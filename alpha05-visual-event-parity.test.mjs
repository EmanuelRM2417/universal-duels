import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulate } from './battle-engine.js';
const creature=(id,ability='blank')=>({id,name:id,definition:{types:['fuego'],hp:500,attack:120,defense:90,specialAttack:120,specialDefense:90,speed:100,moveIds:id==='b'?['idle','idle','idle']:['weather','field','scene'],uniqueMoveId:id==='b'?'idle':'buff',globalAbilityId:ability,uniqueAbilityId:'blank'}});
const rule=(type,value,target='self')=>({event:'manual',target,condition:{type:'always'},chance:100,action:{type,value,...(type==='stat_change'?{stat:'attack'}:{})}});
const move=(id,rules)=>({id,name:id,definition:{type:'fuego',category:'status',power:0,accuracy:0,criticalChance:0,priority:0,rules}});
const names={weather:'Lluvia suave',field:'Jardín',scene:'Arena antigua'};
const catalog={entities:{a:creature('a'),b:creature('b'),c:creature('c')},moves:{weather:move('weather',[rule('set_weather','rain')]),field:move('field',[rule('set_field','garden')]),scene:move('scene',[rule('set_scenario','arena')]),buff:move('buff',[rule('stat_change',1)]),idle:move('idle',[])},abilities:{blank:{id:'blank',definition:{rules:[]}}},effects:{},statuses:{},weathers:{rain:{id:'rain',name:names.weather,definition:{duration:5,fieldEffects:[]}}},fields:{garden:{id:'garden',name:names.field,definition:{duration:5,visualColor:'#228833',fieldEffects:[]}}},scenarios:{arena:{id:'arena',name:names.scene,definition:{duration:5,fieldEffects:[]}}}};
const sim=simulate({catalog,left:'a',right:'b',turns:3,leftOrders:[{move:'weather'},{move:'field'},{move:'scene'}],rightMove:'idle',randomSource:()=>.88});
for(const [kind,id,label] of [['weather','rain',`Ahora hay ${names.weather}.`],['field','garden',`${names.field} se activó.`],['scenario','arena',`Ahora estamos en ${names.scene}.`]]){
 const i=sim.log.indexOf(label);assert.ok(i>=0,`${kind}: narración al activar`);
 assert.ok(sim.visualEvents.some(e=>e.type==='environment'&&e.kind===kind&&e.id===id&&e.logIndex===i),`${kind}: evento visual durante la línea de activación`);
}
const buff=simulate({catalog,left:'a',right:'b',turns:1,leftMove:'buff',rightMove:'idle',randomSource:()=>.88});
const statLine=buff.log.findIndex(x=>/a: attack 1\./.test(x));
assert.ok(statLine>=0 && buff.visualEvents.some(e=>e.type==='unit_state'&&e.logIndex===statLine&&e.unit?.stages?.attack===1),'flecha de stat y sprite desde el evento real');
// Estado y sustitución deben llegar con la misma línea que los anuncia.
const affected=structuredClone(catalog);
affected.moves.buff=move('buff',[rule('apply_status','burn','target')]);
affected.statuses.burn={id:'burn',name:'Quemadura',definition:{duration:3,typeFilter:{mode:'all',types:[]},rules:[]}};
const burn=simulate({catalog:affected,left:'a',right:'b',turns:1,leftMove:'buff',rightMove:'idle',randomSource:()=>.88});
const burnLine=burn.log.findIndex(x=>x.includes('recibe Quemadura.'));
assert.ok(burnLine>=0 && burn.visualEvents.some(e=>e.type==='unit_state'&&e.logIndex===burnLine&&e.unit?.status?.id==='burn'),'estado visual al aplicarse');
const switched=simulate({catalog,left:'a',right:'b',leftTeam:['a','c'],rightTeam:['b'],turns:1,leftOrders:[{switch:1}],rightMove:'idle',randomSource:()=>.88});
const switchedLine=switched.log.findIndex(x=>x.includes('c entra al campo.'));
assert.ok(switchedLine>=0 && switched.visualEvents.some(e=>e.type==='switch'&&e.logIndex===switchedLine&&e.unit?.id==='c'),'sprite sustituto al entrar');
const files={online:readFileSync(new URL('./public/index.html',import.meta.url),'utf8'),practice:readFileSync(new URL('./public/practice.html',import.meta.url),'utf8')};
for(const [mode,html] of Object.entries(files)){
 assert.match(html,/function applyVisualEvent\(/,`${mode} recibe eventos por línea`);
 assert.match(html,/\.battle-stat-burst/,`${mode} muestra flechas de stats`);
 assert.match(html,/stat-up/,`${mode} emite sonido de subida`);
 assert.match(html,/stat-down/,`${mode} emite sonido de bajada`);
 assert.match(html,/battle-hp-fill\" style=\"width:\$\{pct\}%;background:hsl\(/,`${mode} barra de vida dinámica`);
 assert.ok(!html.includes("map(t=>typeMark(t)).join(' / ')"),`${mode} sin barras entre medallones`);
 assert.match(html,/portal-in/,`${mode} sonido de portal enlazado`);
}
console.log('Alpha 0.5: eventos exactos de clima/campo/escenario, stat y paridad online/Entrenamiento OK');
