import test from 'node:test';
import assert from 'node:assert/strict';
import {createCraftHistory} from '../src/craft-history.js';

test('no-op begin/commit does not enable Undo',()=>{
  let state={value:1};const history=createCraftHistory({capture:()=>({...state}),restore:snapshot=>{state={...snapshot};return true;}});
  history.begin();assert.equal(history.commit(),false);assert.equal(history.canUndo,false);assert.equal(history.undo(),false);
});
