import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
const actor=(id,speed=100)=>({id,name:id,definition:{types:['agua'],hp:260,attack:65,defense:90,specialAttack:65,specialDefense:90,speed,moveIds:['shift','strike','idle'],uniqueMoveId:'miss',globalAbilityId:'blank',uniqueAbilityId:'blank'}});
const baseMove=(id,power=0,accuracy=0,category='status')=>({id,name:id,definition:{type:'agua',category,power,accuracy,criticalChance:0,priority:0,rules:[]}});
const rule=(event,mode,target='enemy')=>({event,target,condition:{type:'always',value:''},action:{type:'switch_character',switchMode:mode},chance:100,duration:0,limit:0});
const setup=()=>({entities:{a:actor('a',180),b:actor('b',120),c:actor('c',80),d:actor('d',50),e:actor('e',40),f:actor('f',30)},moves:{shift:baseMove('shift'),strike:baseMove('strike',16,100,'physical'),idle:baseMove('idle'),miss:baseMove('miss',0,1)},abilities:{blank:{id:'blank',definition:{rules:[]}}},statuses:{},weathers:{},fields:{},scenarios:{}});
const run=(catalog,opts={})=>simulate({catalog,leftTeam:['a','c','e'],rightTeam:['b','d','f'],leftOrders:[{move:'shift'}],rightOrders:[{move:'idle'}],randomSource:()=>.5,turns:1,includeCheckpoint:true,...opts});
{
  const c=setup(); c.moves.shift.definition.rules=[rule('manual','random')];
  const r=run(c);
  assert.notEqual(r.rightActiveIndexes[0],0,'random on successful manual move happens immediately');
  assert.equal(r.forcedSwitches.length,0,'random does not queue a picker');
  assert.equal(r.needsReplacement.right.length,0);
}
{
  const c=setup(); c.moves.shift.definition.rules=[rule('manual','manual')];
  const r=run(c);
  assert.deepEqual(r.rightActiveIndexes,[0],'manual switch must not silently replace before selection');
  assert.deepEqual(r.needsReplacement.right,[0],'manual switch must request replacement via normal protocol');
  assert.equal(r.forcedSwitches.length,1);
  const applied=simulate({catalog:c,leftTeam:['a','c','e'],rightTeam:['b','d','f'],turns:1,resume:r.checkpoint,replacementsOnly:true,rightReplacements:[{choices:[{slot:0,teamIndex:2}]}],includeCheckpoint:true,randomSource:()=>.5});
  assert.deepEqual(applied.rightActiveIndexes,[2],'manual selection swaps the correct slot');
  assert.deepEqual(applied.needsReplacement.right,[],'manual queue clears after selection');
  assert.deepEqual(applied.forcedSwitches,[],'no stuck forced swap');
}
{
  const c=setup();c.moves.shift.definition.rules=[rule('manual','manual')];
  const r=run(c,{leftOrders:[{move:'shift',switchChoice:{side:'right',slot:0,teamIndex:1}}]});
  assert.deepEqual(r.rightActiveIndexes,[1], 'valid preselected target swaps without picker');
  assert.deepEqual(r.needsReplacement.right,[]);
}
{
  const c=setup();c.moves.miss.definition.rules=[rule('manual','random')];
  const r=run(c,{leftOrders:[{move:'miss'}],randomSource:()=>.99});
  assert.equal(r.rightActiveIndexes[0],0,'missed manual move does not force switch');
}
{
  const c=setup();c.moves.strike.definition.rules=[rule('on_hit','random')];
  const r=run(c,{leftOrders:[{move:'strike'}]});
  assert.notEqual(r.rightActiveIndexes[0],0,'on_hit switch fires when hit lands');
}
{
  const c=setup();c.moves.strike.definition.rules=[rule('turn_end','random')];
  const r=run(c,{leftOrders:[{move:'strike'}]});
  assert.equal(r.rightActiveIndexes[0],0,'wrong moment does not trigger switch');
}
{
  const c=setup();c.moves.strike.definition.power=10000;
  c.moves.strike.definition.rules=[rule('on_hit','manual')];
  const r=run(c,{leftOrders:[{move:'strike'}]});
  assert.equal(r.rightActive[0].hp,0);
  assert.deepEqual(r.needsReplacement.right,[0],'KO prompts normal replacement without forced swap');
  assert.deepEqual(r.forcedSwitches,[]);
}
{
  const c=setup();c.moves.shift.definition.rules=[rule('manual','manual')];
  const r=simulate({catalog:c,leftTeam:['a','c','e'],rightTeam:['b','d','f'],mode:'doubles',turns:1,leftOrders:[{actions:[{slot:0,move:'shift',target:{side:'right',slot:1}},{slot:1,move:'idle'}]}],rightOrders:[{actions:[{slot:0,move:'idle'},{slot:1,move:'idle'}]}],randomSource:()=>.5,includeCheckpoint:true});
  assert.deepEqual(r.needsReplacement.right,[1],'forced target in Doubles only affects selected slot');
  const applied=simulate({catalog:c,leftTeam:['a','c','e'],rightTeam:['b','d','f'],mode:'doubles',turns:1,resume:r.checkpoint,replacementsOnly:true,rightReplacements:[{choices:[{slot:1,teamIndex:2}]}],includeCheckpoint:true,randomSource:()=>.5});
  assert.deepEqual(applied.rightActiveIndexes,[0,2]);
}
{
  const c=setup();c.moves.strike.definition.rules=[rule('on_attack','random')];
  const r=run(c,{leftOrders:[{move:'strike'}]});
  assert.equal(r.rightTeam[0].hp,260,'on_attack random replacement happens BEFORE the attack; old target stays unharmed');
  assert.notEqual(r.rightActiveIndexes[0],0);
}
{
  const c=setup();c.abilities.onEnd={id:'onEnd',name:'Relevo al final',definition:{rules:[rule('turn_end','manual','self')]}};
  c.entities.a.definition.globalAbilityId='onEnd';
  const r=run(c,{leftOrders:[{move:'idle'}]});
  assert.deepEqual(r.needsReplacement.left,[0],'ability switch obeys turn_end event');
  assert.equal(r.leftActiveIndexes[0],0);
}
{
  const c=setup();c.moves.strike.definition.rules=[rule('on_attack','random','self')];
  const r=run(c,{leftOrders:[{move:'strike'}]});
  assert.notEqual(r.leftActiveIndexes[0],0);
  assert.equal(r.rightTeam[0].hp,260,'switched-out attacker cannot finish an attack');
}
console.log('Alpha 0.7: manual/azar, KO, timing y reemplazos Singles/Doubles OK');
