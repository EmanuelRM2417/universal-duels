import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
const main=read('./public/index.html');
const practice=read('./public/practice.html');
const onboarding=read('./public/account-onboarding.js');
const narrator=read('./public/narrator-templates.js');
// CSS must override earlier *more specific* battle rules, not merely use !important.
for(const [page,html] of [['Salas',main],['Entrenamiento',practice]]) {
 assert.match(html,/body:has\(#battleView:not\(\.hidden\)\) #battleView \.battle-stage::after\s*\{\s*left:var\(--ud-oval-x/,'Oval must win in '+page);
 for(const value of ['--ud-oval-y','--ud-oval-width','--ud-oval-height'])assert.ok(html.includes(value));
 assert.match(html,/function udApplyOvalLayout\(oval\)/,'Published layout loaded in '+page);
}
assert.match(main,/udApplyOvalLayout\(config\?\.fieldOval\)/);
assert.match(practice,/udApplyOvalLayout\(d\.uiLayout\?\.fieldOval\)/);
// Initial hidden dialog stays hidden until auth/me resolves.
assert.match(main,/id="udAuthGate" hidden/);
assert.match(onboarding,/gate\.hidden=true;\s*try\{\s*const me=await json\('\/api\/auth\/me'\)/);
assert.match(onboarding,/else if\(rememberedGuest\(\)\)\{\s*account=null;allowPlay\(\);return;/);
assert.match(onboarding,/rememberGuest\(true\);tutorial\(true\)/);
assert.match(onboarding,/rememberGuest\(false\);window\.udAccountReady/);
assert.match(onboarding,/if\(account\.tutorialComplete\)\{allowPlay\(\);return;\}/);
// Explicit skip from guided tutorial propagates to parent, allows normal play and the server records Google completion.
assert.match(practice,/skip\.id='udTutorialSkip'/);
assert.match(practice,/parent\.postMessage\(\{type:'ud-tutorial-skip'\},location\.origin\)/);
assert.match(onboarding,/\['ud-tutorial-complete','ud-tutorial-skip'\]\.includes/);
assert.match(onboarding,/await json\('\/api\/auth\/tutorial-complete'/);
// Legacy incorrect message is normalized, both if emitted raw and if stored as a template.
const sandbox={window:{}};vm.runInNewContext(narrator,sandbox);
const format=sandbox.window.udNarratorFormat;
const bad='Ajolote ahora tiene 25 de daño.';
assert.equal(format(bad,[]),'Ajolote recibe 25 de daño.');
assert.equal(format('Ajolote recibe 25 de daño.',[{pattern:'[PERSONAJE] recibe [DAÑO] de daño.',replacement:'[PERSONAJE] ahora tiene [DAÑO] de daño.'}]),'Ajolote recibe 25 de daño.');
assert.equal(format('Ajolote recibe 25 de daño.',[]),'Ajolote recibe 25 de daño.');
assert.equal(format('Ajolote recupera 20 PS.',[]),'Ajolote recupera 20 PS.');
console.log('Alpha 0.8: oval cascade across both battle screens, session reload, tutorial skip, legacy narrator OK');
