// Alpha 0.4: pure publication validation. Does not write to Cloudflare.
import {validateDefinition} from './catalog-validation.js';
const CATEGORIES=['effects','moves','abilities','entities','weathers','fields','scenarios','statuses'];
const ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ACTION_REFS={apply_effect:'effects',apply_status:'statuses',set_weather:'weathers',set_field:'fields',set_scenario:'scenarios'};
export function validateRelease(catalog, chart){
  const errors=[],warnings=[];
  if(!chart||typeof chart!=='object'||Array.isArray(chart))errors.push('Falta la tabla de tipos.');
  if(!Object.keys(catalog?.entities||{}).length)errors.push('No hay personajes para publicar.');
  for(const category of CATEGORIES){
    for(const [id,entry] of Object.entries(catalog?.[category]||{})){
      if(!ID.test(id)||id.length>60||entry?.id!==id){errors.push(`ID incompatible: ${category}/${id}`);continue;}
      try{validateDefinition(category,entry.definition);}catch(e){errors.push(`${category}/${id}: ${e.message}`);}
    }
  }
  const exists=(cat,id,source)=>{if(!id||!catalog?.[cat]?.[id])errors.push(`${source}: referencia inexistente ${cat}/${id||'(vacía)'}`);};
  for(const e of Object.values(catalog?.entities||{})){
    const d=e.definition||{};
    for(const id of [...(d.moveIds||[]),d.uniqueMoveId])exists('moves',id,`personaje ${e.id}`);
    for(const id of [d.globalAbilityId,d.uniqueAbilityId])exists('abilities',id,`personaje ${e.id}`);
    for(const id of d.moveIds||[])if(catalog.moves?.[id]?.definition?.kind!=='global')errors.push(`${e.id}: movimiento global inválido ${id}`);
    if(catalog.moves?.[d.uniqueMoveId]?.definition?.kind!=='unique')errors.push(`${e.id}: movimiento exclusivo inválido`);
    if(catalog.abilities?.[d.globalAbilityId]?.definition?.kind!=='global')errors.push(`${e.id}: habilidad global inválida`);
    if(catalog.abilities?.[d.uniqueAbilityId]?.definition?.kind!=='unique')errors.push(`${e.id}: habilidad exclusiva inválida`);
  }
  for(const category of CATEGORIES)for(const entry of Object.values(catalog?.[category]||{})){
    for(const rule of entry.definition?.rules||[]){const ref=ACTION_REFS[rule.action?.type];if(ref)exists(ref,rule.action.value,`${category}/${entry.id}`);}
  }
  // Do not silently replace or 'balance' the author's content.
  if(Object.keys(catalog?.entities||{}).length<8)warnings.push('Hay menos de ocho personajes; Random Team online no podrá iniciarse.');
  return {ok:errors.length===0,errors,warnings,counts:Object.fromEntries(CATEGORIES.map(c=>[c,Object.keys(catalog?.[c]||{}).length]))};
}
export function publicationDiff(previous, next){
  const result={};
  for(const category of CATEGORIES){const a=previous?.catalog?.[category]||{},b=next?.catalog?.[category]||{};
    result[category]={added:[],changed:[],deleted:[]};
    for(const [id,entry] of Object.entries(b)){
      if(!a[id])result[category].added.push(id);
      else if(JSON.stringify(a[id])!==JSON.stringify(entry))result[category].changed.push(id);
    }
    for(const id of Object.keys(a))if(!b[id])result[category].deleted.push(id);
  }
  return result;
}
export function nextHistory(old,entry){return [entry,...(Array.isArray(old)?old:[]).filter(v=>v.revision!==entry.revision)].slice(0,100);}
// Apply only explicitly selected draft changes, preserving unaffected published
// content. Missing references required by a selected item are added recursively.
export function selectRelease(previous,draft,selection){
  if(selection===undefined||selection===null)return {catalog:draft,autoIncluded:[]};
  if(typeof selection!=='object'||Array.isArray(selection))throw Error('Selección de parche inválida.');
  const catalog=Object.fromEntries(CATEGORIES.map(c=>[c,structuredClone(previous?.[c]||{})]));
  const autoIncluded=[],active=new Set();
  const apply=(cat,id,automatic=false)=>{
    if(!CATEGORIES.includes(cat)||typeof id!=='string'||!ID.test(id))throw Error('Selección de parche inválida: '+cat+'/'+id);
    const key=cat+'/'+id;if(active.has(key))return;active.add(key);
    const entry=draft?.[cat]?.[id];
    if(!entry){if(!automatic)delete catalog[cat][id];return;}
    catalog[cat][id]=structuredClone(entry);if(automatic)autoIncluded.push(key);
    const def=entry.definition||{};
    if(cat==='entities'){
      for(const mid of [...(def.moveIds||[]),def.uniqueMoveId])ensure('moves',mid);
      for(const aid of [def.globalAbilityId,def.uniqueAbilityId])ensure('abilities',aid);
    }
    for(const rule of def.rules||[]){const ref=ACTION_REFS[rule.action?.type];if(ref)ensure(ref,rule.action.value);}
  };
  const ensure=(cat,id)=>{if(id&&!catalog[cat]?.[id]&&draft?.[cat]?.[id])apply(cat,id,true);};
  for(const [cat,ids] of Object.entries(selection)){
    if(!CATEGORIES.includes(cat)||!Array.isArray(ids)||ids.length>1000)throw Error('Selección de parche inválida.');
    for(const id of ids)apply(cat,id,false);
  }
  return {catalog,autoIncluded};
}
