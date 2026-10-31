/* Universal Duels: editor-published narrator templates. Only text patterns, no HTML/regex injection. */
(function(){
  const reEscape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const LIMIT=120;
  function apply(text,rules){
    const original=String(text||'');
    if(!Array.isArray(rules))return original;
    for(const rule of rules.slice(0,LIMIT)){
      const pattern=String(rule?.pattern||'').slice(0,240),replacement=String(rule?.replacement||'').slice(0,360);
      if(!pattern||!replacement)continue;
      const tokens=[];const marker=/\[([A-ZÁÉÍÓÚÑ_]{2,24})\]/g;
      let last=0,m,source='^';
      while((m=marker.exec(pattern))){source+=reEscape(pattern.slice(last,m.index))+'(.+?)';tokens.push(m[1]);last=marker.lastIndex;}
      source+=reEscape(pattern.slice(last))+'$';
      if(source.length>850)continue;
      let match;try{match=new RegExp(source,'u').exec(original);}catch{continue;}
      if(!match)continue;
      const values={};tokens.forEach((key,i)=>{values[key]=match[i+1]});
      return replacement.replace(marker,(full,key)=>Object.hasOwn(values,key)?values[key]:full);
    }
    return original;
  }
  window.udNarratorFormat=apply;
})();
