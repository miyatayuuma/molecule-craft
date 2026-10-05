import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from '../vendor/three/three.module.min.js';
import {
  createPolymerGrowthAnchor,createHeroChainPlan,heroGrowthFrame,visibleHeroPointCount,
  largestSafeRect,createSafeRectWorkspace,HERO_CHAIN_BUDGET,POLYMER_VISUAL_AUTHORITY,
  screenSpaceMolecularWeight,projectedPolymerPathMetrics,
} from '../src/polymer-growth-plan.js';
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
const viewPlane={right:[1,0,0],up:[0,1,0],direction:[0,0,1]};
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

test('bounded PE continuation is deterministic, tangent-aligned, and broadly curved in screen space',()=>{
  const anchor=anchorForTest();
  for(let seed=0;seed<120;seed++){
    const plan=createHeroChainPlan({polymerId:'polyethylene',anchor,seed:`seed-${seed}`,viewPlane});
    assert.deepEqual(plan.points.slice(0,anchor.backbonePoints.length),anchor.backbonePoints);
    assert.equal(plan.points.length,anchor.backbonePoints.length+HERO_CHAIN_BUDGET.growthUnits*HERO_CHAIN_BUDGET.pointsPerUnit);
    assert.ok(plan.points.length<=HERO_CHAIN_BUDGET.pointCapacity);
    const firstDelta=plan.points[anchor.backbonePoints.length].map((value,index)=>value-anchor.backbonePoints.at(-1)[index]);
    assert.ok(firstDelta[0]>0&&Math.abs(firstDelta[1])<1e-9&&Math.abs(firstDelta[2])<1e-9,'first continuation preserves the chemistry-derived tangent');
    const metrics=projectedPolymerPathMetrics(plan.points.map(point=>[point[0],point[1]]));
    assert.ok(metrics.pathToChordRatio>1.10&&metrics.pathToChordRatio<1.4,`broad, non-tangled curvature ratio ${metrics.pathToChordRatio}`);
    assert.ok(metrics.cumulativeTurnRad>2.5&&metrics.cumulativeTurnRad<6,`persistent total turn ${metrics.cumulativeTurnRad}`);
    assert.ok(metrics.maxLocalTurnRad<.22,`gradual local turn ${metrics.maxLocalTurnRad}`);
  }
  const first=createHeroChainPlan({polymerId:'polyethylene',anchor,seed:'stable',viewPlane}),again=createHeroChainPlan({polymerId:'polyethylene',anchor,seed:'stable',viewPlane});
  assert.deepEqual(first,again);
  assert.ok(new Set(first.points.slice(anchor.backbonePoints.length).map(point=>point.map(value=>value.toFixed(3)).join(','))).size>45,'the trajectory does not repeat a regular wave');
  const minimumAnchor={...anchor,backbonePoints:anchor.backbonePoints.slice(0,2)},minimum=createHeroChainPlan({polymerId:'polyethylene',anchor:minimumAnchor,seed:'minimum',viewPlane});
  assert.ok(minimum.points.every(point=>point.every(Number.isFinite)),'two-carbon anchors remain supported');
});

test('depth-directed anchors keep their actual start tangent and steer into the camera plane',()=>{
  const anchor=anchorForTest(),depthAnchor={...anchor,backbonePoints:[[0,0,0],[0,0,1],[0,0,2],[0,0,3]],growthTip:[0,0,3],tangent:[0,0,1],initialExtent:3};
  const plan=createHeroChainPlan({polymerId:'polyethylene',anchor:depthAnchor,seed:'depth-directed',viewPlane});
  assert.deepEqual(plan.points.slice(0,depthAnchor.backbonePoints.length),depthAnchor.backbonePoints);
  const firstDelta=plan.points[depthAnchor.backbonePoints.length].map((value,index)=>value-depthAnchor.growthTip[index]);
  assert.ok(firstDelta[2]>0&&Math.abs(firstDelta[0])<1e-9&&Math.abs(firstDelta[1])<1e-9);
  const project=point=>[point[0],point[1]],projectedLength=points=>points.slice(1).reduce((sum,point,index)=>sum+Math.hypot(project(point)[0]-project(points[index])[0],project(point)[1]-project(points[index])[1]),0);
  assert.ok(projectedLength(plan.points)/projectedLength(plan.points.slice(0,plan.basePointCount))>3,'continuation remains visible after a depth-directed finite anchor');
  const metrics=projectedPolymerPathMetrics(plan.points.map(project));
  assert.ok(metrics.pathToChordRatio>1.1&&metrics.maxLocalTurnRad<.24);
});

