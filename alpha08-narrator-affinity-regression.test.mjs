import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulate} from './battle-engine.js';
const html=readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
for(const text of ['[PERSONAJE] recibe [DAÑO] de daño.','Es fuerte.','Es muy fuerte.','Es extremadamente fuerte.','Es débil.','Es muy débil.','Es extremadamente débil.','[PERSONAJE] es inmune al ataque.']){
 assert.ok(html.includes(text),`Falta el patrón de narración en Editor: ${text}`);
}
assert.doesNotMatch(html,/\['Daño','\[PERSONAJE\] ahora tiene \[DAÑO\] de daño\.'/,'la plantilla errónea no se ofrece como mensaje real');
assert.match(html,/input\.dataset\.narratorPattern=pattern/,'cada mensaje sigue asociado al patrón original');
assert.match(html,/const current=changes\.get\(pattern\)\|\|pattern/,'el buscador usa el reemplazo actual');
assert.match(html,/const rules=\[\.\.\.changes\]/,'los mensajes personalizados se guardan');
const engine=readFileSync(new URL('./battle-engine.js',import.meta.url),'utf8');
assert.match(engine,/announcedTypeImmunity/);
assert.match(engine,/state\.log\.push\(`Es \$\{intensity\}/);
console.log('Alpha 0.8: plantillas de daño/afinidad editables, buscador actualizado y origen de mensajes compartido OK');
