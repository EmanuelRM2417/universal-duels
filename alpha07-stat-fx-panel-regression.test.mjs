import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
for(const name of ['index','practice']){
 const html=readFileSync(new URL(`./public/${name}.html`,import.meta.url),'utf8');
 const start=html.indexOf('async function '+(name==='index'?'udAnimateStatGroups':'udAnimatePracticeStatGroups')+'(');
 const end=html.indexOf(name==='index'?'function udPlayStatFx':'function unitHTML',start);
 assert.ok(start>=0 && end>start);
 // Helper is intentionally evaluated with fake render/sound/wait, never a network game.
 const text=html.slice(start,end);
 const screenshots=[],waits=[],sounds=[],ctx={Date,Map,Set};
 const cache=new Map();
 const renderer=()=>screenshots.push([...cache].flatMap(([unit,changes])=>changes.map(c=>unit+':'+c.stat)));
 if(name==='index'){
   Object.assign(ctx,{udStatBursts:cache,battleDisplayData:{},renderBattle:renderer,wait:async ms=>waits.push(ms),window:{udSound:{effect:s=>sounds.push(s)}}});
 }else{
   Object.assign(ctx,{battleTransientFx:cache,battleDisplayData:{},renderBattle:renderer,sleep:async ms=>waits.push(ms),udSound:{effect:s=>sounds.push(s)}});
 }
 vm.createContext(ctx);vm.runInContext(text,ctx);
 const fn=ctx[name==='index'?'udAnimateStatGroups':'udAnimatePracticeStatGroups'];
 await fn([
  {side:'left',teamIndex:0,stat:'speed',delta:-1},
  {side:'right',teamIndex:0,stat:'speed',delta:-1},
  {side:'left',teamIndex:0,stat:'evasion',delta:1},
  {side:'right',teamIndex:1,stat:'evasion',delta:2},
 ],'Prueba del entorno');
 assert.deepEqual(screenshots[0],['left:0:speed','right:0:speed'],`${name}: all speed changes first`);
 assert.deepEqual(screenshots[1],['left:0:evasion','right:1:evasion'],`${name}: then all evasion changes`);
 assert.equal(waits.length,2);assert.ok(waits.every(v=>v===2000));
 assert.deepEqual(sounds,['stat-down','stat-up']);assert.equal(cache.size,0);
 assert.match(html,/data-battle-modal="environment"/,'field/weather/scenario detail restored in left panel');
 assert.match(html,/min-height:100%!important/,'narrator fills available action panel height');
 assert.match(html,/battle-stage:not\(:has\(\.battle-unit\.enemy\.slot-1\)\)/,'Singles nameplate centers between the Doubles slots');
}
console.log('Alpha 0.7: stat FX order, per-stat groups, two-second timing, narrator sizing, environment detail and Singles card position OK');
