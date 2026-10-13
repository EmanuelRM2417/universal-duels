import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dir = new URL('./.github/workflows/', import.meta.url);
const workflow = fs.readFileSync(new URL('./.github/workflows/deploy.yml', import.meta.url), 'utf8');
test('Se conserva el workflow original: push a main o ejecucion manual, npm install y despliegue', () => {
  assert.deepEqual(fs.readdirSync(dir).filter(n => /\.ya?ml$/.test(n)), ['deploy.yml']);
  assert.match(workflow, /push:\s*\n\s+branches: \[main\]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /- run: npm install/);
  assert.match(workflow, /- run: npx wrangler deploy/);
  assert.doesNotMatch(workflow, /CONFIGURE_ISOLATED|PUBLICAR_ALPHA04|wrangler\.test\.toml/);
  assert.equal(fs.existsSync(new URL('./wrangler.test.toml', import.meta.url)), false);
});
