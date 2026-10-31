import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulate} from './battle-engine.js';
// Current Alpha 0.7 contract: event timeline is synchronized and the original
// editor's public UI controls remain reachable after the layout redesign.
const ent=(id,ability)=>({id,name:id,definition:{types:['fuego'],hp:500,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:['hit','rest','buff'],uniqueMoveId:'unique',globalAbilityId:ability,uniqueAbilityId:'none'}});
const mov=(id,rules=[])=>({id,name:id,definition:{type:'fuego',category:'status',power:0,accuracy:0,criticalChance:0,priority:0,cooldown:0,rules}});
const catalog={entities:{hela:ent('hela','enter'),thor:ent('thor','none')},abilities:{enter:{id:'enter',name:'Entrada',definition:{rules:[{event:'on_enter',condition:{type:'always'},target:'self',chance:100,action:{type:'set_field',value:'arena'}}]}},none:{id:'none',definition:{rules:[]}}},moves:{hit:mov('hit'),rest:mov('rest'),buff:mov('buff',[{event:'manual',condition:{type:'always'},target:'self',chance:100,action:{type:'stat_change',stat:'specialAttack',value:2}}]),unique:mov('unique')},fields:{arena:{id:'arena',name:'Arena',definition:{fieldEffects:[{type:'stat_change',timing:'continuous',stat:'speed',value:3,filter:'all',types:[],chance:100}]}}}};
const r=simulate({catalog,leftTeam:['hela'],rightTeam:['thor'],turns:1,leftOrders:[{move:'buff'}],rightOrders:[{move:'rest'}],randomSource:()=>.9});
assert.equal(r.left.maxHp,500);
const on=r.log.findIndex(s=>s.startsWith('Arena se activó'));assert(on>=0);
assert(r.visualEvents.some(v=>v.type==='environment'&&v.logIndex===on&&v.field==='arena'));
assert(r.visualEvents.some(v=>v.type==='unit_state'&&v.logIndex===on&&v.side==='left'&&v.unit.environmentStages.speed===3));
assert(r.visualEvents.some(v=>v.type==='unit_state'&&v.logIndex===on&&v.side==='right'&&v.unit.environmentStages.speed===3));
const boost=r.log.findIndex(s=>s.includes('Ataque especial de hela subió +2'));assert(boost>=0);
assert(r.visualEvents.some(v=>v.logIndex===boost&&v.unit?.stages?.specialAttack===2));
const main=readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
const practice=readFileSync(new URL('./public/practice.html',import.meta.url),'utf8');
const cat=readFileSync(new URL('./public/catalog.html',import.meta.url),'utf8');
for(const html of [main,practice]){
 assert(html.includes('battle-hp-track')&&html.includes('battle-hp-fill'));
 assert(html.includes('battle-stage')&&html.includes('sprite-renderer'));
}
assert(main.includes('udStatsOpen')&&main.includes('udGoogleButton'));
assert(main.includes('udHomeCatalog')&&main.includes('udHomePractice'));
assert(cat.includes('types')||cat.includes('Tipos')); 
console.log('PASS: Environment and stat events synchronized, Alpha 0.7 public controls, battle UI and catalog.');
