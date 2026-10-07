import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPolymerMorphologyBridgePlan,interpolatePolymerBridgeCenterline,resamplePolylineByArcLength} from '../src/polymer-morphology-bridge.js';
import {createPolymerMorphologyBridgeRenderer} from '../src/polymer-morphology-bridge-renderer.js';
import {createPolymerMorphologyPlan} from '../src/polymer-morphology-plan.js';
import {createPolymerMorphologyRenderer} from '../src/polymer-morphology-renderer.js';

const distance=(a,b)=>Math.hypot(...a.map((value,index)=>value-b[index]));
const transform=(point,{translation,rotation,scale})=>{
  const[x,y,z,w]=rotation,[px,py,pz]=point,tx=2*(y*pz-z*py),ty=2*(z*px-x*pz),tz=2*(x*py-y*px);
  return[px+w*tx+(y*tz-z*ty),py+w*ty+(z*tx-x*tz),pz+w*tz+(x*ty-y*tx)].map((value,index)=>value*scale+translation[index]);
};
const closePoints=(left,right,tolerance=1e-8)=>{assert.equal(left.length,right.length);for(let index=0;index<left.length;index++)assert.ok(distance(left[index],right[index])<=tolerance,`point ${index} differs by ${distance(left[index],right[index])}`);};

test('arc-length resampling uses equal distances and preserves input points',()=>{
  const input=[[0,0,0],[1,0,0],[1,0,0],[1,3,0]],before=structuredClone(input),sampled=resamplePolylineByArcLength(input,5);
  assert.deepEqual(input,before);assert.equal(sampled.length,5);assert.deepEqual(sampled[0],[0,0,0]);assert.deepEqual(sampled.at(-1),[1,3,0]);
  const gaps=sampled.slice(1).map((point,index)=>distance(point,sampled[index]));assert.ok(gaps.every(gap=>Math.abs(gap-1)<1e-10),JSON.stringify(gaps));
  assert.throws(()=>resamplePolylineByArcLength([[0,0,0],[0,0,0]],4),/zero-length/);
});

test('similarity registration chooses forward/reverse deterministically and recovers only uniform transforms',()=>{
  const hero=[[0,0,0],[1,0,0],[1.2,.8,.2],[2,1.5,-.1],[3.6,1.4,.9],[4.3,2.7,1.2]],sine=Math.sin(.35)/Math.sqrt(14),rotation=[sine,2*sine,3*sine,Math.cos(.35)],known={translation:[8,-4,2],rotation,scale:2.75},source=[...hero].reverse().map(point=>transform(point,known)),sourceBefore=structuredClone(source),heroBefore=structuredClone(hero),morphologyPlan={polymerId:'polyethylene',heroStrand:{kind:'strand',points:hero}};
  const plan=createPolymerMorphologyBridgePlan({sampleId:'sample-42',sourceCenterline:source,resampleCount:32,morphologyPlan}),again=createPolymerMorphologyBridgePlan({sampleId:'sample-42',sourceCenterline:source,resampleCount:32,morphologyPlan});
  assert.equal(plan.orientation,'reverse');assert.deepEqual(plan,again);assert.deepEqual(source,sourceBefore);assert.deepEqual(hero,heroBefore);
  assert.ok(Math.abs(plan.transform.scale-known.scale)<1e-8);closePoints(plan.sourcePoints,plan.targetPoints,1e-7);assert.ok(plan.registration.rmsError<1e-7);
  assert.deepEqual(Object.keys(plan.transform).sort(),['rotation','scale','translation']);assert.equal(plan.resampleCount,32);
  const lengthsBefore=[distance(hero[0],hero[1]),distance(hero[1],hero[2])],lengthsAfter=[distance(transform(hero[0],plan.transform),transform(hero[1],plan.transform)),distance(transform(hero[1],plan.transform),transform(hero[2],plan.transform))];
  assert.ok(Math.abs(lengthsAfter[0]/lengthsBefore[0]-plan.transform.scale)<1e-8);assert.ok(Math.abs(lengthsAfter[1]/lengthsBefore[1]-plan.transform.scale)<1e-8);
});

