import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {LOADOUT_SLOT_GEOMETRY} from '../src/veil/loadout-workstation.js';

const source=readFileSync(new URL('../src/veil/loadout-workstation.js',import.meta.url),'utf8');
const SLOT_USES=['propellant','fuel','oxidizer','coolant'];
const EXPECTED_GEOMETRY=Object.freeze({
  propellant:Object.freeze({centerX:16.05,left:10.6,width:10.9,top:38.5,height:27,labelX:16.05}),
  fuel:Object.freeze({centerX:65.1,left:60.1,width:10,top:38,height:27,labelX:65.1}),
  oxidizer:Object.freeze({centerX:77.2,left:72.2,width:10,top:38,height:27,labelX:77.2}),
  coolant:Object.freeze({centerX:88.8,left:83.8,width:10,top:38,height:27,labelX:88.8}),
});
const frameOf=({width,top,height})=>({width,top,height});
const rightOf=geometry=>geometry.left+geometry.width;

function assertClose(actual,expected,message){
  assert.ok(Math.abs(actual-expected)<1e-9,`${message}: expected ${expected}, got ${actual}`);
}

test('LOADOUT slot geometry matches the approved current contract',()=>{
  assert.deepEqual(Object.keys(LOADOUT_SLOT_GEOMETRY),SLOT_USES);
  for(const use of SLOT_USES){
    const geometry=LOADOUT_SLOT_GEOMETRY[use],expected=EXPECTED_GEOMETRY[use];
    assert.deepEqual(geometry,expected,`${use} geometry`);
    assertClose(geometry.left,geometry.centerX-geometry.width/2,`${use} left edge derives from center and width`);
    assert.equal(geometry.labelX,geometry.centerX,`${use} label stays centered`);
  }
});

test('PULSE and DRIVE slots retain their shared frame contracts',()=>{
  assert.deepEqual(frameOf(LOADOUT_SLOT_GEOMETRY.propellant),{width:10.9,top:38.5,height:27});
  const driveFrame={width:10,top:38,height:27};
  for(const use of ['fuel','oxidizer','coolant'])assert.deepEqual(frameOf(LOADOUT_SLOT_GEOMETRY[use]),driveFrame,`${use} DRIVE frame`);
});

test('DRIVE slot rectangles do not overlap',()=>{
  const driveUses=['fuel','oxidizer','coolant'];
  for(let i=0;i<driveUses.length-1;i++){
    const leftUse=driveUses[i],rightUse=driveUses[i+1];
    assert.ok(rightOf(LOADOUT_SLOT_GEOMETRY[leftUse])<=LOADOUT_SLOT_GEOMETRY[rightUse].left,`${leftUse} must not overlap ${rightUse}`);
  }
});

test('SVG hit overlay derives rectangular tap bounds from LOADOUT_SLOT_GEOMETRY',()=>{
  assert.match(source,/loadout-slot-overlay/);
  assert.match(source,/class:'loadout-slot-path'/);
  assert.match(source,/'data-use':use/);
  assert.match(source,/svgElement\('rect',\{class:'loadout-slot-path','data-use':use,\.\.\.svgRectGeometry\(LOADOUT_SLOT_GEOMETRY\[use\]\)\}\)/);
  assert.match(source,/document\.getElementById\(`shell-\$\{use\}`\)\?\.click\(\)/);
  assert.match(source,/\.loadout-slot-path\{[^}]*pointer-events:visibleFill/);
  assert.match(source,/\.shell-port\{[^}]*pointer-events:none/);
});

test('schematic, labels, pods, and hit areas stay wired to shared geometry',()=>{
  assert.match(source,/const centerX=use=>LOADOUT_SLOT_GEOMETRY\[use\]\.centerX/);
  assert.match(source,/button\.style\.setProperty\('--slot-left',pct\(geometry\.left\)\)/);
  assert.match(source,/button\.style\.setProperty\('--slot-width',pct\(geometry\.width\)\)/);
  assert.match(source,/button\.style\.setProperty\('--slot-top',pct\(geometry\.top\)\)/);
  assert.match(source,/button\.style\.setProperty\('--slot-height',pct\(geometry\.height\)\)/);
  assert.match(source,/LOADOUT_SLOT_GEOMETRY\[use\]\.labelX/);
  assert.match(source,/left:var\(--slot-left\)!important/);
  assert.match(source,/width:var\(--slot-width\)!important/);
  assert.match(source,/top:var\(--slot-top\)!important/);
  assert.match(source,/height:var\(--slot-height\)!important/);
});

test('selection highlight uses the same rectangular tank overlay',()=>{
  assert.match(source,/loadout-slot-path\[data-use='propellant'\]/);
  assert.match(source,/loadout-slot-path\[data-use='fuel'\]/);
  assert.match(source,/loadout-slot-path\[data-use='oxidizer'\]/);
  assert.match(source,/loadout-slot-path\[data-use='coolant'\]/);
  assert.match(source,/stroke:#a8edf5d6/);
  assert.match(source,/fill-opacity:\.12/);
  assert.doesNotMatch(source,/\.shell-port\[data-active=true\]:before/);
  assert.doesNotMatch(source,/\.port-propellant\[data-active=true\]:before/);
});

test('current molecule display is frameless, separated, and sits behind tank art',()=>{
  assert.match(source,/loadout-molecule-pod/);
  assert.match(source,/\.loadout-unit-image\{[^}]*z-index:2/);
  assert.match(source,/\.shell-port\{z-index:0!important/);
  assert.match(source,/\.loadout-molecule-pod\{[^}]*top:calc\(100% \+ 28px\)[^}]*width:145%;height:54px[^}]*transform:translate\(-50%,-50%\)[^}]*border:0[^}]*background:none[^}]*box-shadow:none[^}]*pointer-events:none/);
  assert.match(source,/\.loadout-molecule-thumb\{width:100%;height:100%/);
  assert.match(source,/#shell-fuel:not\(\.loadout-slot-empty\)>\.loadout-molecule-pod\{left:18%\}/);
  assert.match(source,/#shell-coolant:not\(\.loadout-slot-empty\)>\.loadout-molecule-pod\{left:82%\}/);
  assert.match(source,/\.port-propellant>\.loadout-molecule-pod\{width:175%;height:62px;top:calc\(100% \+ 28px\)/);
  assert.match(source,/\.loadout-slot-empty>\.loadout-molecule-pod\{left:50%;top:calc\(100% \+ 16px\);width:100%;height:24px/);
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
  assert.match(source,/loadout-molecule-pod\{height:50px;transform:translate\(-50%,-50%\)/);
  assert.match(source,/port-propellant>\.loadout-molecule-pod\{height:56px;transform:translate\(-50%,-50%\)/);
  assert.match(source,/loadout-slot-empty>\.loadout-molecule-pod\{height:24px;transform:translateX\(-50%\)/);
  assert.doesNotMatch(source,/loadout-drive-fuel-image|loadout-drive-oxidizer-image|loadout-drive-coolant-image/);
});
