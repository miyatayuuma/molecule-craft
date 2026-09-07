import assert from 'node:assert/strict';
import {craftTargetSlots} from '../src/craft-panel.js';

const water={atoms:[{element:'H'},{element:'H'},{element:'O'}]};

assert.deepEqual(
  craftTargetSlots(water,[]).map(({symbol,filled})=>[symbol,filled]),
  [['H',false],['H',false],['O',false]],
  'Empty craft field should leave every target atom unfilled',
);

assert.deepEqual(
  craftTargetSlots(water,[{element:'H'}]).map(({symbol,filled})=>[symbol,filled]),
  [['H',true],['H',false],['O',false]],
  'Only atoms actually placed in the craft field should fill target slots',
);

assert.deepEqual(
  craftTargetSlots(water,[{element:'H'},{element:'H'},{element:'H'},{element:'O'},{element:'C'}]).map(({symbol,filled})=>[symbol,filled]),
  [['H',true],['H',true],['O',true]],
  'Extra or unrelated field atoms should not create additional target slots',
);

assert.deepEqual(craftTargetSlots(null,[{element:'H'}]),[],'Missing target should render no slots');

console.log('Craft target slot tests passed.');
