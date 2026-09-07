import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {craftTargetSlots} from '../src/craft-panel.js';

const root=new URL('../',import.meta.url);
const [index,app,panel,veilUi,styles,veilCss]=await Promise.all([
  readFile(new URL('index.html',root),'utf8'),
  readFile(new URL('src/app.js',root),'utf8'),
  readFile(new URL('src/craft-panel.js',root),'utf8'),
  readFile(new URL('src/veil/ui.js',root),'utf8'),
  readFile(new URL('styles.css',root),'utf8'),
  readFile(new URL('veil.css',root),'utf8'),
]);

assert.match(index,/id="craft-target"[^>]*>[\s\S]*?class="craft-emblem"[\s\S]*?id="craft-target-formula"[\s\S]*?id="craft-target-atoms"[\s\S]*?id="craft-target-name" hidden/,'Active target must read emblem → formula → atom models → optional name');
assert.match(index,/id="cho-goal-atoms"/);
assert.match(index,/id="veil-to-craft-atoms"/);
assert.match(app,/resources\.state\.recipes\.includes\(id\)\|\|resources\.state\.hints\.includes\(id\)/,'Hinted undiscovered molecules must be targetable');
assert.match(app,/targetDiscovered:resources\.state\.recipes\.includes\(craftTargetId\)/,'Discovery state must be explicit when rendering the target');
assert.match(panel,/nodes\.targetName\.hidden=!discovered/,'Undiscovered target names must stay hidden');
assert.match(panel,/export function renderCraftTargetAtoms/,'Atom previews must share one renderer');
assert.match(veilUi,/renderCraftTargetAtoms\(q\('cho-goal-atoms'\)/);
assert.match(veilUi,/renderCraftTargetAtoms\(q\('veil-to-craft-atoms'\)/);
assert.match(veilUi,/pendingCraftId=id/);
assert.match(veilUi,/source:'field'/,'Field-return hint must become the same craft target after return');
assert.match(styles,/Unified craft target strip/);
assert.match(veilCss,/#craft-target:not\(\[hidden\]\)~#cho-goal-action/,'Campaign shortcut must not duplicate an active target');
assert.deepEqual(craftTargetSlots({atoms:['C','H','H','H','H']},[]).map(x=>x.symbol),['C','H','H','H','H']);

console.log('Unified craft target tests passed.');
