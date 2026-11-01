/* Monitoring messages are server-owned. Never expose this Durable Object on public endpoints. */
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const now=()=>Date.now();
const ONLINE_MS=65_000,ROOM_MS=6*60*60_000,PRACTICE_MS=30*60_000;
const presenceKey=id=>'monitor:presence:'+id;
const matchKey=id=>'monitor:match:'+id;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateTelemetry(body){return body&&UUID.test(body.tabId||'')&&['home','practice','catalog','tutorial'].includes(body.page)&&typeof body.pageview==='boolean';}
export async function notifyMonitor(env,event){if(!env.ROOMS)return;const stub=env.ROOMS.get(env.ROOMS.idFromName('ud-monitor:v1'));const result=await stub.fetch('https://room.internal/monitor/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)});if(!result.ok)throw Error('Fallo registrando el monitoreo.');}
export async function reportMatch(env,match){const id=String(match?.id||'');if(!/^(room:[A-Z0-9]{6}|practice:[0-9a-f-]{64,80})$/i.test(id))return;await notifyMonitor(env,{type:'match',id,kind:match.kind==='room'?'room':'practice',mode:match.mode==='doubles'?'doubles':'singles',status:match.status==='playing'?'playing':'ended',code:typeof match.code==='string'?match.code.slice(0,6):'',players:Math.max(0,Math.min(2,Number(match.players)||0)),at:now()});}
export async function handleMonitorDO(instance,request){const path=new URL(request.url).pathname,storage=instance.storage;
 if(path==='/monitor/ws'&&request.headers.get('Upgrade')?.toLowerCase()==='websocket'){
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];instance.state.acceptWebSocket(server,['admin-monitor']);
  server.send(JSON.stringify({type:'snapshot',data:await monitorSnapshot(instance)}));return new Response(null,{status:101,webSocket:client});
 }
 if(path==='/monitor/snapshot')return reply({ok:true,data:await monitorSnapshot(instance)});
 if(path!=='/monitor/event'||request.method!=='POST')return reply({error:'No encontrado.'},404);
 const e=await request.json();const at=now();
 if(e.type==='presence'){
  if(!validateTelemetry(e))return reply({error:'Visita inválida.'},400);
  const key=presenceKey(e.tabId),old=await storage.get(key);
  if(!old||at-Number(old.at||0)>ONLINE_MS){
   const totals=await storage.get('monitor:totals')||{visits:0,pageviews:0};totals.visits++;totals.pageviews++;await storage.put('monitor:totals',totals);
  }else if(e.pageview){const totals=await storage.get('monitor:totals')||{visits:0,pageviews:0};totals.pageviews++;await storage.put('monitor:totals',totals);}
  await storage.put(key,{at,page:e.page,account:e.account||null});
  await storage.setAlarm(at+ONLINE_MS+5000);
  // A heartbeat renews presence without needlessly broadcasting a new snapshot.
  if(!old||at-Number(old.at||0)>ONLINE_MS||old.account!==e.account)await pushMonitorSnapshot(instance);
  return reply({ok:true});
 }
 if(e.type==='match'){
  if(!/^(room:[A-Z0-9]{6}|practice:[0-9a-f-]{64,80})$/i.test(e.id||''))return reply({error:'Partida inválida.'},400);
  if(e.status==='ended')await storage.delete(matchKey(e.id));
  else await storage.put(matchKey(e.id),{id:e.id,kind:e.kind,mode:e.mode,code:e.code||'',players:e.players||0,at,startedAt:Number(e.startedAt)||at});
  await pushMonitorSnapshot(instance);return reply({ok:true});
 }
 if(e.type==='profile'){
  if(!/^[a-z0-9]{8}$/.test(e.publicId||''))return reply({error:'Perfil inválido.'},400);
  for(const socket of instance.state.getWebSockets('admin-monitor')){try{socket.send(JSON.stringify({type:'profile-change',id:e.publicId}));}catch{}}
  return reply({ok:true});
 }
 return reply({error:'Evento inválido.'},400);
}
export async function monitorSnapshot(instance){
 const at=now(),presence=await instance.storage.list({prefix:'monitor:presence:',limit:5000}),matches=await instance.storage.list({prefix:'monitor:match:',limit:2000});
 const connectedKeys=new Set(),accountIds=new Set();let stale=[];
 for(const [key,p]of presence){if(at-Number(p.at||0)>ONLINE_MS)stale.push(key);else{connectedKeys.add(p.account?'account:'+p.account:key);if(p.account)accountIds.add(p.account);}}
 const active={room:[],practice:[]};
 for(const [key,m]of matches){const ttl=m.kind==='room'?ROOM_MS:PRACTICE_MS;if(at-Number(m.at||0)>ttl)stale.push(key);else active[m.kind==='room'?'room':'practice'].push(m);}
 if(stale.length)await Promise.all(stale.map(key=>instance.storage.delete(key)));
 const totals=await instance.storage.get('monitor:totals')||{visits:0,pageviews:0};
 return {at,visits:totals.visits,pageviews:totals.pageviews,connected:connectedKeys.size,registeredConnected:accountIds.size,active,roomBattles:active.room.length,practiceBattles:active.practice.length};
}
export async function pushMonitorSnapshot(instance){const sockets=instance.state.getWebSockets('admin-monitor');if(!sockets.length)return;const message=JSON.stringify({type:'snapshot',data:await monitorSnapshot(instance)});for(const ws of sockets){try{ws.send(message);}catch{}}}
