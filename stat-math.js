// Universal Duels Alpha 0.4 — single source of truth for stage mathematics.
// Each actor has an additive stage total (-10 to +10). Basic attributes use
// asymmetric percentages; probability attributes modify their own base chance.
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,Number(x)||0));
export function netStages(...values){return clamp(values.reduce((sum,value)=>sum+(Number(value)||0),0),-10,10);}
export function basicStageFactor(...values){const n=netStages(...values);return 1+(n>0?n*.10:n*.05);}
export function probabilityStageFactor(...values){return Math.max(0,1+netStages(...values)*.05);}
/**
 * Stages on a nonzero probability are summed and applied RELATIVE to the base.
 * Examples: evasion 20%, +4 -> 24%; critical 10%, +4 -> 12%.
 * Special zero-base awakening requested for crit/evasion: the first positive
 * stage gives 5% nominal + 20% of it = 6%. Further stages change that
 * 5% nominal by another 20% each. A negative stage never creates a chance.
 */
export function scaledChance(baseChance,...stages){
  const base=clamp(baseChance,0,100),n=netStages(...stages);
  if(base===0)return n>0?clamp(5*(1+n*.20),0,100):0;
  return clamp(base*probabilityStageFactor(n),0,100);
}
export function actorStages(actor,stat){
  return netStages(actor?.stages?.[stat],actor?.environmentStages?.[stat],actor?.statusStages?.[stat],stat==='criticalChance'?actor?.environmentCrit:0);
}
/** accuracy=0 is a sentinel: cannot miss, even against an evasive opponent.
 * Accuracy scales its HIT chance, evasion scales the move's MISS chance.
 * The two effects compose multiplicatively, preserving the original base.
 */
export function hitChance(accuracy,attacker,defender){
  const base=clamp(accuracy??100,0,100);
  if(base===0)return 100;
  const adjustedAccuracy=scaledChance(base,actorStages(attacker,'accuracy'));
  const baseEvasion=100-base;
  const adjustedEvasion=scaledChance(baseEvasion,actorStages(defender,'evasion'));
  return clamp(adjustedAccuracy*(100-adjustedEvasion)/Math.max(0.00001,100-baseEvasion),0,100);
}
export function criticalChance(base,attacker){
  return scaledChance(base??0,actorStages(attacker,'criticalChance'));
}
