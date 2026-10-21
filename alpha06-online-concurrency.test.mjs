import assert from 'node:assert/strict';
import {Room} from './worker.js';

const ent=id=>({id,name:id,definition:{spriteId:'pixel',types:['fuego'],hp:400,attack:85,defense:110,specialAttack:90,specialDefense:110,speed:90,moveIds:['hit','hit2','hit3'],uniqueMoveId:'hit4',globalAbilityId:'none',uniqueAbilityId:'none'}});
const catalog={entities:Object.fromEntries(Array.from({length:8},(_,i)=>['e'+i,ent('e'+i)])),moves:Object.fromEntries(['hit','hit2','hit3','hit4'].map(id=>[id,{id,name:'Golpe',definition:{type:'fuego',category:'physical',power:5,accuracy:100,criticalChance:0,priority:0,rules:[]}}])),abilities:{none:{id:'none',definition:{rules:[]}}},statuses:{},scenarios:{},weathers:{},fields:{}};
const revision='frozen-v1';
const publication={version:'0.6.0-alpha',revision,chart:{},catalog};
const kv=new Map([['public-v1:current',publication],['public-v1:snapshot:'+revision,publication]]);
const storageData=new Map(),sockets=[];
// Real Durable Object storage returns separate snapshots for successive get calls.
// This is essential to expose stale-read/lost-update bugs under concurrency.
const storage={get:async k=>structuredClone(storageData.get(k)),put:async(k,v)=>storageData.set(k,structuredClone(v)),delete:async k=>storageData.delete(k),setAlarm:async()=>{}};
const env={PUBLIC_CONTENT:{get:async k=>kv.get(k)||null,put:async(k,v)=>kv.set(k,JSON.parse(v))}};
class MockSocket{constructor(){this.messages=[]}serializeAttachment(a){this.a=a}deserializeAttachment(){return this.a}send(x){this.messages.push(JSON.parse(x))}}
const ResponseBase=globalThis.Response;
globalThis.Response=class extends ResponseBase{constructor(body,init={}){if(init.status===101){super(null,{status:200});this.webSocket=init.webSocket}else super(body,init)}};
globalThis.WebSocketPair=class{constructor(){this[0]=new MockSocket();this[1]=new MockSocket()}};
try{
 const state={storage,getWebSockets:()=>sockets,acceptWebSocket:s=>sockets.push(s)};
 const room=new Room(state,env);
 await room.fetch(new Request('https://room.invalid/init',{method:'POST',body:JSON.stringify({code:'ABC234',createdAt:Date.now(),battleMode:'singles',teamMode:'picked'})}));
 async function connect(name){const res=await room.fetch(new Request('https://room.invalid/connect?name='+name,{headers:{Upgrade:'websocket'}}));assert.ok(res.webSocket);return sockets.at(-1)}
 const host=await connect('Ana'),guest=await connect('Luis'),ids=Object.keys(catalog.entities);
 for(const sock of [host,guest]){await room.webSocketMessage(sock,JSON.stringify({type:'team',team:ids}));await room.webSocketMessage(sock,JSON.stringify({type:'ready',ready:true}))}
 const order={actions:[{slot:0,move:'hit'}]};
 if(!storageData.get('room').battle) console.log('ROOM NOT STARTED',JSON.stringify(storageData.get('room')),JSON.stringify(host.messages.slice(-5)),JSON.stringify(guest.messages.slice(-5)));
 assert.equal(storageData.get('room').battle.round,1);
 const baseGetSnapshot=room.getSnapshot.bind(room);
 // Imitate a slow KV read so both WebSocket messages arrive concurrently.
 room.getSnapshot=async rev=>{if(rev)await new Promise(resolve=>setTimeout(resolve,18));return baseGetSnapshot(rev)};
 await Promise.all([
   room.webSocketMessage(host,JSON.stringify({type:'select_order',round:1,order})),
   room.webSocketMessage(guest,JSON.stringify({type:'select_order',round:1,order}))
 ]);
 let b=storageData.get('room').battle;
 assert.equal(b.round,2,'concurrent selections must never overwrite each other');
 assert.equal(b.status,'playing');
 assert.ok(host.messages.some(x=>x.type==='battle_round'),'host sees resolution');
 assert.ok(guest.messages.some(x=>x.type==='battle_round'),'guest sees resolution');
 // Deliver a stale packet after the turn advances: must be rejected.
 await room.webSocketMessage(host,JSON.stringify({type:'select_order',round:1,order}));
 assert.ok(host.messages.at(-2)?.type==='error'||host.messages.at(-1)?.type==='error','stale round must get explicit rejection');
 assert.equal(storageData.get('room').battle.round,2);
 // Force a temporary KV problem ONLY AFTER both players have committed their orders.
 let injected=false;
 room.getSnapshot=async rev=>{
   if(!injected&&rev===revision&&storageData.get('room')?.battle?.phase==='resolving'){
     injected=true;throw Error('Simulated temporary KV failure');
   }
   return baseGetSnapshot(rev);
 };
 await room.webSocketMessage(host,JSON.stringify({type:'select_order',round:2,order}));
 await room.webSocketMessage(guest,JSON.stringify({type:'select_order',round:2,order}));
 b=storageData.get('room').battle;
 assert.ok(injected,'test must hit retry branch');
 assert.equal(b.phase,'resolving','technical error must not abandon accepted orders');
 assert.equal(b.selectionDeadline,null,'timer must not declare a loser after both committed');
 assert.ok(b.pending.host&&b.pending.guest,'accepted orders must survive a server error');
 assert.equal(b.winner,null,'server errors are not victories');
 assert.notEqual(b.finishReason,'timeout');
 await room.alarm();
 b=storageData.get('room').battle;
 assert.equal(b.round,3,'server alarm must retry and finish the same turn');
 assert.equal(b.phase,'action');
 assert.ok(b.lastState.leftTeam[0].hp<400,'the retried round actually executes combat');
 assert.ok(guest.messages.some(x=>x.type==='battle_retry'),'both players are told that a retry is happening');
 assert.ok(guest.messages.filter(x=>x.type==='battle_round').length>=2,'both completed rounds delivered to client');
 // Doubles has two actions per player: simultaneous packets must be merged too.
 await room.webSocketMessage(host,JSON.stringify({type:'surrender'}));
 await room.webSocketMessage(host,JSON.stringify({type:'return_lobby'}));
 await room.webSocketMessage(host,JSON.stringify({type:'settings',battleMode:'doubles',teamMode:'picked'}));
 for(const sock of [host,guest])await room.webSocketMessage(sock,JSON.stringify({type:'ready',ready:true}));
 b=storageData.get('room').battle;
 assert.equal(b.round,1);assert.equal(b.mode,'doubles');
 room.getSnapshot=async rev=>{if(rev)await new Promise(resolve=>setTimeout(resolve,18));return baseGetSnapshot(rev)};
 const leftD={actions:[{slot:0,move:'hit',target:{side:'right',slot:0}},{slot:1,move:'hit',target:{side:'right',slot:1}}]};
 const rightD={actions:[{slot:0,move:'hit',target:{side:'left',slot:0}},{slot:1,move:'hit',target:{side:'left',slot:1}}]};
 await Promise.all([
   room.webSocketMessage(host,JSON.stringify({type:'select_order',round:1,order:leftD})),
   room.webSocketMessage(guest,JSON.stringify({type:'select_order',round:1,order:rightD}))
 ]);
 b=storageData.get('room').battle;
 assert.equal(b.round,2,'concurrent Doubles selections must both resolve');
 assert.equal(b.phase,'action');assert.equal(b.status,'playing');
 console.log('OK Alpha 0.6: concurrent Singles/Doubles choices, no lost updates, stale-round rejection, persisted retry, no false timeout');
}finally{globalThis.Response=ResponseBase;delete globalThis.WebSocketPair}
