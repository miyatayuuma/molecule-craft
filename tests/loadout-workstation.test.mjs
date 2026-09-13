import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { LOADOUT_SLOT_GEOMETRY } from '../src/veil/loadout-workstation.js';

const DRIVE_USES=['fuel','oxidizer','coolant'];
const right=slot=>Number((slot.left+slot.width).toFixed(2));

test('LOADOUT DRIVE slots share one fixed boundary frame',()=>{
  const slots=DRIVE_USES.map(use=>LOADOUT_SLOT_GEOMETRY[use]);
  assert.equal(new Set(slots.map(slot=>slot.width)).size,1);
  assert.equal(new Set(slots.map(slot=>slot.height)).size,1);
  assert.equal(new Set(slots.map(slot=>slot.top)).size,1);
  assert.equal(slots[0].width,10.0);
  assert.equal(slots[0].height,27);
  assert.equal(slots[0].top,38);
});

test('LOADOUT DRIVE boundaries use the tuned horizontal positions',()=>{
  const fuel=LOADOUT_SLOT_GEOMETRY.fuel;
  const oxidizer=LOADOUT_SLOT_GEOMETRY.oxidizer;
  const coolant=LOADOUT_SLOT_GEOMETRY.coolant;
  assert.deepEqual(
    [fuel.left,right(fuel),oxidizer.left,right(oxidizer),coolant.left,right(coolant)],
    [60.1,70.1,72.2,82.2,83.8,93.8],
  );
});

test('LOADOUT slot rectangles stay centered on their schematic anchors',()=>{
  for(const use of ['propellant',...DRIVE_USES]){
    const slot=LOADOUT_SLOT_GEOMETRY[use];
    assert.equal(Number((slot.left+slot.width/2).toFixed(2)),slot.centerX);
    assert.equal(slot.labelX,slot.centerX);
  }
});

test('LOADOUT PULSE boundary is shifted right and down',()=>{
  const pulse=LOADOUT_SLOT_GEOMETRY.propellant;
  assert.deepEqual(
    {left:pulse.left,width:pulse.width,top:pulse.top,height:pulse.height},
    {left:10.6,width:10.9,top:38.5,height:27},
  );
});

test('LOADOUT stock preview exposes element state without an explanatory shortage banner',async()=>{
  const source=await readFile(new URL('../src/veil/loadout-workstation.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/材料不足|loadout-shortage-status/);
  assert.match(source,/chip\.dataset\.stockState=chip\.dataset\.sufficient==='false'\?'short':'ready'/);
  assert.match(source,/preview\.setAttribute\('aria-label','必要元素'\)/);
  assert.match(source,/\[data-sufficient='false'\]/,'insufficient element chips receive direct visual state');
});
