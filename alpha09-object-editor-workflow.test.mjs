import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EVENTS,validateDefinition} from './catalog-validation.js';
const itemRule=event=>({event,condition:{type:'always',value:''},conditions:[],target:'self',action:{type:'heal',value:25},chance:100,duration:0,limit:0,operator:'AND',negate:false});
for(const event of EVENTS){
 const d={spriteId:'manzana',timing:'priority',priority:0,rules:[itemRule(event)]};
 assert.doesNotThrow(()=>validateDefinition('items',d),`${event} debe aceptarse en objetos`);
}
const ui=readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
assert.match(ui,/data-view="objects"/);
assert.match(ui,/data-studio-view="objects"/);
assert.match(ui,/udCatalogSharedPanel/);
assert.match(ui,/isItem\?'Momento del efecto':'Evento'/);
assert.match(ui,/'Al usar el consumible'/);
assert.match(ui,/narratorMessage/);
assert.match(ui,/method:'POST',headers:\{'Content-Type':'image\/png'\}/);
assert.match(ui,/URL\.createObjectURL\(file\)/);
const server=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
assert.ok(server.indexOf("url.pathname==='/editor-api/item-sprites'&&request.method==='POST'")<server.indexOf("url.pathname==='/editor-api/item-sprites'&&request.method==='GET'"),'carga separada de consulta');
for(const text of ['EDITOR_SPRITES.put(`item-sprites/${id}.png`','w!==h','Cache-Control','contentType:\'image/png\''])assert.ok(server.includes(text),`Falta ${text}`);
assert.match(server,/validateDefinition\(category,d\)/,'guardado privado valida definiciones');
console.log('Alpha 0.9: guardado, categorías, 19 momentos, carga R2, vista previa y sprites: OK');
