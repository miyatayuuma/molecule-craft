import test from 'node:test';
import assert from 'node:assert/strict';
import {createCraftHistory} from '../src/craft-history.js';

test('new mutation after Undo continues from the rewound state only',()=>{
  let state={values:[]};const history=createCraftHistory({capture:()=>structuredClone(state),restore:snapshot=>{state=structuredClone(snapshot);return true;}});
  history.record(()=>{state.values.push('A');return true;});history.record(()=>{state.values.push('B');return true;});history.undo();history.record(()=>{state.values.push('C');return true;});
  assert.deepEqual(state.values,['A','C']);history.undo();assert.deepEqual(state.values,['A']);history.undo();assert.deepEqual(state.values,[]);
});
