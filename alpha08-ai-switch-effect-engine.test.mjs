import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';

// Editor/Lab shares the exact authoritative engine with Main. An ordinary
// room keeps the human picker, while Practice may delegate the right side to AI.
const actor=(id,speed=100)=>({id,name:id,definition:{types:['agua'],hp:500,attack:65,defense:150,specialAttack:65,specialDefense:150,speed,moveIds:['force','idle','idle'],uniqueMoveId:'idle',globalAbilityId:'none',uniqueAbilityId:'none'}});
const move=(id,{category='status',power=0,targeting='single',rules=[]}={})=>({id,name:id,definition:{type:'agua',targeting,category,power,accuracy:100,criticalChance:0,rules}});
const rule=(event,target='enemy')=>({event,target,condition:{type:'always'},chance:100,action:{type:'switch_character',switchMode:'manual'}});
const catalog=()=>({entities:{a:actor('a',180),b:actor('b',80),c:actor('c',40),d:actor('d',30)},moves:{force:move('force',{rules:[rule('on_attack')]}),idle:move('idle',{targeting:'self'})},abilities:{none:{id:'none',definition:{rules:[]}}},fields:{},weathers:{},scenarios:{},statuses:{}});
const opts=c=>({catalog:c,leftTeam:['a','c'],rightTeam:['b','d'],leftOrders:[{move:'force'}],rightOrders:[{move:'idle'}],turns:1,randomSource:()=>0.1});
{
 const c=catalog(),human=simulate(opts(c));
 assert.deepEqual(human.rightActiveIndexes,[0]);
 assert.deepEqual(human.needsReplacement.right,[0]);
 const ai=simulate({...opts(c),autoResolveSwitchSides:['right']});
 assert.deepEqual(ai.rightActiveIndexes,[1]);
 assert.deepEqual(ai.needsReplacement.right,[]);
 assert.ok(ai.log.some(x=>x.includes('Cambio automático de IA: d entra')));
 assert.ok(!ai.log.some(x=>x==='b usó idle.'),'AI old occupant must not act after it was forced out');
 assert.ok(ai.visualEvents.some(e=>e.type==='switch'&&e.side==='right'&&e.slot===0));
}
{
 const c=catalog();c.moves.force=move('force',{category:'physical',power:15,rules:[rule('on_hit')]});
 const result=simulate({...opts(c),autoResolveSwitchSides:['right']});
 const hit=result.log.findIndex(x=>/(?:b recibe|b recibió) /.test(x)&&x.includes('de daño'));
 const swap=result.log.findIndex(x=>x.includes('Cambio automático de IA: d entra'));
 assert.ok(hit>=0&&swap>hit);
 assert.equal(result.rightActiveIndexes[0],1);
}
console.log('Alpha 0.8 Editor: AI effect replacement resolves at trigger, rooms still use manual selection OK');
