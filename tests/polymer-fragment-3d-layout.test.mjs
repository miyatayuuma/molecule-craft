import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js?v=35';
import {createPolymerFragment3DLayout} from '../src/polymer-fragment-3d-layout.js';
import {createReactionLabPolymerizationCore,POLYMER_COMMIT_DWELL_MS} from '../src/reaction-lab-polymerization.js?v=1';

const readJson=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const [routesAuthority,db]=await Promise.all([readJson('../data/polymerization-routes.json'),readJson('../data/molecules.json')]);
const feedIds=new Set([...routesAuthority.routes.flatMap(route=>route.feedSpecies),'water']);
const records=db.filter(record=>feedIds.has(record.id)),recordById=new Map(records.map(record=>[record.id,record]));
const coordinatesFor=record=>{
  const model=createPreviewModel(THREE,record);for(let step=0;step<190;step++)model.step();
  const snapshot=model.snapshot();return{...record,atoms:snapshot.atoms,bonds:snapshot.bonds,aromaticCycles:snapshot.aromaticCycles};
};
const sourceRecordsFor=instances=>Object.fromEntries(instances.map(instance=>[instance.id,coordinatesFor(recordById.get(instance.species))]));
const fixtureFor=route=>{
  const perSpecies=route.feedSpecies.length===1?4:2,instances=route.feedSpecies.flatMap(id=>Array.from({length:perSpecies},(_,index)=>({id:`feed-${id}-${index+1}`,species:id,batchGeneration:3})));
  const core=createReactionLabPolymerizationCore({records,routes:routesAuthority.routes,sitePatterns:routesAuthority.sitePatterns});
  assert.equal(core.beginBatch({activeSlots:route.feedSpecies,batchGeneration:3,instances,environment:new Set(route.environment.requires)}).ok,true);
  const used=new Map(),nextInstance=species=>{const next=(used.get(species)??0)+1;used.set(species,next);return`feed-${species}-${next}`;};
  nextInstance(route.representativeSequence[0]);let result=null;
  for(let step=1;step<route.representativeSequence.length;step++){
    const species=route.representativeSequence[step],instanceId=nextInstance(species),automatic=step>route.interactionCadence.manualSteps;
    const begun=automatic?core.beginAutomaticStep(instanceId):core.beginManualStep(instanceId);assert.equal(begun.ok,true,`${route.routeId} step ${step}: ${begun.reason}`);
    assert.equal(core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS/2).committed,false);
    result=core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS/2);
  }
  assert.ok(result?.sample,`${route.routeId} produces a finite sample`);
  return{sample:result.sample,instances};
};
const point=(x,y,z=0)=>({x,y,z});
const percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(p*sorted.length)-1)]??0;};
function planeDeviation(points){
  if(points.length<4)return 0;const origin=points[0];let normal=null;
  for(let a=1;a<points.length-1&&!normal;a++)for(let b=a+1;b<points.length&&!normal;b++){
    const u=[points[a].x-origin.x,points[a].y-origin.y,points[a].z-origin.z],v=[points[b].x-origin.x,points[b].y-origin.y,points[b].z-origin.z],cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],magnitude=Math.hypot(...cross);
    if(magnitude>1e-8)normal=cross.map(value=>value/magnitude);
  }
  if(!normal)return Infinity;
  return Math.max(...points.map(p=>Math.abs((p.x-origin.x)*normal[0]+(p.y-origin.y)*normal[1]+(p.z-origin.z)*normal[2])));
}

test('3D chain placement is deterministic, spatial and graph preserving',()=>{
  const fragment={atoms:[],bonds:[],atomOrigins:[]},sourceRecordsByInstanceId={};
  for(let unit=0;unit<4;unit++){
    const instanceId=`unit-${unit}`;sourceRecordsByInstanceId[instanceId]={atoms:[{point:point(-.55,0,0)},{point:point(.55,0,0)},{point:point(-.72,.82,0)},{point:point(.72,-.82,0)}]};
    for(const element of ['C','C','H','H']){fragment.atoms.push({element,formalCharge:0});fragment.atomOrigins.push({instanceId,sourceAtomIndex:fragment.atomOrigins.filter(origin=>origin.instanceId===instanceId).length});}
    const base=unit*4;fragment.bonds.push({a:base,b:base+1,order:1},{a:base,b:base+2,order:1},{a:base+1,b:base+3,order:1});if(unit<3)fragment.bonds.push({a:base+1,b:base+4,order:1});
  }
  const sample={polymerId:'polyethylene',routeId:'fixture-chain',fragment,representation:{}};
  const first=createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId}),second=createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId});
  assert.equal(first.diagnostics.accepted,true,JSON.stringify(first.diagnostics));assert.ok(first.bounds.depth>.5,'connected units form a genuine 3D pose');
  assert.deepEqual(first.atoms.map(({x,y,z})=>[x,y,z]),second.atoms.map(({x,y,z})=>[x,y,z]),'same graph and source geometry regenerate the same conformation');
  assert.deepEqual(first.atomOrigins,fragment.atomOrigins);assert.deepEqual(first.bonds,fragment.bonds.map(bond=>({...bond})));
  assert.ok(first.diagnostics.maxBondError<.2);assert.equal(first.diagnostics.severeOverlapCount,0);
});

