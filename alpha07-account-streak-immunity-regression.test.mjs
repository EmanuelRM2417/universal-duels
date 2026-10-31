import assert from 'node:assert/strict';
import {authRoute,recordAccountMatch} from './auth.js';
import {simulate} from './battle-engine.js';

// Server-only statistics: authenticated account, idempotent match recording, no client-write route.
const origin='https://universalduels.com',db=new Map();
const kv={get:async(k,format)=>format==='json'?JSON.parse(db.get(k)||'null'):db.get(k)||null,put:async(k,v)=>db.set(k,v),delete:async k=>db.delete(k)};
const env={PUBLIC_CONTENT:kv,GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com'};
db.set('auth-v1:account:google-test',JSON.stringify({id:'google-test',publicId:'ab12cd34',nick:'Demo',name:'Demo',tutorialComplete:true}));
db.set('auth-v1:session:'+'x'.repeat(32),JSON.stringify({id:'google-test'}));
const request=(route,options={})=>new Request(origin+route,{...options,headers:{Cookie:'ud_session='+'x'.repeat(32),...(options.headers||{})}});
let response=await authRoute(request('/api/auth/stats'),env,new URL(origin+'/api/auth/stats'));
assert.equal(response.status,200);
let body=await response.json();assert.equal(body.user.id,'ab12cd34');assert.equal(body.stats.total.played,0);
assert.equal(await recordAccountMatch(env,'google-test','room:one',{kind:'salas',mode:'doubles',outcome:'loss',damageDealt:204,damageReceived:315,defeated:2}),true);
assert.equal(await recordAccountMatch(env,'google-test','room:one',{kind:'salas',mode:'doubles',outcome:'loss',damageDealt:204,damageReceived:315,defeated:2}),false);
assert.equal(await recordAccountMatch(env,'google-test','practice:two',{kind:'casual',mode:'singles',outcome:'win',damageDealt:350,damageReceived:60,defeated:1}),true);
response=await authRoute(request('/api/auth/stats'),env,new URL(origin+'/api/auth/stats'));
body=await response.json();
assert.equal(body.stats.total.played,2);assert.equal(body.stats.total.wins,1);assert.equal(body.stats.total.losses,1);
assert.equal(body.stats.total.damageDealt,554);assert.equal(body.stats.total.damageReceived,375);assert.equal(body.stats.total.defeated,3);
assert.equal(body.stats.salasDoubles.played,1);assert.equal(body.stats.casualSingles.played,1);
const nickReq=request('/api/auth/nick',{method:'POST',headers:{Origin:origin},body:JSON.stringify({nick:'Nuevo nickname'})});
response=await authRoute(nickReq,env,new URL(nickReq.url));assert.equal(response.status,200);
body=await response.json();assert.equal(body.user.nick,'Nuevo nickname');assert.equal(body.user.id,'ab12cd34');
response=await authRoute(request('/api/auth/stats',{method:'POST',headers:{Origin:origin}}),env,new URL(origin+'/api/auth/stats'));
assert.notEqual(response.status,200,'browser cannot submit its own statistic totals');

// Mechanics: legacy survival always leaves exactly one HP even if definition asks otherwise.
const entity=(id,ability='blank',move='idle')=>({id,name:id,definition:{types:['agua'],hp:100,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:[move,'idle','idle'],uniqueMoveId:'idle',globalAbilityId:ability,uniqueAbilityId:'blank'}});
const move=(id,power=0,rules=[])=>({id,name:id,definition:{type:'agua',category:power?'physical':'status',power,accuracy:100,criticalChance:0,priority:0,rules}});
const catalog={entities:{protected:entity('protected','survive_old'),immune:entity('immune','aura'),enemy:entity('enemy','blank','hit')},moves:{idle:move('idle'),hit:move('hit',240),curse:move('curse',0,[{event:'manual',condition:{type:'always'},target:'target',action:{type:'apply_status',value:'poison'},duration:3,chance:100}])},abilities:{blank:{id:'blank',definition:{rules:[]}},survive_old:{id:'survive_old',definition:{survive:{chance:100,fixedHp:47,hpPercent:44,limit:1},rules:[]}},aura:{id:'aura',name:'AURA',definition:{rules:[{event:'on_condition',condition:{type:'always'},target:'self',action:{type:'effect_immunity'},chance:100}]}}},statuses:{poison:{id:'poison',name:'Veneno',definition:{rules:[]}}}};
let battle=simulate({catalog,left:'protected',right:'enemy',turns:1,leftMove:'idle',rightMove:'hit',randomSource:()=>.8});
assert.equal(battle.left.hp,1);
assert.equal(battle.matchStats[0].damageReceived,99,'survive reports actual damage only');
assert.equal(battle.matchStats[1].damageDealt,99,'the opponent is credited with that damage');
const fatal=simulate({catalog,left:'enemy',right:'immune',turns:1,leftMove:'hit',rightMove:'idle',randomSource:()=>.8});
assert.equal(fatal.matchStats[0].damageDealt,100,'damage cannot exceed current HP');
assert.equal(fatal.matchStats[1].damageReceived,100);
assert.equal(fatal.matchStats[0].defeated,1,'a confirmed KO is credited once');
const protectedFromStatus={...catalog,entities:{...catalog.entities,enemy:entity('enemy','blank','curse')}};
battle=simulate({catalog:protectedFromStatus,left:'immune',right:'enemy',turns:1,leftMove:'idle',rightMove:'curse',randomSource:()=>.8});
assert.equal(battle.left.status,null,'effect immunity must prevent a new status');
assert.ok(battle.log.some(s=>s.includes('inmune al efecto')),'immunity is explained in battle log');
// On_condition per-turn charge source cannot grow past configured stages.
const charge={event:'on_condition',condition:{type:'streak_count',subject:'self',value:'hit:1:3'},target:'self',action:{type:'stat_change',stat:'speed',value:2},streakEffectMode:'per_turn',chance:100};
const charged={...catalog,moves:{...catalog.moves,hit:move('hit',1)},entities:{...catalog.entities,protected:entity('protected','charge','hit')},abilities:{...catalog.abilities,charge:{id:'charge',definition:{rules:[charge]}}}};
battle=simulate({catalog:charged,left:'protected',right:'enemy',turns:1,leftMove:'hit',rightMove:'idle',randomSource:()=>.8});
assert.equal(battle.left.passiveStages.speed,2,'first consecutive hit activates the reversible +2 passive');
battle=simulate({catalog:charged,left:'protected',right:'enemy',turns:2,leftOrders:[{move:'hit'},{move:'hit'}],rightOrders:[{move:'idle'},{move:'idle'}],randomSource:()=>.8});
assert.equal(battle.left.passiveStages.speed,4,'second hit grants +4 (per-turn accumulation)');
const capped={...charged,moves:{...charged.moves,hit:move('hit',1)}};
battle=simulate({catalog:capped,left:'protected',right:'enemy',turns:2,leftOrders:[{move:'hit'},{move:'idle'}],rightOrders:[{move:'idle'},{move:'idle'}],randomSource:()=>.8});
assert.equal(battle.left.passiveStages.speed||0,0,'lost streak removes passive bonus');
console.log('Alpha 0.7: account stats server-only, match dedup, public ID/nick, survive=1, streak lifecycle OK');
