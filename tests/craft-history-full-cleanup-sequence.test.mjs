import test from 'node:test';
import assert from 'node:assert/strict';
import {createCraftHistory} from '../src/craft-history.js';

test('full cleanup participates in reverse-order history as a single step',()=>{
  let state={atoms:[],stock:2};
  const history=createCraftHistory({capture:()=>structuredClone(state),restore:snapshot=>{state=structuredClone(snapshot);return true;}});
  history.record(()=>{state.atoms.push('H');state.stock--;return true;});
  history.record(()=>{state.atoms.push('H');state.stock--;return true;});
  history.record(()=>{state.stock+=state.atoms.length;state.atoms=[];return true;});
  assert.deepEqual(state,{atoms:[],stock:2});
  history.undo();assert.deepEqual(state,{atoms:['H','H'],stock:0});
  history.undo();assert.deepEqual(state,{atoms:['H'],stock:1});
  history.undo();assert.deepEqual(state,{atoms:[],stock:2});
});
