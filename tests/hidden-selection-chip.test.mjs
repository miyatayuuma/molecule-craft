import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const [shell,app]=await Promise.all([
  readFile(new URL('src/game-shell.js',root),'utf8'),
  readFile(new URL('src/app.js',root),'utf8'),
]);

const hiddenSelectors=shell.slice(shell.indexOf('for(const selector of ['),shell.indexOf('])for(const node'));
assert.doesNotMatch(hiddenSelectors,/#selection-chip/,'Selection chip must keep a layout box for spawn safe-area geometry');
assert.match(shell,/selectionChip\.style\.visibility='hidden'/,'Selection chip should be visually suppressed without display:none');
assert.match(app,/chip=selectionChip\.getBoundingClientRect\(\)/,'Spawn planning still depends on the selection chip rectangle');
assert.match(app,/bottom:Math\.max\(72,selectionChip\.textContent\?rect\.bottom-chip\.top\+12:72\)/,'Regression test must track the lower spawn inset calculation');
