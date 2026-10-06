import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from '../vendor/three/three.module.min.js';
import {
  createPolymerGrowthAnchor,createHeroChainPlan,heroGrowthFrame,visibleHeroPointCount,visibleHeroCenterlinePointCount,
  largestSafeRect,createSafeRectWorkspace,HERO_CHAIN_BUDGET,POLYMER_VISUAL_AUTHORITY,
  screenSpaceMolecularWeight,projectedPolymerPathMetrics,
} from '../src/polymer-growth-plan.js';
import {createPolymerCinematic} from '../src/reaction-lab-polymer-cinematic.js';

const viewPlane={right:[1,0,0],up:[0,1,0],direction:[0,0,1]};
function finiteFragment(){
  const fragment={atoms:[],bonds:[],atomOrigins:[],continuations:[]},pointsByAtomIndex=[],bondLength=1.48,halfTurn=34*Math.PI/180;
  const carbonPoints=[[0,0,0]],directions=[];
  for(let bond=0;bond<7;bond++){
    const angle=(bond%2===0?1:-1)*halfTurn,direction=[Math.cos(angle),Math.sin(angle),0];directions.push(direction);
    const previous=carbonPoints.at(-1);carbonPoints.push(previous.map((value,axis)=>value+direction[axis]*bondLength));
  }
  for(let unit=0;unit<4;unit++){
    const id=`monomer-${unit}`,first=carbonPoints[unit*2],second=carbonPoints[unit*2+1],axis=second.map((value,index)=>(value-first[index])/bondLength),side=[-axis[1],axis[0],0],center=first.map((value,index)=>(value+second[index])*.5),base=fragment.atoms.length;
    const localPoints=[first,second,
      first.map((value,index)=>value-center[index]-.22*axis[index]+.58*side[index]+center[index]),
      first.map((value,index)=>value-center[index]-.22*axis[index]-.58*side[index]+center[index]),
      second.map((value,index)=>value-center[index]+.22*axis[index]+.58*side[index]+center[index]),
      second.map((value,index)=>value-center[index]+.22*axis[index]-.58*side[index]+center[index]),
    ];
    fragment.atoms.push('C','C','H','H','H','H');
    fragment.atomOrigins.push(...Array.from({length:6},(_,sourceAtomIndex)=>({instanceId:id,sourceAtomIndex})));
    pointsByAtomIndex.push(...localPoints);
    fragment.bonds.push([base,base+1,1],[base,base+2,1],[base,base+3,1],[base+1,base+4,1],[base+1,base+5,1]);
    if(unit>0)fragment.bonds.push([base-5,base,1]);
  }
  fragment.continuations.push({atomRef:19,valence:1});
  return{fragment,pointsByAtomIndex,carbonPoints,directions,bondLength,halfTurn};
}
const anchorForTest=()=>{const sample=finiteFragment();return createPolymerGrowthAnchor({fragment:sample.fragment,pointsByAtomIndex:sample.pointsByAtomIndex,newestInstanceId:'monomer-3'});};
const sourceRecord={atoms:[{element:'C',point:[-.67,0,0]},{element:'C',point:[.67,0,0]},{element:'H',point:[-.93,.58,0]},{element:'H',point:[-.93,-.58,0]},{element:'H',point:[.93,.58,0]},{element:'H',point:[.93,-.58,0]}],bonds:[[0,1,2],[0,2,1],[0,3,1],[1,4,1],[1,5,1]]};

test('finite-fragment anchor uses actual rendered carbon coordinates and the newest continuation end',()=>{
  const anchor=anchorForTest();
  const sample=finiteFragment(),expectedIndices=[0,1,6,7,12,13,18,19];
  assert.deepEqual(anchor.backboneAtomIndices,expectedIndices);
  assert.deepEqual(anchor.backbonePoints,expectedIndices.map(index=>sample.pointsByAtomIndex[index]));
  assert.equal(anchor.growthEndAtomIndex,19);
  assert.deepEqual(anchor.growthTip,sample.carbonPoints.at(-1));
  assert.ok(Math.hypot(...anchor.tangent.map((value,index)=>value-sample.directions.at(-1)[index]))<1e-12);
  assert.equal(anchor.repeatUnitCount,4);assert.equal(anchor.repeatUnits.length,4);
  assert.equal(anchor.molecularTemplate.atoms.length,6);assert.equal(anchor.molecularTemplate.bonds.length,5);
  assert.ok(Math.abs(anchor.medianBackboneBondLength-sample.bondLength)<1e-9,'continuation uses the displayed fragment bond spacing');
  assert.ok(Math.abs(anchor.medianTurnAngleRad-2*sample.halfTurn)<1e-9,'continuation calibrates its local zigzag turn from the actual fragment');
  assert.deepEqual(expectedIndices.map(index=>anchor.stationForAtomIndex[index]),[0,1,2,3,4,5,6,7]);
});

