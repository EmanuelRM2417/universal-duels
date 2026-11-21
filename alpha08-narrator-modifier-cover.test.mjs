import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
const generated=readFileSync(new URL('./public/editor/narrator-engine-templates.js',import.meta.url),'utf8');
const script=readFileSync(new URL('../universal-duels-main/public/narrator-templates.js',import.meta.url),'utf8');
const context={window:{}};
vm.runInNewContext(generated,context);
vm.runInNewContext(script,context);
const start=html.indexOf(' const templates=['),end=html.indexOf(' let layout={}',start);
assert.ok(start>0 && end>start);
vm.runInNewContext(html.slice(start,end)+'\nglobalThis.patterns=templates;',context);
const patterns=context.patterns.map(([g,p])=>p);
assert.ok(patterns.length>=250);
for(const [,phrase] of context.window.udEngineNarratorTemplates)assert.ok(patterns.includes(phrase));
const examples=[
 ['La potencia de Bomba volcánica de Caracol volcánico ahora es 80.','La potencia de [MOVIMIENTO] de [ATACANTE] ahora es [VALOR].'],
 ['La precisión de Bomba volcánica de Caracol volcánico ahora es 90 %.','La precisión de [MOVIMIENTO] de [ATACANTE] ahora es [VALOR] %.'],
 ['La probabilidad de crítico de Bomba volcánica de Caracol volcánico ahora es 25 %.','La probabilidad de crítico de [MOVIMIENTO] de [ATACANTE] ahora es [VALOR] %.']
];
for(const [line,original] of examples){
 assert.ok(patterns.includes(original),`El editor muestra la plantilla para ${line}`);
 const replacement='EDITADO [MOVIMIENTO] / [ATACANTE] / [VALOR]';
 assert.equal(context.window.udNarratorFormat(line,[{pattern:original,replacement}]),'EDITADO Bomba volcánica / Caracol volcánico / '+line.split('es ')[1].replace(/ \%?\.$/,'').replace(/\.$/,''));
}
console.log('Narrador: biblioteca extraída + 3 estadísticas editables con variables, sin cambiar plantillas originales: OK');
