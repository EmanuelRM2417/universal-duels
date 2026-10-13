import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateRelease,publicationDiff,nextHistory,selectRelease} from './release-control.js';
import {runRegressionCase,normalizeRegressionCase,seededRandom} from './regression-suite.js';
const common={kind:'global',type:'fuego',category:'physical',power:50,accuracy:100,criticalChance:0,priority:0,rules:[]};
const move=(id,kind='global')=>({id,definition:{...common,kind}});
const ab=(id,kind)=>({id,definition:{kind,rules:[]}});
const entity=id=>({id,name:id,definition:{types:['fuego'],hp:180,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:['m1','m2','m3'],uniqueMoveId:'m4',globalAbilityId:'global-a',uniqueAbilityId:'unique-a',rules:[]}});
const catalog={entities:{a:entity('a'),b:entity('b')},moves:{m1:move('m1'),m2:move('m2'),m3:move('m3'),m4:move('m4','unique')},abilities:{'global-a':ab('global-a','global'),'unique-a':ab('unique-a','unique')},effects:{},statuses:{},weathers:{},fields:{},scenarios:{}};
const valid=validateRelease(catalog,{});assert.equal(valid.ok,true,valid.errors.join('\n'));assert.ok(valid.warnings.some(w=>w.includes('ocho')));
const broken=structuredClone(catalog);broken.entities.a.definition.moveIds[0]='not-published';assert.equal(validateRelease(broken,{}).ok,false);
const badAbility=structuredClone(catalog);badAbility.entities.a.definition.globalAbilityId='unique-a';assert.equal(validateRelease(badAbility,{}).ok,false);
const diff=publicationDiff({catalog},{catalog:{...catalog,entities:{...catalog.entities,c:entity('c')}}});assert.deepEqual(diff.entities.added,['c']);
assert.deepEqual(nextHistory([{revision:'old'}],{revision:'new'}).map(x=>x.revision),['new','old']);

const draft=structuredClone(catalog);draft.entities.c=entity('c');draft.moves.m5=move('m5');draft.entities.c.definition.moveIds[0]='m5';
const selective=selectRelease(catalog,draft,{entities:['c']});
assert.ok(selective.catalog.entities.c);assert.ok(selective.catalog.moves.m5);
assert.deepEqual(selective.autoIncluded,['moves/m5']);
assert.equal(validateRelease(selective.catalog,{}).ok,true);
const noMove=selectRelease(catalog,draft,{moves:['m1']});assert.equal(noMove.catalog.moves.m1!==undefined,true);
const deletion=selectRelease(catalog,draft,{moves:['m1']}); // draft still has m1, so no change
const deletedDraft=structuredClone(catalog);delete deletedDraft.moves.m1;
const brokenDelete=selectRelease(catalog,deletedDraft,{moves:['m1']});
assert.equal(validateRelease(brokenDelete.catalog,{}).ok,false);

const test=normalizeRegressionCase({name:'Golpe determinista',config:{leftTeam:['a'],rightTeam:['b'],mode:'singles',turns:1,leftOrders:[{move:'m1'}],rightOrders:[{move:'m2'}],seed:104}});
const run1=runRegressionCase(test,catalog,{}),run2=runRegressionCase(test,catalog,{});assert.deepEqual(run1.actual,run2.actual);
assert.equal(runRegressionCase({...test,expected:run1.actual},catalog,{}).passed,true);
assert.equal(runRegressionCase({...test,expected:{...run1.actual,winner:'right'}},catalog,{}).passed,false);
const d1=seededRandom(777),d2=seededRandom(777);assert.deepEqual([d1(),d1(),d1()],[d2(),d2(),d2()]);
const wrong=structuredClone(test);wrong.config.turns=61;assert.throws(()=>runRegressionCase(wrong,catalog,{}),/60/);
const config=fs.readFileSync(new URL('./wrangler.toml',import.meta.url),'utf8');
assert.match(config,/binding = "PUBLIC_CONTENT"/);assert.match(config,/binding = "EDITOR_SPRITES"/);
const code=fs.readFileSync(new URL('./worker.js',import.meta.url),'utf8');
assert.match(code,/env\.PUBLIC_CONTENT\.put\('public-v1:current'/);assert.doesNotMatch(code,/env\.EDITOR_DRAFTS\.put\('public-v1:current'/);
assert.match(code,/release-preview/);assert.match(code,/release-rollback/);
console.log('Alpha 0.4: validación de dependencias, historial, regresión determinista y enlace a KV/R2 público OK');

// Safety invariant: editor and public must never deploy to the same Worker name.
import {readFileSync} from "node:fs";
const own=readFileSync(new URL('./wrangler.toml',import.meta.url),'utf8');
const ownName=own.match(/^name = "([^"]+)"/m)?.[1];
assert.ok(ownName && ownName!=='duelo-pixel-rooms','El editor no puede usar el nombre conocido del Worker público.');
// Individual ZIPs must be testable without requiring the other ZIP extracted.
// A separate combined integration test checks both names dynamically.