test('actual-to-unit-5 seam, 4-unit chunks, and slow centerline curvature preserve two-scale geometry',()=>{
  const anchor=anchorForTest();
  for(let seed=0;seed<120;seed++){
    const plan=createHeroChainPlan({polymerId:'polyethylene',anchor,seed:`seed-${seed}`,viewPlane});
    assert.deepEqual(plan.points.slice(0,anchor.backbonePoints.length),anchor.backbonePoints);
    assert.equal(plan.growthUnits,68);assert.equal(plan.baseUnitCount,4);
    assert.equal(plan.points.length,anchor.backbonePoints.length+plan.growthUnits*HERO_CHAIN_BUDGET.pointsPerUnit);
    assert.equal(plan.centerlinePoints.length,HERO_CHAIN_BUDGET.presentationUnitCapacity);
    assert.ok(plan.points.length<=HERO_CHAIN_BUDGET.pointCapacity);
    const firstDelta=plan.points[anchor.backbonePoints.length].map((value,index)=>value-anchor.backbonePoints.at(-1)[index]);
    assert.ok(Math.abs(Math.hypot(...firstDelta)-anchor.medianBackboneBondLength)<1e-9,'4→5 connection has the measured C–C bond length');
    const oldDirection=anchor.backbonePoints.at(-1).map((value,index)=>value-anchor.backbonePoints.at(-2)[index]);
    const seamTurn=Math.acos(oldDirection.reduce((sum,value,index)=>sum+value*firstDelta[index],0)/(Math.hypot(...oldDirection)*Math.hypot(...firstDelta)));
    assert.ok(Math.abs(seamTurn-anchor.medianTurnAngleRad)<1e-6,'4→5 continues the actual alternating backbone angle without tangent inversion');
    assert.ok(plan.maximumContinuationTurnDeviationRad<.42,`C–C turn grammar remains continuous through every molecular chunk: ${plan.maximumContinuationTurnDeviationRad}`);
    assert.ok(Math.abs(Math.hypot(...plan.points[9].map((value,index)=>value-plan.points[8][index]))-anchor.medianBackboneBondLength)<1e-9,'unit 5 retains the measured internal C–C bond length');
    assert.equal(plan.molecularTemplate.atoms.length,6);assert.equal(plan.molecularTemplate.bonds.length,5);
    assert.deepEqual(plan.molecularChunks.slice(0,3).map(chunk=>[chunk.kind,chunk.conceptualStart,chunk.unitCount]),[['actual',1,4],['full-molecular-continuation',5,4],['reusable-molecular-chunk',9,4]]);
    assert.ok(plan.molecularChunks.slice(1).every(chunk=>chunk.unitCount===4&&chunk.entryTangent.every(Number.isFinite)&&chunk.exitTangent.every(Number.isFinite)),'continuation is grouped into reusable four-unit molecular chunks with entry/exit frames');
    for(let chunkIndex=1;chunkIndex<plan.molecularChunks.length;chunkIndex++){
      const prior=plan.molecularChunks[chunkIndex-1],next=plan.molecularChunks[chunkIndex];
      assert.equal(next.centerlineStartIndex,prior.centerlineEndIndex+1,'adjacent molecular chunks share consecutive centerline stations without gaps');
      assert.equal(Math.hypot(...next.entryCenter.map((value,axis)=>value-plan.centerlinePoints[next.centerlineStartIndex][axis])),0,'chunk entry is the same shared molecular/coarse centerline');
    }
    for(let unit=0;unit<plan.growthUnits;unit++){
      const first=plan.points[plan.basePointCount+unit*2],second=plan.points[plan.basePointCount+unit*2+1],center=plan.centerlinePoints[plan.baseUnitCount+unit];
      assert.ok(Math.hypot(...first.map((value,index)=>value-second[index]))>=anchor.medianBackboneBondLength*.999,'every repeat retains a visible C–C zigzag bond');
      assert.ok(Math.hypot(...center.map((value,index)=>value-(first[index]+second[index])*.5))<1e-9,'coarse and molecular renderers share the exact per-unit centerline');
      if(unit>0){const prior=plan.points[plan.basePointCount+unit*2-1];assert.ok(Math.abs(Math.hypot(...first.map((value,index)=>value-prior[index]))-anchor.medianBackboneBondLength)<1e-9,'every chunk connection keeps the measured bond length');}
    }
    const metrics=projectedPolymerPathMetrics(plan.centerlinePoints.map(point=>[point[0],point[1]]));
    assert.ok(metrics.pathToChordRatio>1.10&&metrics.pathToChordRatio<1.4,`broad, non-tangled curvature ratio ${metrics.pathToChordRatio}`);
    assert.ok(metrics.cumulativeTurnRad>2.5&&metrics.cumulativeTurnRad<6,`persistent total turn ${metrics.cumulativeTurnRad}`);
    assert.ok(metrics.maxLocalTurnRad<.28,`gradual local turn ${metrics.maxLocalTurnRad}`);
    const earlyChunkCurve=projectedPolymerPathMetrics(plan.centerlinePoints.slice(0,16).map(point=>[point[0],point[1]]));
    assert.ok(earlyChunkCurve.pathToChordRatio>1.02,'the 12–16 unit molecular chain has already begun its persistent macro bend');
    const headings=plan.centerlinePoints.slice(1).map((point,index)=>Math.atan2(point[1]-plan.centerlinePoints[index][1],point[0]-plan.centerlinePoints[index][0])),turns=headings.slice(1).map((heading,index)=>heading-headings[index]);
    const macroHeadings=plan.molecularChunks.slice(1).map(chunk=>Math.atan2(chunk.entryTangent[1],chunk.entryTangent[0])),macroTurns=macroHeadings.slice(1).map((heading,index)=>heading-macroHeadings[index]);
    let signChanges=0,lastSign=0;for(const turn of macroTurns){const sign=Math.sign(turn);if(sign&&lastSign&&sign!==lastSign)signChanges++;if(sign)lastSign=sign;}
    assert.ok(signChanges<5,'slow persistent curvature does not turn independently at every chunk');
  }
  const first=createHeroChainPlan({polymerId:'polyethylene',anchor,seed:'stable',viewPlane}),again=createHeroChainPlan({polymerId:'polyethylene',anchor,seed:'stable',viewPlane});
  assert.deepEqual(first,again);
  assert.deepEqual(first.centerlinePoints,again.centerlinePoints,'the coarse representation is derived from the same deterministic molecular plan');
  assert.ok(new Set(first.centerlinePoints.slice(anchor.repeatUnitCount).map(point=>point.map(value=>value.toFixed(3)).join(','))).size>45,'macro centers do not repeat a regular wave');
  const minimumAnchor={...anchor,backbonePoints:anchor.backbonePoints.slice(0,2),repeatUnits:[],repeatUnitCenters:[],repeatUnitCount:0,molecularTemplate:null,continuationSeedDirections:[[1,0,0],[1,0,0]],medianBackboneBondLength:1.48},minimum=createHeroChainPlan({polymerId:'polyethylene',anchor:minimumAnchor,seed:'minimum',viewPlane});
  assert.ok(minimum.points.every(point=>point.every(Number.isFinite)),'two-carbon anchors remain supported');
});

