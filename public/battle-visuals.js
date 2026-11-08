/* Universal Duels Alpha 0.8: batallas en pantalla, sin modificar las reglas del servidor. */
(function(g){'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function roster(team,active,already,slot,helpers){
  const {spriteUrl,typeMark,esc}=helpers;
  return `<div class="ud-team-pick-grid" data-replacement-slot="${slot}">`+team.map((u,i)=>{
    const unavailable=u.hp<=0?'Derrotado':active.includes(i)?'En campo':already.includes(i)?'Ya elegido':'';
    const pct=clamp(u.maxHp>0?100*u.hp/u.maxHp:0,0,100),img=spriteUrl(u.id);
    return `<button type="button" class="ud-team-pick" data-i="${i}" data-slot="${slot}" ${unavailable?'disabled':''} aria-label="${esc(u.name)}, ${u.hp} de ${u.maxHp} PS${unavailable?', no disponible: '+unavailable:''}"><strong>${esc(u.name)}</strong>${img?`<span class="ud-sprite-preview" data-view="front"><img class="battle-sprite-sheet" src="${img}" alt=""></span>`:'<span class="ud-sprite-preview"></span>'}<span class="ud-team-types">${(u.types||[]).map(typeMark).join('')}</span><span class="ud-team-hp"><span class="ud-team-hp-track"><span class="ud-team-hp-fill" style="width:${pct}%"></span></span><span>${Number(u.hp)||0} / ${Number(u.maxHp)||0} PS</span></span>${unavailable?`<span class="ud-team-unavailable">${unavailable}</span>`:''}</button>`;
  }).join('')+'</div>';
 }
 function mount(root){if(g.UDSprites?.mount)g.UDSprites.mount(root);if(g.UDTypeIcons?.mount)g.UDTypeIcons.mount(root);}
 function sprite(ref){if(!ref)return null;return document.querySelector(`.battle-unit[data-side="${ref.side}"][data-slot="${ref.slot}"] .battle-sprite-window`);}
 function center(node){const r=node.getBoundingClientRect();return{x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};}
 async function play(node,frames,duration,easing='ease-in-out'){
  if(!node||duration<=0)return;
  if(typeof node.animate!=='function'){await new Promise(r=>setTimeout(r,duration));return;}
  const animation=node.animate(frames,{duration,iterations:1,easing,fill:'none'});
  try{await animation.finished;}catch{}finally{animation.cancel();}
 }
 async function travel(actor,targetRefs,hitRef,scale=1,miss=false){
  const from=sprite(actor),hit=sprite(hitRef);if(!from)return;
  const candidates=(targetRefs||[]).map(sprite).filter(Boolean);
  const positions=(candidates.length?candidates:hit?[hit]:[]).map(center);
  if(!positions.length)return;
  const avg={x:positions.reduce((n,p)=>n+p.x,0)/positions.length,y:positions.reduce((n,p)=>n+p.y,0)/positions.length},here=center(from),deltaX=avg.x-here.x,deltaY=avg.y-here.y;
  const stage=from.closest('.battle-stage')?.getBoundingClientRect(),maximumX=(stage?.width||900)*.83,maximumY=(stage?.height||700)*.78;
  const x=clamp(deltaX*.92,-maximumX,maximumX),y=clamp(deltaY*.92,-maximumY,maximumY);
  const time=Math.round(2000*scale),stay=Math.round(time*.56);
  const animation=play(from,[{translate:'0px 0px',offset:0},{translate:`${x}px ${y}px`,offset:.56},{translate:`${x}px ${y}px`,offset:.7},{translate:'0px 0px',offset:1}],time,'cubic-bezier(.37,.04,.35,1)');
  await new Promise(r=>setTimeout(r,stay));
  const reaction=hit?play(hit,miss?[{translate:'0px 0px'},{translate:'13px -9px'},{translate:'-7px 5px'},{translate:'0px 0px'}]:[{translate:'0px 0px',filter:'brightness(1)'},{translate:'-10px 4px',filter:'brightness(1.7)'},{translate:'5px -2px'},{translate:'0px 0px',filter:'brightness(1)'}],Math.round(440*scale)) :Promise.resolve();
  await Promise.all([animation,reaction]);
 }
 async function circles(ref,scale=1){
  const node=sprite(ref);if(!node)return;
  const r=9;const frames=[];
  for(let i=0;i<=16;i++){const theta=Math.PI*2*(i/8),a=i/16;frames.push({translate:`${Math.round(r*Math.cos(theta)-r)}px ${Math.round(r*Math.sin(theta))}px`,filter:`brightness(${(1+0.55*Math.sin(Math.PI*a)).toFixed(2)})`,offset:a});}
  frames[0].translate='0px 0px';frames[frames.length-1].translate='0px 0px';
  await play(node,frames,Math.round(1900*scale));
 }
 g.UDBattleVisuals={roster,mount,travel,circles};
})(window);
