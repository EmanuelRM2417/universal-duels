// Pure R2 release resource handler: no Cloudflare-specific imports.
// Build a versioned, immutable asset manifest. Unchanged bytes keep their old R2
// object path, so small content patches don't re-upload the whole art collection.
export async function releaseResources(env,catalog,revision,previous={},types=[]){
  if(!env.EDITOR_SPRITES)throw Error('Almacenamiento de sprites sin conectar.');
  const r2=env.EDITOR_SPRITES,assets={sprites:{},environment:{},typeIcons:{},audio:{}},pending=[];
  const choose=async(src,dest,oldPath,required)=>{
    const draft=await r2.head(src),old=oldPath?await r2.head(oldPath):null;
    if(draft&&old&&draft.etag&&old.etag&&draft.etag===old.etag)return oldPath;
    if(draft){pending.push([src,dest]);return dest;}
    if(old)return oldPath;
    if(required)throw Error('Falta el sprite o recurso visual requerido: '+src);
    return null;
  };
  for(const id of new Set(Object.values(catalog.entities||{}).map(e=>e?.definition?.spriteId).filter(Boolean))){
    const oldPath=previous.assets?.sprites?.[id]||(previous.revision?`published/${previous.revision}/sprites/${id}.png`:null);
    assets.sprites[id]=await choose(`drafts/${id}.png`,`published/${revision}/sprites/${id}.png`,oldPath,true);
  }
  for(const category of ['weathers','scenarios'])for(const entry of Object.values(catalog[category]||{})){
    const id=entry?.definition?.imageId;if(!id)continue;
    const key=`${category}/${id}`,oldPath=previous.assets?.environment?.[key]||(previous.revision?`published/${previous.revision}/environment/${key}.png`:null);
    assets.environment[key]=await choose(`environment/${key}.png`,`published/${revision}/environment/${key}.png`,oldPath,true);
  }
  // Audio publicado por revisión. Los borradores nunca se sirven al juego público.
  for(const [category,entries] of [['scenarios',Object.values(catalog.scenarios||{})]])for(const entry of entries){
    const id=entry?.definition?.soundId;if(!id)continue;
    const key=`${category}/${id}`,oldPath=previous.assets?.audio?.[key]||null;
    assets.audio[key]=await choose(`audio/${key}.mp3`,`published/${revision}/audio/${key}.mp3`,oldPath,true);
  }
  for(const id of ['lobby','battle','stat-up','stat-down','physical','special','status','portal-in','portal-out']){
    const oldPath=previous.assets?.audio?.[id]||null;
    const path=await choose(`audio/global/${id}.mp3`,`published/${revision}/audio/global/${id}.mp3`,oldPath,false);
    if(path)assets.audio[id]=path;
  }
  for(const id of types){
    const oldPath=previous.assets?.typeIcons?.[id]||(previous.revision?`published/${previous.revision}/type-icons/${id}.png`:null);
    const path=await choose(`type-icons/${id}.png`,`published/${revision}/type-icons/${id}.png`,oldPath,false);
    if(path)assets.typeIcons[id]=path;
  }
  // Preflight completes before any object is written. A failed copy never moves
  // the public current-version pointer.
  for(const [src,dst] of pending){
    const obj=await r2.get(src);
    if(!obj)throw Error('El recurso desapareció antes de publicar: '+src);
    await r2.put(dst,obj.body,{httpMetadata:obj.httpMetadata,customMetadata:obj.customMetadata});
  }
  return {assets,copied:pending.length,reused:Object.keys(assets.sprites).length+Object.keys(assets.environment).length+Object.keys(assets.typeIcons).length+Object.keys(assets.audio).length-pending.length};
}
