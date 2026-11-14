import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
import {createPractice,advancePractice} from './practice-session.js';

// A human must still choose a manual replacement in a normal room. Practice's
// right-hand AI instead selects a living reserve at the precise effect event.
const entity=(id,speed,moveId)=>({id,name:id,definition:{types:['agua'],hp:500,attack:65,defense:150,specialAttack:65,specialDefense:150,speed,moveIds:[moveId,moveId,moveId],uniqueMoveId:moveId,globalAbilityId:'none',uniqueAbilityId:'none'}});
const rule=(event,target)=>({event,target,condition:{type:'always'},chance:100,action:{type:'switch_character',switchMode:'manual'}});
const mv=(id,{target='self',category='status',power=0,rules=[]}={})=>({id,name:id,definition:{type:'agua',targeting:target,category,power,accuracy:100,criticalChance:0,priority:0,rules}});
const catalog=()=>({
  entities:{a:entity('a',190,'force'),c:entity('c',160,'idle'),b:entity('b',90,'idle'),d:entity('d',60,'idle'),f:entity('f',45,'idle'),g:entity('g',35,'idle')},
  moves:{force:mv('force',{target:'single',rules:[rule('on_attack','enemy')]}),idle:mv('idle')},
  abilities:{none:{id:'none',name:'Ninguna',definition:{rules:[]}}},statuses:{},fields:{},weathers:{},scenarios:{}
});
const opts=(c,more={})=>({catalog:c,leftTeam:['a','c'],rightTeam:['b','d'],leftOrders:[{move:'force'}],rightOrders:[{move:'idle'}],turns:1,randomSource:()=>0.1,...more});
const practice=(c,{mode='singles',left=['a','c'],right=['b','d']}={})=>createPractice({catalog:c,revision:'ai-relevo-test',mode,difficulty:'easy',leftTeam:left,rightTeam:right,now:1000});
const turn=(p,c,order)=>advancePractice(p,'turn',{order},{catalog:c,now:2000,random:()=>0.1});
const assertImmediate=(r,oldName,slot=0)=>{
  const logs=r.state.log;
  const idx=logs.findIndex(line=>line.includes('Cambio automático de IA:'));
  assert.ok(idx>=0,'AI must switch via event immediately, not at turn-end picker');
  assert.ok(!logs.some(line=>line===`${oldName} usó idle.`),'replaced opponent must not carry out the original queued action');
  assert.deepEqual(r.state.needsReplacement.right,[],'AI must not queue a second picker');
  assert.ok(r.visualEvents.some(e=>e.type==='switch'&&e.side==='right'&&e.slot===slot),'switch visual must be sent to Practice UI at the event');
  assert.ok(r.state.forcedSwitches.every(f=>f.side!=='right'),'no unresolved forced switch for AI');
  return idx;
};
{
  const c=catalog();
  const room=simulate(opts(c));
  assert.deepEqual(room.rightActiveIndexes,[0], 'normal battles still prompt humans for manual effect replacements');
  assert.deepEqual(room.needsReplacement.right,[0]);
  const p=practice(c),r=turn(p,c,{slot:0,move:'force'});
  assert.deepEqual(r.state.rightActiveIndexes,[1]);
  assertImmediate(r,'b');
  assert.equal(p.rightReplacements.length,0,'no post-turn workaround needed for effect switches');
  assert.ok(r.lastTurnLogs.some(x=>x.includes('Cambio automático de IA: d entra')));
}
{
  const c=catalog();
  // A replacement is also immediate when the condition is the first successful hit.
  c.moves.force=mv('force',{target:'single',category:'physical',power:18,rules:[rule('on_hit','enemy')]});
  const p=practice(c),r=turn(p,c,{slot:0,move:'force'});
  const swap=assertImmediate(r,'b');
  const hit=r.state.log.findIndex(x=>x.includes('b recibe ')&&x.includes('de daño'));
  assert.ok(hit>=0&&hit<swap,'switch must occur after impact, before the next action');
  assert.deepEqual(r.state.rightActiveIndexes,[1]);
}
{
  const c=catalog();
  // If the AI itself uses an ability/move requiring a manual self switch,
  // it must also be resolved on the effect's activation, without waiting.
  c.entities.b.definition.speed=200;
  c.entities.a.definition.speed=100;
  c.entities.b.definition.moveIds=['selfShift','selfShift','selfShift'];c.entities.b.definition.uniqueMoveId='selfShift';
  c.moves.selfShift=mv('selfShift',{rules:[rule('on_attack','self')]});
  c.entities.a.definition.moveIds=['idle','idle','idle'];c.entities.a.definition.uniqueMoveId='idle';
  const p=practice(c),r=turn(p,c,{slot:0,move:'idle'});
  assertImmediate(r,'b');
  assert.ok(r.state.log.findIndex(x=>x.includes('Cambio automático de IA'))<r.state.log.findIndex(x=>x==='a usó idle.'),'AI self-switch occurs before the next player action');
}
{
  const c=catalog();
  // Doubles: target slot 1 should be replaced, slot 0 remains active and acts.
  const p=practice(c,{mode:'doubles',left:['a','c'],right:['b','d','f']});
  const r=turn(p,c,{actions:[{slot:0,move:'force',target:{side:'right',slot:1}},{slot:1,move:'idle'}]});
  assert.deepEqual(r.state.rightActiveIndexes,[0,2]);
  assertImmediate(r,'d',1);
  assert.ok(r.state.log.some(x=>x==='b usó idle.'),'other active AI unit is unaffected');
  assert.ok(!r.state.log.some(x=>x==='f usó idle.'),'incoming reserve cannot act without a submitted action');
}
{
  const c=catalog();
  c.moves.force=mv('force',{target:'single',category:'physical',power:18,rules:[rule('on_hit','enemy')]});
  c.moves.force.definition.multihit={min:3,max:3,effects:'each'};
  const p=practice(c),r=turn(p,c,{slot:0,move:'force'});
  assertImmediate(r,'b');
  assert.ok(r.state.log.some(x=>x.includes('(golpe 1)')),'first impact still occurs');
  assert.ok(!r.state.log.some(x=>x.includes('b recibió ')&&x.includes('(golpe 2)')),'old enemy cannot be hit again after being replaced');
}
console.log('Alpha 0.8: AI resolves manual effect switching at activation, on_attack/on_hit, self, target, Doubles and chain; rooms unchanged OK');
