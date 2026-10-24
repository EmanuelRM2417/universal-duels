import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACTION_MS,REPLACEMENT_MS,actionLimit,replacementLimit} from './worker.js';
const main=readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
const training=readFileSync(new URL('./public/practice.html',import.meta.url),'utf8');
for(const [name,html] of [['Salas',main],['Entrenamiento',training]]){
 assert.match(html,/aspect-ratio:4\/3!important/,`${name}: escena 4:3`);
 assert.match(html,/\.battle-stage::before\{display:none!important;content:none!important\}/,`${name}: eliminar suelo rival`);
 assert.match(html,/--field-color/,`${name}: color del campo limitado a la arena`);
 assert.match(html,/\.battle-stage::after\{left:1%!important;right:1%!important/,`${name}: óvalo ampliado`);
 assert.match(html,/\.battle-command-panel:empty\{display:grid!important;visibility:hidden\}/,`${name}: espacio fijo del panel`);
 assert.match(html,/class="ud-move-info" data-move-info/,`${name}: botón independiente de información`);
 assert.match(html,/querySelectorAll\('\[data-move-info\]'\)/,`${name}: botón conectado al modal`);
 assert.match(html,/class="ud-action-spacer" aria-hidden="true"/,`${name}: hueco de Info reservado`);
 assert.doesNotMatch(html,/id="battleMoveInfo"/,`${name}: sin botón Info que cambia el panel`);
 assert.match(html,/battle-command-panel \.battle-move-grid/,`${name}: cuadrícula de ataques fuera de la arena`);
}
assert.equal(ACTION_MS,60000);
assert.equal(actionLimit('singles'),60000);
assert.equal(actionLimit('doubles'),120000);
assert.equal(REPLACEMENT_MS,15000);
assert.equal(replacementLimit('doubles',2),30000);
assert.match(training,/session\.phase==='replacement'\?15000:60000/,'Entrenamiento opcional usa mismo tiempo');
const home=main.slice(main.indexOf('<section id="home"'),main.indexOf('<section id="teamBuilder"'));
for(const id of ['name','create','joinCode','join','udTutorialOpen','udHomePractice','udHomeCatalog','udHomeTeams'])assert.match(home,new RegExp(`id="${id}"`));
assert.doesNotMatch(home,/udHomeVolume/,'sin volumen duplicado');
assert.match(home,/ud-home-actions/,'menú en dos columnas');
assert.doesNotMatch(main,/Contenido \$\{revision\} cargado/,'ocultar mensaje de parche');
console.log('Alpha 0.7 corrective layout: main/practice 4:3, field oval, fixed panel, movement info, timers, menu OK');
