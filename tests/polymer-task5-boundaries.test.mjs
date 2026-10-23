import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {convexHull,clearance,poseAt,seed} from '../scripts/diagnose-polymer-task5-boundaries.mjs';
import {initial} from '../scripts/analyze-polymer-task5-orientation-feasibility.mjs';

const root=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-boundary-92da7771/',import.meta.url);
const read=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL(name+'.json.gz',root))));
const result=read('results'),boundaries=read('boundaries');

test('native convex silhouette has the correct sign independently of vertex order and duplicate interior vertices',()=>{
  const hull=convexHull([{x:2,y:2},{x:0,y:0},{x:2,y:0},{x:1,y:1},{x:0,y:2},{x:0,y:0}]);
  assert.equal(hull.length,4);assert.equal(clearance(hull,{x:1,y:1}),-1);
  assert.equal(clearance(hull,{x:3,y:1}),1);assert.equal(clearance(hull,{x:0,y:1}),0);
});

test('the finite boundary experiment retains all twelve slots and three arithmetic modes without promoting a linear optimum to feasibility',()=>{
  assert.equal(result.rows.length,12);assert.equal(result.CPURasters,38);
  assert.equal(new Set(result.rows.map(r=>r.rotationDegrees.join(','))).size,4);
  assert.equal(result.CPUJointWitness,false);assert.equal(result.certifiedExcludedRegions,0);
  for(const r of result.rows){
    assert.ok(r.linearSlack>0);assert.deepEqual(r.observations.map(o=>o.precision),['legacy4','shader32','float64']);
    for(const o of r.observations){
      assert.equal(o.grade.atoms.length,11);assert.equal(o.grade.bonds.length,10);
      const ratios=[o.qMin/20,...o.grade.atoms.flatMap(a=>[a.visibleFraction/.6,a.diameter/(initial.graph.atoms[a.index].element==='H'?5.5:9.5)]),...o.grade.bonds.flatMap(b=>[b.visiblePixels/b.requiredPixels,b.continuous/7.75,b.width/1.25,b.length/7.75])];
      assert.equal(o.minimumMargin,Object.values(o.guards).every(Boolean)?Math.min(...ratios):0);
      assert.ok(o.grade.atoms.every(a=>a.pass));assert.ok(o.grade.bonds.find(b=>b.index===35).pass);
      assert.ok(!o.grade.bonds.find(b=>b.index===33).pass);assert.ok(!o.grade.bonds.find(b=>b.index===34).pass);
      assert.ok(!o.grade.jointPartialPixelPass&&o.minimumMargin<1);
    }
  }
});

test('observed H5 loss and endpoint continuity remain specific pixel-boundary facts, and explicit refit preserves the frozen input',()=>{
  assert.equal(boundaries.losses.length,88);assert.ok(boundaries.losses.every(p=>p.owner===6&&p.distance>0));
  assert.deepEqual(boundaries.continuity.best,{start:11,end:26});
  assert.equal(boundaries.continuity.runLength,7.474644037017971);
  const left=boundaries.continuity.extensions[0];assert.equal(left.owner,36);assert.equal(left.j,10);
  assert.equal(boundaries.continuity.extensions[1].kind,'projected-cylinder-end-displacement');
  const before=JSON.stringify(initial);const fit=poseAt(seed.rotationDegrees);
  assert.deepEqual(fit.pose,seed.pose);assert.equal(JSON.stringify(initial),before);
});
