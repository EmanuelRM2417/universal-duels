// Universal Duels Alpha 0.4 — decision planner for private practice.
// Pure function: it receives only information the caller is allowed to reveal.
// This module does not create a practice session or persist player data.
import {normalizeMoveTarget} from './battle-engine.js';
import {hitChance,criticalChance} from './stat-math.js';

const bounded=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
const finite=(n,fallback=0)=>Number.isFinite(Number(n))?Number(n):fallback;
const effectiveness=(chart,moveType,targetTypes=[])=>targetTypes.reduce((sum,type)=>{
  const entry=chart?.[moveType]?.[type];
  return sum+(entry==='eficaz'?0.2:entry==='ineficaz'?-0.2:entry==='inmune'?-1:0);
},0);
const stat=(unit,key)=>Math.max(1,finite(unit?.currentStats?.[key]??unit?.baseStats?.[key]??100,100));
function estimatedDamage(unit,target,move,chart){
  const d=move.definition||{};
  const power=bounded(d.power,0,1000);
  if(!power||target.types?.some(type=>chart?.[d.type]?.[type]==='inmune'))return 0;
  const special=String(d.category).toLowerCase()==='special';
  const attack=stat(unit,special?'specialAttack':'attack');
  const defense=stat(target,special?'specialDefense':'defense');
  const eff=effectiveness(chart,d.type,target.types);
  const stab=(unit.types||[]).includes(d.type)?0.2:0;
  const acc=hitChance(d.accuracy??100,unit,target)/100;
  const multi=d.multihit;
  const hits=multi?(bounded(multi.min??1,1,20)+bounded(multi.max??multi.min??1,1,20))/2:1;
  const chanceCrit=criticalChance(d.criticalChance??0,unit)/100;
  // Use the same 50-level damage base as the authoritative engine instead
  // of overestimating damage from the raw move power. Independent final bonuses
  // remain additive; accuracy is evaluated for this particular move.
  const raw=Math.max(1,Math.floor((2*50/5+2)*power*attack/defense/50+2));
  return Math.max(0,raw*Math.max(0,1+eff+stab+chanceCrit*0.5)*acc*hits);
}
// Bounded two-turn expected-value search. Uses only currently visible units and
// the AI's OWN available moves. Never inspects unrevealed enemy moves/abilities.
// This stays pure and requires no CPU-expensive replay of the whole combat.
export function twoTurnValue(unit,move,target,options,chart,opponents=[]){
  const first=estimatedDamage(unit,target,move,chart);
  const afterHp=Math.max(0,finite(target.hp,1)-first);
  const damageThreat=opponents.filter(e=>e?.hp>0).reduce((sum,e)=>{
    const atk=stat(e,'attack'),spa=stat(e,'specialAttack');
    // Unknown enemy moves are estimated from public attack statistics only.
    return sum+Math.max(atk,spa)*0.25;
  },0);
  const survival=bounded((finite(unit.hp,1)-damageThreat)/Math.max(1,finite(unit.maxHp,1))*2,0,1);
  const next=options.filter(m=>m&&finite(unit.cooldowns?.[m.id])<=1)
    .filter(m=>m.id!==move.id||finite(move.definition?.cooldown)<=0)
    .reduce((best,m)=>Math.max(best,estimatedDamage(unit,{...target,hp:afterHp||target.hp},m,chart)),0);
  const kill=first>=finite(target.hp,1)?Math.min(45,finite(target.maxHp,1)*0.08):0;
  // Two turns with discounted future value and chance to survive retaliation.
  return first+kill+0.7*survival*next;
}
function possibleTargets(unit,slot,side,own,opponents,kind){
  const enemies=opponents.filter(x=>x&&x.hp>0);
  const allies=own.filter(x=>x&&x.hp>0&&x.activeSlot!==slot);
  switch(kind){
    case 'self': return [{unit,side,slot}];
    case 'ally': return allies.map(x=>({unit:x,side,slot:x.activeSlot}));
    case 'single': return [...enemies.map(x=>({unit:x,side:side==='left'?'right':'left',slot:x.activeSlot})),...allies.map(x=>({unit:x,side,slot:x.activeSlot}))];
    case 'enemy_team': return enemies.length?[{unit:enemies[0],side:side==='left'?'right':'left',slot:enemies[0].activeSlot}]:[];
    case 'ally_team': return [{unit,side,slot}];
    case 'all': return enemies.length?[{unit:enemies[0],side:side==='left'?'right':'left',slot:enemies[0].activeSlot}]:[];
    default:return enemies.length?[{unit:enemies[0],side:side==='left'?'right':'left',slot:enemies[0].activeSlot}]:[];
  }
}
function scoreAction(unit,move,target,chart,level,planned){
  const d=move.definition||{},kind=normalizeMoveTarget(d);
  const damaging=finite(d.power)>0;
  if(damaging){
    const dmg=estimatedDamage(unit,target.unit,move,chart);
    let value=dmg;
    if(level==='advanced'){
      const remain=finite(target.unit.hp,1);
      if(dmg>=remain)value+=35;
      if(remain>0)value+=Math.min(20,dmg/remain*12);
      // Avoid concentrating multiple allied moves on an already expected KO.
      if(planned.get(target.unit.teamIndex)||planned.get(target.unit.id))value*=0.72;
      if(kind==='enemy_team'||kind==='all')value*=1.5;
    }
    return value;
  }
  const rules=Array.isArray(d.rules)?d.rules:[];
  const self=target.unit===unit;
  const wounded=finite(unit.maxHp)-finite(unit.hp);
  const heal=rules.some(r=>r.action?.type==='heal');
  return heal?(wounded>0?15+Math.min(40,wounded/5):2):(self?10:8)+(level==='advanced'?4:0);
}
/**
 * Select legal-looking actions from a PUBLIC battle snapshot. The server must
 * still validate the resulting actions, including hidden rules and cooldowns.
 * `random` is injected for deterministic tests; never pass secret opponent data.
 */
