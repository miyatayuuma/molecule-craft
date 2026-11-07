import test from 'node:test';
import assert from 'node:assert/strict';
import {ComparisonBoilingCycle,BOILING_TIMING} from '../src/compare-boiling-cycle.js';
import {buildComparisonRows,comparisonValueLabel} from '../src/encyclopedia-compare.js';

const advance=(cycle,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)cycle.advance(1/60);};

test('liquid heats to boiling point, plateaus, then disappears without repeat',()=>{
  const cycle=new ComparisonBoilingCycle();cycle.focus('water',null,{known:true,boilingPoint:100});
  assert.equal(cycle.reading(),88);
  advance(cycle,BOILING_TIMING.warmup);
  assert.ok(Math.abs(cycle.reading()-100)<.001);
  assert.equal(cycle.snapshot('water').phase,'boiling');
  advance(cycle,BOILING_TIMING.boiling+.15);
  assert.equal(cycle.snapshot('water').phase,'evaporated');
  assert.equal(cycle.snapshot('water').opacity,0);
  cycle.focus('water',null,{known:true,boilingPoint:100});
  advance(cycle,1.0);
  assert.equal(cycle.snapshot('water').phase,'evaporated');
});

test('switching focus restores previous bead and a new dock can restart',()=>{
  const cycle=new ComparisonBoilingCycle();cycle.focus('water',null,{known:true,boilingPoint:100});
  advance(cycle,6);cycle.focus('ethanol',null,{known:true,boilingPoint:78.4});
  assert.equal(cycle.snapshot('water').phase,'recovering');
  assert.equal(cycle.snapshot('water').opacity,0);
  assert.equal(cycle.reading(),66.4);
  advance(cycle,BOILING_TIMING.recovery/2);
  assert.ok(cycle.snapshot('water').opacity>.45&&cycle.snapshot('water').opacity<.55);
  advance(cycle,BOILING_TIMING.recovery/2+.1);
  assert.equal(cycle.snapshot('water'),null);
  cycle.focus('water',null,{known:true,boilingPoint:100});
  assert.equal(cycle.snapshot('water').phase,'heating');
});

test('unknown samples cannot be measured or animated',()=>{
  const cycle=new ComparisonBoilingCycle();cycle.focus('water',null,{known:false,boilingPoint:100});
  assert.equal(cycle.reading(),null);assert.equal(cycle.snapshot('water'),null);
});

test('pilot is sorted by real, finite boiling points without exposing unknowns',()=>{
  const records=['water','ethanol','n-butane','methane'].map(id=>({id}));
  const {rows,missing}=buildComparisonRows(records,{axis:'boilingPoint',discoveredIds:new Set(['water'])});
  assert.deepEqual(rows.map(row=>row.id),['n-butane','ethanol','water']);
  assert.deepEqual(missing,['methane']);
  assert.equal(rows[0].discovered,false);
  assert.equal(comparisonValueLabel(rows[2].value,'boilingPoint'),'100.0 °C');
});
