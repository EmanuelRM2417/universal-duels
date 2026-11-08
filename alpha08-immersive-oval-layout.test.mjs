import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const home=read('./public/index.html'),practice=read('./public/practice.html'),catalog=read('./public/catalog.html'),tutorial=read('./public/tutorial.html');
assert.match(home,/#udEmbeddedOverlay\{inset:0!important;border:0!important;border-radius:0!important/,'pantallas sin borde de ventana superpuesta');
assert.match(home,/#udEmbeddedOverlay \.ud-embedded-header\{display:none!important/,'se elimina encabezado superpuesto');
assert.match(home,/frame\.src=kind==='tutorial'\?'\/practice\.html\?guided=1'/,'pantallas internas conservan URL Main');
assert.match(home,/id="udAccountEditNick" hidden>Perfil</,'Perfil reemplaza el nombre anterior del botón');
assert.match(practice,/id="udPracticeReturnHome"[^>]+>Volver al menú principal/,'lobby botón real');
assert.match(practice,/udPracticeHomeNav\.hidden=!\$\('battleView'\)\.classList\.contains\('hidden'\)/,'botón oculto en batalla');
assert.match(practice,/udPracticeViewObserver\.observe\(\$\('battleView'\)/,'observa cambios de etapa sin URL');
assert.match(practice,/window\.parent\.postMessage\(\{type:'ud-close-embedded'\}/,'volver al menú sin recargar el juego');
for(const [section,s] of [['catálogo',catalog],['tutorial',tutorial]]){
 assert.match(s,/ud-close-embedded/,'volver desde '+section+' dentro del menú');
 assert.match(s,/Volver al menú principal/,'botón de '+section+' con texto correcto');
}
for(const s of [home,practice]){
 assert.match(s,/\.battle-stage::after\{left:var\(--ud-oval-x/,'posición de óvalo configurada');
 assert.match(s,/--ud-oval-y/);
 assert.match(s,/--ud-oval-width/);
 assert.match(s,/--ud-oval-height/);
 assert.match(s,/function udApplyOvalLayout\(oval\)/,'función aplica publicación');
}
assert.match(home,/udApplyOvalLayout\(config\?\.fieldOval\)/,'Main recibe layout publicado');
assert.match(practice,/udApplyOvalLayout\(d\.uiLayout\?\.fieldOval\)/,'Entrenamiento recibe layout publicado');
console.log('Alpha 0.8: navegación sin cambio de URL, botón solo lobby, perfil y óvalo publicado OK');
