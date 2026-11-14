import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulate} from './battle-engine.js';
const entity=(id,types=['fuego'],speed=100)=>({id,name:id,definition:{types,hp:500,attack:100,defense:100,specialAttack:100,specialDefense:100,speed,moveIds:['chain','hit','idle'],uniqueMoveId:'idle',globalAbilityId:'none',uniqueAbilityId:'none'}});
const move=(id,def)=>({id,name:id,definition:{type:'fuego',category:'physical',power:55,accuracy:100,criticalChance:0,priority:0,target:'single',rules:[],...def}});
const blank=()=>({entities:{a:entity('a',['fuego'],190),b:entity('b',['agua'],90),c:entity('c',['fuego'],80),d:entity('d',['agua'],70)},moves:{chain:move('chain',{multihit:{min:3,max:3,effects:'chain'}}),hit:move('hit',{}),idle:move('idle',{category:'status',power:0,accuracy:0})},abilities:{none:{id:'none',name:'Ninguna',definition:{rules:[]}}},fields:{},weathers:{},scenarios:{},statuses:{},effects:{}});
const rule={event:'on_hit',target:'self',condition:{type:'always'},chance:100,action:{type:'switch_character',switchMode:'random'}};
const common=(catalog,more={})=>({catalog,leftTeam:['a','c'],rightTeam:['b','d'],turns:1,leftOrders:[{move:'chain'}],rightOrders:[{move:'idle'}],randomSource:()=>0.15,...more});
{
 const c=blank();c.moves.chain.definition.rules=[rule];
 const result=simulate(common(c));
 const firstHit=result.log.findIndex(x=>/(?:recibe|recibió)/.test(x)&&x.includes('de daño'));
 const switched=result.log.findIndex(x=>x.includes('Cambio forzado: c entra'));
 assert.ok(firstHit>=0&&switched>firstHit,'relevo automático se produce después del primer impacto');
 assert.equal(result.leftActiveIndexes[0],1,'el atacante cambia inmediatamente de personaje');
 assert.ok(result.log.filter(x=>x.includes('de daño (golpe')).length===1,'el atacante retirado no ejecuta los golpes restantes');
 assert.ok(switched<result.log.findIndex(x=>x.includes('Ronda 2'))||result.rounds===1,'el relevo no queda para el final de otra ronda');
 const visual=result.visualEvents.find(x=>x.type==='switch'&&x.side==='left');
 assert.equal(visual?.logIndex,switched,'la animación del relevo está vinculada al mensaje exacto');
}
{
 const c=blank();c.moves.chain.definition.accuracy=25;const result=simulate(common(c,{randomSource:()=>0.99}));
 assert.ok(result.log.some(x=>x.includes('b esquivó el ataque de')),'se registra la esquiva');
 assert.ok(!result.log.some(x=>/^Es (?:muy |extremadamente )?(?:fuerte|débil)/.test(x)),'no narrar afinidad cuando el ataque falla');
 assert.ok(!result.log.some(x=>x.includes('es inmune al ataque')),'no narrar inmunidad antes de comprobar precisión');
}
{
 const c=blank();const result=simulate(common(c,{leftOrders:[{move:'hit'}],chart:{fuego:{agua:'eficaz'}}}));
 const announce=result.log.findIndex(x=>x.includes('usó hit'));
 const affinity=result.log.findIndex(x=>x.includes('Es fuerte'));
 const damage=result.log.findIndex(x=>/(?:recibe|recibió)/.test(x)&&x.includes('de daño'));
 assert.ok(announce>=0&&affinity>announce&&damage>affinity,'narrar ataque, afinidad y golpe en orden cuando impacta');
}
const main=readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
const practice=readFileSync(new URL('./public/practice.html',import.meta.url),'utf8');
for(const [name,html] of [['Salas',main],['Entrenamiento',practice]]){
 assert.match(html,/async function udNarrationDwell\(start\)/,name+' usa espera sincronizada');
 assert.match(html,/2500\*speedFactor\(\)\/1\.2/,name+' fija 2.5 segundos a velocidad normal');
 assert.match(html,/await udNarrationDwell\(udHeadlineAt\)/,name+' respeta la lectura por mensaje');
}
console.log('Alpha 0.8: cambios automáticos inmediatos, esquiva sin afinidad y narración 2,5 s OK');
