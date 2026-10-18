import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const html=readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
test('las reglas de estado conservan Y/O y NO, no fuerzan AND al guardarse',()=>{
 assert.match(html,/operator:val\("operator"\),negate:val\("negate"\)==="true"/);
 assert.doesNotMatch(html,/operator:catalogCategory\.value==='statuses'\?'AND'/);
 assert.doesNotMatch(html,/negate:catalogCategory\.value==='statuses'\?false/);
});
test('duplicar regla utiliza valores actuales, incluidos operadores y condiciones extra',()=>{
 assert.match(html,/Duplicar efecto/);
 assert.match(html,/structuredClone\(readRuleRow\(row\)\)/);
 assert.match(html,/addRule\(copy\)/);
 assert.match(html,/operator:item\.querySelector\('\[data-condition-part="operator"\]'\)\.value/);
});
test('duplicar efecto de entorno utiliza la misma lectura que guardarlo',()=>{
 assert.match(html,/structuredClone\(readEnvironmentEffectRow\(row\)\)/);
 assert.match(html,/function readEnvironmentEffects\(\)\{return \[\.\.\.environmentEffects\.children\]\.map\(readEnvironmentEffectRow\)/);
});
