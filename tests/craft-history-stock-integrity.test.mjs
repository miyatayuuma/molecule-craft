import test from 'node:test';
import assert from 'node:assert/strict';
import {createCraftHistory} from '../src/craft-history.js';

test('repeated Undo conserves total atoms across workspace and BASE STOCK',()=>{
  let state={workspace:0,stock:3};
  const history=createCraftHistory({capture:()=>({...state}),restore:snapshot=>{state={...snapshot};return true;}});
  for(let i=0;i<3;i++)history.record(()=>{state.stock--;state.workspace++;return true;});
  for(let i=0;i<3;i++){assert.equal(state.stock+state.workspace,3);assert.equal(history.undo(),true);assert.equal(state.stock+state.workspace,3);}
  assert.deepEqual(state,{workspace:0,stock:3});assert.equal(history.undo(),false);
});