test('bridge begins on Task 1 centerline, ends on the transformed hero and interpolates without index-count assumptions',()=>{
  const hero=[[0,0,0],[.5,1,0],[1.5,1,1],[2,0,1]],source=[[2,3,1],[2,4,1],[4,4,2],[5,3,2],[6,4,1],[7,5,0]],plan=createPolymerMorphologyBridgePlan({sourceCenterline:source,resampleCount:24,morphologyPlan:{polymerId:'polyethylene',heroStrand:{points:hero}}}),scratch=plan.sourcePoints.map(()=>[0,0,0]);
  assert.equal(plan.sourcePoints.length,24);assert.equal(plan.targetPoints.length,24);assert.notEqual(plan.sourcePoints.length,source.length);assert.notEqual(plan.targetPoints.length,hero.length);
  assert.equal(interpolatePolymerBridgeCenterline(plan,0,scratch),scratch);closePoints(scratch,plan.sourcePoints,0);
  interpolatePolymerBridgeCenterline(plan,1,scratch);closePoints(scratch,plan.targetPoints,0);
  interpolatePolymerBridgeCenterline(plan,.5,scratch);for(let index=0;index<scratch.length;index++)for(let axis=0;axis<3;axis++)assert.ok(Math.abs(scratch[index][axis]-(plan.sourcePoints[index][axis]+plan.targetPoints[index][axis])*.5)<1e-12);
  interpolatePolymerBridgeCenterline(plan,-1,scratch);closePoints(scratch,plan.sourcePoints,0);interpolatePolymerBridgeCenterline(plan,2,scratch);closePoints(scratch,plan.targetPoints,0);
});

test('a matching Task 1 sample count preserves the exact source centerline at handoff',()=>{
  const source=Array.from({length:72},(_,index)=>[index*.4,Math.sin(index*.12)*1.8,Math.cos(index*.07)*.6]),plan=createPolymerMorphologyBridgePlan({sampleId:'exact-handoff',sourceCenterline:source,resampleCount:72});
  assert.deepEqual(plan.sourcePoints,source);assert.equal(plan.sourcePoints.length,72);assert.equal(interpolatePolymerBridgeCenterline(plan,0).length,72);
});

test('same sample id yields the same PE morphology, hero orientation and registration',()=>{
  const source=Array.from({length:40},(_,index)=>[index*.7,Math.sin(index*.23)*2,Math.cos(index*.17)]),a=createPolymerMorphologyBridgePlan({polymerId:'polyethylene',sampleId:'deterministic-sample',sourceCenterline:source}),b=createPolymerMorphologyBridgePlan({polymerId:'polyethylene',sampleId:'deterministic-sample',sourceCenterline:source});
  assert.deepEqual(a,b);assert.equal(a.seed,'deterministic-sample');assert.equal(a.resampleCount,72);assert.ok(a.registration.rmsError>=0&&a.registration.maxError>=a.registration.rmsError);
  assert.throws(()=>createPolymerMorphologyBridgePlan({polymerId:'polystyrene',sampleId:'x',sourceCenterline:source}),/limited to polyethylene/);
});

test('one bounded temporary tube updates in place and disposes its resources',()=>{
  const visual=createPolymerMorphologyBridgeRenderer(THREE,{pointCount:72,radialSegments:8}),disposed=[];
  visual.geometry.addEventListener('dispose',()=>disposed.push('geometry'));visual.material.addEventListener('dispose',()=>disposed.push('material'));
  const path=Array.from({length:72},(_,index)=>[index*.2,Math.sin(index*.17),Math.cos(index*.13)]);visual.update(path,.08);visual.setOpacity(.4);
  assert.deepEqual([visual.stats.objectCount,visual.stats.geometryCount,visual.stats.materialCount,visual.stats.vertexCount,visual.stats.indexCount],[1,1,1,576,3408]);assert.equal(visual.material.depthWrite,false);assert.ok([...visual.geometry.attributes.position.array].every(Number.isFinite));assert.ok([...visual.geometry.attributes.normal.array].every(Number.isFinite));
  visual.dispose();visual.dispose();assert.deepEqual(disposed,['geometry','material']);assert.deepEqual([visual.stats.objectCount,visual.stats.geometryCount,visual.stats.materialCount],[0,0,0]);
});

test('registration changes only the morphology root similarity transform, never its static mesh geometry',()=>{
  const morphology=createPolymerMorphologyPlan({polymerId:'polyethylene',seed:'geometry-authority'}),rendered=createPolymerMorphologyRenderer(THREE,morphology),before=rendered.root.children.map(object=>({position:[...object.geometry.attributes.position.array],index:[...object.geometry.index.array]})),bridge=createPolymerMorphologyBridgePlan({sampleId:'geometry-authority',sourceCenterline:Array.from({length:72},(_,index)=>[index*.5,Math.sin(index*.11)*3,Math.cos(index*.09)*2]),resampleCount:72,morphologyPlan:morphology}),{translation,rotation,scale}=bridge.transform;
  rendered.root.position.fromArray(translation);rendered.root.quaternion.set(rotation[0],rotation[1],rotation[2],rotation[3]);rendered.root.scale.setScalar(scale);
  rendered.root.children.forEach((object,index)=>{assert.deepEqual([...object.geometry.attributes.position.array],before[index].position);assert.deepEqual([...object.geometry.index.array],before[index].index);});
  assert.deepEqual(Object.keys(bridge.transform).sort(),['rotation','scale','translation']);rendered.dispose();
});
