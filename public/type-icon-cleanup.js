/* Universal Duels — conservative transparency restoration for embedded checkerboards.
   Never changes images already using alpha and never touches game content storage. */
(function(global){
'use strict';
function dist(a,b){return Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[2]-b[2]));}
function restore(canvas){
  const w=canvas.width,h=canvas.height;if(w<8||h<8)return {changed:false,reason:'Dimensiones demasiado pequeñas'};
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return{changed:false,reason:'Canvas no disponible'};
  let pixels;try{pixels=ctx.getImageData(0,0,w,h)}catch{return{changed:false,reason:'Imagen no accesible'}}
  const d=pixels.data,n=w*h;let transparent=0;for(let i=3;i<d.length;i+=4)if(d[i]<240)transparent++;
  if(transparent/n>.01)return{changed:false,reason:'El PNG ya contiene transparencia'};
  const counts=new Map();let total=0;
  const sample=(x,y)=>{const p=4*(y*w+x);const v=[d[p],d[p+1],d[p+2]];const k=v.map(c=>Math.round(c/12)*12).join(',');const rec=counts.get(k)||{sum:[0,0,0],n:0};for(let j=0;j<3;j++)rec.sum[j]+=v[j];rec.n++;counts.set(k,rec);total++;};
  const step=Math.max(1,Math.floor(Math.min(w,h)/96));
  for(let x=0;x<w;x+=step){sample(x,0);sample(x,h-1)}
  for(let y=1;y<h-1;y+=step){sample(0,y);sample(w-1,y)}
  const top=[...counts.values()].sort((a,b)=>b.n-a.n).slice(0,2);
  if(top.length!==2||top[0].n/total<.18||top[1].n/total<.10||((top[0].n+top[1].n)/total)<.67)
    return{changed:false,reason:'No se detectó un patrón cuadriculado seguro'};
  const colors=top.map(r=>r.sum.map(x=>x/r.n));
  if(dist(colors[0],colors[1])>110||dist(colors[0],colors[1])<3)
    return{changed:false,reason:'Los colores del borde no parecen un tablero'};
  const matches=p=>colors.some(c=>Math.max(Math.abs(d[p]-c[0]),Math.abs(d[p+1]-c[1]),Math.abs(d[p+2]-c[2]))<=22);
  const visited=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
  function enqueue(i){if(i<0||i>=n||visited[i]||!matches(4*i))return;visited[i]=1;queue[tail++]=i;}
  for(let x=0;x<w;x++){enqueue(x);enqueue((h-1)*w+x)}
  for(let y=0;y<h;y++){enqueue(y*w);enqueue(y*w+w-1)}
  while(head<tail){const i=queue[head++],x=i%w,y=(i/w)|0;if(x>0)enqueue(i-1);if(x<w-1)enqueue(i+1);if(y>0)enqueue(i-w);if(y<h-1)enqueue(i+w)}
  // Safeguard: do not erase a frame dominated by the art's own palette.
  if(tail<n*.07||tail>n*.96)return{changed:false,reason:'Bordes ambiguos, no se alteró la imagen'};
  for(let i=0;i<n;i++)if(visited[i])d[4*i+3]=0;
  ctx.putImageData(pixels,0,0);return{changed:true,removed:tail};
}
function decode(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
const results=new Map();
async function cleanUrl(src){if(!results.has(src))results.set(src,(async()=>{const image=await decode(src);const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;c.getContext('2d').drawImage(image,0,0);const result=restore(c);return{...result,url:result.changed?c.toDataURL('image/png'):src,canvas:c};})().catch(e=>{results.delete(src);throw e}));return results.get(src);}
function mount(root=document){root.querySelectorAll('img[src*="/type-icons/"]:not([data-ud-type-clean])').forEach(img=>{img.dataset.udTypeClean='1';const src=img.src;cleanUrl(src).then(r=>{if(img.isConnected&&r.changed)img.src=r.url;}).catch(()=>{});});}
global.UDTypeIcons={restore,cleanUrl,mount};
})(typeof window==='undefined'?globalThis:window);
