import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
const entity=(id,ability='blank')=>({id,name:id,definition:{types:['fuego'],hp:100,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:id==='attacker'?200:80,moveIds:['strike','wait','wait'],uniqueMoveId:'wait',globalAbilityId:ability,uniqueAbilityId:'blank'}});
const move=(id,power)=>({id,name:id,definition:{type:'fuego',category:'physical',power,accuracy:100,criticalChance:0,priority:0,rules:[]}});
const renacer={id:'rebirth',definition:{rules:[
 {event:'on_death',target:'self',condition:{type:'always'},action:{type:'resurrect',value:1},limit:1},
 {event:'on_death',target:'self',condition:{type:'always'},action:{type:'immunity',damageClass:'all',typeFilter:{mode:'all',types:[]}},duration:2,limit:1}
]}};
const catalog={entities:Object.fromEntries(['attacker','ally','phoenix','partner','reserve'].map(id=>[id,entity(id,id==='phoenix'?'rebirth':'blank')])),moves:{strike:move('strike',250),wait:move('wait',0)},abilities:{blank:{id:'blank',definition:{rules:[]}},rebirth:renacer},effects:{}};
const orders=[ [{slot:0,move:'strike',target:{side:'right',slot:0}},{slot:1,move:'wait',target:{side:'right',slot:1}}], [{slot:0,move:'wait',target:{side:'left',slot:0}},{slot:1,move:'wait',target:{side:'left',slot:1}}] ];
const first=simulate({catalog,mode:'doubles',leftTeam:['attacker','ally'],rightTeam:['phoenix','partner','reserve'],turns:1,leftOrders:[orders[0]],rightOrders:[orders[1]],randomSource:()=>.8,includeCheckpoint:true});
assert.equal(first.rightActive[0].hp,1,'Phoenix should revive with 1% of 100 HP');
assert.equal(first.rightActive[0].activeSlot,0,'Revived unit retains slot 0');
assert.equal(first.rightActive[1].activeSlot,1,'Partner retains slot 1');
assert.deepEqual(first.needsReplacement.right,[],'No replacement when revival succeeds');
assert.equal(first.deathEvents.length,0,'No confirmed KO after immediate revival');
assert.ok(first.rightActive[0].effects.some(e=>e.id==='immunity'),'Revived unit must be immune');
const second=simulate({catalog,mode:'doubles',leftTeam:['attacker','ally'],rightTeam:['phoenix','partner','reserve'],turns:2,resume:first.checkpoint,randomTape:first.randomTape,leftOrders:[orders[0],orders[0]],rightOrders:[orders[1],orders[1]],randomSource:()=>.8});
assert.equal(second.rightActive[0].hp,1,'Second round hit blocked by immunity');
assert.ok(second.log.some(x=>x.includes('inmune')),'Immunity message is logged');
console.log('Alpha 0.4: doubles Renacer keeps both selectable slots, resurrection HP, immunity and no false replacement OK');
