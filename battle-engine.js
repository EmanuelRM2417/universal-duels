// Universal Duels battle engine · Alpha 0.4
// Shared by the private Lab and the public server. Supports Singles and Doubles.
import {basicStageFactor,hitChance,criticalChance} from './stat-math.js';
export const STATS=['hp','attack','defense','specialAttack','specialDefense','speed'];
export const MOVE_TARGETS=['self','ally_team','enemy_team','single','ally','all','all_active','enemy_direct','enemy_inverse'];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
const integer=n=>Math.round(Number(n)||0);
const safe=s=>String(s||'').slice(0,100);
const STAT_NAMES={attack:'Ataque',defense:'Defensa',specialAttack:'Ataque especial',specialDefense:'Defensa especial',speed:'Velocidad',accuracy:'Precisión',evasion:'Evasión',criticalChance:'Probabilidad de crítico'};
const statChangeText=(actor,stat,delta)=>`${STAT_NAMES[stat]||stat} de ${battleLogName(actor)} ${delta>0?'subió':'bajó'} ${delta>0?'+':''}${delta}.`;
const environmentText=(kind,entry,on)=>kind==='fields'?`${entry.name} se ${on?'activó':'desactivó'}.`:kind==='weathers'?(on?`Ahora hay ${entry.name}.`:`${entry.name} desapareció.`):(on?`Ahora estamos en ${entry.name}.`:`Ya no estamos en ${entry.name}.`);
const percent=x=>clamp(x,0,100);
const drainPercent=x=>clamp(x,0,1000);
// Los modificadores solo existen si fueron configurados. El tope se refiere al
// máximo bono/penalización en puntos o porcentaje, no al valor base del ataque.
function modifiedValue(base,mods=[],bounds=[0,Infinity]){
  let additive=0,factor=1;
  for(const m of mods){
    let change=Number(m.value)||0;
    const cap=m.cap===null||m.cap===undefined||m.cap===''?Infinity:Math.max(0,Number(m.cap));
    change=Math.sign(change)*Math.min(Math.abs(change),cap);
    if(m.mode==='percent'){
      if(m.stacking==='multiplicative'){const growth=m.stacks?(Math.pow(Math.max(0,1+(Number(m.perStack)||0)/100),Math.max(0,Number(m.stacks)))-1)*100:change;const limited=Math.sign(growth)*Math.min(Math.abs(growth),cap);factor*=Math.max(0,1+limited/100);}
      else additive+=base*change/100;
    }else additive+=change;
  }
  return clamp((base+additive)*factor,bounds[0],bounds[1]);
}
function matchesEnvironmentAttack(a,move,e){
  const types=Array.isArray(e.types)?e.types:[];
  const actorMatch=!e.filter||e.filter==='all'||(e.filter==='include'?types.some(t=>a.types.includes(t)):!types.some(t=>a.types.includes(t)));
  return actorMatch&&(!Array.isArray(e.attackTypes)||!e.attackTypes.length||e.attackTypes.includes(move.definition.type));
}
function moveCounter(user,moveId){
  ensureActorRuntime(user);
  if(!user.moveStreaks[moveId]||typeof user.moveStreaks[moveId]!=='object')user.moveStreaks[moveId]={};
  return user.moveStreaks[moveId];
}
function streakCounter(user,mode,moveId){
  const counters=moveId?moveCounter(user,moveId):user.consecutiveCounters||{};
  return Math.max(0,Number(counters[mode]||0));
}
function streakModifier(move,user){
  const cfg=move?.definition?.streak;if(!cfg?.enabled)return null;
  const mode=cfg.conditionMode==='hitAnyTurn'?'hitAnyTurn':cfg.conditionMode==='use'?'use':move?.definition?.multihit&&cfg.countUnit==='hit'?'streakHits':'hit';
  const count=streakCounter(user,mode,move.id);
  const threshold=Math.max(1,integer(cfg.minStreak||1));
  if(count<threshold)return null;
  const stacks=Math.max(0,Math.min(count-threshold+1,Number(cfg.maxStacks)||999));
  const amount=(Number(cfg.perStack)||0)*stacks;
  return {value:amount,mode:cfg.valueMode==='percent'?'percent':'fixed',stacking:cfg.stacking==='multiplicative'?'multiplicative':'additive',cap:cfg.cap,stacks:cfg.cap!==undefined&&cfg.cap!==null&&cfg.cap!==''&&Number(cfg.perStack)>0?Math.min(stacks,Math.floor(Number(cfg.cap)/Number(cfg.perStack))):stacks,perStack:Number(cfg.perStack)||0};
}

const base=d=>Object.fromEntries(STATS.map(k=>[k,clamp(d[k]??0,0,k==='hp'?500:200)]));
const sideName=s=>s===0?'left':'right';
const sideIndex=s=>s==='right'||s===1?1:0;

export function normalizeMoveTarget(definition={}){return MOVE_TARGETS.includes(definition.targeting)?definition.targeting:'single';}
export function validateEntity(entry){
  const d=entry?.definition;
  if(!d||!Array.isArray(d.types)||d.types.length<1||d.types.length>3||new Set(d.types).size!==d.types.length)throw Error('Entidad sin 1–3 tipos distintos.');
  for(const s of STATS){const max=s==='hp'?500:200;if(!Number.isInteger(Number(d[s]))||Number(d[s])<0||Number(d[s])>max)throw Error('Estadística inválida: '+s);}
  if(['attack','defense','specialAttack','specialDefense','speed'].reduce((n,k)=>n+Number(d[k]||0),0)>1000)throw Error('Las cinco estadísticas base superan 1000.');
  if(!Array.isArray(d.moveIds)||d.moveIds.length!==3||!d.uniqueMoveId||!d.globalAbilityId||!d.uniqueAbilityId)throw Error('La entidad requiere tres ataques globales, uno exclusivo y dos habilidades.');
}
function actor(entry,moves,abilities,side,teamIndex){
  validateEntity(entry);const d=entry.definition,stats=base(d);
  return {id:entry.id,name:entry.name,side:sideName(side),teamIndex,types:d.types.map(t=>t==='espiritu'?'valor':t),stats,hp:stats.hp,maxHp:stats.hp,stages:{},environmentStages:{},statusStages:{},passiveStages:{},environmentCrit:0,environmentImmune:[],environmentDamageImmunity:[],statusBlocked:false,status:null,effects:[],statSources:[],moves,abilities,used:{},consecutiveCounters:{},moveStreaks:{},cooldowns:{},cooldownSetRound:{},environmentCooldownOnUse:[],lastHitType:null,_mirror:false,firstFullRound:1};
}
function ensureActorRuntime(a){
  if(!a||typeof a!=='object')throw Error('Combatiente inválido durante la resolución.');
  for(const k of ['effects','statSources','environmentCooldownOnUse','environmentDamageImmunity'])if(!Array.isArray(a[k]))a[k]=[];
  for(const k of ['cooldowns','cooldownSetRound','stages','environmentStages','statusStages','passiveStages','used','consecutiveCounters','moveStreaks'])if(!a[k]||typeof a[k]!=='object'||Array.isArray(a[k]))a[k]={};
  return a;
}
function battleLogName(a){return (a?._mirror?(a?.side==='left'?'@@L@@':a?.side==='right'?'@@R@@':''):'')+(a?.name||'');}

