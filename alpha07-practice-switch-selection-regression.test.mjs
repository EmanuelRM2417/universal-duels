import assert from 'node:assert/strict';
import {createPractice,advancePractice} from './practice-session.js';
const actor=(id,speed)=>({id,name:id,definition:{types:['agua'],hp:350,attack:85,defense:100,specialAttack:85,specialDefense:100,speed,moveIds:['chosen','later','idle'],uniqueMoveId:'random',globalAbilityId:'empty',uniqueAbilityId:'empty'}});
const rule=(event,mode)=>({event,target:'self',chance:100,condition:{type:'always',value:''},action:{type:'switch_character',switchMode:mode},duration:0,limit:0});
const mv=(id,category='status',power=0,rules=[])=>({id,name:id,definition:{type:'agua',category,power,accuracy:100,criticalChance:0,target:'self',rules}});
const catalog={entities:{a:actor('a',200),b:actor('b',20),c:actor('c',90),d:actor('d',50),e:actor('e',40),f:actor('f',35)},moves:{idle:mv('idle'),chosen:mv('chosen','status',0,[rule('on_attack','manual')]),later:mv('later','physical',35,[rule('on_hit','manual')]),random:mv('random','status',0,[rule('on_attack','random')])},abilities:{empty:{id:'empty',definition:{rules:[]}}},statuses:{},fields:{},weathers:{},scenarios:{}};
function start(mode='singles'){return createPractice({catalog,revision:'regression',mode,difficulty:'easy',leftTeam:['a','c','e'],rightTeam:['b','d','f'],now:1000});}
function advance(session,actions){return advancePractice(session,'turn',{order:session.mode==='singles'?actions[0]:{actions}},{catalog,now:2000,random:()=>0.2});}
for(const [id,timing] of [['chosen','on_attack'],['later','on_hit']]){
 const p=start(),r=advance(p,[{slot:0,move:id,switchChoice:{side:'left',slot:0,teamIndex:1}}]);
 assert.equal(r.state.leftActiveIndexes[0],1,`Practice ${timing} must use preselected switch immediately`);
 assert.deepEqual(r.state.needsReplacement.left,[],`Practice ${timing} must not ask for a second selection`);
 assert.ok(p.leftOrders[0].switchChoice,`Practice ${timing} must preserve switchChoice in validated order`);
 assert.ok(r.state.log.some(x=>x.includes('Cambio por efecto')),`Practice ${timing} must narrate the switch`);
}
{
 const p=start('doubles');
 const r=advance(p,[{slot:0,move:'chosen',target:{side:'right',slot:0},switchChoice:{side:'left',slot:0,teamIndex:2}},{slot:1,move:'idle',target:{side:'right',slot:1}}]);
 assert.deepEqual(r.state.leftActiveIndexes,[2,1],'Doubles replaces only selected slot');
 assert.deepEqual(r.state.needsReplacement.left,[]);
}
{
 const p=start();const r=advance(p,[{slot:0,move:'random'}]);
 assert.notEqual(r.state.leftActiveIndexes[0],0,'random switch fires on configured event');
 assert.deepEqual(r.state.needsReplacement.left,[]);
}
{
 const p=start();assert.throws(()=>advance(p,[{slot:0,move:'chosen',switchChoice:{side:'right',slot:0,teamIndex:1}}]),/Relevo del efecto inválido/);
 const p2=start();assert.throws(()=>advance(p2,[{slot:0,move:'chosen',switchChoice:{side:'left',slot:0,teamIndex:0}}]),/Relevo del efecto inválido/);
 const p3=start();assert.throws(()=>advance(p3,[{slot:0,move:'idle',switchChoice:{side:'left',slot:0,teamIndex:2}}]),/Relevo del efecto inválido/);
}
console.log('Alpha 0.7: Practice self-switch manual on_attack/on_hit, random, Doubles, order validation and no double picker OK');
