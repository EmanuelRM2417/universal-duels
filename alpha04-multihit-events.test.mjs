import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';

const rule=(event,target,stat)=>({event,target,condition:{type:'always'},action:{type:'stat_change',stat,value:1},chance:100});
const entity=(id,globalAbilityId)=>({id,name:id,definition:{types:['fuego'],hp:500,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:['chain','wait','wait'],uniqueMoveId:'wait',globalAbilityId,uniqueAbilityId:'blank'}});
const hit={id:'chain',name:'Tres impactos',definition:{type:'fuego',category:'physical',power:5,accuracy:100,criticalChance:0,multihit:{min:3,max:3,effects:'chain'},rules:[rule('on_hit','self','attack')]}};
const wait={id:'wait',name:'Esperar',definition:{type:'fuego',category:'status',power:0,accuracy:0,criticalChance:0,rules:[]}};
const catalog={entities:{attacker:entity('attacker','onhit'),target:entity('target','ondamage')},moves:{chain:hit,wait},abilities:{onhit:{id:'onhit',definition:{rules:[rule('on_hit','self','speed')]}},ondamage:{id:'ondamage',definition:{rules:[rule('on_damage_taken','self','defense')]}},blank:{id:'blank',definition:{rules:[]}}},effects:{}};
const options={catalog,left:'attacker',right:'target',turns:1,leftMove:'chain',rightMove:'wait',randomSource:()=>.9};
const r=simulate(options);
assert.equal(r.log.filter(x=>/recibió \d+ de daño \(golpe [123]\)\./.test(x)).length,3,'cada impacto indica su índice en el mensaje de daño');
assert.equal(r.log.filter(x=>/^Golpe \d+\//.test(x)).length,0,'no se muestran líneas independientes Golpe 1/3');
assert.equal(r.left.stages.speed,3,'la habilidad Al acertar se activa en cada impacto');
assert.equal(r.right.stages.defense,3,'la habilidad Al recibir daño se activa en cada impacto');
assert.equal(r.left.stages.attack,1,'el efecto chain del movimiento se aplica una vez al finalizar la cadena');
assert.deepEqual(simulate({...options,randomTape:r.randomTape}),r,'el resultado debe poder reproducirse');
// Si una habilidad resucita entre impactos, el siguiente golpe puede dañarla otra vez.
const revival={...catalog,entities:{...catalog.entities,target:{...catalog.entities.target,definition:{...catalog.entities.target.definition,hp:80}}},abilities:{...catalog.abilities,ondamage:{id:'ondamage',definition:{rules:[{event:'on_death',target:'self',condition:{type:'always'},action:{type:'resurrect',fixedHp:21},limit:1}]}}},moves:{...catalog.moves,chain:{...hit,definition:{...hit.definition,power:250}}}};
const revived=simulate({...options,catalog:revival});
assert.equal(revived.log.filter(x=>x.includes('resucita')).length,1,'Al morir se resuelve antes de completar la cadena');
assert.equal(revived.right.hp,0,'la resurrección no invalida los impactos restantes');
console.log('Alpha 0.4: multigolpe chain aplica eventos de habilidades en cada impacto, KO/reanimación y RNG reproducible');
