import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('./public/account-onboarding.js',import.meta.url),'utf8');
async function simulate({initialUser=null,guest=false,tutorialComplete=true}){
  const listeners=new Map(),elements=new Map(),windowListeners=new Map(),calls=[];
  const store=new Map(guest?[['ud-alpha08-guest-session-active','1']]:[]);
  const element=id=>{if(!elements.has(id))elements.set(id,{id,hidden:id==='udAuthGate'||id==='udAccountBar',textContent:'',value:'',readOnly:false,disabled:false,style:{},children:[],contentWindow:{id:'test-iframe'},addEventListener(type,fn){listeners.set(`${id}:${type}`,fn)},replaceChildren(){},append(){},setAttribute(){}});return elements.get(id)};
  const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  let resolveMe;const pendingMe=new Promise(res=>{resolveMe=res});
  const fetch=async(path,options)=>{calls.push(path);if(path==='/api/auth/me')return await pendingMe;
    const payload=path==='/api/auth/config'?{googleClientId:null}:path==='/api/auth/tutorial-complete'?{user:{...initialUser,tutorialComplete:true}}:{};
    return{ok:true,json:async()=>payload};
  };
  const window={udOpenEmbed:kind=>calls.push('open:'+kind),udCloseEmbed:()=>calls.push('close'),udAccountReady:account=>calls.push('ready:'+String(account?.id??'guest')),udRejoinRoom:()=>calls.push('rejoin'),addEventListener:(type,fn)=>windowListeners.set(type,fn)};
  const context={document:{getElementById:element,head:{append(){}}},window,location:{origin:'https://universalduels.com'},localStorage:storage,fetch,console};
  // Nodes must exist before script reads hidden values.
  element('udAuthGate');element('udAccountBar');
  vm.runInNewContext(source,context);
  const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  // /me is still pending, so a previously authenticated user must never see a flashing login gate.
  await tick();assert.equal(element('udAuthGate').hidden,true,'gate remains hidden while checking session');
  resolveMe({ok:true,json:async()=>({user:initialUser})});await tick();
  return{elements,listeners,windowListeners,store,calls,element,tick,window};
}
const google=await simulate({initialUser:{id:'a1b2c3d4',nick:'Jugador',name:'Jugador',tutorialComplete:true}});
assert.equal(google.element('udAuthGate').hidden,true);assert.equal(google.element('udAccountBar').hidden,false);assert.ok(google.calls.includes('ready:a1b2c3d4'));
const guest=await simulate({initialUser:null,guest:true});
assert.equal(guest.element('udAuthGate').hidden,true);assert.equal(guest.element('udAccountBar').hidden,false);assert.ok(guest.calls.includes('ready:guest'));
const firstRun=await simulate({initialUser:null});
assert.equal(firstRun.element('udAuthGate').hidden,false,'first visitors still get login options');
firstRun.listeners.get('udGuestButton:click')();
assert.equal(firstRun.store.get('ud-alpha08-guest-session-active'),'1','guest login is remembered');
assert.ok(firstRun.calls.includes('open:tutorial'));
const frame=firstRun.element('udEmbeddedFrame');
firstRun.windowListeners.get('message')({origin:'https://universalduels.com',source:frame.contentWindow,data:{type:'ud-tutorial-skip'}});
await firstRun.tick();assert.equal(firstRun.element('udAccountBar').hidden,false,'skip completes guest onboarding');assert.ok(firstRun.calls.includes('close'));
const unfinished=await simulate({initialUser:{id:'abcd1234',nick:'Test',tutorialComplete:false}});
assert.ok(unfinished.calls.includes('open:tutorial'));
const frame2=unfinished.element('udEmbeddedFrame');
unfinished.windowListeners.get('message')({origin:'https://universalduels.com',source:frame2.contentWindow,data:{type:'ud-tutorial-skip'}});
await unfinished.tick();assert.ok(unfinished.calls.includes('/api/auth/tutorial-complete'),'Google skip persists completion on server');assert.equal(unfinished.element('udAccountBar').hidden,false);
console.log('Alpha 0.8: session gates do not flash, guest retained, normal login works, skip authorized and completed');
