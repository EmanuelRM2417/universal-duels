/* Google Identity Services authentication. Uses published-content KV with isolated
 * auth-v1: prefixes during Alpha; migrate to D1/account-specific storage before scaling.
 * No OAuth secrets, ID tokens or session IDs are exposed through public responses. */
const j=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>alphabet[v%alphabet.length]).join('');
const readCookie=req=>{const text=req.headers.get('Cookie')||'';return text.split(';').map(x=>x.trim()).find(x=>x.startsWith('ud_session='))?.slice(11)||''};
const base64url=x=>Uint8Array.from(atob(x.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-x.length%4)%4)),c=>c.charCodeAt(0));
let jwksCache=null,jwksExpiry=0;
async function googleKeys(){
 if(jwksCache&&Date.now()<jwksExpiry)return jwksCache;
 const response=await fetch('https://www.googleapis.com/oauth2/v3/certs');if(!response.ok)throw Error('Certificados de Google no disponibles.');
 const data=await response.json();if(!Array.isArray(data.keys))throw Error('Respuesta de certificados inválida.');
 jwksCache=data.keys;jwksExpiry=Date.now()+Math.min(3600,Math.max(60,Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1])||600))*1000;
 return jwksCache;
}
export async function verifyGoogleCredential(jwt,clientId,keys=undefined){
 if(typeof jwt!=='string'||jwt.length>12000||!clientId)throw Error('Token o Client ID inválido.');
 const bits=jwt.split('.');if(bits.length!==3)throw Error('JWT inválido.');
 let head,body;try{head=JSON.parse(new TextDecoder().decode(base64url(bits[0])));body=JSON.parse(new TextDecoder().decode(base64url(bits[1])));}catch{throw Error('JWT ilegible.');}
 if(head.alg!=='RS256'||!head.kid||!body?.sub||body.aud!==clientId||!['accounts.google.com','https://accounts.google.com'].includes(body.iss)||!Number.isFinite(body.exp)||body.exp<=Date.now()/1000||!Number.isFinite(body.iat)||body.iat>Date.now()/1000+60)throw Error('Credencial de Google inválida.');
 const jwk=(keys||await googleKeys()).find(k=>k.kid===head.kid&&k.kty==='RSA'&&(!k.use||k.use==='sig'));if(!jwk)throw Error('No se encontró la clave de firma Google.');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,base64url(bits[2]),new TextEncoder().encode(bits.slice(0,2).join('.'))))throw Error('Firma de Google inválida.');
 return {sub:String(body.sub),name:String(body.name||'Jugador').slice(0,80)};
}
const profile=u=>({id:u.id,name:u.name,tutorialComplete:!!u.tutorialComplete});
const sessionCookie=(value,maxAge)=>`ud_session=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
const sameOrigin=(req,url)=>req.headers.get('Origin')===url.origin;
const store=env=>env.PUBLIC_CONTENT;
async function current(req,env){const sid=readCookie(req);if(!/^[A-Za-z0-9_-]{32}$/.test(sid)||!store(env))return null;const session=await store(env).get('auth-v1:session:'+sid,'json');if(!session?.id)return null;const account=await store(env).get('auth-v1:account:'+session.id,'json');return account?{account,sid}:null;}
export async function authRoute(req,env,url){
 if(!url.pathname.startsWith('/api/auth/'))return null;
 if(req.method==='GET'&&url.pathname==='/api/auth/config')return j({ok:true,googleClientId:env.GOOGLE_CLIENT_ID||'',configured:!!env.GOOGLE_CLIENT_ID});
 if(req.method==='GET'&&url.pathname==='/api/auth/me'){
  const data=await current(req,env);return j({ok:true,user:data?profile(data.account):null});
 }
 if(req.method!=='POST'||!sameOrigin(req,url))return j({error:'Método u origen no autorizado.'},403);
 if(url.pathname==='/api/auth/google'){
  if(!store(env)||!env.GOOGLE_CLIENT_ID)return j({error:'Google Login todavía no está configurado en el Worker.'},503);
  if(Number(req.headers.get('Content-Length'))>16000)return j({error:'Solicitud demasiado grande.'},413);
  let data;try{data=await req.json();}catch{return j({error:'JSON inválido.'},400);}
  let verified;try{verified=await verifyGoogleCredential(data?.credential,env.GOOGLE_CLIENT_ID);}catch(e){return j({error:e.message},401);}
  const key='auth-v1:account:'+verified.sub,prior=await store(env).get(key,'json');
  const account={id:verified.sub,name:verified.name,createdAt:prior?.createdAt||new Date().toISOString(),tutorialComplete:!!prior?.tutorialComplete};
  await store(env).put(key,JSON.stringify(account));
  const sid=token();await store(env).put('auth-v1:session:'+sid,JSON.stringify({id:account.id}),{expirationTtl:60*60*24*30});
  return j({ok:true,user:profile(account)},200,{'Set-Cookie':sessionCookie(sid,60*60*24*30)});
 }
 if(url.pathname==='/api/auth/logout'){
  const sid=readCookie(req);if(/^[A-Za-z0-9_-]{32}$/.test(sid)&&store(env))await store(env).delete('auth-v1:session:'+sid);
  return j({ok:true},200,{'Set-Cookie':sessionCookie('',0)});
 }
 if(url.pathname==='/api/auth/tutorial-complete'){
  const user=await current(req,env);if(!user)return j({error:'No hay sesión Google.'},401);
  const updated={...user.account,tutorialComplete:true};await store(env).put('auth-v1:account:'+updated.id,JSON.stringify(updated));
  return j({ok:true,user:profile(updated)});
 }
 return j({error:'Ruta de autenticación desconocida.'},404);
}
