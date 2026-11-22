import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
const rule=(event,action,target='self',extra={})=>({event,target,action,chance:100,duration:0,limit:0,condition:{type:'always',value:''},conditions:[],...extra});
const move=(id,priority=0,rules=[],targeting='self',power=0)=>({id,name:id,definition:{kind:'global',type:'agua',category:power?'special':'status',targeting,power,accuracy:0,criticalChance:0,priority,cooldown:0,rules}});
const entity=(id,speed=100,ability='empty')=>({id:id.toLowerCase(),name:id,definition:{hp:500,attack:100,defense:100,specialAttack:100,specialDefense:100,speed,types:['agua'],moveIds:['idle','strike','strike'],uniqueMoveId:'wound',globalAbilityId:'empty',uniqueAbilityId:ability}});
const apple=(action,event='manual')=>({id:'apple',name:'Manzana',definition:{timing:'start',spriteId:'manzana',rules:[rule('manual',{type:'heal',value:35}),rule(event,action,'self',{duration:3})]}});
const cat={entities:{a:entity('A',1),b:entity('B',200),c:entity('C',80)},moves:{idle:move('idle'),strike:move('strike',-5,[], 'single',30),wound:move('wound',0,[rule('manual',{type:'damage',value:75},'target')],'single')},abilities:{empty:{id:'empty',definition:{rules:[]}},change:{id:'change',definition:{rules:[rule('turn_start',{type:'stat_change',stat:'speed',value:1},'self',{condition:{type:'going_to_switch'}})]}},arrival:{id:'arrival',definition:{rules:[rule('turn_start',{type:'stat_change',stat:'speed',value:1},'self',{condition:{type:'first_turn_in_field'}})]}}},effects:{},statuses:{},items:{}};
const order=(...entries)=>({actions:entries.map((x,slot)=>({slot,...x}))});
const run=(catalog,opts={})=>simulate({catalog,chart:{},leftTeam:['a'],rightTeam:['b'],leftItems:Object.keys(catalog.items).slice(0,3),rightItems:[],mode:'singles',turns:1,randomSource:()=>0.42,leftOrders:[order({move:'idle'})],rightOrders:[order({move:'idle'})],...opts});
for (const variety of ['periodic-rule','periodic-effect']){
 const c=structuredClone(cat);c.items.apple=apple(variety==='periodic-rule'?{type:'heal',value:5}:{type:'heal_over_time',value:5},variety==='periodic-rule'?'turn_end':'manual');
 let prev=run(c,{leftOrders:[order({move:'idle'})],rightOrders:[order({move:'wound',target:{side:'left',slot:0}})],includeCheckpoint:true});
 assert.equal(prev.leftTeam[0].hp,125,'primera ronda: pérdida inicial de PS');
 for(const [round,want] of [[2,325],[3,350],[4,375],[5,375]]){
   prev=run(c,{turns:round,resume:prev.checkpoint,includeCheckpoint:true,
      leftOrders:[order({move:'idle'}),order({move:'idle',item:round===2?'apple':undefined}),order({move:'idle'}),order({move:'idle'}),order({move:'idle'})],
      rightOrders:[order({move:'wound',target:{side:'left',slot:0}}),order({move:'idle'}),order({move:'idle'}),order({move:'idle'}),order({move:'idle'})]});
   assert.equal(prev.leftTeam[0].hp,want,`${variety}: recuperación de 35 % + 5 % durante tres turnos, ronda ${round}`);
   if(round===2){assert.deepEqual(prev.usedItems.left,['apple']);assert.equal(prev.visualEvents.filter(e=>e.type==='item_use').length,1);assert.ok(prev.log.some(line=>line.includes('A consumió Manzana.')));assert.ok(prev.log.indexOf('A consumió Manzana.')<prev.log.findIndex(x=>x.includes('recupera 25 PS')),'narración de consumo precede a la curación periódica');}
 }
}
const energy={id:'energy',name:'Energética',definition:{timing:'priority',rules:[rule('manual',{type:'move_first'},'self',{duration:1})]}};
{
 const c=structuredClone(cat);c.items.energy=energy;
 const out=run(c,{leftTeam:['a'],rightTeam:['b','c'],leftItems:['energy'],leftOrders:[order({move:'strike',item:'energy'})],rightOrders:[order({switch:1})]});
 assert.ok(out.log.findIndex(x=>x.includes('A usó strike.'))>=0,'el ataque se ejecuta');
 assert.ok(out.log.findIndex(x=>x.includes('A usó strike.'))<out.log.findIndex(x=>x.includes('Cambio: C entra al campo.')),'moverse primero ignora prioridad -5, velocidad baja y sucede antes del cambio');
}
{
 const c=structuredClone(cat);c.items.energy=energy;c.items.energy2={...energy,id:'energy2'};c.moves.fast=move('fast',5,[],'single',30);c.entities.b.definition.moveIds=['fast','idle','wound'];
 const out=run(c,{leftItems:['energy'],rightItems:['energy2'],leftOrders:[order({move:'strike',item:'energy'})],rightOrders:[order({move:'fast',item:'energy2'})]});
 const a=out.log.findIndex(x=>x.includes('A usó strike.')),b=out.log.findIndex(x=>x.includes('B usó fast.'));
 assert.ok(b>=0&&a>=0&&b<a,'dos usuarios de moverse primero desempatan por prioridad antes de Velocidad');
}
{
 const c=structuredClone(cat);c.items.late={id:'late',name:'Pesadez',definition:{timing:'start',rules:[rule('manual',{type:'move_last'},'self',{duration:1})]}};
 const out=run(c,{leftItems:['late'],leftOrders:[order({move:'strike',item:'late'})],rightOrders:[order({move:'idle'})]});
 assert.ok(out.log.findIndex(x=>x.includes('B usó idle.'))<out.log.findIndex(x=>x.includes('A usó strike.')),'moverse último supera cualquier prioridad');
}
{
 const c=structuredClone(cat);c.entities.a.definition.uniqueAbilityId='change';
 let out=run(c,{leftTeam:['a','c'],leftOrders:[order({switch:1})]});
 assert.ok(out.log.findIndex(x=>x.includes('Velocidad de A subió'))<out.log.findIndex(x=>x.includes('Cambio: C entra')),'va a cambiar se evalúa antes del cambio manual');
 out=run(c);assert.ok(!out.log.some(x=>x.includes('Velocidad de A subió')),'no se activa sin cambio voluntario');
}
{
 const c=structuredClone(cat);c.entities.c.definition.uniqueAbilityId='arrival';
 let out=run(c,{leftTeam:['a','c'],leftOrders:[order({switch:1})],includeCheckpoint:true});
 assert.equal(out.leftTeam[1].stages.speed||0,0,'no se considera primer turno completo el de entrada por cambio');
 out=run(c,{leftTeam:['a','c'],turns:2,resume:out.checkpoint,leftOrders:[order({switch:1}),order({move:'idle'})],rightOrders:[order({move:'idle'}),order({move:'idle'})]});
 assert.equal(out.leftTeam[1].stages.speed,1,'primer turno completo tras entrada activa la condición');
}
console.log('Consumibles Alpha 0.9: manzana, checkpoints, prioridad absoluta, cambios, primera entrada: OK');
// Las condiciones pueden observar el cambio voluntario del OBJETIVO, no solamente el del usuario.
{
 const c=structuredClone(cat);
 c.abilities.watch={id:'watch',definition:{rules:[rule('turn_start',{type:'stat_change',stat:'speed',value:1},'self',{condition:{type:'going_to_switch',subject:'target'}})]}};
 c.entities.a.definition.uniqueAbilityId='watch';
 let out=run(c,{leftOrders:[order({move:'idle'})],rightTeam:['b','c'],rightOrders:[order({switch:1})]});
 assert.equal(out.leftTeam[0].stages.speed,1,'va a cambiar detecta cambio voluntario del objetivo');
 out=run(c,{leftOrders:[order({move:'idle'})],rightTeam:['b','c'],rightOrders:[order({move:'idle'})]});
 assert.equal(out.leftTeam[0].stages.speed||0,0,'va a cambiar no reacciona sin cambio elegido');
}
// La regeneración periódica deja de aplicarse al salir del campo, salvo persistencia explícita.
{
 const c=structuredClone(cat);c.items.apple=apple({type:'heal',value:5},'turn_end');
 let result=run(c,{leftTeam:['a','c'],rightTeam:['b'],leftItems:['apple'],turns:4,includeCheckpoint:true,
  leftOrders:[order({move:'idle'}),order({move:'idle',item:'apple'}),order({switch:1}),order({switch:0})],
  rightOrders:[order({move:'wound',target:{side:'left',slot:0}}),order({move:'idle'}),order({move:'idle'}),order({move:'idle'})]});
 assert.equal(result.leftTeam[0].hp,325,'salir del campo cancela las reglas temporales de curación');
 assert.ok(result.checkpoint.activeConsumableRules.some(e=>e.id==='apple'&&e.disabledRules.includes(1)), 'reglas canceladas persisten en checkpoint');
}
