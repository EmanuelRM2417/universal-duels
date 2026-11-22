import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
for (const page of ['index.html','practice.html']) {
 const html=readFileSync(new URL('./public/'+page,import.meta.url),'utf8');
 assert.match(html,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/,'panel de cuatro casillas');
 assert.match(html,/#battleItem[^}]*grid-column:1!important;grid-row:1!important/,'Consumible en esquina superior izquierda');
 assert.match(html,/\.ud-item-selection-list button:hover:not\(:disabled\)/,'selección interactiva');
 assert.match(html,/function udOpenItemPicker\(\)/,'ventana de tres consumibles');
 assert.match(html,/id="udDeselectItem"/,'consumible deseleccionable');
 assert.match(html,/data-ud-item=.*?x\.used\|\|x\.reserved\?'disabled':''/,'exclusividad de reserva en Doubles');
 assert.match(html,/function udAnimateItemUsed\(e\)[\s\S]*?innerHTML=`<img src="\$\{img\}" alt="">`/,'animación con sprite, sin texto');
 assert.doesNotMatch(html,/\(oculto[s]? para el rival\)/i);
 assert.match(html,/consumió/,'narrador recibe mensaje de consumo sin reescritura');
}
console.log('Alpha 0.9: interfaz de consumibles, cuatro casillas, selector, sprite y narrador: OK');
