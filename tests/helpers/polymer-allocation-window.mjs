import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';

// A live automatic commit may add real lanes during the animation window.
// Every unchanged-graph window still permits exactly zero new allocations.
export function assertPolymerAllocationWindow(before,after,label){
  const a=before.snapshot,b=after.snapshot,A=a.polymerization,B=b.polymerization;
  assert.equal(b.batch.generation,a.batch.generation,`${label}: allocation window keeps its batch`);
  assert.equal(B.routeId,A.routeId,`${label}: allocation window keeps its route`);
  assert.equal(B.manualStepCount,A.manualStepCount,`${label}: no additional manual commit occurs`);
  assert.ok(B.automaticStepCount>=A.automaticStepCount,`${label}: automatic progress is monotonic`);
  assert.ok(before.graph&&after.graph,`${label}: actual rendered graphs are retained`);
  const changed=!isDeepStrictEqual(before.graph,after.graph),lanes=g=>g.bonds.reduce((n,bond)=>n+bond.order,0);
  if(changed){
    assert.ok(B.automaticStepCount>A.automaticStepCount,`${label}: graph change requires an actual automatic commit`);
    assert.ok(B.displayedUnitCount>A.displayedUnitCount,`${label}: automatic graph adds an actual unit`);
  }
  const allowance=changed?Math.max(0,lanes(after.graph)-lanes(before.graph)):0;
  const allocated=b.polymerRuntimeMetrics.bondVisualAllocations-a.polymerRuntimeMetrics.bondVisualAllocations;
  assert.ok(allocated>=0&&allocated<=allowance,`${label}: bond allocations ${allocated} exceed actual graph lane growth ${allowance}`);
  return{changed,allocated,allowance,beforeLanes:lanes(before.graph),afterLanes:lanes(after.graph)};
}
