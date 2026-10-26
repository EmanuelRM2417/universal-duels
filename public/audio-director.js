// Music is intentionally mixed with Web Audio rather than an HTMLMediaElement.
// This avoids Android's persistent media notification and stops on tab backgrounding.
function createInternalMusicChannel(){
  let context=null,output=null,source=null,buffer=null,loadPromise=null;
  let sourceUrl='',position=0,startedAt=0,volume=1,loop=true,paused=true;
  let generation=0,playEpoch=0;
  const listeners=new Map();
  const emit=name=>{for(const entry of [...(listeners.get(name)||[])]){entry.fn();if(entry.once)listeners.get(name).delete(entry);}};
  const AudioContextType=()=>window.AudioContext||window.webkitAudioContext;
  const ensureContext=()=>{
    if(context)return context;
    const Type=AudioContextType();if(!Type)throw new Error('Web Audio no disponible');
    context=new Type();output=context.createGain();output.gain.value=volume;
    output.connect(context.destination);return context;
  };
  const positionNow=()=>{
    if(!context||paused||!buffer)return position;
    const elapsed=Math.max(0,context.currentTime-startedAt);
    return loop&&buffer.duration?((position+elapsed)%buffer.duration):Math.min(buffer.duration,position+elapsed);
  };
  const detach=()=>{if(!source)return;const node=source;source=null;node.onended=null;try{node.stop();}catch{}try{node.disconnect();}catch{}};
  function pause(){
    ++playEpoch;
    if(!paused)position=positionNow();
    paused=true;detach();
  }
  function setSource(next){
    pause();++generation;sourceUrl=String(next||'');position=0;buffer=null;loadPromise=null;
  }
  async function play(){
    if(!sourceUrl||!paused||document.hidden)return;
    const epoch=++playEpoch,token=generation,requestedUrl=sourceUrl;
    const ctx=ensureContext();
    // Resume is initiated on the user gesture, before any network/decode awaits.
    await ctx.resume();
    if(!loadPromise){
      loadPromise=(async()=>{
        const response=await fetch(requestedUrl);
        if(!response.ok)throw Error('Audio HTTP '+response.status);
        return await ctx.decodeAudioData(await response.arrayBuffer());
      })();
    }
    let decoded;
    try{decoded=await loadPromise;}catch(error){if(token===generation)loadPromise=null;throw error;}
    if(epoch!==playEpoch||token!==generation||!paused||document.hidden)return;
    buffer=decoded;
    emit('loadedmetadata');
    if(epoch!==playEpoch||token!==generation||!paused||document.hidden)return;
    const node=ctx.createBufferSource();node.buffer=decoded;node.loop=loop;
    node.connect(output);source=node;
    const offset=loop&&decoded.duration?position%decoded.duration:Math.min(position,Math.max(0,decoded.duration-.001));
    position=offset;startedAt=ctx.currentTime;paused=false;
    node.onended=()=>{
      if(source!==node||paused)return;
      source=null;paused=true;position=0;
      if(!node.loop)emit('ended');
    };
    node.start(0,offset);
  }
  return {
    get src(){return sourceUrl;},set src(value){setSource(value);},
    get currentTime(){return positionNow();},set currentTime(value){
      const n=Math.max(0,Number(value)||0),wasPlaying=!paused;
      if(wasPlaying)pause();position=n;
      if(wasPlaying)play().catch(()=>{});
    },
    get paused(){return paused;},get volume(){return volume;},
    set volume(value){volume=Math.max(0,Math.min(1,Number(value)||0));if(output)output.gain.value=volume;},
    get loop(){return loop;},set loop(value){loop=!!value;if(source)source.loop=loop;},
    preload:'none',pause,play,load(){},
    removeAttribute(name){if(name==='src')setSource('');},
    addEventListener(name,fn,options){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add({fn,once:!!options?.once});}
  };
}