function effective(a,stat){ensureActorRuntime(a);return Math.max(1,Math.round((a.stats[stat]??100)*basicStageFactor(a.stages[stat],a.environmentStages[stat],a.statusStages?.[stat],a.passiveStages?.[stat])));}
function meets(cond,user,target,state){
  const moveId=arguments[4]||null;
  if(!cond||cond.type==='always')return true;const v=cond.value;const checked=cond.subject==='target'?target:user;if(!checked&&['hp_below','hp_above','hp_full','has_status','has_type','was_hit_by_type','stat_below','streak_count'].includes(cond.type))return false;
  switch(cond.type){
    case'hp_below':return checked.hp/checked.maxHp*100<Number(v);case'hp_above':return checked.hp/checked.maxHp*100>Number(v);
    case'hp_full':return checked.hp===checked.maxHp;case'weather_is':return !!state.weather&&(!v||state.weather===v);case'field_is':return !!state.field&&(!v||state.field===v);case'scenario_is':return !!state.scenario&&(!v||state.scenario===v);case'has_status':return !!checked.status&&(!v||checked.status.id===v);case'enemy_defeated':return !!state.currentDefeatActor&&state.currentDefeatActor.side===user.side&&state.currentDefeatActor.teamIndex===user.teamIndex;
    case'has_type':return checked.types.includes(v);case'was_hit_by_type':return checked.lastHitType===v;case'received_move_type':return !!state.currentReceivedMove&&(!v||state.currentReceivedMove.type===v);case'received_move_category':return !!state.currentReceivedMove&&(!v||state.currentReceivedMove.category===v);case'stat_below':return effective(checked,'speed')<Number(v);
    case'streak_count':{ // La condición cuenta la racha; el efecto se configura aparte.
      const [mode='hit',min='1',max='']=String(v||'hit:1:').split(':');
      if(!['hit','use','streakHits','hitAnyTurn'].includes(mode))return false;
      const count=streakCounter(checked,mode,checked===user?moveId:null);
      return count>=Math.max(0,Number(min)||0)&&(max===''||count<=Number(max));
    }
    case'in_doubles':return state.mode==='doubles';
    case'going_to_switch':return !!checked&&state.plannedSwitches?.has(checked);
    case'first_turn_in_field':return !!checked&&checked.hp>0&&state.active[actorSide(checked)]?.includes(checked.teamIndex)&&state.round===(checked.firstFullRound??1);
    default:return false;
  }
}
function conditionsPass(rule,user,target,state,moveId=null){
  const parts=[rule.condition||{type:'always'},...(Array.isArray(rule.conditions)?rule.conditions:[])];let result=null;
  for(const part of parts){const yes=part.negate?!meets(part,user,target,state,moveId):meets(part,user,target,state,moveId);result=result===null?yes:part.operator==='OR'?(result||yes):(result&&yes);}
  return rule.negate?!result:result;
}
function receivedAttackFilterPasses(rule,state){
  if(rule.event!=='on_receive_attack'||!rule.receivedAttackFilter)return true;
  const f=rule.receivedAttackFilter,move=state.currentReceivedMove;
  if(!move)return false;
  if(f.category&&f.category!=='both'&&f.category!==move.category)return false;
  const types=Array.isArray(f.types)?f.types:[];
  if(f.mode==='include'&&!types.includes(move.type))return false;
  if(f.mode==='exclude'&&types.includes(move.type))return false;
  return true;
}
function chance(rule,state){return percent(rule.chance??100)>=100||state.random()*100<percent(rule.chance??100);}
function sourceMeta(state){return {sourceKind:state.currentSourceKind||'efecto',sourceId:state.currentSourceId||'',sourceName:state.currentSourceName||'Efecto',sourceActor:state.currentSourceActor||'',sourceOwnerSide:state.currentSourceOwnerSide,sourceOwnerIndex:state.currentSourceOwnerIndex,...(state.currentSourceKind==='objeto'?{persistOnSwitch:!!state.currentItemPersistOnSwitch}:{})};}
function clearStatusLinkedEffects(a,statusId){ensureActorRuntime(a);a.effects=a.effects.filter(e=>!(e.sourceKind==='estado'&&e.sourceId===statusId));for(const key of Object.keys(a.used||{}))if(key.startsWith('status:'+statusId+':')||key.startsWith('statuspassive:'+statusId+':'))delete a.used[key];}
const STAT_KEYS=Object.keys(STAT_NAMES);
function statSelected(action,stat){return !(Array.isArray(action?.stats)&&action.stats.length)||action.stats.includes(stat);}
function directionSelected(action,value){const mode=action?.direction||'both';return value!==0&&(mode==='both'||mode==='up'&&value>0||mode==='down'&&value<0);}
function ownerSuppressed(effect,state,recipient){
  if(effect.sourceKind!=='habilidad')return false;
  const side=effect.sourceOwnerSide,index=effect.sourceOwnerIndex;
  const owner=side!==undefined&&index!==undefined?state.teams?.[sideIndex(side)]?.[index]:recipient;
  return !!owner?.effects?.some(e=>e.id==='suppressed');
}
function blocksStage(actor,stat,value,state,extra=[]){
  if(!value)return false;
  return [...(actor.effects||[]).filter(e=>e.id==='block_stat_changes'&&!ownerSuppressed(e,state,actor)),...(actor.passiveStatBlocks||[]),...extra]
    .some(e=>statSelected(e,stat)&&directionSelected(e,value));
}
function sourceSuffix(state){return state.currentSourceName?` por ${state.currentSourceName}${state.currentSourceActor?' de '+state.currentSourceActor:''}`:'';}
function annotateLogs(state,start,source,actor){if(!source)return;const suffix=` por ${source}${actor?' de '+actor:''}`;for(let i=start;i<state.log.length;i++)if(!state.log[i].includes(suffix))state.log[i]=state.log[i].replace(/\.$/,'')+suffix+'.';}
function actorSide(a){return a?.side==='right'?1:0;}
function activeActors(state,side){return (state.active[side]||[]).map(i=>state.teams[side][i]).filter(a=>a&&a.hp>0);}
function partnerOf(state,user){return activeActors(state,actorSide(user)).find(a=>a!==user)||null;}
function firstOpponent(state,user){return activeActors(state,1-actorSide(user))[0]||null;}
function targetSet(kind,user,contextTarget,state){
  const own=activeActors(state,actorSide(user)),enemy=activeActors(state,1-actorSide(user)),partner=partnerOf(state,user);
  switch(kind){
    case'self':return[user];case'ally':return partner?[partner]:[];case'ally_team':return own;case'enemy_team':return enemy;case'all':return [...own.filter(a=>a!==user),...enemy];case'all_active':return[...own,...enemy];case'enemy_direct':case'enemy_inverse':{const ownSlot=state.active[actorSide(user)].indexOf(user.teamIndex);const slot=state.mode==='doubles'&&kind==='enemy_inverse'?1-ownSlot:ownSlot;const idx=state.active[1-actorSide(user)]?.[Math.max(0,slot)];const opponent=state.teams[1-actorSide(user)]?.[idx];return opponent?.hp>0?[opponent]:[];}case'attacker':return contextTarget&&contextTarget.hp>0?[contextTarget]:[];case'target':return contextTarget&&contextTarget.hp>0?[contextTarget]:[];default:return contextTarget&&contextTarget.hp>0?[contextTarget]:enemy.slice(0,1);
  }
}
// Protección letal determinista: cada impacto se evalúa por separado.
function inflictDamage(target,amount,state,source='move'){
  ensureActorRuntime(target);
  const before=target.hp;
  if(before<=0||amount<=0)return 0;
  const lethal=amount>=before;
  if(lethal){
    // Las habilidades neutralizadas no participan; las protecciones por efectos sí.
    const candidates=(target.effects.some(e=>e.id==='suppressed')?[]:(target.abilities||[]))
      .filter(a=>a?.definition?.survive).map(a=>({id:a.id,kind:'ability',config:a.definition.survive}))
      .concat((target.effects||[]).filter(e=>e.id==='survive'&&!ownerSuppressed(e,state,target)).map(e=>({id:e.sourceId||'effect',kind:'effect',config:e})));
    candidates.sort((a,b)=>(Number(b.config.priority)||0)-(Number(a.config.priority)||0));
    for(const candidate of candidates){
      const cfg=candidate.config,allowed=cfg.sources||['move','effect','environment'];
      if(Array.isArray(allowed)&&!allowed.includes(source))continue;
      const scope=cfg.limitScope||cfg.limitMode||'battle';
      const entryScoped=scope==='entry'||scope==='per_entry'||scope==='oncePerEntry';
      const key=(entryScoped?'survive-entry:':candidate.kind==='effect'?'survive-effect:':'survive:')+candidate.id;
      const limit=scope==='unlimited'?Infinity:cfg.limit===undefined?Infinity:Math.max(0,integer(cfg.limit));
      if((target.used[key]||0)>=limit)continue;
      if(state.random()*100>=percent(cfg.chance??100))continue;
      const remaining=1; // Sobrevivir deja exactamente 1 PS, incluido contenido anterior.
      target.hp=remaining;target.used[key]=(target.used[key]||0)+1;
      state.matchStats[actorSide(target)].damageReceived+=Math.max(0,before-remaining);
      if(state.damageCauserSide!==null&&state.damageCauserSide!==actorSide(target))state.matchStats[state.damageCauserSide].damageDealt+=Math.max(0,before-remaining);
      state.log.push(`${battleLogName(target)} activa Sobrevivir y queda con ${remaining} PS.`);state.pushVisualUnit?.(target);
      state.onSurvive?.(target,candidate);state.refreshPassives?.();
      return Math.max(0,before-target.hp);
    }
  }
  target.hp=Math.max(0,before-amount);
  state.matchStats[actorSide(target)].damageReceived+=before-target.hp;
  if(state.damageCauserSide!==null&&state.damageCauserSide!==actorSide(target))state.matchStats[state.damageCauserSide].damageDealt+=before-target.hp;
  state.refreshPassives?.();state.refreshStatus?.();
  return before-target.hp;
}
function switchTargetOwner(state,target){return actorSide(target);}
function resetSwitchStages(a){ensureActorRuntime(a);a.stages={};a.statSources=[];a.consecutiveCounters={};a.moveStreaks={};}
function resetEntryAbilityUsage(a){ensureActorRuntime(a);for(const ability of a.abilities||[])for(const [idx,rule] of (ability?.definition?.rules||[]).entries())if(rule.event==='on_enter')delete a.used[ability.id+':'+idx];}
// Ataque secundario producido por una regla. Usa las mismas fórmulas y eventos de
// impacto que el ataque principal, sin cambiar su tipo público ni sus datos de catálogo.
// Each nested secondary attack has an isolated event context and its own on-hit rules.
// A nested on_hit MUST NOT execute on the primary move or another secondary attack.
function secondaryNarrator(spec,source,user,defender){
  const fallback=`${battleLogName(user)} realiza un ataque adicional por ${source}.`;
  if(typeof spec.narratorMessage!=='string'||!spec.narratorMessage.trim())return fallback;
  const words={ATACANTE:battleLogName(user),PERSONAJE:battleLogName(user),OBJETIVO:battleLogName(defender),MOVIMIENTO:source,EFECTO:source};
  return spec.narratorMessage.slice(0,240).replace(/\[(ATACANTE|PERSONAJE|OBJETIVO|MOVIMIENTO|EFECTO)\]/g,(full,key)=>words[key]);
}
function performSecondaryAttack(rule,user,contextTarget,state,depth,sourceOverride=null){
  const spec=rule.action?.attack||{};
  if((state.extraAttackDepth||0)>=4||(state.extraAttacksThisRound||0)>=16)return;
  if(!['physical','special'].includes(spec.category)||!Number.isFinite(Number(spec.power))||Number(spec.power)<=0)return;
  if(!Number.isFinite(Number(spec.accuracy))||!Number.isFinite(Number(spec.criticalChance)))return;
  if(spec.type!=='neutral'&&!state.chart?.[spec.type]&&!['fuego','agua','planta','roca','rayo','hielo','viento','espectro','divinidad','mente','agilidad','guerra','valor','luz','oscuridad','veneno','dragon','metal','tecnologia','encanto'].includes(spec.type))return;
  state.extraAttackDepth=(state.extraAttackDepth||0)+1;
  state.extraAttacksThisRound=(state.extraAttacksThisRound||0)+1;
  const saveKeys=['currentSourceName','currentSourceId','currentSourceKind','currentSourceActor','currentSourceOwnerSide','currentSourceOwnerIndex','currentRuleEvent','currentRuleKey','currentReceivedMove','currentAttackActor','currentAttackMove','attackModifiers','forceMiss','preventAction','lastDamage','damageBonus'];
  const prior=Object.fromEntries(saveKeys.map(k=>[k,state[k]]));
  const source=sourceOverride||state.currentSourceName||'Efecto';
  const recipients=targetSet(spec.target||rule.target||'target',user,contextTarget,state).filter(t=>t?.hp>0);
  const impacts=Math.max(1,Math.min(20,integer(spec.hits||1)));
  const nested=Array.isArray(spec.rules)?spec.rules.slice(0,12):[];
  try{
    const definition={...spec};state.currentAttackActor=user;
    state.currentAttackMove={id:`secondary-${state.extraAttacksThisRound}`,name:source,definition};
    state.attackModifiers={power:[],accuracy:[],critical:[],final:[]};state.forceMiss=false;state.damageBonus=0;
    state.currentSourceName=source;state.currentSourceKind='impacto-secundario';state.currentSourceId=state.currentAttackMove.id;
    state.currentSourceActor=user.name;state.currentSourceOwnerSide=user.side;state.currentSourceOwnerIndex=user.teamIndex;
    function ownRules(event,defender){for(let i=0;i<nested.length;i++){
      const sub=nested[i];if(sub.event!==event||!conditionsPass(sub,user,defender,state)||!chance(sub,state))continue;
      state.currentSourceName=source;state.currentSourceKind='impacto-secundario';state.currentSourceId=state.currentAttackMove.id;state.currentSourceActor=user.name;state.currentSourceOwnerSide=user.side;state.currentSourceOwnerIndex=user.teamIndex;state.currentRuleEvent=event;state.currentRuleKey=`secondary:${state.currentSourceId}:${i}`;
      action(sub,user,defender,state,depth+1);
      state.currentRuleKey='';state.currentRuleEvent='';
    }}
    for(const [recipientIndex,defender] of recipients.entries()){
      if(user.hp<=0||defender.hp<=0)continue;
      const eachImpacts=Math.floor(impacts/recipients.length)+(recipientIndex<impacts%recipients.length?1:0);
      for(let impactIndex=0;impactIndex<eachImpacts;impactIndex++){
      if(user.hp<=0||defender.hp<=0)break;
      const target={side:defender.side,slot:state.active[actorSide(defender)]?.findIndex(i=>i===defender.teamIndex)};
      const origin={side:user.side,slot:state.active[actorSide(user)]?.findIndex(i=>i===user.teamIndex)};
      state.log.push(secondaryNarrator(spec,source,user,defender));
      state.visualEvents.push({logIndex:state.log.length-1,type:'secondary_attack',side:origin.side,slot:origin.slot,targets:[target],category:spec.category,animate:spec.animate!==false,attackerName:battleLogName(user)});
      ownRules('manual',defender);ownRules('on_attack',defender);
      // Passive abilities may react to the independent attack, but cannot cause
      // any nested move rules to be re-evaluated as primary move effects.
      if(spec.interactions?.reactive!==false)rulesFor(null,'on_attack',user,defender,state);
      if(state.random()*100 >= Number(spec.chance??100))continue;
      const actualAccuracy=modifiedValue(Number(spec.accuracy),state.attackModifiers.accuracy,[0,100]);
      const hit=!state.forceMiss&&(Number(spec.accuracy)===0||state.random()*100<hitChance(actualAccuracy,user,defender));
      if(!hit){state.log.push(`${battleLogName(defender)} esquivó el ataque de ${battleLogName(user)}.`);ownRules('on_miss',defender);if(spec.interactions?.reactive!==false)rulesFor(null,'on_miss',user,defender,state);state.currentReceivedMove={type:spec.type,category:spec.category,moveId:'secondary-attack'};if(spec.interactions?.reactive!==false)rulesFor(null,'on_dodge',defender,user,state);state.currentReceivedMove=null;continue;}
      const rel=relationBonus(spec.type,defender,state);
      const immune=[...(defender.effects||[]),...(defender.environmentDamageImmunity||[]),...(defender.passiveDamageImmunity||[])].some(e=>damageImmunityMatches(e,state,defender,{type:spec.type,category:spec.category,targeting:spec.target||'single'}));
      if((rel.immune||immune)&&spec.interactions?.immunity!==false){state.log.push(`${battleLogName(defender)} es inmune al ataque.`);continue;}
      const atk=effective(user,spec.category==='special'?'specialAttack':'attack');
      const def=effective(defender,spec.category==='special'?'specialDefense':'defense');
      const base=Math.max(1,Math.floor((2*50/5+2)*modifiedValue(Number(spec.power),state.attackModifiers.power,[0,5000])*atk/Math.max(1,def)/50+2));
      let bonus=(user.types.includes(spec.type)?.2:0)+rel.bonus;
      if(spec.interactions?.critical!==false&&state.random()*100<criticalChance(modifiedValue(Number(spec.criticalChance),state.attackModifiers.critical,[0,100]),user)){bonus+=.5;state.log.push(`${battleLogName(user)} hizo un golpe crítico contra ${battleLogName(defender)}.`);}
      const initialDamage=Math.max(1,integer(modifiedValue(base*(1+bonus+state.damageBonus),state.attackModifiers.final,[0,999999])));
      const damage=Math.max(0,integer(initialDamage*receivedDamageFactor(defender,{type:spec.type,category:spec.category,targeting:spec.target||'single'},state)));
      state.damageCauserSide=actorSide(user);
      const actual=inflictDamage(defender,damage,state,'move');state.damageCauserSide=null;
      state.lastDamage={attackerSide:user.side,attackerTeamIndex:user.teamIndex,defenderSide:defender.side,defenderTeamIndex:defender.teamIndex,amount:actual,moveId:'secondary-attack'};
      defender.lastHitType=spec.type;
      state.log.push(`${battleLogName(defender)} recibe ${damage} de daño.`);
      state.pushVisualUnit?.(defender);
      state.currentReceivedMove={type:spec.type,category:spec.category,moveId:'secondary-attack'};
      ownRules('on_hit',defender);
      if(spec.interactions?.reactive!==false)rulesFor(null,'on_hit',user,defender,state);
      if(actual>0&&spec.interactions?.reactive!==false){rulesFor(null,'on_damage_taken',defender,user,state);rulesFor(null,'on_receive_attack',defender,user,state);}
      state.currentReceivedMove=null;
      state.resolveDeaths?.();
      }
    }
  }finally{
    Object.assign(state,prior);
    state.extraAttackDepth--;
  }
}
function action(rule,user,contextTarget,state,depth){
  ensureActorRuntime(user);if(contextTarget)ensureActorRuntime(contextTarget);const act=rule.action||{};
  // Por turno: la intensidad de acciones numéricas crece con los niveles de racha.
  // Las acciones instantáneas ya ejecutadas no se pueden revertir; los efectos
  // temporales conservan su vinculación a la racha para desaparecer al perderla.
  const streakParts=rule.condition?.type==='streak_count'?String(rule.condition.value||'hit:1:').split(':'):null;
  const streakCount=streakParts?streakCounter(user,streakParts[0],state.currentSourceKind==='movimiento'?state.currentSourceId:null):0;
  const streakLevel=streakParts&&rule.event==='on_condition'&&rule.streakEffectMode==='per_turn'?Math.max(1,streakCount-Math.max(0,Number(streakParts[1])||0)+1):1;
  const scalable=['damage','heal','heal_from_damage','damage_from_damage','heal_from_received_damage','damage_from_received_damage','modify_active_cooldowns','cooldown_on_use'];
  const v=streakLevel>1&&scalable.includes(act.type)&&act.value!==''&&Number.isFinite(Number(act.value))?Number(act.value)*streakLevel:act.value;
  if(['set_weather','set_field','set_scenario'].includes(act.type)){
    const kind={set_weather:'weathers',set_field:'fields',set_scenario:'scenarios'}[act.type],key={weathers:'weather',fields:'field',scenarios:'scenario'}[kind],entry=state.catalog[kind]?.[v];
    if(!entry){state.log.push('Entorno no encontrado: '+safe(v));return;}if(state[key]===v){state.log.push(kind==='fields'?entry.name+' ya está activo.':kind==='scenarios'?'Ya estamos en '+entry.name+'.':'Ya hay '+entry.name+'.');return;}
    if(state.allActive().some(a=>a.effects.some(e=>e.id==='prevent_environment'&&(e.kind==='all'||e.kind===kind)))){state.log.push('Activación de entorno bloqueada.');return;}
    state[key]=safe(v);state[key+'Turns']=5;state.log.push(environmentText(kind,entry,true));state.pushVisualEnvironment?.(key);state.refreshEnvironment?.();return;
  }
  if(act.type==='attack'){
    if(state.currentAttackActor===user&&state.currentRuleEvent==='on_attack'&&state.pendingSecondaryAttacks){
      state.pendingSecondaryAttacks.push({rule,user,contextTarget,depth,source:state.currentSourceName});
    }else performSecondaryAttack(rule,user,contextTarget,state,depth);
    return;
  }
  if(act.type==='swap_positions'){
    if(state.mode!=='doubles')return;
    const side=rule.target==='enemy_team'?1-actorSide(user):actorSide(user);
    if(state.active[side]?.length!==2||state.active[side].some(i=>state.teams[side][i]?.hp<=0))return;
    [state.active[side][0],state.active[side][1]]=[state.active[side][1],state.active[side][0]];
    state.log.push(`Las posiciones del equipo ${side===actorSide(user)?'aliado':'rival'} se intercambiaron.`);
    state.visualEvents.push({logIndex:state.log.length-1,type:'swap_positions',side:sideName(side)});
    state.pushVisualUnit?.(state.teams[side][state.active[side][0]],'switch_position');
    state.pushVisualUnit?.(state.teams[side][state.active[side][1]],'switch_position');
    return;
  }
  if(act.type==='force_miss'){state.forceMiss=true;return;}
  if(act.type==='do_nothing'){state.preventAction=true;return;}
  if(act.type==='apply_effect'){
    const effect=state.catalog.effects?.[v];if(effect&&depth<6){const prior={currentSourceName:state.currentSourceName,currentSourceId:state.currentSourceId,currentSourceKind:state.currentSourceKind};try{
      state.currentSourceName=effect.name||effect.id||'Efecto';state.currentSourceKind='efecto';state.currentSourceId=effect.id||v;
      for(const sub of effect.definition.rules||[])if(sub.event==='manual'&&conditionsPass(sub,user,contextTarget,state)&&chance(sub,state)){
        action(sub,user,contextTarget,state,depth+1);
      }
    }finally{Object.assign(state,prior);}}return;
  }
  const targets=act.type==='resurrect'&&rule.target==='self'?[user]:act.type==='resurrect'&&rule.target==='ally_team'?state.teams[actorSide(user)].filter(t=>t.hp===0):act.type==='resurrect'&&rule.target==='target'&&contextTarget?[contextTarget]:targetSet(rule.target,user,contextTarget,state);
  if(['environment_immunity','prevent_environment','effect_immunity'].includes(act.type)){
    for(const t of targets){const meta=sourceMeta(state),key=state.currentRuleKey||undefined;const previous=t.effects.find(e=>e.id===act.type&&e.sourceKind===meta.sourceKind&&e.sourceId===meta.sourceId&&e.streakRuleKey===key);if(previous){previous.turns=integer(rule.duration);previous.permanent=integer(rule.duration)===0;}else {t.effects.push({id:act.type,kind:v||'all',turns:integer(rule.duration),permanent:integer(rule.duration)===0,source:'ability',streakRuleKey:key,...meta});state.log.push(battleLogName(t)+(act.type==='effect_immunity'?' es inmune a los efectos.':' obtiene inmunidad a '+v+'.'));}}return;
  }
  if(['modify_move_power','modify_move_accuracy','modify_move_critical','final_damage'].includes(act.type)){
    const key={modify_move_power:'power',modify_move_accuracy:'accuracy',modify_move_critical:'critical',final_damage:'final'}[act.type];
    if(state.attackModifiers&&state.currentAttackActor===user&&Number.isFinite(Number(v))){
      const streak=String(rule.condition?.type==='streak_count'?rule.condition.value:'hit:1:').split(':');
      const counter=streakCounter(user,streak[0]||'hit',state.currentSourceKind==='movimiento'?state.currentSourceId:null);
      const stacks=rule.condition?.type==='streak_count'?Math.max(0,counter-(Number(streak[1])||0)+1):0;
      const value=Number(v)+(Number(act.perStack)||0)*stacks+(Number(act.perRound)||0)*Math.max(0,(state.round||1)-1);
      const base=Number(state.currentAttackMove?.definition?.[{power:'power',accuracy:'accuracy',critical:'criticalChance'}[key]]);
      const previous=Number.isFinite(base)&&key!=='final'?modifiedValue(base,state.attackModifiers[key],[0,key==='power'?5000:100]):null;
      state.attackModifiers[key].push({value,mode:act.mode||'fixed',stacking:act.stacking||'additive',cap:act.cap??null});
      if(previous!==null){
        const next=modifiedValue(base,state.attackModifiers[key],[0,key==='power'?5000:100]);
        if(Math.abs(next-previous)>0.0001){
          const label={power:'potencia',accuracy:'precisión',critical:'probabilidad de crítico'}[key];
          const shown=n=>Number(n.toFixed(2));
          state.log.push(`La ${label} de ${state.currentAttackMove.name} de ${battleLogName(user)} ahora es ${shown(next)}${key==='power'?'':' %'}.`);
        }
      }
    }
    return;
  }
  if(act.type==='survive'){
    // Opcional: instala la protección; la ejecución es automática y garantizada.
    for(const t of targetSet(rule.target,user,contextTarget,state))if(t?.hp>0){
      const duration=Math.max(1,integer(rule.duration||99));
      const sid=state.currentSourceId||'';
      // Actualizar una protección del mismo origen, sin acumular copias invisibles.
      t.effects=t.effects.filter(e=>!(e.id==='survive'&&e.sourceId===sid&&e.sourceKind===(state.currentSourceKind||'efecto')));
      t.effects.push({id:'survive',hpPercent:1,fixedHp:1,
        chance:percent(act.chance??rule.chance??100),priority:Number(act.priority)||0,
        sources:Array.isArray(act.sources)?act.sources:['move','effect','environment'],
        limit:act.limit===undefined?1:Math.max(0,integer(act.limit)),limitScope:act.limitScope||'battle',
        sourceKind:state.currentSourceKind||'efecto',sourceId:sid,streakRuleKey:state.currentRuleKey||undefined,turns:duration});
    }
    return;
  }
  if(act.type==='damage_multiplier'){
    // 100% = neutro, 150% = +50 puntos de modificador FINAL,
    // 50% = -50 puntos. Se suma a STAB, crítico y afinidades; no se compone.
    const factor=Number(v);if(Number.isFinite(factor)&&factor>=0&&factor<=500)state.damageBonus+=(factor-100)/100;return;
  }
  for(const t of targets){
    if(!t||(t.hp<=0&&act.type!=='resurrect'))continue;ensureActorRuntime(t);
    if(t.effects?.some(e=>e.id==='effect_immunity'&&!ownerSuppressed(e,state,t))||t.passiveEffectImmunity){
      if(!['effect_immunity','survive','remove_effect','remove_status'].includes(act.type)){
        // Solo narrar una inmunidad cuando alguien intenta imponer realmente un
        // efecto nuevo. Los chequeos continuos, propios y los efectos sin cambio
        // siguen bloqueados, pero no llenan la narración de avisos fantasma.
        const event=state.currentRuleEvent||'';
        const activeAttempt=!['on_condition','turn_start','turn_end','round_end','on_enter','on_status'].includes(event);
        const wouldChange=act.type==='apply_status'?(!t.status&&!t.statusBlocked&&!!state.catalog.statuses?.[safe(v)])
          :act.type==='stat_change'?STAT_KEYS.includes(act.stat)&&integer(v)!==0&&clamp((t.stages[act.stat]||0)+integer(v),-10,10)!==(t.stages[act.stat]||0)
          :act.type==='heal'?t.hp<t.maxHp&&Number(v)>0
          :act.type==='damage'?Number(v)>0
          :act.type==='clear_stat_changes'?STAT_KEYS.some(stat=>statSelected(act,stat)&&directionSelected(act,t.stages[stat]||0))
          :act.type==='remove_status'?!!t.status
          :act.type==='modify_active_cooldowns'?Object.values(t.cooldowns||{}).some(n=>n>0)&&integer(v)!==0
          :['heal_from_damage','damage_from_damage','heal_from_received_damage','damage_from_received_damage'].includes(act.type)?Number(v)>0&&Number(state.lastDamage?.amount)>0
          :true;
        if(user!==t&&activeAttempt&&wouldChange){
          state.log.push(`${battleLogName(t)} es inmune al efecto${sourceSuffix(state)}.`);
        }
        continue;
      }
    }
    if(act.type==='resurrect'){if(t.hp!==0)continue;const hp=act.fixedHp!==undefined?integer(act.fixedHp):Math.ceil(t.maxHp*percent(act.percent??v??25)/100);t.hp=Math.max(1,Math.min(t.maxHp,hp));state.log.push(`${battleLogName(t)} resucita con ${t.hp} PS.`);state.refreshPassives?.();}
    else if(act.type==='heal'){const before=t.hp,amount=Math.max(0,integer(t.maxHp*percent(v)/100));t.hp=Math.min(t.maxHp,t.hp+amount);const actual=t.hp-before;if(actual>0){state.log.push(`${battleLogName(t)} recupera ${actual} PS (${percent(v)} %).`);state.pushVisualUnit?.(t);state.refreshPassives?.();state.refreshStatus?.();}}
    else if(act.type==='damage'){const amount=percent(v)===0?0:Math.max(1,integer(t.maxHp*percent(v)/100));if(amount>0){state.damageCauserSide=actorSide(user);inflictDamage(t,amount,state,'effect');state.damageCauserSide=null;state.log.push(`${battleLogName(t)} recibe ${amount} de daño adicional (${percent(v)} %).`);state.pushVisualUnit?.(t);}}
    else if(['damage_from_received_damage','heal_from_received_damage'].includes(act.type)){
      const ld=state.lastDamage;
      const received=ld?.defenderTeamIndex===user.teamIndex&&ld?.defenderSide===user.side?Math.max(0,Number(ld.amount)||0):0;
      const amount=Math.max(0,integer(received*drainPercent(v)/100));
      if(amount>0){
        if(act.type==='heal_from_received_damage'){
          const old=t.hp;t.hp=Math.min(t.maxHp,t.hp+amount);
          if(t.hp>old){state.log.push(`${battleLogName(t)} recupera ${t.hp-old} PS por daño recibido.`);state.refreshPassives?.();state.refreshStatus?.();state.pushVisualUnit?.(t);}
        }else{
          const actual=inflictDamage(t,amount,state,'effect');if(actual>0){state.log.push(`${battleLogName(t)} recibe ${actual} PS adicionales por daño recibido.`);state.pushVisualUnit?.(t);}
        }
      }
    }
    else if(act.type==='damage_from_damage'){const dealt=state.lastDamage?.attackerTeamIndex===user.teamIndex&&state.lastDamage?.attackerSide===user.side?state.lastDamage.amount:0;const amount=Math.max(0,integer(dealt*drainPercent(v)/100));if(amount>0){const actual=inflictDamage(t,amount,state,'effect');state.log.push(`${battleLogName(t)} recibe ${actual} PS de daño por el daño infligido (${drainPercent(v)} %).`);state.pushVisualUnit?.(t);}}
    else if(act.type==='heal_from_damage'){const dealt=state.lastDamage?.attackerTeamIndex===user.teamIndex&&state.lastDamage?.attackerSide===user.side?state.lastDamage.amount:0,before=t.hp,amount=Math.max(0,integer(dealt*drainPercent(v)/100));t.hp=Math.min(t.maxHp,t.hp+amount);const actual=t.hp-before;if(actual>0){state.log.push(`${battleLogName(t)} recupera ${actual} PS (${drainPercent(v)} % del daño infligido).`);state.pushVisualUnit?.(t);}}
    else if(act.type==='stat_change'&&STAT_KEYS.includes(act.stat)){if(blocksStage(t,act.stat,integer(v),state)){state.log.push(`${battleLogName(t)} no puede modificar ${STAT_NAMES[act.stat]}${sourceSuffix(state)}.`);continue;}const before=t.stages[act.stat]||0,next=clamp(before+integer(v),-10,10),delta=next-before;t.stages[act.stat]=next;if(delta){t.statSources.push({stat:act.stat,value:delta,sourceName:state.currentSourceName||'Efecto',sourceKind:state.currentSourceKind||'efecto',sourceActor:state.currentSourceActor||user.name});state.log.push(statChangeText(t,act.stat,delta));state.pushVisualUnit?.(t);}else if(integer(v)!==0){state.log.push(`${STAT_NAMES[act.stat]} de ${battleLogName(t)} ya está en el límite ${before>0?'máximo':'mínimo'}.`);}}
    else if(act.type==='block_items'){
      const meta=sourceMeta(state),duration=Math.max(1,integer(rule.duration||1));
      const old=t.effects.find(e=>e.id==='block_items'&&e.sourceId===meta.sourceId&&e.sourceKind===meta.sourceKind);
      if(old)old.turns=duration;else t.effects.push({id:'block_items',turns:duration,...meta});
      state.log.push(`${battleLogName(t)} no puede utilizar consumibles.`);state.pushVisualUnit?.(t);
    }
    else if(act.type==='move_first'||act.type==='move_last'){
      const meta=sourceMeta(state),duration=Math.max(1,integer(rule.duration||1));
      t.effects=t.effects.filter(e=>!((e.id==='move_first'||e.id==='move_last')&&e.sourceId===meta.sourceId&&e.sourceKind===meta.sourceKind));
      t.effects.push({id:act.type,turns:duration,...meta});
      state.log.push(`${battleLogName(t)} ${act.type==='move_first'?'se moverá primero':'se moverá último'}.`);
      state.pushVisualUnit?.(t);
    }
    else if(act.type==='heal_over_time'){
      const meta=sourceMeta(state),duration=Math.max(1,integer(rule.duration||1));
      t.effects=t.effects.filter(e=>!(e.id==='heal_over_time'&&e.sourceId===meta.sourceId&&e.sourceKind===meta.sourceKind));
      t.effects.push({id:'heal_over_time',value:percent(v),turns:duration,...meta});
      state.log.push(`${battleLogName(t)} recuperará ${percent(v)} % de sus PS al final de cada turno durante ${duration} turnos.`);
    }
    else if(act.type==='clear_stat_changes'){
      let modified=false;
      for(const stat of STAT_KEYS){const old=t.stages[stat]||0;if(!statSelected(act,stat)||!directionSelected(act,old))continue;t.stages[stat]=0;modified=true;
        t.statSources=(t.statSources||[]).filter(x=>x.stat!==stat);
        state.log.push(`${battleLogName(t)} elimina ${old>0?'subidas':'bajadas'} de ${STAT_NAMES[stat]}${sourceSuffix(state)}.`);
      }
      if(modified){state.refreshPassives?.();state.pushVisualUnit?.(t);}
    }
    else if(act.type==='block_stat_changes'){
      const meta=sourceMeta(state),duration=integer(rule.duration),existing=t.effects.find(e=>e.id==='block_stat_changes'&&e.sourceId===meta.sourceId&&e.sourceKind===meta.sourceKind);
      const item={id:'block_stat_changes',stats:Array.isArray(act.stats)?act.stats.filter(x=>STAT_KEYS.includes(x)):[],direction:['up','down','both'].includes(act.direction)?act.direction:'both',turns:duration,permanent:duration===0,streakRuleKey:state.currentRuleKey||undefined,...meta};
      if(existing)Object.assign(existing,item);else t.effects.push(item);
      state.log.push(`${battleLogName(t)} impide cambios de estadística${sourceSuffix(state)}.`);
      state.refreshEnvironment?.();state.refreshStatus?.();state.pushVisualUnit?.(t);
    }
    else if(act.type==='apply_status'&&!t.status&&!t.statusBlocked){const st=state.catalog.statuses?.[safe(v)],f=st?.definition?.typeFilter||{mode:'all',types:[]},matched=(f.types||[]).some(x=>t.types.includes(x)),immune=f.mode==='exclude'&&matched||f.mode==='include'&&!matched;if(immune)state.log.push(`${battleLogName(t)} es inmune a ${st?.name||safe(v)}.`);else{t.status={id:safe(v),turns:Math.max(0,integer(rule.duration)),streakRuleKey:state.currentRuleKey||undefined};state.log.push(`${battleLogName(t)} recibe ${st?.name||t.status.id}.`);state.refreshStatus?.();state.refreshPassives?.();state.pushVisualUnit?.(t);rulesFor(null,'on_status_applied',t,user,state);}}
    else if(act.type==='remove_status'){if(t.status){const oldId=t.status.id,old=state.catalog.statuses?.[oldId]?.name||oldId;t.status=null;clearStatusLinkedEffects(t,oldId);state.log.push(`${battleLogName(t)} pierde ${old}.`);state.refreshStatus?.();state.refreshPassives?.();state.pushVisualUnit?.(t);}}
    else if(act.type==='suppress_abilities'){
      const duration=Math.max(1,integer(rule.duration));
      const meta=sourceMeta(state);
      // Múltiples supresiones de distinto origen pueden coexistir; reaplicar la misma renueva duración.
      const active=t.effects.find(e=>e.id==='suppressed'&&e.sourceKind===meta.sourceKind&&e.sourceId===meta.sourceId);
      if(active)active.turns=Math.max(active.turns||0,duration);
      else t.effects.push({id:'suppressed',turns:duration,streakRuleKey:state.currentRuleKey||undefined,...meta});
      t.consecutiveCounters={};state.log.push(`${battleLogName(t)}: habilidades anuladas.`);
      state.refreshEnvironment?.();state.pushVisualUnit?.(t);
    }
    else if(act.type==='remove_effect')t.effects=t.effects.filter(e=>e.id!==v);
    else if(act.type==='restrict_moves'){
      // Una restricción activa a la vez; las nuevas reemplazan a las anteriores.
      t.effects=t.effects.filter(e=>e.id!=='restrict_moves');
      t.effects.push({id:'restrict_moves',streakRuleKey:state.currentRuleKey||undefined,turns:Math.max(1,integer(rule.duration)),categories:Array.isArray(act.categories)?act.categories.filter(x=>['physical','special','status'].includes(x)):[],types:Array.isArray(act.types)?act.types.filter(x=>typeof x==='string'):[],...sourceMeta(state)});
      state.log.push(`${battleLogName(t)} tiene sus movimientos restringidos.`);
      state.pushVisualUnit?.(t);
    }
    else if(act.type==='modify_active_cooldowns'){for(const[mid,n]of Object.entries(t.cooldowns)){if(n<=0)continue;const next=Math.max(0,n+integer(v));t.cooldowns[mid]=next;const m=t.moves.find(x=>x.id===mid);state.log.push(`${battleLogName(t)}: cooldown activo de ${m?.name||mid} ${integer(v)>=0?'+':''}${integer(v)} → ${next}${sourceSuffix(state)}.`);}}
    else if(act.type==='cooldown_on_use'){t.effects.push({id:'cooldown_on_use',streakRuleKey:state.currentRuleKey||undefined,value:integer(v),turns:Math.max(1,integer(rule.duration)),...sourceMeta(state)});state.log.push(`${battleLogName(t)} modifica el cooldown de sus movimientos${sourceSuffix(state)}.`);}
    else if(act.type==='immunity')t.effects.push({id:'immunity',streakRuleKey:state.currentRuleKey||undefined,damageClass:act.damageClass||'all',filter:act.typeFilter||{mode:'all',types:[]},targetingFilter:Array.isArray(act.targetingFilter)?act.targetingFilter:[],turns:integer(rule.duration),permanent:integer(rule.duration)===0,...sourceMeta(state)});
    else if(act.type==='adjust_received_damage'){
      const source=sourceMeta(state),ruleKey=state.currentRuleKey||undefined;
      t.effects=t.effects.filter(e=>!(e.id==='adjust_received_damage'&&e.sourceKind===source.sourceKind&&e.sourceId===source.sourceId&&e.streakRuleKey===ruleKey));
      t.effects.push({id:'adjust_received_damage',value:Number(act.value),damageClass:act.damageClass||'all',filter:act.typeFilter||{mode:'all',types:[]},targetingFilter:Array.isArray(act.targetingFilter)?act.targetingFilter:[],turns:integer(rule.duration),permanent:integer(rule.duration)===0,persistOnSwitch:!!rule.persistOnSwitch,streakRuleKey:ruleKey,...source});
      state.pushVisualUnit?.(t);
    }
    else if(act.type==='switch_character'){
      const owner=switchTargetOwner(state,t),slot=state.active[owner].findIndex(i=>i===t.teamIndex),mode=act.switchMode==='manual'?'manual':'random';
      // A KO requires a KO replacement, not an additional switch effect.
      if(slot<0||t.hp<=0)continue;
      // No expulsar al reemplazo de un personaje que ya abandonó esta posición
      // durante la misma ronda por otro movimiento o por un cambio anterior.
      if(state.currentSourceKind==='objeto'&&state.changedSlotsThisRound?.has(`${owner}:${slot}`))continue;
      const eligible=state.teams[owner].map((a,i)=>({a,i})).filter(x=>x.a.hp>0&&!state.active[owner].includes(x.i));if(!eligible.length)continue;
      if(mode==='manual'){const chosen=state.currentSwitchChoice;
        if(chosen&&sideIndex(chosen.side??sideName(owner))===owner&&Number(chosen.slot)===slot&&eligible.some(x=>x.i===Number(chosen.teamIndex)))state.switchTo(owner,slot,Number(chosen.teamIndex),true,'Cambio por efecto');
        else if(state.autoResolveSwitchSides?.has(sideName(owner))){
          // Solo en Entrenamiento: la IA decide un relevo manual al activarse
          // la regla, no después de terminar los demás ataques de la ronda.
          const pick=eligible[Math.floor(state.random()*eligible.length)].i;
          state.switchTo(owner,slot,pick,true,'Cambio automático de IA');
        }
        else{if(!state.forcedSwitches.some(f=>f.side===sideName(owner)&&f.slot===slot)){state.forcedSwitches.push({side:sideName(owner),slot,reason:state.currentSourceName||'Efecto',targetTeamIndex:t.teamIndex});state.log.push(`${battleLogName(t)} debe cambiar de personaje.`);}}}
      else{const pick=eligible[Math.floor(state.random()*eligible.length)].i;state.switchTo(owner,slot,pick,true,'Cambio forzado');}
    }
  }
}
function rulesFor(entry,event,user,contextTarget,state){
  if(!user||(user.hp<=0&&event!=='on_death'))return;ensureActorRuntime(user);
  if(user.status){const statusId=user.status.id,st=state.catalog.statuses?.[statusId];for(const rule of st?.definition?.rules||[]){
    if(!user.status||user.status.id!==statusId)break;
    // Los modificadores continuos de estadísticas se calculan en refreshStatus,
    // nunca como acumulaciones permanentes al final de ronda.
    if(rule.event!==event||!receivedAttackFilterPasses(rule,state)||(event==='on_status'&&rule.action?.type==='stat_change')||!conditionsPass(rule,user,contextTarget,state)||!chance(rule,state))continue;
    const key='status:'+statusId+':'+(st.definition.rules.indexOf(rule));if(rule.limit>0&&(user.used[key]||0)>=rule.limit)continue;
    user.used[key]=(user.used[key]||0)+1;
    state.currentSourceName=st.name;state.currentSourceKind='estado';state.currentSourceId=st.id||statusId;state.currentSourceActor=user.name;state.currentSourceOwnerSide=user.side;state.currentSourceOwnerIndex=user.teamIndex;
    const previousEvent=state.currentRuleEvent;state.currentRuleEvent=event;action(rule,user,contextTarget,state,0);state.currentRuleEvent=previousEvent;state.currentSourceName='';state.currentSourceId='';state.currentSourceActor='';
  }}
  for(const ability of user.abilities||[]){
    if(user.effects.some(e=>e.id==='suppressed'))break;
    for(const[idx,rule]of(ability?.definition?.rules||[]).map((rule,idx)=>({idx,rule})).sort((a,b)=>event==='on_death'?Number(b.rule.action?.type==='resurrect')-Number(a.rule.action?.type==='resurrect'):0).map(({idx,rule})=>[idx,rule])){
      const key=ability.id+':'+idx;if(rule.event!==event||(rule.limit>0&&(user.used[key]||0)>=rule.limit))continue;
      if(!receivedAttackFilterPasses(rule,state)||!conditionsPass(rule,user,contextTarget,state)||(rule.action?.type!=='survive'&&!chance(rule,state)))continue;user.used[key]=(user.used[key]||0)+1;
      state.currentSourceName=ability.name||entry?.name||'Habilidad';state.currentSourceKind='habilidad';state.currentSourceId=ability.id;state.currentSourceActor=user.name;state.currentSourceOwnerSide=user.side;state.currentSourceOwnerIndex=user.teamIndex;const previousLogLength=state.log.length,abilityLabel=state.currentSourceName;const previousEvent=state.currentRuleEvent;state.currentRuleEvent=event;action(rule,user,contextTarget,state,0);state.currentRuleEvent=previousEvent;for(let i=previousLogLength;i<state.log.length;i++)if(!state.log[i].includes(' por '+abilityLabel+' de '))state.log[i]=state.log[i].replace(/\.$/,'')+' por '+abilityLabel+' de '+user.name+'.';state.currentSourceName='';state.currentSourceId='';
    }
  }
  // Los consumibles ya consumidos reaccionan a los eventos de combate desde el momento del consumo.
  // Sus efectos pueden ejecutarse posteriormente sin volver a consumirse.
  state.runArmedItems?.(event,user,contextTarget);
}
function runMoveRules(move,event,user,contextTarget,state,onlySwitch=false,chainPhase=null){
  for(const rule of move?.definition?.rules||[]){
    if(chainPhase&&event==='on_hit'){
      // Compatibilidad: los movimientos históricos conservan el modo anterior
      // hasta que cada regla sea modificada individualmente en el Editor.
      const timing=rule.chainTiming||(rule.action?.type==='switch_character'?'each':move.definition?.multihit?.effects)||'each';
      if(timing!==chainPhase)continue;
    }
    if((onlySwitch&&rule.action?.type!=='switch_character')||(!onlySwitch&&event==='manual'&&rule.action?.type==='switch_character'))continue;if(rule.event!==event||!conditionsPass(rule,user,contextTarget,state,move.id)||(rule.action?.type!=='survive'&&!chance(rule,state)))continue;state.currentSourceName=move.name;state.currentSourceKind='movimiento';state.currentSourceId=move.id;state.currentSourceActor=user.name;state.currentSourceOwnerSide=user.side;state.currentSourceOwnerIndex=user.teamIndex;const previousEvent=state.currentRuleEvent;state.currentRuleEvent=event;action(rule,user,contextTarget,state,0);state.currentRuleEvent=previousEvent;state.currentSourceName='';state.currentSourceId='';state.currentSourceKind='';}
}
function applyMoveCooldown(attacker,move,state){const d=move.definition;let cd=Math.max(0,integer(d.cooldown||0));for(const e of attacker.effects.filter(e=>e.id==='cooldown_on_use'&&!ownerSuppressed(e,state,attacker)))cd=Math.max(0,cd+integer(e.value));for(const e of attacker.environmentCooldownOnUse||[])if(chance(e,state))cd=Math.max(0,cd+integer(e.value));if(cd>0){attacker.cooldowns[move.id]=cd;attacker.cooldownSetRound[move.id]=state.round;const origins=attacker.effects.filter(e=>e.id==='cooldown_on_use'&&!ownerSuppressed(e,state,attacker)).map(e=>e.sourceName).filter(Boolean);state.log.push(`${battleLogName(attacker)} tiene ${cd} ${cd===1?'turno restante':'turnos restantes'} para poder volver a usar ${move.name}${origins.length?' (efecto: '+[...new Set(origins)].join(', ')+')':''}.`);}}
// The protection checks the actual targeting of the incoming move (Wide Guard style).
// Legacy immunities with no targetingFilter still protect against every targeting mode.
function damageImmunityMatches(effect,state,defender,attack){
  if(effect.id!=='immunity'||ownerSuppressed(effect,state,defender))return false;
  if(effect.damageClass!=='all'&&effect.damageClass!==attack.category)return false;
  const f=effect.filter||{mode:'all',types:[]};
  const typeMatches=f.mode==='all'||f.mode==='include'&&(f.types||[]).includes(attack.type)||f.mode==='exclude'&&!(f.types||[]).includes(attack.type);
  if(!typeMatches)return false;
  const targetings=effect.targetingFilter;
  return !Array.isArray(targetings)||targetings.length===0||targetings.includes(attack.targeting||'single');
}
// Ajustes de daño recibido: 100 % = neutral, 50 % = mitad, 150 % = +50 %.
// El filtro examina el ATAQUE recibido, nunca el tipo del defensor.
function receivedDamageFactor(defender,attack,state){
  const matching=e=>{
    if(e.id!=='adjust_received_damage'||ownerSuppressed(e,state,defender))return false;
    if(e.damageClass&&e.damageClass!=='all'&&e.damageClass!==attack.category)return false;
    const f=e.filter||{mode:'all',types:[]},types=f.types||[];
    if(f.mode==='include'&&!types.includes(attack.type))return false;
    if(f.mode==='exclude'&&types.includes(attack.type))return false;
    const targeting=attack.targeting==='target'?'single':attack.targeting;
    return !Array.isArray(e.targetingFilter)||!e.targetingFilter.length||e.targetingFilter.includes(targeting);
  };
  let factor=1;
  for(const e of [...(defender.effects||[]),...(defender.passiveReceivedDamageAdjust||[])]){
    if(matching(e))factor*=Math.max(0,Math.min(5,Number(e.value)/100));
  }
  return Math.max(0,Math.min(25,factor));
}
function relationBonus(moveType,defender,state){if(moveType==='neutral')return{bonus:0,immune:false};let bonus=0,immune=false;for(const t of defender.types){const rel=state.chart?.[moveType]?.[t]||'neutral';if(rel==='inmune')immune=true;else if(rel==='eficaz')bonus+=.3;else if(rel==='ineficaz')bonus-=.2;}return{bonus,immune};}
function resolvePosition(state,ref){if(!ref||!['left','right'].includes(ref.side)||!Number.isInteger(Number(ref.slot)))return null;const s=sideIndex(ref.side),slot=Number(ref.slot),idx=state.active[s]?.[slot];return idx===undefined?null:state.teams[s][idx]||null;}
function moveTargets(user,move,orderTarget,state){
  const kind=normalizeMoveTarget(move.definition),own=actorSide(user),partner=partnerOf(state,user),enemy=activeActors(state,1-own);
  if(kind==='self')return[user];if(kind==='ally')return partner?[partner]:[];if(kind==='ally_team')return activeActors(state,own);if(kind==='enemy_team')return enemy;if(kind==='all')return[...activeActors(state,own).filter(a=>a!==user),...enemy];if(kind==='all_active')return[...activeActors(state,own),...enemy];if(kind==='enemy_direct'||kind==='enemy_inverse')return targetSet(kind,user,null,state);
  // single: Singles auto-selecciona al oponente. Doubles conserva la posición elegida.
  if(state.mode==='singles')return enemy.slice(0,1);const selected=resolvePosition(state,orderTarget);return selected&&selected!==user&&selected.hp>0?[selected]:[];
}
function restrictedMove(effect,move){
  const categories=Array.isArray(effect.categories)?effect.categories:[];
  const types=Array.isArray(effect.types)?effect.types:[];
  // Legacy rules (no configured filters) continue to restrict all moves.
  if(!categories.length&&!types.length)return true;
  const definition=move?.definition||{};
  return categories.includes(definition.category)||types.includes(definition.type);
}
function executeMove(attacker,move,orderTarget,state,switchChoice=null){
  ensureActorRuntime(attacker);const d=move.definition;if(attacker.hp<=0||!state.active[actorSide(attacker)].includes(attacker.teamIndex)||state.invalidatedTurnActors?.has(attacker))return;
  if((attacker.cooldowns[move.id]||0)>0){state.log.push(`${battleLogName(attacker)} no puede usar ${move.name}: quedan ${attacker.cooldowns[move.id]} turnos de cooldown.`);return;}
  if([...(attacker.effects||[]),...(attacker.environmentMoveRestrictions||[])].some(e=>e.id==='restrict_moves'&&!ownerSuppressed(e,state,attacker)&&restrictedMove(e,move))){state.log.push(`${battleLogName(attacker)} no puede usar ${move.name}: movimiento restringido.`);return;}
  let targets=moveTargets(attacker,move,orderTarget,state),context=targets[0]||firstOpponent(state,attacker);state.damageBonus=0;
  const counter=attacker.consecutiveCounters.attack||0;state.currentAttackActor=attacker;state.attackModifiers={power:[],accuracy:[],critical:[],final:[]};const charge=attacker.effects.some(e=>e.id==='suppressed')?null:(attacker.abilities||[]).find(a=>a.definition?.consecutiveAttack)?.definition.consecutiveAttack;
  let successfulHit=false;state.currentSwitchChoice=switchChoice;
  state.forceMiss=false;state.preventAction=false;state.currentAttackMove=move;state.pendingSecondaryAttacks=[];
  const moveCounts=moveCounter(attacker,move.id);moveCounts.lastUsedRound=state.round;moveCounts.registeredHitThisUse=false;
  // El narrador anuncia el movimiento ANTES de cualquier efecto suyo o habilidad.
  state.log.push(`${battleLogName(attacker)} usó ${move.name}.`);
  state.visualEvents.push({logIndex:state.log.length-1,type:'move_targets',side:attacker.side,slot:state.active[actorSide(attacker)].findIndex(i=>i===attacker.teamIndex),targets:targets.map(t=>({side:t.side,slot:state.active[actorSide(t)].findIndex(i=>i===t.teamIndex)}))});
  // Solo anunciar afinidad cuando el golpe haya acertado.
  const announcedTypeImmunity=new Set();
  rulesFor(null,'on_attack',attacker,context,state);
  runMoveRules(move,'on_attack',attacker,context,state);
  if(state.preventAction){state.log.push(`${battleLogName(attacker)} no puede actuar.`);applyMoveCooldown(attacker,move,state);return;}
  // A switch at on_attack happens before the hit: never attack from the bench
  // or continue aiming at an enemy who just left the field.
  const own=actorSide(attacker),ownSlot=state.active[own].findIndex(i=>i===attacker.teamIndex);
  if(ownSlot<0||state.forcedSwitches.some(f=>sideIndex(f.side)===own&&Number(f.slot)===ownSlot))return;
  targets=moveTargets(attacker,move,orderTarget,state);context=targets[0]||firstOpponent(state,attacker);
  for(const key of ['weather','field','scenario']){const category={weather:'weathers',field:'fields',scenario:'scenarios'}[key],id=state[key],environment=state.catalog[category]?.[id];if(!environment)continue;
    for(const e of environment.definition.fieldEffects||[]){if(e.type!=='final_damage'||e.timing!=='continuous'||!matchesEnvironmentAttack(attacker,move,e)||!chance(e,state))continue;state.attackModifiers.final.push(e);}}
  if(attacker.status){const entry=state.catalog.statuses?.[attacker.status.id];for(const rule of entry?.definition?.rules||[]){if(rule.action?.type!=='final_damage'||rule.event!=='on_status'||!conditionsPass(rule,attacker,context,state)||!chance(rule,state))continue;const a=rule.action;state.attackModifiers.final.push({value:a.value,mode:a.mode||'percent',stacking:a.stacking||'additive',cap:a.cap??null});}}
  runMoveRules(move,'manual',attacker,context,state);if(state.mode==='doubles')runMoveRules(move,'manual_doubles',attacker,context,state);
  if(state.preventAction){state.log.push(`${battleLogName(attacker)} no puede actuar.`);applyMoveCooldown(attacker,move,state);return;}
  if(!targets.length){if(charge)attacker.consecutiveCounters.attack=0;state.log.push(`${battleLogName(attacker)} falló: no hay un objetivo válido.`);applyMoveCooldown(attacker,move,state);return;}
  // Una sola comprobación de precisión por objetivo/cadena; cada impacto calcula su propio crítico.
  const multi=d.multihit&&typeof d.multihit==='object'?d.multihit:null;
  const powerBonus=streakModifier(move,attacker);if(powerBonus){const power=Number(d.power)||0,improved=modifiedValue(power,[powerBonus],[0,5000]);if(improved!==power)state.log.push(`${move.name}: potencia ${power}${improved>power?'+':''}${integer(improved-power)}.`);}
  const minHits=multi?Math.max(1,Math.min(20,integer(multi.min??1))):1;
  const maxHits=multi?Math.max(minHits,Math.min(20,integer(multi.max??minHits))):1;
  let manualSwitchApplied=false;
  for(const defender of targets){
    if(!defender||defender.hp<=0||attacker.hp<=0)continue;ensureActorRuntime(defender);
    const evaded=!state.forceMiss&&d.accuracy!==null&&d.accuracy!==undefined&&Number(d.accuracy)!==0&&state.random()*100>=hitChance(Math.max(.00001,modifiedValue(Number(d.accuracy),state.attackModifiers.accuracy,[0,100])),attacker,defender);
    if(state.forceMiss||evaded){state.log.push(evaded?`${battleLogName(defender)} esquivó el ataque de ${battleLogName(attacker)}.`:`${battleLogName(attacker)} falló contra ${battleLogName(defender)}.`);runMoveRules(move,'on_miss',attacker,defender,state);rulesFor(null,'on_miss',attacker,defender,state);
      if(evaded&&!state.forceMiss){state.currentReceivedMove={type:d.type,category:d.category,moveId:move.id};rulesFor(null,'on_dodge',defender,attacker,state);state.currentReceivedMove=null;}continue;}
    // Cada defensor acertado tiene su propia afinidad. Si esquivó, jamás se anuncia
    // un bono de tipo ni una inmunidad que no llegó a comprobarse.
    if(d.category!=='status'&&Number(d.power)>0){
      const rel=relationBonus(d.type,defender,state);
      const suffix=targets.filter(t=>t?.hp>0).length>1?' contra '+battleLogName(defender):'';
      if(rel.immune){state.log.push(`${battleLogName(defender)} es inmune al ataque.`);announcedTypeImmunity.add(defender);}
      else{
        const n=rel.bonus>0?Math.max(1,Math.round(rel.bonus/.3)):rel.bonus<0?Math.max(1,Math.round(Math.abs(rel.bonus)/.2)):0;
        if(n){const intensity=n===1?'':n===2?'muy ':'extremadamente ';state.log.push(`Es ${intensity}${rel.bonus>0?'fuerte':'débil'}${suffix}.`);}
      }
    }
    // El cambio en «manual» se aplica tras acertar, no antes del daño.
    const hits=minHits===maxHits?minHits:minHits+Math.floor(state.random()*(maxHits-minHits+1));
    let chainDamage=0,landedHits=0;
    for(let hit=1;hit<=hits;hit++){
      if(defender.hp<=0||attacker.hp<=0||!state.active[actorSide(defender)].includes(defender.teamIndex)||!state.active[actorSide(attacker)].includes(attacker.teamIndex))break;
      // El índice de golpe acompaña exclusivamente al mensaje de daño.
      let damage=0;
      if(d.category!=='status'&&Number(d.power)>0){
        const effectImmune=[...(defender.effects||[]),...(defender.environmentDamageImmunity||[]),...(defender.passiveDamageImmunity||[])].some(e=>damageImmunityMatches(e,state,defender,{type:d.type,category:d.category,targeting:normalizeMoveTarget(d)}));
        const rel=relationBonus(d.type,defender,state);if(effectImmune||rel.immune){if(!announcedTypeImmunity.has(defender))state.log.push(`${battleLogName(defender)} es inmune al ataque.`);break;}
        const attack=effective(attacker,d.category==='special'?'specialAttack':'attack'),defense=effective(defender,d.category==='special'?'specialDefense':'defense'),raw=Math.max(1,Math.floor((2*50/5+2)*modifiedValue(Number(d.power),[...state.attackModifiers.power,...(streakModifier(move,attacker)?[streakModifier(move,attacker)]:[])],[0,5000])*attack/defense/50+2));
        let bonus=(attacker.types.includes(d.type)?.2:0)+rel.bonus;
        if(charge)bonus+=counter*Number(charge.damagePerStack??10)/100;
        if(state.random()*100<criticalChance(modifiedValue(Number(d.criticalChance??0),state.attackModifiers.critical,[0,100]),attacker)){bonus+=.5;state.log.push(`${battleLogName(attacker)} hizo un golpe crítico contra ${battleLogName(defender)}.`);}
        damage=Math.max(0,integer(Math.max(1,integer(modifiedValue(raw*(1+bonus+state.damageBonus),state.attackModifiers.final,[0,999999])))*receivedDamageFactor(defender,{type:d.type,category:d.category,targeting:normalizeMoveTarget(d)},state)));state.damageCauserSide=actorSide(attacker);const actualDamage=inflictDamage(defender,damage,state,'move');state.damageCauserSide=null;state.lastDamage={attackerSide:attacker.side,attackerTeamIndex:attacker.teamIndex,defenderSide:defender.side,defenderTeamIndex:defender.teamIndex,amount:actualDamage,moveId:move.id};chainDamage+=actualDamage;defender.lastHitType=d.type;state.log.push(multi?`${battleLogName(defender)} recibió ${damage} de daño (golpe ${hit}).`:`${battleLogName(defender)} recibe ${damage} de daño.`);state.pushVisualUnit?.(defender);
        successfulHit=true;attacker.consecutiveCounters.streakHits=(attacker.consecutiveCounters.streakHits||0)+1;
        moveCounts.streakHits=(moveCounts.streakHits||0)+1;
        if(!moveCounts.registeredHitThisUse){
          moveCounts.registeredHitThisUse=true;
          moveCounts.hit=(moveCounts.hit||0)+1;
          if(moveCounts.lastHitAnyTurn!==state.round){moveCounts.hitAnyTurn=(moveCounts.hitAnyTurn||0)+1;moveCounts.lastHitAnyTurn=state.round;}
        }
      }
      // Habilidades de acierto/daño y muertes se resuelven por impacto,
      // incluso si el efecto propio del movimiento se difiere al fin de la cadena.
      // De lo contrario, un multigolpe 'chain' pierde activaciones intermedias.
      landedHits++;
      runMoveRules(move,'on_hit',attacker,defender,state,false,multi?'each':null);
      rulesFor(null,'on_hit',attacker,defender,state);
      if(damage>0){state.currentReceivedMove={type:d.type,category:d.category,moveId:move.id};rulesFor(null,'on_damage_taken',defender,attacker,state);rulesFor(null,'on_receive_attack',defender,attacker,state);state.currentReceivedMove=null;}
      state.resolveDeaths();
      if(!manualSwitchApplied){manualSwitchApplied=true;runMoveRules(move,'manual',attacker,defender,state,true);}
    }
    if(multi&&landedHits>0){
      // La última acción `on_hit` por cadena usa el daño REAL agregado de
      // todos los impactos (incluidos impactos letales y Sobrevivir).
      state.lastDamage={attackerSide:attacker.side,attackerTeamIndex:attacker.teamIndex,defenderSide:defender.side,defenderTeamIndex:defender.teamIndex,amount:chainDamage,moveId:move.id};
      runMoveRules(move,'on_hit',attacker,defender,state,false,'chain');
      state.resolveDeaths();
    }
  }
  // Secondary hits scheduled from 'Al atacar' occur after the primary hit(s).
  // Each saved event retains its own rules, source and target, in original order.
  const pending=state.pendingSecondaryAttacks||[];state.pendingSecondaryAttacks=null;
  for(const queued of pending)if(queued.user.hp>0)performSecondaryAttack(queued.rule,queued.user,queued.contextTarget,state,queued.depth,queued.source);
  if(d.category!=='status'&&Number(d.power)>0){
    moveCounts.use=(moveCounts.use||0)+1;
    if(!successfulHit){moveCounts.hit=0;moveCounts.streakHits=0;}
    attacker.consecutiveCounters.use=(attacker.consecutiveCounters.use||0)+1;
    attacker.consecutiveCounters.hit=successfulHit?(attacker.consecutiveCounters.hit||0)+1:0;
    if(successfulHit&&attacker.consecutiveCounters.lastHitAnyTurn!==state.round){attacker.consecutiveCounters.hitAnyTurn=(attacker.consecutiveCounters.hitAnyTurn||0)+1;attacker.consecutiveCounters.lastHitAnyTurn=state.round;}
    if(!successfulHit)attacker.consecutiveCounters.streakHits=0;
    attacker.consecutiveCounters.lastAttackRound=state.round;
  }
  if(charge){
    if(successfulHit||(charge.conditionMode==='use'&&d.category!=='status'&&Number(d.power)>0)){attacker.consecutiveCounters.attack=counter+1;attacker.consecutiveCounters.lastAttackRound=state.round;const amount=integer(charge.speedStages??1);if(amount&&!blocksStage(attacker,'speed',amount,state)){const old=attacker.stages.speed||0;attacker.stages.speed=clamp(old+amount,-10,10);const delta=attacker.stages.speed-old;if(delta){attacker.statSources.push({stat:'speed',value:delta,sourceName:(attacker.abilities||[]).find(a=>a.definition?.consecutiveAttack)?.name||'Carga',sourceKind:'habilidad',sourceActor:attacker.name});state.log.push(statChangeText(attacker,'speed',delta));state.pushVisualUnit?.(attacker);}}state.log.push(`${battleLogName(attacker)} acumula Carga (${counter+1}).`);}
    else{attacker.consecutiveCounters.attack=0;state.log.push(`${battleLogName(attacker)} pierde su acumulación de Carga.`);}
  }
  state.refreshPassives?.();
  applyMoveCooldown(attacker,move,state);
}
function tick(a,state){ensureActorRuntime(a);
  const hadSuppression=a.effects.some(e=>e.id==='suppressed');
  const hadRestriction=a.effects.some(e=>e.id==='restrict_moves');
  for(const e of a.effects)if(e.turns>0)e.turns--;
  a.effects=a.effects.filter(e=>e.permanent||e.turns!==0);
  if(hadSuppression&&!a.effects.some(e=>e.id==='suppressed')){
    state?.log.push(`${battleLogName(a)} recupera sus habilidades.`);
    state?.refreshEnvironment?.();state?.pushVisualUnit?.(a);
  }
  if(hadRestriction&&!a.effects.some(e=>e.id==='restrict_moves')){
    state?.log.push(`${battleLogName(a)} puede volver a usar movimientos.`);
    state?.pushVisualUnit?.(a);
  }
  if(a.status?.turns>0&&--a.status.turns===0){const old=a.status.id;a.status=null;clearStatusLinkedEffects(a,old);state?.log.push(`${battleLogName(a)} deja de tener ${state?.catalog?.statuses?.[old]?.name||old}.`);state?.refreshStatus?.();state?.refreshPassives?.();state?.pushVisualUnit?.(a);}}

