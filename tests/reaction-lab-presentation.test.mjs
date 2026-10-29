import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js';
import {bondLaneSegments,fitRigidBodyVelocity,fitRigidPose,formalChargeVisualTransition,mapProductAtomOrigins,planBondLaneTransition,REACTION_PRESENTATION_NORMAL_PHASES,REACTION_PRESENTATION_REDUCED_PHASES,resolveProductTargetGeometry,resolveStaticFormalCharge,smoothPresentationProgress,staticBondLaneOffsets,transportBondLaneSide} from '../src/reaction-lab-presentation.js';

test('normal and reduced motion timings preserve the complete presentation sequence',()=>{
  assert.equal(Object.values(REACTION_PRESENTATION_NORMAL_PHASES).reduce((sum,value)=>sum+value,0),1200);
  assert.equal(Object.values(REACTION_PRESENTATION_REDUCED_PHASES).reduce((sum,value)=>sum+value,0),220);
});

test('bond lane diffs retain common lanes and animate removed or added lanes concurrently',()=>{
  const down=planBondLaneTransition(2,1),up=planBondLaneTransition(1,2),triple=planBondLaneTransition(3,1);
  assert.deepEqual(down.lanes.map(row=>row.kind),['persistent','broken']);assert.equal(down.persistent,1);
  assert.deepEqual(up.lanes.map(row=>row.kind),['persistent','formed']);assert.deepEqual(triple.lanes.map(row=>row.kind),['persistent','broken','broken']);
  assert.equal(bondLaneSegments('broken',0).length,2);assert.ok(bondLaneSegments('broken',.5)[0].to<bondLaneSegments('broken',.5)[1].from);
  assert.deepEqual(bondLaneSegments('formed',0),[]);assert.equal(bondLaneSegments('formed',1).length,2);
});

test('static single, double and triple bonds use the shared lane count and local lane frame never flips',()=>{
  assert.deepEqual(staticBondLaneOffsets(1),[0]);assert.equal(staticBondLaneOffsets(2).length,2);assert.equal(staticBondLaneOffsets(3).length,3);
  const side=[1,0,0],axes=[[0,1,0],[.5,.8660254038,0],[1,0,0],[.5,-.8660254038,0],[0,-1,0]],transported=[];let previous=axes[0];
  for(const axis of axes.slice(1)){const next=transportBondLaneSide(side,previous,axis);transported.push(next);assert.ok(next[0]>=-1e-12,'lane side retains its orientation through bond-axis rotation');assert.ok(Math.abs(next.reduce((sum,value,index)=>sum+value*axis[index],0))<1e-8,'lane side remains perpendicular to the current bond axis');previous=axis;}
  assert.ok(transportBondLaneSide([1,0,0],[0,1,0],[0,-1,0])[0]>.999999,'a 180 degree axis change does not flip the lane side');
});

test('source-to-product origins preserve Core mapping exactly across duplicate products',()=>{
  const record={id:'water',atoms:['O','H']},execution={products:[record,record],atomOrigins:[
    {species:'water',origins:[{sourceAtom:'a:0',productAtom:0},{sourceAtom:'b:1',productAtom:1}]},
    {species:'water',origins:[{sourceAtom:'b:0',productAtom:0},{sourceAtom:'a:1',productAtom:1}]},
  ]},source=new Map([['a:0',[0,0,0]],['b:1',[1,0,0]],['b:0',[0,2,0]],['a:1',[0,3,0]]]);
  const result=mapProductAtomOrigins(execution,source,new Map([['a:0','O'],['b:1','H'],['b:0','O'],['a:1','H']]));assert.equal(result.ok,true);
  assert.deepEqual(result.products.map(product=>product.origins.map(origin=>origin.sourceAtom)),[['a:0','b:1'],['b:0','a:1']]);
  assert.equal(mapProductAtomOrigins({...execution,atomOrigins:[execution.atomOrigins[0],execution.atomOrigins[0]]},source).reason,'source-atom-reused');
  assert.equal(mapProductAtomOrigins(execution,new Map([...source].slice(1))).ok,false);
  assert.equal(mapProductAtomOrigins(execution,source,new Map([['a:0','C'],['b:1','H'],['b:0','O'],['a:1','H']])).reason,'element-continuity-mismatch');
});

test('atom continuity mapping accepts arbitrary product count without fixed left/right slots',()=>{
  const records=[{id:'water',atoms:['O','H']},{id:'hydrogen',atoms:['H']},{id:'oxygen',atoms:['O','O']}],execution={products:records,atomOrigins:[
    {origins:[{sourceAtom:'r:0',productAtom:0},{sourceAtom:'r:1',productAtom:1}]},
    {origins:[{sourceAtom:'r:2',productAtom:0}]},
    {origins:[{sourceAtom:'r:3',productAtom:0},{sourceAtom:'r:4',productAtom:1}]},
  ]},source=new Map([['r:0',[0,0,0]],['r:1',[1,0,0]],['r:2',[2,0,0]],['r:3',[3,0,0]],['r:4',[4,0,0]]]);
  const result=mapProductAtomOrigins(execution,source);assert.equal(result.ok,true);assert.equal(result.products.length,3);assert.deepEqual(result.products.map(product=>product.record.id),['water','hydrogen','oxygen']);
});

