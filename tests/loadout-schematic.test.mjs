import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source=readFileSync(new URL('../src/veil/loadout-workstation.js',import.meta.url),'utf8');

test('loadout workstation uses straight rectangular geometry on white tank structures',()=>{
  assert.match(source,/LOADOUT_SLOT_GEOMETRY/);
  assert.match(source,/propellant:Object\.freeze\(\{left:9\.6,width:10\.9/);
  assert.match(source,/fuel:Object\.freeze\(\{left:59\.0,width:10\.2/);
  assert.match(source,/oxidizer:Object\.freeze\(\{left:71\.0,width:9\.0/);
  assert.match(source,/coolant:Object\.freeze\(\{left:82\.4,width:9\.4/);
  assert.match(source,/shape:'M96 75 H205 V129 H96 Z'/);
  assert.match(source,/shape:'M590 76 H692 V130 H590 Z'/);
  assert.match(source,/shape:'M710 76 H800 V130 H710 Z'/);
  assert.match(source,/shape:'M824 76 H918 V130 H824 Z'/);
  assert.doesNotMatch(source,/shape:'[^']*[QLC]/);
  assert.doesNotMatch(source,/--loadout-drive-cell/);
});

test('SVG hit overlay forwards clicks only from tank paths',()=>{
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

test('selection highlight uses the same rectangular tank path',()=>{
  assert.match(source,/loadout-slot-path\[data-use='fuel'\]/);
  assert.match(source,/loadout-slot-path\[data-use='oxidizer'\]/);
  assert.match(source,/loadout-slot-path\[data-use='coolant'\]/);
  assert.match(source,/stroke:#a8edf5d6/);
  assert.match(source,/fill-opacity:\.12/);
  assert.doesNotMatch(source,/\.shell-port\[data-active=true\]:before/);
  assert.doesNotMatch(source,/\.port-propellant\[data-active=true\]:before/);
});

test('dark end caps and inter-tank connectors remain outside hit boxes',()=>{
  assert.match(source,/fuel:Object\.freeze\([^\n]*shape:'M590 76 H692/);
  assert.match(source,/oxidizer:Object\.freeze\([^\n]*shape:'M710 76 H800/);
  assert.match(source,/coolant:Object\.freeze\([^\n]*shape:'M824 76 H918/);
  assert.doesNotMatch(source,/M576 76 H700/);
  assert.doesNotMatch(source,/M695 76 H812/);
  assert.doesNotMatch(source,/M810 76 H932/);
});

test('vertical bounds remain unchanged from the approved silhouette pass',()=>{
  assert.match(source,/propellant:Object\.freeze\(\{left:9\.6,width:10\.9,top:36\.5,height:31\.5/);
  assert.match(source,/fuel:Object\.freeze\(\{left:59\.0,width:10\.2,top:37\.0,height:30\.0/);
  assert.match(source,/oxidizer:Object\.freeze\(\{left:71\.0,width:9\.0,top:37\.0,height:30\.0/);
  assert.match(source,/coolant:Object\.freeze\(\{left:82\.4,width:9\.4,top:37\.0,height:30\.0/);
});

test('current molecule display is frameless and sits behind tank art',()=>{
  assert.match(source,/loadout-molecule-pod/);
  assert.match(source,/\.loadout-unit-image\{[^}]*z-index:2/);
  assert.match(source,/\.shell-port\{z-index:0!important/);
  assert.match(source,/\.loadout-molecule-pod\{[^}]*top:0[^}]*width:56px;height:54px[^}]*transform:translate\(-50%,-58%\)[^}]*border:0[^}]*background:none[^}]*box-shadow:none[^}]*pointer-events:none/);
  assert.match(source,/\.loadout-molecule-thumb\{width:56px;height:54px/);
  assert.match(source,/\.loadout-pod-formula\{display:none!important\}/);
  assert.doesNotMatch(source,/background:linear-gradient\(180deg,#102b3be8,#081923ee\)/);
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
  assert.match(source,/loadout-molecule-pod\{width:48px;height:50px;top:0;transform:translate\(-50%,-56%\)/);
  assert.match(source,/port-propellant>\.loadout-molecule-pod\{width:60px;height:56px;top:0/);
  assert.doesNotMatch(source,/loadout-drive-fuel-image|loadout-drive-oxidizer-image|loadout-drive-coolant-image/);
});
