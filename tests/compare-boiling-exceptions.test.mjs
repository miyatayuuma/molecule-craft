import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {boilingComparisonFor,boilingValueFor} from '../src/compare-boiling-data.js';
import {buildComparisonRows,comparisonValueLabel} from '../src/encyclopedia-compare.js';
import {ComparisonBoilingCycle,BOILING_TIMING} from '../src/compare-boiling-cycle.js';
import {boilingMorph} from '../src/compare-boiling-morph.js';

const step=(cycle,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)cycle.advance(1/60);};

test('all non-boiling entries are labelled, sourced, and do not overwrite normal boiling data',async()=>{
  const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
  const registry=JSON.parse(await readFile(new URL('../data/boiling-exceptions.json',import.meta.url)));
  const ids=new Set(records.map(record=>record.id));
  assert.equal(Object.keys(registry.compounds).length,4);
  for(const [id,definition] of Object.entries(registry.compounds)){
    assert.ok(ids.has(id));assert.equal(boilingValueFor(id),null);
    assert.ok(definition.sourceUrls.length);
    assert.equal(boilingComparisonFor(id)?.kind,definition.kind);
  }
  assert.equal(boilingComparisonFor('carbon-dioxide').celsius,-78.5);
  assert.equal(boilingComparisonFor('ethyne').celsius,-84.7);
  assert.equal(boilingComparisonFor('2-butene').celsius,2.3);
  assert.equal(boilingComparisonFor('methyl-ethyl-ether').celsius,8.35);
  assert.equal(boilingComparisonFor('2-4-6-trinitrotoluene'),null,'thermal decomposition remains unresolved');
  for(const id of ['cyclobutane','difluoromethane','1-butyne','2-butyne','catechol']){
    assert.equal(boilingComparisonFor(id).kind,'boiling');
  }
});

test('sublimation heats as a solid and becomes gas without creating liquid, dish, or bubbles',()=>{
  const cycle=new ComparisonBoilingCycle();
  cycle.focus('carbon-dioxide',null,{known:true,boilingPoint:-78.5,transition:boilingComparisonFor('carbon-dioxide')});
  step(cycle,BOILING_TIMING.warmup*.9);
  const warming=boilingMorph(cycle.snapshot('carbon-dioxide'));
  assert.deepEqual([warming.pearl,warming.liquid,warming.dish,warming.bubbles],[1,0,0,0]);
  step(cycle,BOILING_TIMING.warmup*.1+.7);
  assert.equal(cycle.snapshot('carbon-dioxide').phase,'subliming');
  const subliming=boilingMorph(cycle.snapshot('carbon-dioxide'));
  assert.ok(subliming.pearl>0&&subliming.pearl<1);
  assert.ok(subliming.vapor>0);
  assert.equal(subliming.liquid,0);assert.equal(subliming.dish,0);assert.equal(subliming.bubbles,0);
  step(cycle,BOILING_TIMING.boiling);
  assert.equal(cycle.snapshot('carbon-dioxide').phase,'evaporated');
  assert.equal(boilingMorph(cycle.snapshot('carbon-dioxide')).dish,0);
  cycle.focus('water',null,{known:true,boilingPoint:100});
  step(cycle,BOILING_TIMING.recovery*.5);
  assert.equal(boilingMorph(cycle.snapshot('carbon-dioxide')).condensation,0);
});

test('range entries retain their full documented interval while the readout wavers inside it',()=>{
  const transition=boilingComparisonFor('2-butene');
  const {rows}=buildComparisonRows([{id:'2-butene'},{id:'water'}],{axis:'boilingPoint',discoveredIds:new Set(['2-butene'])});
  assert.equal(rows[0].value,2.3);
  assert.equal(comparisonValueLabel(rows[0].value,'boilingPoint',rows[0].transition),'0.9〜3.7 °C（異性体差）');
  const cycle=new ComparisonBoilingCycle();
  cycle.focus('2-butene',null,{known:true,boilingPoint:rows[0].value,transition});
  step(cycle,BOILING_TIMING.warmup);
  const values=[];for(let i=0;i<90;i++){cycle.advance(1/60);values.push(cycle.reading());}
  assert.ok(values.every(value=>value>=.9&&value<=3.7));
  assert.ok(Math.max(...values)-Math.min(...values)>1.8,'readout should show range uncertainty');
  assert.equal(cycle.snapshot('2-butene').phase,'boiling');
  const unknown=buildComparisonRows([{id:'2-butene'}],{axis:'boilingPoint',discoveredIds:new Set()});
  assert.equal(unknown.rows[0].discovered,false);
});
