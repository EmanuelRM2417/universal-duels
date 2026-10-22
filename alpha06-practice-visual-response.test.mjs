import assert from 'node:assert/strict';
import {createPractice,advancePractice,publicPractice} from './practice-session.js';
import {readFileSync} from 'node:fs';
const actor=id=>({id,name:id,definition:{types:['fuego'],hp:400,attack:130,defense:100,specialAttack:100,specialDefense:100,speed:id==='a'?180:70,moveIds:['burn','arena','boost'],uniqueMoveId:'idle',globalAbilityId:'none',uniqueAbilityId:'none'}});
const rule=(type,value,target='target')=>({event:'manual',condition:{type:'always'},target,chance:100,duration:3,action:{type,value,...(type==='stat_change'?{stat:'attack'}:{})}});
const move=(id,rules)=>({id,name:id,definition:{type:'fuego',category:'status',power:0,accuracy:0,criticalChance:0,priority:0,rules}});
const catalog={entities:{a:actor('a'),b:actor('b'),c:actor('c')},moves:{burn:move('burn',[rule('apply_status','burn')]),arena:move('arena',[rule('set_scenario','arena','self')]),boost:move('boost',[rule('stat_change',1,'self')]),idle:move('idle',[])},abilities:{none:{id:'none',definition:{rules:[]}}},statuses:{burn:{id:'burn',name:'Quemadura',definition:{duration:3,rules:[]}}},scenarios:{arena:{id:'arena',name:'Arena antigua',definition:{duration:5,fieldEffects:[]}}},weathers:{},fields:{}};
const s=createPractice({catalog,revision:'visual-sync',mode:'singles',difficulty:'easy',leftTeam:['a','c'],rightTeam:['b'],now:1000});
const steps=[
  ['burn',e=>e.type==='unit_state'&&e.unit?.status?.id==='burn',text=>text.includes('recibe Quemadura.')],
  ['arena',e=>e.type==='environment'&&e.kind==='scenario'&&e.id==='arena',text=>text.includes('Ahora estamos en Arena antigua.')],
  ['boost',e=>e.type==='unit_state'&&e.unit?.stages?.attack>=1,text=>text.includes('Ataque de')&&text.includes('subió +1.')]
];
for(let i=0;i<steps.length;i++){
 const [id,eventPredicate,linePredicate]=steps[i];
 const response=advancePractice(s,'turn',{order:{move:id}},{catalog,now:2000+i*1000,random:()=>.99});
 assert.ok(Array.isArray(response.visualEvents)&&response.visualEvents.length,`${id}: must send events to the client`);
 assert.ok(Array.isArray(response.lastTurnLogs)&&response.lastTurnLogs.length,`${id}: must send log lines`);
 const ev=response.visualEvents.find(eventPredicate);
 assert.ok(ev,`${id}: correct event is transmitted`);
 assert.ok(response.lastTurnLogs[ev.logIndex]&&linePredicate(response.lastTurnLogs[ev.logIndex]),`${id}: event is synchronized to its text`);
}
const html=readFileSync(new URL('./public/practice.html',import.meta.url),'utf8');
assert.match(html,/session\.visualEvents\|\|\[\]/);
assert.doesNotMatch(html,/setInterval\(/);
for(const source of ['./public/index.html','./public/practice.html']) {
 const ui=readFileSync(new URL(source,import.meta.url),'utf8');
 assert.match(ui,/\.battle-unit\.enemy\.slot-1,\.battle-unit\.player\.slot-1\{transform:none!important\}/);
}
console.log('Alpha 0.6: Práctica entrega estado, escenario y stats sincronizados, sin reloj, y Doubles sin escalado fraccionario.');
