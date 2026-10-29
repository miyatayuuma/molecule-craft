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

assert.match(index,/id="craft-target"[^>]*>[\s\S]*?class="craft-emblem"[\s\S]*?id="craft-target-formula"[\s\S]*?id="craft-target-name" hidden[\s\S]*?id="craft-target-atoms"/);
assert.match(index,/id="cho-goal-atoms"/);
assert.doesNotMatch(index,/id="veil-to-craft(?:-atoms|-label)?"/,'FIELD has no separate return or craft button');
assert.match(app,/resources\.state\.recipes\.includes\(id\)\|\|resources\.state\.hints\.includes\(id\)/);
assert.match(app,/targetDiscovered:resources\.state\.recipes\.includes\(craftTargetId\)/);
assert.match(panel,/nodes\.targetName\.hidden=!discovered/);
assert.match(panel,/export function renderCraftTargetAtoms/);
assert.match(veilUi,/import \{ renderCraftTargetAtoms \} from '\.\.\/craft-panel\.js\?v=3'/);
assert.match(veilUi,/returnState=null/);
assert.match(veilUi,/renderCraftTargetAtoms\(q\('cho-goal-atoms'/);
assert.doesNotMatch(veilUi,/pendingCraftId|source:'field'|veil-to-craft/,'Extraction has no separate field craft or return action');
assert.match(styles,/Unified craft target strip/);
assert.match(veilCss,/#craft-target:not\(\[hidden\]\)~#cho-goal-action/);
assert.deepEqual(craftTargetSlots({atoms:['C','H','H','H','H']},[]).map(x=>x.symbol),['C','H','H','H','H']);

console.log('Unified craft target tests passed.');
