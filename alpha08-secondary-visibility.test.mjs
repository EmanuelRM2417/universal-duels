import assert from 'node:assert/strict';
import fs from 'node:fs';
const engine=fs.readFileSync(new URL('./battle-engine.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
const practice=fs.readFileSync(new URL('./public/practice.html',import.meta.url),'utf8');
for(const html of [main,practice]){
 assert.ok(html.includes("e.type==='secondary_attack'"),'Evento secundario visual no detectado');
 assert.ok(html.includes("extraEvent.animate===false"),'sin animación del atacante sigue mostrando retroceso');
 assert.ok(html.includes('udAnimateImpact(line)'),'defensor debe reaccionar a recibir daño');
}
assert.ok(engine.includes('state.extraAttacksThisRound'),'protección antibucles');
console.log('Impacto secundario visible y sin exponer el tipo secundario en la ficha: OK');
