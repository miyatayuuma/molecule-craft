import test from 'node:test';
import assert from 'node:assert/strict';
import {createCraftHistory} from '../src/craft-history.js';

test('failed restore keeps the Undo entry available for retry',()=>{
  let state={value:0},fail=true;
  const history=createCraftHistory({capture:()=>({...state}),restore:snapshot=>{if(fail)return false;state={...snapshot};return true;}});
  history.record(()=>{state.value=1;return true;});assert.equal(history.depth,1);
  assert.equal(history.undo(),false);assert.equal(history.depth,1);assert.equal(state.value,1);
  fail=false;assert.equal(history.undo(),true);assert.equal(history.depth,0);assert.equal(state.value,0);
});
