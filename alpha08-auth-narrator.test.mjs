import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {verifyGoogleCredential,authRoute} from './auth.js';

const context={window:{}};
vm.runInNewContext(readFileSync(new URL('./public/narrator-templates.js',import.meta.url),'utf8'),context);
const format=context.window.udNarratorFormat;
assert.equal(format('Isis recibe Veneno.',[{pattern:'[PERSONAJE] recibe [EFECTO].',replacement:'[PERSONAJE] ahora tiene [EFECTO].'}]),'Isis ahora tiene Veneno.');
assert.equal(format('Ares recibe Veneno.',[{pattern:'Isis recibe Veneno.',replacement:'otro'}]),'Ares recibe Veneno.');
assert.equal(format('Ya hay Lluvia.',[{pattern:'Ya hay [CLIMA].',replacement:'[CLIMA] ya cubre el campo.'}]),'Lluvia ya cubre el campo.');
assert.equal(format('Desconocido',[]),'Desconocido');
const base64url=x=>Buffer.from(x).toString('base64url');
const {publicKey,privateKey}=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',publicKey);jwk.kid='test-key';jwk.use='sig';
const client='test.apps.googleusercontent.com';
async function signed(overrides={}){const h=base64url(JSON.stringify({alg:'RS256',kid:'test-key'})),b=base64url(JSON.stringify({sub:'10001',name:'Prueba',aud:client,iss:'https://accounts.google.com',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),...overrides}));const data=h+'.'+b;const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,new TextEncoder().encode(data));return data+'.'+base64url(Buffer.from(signature));}
const good=await signed();
assert.equal((await verifyGoogleCredential(good,client,[jwk])).sub,'10001');
const badAudience=await signed({aud:'wrong'}),expired=await signed({exp:1});
await assert.rejects(()=>verifyGoogleCredential(badAudience,client,[jwk]));
await assert.rejects(()=>verifyGoogleCredential(expired,client,[jwk]));
await assert.rejects(()=>verifyGoogleCredential(good.slice(0,-4)+'abcd',client,[jwk]));
const db=new Map();const kv={get:async(key,type)=>type==='json'?JSON.parse(db.get(key)||'null'):db.get(key)||null,put:async(key,value)=>db.set(key,value),delete:async key=>db.delete(key)};
const env={PUBLIC_CONTENT:kv,GOOGLE_CLIENT_ID:client};
const origin='https://universalduels.com';
let r=await authRoute(new Request(origin+'/api/auth/config'),env,new URL(origin+'/api/auth/config'));
assert.equal((await r.json()).googleClientId,client);
r=await authRoute(new Request(origin+'/api/auth/me'),env,new URL(origin+'/api/auth/me'));
assert.equal((await r.json()).user,null);
r=await authRoute(new Request(origin+'/api/auth/logout',{method:'POST',headers:{Origin:'https://evil.example'}}),env,new URL(origin+'/api/auth/logout'));
assert.equal(r.status,403);
// A token only reaches accounts after server-side signature verification. Local signed token tested above.
assert.equal(db.size,0);
console.log('Alpha 0.8: narrador editable, JWT verificado (aud/firma/exp), sesión y CSRF OK');
// Full auth route with a generated correctly-signed Google credential; no production Google calls.
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{
 assert.equal(url,'https://www.googleapis.com/oauth2/v3/certs');
 return new Response(JSON.stringify({keys:[jwk]}),{headers:{'Cache-Control':'public,max-age=600'}});
};
try{
 const makeLoginReq=()=>new Request(origin+'/api/auth/google',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({credential:good})});
 r=await authRoute(makeLoginReq(),env,new URL(origin+'/api/auth/google'));
 assert.equal(r.status,200);
 const login=await r.json();assert.equal(login.user.tutorialComplete,false);
 assert.equal(db.size,2,'Account and session stored separately');
 const cookie=r.headers.get('Set-Cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);
 const session=cookie.split(';')[0];
 let meReq=new Request(origin+'/api/auth/me',{headers:{Cookie:session}});
 r=await authRoute(meReq,env,new URL(meReq.url));assert.equal((await r.json()).user.name,'Prueba');
 const completeReq=new Request(origin+'/api/auth/tutorial-complete',{method:'POST',headers:{Origin:origin,Cookie:session}});
 r=await authRoute(completeReq,env,new URL(completeReq.url));assert.equal((await r.json()).user.tutorialComplete,true);
 // Login again; the completed tutorial flag must persist across sessions.
 r=await authRoute(makeLoginReq(),env,new URL(origin+'/api/auth/google'));assert.equal((await r.json()).user.tutorialComplete,true);
 assert.equal(db.size,3);
 const logoutReq=new Request(origin+'/api/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:session}});
 r=await authRoute(logoutReq,env,new URL(logoutReq.url));assert.equal(r.status,200);
 meReq=new Request(origin+'/api/auth/me',{headers:{Cookie:session}});
 r=await authRoute(meReq,env,new URL(meReq.url));assert.equal((await r.json()).user,null);
}finally{globalThis.fetch=originalFetch;}
console.log('Alpha 0.7: acceso Google -> sesión -> tutorial único -> reingreso -> salida OK');
