import assert from 'node:assert/strict';
import {createSoundDirector} from './public/audio-director.js';

const handlers={document:new Map(),window:new Map()};
const on=(which,type,fn)=>{const map=handlers[which];if(!map.has(type))map.set(type,[]);map.get(type).push(fn);};
const emit=(which,type)=>{for(const fn of handlers[which].get(type)||[])fn();};
const liveSources=[];
class FakeAudioContext {
  state='suspended';currentTime=0;destination={};
  createGain(){return{gain:{value:1},connect(){}};}
  createBufferSource(){const node={loop:false,started:false,stopped:false,onended:null,connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};liveSources.push(node);return node;}
  async decodeAudioData(){return {duration:42};}
  async resume(){this.state='running';}
  async suspend(){this.state='suspended';}
}
const store=new Map();
globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
globalThis.sessionStorage={getItem:k=>store.get('session-'+k)??null,setItem:(k,v)=>store.set('session-'+k,v)};
globalThis.document={hidden:false,readyState:'loading',addEventListener:(type,fn)=>on('document',type,fn),getElementById:()=>({})};
globalThis.window={AudioContext:FakeAudioContext,addEventListener:(type,fn)=>on('window',type,fn)};
globalThis.Audio=class{constructor(){throw Error('HTML media player cannot be used for music');}};
globalThis.fetch=async url=>{
  if(url.startsWith('/api/music-playlists'))return{ok:true,json:async()=>({playlists:{lobby:[{id:'lobby-a'},{id:'lobby-b'},{id:'lobby-c'}],battle:[{id:'battle-a'}]}})};
  if(url.startsWith('/api/music-file/'))return{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};
  throw Error('Unexpected fetch '+url);
};
const director=createSoundDirector();
director.context('lobby');
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(liveSources.length,0,'autoplay must not start music');
emit('document','pointerdown');
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(liveSources.length,1,'music uses one Web Audio source');
assert.equal(liveSources[0].started,true);
assert.match(director.state.current,/^playlist:lobby:/);

document.hidden=true;emit('document','visibilitychange');
assert.equal(liveSources[0].stopped,true,'background must stop music');
document.hidden=false;emit('document','visibilitychange');
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(liveSources.length,2,'music resumes on returning to foreground');

director.pause();
assert.equal(liveSources[1].stopped,true);
document.hidden=true;emit('document','visibilitychange');
document.hidden=false;emit('document','visibilitychange');
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(liveSources.length,2,'explicit pause must not auto-resume');

director.context('battle');
await new Promise(resolve=>setTimeout(resolve,0));
assert.match(director.state.current,/^playlist:battle:/);
assert.equal(liveSources.length,3);
assert.equal(liveSources[2].started,true);
emit('window','pagehide');
assert.equal(liveSources[2].stopped,true,'pagehide must stop playback');
console.log('Alpha 0.7 mobile audio regression passed.');
