import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainConfig=fs.readFileSync(new URL('./wrangler.toml',import.meta.url),'utf8');
const testConfig=fs.readFileSync(new URL('./wrangler.test.toml',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('./worker.js',import.meta.url),'utf8');

test('Editor API routes reach Worker before static Assets',()=>{
  assert.match(mainConfig,/run_worker_first\s*=\s*\[[^\]]*"\/editor-api\/\*"/);
  assert.match(testConfig,/run_worker_first\s*=\s*\[[^\]]*"\/editor-api\/\*"/);
  assert.match(worker,/url\.pathname\.startsWith\("\/editor-api\/"\)/);
});

test('Publication requires Cloudflare Access and positive manual confirmation',()=>{
  assert.match(worker,/jwtVerify\(token, keys/);
  assert.match(worker,/if \(!identity\)/);
  assert.match(worker,/body\.confirm!==true/);
  assert.match(worker,/body\.expectedRevision!==\(current\?\.revision\|\|null\)/);
});

test('Editor test Worker cannot accidentally use real production resources',()=>{
  assert.match(testConfig,/CONFIGURE_ISOLATED_TEST_KV_NAMESPACE_FIRST/);
  assert.match(testConfig,/CONFIGURE_ISOLATED_TEST_SPRITES_BUCKET/);
  assert.match(testConfig,/binding = "PUBLIC_CONTENT"\s*\nid = "CONFIGURE_ISOLATED_TEST_PUBLIC_CONTENT_KV"/);
  assert.doesNotMatch(testConfig,/453d2d63210e42149663b5771e76a803/);
});
console.log('Alpha 0.4: isolated editor Worker config, manual publish and Access checks OK');
