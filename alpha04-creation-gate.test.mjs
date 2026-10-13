import assert from 'node:assert/strict';
import {Room} from './worker.js';
const entries=new Map(),writes=[];
const storage={get:async key=>entries.get(key),put:async(key,value)=>{entries.set(key,structuredClone(value));writes.push(key)},setAlarm:async()=>{}};
const room=new Room({storage},{});
async function check(kind){const res=await room.fetch(new Request('https://room.internal/creation-gate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind})}));return res.status;}
for(let i=0;i<40;i++)assert.equal(await check('room'),200);
assert.equal(await check('room'),429);
for(let i=0;i<240;i++)assert.equal(await check('practice'),200);
assert.equal(await check('practice'),429);
assert.equal(await check('foo'),400);
assert.ok(writes.length===280);
entries.set('creation-gate-v1',{start:Date.now()-3_600_001,practice:240,room:40});
assert.equal(await check('practice'),200,'New one-hour window should reset the ceiling');
assert.equal(await check('room'),200);
console.log('Alpha 0.4: umbrales antiabuso y ventana de renovación del servidor OK');
