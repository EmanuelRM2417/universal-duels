import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
const creature=(id)=>({id,name:id,definition:{types:['fuego'],hp:500,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:['chain','idle','idle'],uniqueMoveId:'idle',globalAbilityId:'blank',uniqueAbilityId:'blank'}});
const idle={id:'idle',name:'Esperar',definition:{type:'fuego',category:'status',power:0,accuracy:0,criticalChance:0,rules:[]}};
const move=unit=>({id:'chain',name:'Cadena',definition:{type:'fuego',category:'physical',power:5,accuracy:100,criticalChance:0,priority:0,multihit:{min:3,max:3,effects:'each'},streak:{enabled:true,conditionMode:'hit',countUnit:unit,minStreak:1,perStack:20,valueMode:'fixed'},rules:[]}});
function run(unit){return simulate({left:'a',right:'b',catalog:{entities:{a:creature('a'),b:creature('b')},moves:{chain:move(unit),idle},abilities:{blank:{id:'blank',definition:{rules:[]}}},effects:{},statuses:{},weathers:{},fields:{},scenarios:{}},turns:1,leftMove:'chain',rightMove:'idle',randomSource:()=>.99});}
const perHit=run('hit'),perChain=run('chain');
assert.equal(perHit.log.filter(t=>/recibió \d+ de daño \(golpe [1-3]\)\./.test(t)).length,3);
assert.equal(perHit.log.filter(t=>/^Golpe \d+\//.test(t)).length,0);
assert.equal(perHit.left.consecutiveCounters.streakHits,3);
assert.equal(perChain.left.consecutiveCounters.hit,1);
assert.ok(perHit.right.hp<perChain.right.hp,`cada golpe debe potenciar posteriores golpes (${perHit.right.hp} < ${perChain.right.hp})`);
const repeat=simulate({left:'a',right:'b',catalog:{entities:{a:creature('a'),b:creature('b')},moves:{chain:move('hit'),idle},abilities:{blank:{id:'blank',definition:{rules:[]}}}},turns:1,leftMove:'chain',rightMove:'idle',randomTape:perHit.randomTape});
assert.equal(repeat.right.hp,perHit.right.hp,'la ejecución con la misma cinta RNG es determinista');
console.log('Rachas: por impacto, por cadena, formato de narración y determinismo correctos.');
