import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainConfig=fs.readFileSync(new URL('./wrangler.toml',import.meta.url),'utf8');
const workflow=fs.readFileSync(new URL('./.github/workflows/deploy.yml',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('./worker.js',import.meta.url),'utf8');

test('Editor API routes reach Worker before static Assets',()=>{
  assert.match(mainConfig,/run_worker_first\s*=\s*\[[^\]]*"\/editor-api\/\*"/);
  assert.match(worker,/url\.pathname\.startsWith\("\/editor-api\/"\)/);
});

test('Publication requires Cloudflare Access and positive manual confirmation',()=>{
  assert.match(worker,/jwtVerify\(token, keys/);
  assert.match(worker,/if \(!identity\)/);
  assert.match(worker,/body\.confirm!==true/);
  assert.match(worker,/body\.expectedRevision!==\(current\?\.revision\|\|null\)/);
});

test('Workflow original: despliegue desde main o ejecucion manual, sin configuraciones de prueba adicionales',()=>{
  const active=fs.readdirSync(new URL('./.github/workflows/',import.meta.url)).filter(n=>/\.ya?ml$/.test(n));
  assert.deepEqual(active,['deploy.yml']);
  assert.match(workflow,/push:\s*\n\s+branches: \[main\]/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/- run: npm install/);
  assert.match(workflow,/- run: npx wrangler deploy/);
  assert.doesNotMatch(workflow,/CONFIGURE_ISOLATED|PUBLICAR_ALPHA04|wrangler\.test\.toml/);
  assert.equal(fs.existsSync(new URL('./wrangler.test.toml',import.meta.url)),false);
});
console.log('Alpha 0.4: editor Worker, workflow original de despliegue OK');
