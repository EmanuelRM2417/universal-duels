import assert from 'node:assert/strict';
import app from './worker.js';
import fs from 'node:fs';
const songs={lobby:[{id:'uno'},{id:'dos'},{id:'tres'}],battle:[{id:'accion'},{id:'aventura'},{id:'final'}]};
const publication={revision:'patch-a05-test',version:'0.7.0-alpha',chart:{},catalog:{entities:{},moves:{},abilities:{}},musicPlaylists:songs,assets:{audio:{}}};
const env={PUBLIC_CONTENT:{get:async k=>k==='public-v1:current'?publication:k===`public-v1:snapshot:${publication.revision}`?publication:null}};
for(const path of ['/api/music-playlists',`/api/music-playlists?revision=${publication.revision}`]){
 const r=await app.fetch(new Request('https://example.invalid'+path),env),d=await r.json();
 assert.equal(r.status,200);assert.deepEqual(d.playlists,songs);assert.equal(d.revision,publication.revision);
}
const home=fs.readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
const practice=fs.readFileSync(new URL('./public/practice.html',import.meta.url),'utf8');
const audio=fs.readFileSync(new URL('./public/audio-director.js',import.meta.url),'utf8');
const tutorial=fs.readFileSync(new URL('./public/tutorial.html',import.meta.url),'utf8');
assert(home.includes('udHomePractice')&&home.includes('battle-stage')); 
assert(home.includes('udStatBursts')&&home.includes('udEmbeddedFrame')); 
assert(practice.includes('visualEvents')&&practice.includes('token'));
assert(audio.includes('lobby')&&audio.includes('battle'));
assert(tutorial.includes('objetivo')&&tutorial.includes('prioridad'));
console.log('PASS: Published and version-pinned playlists, public/practice UI, audio director and tutorial.');
