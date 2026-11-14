import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {simulate} from './battle-engine.js';
import {hitChance,criticalChance} from './stat-math.js';
const entry=(id,ability='none')=>({id,name:id,definition:{types:['fuego'],hp:450,attack:100,defense:140,specialAttack:100,specialDefense:140,speed:id==='a'?130:70,moveIds:['fuego','boost','quiet'],uniqueMoveId:'agua',globalAbilityId:ability,uniqueAbilityId:'none'}});
const rule=(event,action,target='self')=>({event,condition:{type:'always',value:''},target,action,chance:100,duration:0,limit:0});
const make=(filter=null)=>({entities:{a:entry('a'),b:entry('b',filter===false?'none':'reflect')},moves:{
 fuego:{id:'fuego',name:'Físico fuego',definition:{type:'fuego',category:'physical',power:35,accuracy:0,rules:[]}},
 agua:{id:'agua',name:'Especial agua',definition:{type:'agua',category:'special',power:35,accuracy:0,rules:[]}},
 quiet:{id:'quiet',name:'Esperar',definition:{type:'fuego',category:'status',power:0,accuracy:0,rules:[]}},
 boost:{id:'boost',name:'Prepararse',definition:{type:'fuego',category:'status',targeting:'self',power:0,accuracy:0,rules:[rule('on_hit',{type:'stat_change',stat:'attack',value:2})]}}
},abilities:{none:{id:'none',name:'Ninguna',definition:{rules:[]}},reflect:{id:'reflect',name:'Devolver',definition:{rules:[{...rule('on_receive_attack',{type:'damage_from_received_damage',value:100},'attacker'),...(filter?{receivedAttackFilter:filter}:{})}]}}},statuses:{},fields:{},weathers:{},scenarios:{},effects:{}});
const simulateHit=(cat,move='fuego',rand=()=>.4)=>simulate({catalog:cat,left:'a',right:'b',turns:1,leftOrders:[{move}],rightOrders:[{move:'quiet'}],randomSource:rand});
const hitBase=simulateHit(make(false));
const all=simulateHit(make({mode:'all',types:[],category:'both'}));
assert.ok(all.left.hp<hitBase.left.hp,'ambos y todos permiten reflejar un ataque físico');
const includeFuego=simulateHit(make({mode:'include',types:['fuego'],category:'physical'}));
assert.ok(includeFuego.left.hp<hitBase.left.hp,'incluir fuego y físico refleja fuego físico');
const excluded=simulateHit(make({mode:'exclude',types:['fuego'],category:'both'}));
assert.equal(excluded.left.hp,hitBase.left.hp,'excluir fuego bloquea fuego');
const wrongClass=simulateHit(make({mode:'include',types:['fuego'],category:'special'}));
assert.equal(wrongClass.left.hp,hitBase.left.hp,'ataque físico no coincide con filtro especial');
const specialBase=simulateHit(make(false),'agua');
const special=simulateHit(make({mode:'include',types:['agua'],category:'special'}),'agua');
assert.ok(special.left.hp<specialBase.left.hp,'especial agua sí coincide en tipo y clase');
const wrongType=simulateHit(make({mode:'include',types:['fuego'],category:'special'}),'agua');
assert.equal(wrongType.left.hp,specialBase.left.hp,'especial agua no coincide con solo fuego');
const withoutFilter=simulateHit(make(),'agua');
assert.ok(withoutFilter.left.hp<specialBase.left.hp,'habilidades anteriores sin filtro conservan su comportamiento');
const boost=simulateHit(make(false),'boost');
assert.equal(boost.left.stages.attack,2,'estado que acierta aplica el cambio de stat');
const missedCatalog=make(false);
missedCatalog.moves.boost.definition.accuracy=15;
const missed=simulateHit(missedCatalog,'boost',()=>.99);
assert.equal(missed.left.stages.attack||0,0,'un movimiento de estado que falla no aplica efectos al acertar');
assert.ok(missed.log.some(x=>x.includes('esquivó el ataque')),'un fallo de precisión se explica en el narrador');
const manualCatalog=make(false);
manualCatalog.moves.boost.definition.rules=[rule('manual',{type:'stat_change',stat:'defense',value:3})];
assert.equal(simulateHit(manualCatalog,'boost').left.stages.defense,3,'efecto Al usar sigue pudiendo subir stats');

