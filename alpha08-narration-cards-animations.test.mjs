import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {simulate} from './battle-engine.js';
const files=['index','practice'];
const base=new URL('./public/',import.meta.url);
const code=readFileSync(new URL('battle-visuals.js',base),'utf8');
const css=readFileSync(new URL('battle-visuals.css',base),'utf8');
const stub={};vm.runInNewContext(code,{window:stub,document:{},setTimeout,Promise});
const h={spriteUrl:id=>'/sprites/'+id+'.png',typeMark:t=>`<i>${t}</i>`,esc:s=>String(s)};
const team=Array.from({length:8},(_,i)=>({id:'id'+i,name:'Personaje '+(i+1),hp:i===2?0:40+i*10,maxHp:100,types:['agua']}));
const markup=stub.UDBattleVisuals.roster(team,[0,1],[4],0,h);
assert.equal((markup.match(/class="ud-team-pick"/g)||[]).length,8,'8 personajes en orden');
for(let i=1;i<8;i++)assert.ok(markup.indexOf('Personaje '+i)<markup.indexOf('Personaje '+(i+1)),'se respeta el orden del equipo');
assert.equal((markup.match(/ disabled/g)||[]).length,4,'en campo, derrotado y ya elegido sin seleccionar (incluye atributos adicionales)');
assert.match(markup,/En campo/);assert.match(markup,/Derrotado/);assert.match(markup,/Ya elegido/);
assert.match(markup,/40 \/ 100 PS/);assert.match(markup,/ud-team-hp-fill/);
assert.match(css,/repeat\(4,minmax\(0,1fr\)\)/,'4 columnas');
assert.match(css,/ud-choosing-action/,'resaltado de acción independiente');
// Las rutinas de animación se prueban con nodos simulados para validar destino, secuencia y duración.
const events=[];
const stage={width:900,height:700};
function node(x,y){return{getBoundingClientRect(){return{left:x,right:x+80,top:y,bottom:y+80,width:80,height:80};},closest(){return{getBoundingClientRect(){return stage;}}},animate(frames,opt){events.push({frames,opt});return{finished:Promise.resolve(),cancel(){}}}};}
const nodes={'.battle-unit[data-side="left"][data-slot="0"] .battle-sprite-window':node(10,300),'.battle-unit[data-side="right"][data-slot="0"] .battle-sprite-window':node(610,100),'.battle-unit[data-side="right"][data-slot="1"] .battle-sprite-window':node(740,110)};
const fake={};vm.runInNewContext(code,{window:fake,document:{querySelector:s=>nodes[s]||null},setTimeout,Promise});
await fake.UDBattleVisuals.travel({side:'left',slot:0},[{side:'right',slot:0},{side:'right',slot:1}],{side:'right',slot:0},.02);
assert.ok(events.length>=2,'actor avanza y defensor retrocede');
assert.match(events[0].frames[1].translate,/px/,'avance calculado por posición real');
assert.equal(events[0].opt.duration,40,'avance de ~2 segundos a velocidad normal (test escalado)');
events.length=0;
await fake.UDBattleVisuals.circles({side:'left',slot:0},.01);
assert.ok(events[0].frames.length>=16,'se trazan dos círculos completos');
assert.equal(events[0].opt.duration,19);
for(const f of files){const html=readFileSync(new URL(f+'.html',base),'utf8');
 assert.match(html,/\/battle-visuals\.css/);assert.match(html,/\/battle-visuals\.js/);
 assert.match(html,/udRosterCards/);assert.match(html,/ud-team-pick:not\(:disabled\)/);
 assert.match(html,/ud-choosing-action/);assert.match(html,/udAnimateImpact/);assert.match(html,/window\.UDBattleVisuals\.travel/);
 assert.doesNotMatch(html,/Elegí acción de \$\{esc\(u\.name\)\}/);
 assert.match(html,/↑ daño infligido: \+30 %/);
 assert.doesNotMatch(html,/Estos indicadores muestran únicamente relaciones de tipo/);
}
// Narración de afinidades: se muestra tras usar movimiento, no altera fórmulas del daño.
const entity=(id,types)=>({id,name:id,definition:{types,hp:500,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:['hit','idle','idle'],uniqueMoveId:'idle',globalAbilityId:'none',uniqueAbilityId:'none'}});
const c={entities:{a:entity('a',['fuego']),b:entity('b',['planta']),c:entity('c',['planta','hielo']),d:entity('d',['agua'])},moves:{hit:{id:'hit',name:'Llama',definition:{type:'fuego',category:'physical',power:20,accuracy:100,criticalChance:0,priority:0,rules:[]}},idle:{id:'idle',name:'Esperar',definition:{type:'fuego',category:'status',power:0,accuracy:0,criticalChance:0,rules:[]}}},abilities:{none:{id:'none',name:'Ninguna',definition:{rules:[]}}},fields:{},weathers:{},scenarios:{},statuses:{}};
let chart={fuego:{planta:'eficaz',hielo:'eficaz',agua:'ineficaz'}};
for(const [id,expected] of [['b','Es fuerte.'],['c','Es muy fuerte.'],['d','Es débil.']]){
 const result=simulate({catalog:c,chart,leftTeam:['a'],rightTeam:[id],turns:1,leftOrders:[{move:'hit'}],rightOrders:[{move:'idle'}],randomSource:()=>.5});
 const log=result.log;const use=log.findIndex(x=>x.includes(' usó Llama.'));
 assert.ok(use>=0,id+' anuncia movimiento');
 assert.equal(log[use+1],expected,id+' anuncia afinidad justo después');
 assert.ok(log.some(x=>/recibe \d+ de daño/.test(x)),'el ataque sigue haciendo daño');
}
const neutral=simulate({catalog:c,chart:{},leftTeam:['a'],rightTeam:['d'],turns:1,leftOrders:[{move:'hit'}],rightOrders:[{move:'idle'}],randomSource:()=>.5});
assert.ok(!neutral.log.some(s=>/Es (?:muy |extremadamente )?(?:fuerte|débil)/.test(s)),'neutral no anuncia');
const im=simulate({catalog:c,chart:{fuego:{agua:'inmune'}},leftTeam:['a'],rightTeam:['d'],turns:1,leftOrders:[{move:'hit'}],rightOrders:[{move:'idle'}],randomSource:()=>.5});
assert.equal(im.log.filter(s=>s.includes('es inmune al ataque.')).length,1,'mensaje de inmunidad único');
console.log('Alpha 0.8: selección 2×4, iconos/PS, desplazamiento, dos círculos, narración de afinidades y tipo inmune OK');
