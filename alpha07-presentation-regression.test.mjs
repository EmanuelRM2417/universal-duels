import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulate} from './battle-engine.js';
const actor=(id,ability='empty',moves=['idle'])=>({id,name:id,definition:{types:['agua'],hp:250,attack:65,defense:80,specialAttack:65,specialDefense:80,speed:100,moveIds:Array.from({length:3},(_,i)=>moves[i]||'idle'),uniqueMoveId:'idle',globalAbilityId:ability,uniqueAbilityId:'empty'}});
const move=(id,rules=[],power=0)=>({id,name:id,definition:{category:power?'physical':'status',type:'agua',power,accuracy:100,criticalChance:0,rules}});
const rule=(event,type,value,target='self',extra={})=>({event,target,chance:100,condition:{type:'always',value:''},action:{type,value,...extra},duration:0,limit:0});
const catalog=()=>({entities:{a:actor('a','glow',['campo','chosen','strike']),b:actor('b','empty',['campo','idle']),c:actor('c','empty',['idle']),d:actor('d','empty',['idle'])},moves:{campo:move('campo',[rule('on_attack','set_field','bosque')]),idle:move('idle'),chosen:move('chosen',[rule('on_hit','switch_character',null,'self',{switchMode:'manual'})]),strike:move('strike',[],38)},abilities:{empty:{id:'empty',name:'Vacía',definition:{rules:[]}},glow:{id:'glow',name:'Aura de prueba',definition:{rules:[rule('on_enter','stat_change',2,'self',{stat:'speed'})]}}},statuses:{},weathers:{},fields:{bosque:{name:'Bosque',definition:{visualColor:'#31784c',fieldEffects:[{timing:'continuous',type:'stat_change',stat:'evasion',value:2,filter:'all'}]}}},scenarios:{}});
const run=(c,opt={})=>simulate({catalog:c,leftTeam:['a','c'],rightTeam:['b','d'],turns:1,leftOrders:[{move:'campo'}],rightOrders:[{move:'campo'}],randomSource:()=>.5,includeCheckpoint:true,...opt});
{
 const c=catalog();const r=run(c);
 assert.ok(r.log.some(x=>x==='Bosque se activó.'),'field activation narrated');
 assert.ok(r.log.some(x=>x==='Bosque ya está activo.'),'duplicate field reported with friendly text');
 const sources=r.leftActive[0].statSources;
 assert.ok(sources.some(x=>x.stat==='speed'&&x.sourceName==='Aura de prueba'&&x.sourceActor==='a'),'direct ability stages trace back to their source');
 assert.ok(sources.some(x=>x.stat==='evasion'&&x.sourceName==='Bosque'),'environment continuous evasion tracks its origin');
 assert.ok(r.log.some(x=>x.includes('por Aura de prueba de a')),'ability effect narration carries original attribution');
}
{
 const c=catalog();c.moves.campo.definition.rules=[rule('on_attack','set_weather','lluvia')];c.weathers.lluvia={name:'Lluvia',definition:{fieldEffects:[]}};
 const r=run(c);assert.ok(r.log.some(x=>x==='Ya hay Lluvia.'),'duplicate weather wording');
}
{
 const c=catalog();c.moves.campo.definition.rules=[rule('on_attack','set_scenario','patio')];c.scenarios.patio={name:'Patio',definition:{fieldEffects:[]}};
 const r=run(c);assert.ok(r.log.some(x=>x==='Ya estamos en Patio.'),'duplicate scenario wording');
}
{
 const c=catalog();c.moves.chosen.definition.rules=[rule('on_attack','switch_character',null,'self',{switchMode:'manual'})];
 const r=run(c,{leftOrders:[{move:'chosen',switchChoice:{side:'left',slot:0,teamIndex:1}}],rightOrders:[{move:'idle'}]});
 assert.equal(r.leftActiveIndexes[0],1,'preselected manual replacement occurs at on_attack');
 assert.deepEqual(r.needsReplacement.left,[],'no second replacement prompt');
}
{
 const c=catalog();const r=run(c,{leftOrders:[{move:'strike'}],rightOrders:[{move:'idle'}]});
 const damageLine=r.log.findIndex(x=>x.includes(' recibe ')&&x.includes(' de daño.'));
 assert.ok(damageLine>=0,'one-hit damage line exists');
 assert.ok(r.visualEvents.some(e=>e.logIndex===damageLine&&e.unit),'damage beat has one authoritative HP snapshot');
}
{
 const c=catalog();c.moves.chosen.definition.power=30;c.moves.chosen.definition.category='physical';
 const r=run(c,{leftOrders:[{move:'chosen',switchChoice:{side:'left',slot:0,teamIndex:1}}],rightOrders:[{move:'idle'}]});
 assert.equal(r.leftActiveIndexes[0],1,'preselected switch happens on hit in the same move');
 assert.deepEqual(r.needsReplacement.left,[],'on-hit manual switch does not require a second selection');
}
{
 const c=catalog();c.statuses.focus={id:'focus',name:'Concentración',definition:{rules:[rule('on_status','stat_change',3,'self',{stat:'accuracy'})]}};
 c.abilities.glow.definition.rules.push(rule('on_enter','apply_status','focus'));
 const r=run(c);assert.ok(r.leftActive[0].statSources.some(x=>x.stat==='accuracy'&&x.sourceName==='Concentración'), 'status-based accuracy stage names original status');
}
{
 const c=catalog();c.fields.bosque.definition.fieldEffects.push({timing:'continuous',type:'critical_change',value:4,filter:'all'});
 const r=run(c);assert.ok(r.leftActive[0].statSources.some(x=>x.stat==='criticalChance'&&x.sourceName==='Bosque'&&x.value===4), 'environment critical bonus preserves provenance');
}
for(const fn of ['public/index.html','public/practice.html']){
 const s=readFileSync(new URL(fn,import.meta.url),'utf8');
 assert.match(s,/class="ud-combat-info"/,'environment HUD is outside 4:3 canvas');
 assert.match(s,/class="battle-command-panel"/,'narrator has a separate action panel');
 assert.match(s,/\$\('battleCommandPanel'\)\.innerHTML=narr\|\|controls/,'narration replaces actions while playing');
 assert.match(s,/\$\('battleCommandPanel'\)\.append\(msg\)/,'narrator does not cover arena');
 assert.match(s,/ud-target-empty/,'KO preserves unselectable target position');
 assert.match(s,/displayedBattleLog\.push\(line\);if\(battleModalKind==='log'/,'battle log refreshes during playback');
 assert.match(s,/\.battle-unit \.battle-hp-fill\{display:block!important/,'HP bar fill receives explicit height');
}
console.log('Alpha 0.7: source origin, scenario/weather/field, chosen switch timing, HP events and both battle screens OK');
