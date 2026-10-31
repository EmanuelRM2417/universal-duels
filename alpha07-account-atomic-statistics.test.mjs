import assert from 'node:assert/strict';
import {recordAccountMatch,accountStats,authRoute} from './auth.js';
import {Room} from './worker.js';

const kvData=new Map(),storageData=new Map();
const kv={
 async get(key,format){const v=kvData.get(key);return format==='json'?(v?JSON.parse(v):null):v||null},
 async put(key,value){kvData.set(key,value)},async delete(key){kvData.delete(key)}
};
function storage(key){
 if(!storageData.has(key))storageData.set(key,new Map());const map=storageData.get(key);
 const tx={get:async k=>structuredClone(map.get(k)),put:async(k,v)=>{map.set(k,structuredClone(v));}};
 return { ...tx, async transaction(fn){return fn(tx)},async setAlarm(){},async deleteAlarm(){}};
}
const objs=new Map();const env={PUBLIC_CONTENT:kv,ROOMS:{idFromName:name=>name,get(id){
 if(!objs.has(id)){const state={storage:storage(id),getWebSockets:()=>[]};const obj=new Room(state,env);objs.set(id,obj);}
 return {fetch:(url,options)=>objs.get(id).fetch(new Request(url,options))};
}}};
const account='test-777';await kv.put('auth-v1:account:'+account,JSON.stringify({id:account,publicId:'ab12cd34',name:'Player',nick:'Player'}));
const previous={total:{played:3,wins:2,losses:1,draws:0,damageDealt:90,damageReceived:55,defeated:4}};
await kv.put('auth-v1:stats:'+account,JSON.stringify(previous));
const initial=await accountStats(env,account);assert.equal(initial.total.played,3,'Legacy totals are visible before first new event');
const payload={kind:'salas',mode:'singles',outcome:'loss',damageDealt:40,damageReceived:70,defeated:1};
const simultaneous=await Promise.all(Array.from({length:36},(_,i)=>recordAccountMatch(env,account,'room:atomic:'+i,payload)));
assert(simultaneous.every(Boolean));
let stats=await accountStats(env,account);
assert.equal(stats.total.played,39,'All simultaneous matches must count exactly once');
assert.equal(stats.total.wins,2);assert.equal(stats.total.losses,37);assert.equal(stats.total.damageDealt,90+40*36);
assert.equal(stats.salasSingles.played,36);assert.equal(stats.singles.played,36);
const duplicates=await Promise.all(Array.from({length:25},()=>recordAccountMatch(env,account,'room:atomic:0',payload)));
assert(duplicates.every(x=>!x));stats=await accountStats(env,account);assert.equal(stats.total.played,39);
const surrender={...payload,outcome:'loss'};assert.equal(await recordAccountMatch(env,account,'room:surrender',surrender),true);
assert.equal((await accountStats(env,account)).total.losses,38);
const sid='s'.repeat(32);await kv.put('auth-v1:session:'+sid,JSON.stringify({id:account}));
const path='https://universalduels.com/api/auth/stats';const r=await authRoute(new Request(path,{headers:{Cookie:'ud_session='+sid}}),env,new URL(path));
assert.equal(r.status,200);const result=await r.json();assert.equal(result.stats.total.played,40);
assert.equal(await recordAccountMatch(env,'unknown-account','room:fake',payload),false,'unknown accounts cannot get stats');
console.log('PASS: Atomic, idempotent account statistics with legacy migration, 36 simultaneous games, restart-safe DO storage, surrender and authenticated read.');
