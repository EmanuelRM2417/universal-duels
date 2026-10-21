import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
const entity=(id,speed,moves)=>({id,name:id,definition:{types:['fuego'],hp:450,attack:70,defense:100,specialAttack:70,specialDefense:100,speed,moveIds:moves,uniqueMoveId:moves[0],globalAbilityId:'blank',uniqueAbilityId:'blank'}});
const rule=(categories,types)=>({event:'manual',target:'target',condition:{type:'always'},chance:100,duration:3,action:{type:'restrict_moves',categories,types}});
const move=(id,type,category,rules=[])=>({id,name:id,definition:{type,category,power:category==='status'?0:15,accuracy:100,criticalChance:0,priority:0,rules}});
const cat={entities:{a:entity('a',180,['lock','wait','wait']),b:entity('b',25,['fire','water','heal'])},moves:{lock:move('lock','fuego','status',[rule(['status'],['fuego'])]),fire:move('fire','fuego','physical'),water:move('water','agua','special'),heal:move('heal','agua','status'),wait:move('wait','agua','status')},abilities:{blank:{id:'blank',definition:{rules:[]}}},weathers:{},fields:{},scenarios:{},statuses:{},effects:{}};
const run=(rightMove,catalog=cat,extra={})=>simulate({catalog,left:'a',right:'b',turns:2,leftOrders:[{move:'lock'},{move:'wait'}],rightOrders:[{move:'water'},{move:rightMove}],randomSource:()=>0.7,...extra});
assert.equal(run('fire').log.some(s=>s.includes('no puede usar fire: movimiento restringido')),true,'fire type blocked');
assert.equal(run('heal').log.some(s=>s.includes('no puede usar heal: movimiento restringido')),true,'status class blocked');
assert.equal(run('water').log.some(s=>s.includes('no puede usar water: movimiento restringido')),false,'unmatched attack remains usable');
cat.moves.lock.definition.rules=[rule([],[])];
assert.equal(run('water').log.some(s=>s.includes('no puede usar water: movimiento restringido')),true,'legacy/no-filters block all');
// A restricted character can still switch.
const switchCat=structuredClone(cat);switchCat.entities.c=entity('c',22,['water','fire','heal']);
const switched=run('water',switchCat,{rightTeam:['b','c'],rightOrders:[{move:'water'},{switch:1}]});
assert.equal(switched.rightActive[0].id,'c','switch is never restricted');
// Continuous environment restriction uses the same filters while active.
const envCat=structuredClone(cat);envCat.weathers.flare={id:'flare',name:'Flare',definition:{duration:5,fieldEffects:[{type:'restrict_moves',categories:['status'],moveTypes:['fuego'],timing:'continuous',filter:'all',types:[],chance:100}]}};
envCat.moves.lock.definition.rules=[];
const env=simulate({catalog:envCat,left:'a',right:'b',weather:'flare',turns:1,leftMove:'wait',rightMove:'fire',randomSource:()=>0.7});
assert.ok(env.log.some(s=>s.includes('no puede usar fire: movimiento restringido')),'weather continuous restrictions');
console.log('Alpha 0.6 filtros de restringir movimientos: categorías, tipos, compatibilidad, cambio, clima OK');
