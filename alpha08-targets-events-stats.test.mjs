import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
const entity=(id,{hp=500,speed=100,ability='blank'}={})=>({id,name:id,definition:{types:['fuego'],hp,attack:130,defense:100,specialAttack:100,specialDefense:100,speed,moveIds:['hit','idle','idle'],uniqueMoveId:'idle',globalAbilityId:ability,uniqueAbilityId:'blank'}});
const R=(event,type,value,target='self',condition={type:'always'})=>({event,condition,target,action:{type,value},chance:100,duration:2,limit:0});
const hit={id:'hit',name:'Llamarada',definition:{type:'fuego',category:'physical',power:100,accuracy:100,criticalChance:0,priority:0,rules:[]}};
const idle={id:'idle',name:'Esperar',definition:{type:'fuego',category:'status',power:0,accuracy:0,criticalChance:0,rules:[]}};
function cat(a={},b={},c={}){return{entities:{a:entity('a',a),b:entity('b',b),c:entity('c',c)},moves:{hit:{...hit,definition:{...hit.definition}},idle},abilities:{blank:{id:'blank',name:'Ninguna',definition:{rules:[]}},reflect:{id:'reflect',name:'Espejo',definition:{rules:[R('on_receive_attack','damage_from_received_damage',100,'attacker',{type:'received_move_type',value:'fuego'})]}},dodge:{id:'dodge',name:'Evasor',definition:{rules:[R('on_dodge','damage',7,'attacker')]}},ally:{id:'ally',name:'Vínculo',definition:{rules:[R('on_ally_ko','damage',7,'self')]}},clean:{id:'clean',name:'Purificar',definition:{rules:[{...R('on_receive_attack','clear_stat_changes',0,'attacker'),action:{type:'clear_stat_changes',direction:'up',stats:['attack']}}]}},passive:{id:'passive',name:'Aura',definition:{rules:[{...R('on_condition','stat_change',2,'self'),action:{type:'stat_change',stat:'attack',value:2}}]}},block:{id:'block',name:'Escudo de stats',definition:{rules:[{...R('on_condition','block_stat_changes',0,'self'),action:{type:'block_stat_changes',direction:'both',stats:['attack']}}]}}},effects:{},statuses:{},weathers:{},fields:{grass:{id:'grass',name:'Aura vegetal',definition:{fieldEffects:[{type:'stat_change',stat:'attack',value:3,filter:'all',types:[],timing:'continuous',chance:100}]}}},scenarios:{}};}
const common={left:'a',right:'b',turns:1,leftOrders:[{move:'hit'}],rightOrders:[{move:'idle'}],randomSource:()=>0.4};
const base=simulate({...common,catalog:cat()});
const reflected=simulate({...common,catalog:cat({}, {ability:'reflect'})});
assert.ok(reflected.left.hp<base.left.hp,'el atacante recibe daño reflejado de un ataque directo');
assert.ok(reflected.log.some(t=>t.includes('Espejo')),'el narrador identifica el origen de la habilidad');
const missed=simulate({...common,catalog:(()=>{const c=cat({}, {ability:'dodge'});c.moves.hit.definition.accuracy=10;return c;})(),randomSource:()=>0.99});
assert.ok(missed.left.hp<500,'al esquivar se ejecuta en el defensor contra el atacante');
assert.ok(missed.log.some(x=>x.includes('esquivó el ataque')),'la evasión es real');
// El reflejo necesita el tipo que recibió, y no se activa con un tipo distinto.
const different=cat({}, {ability:'reflect'});different.moves.hit.definition.type='agua';
const noReflect=simulate({...common,catalog:different});
assert.equal(noReflect.left.hp,500);
// El aliado activo recibe el evento confirmado del compañero, solo en Doubles.
const dbl=cat({}, {hp:60}, {ability:'ally'});
const double=simulate({catalog:dbl,leftTeam:['a','c'],rightTeam:['b','c'],mode:'doubles',turns:1,leftOrders:[{actions:[{slot:0,move:'hit',target:{side:'right',slot:0}},{slot:1,move:'idle'}]}],rightOrders:[{actions:[{slot:0,move:'idle'},{slot:1,move:'idle'}]}],randomSource:()=>0.4});
assert.equal(double.rightTeam[0].hp,0,'compañero derrotado');
assert.ok(double.rightTeam[1].hp<500,'evento al perder al compañero activado');
// Limpiar cambios no pasivos preserva el bono pasivo, aunque quite una subida manual.
const clean=cat({ability:'passive'},{ability:'clean'});clean.moves.hit.definition.rules=[R('manual','stat_change',3,'self')];clean.moves.hit.definition.rules[0].action.stat='attack';
const cleaned=simulate({...common,catalog:clean});
assert.equal(cleaned.left.stages.attack||0,0,'limpieza de subidas del ataque');
assert.equal(cleaned.left.passiveStages.attack,2,'la subida pasiva continúa');
// Impedir cambios protege contra campos continuos y fuentes no pasivas.
const blocked=simulate({...common,catalog:cat({}, {ability:'block'}),field:'grass'});
assert.equal(blocked.right.environmentStages.attack||0,0,'bloquea el campo continuo');
assert.equal(blocked.left.environmentStages.attack,3,'no bloquea el campo para otros');
// Una habilidad anulada deja de reflejar daño y de conceder bonificaciones pasivas.
const silenced=cat({}, {ability:'reflect'});
silenced.abilities.reflect.definition.rules.push({...R('on_condition','stat_change',2,'self'),action:{type:'stat_change',stat:'attack',value:2}});
silenced.moves.hit.definition.rules=[R('manual','suppress_abilities',0,'enemy_team')];
const silent1=simulate({...common,catalog:silenced});
assert.equal(silent1.left.hp,500,'se anuló el reflejo de daño de la habilidad');
assert.equal(silent1.right.passiveStages.attack||0,0,'se anuló el bono pasivo de la habilidad');
assert.ok(silent1.right.effects.some(e=>e.id==='suppressed'),'la supresión continúa hasta caducar');
const silent2=simulate({...common,catalog:silenced,turns:2,leftOrders:[{move:'hit'},{move:'idle'}],rightOrders:[{move:'idle'},{move:'idle'}]});
assert.ok(!silent2.right.effects.some(e=>e.id==='suppressed'),'se acabó la supresión');
assert.equal(silent2.right.passiveStages.attack,2,'la habilidad vuelve a funcionar cuando termina la anulación');
// Forzar un fallo no es una esquiva, ni concede el evento de evasión.
const force=cat({}, {ability:'dodge'});
force.moves.hit.definition.rules=[R('on_attack','force_miss',0,'self')];
const forced=simulate({...common,catalog:force});
assert.equal(forced.left.hp,500,'fallar por efecto no equivale a esquivar');
// Filtrar por clase del movimiento es independiente de la afinidad elemental.
const category=cat({}, {ability:'reflect'});
category.abilities.reflect.definition.rules[0].condition={type:'received_move_category',value:'special'};
assert.equal(simulate({...common,catalog:category}).left.hp,500,'un ataque físico no pasa el filtro Especial');
// Bloquear solo bajadas no bloquea subidas de entorno.
const onlyDown=cat({}, {ability:'block'});
onlyDown.abilities.block.definition.rules[0].action.direction='down';
assert.equal(simulate({...common,catalog:onlyDown,field:'grass'}).right.environmentStages.attack,3);
// Limpiar solo bajadas preserva una subida manual.
const onlyCleanDown=cat({ability:'passive'}, {ability:'clean'});
onlyCleanDown.abilities.clean.definition.rules[0].action.direction='down';
onlyCleanDown.moves.hit.definition.rules=[{...R('manual','stat_change',3,'self'),action:{type:'stat_change',stat:'attack',value:3}}];
assert.equal(simulate({...common,catalog:onlyCleanDown}).left.stages.attack,3);
console.log('Nuevos eventos, objetivo atacante, tipos, reflejo, limpieza, bloqueo y negación de habilidades OK');
