import assert from 'node:assert/strict';
import {releaseResources} from './release-assets.js';
const blobs=new Map(), puts=[];
const putLocal=(key,text)=>blobs.set(key,{value:text,etag:'hash:'+text,httpMetadata:{contentType:'image/png'}});
putLocal('drafts/cat.png','cat-v1');putLocal('type-icons/fuego.png','flame-v1');putLocal('environment/scenarios/pond.png','pond-v1');
const r2={head:async key=>blobs.get(key)?{etag:blobs.get(key).etag}:null,
  get:async key=>blobs.get(key)?{body:blobs.get(key).value,httpMetadata:blobs.get(key).httpMetadata}:null,
  put:async(key,body)=>{puts.push(key);putLocal(key,body);}};
const env={EDITOR_SPRITES:r2},catalog={entities:{cat:{definition:{spriteId:'cat'}}},scenarios:{pond:{definition:{imageId:'pond'}}}};
const first=await releaseResources(env,catalog,'patch-test-1',{},['fuego','agua']);
assert.equal(first.copied,3);assert.equal(first.reused,0);assert.equal(puts.length,3);
assert.equal(first.assets.sprites.cat,'published/patch-test-1/sprites/cat.png');
assert.equal(first.assets.environment['scenarios/pond'],'published/patch-test-1/environment/scenarios/pond.png');
const prev={revision:'patch-test-1',assets:first.assets};
const second=await releaseResources(env,catalog,'patch-test-2',prev,['fuego','agua']);
assert.equal(second.copied,0);assert.equal(second.reused,3);assert.equal(puts.length,3);
assert.deepEqual(second.assets,first.assets);
putLocal('drafts/cat.png','cat-v2');
const third=await releaseResources(env,catalog,'patch-test-3',{revision:'patch-test-2',assets:second.assets},['fuego']);
assert.equal(third.copied,1);assert.equal(third.assets.sprites.cat,'published/patch-test-3/sprites/cat.png');
assert.equal(third.assets.environment['scenarios/pond'],first.assets.environment['scenarios/pond']);
blobs.delete('drafts/cat.png');
const fourth=await releaseResources(env,catalog,'patch-test-4',{revision:'patch-test-3',assets:third.assets},['fuego']);
assert.equal(fourth.copied,0);assert.equal(fourth.assets.sprites.cat,third.assets.sprites.cat);
const broken={entities:{lost:{definition:{spriteId:'missing'}}}};
await assert.rejects(()=>releaseResources(env,broken,'patch-bad',{},['agua']),/Falta el sprite/);
assert.equal(puts.length,4,'A failed preflight must not copy resources');
console.log('Alpha 0.4 R2: deduplicación, cambios, continuidad de assets y fallos sin publicación OK');
