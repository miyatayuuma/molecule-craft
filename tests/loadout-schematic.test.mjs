import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source=readFileSync(new URL('../src/veil/loadout-workstation.js',import.meta.url),'utf8');

test('loadout workstation renders a sparse PULSE / DRIVE schematic',()=>{
  assert.match(source,/loadout-schematic-lines/);
  assert.match(source,/loadout-schematic-path/);
  assert.match(source,/loadout-schematic-node/);
  assert.match(source,/loadout-pulse-label','PULSE'/);
  assert.match(source,/loadout-drive-label','DRIVE'/);
  assert.match(source,/--loadout-drive-cell:15\.333333%/);
  assert.match(source,/calc\(var\(--loadout-drive-left\) \+ var\(--loadout-drive-cell\)\)/);
});

test('schematic keeps launch gestures unobstructed and centered on the existing ship coordinate',()=>{
  assert.match(source,/#supply-dialog \.loadout-schematic-lines\{[\s\S]*?pointer-events:none/);
  assert.match(source,/#supply-dialog \.loadout-callout-label\{[\s\S]*?pointer-events:none/);
  assert.match(source,/--loadout-ship-x:39%/);
  assert.match(source,/#supply-dialog #collector-launch-handle\{[\s\S]*?left:var\(--loadout-ship-x\)!important/);
  assert.match(source,/#supply-dialog #expedition-destinations button\{left:var\(--loadout-ship-x\)!important/);
});

test('current loadout uses existing molecule model assets with formula as auxiliary text',()=>{
  assert.match(source,/RESOURCE_KEY/);
  assert.match(source,/state\?\.loadout\?\.tanks/);
  assert.match(source,/assets\/models\/molecule-\$\{id\}\.svg/);
  assert.match(source,/loadout-molecule-thumb/);
  assert.match(source,/shell-port>small/);
  assert.match(source,/loadout-slot-empty/);
  assert.match(source,/MutationObserver/);
  assert.match(source,/tank-molecules/);
});

test('responsive layout keeps the one-piece DRIVE unit and readable external labels',()=>{
  assert.match(source,/loadout-drive-unit\.png/);
  assert.match(source,/loadout-drive-image/);
  assert.match(source,/@media\(max-width:370px\)/);
  assert.match(source,/loadout-callout-label\{font-size:10px\}/);
  assert.doesNotMatch(source,/loadout-drive-fuel-image|loadout-drive-oxidizer-image|loadout-drive-coolant-image/);
});
