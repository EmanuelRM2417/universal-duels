/* Alpha 0.7: first-run playable onboarding and Google Identity Services. */
(()=>{
 const $=id=>document.getElementById(id),gate=$('udAuthGate'),name=$('udAccountName'),status=$('udAuthStatus');
 let account=null,accessGranted=false,tutorialRunning=false,mandatory=false;
 const GUEST_SESSION_KEY='ud-alpha08-guest-session-active';
 function rememberedGuest(){try{return localStorage.getItem(GUEST_SESSION_KEY)==='1';}catch{return false;}}
 function rememberGuest(active){try{if(active)localStorage.setItem(GUEST_SESSION_KEY,'1');else localStorage.removeItem(GUEST_SESSION_KEY);}catch{}}
 window.udMandatoryTutorial=false;
 function setStatus(text){status.textContent=text;}
 function showGate(){gate.hidden=false;$('udAccountBar').hidden=true;}
 function accountBar(){gate.hidden=true;$('udAccountBar').hidden=false;$('udAccountEditNick').hidden=!account;name.textContent=account?'@'+(account.nick||account.name)+' · '+account.id:'Invitado';if(account&&$('name')){$('name').value=account.nick||account.name;$('name').readOnly=true;}else if($('name'))$('name').readOnly=false;}
 function allowPlay(){window.udAccountReady?.(account);accessGranted=true;window.udAuthAllowed=true;window.udMandatoryTutorial=false;accountBar();window.udRejoinRoom?.();}
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
 window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===$('udEmbeddedFrame').contentWindow&&['ud-tutorial-complete','ud-tutorial-skip'].includes(e.data?.type))finalize();});
 $('udGuestButton').addEventListener('click',()=>{account=null;rememberGuest(true);tutorial(true);});
 $('udAccountLogout').addEventListener('click',async()=>{if(account)try{await json('/api/auth/logout',{method:'POST'});}catch{}account=null;rememberGuest(false);window.udAccountReady?.(null);accessGranted=false;window.udAuthAllowed=false;showGate();});
 async function renderGoogle(clientId){
   if(!clientId){setStatus('El Worker publicado no está recibiendo GOOGLE_CLIENT_ID. Revisá que la variable esté en Main (no Editor ni Preview), en el entorno de producción, y que los cambios se hayan desplegado.');return;}
   const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
   script.onload=()=>{
     if(!window.google?.accounts?.id){setStatus('Google no está disponible en este navegador.');return;}
     google.accounts.id.initialize({client_id:clientId,callback:async response=>{
       try{setStatus('Verificando cuenta de Google…');const data=await json('/api/auth/google',{method:'POST',body:JSON.stringify({credential:response.credential})});account=data.user;rememberGuest(false);
         if(account.tutorialComplete)allowPlay();else tutorial(true);
       }catch(e){showGate();setStatus(e.message);}
     }});
     google.accounts.id.renderButton($('udGoogleButton'),{theme:'filled_blue',size:'large',shape:'pill',text:'continue_with',width:250});
     if(!$('udGoogleButton').children.length)setStatus('No apareció el botón de Google. Comprobá el origen autorizado https://universalduels.com y bloqueadores del navegador.');
   };
   script.onerror=()=>setStatus('No se pudo cargar Google. Podés jugar como invitado.');document.head.append(script);
 }
 const statGroups=[['total','Total'],['casual','Casuales / entrenamiento'],['salas','Salas online'],['singles','Singles'],['doubles','Doubles'],['casualSingles','Casuales · Singles'],['casualDoubles','Casuales · Doubles'],['salasSingles','Salas · Singles'],['salasDoubles','Salas · Doubles']];
 const statsPanel=$('udStatsPanel'),statsStatus=$('udStatsStatus');
 function fillStatsTable(stats){
   const host=$('udStatsContent');host.replaceChildren();
   const table=document.createElement('table'),head=document.createElement('thead'),header=document.createElement('tr');
   for(const title of ['Categoría','Jugadas','Ganadas','Perdidas','Winrate','Daño infligido','Daño recibido','Derrotados']){
     const th=document.createElement('th');th.textContent=title;header.append(th);
   }
   head.append(header);table.append(head);const body=document.createElement('tbody');
   for(const [key,title] of statGroups){
     const s=stats?.[key]||{},played=Number(s.played)||0,wins=Number(s.wins)||0;
     const values=[title,played,wins,Number(s.losses)||0,(played?100*wins/played:0).toFixed(1)+'%',Number(s.damageDealt)||0,Number(s.damageReceived)||0,Number(s.defeated)||0];
     const tr=document.createElement('tr');for(const value of values){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}body.append(tr);
   }
   table.append(body);host.append(table);
 }
 $('udAccountEditNick')?.addEventListener('click',()=>$('udStatsOpen')?.click());
 $('udStatsOpen')?.addEventListener('click',async()=>{
   statsPanel.hidden=false;statsStatus.textContent='';$('udStatsIdentity').textContent='';$('udStatsContent').replaceChildren();
   $('udStatsNick').value=account?.nick||'';
   $('udStatsNick').disabled=!account;$('udStatsSaveNick').disabled=!account;
   if(!account){statsStatus.textContent='Iniciá sesión con Google para guardar estadísticas y asignar un ID único.';return;}
   try{
     const data=await json('/api/auth/stats');account=data.user;
     $('udStatsIdentity').textContent='ID: '+account.id+' · Nick: '+account.nick;
     $('udStatsNick').value=account.nick||'';fillStatsTable(data.stats);
   }catch(e){statsStatus.textContent='No se pudieron cargar las estadísticas: '+e.message;}
 });
 $('udStatsClose')?.addEventListener('click',()=>{statsPanel.hidden=true;});
 $('udStatsSaveNick')?.addEventListener('click',async()=>{
   if(!account)return;
   try{
     const data=await json('/api/auth/nick',{method:'POST',body:JSON.stringify({nick:$('udStatsNick').value})});
     account=data.user;accountBar();$('udStatsIdentity').textContent='ID: '+account.id+' · Nick: '+account.nick;
     statsStatus.textContent='Nick actualizado.';
   }catch(e){statsStatus.textContent='No se pudo guardar el nick: '+e.message;}
 });
 async function init(){
   // No mostrar el formulario antes de conocer la sesión: evita el destello
   // de la pantalla de inicio de sesión al recargar con Google o invitado.
   gate.hidden=true;
   try{
     const me=await json('/api/auth/me');
     if(me.user){
       account=me.user;rememberGuest(false);
       if(account.tutorialComplete){allowPlay();return;}
       tutorial(true);
     }else if(rememberedGuest()){
       account=null;allowPlay();return;
     }else showGate();
   }catch(e){
     if(rememberedGuest()){account=null;allowPlay();return;}
     showGate();setStatus('No se pudo verificar la sesión: '+e.message);
   }
   try{const config=await json('/api/auth/config');await renderGoogle(config.googleClientId);}
   catch(e){setStatus('No se pudo comprobar Google: '+e.message+'; podés continuar como invitado.');}
 }
 init();
})();
