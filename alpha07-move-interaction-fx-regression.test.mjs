import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const files=['public/index.html','public/practice.html'];
function functionBlock(src,start,end){const i=src.indexOf(start);assert(i>=0,`Missing ${start}`);const j=src.indexOf(end,i+start.length);assert(j>i,`Missing next ${end}`);return src.slice(i,j);}
for(const file of files){
 const html=readFileSync(new URL(file,import.meta.url),'utf8');
 const selectSource=functionBlock(html,'function maybeSwitchChoice(','function commitAction(');
 const elements={
  battleModalTitle:{textContent:''},battleModalBody:{innerHTML:'',querySelectorAll(sel){return [...this.innerHTML.matchAll(/data-i="(\d+)"/g)].map(match=>({dataset:{i:match[1]},onclick:null})).map(btn=>{this.buttons.push(btn);return btn;})},buttons:[]},
  battleModalClose:{hidden:true},battleModal:{hidden:true},
 };
 const chosen=[];
 const ctx={
   $:id=>elements[id],battleLastData:{leftActiveIndexes:[0]},playerSide:()=> 'left',
   pUnits:()=>({playerTeam:[{name:'A',hp:100,maxHp:100},{name:'Reserva',hp:90,maxHp:100}]}),
   esc:s=>s,commitAction:action=>chosen.push(action),
   moveHasManualSelfSwitch:()=>true,Number,
 };
 vm.runInNewContext(selectSource,ctx);
 const actor={slot:0,move:'teleport'};
 ctx.maybeSwitchChoice(actor,{},{});
 assert.equal(elements.battleModal.hidden,false,`${file}: modal must open for manual switch in Singles`);
 assert.equal(elements.battleModalClose.hidden,false);
 assert.match(elements.battleModalBody.innerHTML,/Reserva/);
 assert.equal(elements.battleModalBody.buttons.length,1);
 elements.battleModalBody.buttons[0].onclick();
 assert.equal(chosen.length,1);
 assert.equal(chosen[0].switchChoice.teamIndex,1);
 assert.equal(chosen[0].switchChoice.slot,0);
 ctx.pUnits=()=>({playerTeam:[{name:'A',hp:100,maxHp:100}]});
 elements.battleModal.hidden=true;
 ctx.maybeSwitchChoice({slot:0,move:'teleport'}, {}, {});
 assert.equal(chosen.length,2,`${file}: no reserves should not deadlock move selection`);
 assert.equal(elements.battleModal.hidden,true);
 assert(html.includes('udRestoreHpTransitions'),`${file}: HP transitions must survive rerenders`);
 assert(html.includes('udAnimateImpact(line)'),`${file}: each hit must animate`);
 assert(html.includes('udAnimateOtherStatusTargets'),`${file}: status affected targets animation`);
 assert(html.includes('udFxDodge')&&html.includes('udFxRecoil')&&html.includes('udFxSpecial'),`${file}: dedicated reactions`);
 const fxSrc=functionBlock(html,'function udReadImpact(','async function udAnimateImpact(');
 const sandbox={};vm.runInNewContext(fxSrc,sandbox);
 for(const log of ['@@R@@Rival recibe 11 de daño.','@@R@@Rival recibió 8 de daño (golpe 1).','@@R@@Rival recibió 7 de daño (golpe 2).']){
  assert.equal(sandbox.udReadImpact(log).kind,'hit',`${file}: each chain hit must be recognized`);
 }
 assert.equal(sandbox.udReadImpact('@@L@@Aliado falló contra @@R@@Rival.').kind,'miss');
 assert.equal(sandbox.udReadImpact('El campo inflige 6 puntos. '),null);
 console.log(`${file}: selección Singles + reacciones por golpe + PS OK`);
}
