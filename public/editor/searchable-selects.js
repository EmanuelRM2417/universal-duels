/* Editor: se conserva el <select> nativo; el buscador elige una de sus opciones reales. */
(()=>{
  const fold=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
  let panel=null,anchor=null;
  const close=()=>{panel?.remove();panel=null;anchor=null;};
  function open(select,initial=''){
    if(!select||select.disabled)return;
    close();anchor=select;
    const items=[...select.options].map(o=>({value:o.value,label:o.textContent,disabled:o.disabled||!!o.parentElement?.disabled}));
    panel=document.createElement('div');panel.className='ud-select-search-dialog';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Buscar '+(select.closest('label')?.firstChild?.textContent||'opción'));
    const input=document.createElement('input');input.type='search';input.placeholder='Buscar opción';input.autocomplete='off';input.setAttribute('aria-label','Buscar entre las opciones');
    const count=document.createElement('small');count.className='ud-select-search-count';
    const list=document.createElement('div');list.className='ud-select-search-results';list.setAttribute('role','listbox');
    panel.append(input,count,list);document.body.append(panel);
    const rect=select.getBoundingClientRect();const width=Math.min(470,Math.max(280,rect.width));
    panel.style.width=width+'px';panel.style.left=Math.max(8,Math.min(innerWidth-width-8,rect.left))+'px';panel.style.top=Math.max(8,Math.min(innerHeight-330,rect.bottom+5))+'px';
    function render(){const term=fold(input.value);list.replaceChildren();const filtered=items.filter(x=>!term||fold(x.label).includes(term)||fold(x.value).includes(term));
      count.textContent=filtered.length+' de '+items.length+' opciones';
      for(const item of filtered.slice(0,250)){const button=document.createElement('button');button.type='button';button.className='ud-select-search-result';button.textContent=item.label||item.value;button.disabled=item.disabled;button.setAttribute('role','option');button.setAttribute('aria-selected',String(select.value===item.value));
        button.onclick=()=>{select.value=item.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));close();select.focus({preventScroll:true});};list.append(button);}
      if(!filtered.length){const empty=document.createElement('p');empty.textContent='No hay coincidencias';list.append(empty);}
    }
    input.value=initial;input.addEventListener('input',render);
    input.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();close();select.focus();}
      else if(e.key==='ArrowDown'){e.preventDefault();list.querySelector('button:not(:disabled)')?.focus();}
      else if(e.key==='Enter'){e.preventDefault();list.querySelector('button:not(:disabled)')?.click();}
    });
    list.addEventListener('keydown',e=>{if(e.key==='Escape'){close();select.focus();return;}
      const buttons=[...list.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);
      if(e.key==='ArrowDown'){e.preventDefault();buttons[Math.min(index+1,buttons.length-1)]?.focus();}
      else if(e.key==='ArrowUp'){e.preventDefault();if(index<=0)input.focus();else buttons[index-1]?.focus();}
    });
    render();input.focus();input.select();
  }
  function install(select){
    if(select.dataset.udSelectSearch||select.closest('.ud-select-search-dialog'))return;
    select.dataset.udSelectSearch='1';
    const trigger=document.createElement('button');trigger.type='button';trigger.className='ud-select-search-trigger';trigger.textContent='Buscar';trigger.title='Buscar por nombre en la lista';trigger.setAttribute('aria-label','Buscar opciones de '+(select.closest('label')?.firstChild?.textContent||'esta lista'));
    trigger.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open(select);});
    select.after(trigger);
  }
  const scan=root=>{if(root.nodeType!==1)return;if(root.matches?.('select'))install(root);root.querySelectorAll?.('select').forEach(install);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>scan(document.body));else scan(document.body);
  const observer=new MutationObserver(changes=>{for(const change of changes)for(const node of change.addedNodes)scan(node);});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('keydown',e=>{const select=e.target;if(select?.tagName!=='SELECT'||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.key==='/'||e.key.length===1&&!/\s/.test(e.key)){e.preventDefault();open(select,e.key==='/'?'':e.key);}
  },true);
  document.addEventListener('pointerdown',e=>{if(panel&&!panel.contains(e.target)&&e.target!==anchor&&!e.target.closest('.ud-select-search-trigger'))close();});
})();
