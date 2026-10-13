import assert from 'node:assert/strict';
import { Room } from './worker.js';

const NativeResponse=globalThis.Response;
// Node's Response constructor forbids 101; Cloudflare Workers supports switching protocols.
globalThis.Response=class extends NativeResponse {
  constructor(body, init={}) { if(init.status===101){super(null,{status:200});this.webSocket=init.webSocket;}else super(body,init); }
};
class MockSocket{
  constructor(){this.messages=[];this.attachment=null;}
  serializeAttachment(a){this.attachment=a;}
  deserializeAttachment(){return this.attachment;}
  send(message){this.messages.push(JSON.parse(message));}
}
globalThis.WebSocketPair=class { constructor(){this[0]=new MockSocket();this[1]=new MockSocket();} };
const map=new Map(), sockets=[];
const storage={get:async k=>map.get(k),put:async(k,v)=>map.set(k,v),setAlarm:async()=>{}};
const state={storage,getWebSockets:()=>sockets,acceptWebSocket:s=>sockets.push(s)};
const doRoom=new Room(state,{});
await doRoom.fetch(new Request('https://test/init',{method:'POST',body:JSON.stringify({code:'ABC234',createdAt:Date.now(),battleMode:'singles'})}));
const connect=async(session='',name='Jugador')=>{
  const url='https://test/connect?name='+encodeURIComponent(name)+(session?'&session='+encodeURIComponent(session):'');
  const response=await doRoom.fetch(new Request(url,{headers:{Upgrade:'websocket'}}));
  return{response,socket:sockets.at(-1)};
};
const a=await connect('','Ana');
assert.ok(a.response.webSocket);
assert.equal(a.socket.messages[0].role,'host');
const token=a.socket.messages[0].session;
assert.ok(token.length>32);
const b=await connect('','Beto');
assert.equal(b.socket.messages[0].role,'guest');
const bToken=b.socket.messages[0].session;
const stranger=await connect('','Intruso');
assert.equal(stranger.response.status,409);
const invalid=await connect('fake-token','Intruso');
assert.equal(invalid.response.status,403);
const rejoined=await connect(token,'Nombre falso');
assert.equal(rejoined.socket.messages[0].role,'host');
assert.equal(rejoined.socket.messages[0].controller,true);
assert.ok(a.socket.messages.some(m=>m.type==='session_observer'));
assert.equal(map.get('room').players.length,2);
assert.equal(map.get('room').players[0].name,'Ana');
// The old socket cannot mutate a room. Connection heartbeat must not be accepted from observer.
const oldPongs=a.socket.messages.filter(m=>m.type==='pong').length;
await doRoom.webSocketMessage(a.socket,JSON.stringify({type:'ping'}));
assert.equal(a.socket.messages.filter(m=>m.type==='pong').length,oldPongs);
assert.equal(a.socket.messages.at(-1).type,'session_observer');
await doRoom.webSocketMessage(rejoined.socket,JSON.stringify({type:'ping'}));
assert.equal(rejoined.socket.messages.at(-1).type,'pong');
// Closing old device never marks the new session disconnected.
await doRoom.webSocketClose(a.socket);
assert.equal(map.get('room').players[0].connected,true);
await doRoom.webSocketClose(rejoined.socket);
assert.equal(map.get('room').players[0].connected,false);
const recovered=await connect(token,'Ana');
assert.equal(recovered.socket.messages[0].role,'host');
assert.equal(map.get('room').players[0].connected,true);
assert.equal(map.get('room').players[1].session,bToken);
// A player may confirm independently. Resolution only starts after both submissions.
const testBattle={status:'playing',phase:'action',selectionDeadline:Date.now()+60_000,round:1,pending:{host:null,guest:null},selection:{host:{actions:[]},guest:null}};
const tempRoom={battle:testBattle};
doRoom.normalizeOrder=async()=>({actions:[]});
await doRoom.handleOrder(recovered.socket,tempRoom,'host',{actions:[]});
assert.deepEqual(testBattle.pending.host,{actions:[]});
assert.equal(testBattle.pending.guest,null);
assert.equal(recovered.socket.messages.at(-1).type,'order_accepted');
console.log('alpha 0.4: reconnect, reserved seats, observer security and independent confirmation OK');