test('depth-directed anchors keep their actual start tangent and steer into the camera plane',()=>{
  const anchor=anchorForTest(),transform=point=>[point[1],0,point[0]],depthAnchor={...anchor,backbonePoints:anchor.backbonePoints.map(transform),growthTip:transform(anchor.growthTip),tangent:transform(anchor.tangent),repeatUnitCenters:anchor.repeatUnitCenters.map(transform),continuationSeedDirections:anchor.continuationSeedDirections.map(transform),initialExtent:anchor.initialExtent};
  const plan=createHeroChainPlan({polymerId:'polyethylene',anchor:depthAnchor,seed:'depth-directed',viewPlane});
  assert.deepEqual(plan.points.slice(0,depthAnchor.backbonePoints.length),depthAnchor.backbonePoints);
  const firstDelta=plan.points[depthAnchor.backbonePoints.length].map((value,index)=>value-depthAnchor.growthTip[index]);
  assert.ok(firstDelta[2]>1&&Math.abs(firstDelta[0])>.5&&Math.abs(firstDelta[1])<1e-9,'the first new bond preserves the transformed actual zigzag tangent');
  const project=point=>[point[0],point[1]],projectedLength=points=>points.slice(1).reduce((sum,point,index)=>sum+Math.hypot(project(point)[0]-project(points[index])[0],project(point)[1]-project(points[index])[1]),0);
  assert.ok(projectedLength(plan.centerlinePoints)>3,'continuation remains visible after a depth-directed finite anchor');
  const metrics=projectedPolymerPathMetrics(plan.centerlinePoints.slice(plan.baseUnitCount).map(project));
  const worldContinuation=plan.centerlinePoints.slice(plan.baseUnitCount-1),worldDirections=worldContinuation.slice(1).map((point,index)=>point.map((value,axis)=>value-worldContinuation[index][axis])),worldTurns=worldDirections.slice(1).map((direction,index)=>Math.acos(Math.max(-1,Math.min(1,direction.reduce((sum,value,axis)=>sum+value*worldDirections[index][axis],0)/(Math.hypot(...direction)*Math.hypot(...worldDirections[index]))))));
  assert.ok(metrics.pathToChordRatio>1.1&&Math.max(...worldTurns)<.28,JSON.stringify({metrics,maxWorldTurn:Math.max(...worldTurns)}));
});

