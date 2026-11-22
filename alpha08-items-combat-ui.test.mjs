import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const practice=readFileSync(new URL('./practice-session.js',import.meta.url),'utf8');
for(const file of ['index.html','practice.html']){
 const html=readFileSync(new URL('./public/'+file,import.meta.url),'utf8');
 assert.equal((html.match(/<button id="battleItem" disabled>Consumible<\/button>/g)||[]).length,1,'solo se deshabilita en el estado sin actor '+file);
 assert.ok(html.includes("udItemChoices().some(x=>!x.used&&!x.reserved)"),'el botón de objeto puede habilitarse '+file);
 for(const token of ['udOpenItemPicker','udPendingItem','udAnimateItemUsed','udDeselectItem','function udItemBlocked','data-ud-item','function udItemChoices','udPendingItem=null'])assert.ok(html.includes(token),`falta ${token} en ${file}`);
}
for(const source of [worker,practice]){
 for(const token of ['leftItems','rightItems','usedItems'])assert.ok(source.includes(token),`falta ${token} en el servidor`);
}
assert.ok(worker.includes('role===\'host\'?[...(b.lastState?.items?.left||[])]:[]'),'la selección izquierda no se envía al rival');
assert.ok(worker.includes('role===\'guest\'?[...(b.lastState?.items?.right||[])]:[]'),'la selección derecha no se envía al rival');
assert.ok(practice.includes('right:[]'),'los objetos de la IA permanecen ocultos');
console.log('Interfaz y servidor: botones utilizables, cancelación, privacidad y sprites: OK');
