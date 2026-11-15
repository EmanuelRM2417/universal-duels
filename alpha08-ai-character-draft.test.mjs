import assert from 'node:assert/strict';
import {validateAIProposal,generateAICharacter} from './ai-character.js';
import {validateDefinition} from './catalog-validation.js';
const mv=(id)=>({id,name:id,definition:{kind:'global',type:'agua',category:'special',power:40,accuracy:100,criticalChance:0,priority:0,cooldown:0,targeting:'single',rules:[]}});
const catalog={entities:{},moves:{m1:mv('m1'),m2:mv('m2'),m3:mv('m3')},abilities:{a1:{id:'a1',name:'Habilidad',definition:{kind:'global',rules:[]}}}};
const proposal={types:['agua','planta'],stats:{hp:100,attack:50,defense:50,specialAttack:100,specialDefense:80,speed:70},globalMoves:['m1','m2','m3'],globalAbility:'a1',uniqueMove:{name:'Olas',description:'Ataque acuático',definition:{kind:'unique',type:'agua',category:'special',power:80,accuracy:100,criticalChance:5,priority:0,cooldown:0,targeting:'single',rules:[]}},uniqueAbility:{name:'Corriente',description:'Habilidad especial',definition:{kind:'unique',rules:[]}},characterDescription:'Entidad de prueba',researchNotes:'Un borrador de prueba',references:['https://example.org/','javascript:alert(1)']};
const draft=validateAIProposal(proposal,catalog,{name:'Ajolote',spriteId:'ajolote'});
for(const v of [draft.entity,draft.uniqueMove,draft.uniqueAbility])assert.doesNotThrow(()=>validateDefinition(v.category,v.definition));
assert.equal(draft.entity.definition.spriteId,'ajolote');assert.equal(draft.entity.definition.moveIds.length,3);assert.equal(draft.references.length,1);
await assert.rejects(()=>generateAICharacter({name:'Ajolote',spriteId:'ajolote',catalog}),/Falta configurar/);
const calls=[];
const result=await generateAICharacter({name:'Ajolote',spriteId:'ajolote',catalog,apiKey:'test-placeholder',spriteDataUrl:'data:image/png;base64,iVBORw0KGgo=',fetcher:async(url,request)=>{
 const payload=JSON.parse(request.body);calls.push(payload);
 assert.match(url,/api.openai.com\/v1\/responses/);
 assert.equal(payload.store,false);
 if(payload.tools){
  assert.ok(payload.tools.some(x=>x.type==='web_search'));
  assert.equal(payload.text,undefined,'La búsqueda NO debe utilizar modo JSON.');
  assert.equal(payload.tool_choice,'required');
  return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'El ajolote es un anfibio acuático.',annotations:[{url:'https://example.org/ajolote'}]}]}]})};
 }
 assert.equal(payload.text?.format?.type,'json_object');
 assert.equal(payload.tools,undefined,'La generación JSON NO debe usar búsqueda web.');
 assert.match(JSON.stringify(payload.input),/input_image/);
 assert.match(JSON.stringify(payload.input),/anfibio acuático/);
 return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify(proposal)}]}]})};
}});
assert.equal(calls.length,2);
assert.deepEqual(result.references,['https://example.org/ajolote']);
assert.ok(result.entity.id);assert.ok(!('apiKey' in result));
assert.throws(()=>validateAIProposal({...proposal,globalMoves:['m1','m2','x']},catalog,{name:'Ajolote',spriteId:'ajolote'}));
console.log('Generación IA en borrador, validaciones y secreto opcional: OK');
