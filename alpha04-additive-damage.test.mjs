import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';

const entity=id=>({id,name:id,definition:{types:['fuego'],hp:500,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:['strike','wait','wait'],uniqueMoveId:'wait',globalAbilityId:'blank',uniqueAbilityId:'blank'}});
const multiRule=value=>({event:'manual',target:'self',condition:{type:'always'},chance:100,action:{type:'damage_multiplier',value}});
const catalog={entities:{a:entity('a'),b:entity('b')},moves:{strike:{id:'strike',name:'Ataque',definition:{type:'fuego',category:'physical',power:80,accuracy:0,criticalChance:0,rules:[]}},wait:{id:'wait',name:'Esperar',definition:{type:'fuego',category:'status',power:0,accuracy:0,rules:[]}}},abilities:{blank:{id:'blank',definition:{rules:[]}}}};
const run=(modifiers=[],criticalChance=0)=>{
 const local=structuredClone(catalog);
 local.moves.strike.definition.rules=modifiers.map(multiRule);
 local.moves.strike.definition.criticalChance=criticalChance;
 const r=simulate({catalog:local,left:'a',right:'b',turns:1,leftMove:'strike',rightMove:'wait',randomSource:()=>0});
 return {damage:500-r.right.hp,log:r.log};
};
const neutral=run();
const buff=run([150]);
const double=run([150,150]);
const cancel=run([150,50]);
const crit=run([],100);
const critPlus=run([150],100);
// Extraer el daño base de la fórmula: sin otros modificadores solo existe STAB +20 %.
const damageBase=neutral.damage/1.2;
const near=(actual,want,msg)=>assert.ok(Math.abs(actual-want)<=1.5,`${msg}: ${actual} vs ${want}`);
near(buff.damage,damageBase*1.7,'+50% se SUMA al +20% STAB');
near(double.damage,damageBase*2.2,'dos bonificaciones +50% suman +100%, no ×2.25');
near(cancel.damage,neutral.damage,'bonificación y penalización iguales se anulan');
near(crit.damage,damageBase*1.7,'crítico +50% se suma a STAB');
near(critPlus.damage,damageBase*2.2,'crítico, STAB y bonificador se suman');
console.log('Alpha 0.4: bonificadores de daño finales aditivos (STAB, críticos y reglas)');
