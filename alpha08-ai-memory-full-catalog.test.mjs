import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readFullDraftCatalog,mergePublishedAndDraftCatalog} from './ai-catalog.js';
import {buildFullAICatalog,chunkFullAIContext,getAICatalogCounts,generateAICharacter} from './ai-character.js';
import {recordAIGeneration,approveAIGeneration,deleteAIGeneration,listAIGenerations,listApprovedAIMemories,learningContext,previewAIGeneration} from './ai-memory.js';
const move=id=>({id,category:'moves',name:'Mov '+id,description:'Prueba '+id,definition:{kind:'global',type:'agua',category:'special',power:40,accuracy:100,criticalChance:0,priority:0,cooldown:0,targeting:'single',rules:[]}});
const ability=id=>({id,category:'abilities',name:'Hab '+id,description:'Prueba '+id,definition:{kind:'global',rules:[]}});
const catalog={entities:{},moves:{},abilities:{},effects:{},statuses:{},weathers:{},scenarios:{},fields:{},tags:{},tutorial:{}};
for(let i=0;i<72;i++)catalog.entities['entity-'+i]={id:'entity-'+i,name:'Personaje '+i,description:'Lore '+i+' '+('Z'.repeat(1500)),definition:{types:['agua'],hp:100,attack:70,defense:70,specialAttack:70,specialDefense:70,speed:70,rules:[{event:'on_attack',value:'Ent'+i}]}};
for(let i=0;i<101;i++)catalog.moves['m'+i]=move('m'+i);
for(let i=0;i<57;i++)catalog.abilities['a'+i]=ability('a'+i);
for(let i=0;i<37;i++)catalog.effects['ef'+i]={id:'ef'+i,name:'Efecto '+i,description:'Descripción '+i,definition:{kind:'global',rules:[]}};
for(let i=0;i<12;i++)catalog.statuses['status'+i]={id:'status'+i,name:'Estado '+i,definition:{rules:[]}};
const chart={agua:{fuego:'strong',planta:'weak'}};
const full=buildFullAICatalog(catalog,chart,[{id:'example-x',feedback:'Mi preferencia de balance'}]);
assert.equal(full.entries.length,72+101+57+37+12);
assert.deepEqual(getAICatalogCounts(catalog).entities,72);
assert.ok(full.entries.some(e=>e.id==='m100'&&e.definition.power===40));
assert.ok(full.entries.some(e=>e.id==='entity-71'&&e.definition.rules[0].value==='Ent71'));
assert.equal(full.approvedCorrections.length,1);
const chunks=chunkFullAIContext(full,5000);
assert.ok(chunks.length>10);
for(const id of ['entity-71','m100','a56','ef36','status11'])assert.ok(chunks.join('\n').includes(id),'Falta en fragmentos: '+id);
assert.ok(chunks.join('\n').includes('type-chart'));

const proposal={types:['agua','planta'],stats:{hp:100,attack:50,defense:50,specialAttack:100,specialDefense:80,speed:70},globalMoves:['m1','m2','m3'],globalAbility:'a1',uniqueMove:{name:'Olas',description:'Ataque acuático',definition:{kind:'unique',type:'agua',category:'special',power:80,accuracy:100,criticalChance:5,priority:0,cooldown:0,targeting:'single',rules:[]}},uniqueAbility:{name:'Corriente',description:'Habilidad',definition:{kind:'unique',rules:[]}},characterDescription:'Personaje de prueba',researchNotes:'Origen probado',references:[]};
const calls=[];
const result=await generateAICharacter({name:'Ajolote',spriteId:'ajolote',catalog,chart,approvedExamples:full.approvedCorrections,apiKey:'test-key',fetcher:async(url,request)=>{
 const payload=JSON.parse(request.body);calls.push(payload);
 if(payload.tools){
  assert.equal(payload.text,undefined,'La búsqueda web no debe usar formato JSON.');
  return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Investigación web: anfibio de México.',annotations:[{url:'https://example.org/ajolote'}]}]}]})};
 }
 if(payload.text?.format?.type==='json_object')return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify(proposal)}]}]})};
 return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Análisis de todo el fragmento.'}]}]})};
}});
assert.ok(calls.length>2,'Catálogo grande debe procesarse por fragmentos completos y hacer dos etapas finales.');
assert.ok(calls.at(-2).tools.some(t=>t.type==='web_search'));
assert.equal(calls.at(-1).text?.format?.type,'json_object');
assert.equal(calls.at(-1).tools,undefined);
const allInput=calls.map(c=>typeof c.input==='string'?c.input:JSON.stringify(c.input)).join('\n');
for(const id of ['entity-71','m100','a56','ef36','status11'])assert.ok(allInput.includes(id),'El modelo no recibió '+id);
assert.ok(JSON.stringify(calls.at(-1).input).includes('anfibio de México'));
assert.deepEqual(result.references,['https://example.org/ajolote']);
assert.equal(result.catalogCounts.moves,101);
assert.equal(result.learningExamplesUsed,1);