test('formal-charge visuals follow Core diffs and honor shared resonance charge suppression',()=>{
  const graphDiff={formalChargeChanges:[{atom:'water:0',from:1,to:0},{atom:'ozone:1',from:0,to:1}]};
  assert.deepEqual(formalChargeVisualTransition(graphDiff,'water:0',{oldVisualCharge:1,newVisualCharge:0}),{oldCharge:1,newCharge:0});
  assert.deepEqual(formalChargeVisualTransition(graphDiff,'ozone:1',{oldVisualCharge:0,newVisualCharge:1,newSuppressed:true}),{oldCharge:0,newCharge:0});
  assert.deepEqual(formalChargeVisualTransition(graphDiff,'unchanged:0',{oldVisualCharge:-1,newVisualCharge:-1}),{oldCharge:-1,newCharge:-1});
  assert.equal(resolveStaticFormalCharge(0,-1),-1,'explicit record formal charge overrides inferred preview charge');assert.equal(resolveStaticFormalCharge(1,1,true),0,'nitro/ozone shared notation suppresses the static charge label');assert.equal(resolveStaticFormalCharge(-1,null),-1);
});

test('rigid fit uses only proper rotation and translation and rejects non-finite targets',()=>{
  const moving=[[1,0,0],[0,1,0],[0,0,1],[0,0,0]],fixed=moving.map(([x,y,z])=>[-y+3,x-2,z+5]),fit=fitRigidPose(moving,fixed,['C','C','C','H']);
  assert.equal(fit.ok,true);assert.ok(fit.rms<1e-10);for(let index=0;index<moving.length;index++)assert.ok(Math.hypot(...fit.points[index].map((value,axis)=>value-fixed[index][axis]))<1e-9);
  const reflected=moving.map(([x,y,z])=>[-x,y,z]),mirror=fitRigidPose(moving,reflected,['C','C','C','C']);assert.equal(mirror.ok,true);assert.ok(mirror.rms>0.1,'a mirror image cannot be reached with the proper rigid fit');
  assert.equal(fitRigidPose([[NaN,0,0]],[[0,0,0]],['C']).ok,false);
});

test('source-seeded product targets require valid solver geometry and otherwise use canonical rigid fallback',async()=>{
  const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8')),record=records.find(item=>item.id==='ethanol'),preview=createPreviewModel(THREE,record);
  for(let index=0;index<220;index++)preview.step();
  const canonical=preview.snapshot(),quality=preview.quality(),source=canonical.atoms.map(atom=>atom.point.toArray()),seed=source.map(point=>[point[0]+2,point[1]-3,point[2]+1]);
  const solved=resolveProductTargetGeometry({seededPoints:seed,seedConverged:quality.validation.valid,canonicalPoints:source,sourcePoints:seed,elements:record.atoms.map(atom=>typeof atom==='string'?atom:atom.element)});
  assert.equal(solved.geometry,'source-seeded');assert.deepEqual(solved.points,seed);
  const fallback=resolveProductTargetGeometry({seededPoints:seed,seedConverged:false,canonicalPoints:source,sourcePoints:seed,elements:record.atoms.map(atom=>typeof atom==='string'?atom:atom.element)});
  assert.equal(fallback.geometry,'canonical-rigid-fallback');assert.ok(Math.hypot(...fallback.points[0].map((value,axis)=>value-seed[0][axis]))<1e-8);
  const rejected=resolveProductTargetGeometry({seededPoints:[[Infinity,0,0]],seedConverged:true,canonicalPoints:[[NaN,0,0]],sourcePoints:[[1,2,3]],elements:['C']});
  assert.equal(rejected.geometry,'source-continuity-fallback');assert.deepEqual(rejected.points,[[1,2,3]]);
  assert.equal(resolveProductTargetGeometry({sourcePoints:[[NaN,0,0]]}).ok,false);
});

test('rigid velocity projection recovers linear and angular source motion',()=>{
  const positions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0]],center=[2,3,4],linear=[.4,-.2,.1],angular=[0,0,.7],velocities=positions.map(([x,y,z])=>[linear[0]-angular[2]*y,linear[1]+angular[2]*x,linear[2]]),fit=fitRigidBodyVelocity(positions.map(point=>point.map((value,index)=>value+center[index])),velocities,[12,12,1,1]);
  assert.equal(fit.finite,true);for(let axis=0;axis<3;axis++){assert.ok(Math.abs(fit.linear[axis]-linear[axis])<1e-10);assert.ok(Math.abs(fit.angular[axis]-angular[axis])<1e-10);}
});

test('shared interpolation eases monotonically without overshoot',()=>{
  const values=Array.from({length:101},(_,index)=>smoothPresentationProgress(index/100));assert.equal(values[0],0);assert.equal(values.at(-1),1);assert.ok(values.every((value,index)=>value>=0&&value<=1&&(index===0||value>=values[index-1])));
});
