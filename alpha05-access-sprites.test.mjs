import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read = p => fs.readFileSync(new URL(p,import.meta.url),'utf8');
const cfg=read('./wrangler.toml');const html=read('./public/editor/index.html');const worker=read('./worker.js');const renderer=read('./public/sprite-renderer.js');
for (const v of [
 'name = "universal-duels-editor-privado"',
 'binding = "EDITOR_DRAFTS"',
 'binding = "PUBLIC_CONTENT"',
 'id = "453d2d63210e42149663b5771e76a803"',
 'bucket_name = "universal-duels-sprites-test"',
 'ACCESS_TEAM_DOMAIN = "nameless-water-b29a.cloudflareaccess.com"',
 'ACCESS_AUD = "99bc017b30ecadb6150e289655d2c2fcdf043e1d65c3fa644d7df00f2350e346"',
 'EDITOR_EMAIL = "2417erm@gmail.com"'
])assert.ok(cfg.includes(v),`Editor release config missing: ${v}`);
assert.equal((cfg.match(/id = "453d2d63210e42149663b5771e76a803"/g)||[]).length,2,'Both bindings must use existing catalog KV');
assert.match(worker,/env\.EDITOR_DRAFTS/);
assert.match(worker,/env\.ACCESS_AUD/);
assert.match(html,/\/sprite-renderer\.js/);
assert.match(html,/UDSprites\?\.mount\(stage\)/);
assert.match(renderer,/getImageData/);
assert.ok(fs.existsSync(new URL('./.github/workflows/deploy.yml',import.meta.url)));
console.log('Editor: AUD correcto, KV catalog-v1, rutas R2 y render de Lab OK');
