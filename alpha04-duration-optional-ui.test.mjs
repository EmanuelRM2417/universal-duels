import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
assert.match(html,/duration:val\("duration"\)===""\?0:Number\(val\("duration"\)\)/,'Las acciones sin duración deben guardar cero en vez de null');
assert.match(html,/durationActions\.includes\(rule\.action\.type\)/,'Solo efectos con duración deben exigirla');
assert.match(html,/durationActions=\['apply_status'/,'La validación reconoce las acciones temporales');
assert.match(html,/\['apply_status','suppress_abilities','restrict_moves','environment_immunity','prevent_environment','cooldown_on_use','immunity','survive'\]/,'La interfaz conserva la visibilidad condicional');
assert.doesNotMatch(html,/for\(const key of \["chance","duration","limit"\]\) if\(rule\[key\]===null/,'La validación ya no exige duration a todas las acciones');
console.log('Duraciones opcionales, 99 y visibilidad condicionada: OK');
