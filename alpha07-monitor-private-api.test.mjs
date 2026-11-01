import assert from 'node:assert/strict';
import worker from './worker.js';
const secret='n'.repeat(40),sub='google-101',publicId='ab12cd34';
const data=new Map([
 ['auth-v1:public-id:'+publicId,sub],
 ['auth-v1:account:'+sub,JSON.stringify({id:sub,name:'Real Google Name',nick:'Nuevo Nick',publicId,createdAt:'2026-10-31T00:00:00Z'})],
 ['auth-v1:teams:'+sub,JSON.stringify([{name:'Equipo 1',ids:['a','b','c','d','e','f','g','h']}])],
 ['public-v1:current',JSON.stringify({catalog:{entities:{a:{name:'Zeus'},b:{name:'Horus'}}}})]
]);
const kv={async get(k,format){const v=data.get(k);return format==='json'?(v?JSON.parse(v):null):v||null;},async list(args){const keys=[...data.keys()].filter(k=>k.startsWith(args.prefix)).map(name=>({name}));return{keys,list_complete:true}}};
let requestCount=0;
const env={UD_MONITOR_SECRET:secret,PUBLIC_CONTENT:kv,ROOMS:{idFromName:k=>k,get(id){return{fetch:async url=>{requestCount++;if(id==='account-stats:'+sub)return new Response(JSON.stringify({stats:{total:{played:10,wins:7,losses:3}}}));if(String(url).endsWith('/monitor/snapshot'))return new Response(JSON.stringify({ok:true,data:{visits:5,connected:2,active:{room:[],practice:[]}}}));return new Response('{}');}};}}};
const api=async(path,authorized=true)=>worker.fetch(new Request('https://universalduels.com/api/internal-monitor/'+path,{headers:authorized?{'X-UD-Monitor-Secret':secret}:{}}),env);
let res=await api('summary',false);assert.equal(res.status,403);assert.equal(requestCount,0);
res=await api('summary');assert.equal(res.status,200);assert.equal((await res.json()).data.visits,5);
res=await api('profiles');assert.equal(res.status,200);let list=await res.json();assert.equal(list.profiles.length,1);assert.deepEqual(Object.keys(list.profiles[0]).sort(),['createdAt','id','nick']);
res=await api('profiles?q=nuevo');assert.equal((await res.json()).profiles[0].nick,'Nuevo Nick');
res=await api('profiles?q=notfound');assert.equal((await res.json()).profiles.length,0);
res=await api('profile/zz99zz99');assert.equal(res.status,404);
res=await api('profile/'+publicId);assert.equal(res.status,200);
const p=(await res.json()).profile;assert.equal(p.id,publicId);assert.equal(p.nick,'Nuevo Nick');assert.equal(p.stats.total.played,10);assert.equal(p.teams[0].members[0].name,'Zeus');assert.equal(p.teams[0].members[1].name,'Horus');
assert(!JSON.stringify(p).includes(sub),'Private Google subject must never be sent to admin panel');
console.log('PASS: auth secret, server-side ID/nick search, profiles with stats and named team members, no Google identity leakage.');
