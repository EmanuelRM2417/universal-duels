import assert from 'node:assert/strict';
import app,{Room} from './worker.js';
import {simulate} from './battle-engine.js';

const ent=id=>({id,name:id,definition:{spriteId:'cat-image',types:['fuego'],hp:400,attack:90,defense:100,specialAttack:90,specialDefense:100,speed:100,moveIds:['hit','set-weather','set-field'],uniqueMoveId:'set-scenario',globalAbilityId:'none',uniqueAbilityId:'none'}});
const attack={id:'hit',name:'Golpe',definition:{type:'fuego',category:'physical',power:8,accuracy:100,criticalChance:0,priority:0,rules:[]}};
const environmentMove=(id,type,value)=>({id,name:id,definition:{type:'fuego',category:'status',power:0,accuracy:0,criticalChance:0,priority:0,rules:[{event:'manual',target:'self',chance:100,action:{type,value}}]}});
const catalog={entities:Object.fromEntries(Array.from({length:8},(_,i)=>['e'+i,ent('e'+i)])),moves:{hit:attack,'set-weather':environmentMove('set-weather','set_weather','rain'),'set-field':environmentMove('set-field','set_field','sand'),'set-scenario':environmentMove('set-scenario','set_scenario','cave')},abilities:{none:{id:'none',definition:{rules:[]}}},weathers:{rain:{id:'rain',name:'Lluvia',definition:{imageId:'rain-visual',visualOpacity:40}}},fields:{sand:{id:'sand',name:'Arena',definition:{visualColor:'#aabbcc'}}},scenarios:{cave:{id:'cave',name:'Cueva',definition:{imageId:'cave-visual'}}},statuses:{}};
const revision='frozen-v1';
const publication={version:'0.4.0-alpha',revision,chart:{},catalog,assets:{sprites:{'cat-image':'published/old/sprites/cat-image.png'},environment:{'weathers/rain-visual':'published/old/environment/weathers/rain-visual.png','scenarios/cave-visual':'published/old/environment/scenarios/cave-visual.png'}}};
const kv=new Map([['public-v1:current',publication],['public-v1:snapshot:'+revision,publication]]),r2Access=[],sockets=[];
const storageData=new Map(),storage={get:async key=>storageData.get(key),put:async (key,v)=>storageData.set(key,structuredClone(v)),delete:async key=>storageData.delete(key),setAlarm:async()=>{}};
const env={PUBLIC_CONTENT:{get:async key=>kv.get(key)||null,put:async(k,v)=>kv.set(k,JSON.parse(v))},PUBLIC_SPRITES:{get:async key=>{r2Access.push(key);return key.startsWith('published/old/')?{body:new Uint8Array([137,80,78,71])}:null}}};
class MockSocket{constructor(){this.messages=[]}serializeAttachment(a){this.a=a}deserializeAttachment(){return this.a}send(x){this.messages.push(JSON.parse(x))}}
const OldResponse=globalThis.Response;
globalThis.Response=class extends OldResponse{constructor(body,init={}){if(init.status===101){super(null,{status:200});this.webSocket=init.webSocket}else super(body,init)}};
globalThis.WebSocketPair=class{constructor(){this[0]=new MockSocket();this[1]=new MockSocket()}};
try{
  const state={storage,getWebSockets:()=>sockets,acceptWebSocket:s=>sockets.push(s)};
  const room=new Room(state,env);
  await room.fetch(new Request('https://room.invalid/init',{method:'POST',body:JSON.stringify({code:'ABC234',createdAt:Date.now(),battleMode:'singles',teamMode:'picked'})}));
  async function connect(name){const res=await room.fetch(new Request('https://room.invalid/connect?name='+name,{headers:{Upgrade:'websocket'}}));assert.ok(res.webSocket);return sockets.at(-1)}
  const host=await connect('Ana'),guest=await connect('Beto');
  const ids=Object.keys(catalog.entities);
  for(const sock of [host,guest]){await room.webSocketMessage(sock,JSON.stringify({type:'team',team:ids}));await room.webSocketMessage(sock,JSON.stringify({type:'ready',ready:true}))}
  assert.equal(storageData.get('room').battle.status,'playing');
  let b=storageData.get('room').battle;
  assert.equal(b.round,1);assert.equal(b.phase,'action');
  const left={actions:[{slot:0,move:'set-weather'}]},right={actions:[{slot:0,move:'hit'}]};
  await room.webSocketMessage(host,JSON.stringify({type:'select_order',order:left}));
  await room.webSocketMessage(guest,JSON.stringify({type:'select_order',order:right}));
  assert.ok(host.messages.some(x=>x.type==='battle_selection'));
  assert.equal(host.messages.at(-1).type,'battle_round');
  assert.ok(host.messages.some(x=>x.type==='selection_accepted'));
  b=storageData.get('room').battle;
  assert.equal(b.round,2,'both player actions actually resolve');
  assert.equal(b.status,'playing');assert.equal(b.lastState.weather,'rain');
  const changed=host.messages.filter(m=>m.type==='battle_round').at(-1);
  assert.ok(changed,'must send new state to both clients');
  assert.ok(changed.visualEvents.some(e=>e.type==='environment'&&e.weather==='rain'),'weather must change visually at activation');
  // Acknowledged selections are decisions: a lost confirmation must not force false tie.
  await room.webSocketMessage(host,JSON.stringify({type:'select_order',order:{actions:[{slot:0,move:'set-field'}]}}));
  await room.webSocketMessage(guest,JSON.stringify({type:'select_order',order:{actions:[{slot:0,move:'hit'}]}}));
  b=storageData.get('room').battle;
  assert.equal(b.round,3,'alarm should commit valid selections before deciding timeout');
  assert.equal(b.lastState.field,'sand');
  assert.notEqual(b.finishReason,'both_timeout');
  // REST resources only from manifest and published entries.
  for(const [cat,id,key] of [['weathers','rain-visual','published/old/environment/weathers/rain-visual.png'],['scenarios','cave-visual','published/old/environment/scenarios/cave-visual.png']]){
    const r=await app.fetch(new Request('https://example.invalid/api/environment-visuals/'+cat+'/'+id+'?revision='+revision),env);
    assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/immutable/);assert.ok(r2Access.includes(key));
  }
  assert.equal((await app.fetch(new Request('https://example.invalid/api/environment-visuals/weathers/hidden-file?revision='+revision),env)).status,404);
  // Simulate environmental transition after move execution and expiration after 5 rounds.
  const replay=simulate({left:'e0',right:'e1',catalog,turns:5,leftOrders:[{move:'set-scenario'},...Array(4).fill({move:'hit'})],rightOrders:Array(5).fill({move:'hit'}),randomSource:()=>.9});
  assert.ok(replay.visualEvents.some(x=>x.type==='environment'&&x.scenario==='cave'));
  assert.ok(replay.visualEvents.some(x=>x.type==='environment'&&x.scenario===''));
  // Altered status changes are visual events at application and expiration,
  // not only final turn snapshots.
  const statusCatalog=structuredClone(catalog);
  statusCatalog.moves['set-scenario']={id:'set-scenario',name:'Estado',definition:{type:'fuego',category:'status',power:0,accuracy:0,criticalChance:0,priority:1,rules:[{event:'manual',target:'target',duration:2,action:{type:'apply_status',value:'burn'}}]}};
  statusCatalog.statuses={burn:{id:'burn',name:'Quemado',definition:{visualColor:'#ff2200',visualOpacity:30,rules:[]}}};
  const statusState=simulate({left:'e0',right:'e1',catalog:statusCatalog,turns:2,leftOrders:[{move:'set-scenario'},{move:'hit'}],rightOrders:[{move:'hit'},{move:'hit'}],randomSource:()=>.9});
  assert.ok(statusState.visualEvents.some(e=>e.type==='unit_state'&&e.unit.status?.id==='burn'),'status visual must update when applied');
  assert.ok(statusState.visualEvents.some(e=>e.type==='unit_state'&&e.unit.status===null),'status visual must disappear when expired');
  // Doubles starts and both sides resolve orders for both slots.
  await room.webSocketMessage(host,JSON.stringify({type:'surrender'}));
  await room.webSocketMessage(host,JSON.stringify({type:'return_lobby'}));
  await room.webSocketMessage(host,JSON.stringify({type:'settings',battleMode:'doubles',teamMode:'picked'}));
  for(const sock of [host,guest])await room.webSocketMessage(sock,JSON.stringify({type:'ready',ready:true}));
  b=storageData.get('room').battle;assert.equal(b.mode,'doubles');assert.equal(b.round,1);
  const dLeft={actions:[{slot:0,move:'hit',target:{side:'right',slot:0}},{slot:1,move:'hit',target:{side:'right',slot:1}}]},dRight={actions:[{slot:0,move:'hit',target:{side:'left',slot:0}},{slot:1,move:'hit',target:{side:'left',slot:1}}]};
  for(const [sock,order] of [[host,dLeft],[guest,dRight]])await room.webSocketMessage(sock,JSON.stringify({type:'select_order',order}));
  b=storageData.get('room').battle;
  assert.equal(b.round,2);assert.equal(b.mode,'doubles');assert.equal(b.status,'playing');
  console.log('Sala Singles/Doubles: 2 jugadores, acciones resueltas, recuperación de confirmación, entorno instantáneo, R2 versionado OK');
}finally{globalThis.Response=OldResponse;delete globalThis.WebSocketPair}