test('source aromatic ring remains planar while a linked unit takes a 3D pose',()=>{
  const fragment={atoms:[],bonds:[],atomOrigins:[]},ringId='ring',tailId='tail',ring=[];
  for(let index=0;index<6;index++)ring.push(point(Math.cos(index*Math.PI/3),Math.sin(index*Math.PI/3),0));
  const ringRecord={atoms:ring.map(point=>({point})),aromaticCycles:[[0,1,2,3,4,5]]},tailRecord={atoms:[{point:point(-.55,0,0)},{point:point(.55,0,0)},{point:point(0,.9,0)}]};
  const sourceRecordsByInstanceId={[ringId]:ringRecord,[tailId]:tailRecord};
  for(let index=0;index<6;index++){fragment.atoms.push({element:'C',formalCharge:0});fragment.atomOrigins.push({instanceId:ringId,sourceAtomIndex:index});fragment.bonds.push({a:index,b:(index+1)%6,order:1.5});}
  for(let index=0;index<3;index++){fragment.atoms.push({element:index===2?'H':'C',formalCharge:0});fragment.atomOrigins.push({instanceId:tailId,sourceAtomIndex:index});}
  fragment.bonds.push({a:0,b:6,order:1},{a:6,b:7,order:1},{a:6,b:8,order:1});
  const plan=createPolymerFragment3DLayout({polymerId:'polystyrene',routeId:'ring-fixture',fragment},{sourceRecordsByInstanceId});
  assert.equal(plan.diagnostics.accepted,true,JSON.stringify(plan.diagnostics));assert.ok(plan.diagnostics.protectedRingAtomCount>=6);
  const ringPoints=plan.atoms.slice(0,6).map(atom=>[atom.x,atom.y,atom.z]),normal=(()=>{const a=ringPoints[0],b=ringPoints[1],c=ringPoints[2],u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],d=Math.hypot(...n);return n.map(value=>value/d);})();
  const origin=ringPoints[0],deviation=Math.max(...ringPoints.map(p=>Math.abs((p[0]-origin[0])*normal[0]+(p[1]-origin[1])*normal[1]+(p[2]-origin[2])*normal[2])));
  assert.ok(deviation<.08,`aromatic ring leaves its source plane by only ${deviation}`);assert.ok(plan.bounds.depth>.25);
});

test('3D layout reports missing source poses instead of silently claiming a complete conformer',()=>{
  const fragment={atoms:[{element:'C'},{element:'C'}],bonds:[{a:0,b:1,order:1}],atomOrigins:[{instanceId:'a',sourceAtomIndex:0},{instanceId:'b',sourceAtomIndex:0}]};
  const plan=createPolymerFragment3DLayout({fragment});
  assert.equal(plan.diagnostics.accepted,false);assert.equal(plan.diagnostics.reason,'missing-source-coordinates');assert.equal(plan.diagnostics.sourceCoordinateFallbacks.length,2);
});

