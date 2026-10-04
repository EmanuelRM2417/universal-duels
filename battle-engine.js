// Universal Duels battle engine · Alpha 0.2
// Shared by the private Lab and the public server. Supports Singles and Doubles.
export const STATS=['hp','attack','defense','specialAttack','specialDefense','speed'];
export const MOVE_TARGETS=['self','ally_team','enemy_team','single','ally','all'];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
const integer=n=>Math.round(Number(n)||0);
const safe=s=>String(s||'').slice(0,100);
const percent=x=>clamp(x,0,100);
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
  return {id:entry.id,name:entry.name,side:sideName(side),teamIndex,types:d.types.map(t=>t==='espiritu'?'valor':t),stats,hp:stats.hp,maxHp:stats.hp,stages:{},environmentStages:{},statusStages:{},environmentCrit:0,environmentImmune:[],environmentDamageImmunity:[],statusBlocked:false,status:null,effects:[],statSources:[],moves,abilities,used:{},cooldowns:{},cooldownSetRound:{},environmentCooldownOnUse:[],lastHitType:null,_mirror:false};
}
function ensureActorRuntime(a){
  if(!a||typeof a!=='object')throw Error('Combatiente inválido durante la resolución.');
  for(const k of ['effects','statSources','environmentCooldownOnUse','environmentDamageImmunity'])if(!Array.isArray(a[k]))a[k]=[];
  for(const k of ['cooldowns','cooldownSetRound','stages','environmentStages','statusStages','used'])if(!a[k]||typeof a[k]!=='object'||Array.isArray(a[k]))a[k]={};
  return a;
}
function battleLogName(a){return (a?._mirror?(a?.side==='left'?'@@L@@':a?.side==='right'?'@@R@@':''):'')+(a?.name||'');}
function stageFactor(...values){let up=0,down=0;for(const raw of values){const v=Number(raw)||0;if(v>0)up+=v;else down+=v;}up=clamp(up,0,10);down=clamp(down,-10,0);return Math.max(0,1+up*.10+down*.05);}
function effective(a,stat){ensureActorRuntime(a);return Math.max(1,Math.round((a.stats[stat]??100)*stageFactor(a.stages[stat],a.environmentStages[stat],a.statusStages?.[stat])));}
function meets(cond,user,target,state){
  if(!cond||cond.type==='always')return true;const v=cond.value;
  switch(cond.type){
    case'hp_below':return user.hp/user.maxHp*100<Number(v);case'hp_above':return user.hp/user.maxHp*100>Number(v);
    case'weather_is':return state.weather===v;case'field_is':return state.field===v;case'has_status':return user.status?.id===v;
    case'has_type':return user.types.includes(v);case'was_hit_by_type':return user.lastHitType===v;case'stat_below':return effective(user,'speed')<Number(v);
    case'in_doubles':return state.mode==='doubles';default:return false;
  }
}
function conditionsPass(rule,user,target,state){
  const parts=[rule.condition||{type:'always'},...(Array.isArray(rule.conditions)?rule.conditions:[])];let result=null;
  for(const part of parts){const yes=part.negate?!meets(part,user,target,state):meets(part,user,target,state);result=result===null?yes:part.operator==='OR'?(result||yes):(result&&yes);}
  return rule.negate?!result:result;
}
function chance(rule,state){return percent(rule.chance??100)>=100||state.random()*100<percent(rule.chance??100);}
function sourceMeta(state){return {sourceKind:state.currentSourceKind||'efecto',sourceId:state.currentSourceId||'',sourceName:state.currentSourceName||'Efecto',sourceActor:state.currentSourceActor||''};}
function clearStatusLinkedEffects(a,statusId){ensureActorRuntime(a);a.effects=a.effects.filter(e=>!(e.sourceKind==='estado'&&e.sourceId===statusId));}
function actorSide(a){return a?.side==='right'?1:0;}
function activeActors(state,side){return (state.active[side]||[]).map(i=>state.teams[side][i]).filter(a=>a&&a.hp>0);}
function partnerOf(state,user){return activeActors(state,actorSide(user)).find(a=>a!==user)||null;}
function firstOpponent(state,user){return activeActors(state,1-actorSide(user))[0]||null;}
function targetSet(kind,user,contextTarget,state){
  const own=activeActors(state,actorSide(user)),enemy=activeActors(state,1-actorSide(user)),partner=partnerOf(state,user);
  switch(kind){
    case'self':return[user];case'ally':return partner?[partner]:[];case'ally_team':return own;case'enemy_team':return enemy;case'all':return [...own.filter(a=>a!==user),...enemy];case'all_active':return[...own,...enemy];case'target':return contextTarget&&contextTarget.hp>0?[contextTarget]:[];default:return contextTarget&&contextTarget.hp>0?[contextTarget]:enemy.slice(0,1);
  }
}
function switchTargetOwner(state,target){return actorSide(target);}
function resetSwitchStages(a){ensureActorRuntime(a);a.stages={};a.statSources=[];}
function resetEntryAbilityUsage(a){ensureActorRuntime(a);for(const ability of a.abilities||[])for(const [idx,rule] of (ability?.definition?.rules||[]).entries())if(rule.event==='on_enter')delete a.used[ability.id+':'+idx];}
function action(rule,user,contextTarget,state,depth){
  ensureActorRuntime(user);if(contextTarget)ensureActorRuntime(contextTarget);const act=rule.action||{},v=act.value;
  if(['set_weather','set_field','set_scenario'].includes(act.type)){
    const kind={set_weather:'weathers',set_field:'fields',set_scenario:'scenarios'}[act.type],key={weathers:'weather',fields:'field',scenarios:'scenario'}[kind],entry=state.catalog[kind]?.[v];
    if(!entry){state.log.push('Entorno no encontrado: '+safe(v));return;}if(state[key]===v){state.log.push('El entorno '+safe(v)+' ya está activo.');return;}
    if(state.allActive().some(a=>a.effects.some(e=>e.id==='prevent_environment'&&(e.kind==='all'||e.kind===kind)))){state.log.push('Activación de entorno bloqueada.');return;}
    state[key]=safe(v);state[key+'Turns']=5;state.log.push('Se activa '+key+': '+entry.name+' (5 rondas).');state.refreshEnvironment?.();return;
  }
  if(act.type==='apply_effect'){
    const effect=state.catalog.effects?.[v];if(effect&&depth<6)for(const sub of effect.definition.rules||[])if(sub.event==='manual'&&conditionsPass(sub,user,contextTarget,state)&&chance(sub,state))action(sub,user,contextTarget,state,depth+1);return;
  }
  const targets=targetSet(rule.target,user,contextTarget,state);
  if(['environment_immunity','prevent_environment'].includes(act.type)){
    for(const t of targets){t.effects.push({id:act.type,kind:v,turns:integer(rule.duration),permanent:integer(rule.duration)===0,source:'ability',...sourceMeta(state)});state.log.push(battleLogName(t)+' obtiene inmunidad a '+v+'.');}return;
  }
  if(act.type==='damage_multiplier'){
    // Modifica únicamente el daño del movimiento que está resolviéndose. 100 = sin cambio.
    const factor=Number(v);if(Number.isFinite(factor)&&factor>=0&&factor<=500)state.damageMultiplier*=factor/100;return;
  }
  for(const t of targets){
    if(!t||t.hp<=0)continue;ensureActorRuntime(t);
    if(act.type==='heal'){const before=t.hp,amount=Math.max(0,integer(t.maxHp*percent(v)/100));t.hp=Math.min(t.maxHp,t.hp+amount);const actual=t.hp-before;if(actual>0)state.log.push(`${battleLogName(t)} recupera ${actual} PS (${percent(v)} %).`);}
    else if(act.type==='damage'){const amount=percent(v)===0?0:Math.max(1,integer(t.maxHp*percent(v)/100));if(amount>0){t.hp=Math.max(0,t.hp-amount);state.log.push(`${battleLogName(t)} recibe ${amount} de daño adicional (${percent(v)} %).`);}}
    else if(act.type==='heal_from_damage'){const dealt=state.lastDamage?.attackerTeamIndex===user.teamIndex&&state.lastDamage?.attackerSide===user.side?state.lastDamage.amount:0,before=t.hp,amount=Math.max(0,integer(dealt*percent(v)/100));t.hp=Math.min(t.maxHp,t.hp+amount);const actual=t.hp-before;if(actual>0)state.log.push(`${battleLogName(t)} recupera ${actual} PS (${percent(v)} % del daño infligido).`);}
    else if(act.type==='stat_change'&&['attack','defense','specialAttack','specialDefense','speed','accuracy','evasion','criticalChance'].includes(act.stat)){const before=t.stages[act.stat]||0,next=clamp(before+integer(v),-10,10),delta=next-before;t.stages[act.stat]=next;if(delta){t.statSources.push({stat:act.stat,value:delta,sourceName:state.currentSourceName||'Efecto',sourceKind:state.currentSourceKind||'efecto',sourceActor:state.currentSourceActor||user.name});state.log.push(`${battleLogName(t)}: ${act.stat} ${next}.`);state.pushVisualUnit?.(t);}}
    else if(act.type==='apply_status'&&!t.status&&!t.statusBlocked){const st=state.catalog.statuses?.[safe(v)],f=st?.definition?.typeFilter||{mode:'all',types:[]},matched=(f.types||[]).some(x=>t.types.includes(x)),immune=f.mode==='exclude'&&matched||f.mode==='include'&&!matched;if(immune)state.log.push(`${battleLogName(t)} es inmune a ${st?.name||safe(v)}.`);else{t.status={id:safe(v),turns:Math.max(0,integer(rule.duration))};state.refreshStatus?.();state.log.push(`${battleLogName(t)} recibe ${st?.name||t.status.id}.`);}}
    else if(act.type==='remove_status'){if(t.status){const oldId=t.status.id,old=state.catalog.statuses?.[oldId]?.name||oldId;t.status=null;clearStatusLinkedEffects(t,oldId);state.refreshStatus?.();state.log.push(`${battleLogName(t)} pierde ${old}.`);}}
    else if(act.type==='suppress_abilities'){t.effects.push({id:'suppressed',turns:Math.max(1,integer(rule.duration)),...sourceMeta(state)});state.log.push(`${battleLogName(t)}: habilidades anuladas.`);}
    else if(act.type==='remove_effect')t.effects=t.effects.filter(e=>e.id!==v);
    else if(act.type==='restrict_moves'){if(!t.effects.some(e=>e.id==='restrict_moves'&&e.sourceKind===state.currentSourceKind&&e.sourceId===state.currentSourceId))t.effects.push({id:'restrict_moves',turns:Math.max(1,integer(rule.duration)),...sourceMeta(state)});}
    else if(act.type==='modify_active_cooldowns'){for(const[mid,n]of Object.entries(t.cooldowns)){if(n<=0)continue;const next=Math.max(0,n+integer(v));t.cooldowns[mid]=next;const m=t.moves.find(x=>x.id===mid);state.log.push(`${battleLogName(t)}: cooldown activo de ${m?.name||mid} ${integer(v)>=0?'+':''}${integer(v)} → ${next}.`);}}
    else if(act.type==='cooldown_on_use')t.effects.push({id:'cooldown_on_use',value:integer(v),turns:Math.max(1,integer(rule.duration)),...sourceMeta(state)});
    else if(act.type==='immunity')t.effects.push({id:'immunity',damageClass:act.damageClass||'all',filter:act.typeFilter||{mode:'all',types:[]},turns:integer(rule.duration),permanent:integer(rule.duration)===0,...sourceMeta(state)});
    else if(act.type==='switch_character'){
      const owner=switchTargetOwner(state,t),slot=state.active[owner].findIndex(i=>i===t.teamIndex),mode=act.switchMode==='manual'?'manual':'random';
      if(slot<0)continue;const eligible=state.teams[owner].map((a,i)=>({a,i})).filter(x=>x.a.hp>0&&!state.active[owner].includes(x.i));if(!eligible.length)continue;
      if(mode==='manual'){const chosen=state.currentSwitchChoice;
        if(chosen&&sideIndex(chosen.side??sideName(owner))===owner&&Number(chosen.slot)===slot&&eligible.some(x=>x.i===Number(chosen.teamIndex)))state.switchTo(owner,slot,Number(chosen.teamIndex),true,'Cambio por efecto');
        else{state.forcedSwitches.push({side:sideName(owner),slot,reason:state.currentSourceName||'Efecto',targetTeamIndex:t.teamIndex});state.log.push(`${battleLogName(t)} debe cambiar de personaje.`);}}
      else{const pick=eligible[Math.floor(state.random()*eligible.length)].i;state.switchTo(owner,slot,pick,true,'Cambio forzado');}
    }
  }
}
function rulesFor(entry,event,user,contextTarget,state){
  if(!user||user.hp<=0)return;ensureActorRuntime(user);
  if(event==='on_status'&&user.status){const statusId=user.status.id,st=state.catalog.statuses?.[statusId];for(const rule of st?.definition?.rules||[]){if(!user.status||user.status.id!==statusId)break;if(rule.event==='on_status'&&rule.action?.type!=='stat_change'&&conditionsPass(rule,user,contextTarget,state)&&chance(rule,state)){state.currentSourceName=st.name;state.currentSourceKind='estado';state.currentSourceId=st.id||statusId;state.currentSourceActor=user.name;action(rule,user,contextTarget,state,0);state.currentSourceName='';state.currentSourceId='';}}}
  for(const ability of user.abilities||[]){
    if(user.effects.some(e=>e.id==='suppressed'))break;
    for(const[idx,rule]of(ability?.definition?.rules||[]).entries()){
      const key=ability.id+':'+idx;if(rule.event!==event||(rule.limit>0&&(user.used[key]||0)>=rule.limit))continue;
      if(!conditionsPass(rule,user,contextTarget,state)||!chance(rule,state))continue;user.used[key]=(user.used[key]||0)+1;
      state.currentSourceName=ability.name||entry?.name||'Habilidad';state.currentSourceKind='habilidad';state.currentSourceId=ability.id;state.currentSourceActor=user.name;action(rule,user,contextTarget,state,0);state.currentSourceName='';state.currentSourceId='';
    }
  }
}
function runMoveRules(move,event,user,contextTarget,state){
  for(const rule of move?.definition?.rules||[]){if(rule.event!==event||!conditionsPass(rule,user,contextTarget,state)||!chance(rule,state))continue;state.currentSourceName=move.name;state.currentSourceKind='movimiento';state.currentSourceId=move.id;state.currentSourceActor=user.name;action(rule,user,contextTarget,state,0);state.currentSourceName='';state.currentSourceId='';}
}
function applyMoveCooldown(attacker,move,state){const d=move.definition;let cd=Math.max(0,integer(d.cooldown||0));for(const e of attacker.effects.filter(e=>e.id==='cooldown_on_use'))cd=Math.max(0,cd+integer(e.value));for(const e of attacker.environmentCooldownOnUse||[])if(chance(e,state))cd=Math.max(0,cd+integer(e.value));if(cd>0){attacker.cooldowns[move.id]=cd;attacker.cooldownSetRound[move.id]=state.round;state.log.push(`${battleLogName(attacker)} tiene ${cd} ${cd===1?'turno restante':'turnos restantes'} para poder volver a usar ${move.name}.`);}}
function relationBonus(moveType,defender,state){let bonus=0,immune=false;for(const t of defender.types){const rel=state.chart?.[moveType]?.[t]||'neutral';if(rel==='inmune')immune=true;else if(rel==='eficaz')bonus+=.2;else if(rel==='ineficaz')bonus-=.2;}return{bonus,immune};}
function resolvePosition(state,ref){if(!ref||!['left','right'].includes(ref.side)||!Number.isInteger(Number(ref.slot)))return null;const s=sideIndex(ref.side),slot=Number(ref.slot),idx=state.active[s]?.[slot];return idx===undefined?null:state.teams[s][idx]||null;}
function moveTargets(user,move,orderTarget,state){
  const kind=normalizeMoveTarget(move.definition),own=actorSide(user),partner=partnerOf(state,user),enemy=activeActors(state,1-own);
  if(kind==='self')return[user];if(kind==='ally')return partner?[partner]:[];if(kind==='ally_team')return activeActors(state,own);if(kind==='enemy_team')return enemy;if(kind==='all')return[...activeActors(state,own).filter(a=>a!==user),...enemy];
  // single: Singles auto-selecciona al oponente. Doubles conserva la posición elegida.
  if(state.mode==='singles')return enemy.slice(0,1);const selected=resolvePosition(state,orderTarget);return selected&&selected!==user&&selected.hp>0?[selected]:[];
}
function executeMove(attacker,move,orderTarget,state,switchChoice=null){
  ensureActorRuntime(attacker);const d=move.definition;if(attacker.hp<=0)return;
  if((attacker.cooldowns[move.id]||0)>0){state.log.push(`${battleLogName(attacker)} no puede usar ${move.name}: quedan ${attacker.cooldowns[move.id]} turnos de cooldown.`);return;}
  if(attacker.effects.some(e=>e.id==='restrict_moves')){state.log.push(`${battleLogName(attacker)} tiene ataques restringidos.`);return;}
  const targets=moveTargets(attacker,move,orderTarget,state),context=targets[0]||firstOpponent(state,attacker);state.damageMultiplier=1;state.currentSwitchChoice=switchChoice;
  rulesFor(null,'on_attack',attacker,context,state);runMoveRules(move,'on_attack',attacker,context,state);state.log.push(`${battleLogName(attacker)} usó ${move.name}.`);state.visualEvents.push({logIndex:state.log.length-1,type:'move_targets',side:attacker.side,slot:state.active[actorSide(attacker)].findIndex(i=>i===attacker.teamIndex),targets:targets.map(t=>({side:t.side,slot:state.active[actorSide(t)].findIndex(i=>i===t.teamIndex)}))});runMoveRules(move,'manual',attacker,context,state);if(state.mode==='doubles')runMoveRules(move,'manual_doubles',attacker,context,state);
  if(!targets.length){state.log.push(`${battleLogName(attacker)} falló: no hay un objetivo válido.`);applyMoveCooldown(attacker,move,state);return;}
  for(const defender of targets){
    if(!defender||defender.hp<=0)continue;ensureActorRuntime(defender);
    if(d.accuracy!==null&&d.accuracy!==undefined&&Number(d.accuracy)!==0&&state.random()*100>=percent(Number(d.accuracy)*(effective(attacker,'accuracy')/100)/(effective(defender,'evasion')/100))){state.log.push(`${battleLogName(attacker)} falló contra ${battleLogName(defender)}.`);continue;}
    let damage=0;
    if(d.category!=='status'&&Number(d.power)>0){
      const effectImmune=[...(defender.effects||[]),...(defender.environmentDamageImmunity||[])].some(e=>e.id==='immunity'&&(e.damageClass==='all'||e.damageClass===d.category)&&(()=>{const f=e.filter||{mode:'all',types:[]},matched=(f.types||[]).includes(d.type);return f.mode==='all'||f.mode==='include'&&matched||f.mode==='exclude'&&!matched})());
      const rel=relationBonus(d.type,defender,state);if(effectImmune||rel.immune){state.log.push(`${battleLogName(defender)} es inmune al ataque.`);continue;}
      const attack=effective(attacker,d.category==='special'?'specialAttack':'attack'),defense=effective(defender,d.category==='special'?'specialDefense':'defense'),raw=Math.max(1,Math.floor((2*50/5+2)*Number(d.power)*attack/defense/50+2));
      let bonus=(attacker.types.includes(d.type)?.2:0)+rel.bonus;if(state.random()*100<percent((d.criticalChance??0)+attacker.environmentCrit+(attacker.stages.criticalChance||0)*5)){bonus+=.5;state.log.push(`${battleLogName(attacker)} hizo un golpe crítico contra ${battleLogName(defender)}.`);}
      damage=Math.max(1,integer(raw*(1+bonus)*state.damageMultiplier));defender.hp=Math.max(0,defender.hp-damage);state.lastDamage={attackerSide:attacker.side,attackerTeamIndex:attacker.teamIndex,defenderSide:defender.side,defenderTeamIndex:defender.teamIndex,amount:damage};defender.lastHitType=d.type;state.log.push(`${battleLogName(defender)} recibe ${damage} de daño.`);
    }
    runMoveRules(move,'on_hit',attacker,defender,state);rulesFor(null,'on_hit',attacker,defender,state);if(damage>0)rulesFor(null,'on_damage_taken',defender,attacker,state);
  }
  applyMoveCooldown(attacker,move,state);
}
function tick(a,state){ensureActorRuntime(a);for(const e of a.effects)if(e.turns>0)e.turns--;a.effects=a.effects.filter(e=>e.permanent||e.turns!==0);if(a.status?.turns>0&&--a.status.turns===0){const old=a.status.id;a.status=null;clearStatusLinkedEffects(a,old);state?.refreshStatus?.();}}

