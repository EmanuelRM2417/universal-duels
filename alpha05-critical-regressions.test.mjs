import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL(path, import.meta.url),'utf8');
const main = read('./public/index.html');
const practice = read('./public/practice.html');
const catalog = read('./public/catalog.html');
const renderer = read('./public/sprite-renderer.js');
const server = read('./worker.js');
const config = read('./wrangler.toml');
assert.match(server,/data\.type==="select_order"/);
assert.match(server,/b\.pending\[role\]=normalized/,'Selection accepted as final action in one step');
assert.match(server,/if\(b\.pending\.host&&b\.pending\.guest\)await this\.resolveRound\(room\)/);
assert.match(main,/send\(\{type:'select_order',round:battle\.round,order\}\)/);
assert.match(main,/function sendPendingOrder\(/);
assert.match(main,/['battle_start','battle_round','battle_replacement','battle_result','battle_sync','battle_retry']/);
assert.match(main,/m\.type==='order_accepted'/);
assert.match(main,/id="battleMessage"/);
assert.match(main,/#battleStage > #battleMessage\s*\{[^}]*position:absolute!important;[^}]*top:auto!important;[^}]*bottom:2%!important/);
assert.ok(!/function controlsHTML[\s\S]*?function renderBattle/.exec(main)?.[0]?.includes('<div class="battle-message">'),'No narration box nested in controls');
assert.match(main,/function typeMark\(t,table=false\)/);
assert.match(main,/wireTypeMarks\(\$\('battleStage'\)\)/);
assert.match(main,/wireTypeMarks\(\$\('roster'\)\)/);
assert.match(main,/\/api\/type-icons\//);
assert.match(catalog,/function typeBadge\(type\)/);
assert.match(renderer,/getImageData/);
assert.match(renderer,/drawImage\(asset\.source,rect\.x\+rect\.bounds\.x/);
assert.match(renderer,/const mid = Math\.floor\(width \/ 2\)/);
for (const [name,html] of [['online',main],['practice',practice],['catalog',catalog]]) {
  assert.match(html,/\/sprite-renderer\.js/, `${name}: share renderer`);
  assert.match(html,/UDSprites\?\.mount/, `${name}: mount renderer`);
}
assert.match(config,/name = "universalduels"/);
assert.match(config,/id = "453d2d63210e42149663b5771e76a803"/);
await import('./public/sprite-renderer.js');
const {frameRect,computeLayout} = globalThis.UDSprites;
assert.deepEqual(frameRect(208,192,'front'),{x:0,y:0,width:104,height:192});
assert.deepEqual(frameRect(208,192,'back'),{x:104,y:0,width:104,height:192});
assert.deepEqual(frameRect(209,192,'back'),{x:104,y:0,width:105,height:192});
for (const view of ['front','back']) {
  const r=computeLayout({width:35,height:95},{width:83,height:125},view,190,190);
  assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=190&&r.y+r.height<=190,'nondeforming and centered within stage');
  assert.ok(Math.abs(r.width/r.height-(view==='front'?35/95:83/125))<1e-9,'image aspect ratio preserved');
}
console.log('Alpha 0.5: turno único, narración inferior, medallones, recorte geométrico y bindings Main OK');
