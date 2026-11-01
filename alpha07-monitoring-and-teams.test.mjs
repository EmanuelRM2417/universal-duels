import assert from 'node:assert/strict';
import {handleMonitorDO,monitorSnapshot,validateTelemetry} from './monitoring.js';
import worker,{Room} from './worker.js';
import {authRoute,normalizeTeams} from './auth.js';
import {readFileSync} from 'node:fs';

const rows=new Map(),sockets=[];
const storage={async setAlarm(){},async get(k){return structuredClone(rows.get(k))},async put(k,v){rows.set(k,structuredClone(v));},async delete(k){rows.delete(k)},async list({prefix}){return new Map([...rows].filter(([k])=>k.startsWith(prefix)))}};
const hub={storage,state:{getWebSockets:()=>sockets}};
async function event(e){return handleMonitorDO(hub,new Request('https://room.internal/monitor/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)}));}
const tab='12345678-1234-4234-8234-123456789abc';
assert.equal(validateTelemetry({tabId:tab,page:'home',pageview:true}),true);
assert.equal(validateTelemetry({tabId:'spoof',page:'home',pageview:true}),false);
assert.equal((await event({type:'presence',tabId:'spoof',page:'home',pageview:true})).status,400);
assert.equal((await event({type:'presence',tabId:tab,page:'home',pageview:true,account:'ab12cd34'})).status,200);
await event({type:'presence',tabId:tab,page:'home',pageview:false,account:'ab12cd34'});
let snap=await monitorSnapshot(hub);
assert.equal(snap.visits,1);assert.equal(snap.pageviews,1);assert.equal(snap.connected,1);assert.equal(snap.registeredConnected,1);
const secondTab='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';await event({type:'presence',tabId:secondTab,page:'home',pageview:true,account:'ab12cd34'});assert.equal((await monitorSnapshot(hub)).connected,1,'Same signed-in account with two tabs counts as one person');
await event({type:'presence',tabId:tab,page:'catalog',pageview:true,account:'ab12cd34'});
snap=await monitorSnapshot(hub);assert.equal(snap.visits,2);assert.equal(snap.pageviews,3);
const match={type:'match',id:'room:ABC234',kind:'room',mode:'doubles',status:'playing',code:'ABC234',players:2};
await event(match);assert.equal((await monitorSnapshot(hub)).roomBattles,1);
await event(match);assert.equal((await monitorSnapshot(hub)).roomBattles,1,'No duplicar partidas si se reciben actualizaciones');
await event({...match,status:'ended'});assert.equal((await monitorSnapshot(hub)).roomBattles,0);
const token='a'.repeat(64);await event({type:'match',id:'practice:'+token,kind:'practice',mode:'singles',status:'playing'});assert.equal((await monitorSnapshot(hub)).practiceBattles,1);
rows.set('monitor:presence:'+secondTab,{at:Date.now()-90_000});rows.set('monitor:presence:'+tab,{at:Date.now()-90_000});rows.set('monitor:match:practice:'+token,{id:'practice:'+token,kind:'practice',at:Date.now()-60*60_000});
assert.equal((await monitorSnapshot(hub)).connected,0);assert.equal((await monitorSnapshot(hub)).practiceBattles,0);
const messages=[];sockets.push({send:v=>messages.push(JSON.parse(v))});await event({type:'profile',publicId:'ab12cd34'});assert.equal(messages.at(-1).type,'profile-change');

const storeData=new Map(),sid='s'.repeat(32),sub='google-sub';
storeData.set('auth-v1:session:'+sid,JSON.stringify({id:sub}));storeData.set('auth-v1:account:'+sub,JSON.stringify({id:sub,publicId:'ab12cd34',name:'Original',nick:'Original'}));
const kv={async get(k,form){const v=storeData.get(k);return form==='json'?(v?JSON.parse(v):null):v||null;},async put(k,v){storeData.set(k,v)},async delete(k){storeData.delete(k)}};
const env={PUBLIC_CONTENT:kv,ROOMS:{idFromName:k=>k,get:()=>({fetch:async()=>new Response('{}')})}};
function auth(path,method='GET',body){const url=new URL('https://universalduels.com'+path);const request=new Request(url,{method,headers:{Cookie:'ud_session='+sid,...(method==='POST'?{Origin:url.origin,'Content-Type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})});return authRoute(request,env,url);}
assert.throws(()=>normalizeTeams([{name:'Bad',ids:['same',...Array(7).fill('same')]}]));
const teams=[{name:'Mitología',ids:['a','b','c','d','e','f','g','h']}];
let response=await auth('/api/auth/teams','POST',{teams});assert.equal(response.status,200);assert.deepEqual((await response.json()).teams,teams);
response=await auth('/api/auth/teams');assert.deepEqual((await response.json()).teams,teams);
response=await auth('/api/auth/nick','POST',{nick:'Otro Jugador'});assert.equal(response.status,200);assert.equal((await response.json()).user.id,'ab12cd34');
assert.deepEqual((await (await auth('/api/auth/teams')).json()).teams,teams,'Changing nickname preserves teams');
response=await auth('/api/auth/nick','POST',{nick:'X'});assert.equal(response.status,400);
response=await auth('/api/auth/teams','POST',{teams:[{name:'Mal',ids:['a']}]});assert.equal(response.status,400);
const guest=await authRoute(new Request('https://universalduels.com/api/auth/teams'),env,new URL('https://universalduels.com/api/auth/teams'));assert.equal(guest.status,401);
const denied=await worker.fetch(new Request('https://universalduels.com/api/internal-monitor/summary'),{...env,UD_MONITOR_SECRET:'a'.repeat(40)});
assert.equal(denied.status,403,'Private monitoring must reject unsigned public requests');
assert.match(readFileSync(new URL('./public/index.html',import.meta.url),'utf8'),/udStatsSaveNick/);
assert.match(readFileSync(new URL('./public/monitor-client.js',import.meta.url),'utf8'),/visibilitychange/);
console.log('PASS: presence, visits, stale TTL, live match lifecycle, profile-change events, saved teams, nickname, privacy and monitoring secret.');