test('LOD follows CSS-pixel atom and bond readability with a smooth retained transition',()=>{
  const authority=POLYMER_VISUAL_AUTHORITY;
  assert.deepEqual([authority.molecularBondStartPx,authority.molecularBondFullPx],[4,8]);
  assert.deepEqual([authority.molecularAtomStartPx,authority.molecularAtomFullPx],[2.5,4.5]);
  const readable=screenSpaceMolecularWeight({heavyAtomDiameterPx:5,backboneBondLengthPx:9,previousWeight:1});
  assert.equal(readable.molecularWeight,1);assert.equal(readable.coarseWeight,0);
  const middle=screenSpaceMolecularWeight({heavyAtomDiameterPx:3.5,backboneBondLengthPx:6,previousWeight:1});
  assert.equal(middle.readabilityScore,.5);assert.equal(middle.molecularWeight,.5);assert.equal(middle.coarseWeight,.5);
  const unreadable=screenSpaceMolecularWeight({heavyAtomDiameterPx:1.5,backboneBondLengthPx:3,previousWeight:middle.molecularWeight});
  assert.equal(unreadable.molecularWeight,0);assert.equal(unreadable.coarseWeight,1);
  const retainedMolecular=screenSpaceMolecularWeight({heavyAtomDiameterPx:4.45,backboneBondLengthPx:7.85,previousWeight:1});
  assert.equal(retainedMolecular.molecularWeight,1,'small threshold jitter retains the molecular state');
  const retainedCoarse=screenSpaceMolecularWeight({heavyAtomDiameterPx:2.56,backboneBondLengthPx:4.12,previousWeight:0});
  assert.equal(retainedCoarse.molecularWeight,0,'small threshold jitter retains the coarse state');
  const missing=screenSpaceMolecularWeight({heavyAtomDiameterPx:NaN,backboneBondLengthPx:6,previousWeight:.37});
  assert.equal(missing.molecularWeight,.37,'missing projection data retains the prior visual state');
});

test('molecular growth phases keep one increasing backbone under normal and reduced motion',()=>{
  for(const reduced of [false,true]){
    const plan=createHeroChainPlan({polymerId:'polyethylene',anchor:anchorForTest(),seed:'timeline',viewPlane});
    const phases=new Set();let previous=0,final=null;
    for(let elapsed=0;elapsed<20000;elapsed+=25){const frame=heroGrowthFrame(elapsed,reduced),visible=visibleHeroPointCount(plan,frame);phases.add(frame.phase);assert.ok(visible>=previous,'the same path never retracts during growth');previous=visible;if(frame.phase==='long-chain-hold')final=frame;}
    for(const phase of ['anchored','recognizable-incorporation','extension','long-chain-hold'])assert.ok(phases.has(phase),`missing ${phase}`);
    assert.equal(final.units,HERO_CHAIN_BUDGET.growthUnits);
  }
  assert.equal(heroGrowthFrame(100000,false,4).phase,'long-chain-hold');
});

test('camera safe region uses live obstacles and leaves the selected rectangle clear',()=>{
  const canvas={left:0,top:0,right:390,bottom:360,width:390,height:360},obstacles=[{left:0,right:72,top:0,bottom:72},{left:318,right:390,top:0,bottom:72},{left:165,right:225,top:310,bottom:360}];
  const safe=largestSafeRect(canvas,obstacles,8);assert.ok(safe.width>=150&&safe.height>=120);
  for(const box of obstacles)assert.ok(safe.right<=box.left-8||safe.left>=box.right+8||safe.bottom<=box.top-8||safe.top>=box.bottom+8);
  const target={left:0,right:0,top:0,bottom:0,width:0,height:0},workspace=createSafeRectWorkspace(3);
  assert.equal(largestSafeRect(canvas,obstacles,8,target,workspace,obstacles.length),target,'active camera framing reuses its bounded result and scratch buffers');
  assert.deepEqual(target,safe);
});

function census(root){const objects=[],geometries=new Set(),materials=new Set();root.traverse(object=>{objects.push(object);if(object.geometry)geometries.add(object.geometry);if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);});return{objects:objects.length,geometries:geometries.size,materials:materials.size,vertices:[...geometries].reduce((sum,geometry)=>sum+(geometry.attributes.position?.count??0),0),indices:[...geometries].reduce((sum,geometry)=>sum+(geometry.index?.count??0),0)};}
const readableMetrics={projectedHeavyAtomDiameterPx:7,projectedBackboneBondLengthPx:12,localUnitsPerCssPixel:.01,cameraDistance:20};

