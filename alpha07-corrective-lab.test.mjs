import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
for(const [label,rx] of [
 ['escenario 4:3',/aspect-ratio:4\/3!important/],
 ['sin segundo óvalo de rivales',/\.battle-stage::before\{display:none!important;content:none!important\}/],
 ['única arena con campo',/color-mix\(in srgb,var\(--field-color/],
 ['panel fijo',/\.battle-command-panel:empty\{display:grid!important;visibility:hidden\}/],
 ['espacio Info vacío',/class="ud-action-spacer" aria-hidden="true"/],
 ['botones i',/class="ud-move-info" data-move-info/],
 ['modal conectado',/querySelectorAll\('\[data-move-info\]'\)/],
 ])assert.match(html,rx,label);
assert.doesNotMatch(html,/id="battleMoveInfo"/);
assert.match(html,/function wireManualControl\(\)/);
console.log('Alpha 0.7 corrective Lab: arena, moves info, static layout OK');
