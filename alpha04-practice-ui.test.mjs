import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./public/practice.html',import.meta.url),'utf8');
for(const feature of ['function renderPracticeRoster','function validTargetPositions','function openTargetPicker','function openSwitchPicker','function openReplacementPicker','function animateLogLines','function showSession','function refresh',"localStorage.removeItem(KEY)"]){
  assert.ok(html.includes(feature),`La función/interfaz de entrenamiento debe conservar ${feature}`);
}
for(const visual of ['battle-stage','battle-sprite-sheet','battle-hp-fill','battle-modal','battle-message','function effectRows','function environmentLayers','function typeTableBody','function logBody','data-battle-modal'])assert.ok(html.includes(visual),`Entrenamiento sin interfaz completa: ${visual}`);
assert.match(html,/const udSound=createSoundDirector/);
assert.match(html,/udSound.context\('battle'/);
assert.match(html,/udRotateDevice/);
assert.doesNotMatch(html,/id="enemies" class="grid"/);
console.log('Alpha 0.5: Entrenamiento con interfaz visual completa, objetivos, audio y reconexión OK');
