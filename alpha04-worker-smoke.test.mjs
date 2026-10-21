import assert from 'node:assert/strict';
import app,{Room} from './worker.js';
const ent=(id)=>({id,name:id,definition:{spriteId:'testcat',types:['fuego'],hp:500,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:105,moveIds:['attack','wait','slow'],uniqueMoveId:'special',globalAbilityId:'none',uniqueAbilityId:'none'}});
const move=(id,power)=>({id,name:id,definition:{type:'fuego',category:power?'physical':'status',power,accuracy:100,criticalChance:0,priority:0,rules:[]}});
const catalog={entities:{cat:ent('cat'),dog:ent('dog')},moves:{attack:move('attack',2),slow:move('slow',2),wait:move('wait',0),special:move('special',1)},abilities:{none:{id:'none',definition:{rules:[]}}}};
const publication={ok:true,revision:'patch-smoke',version:'0.4.0-alpha',publishedAt:'2026-10-12',chart:{},catalog,assets:{sprites:{testcat:'published/patch-old/sprites/testcat.png'},typeIcons:{fuego:'published/patch-old/type-icons/fuego.png'}}};
const kv=new Map([['public-v1:current',publication],['public-v1:snapshot:patch-smoke',publication]]);
const r2Keys=[];
const roomStubs=new Map();
const env={PUBLIC_CONTENT:{get:async(key)=>kv.get(key)||null,put:async(key,val)=>kv.set(key,JSON.parse(val))},
 PUBLIC_SPRITES:{get:async key=>{r2Keys.push(key);return key==='published/patch-old/sprites/testcat.png'||key==='published/patch-old/type-icons/fuego.png'?{body:'image bytes'}:null}},
 ROOMS:{idFromName:x=>x,get:id=>{if(!roomStubs.has(id)){
   const rows=new Map(),storage={get:async key=>rows.get(key)||null,put:async(key,val)=>rows.set(key,structuredClone(val)),delete:async key=>rows.delete(key),setAlarm:async()=>{}};
   roomStubs.set(id,new Room({storage,getWebSockets:()=>[]},env));
 }return {fetch:(url,init)=>roomStubs.get(id).fetch(url instanceof Request?url:new Request(url,init))};}}};
const url='https://example.invalid';
async function fetchIt(path,method='GET',body){const req=new Request(url+path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const res=await app.fetch(req,env);const text=await res.text();let parsed;try{parsed=JSON.parse(text)}catch{parsed=text}return {status:res.status,body:parsed,headers:res.headers};}
let r=await fetchIt('/health');assert.equal(r.status,200);assert.equal(r.body.version,'0.5.0-alpha');
r=await fetchIt('/api/catalog');assert.equal(r.body.revision,'patch-smoke');
r=await fetchIt('/api/catalog/patch-smoke');assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/immutable/);
r=await fetchIt('/api/sprites/testcat?revision=patch-smoke');assert.equal(r.status,200);assert.equal(r.body,'image bytes');
r=await fetchIt('/api/type-icons/fuego?revision=patch-smoke');assert.equal(r.status,200);assert.equal(r.body,'image bytes');
assert.deepEqual(r2Keys,['published/patch-old/sprites/testcat.png','published/patch-old/type-icons/fuego.png']);
r=await fetchIt('/api/practice','POST',{mode:'singles',difficulty:'advanced',leftTeam:['cat'],rightTeam:['dog']});
assert.equal(r.status,200);assert.equal(r.body.practice.round,1);
const token=r.body.token;
const resume=await fetchIt('/api/practice/'+token,'GET');assert.equal(resume.body.practice.status,'playing');
const play=await fetchIt('/api/practice/'+token,'POST',{operation:'turn',order:{move:'attack'}});
assert.equal(play.status,200);assert.equal(play.body.practice.round,2);
r=await fetchIt('/api/practice','POST',{token,mode:'doubles',difficulty:'easy',leftTeam:['cat'],rightTeam:['dog']});
assert.equal(r.body.resumed,true);assert.equal(r.body.practice.mode,'singles');
r=await fetchIt('/api/practice/'+token,'POST',{operation:'surrender'});assert.equal(r.body.practice.outcome,'surrender');
r=await fetchIt('/api/practice','POST',{token,mode:'doubles',difficulty:'easy',leftTeam:['cat','dog'],rightTeam:['cat','dog']});
assert.equal(r.body.practice.mode,'doubles');assert.equal(r.body.resumed,undefined);
console.log('Alpha 0.4 Worker HTTP: catálogo, imágenes versionadas, Práctica y reanudación OK');
