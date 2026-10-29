import test from 'node:test';
import assert from 'node:assert/strict';
import {createCraftHistory} from '../src/craft-history.js';

test('restored workspace is the Undo baseline rather than a historical operation',()=>{
  let state={atoms:['C'],stock:{C:0,H:2}};
  const history=createCraftHistory({capture:()=>structuredClone(state),restore:snapshot=>{state=structuredClone(snapshot);return true;}});
  assert.equal(history.canUndo,false,'Creating history around a restored state must not manufacture prior-session Undo');
  history.record(()=>{state.stock.H--;state.atoms.push('H');return true;});
  history.undo();assert.deepEqual(state,{atoms:['C'],stock:{C:0,H:2}});assert.equal(history.canUndo,false);
});
