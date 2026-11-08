import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// La afinidad debe mostrarse por cantidad de relaciones de tipo, no con el
// mismo umbral porcentual para ventajas (+30%) y resistencias (-20%).
const chart={fuego:{a:'eficaz',b:'eficaz',c:'eficaz',d:'ineficaz',e:'ineficaz',f:'ineficaz'}};
for(const page of ['index.html','practice.html']){
  const html=readFileSync(new URL('./public/'+page,import.meta.url),'utf8');
  const declaration=html.match(/^function affinity\(moveType,target\)\{[^\n]+/m)?.[0];
  assert.ok(declaration,`Falta la función de afinidad en ${page}`);
  const ctx={chart};
  vm.runInNewContext(declaration,ctx);
  for(const [types,expected,style] of [
    [['a'],'↑','a20'],[['a','b'],'↑↑','a40'],[['a','b','c'],'↑↑↑','a60'],
    [['d'],'↓','a20'],[['d','e'],'↓↓','a40'],[['d','e','f'],'↓↓↓','a60'],
    [['a','d'],'↑','a20'],[['a','b','d'],'↑','a20'],
  ]){
    const actual=vm.runInNewContext(`affinity('fuego',{types:${JSON.stringify(types)}})`,ctx);
    assert.equal(actual.text,expected,`${page}: ${types.join(',')} debe ser ${expected}`);
    assert.equal(actual.cls,style,`${page}: color de intensidad ${expected}`);
    assert.ok((actual.text.match(/↑|↓/g)||[]).length<=types.length,`${page}: nunca más flechas que tipos defensores`);
  }
  const neutral=vm.runInNewContext("affinity('fuego',{types:['x']})",ctx);
  assert.equal(neutral.text,'',`${page}: neutral no tiene flechas`);
  const immuneChart={fuego:{a:'inmune'}};
  ctx.chart=immuneChart;
  assert.equal(vm.runInNewContext("affinity('fuego',{types:['a']})",ctx).text,'INMUNE',`${page}: inmunidad`);
}
console.log('Alpha 0.8: flechas y colores reflejan +30/+60/+90 y −20/−40/−60 en Main y Entrenamiento');
