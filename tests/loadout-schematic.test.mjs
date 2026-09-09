import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source=readFileSync(new URL('../src/veil/loadout-workstation.js',import.meta.url),'utf8');

test('loadout workstation uses explicit image-space slot geometry instead of equal thirds',()=>{
  assert.match(source,/LOADOUT_SLOT_GEOMETRY/);
  assert.match(source,/fuel:Object\.freeze\(\{left:56\.6,width:12\.7/);
  assert.match(source,/oxidizer:Object\.freeze\(\{left:68\.8,width:12\.5/);
  assert.match(source,/coolant:Object\.freeze\(\{left:80\.7,width:15\.0/);
  assert.doesNotMatch(source,/--loadout-drive-cell/);
  assert.match(source,/left:var\(--slot-left\)!important/);
  assert.match(source,/width:var\(--slot-width\)!important/);
});

test('schematic and labels share geometry-derived tank centers',()=>{
  assert.match(source,/centerX\('fuel'\)/);
  assert.match(source,/centerX\('oxidizer'\)/);
  assert.match(source,/centerX\('coolant'\)/);
  assert.match(source,/--slot-label-x/);
  assert.match(source,/loadout-schematic-path/);
});

test('selection highlight follows each actual tank hit area without blocking launch gestures',()=>{
  assert.match(source,/\.shell-port\[data-active=true\]:before/);
  assert.match(source,/border-color:#a8edf5c4/);
  assert.match(source,/#supply-dialog \.loadout-schematic-lines\{[\s\S]*?pointer-events:none/);
  assert.match(source,/--loadout-ship-x:39%/);
  assert.match(source,/#supply-dialog #collector-launch-handle\{[\s\S]*?left:var\(--loadout-ship-x\)!important/);
});

test('current molecule display uses a larger backed pod below each tank',()=>{
  assert.match(source,/loadout-molecule-pod/);
  assert.match(source,/background:linear-gradient\(180deg,#102b3be8,#081923ee\)/);
  assert.match(source,/top:calc\(100% \+ 18px\)/);
  assert.match(source,/width:58px/);
  assert.match(source,/loadout-pod-formula/);
  assert.match(source,/assets\/models\/molecule-\$\{id\}\.svg/);
});

test('stock preview collapses to a simple shortage bar and hides when fully affordable',()=>{
  assert.match(source,/syncStockPreview/);
  assert.match(source,/材料不足/);
  assert.match(source,/loadout-shortage-status/);
  assert.match(source,/chip\.dataset\.sufficient==='false'/);
  assert.match(source,/if\(!insufficient\)\{preview\.hidden=true;return;\}/);
  assert.match(source,/scaleX\(\$\{ratio\}\)/);
});

test('responsive layout keeps one-piece DRIVE and molecule pods readable',()=>{
  assert.match(source,/loadout-drive-unit\.png/);
  assert.match(source,/@media\(max-width:370px\)/);
  assert.match(source,/loadout-molecule-pod\{width:52px;height:37px/);
  assert.doesNotMatch(source,/loadout-drive-fuel-image|loadout-drive-oxidizer-image|loadout-drive-coolant-image/);
});