export function simulate({left,right,leftTeam,rightTeam,leftItems=[],rightItems=[],chart={},catalog,turns=10,randomTape=[],randomSource,weather='',field='',scenario='',leftMove='',rightMove='',leftOrders=[],rightOrders=[],leftReplacements=[],rightReplacements=[],mode='singles',resume=null,replacementsOnly=false,includeCheckpoint=false,autoResolveSwitchSides=[]}){
  mode=mode==='doubles'?'doubles':'singles';if(!Number.isInteger(turns)||turns<0||turns>300)throw Error('Rondas entre 0 y 300.');if(!Array.isArray(randomTape)||randomTape.length>30000||randomTape.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>=1))throw Error('Historial RNG inválido.');
  const tape=randomTape.slice();let cursor=resume&&tape.length>=resume.randomCursor?resume.randomCursor:0;const fresh=typeof randomSource==='function'?randomSource:()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;const random=()=>{if(cursor<tape.length)return tape[cursor++];const v=fresh();if(!Number.isFinite(v)||v<0||v>=1)throw Error('RNG inválido.');tape.push(v);cursor++;return v;};
  const load=(id,side,teamIndex)=>{const e=catalog.entities[id];if(!e)throw Error('Entidad no encontrada: '+id);const d=e.definition,moves=[...(d.moveIds||[]),d.uniqueMoveId].map(mid=>{const m=catalog.moves[mid];if(!m)throw Error('Ataque inexistente: '+mid);return m;}),abilities=[d.globalAbilityId,d.uniqueAbilityId].map(aid=>{const a=catalog.abilities[aid];if(!a)throw Error('Habilidad inexistente: '+aid);return a;});return actor(e,moves,abilities,side,teamIndex);};
  const parseTeam=(value,single,side)=>{const ids=value===undefined?[single]:value;if(!Array.isArray(ids)||ids.length<1||ids.length>8||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw Error('El equipo '+side+' debe tener entre 1 y 8 entidades diferentes.');if(mode==='doubles'&&ids.length<2)throw Error('Doubles requiere al menos dos entidades por equipo.');return ids;};
  const ids=[parseTeam(leftTeam,left,'izquierdo'),parseTeam(rightTeam,right,'derecho')];
  const validateItemIds=(value,label)=>{if(!Array.isArray(value)||value.length>3||new Set(value).size!==value.length||value.some(id=>typeof id!=='string'||!catalog.items?.[id]))throw Error('Consumibles inválidos del equipo '+label+'.');return [...value];};
  const itemLists=resume?.itemLists?structuredClone(resume.itemLists):[validateItemIds(leftItems,'izquierdo'),validateItemIds(rightItems,'derecho')];
  const usedItems=resume?.usedItems?structuredClone(resume.usedItems):[[],[]];
  if(resume&&(!Number.isInteger(resume.round)||resume.round<0||resume.round>turns||resume.mode!==mode))throw Error('Checkpoint del combate incompatible.');
  const teams=resume?structuredClone(resume.teams):ids.map((arr,s)=>arr.map((id,i)=>load(id,s,i)));
  if(teams.length!==2||teams.some((t,i)=>t.length!==ids[i].length||t.some((a,j)=>a.id!==ids[i][j])))throw Error('Equipo incompatible con checkpoint.');
  const active=resume?structuredClone(resume.active):(mode==='doubles'?[[0,1],[0,1]]:[[0],[0]]);
  const state={mode,chart,catalog,teams,active,itemLists,usedItems,activeConsumableRules:structuredClone(resume?.activeConsumableRules||[]),weather:resume?.weather||'',field:resume?.field||'',scenario:resume?.scenario||'',
    weatherTurns:resume?.weatherTurns||0,fieldTurns:resume?.fieldTurns||0,scenarioTurns:resume?.scenarioTurns||0,
    round:resume?.round||0,lastDamage:resume?.lastDamage||null,damageBonus:0,random,log:[],timeline:[],visualEvents:[],
    // La selección automática de la IA es exclusiva del simulador de práctica;
    // las salas online siguen solicitando los cambios manuales a los jugadores.
    autoResolveSwitchSides:new Set(Array.isArray(autoResolveSwitchSides)?autoResolveSwitchSides.filter(s=>s==='right'||s==='left'):[]),
    forcedSwitches:resume?.forcedSwitches||[],deathEvents:resume?.deathEvents||[],
    matchStats:resume?.matchStats||[{damageDealt:0,damageReceived:0,defeated:0},{damageDealt:0,damageReceived:0,defeated:0}],damageCauserSide:null};
  // Detectar KOs por transición de PS, sin volver a activar Al morir para el mismo KO.
  // Se procesa el grupo completo antes de comprobar victoria o reemplazos.
  const koSeen=new Set(resume?teams.flat().filter(a=>a.hp<=0):[]);let processingDeaths=false;
  const resolveDeaths=()=>{
    if(processingDeaths)return;
    processingDeaths=true;
    try{
      for(let iteration=0;iteration<64;iteration++){
        const newly=[];
        for(const side of [0,1])for(const a of teams[side]){
          if(a.hp>0){koSeen.delete(a);continue;}
          if(!koSeen.has(a)){koSeen.add(a);newly.push(a);}
        }
        if(!newly.length)break;
        // La prioridad mayor resuelve primero, después Velocidad; desempate por RNG.
        const queue=newly.map(a=>({a,priority:Math.max(0,...(a.abilities||[]).flatMap(ab=>(ab.definition?.rules||[]).filter(r=>r.event==='on_death').map(r=>Number(r.priority)||0))),speed:effective(a,'speed'),tie:random()}));
        queue.sort((x,y)=>y.priority-x.priority||y.speed-x.speed||x.tie-y.tie);
        for(const {a} of queue){
          // Resolver Al morir antes de confirmar el KO: una resurrección
          // inmediata conserva el slot y no crea un evento de derrota falso.
          rulesFor(null,'on_death',a,firstOpponent(state,a),state);
          if(a.hp>0){koSeen.delete(a);state.pushVisualUnit?.(a,'unit_state');}
          else {state.deathEvents.push({side:a.side,teamIndex:a.teamIndex,round:state.round});
            state.log.push(`${battleLogName(a)} queda fuera de combate.`);
             if(state.mode==='doubles'){const partner=partnerOf(state,a);if(partner?.hp>0)rulesFor(null,'on_ally_ko',partner,a,state);}
            const ld=state.lastDamage;
            if(ld&&ld.defenderSide===a.side&&ld.defenderTeamIndex===a.teamIndex){
              const killer=state.teams[sideIndex(ld.attackerSide)]?.[ld.attackerTeamIndex];
              if(killer&&killer.hp>0&&killer.side!==a.side){state.matchStats[actorSide(killer)].defeated++;state.currentDefeatActor=killer;
                try{rulesFor(null,'on_enemy_ko',killer,a,state);const finishingMove=killer.moves?.find(m=>m.id===ld.moveId);if(finishingMove)runMoveRules(finishingMove,'on_enemy_ko',killer,a,state);}finally{state.currentDefeatActor=null;}
              }
            }
          }
        }
        if(iteration===63)state.log.push('Protección contra bucles: se detuvo una cadena excesiva de eventos Al morir.');
      }
    }finally{processingDeaths=false;}
  };
  state.resolveDeaths=resolveDeaths;
  state.onSurvive=(target,source)=>{if(state._surviveDepth)return;state._surviveDepth=1;try{rulesFor(null,'on_survive',target,firstOpponent(state,target),state);const ownMove=target.moves?.find(m=>m.id===source?.id);if(ownMove)runMoveRules(ownMove,'on_survive',target,firstOpponent(state,target),state);}finally{state._surviveDepth=0;}};
  state.allActive=()=>[...activeActors(state,0),...activeActors(state,1)];
  const current=(s,slot=0)=>{const idx=active[s]?.[slot];return idx===undefined?null:teams[s][idx]||null;};state.current=(s,slot=0)=>current(s,slot);
  const syncMirrorTags=()=>{for(const t of teams)for(const a of t)a._mirror=false;for(const a of activeActors(state,0))for(const b of activeActors(state,1))if(a.id===b.id){a._mirror=true;b._mirror=true;}};syncMirrorTags();
  const remaining=s=>teams[s].some(a=>a.hp>0);
  const activeSlotOf=a=>active[actorSide(a)].findIndex(i=>i===a.teamIndex);
  const summary=p=>{ensureActorRuntime(p);const core=['attack','defense','specialAttack','specialDefense','speed'];return{id:p.id,name:p.name,side:p.side,teamIndex:p.teamIndex,activeSlot:activeSlotOf(p),hp:p.hp,maxHp:p.maxHp,baseStats:Object.fromEntries(core.map(k=>[k,p.stats[k]])),currentStats:Object.fromEntries(core.map(k=>[k,effective(p,k)])),stages:{...p.stages},environmentStages:{...p.environmentStages},statusStages:{...(p.statusStages||{})},passiveStages:{...(p.passiveStages||{})},statSources:[...(p.statSources||[]),...(p.passiveStatSources||[]),...(p.environmentStatSources||[]),...(p.statusStatSources||[])],environmentCrit:p.environmentCrit,status:p.status,effects:p.effects.map(e=>({...e})),types:p.types,consecutiveCounters:{...p.consecutiveCounters},moveStreaks:structuredClone(p.moveStreaks||{}),cooldowns:{...p.cooldowns}};};
  const activeSummary=s=>active[s].map((_,slot)=>current(s,slot)).filter(Boolean).map(summary);
  const snapshotRound=round=>state.timeline.push({round,left:summary(current(0,0)),right:summary(current(1,0)),leftActive:activeSummary(0),rightActive:activeSummary(1),weather:state.weather,field:state.field,scenario:state.scenario,teams:teams.map(t=>t.map(summary))});
  state.captureUnit=a=>summary(a);state.pushVisualUnit=(a,type='unit_state')=>state.visualEvents.push({logIndex:state.log.length-1,type,side:a.side,slot:activeSlotOf(a),unit:summary(a)});state.pushVisualEnvironment=(kind='')=>state.visualEvents.push({logIndex:state.log.length-1,type:'environment',kind,id:state[kind]||'',turns:state[kind+'Turns']||0,weather:state.weather,field:state.field,scenario:state.scenario,weatherTurns:state.weatherTurns,fieldTurns:state.fieldTurns,scenarioTurns:state.scenarioTurns});
  const enter=(s,slot)=>{const a=current(s,slot);if(!a||a.hp<=0)return;
    // Sobrevivir «por entrada» vuelve a estar disponible tras reingresar.
    for(const key of Object.keys(a.used||{}))if(key.startsWith('survive-entry:'))delete a.used[key];
    resetEntryAbilityUsage(a);rulesFor(null,'on_enter',a,firstOpponent(state,a),state);
  };
  const switchTo=(s,slot,index,forced=false,label='Cambio')=>{if(!Number.isInteger(index)||index<0||index>=teams[s].length||active[s].includes(index)||teams[s][index].hp<=0)throw Error('Cambio inválido en equipo '+(s===0?'izquierdo':'derecho')+'.');const leaving=current(s,slot);if(leaving){
    // El relevo anula todas las acciones todavía pendientes del personaje saliente.
    // Un personaje entrante nunca hereda su movimiento o consumible.
    state.invalidatedTurnActors?.add(leaving);
    state.changedSlotsThisRound?.add(`${s}:${slot}`);resetSwitchStages(leaving);for(const armed of state.armedItems||[])if(armed.actor===leaving){armed.disabledRules=armed.disabledRules||[];for(const [index,rule] of (armed.item?.definition?.rules||[]).entries())if(!rule.persistOnSwitch&&!armed.disabledRules.includes(index))armed.disabledRules.push(index);}leaving.effects=leaving.effects.filter(e=>e.sourceKind!=='objeto'||e.persistOnSwitch);if(leaving.status?.sourceKind==='objeto'&&!leaving.status.persistOnSwitch)leaving.status=null;}active[s][slot]=index;const entrant=current(s,slot);if(entrant)entrant.firstFullRound=Math.max(1,(state.round||0)+1);state.forcedSwitches=state.forcedSwitches.filter(f=>!(sideIndex(f.side)===s&&Number(f.slot)===slot));syncMirrorTags();state.log.push(`${forced?label+': ':label+': '}${battleLogName(current(s,slot))} entra al campo.`);state.pushVisualUnit(current(s,slot),'switch');enter(s,slot);state.refreshEnvironment?.();state.pushVisualUnit(current(s,slot));};state.switchTo=switchTo;
  const parseAction=o=>{if(o===undefined||o===null||o==='')return null;if(typeof o==='string')return{move:o};if(typeof o!=='object'||Array.isArray(o))throw Error('Acción inválida.');if(o.switch!==undefined)return{switch:Number(o.switch)};if(o.move!==undefined)return{move:o.move,target:o.target||null,item:o.item||null,switchChoice:o.switchChoice||null};return null;};
  const parseSideOrder=(orders,round,defaultMove)=>{const raw=orders[round-1];if(mode==='singles'){const action=raw&&Array.isArray(raw.actions)?raw.actions.find(a=>Number(a.slot??0)===0):raw;const one=parseAction(action);return[one||{move:defaultMove||''}];}if(raw&&Array.isArray(raw.actions)){return[0,1].map(slot=>parseAction(raw.actions.find(a=>Number(a.slot)===slot))||null);}if(Array.isArray(raw))return[0,1].map(i=>parseAction(raw[i]));return[null,null];};
  const chooseMove=(a,opponent,requested)=>{if(requested){const m=a.moves.find(m=>m.id===requested);if(!m)throw Error('El ataque '+requested+' no pertenece a '+a.name+'.');return m;}const available=a.moves.filter(m=>(a.cooldowns[m.id]||0)<=0);if(!available.length)throw Error(a.name+' no tiene movimientos disponibles por cooldown.');const useful=available.filter(m=>m.definition.category==='status'||Number(m.definition.power)<=0||!opponent?.types?.some(t=>state.chart?.[m.definition.type]?.[t]==='inmune'));const pool=useful.length?useful:available;return pool[Math.floor(random()*pool.length)];};
  if(!resume){
    for(const s of[0,1])for(let slot=0;slot<active[s].length;slot++)enter(s,slot);
    for(const[key,id,kind]of[['weather',weather,'weathers'],['field',field,'fields'],['scenario',scenario,'scenarios']])if(id){if(!catalog[kind]?.[id])throw Error('Entorno no encontrado: '+kind+'/'+id);state[key]=id;state[key+'Turns']=5;state.log.push('Entorno inicial: '+catalog[kind][id].name+' (5 rondas).');}
    snapshotRound(0);
  }
  const envKinds=[['weather','weathers'],['field','fields'],['scenario','scenarios']],matches=(a,e)=>e.filter==='all'||(e.filter==='include'?e.types.some(t=>a.types.includes(t)):!e.types.some(t=>a.types.includes(t))),immune=(a,kind)=>a.effects.some(e=>e.id==='environment_immunity'&&(e.kind==='all'||e.kind===kind)&&!ownerSuppressed(e,state,a));
  // Pasivas puras: calcular desde cero en cada cambio de PS, entrada o supresión.
  // Nunca se acumulan de manera permanente en stages; quitar condición quita el bono.
  const refreshPassives=()=>{
    if(state._refreshingPassives)return;
    state._refreshingPassives=true;
    try{
      for(const a of state.allActive()){
        const before=a.passiveStages||{},previousBlocked=!!a.passiveStatusBlocked;
        const stages={},immunities=[],passiveSources=[],receivedAdjust=[];let block=false,effectImmune=false;
        const statBlocks=[];
        for(const owner of state.allActive())if(!owner.effects.some(e=>e.id==='suppressed')){
          for(const ability of owner.abilities||[])for(const rule of ability?.definition?.rules||[]){
            if(rule.event!=='on_condition'||rule.action?.type!=='block_stat_changes'||!conditionsPass(rule,owner,firstOpponent(state,owner),state))continue;
            if(targetSet(rule.target||'self',owner,firstOpponent(state,owner),state).includes(a))statBlocks.push({...rule.action});
          }
        }
        a.passiveStatBlocks=statBlocks;
        for(const owner of state.allActive()){
          for(const ability of owner.abilities||[])for(const [ruleIndex,rule] of (ability?.definition?.rules||[]).entries()){
            if(rule.event!=='on_condition')continue;
            const key=`passive:${ability.id}:${ruleIndex}`;
            const active=!owner.effects.some(e=>e.id==='suppressed')&&conditionsPass(rule,owner,firstOpponent(state,owner),state);
            const wasActive=!!owner.used[key];
            if(!active){
              owner.used[key]=0;
              for(const recipient of state.allActive()){
                recipient.effects=recipient.effects.filter(e=>e.streakRuleKey!==key+'@'+owner.side+':'+owner.teamIndex);
                if(recipient.status?.streakRuleKey===key+'@'+owner.side+':'+owner.teamIndex){const oldStatus=recipient.status.id;recipient.status=null;clearStatusLinkedEffects(recipient,oldStatus);state.pushVisualUnit?.(recipient);state.refreshStatus?.();}
              }
              continue;
            }
            const recurring=rule.streakEffectMode==='per_turn';
            const lastTick=Number(owner.used[key]||0);
            owner.used[key]=recurring?state.round||1:1;
            const act=rule.action||{};
            if(!['stat_change','block_status','immunity','effect_immunity','block_stat_changes','adjust_received_damage'].includes(act.type)){
              if((!wasActive||recurring&&lastTick!==(state.round||1))&&a===owner){
                state.currentRuleKey=key+'@'+owner.side+':'+owner.teamIndex;
                state.currentSourceName=ability.name||'Habilidad';state.currentSourceKind='habilidad';state.currentSourceId=ability.id;state.currentSourceActor=owner.name;state.currentSourceOwnerSide=owner.side;state.currentSourceOwnerIndex=owner.teamIndex;
                action(rule,owner,firstOpponent(state,owner),state,0);
                state.currentSourceName='';state.currentSourceKind='';state.currentSourceId='';state.currentSourceActor='';state.currentRuleKey='';
              }
              continue;
            }
            const targets=targetSet(rule.target||'self',owner,firstOpponent(state,owner),state);
            if(!targets.includes(a))continue;
            if(act.type==='stat_change'&&STAT_NAMES[act.stat]){
              const parts=String(rule.condition?.value||'').split(':');
              const counter=owner.consecutiveCounters?.[parts[0]]||0;
              const levels=rule.condition?.type==='streak_count'&&rule.streakEffectMode==='per_turn'?Math.max(1,counter-Math.max(0,Number(parts[1])||0)+1):1;
              const val=Math.max(-10,Math.min(10,integer(act.value)*levels));
              if(blocksStage(a,act.stat,val,state,statBlocks))continue;
              stages[act.stat]=(stages[act.stat]||0)+val;
              passiveSources.push({stat:act.stat,value:val,sourceKind:'habilidad',sourceName:ability.name||ability.id,sourceActor:owner.name});}
            if(act.type==='block_status')block=true;if(act.type==='effect_immunity')effectImmune=true;
            if(act.type==='immunity')immunities.push({id:'immunity',damageClass:act.damageClass||'all',filter:act.typeFilter||{mode:'all',types:[]},targetingFilter:Array.isArray(act.targetingFilter)?act.targetingFilter:[]});
            if(act.type==='adjust_received_damage')receivedAdjust.push({id:'adjust_received_damage',value:Number(act.value),damageClass:act.damageClass||'all',filter:act.typeFilter||{mode:'all',types:[]},targetingFilter:Array.isArray(act.targetingFilter)?act.targetingFilter:[]});
          }
          // Los estados admiten las mismas condiciones pasivas. Los ajustes de
          // estadísticas se evalúan separadamente en refreshStatus.
          const statusId=owner.status?.id, statusEntry=statusId&&state.catalog.statuses?.[statusId];
          if(statusEntry)for(const [idx,rule] of (statusEntry.definition?.rules||[]).entries()){
            if(rule.event!=='on_condition')continue;
            const key=`statuspassive:${statusId}:${idx}`;
            const active=conditionsPass(rule,owner,firstOpponent(state,owner),state);
            const beforeActive=!!owner.used[key];owner.used[key]=active?1:0;
            if(!active)continue;
            const act=rule.action||{};
            if(act.type==='stat_change')continue;
            if(!['block_status','immunity','adjust_received_damage'].includes(act.type)){
              if(!beforeActive&&a===owner){
                state.currentSourceName=statusEntry.name||'Estado';state.currentSourceKind='estado';state.currentSourceId=statusId;state.currentSourceActor=owner.name;state.currentSourceOwnerSide=owner.side;state.currentSourceOwnerIndex=owner.teamIndex;
                action(rule,owner,firstOpponent(state,owner),state,0);
                state.currentSourceName='';state.currentSourceKind='';state.currentSourceId='';state.currentSourceActor='';
              }
              continue;
            }
            if(!targetSet(rule.target||'self',owner,firstOpponent(state,owner),state).includes(a))continue;
            if(act.type==='block_status')block=true;if(act.type==='effect_immunity')effectImmune=true;
            if(act.type==='immunity')immunities.push({id:'immunity',damageClass:act.damageClass||'all',filter:act.typeFilter||{mode:'all',types:[]},targetingFilter:Array.isArray(act.targetingFilter)?act.targetingFilter:[]});
            if(act.type==='adjust_received_damage')receivedAdjust.push({id:'adjust_received_damage',value:Number(act.value),damageClass:act.damageClass||'all',filter:act.typeFilter||{mode:'all',types:[]},targetingFilter:Array.isArray(act.targetingFilter)?act.targetingFilter:[]});
          }
        }
        a.passiveStages=stages;a.passiveStatSources=passiveSources;a.passiveStatusBlocked=block;a.passiveEffectImmunity=effectImmune;a.passiveDamageImmunity=immunities;a.passiveReceivedDamageAdjust=receivedAdjust;
        a.statusBlocked=!!a.environmentStatusBlocked||block;
        if(block&&a.status){const old=a.status.id;a.status=null;clearStatusLinkedEffects(a,old);state.refreshStatus?.();}
        for(const stat of new Set([...Object.keys(before),...Object.keys(stages)])){
          const difference=(stages[stat]||0)-(before[stat]||0);
          if(difference){const origin=passiveSources.filter(x=>x.stat===stat).map(x=>x.sourceName+' de '+x.sourceActor).join(', ');state.log.push(statChangeText(a,stat,difference).replace(/\.$/,'')+(origin?' por '+origin:'')+'.');state.pushVisualUnit?.(a);}
        }
        if(previousBlocked!==block)state.pushVisualUnit?.(a);
      }
    }finally{state._refreshingPassives=false;}
  };
  state.refreshPassives=refreshPassives;
  const refreshEnvironment=()=>{const before=new Map();for(const a of state.allActive()){ensureActorRuntime(a);before.set(a,JSON.stringify({environmentStages:a.environmentStages||{},environmentCrit:a.environmentCrit||0,statusBlocked:!!a.statusBlocked,status:a.status?{id:a.status.id,turns:a.status.turns}:null}));a.environmentStages={};a.environmentStatSources=[];a.environmentCrit=0;a.environmentCooldownOnUse=[];a.environmentDamageImmunity=[];a.environmentMoveRestrictions=[];a.statusBlocked=false;a.environmentStatusBlocked=false;}for(const[key,kind]of envKinds){const id=state[key],entry=state.catalog[kind]?.[id];if(!id||!entry)continue;for(const e of entry.definition.fieldEffects||[]){if(e.timing!=='continuous')continue;for(const a of state.allActive()){if(a.hp<=0||immune(a,kind)||!matches(a,e)||!chance(e,state))continue;if(e.type==='stat_change'){if(blocksStage(a,e.stat,Number(e.value)||0,state))continue;a.environmentStages[e.stat]=(a.environmentStages[e.stat]||0)+e.value;a.environmentStatSources.push({stat:e.stat,value:Number(e.value)||0,sourceKind:kind,sourceName:entry.name,sourceActor:'entorno'});}else if(e.type==='critical_change'){if(blocksStage(a,'criticalChance',Number(e.value)||0,state))continue;a.environmentCrit+=e.value;a.environmentStatSources.push({stat:'criticalChance',value:Number(e.value)||0,sourceKind:kind,sourceName:entry.name,sourceActor:'entorno'});}else if(e.type==='remove_status'&&a.status){const old=a.status.id;a.status=null;clearStatusLinkedEffects(a,old);state.refreshStatus?.();}else if(e.type==='block_status'){if(a.status){const old=a.status.id;a.status=null;clearStatusLinkedEffects(a,old);}a.statusBlocked=true;a.environmentStatusBlocked=true;state.refreshStatus?.();}else if(e.type==='cooldown_on_use')a.environmentCooldownOnUse.push(e);else if(e.type==='restrict_moves')a.environmentMoveRestrictions.push({id:'restrict_moves',categories:e.categories||[],types:e.moveTypes||[]});else if(e.type==='immunity')a.environmentDamageImmunity.push({id:'immunity',damageClass:e.damageClass||'all',filter:e.immunityTypeFilter||{mode:'all',types:[]},targetingFilter:Array.isArray(e.targetingFilter)?e.targetingFilter:[],sourceKind:kind,sourceName:entry.name});}}}refreshPassives();for(const a of state.allActive()){const after=JSON.stringify({environmentStages:a.environmentStages||{},environmentCrit:a.environmentCrit||0,statusBlocked:!!a.statusBlocked,status:a.status?{id:a.status.id,turns:a.status.turns}:null});if(before.get(a)!==after)state.pushVisualUnit?.(a);}};state.refreshEnvironment=refreshEnvironment;
  const applyEnv=(a,e,entry,kind)=>{if(a.hp<=0||immune(a,kind)||!matches(a,e)||!chance(e,state))return;if(e.type==='damage_percent'){const amount=e.value===0?0:Math.max(1,integer(a.maxHp*e.value/100));if(amount>0){inflictDamage(a,amount,state,'environment');state.log.push(entry.name+': '+battleLogName(a)+' pierde '+amount+' PS ('+e.value+' %).');state.pushVisualUnit?.(a);}}else if(e.type==='heal_percent'){const before=a.hp,amount=integer(a.maxHp*e.value/100);a.hp=Math.min(a.maxHp,a.hp+amount);const actual=a.hp-before;if(actual>0){state.log.push(entry.name+': '+battleLogName(a)+' recupera '+actual+' PS ('+e.value+' %).');state.pushVisualUnit?.(a);}}else if(e.type==='cooldown_change'){for(const[mid,n]of Object.entries(a.cooldowns)){if(n<=0)continue;const next=Math.max(0,n+integer(e.value));a.cooldowns[mid]=next;const m=a.moves.find(x=>x.id===mid);state.log.push(entry.name+': cooldown activo de '+(m?.name||mid)+' en '+battleLogName(a)+' '+(e.value>=0?'+':'')+e.value+' → '+next+'.');}}else if(e.type==='remove_status'&&a.status){const oldId=a.status.id,old=state.catalog.statuses?.[oldId]?.name||oldId;a.status=null;clearStatusLinkedEffects(a,oldId);state.refreshStatus?.();state.log.push(entry.name+': '+battleLogName(a)+' pierde '+old+'.');state.pushVisualUnit?.(a);}else if(e.type==='block_status'){if(a.status){const oldId=a.status.id,old=state.catalog.statuses?.[oldId]?.name||oldId;a.status=null;clearStatusLinkedEffects(a,oldId);state.refreshStatus?.();state.log.push(entry.name+': '+battleLogName(a)+' pierde '+old+'.');state.pushVisualUnit?.(a);}a.statusBlocked=true;}else if(e.type==='stat_change'){if(blocksStage(a,e.stat,Number(e.value)||0,state))return;const stat=e.stat,before=a.stages[stat]||0,next=clamp(before+integer(e.value),-10,10),delta=next-before;a.stages[stat]=next;if(delta){a.statSources.push({stat,value:delta,sourceName:entry.name,sourceKind:kind,sourceActor:'entorno'});state.log.push(statChangeText(a,stat,delta));state.pushVisualUnit(a);}}else if(e.type==='critical_change'){if(blocksStage(a,'criticalChance',Number(e.value)||0,state))return;const stat='criticalChance',before=a.stages[stat]||0,next=clamp(before+integer(e.value),-10,10),delta=next-before;a.stages[stat]=next;if(delta){a.statSources.push({stat,value:delta,sourceName:entry.name,sourceKind:kind,sourceActor:'entorno'});state.log.push(statChangeText(a,stat,delta));state.pushVisualUnit(a);}}};
  const environmentTimed=timing=>{for(const[key,kind]of envKinds){const id=state[key],entry=state.catalog[kind]?.[id];if(!id||!entry)continue;for(const e of entry.definition.fieldEffects||[]){if(e.timing!==timing)continue;for(const a of state.allActive())applyEnv(a,e,entry,kind);}}};
  const refreshStatus=()=>{for(const t of teams)for(const a of t){const before=JSON.stringify(a.statusStages||{});a.statusStages={};a.statusStatSources=[];if(a.status){const st=state.catalog.statuses?.[a.status.id];for(const r of st?.definition?.rules||[]){if(!['on_status','on_condition'].includes(r.event)||r.action?.type!=='stat_change'||!conditionsPass(r,a,firstOpponent(state,a),state))continue;const stat=r.action.stat,val=integer(r.action.value);if(blocksStage(a,stat,val,state))continue;a.statusStages[stat]=(a.statusStages[stat]||0)+val;a.statusStatSources.push({stat,value:val,sourceKind:'estado',sourceName:st?.name||a.status.id,sourceActor:a.name});}}if(before!==JSON.stringify(a.statusStages||{}))state.pushVisualUnit?.(a);}};state.refreshStatus=refreshStatus;refreshStatus();refreshEnvironment();
  const replacementHistory=[leftReplacements,rightReplacements];
  const requiredSlots=s=>{if(!remaining(s))return [];const koSlots=active[s].map((idx,slot)=>({slot,a:teams[s][idx]})).filter(x=>!x.a||x.a.hp<=0).map(x=>x.slot);const forced=state.forcedSwitches.filter(f=>sideIndex(f.side)===s&&active[s][Number(f.slot)]===f.targetTeamIndex).map(f=>Number(f.slot));return [...new Set([...koSlots,...forced])].sort((a,b)=>a-b);};
  const applyReplacementForRound=(s,round)=>{const required=requiredSlots(s);if(!required.length)return;const raw=replacementHistory[s]?.[round-1],choices=Array.isArray(raw)?raw:raw?.choices;if(!Array.isArray(choices))return;for(const slot of required){const c=choices.find(x=>Number(x.slot)===slot);if(!c)continue;switchTo(s,slot,Number(c.teamIndex),true,'Relevo');}};
  let played=resume?.round||0;
  if(resume&&replacementsOnly){
    if(turns!==played)throw Error('Un reemplazo no debe avanzar la ronda.');
    applyReplacementForRound(0,played);applyReplacementForRound(1,played);
    syncMirrorTags();refreshEnvironment();snapshotRound(played);
  }
  for(let round=played+1;!replacementsOnly&&round<=turns&&remaining(0)&&remaining(1);round++){
    played=round;state.round=round;state.extraAttacksThisRound=0;
    state.invalidatedTurnActors=new Set();state.changedSlotsThisRound=new Set();syncMirrorTags();state.log.push('— Ronda '+round+' —');
    const orders=[parseSideOrder(leftOrders,round,leftMove),parseSideOrder(rightOrders,round,rightMove)];
    // Las condiciones «va a cambiar» únicamente inspeccionan cambios voluntarios ya elegidos.
    state.plannedSwitches=new Set();
    for(const side of [0,1])for(let slot=0;slot<active[side].length;slot++){
      const a=current(side,slot);if(a?.hp>0&&orders[side][slot]?.switch!==undefined)state.plannedSwitches.add(a);
    }
    // Restaurar disparadores de consumibles consumidos en rondas previas (checkpoint y continuación online).
    state.armedItems=(state.activeConsumableRules||[]).map(record=>({
      ...record,actor:teams[record.s]?.[record.teamIndex],item:catalog.items?.[record.id],activated:true
    })).filter(record=>record.actor&&record.item);
    const eligibleConsumable=(a,entry)=>a&&a.hp>0&&state.active[entry.s]?.includes(a.teamIndex)
      &&!state.forcedSwitches.some(f=>sideIndex(f.side)===entry.s&&f.targetTeamIndex===a.teamIndex)
      &&!a.effects.some(e=>e.id==='block_items'&&!ownerSuppressed(e,state,a))
      &&!state.usedItems[entry.s].includes(entry.id);
    const runItemRules=(armed,event,contextTarget)=>{
      const {s,actor:a,id,item}=armed;
      // Un consumible consumido no reactiva reglas después de que el personaje abandone el campo,
      // salvo persistencia explícita de esa regla.
      if(a.hp<=0&&event!=='on_death')return;
      const inField=state.active[s].includes(a.teamIndex);
      if(!inField&&!armed.activated)return;
      const context=contextTarget||firstOpponent(state,a);
      for(const [index,rule] of (item.definition?.rules||[]).entries()){
        if(rule.event!==event||armed.disabledRules?.includes(index))continue;
        if(!inField&&!rule.persistOnSwitch)continue;
        if(!armed.activated)continue;
        if(!receivedAttackFilterPasses(rule,state)||!conditionsPass(rule,a,context,state))continue;
        if(rule.action?.type==='swap_positions'&&state.mode!=='doubles')continue;
        if(rule.action?.type==='switch_character'){
          const receivers=targetSet(rule.target||'self',a,context,state).filter(t=>t?.hp>0 && !state.changedSlotsThisRound?.has(`${actorSide(t)}:${state.active[actorSide(t)].indexOf(t.teamIndex)}`));
          if(!receivers.some(t=>{const owner=actorSide(t);return state.teams[owner].some((ally,i)=>ally.hp>0&&!state.active[owner].includes(i));}))continue;
        }
        const times=armed.triggerCounts[index]||0;
        // Los momentos reactivos están ligados al consumo, no son nuevos consumos.
        // Una regla de final de turno con duración 3 se activa tres veces, comenzando
        // en el mismo turno de consumo (si ese momento todavía no pasó).
        const timed=['turn_end','round_end','turn_start','on_status'].includes(event);
        if(!timed&&!['manual','manual_doubles'].includes(event)&&Number(rule.duration)>0&&round>=armed.activatedRound+Number(rule.duration))continue;
        const maxTriggers=rule.action?.type==='heal_over_time'?1:timed?Math.max(1,Number(rule.duration)||1):Math.max(1,Number(rule.limit)||1);
        if(times>=maxTriggers||(Number(rule.limit)>0&&times>=Number(rule.limit)))continue;
        if(armed.preApproved&&['manual','manual_doubles'].includes(event)){if(!armed.preApproved.has(index))continue;}
        else if(!chance(rule,state))continue;
        armed.triggerCounts[index]=times+1;
        const old={name:state.currentSourceName,kind:state.currentSourceKind,id:state.currentSourceId,actor:state.currentSourceActor,side:state.currentSourceOwnerSide,index:state.currentSourceOwnerIndex,persist:state.currentItemPersistOnSwitch,event:state.currentRuleEvent};
        state.currentSourceKind='objeto';state.currentSourceId=id;state.currentSourceName=item.name;state.currentSourceActor=a.name;state.currentSourceOwnerSide=a.side;state.currentSourceOwnerIndex=a.teamIndex;
        state.currentItemPersistOnSwitch=!!rule.persistOnSwitch;state.currentRuleEvent=event;
        try{action(rule,a,context,state,0);}finally{
          state.currentSourceName=old.name;state.currentSourceKind=old.kind;state.currentSourceId=old.id;state.currentSourceActor=old.actor;state.currentSourceOwnerSide=old.side;state.currentSourceOwnerIndex=old.index;state.currentItemPersistOnSwitch=old.persist;state.currentRuleEvent=old.event;
        }
      }
    };
    state.runArmedItems=(event,user,context)=>{
      if(state._runningArmedItems)return;
      state._runningArmedItems=true;
      try{for(const armed of state.armedItems)if(armed.actor===user){runItemRules(armed,event,context);if(event!=='on_condition')runItemRules(armed,'on_condition',context);}}finally{state._runningArmedItems=false;}
    };
    const executeItem=entry=>{
      const {s,actor:a,id}=entry;
      if(!eligibleConsumable(a,entry))return;
      const item=catalog.items?.[id];if(!item)return;
      if(state.armedItems.some(x=>x.s===s&&x.id===id))return;
      const context=firstOpponent(state,a),approved=new Set();
      let hasLaterRules=false;
      for(const [index,rule] of (item.definition?.rules||[]).entries()){
        if(!['manual','manual_doubles'].includes(rule.event)){
          hasLaterRules=true;continue;
        }
        if(rule.event==='manual_doubles'&&mode!=='doubles')continue;
        if(!conditionsPass(rule,a,context,state))continue;
        if(rule.action?.type==='swap_positions'){
          if(mode!=='doubles')continue;
          const side=rule.target==='enemy_team'?1-s: s;
          if(state.active[side]?.length!==2||state.active[side].some(i=>state.teams[side][i]?.hp<=0))continue;
        }
        if(rule.action?.type==='switch_character'){
          const receivers=targetSet(rule.target||'self',a,context,state).filter(x=>x?.hp>0 && !state.changedSlotsThisRound?.has(`${actorSide(x)}:${state.active[actorSide(x)].indexOf(x.teamIndex)}`));
          if(!receivers.some(t=>state.teams[actorSide(t)].some((ally,i)=>ally.hp>0&&!state.active[actorSide(t)].includes(i))))continue;
        }
        if(chance(rule,state))approved.add(index);
      }
      // Si no existe ninguna activación posible, el consumible queda disponible.
      // Las reglas reactivas sí permiten consumirlo aunque su evento suceda después.
      if(!approved.size&&!hasLaterRules)return;
      // El momento de consumo es independiente del momento de los efectos. El objeto
      // se gasta, se narra y se anima AQUÍ; después empiezan a existir sus reglas.
      state.usedItems[s].push(id);
      state.log.push(`${battleLogName(a)} consumió ${item.name}.`);
      state.visualEvents.push({logIndex:state.log.length-1,type:'item_use',side:a.side,slot:state.active[s].indexOf(a.teamIndex),itemId:id,spriteId:item.definition?.spriteId||'',itemName:item.name,attackerName:battleLogName(a)});
      const armed={s,teamIndex:a.teamIndex,actor:a,id,item,activated:true,activatedRound:round,triggerCounts:{},preApproved:approved};
      state.armedItems.push(armed);
      if(item.definition?.timing==='start')runItemRules(armed,'turn_start',firstOpponent(state,a));
      runItemRules(armed,'manual',firstOpponent(state,a));
      if(mode==='doubles')runItemRules(armed,'manual_doubles',firstOpponent(state,a));
      // «Al usar»/«Inicio» son momentos posteriores al consumo que pueden ser inmediatos.
      runItemRules(armed,'on_condition',firstOpponent(state,a));
      delete armed.preApproved;state.resolveDeaths();
    };
    refreshEnvironment();environmentTimed('turn_start');
    for(const a of state.allActive())if(a.hp>0){rulesFor(null,'turn_start',a,firstOpponent(state,a),state);}
    const actions=[],lastItems=[],endItems=[],startItems=[];
    for(const side of [0,1])for(let slot=0;slot<active[side].length;slot++){
      const a=current(side,slot),o=orders[side][slot];if(!a||a.hp<=0)continue;
      if(o?.switch!==undefined){actions.push({kind:'switch',s:side,slot,actor:a,index:Number(o.switch)});continue;}
      const opp=firstOpponent(state,a),move=chooseMove(a,opp,o?.move);
      actions.push({kind:'move',s:side,slot,actor:a,move,target:o?.target||null,switchChoice:o?.switchChoice||null,priority:Number(move.definition.priority)||0});
      if(o?.item&&itemLists[side].includes(o.item)&&!usedItems[side].includes(o.item)){
        const def=catalog.items[o.item]?.definition||{},entry={kind:'item',s:side,slot,actor:a,id:o.item,priority:Number(def.priority)||0};
        if(def.timing==='last')lastItems.push(entry);
        else if(def.timing==='end')endItems.push(entry);
        else if(def.timing==='start'||(def.rules||[]).some(r=>['move_first','move_last'].includes(r.action?.type)&&['manual','manual_doubles','on_condition'].includes(r.event)))startItems.push(entry);
        else actions.push(entry);
      }
    }
    // Los consumos al inicio se ordenan por prioridad y Velocidad entre sí.
    startItems.sort((x,y)=>(y.priority||0)-(x.priority||0)||effective(y.actor,'speed')-effective(x.actor,'speed')||(random()<.5?-1:1));
    for(const entry of startItems)executeItem(entry);
    // Orden total: Moverse primero, cambios manuales, consumibles, movimientos
    // ordinarios, moverse último. En un mismo grupo se desempata con prioridad
    // y Velocidad (incluidas dos entidades que utilizan Moverse primero).
    const orderTier=entry=>{
      if(entry.kind==='switch')return 1;
      if(entry.kind==='item')return 3;
      const effects=entry.actor.effects||[];
      if(effects.some(e=>e.id==='move_last'))return 4;
      return effects.some(e=>e.id==='move_first')?0:3;
    };
    actions.sort((x,y)=>{const tx=orderTier(x),ty=orderTier(y);if(tx!==ty)return tx-ty;const px=x.priority||0,py=y.priority||0;if(px!==py)return py-px;
      // A igualdad de prioridad, el consumible se resuelve antes del movimiento:
      // el defensor expulsado no alcanza a atacar y activar su propio relevo.
      if(x.kind!==y.kind && (x.kind==='item'||y.kind==='item'))return x.kind==='item'?-1:1;
      if(x.actor===y.actor&&x.kind!==y.kind)return x.kind==='item'?-1:y.kind==='item'?1:0;const sx=effective(x.actor,'speed'),sy=effective(y.actor,'speed');return sx!==sy?sy-sx:(random()<.5?-1:1);});
    for(const entry of actions){state.resolveDeaths();if(!remaining(0)||!remaining(1))break;
      if(state.invalidatedTurnActors.has(entry.actor)||!state.active[entry.s].includes(entry.actor.teamIndex)||entry.actor.hp<=0||state.forcedSwitches.some(f=>sideIndex(f.side)===entry.s&&f.targetTeamIndex===entry.actor.teamIndex))continue;
      if(entry.kind==='item')executeItem(entry);
      else if(entry.kind==='switch')switchTo(entry.s,entry.slot,entry.index,false,'Cambio');
      else executeMove(entry.actor,entry.move,entry.target,state,entry.switchChoice);
    }
    for(const entry of endItems)executeItem(entry);
    state.resolveDeaths();for(const a of state.allActive())if(a.hp>0){rulesFor(null,'on_status',a,firstOpponent(state,a),state);rulesFor(null,'turn_end',a,firstOpponent(state,a),state);}environmentTimed('turn_end');for(const a of state.allActive())if(a.hp>0)for(const e of a.effects.filter(e=>e.id==='heal_over_time')){const before=a.hp;a.hp=Math.min(a.maxHp,a.hp+integer(a.maxHp*percent(e.value)/100));if(a.hp>before){state.log.push(`${battleLogName(a)} recupera ${a.hp-before} PS por ${e.sourceName||'consumible'}.`);state.pushVisualUnit?.(a);}}for(const a of state.allActive())if(a.hp>0)rulesFor(null,'round_end',a,firstOpponent(state,a),state);environmentTimed('round_end');state.resolveDeaths();
    // Los contadores de ataque consecutivo se reinician si no hubo impacto ofensivo este turno.
    for(const a of state.allActive()){
      if(a.consecutiveCounters.lastAttackRound!==round){a.consecutiveCounters.attack=0;a.consecutiveCounters.hit=0;a.consecutiveCounters.use=0;a.consecutiveCounters.streakHits=0;}
      for(const counter of Object.values(a.moveStreaks||{})){
        if(counter.lastUsedRound!==round){counter.hit=0;counter.use=0;counter.streakHits=0;}
        delete counter.registeredHitThisUse;
      }
    }
    // Los cooldowns solo avanzan mientras el personaje está activo y vivo. En reserva quedan congelados.
    for(const a of state.allActive())if(a.hp>0)for(const[mid,n]of Object.entries(a.cooldowns)){if(n<=0||a.cooldownSetRound[mid]===round)continue;const next=n-1;a.cooldowns[mid]=next;const m=a.moves.find(x=>x.id===mid);state.log.push(next>0?`${battleLogName(a)} tiene ${next} ${next===1?'turno restante':'turnos restantes'} para poder volver a usar ${m?.name||mid}.`:`${battleLogName(a)} puede volver a usar ${m?.name||mid}.`);}
    for(const t of teams)for(const a of t)if(a.hp>0)tick(a,state);refreshStatus();if(state.weatherTurns>0&&--state.weatherTurns===0){{const old=state.catalog.weathers?.[state.weather];state.weather='';state.log.push(old?environmentText('weathers',old,false):'Termina el entorno.');state.pushVisualEnvironment('weather');refreshEnvironment();}}if(state.fieldTurns>0&&--state.fieldTurns===0){{const old=state.catalog.fields?.[state.field];state.field='';state.log.push(old?environmentText('fields',old,false):'Termina el entorno.');state.pushVisualEnvironment('field');refreshEnvironment();}}if(state.scenarioTurns>0&&--state.scenarioTurns===0){{const old=state.catalog.scenarios?.[state.scenario];state.scenario='';state.log.push(old?environmentText('scenarios',old,false):'Termina el entorno.');state.pushVisualEnvironment('scenario');refreshEnvironment();}}
    // Los objetos «último del turno» actúan después de todos los efectos, caducidades y daños residuales.
    lastItems.sort((a,b)=>effective(b.actor,'speed')-effective(a.actor,'speed'));
    for(const entry of lastItems)executeItem(entry);
    // Estado serializable: en un avance por checkpoint se mantienen los consumibles
    // activos y sus contadores de disparos para las rondas siguientes.
    state.activeConsumableRules=state.armedItems.map(x=>({s:x.s,teamIndex:x.actor.teamIndex,id:x.id,activatedRound:x.activatedRound,triggerCounts:structuredClone(x.triggerCounts),disabledRules:structuredClone(x.disabledRules||[])}));
    // Los reemplazos por KO son siempre manuales: solo se aplican si el caller ya guardó la elección.
    state.resolveDeaths();applyReplacementForRound(0,round);applyReplacementForRound(1,round);syncMirrorTags();refreshEnvironment();snapshotRound(round);
  }
  const leftAlive=remaining(0),rightAlive=remaining(1),winner=leftAlive&&!rightAlive?'left':rightAlive&&!leftAlive?'right':null,needsReplacement={left:requiredSlots(0),right:requiredSlots(1)};
  const leftActive=activeSummary(0),rightActive=activeSummary(1);
  return{...(includeCheckpoint?{checkpoint:{mode,round:played,teams:structuredClone(teams),active:structuredClone(active),
      weather:state.weather,field:state.field,scenario:state.scenario,weatherTurns:state.weatherTurns,
      fieldTurns:state.fieldTurns,scenarioTurns:state.scenarioTurns,lastDamage:state.lastDamage,
      deathEvents:structuredClone(state.deathEvents),forcedSwitches:structuredClone(state.forcedSwitches),itemLists:structuredClone(state.itemLists),usedItems:structuredClone(state.usedItems),activeConsumableRules:structuredClone(state.activeConsumableRules),matchStats:structuredClone(state.matchStats),randomCursor:cursor}}:{}),ok:true,mode,rounds:played,winner,winnerId:winner==='left'?leftActive[0]?.id:winner==='right'?rightActive[0]?.id:null,left:leftActive[0]||summary(teams[0][0]),right:rightActive[0]||summary(teams[1][0]),leftActive,rightActive,leftActiveIndexes:[...active[0]],rightActiveIndexes:[...active[1]],items:{left:[...itemLists[0]],right:[...itemLists[1]]},usedItems:{left:[...usedItems[0]],right:[...usedItems[1]]},leftTeam:teams[0].map(summary),rightTeam:teams[1].map(summary),needsReplacement,deathEvents:state.deathEvents,forcedSwitches:state.forcedSwitches,matchStats:state.matchStats,weather:state.weather,field:state.field,scenario:state.scenario,weatherTurns:state.weatherTurns,fieldTurns:state.fieldTurns,scenarioTurns:state.scenarioTurns,log:state.log.slice(0,2000),timeline:state.timeline,visualEvents:state.visualEvents.filter(e=>e.logIndex<2000),randomTape:tape.slice(0,cursor)};
}
