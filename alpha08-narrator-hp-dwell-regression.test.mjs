import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const sandbox={window:{}};
vm.runInNewContext(read('./public/narrator-templates.js'),sandbox);
const render=sandbox.window.udNarratorFormat;
const outdated=[{pattern:'[CLIMA]: [PERSONAJE] pierde [PS] PS ([PORCENTAJE] %).',replacement:'[CLIMA]: [PERSONAJE] ya no tiene [PS] PS ([PORCENTAJE] %).'}];
assert.equal(render('Inframundo: Adolf Hitler pierde 13 PS (5 %).',outdated),'Inframundo: Adolf Hitler pierde 13 PS (5 %).');
assert.equal(render('Inframundo: Adolf Hitler ya no tiene 13 PS (5 %).',[]),'Inframundo: Adolf Hitler pierde 13 PS (5 %).');
assert.equal(render('Tormenta: Ajolote pierde 10 PS (20 %).',outdated),'Tormenta: Ajolote pierde 10 PS (20 %).');
assert.equal(render('Adolf Hitler pierde 13 PS (5 %).',[]),'Adolf Hitler pierde 13 PS (5 %).');
assert.equal(render('Adolf Hitler ahora tiene 23 de daño.',[]),'Adolf Hitler recibe 23 de daño.');
assert.equal(render('Ajolote recibe 25 de daño.',[{pattern:'[PERSONAJE] recibe [DAÑO] de daño.',replacement:'[PERSONAJE] ahora tiene [DAÑO] de daño.'}]),'Ajolote recibe 25 de daño.');
assert.equal(render('Ajolote recupera 13 PS (5 %).',[{pattern:'[PERSONAJE] recupera [PS] PS ([PORCENTAJE] %).',replacement:'[PERSONAJE] se cura [PS] PS.'}]),'Ajolote se cura 13 PS.','custom messages unrelated to the old error remain customizable');
for(const page of ['./public/index.html','./public/practice.html']){
  const html=read(page);
  assert.match(html,/udHeadlineAt=Date\.now\(\)/,page+' records when move headline appeared');
  assert.match(html,/await wait\(Math\.max\(0,\(1700\*speedFactor\(\)-\(Date\.now\(\)-udHeadlineAt\)\)\/speedFactor\(\)\)\)/,page+' reserves its own read time');
  assert.match(html,/extremadamente \|muy /,page+' recognizes separate intensity narration');
}
assert.match(read('./public/index.html'),/const playbackLimit=battle\?\.phase==='replacement'\?8000:18000;/,'online deadline reserves time for longer commentary');
console.log('Alpha 0.8: narrator HP loss corrected from obsolete overrides; move headline and affinity timing separate');
