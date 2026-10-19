// Shared sound director: a single soundtrack at a time, no polling.
// Browser autoplay policies require a gesture; audio stays silent until enabled.
export function createSoundDirector({url=(kind,id,revision)=>`/api/audio/${kind}/${id}?revision=${encodeURIComponent(revision||'')}`}={}){
  const music=new Audio();music.loop=true;music.preload='none';
  let volume=Number(localStorage.getItem('ud-audio-volume')??0.45),muted=localStorage.getItem('ud-audio-muted')==='true';
  let unlocked=false,mode='lobby',scenario='',revision='',current='',soundVolume=100;
  const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));volume=clamp(volume);
  const sync=()=>{music.volume=muted?0:clamp(volume*soundVolume/100);};sync();
  const start=()=>{unlocked=true;if(current)music.play().catch(()=>{});};
  document.addEventListener('pointerdown',start,{once:true});document.addEventListener('keydown',start,{once:true});
  function select(kind,id,vol=100){const key=kind+':'+id+':'+revision;if(current===key){soundVolume=vol;sync();return;}
    current=key;soundVolume=vol;music.pause();music.removeAttribute('src');music.load();
    if(!id)return;music.src=url(kind,id,revision);music.currentTime=0;sync();
    if(unlocked)music.play().catch(()=>{});
  }
  function context(next,{scenarioId='',soundId='',scenarioVolume=100,revision:rev=''}={}){
    mode=next;revision=rev||revision;scenario=scenarioId||'';
    if(mode==='lobby')select('global','lobby');
    else if(soundId)select('scenarios',soundId,scenarioVolume);
    else select('global','battle');
  }
  function effect(id){if(muted||!volume||!unlocked)return;
    const a=new Audio(url('global',id,revision));a.volume=volume;a.play().catch(()=>{
      // Lightweight fallback effects when the optional MP3 is absent.
      if(['stat-up','stat-down','physical','special','status','portal-in','portal-out'].includes(id))beep(id);
    });
  }
  let audioCtx=null;
  function beep(id){try{audioCtx ||=new (window.AudioContext||window.webkitAudioContext)();
    const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),now=audioCtx.currentTime;
    const tones={'stat-up':[420,700],'stat-down':[600,240],physical:[130,80],special:[540,340],status:[300,400],'portal-in':[170,620],'portal-out':[620,170]};
    const [a,b]=tones[id]||[300,500];osc.type=id==='physical'?'sawtooth':'sine';osc.frequency.setValueAtTime(a,now);osc.frequency.exponentialRampToValueAtTime(Math.max(30,b),now+0.16);
    gain.gain.setValueAtTime(Math.min(.12,volume*.12),now);gain.gain.exponentialRampToValueAtTime(.001,now+.20);osc.connect(gain).connect(audioCtx.destination);osc.start(now);osc.stop(now+.21);
  }catch{}}
  function settings(){const el=document.createElement('aside');el.id='udAudioSettings';el.style.cssText='position:fixed;bottom:12px;right:12px;z-index:9999;background:#171b2ef0;color:white;border:1px solid #7d82a8;border-radius:12px;padding:9px;font:12px system-ui;box-shadow:0 5px 20px #0008;max-width:190px';
    const title=document.createElement('div');title.textContent='♫ Sonido';title.style.fontWeight='bold';
    const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.value=String(Math.round(volume*100));slider.setAttribute('aria-label','Volumen general');slider.style.width='100%';
    slider.oninput=()=>{volume=clamp(Number(slider.value)/100);localStorage.setItem('ud-audio-volume',String(volume));sync();};
    const mute=document.createElement('button');mute.style.cssText='font:inherit;background:#323b60;color:white;border:1px solid #7882a8;border-radius:6px;padding:4px 8px';
    const label=()=>mute.textContent=muted?'Activar sonido':'Silenciar';label();mute.onclick=()=>{muted=!muted;localStorage.setItem('ud-audio-muted',String(muted));label();sync();};
    el.append(title,slider,mute);document.body.append(el);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',settings,{once:true});else settings();
  return {context,effect,settings,unlock:start,get state(){return{mode,scenario,volume,muted,current}}};
}
