import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
const rule=(event,condition,action,target='self')=>({event,condition,conditions:[],target,action,chance:100,duration:0,limit:0,operator:'AND',negate:false});
const simpleRule=rule('on_status_applied',{type:'always',value:''},{type:'damage',value:'5'});
const conditionalRule=rule('turn_end',{type:'hp_above',subject:'self',value:'90'},{type:'damage',value:'5'});
const reversibleRule=rule('on_condition',{type:'hp_below',subject:'self',value:'50'},{type:'stat_change',stat:'speed',value:'4'});
const definition={duration:3,typeFilter:{mode:'all',types:[]},rules:[simpleRule,conditionalRule,reversibleRule]};
assert.equal(definition.rules.length,3);
for(const r of definition.rules){assert.equal(r.event,JSON.parse(JSON.stringify(r)).event);}
const noop={id:'noop',name:'Esperar',definition:{type:'agua',category:'status',power:0,accuracy:100,criticalChance:0,priority:0,cooldown:0,rules:[]}};
const infect={id:'infect',name:'Contagiar',definition:{...noop.definition,rules:[rule('manual',{type:'always',value:''},{type:'apply_status',value:'veneno'},'target')]}};
const ent=(id,moves)=>({id,name:id,definition:{types:['agua'],hp:100,attack:50,defense:50,specialAttack:50,specialDefense:50,speed:50,moveIds:moves.slice(0,3),uniqueMoveId:moves[3],globalAbilityId:'global',uniqueAbilityId:'unique'}});
const catalog={entities:{a:ent('a',['infect','noop','noop','noop']),b:ent('b',['noop','noop','noop','noop'])},moves:{infect,noop},abilities:{global:{id:'global',definition:{rules:[]}},unique:{id:'unique',definition:{rules:[]}}},statuses:{veneno:{id:'veneno',name:'Veneno',definition}},effects:{}};
const result=simulate({left:'a',right:'b',catalog,chart:{},turns:1,leftMove:'infect',rightMove:'noop',randomSource:()=>.5});
assert.equal(result.right.hp,90,'Aplicación inmediata y final de turno, ambos eventos funcionan');
console.log('Main: eventos de estado, activación inmediata y fin de turno OK');
