// Catálogo íntegro para IA: todas las páginas KV, todas las categorías y las
// definiciones completas. Bulk get reduce subsolicitudes Cloudflare.
export async function readFullDraftCatalog(kv,categories){
 const catalog={};
 for(const category of categories){
  const prefix=`catalog-v1:${category}:`,entries=[];let cursor,pages=0;
  do{
   if(++pages>100)throw Error('Catálogo demasiado grande para una sola solicitud de IA: '+category);
   const page=await kv.list({prefix,limit:1000,...(cursor?{cursor}:{})});
   for(let i=0;i<page.keys.length;i+=100){
    const keys=page.keys.slice(i,i+100).map(k=>k.name);
    const batch=await kv.get(keys,'json');
    entries.push(...keys.map(k=>batch.get(k)).filter(Boolean));
   }
   cursor=page.list_complete?undefined:page.cursor;
  }while(cursor);
  catalog[category]=Object.fromEntries(entries.map(e=>[e.id,e]));
 }
 const draft=await kv.get('type-chart-draft','json');
 return {catalog,chart:draft?.chart||draft||null};
}
export function mergePublishedAndDraftCatalog(published,draft,categories){
 const catalog={};
 for(const category of categories)catalog[category]={...(published?.catalog?.[category]||{}),...(draft.catalog?.[category]||{})};
 return {catalog,chart:draft.chart||published?.chart||null};
}
