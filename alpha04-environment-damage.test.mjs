import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
const entity=(id)=>({id,name:id,definition:{types:['agua'],hp:750,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:id==='left'?120:50,moveIds:['flame','water','wait'],uniqueMoveId:'wait',globalAbilityId:'blank',uniqueAbilityId:'blank'}});
const move=(id,type)=>({id,name:id,definition:{category:id==='wait'?'status':'special',type,power:id==='wait'?0:80,accuracy:100,criticalChance:0,priority:0,rules:[]}});
const cat={entities:{left:entity('left'),right:entity('right')},moves:{flame:move('flame','fuego'),water:move('water','agua'),wait:move('wait','agua')},abilities:{blank:{id:'blank',definition:{rules:[]}}},weathers:{sun:{id:'sun',name:'Sol',definition:{fieldEffects:[{type:'final_damage',timing:'continuous',filter:'all',types:[],attackTypes:['fuego'],value:20,mode:'percent',stacking:'additive',chance:100}]}}},fields:{},scenarios:{},statuses:{}};
const run=(m,w='')=>simulate({catalog:cat,left:'left',right:'right',turns:1,leftMove:m,rightMove:'wait',weather:w,randomSource:()=>0.9});
assert.ok(run('flame','sun').right.hp<run('flame').right.hp,'sun boosts fire final damage');
assert.equal(run('water','sun').right.hp,run('water').right.hp,'sun does not boost water final damage');
const status={id:'empowered',name:'Empoderado',definition:{rules:[{event:'on_status',condition:{type:'always'},action:{type:'final_damage',value:20,mode:'percent',stacking:'additive'},chance:100}]}};
cat.statuses.empowered=status;
// use a move to apply the status before attacking, then confirm it changes attack damage
const apply=move('apply','agua');apply.definition.category='status';apply.definition.power=0;apply.definition.rules=[{event:'manual',condition:{type:'always'},target:'self',action:{type:'apply_status',value:'empowered'},duration:2,chance:100}];cat.moves.apply=apply;cat.entities.left.definition.moveIds=['apply','flame','water'];
const empowered=simulate({catalog:cat,left:'left',right:'right',turns:2,leftOrders:[{move:'apply'},{move:'flame'}],rightOrders:[{move:'wait'},{move:'wait'}],randomSource:()=>0.9});
const plain=simulate({catalog:cat,left:'left',right:'right',turns:2,leftOrders:[{move:'wait'},{move:'flame'}],rightOrders:[{move:'wait'},{move:'wait'}],randomSource:()=>0.9});
assert.ok(empowered.right.hp<plain.right.hp,'status boosts final attack damage');
console.log('Clima filtrado por tipo y estado alterado con daño final opcional OK');
