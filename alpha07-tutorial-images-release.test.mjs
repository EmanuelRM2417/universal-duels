import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {releaseResources} from './release-assets.js';
const released=new Map(),uploads=new Map([['tutorial/objetivo.png',{body:new Uint8Array([137,80,78,71,13,10,26,10,11]),etag:'tutorial-v1',httpMetadata:{contentType:'image/png'}}]]);
const r2={
 async head(key){const x=uploads.get(key)||released.get(key);return x?{etag:x.etag}:null;},
 async get(key){return uploads.get(key)||released.get(key)||null;},
 async put(key,body,metadata){released.set(key,{etag:'tutorial-v1',body,httpMetadata:metadata.httpMetadata});}
};
const data={tutorial:{objetivo:{id:'objetivo',name:'Objetivo',definition:{text:'Guía',imageId:'objetivo'}}},entities:{},weathers:{},scenarios:{}};
const result=await releaseResources({EDITOR_SPRITES:r2},data,'rev-test',{},[],{});
assert.equal(result.assets.tutorialImages.objetivo,'published/rev-test/tutorial/objetivo.png');
assert.ok(released.has('published/rev-test/tutorial/objetivo.png'));
const reused=await releaseResources({EDITOR_SPRITES:r2},data,'rev-test2',{assets:result.assets},[],{});
assert.equal(reused.assets.tutorialImages.objetivo,result.assets.tutorialImages.objetivo,'unchanged bytes reuse prior public revision');
assert.ok(!released.has('published/rev-test2/tutorial/objetivo.png'),'unchanged images do not duplicate');
const missing={tutorial:{objetivo:{id:'objetivo',definition:{imageId:'missing'}}},entities:{},weathers:{},scenarios:{}};
await assert.rejects(()=>releaseResources({EDITOR_SPRITES:r2},missing,'rev-invalid',{},[],{}),/Falta el sprite o recurso visual requerido/);
assert.ok(![...released.keys()].some(k=>k.includes('rev-invalid')),'missing image blocks publication before copying');
const worker=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mainWorker=readFileSync(new URL('../universal-duels-main/worker.js',import.meta.url),'utf8');
const editor=readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
const main=readFileSync(new URL('../universal-duels-main/public/index.html',import.meta.url),'utf8');
assert.ok(worker.includes('tutorial-images'));
assert.match(worker,/request\.headers\.get\('Origin'\)!==url\.origin/);
assert.ok(mainWorker.includes('snap.assets?.tutorialImages?.[id]'));
assert.match(main,/api\/tutorial-images/);
assert.match(main,/\['extras','Consejos para empezar'\]/);
assert.match(editor,/Subir imagen/);
console.log('PASS tutorial PNG private upload/public release R2 manifest, reuse and preflight, Main image endpoint and guide extras');
