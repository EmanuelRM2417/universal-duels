// Universal Duels: asistente de BORRADORES, siempre privado y manual.
// No aprende pesos de modelo; utiliza los ejemplos actuales del catálogo como contexto.
import {validateDefinition} from './catalog-validation.js';
const slug=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,36);
const uniquePrefix=(name)=>'ia-'+(slug(name)||'personaje')+'-'+Date.now().toString(36).slice(-5);
const pick=(entries,max,kind)=>Object.values(entries||{}).filter(e=>!kind||e?.definition?.kind===kind).slice(0,max).map(e=>({id:e.id,name:e.name,description:e.description,definition:e.definition}));
const schemaPrompt=`Devolvé SOLAMENTE JSON, sin markdown, con exactamente estas claves:
{
"types":["agua"],"stats":{"hp":100,"attack":90,"defense":90,"specialAttack":90,"specialDefense":90,"speed":90},
"globalMoves":["id-mov-global-1","id-mov-global-2","id-mov-global-3"],"globalAbility":"id-habilidad-global",
"uniqueMove":{"name":"Nombre","description":"Descripción","definition":{"kind":"unique","type":"agua","category":"special","power":70,"accuracy":100,"criticalChance":5,"priority":0,"cooldown":0,"targeting":"single","rules":[]}},
"uniqueAbility":{"name":"Nombre","description":"Descripción","definition":{"kind":"unique","rules":[]}},
"characterDescription":"Texto breve sobre la identidad del personaje en el juego", "researchNotes":"Contexto real comprobable; distinguir mito de historia y evitar presentar ficción como hecho", "references":["URL fuente comprobada"]}
SOLO IDs existentes en globalMoves/globalAbility, no inventar referencias. 3 globales diferentes. Las reglas, si las creás, deben ser un arreglo con evento válido, condición {type:'always',value:''}, conditions:[], target, action, chance:0-100, duration:0, limit:0, operator:'AND', negate:false. Preferí pocas reglas sencillas y válidas; nunca generes acciones no documentadas. No crees contenido público. Nunca omitas atributos obligatorios. PS 0..500, otras stats 0..200 y suma de las otras 5 <=1000. Tipos 1 a 3. Ofrecé un concepto balanceable, no favorezcas por fama. Las fuentes son para revisión humana.`;
const safeDefinition=(d)=>d&&typeof d==='object'&&!Array.isArray(d)?structuredClone(d):{};
export function validateAIProposal(proposal,catalog,{name,spriteId}={}){
 const allMoves=catalog.moves||{},allAbilities=catalog.abilities||{};
 if(!proposal||typeof proposal!=='object')throw Error('La IA no devolvió una propuesta válida.');
 if(!Array.isArray(proposal.globalMoves)||proposal.globalMoves.length!==3||new Set(proposal.globalMoves).size!==3||proposal.globalMoves.some(id=>allMoves[id]?.definition?.kind!=='global'))throw Error('La IA debe seleccionar tres movimientos globales existentes y distintos.');
 if(allAbilities[proposal.globalAbility]?.definition?.kind!=='global')throw Error('La IA debe seleccionar una habilidad global existente.');
 const base=uniquePrefix(name),move={id:base+'-mov',category:'moves',name:String(proposal.uniqueMove?.name||'').slice(0,100),description:String(proposal.uniqueMove?.description||'').slice(0,2000),definition:safeDefinition(proposal.uniqueMove?.definition)},ability={id:base+'-hab',category:'abilities',name:String(proposal.uniqueAbility?.name||'').slice(0,100),description:String(proposal.uniqueAbility?.description||'').slice(0,2000),definition:safeDefinition(proposal.uniqueAbility?.definition)};
 if(!move.name||!ability.name)throw Error('Falta nombre del movimiento o de la habilidad exclusiva.');
 move.definition.kind='unique';ability.definition.kind='unique';
 // No permitir a la IA sobrescribir contenido existente.
 if(catalog.moves?.[move.id]||catalog.abilities?.[ability.id]||catalog.entities?.[base])throw Error('Ya existe ese ID; generá otra propuesta.');
 validateDefinition('moves',move.definition);validateDefinition('abilities',ability.definition);
 const e={id:base,category:'entities',name:String(name).trim().slice(0,100),description:String(proposal.characterDescription||'').slice(0,2000),definition:{types:proposal.types,hp:proposal.stats?.hp,attack:proposal.stats?.attack,defense:proposal.stats?.defense,specialAttack:proposal.stats?.specialAttack,specialDefense:proposal.stats?.specialDefense,speed:proposal.stats?.speed,spriteId,moveIds:proposal.globalMoves,uniqueMoveId:move.id,globalAbilityId:proposal.globalAbility,uniqueAbilityId:ability.id,rules:[]}};
 validateDefinition('entities',e.definition);
 return {entity:e,uniqueMove:move,uniqueAbility:ability,researchNotes:String(proposal.researchNotes||'').slice(0,3000),references:Array.isArray(proposal.references)?proposal.references.filter(u=>typeof u==='string'&&/^https:\/\//.test(u)).slice(0,8):[],warning:'Borrador sugerido por IA: revisar fuentes, autenticidad, balance y efectos antes de publicarlo.'};
}
export async function generateAICharacter({name,spriteId,notes='',catalog,apiKey,fetcher=fetch,model='gpt-5-mini',spriteDataUrl=null}){
 if(!apiKey)throw Error('Falta configurar el secreto UD_AI_API_KEY en el Worker Editor.');
 if(typeof name!=='string'||name.trim().length<2||name.length>100||typeof spriteId!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spriteId)||typeof notes!=='string'||notes.length>1600)throw Error('Nombre, sprite o instrucciones inválidos.');
 if(!Object.values(catalog.moves||{}).filter(x=>x.definition?.kind==='global').length||!Object.values(catalog.abilities||{}).some(x=>x.definition?.kind==='global'))throw Error('Primero creá movimientos y habilidades globales.');
 const context={character:name,spriteId,notes,existingEntities:pick(catalog.entities,24),globalMoves:pick(catalog.moves,60,'global'),globalAbilities:pick(catalog.abilities,40,'global'),uniqueMoves:pick(catalog.moves,16,'unique'),uniqueAbilities:pick(catalog.abilities,16,'unique')};
 const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model,store:false,tools:[{type:'web_search'}],tool_choice:'required',text:{format:{type:'json_object'}},max_output_tokens:5000,instructions:'Sos un diseñador de Universal Duels. Usá la búsqueda web para conocer la historia/mitología/naturaleza real del personaje. Evitá presentar conjeturas como hechos. Usá el catálogo como ejemplos de estilo y balance sin copiar contenido innecesariamente. '+schemaPrompt,input:spriteDataUrl?[{role:'user',content:[{type:'input_text',text:JSON.stringify(context)},{type:'input_image',image_url:spriteDataUrl,detail:'low'}]}]:JSON.stringify(context)})});
 const body=await response.json().catch(()=>({}));if(!response.ok)throw Error('Servicio de IA: '+String(body.error?.message||'Error de respuesta').slice(0,230));
 if(body.status==='incomplete')throw Error('La investigación quedó incompleta: reintentá o simplificá las instrucciones.');
 const text=(body.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('\n')||body.output_text||'';
 let result;try{result=JSON.parse(text);}catch{throw Error('La IA no devolvió JSON válido. Podés volver a generar.');}
 const suggested=validateAIProposal(result,catalog,{name,spriteId});
 const verified=[...new Set((body.output||[]).flatMap(item=>item.content||[]).flatMap(item=>item.annotations||[]).map(a=>a.url).filter(u=>typeof u==='string'&&/^https:\/\//.test(u)))].slice(0,8);
 if(verified.length)suggested.references=verified;
 return suggested;
}
