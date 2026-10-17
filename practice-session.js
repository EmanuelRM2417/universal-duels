import {simulate,normalizeMoveTarget} from './battle-engine.js';
import {choosePracticeActions} from './practice-ai.js';

export const PRACTICE_TTL=7*24*60*60*1000;
const idRe=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const aliveReserves=(state,side)=>{
  const active=state[side+'ActiveIndexes']||[];
  return (state[side+'Team']||[]).flatMap((u,i)=>u.hp>0&&!active.includes(i)?[i]:[]);
};
export const practiceOutcome=state=>{
  const a=state.leftTeam.some(x=>x.hp>0),b=state.rightTeam.some(x=>x.hp>0);
  return !a&&!b?'draw':!a?'defeat':!b?'victory':null;
};
// Persist only current state and a compact log; never write full historical timeline to DO storage.
const compactState=result=>{
  const {timeline,visualEvents,randomTape,checkpoint,...essential}=result;
  return {...essential,log:(result.log||[]).slice(-80)};
};
const run=(session,catalog,chart,turns)=>{
  const checkpoint=session.engineCheckpoint;
  const incremental=checkpoint&&(turns===checkpoint.round+1||turns===checkpoint.round);
  return simulate({catalog,chart,leftTeam:session.leftTeam,rightTeam:session.rightTeam,mode:session.mode,turns,
    leftOrders:session.leftOrders,rightOrders:session.rightOrders,leftReplacements:session.leftReplacements,rightReplacements:session.rightReplacements,
    randomTape:incremental?[]:session.randomTape,resume:incremental?checkpoint:null,
    replacementsOnly:!!incremental&&turns===checkpoint.round,includeCheckpoint:true});
};
const updateState=(session,result)=>{
  session.randomTape=[];
  session.engineCheckpoint=result.checkpoint;
  const previous=Array.isArray(session.lastState?.log)?session.lastState.log:[];
  // Incremental result.log is a delta. Keep a small recent window for the UI.
  session.lastState=compactState({...result,log:[...previous,...result.log].slice(-80)});
};
export function createPractice({catalog,chart={},revision,mode='singles',difficulty='easy',leftTeam,rightTeam,now=Date.now()}){
  if(!['singles','doubles'].includes(mode)||!['easy','advanced'].includes(difficulty))throw Error('Modalidad de Práctica inválida.');
  if(!revision)throw Error('Falta la versión del contenido.');
  const validate=(arr)=>Array.isArray(arr)&&arr.length>=1&&arr.length<=8&&new Set(arr).size===arr.length&&arr.every(x=>typeof x==='string'&&idRe.test(x)&&catalog?.entities?.[x]);
  if(!validate(leftTeam)||!validate(rightTeam))throw Error('Los equipos deben incluir de 1 a 8 personajes publicados sin repetir.');
  const s={revision,mode,difficulty,leftTeam:[...leftTeam],rightTeam:[...rightTeam],leftOrders:[],rightOrders:[],leftReplacements:[],rightReplacements:[],randomTape:[],round:1,phase:'action',status:'playing',outcome:null,updatedAt:now,expiresAt:now+PRACTICE_TTL};
  const r=run(s,catalog,chart,0);updateState(s,r);return s;
}
export function publicPractice(session){return {revision:session.revision,mode:session.mode,difficulty:session.difficulty,round:session.round,phase:session.phase,status:session.status,outcome:session.outcome,expiresAt:session.expiresAt,state:session.lastState};}
function validateOrders(session,order,catalog){
  const state=session.lastState,active=state.leftActive.filter(x=>x.hp>0),selected=Array.isArray(order?.actions)?order.actions:[order];
  const actions=[];
  for(const u of active){const raw=selected.find(x=>Number(x?.slot??0)===u.activeSlot);if(!raw)throw Error('Falta una acción de un personaje activo.');
    if(raw.switch!==undefined){const i=Number(raw.switch);if(!aliveReserves(state,'left').includes(i)||actions.some(a=>a.switch===i))throw Error('Cambio de personaje inválido.');actions.push({slot:u.activeSlot,switch:i});continue;}
    const entry=catalog.entities[u.id],allowed=[...(entry?.definition?.moveIds||[]),entry?.definition?.uniqueMoveId].filter(Boolean);
    if(!allowed.includes(raw.move)||!catalog.moves[raw.move]||Number(u.cooldowns?.[raw.move]||0)>0)throw Error('Movimiento inválido o en cooldown.');
    const move=catalog.moves[raw.move],targeting=normalizeMoveTarget(move.definition),a={slot:u.activeSlot,move:raw.move};
    if(session.mode==='doubles'&&targeting==='single'){
      const t=raw.target,side=t?.side,slot=Number(t?.slot),target=(side==='left'?state.leftActive:side==='right'?state.rightActive:[]).find(x=>x.activeSlot===slot);
      if(!target||target.hp<=0||(side==='left'&&slot===u.activeSlot))throw Error('Objetivo inválido.');
      a.target={side,slot};
    }
    if(raw.switchChoice){
      const choice=raw.switchChoice,index=Number(choice.teamIndex),available=aliveReserves(state,'left');
      const manual=(move.definition?.rules||[]).some(rule=>rule.action?.type==='switch_character'&&rule.action?.switchMode==='manual'&&rule.target==='self');
      if(!manual||choice.side!=='left'||Number(choice.slot)!==u.activeSlot||!Number.isInteger(index)||!available.includes(index))throw Error('Relevo del efecto inválido.');
      a.switchChoice={side:'left',slot:u.activeSlot,teamIndex:index};
    }
    actions.push(a);
  }
  return session.mode==='singles'?actions[0]:{actions};
}
function autoReplacement(session,side){
  const state=session.lastState,required=state.needsReplacement?.[side]||[],available=aliveReserves(state,side);
  const choices=[];
  for(const slot of required){if(!available.length)break;const i=Math.floor(Math.random()*available.length);choices.push({slot,teamIndex:available.splice(i,1)[0]});}
  return choices;
}
export function advancePractice(session,operation,payload,{catalog,chart={},now=Date.now(),random=Math.random}){
  if(now>=session.expiresAt)throw Error('La partida de Práctica expiró.');
  if(session.status!=='playing')throw Error('La partida ya terminó.');
  if(session.round>300)throw Error('Límite técnico de rondas alcanzado.');
  if(operation==='surrender'){session.status='finished';session.phase='finished';session.outcome='surrender';}
  else if(operation==='replacement'){
    if(session.phase!=='replacement')throw Error('No se están eligiendo sustituciones.');
    const required=session.lastState.needsReplacement?.left||[],available=aliveReserves(session.lastState,'left'),need=Math.min(required.length,available.length),choices=payload?.choices;
    if(!Array.isArray(choices)||choices.length!==need||new Set(choices.map(x=>x.slot)).size!==choices.length||new Set(choices.map(x=>x.teamIndex)).size!==choices.length||choices.some(x=>!required.includes(x.slot)||!available.includes(x.teamIndex)))throw Error('Sustituciones inválidas.');
    session.leftReplacements[session.round-2]={choices};
    const r=run(session,catalog,chart,session.round-1);updateState(session,r);session.phase='action';
  } else if(operation==='turn'){
    if(session.phase!=='action')throw Error('Primero seleccioná las sustituciones.');
    const user=validateOrders(session,payload?.order,catalog);
    const ai=choosePracticeActions({battle:session.lastState,catalog,chart,side:'right',difficulty:session.difficulty,random});
    session.leftOrders.push(user);session.rightOrders.push(ai);
    const r=run(session,catalog,chart,session.round);updateState(session,r);
    const outcome=practiceOutcome(r);
    if(outcome){session.status='finished';session.phase='finished';session.outcome=outcome;}
    else {
      const leftNeeds=r.needsReplacement?.left?.length&&aliveReserves(r,'left').length;
      const rightNeeds=r.needsReplacement?.right?.length&&aliveReserves(r,'right').length;
      if(rightNeeds){session.rightReplacements[session.round-1]={choices:autoReplacement(session,'right')};}
      if(leftNeeds){session.phase='replacement';}
      else if(rightNeeds){const updated=run(session,catalog,chart,session.round);updateState(session,updated);}
      if(!leftNeeds)session.phase='action';
      session.round++;
    }
  }else throw Error('Operación de Práctica inválida.');
  session.updatedAt=now;session.expiresAt=now+PRACTICE_TTL;
  return publicPractice(session);
}
