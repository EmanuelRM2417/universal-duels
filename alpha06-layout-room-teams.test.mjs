import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Room, ACTION_MS, REPLACEMENT_MS,actionLimit,replacementLimit} from './worker.js';
const main=readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
const practice=readFileSync(new URL('./public/practice.html',import.meta.url),'utf8');
for(const [id,html] of [['Main',main],['Entrenamiento',practice]]){
  assert.match(html,/aspect-ratio:4\/3!important/,`${id}: escenario 4:3`);
  assert.match(html,/battleCommandPanel/,`${id}: panel fuera del escenario`);
  assert.match(html,/\.battle-nameplate\{position:absolute!important/,`${id}: tarjeta estable`);
  assert.match(html,/background-size:contain!important/,`${id}: clima no repetido`);
}
assert.doesNotMatch(main.slice(main.indexOf('<section id="home"'),main.indexOf('<section id="teamBuilder"')),/id="homeBattleMode"|id="homeTeamMode"/);
for(const id of ['udHomeTeams','udHomeCatalog','udHomePractice','udHomeVolume','udLeaveRoom','udBuilderSave','udLobbyTeams','udEmbeddedOverlay'])assert.ok(main.includes(id),id);
assert.match(main,/ud-alpha-last-room/);assert.match(main,/ud-alpha06-named-teams/);assert.match(main,/udBackToHome/);
assert.match(practice,/udPracticeTimerEnabled/);assert.match(practice,/if\(!udPracticeTimed\(\)/);
assert.match(practice,/udPracticeSavedTeam/);assert.doesNotMatch(practice,/Reanudable hasta/);
assert.equal(ACTION_MS,30000);assert.equal(REPLACEMENT_MS,15000);
assert.equal(actionLimit('singles'),30000);assert.equal(actionLimit('doubles'),60000);
assert.equal(replacementLimit('singles',1),15000);assert.equal(replacementLimit('doubles',2),30000);
class MockSocket{constructor(role,conn){this.msg=[];this.role=role;this.conn=conn;}deserializeAttachment(){return{role:this.role,connectionId:this.conn};}send(text){this.msg.push(JSON.parse(text));}close(){this.closed=true;}}
const memory=new Map(),host=new MockSocket('host','h1'),guest=new MockSocket('guest','g1'),sockets=[host,guest];
const storage={get:async k=>memory.get(k),put:async(k,v)=>memory.set(k,v),setAlarm:async()=>{}};
const R=new Room({storage,getWebSockets:()=>sockets},{});
const room={code:'ABC234',battleMode:'singles',teamMode:'picked',players:[{role:'host',name:'Ana',session:'a',connected:true,connectionId:'h1',team:[],ready:false},{role:'guest',name:'Beto',session:'b',connected:true,connectionId:'g1',team:[],ready:false}],battle:null};
memory.set('room',room);
await R.webSocketMessage(host,JSON.stringify({type:'leave_room'}));
assert.deepEqual(memory.get('room').players.map(p=>p.role),['guest'],'explicit exit frees seat');
assert.ok(host.msg.some(x=>x.type==='left_room'));
assert.ok(guest.msg.some(x=>x.type==='room'&&x.room.players.length===1));
await R.webSocketClose(guest);
assert.equal(memory.get('room').players.length,1,'disconnect reserves the seat');
assert.equal(memory.get('room').players[0].connected,false);
// A user can withdraw an acknowledged order before the opponent commits.
room.players.unshift({role:'host',name:'Ana',session:'a',connected:true,connectionId:'h1',team:[],ready:false});
room.battle={status:'playing',phase:'action',round:2,pending:{host:{actions:[]},guest:null},selection:{host:{actions:[]},guest:null}};
await R.webSocketMessage(host,JSON.stringify({type:'cancel_selection'}));
assert.equal(room.battle.pending.host,null);
assert.equal(room.battle.selection.host,null);
assert.ok(host.msg.some(x=>x.type==='selection_cancelled'));
room.battle.pending.host={actions:[]};room.battle.pending.guest={actions:[]};
await R.webSocketMessage(host,JSON.stringify({type:'cancel_selection'}));
assert.deepEqual(room.battle.pending.host,{actions:[]},'cannot withdraw an order after both accepted');
assert.ok(host.msg.some(x=>x.type==='error'&&/resolviéndose/.test(x.message)));
console.log('Alpha 0.6: layout 4:3, teams, timers per unit, leave/reconnect, cancellation tested.');
