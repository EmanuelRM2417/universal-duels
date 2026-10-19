import { simulate, normalizeMoveTarget } from "./battle-engine.js";
import {createPractice,advancePractice,publicPractice,PRACTICE_TTL} from "./practice-session.js";

export const ACTION_MS=60_000, REPLACEMENT_MS=30_000;
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const TYPES=new Set(["fuego","planta","roca","hielo","rayo","metal","guerra","mente","encanto","espectro","divinidad","luz","oscuridad","viento","dragon","agua","veneno","tecnologia","agilidad","valor"]),ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export async function loadPublishedContent(env){if(!env.PUBLIC_CONTENT)throw Error("Contenido público no conectado.");const published=await env.PUBLIC_CONTENT.get("public-v1:current","json");if(!published?.revision||!published?.catalog||!published?.chart)throw Error("No hay un parche público cargado. Cargalo desde el editor privado.");return published;}
async function snapshot(env,revision){if(!env.PUBLIC_CONTENT)throw Error("Contenido público no conectado.");if(revision){if(!/^[a-z0-9-]{1,80}$/.test(revision))throw Error("Revisión inválida.");const frozen=await env.PUBLIC_CONTENT.get(`public-runtime:snapshot:${revision}`,"json");if(frozen)return frozen;const publishedRevision=await env.PUBLIC_CONTENT.get(`public-v1:snapshot:${revision}`,"json");if(publishedRevision)return publishedRevision;}const published=await loadPublishedContent(env);if(revision&&published.revision!==revision)throw Error("La revisión de esta batalla ya no está disponible.");return published;}
async function freezeSnapshot(env,s){
  // Publishing already stores immutable snapshots. Avoid one KV write per new match.
  const key=`public-runtime:snapshot:${s.revision}`;
  if(await env.PUBLIC_CONTENT.get(key))return;
  if(await env.PUBLIC_CONTENT.get(`public-v1:snapshot:${s.revision}`))return;
  await env.PUBLIC_CONTENT.put(key,JSON.stringify(s),{expirationTtl:2592000});
}
export function completedOutcome(result){
  const leftAlive=Array.isArray(result?.leftTeam)&&result.leftTeam.some(u=>u.hp>0);
  const rightAlive=Array.isArray(result?.rightTeam)&&result.rightTeam.some(u=>u.hp>0);
  if(!leftAlive&&!rightAlive)return {finished:true,winner:null,reason:'double_ko'};
  if(!leftAlive)return {finished:true,winner:'guest',reason:'ko'};
  if(!rightAlive)return {finished:true,winner:'host',reason:'ko'};
  return {finished:false,winner:null,reason:null};
}
function publicCatalog(s){return{ok:true,version:s.version,revision:s.revision,publishedAt:s.publishedAt,types:s.types,chart:s.chart,catalog:s.catalog,uiLayout:s.uiLayout||{}};}
function fixedCatalogResponse(s){const res=json(publicCatalog(s));res.headers.set('Cache-Control','public, max-age=31536000, immutable');return res;}
// Stop reading oversized bodies before JSON parsing; Content-Length is optional
// and may be absent or inaccurate for streamed requests.
async function readLimitedJson(request,maxBytes,{allowEmpty=false}={}){
  const advertised=Number(request.headers.get('content-length')||0);
  const tooLarge=()=>Object.assign(new Error('Solicitud demasiado grande.'),{status:413});
  if(advertised>maxBytes)throw tooLarge();
  if(!request.body){if(allowEmpty)return {};throw Error('Se requiere un cuerpo JSON.');}
  const reader=request.body.getReader(),chunks=[];let size=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>maxBytes){await reader.cancel().catch(()=>{});throw tooLarge();}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  if(!size){if(allowEmpty)return {};throw Error('Se requiere un cuerpo JSON.');}
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
function cleanName(v){const n=String(v||"Jugador").trim().replace(/[<>\u0000-\u001f]/g,"").slice(0,20);return n||"Jugador";}
function makeCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",bytes=new Uint8Array(6);crypto.getRandomValues(bytes);return[...bytes].map(x=>chars[x%chars.length]).join("");}
function randomTeam(catalog){const ids=Object.keys(catalog.entities||{});if(ids.length<8)throw Error("Se necesitan al menos 8 personajes publicados para Random Team.");for(let i=ids.length-1;i>0;i--){const b=new Uint32Array(1);crypto.getRandomValues(b);const j=b[0]%(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}return ids.slice(0,8);}
function compactResult(r){return{mode:r.mode,rounds:r.rounds,winner:r.winner,left:r.left,right:r.right,leftActive:r.leftActive,rightActive:r.rightActive,leftActiveIndexes:r.leftActiveIndexes,rightActiveIndexes:r.rightActiveIndexes,leftTeam:r.leftTeam,rightTeam:r.rightTeam,needsReplacement:r.needsReplacement,forcedSwitches:r.forcedSwitches,weather:r.weather,field:r.field,scenario:r.scenario,weatherTurns:r.weatherTurns,fieldTurns:r.fieldTurns,scenarioTurns:r.scenarioTurns};}

async function allowCreation(request,env,kind){
  // Enforce an abuse ceiling, not a gameplay limit. Normal players only have one
  // pending Practice and can start another immediately after the previous ends.
  const address=request.headers.get('CF-Connecting-IP');
  if(!address||!env.ROOMS)return true; // Local tests / development without CF headers.
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(address));
  const hash=Array.from(new Uint8Array(digest)).slice(0,16).map(n=>n.toString(16).padStart(2,'0')).join('');
  const gate=env.ROOMS.get(env.ROOMS.idFromName('security-gate:'+hash));
  const response=await gate.fetch('https://room.internal/creation-gate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind})});
  return response.ok;
}
export default{async fetch(request,env){const url=new URL(request.url);if(request.method==="OPTIONS")return new Response(null,{headers:cors});if(url.pathname==="/health"){try{const s=await loadPublishedContent(env);return json({ok:true,service:"Universal Duels",version:"0.4.0-alpha",revision:s.revision,source:"manual-public-patch"});}catch(e){return json({ok:false,service:"Universal Duels",version:"0.4.0-alpha",error:e.message},503);}}
  if(url.pathname==="/api/catalog"&&request.method==="GET"){try{return json(publicCatalog(await snapshot(env)));}catch(e){return json({error:e.message},503);}}
  const catMatch=url.pathname.match(/^\/api\/catalog\/([a-z0-9-]{1,80})$/i);if(catMatch&&request.method==="GET"){try{return fixedCatalogResponse(await snapshot(env,catMatch[1]));}catch(e){return json({error:e.message},404);}}
  const environmentMatch=url.pathname.match(/^\/api\/environment-visuals\/(scenarios|weathers)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if(environmentMatch&&request.method==='GET'){
    if(!env.PUBLIC_SPRITES)return json({error:'R2 no conectado.'},503);
    try{
      const requestedRevision=url.searchParams.get('revision')||'',snap=await snapshot(env,requestedRevision||undefined);
      const [,category,id]=environmentMatch;
      if(!Object.values(snap.catalog?.[category]||{}).some(x=>x?.definition?.imageId===id))return json({error:'Recurso no publicado.'},404);
      const key=`${category}/${id}`,path=snap.assets?.environment?.[key]||`published/${snap.revision}/environment/${key}.png`;
      const obj=await env.PUBLIC_SPRITES.get(path);
      return obj?new Response(obj.body,{headers:{'Content-Type':'image/png','Cache-Control':requestedRevision?'public, max-age=31536000, immutable':'public, max-age=300','X-Content-Type-Options':'nosniff'}}):json({error:'Recurso no encontrado.'},404);
    }catch(e){return json({error:String(e.message||e)},404);}
  }
  const audioMatch=url.pathname.match(/^\/api\/audio\/(global|scenarios)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if(audioMatch&&request.method==='GET'){
    if(!env.PUBLIC_SPRITES)return json({error:'Audio público no conectado.'},503);
    try{
      const requestedRevision=url.searchParams.get('revision')||'',snap=await snapshot(env,requestedRevision||undefined);
      const [,category,id]=audioMatch,key=category==='global'?id:`scenarios/${id}`;
      if(category==='scenarios'&&!Object.values(snap.catalog?.scenarios||{}).some(x=>x?.definition?.soundId===id))return json({error:'Audio no publicado.'},404);
      const assetPath=snap.assets?.audio?.[key];
      if(!assetPath)return json({error:'Audio no configurado.'},404);
      const obj=await env.PUBLIC_SPRITES.get(assetPath);
      return obj?new Response(obj.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':requestedRevision?'public, max-age=31536000, immutable':'public, max-age=300','X-Content-Type-Options':'nosniff'}}):json({error:'Audio no encontrado.'},404);
    }catch(e){return json({error:String(e.message||e)},404);}
  }
  const spriteMatch=url.pathname.match(/^\/api\/sprites\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);if(spriteMatch&&request.method==="GET"){if(!env.PUBLIC_SPRITES)return json({error:"Sprites públicos no conectados."},503);try{const requestedRevision=url.searchParams.get("revision")||"",s=await snapshot(env,requestedRevision||undefined),id=spriteMatch[1],published=Object.values(s.catalog?.entities||{}).some(e=>e?.definition?.spriteId===id);if(!published)return json({error:"Sprite no publicado."},404);const assetPath=s.assets?.sprites?.[id]||`published/${s.revision}/sprites/${id}.png`;const obj=await env.PUBLIC_SPRITES.get(assetPath);if(!obj)return json({error:"Sprite no encontrado en este parche."},404);return new Response(obj.body,{headers:{"Content-Type":"image/png","Cache-Control":requestedRevision?"public, max-age=31536000, immutable":"public, max-age=300","X-Content-Type-Options":"nosniff"}});}catch(e){return json({error:e.message},404);}}
  const typeMatch=url.pathname.match(/^\/api\/type-icons\/([a-z]+)$/);if(typeMatch&&request.method==="GET"){if(!TYPES.has(typeMatch[1]))return json({error:"Tipo desconocido."},404);if(!env.PUBLIC_SPRITES)return json({error:"Sprites públicos no conectados."},503);try{const requestedRevision=url.searchParams.get("revision")||"",s=await snapshot(env,requestedRevision||undefined),assetPath=s.assets?.typeIcons?.[typeMatch[1]]||`published/${s.revision}/type-icons/${typeMatch[1]}.png`,obj=await env.PUBLIC_SPRITES.get(assetPath);if(!obj)return json({error:"Icono no encontrado en este parche."},404);return new Response(obj.body,{headers:{"Content-Type":"image/png","Cache-Control":requestedRevision?"public, max-age=31536000, immutable":"public, max-age=300","X-Content-Type-Options":"nosniff"}});}catch(e){return json({error:e.message},404);}}
  if(url.pathname==="/api/practice"&&request.method==="POST"){
    try{
      if(!await allowCreation(request,env,'practice'))return json({error:'Demasiadas solicitudes en poco tiempo. Probá más tarde.'},429);
      const input=await readLimitedJson(request,4096),snap=await snapshot(env);
      // A random, browser-held credential identifies one practice slot. It is
      // not a visible match seed and never affects combat randomness.
      const token=typeof input.token==='string'&&/^[0-9a-f-]{64,80}$/i.test(input.token)
        ?input.token:crypto.randomUUID()+crypto.randomUUID();
      const stub=env.ROOMS.get(env.ROOMS.idFromName('practice:'+token));
      const response=await stub.fetch('https://room.internal/practice/init',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,revision:snap.revision})});
      const data=await response.json();
      return json({...data,...(response.ok?{token}:{})},response.status);
    }catch(e){return json({error:String(e.message||e)},e.status||400);}
  }
  const practiceMatch=url.pathname.match(/^\/api\/practice\/([0-9a-f-]{64,80})$/i);
  if(practiceMatch){
    const stub=env.ROOMS.get(env.ROOMS.idFromName('practice:'+practiceMatch[1]));
    return stub.fetch(new Request('https://room.internal/practice/session',{method:request.method,headers:request.headers,body:['POST','PUT'].includes(request.method)?request.body:undefined,duplex:'half'}));
  }
  if(url.pathname==="/api/rooms"&&request.method==="POST"){
    let body;try{body=await readLimitedJson(request,2048,{allowEmpty:true});}catch(e){return json({error:String(e.message||e)},e.status||400);}
    if(!await allowCreation(request,env,'room'))return json({error:'Demasiadas salas creadas en poco tiempo.'},429);
    const code=makeCode(),id=env.ROOMS.idFromName(code),stub=env.ROOMS.get(id),battleMode=body.battleMode==="doubles"?"doubles":"singles",teamMode=body.teamMode==="random"?"random":"picked";const init=await stub.fetch("https://room.internal/init",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,createdAt:Date.now(),battleMode,teamMode})});if(!init.ok)return json({error:"No se pudo crear la sala."},500);return json({code});}
  const roomMatch=url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})$/i);if(roomMatch){const code=roomMatch[1].toUpperCase(),id=env.ROOMS.idFromName(code),stub=env.ROOMS.get(id),target=new URL(request.url);target.pathname="/connect";target.searchParams.set("code",code);target.searchParams.set("name",cleanName(url.searchParams.get("name")));return stub.fetch(new Request(target,request));}
  if(env.ASSETS)return env.ASSETS.fetch(request);return json({error:"Ruta no encontrada."},404);
}};

