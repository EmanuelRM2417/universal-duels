import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateRules} from './catalog-validation.js';
const html=fs.readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const generator=fs.readFileSync(new URL('./build-narrator-templates.cjs',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('./battle-engine.js',import.meta.url),'utf8');
const templatesSource=fs.readFileSync(new URL('./public/editor/narrator-engine-templates.js',import.meta.url),'utf8');
const box={window:{}};vm.runInNewContext(templatesSource,box);
const templates=Array.from(box.window.udEngineNarratorTemplates);
assert.ok(templates.length>=100,'Editor debe enumerar al menos 100 variantes reales del narrador');
assert.ok(generator.includes('log.push'),'el catálogo del narrador se extrae desde el motor');
assert.ok(source.includes('state.log.push'),'existen mensajes emitidos por motor');
for(const essential of ['consumió [CONSUMIBLE]', 'Ronda [NUMERO]', 'recupera [PS] PS', 'entra al campo','cooldown activo','se desactivó', 'se moverá primero'])
 assert.ok(templates.some(([,line])=>line.includes(essential)),'falta mensaje del narrador: '+essential);
assert.ok(!templates.some(([,line])=>line==='[VALOR]'),'ningún patrón genérico que capture todos los mensajes');
assert.match(html,/narrator-engine-templates\.js/,'narrador carga catálogo generado');
assert.match(html,/máximo 3000/,'Editor permite personalizar miles de mensajes');
assert.match(worker,/narratorRules\.length>3000/,'servidor acepta las mismas reglas que el Editor');
assert.match(html,/searchable-selects\.js/,'Editor incorpora buscadores en desplegables');
const search=fs.readFileSync(new URL('./public/editor/searchable-selects.js',import.meta.url),'utf8');
for(const s of ['MutationObserver','createElement(\'input\')','select.after(trigger)','dispatchEvent','toLocaleLowerCase'])assert.ok(search.includes(s),'buscador conserva select nativo: '+s);
const base={event:'on_condition',target:'self',action:{type:'adjust_received_damage',value:50,damageClass:'physical',typeFilter:{mode:'include',types:['agua','neutral']},targetingFilter:['single','enemy_team']},chance:100,duration:2,limit:0,condition:{type:'always'},conditions:[]};
assert.doesNotThrow(()=>validateRules({rules:[base]},'abilities'));
for(const invalid of [{value:600},{damageClass:'passive'},{typeFilter:{mode:'include',types:['inventado']}},{targetingFilter:['ilegal']}])
 assert.throws(()=>validateRules({rules:[{...base,action:{...base.action,...invalid}}]},'abilities'));
console.log('Editor: 100+ narraciones, filtros de daño y búsqueda por listas: OK');
