import assert from 'node:assert/strict';
import {Room,ACTION_MS,REPLACEMENT_MS,actionLimit,replacementLimit} from './worker.js';
assert.equal(ACTION_MS,30000);assert.equal(REPLACEMENT_MS,15000);assert.equal(actionLimit('singles'),30000);assert.equal(actionLimit('doubles'),60000);assert.equal(replacementLimit('singles',1),15000);assert.equal(replacementLimit('doubles',2),30000);
const data={battle:{lastState:{needsReplacement:{left:[0,1],right:[]},leftTeam:[{hp:0},{hp:0},{hp:45}],rightTeam:[],leftActiveIndexes:[0,1],rightActiveIndexes:[]}}};
const room=new Room({getWebSockets:()=>[]},{})
assert.deepEqual(room.normalizeReplacement(data,'host',[{slot:1,teamIndex:2}]),[{slot:1,teamIndex:2}]);
assert.throws(()=>room.normalizeReplacement(data,'host',[{slot:0,teamIndex:2},{slot:1,teamIndex:2}]),/disponibles/);
for(let i=0;i<20;i++){
 const r=room.randomReplacements(data.battle,'host');
 assert.equal(r.length,1);assert.equal(r[0].teamIndex,2);assert.ok([0,1].includes(r[0].slot));
}
const memory={room:{battle:{status:'playing',phase:'action',selectionDeadline:Date.now()-1000,pending:{host:{actions:[]},guest:null}},createdAt:Date.now(),players:[]}};
const events=[];
room.storage={get:async k=>memory[k],put:async(k,v)=>{memory[k]=v},setAlarm:async()=>{},delete:async()=>{}};
room.broadcastBattle=(r,t)=>events.push(t);
await room.alarm();
assert.equal(memory.room.battle.status,'finished');
assert.equal(memory.room.battle.winner,'host');
assert.equal(memory.room.battle.finishReason,'timeout');
assert.deepEqual(events,['battle_result']);
console.log('alpha 0.4: deadlines, replacement slot shortage, action timeout OK');