export class Room{
  constructor(state,env){this.state=state;this.storage=state.storage;this.env=env;this.snapshotCache=new Map();}
  async getSnapshot(revision){
    const key=revision||"current",cached=this.snapshotCache.get(key);
    // Immutable revisions are safe to cache. The current pointer is mutable; never cache it.
    if(revision&&cached)return cached;
    const value=await snapshot(this.env,revision);
    if(revision){this.snapshotCache.set(key,value);if(this.snapshotCache.size>3)this.snapshotCache.delete(this.snapshotCache.keys().next().value);}
    return value;
  }
  async fetch(request){const url=new URL(request.url);
    if(url.pathname==='/creation-gate'&&request.method==='POST'){
      const {kind}=await request.json(),now=Date.now(),key='creation-gate-v1';
      if(!['practice','room'].includes(kind))return json({error:'Solicitud inválida.'},400);
      const old=await this.storage.get(key)||{start:now,practice:0,room:0};
      const count=now-old.start<3_600_000?old:{start:now,practice:0,room:0};
      // This is an anti-abuse guard (240 practice starts / 40 new rooms per hour),
      // not an arbitrary limit of 3 Practice matches.
      if(count[kind]>=(kind==='practice'?240:40))return json({error:'Límite de seguridad alcanzado.'},429);
      count[kind]++;await this.storage.put(key,count);await this.storage.setAlarm(count.start+3_600_000);
      return json({ok:true});
    }
    if(url.pathname.startsWith('/practice/')){
      try{
        if(url.pathname==='/practice/init'&&request.method==='POST'){
          const existing=await this.storage.get('practice');
          // Never overwrite a pending match: opening practice resumes it.
          if(existing&&Date.now()<existing.expiresAt&&existing.status==='playing')
            return json({ok:true,practice:publicPractice(existing),resumed:true});
          const body=await readLimitedJson(request,4096),snap=await this.getSnapshot(body.revision);
          const practice=createPractice({catalog:snap.catalog,chart:snap.chart,revision:snap.revision,mode:body.mode,difficulty:body.difficulty,leftTeam:body.leftTeam,rightTeam:body.rightTeam});
          await this.storage.put('practice',practice);await this.storage.setAlarm(practice.expiresAt);
          return json({ok:true,practice:publicPractice(practice)});
        }
        if(url.pathname!=='/practice/session')return json({error:'Ruta no encontrada.'},404);
        const practice=await this.storage.get('practice');
        if(!practice||Date.now()>=practice.expiresAt)return json({error:'La partida expiró o no existe.'},410);
        if(request.method==='GET')return json({ok:true,practice:publicPractice(practice)});
        if(request.method==='DELETE')return json({error:'Terminá la partida antes de crear otra.'},409);
        if(request.method!=='POST')return json({error:'Método inválido.'},405);
        const input=await readLimitedJson(request,8192),snap=await this.getSnapshot(practice.revision);
        const state=advancePractice(practice,input.operation,input,{catalog:snap.catalog,chart:snap.chart});
        await this.storage.put('practice',practice);await this.storage.setAlarm(practice.expiresAt);
        return json({ok:true,practice:state});
      }catch(e){return json({error:String(e.message||e)},e.status||400);}
    }
if(url.pathname==="/init"&&request.method==="POST"){const b=await request.json(),cur=await this.storage.get("room");if(!cur){await this.storage.put("room",{code:b.code,createdAt:b.createdAt,battleMode:b.battleMode==="doubles"?"doubles":"singles",teamMode:b.teamMode==="random"?"random":"picked",players:[],battle:null});await this.storage.setAlarm(Number(b.createdAt||Date.now())+6*60*60*1000);}return new Response("ok");}if(url.pathname!=="/connect")return new Response("Not found",{status:404});if(request.headers.get("Upgrade")!=="websocket")return new Response("Se requiere WebSocket",{status:426});const room=await this.getRoom();if(!room.code)return new Response(JSON.stringify({error:"La sala no existe o expiró."}),{status:404,headers:{"Content-Type":"application/json"}});const sockets=this.state.getWebSockets();
    const credential=url.searchParams.get("session")||"";
    const existing=(room.players||[]).find(p=>p.session&&p.session===credential);
    // Never infer identity from an available socket: a disconnect must not free a player's seat.
    if(credential&&!existing)return json({error:"Credencial de sesión inválida."},403);
    const role=existing?.role||(!room.players.some(p=>p.role==="host")?"host":(!room.players.some(p=>p.role==="guest")?"guest":null));
    if(!role)return json({error:"La sala ya tiene dos participantes. Necesitás tu sesión para volver."},409);
    const name=existing?.name||cleanName(url.searchParams.get("name"));
    const session=existing?.session||crypto.randomUUID()+"-"+crypto.randomUUID();
    const connectionId=crypto.randomUUID();
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];
    this.state.acceptWebSocket(server);
    server.serializeAttachment({role,name,connectionId});
    let player=existing;
    if(!player){player={role,name,session,ready:false,team:[],runtimeTeam:[],connected:true};room.players.push(player);}
    player.connectionId=connectionId;
    player.connected=true;
    await this.storage.put("room",room);
    // Older devices remain subscribed, but are read-only. Their actions are rejected server-side.
    for(const old of sockets){if(old===server)continue;const a=old.deserializeAttachment()||{};if(a.role===role)this.send(old,{type:"session_observer",message:"Esta sesión se controla desde un dispositivo más reciente."});}
    this.send(server,{type:"welcome",role,code:room.code,session,controller:true});
    this.send(server,{type:"room",room:this.publicRoom(room)});
    if(room.battle)this.send(server,{type:"battle_sync",battle:this.publicBattle(room,role)});
    this.broadcastRoom(room);
    return new Response(null,{status:101,webSocket:client});}
  async webSocketMessage(socket,message){
    if((typeof message==='string'?message.length:message?.byteLength||0)>8192){this.send(socket,{type:'error',message:'Mensaje demasiado grande.'});return;}
    let data;try{data=JSON.parse(typeof message==="string"?message:new TextDecoder().decode(message));}catch{return;}const role=socket.deserializeAttachment()?.role;if(!role)return;const room=await this.getRoom(),player=room.players.find(p=>p.role===role);if(!player)return;const attachment=socket.deserializeAttachment()||{};if(attachment.connectionId!==player.connectionId){this.send(socket,{type:"session_observer",message:"Solo el dispositivo más reciente puede realizar acciones."});return;}
    if(data.type==="ping"){this.send(socket,{type:"pong",at:Date.now()});return;}
    if(data.type==="settings"){if(role!=="host"){this.send(socket,{type:"error",message:"Solo el creador puede cambiar la modalidad."});return;}if(room.battle?.status==="playing"){this.send(socket,{type:"error",message:"No se puede cambiar la modalidad durante una batalla."});return;}room.battleMode=data.battleMode==="doubles"?"doubles":"singles";room.teamMode=data.teamMode==="random"?"random":"picked";for(const p of room.players)p.ready=false;await this.storage.put("room",room);this.broadcastRoom(room);return;}
    if(data.type==="team"){if(room.battle?.status==="playing"){this.send(socket,{type:"error",message:"No podés cambiar el equipo durante una batalla."});return;}let s;try{s=await this.getSnapshot();}catch(e){this.send(socket,{type:"error",message:e.message});return;}if(!Array.isArray(data.team)||data.team.length!==8||new Set(data.team).size!==8||data.team.some(id=>!ID.test(id||"")||!s.catalog.entities[id])){this.send(socket,{type:"error",message:"El equipo debe contener 8 personajes publicados distintos."});return;}player.team=[...data.team];player.ready=false;}
    else if(data.type==="ready"){if(room.teamMode==="picked"&&player.team.length!==8){this.send(socket,{type:"error",message:"Guardá un equipo de 8 antes de marcarte listo."});return;}player.ready=!!data.ready;}
    else if(data.type==="select_order"){if(room.battle?.status!=="playing"||room.battle.phase!=="action"){this.send(socket,{type:"error",message:"Ahora no se están eligiendo acciones."});return;}try{const normalized=await this.normalizeOrder(room,role,data.order);room.battle.selection[role]=normalized;await this.storage.put("room",room);if(room.battle.selectionDeadline)await this.storage.setAlarm(room.battle.selectionDeadline);this.send(socket,{type:"selection_accepted",round:room.battle.round});this.broadcast({type:"battle_selection",round:room.battle.round,host:!!room.battle.selection.host,guest:!!room.battle.selection.guest});}catch(e){this.send(socket,{type:"error",message:String(e.message||e)});}return;}
    else if(data.type==="cancel_selection"){if(room.battle?.status!=="playing"||room.battle.phase!=="action")return;if(room.battle.pending?.[role]){this.send(socket,{type:"error",message:"La acción ya fue enviada para esta ronda."});return;}room.battle.selection[role]=null;await this.storage.put("room",room);this.broadcast({type:"battle_selection",round:room.battle.round,host:!!room.battle.selection.host,guest:!!room.battle.selection.guest});return;}
    else if(data.type==="order"){await this.handleOrder(socket,room,role,data.order);return;}
    else if(data.type==="replacement"){await this.handleReplacement(socket,room,role,data.choices);return;}
    else if(data.type==="surrender"){if(room.battle?.status!=="playing")return;room.battle.status="finished";room.battle.winner=role==="host"?"guest":"host";room.battle.finishReason="surrender";await this.storage.put("room",room);this.broadcastBattle(room,"battle_result",{reason:"surrender"});return;}
    else if(data.type==="return_lobby"){if(room.battle?.status!=="finished")return;await this.resetAfterBattle(room);return;}
    else{this.send(socket,{type:"error",message:"Mensaje no reconocido por el servidor."});return;}
    await this.storage.put("room",room);this.broadcastRoom(room);await this.maybeStartBattle(room);
  }
  async maybeStartBattle(room){if(room.battle?.status==="playing")return;const host=room.players.find(p=>p.role==="host"),guest=room.players.find(p=>p.role==="guest");if(!host||!guest||!host.ready||!guest.ready)return;let s;try{s=await this.getSnapshot();}catch(e){this.broadcast({type:"error",message:e.message});return;}try{if(room.teamMode==="random"){host.runtimeTeam=randomTeam(s.catalog);guest.runtimeTeam=randomTeam(s.catalog);}else{if(host.team.length!==8||guest.team.length!==8)return;host.runtimeTeam=[...host.team];guest.runtimeTeam=[...guest.team];}await freezeSnapshot(this.env,s);const result=simulate({leftTeam:host.runtimeTeam,rightTeam:guest.runtimeTeam,catalog:s.catalog,chart:s.chart,turns:0,mode:room.battleMode,randomTape:[],includeCheckpoint:true});room.battle={status:"playing",phase:"action",mode:room.battleMode,teamMode:room.teamMode,revision:s.revision,round:1,leftOrders:[],rightOrders:[],leftReplacements:[],rightReplacements:[],pending:{host:null,guest:null},selection:{host:null,guest:null},replacementPending:{host:null,guest:null},selectionDeadline:Date.now()+ACTION_MS,replacementDeadline:null,randomTape:[],checkpoint:result.checkpoint,logLength:result.log.length,lastState:compactResult(result),recentLog:result.log.slice(-120),winner:null,finishReason:null};await this.storage.put("room",room);await this.storage.setAlarm(room.battle.selectionDeadline);this.broadcastBattle(room,"battle_start",{logs:result.log,visualEvents:result.visualEvents});}catch(e){this.broadcast({type:"error",message:"No se pudo iniciar: "+String(e.message||e)});}}
  sideForRole(role){return role==="host"?"left":"right";}
  async normalizeOrder(room,role,order){const b=room.battle;if(!b||b.status!=="playing"||b.phase!=="action")throw Error("La batalla no está esperando acciones.");if(!order||typeof order!=="object"||!Array.isArray(order.actions))throw Error("Acciones inválidas.");const side=this.sideForRole(role),active=side==="left"?b.lastState.leftActive:b.lastState.rightActive,team=side==="left"?b.lastState.leftTeam:b.lastState.rightTeam,needed=b.mode==="doubles"?2:1,s=await this.getSnapshot(b.revision),out=[],destinations=new Set();for(let slot=0;slot<needed;slot++){const unit=active.find(u=>Number(u.activeSlot)===slot);if(!unit||unit.hp<=0)continue;const raw=order.actions.find(a=>Number(a.slot)===slot);if(!raw)throw Error(`Falta la acción del personaje ${slot+1}.`);if(raw.switch!==undefined){const i=Number(raw.switch);if(!Number.isInteger(i)||i<0||i>=team.length||team[i].hp<=0||b.lastState[side+"ActiveIndexes"].includes(i)||destinations.has(i))throw Error("Cambio inválido.");destinations.add(i);out.push({slot,switch:i});continue;}if(typeof raw.move!=="string"||!ID.test(raw.move))throw Error("Movimiento inválido.");const ent=s.catalog.entities[unit.id],allowed=[...(ent?.definition?.moveIds||[]),ent?.definition?.uniqueMoveId].filter(Boolean);if(!allowed.includes(raw.move))throw Error("Ese movimiento no pertenece al personaje activo.");if((unit.cooldowns?.[raw.move]||0)>0)throw Error("Ese movimiento todavía está en cooldown.");const m=s.catalog.moves[raw.move],targeting=normalizeMoveTarget(m?.definition||{}),act={slot,move:raw.move};if(b.mode==="doubles"&&targeting==="single"){const t=raw.target;if(!t||!["left","right"].includes(t.side)||![0,1].includes(Number(t.slot)))throw Error("Elegí un objetivo válido.");const targetActive=t.side==="left"?b.lastState.leftActive:b.lastState.rightActive,target=targetActive.find(x=>Number(x.activeSlot)===Number(t.slot));if(!target||target.hp<=0||(t.side===side&&Number(t.slot)===slot))throw Error("Ese personaje no puede ser objetivo.");act.target={side:t.side,slot:Number(t.slot)};}if(raw.switchChoice){const c=raw.switchChoice,i=Number(c.teamIndex);if(c.side!==side||Number(c.slot)!==slot||!Number.isInteger(i)||i<0||i>=team.length||team[i].hp<=0||b.lastState[side+"ActiveIndexes"].includes(i))throw Error("Relevo del efecto inválido.");act.switchChoice={side,slot,teamIndex:i};}out.push(act);}return{actions:out};}
  async handleOrder(socket,room,role,order){const b=room.battle;if(!b||b.status!=="playing"||b.phase!=="action"){this.send(socket,{type:"error",message:"La batalla no está esperando acciones."});return;}if(b.selectionDeadline&&Date.now()>=b.selectionDeadline){await this.finishOnTimeout(room,role);return;}if(b.pending[role]){this.send(socket,{type:"error",message:"Ya enviaste tus acciones."});return;}try{order=await this.normalizeOrder(room,role,order);}catch(e){this.send(socket,{type:"error",message:String(e.message||e)});return;}const selected=b.selection[role];if(!selected||JSON.stringify(selected)!==JSON.stringify(order)){this.send(socket,{type:"error",message:"La selección cambió. Elegí las acciones nuevamente."});return;}b.pending[role]=order;await this.storage.put("room",room);this.send(socket,{type:"order_accepted",round:b.round});if(b.pending.host&&b.pending.guest)await this.resolveRound(room);}
  async resolveRound(room){const b=room.battle,host=room.players.find(p=>p.role==="host"),guest=room.players.find(p=>p.role==="guest");try{const s=await this.getSnapshot(b.revision),leftOrders=[...b.leftOrders,b.pending.host],rightOrders=[...b.rightOrders,b.pending.guest],result=simulate({leftTeam:host.runtimeTeam,rightTeam:guest.runtimeTeam,catalog:s.catalog,chart:s.chart,turns:b.round,mode:b.mode,leftOrders,rightOrders,leftReplacements:b.leftReplacements,rightReplacements:b.rightReplacements,randomTape:b.checkpoint?[]:b.randomTape,
  resume:b.checkpoint||null,includeCheckpoint:true}),start=b.logLength||0,
  newLogs=b.checkpoint?result.log:result.log.slice(start),
  newVisual=b.checkpoint?result.visualEvents.map(e=>({...e,logIndex:e.logIndex+start})):result.visualEvents.filter(e=>e.logIndex>=start);b.leftOrders=leftOrders;b.rightOrders=rightOrders;b.randomTape=b.checkpoint?[]:result.randomTape;b.checkpoint=result.checkpoint;b.logLength=start+newLogs.length;b.lastState=compactResult(result);b.recentLog=[...b.recentLog,...newLogs].slice(-160);b.pending={host:null,guest:null};b.selection={host:null,guest:null};b.selectionDeadline=null;const outcome=completedOutcome(result);if(outcome.finished){b.status="finished";b.phase="finished";b.winner=outcome.winner;b.finishReason=outcome.reason;}else if(["left","right"].some(side=>(result.needsReplacement[side]?.length||0)>0&&result[side+"Team"].some((unit,i)=>unit.hp>0&&!result[side+"ActiveIndexes"].includes(i)))){b.phase="replacement";b.replacementPending={host:null,guest:null};b.replacementDeadline=Date.now()+REPLACEMENT_MS;}else{b.round++;b.phase="action";b.selectionDeadline=Date.now()+ACTION_MS;}await this.storage.put("room",room);await this.storage.setAlarm(b.replacementDeadline||b.selectionDeadline||Number(room.createdAt||Date.now())+6*60*60*1000);this.broadcastBattle(room,outcome.finished?"battle_result":"battle_round",{logs:newLogs,visualEvents:newVisual,logStart:start});}catch(e){b.pending={host:null,guest:null};b.selection={host:null,guest:null};await this.storage.put("room",room);this.broadcast({type:"error",message:"No se pudo resolver la ronda: "+String(e.message||e)});}}
  normalizeReplacement(room,role,choices){
    const b=room.battle,side=this.sideForRole(role),required=b.lastState.needsReplacement?.[side]||[];
    if(!required.length)return [];
    const team=side==="left"?b.lastState.leftTeam:b.lastState.rightTeam,active=side==="left"?b.lastState.leftActiveIndexes:b.lastState.rightActiveIndexes;
    const available=team.map((unit,i)=>unit.hp>0&&!active.includes(i)?i:-1).filter(i=>i>=0);
    const count=Math.min(required.length,available.length);
    if(!Array.isArray(choices)||choices.length!==count)throw Error("Elegí los reemplazos disponibles.");
    const used=new Set(),slots=new Set();
    return choices.map(c=>{
      const slot=Number(c?.slot),i=Number(c?.teamIndex);
      if(!required.includes(slot)||slots.has(slot)||!available.includes(i)||used.has(i))throw Error("Reemplazo inválido.");
      used.add(i);slots.add(slot);return{slot,teamIndex:i};
    });
  }
  randomReplacements(b,role){
    const side=this.sideForRole(role),required=[...(b.lastState.needsReplacement?.[side]||[])];
    const team=side==="left"?b.lastState.leftTeam:b.lastState.rightTeam,active=side==="left"?b.lastState.leftActiveIndexes:b.lastState.rightActiveIndexes;
    const available=team.map((unit,i)=>unit.hp>0&&!active.includes(i)?i:-1).filter(i=>i>=0);
    const pick=n=>{const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);return bytes[0]%n;};
    const choices=[];
    while(required.length&&available.length){const slot=required.splice(pick(required.length),1)[0],teamIndex=available.splice(pick(available.length),1)[0];choices.push({slot,teamIndex});}
    return choices;
  }
  async finishOnTimeout(room,loser){
    const b=room.battle;b.status="finished";b.phase="finished";b.winner=loser==="host"?"guest":"host";b.finishReason="timeout";b.selectionDeadline=null;b.replacementDeadline=null;
    await this.storage.put("room",room);this.broadcastBattle(room,"battle_result");
  }
  async handleReplacement(socket,room,role,choices){const b=room.battle;if(!b||b.status!=="playing"||b.phase!=="replacement"){this.send(socket,{type:"error",message:"Ahora no se están eligiendo reemplazos."});return;}if(b.replacementDeadline&&Date.now()>=b.replacementDeadline){this.send(socket,{type:"error",message:"Terminó el tiempo de sustitución."});return;}let normalized;try{normalized=this.normalizeReplacement(room,role,choices);}catch(e){this.send(socket,{type:"error",message:String(e.message||e)});return;}b.replacementPending[role]=normalized;await this.storage.put("room",room);const hostNeeds=(b.lastState.needsReplacement.left||[]).length>0,guestNeeds=(b.lastState.needsReplacement.right||[]).length>0;if((!hostNeeds||b.replacementPending.host)&&(!guestNeeds||b.replacementPending.guest))await this.applyReplacements(room);else this.broadcastBattle(room,"battle_replacement_waiting");}
  async applyReplacements(room){const b=room.battle,host=room.players.find(p=>p.role==="host"),guest=room.players.find(p=>p.role==="guest"),left=[...b.leftReplacements],right=[...b.rightReplacements];left[b.round-1]={choices:b.replacementPending.host||[]};right[b.round-1]={choices:b.replacementPending.guest||[]};try{const s=await this.getSnapshot(b.revision),result=simulate({leftTeam:host.runtimeTeam,rightTeam:guest.runtimeTeam,catalog:s.catalog,chart:s.chart,turns:b.round,mode:b.mode,leftOrders:b.leftOrders,rightOrders:b.rightOrders,leftReplacements:left,rightReplacements:right,randomTape:b.checkpoint?[]:b.randomTape,
  resume:b.checkpoint||null,replacementsOnly:!!b.checkpoint,includeCheckpoint:true}),start=b.logLength,
  newLogs=b.checkpoint?result.log:result.log.slice(start),
  newVisual=b.checkpoint?result.visualEvents.map(e=>({...e,logIndex:e.logIndex+start})):result.visualEvents.filter(e=>e.logIndex>=start);b.leftReplacements=left;b.rightReplacements=right;b.randomTape=b.checkpoint?[]:result.randomTape;b.checkpoint=result.checkpoint;b.logLength=start+newLogs.length;b.lastState=compactResult(result);b.recentLog=[...b.recentLog,...newLogs].slice(-160);b.replacementPending={host:null,guest:null};b.round++;b.phase="action";b.replacementDeadline=null;b.selectionDeadline=Date.now()+ACTION_MS;await this.storage.put("room",room);await this.storage.setAlarm(b.selectionDeadline);this.broadcastBattle(room,"battle_replacement",{logs:newLogs,visualEvents:newVisual,logStart:start});}catch(e){this.broadcast({type:"error",message:"No se pudo aplicar el reemplazo: "+String(e.message||e)});}}
  async resetAfterBattle(room){for(const p of room.players){p.ready=false;p.runtimeTeam=[];}room.battle=null;await this.storage.put("room",room);this.broadcast({type:"battle_return_lobby"});this.broadcastRoom(room);}
  publicBattle(room,role){const b=room.battle;if(!b)return null;return{status:b.status,phase:b.phase,mode:b.mode,teamMode:b.teamMode,revision:b.revision,round:b.round,state:b.lastState,recentLog:b.recentLog||[],winner:b.winner||null,finishReason:b.finishReason||null,submitted:!!b.pending?.[role],opponentSubmitted:!!b.pending?.[role==="host"?"guest":"host"],selected:!!b.selection?.[role],opponentSelected:!!b.selection?.[role==="host"?"guest":"host"],replacementSubmitted:!!b.replacementPending?.[role],selectionDeadline:b.selectionDeadline||null,replacementDeadline:b.replacementDeadline||null};}
  broadcastBattle(room,type,extra={}){for(const s of this.state.getWebSockets()){let role;try{role=s.deserializeAttachment()?.role}catch{}if(role)this.send(s,{type,battle:this.publicBattle(room,role),...extra});}}
  broadcastRoom(room){this.broadcast({type:"room",room:this.publicRoom(room)});}publicRoom(room){return{code:room.code,battleMode:room.battleMode||"singles",teamMode:room.teamMode||"picked",players:(room.players||[]).map(p=>({role:p.role,name:p.name,ready:!!p.ready,teamCount:(p.team||[]).length,connected:!!p.connected})),capacity:2,battleStatus:room.battle?.status||null};}
  async webSocketClose(socket){await this.removeSocket(socket);}async webSocketError(socket){await this.removeSocket(socket);}async removeSocket(socket){let a={};try{a=socket.deserializeAttachment()||{}}catch{}const room=await this.getRoom(),p=room.players.find(x=>x.role===a.role);if(!p||p.connectionId!==a.connectionId)return;p.connected=false;await this.storage.put("room",room);this.broadcastRoom(room);this.broadcast({type:"notice",message:"Un jugador se desconectó. Su partida continuará y podrá reconectarse."});}
  async alarm(){
    const room=await this.getRoom(),now=Date.now(),b=room.battle;
    if(b?.status==="playing"&&b.phase==="action"&&b.selectionDeadline){
      if(b.selectionDeadline<=now){
        const missing=["host","guest"].filter(role=>!b.pending?.[role]);
        if(missing.length===2){b.status="finished";b.phase="finished";b.winner=null;b.finishReason="both_timeout";b.selectionDeadline=null;await this.storage.put("room",room);this.broadcastBattle(room,"battle_result");}
        else if(missing.length===1)await this.finishOnTimeout(room,missing[0]);
        else await this.resolveRound(room);
        return;
      }
      await this.storage.setAlarm(b.selectionDeadline);return;
    }
    if(b?.status==="playing"&&b.phase==="replacement"&&b.replacementDeadline){
      if(b.replacementDeadline<=now){
        for(const role of ["host","guest"])if(!b.replacementPending[role])b.replacementPending[role]=this.randomReplacements(b,role);
        await this.applyReplacements(room);return;
      }
      await this.storage.setAlarm(b.replacementDeadline);return;
    }
    const practice=await this.storage.get('practice');
    if(practice){if(now>=practice.expiresAt)await this.storage.delete('practice');else await this.storage.setAlarm(practice.expiresAt);return;}
    const expires=Number(room.createdAt||now)+6*60*60*1000;
    if(now<expires){await this.storage.setAlarm(expires);return;}
    for(const socket of this.state.getWebSockets()){try{socket.close(1000,"Sala expirada")}catch{}}
    await this.storage.delete("room");
  }
  async getRoom(){return(await this.storage.get("room"))||{code:"",players:[],battle:null};}send(socket,data){try{socket.send(JSON.stringify(data))}catch{}}broadcast(data){for(const socket of this.state.getWebSockets())this.send(socket,data);}
}