// Catálogo pequeño: se envían las definiciones originales directamente, sin resumir.
const small={moves:{m1:move('m1'),m2:move('m2'),m3:move('m3')},abilities:{a1:ability('a1')},entities:{'one':{id:'one',name:'uno',description:'EJEMPLO_INTEGRO',definition:{hp:123}}},effects:{'rare':{id:'rare',name:'Impedir',description:'EFECTO_UNICO',definition:{rules:[]}}}};
let direct;
let researchCalls=0;
await generateAICharacter({name:'Ajolote',spriteId:'ajolote',catalog:small,apiKey:'test',fetcher:async(url,request)=>{
 const payload=JSON.parse(request.body);
 if(payload.tools){researchCalls++;return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Anfibio real.'}]}]})};}
 direct=payload;
 return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify(proposal)}]}]})};
}});
assert.equal(researchCalls,1);
assert.equal(direct.text?.format?.type,'json_object');
assert.ok(JSON.stringify(direct.input).includes('EJEMPLO_INTEGRO'));
assert.ok(JSON.stringify(direct.input).includes('EFECTO_UNICO'));

const stored=new Map();const kv={
 async put(key,value){stored.set(key,String(value));},
 async get(key,mode){if(Array.isArray(key))return new Map(key.map(k=>[k,stored.has(k)?JSON.parse(stored.get(k)):null]));const x=stored.get(key);return mode==='json'?(x?JSON.parse(x):null):x??null;},
 async delete(key){stored.delete(key);},
 async list({prefix='',limit=1000,cursor}={}){const keys=[...stored.keys()].filter(k=>k.startsWith(prefix)).sort();const start=cursor?Number(cursor):0;const size=Math.min(2,limit);const part=keys.slice(start,start+size);return {keys:part.map(name=>({name})),list_complete:start+size>=keys.length,cursor:String(start+size)};}
};
// Leer todas las páginas y claves sin truncar (KV bulk-get).
for(let i=0;i<7;i++)await kv.put('catalog-v1:moves:page-'+i,JSON.stringify({id:'page-'+i,category:'moves',name:'Paginado '+i,definition:{kind:'global',type:'agua',power:30}}));
await kv.put('type-chart-draft',JSON.stringify({chart:{agua:{fuego:'strong'}}}));
const paged=await readFullDraftCatalog(kv,['moves','entities']);
assert.equal(Object.keys(paged.catalog.moves).length,7);
assert.ok(paged.catalog.moves['page-6']);
assert.equal(paged.chart.agua.fuego,'strong');
const merged=mergePublishedAndDraftCatalog({catalog:{moves:{old:{id:'old',name:'Publicado'},'page-0':{id:'page-0',name:'Antiguo'}}}},paged,['moves','entities']);
assert.equal(Object.keys(merged.catalog.moves).length,8);
assert.equal(merged.catalog.moves['page-0'].name,'Paginado 0','Los borradores prevalecen.');
const exampleProposal={entity:{id:'unique-e',category:'entities',name:'Ajolote',description:'original',definition:{types:['agua'],hp:100,attack:50,defense:50,specialAttack:100,specialDefense:80,speed:70,spriteId:'ajolote',moveIds:['m1','m2','m3'],uniqueMoveId:'unique-m',globalAbilityId:'a1',uniqueAbilityId:'unique-a',rules:[]}},uniqueMove:{id:'unique-m',category:'moves',name:'Olas',description:'original',definition:{kind:'unique',type:'agua',category:'special',power:80,accuracy:100,criticalChance:5,priority:0,cooldown:0,targeting:'single',rules:[]}},uniqueAbility:{id:'unique-a',category:'abilities',name:'Corriente',description:'original',definition:{kind:'unique',rules:[]}}};
const gen=await recordAIGeneration(kv,{proposal:exampleProposal,characterName:'Ajolote',catalogCounts:getAICatalogCounts(small)});
assert.equal((await listAIGenerations(kv)).length,1);
assert.equal((await listApprovedAIMemories(kv)).length,0,'No aprender sin permiso explícito.');
await assert.rejects(()=>approveAIGeneration(kv,gen.id),/Guardá primero/);
for(const k of ['uniqueMove','uniqueAbility','entity']){
 const e=structuredClone(exampleProposal[k]);
 if(k==='entity'){e.definition.attack=65;e.name='Ajolote corregido';}
 await kv.put('catalog-v1:'+e.category+':'+e.id,JSON.stringify(e));
}
const preview=await previewAIGeneration(kv,gen.id);
assert.equal(preview.missing.length,0);assert.ok(preview.changes.some(c=>c.field.endsWith('definition.attack')));
const approved=await approveAIGeneration(kv,gen.id,{feedback:'Los ofensivos frágiles tienen más ataque.'});
assert.ok(approved.changeCount>=2);
const examples=await listApprovedAIMemories(kv);
assert.equal(examples.length,1);assert.equal(learningContext(examples)[0].feedback,'Los ofensivos frágiles tienen más ataque.');
await deleteAIGeneration(kv,gen.id);
assert.equal((await listAIGenerations(kv)).length,0);
assert.equal((await listApprovedAIMemories(kv)).length,0);
assert.ok(await kv.get('catalog-v1:entities:unique-e','json'),'Borrar memoria no debe borrar entidades.');
const worker=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const html=readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
for(const term of ['/editor-api/ai-memory','recordAIGeneration','approveAIGeneration','listApprovedAIMemories','readFullDraftCatalog(env.EDITOR_DRAFTS,RELEASE_CATEGORIES)','public-v1:current'])assert.ok(worker.includes(term));
for(const term of ['udAIMemoryList','udAIApprove','udAIMemoryCompare','udAIFeedback','Aprobar como ejemplo'])assert.ok(html.includes(term));
console.log('Catálogo COMPLETO, procesamiento paginado, memoria privada, aprobación y borrado: OK');
