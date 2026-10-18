import assert from 'node:assert/strict';
import {basicStageFactor,scaledChance,hitChance,criticalChance,netStages} from './stat-math.js';
import {simulate} from './battle-engine.js';

const near=(actual,expected,msg)=>assert.ok(Math.abs(actual-expected)<1e-9,`${msg}: got ${actual}, expected ${expected}`);
const stages=(stat,value)=>({event:'on_enter',condition:{type:'always'},target:'self',action:{type:'stat_change',stat,value},chance:100,duration:0,limit:0});
const entry=(id,ability='neutral')=>({id,name:id,definition:{types:['fuego'],hp:500,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:['strike','wait','alt'],uniqueMoveId:'unique',globalAbilityId:ability,uniqueAbilityId:'neutral'}});
const move=(id,{accuracy=100,crit=0,power=0}={})=>({id,name:id,definition:{type:'fuego',category:power?'physical':'status',power,accuracy,criticalChance:crit,priority:0,rules:[]}});
const baseCatalog={entities:{left:entry('left'),right:entry('right')},moves:{strike:move('strike',{accuracy:80,power:10}),wait:move('wait',{accuracy:0}),alt:move('alt'),unique:move('unique')},abilities:{neutral:{id:'neutral',definition:{rules:[]}}},effects:{},statuses:{},scenarios:{},weathers:{},fields:{}};
const run=(leftStages=[],rightStages=[],accuracy=80,crit=0,random=0.7,mode='singles')=>{
  const catalog=structuredClone(baseCatalog);
  catalog.abilities.attacker={id:'attacker',definition:{rules:leftStages}};
  catalog.abilities.defender={id:'defender',definition:{rules:rightStages}};
  catalog.entities.left.definition.globalAbilityId='attacker';
  catalog.entities.right.definition.globalAbilityId='defender';
  catalog.moves.strike=move('strike',{accuracy,crit,power:10});
  return simulate({catalog,left:'left',right:'right',leftTeam:mode==='doubles'?['left','left2']:undefined,rightTeam:mode==='doubles'?['right','right2']:undefined,turns:1,mode,randomSource:()=>random,leftMove:'strike',rightMove:'wait',leftOrders:mode==='doubles'?[{actions:[{slot:0,move:'strike',target:{side:'right',slot:0}},{slot:1,move:'wait',target:{side:'left',slot:1}}]}]:[{move:'strike'}],rightOrders:mode==='doubles'?[{actions:[{slot:0,move:'wait'},{slot:1,move:'wait'}]}]:[{move:'wait'}]});
};
// Asymmetric, additive stages, including opposing sources and saturation.
for(const [n,want] of [[0,1],[1,1.10],[4,1.40],[10,2],[-1,.95],[-4,.80],[-10,.50]])near(basicStageFactor(n),want,`basic level ${n}`);
near(basicStageFactor(4,-2),1.2,'opposing positive and negative stages net together');
near(basicStageFactor(10,5,-3),2,'net stages clamp after summing');
assert.equal(netStages(8,-10),-2);
// Relative, additive percentage per level; other independent effects use the base as their reference.
near(scaledChance(20,4),24,'20% evasion +4 = 24%');
near(scaledChance(10,4),12,'10% critical +4 = 12%');
near(scaledChance(80,-2),72,'80% accuracy -2 = 72%');
near(scaledChance(0,1),6,'0% with +1 awakens at 6%');
near(scaledChance(0,4),9,'0% with +4 uses zero-baseline special case');
near(scaledChance(0,-1),0,'negative stage does not create probability');
near(hitChance(80,{}, {stages:{evasion:4}}),76,'80% base accuracy and evasion +4');
// La evasión inicial es propia de CADA movimiento; 20% no es un valor universal.
for(const [accuracy,expectedHit] of [[90,88],[80,76],[70,64],[50,40]]){
  near(hitChance(accuracy,{}, {stages:{evasion:4}}),expectedHit,`evasion +4 for move ${accuracy}%`);
}
near(hitChance(100,{}, {stages:{evasion:4}}),91,'zero miss baseline awakens to 9% with evasion +4');
near(hitChance(100,{}, {stages:{evasion:1}}),94,'100% base accuracy and evasion +1');
near(hitChance(80,{stages:{accuracy:4}}, {stages:{evasion:4}}),91.2,'independent accuracy and evasion factors multiply');
near(hitChance(0,{stages:{accuracy:-10}},{stages:{evasion:10}}),100,'accuracy=0 never fails');
near(criticalChance(0,{stages:{criticalChance:1}}),6,'0% crit gets 6% from +1');
near(criticalChance(10,{stages:{criticalChance:4}}),12,'10% crit grows relatively, not by 20 points');
near(criticalChance(20,{stages:{criticalChance:4},environmentCrit:2}),26,'environmental crit stacks as stages');

