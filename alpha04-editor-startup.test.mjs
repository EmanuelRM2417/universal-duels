import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
assert.match(html,/<select id="simLeftMove" hidden><\/select>/);
assert.match(html,/<select id="simRightMove" hidden><\/select>/);
assert.doesNotMatch(html,/refreshTemplateTools\(\)/,'La función eliminada impedía inicializar referencias del editor');
assert.match(html,/id="releasePreview"/);
assert.match(html,/id="compareRegression"/);
console.log('Alpha 0.4: inicio del editor, controles select del simulador y herramientas de publicación OK');

const root=readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
const lab=readFileSync(new URL('./public/lab/index.html',import.meta.url),'utf8');
assert.match(root,/<meta http-equiv="refresh" content="0;url=\/editor\/">/);
assert.match(root,/location\.replace\('\/editor\/'/);
assert.match(lab,/Abrir editor actualizado/);
assert.match(lab,/location\.href='\/editor\/'/);
assert.match(html,/ESTUDIO PRIVADO · BORRADORES · ALPHA 0\.4/);
assert.match(html,/UD-EDITOR-ALPHA04-ETIQUETAS-20261017/);
console.log('Enlace al editor actualizado y versión visible OK');
