import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Mantener la misma lectura visual de flechas que Main en el Laboratorio.
const html=readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
const declaration=html.match(/^\s*function affinity\(moveType,target\)\{[^\n]+/m)?.[0];
assert.ok(declaration,'Falta la función afinidad del Laboratorio');
const ctx={typeChart:{fuego:{a:'eficaz',b:'eficaz',c:'eficaz',d:'ineficaz',e:'ineficaz',f:'ineficaz'}}};
vm.runInNewContext(declaration,ctx);
for(const [types,expected] of [
  [['a'],'↑'],[['a','b'],'↑↑'],[['a','b','c'],'↑↑↑'],
  [['d'],'↓'],[['d','e'],'↓↓'],[['d','e','f'],'↓↓↓'],
  [['a','d'],'↑'],[['a','b','d'],'↑'],
]){
  const actual=vm.runInNewContext(`affinity('fuego',{types:${JSON.stringify(types)}})`,ctx);
  assert.equal(actual.text,expected,`Laboratorio: ${types.join(',')}`);
  assert.ok((actual.text.match(/↑|↓/g)||[]).length<=types.length,'nunca más flechas que tipos');
}
assert.equal(vm.runInNewContext("affinity('fuego',{types:['x']})",ctx).text,'');
ctx.typeChart={fuego:{a:'inmune'}};
assert.equal(vm.runInNewContext("affinity('fuego',{types:['a']})",ctx).text,'INMUNE');
console.log('Alpha 0.8: Laboratorio mantiene flechas correctas por tipos del defensor');