test('bounded instanced detail persists while readable, crossfades in place, and stabilizes at hold',()=>{
  const anchor=anchorForTest(),cinematics=[.5,1,4].map(durationMultiplier=>createPolymerCinematic({THREE,polymerId:'polyethylene',anchor,sourceRecords:[sourceRecord],sampleId:'same-sample',durationMultiplier,viewPlane}));
  const baselines=cinematics.map(cinematic=>census(cinematic.root));
  for(let index=0;index<cinematics.length;index++){
    const cinematic=cinematics[index],baseline=baselines[index];
    assert.equal(baseline.objects,HERO_CHAIN_BUDGET.objects);assert.equal(baseline.geometries,5);assert.equal(baseline.materials,9);
    assert.equal(cinematic.stats.coarseGeometryVertexCapacity,HERO_CHAIN_BUDGET.vertexCapacity);
    assert.equal(cinematic.root.children.find(child=>child.name==='continuous-polymer-backbone').geometry.index.count,HERO_CHAIN_BUDGET.indexCapacity);
    assert.equal(cinematic.stats.chainAtomInstanceCapacity,288);assert.equal(cinematic.stats.chainBondInstanceCapacity,288);
    cinematic.advance(16);cinematic.render(readableMetrics);
    assert.equal(cinematic.stats.phase,'anchored');assert.equal(cinematic.stats.molecularLodWeight,1);assert.equal(cinematic.stats.coarseLodWeight,0);
    let incorporated=false;
    for(let step=0;step<300&&!incorporated;step++){
      cinematic.advance(50);cinematic.render(readableMetrics);assert.deepEqual(census(cinematic.root),baseline);
      incorporated=cinematic.stats.phase==='extension'&&cinematic.stats.molecularDetailUnitCount>2;
    }
    assert.ok(incorporated,'more than the tip units are molecular while their projected bonds remain readable');
    assert.equal(cinematic.stats.molecularLodWeight,1);assert.equal(cinematic.stats.coarseLodWeight,0);
    assert.ok(cinematic.stats.molecularAtomInstanceCount>cinematic.stats.tipDetailAtomCount);
    assert.equal(cinematic.detailOpacityForStation(0),1);
    cinematic.render({projectedHeavyAtomDiameterPx:3.5,projectedBackboneBondLengthPx:6,localUnitsPerCssPixel:.01,cameraDistance:22});
    assert.equal(cinematic.stats.molecularLodWeight,.5);assert.equal(cinematic.stats.coarseLodWeight,.5,'both representations overlap during the same-backbone transition');
    assert.equal(cinematic.stats.coarseBackboneAlignmentError,0);
    cinematic.render({projectedHeavyAtomDiameterPx:2,projectedBackboneBondLengthPx:3,localUnitsPerCssPixel:.01,cameraDistance:25});
    assert.equal(cinematic.stats.molecularLodWeight,0);assert.equal(cinematic.stats.coarseLodWeight,1);
    assert.equal(cinematic.detailOpacityForStation(0),0);assert.equal(cinematic.stats.tipDetailAtomCount,0,'unreadable atomistic tip is removed with the rest of the chain');
    assert.equal(cinematic.stats.projectedStrandWidthPx,2.8);assert.equal(cinematic.stats.molecularDetailUnitCount,0);
    for(let step=0;step<1000&&cinematic.stats.phase!=='long-chain-hold';step++){cinematic.advance(50);cinematic.render({projectedHeavyAtomDiameterPx:2,projectedBackboneBondLengthPx:3,localUnitsPerCssPixel:.01,cameraDistance:25});assert.deepEqual(census(cinematic.root),baseline);}
    assert.equal(cinematic.stats.phase,'long-chain-hold');assert.equal(cinematic.stats.feedVisualActiveCount,0);
    const held={...cinematic.stats};
    for(let step=0;step<20;step++){cinematic.advance(16);cinematic.render({projectedHeavyAtomDiameterPx:2,projectedBackboneBondLengthPx:3,localUnitsPerCssPixel:.01,cameraDistance:25});assert.deepEqual(census(cinematic.root),baseline);}
    assert.equal(cinematic.stats.objectCount,held.objectCount);assert.equal(cinematic.stats.geometryCount,held.geometryCount);assert.equal(cinematic.stats.materialCount,held.materialCount);
    assert.equal(cinematic.stats.heroChainVertexCount,HERO_CHAIN_BUDGET.vertexCapacity);assert.equal(cinematic.stats.feedVisualCapacity,HERO_CHAIN_BUDGET.feedCapacity);
    cinematic.dispose();cinematic.dispose();assert.equal(cinematic.root.children.length,0);assert.equal(cinematic.stats.objectCount,0);assert.equal(cinematic.stats.geometryCount,0);assert.equal(cinematic.stats.materialCount,0);
  }
});
