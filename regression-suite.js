// Deterministic private test runner; no Cloudflare bindings or persistent side effects.
import {simulate} from './battle-engine.js';
export function seededRandom(seed=1){
  let state=(Number(seed)>>>0)||1;
  return ()=>{state=(state+0x6D2B79F5)>>>0;let t=Math.imul(state^(state>>>15),1|state);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
}
export function regressionSummary(r){
  const unit=u=>({id:u.id,hp:u.hp,status:u.status?.id||null,counters:u.consecutiveCounters||{},cooldowns:u.cooldowns||{}});
  return {rounds:r.rounds,winner:r.winner,needsReplacement:r.needsReplacement,
    left:r.leftTeam.map(unit),right:r.rightTeam.map(unit),
    events:(r.deathEvents||[]).map(e=>({side:e.side,teamIndex:e.teamIndex})),
    weather:r.weather,field:r.field,scenario:r.scenario};
}
export function runRegressionCase(test,catalog,chart){
  const c=test?.config||{};
  if(!['singles','doubles'].includes(c.mode||'singles'))throw Error('Modo inválido.');
  if(!Array.isArray(c.leftTeam)||!Array.isArray(c.rightTeam)||c.leftTeam.length<1||c.rightTeam.length<1||c.leftTeam.length>8||c.rightTeam.length>8)throw Error('Equipos inválidos.');
  const turns=Number(c.turns??0);
  if(!Number.isInteger(turns)||turns<0||turns>60)throw Error('El simulador permite hasta 60 rondas por prueba guardada.');
  const result=simulate({catalog,chart,mode:c.mode||'singles',leftTeam:c.leftTeam,rightTeam:c.rightTeam,
    turns,leftOrders:c.leftOrders||[],rightOrders:c.rightOrders||[],leftReplacements:c.leftReplacements||[],rightReplacements:c.rightReplacements||[],
    weather:c.weather||'',field:c.field||'',scenario:c.scenario||'',randomSource:seededRandom(c.seed??1)});
  const actual=regressionSummary(result);
  const passed=test.expected===undefined||JSON.stringify(test.expected)===JSON.stringify(actual);
  return {name:test.name||'sin nombre',passed,actual,expected:test.expected??null};
}
export function normalizeRegressionCase(raw){
  if(typeof raw?.name!=='string'||!/^[\p{L}\p{N}_ .-]{1,64}$/u.test(raw.name))throw Error('Nombre de prueba inválido.');
  if(!raw.config||typeof raw.config!=='object'||JSON.stringify(raw).length>20000)throw Error('Configuración de prueba inválida o demasiado grande.');
  return {name:raw.name,config:structuredClone(raw.config),...(raw.expected?{expected:structuredClone(raw.expected)}:{})};
}
