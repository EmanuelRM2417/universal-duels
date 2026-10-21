import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulate} from './battle-engine.js';
const entity=(id,{ability='blank',hp=100,speed=80,moves=['wait','wait','wait'],unique='wait'}={})=>({id,name:id,definition:{types:['fuego'],hp,attack:120,defense:100,specialAttack:100,specialDefense:100,speed,moveIds:moves,uniqueMoveId:unique,globalAbilityId:ability,uniqueAbilityId:'blank'}});
const move=(id,{power=0,rules=[],priority=0}={})=>({id,name:id,definition:{type:'fuego',category:power?'physical':'status',power,accuracy:power?100:0,criticalChance:0,priority,rules}});
const rule=(type,{value='',target='target',duration=2,other={}}={})=>({event:'manual',target,condition:{type:'always'},chance:100,duration,action:{type,value,...other}});
const blank={id:'blank',definition:{rules:[]}};
const base=()=>({entities:{a:entity('a',{speed:180,moves:['strike','silence','lock']}),b:entity('b',{speed:30,ability:'passive',moves:['wait','wait','wait']}),c:entity('c')},moves:{strike:move('strike',{power:500}),wait:move('wait'),silence:move('silence',{rules:[rule('suppress_abilities')]}),lock:move('lock',{rules:[rule('restrict_moves')]}),guard:move('guard',{rules:[rule('survive',{target:'self',duration:3,other:{fixedHp:1,limit:1}})]})},abilities:{blank,passive:{id:'passive',definition:{rules:[{event:'on_condition',condition:{type:'always'},target:'self',action:{type:'stat_change',stat:'defense',value:2}}]}},survival:{id:'survival',definition:{survive:{chance:100,fixedHp:1,limit:1,priority:3},rules:[]}}},effects:{},statuses:{},fields:{},weathers:{},scenarios:{}});
const run=(catalog,extra={})=>simulate({catalog,left:'a',right:'b',turns:1,leftMove:'wait',rightMove:'wait',randomSource:()=>0.75,...extra});
// Baseline passive, immediate suppression while active, resumption on expiry.
{
 const cat=base();const initial=run(cat,{turns:0});assert.equal(initial.right.passiveStages.defense,2);
 const sup=run(cat,{leftMove:'silence'});
 assert.equal(Number(sup.right.passiveStages.defense||0),0,'suppression removes passive immediately');
 assert.ok(sup.right.effects.some(e=>e.id==='suppressed'),'suppression remains active beyond first turn');
 const expired=run(cat,{turns:2,leftOrders:[{move:'silence'},{move:'wait'}]});
 assert.equal(expired.right.passiveStages.defense,2,'passive resumes after suppression expires');
 assert.equal(expired.log.some(x=>x.includes('recupera sus habilidades.')),true);
}
// Restriction blocks attacks but never switching, expires with timer.
{
 const cat=base();const res=run(cat,{turns:1,leftMove:'lock'});
 assert.ok(res.log.some(x=>x.includes('movimientos restringidos.')),'restriction blocks move');
 assert.ok(res.right.effects.some(e=>e.id==='restrict_moves'));
 const after=run(cat,{turns:2,leftOrders:[{move:'lock'},{move:'wait'}],rightOrders:[{move:'wait'},{switch:1}],rightTeam:['b','c']});
 assert.equal(after.rightActive[0].id,'c','switch permitted despite move restriction');
 const expiry=run(cat,{turns:2,leftOrders:[{move:'lock'},{move:'wait'}]});
 assert.ok(expiry.log.some(x=>x.includes('puede volver a usar movimientos.')),'restriction expiry announced');
}
// One-use survival and per-entry reset.
{
 const cat=base();cat.entities.b=entity('b',{ability:'survival',hp:70,speed:20});
 let single=run(cat,{leftMove:'strike'});assert.equal(single.right.hp,1);assert.equal(single.log.filter(x=>x.includes('activa Sobrevivir')).length,1);
 cat.moves.strike.definition.multihit={min:2,max:2,effects:'each'};
 let multi=run(cat,{leftMove:'strike'});assert.equal(multi.right.hp,0,'one-use protection does not activate twice in chain');
 // Re-entry resets only protection configured per entry, not limited per battle.
 delete cat.moves.strike.definition.multihit;
 cat.abilities.survival.definition.survive.limitScope='entry';
 const steps={turns:3,leftOrders:[{move:'strike'},{move:'wait'},{move:'strike'}],rightOrders:[{move:'wait'},{switch:1},{switch:0}],rightTeam:['b','c']};
 const perEntry=run(cat,steps);assert.equal(perEntry.rightTeam[0].hp,1,'entry-scoped survival usable again after re-entry');
 assert.equal(perEntry.log.filter(x=>x.includes('activa Sobrevivir')).length,2);
 cat.abilities.survival.definition.survive.limitScope='battle';
 const perBattle=run(cat,steps);assert.equal(perBattle.rightTeam[0].hp,0,'battle-scoped survival not refreshed by re-entry');
}
// Suppressed survival is unavailable; explicit effect protection remains effective.
{
 const cat=base();cat.entities.b=entity('b',{ability:'survival',hp:70,speed:20});
 const sup=run(cat,{turns:2,leftOrders:[{move:'silence'},{move:'strike'}],rightOrders:[{move:'wait'},{move:'wait'}]});
 assert.equal(sup.right.hp,0,'suppression disables ability-based survival');
 cat.moves.silence.definition.rules[0].duration=4;
 cat.entities.b.definition.moveIds=['guard','wait','wait'];cat.entities.b.definition.uniqueMoveId='guard';
 // guard on earlier round: survives despite ability suppression.
 const eff=run(cat,{turns:3,leftOrders:[{move:'silence'},{move:'wait'},{move:'strike'}],rightOrders:[{move:'guard'},{move:'wait'},{move:'wait'}]});
 assert.equal(eff.right.hp,1,'protection from a movement remains while abilities are suppressed');
}