test('LOD follows CSS-pixel atom and bond readability with a smooth retained transition',()=>{
  const authority=POLYMER_VISUAL_AUTHORITY;
  assert.deepEqual([authority.molecularBondStartPx,authority.molecularBondFullPx],[4,8]);
  assert.deepEqual([authority.molecularAtomStartPx,authority.molecularAtomFullPx],[2.5,4.5]);
  assert.equal(authority.coarseStrandWorldRadiusMax,.58);
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
    for(let elapsed=0;elapsed<20000;elapsed+=25){const frame=heroGrowthFrame(elapsed,reduced,1,{},plan.growthUnits),visible=visibleHeroPointCount(plan,frame),centers=visibleHeroCenterlinePointCount(plan,frame);phases.add(frame.phase);assert.ok(visible>=previous,'the same path never retracts during growth');assert.ok(centers>=plan.baseUnitCount&&centers<=plan.centerlinePoints.length);previous=visible;if(frame.phase==='long-chain-hold')final=frame;}
    for(const phase of ['anchored','recognizable-incorporation','stage-b-molecular-hold','extension','long-chain-hold'])assert.ok(phases.has(phase),`missing ${phase}`);
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
    for(const name of ['bounded-molecular-chain-atoms','bounded-incoming-monomer-atoms','bounded-incoming-repeat-markers']){const mesh=cinematic.root.children.find(child=>child.name===name);assert.equal(mesh.material.vertexColors,false,`${name} uses instance colors without a missing vertex-color attribute`);assert.ok(mesh.instanceColor,`${name} retains its bounded per-instance element palette`);}
    assert.equal(cinematic.stats.coarseGeometryVertexCapacity,HERO_CHAIN_BUDGET.vertexCapacity);
    assert.equal(cinematic.root.children.find(child=>child.name==='continuous-polymer-backbone').geometry.index.count,HERO_CHAIN_BUDGET.indexCapacity);
    assert.equal(cinematic.stats.actualRepeatUnitCount,4);assert.equal(cinematic.stats.presentationUnitCount,4);
    assert.equal(cinematic.stats.molecularTemplateAtomCount,6);assert.equal(cinematic.stats.molecularTemplateBondCount,5);
    assert.equal(cinematic.stats.chainAtomInstanceCapacity,408);assert.equal(cinematic.stats.chainBondInstanceCapacity,408);
    cinematic.advance(16);cinematic.render(readableMetrics);
    assert.equal(cinematic.stats.phase,'anchored');assert.equal(cinematic.stats.molecularLodWeight,1);assert.equal(cinematic.stats.coarseLodWeight,0);
    let incorporated=false;
    for(let step=0;step<600&&!incorporated;step++){
      cinematic.advance(50);cinematic.render(readableMetrics);assert.deepEqual(census(cinematic.root),baseline);
      incorporated=cinematic.stats.phase==='extension'&&cinematic.stats.molecularDetailUnitCount>anchor.repeatUnitCount+1;
    }
    assert.ok(incorporated,'more than the tip units are molecular while their projected bonds remain readable');
    assert.equal(cinematic.stats.molecularLodWeight,1);assert.equal(cinematic.stats.coarseLodWeight,0);
    assert.ok(cinematic.stats.molecularAtomInstanceCount>cinematic.stats.tipDetailAtomCount);
    assert.equal(cinematic.detailOpacityForStation(0),1);
    cinematic.render({projectedHeavyAtomDiameterPx:3.5,projectedBackboneBondLengthPx:6,localUnitsPerCssPixel:.01,cameraDistance:22});
    assert.equal(cinematic.stats.molecularLodWeight,.5);assert.equal(cinematic.stats.coarseLodWeight,.5,'both representations overlap during the same-backbone transition');
    assert.equal(cinematic.stats.coarseBackboneAlignmentError,0);
    cinematic.render({projectedHeavyAtomDiameterPx:3.2,projectedBackboneBondLengthPx:4.33,localUnitsPerCssPixel:.01,cameraDistance:24});
    assert.ok(cinematic.stats.molecularLodWeight<=.02);assert.equal(cinematic.stats.molecularDetailUnitCount,0,'the final translucent molecular residue is removed below 2% weight');
    cinematic.render({projectedHeavyAtomDiameterPx:2,projectedBackboneBondLengthPx:3,localUnitsPerCssPixel:.01,cameraDistance:25});
    assert.equal(cinematic.stats.molecularLodWeight,0);assert.equal(cinematic.stats.coarseLodWeight,1);
    assert.equal(cinematic.detailOpacityForStation(0),0);assert.equal(cinematic.stats.tipDetailAtomCount,0,'unreadable atomistic tip is removed with the rest of the chain');
    assert.equal(cinematic.stats.projectedStrandWidthPx,2.8);assert.equal(cinematic.stats.molecularDetailUnitCount,0);
    cinematic.render({projectedHeavyAtomDiameterPx:1.2,projectedBackboneBondLengthPx:2.6,localUnitsPerCssPixel:.55,cameraDistance:432});
    assert.ok(cinematic.stats.projectedStrandWidthPx>=2&&cinematic.stats.projectedStrandWidthPx<=2.8,'the bounded far-camera radius keeps the coarse strand above a 2 px hairline');
    for(let step=0;step<1000&&cinematic.stats.phase!=='long-chain-hold';step++){cinematic.advance(50);cinematic.render({projectedHeavyAtomDiameterPx:2,projectedBackboneBondLengthPx:3,localUnitsPerCssPixel:.01,cameraDistance:25});assert.deepEqual(census(cinematic.root),baseline);}
    assert.equal(cinematic.stats.phase,'long-chain-hold');assert.equal(cinematic.stats.feedVisualActiveCount,0);
    const held={...cinematic.stats};
    for(let step=0;step<20;step++){cinematic.advance(16);cinematic.render({projectedHeavyAtomDiameterPx:2,projectedBackboneBondLengthPx:3,localUnitsPerCssPixel:.01,cameraDistance:25});assert.deepEqual(census(cinematic.root),baseline);}
    assert.equal(cinematic.stats.objectCount,held.objectCount);assert.equal(cinematic.stats.geometryCount,held.geometryCount);assert.equal(cinematic.stats.materialCount,held.materialCount);
    assert.equal(cinematic.stats.heroChainVertexCount,HERO_CHAIN_BUDGET.vertexCapacity);assert.equal(cinematic.stats.feedVisualCapacity,HERO_CHAIN_BUDGET.feedCapacity);
    cinematic.dispose();cinematic.dispose();assert.equal(cinematic.root.children.length,0);assert.equal(cinematic.stats.objectCount,0);assert.equal(cinematic.stats.geometryCount,0);assert.equal(cinematic.stats.materialCount,0);
  }
});