const up=run([stages('attack',1),stages('speed',3)]);
assert.equal(up.left.currentStats.attack,110);
assert.equal(up.left.currentStats.speed,130);
const down=run([stages('defense',-1),stages('speed',-3)]);
assert.equal(down.left.currentStats.defense,95);
assert.equal(down.left.currentStats.speed,85);
const hit=run([],[stages('evasion',4)],80,0,0.75);
assert.ok(!hit.log.some(x=>x.includes('evadió el ataque')),'RNG 75% must hit when hit chance is 76%');
const miss=run([],[stages('evasion',4)],80,0,0.78);
assert.ok(miss.log.some(x=>x.includes('evadió el ataque')),'RNG 78% must miss when hit chance is 76%');
const zeroEvade=run([],[stages('evasion',1)],100,0,0.95);
assert.ok(zeroEvade.log.some(x=>x.includes('evadió el ataque')),'100% move is reduced to 94% after evasion +1');
const neverMiss=run([stages('accuracy',-10)],[stages('evasion',10)],0,0,0.999);
assert.ok(!neverMiss.log.some(x=>x.includes('evadió el ataque')),'accuracy 0 ignores any stage/effect');
const zeroCritical=run([stages('criticalChance',1)],[],0,0,0.055);
assert.ok(zeroCritical.log.some(x=>x.includes('recibió un crítico')),'critical 0% plus stage +1 yields 6%');
const normalCritical=run([stages('criticalChance',1)],[],0,0,0.07);
assert.ok(!normalCritical.log.some(x=>x.includes('recibió un crítico')),'critical 7% does not trigger with a 6% chance');
const multiCatalog=structuredClone(baseCatalog);
for(const id of ['left2','right2'])multiCatalog.entities[id]=entry(id);
const d=run.toString();
const dbl=simulate({catalog:multiCatalog,leftTeam:['left','left2'],rightTeam:['right','right2'],mode:'doubles',turns:1,leftOrders:[{actions:[{slot:0,move:'strike',target:{side:'right',slot:0}},{slot:1,move:'wait'}]}],rightOrders:[{actions:[{slot:0,move:'wait'},{slot:1,move:'wait'}]}],randomSource:()=>0.7});
assert.equal(dbl.mode,'doubles');
assert.deepEqual(simulate({catalog:multiCatalog,leftTeam:['left','left2'],rightTeam:['right','right2'],mode:'doubles',turns:1,leftOrders:[{actions:[{slot:0,move:'strike',target:{side:'right',slot:0}},{slot:1,move:'wait'}]}],rightOrders:[{actions:[{slot:0,move:'wait'},{slot:1,move:'wait'}]}],randomTape:dbl.randomTape}),dbl,'Doubles remains deterministic with new formula');

// Continuous field and status modifiers must use the same probability model.
const fieldCatalog=structuredClone(baseCatalog);
fieldCatalog.moves.strike=move('strike',{accuracy:80,power:10,crit:0});
fieldCatalog.fields.azar={id:'azar',name:'Azar',definition:{duration:5,fieldEffects:[
 {type:'stat_change',timing:'continuous',filter:'all',types:[],chance:100,stat:'evasion',value:4},
 {type:'critical_change',timing:'continuous',filter:'all',types:[],chance:100,value:1}
]}};
const fieldMiss=simulate({catalog:fieldCatalog,left:'left',right:'right',field:'azar',turns:1,leftMove:'strike',rightMove:'wait',randomSource:()=>.78});
assert.ok(fieldMiss.log.some(x=>x.includes('evadió el ataque')),'continuous field +4 evasion uses 24% (not +20 points)');
assert.equal(fieldMiss.left.environmentStages.evasion,4,'environment stage not permanent stage');
assert.equal(fieldMiss.right.environmentCrit,1,'continuous critical stage is a level, not five percentage points');
const fieldCrit=simulate({catalog:fieldCatalog,left:'left',right:'right',field:'azar',turns:1,leftMove:'strike',rightMove:'wait',randomSource:()=>.055});
assert.ok(fieldCrit.log.some(x=>x.includes('recibió un crítico')),'continuous field +1 crit awakens zero-base 6%');
console.log('Alpha 0.4: additive +/- stages, relative precision/crit/evasion, zero fallback, no-miss, Singles/Doubles OK');