// Universal Duels Alpha 0.5: event-driven sound, single music channel and independent SFX.
// Browsers may require a user interaction before playing audio with sound.
export function createSoundDirector({url=(kind,id,revision)=>`/api/audio/${kind}/${id}?revision=${encodeURIComponent(revision||'')}`,playlistUrl=(mode,revision)=>'/api/music-playlists?revision='+encodeURIComponent(revision||''),musicFileUrl=(mode,id,revision)=>'/api/music-file/'+encodeURIComponent(mode)+'/'+encodeURIComponent(id)+'?revision='+encodeURIComponent(revision||'')}={}){
  const music=createInternalMusicChannel();music.loop=true;music.preload='none';
  const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
  const store=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{}};
  const remember=(key,value)=>{try{sessionStorage.setItem(key,String(value));}catch{}};
  const recall=(key,fallback='')=>{try{return sessionStorage.getItem(key)??fallback;}catch{return fallback;}};
  let musicVolume=clamp(localStorage.getItem('ud-audio-music')??localStorage.getItem('ud-audio-volume')??0.45);
  let effectVolume=clamp(localStorage.getItem('ud-audio-effects')??0.55);
  let muted=localStorage.getItem('ud-audio-muted')==='true';
  let unlocked=false,mode='lobby',scenario='',revision='',current='',soundVolume=100,settingsOpen=false;
  let musicSlider=null,effectSlider=null,muteButton=null,panel=null;
  const sync=()=>{music.volume=muted?0:clamp(musicVolume*soundVolume/100);if(musicSlider)musicSlider.value=String(Math.round(musicVolume*100));if(effectSlider)effectSlider.value=String(Math.round(effectVolume*100));if(muteButton){muteButton.textContent=muted?'🔇':'🔊';muteButton.setAttribute('aria-label',muted?'Activar sonido':'Silenciar sonido');muteButton.title=muted?'Activar sonido':'Silenciar sonido';}};
  sync();
  const playlists={lobby:[],battle:[]},history={lobby:[],battle:[]};
  let playlistGeneration=0,playlistMode='',playlistTrack='',playlistRevision='';
  const pickTrack=(mode)=>{
    const tracks=playlists[mode]||[];
    if(!tracks.length)return null;
    const recent=history[mode].slice(-(tracks.length>=3?2:1));
    let options=tracks.filter(t=>!recent.includes(t.id));
    if(!options.length)options=tracks;
    return options[Math.floor(Math.random()*options.length)];
  };
  const nextTrack=()=>{
    if(!playlistMode)return;
    const track=pickTrack(playlistMode);if(!track)return;
    playlistTrack=track.id;history[playlistMode].push(track.id);if(history[playlistMode].length>2)history[playlistMode].shift();
    current='playlist:'+playlistMode+':'+track.id+':'+playlistRevision;
    music.pause();music.removeAttribute('src');music.load();music.loop=false;
    music.src=musicFileUrl(playlistMode,track.id,playlistRevision);
    sync();if(unlocked&&!muted)music.play().catch(()=>{});
  };
  music.addEventListener('ended',()=>{if(playlistMode)nextTrack();});
  async function loadPlaylist(mode,rev){
    const generation=++playlistGeneration;playlistMode=mode;playlistRevision=rev;
    try{const r=await fetch(playlistUrl(mode,rev));if(!r.ok)throw Error('Playlist no disponible');const d=await r.json();
      if(generation!==playlistGeneration||playlistMode!==mode)return;
      playlists[mode]=Array.isArray(d.playlists?.[mode])?d.playlists[mode].filter(t=>t&&typeof t.id==='string'):[];
      if(playlists[mode].length)nextTrack();else{playlistMode='';select('global',mode);}
    }catch{if(generation===playlistGeneration){playlistMode='';select('global',mode);}}
  }
  const start=()=>{unlocked=true;if(current&&music.src&&!muted)music.play().catch(()=>{});};
  document.addEventListener('pointerdown',start,{once:true});document.addEventListener('keydown',start,{once:true});
  // Track lobby position without retaining two active players; it resumes when returning from battle.
  const saveLobby=()=>{if(current.startsWith('global:lobby:')&&Number.isFinite(music.currentTime))remember('ud-lobby-position',music.currentTime);};
  const saveIfLeaving=()=>saveLobby();
  window.addEventListener('pagehide',saveIfLeaving);
  // Suspend music and SFX when leaving the browser: no background playback.
  let resumeOnReturn=false;
  const stopForBackground=()=>{
    resumeOnReturn=!music.paused;
    music.pause();
    if(audioCtx?.state==='running')audioCtx.suspend().catch(()=>{});
  };
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){stopForBackground();return;}
    if(audioCtx?.state==='suspended'&&unlocked)audioCtx.resume().catch(()=>{});
    if(resumeOnReturn){resumeOnReturn=false;if(unlocked&&!muted)music.play().catch(()=>{});}
  });
  window.addEventListener('pagehide',stopForBackground);
  window.addEventListener('pageshow',()=>{
    if(!document.hidden&&audioCtx?.state==='suspended'&&unlocked)audioCtx.resume().catch(()=>{});
    if(!document.hidden&&resumeOnReturn){resumeOnReturn=false;if(unlocked&&!muted)music.play().catch(()=>{});}
  });
  function select(kind,id,vol=100){
    const key=kind+':'+id+':'+revision;
    if(current===key){soundVolume=vol;sync();return;}
    saveLobby();current=key;soundVolume=vol;music.loop=true;
    music.pause();music.removeAttribute('src');music.load();
    if(!id)return;
    music.src=url(kind,id,revision);
    if(kind==='global'&&id==='lobby'){
      const p=Number(recall('ud-lobby-position','0'));
      if(Number.isFinite(p)&&p>0){const seek=()=>{try{music.currentTime=p;}catch{}};music.addEventListener('loadedmetadata',seek,{once:true});}
    }
    sync();if(unlocked&&!muted)music.play().catch(()=>{});
  }
  function context(next,{scenarioId='',soundId='',scenarioVolume=100,revision:rev=''}={}){
    mode=next;revision=rev||revision;scenario=scenarioId||'';
    if(mode==='lobby'||!soundId){
      const target=mode==='lobby'?'lobby':'battle';
      if(playlistMode===target&&playlistRevision===revision)return;
      playlistMode=target;music.pause();loadPlaylist(target,revision);
    }else{playlistMode='';++playlistGeneration;select('scenarios',soundId,scenarioVolume);}

  }
  let audioCtx=null;
  function beep(id){
    try{
      audioCtx ||=new (window.AudioContext||window.webkitAudioContext)();
      const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),now=audioCtx.currentTime;
      const tones={'stat-up':[420,700],'stat-down':[600,240],physical:[130,80],special:[540,340],status:[300,400],'portal-in':[170,620],'portal-out':[620,170]};
      const [a,b]=tones[id]||[300,500];osc.type=id==='physical'?'sawtooth':'sine';
      osc.frequency.setValueAtTime(a,now);osc.frequency.exponentialRampToValueAtTime(Math.max(30,b),now+0.16);
      gain.gain.setValueAtTime(Math.min(.12,effectVolume*.12),now);gain.gain.exponentialRampToValueAtTime(.001,now+.20);
      osc.connect(gain).connect(audioCtx.destination);osc.start(now);osc.stop(now+.21);
    }catch{}
  }
  function effect(id){if(muted||!effectVolume||!unlocked||!id)return;
    const a=new Audio(url('global',id,revision));a.volume=effectVolume;
    a.play().catch(()=>{if(['stat-up','stat-down','physical','special','status','portal-in','portal-out'].includes(id))beep(id);});
  }
  function settings(){
    if(document.getElementById('udAudioSettings'))return;
    const root=document.createElement('aside');root.id='udAudioSettings';root.style.cssText='position:fixed;right:12px;bottom:12px;z-index:9998;font:13px system-ui;color:#fff';
    const toggle=document.createElement('button');toggle.type='button';toggle.textContent='🔊';toggle.title='Configuración de audio';toggle.setAttribute('aria-label','Configuración de audio');
    toggle.style.cssText='cursor:pointer;border:1px solid #8288b6;background:#262b45;color:#fff;border-radius:12px;padding:10px;font-size:18px;box-shadow:0 4px 16px #0008';
    panel=document.createElement('div');panel.hidden=true;panel.style.cssText='position:absolute;right:0;bottom:52px;width:215px;padding:14px;background:#1a1e32;border:1px solid #737ca8;border-radius:12px;box-shadow:0 8px 28px #000b';
    const title=document.createElement('strong');title.textContent='Audio';
    function makeSlider(name,value,change){const label=document.createElement('label');label.style.cssText='display:block;margin-top:10px';label.textContent=name;const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.value=String(Math.round(value*100));slider.style.cssText='width:100%;display:block;margin-top:5px';slider.setAttribute('aria-label',name);slider.oninput=()=>change(clamp(Number(slider.value)/100));label.append(slider);panel.append(label);return slider;}
    panel.append(title);
    musicSlider=makeSlider('Volumen de música',musicVolume,n=>{musicVolume=n;store('ud-audio-music',n);sync();if(unlocked&&!muted&&n>0&&current&&music.paused)music.play().catch(()=>{});});
    effectSlider=makeSlider('Volumen de efectos',effectVolume,n=>{effectVolume=n;store('ud-audio-effects',n);sync();});
    muteButton=document.createElement('button');muteButton.type='button';muteButton.style.cssText='margin-top:9px;border:1px solid #69739e;border-radius:8px;background:#303754;color:#fff;padding:8px;font-size:18px;width:100%;cursor:pointer';
    muteButton.onclick=()=>{muted=!muted;store('ud-audio-muted',muted);sync();if(muted)music.pause();else start();};panel.append(muteButton);
    toggle.onclick=()=>{settingsOpen=!settingsOpen;panel.hidden=!settingsOpen;toggle.setAttribute('aria-expanded',String(settingsOpen));};
    root.append(toggle,panel);document.body.append(root);sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',settings,{once:true});else settings();
  return {context,effect,settings,unlock:start,pause:()=>music.pause(),resume:()=>{if(unlocked&&!muted&&music.src)music.play().catch(()=>{});},get state(){return{mode,scenario,volume:musicVolume,musicVolume,effectVolume,muted,current}}};
}
