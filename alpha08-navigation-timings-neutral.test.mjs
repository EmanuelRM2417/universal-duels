import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('./public/'+n+'.html',import.meta.url),'utf8');
const index=read('index'),practice=read('practice'),catalog=read('catalog'),tutorial=read('tutorial');
for(const [name,text] of [['practice',practice],['catalog',catalog],['tutorial',tutorial]]){
 if(name==='practice')assert.match(text,/id="udPracticeReturnHome"[^>]*>Volver al menú principal<\/button>/,name);
 else assert.match(text,/class="ud-menu-return"[^>]*>Volver al menú principal<\/button>/,name);
 assert.doesNotMatch(text,/href="\/">← Volver al juego/);
}
assert.doesNotMatch(practice,/<nav class="row">[^<]*<a href="\/catalog.html">/);
assert.doesNotMatch(tutorial,/<a href="\/practice.html">Probar en Entrenamiento<\/a>/);
assert.match(index,/backgroundId=data\.scenario\?sc\.imageId:udNeutralSceneId/);
assert.match(practice,/!data\?\.scenario\?udNeutralSceneId:''/);
assert.match(index,/const playbackLimit=battle\?\.phase==='replacement'\?8000:12500;/,'longer online playback but capped to preserve timed decisions');
assert.match(index,/serverDeadline\?serverDeadline-Date\.now\(\)-8500/,'must reserve time for online actions');
assert.match(index,/await wait\(650\);continue/,'movement headline visible before next narration event');
assert.match(practice,/await wait\(720\); \/\/ Tiempo mínimo/,'practice movement headline readable');
assert.match(practice,/await wait\(udReadImpact\(line\)\?700:1250\)/,'practice damage text has dwell time');
assert.match(practice,/const sleep=ms=>new Promise\(r=>setTimeout\(r,Math\.round\(ms\*speedFactor\(\)\)\)\)/,'one common speed factor');
assert.match(practice,/wait=ms=>sleep\(ms\)/,'no double application of speed factor');
for(const html of [index,practice]){
 assert.match(html,/:root\{--ud-speed-multiplier:1\.2\}/,'CSS animations match JS default speed');
 assert.match(html,/document\.documentElement\.style\.setProperty\('--ud-speed-multiplier',String\(speedFactor\(\)\)\)/,'speed selection updates CSS animations');
}
console.log('Alpha 0.8: navigation simplified, neutral scenario fallback, timeline capped and audio/visual pacing synchronized');
