import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompletionSideEffectGate} from '../src/completion-side-effects.js';

const item=(key,signature,complete)=>({key,signature,complete});

test('emits only incomplete -> complete edges for the same structure identity',()=>{
  const gate=createCompletionSideEffectGate();
  assert.deepEqual(gate.sync([item('1,2','a',false)]).completions,[]);
  const completed=gate.sync([item('1,2','b',true)]).completions;
  assert.equal(completed.length,1);assert.equal(completed[0].signature,'b');
  assert.deepEqual(gate.sync([item('1,2','c',true)]).completions,[],'complete -> complete signature changes are not fresh completions');
});

test('a restore sync can replace the baseline without emitting completion side effects',()=>{
  const gate=createCompletionSideEffectGate();
  gate.sync([item('1,2','incomplete',false)]);
  gate.suppressNextSync();
  const restored=gate.sync([item('1,2','complete',true)]);
  assert.equal(restored.suppressed,true);assert.deepEqual(restored.completions,[]);
  assert.deepEqual(gate.sync([item('1,2','complete-geometry-refresh',true)]).completions,[]);
  gate.sync([item('1,2','broken-again',false)]);
  assert.equal(gate.sync([item('1,2','rebuilt',true)]).completions.length,1,'a later forward rebuild still emits');
});

test('new atom-set structures can complete while unchanged complete structures stay quiet',()=>{
  const gate=createCompletionSideEffectGate();
  gate.sync([item('1,2','stable',true)]);
  const next=gate.sync([item('1,2','stable',true),item('3,4','new',true)]);
  assert.deepEqual(next.completions.map(value=>value.key),['3,4']);
});
