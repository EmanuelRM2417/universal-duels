import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const game=readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
const practice=readFileSync(new URL('./public/practice.html',import.meta.url),'utf8');
const catalog=readFileSync(new URL('./public/catalog.html',import.meta.url),'utf8');
for(const anchor of ['battleStage','battleModal','battleSwitch','battleMoveInfo','battleCancelMove','battleModalBody']){
 assert.match(practice,new RegExp(anchor),'Pantalla de práctica requiere '+anchor);
}
const gameCss=game.match(/<style>([\s\S]*?)<\/style>/)[1];
const practiceCss=practice.match(/<style>([\s\S]*?)<\/style>/)[1];
assert.ok(practiceCss.startsWith(gameCss),'Práctica debe reutilizar exactamente las reglas visuales de la sala');
for(const name of ['unitHTML','renderBattle','openTargetPicker','openSwitchPicker','openModal','openReplacementPicker'])assert.match(practice,new RegExp('function '+name+'\\('));
assert.match(practice,/function commitAction\(act\)/);
assert.match(practice,/pUnits\(battleLastData\)\.playerActive\.filter\(u=>u\.hp>0\)\.length/);
assert.match(practice,/selected\.some\(y=>y\.teamIndex===x\.i\)/);
assert.match(practice,/localStorage\.removeItem\(KEY\)/);
assert.match(catalog,/function plain\(value\)/);
assert.match(catalog,/template\.content\.textContent/);
console.log('Práctica: interfaz de sala, sprites, objetivos, cambios y catálogo de texto OK');
