import assert from 'node:assert/strict';
import app,{Room} from './worker.js';

const catalog={entities:{a:{id:'a',name:'A',definition:{types:['fuego'],hp:100,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:['wait','wait','wait'],uniqueMoveId:'wait',globalAbilityId:'none',uniqueAbilityId:'none'}},b:{id:'b',name:'B',definition:{types:['fuego'],hp:100,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:['wait','wait','wait'],uniqueMoveId:'wait',globalAbilityId:'none',uniqueAbilityId:'none'}}},moves:{wait:{id:'wait',name:'Esperar',definition:{type:'fuego',category:'status',power:0,accuracy:0,rules:[]}}},abilities:{none:{id:'none',definition:{rules:[]}}}};
const publication={revision:'test-v1',catalog,chart:{}};
const rooms=new Map();let lookups=0;
const env={PUBLIC_CONTENT:{get:async()=>publication},ROOMS:{idFromName:x=>x,get:x=>{lookups++;if(!rooms.has(x)){const memory=new Map(),storage={get:async key=>memory.get(key),put:async(k,v)=>memory.set(k,structuredClone(v)),setAlarm:async()=>{},delete:async k=>memory.delete(k)};rooms.set(x,new Room({storage,getWebSockets:()=>[]},env));}return{fetch:(u,init)=>rooms.get(x).fetch(u instanceof Request?u:new Request(u,init))};}}};
const request=(path,body,headers={})=>new Request('https://example.test'+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body});
const over=JSON.stringify({mode:'singles',difficulty:'easy',leftTeam:['a'],rightTeam:['b'],padding:'X'.repeat(5000)});
let r=await app.fetch(request('/api/practice',over),env);assert.equal(r.status,413,'oversized practice creation rejected without Content-Length');assert.equal(lookups,0,'rejection before DO creation');
r=await app.fetch(request('/api/rooms','x'.repeat(2100)),env);assert.equal(r.status,413,'oversized room creation rejected');assert.equal(lookups,0);
r=await app.fetch(request('/api/rooms','{}',{'content-length':'999999'}),env);assert.equal(r.status,413,'advertised oversized request rejected before read');
const token='a'.repeat(72);
r=await app.fetch(request('/api/practice',JSON.stringify({token,mode:'singles',difficulty:'easy',leftTeam:['a'],rightTeam:['b']})),env);assert.equal(r.status,200,'normal practice request remains available');
r=await app.fetch(request('/api/practice/'+token,'X'.repeat(8500)),env);assert.equal(r.status,413,'practice turn body is bounded even for DO requests');
r=await app.fetch(request('/api/practice/'+token,JSON.stringify({operation:'surrender'})),env);assert.equal(r.status,200,'legitimate request remains functional after rejection');
console.log('Alpha 0.4: request size limits enforced without Content-Length for room creation and Practice DO');