// Both global and exclusive passives are suppressed, and no private ability data is needed to render the rival's arrow.
{
 const cat=base();cat.entities.b.definition.uniqueAbilityId='secondPassive';
 cat.abilities.secondPassive={id:'secondPassive',definition:{rules:[{event:'on_condition',condition:{type:'always'},target:'self',action:{type:'stat_change',stat:'speed',value:3}}]}};
 const initial=run(cat,{turns:0});assert.equal(initial.right.passiveStages.defense,2);assert.equal(initial.right.passiveStages.speed,3);
 const sup=run(cat,{leftMove:'silence'});assert.equal(sup.right.passiveStages.defense||0,0);assert.equal(sup.right.passiveStages.speed||0,0);
 const ended=run(cat,{turns:2,leftOrders:[{move:'silence'},{move:'wait'}]});assert.equal(ended.right.passiveStages.defense,2);assert.equal(ended.right.passiveStages.speed,3);
}
// Damage-source filtering, priority and 0% activation are enforced for lethal protections.
{
 const cat=base();cat.entities.b=entity('b',{ability:'survival',hp:70,speed:20});
 cat.abilities.survival.definition.survive.sources=['environment'];
 assert.equal(run(cat,{leftMove:'strike'}).right.hp,0,'wrong damage source cannot activate Survival');
 cat.abilities.survival.definition.survive.sources=['move'];
 cat.abilities.survival.definition.survive.chance=0;
 assert.equal(run(cat,{leftMove:'strike'}).right.hp,0,'0% chance cannot activate Survival');
 cat.abilities.survival.definition.survive.chance=100;
 cat.entities.b.definition.uniqueAbilityId='higherSurvival';
 cat.abilities.higherSurvival={id:'higherSurvival',definition:{survive:{chance:100,fixedHp:11,limit:1,priority:5},rules:[]}};
 assert.equal(run(cat,{leftMove:'strike'}).right.hp,11,'highest-priority protection activates first');
}
// Enemy stat changes emit a unit_state event at the exact narration index.
{
 const cat=base();cat.entities.a.definition.moveIds[0]='debuff';cat.moves.debuff=move('debuff',{rules:[rule('stat_change',{value:-2,target:'target',other:{stat:'speed'}})]});
 const r=run(cat,{leftMove:'debuff'});
 assert.ok(r.visualEvents.some(e=>e.type==='unit_state'&&e.side==='right'&&e.slot===0&&e.unit?.stages?.speed===-2),'enemy stat changes are emitted with correct side and slot');
}
const html=readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
assert.match(html,/\.battle-unit\.enemy \.battle-stat-layer\{top:45%!important;z-index:45!important\}/,'Lab: enemy stat arrow is visible');
assert.match(html,/stat-up/);assert.match(html,/stat-down/);
assert.doesNotMatch(html,/<span class="streak-power">\$\{escapeHtml\(streakPowerText/);
assert.match(html,/d\.multihit&&d\.streak\?\.enabled\?\(d\.power/);
assert.match(html,/surviveScope/);assert.match(html,/surviveFixedHp/);
console.log('Alpha 0.6: Sobrevivir, Anular habilidades, Restringir movimientos, flechas del rival, nombres de movimientos en Lab OK');