test('all 25 route samples retain their chemical topology in a bounded 3D layout',async()=>{
  const focused=new Set(['polyethylene','polypropylene','polystyrene','polyvinyl-chloride','polyethylene-oxide','polyethylene-terephthalate','nylon-6-6','styrene-butadiene-copolymer','polybutadiene','phenol-formaldehyde-resin']);
  const timings=[],fallbacks=[],routeMetrics=[];assert.equal(routesAuthority.routes.length,25);assert.equal(new Set(routesAuthority.routes.map(route=>route.routeId)).size,25,'25 unique production routes are covered');
  for(const route of routesAuthority.routes){
    const {sample,instances}=fixtureFor(route),sourceRecordsByInstanceId=sourceRecordsFor(instances),started=performance.now(),plan=createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId}),elapsedMs=performance.now()-started;
    timings.push(elapsedMs);if(!plan.diagnostics.accepted)fallbacks.push({routeId:route.routeId,...plan.diagnostics});
    const graphIndexByOrigin=new Map(sample.fragment.atomOrigins.map((origin,index)=>[`${origin.instanceId}:${origin.sourceAtomIndex}`,index])),ringDeviations=[];
    for(const[instanceId,record]of Object.entries(sourceRecordsByInstanceId))for(const cycle of record.aromaticCycles??[]){const sourceIds=Array.isArray(cycle)?cycle:(cycle?.atoms??[]),ringPoints=sourceIds.map(sourceAtomIndex=>plan.atoms[graphIndexByOrigin.get(`${instanceId}:${sourceAtomIndex}`)]).filter(Boolean);if(ringPoints.length>=4)ringDeviations.push(planeDeviation(ringPoints));}
    assert.ok(ringDeviations.every(deviation=>deviation<=.12),`${route.routeId}: aromatic source rings remain locally planar (${ringDeviations.join(', ')})`);
    assert.equal(plan.atoms.length,sample.fragment.atoms.length,`${route.routeId}: atom count`);assert.deepEqual(plan.atoms.map(atom=>atom.id),sample.fragment.atoms.map((_,index)=>index),`${route.routeId}: atom IDs remain stable`);assert.equal(plan.bonds.length,sample.fragment.bonds.length,`${route.routeId}: bond count`);
    assert.deepEqual(plan.atomOrigins,sample.fragment.atomOrigins,`${route.routeId}: atom origins remain unchanged`);assert.deepEqual(plan.bonds,sample.fragment.bonds.map(bond=>({...bond})),`${route.routeId}: bonds and orders remain unchanged`);
    assert.ok(plan.diagnostics.finite,`${route.routeId}: all XYZ positions are finite`);assert.ok(plan.diagnostics.sourceCoordinateFallbacks.length===0,`${route.routeId}: every source atom has a real preview pose`);
    assert.equal(plan.diagnostics.accepted,true,`${route.routeId}: layout must not require fallback: ${JSON.stringify(plan.diagnostics)}`);assert.equal(plan.diagnostics.severeOverlapCount,0,`${route.routeId}: no severe nonbonded overlap`);
    assert.ok(plan.diagnostics.maxBondError<=.35,`${route.routeId}: max bond error remains within 0.35 Å (${plan.diagnostics.maxBondError})`);
    assert.ok(plan.bounds.width>0&&plan.bounds.height>=0&&plan.bounds.depth>=0,`${route.routeId}: finite XYZ bounds`);assert.ok(plan.diagnostics.iterations<=160);
    if(focused.has(route.polymerId))assert.ok(plan.bounds.depth>.18,`${route.polymerId}: the representative pose has readable spatial depth`);
    if(route.polymerId==='polystyrene')assert.ok(plan.diagnostics.protectedRingAtomCount>=6,'polystyrene aromatic ring atoms receive local conformation restraints');
    const repeat=createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId});assert.deepEqual(plan.atoms.map(({x,y,z})=>[x,y,z]),repeat.atoms.map(({x,y,z})=>[x,y,z]),`${route.routeId}: deterministic regeneration`);
    routeMetrics.push({routeId:route.routeId,polymerId:route.polymerId,atomCount:plan.atoms.length,bondCount:plan.bonds.length,layoutComputationMs:Number(elapsedMs.toFixed(3)),iterations:plan.diagnostics.iterations,maxBondError:Number(plan.diagnostics.maxBondError.toFixed(4)),meanBondError:Number(plan.diagnostics.meanBondError.toFixed(4)),depthSpan:Number(plan.bounds.depth.toFixed(4)),minimumNonbondedDistance:plan.diagnostics.minimumNonbondedDistance===null?null:Number(plan.diagnostics.minimumNonbondedDistance.toFixed(4)),severeOverlapCount:plan.diagnostics.severeOverlapCount,aromaticRingMaxPlaneDeviation:ringDeviations.length?Number(Math.max(...ringDeviations).toFixed(4)):null,fallback:!plan.diagnostics.accepted});
  }
  assert.deepEqual(fallbacks,[]);
  const summary={schemaVersion:1,routeCount:routeMetrics.length,acceptedRouteCount:routeMetrics.filter(row=>!row.fallback).length,fallbackCount:fallbacks.length,iterationLimit:160,layoutComputationMs:{p50:Number(percentile(timings,.5).toFixed(3)),p95:Number(percentile(timings,.95).toFixed(3)),max:Number(Math.max(...timings).toFixed(3))},maximumBondError:Number(Math.max(...routeMetrics.map(row=>row.maxBondError)).toFixed(4)),minimumDepthSpan:Number(Math.min(...routeMetrics.filter(row=>focused.has(row.polymerId)).map(row=>row.depthSpan)).toFixed(4)),severeOverlapCount:routeMetrics.reduce((sum,row)=>sum+row.severeOverlapCount,0),maximumAromaticRingPlaneDeviation:Number(Math.max(0,...routeMetrics.map(row=>row.aromaticRingMaxPlaneDeviation??0)).toFixed(4)),routes:routeMetrics};
  const evidenceDir=resolve(process.env.TASK11_GEOMETRY_EVIDENCE_DIR??join(process.cwd(),'test-results/polymer-3d-layout'));await mkdir(evidenceDir,{recursive:true});await writeFile(join(evidenceDir,'validation-25.json'),JSON.stringify(summary,null,2));console.log(`POLYMER_3D_LAYOUT_PROFILE ${JSON.stringify(summary)}`);
});
