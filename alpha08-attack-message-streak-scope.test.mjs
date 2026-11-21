import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';

const rule=(event,action,condition={type:'always',value:''},target='target')=>({event,condition,conditions:[],target,action,chance:100,duration:0,limit:0,operator:'AND',negate:false});
const secondary=(message,own=[])=>rule('on_attack',{type:'attack',attack:{type:'fuego',category:'special',power:25,accuracy:100,criticalChance:0,chance:100,target:'target',animate:true,narratorMessage:message,rules:own}});
const statusRule=rule('on_hit',{type:'apply_status',value:'stun'});statusRule.duration=3;
const makeMove=(id,power=30,rules=[],other={})=>({id,name:id,definition:{kind:'global',type:'fuego',category:'physical',power,accuracy:100,criticalChance:0,priority:0,cooldown:0,targeting:'single',rules,...other}});
const noop={id:'noop',name:'No hacer nada',definition:{kind:'global',type:'agua',category:'status',power:0,accuracy:0,criticalChance:0,priority:0,cooldown:0,targeting:'single',rules:[]}};
const player=(id,moves)=>({id,name:id,definition:{types:['fuego'],hp:500,attack:90,defense:90,specialAttack:90,specialDefense:90,speed:100,moveIds:moves,uniqueMoveId:'noop',globalAbilityId:'ab',uniqueAbilityId:'ab'}});
const ability={id:'ab',name:'Sin habilidad',definition:{kind:'global',rules:[]}};
function play(move,rounds=1,orders=null,random=()=>.5,otherMoves=[]){
 const moves={noop,[move.id]:move,...Object.fromEntries(otherMoves.map(m=>[m.id,m]))};
 const catalog={entities:{a:player('a',[move.id,otherMoves[0]?.id||'noop','noop']),b:player('b',['noop','noop','noop'])},moves,abilities:{ab:ability},statuses:{stun:{id:'stun',name:'Aturdimiento',definition:{duration:3,typeFilter:{mode:'all',types:[]},rules:[]}}},effects:{}};
 return simulate({left:'a',right:'b',catalog,chart:{},turns:rounds,leftMove:move.id,rightMove:'noop',leftOrders:orders||[],randomSource:random});
}
const stun=rule('on_hit',{type:'apply_status',value:'stun'});stun.duration=3;
const explode=secondary('Bomba volcánica explotó contra [OBJETIVO].',[stun]);
const after=secondary('La ceniza cayó.');
const mainMove=makeMove('Bomba volcánica',20,[explode,after,rule('on_hit',{type:'stat_change',stat:'speed',value:-1})]);
const battle=play(mainMove);
const iUse=battle.log.findIndex(x=>x.includes('usó Bomba volcánica'));
const iBase=battle.log.findIndex(x=>x.includes('recibe')&&x.includes('daño'));
const iExplosion=battle.log.findIndex(x=>x.includes('Bomba volcánica explotó'));
const iSecondaryDamage=battle.log.findIndex((x,i)=>i>iExplosion&&x.includes('recibe')&&x.includes('daño'));
const iStun=battle.log.findIndex(x=>x.includes('recibe Aturdimiento'));
const iAsh=battle.log.findIndex(x=>x.includes('La ceniza cayó'));
assert.ok(iUse>=0&&iBase>iUse&&iExplosion>iBase&&iSecondaryDamage>iExplosion&&iStun>iSecondaryDamage&&iAsh>iStun,
  'anuncio principal -> daño principal -> explosión -> daño secundario -> estado secundario -> siguiente Atacar');
assert.equal(battle.right.status?.id,'stun');
assert.equal(battle.right.stages.speed,-1,'el efecto propio del movimiento principal NO se dispara con cada Atacar');
assert.equal(battle.log.filter(x=>x.includes('recibe Aturdimiento')).length,1,'aturdimiento únicamente al explotar');
const visual=battle.visualEvents.filter(x=>x.type==='secondary_attack');
assert.equal(visual.length,2);
assert.ok(visual.every(e=>e.attackerName?.includes('a')),'la animación usa el actor del evento y no analiza el mensaje personalizado');


// An independent secondary attack that misses must not apply its private on_hit status.
const missedExplosion=secondary('Bomba volcánica falló.',[stun]);missedExplosion.action.attack.accuracy=10;
const missed=play(makeMove('Explosión fallida',20,[missedExplosion]),1,null,()=>.5);
assert.equal(missed.right.status,null,'si la explosión falla, su aturdimiento NO afecta el golpe principal');
assert.ok(missed.log.some(x=>x.includes('Bomba volcánica falló.')));
assert.ok(missed.log.some(x=>x.includes('esquivó')),'el impacto adicional puede fallar independientemente del principal');

const movePower=makeMove('Potenciar',30,[rule('on_attack',{type:'modify_move_power',value:50})]);
const powerResult=play(movePower);
assert.ok(powerResult.log.some(x=>x.includes('La potencia de Potenciar de a ahora es 80.')),'mensaje editable de potencia');
const baseline=play(makeMove('Potenciar',30));
assert.ok(powerResult.right.hp<baseline.right.hp,'potencia modifica el daño real');

const accuracy=makeMove('Apuntar',20,[rule('on_attack',{type:'modify_move_accuracy',value:80})],{accuracy:20});
const accuracyResult=play(accuracy);
assert.ok(accuracyResult.log.some(x=>x.includes('La precisión de Apuntar de a ahora es 100 %.')));
assert.ok(accuracyResult.log.some(x=>/recibe \d+ de daño/.test(x)),'precisión modificada impacta');
assert.ok(play(makeMove('Apuntar',20,[],{accuracy:20})).log.some(x=>x.includes('esquivó')),'sin modificador no impacta con misma aleatoriedad');

const crit=makeMove('Crítico',20,[rule('on_attack',{type:'modify_move_critical',value:100})]);
const critResult=play(crit);
assert.ok(critResult.log.some(x=>x.includes('La probabilidad de crítico de Crítico de a ahora es 100 %.')));
assert.ok(critResult.log.some(x=>x.includes('hizo un golpe crítico')),'crítico realmente aplicado');

// A per-move streak should use hits from THIS move, not any attack by the actor.
const condition={type:'streak_count',value:'hit:1:',subject:'self'};
const streakMove=makeMove('Carga especial',20,[rule('on_attack',{type:'modify_move_power',value:0,perStack:45},condition)]);
const streakTwo=play(streakMove,2);
assert.ok(streakTwo.log.some(x=>x.includes('La potencia de Carga especial de a ahora es 65.')),'segunda utilización acumula la racha propia');
const another=makeMove('Intercalar',20);
const interrupted=play(streakMove,3,[{actions:[{move:streakMove.id}]},{actions:[{move:another.id}]},{actions:[{move:streakMove.id}]}],()=>.5,[another]);
assert.ok(!interrupted.log.some(x=>x.includes('La potencia de Carga especial de a ahora es')),'intercalar otro movimiento corta la racha consecutiva del anterior');
const any={type:'streak_count',value:'hitAnyTurn:1:',subject:'self'};
const spaced=makeMove('Acertar separados',20,[rule('on_attack',{type:'modify_move_power',value:0,perStack:30},any)]);
const spacedBattle=play(spaced,3,[{actions:[{move:spaced.id}]},{actions:[{move:another.id}]},{actions:[{move:spaced.id}]}],()=>.5,[another]);
assert.ok(spacedBattle.log.some(x=>x.includes('La potencia de Acertar separados de a ahora es 50.')),'turnos separados conservan aciertos previos');
console.log('Mensajes propios, orden, aislamiento, precisión, potencia, crítico y rachas de movimiento: OK');
