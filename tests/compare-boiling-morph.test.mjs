import test from 'node:test';
import assert from 'node:assert/strict';
import {boilingMorph} from '../src/compare-boiling-morph.js';
import {BOILING_TIMING,ComparisonBoilingCycle} from '../src/compare-boiling-cycle.js';

const step=(cycle,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)cycle.advance(1/60);};
test('the sample becomes liquid before boiling and never bubbles below boiling point',()=>{
  const cycle=new ComparisonBoilingCycle();cycle.focus('water',null,{known:true,boilingPoint:100});
  const initial=boilingMorph(cycle.snapshot('water'));
  assert.equal(initial.pearl,1);assert.equal(initial.liquid,0);assert.equal(initial.bubbles,0);
  step(cycle,BOILING_TIMING.warmup*.68);
  const warm=boilingMorph(cycle.snapshot('water'));
  assert.equal(warm.pearl,0);assert.equal(warm.liquid,1);assert.equal(warm.bubbles,0);
  assert.ok(cycle.reading()<100);
});
test('the boiling point plateaus while liquid bubbles and shrinks before disappearing',()=>{
  const cycle=new ComparisonBoilingCycle();cycle.focus('ethanol',null,{known:true,boilingPoint:78.4});
  step(cycle,BOILING_TIMING.warmup+.8);
  const active=boilingMorph(cycle.snapshot('ethanol'));
  assert.equal(cycle.reading(),78.4);assert.ok(active.liquid>.5&&active.liquid<1);
  assert.ok(active.bubbles>.2);assert.ok(active.vapor>0);
  step(cycle,BOILING_TIMING.boiling);
  const vanished=boilingMorph(cycle.snapshot('ethanol'));
  assert.equal(vanished.pearl,0);assert.equal(vanished.liquid,0);
  assert.equal(vanished.dish,1);
});
test('changing focus recondenses a fully evaporated bead without moving its liquid dish',()=>{
  const cycle=new ComparisonBoilingCycle();cycle.focus('water',null,{known:true,boilingPoint:100});
  step(cycle,6);cycle.focus('ethanol',null,{known:true,boilingPoint:78.4});
  step(cycle,BOILING_TIMING.recovery*.35);
  const forming=boilingMorph(cycle.snapshot('water'));
  assert.ok(forming.condensation>.5);assert.equal(forming.dish,0);
  step(cycle,BOILING_TIMING.recovery*.6);
  const settled=boilingMorph(cycle.snapshot('water'));
  assert.ok(settled.pearl>.7);assert.equal(settled.dish,0);
});
