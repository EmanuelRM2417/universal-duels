import assert from 'node:assert/strict';
import app from './worker.js';
import fs from 'node:fs';
const publication={revision:'patch-a05-test',version:'0.5.0-alpha',chart:{},catalog:{entities:{},moves:{},abilities:{}},audioPlaylists:{lobby:['uno','dos','tres'],battle:['accion','aventura','final']},assets:{audio:{}}};
const env={PUBLIC_CONTENT:{get:async k=>k==='public-v1:current'?publication:k===`public-v1:snapshot:${publication.revision}`?publication:null}};
for(const path of ['/api/catalog',`/api/catalog/${publication.revision}`]){
 const r=await app.fetch(new Request('https://example.invalid'+path),env),d=await r.json();
 assert.equal(r.status,200);assert.deepEqual(d.audioPlaylists,publication.audioPlaylists);assert.equal(d.revision,publication.revision);
}
const home=fs.readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
const practice=fs.readFileSync(new URL('./public/practice.html',import.meta.url),'utf8');
const catalog=fs.readFileSync(new URL('./public/catalog.html',import.meta.url),'utf8');
const audio=fs.readFileSync(new URL('./public/audio-director.js',import.meta.url),'utf8');
const tutorial=fs.readFileSync(new URL('./public/tutorial.html',import.meta.url),'utf8');
assert.match(home,/await this\.handleOrder|id="battleCountdown"/); // UI countdown
assert.match(home,/udStatBursts/);assert.match(home,/ud-stat-burst/);
assert.match(home,/udInlinePage/);assert.match(home,/frame\.src=path\+'\?embed=1'/);
assert.doesNotMatch(home,/<button data-speed=/);
assert.match(practice,/token=crypto\.randomUUID\(\)\+crypto\.randomUUID\(\)/);
assert.match(catalog,/const STATS=.*'hp',1000/);assert.match(catalog,/query\.startsWith\('#'\)/);assert.match(catalog,/typesSelected\.length<3/);
assert.match(audio,/lastPlayed=\{lobby:\[\],battle:\[\]\}/);assert.match(audio,/previous\.includes\(id\)/);
assert.match(tutorial,/if\(window\.parent===window\)/);
console.log('Alpha 0.5: API audio playlists (actual and immutable), type/stat catalog, SPA, timers, sounds and new training session OK');
