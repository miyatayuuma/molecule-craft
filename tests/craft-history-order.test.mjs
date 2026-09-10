import test from 'node:test';
import assert from 'node:assert/strict';
import {createCraftHistory} from '../src/craft-history.js';

test('Undo applies snapshots in strict reverse operation order',()=>{
  let state={steps:[]};
  const history=createCraftHistory({capture:()=>structuredClone(state),restore:snapshot=>{state=structuredClone(snapshot);return true;}});
  for(const step of ['atom A','atom B','bond'])history.record(()=>{state.steps.push(step);return true;});
  history.undo();assert.deepEqual(state.steps,['atom A','atom B']);
  history.undo();assert.deepEqual(state.steps,['atom A']);
  history.undo();assert.deepEqual(state.steps,[]);
});
