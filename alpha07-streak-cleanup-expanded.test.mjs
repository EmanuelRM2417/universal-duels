import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
const ent=(id,ab,mov)=>({id,name:id,definition:{types:['agua'],hp:150,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:[mov,'idle','idle'],uniqueMoveId:'idle',globalAbilityId:ab,uniqueAbilityId:'blank'}});
const mov=(id,power=0)=>({id,name:id,definition:{type:'agua',category:power?'physical':'status',power,accuracy:100,priority:0,rules:[]}});
const basic={entities:{hero:ent('hero','charger','tap'),villain:ent('villain','blank','idle')},moves:{tap:mov('tap',1),idle:mov('idle')},abilities:{blank:{id:'blank',definition:{rules:[]}}}};
for(const action of [
 {type:'restrict_moves',categories:['physical']},
 {type:'cooldown_on_use',value:2}
]){
 const rule={event:'on_condition',condition:{type:'streak_count',subject:'self',value:'hit:1:3'},target:'self',action,duration:12,chance:100,streakEffectMode:'normal'};
 const catalog={...basic,abilities:{...basic.abilities,charger:{id:'charger',name:'Carga',definition:{rules:[rule]}}}};
 const first=simulate({catalog,left:'hero',right:'villain',turns:1,leftMove:'tap',rightMove:'idle',randomSource:()=>.8});
 assert.equal(first.left.effects.some(e=>e.id===action.type),true,`${action.type} installed on hitting`);
 const lost=simulate({catalog,left:'hero',right:'villain',turns:2,leftOrders:[{move:'tap'},{move:'idle'}],rightOrders:[{move:'idle'},{move:'idle'}],randomSource:()=>.8});
 assert.equal(lost.left.effects.some(e=>e.id===action.type),false,`${action.type} removed after broken streak`);
}
console.log('Expanded streak lifecycle: restrict_moves and cooldown_on_use activate and disappear correctly.');
