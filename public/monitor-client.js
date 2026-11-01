/* Lightweight, anonymous per-tab presence; no IP, email or browser fingerprint is collected. */
(()=>{
 const page=location.pathname.startsWith('/practice')?'practice':location.pathname.startsWith('/catalog')?'catalog':location.pathname.startsWith('/tutorial')?'tutorial':'home';
 const key='ud-monitor-tab-v1';let id;
 try{id=sessionStorage.getItem(key);if(!id||!/^[0-9a-f-]{36}$/i.test(id)){id=crypto.randomUUID();sessionStorage.setItem(key,id);}}catch{id=crypto.randomUUID();}
 let first=true;
 const ping=()=>{
  if(document.visibilityState==='hidden')return;
  const pageview=first;first=false;
  fetch('/api/monitor/ping',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({tabId:id,page,pageview}),keepalive:true}).catch(()=>{});
 };
 ping();setInterval(ping,15_000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')ping();});
})();
