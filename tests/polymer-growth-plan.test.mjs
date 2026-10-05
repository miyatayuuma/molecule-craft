import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPolymerGrowthAnchor,createHeroChainPlan,heroGrowthFrame,visibleHeroPointCount,largestSafeRect,HERO_CHAIN_BUDGET} from '../src/polymer-growth-plan.js';
import {createPolymerCinematic} from '../src/reaction-lab-polymer-cinematic.js';

function finiteFragment(){
  return{
    atoms:['C','C','C','C','H','H'],
    bonds:[[0,1,1],[1,2,1],[2,3,1],[0,4,1],[3,5,1]],
    atomOrigins:[
      {instanceId:'old-a',sourceAtomIndex:0},{instanceId:'old-b',sourceAtomIndex:0},
      {instanceId:'old-b',sourceAtomIndex:1},{instanceId:'newest',sourceAtomIndex:1},
      {instanceId:'old-a',sourceAtomIndex:2},{instanceId:'newest',sourceAtomIndex:2},
    ],
    continuations:[{atomRef:3,valence:1}],
  };
}
const coordinates=[[0,0,0],[1,0,0],[2,0,0],[3,0,0],[-.25,.7,0],[3.25,.7,0]];
const anchorForTest=()=>createPolymerGrowthAnchor({fragment:finiteFragment(),pointsByAtomIndex:coordinates,newestInstanceId:'newest'});
const sourceRecord={atoms:[{element:'C',point:[-.5,0,0]},{element:'C',point:[.5,0,0]},{element:'H',point:[-.8,.45,0]},{element:'H',point:[-.8,-.45,0]},{element:'H',point:[.8,.45,0]},{element:'H',point:[.8,-.45,0]}],bonds:[[0,1,2],[0,2,1],[0,3,1],[1,4,1],[1,5,1]]};

test('finite-fragment anchor uses actual rendered carbon coordinates and the newest continuation end',()=>{
  const anchor=anchorForTest();
  assert.deepEqual(anchor.backboneAtomIndices,[0,1,2,3]);
  assert.deepEqual(anchor.backbonePoints,coordinates.slice(0,4));
  assert.equal(anchor.growthEndAtomIndex,3);
  assert.deepEqual(anchor.growthTip,[3,0,0]);
  assert.deepEqual(anchor.tangent,[1,0,0]);
  assert.deepEqual(anchor.stationForAtomIndex,[0,1,2,3,0,3]);
});

test('hero-chain plan is deterministic, one continuous trajectory, tangent-aligned, irregular and bounded',()=>{
  const anchor=anchorForTest(),a=createHeroChainPlan({polymerId:'polyethylene',anchor,seed:'stable-sample'}),b=createHeroChainPlan({polymerId:'polyethylene',anchor,seed:'stable-sample'}),other=createHeroChainPlan({polymerId:'polyethylene',anchor,seed:'other-sample'});
  assert.deepEqual(a,b);assert.notDeepEqual(a.points,other.points);
  assert.deepEqual(a.points.slice(0,anchor.backbonePoints.length),anchor.backbonePoints);
  assert.equal(a.points.length,anchor.backbonePoints.length+HERO_CHAIN_BUDGET.growthUnits*HERO_CHAIN_BUDGET.pointsPerUnit);
  assert.ok(a.points.length<=HERO_CHAIN_BUDGET.pointCapacity);
  const initialDelta=a.points[anchor.backbonePoints.length].map((value,index)=>value-anchor.backbonePoints.at(-1)[index]);
  assert.ok(initialDelta[0]>0&&Math.abs(initialDelta[1])<1e-9&&Math.abs(initialDelta[2])<1e-9,'the first continuation preserves the measured tangent');
  const headings=a.points.slice(anchor.backbonePoints.length).slice(1).map((point,index)=>{const previous=a.points[anchor.backbonePoints.length+index];const delta=point.map((value,axis)=>value-previous[axis]),length=Math.hypot(...delta);return delta.map(value=>value/length);});
  const bends=headings.slice(1).map((heading,index)=>Math.acos(Math.max(-1,Math.min(1,heading.reduce((sum,value,axis)=>sum+value*headings[index][axis],0)))));
  assert.ok(Math.max(...bends)<.2,'persistent curvature has no sharp random corners');
  assert.ok(new Set(headings.map(row=>row.map(value=>value.toFixed(3)).join(','))).size>8,'the long chain is not a repeated straight or periodic pattern');
  assert.ok(Math.hypot(...a.points.at(-1))>Math.hypot(...a.points[anchor.backbonePoints.length-1])+10,'final chain reads longer than the finite origin');
  const minimumAnchor={...anchor,backbonePoints:anchor.backbonePoints.slice(0,2)},minimumPlan=createHeroChainPlan({polymerId:'polyethylene',anchor:minimumAnchor,seed:'two-carbon-fragment'});
  assert.ok(minimumPlan.points.every(point=>point.every(Number.isFinite)),'the minimum two-carbon finite anchor still produces a stable continuation');
});