export function choosePracticeActions({battle,catalog,chart={},side='right',difficulty='easy',random=Math.random}){
  if(!battle||!catalog?.moves||!catalog?.entities)throw Error('Práctica: batalla o catálogo inválido.');
  if(!['left','right'].includes(side))throw Error('Práctica: lado inválido.');
  const level=difficulty==='advanced'?'advanced':'easy';
  const own=battle[side+'Active']||[],other=battle[(side==='left'?'right':'left')+'Active']||[];
  const planned=new Map(),actions=[];
  const reserves=(battle[side+'Team']||[]).filter(u=>u?.hp>0&&!(battle[side+'ActiveIndexes']||[]).includes(u.teamIndex));
  const reservedSwitches=new Set();
  // Evaluate a voluntary switch using only currently visible opposing units
  // and the known types/base statistics of our own reserves.
  function switchCandidate(unit){
    if(level!=='advanced'||!reserves.length||!other.some(e=>e?.hp>0))return null;
    const danger=Math.min(1,finite(unit.hp)/Math.max(1,finite(unit.maxHp,1)));
    if(danger>0.32)return null;
    const enemies=other.filter(e=>e?.hp>0);
    const threats=enemies.map(e=>{
      const defs=catalog.entities[e.id]?.definition||{};
      // Do not access the opponent's unrevealed move list or abilities.
      return {types:e.types||defs.types||[],attack:finite(e.currentStats?.attack??e.baseStats?.attack,100)};
    });
    const options=reserves.filter(r=>!reservedSwitches.has(r.teamIndex)).map(r=>{
      const own=catalog.entities[r.id]?.definition||{};
      const types=r.types||own.types||[];
      const hp=finite(r.hp)/Math.max(1,finite(r.maxHp,own.hp||1));
      const defensiveTypes=threats.reduce((score,t)=>score+t.types.reduce((v,type)=>v+effectiveness(chart,type,types),0),0);
      return {r,score:hp*100-defensiveTypes*20+finite(own.defense,100)*0.03};
    }).sort((a,b)=>b.score-a.score);
    const best=options[0];
    if(!best||best.score<45)return null;
    return best.r.teamIndex;
  }

  for(const unit of own){
    if(!unit||unit.hp<=0)continue;
    const slot=Number(unit.activeSlot);
    const entry=catalog.entities[unit.id];
    if(!entry)throw Error('Práctica: entidad no publicada.');
    const replacement=switchCandidate(unit);
    if(replacement!==null){
      reservedSwitches.add(replacement);
      actions.push({slot,switch:replacement});
      continue;
    }
    const moves=[...(entry.definition.moveIds||[]),entry.definition.uniqueMoveId].filter(Boolean)
      .map(id=>catalog.moves[id]).filter(m=>m&&!(finite(unit.cooldowns?.[m.id])>0));
    const candidates=[];
    for(const move of moves){
      const kind=normalizeMoveTarget(move.definition);
      for(const target of possibleTargets(unit,slot,side,own,other,kind)){
        // Attack moves may not deliberately target allies.
        if(finite(move.definition.power)>0&&target.side===side&&target.unit!==unit)continue;
        if(kind==='single'&&finite(move.definition.power)>0&&target.unit===unit)continue;
        const score=scoreAction(unit,move,target,chart,level,planned)
          +(level==='advanced'&&finite(move.definition.power)>0
            ?0.30*(twoTurnValue(unit,move,target.unit,moves,chart,other)-estimatedDamage(unit,target.unit,move,chart)):0);
        candidates.push({move,target,score});
      }
    }
    if(!candidates.length)throw Error('Práctica: personaje sin acciones legales disponibles.');
    candidates.sort((a,b)=>b.score-a.score||a.move.id.localeCompare(b.move.id));
    const rng=bounded(random(),0,0.999999);
    // Easy plays varied moves; advanced strongly prefers the top-ranked set.
    const pool=level==='easy'?candidates:candidates.filter(c=>c.score>=candidates[0].score*0.85);
    const chosen=pool[Math.floor(rng*pool.length)];
    if(!chosen)throw Error('Práctica: no se pudo escoger movimiento.');
    const action={slot,move:chosen.move.id};
    if(battle.mode==='doubles'&&normalizeMoveTarget(chosen.move.definition)==='single'){
      action.target={side:chosen.target.side,slot:chosen.target.slot};
    }
    actions.push(action);
    planned.set(chosen.target.unit.teamIndex,(planned.get(chosen.target.unit.teamIndex)||0)+1);
  }
  if(!actions.length)throw Error('Práctica: no hay personajes activos capaces de actuar.');
  if(battle.mode==='doubles')return{actions};
  return actions[0].switch!==undefined?{switch:actions[0].switch}:{move:actions[0].move};
}
