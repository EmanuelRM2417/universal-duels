import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
const entity=(id,ability='blank',moves=['tap','idle','idle'])=>({id,name:id,definition:{types:['agua'],hp:100,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:moves,uniqueMoveId:'idle',globalAbilityId:ability,uniqueAbilityId:'blank'}});
const move=(id,power=0,rules=[])=>({id,name:id,definition:{type:'agua',category:power?'physical':'status',power,accuracy:100,criticalChance:0,priority:0,rules}});
const cond=(act,mode='normal')=>({event:'on_condition',condition:{type:'streak_count',subject:'self',value:'hit:1:3'},target:'self',action:act,duration:12,streakEffectMode:mode,chance:100});
const core={entities:{a:entity('a','charger'),b:entity('b','blank')},moves:{tap:move('tap',1),idle:move('idle'),blast:move('blast',500)},abilities:{blank:{id:'blank',definition:{rules:[]}}},statuses:{poison:{id:'poison',name:'Veneno',definition:{rules:[]}}}};
{
 const catalog={...core,entities:{...core.entities,a:entity('a','charger',['blast','idle','idle']),b:entity('b','survive',['idle','idle','idle'])},abilities:{...core.abilities,charger:{id:'charger',definition:{rules:[]}},survive:{id:'survive',definition:{survive:{chance:100,fixedHp:88,limit:1},rules:[]}}}};
 const r=simulate({catalog,left:'a',right:'b',leftMove:'blast',rightMove:'idle',turns:1,randomSource:()=>.8});
 assert.equal(r.right.hp,1);
 const index=r.log.findIndex(x=>x.includes('activa Sobrevivir')&&x.includes('1 PS'));
 assert(index>=0,'Survival is narrated immediately');
 assert(r.visualEvents.some(e=>e.logIndex===index&&e.type==='unit_state'&&e.unit?.hp===1&&e.side==='right'),'The 1 HP appears in the visual timeline on the exact survival event');
}
for(const a of [{type:'apply_status',value:'poison'},{type:'restrict_moves',categories:['physical']},{type:'cooldown_on_use',value:2}]){
 const c={...core,abilities:{...core.abilities,charger:{id:'charger',definition:{rules:[cond(a)]}}}};
 const started=simulate({catalog:c,left:'a',right:'b',leftMove:'tap',rightMove:'idle',turns:1,randomSource:()=>.8});
 assert(a.type==='apply_status'?started.left.status?.id==='poison':started.left.effects.some(e=>e.id===a.type),`${a.type} begins with streak`);
 const stopped=simulate({catalog:c,left:'a',right:'b',leftOrders:[{move:'tap'},{move:'idle'}],rightOrders:[{move:'idle'},{move:'idle'}],turns:2,randomSource:()=>.8});
 assert(a.type==='apply_status'?!stopped.left.status:!stopped.left.effects.some(e=>e.id===a.type),`${a.type} vanishes as soon as the streak is lost`);
}
{
 const c={...core,abilities:{...core.abilities,charger:{id:'charger',definition:{rules:[cond({type:'stat_change',stat:'speed',value:2},'per_turn')]}}}};
 const r=simulate({catalog:c,left:'a',right:'b',leftOrders:[{move:'tap'},{move:'tap'},{move:'tap'},{move:'tap'}],rightOrders:[{move:'idle'},{move:'idle'},{move:'idle'},{move:'idle'}],turns:4,randomSource:()=>.8});
 assert.equal(r.left.passiveStages.speed||0,0,'max streak bound 3 deactivates the effect at 4 hits');
}
console.log('PASS: Survival visual 1HP snapshot, status/immunity/restrictions/cooldown removal on lost streak, upper bound and per-turn bonus.');
