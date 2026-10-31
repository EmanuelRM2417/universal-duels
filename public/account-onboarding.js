/* Alpha 0.7: first-run playable onboarding and Google Identity Services. */
(()=>{
 const $=id=>document.getElementById(id),gate=$('udAuthGate'),name=$('udAccountName'),status=$('udAuthStatus');
 let account=null,accessGranted=false,tutorialRunning=false,mandatory=false;
 window.udMandatoryTutorial=false;
 function setStatus(text){status.textContent=text;}
 function showGate(){gate.hidden=false;$('udAccountBar').hidden=true;}
 function accountBar(){gate.hidden=true;$('udAccountBar').hidden=false;name.textContent=account?'Google · '+account.name:'Invitado';}
 function allowPlay(){accessGranted=true;window.udAuthAllowed=true;window.udMandatoryTutorial=false;accountBar();window.udRejoinRoom?.();}
 function tutorial(required){gate.hidden=true;mandatory=!!required;tutorialRunning=true;window.udMandatoryTutorial=mandatory;
   window.udOpenEmbed?.('tutorial');$('udEmbeddedClose').hidden=mandatory;
 }
 window.udStartTutorial=(required=false)=>tutorial(required);
 async function json(path,options={}){
   const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
   const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo completar el acceso.');return data;
 }
 async function finalize(){
   if(!tutorialRunning)return;
   if(account){try{const r=await json('/api/auth/tutorial-complete',{method:'POST'});account=r.user;}catch(e){setStatus('El tutorial terminó, pero no se guardó en tu cuenta: '+e.message);}}
   tutorialRunning=false;mandatory=false;window.udMandatoryTutorial=false;$('udEmbeddedClose').hidden=false;
   window.udCloseEmbed?.();allowPlay();
 }
 window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===$('udEmbeddedFrame').contentWindow&&e.data?.type==='ud-tutorial-complete')finalize();});
 $('udGuestButton').addEventListener('click',()=>{account=null;tutorial(true);});
 $('udAccountLogout').addEventListener('click',async()=>{if(account)try{await json('/api/auth/logout',{method:'POST'});}catch{}account=null;accessGranted=false;window.udAuthAllowed=false;showGate();});
 async function renderGoogle(clientId){
   if(!clientId){setStatus('Inicio con Google pendiente de configurar. Podés continuar como invitado.');return;}
   const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
   script.onload=()=>{
     if(!window.google?.accounts?.id){setStatus('Google no está disponible en este navegador.');return;}
     google.accounts.id.initialize({client_id:clientId,callback:async response=>{
       try{setStatus('Verificando cuenta de Google…');const data=await json('/api/auth/google',{method:'POST',body:JSON.stringify({credential:response.credential})});account=data.user;
         if(account.tutorialComplete)allowPlay();else tutorial(true);
       }catch(e){showGate();setStatus(e.message);}
     }});
     google.accounts.id.renderButton($('udGoogleButton'),{theme:'filled_blue',size:'large',shape:'pill',text:'continue_with',width:250});
   };
   script.onerror=()=>setStatus('No se pudo cargar Google. Podés jugar como invitado.');document.head.append(script);
 }
 async function init(){
   showGate();
   try{
     const [config,me]=await Promise.all([json('/api/auth/config'),json('/api/auth/me')]);
     if(me.user){account=me.user;if(account.tutorialComplete){allowPlay();return;}tutorial(true);}
     await renderGoogle(config.googleClientId);
   }catch(e){setStatus('No se pudo comprobar Google: '+e.message+'; podés continuar como invitado.');}
 }
 init();
})();
