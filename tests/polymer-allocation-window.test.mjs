import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPolymerAllocationWindow} from './helpers/polymer-allocation-window.mjs';

const sample=(orders,allocated,{automatic=0,units=3,manual=2}={})=>({graph:{bonds:orders.map((order,i)=>({a:i,b:i+1,order}))},snapshot:{batch:{generation:1},polymerization:{routeId:'captured-PET',manualStepCount:manual,automaticStepCount:automatic,displayedUnitCount:units},polymerRuntimeMetrics:{bondVisualAllocations:allocated}}});
test('a real automatic commit permits only its seven new actual single/double lanes',()=>{
  const a=sample([3],51),b=sample([3,2,2,1,1,1],58,{automatic:1,units:4});
  assert.deepEqual(assertPolymerAllocationWindow(a,b,'PET'),{changed:true,allocated:7,allowance:7,beforeLanes:3,afterLanes:10});
  b.snapshot.polymerRuntimeMetrics.bondVisualAllocations=59;assert.throws(()=>assertPolymerAllocationWindow(a,b,'PET'),/exceed actual graph lane growth/);
});
test('unchanged graphs allow zero new geometry even if the automatic counter advances',()=>{
  const a=sample([3,2,1],51),b=sample([3,2,1],51);assert.equal(assertPolymerAllocationWindow(a,b,'stable').allowance,0);
  b.snapshot.polymerization.automaticStepCount=1;b.snapshot.polymerRuntimeMetrics.bondVisualAllocations=52;
  assert.throws(()=>assertPolymerAllocationWindow(a,b,'stable'),/exceed actual graph lane growth/);
});
test('a changed graph cannot excuse allocations without a same-batch automatic unit commit',()=>{
  const a=sample([1],1),b=sample([1,1],2);assert.throws(()=>assertPolymerAllocationWindow(a,b,'uncommitted'),/actual automatic commit/);
  b.snapshot.polymerization.automaticStepCount=1;assert.throws(()=>assertPolymerAllocationWindow(a,b,'no unit'),/actual unit/);
  b.snapshot.polymerization.displayedUnitCount=4;b.snapshot.batch.generation=2;assert.throws(()=>assertPolymerAllocationWindow(a,b,'wrong batch'),/keeps its batch/);
  b.snapshot.batch.generation=1;b.snapshot.polymerization.manualStepCount=3;assert.throws(()=>assertPolymerAllocationWindow(a,b,'manual'),/additional manual commit/);
});