export function simulate({left,right,leftTeam,rightTeam,chart={},catalog,turns=10,randomTape=[],randomSource,weather='',field='',scenario='',leftMove='',rightMove='',leftOrders=[],rightOrders=[],leftReplacements=[],rightReplacements=[],mode='singles'}){
  mode=mode==='doubles'?'doubles':'singles';if(!Number.isInteger(turns)||turns<0||turns>50)throw Error('Rondas entre 0 y 50.');if(!Array.isArray(randomTape)||randomTape.length>30000||randomTape.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>=1))throw Error('Historial RNG inválido.');
  const tape=randomTape.slice();let cursor=0;const fresh=typeof randomSource==='function'?randomSource:()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;const random=()=>{if(cursor<tape.length)return tape[cursor++];const v=fresh();if(!Number.isFinite(v)||v<0||v>=1)throw Error('RNG inválido.');tape.push(v);cursor++;return v;};
  const load=(id,side,teamIndex)=>{const e=catalog.entities[id];if(!e)throw Error('Entidad no encontrada: '+id);const d=e.definition,moves=[...(d.moveIds||[]),d.uniqueMoveId].map(mid=>{const m=catalog.moves[mid];if(!m)throw Error('Ataque inexistente: '+mid);return m;}),abilities=[d.globalAbilityId,d.uniqueAbilityId].map(aid=>{const a=catalog.abilities[aid];if(!a)throw Error('Habilidad inexistente: '+aid);return a;});return actor(e,moves,abilities,side,teamIndex);};
  const parseTeam=(value,single,side)=>{const ids=value===undefined?[single]:value;if(!Array.isArray(ids)||ids.length<1||ids.length>8||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw Error('El equipo '+side+' debe tener entre 1 y 8 entidades diferentes.');if(mode==='doubles'&&ids.length<2)throw Error('Doubles requiere al menos dos entidades por equipo.');return ids;};
  const ids=[parseTeam(leftTeam,left,'izquierdo'),parseTeam(rightTeam,right,'derecho')],teams=ids.map((arr,s)=>arr.map((id,i)=>load(id,s,i))),active=mode==='doubles'?[[0,1],[0,1]]:[[0],[0]];
  const state={mode,chart,catalog,teams,active,weather:'',field:'',scenario:'',weatherTurns:0,fieldTurns:0,scenarioTurns:0,round:0,lastDamage:null,damageMultiplier:1,random,log:[],timeline:[],visualEvents:[],forcedSwitches:[]};
  state.allActive=()=>[...activeActors(state,0),...activeActors(state,1)];
  const current=(s,slot=0)=>{const idx=active[s]?.[slot];return idx===undefined?null:teams[s][idx]||null;};state.current=(s,slot=0)=>current(s,slot);
  const syncMirrorTags=()=>{for(const t of teams)for(const a of t)a._mirror=false;for(const a of activeActors(state,0))for(const b of activeActors(state,1))if(a.id===b.id){a._mirror=true;b._mirror=true;}};syncMirrorTags();
  const remaining=s=>teams[s].some(a=>a.hp>0);
  const activeSlotOf=a=>active[actorSide(a)].findIndex(i=>i===a.teamIndex);
  const summary=p=>{ensureActorRuntime(p);const core=['attack','defense','specialAttack','specialDefense','speed'];return{id:p.id,name:p.name,side:p.side,teamIndex:p.teamIndex,activeSlot:activeSlotOf(p),hp:p.hp,maxHp:p.maxHp,baseStats:Object.fromEntries(core.map(k=>[k,p.stats[k]])),currentStats:Object.fromEntries(core.map(k=>[k,effective(p,k)])),stages:{...p.stages},environmentStages:{...p.environmentStages},statusStages:{...(p.statusStages||{})},statSources:[...(p.statSources||[])],environmentCrit:p.environmentCrit,status:p.status,effects:p.effects.map(e=>({...e})),types:p.types,cooldowns:{...p.cooldowns}};};
  const activeSummary=s=>active[s].map((_,slot)=>current(s,slot)).filter(Boolean).map(summary);
  const snapshotRound=round=>state.timeline.push({round,left:summary(current(0,0)),right:summary(current(1,0)),leftActive:activeSummary(0),rightActive:activeSummary(1),weather:state.weather,field:state.field,scenario:state.scenario,teams:teams.map(t=>t.map(summary))});
  state.captureUnit=a=>summary(a);state.pushVisualUnit=(a,type='unit_state')=>state.visualEvents.push({logIndex:state.log.length-1,type,side:a.side,slot:activeSlotOf(a),unit:summary(a)});
  const enter=(s,slot)=>{const a=current(s,slot);if(!a||a.hp<=0)return;resetEntryAbilityUsage(a);rulesFor(null,'on_enter',a,firstOpponent(state,a),state);};
  const switchTo=(s,slot,index,forced=false,label='Cambio')=>{if(!Number.isInteger(index)||index<0||index>=teams[s].length||active[s].includes(index)||teams[s][index].hp<=0)throw Error('Cambio inválido en equipo '+(s===0?'izquierdo':'derecho')+'.');const leaving=current(s,slot);if(leaving)resetSwitchStages(leaving);active[s][slot]=index;syncMirrorTags();state.log.push(`${forced?label+': ':label+': '}${battleLogName(current(s,slot))} entra al campo.`);state.pushVisualUnit(current(s,slot),'switch');enter(s,slot);state.refreshEnvironment?.();};state.switchTo=switchTo;
  const parseAction=o=>{if(o===undefined||o===null||o==='')return null;if(typeof o==='string')return{move:o};if(typeof o!=='object'||Array.isArray(o))throw Error('Acción inválida.');if(o.switch!==undefined)return{switch:Number(o.switch)};if(o.move!==undefined)return{move:o.move,target:o.target||null,switchChoice:o.switchChoice||null};return null;};
  const parseSideOrder=(orders,round,defaultMove)=>{const raw=orders[round-1];if(mode==='singles'){const one=parseAction(raw);return[one||{move:defaultMove||''}];}if(raw&&Array.isArray(raw.actions)){return[0,1].map(slot=>parseAction(raw.actions.find(a=>Number(a.slot)===slot))||null);}if(Array.isArray(raw))return[0,1].map(i=>parseAction(raw[i]));return[null,null];};
  const chooseMove=(a,opponent,requested)=>{if(requested){const m=a.moves.find(m=>m.id===requested);if(!m)throw Error('El ataque '+requested+' no pertenece a '+a.name+'.');return m;}const available=a.moves.filter(m=>(a.cooldowns[m.id]||0)<=0);if(!available.length)throw Error(a.name+' no tiene movimientos disponibles por cooldown.');const useful=available.filter(m=>m.definition.category==='status'||Number(m.definition.power)<=0||!opponent?.types?.some(t=>state.chart?.[m.definition.type]?.[t]==='inmune'));const pool=useful.length?useful:available;return pool[Math.floor(random()*pool.length)];};
  for(const s of[0,1])for(let slot=0;slot<active[s].length;slot++)enter(s,slot);
  for(const[key,id,kind]of[['weather',weather,'weathers'],['field',field,'fields'],['scenario',scenario,'scenarios']])if(id){if(!catalog[kind]?.[id])throw Error('Entorno no encontrado: '+kind+'/'+id);state[key]=id;state[key+'Turns']=5;state.log.push('Entorno inicial: '+catalog[kind][id].name+' (5 rondas).');}
  snapshotRound(0);
  const envKinds=[['weather','weathers'],['field','fields'],['scenario','scenarios']],matches=(a,e)=>e.filter==='all'||(e.filter==='include'?e.types.some(t=>a.types.includes(t)):!e.types.some(t=>a.types.includes(t))),immune=(a,kind)=>a.effects.some(e=>e.id==='environment_immunity'&&(e.kind==='all'||e.kind===kind)&&!(e.source==='ability'&&a.effects.some(x=>x.id==='suppressed')));
  const refreshEnvironment=()=>{for(const a of state.allActive()){ensureActorRuntime(a);a.environmentStages={};a.environmentCrit=0;a.environmentCooldownOnUse=[];a.environmentDamageImmunity=[];a.statusBlocked=false;}for(const[key,kind]of envKinds){const id=state[key],entry=state.catalog[kind]?.[id];if(!id||!entry)continue;for(const e of entry.definition.fieldEffects||[]){if(e.timing!=='continuous')continue;for(const a of state.allActive()){if(a.hp<=0||immune(a,kind)||!matches(a,e)||!chance(e,state))continue;if(e.type==='stat_change'){if(e.stat==='criticalChance')a.environmentCrit+=e.value*5;else a.environmentStages[e.stat]=(a.environmentStages[e.stat]||0)+e.value;}else if(e.type==='critical_change')a.environmentCrit+=e.value*5;else if(e.type==='remove_status'&&a.status){const old=a.status.id;a.status=null;clearStatusLinkedEffects(a,old);state.refreshStatus?.();}else if(e.type==='block_status'){if(a.status){const old=a.status.id;a.status=null;clearStatusLinkedEffects(a,old);}a.statusBlocked=true;state.refreshStatus?.();}else if(e.type==='cooldown_on_use')a.environmentCooldownOnUse.push(e);else if(e.type==='immunity')a.environmentDamageImmunity.push({id:'immunity',damageClass:e.damageClass||'all',filter:e.immunityTypeFilter||{mode:'all',types:[]},sourceKind:kind,sourceName:entry.name});}}}};state.refreshEnvironment=refreshEnvironment;
  const applyEnv=(a,e,entry,kind)=>{if(a.hp<=0||immune(a,kind)||!matches(a,e)||!chance(e,state))return;if(e.type==='damage_percent'){const amount=e.value===0?0:Math.max(1,integer(a.maxHp*e.value/100));if(amount>0){a.hp=Math.max(0,a.hp-amount);state.log.push(entry.name+': '+battleLogName(a)+' pierde '+amount+' PS ('+e.value+' %).');}}else if(e.type==='heal_percent'){const before=a.hp,amount=integer(a.maxHp*e.value/100);a.hp=Math.min(a.maxHp,a.hp+amount);const actual=a.hp-before;if(actual>0)state.log.push(entry.name+': '+battleLogName(a)+' recupera '+actual+' PS ('+e.value+' %).');}else if(e.type==='cooldown_change'){for(const[mid,n]of Object.entries(a.cooldowns)){if(n<=0)continue;const next=Math.max(0,n+integer(e.value));a.cooldowns[mid]=next;const m=a.moves.find(x=>x.id===mid);state.log.push(entry.name+': cooldown activo de '+(m?.name||mid)+' en '+battleLogName(a)+' '+(e.value>=0?'+':'')+e.value+' → '+next+'.');}}else if(e.type==='remove_status'&&a.status){const oldId=a.status.id,old=state.catalog.statuses?.[oldId]?.name||oldId;a.status=null;clearStatusLinkedEffects(a,oldId);state.refreshStatus?.();state.log.push(entry.name+': '+battleLogName(a)+' pierde '+old+'.');}else if(e.type==='block_status'){if(a.status){const oldId=a.status.id,old=state.catalog.statuses?.[oldId]?.name||oldId;a.status=null;clearStatusLinkedEffects(a,oldId);state.refreshStatus?.();state.log.push(entry.name+': '+battleLogName(a)+' pierde '+old+'.');}a.statusBlocked=true;}else if(e.type==='stat_change'){const stat=e.stat,before=a.stages[stat]||0,next=clamp(before+integer(e.value),-10,10),delta=next-before;a.stages[stat]=next;if(delta){a.statSources.push({stat,value:delta,sourceName:entry.name,sourceKind:kind,sourceActor:'entorno'});state.log.push(entry.name+': '+battleLogName(a)+' '+stat+' '+(delta>0?'+':'')+delta+'.');state.pushVisualUnit(a);}}else if(e.type==='critical_change'){const stat='criticalChance',before=a.stages[stat]||0,next=clamp(before+integer(e.value),-10,10),delta=next-before;a.stages[stat]=next;if(delta){a.statSources.push({stat,value:delta,sourceName:entry.name,sourceKind:kind,sourceActor:'entorno'});state.log.push(entry.name+': '+battleLogName(a)+' crítico '+(delta>0?'+':'')+delta+'.');state.pushVisualUnit(a);}}};
  const environmentTimed=timing=>{for(const[key,kind]of envKinds){const id=state[key],entry=state.catalog[kind]?.[id];if(!id||!entry)continue;for(const e of entry.definition.fieldEffects||[]){if(e.timing!==timing)continue;for(const a of state.allActive())applyEnv(a,e,entry,kind);}}};
  const refreshStatus=()=>{for(const t of teams)for(const a of t){a.statusStages={};if(!a.status)continue;const st=state.catalog.statuses?.[a.status.id];for(const r of st?.definition?.rules||[]){if(r.event!=='on_status'||r.action?.type!=='stat_change')continue;const stat=r.action.stat,val=integer(r.action.value);a.statusStages[stat]=(a.statusStages[stat]||0)+val;}}};state.refreshStatus=refreshStatus;refreshStatus();refreshEnvironment();
  const replacementHistory=[leftReplacements,rightReplacements];
  const requiredSlots=s=>active[s].map((idx,slot)=>({idx,slot,a:teams[s][idx]})).filter(x=>!x.a||x.a.hp<=0).filter(()=>remaining(s)).map(x=>x.slot);
  const applyReplacementForRound=(s,round)=>{const required=requiredSlots(s);if(!required.length)return;const raw=replacementHistory[s]?.[round-1],choices=Array.isArray(raw)?raw:raw?.choices;if(!Array.isArray(choices))return;for(const slot of required){const c=choices.find(x=>Number(x.slot)===slot);if(!c)continue;switchTo(s,slot,Number(c.teamIndex),true,'Relevo');}};
  let played=0;
  for(let round=1;round<=turns&&remaining(0)&&remaining(1);round++){
    played=round;state.round=round;syncMirrorTags();state.log.push('— Ronda '+round+' —');refreshEnvironment();environmentTimed('turn_start');for(const a of state.allActive())if(a.hp>0)rulesFor(null,'turn_start',a,firstOpponent(state,a),state);
    const orders=[parseSideOrder(leftOrders,round,leftMove),parseSideOrder(rightOrders,round,rightMove)],switches=[];
    for(const s of[0,1])for(let slot=0;slot<active[s].length;slot++){const a=current(s,slot),o=orders[s][slot];if(a?.hp>0&&o?.switch!==undefined)switches.push({s,slot,a,index:Number(o.switch)});}
    switches.sort((x,y)=>effective(y.a,'speed')-effective(x.a,'speed')||(random()<.5?-1:1));for(const sw of switches)switchTo(sw.s,sw.slot,sw.index,false,'Cambio');refreshEnvironment();
    const attacks=[];for(const s of[0,1])for(let slot=0;slot<active[s].length;slot++){const a=current(s,slot),o=orders[s][slot];if(!a||a.hp<=0||o?.switch!==undefined)continue;const opp=firstOpponent(state,a);attacks.push({s,slot,actor:a,move:chooseMove(a,opp,o?.move),target:o?.target||null,switchChoice:o?.switchChoice||null});}
    attacks.sort((x,y)=>{const px=Number(x.move.definition.priority)||0,py=Number(y.move.definition.priority)||0;if(px!==py)return py-px;const sx=effective(x.actor,'speed'),sy=effective(y.actor,'speed');return sx!==sy?sy-sx:(random()<.5?-1:1);});
    for(const turn of attacks){if(!remaining(0)||!remaining(1))break;if(current(turn.s,turn.slot)!==turn.actor||turn.actor.hp<=0)continue;executeMove(turn.actor,turn.move,turn.target,state,turn.switchChoice);}
    for(const a of state.allActive())if(a.hp>0){rulesFor(null,'on_status',a,firstOpponent(state,a),state);rulesFor(null,'turn_end',a,firstOpponent(state,a),state);}environmentTimed('turn_end');for(const a of state.allActive())if(a.hp>0)rulesFor(null,'round_end',a,firstOpponent(state,a),state);environmentTimed('round_end');
    for(const t of teams)for(const a of t)for(const[mid,n]of Object.entries(a.cooldowns)){if(n<=0||a.cooldownSetRound[mid]===round)continue;const next=n-1;a.cooldowns[mid]=next;const m=a.moves.find(x=>x.id===mid);state.log.push(next>0?`${battleLogName(a)} tiene ${next} ${next===1?'turno restante':'turnos restantes'} para poder volver a usar ${m?.name||mid}.`:`${battleLogName(a)} puede volver a usar ${m?.name||mid}.`);}
    for(const t of teams)for(const a of t)if(a.hp>0)tick(a,state);refreshStatus();if(state.weatherTurns>0&&--state.weatherTurns===0){state.weather='';state.log.push('El clima termina.');}if(state.fieldTurns>0&&--state.fieldTurns===0){state.field='';state.log.push('El campo termina.');}if(state.scenarioTurns>0&&--state.scenarioTurns===0){state.scenario='';state.log.push('El escenario termina.');}
    // Los reemplazos por KO son siempre manuales: solo se aplican si el caller ya guardó la elección.
    applyReplacementForRound(0,round);applyReplacementForRound(1,round);syncMirrorTags();refreshEnvironment();snapshotRound(round);
  }
  const leftAlive=remaining(0),rightAlive=remaining(1),winner=leftAlive&&!rightAlive?'left':rightAlive&&!leftAlive?'right':null,needsReplacement={left:requiredSlots(0),right:requiredSlots(1)};
  const leftActive=activeSummary(0),rightActive=activeSummary(1);
  return{ok:true,mode,rounds:played,winner,winnerId:winner==='left'?leftActive[0]?.id:winner==='right'?rightActive[0]?.id:null,left:leftActive[0]||summary(teams[0][0]),right:rightActive[0]||summary(teams[1][0]),leftActive,rightActive,leftActiveIndexes:[...active[0]],rightActiveIndexes:[...active[1]],leftTeam:teams[0].map(summary),rightTeam:teams[1].map(summary),needsReplacement,forcedSwitches:state.forcedSwitches,weather:state.weather,field:state.field,scenario:state.scenario,weatherTurns:state.weatherTurns,fieldTurns:state.fieldTurns,scenarioTurns:state.scenarioTurns,log:state.log.slice(0,2000),timeline:state.timeline,visualEvents:state.visualEvents.filter(e=>e.logIndex<2000),randomTape:tape.slice(0,cursor)};
}
