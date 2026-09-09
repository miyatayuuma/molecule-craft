import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source=readFileSync(new URL('../src/veil/loadout-workstation.js',import.meta.url),'utf8');

test('loadout workstation defines tank-silhouette geometry instead of rectangular thirds',()=>{
  assert.match(source,/LOADOUT_SLOT_GEOMETRY/);
  assert.match(source,/propellant:Object\.freeze\(\{left:9\.0,width:12\.9/);
  assert.match(source,/fuel:Object\.freeze\(\{left:57\.7,width:12\.2/);
  assert.match(source,/oxidizer:Object\.freeze\(\{left:69\.9,width:11\.3/);
  assert.match(source,/coolant:Object\.freeze\(\{left:81\.4,width:11\.6/);
  for(const use of ['propellant','fuel','oxidizer','coolant'])assert.match(source,new RegExp(`${use}:Object\\.freeze\\(\\{[^}]*shape:'M`));
  assert.doesNotMatch(source,/--loadout-drive-cell/);
});

test('SVG hit overlay forwards clicks only from tank silhouette paths',()=>{
  assert.match(source,/loadout-slot-overlay/);
  assert.match(source,/class:'loadout-slot-path'/);
  assert.match(source,/'data-use':use/);
  assert.match(source,/d:LOADOUT_SLOT_GEOMETRY\[use\]\.shape/);
  assert.match(source,/document\.getElementById\(`shell-\$\{use\}`\)\?\.click\(\)/);
  assert.match(source,/\.loadout-slot-path\{[^}]*pointer-events:visibleFill/);
  assert.match(source,/\.shell-port\{[^}]*pointer-events:none/);
});

test('schematic, labels, pods, and hit areas share geometry-derived centers',()=>{
  assert.match(source,/const centerX=use=>LOADOUT_SLOT_GEOMETRY\[use\]\.labelX/);
  assert.match(source,/centerX\('fuel'\)/);
  assert.match(source,/centerX\('oxidizer'\)/);
  assert.match(source,/centerX\('coolant'\)/);
  assert.match(source,/--slot-label-x/);
  assert.match(source,/left:var\(--slot-left\)!important/);
  assert.match(source,/width:var\(--slot-width\)!important/);
});

test('selection highlight follows silhouette path rather than rectangular pseudo element',()=>{
  assert.match(source,/loadout-slot-path\[data-use='fuel'\]/);
  assert.match(source,/loadout-slot-path\[data-use='oxidizer'\]/);
  assert.match(source,/loadout-slot-path\[data-use='coolant'\]/);
  assert.match(source,/stroke:#a8edf5d6/);
  assert.match(source,/fill-opacity:\.12/);
  assert.doesNotMatch(source,/\.shell-port\[data-active=true\]:before/);
  assert.doesNotMatch(source,/\.port-propellant\[data-active=true\]:before/);
});

test('dark end caps and connectors are excluded by gaps between silhouette paths',()=>{
  assert.match(source,/fuel:Object\.freeze\([^\n]*shape:'M592 76 H678/);
  assert.match(source,/oxidizer:Object\.freeze\([^\n]*shape:'M713 76 H791/);
  assert.match(source,/coolant:Object\.freeze\([^\n]*shape:'M828 76 H910/);
  assert.doesNotMatch(source,/fuel:Object\.freeze\(\{left:56\.6,width:12\.7/);
  assert.doesNotMatch(source,/coolant:Object\.freeze\(\{left:80\.7,width:15\.0/);
});

test('current molecule display keeps the backed pod below each tank',()=>{
  assert.match(source,/loadout-molecule-pod/);
  assert.match(source,/background:linear-gradient\(180deg,#102b3be8,#081923ee\)/);
  assert.match(source,/top:calc\(100% \+ 18px\)/);
  assert.match(source,/width:58px/);
  assert.match(source,/loadout-pod-formula/);
  assert.match(source,/assets\/models\/molecule-\$\{id\}\.svg/);
});

test('stock preview remains a simple shortage bar and hides when fully affordable',()=>{
  assert.match(source,/syncStockPreview/);
  assert.match(source,/材料不足/);
  assert.match(source,/loadout-shortage-status/);
  assert.match(source,/chip\.dataset\.sufficient==='false'/);
  assert.match(source,/if\(!insufficient\)\{preview\.hidden=true;return;\}/);
  assert.match(source,/scaleX\(\$\{ratio\}\)/);
});

test('launch gestures stay on the existing ship anchor and overlay disables during destination selection',()=>{
  assert.match(source,/--loadout-ship-x:39%/);
  assert.match(source,/#supply-dialog #collector-launch-handle\{[^}]*left:var\(--loadout-ship-x\)!important/);
  assert.match(source,/expedition-destinations\[aria-hidden='false'\][^\n]*\.loadout-slot-path\{pointer-events:none\}/);
});

test('responsive layout keeps one-piece DRIVE and molecule pods readable',()=>{
  assert.match(source,/loadout-drive-unit\.png/);
  assert.match(source,/@media\(max-width:370px\)/);
  assert.match(source,/loadout-molecule-pod\{width:52px;height:37px/);
  assert.doesNotMatch(source,/loadout-drive-fuel-image|loadout-drive-oxidizer-image|loadout-drive-coolant-image/);
});
