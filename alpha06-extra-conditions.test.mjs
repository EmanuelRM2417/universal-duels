import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
const entity=(id,speed=50)=>({id,name:id,definition:{types:['fuego'],hp:150,attack:180,defense:80,specialAttack:80,specialDefense:80,speed,moveIds:['hit','drain','wait'],uniqueMoveId:'hit',globalAbilityId:'blank',uniqueAbilityId:'blank'}});
const rule=(type,value='',action={type:'heal',value:0},event='manual')=>({event,condition:{type,value},target:'self',action,chance:100,duration:0,limit:0,conditions:[]});
const catalog=()=>({entities:{a:entity('a',180),b:entity('b',20)},moves:{hit:{id:'hit',name:'Golpe',definition:{type:'fuego',category:'physical',power:500,accuracy:100,criticalChance:0,priority:0,rules:[]}},drain:{id:'drain',name:'Contrapartida',definition:{type:'agua',category:'physical',power:40,accuracy:100,criticalChance:0,priority:0,rules:[rule('always','',{type:'damage_from_damage',value:1000},'on_hit')]}},wait:{id:'wait',name:'Espera',definition:{type:'agua',category:'status',power:0,accuracy:0,criticalChance:0,priority:0,rules:[]}}},abilities:{blank:{id:'blank',definition:{rules:[]}}},fields:{field1:{id:'field1',name:'Campo',definition:{duration:5,fieldEffects:[]}}},weathers:{rain:{id:'rain',name:'Lluvia',definition:{duration:5,fieldEffects:[]}}},scenarios:{arena:{id:'arena',name:'Arena',definition:{duration:5,fieldEffects:[]}}},statuses:{burn:{id:'burn',name:'Quemadura',definition:{duration:2,rules:[]}}},effects:{}});
const run=(cat,options={})=>simulate({catalog:cat,left:'a',right:'b',turns:1,leftMove:'wait',rightMove:'wait',randomSource:()=>0.75,...options});
for(const [type,key,ref,wrong] of [['weather_is','weather','rain','other'],['field_is','field','field1','other'],['scenario_is','scenario','arena','other']]){
  const c=catalog();c.abilities.check={id:'check',name:'Prueba',definition:{rules:[{...rule(type,'',{type:'stat_change',stat:'speed',value:1},'turn_start'),target:'self'}]}};c.entities.a.definition.globalAbilityId='check';
  assert.equal(run(c,{[key]:ref}).left.stages.speed,1,`${type} vacío acepta cualquier ${key}`);
  c.abilities.check.definition.rules[0].condition.value=ref;
  assert.equal(run(c,{[key]:ref}).left.stages.speed,1,`${type} ID exacto`);
  c.abilities.check.definition.rules[0].condition.value=wrong;
  assert.equal(run(c,{[key]:ref}).left.stages.speed||0,0,`${type} rechaza ID distinto`);
  c.abilities.check.definition.rules[0].condition.value='';
  assert.equal(run(c).left.stages.speed||0,0,`${type} necesita algún ${key} activo`);
}
{
 const c=catalog();c.moves.hit.definition.rules=[{...rule('enemy_defeated','',{type:'stat_change',stat:'speed',value:2},'on_enemy_ko')}];
 const result=run(c,{leftMove:'hit'});
 assert.equal(result.right.hp,0,'golpe letal confirmado');
 assert.equal(result.left.stages.speed,2,'evento y condición Al derrotar a un enemigo');
 const non=run(c,{leftMove:'wait'});assert.equal(non.left.stages.speed||0,0,'sin KO no activa');
}
{
 const c=catalog();const r=run(c,{leftMove:'drain'});
 assert.ok(r.log.some(x=>x.includes('daño por el daño infligido (1000 %)')),'contraparte daño 1000%');
 assert.ok(r.left.hp<150,'el atacante recibe daño de retorno');
}
console.log('Alpha 0.6: filtros de entorno, KO y daño según daño infligido OK');
