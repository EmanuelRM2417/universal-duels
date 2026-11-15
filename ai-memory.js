// Memoria PRIVADA del asistente: ejemplos aprobados explícitamente por el propietario.
// No modifica el modelo, el catálogo ni el sistema de publicación.
import {validateDefinition} from './catalog-validation.js';

export const AI_MEMORY_PREFIX='ai-memory:v1:';
const idPattern=/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i;
const editable=e=>({id:e.id,category:e.category,name:e.name,description:e.description,definition:e.definition});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export function compareAIEditions(original,approved){
 const changes=[];
 function walk(a,b,path){
  if(same(a,b))return;
  if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
   const keys=new Set([...Object.keys(a),...Object.keys(b)]);
   for(const k of keys)walk(a[k],b[k],path?path+'.'+k:k);
  }else changes.push({field:path,before:a===undefined?null:a,after:b===undefined?null:b});
 }
 for(const key of ['entity','uniqueMove','uniqueAbility'])walk(editable(original[key]),editable(approved[key]),key);
 return changes;
}
const genKey=id=>AI_MEMORY_PREFIX+'generation:'+id;
const exampleKey=id=>AI_MEMORY_PREFIX+'example:'+id;
export async function recordAIGeneration(kv,{proposal,characterName,catalogCounts}){
 const id=crypto.randomUUID(),createdAt=new Date().toISOString();
 const generation={id,createdAt,characterName:String(characterName||proposal.entity?.name||'').slice(0,100),catalogCounts,original:{entity:editable(proposal.entity),uniqueMove:editable(proposal.uniqueMove),uniqueAbility:editable(proposal.uniqueAbility)},approvedAt:null};
 await kv.put(genKey(id),JSON.stringify(generation));
 return {id,createdAt};
}
export async function approveAIGeneration(kv,id,{feedback=''}={}){
 if(!idPattern.test(id||''))throw Error('Identificador de generación inválido.');
 if(typeof feedback!=='string'||feedback.length>1600)throw Error('La explicación debe tener un máximo de 1600 caracteres.');
 const generation=await kv.get(genKey(id),'json');if(!generation)throw Error('No se encontró la generación original.');
 const latest={};
 for(const key of ['uniqueMove','uniqueAbility','entity']){
  const prev=generation.original[key];
  const current=await kv.get(`catalog-v1:${prev.category}:${prev.id}`,'json');
  if(!current)throw Error(`Guardá primero el ${prev.category} / ${prev.id} en el catálogo privado.`);
  const entry=editable(current);
  validateDefinition(entry.category,entry.definition);
  latest[key]=entry;
 }
 // Se conserva el vínculo con los IDs que propuso la IA; nunca se aprende de otro personaje por accidente.
 const d=latest.entity.definition;
 if(d.uniqueMoveId!==latest.uniqueMove.id||d.uniqueAbilityId!==latest.uniqueAbility.id)throw Error('El personaje aprobado debe seguir vinculado a sus exclusivos originales.');
 const changes=compareAIEditions(generation.original,latest);
 const example={id,characterName:generation.characterName,createdAt:generation.createdAt,approvedAt:new Date().toISOString(),feedback:feedback.trim(),original:generation.original,approved:latest,changes};
 await kv.put(exampleKey(id),JSON.stringify(example));
 await kv.put(genKey(id),JSON.stringify({...generation,approvedAt:example.approvedAt}));
 return {id,approvedAt:example.approvedAt,changeCount:changes.length,changes};
}
export async function deleteAIExample(kv,id){
 if(!idPattern.test(id||''))throw Error('Identificador de memoria inválido.');
 await kv.delete(exampleKey(id));
 const generation=await kv.get(genKey(id),'json');
 if(generation)await kv.put(genKey(id),JSON.stringify({...generation,approvedAt:null}));
}
async function listAll(kv,prefix){
 const result=[];let cursor,pages=0;
 do{
  if(++pages>100)throw Error('La memoria tiene demasiadas páginas para consultar.');
  const page=await kv.list({prefix,limit:1000,...(cursor?{cursor}:{})});
  for(let i=0;i<page.keys.length;i+=100){
   const keys=page.keys.slice(i,i+100).map(k=>k.name);
   const batch=await kv.get(keys,'json');
   result.push(...keys.map(key=>batch.get(key)).filter(Boolean));
  }
  cursor=page.list_complete?undefined:page.cursor;
 }while(cursor);
 return result;
}
export async function listAIGenerations(kv){
 const data=await listAll(kv,AI_MEMORY_PREFIX+'generation:');
 return data.map(({id,characterName,createdAt,approvedAt,catalogCounts})=>({id,characterName,createdAt,approvedAt,catalogCounts})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export async function listApprovedAIMemories(kv){
 const data=await listAll(kv,AI_MEMORY_PREFIX+'example:');
 return data.sort((a,b)=>b.approvedAt.localeCompare(a.approvedAt));
}
export async function getAIGeneration(kv,id){
 if(!idPattern.test(id||''))throw Error('Identificador inválido.');
 const generation=await kv.get(genKey(id),'json');
 if(!generation)throw Error('No existe esa generación.');
 return {generation,example:await kv.get(exampleKey(id),'json')};
}
export function learningContext(examples){
 // TODAS las correcciones aprobadas forman parte del contexto, sin top-N silencioso.
 return examples.map(e=>({characterName:e.characterName,feedback:e.feedback,original:e.original,approved:e.approved,changes:e.changes}));
}
export async function previewAIGeneration(kv,id){
 const {generation,example}=await getAIGeneration(kv,id);
 const current={};const missing=[];
 for(const key of ['entity','uniqueMove','uniqueAbility']){
  const e=generation.original[key];const stored=await kv.get(`catalog-v1:${e.category}:${e.id}`,'json');
  if(stored)current[key]=editable(stored);else missing.push(e.category+'/'+e.id);
 }
 return {generation:{id:generation.id,characterName:generation.characterName,createdAt:generation.createdAt,approvedAt:generation.approvedAt,catalogCounts:generation.catalogCounts},original:generation.original,current,missing,changes:missing.length?[]:compareAIEditions(generation.original,current),example:example?{approvedAt:example.approvedAt,feedback:example.feedback,changeCount:example.changes.length}:null};
}
export async function deleteAIGeneration(kv,id){
 if(!idPattern.test(id||''))throw Error('Identificador inválido.');
 await kv.delete(exampleKey(id));
 await kv.delete(genKey(id));
}
