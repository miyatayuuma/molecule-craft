import test from 'node:test';
import assert from 'node:assert/strict';
import {ComparisonBoilingCycle,BOILING_TIMING,BOILING_START_OFFSET,heatingProgress,boilingHeatLevel} from '../src/compare-boiling-cycle.js';
import {buildComparisonRows,comparisonValueLabel} from '../src/encyclopedia-compare.js';

const advance=(cycle,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)cycle.advance(1/60);};

test('liquid heats to boiling point, plateaus, then disappears without repeat',()=>{
  const cycle=new ComparisonBoilingCycle();cycle.focus('water',null,{known:true,boilingPoint:100});
  assert.equal(cycle.reading(),45);
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
  assert.ok(Math.abs(cycle.reading()-23.4)<.0001);
  advance(cycle,BOILING_TIMING.recovery/2);
  assert.ok(cycle.snapshot('water').opacity>.45&&cycle.snapshot('water').opacity<.55);
  advance(cycle,BOILING_TIMING.recovery/2+.1);
  assert.equal(cycle.snapshot('water'),null);
  cycle.focus('water',null,{known:true,boilingPoint:100});
  assert.equal(cycle.snapshot('water').phase,'heating');
});

test('temperature jumps early and approaches boiling gently, with synchronized heater color',()=>{
  const cycle=new ComparisonBoilingCycle();cycle.focus('water',null,{known:true,boilingPoint:100});
  assert.equal(BOILING_START_OFFSET,55);
  assert.equal(boilingHeatLevel(cycle.snapshot('water')),0);
  advance(cycle,BOILING_TIMING.warmup*.2);
  const early=cycle.reading(),earlyHeat=boilingHeatLevel(cycle.snapshot('water'));
  assert.ok(early>70&&early<100);
  assert.ok(Math.abs(earlyHeat-(early-45)/55)<.001);
  advance(cycle,BOILING_TIMING.warmup*.3);
  const middle=cycle.reading();
  assert.ok(middle>90&&middle<100);
  assert.ok(early-45>middle-early,'rise is larger at the beginning');
  assert.ok(heatingProgress(BOILING_TIMING.warmup*.9)>.99);
  advance(cycle,BOILING_TIMING.warmup*.5);
  assert.equal(boilingHeatLevel(cycle.snapshot('water')),1);
  advance(cycle,BOILING_TIMING.boiling);
  assert.equal(boilingHeatLevel(cycle.snapshot('water')),0,'heater cools once the sample is gone');
});

test('unknown samples cannot be measured or animated',()=>{
  const cycle=new ComparisonBoilingCycle();cycle.focus('water',null,{known:false,boilingPoint:100});
  assert.equal(cycle.reading(),null);assert.equal(cycle.snapshot('water'),null);
});

test('full phase comparison is sorted without exposing undiscovered molecules or inventing missing values',()=>{
  const records=['water','ethanol','n-butane','methane','carbon-dioxide'].map(id=>({id}));
  const {rows,missing}=buildComparisonRows(records,{axis:'boilingPoint',discoveredIds:new Set(['water'])});
  assert.deepEqual(rows.map(row=>row.id),['methane','carbon-dioxide','n-butane','ethanol','water']);
  assert.deepEqual(missing,[]);
  assert.equal(rows[0].discovered,false);
  assert.equal(comparisonValueLabel(rows[4].value,'boilingPoint'),'100.0 °C');
  assert.equal(comparisonValueLabel(rows[1].value,'boilingPoint',rows[1].transition),'-78.5 °C（昇華）');
});