test('camera-aware continuation keeps depth-directed anchors visibly long without changing the first tangent',()=>{
  const anchor=anchorForTest(),depthAnchor={...anchor,backbonePoints:[[0,0,0],[0,0,1],[0,0,2],[0,0,3]],growthTip:[0,0,3],tangent:[0,0,1],initialExtent:3};
  const viewPlane={right:[1,0,0],up:[0,1,0],direction:[0,0,1]},plan=createHeroChainPlan({polymerId:'polyethylene',anchor:depthAnchor,seed:'depth-directed-growth',viewPlane});
  assert.deepEqual(plan.points.slice(0,depthAnchor.backbonePoints.length),depthAnchor.backbonePoints);
  const firstDelta=plan.points[depthAnchor.backbonePoints.length].map((value,index)=>value-depthAnchor.growthTip[index]);
  assert.ok(firstDelta[2]>0&&Math.abs(firstDelta[0])<1e-9&&Math.abs(firstDelta[1])<1e-9,'the initial additions preserve the chemistry-derived tangent');
  const project=point=>[point[0],point[1]],projectedLength=points=>points.slice(1).reduce((sum,point,index)=>sum+Math.hypot(project(point)[0]-project(points[index])[0],project(point)[1]-project(points[index])[1]),0);
  const initialLength=projectedLength(plan.points.slice(0,plan.basePointCount)),heroLength=projectedLength(plan.points);
  assert.ok(heroLength/initialLength>3,'after the tangent-aligned start, extension stays in the visible camera plane and reads as a long chain');
  const headings=plan.points.slice(depthAnchor.backbonePoints.length).slice(1).map((point,index)=>{const previous=plan.points[depthAnchor.backbonePoints.length+index],delta=point.map((value,axis)=>value-previous[axis]),length=Math.hypot(...delta);return delta.map(value=>value/length);});
  const bends=headings.slice(1).map((heading,index)=>Math.acos(Math.max(-1,Math.min(1,heading.reduce((sum,value,axis)=>sum+value*headings[index][axis],0)))));
  assert.ok(Math.max(...bends)<.2,'camera-plane steering remains gradual and keeps local curvature persistent');
});

test('recognizable incorporation, extension and observation hold preserve one increasing chain in normal and reduced motion',()=>{
  for(const reduced of [false,true]){
    const phases=new Set();let previous=0,final=null;
    for(let elapsed=0;elapsed<20000;elapsed+=25){const frame=heroGrowthFrame(elapsed,reduced),visible=visibleHeroPointCount(createHeroChainPlan({polymerId:'polyethylene',anchor:anchorForTest()}),frame);phases.add(frame.phase);assert.ok(visible>=previous,'the same hero chain never retracts during growth');previous=visible;if(frame.phase==='long-chain-hold')final=frame;}
    for(const phase of ['anchored','recognizable-incorporation','extension','long-chain-hold'])assert.ok(phases.has(phase),`missing ${phase}`);
    assert.equal(final.units,HERO_CHAIN_BUDGET.growthUnits);
  }
  assert.equal(heroGrowthFrame(100000,false,4).phase,'long-chain-hold');
});

test('camera safe region uses live obstacles and leaves each selected rectangle clear',()=>{
  const canvas={left:0,top:0,right:390,bottom:360,width:390,height:360},obstacles=[{left:0,right:72,top:0,bottom:72},{left:318,right:390,top:0,bottom:72},{left:165,right:225,top:310,bottom:360}];
  const safe=largestSafeRect(canvas,obstacles,8);assert.ok(safe.width>=150&&safe.height>=120);
  for(const box of obstacles)assert.ok(safe.right<=box.left-8||safe.left>=box.right+8||safe.bottom<=box.top-8||safe.top>=box.bottom+8);
});

function census(root){const objects=[],geometries=new Set(),materials=new Set();root.traverse(object=>{objects.push(object);if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});return{objects:objects.length,geometries:geometries.size,materials:materials.size,vertices:[...geometries].reduce((sum,geometry)=>sum+(geometry.attributes.position?.count??0),0),indices:[...geometries].reduce((sum,geometry)=>sum+(geometry.index?.count??0),0)};}

test('real Three resources, feed pool, hero vertices and hold counts are bounded across duration and cleanup',()=>{
  const anchor=anchorForTest(),cinematics=[.5,1,4].map(durationMultiplier=>createPolymerCinematic({THREE,polymerId:'polyethylene',anchor,sourceRecords:[sourceRecord],sampleId:'same-sample',durationMultiplier}));
  const baselines=cinematics.map(cinematic=>census(cinematic.root));
  for(let index=0;index<cinematics.length;index++){
    const cinematic=cinematics[index],baseline=baselines[index];
    assert.equal(baseline.objects,HERO_CHAIN_BUDGET.objects);assert.ok(baseline.vertices<=HERO_CHAIN_BUDGET.vertexCapacity+300,'template geometry stays fixed and bounded');
    assert.ok(baseline.geometries<=5);assert.ok(baseline.materials<=5);
    cinematic.update(16,{cameraDistance:20});assert.equal(cinematic.stats.phase,'anchored');assert.equal(cinematic.stats.coarseBackboneAlphaMean,0,'the actual atomistic fragment remains the only visible representation at the anchor');
    let transferObserved=false;
    for(let step=0;step<2000&&cinematic.stats.phase!=='long-chain-hold';step++){cinematic.update(50,{cameraDistance:20});if(cinematic.stats.phase==='extension'&&cinematic.stats.coarseBackboneAlphaMean>0)transferObserved=true;assert.deepEqual(census(cinematic.root),baseline);}
    const held=cinematic.update(50,{cameraDistance:24});assert.equal(held.phase,'long-chain-hold');assert.equal(cinematic.stats.heroChainSegmentCount,cinematic.plan.points.length-1);
    assert.ok(transferObserved,'coarse backbone opacity transfers as older molecular sections simplify');assert.ok(cinematic.stats.coarseBackboneAlphaMean>.35);
    for(let step=0;step<20;step++){cinematic.update(16,{cameraDistance:24});assert.deepEqual(census(cinematic.root),baseline);}
    assert.equal(cinematic.stats.feedVisualCapacity,HERO_CHAIN_BUDGET.feedCapacity);assert.ok(cinematic.stats.heroChainVertexCount<=HERO_CHAIN_BUDGET.vertexCapacity);
    cinematic.dispose();cinematic.dispose();assert.equal(cinematic.root.children.length,0);assert.equal(cinematic.stats.objectCount,0);
  }
});
