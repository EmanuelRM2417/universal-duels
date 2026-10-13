import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
const ent=id=>({id,name:id,definition:{types:['fuego'],hp:170,attack:120,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:['hit','wait','finisher'],uniqueMoveId:'unique',globalAbilityId:'none',uniqueAbilityId:'none'}});
const move=(id,power)=>({id,name:id,definition:{type:'fuego',category:power?'physical':'status',power,accuracy:100,criticalChance:0,priority:0,rules:[]}});
const catalog={entities:Object.fromEntries(['a','b','c','d'].map(id=>[id,ent(id)])),moves:{hit:move('hit',20),wait:move('wait',0),finisher:move('finisher',500),unique:move('unique',10)},abilities:{none:{id:'none',definition:{rules:[]}}}};
for(const mode of ['singles','doubles']){
 const base={catalog,mode,leftTeam:['a','c'],rightTeam:['b','d'],randomSource:()=>.31};
 const left=mode==='singles'?[{move:'hit'},{move:'hit'}]:Array.from({length:2},()=>({actions:[{slot:0,move:'hit',target:{side:'right',slot:0}},{slot:1,move:'hit',target:{side:'right',slot:1}}]}));
 const right=mode==='singles'?[{move:'wait'},{move:'wait'}]:Array.from({length:2},()=>({actions:[{slot:0,move:'wait'},{slot:1,move:'wait'}]}));
 const r1=simulate({...base,turns:1,leftOrders:left.slice(0,1),rightOrders:right.slice(0,1),includeCheckpoint:true});
 const r2=simulate({...base,turns:2,leftOrders:left,rightOrders:right,resume:r1.checkpoint,includeCheckpoint:true});
 const full=simulate({...base,turns:2,leftOrders:left,rightOrders:right});
 assert.deepEqual(r2.leftTeam,full.leftTeam);assert.deepEqual(r2.rightTeam,full.rightTeam);
 assert.equal(r2.rounds,2);assert.deepEqual([...r1.log,...r2.log],full.log);
}
const base={catalog,mode:'singles',leftTeam:['a','c'],rightTeam:['b','d'],randomSource:()=>.31};
const ko=simulate({...base,turns:1,leftOrders:[{move:'finisher'}],rightOrders:[{move:'wait'}],includeCheckpoint:true});
assert.deepEqual(ko.needsReplacement.right,[0]);
const choices=[{choices:[{slot:0,teamIndex:1}]}];
const resumed=simulate({...base,turns:1,leftOrders:[{move:'finisher'}],rightOrders:[{move:'wait'}],rightReplacements:choices,resume:ko.checkpoint,replacementsOnly:true,includeCheckpoint:true});
const full=simulate({...base,turns:1,leftOrders:[{move:'finisher'}],rightOrders:[{move:'wait'}],rightReplacements:choices});
assert.deepEqual(resumed.rightTeam,full.rightTeam);assert.deepEqual(resumed.rightActiveIndexes,full.rightActiveIndexes);
assert.match(resumed.log.join(' '),/Relevo/);
console.log('Alpha 0.4: continuación incremental coincide con replay completo en Singles, Doubles y sustituciones KO');
