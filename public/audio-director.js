// Universal Duels Alpha 0.5: event-driven sound, single music channel and independent SFX.
// Browsers may require a user interaction before playing audio with sound.
export function createSoundDirector({url=(kind,id,revision)=>`/api/audio/${kind}/${id}?revision=${encodeURIComponent(revision||'')}`}={}){
  const music=new Audio();music.loop=false;music.preload='none';
  const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
  const store=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{}};
  const remember=(key,value)=>{try{sessionStorage.setItem(key,String(value));}catch{}};
  const recall=(key,fallback='')=>{try{return sessionStorage.getItem(key)??fallback;}catch{return fallback;}};
  let musicVolume=clamp(localStorage.getItem('ud-audio-music')??localStorage.getItem('ud-audio-volume')??0.45);
  let effectVolume=clamp(localStorage.getItem('ud-audio-effects')??0.55);
  let muted=localStorage.getItem('ud-audio-muted')==='true';
  let unlocked=false,mode='lobby',scenario='',revision='',current='',soundVolume=100,settingsOpen=false,playlists={lobby:[],battle:[]},lastPlayed={lobby:[],battle:[]},activePlaylist='',trackSerial=0;
  let musicSlider=null,effectSlider=null,muteButton=null,panel=null;
  const sync=()=>{music.volume=muted?0:clamp(musicVolume*soundVolume/100);if(musicSlider)musicSlider.value=String(Math.round(musicVolume*100));if(effectSlider)effectSlider.value=String(Math.round(effectVolume*100));if(muteButton){muteButton.textContent=muted?'🔇':'🔊';muteButton.setAttribute('aria-label',muted?'Activar sonido':'Silenciar sonido');muteButton.title=muted?'Activar sonido':'Silenciar sonido';}};
  sync();
  const start=()=>{unlocked=true;if(current&&music.src&&!muted)music.play().catch(()=>{});};
  document.addEventListener('pointerdown',start,{once:true});document.addEventListener('keydown',start,{once:true});
  // Track lobby position without retaining two active players; it resumes when returning from battle.
  const saveLobby=()=>{if((current.startsWith('global:lobby:')||current.startsWith('global:lobby-'))&&Number.isFinite(music.currentTime)){remember('ud-lobby-position',music.currentTime);remember('ud-lobby-track',current.split(':')[1]);}};
  const saveIfLeaving=()=>saveLobby();
  window.addEventListener('pagehide',saveIfLeaving);
  function select(kind,id,vol=100){
    const key=kind+':'+id+':'+revision;
    if(current===key){soundVolume=vol;sync();return;}
    saveLobby();current=key;soundVolume=vol;
    music.pause();music.removeAttribute('src');music.load();
    if(!id)return;
    music.src=url(kind,id,revision);music.loop=!(activePlaylist&&((kind==='global'&&id.startsWith(activePlaylist+'-'))));
    if(kind==='global'&&(id==='lobby'||id.startsWith('lobby-'))&&recall('ud-lobby-track')===id){
      const p=Number(recall('ud-lobby-position','0'));
      if(Number.isFinite(p)&&p>0){const seek=()=>{try{music.currentTime=p;}catch{}};music.addEventListener('loadedmetadata',seek,{once:true});}
    }
    sync();if(!muted)music.play().then(()=>{unlocked=true}).catch(()=>{});
  }
  function chooseTrack(kind){
    const tracks=playlists[kind]||[];if(!tracks.length)return kind;
    const previous=lastPlayed[kind];const available=tracks.filter(id=>!previous.includes(id));
    // Para 1 o 2 canciones no existen suficientes alternativas: no prometemos lo imposible.
    const pool=available.length?available:tracks.filter(id=>id!==previous[previous.length-1]);
    const selected=(pool.length?pool:tracks)[Math.floor(Math.random()*(pool.length||tracks.length))];
    previous.push(selected);while(previous.length>2)previous.shift();return kind+'-'+selected;
  }
  music.addEventListener('ended',()=>{
    if(activePlaylist&&(mode===activePlaylist)&&!muted){select('global',chooseTrack(activePlaylist));}
  });
  function configurePlaylists(value={}){for(const kind of ['lobby','battle'])playlists[kind]=Array.isArray(value[kind])?[...new Set(value[kind])].filter(x=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x)):[];}
  function context(next,{scenarioId='',soundId='',scenarioVolume=100,revision:rev='',audioPlaylists}={}){
    if(audioPlaylists)configurePlaylists(audioPlaylists);
    mode=next;revision=rev||revision;scenario=scenarioId||'';
    if(mode==='lobby'){if(activePlaylist==='lobby'&&current.startsWith('global:lobby-'))return;activePlaylist='lobby';const saved=recall('ud-lobby-track');const valid=playlists.lobby.length?playlists.lobby.some(id=>saved==='lobby-'+id):saved==='lobby';select('global',valid?saved:chooseTrack('lobby'));}
    else if(soundId){activePlaylist='';select('scenarios',soundId,scenarioVolume);}
    else {if(activePlaylist==='battle'&&current.startsWith('global:battle-'))return;activePlaylist='battle';select('global',chooseTrack('battle'));}
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
  const lastEffectAt=new Map();function effect(id){if(muted||!effectVolume||!unlocked||!id)return;const now=performance.now();if(now-(lastEffectAt.get(id)||-1000)<130)return;lastEffectAt.set(id,now);
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
  return {context,configurePlaylists,effect,settings,unlock:start,get state(){return{mode,scenario,volume:musicVolume,musicVolume,effectVolume,muted,current}}};
}
