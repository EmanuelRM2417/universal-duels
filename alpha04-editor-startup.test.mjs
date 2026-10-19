import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
assert.match(html,/<select id="simLeftMove" hidden><\/select>/);
assert.match(html,/<select id="simRightMove" hidden><\/select>/);
assert.doesNotMatch(html,/refreshTemplateTools\(\)/,'La función eliminada impedía inicializar referencias del editor');
assert.match(html,/id="releasePreview"/);
assert.match(html,/id="compareRegression"/);
console.log('Alpha 0.4: inicio del editor, controles select del simulador y herramientas de publicación OK');