test('Stage B incorporates four recognizable Feed monomers into the same 8-unit molecular chain',()=>{
  const cinematic=createPolymerCinematic({THREE,polymerId:'polyethylene',anchor:anchorForTest(),sourceRecords:[sourceRecord],sampleId:'stage-b-checkpoint',viewPlane});
  for(let frame=0;frame<62;frame++){cinematic.advance(50);cinematic.render(readableMetrics);}
  assert.equal(cinematic.stats.phase,'stage-b-molecular-hold');assert.equal(cinematic.stats.presentationUnitCount,8);
  assert.equal(cinematic.stats.molecularDetailUnitCount,8);assert.equal(cinematic.stats.recognizableFeedUnitProofMask,15);
  assert.equal(cinematic.stats.molecularAtomInstanceCount,24);assert.equal(cinematic.stats.molecularBondInstanceCount,24);
  const chainAtoms=cinematic.root.children.find(child=>child.name==='bounded-molecular-chain-atoms'),matrix=new THREE.Matrix4();
  for(let atom=0;atom<2;atom++){
    chainAtoms.getMatrixAt(atom,matrix);
    const expected=cinematic.plan.points[cinematic.plan.basePointCount+atom],translation=matrix.elements.slice(12,15);
    assert.ok(Math.hypot(...translation.map((value,axis)=>value-expected[axis]))<1e-5,`unit 5 backbone carbon ${atom+1} uses the continuous molecular plan`);
  }
  cinematic.dispose();assert.equal(cinematic.stats.objectCount,0);
});