// En Doubles, cada defensor recibe su propio resultado: uno puede esquivar y el otro recibir el golpe.
const doublesCat=make(false);
doublesCat.entities.c=entry('c');
doublesCat.entities.b=entry('b','evasive');
doublesCat.abilities.evasive={id:'evasive',name:'Evasión',definition:{rules:[rule('on_condition',{type:'stat_change',stat:'evasion',value:10})]}};
doublesCat.moves.fuego.definition.targeting='enemy_team';
doublesCat.moves.fuego.definition.accuracy=100;
const doubles=simulate({catalog:doublesCat,mode:'doubles',leftTeam:['a','c'],rightTeam:['b','c'],turns:1,
 leftOrders:[{actions:[{slot:0,move:'fuego'},{slot:1,move:'quiet'}]}],rightOrders:[{actions:[{slot:0,move:'quiet'},{slot:1,move:'quiet'}]}],randomSource:()=>.75});
assert.equal(doubles.rightTeam[0].hp,450,'en Doubles, el primero esquiva con +10 evasión');
assert.ok(doubles.rightTeam[1].hp<450,'el segundo recibe el golpe y pierde PS');
assert.ok(doubles.log.some(x=>x.includes('b esquivó el ataque de')),'el primer defensor muestra el fallo');
assert.ok(doubles.log.some(x=>x.includes('c recibe')||x.includes('c recibió')),'el segundo defensor muestra daño');

// Los niveles pasivos de las probabilidades cuentan en el cálculo real, no solo en el panel.
assert.equal(hitChance(100,{stages:{},passiveStages:{accuracy:10}},{stages:{evasion:6}}),100,'precisión pasiva +10 compensa evasión +6');
assert.equal(hitChance(100,{stages:{}},{stages:{},passiveStages:{evasion:10}}),50,'evasión pasiva +10 reduce acierto a 50%');
assert.equal(criticalChance(10,{stages:{},passiveStages:{criticalChance:4}}),12,'crítico pasivo influye en la probabilidad');

// Real shared animation execution with two defenders. No hit flicker or recoil on dodge.
const js=readFileSync(new URL('./public/battle-visuals.js',import.meta.url),'utf8');
const frames={};
function character(side,slot,x){const node={getBoundingClientRect(){return{left:x,right:x+20,top:50,bottom:70}},closest(){return{getBoundingClientRect(){return{width:800,height:450}}}},animate(steps,options){frames[side+slot]=steps;return{finished:Promise.resolve(),cancel(){}}}};return{side,slot,node};}
const c0=character('right',0,100),c1=character('right',1,200);
const fakeUnits=[c0,c1].map(x=>({dataset:{side:x.side,slot:String(x.slot)},querySelector(){return x.node}}));
const dom={querySelector(sel){const m=sel.match(/data-side="([^"]+)".*data-slot="([^"]+)"/);return [c0,c1].find(c=>m?.[1]===c.side&&m?.[2]===String(c.slot))?.node||null;},querySelectorAll(){return fakeUnits}};
const win={};vm.runInNewContext(js,{window:win,document:dom,setTimeout,Promise});
await win.UDBattleVisuals.dodge({side:'right',slot:0},1);
assert.match(frames.right0[1].translate,/^-17px 0px$/,'el defensor izquierdo se mueve a su izquierda');
await win.UDBattleVisuals.dodge({side:'right',slot:1},1);
assert.match(frames.right1[1].translate,/^17px 0px$/,'el defensor derecho se mueve a su derecha');
assert.ok(frames.right1.every(f=>!('filter' in f)),'la esquiva no brilla ni reproduce choque');
console.log('Alpha 0.8: filtro por clase/tipo, movimientos de estado al acertar, esquiva individual izquierda/derecha OK');
