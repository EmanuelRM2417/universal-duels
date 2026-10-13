import assert from 'node:assert/strict';
import {createPractice,advancePractice} from './practice-session.js';
import {simulate} from './battle-engine.js';
const ent=(id,speed)=>({id,name:id,definition:{types:['fuego'],hp:500,attack:100,defense:100,specialAttack:100,specialDefense:100,speed,moveIds:['hit','weak','wait'],uniqueMoveId:'unique',globalAbilityId:'none',uniqueAbilityId:'none'}});
const mv=(id,power)=>({id,name:id,definition:{type:'fuego',category:power?'physical':'status',power,accuracy:100,criticalChance:0,priority:0,rules:[]}});
const catalog={entities:{a:ent('a',140),b:ent('b',100)},moves:{hit:mv('hit',3),weak:mv('weak',2),wait:mv('wait',0),unique:mv('unique',1)},abilities:{none:{id:'none',definition:{rules:[]}}}};
let session=createPractice({catalog,chart:{},revision:'patch-test',mode:'singles',difficulty:'advanced',leftTeam:['a'],rightTeam:['b'],now:1000});
assert.equal(session.engineCheckpoint.round,0);
for(let n=0;n<5;n++){
 const state=advancePractice(session,'turn',{order:{move:'hit'}},{catalog,chart:{},now:2000+n,random:()=>0});
 assert.equal(state.round,n+2);assert.equal(session.engineCheckpoint.round,n+1);assert.equal(session.randomTape.length,0);
 assert.ok(state.state.log.length<80);assert.equal(state.status,'playing');
}
const replay=simulate({catalog,chart:{},mode:'singles',leftTeam:['a'],rightTeam:['b'],turns:5,leftOrders:Array(5).fill({move:'hit'}),rightOrders:session.rightOrders,randomSource:()=>0.2});
assert.deepEqual(session.lastState.leftTeam,replay.leftTeam);assert.deepEqual(session.lastState.rightTeam,replay.rightTeam);
console.log('Práctica incremental: cinco rondas, mismas estadísticas, estado recuperable y sin histórico RNG');
