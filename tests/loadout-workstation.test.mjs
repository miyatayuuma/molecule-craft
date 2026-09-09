import test from 'node:test';
import assert from 'node:assert/strict';
import { LOADOUT_SLOT_GEOMETRY } from '../src/veil/loadout-workstation.js';

const DRIVE_USES=['fuel','oxidizer','coolant'];
const right=slot=>Number((slot.left+slot.width).toFixed(2));

test('LOADOUT DRIVE slots share one fixed boundary frame',()=>{
  const slots=DRIVE_USES.map(use=>LOADOUT_SLOT_GEOMETRY[use]);
  assert.equal(new Set(slots.map(slot=>slot.width)).size,1);
  assert.equal(new Set(slots.map(slot=>slot.height)).size,1);
  assert.equal(new Set(slots.map(slot=>slot.top)).size,1);
  assert.equal(slots[0].width,11.4);
  assert.equal(slots[0].height,27);
  assert.equal(slots[0].top,38);
});

test('LOADOUT DRIVE boundaries follow the visible tank bodies and separators',()=>{
  const fuel=LOADOUT_SLOT_GEOMETRY.fuel;
  const oxidizer=LOADOUT_SLOT_GEOMETRY.oxidizer;
  const coolant=LOADOUT_SLOT_GEOMETRY.coolant;
  assert.deepEqual(
    [fuel.left,right(fuel),oxidizer.left,right(oxidizer),coolant.left,right(coolant)],
    [59.4,70.8,71.0,82.4,82.6,94.0],
  );
  assert.equal(Number((oxidizer.left-right(fuel)).toFixed(2)),0.2);
  assert.equal(Number((coolant.left-right(oxidizer)).toFixed(2)),0.2);
});

test('LOADOUT slot rectangles stay centered on their schematic anchors',()=>{
  for(const use of ['propellant',...DRIVE_USES]){
    const slot=LOADOUT_SLOT_GEOMETRY[use];
    assert.equal(Number((slot.left+slot.width/2).toFixed(2)),slot.centerX);
    assert.equal(slot.labelX,slot.centerX);
  }
});

test('LOADOUT PULSE boundary targets the central white tank frame',()=>{
  const pulse=LOADOUT_SLOT_GEOMETRY.propellant;
  assert.deepEqual(
    {left:pulse.left,width:pulse.width,top:pulse.top,height:pulse.height},
    {left:9.6,width:10.9,top:37.5,height:27},
  );
});