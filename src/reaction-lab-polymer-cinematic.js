import {
  createHeroChainPlan, heroGrowthFrame, HERO_CHAIN_BUDGET, POLYMER_VISUAL_AUTHORITY,
  sampleHeroPoint, screenSpaceMolecularWeight, visibleHeroPointCount, visibleHeroCenterlinePointCount,
} from './polymer-growth-plan.js?v=5';
import {modelAtomRadius} from './chemistry.js?v=20';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smoothstep=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const EMPTY_METRICS=Object.freeze({});

function recordPoint(atom){
  const point=atom?.point;
  if(point?.toArray)return point.toArray();
  if(Array.isArray(point))return point;
  return [point?.x??0,point?.y??0,point?.z??0];
}

function makeTemplate(record){
  if(!record?.atoms?.length)return null;
  const atoms=record.atoms.map((atom,index)=>({element:typeof atom==='string'?atom:atom.element,point:recordPoint(atom),index}));
  const bonds=record.bonds.map(bond=>Array.isArray(bond)?{a:bond[0],b:bond[1],order:bond[2]}:bond).filter(bond=>atoms[bond.a]&&atoms[bond.b]);
  const carbons=atoms.filter(atom=>atom.element==='C');
  let axisStart=null,axisEnd=null,axisLength=0;
  for(let a=0;a<carbons.length;a++)for(let b=a+1;b<carbons.length;b++){
    const left=carbons[a],right=carbons[b],length=Math.hypot(...right.point.map((value,index)=>value-left.point[index]));
    if(length>axisLength){axisStart=left;axisEnd=right;axisLength=length;}
  }
  if(!axisStart||axisLength<1e-6)return null;
  return{
    atoms,bonds,
    axisStartIndex:axisStart.index,
    axisEndIndex:axisEnd.index,
    axis:axisEnd.point.map((value,index)=>(value-axisStart.point[index])/axisLength),
    axisLength,
    center:axisStart.point.map((value,index)=>(value+axisEnd.point[index])*.5),
  };
}

function sampleInto(points,station,target){
  const index=clamp(station,0,points.length-1),first=Math.floor(index),second=Math.min(points.length-1,first+1),mix=index-first,a=points[first],b=points[second];
  return target.set(a[0]+(b[0]-a[0])*mix,a[1]+(b[1]-a[1])*mix,a[2]+(b[2]-a[2])*mix);
}

function census(root){
  const objects=[],geometries=new Set(),materials=new Set();
  root.traverse(object=>{objects.push(object);if(object.geometry)geometries.add(object.geometry);if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)materials.add(material);});
  return{objectCount:objects.length,geometryCount:geometries.size,materialCount:materials.size};
}

/**
 * Presentation-only PE scale-up. Its single backbone is anchored to the actual
 * finite fragment. Added repeat units use fixed instanced buffers; screen-space
 * readability alone transfers that same chain to the shared coarse tube.
 */
export function createPolymerCinematic({THREE,polymerId,anchor,sourceRecords=[],sampleId='polymer-sample',reducedMotion=false,durationMultiplier=1,viewPlane=null}){
  if(polymerId!=='polyethylene')throw new Error('Hero-chain continuity is currently enabled for polyethylene only.');
  const plan=createHeroChainPlan({polymerId,anchor,seed:sampleId,viewPlane}),root=new THREE.Group();root.name='polymer-hero-chain-presentation';
  const chainTemplate=makeTemplate(anchor.molecularTemplate),feedTemplate=makeTemplate(sourceRecords[0]),radial=HERO_CHAIN_BUDGET.radialSegments;
  if(anchor.repeatUnitCount!==4||chainTemplate?.atoms.length!==6||chainTemplate?.bonds.length!==5)throw new Error('PE continuation requires the actual four-unit fragment to calibrate its six-atom molecular template.');
  const chainTemplateAtomCount=Math.max(1,chainTemplate?.atoms.length??0),chainTemplateBondCount=Math.max(1,chainTemplate?.bonds.length??0);
  const feedTemplateAtomCount=Math.max(1,feedTemplate?.atoms.length??0),feedTemplateBondCount=Math.max(1,feedTemplate?.bonds.length??0);
  const chainAtomCapacity=chainTemplateAtomCount*plan.growthUnits;
  const chainBondCapacity=chainTemplateBondCount*plan.growthUnits+plan.growthUnits;
  const feedAtomCapacity=feedTemplateAtomCount*HERO_CHAIN_BUDGET.feedCapacity,feedBondCapacity=feedTemplateBondCount*HERO_CHAIN_BUDGET.feedCapacity;
  const markerAtomCapacity=2*HERO_CHAIN_BUDGET.feedCapacity,markerBondCapacity=HERO_CHAIN_BUDGET.feedCapacity;
  const vertices=HERO_CHAIN_BUDGET.vertexCapacity,positions=new Float32Array(vertices*3),radialDirections=new Float32Array(vertices*3),colors=new Float32Array(vertices*4),indices=[];
  const pathVectors=plan.centerlinePoints.map(point=>new THREE.Vector3(...point));
  const extensionDirection=pathVectors.length>1?new THREE.Vector3().subVectors(pathVectors.at(-1),pathVectors.at(-2)).normalize():new THREE.Vector3(1,0,0);
  while(pathVectors.length<HERO_CHAIN_BUDGET.centerlinePointCapacity)pathVectors.push(pathVectors.at(-1).clone().addScaledVector(extensionDirection,plan.targetStep*2));
  const tangent=new THREE.Vector3(),reference=new THREE.Vector3(),side=new THREE.Vector3(),up=new THREE.Vector3();
  for(let pointIndex=0;pointIndex<pathVectors.length;pointIndex++){
    tangent.subVectors(pathVectors[Math.min(pointIndex+1,pathVectors.length-1)],pathVectors[Math.max(0,pointIndex-1)]).normalize();
    reference.set(0,Math.abs(tangent.y)<.88?1:0,Math.abs(tangent.y)<.88?0:1);
    side.crossVectors(tangent,reference).normalize();up.crossVectors(tangent,side).normalize();
    for(let ring=0;ring<radial;ring++){
      const angle=ring/radial*Math.PI*2,vertex=pointIndex*radial+ring,index=vertex*3;
      const nx=side.x*Math.cos(angle)+up.x*Math.sin(angle),ny=side.y*Math.cos(angle)+up.y*Math.sin(angle),nz=side.z*Math.cos(angle)+up.z*Math.sin(angle);
      radialDirections[index]=nx;radialDirections[index+1]=ny;radialDirections[index+2]=nz;
      positions[index]=pathVectors[pointIndex].x+nx*.15;positions[index+1]=pathVectors[pointIndex].y+ny*.15;positions[index+2]=pathVectors[pointIndex].z+nz*.15;
      const colorIndex=vertex*4;colors[colorIndex]=.545;colors[colorIndex+1]=.847;colors[colorIndex+2]=.824;colors[colorIndex+3]=1;
      if(pointIndex<pathVectors.length-1){const a=pointIndex*radial+ring,b=pointIndex*radial+(ring+1)%radial,c=a+radial,d=b+radial;indices.push(a,b,c,b,d,c);}
    }
  }
  const tubeGeometry=new THREE.BufferGeometry();tubeGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));tubeGeometry.setAttribute('color',new THREE.BufferAttribute(colors,4));tubeGeometry.setIndex(indices);tubeGeometry.computeVertexNormals();tubeGeometry.setDrawRange(0,0);
  const tubeMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',emissive:'#12363b',roughness:.48,metalness:.08,transparent:true,vertexColors:true,opacity:0,depthWrite:false});
  const tube=new THREE.Mesh(tubeGeometry,tubeMaterial);tube.name='continuous-polymer-backbone';root.add(tube);

  const sphereGeometry=new THREE.SphereGeometry(1,8,6),bondGeometry=new THREE.CylinderGeometry(.038,.038,1,6),particleGeometry=new THREE.SphereGeometry(1,7,5),pulseGeometry=new THREE.SphereGeometry(1,10,7);
  const chainAtomMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.44,metalness:.02,transparent:true,opacity:1});
  const chainBondMaterial=new THREE.MeshStandardMaterial({color:'#b8d1de',roughness:.5,transparent:true,opacity:1});
  const feedAtomMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.44,metalness:.02,transparent:true,opacity:1});
  const feedBondMaterial=new THREE.MeshStandardMaterial({color:'#c1d7df',roughness:.48,transparent:true,opacity:1});
  const markerAtomMaterial=new THREE.MeshStandardMaterial({color:'#cde5ed',emissive:'#173f48',roughness:.5,transparent:true,opacity:0});
  const markerBondMaterial=new THREE.MeshStandardMaterial({color:'#9ebcc5',roughness:.5,transparent:true,opacity:0});
  const particleMaterial=new THREE.MeshStandardMaterial({color:'#cde5ed',emissive:'#1e4e5c',roughness:.5,transparent:true,opacity:0});
  const pulseMaterial=new THREE.MeshBasicMaterial({color:'#a7f0df',transparent:true,opacity:.24,depthWrite:false});

  const chainAtoms=new THREE.InstancedMesh(sphereGeometry,chainAtomMaterial,chainAtomCapacity);chainAtoms.name='bounded-molecular-chain-atoms';chainAtoms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);chainAtoms.frustumCulled=false;root.add(chainAtoms);
  const chainBonds=new THREE.InstancedMesh(bondGeometry,chainBondMaterial,chainBondCapacity);chainBonds.name='bounded-molecular-chain-bonds';chainBonds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);chainBonds.frustumCulled=false;root.add(chainBonds);
  const feedAtoms=new THREE.InstancedMesh(sphereGeometry,feedAtomMaterial,feedAtomCapacity);feedAtoms.name='bounded-incoming-monomer-atoms';feedAtoms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);feedAtoms.frustumCulled=false;root.add(feedAtoms);
  const feedBonds=new THREE.InstancedMesh(bondGeometry,feedBondMaterial,feedBondCapacity);feedBonds.name='bounded-incoming-monomer-bonds';feedBonds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);feedBonds.frustumCulled=false;root.add(feedBonds);
  const markers=new THREE.InstancedMesh(sphereGeometry,markerAtomMaterial,markerAtomCapacity);markers.name='bounded-incoming-repeat-markers';markers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);markers.frustumCulled=false;root.add(markers);
  const markerBonds=new THREE.InstancedMesh(bondGeometry,markerBondMaterial,markerBondCapacity);markerBonds.name='bounded-incoming-marker-bonds';markerBonds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);markerBonds.frustumCulled=false;root.add(markerBonds);
  const particles=new THREE.InstancedMesh(particleGeometry,particleMaterial,HERO_CHAIN_BUDGET.feedCapacity);particles.name='bounded-incoming-particles';particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);particles.frustumCulled=false;root.add(particles);
  const tipPulse=new THREE.Mesh(pulseGeometry,pulseMaterial);tipPulse.name='polymer-growth-tip-anchor';root.add(tipPulse);

  const sourceElementColors={C:'#c7d6e1',H:'#f2f8fb',O:'#f18177',N:'#8caeff',Cl:'#85cd91',S:'#f0c66f',P:'#f09a59',F:'#a5da9e'};
  const color=new THREE.Color();
  function initializeInstanceColors(mesh,capacity,atomList){
    if(!atomList?.length)return;
    for(let index=0;index<capacity;index++){const atom=atomList[index%atomList.length];color.set(sourceElementColors[atom?.element]??'#c7d6e1');mesh.setColorAt(index,color);}
  }
  initializeInstanceColors(chainAtoms,chainAtomCapacity,chainTemplate?.atoms);
  initializeInstanceColors(feedAtoms,feedAtomCapacity,feedTemplate?.atoms);
  initializeInstanceColors(markers,markerAtomCapacity,[{element:'C'},{element:'C'}]);

  const dummy=new THREE.Object3D(),fromAxis=new THREE.Vector3(),toAxis=new THREE.Vector3(),axisCenter=new THREE.Vector3(),atomPosition=new THREE.Vector3(),atomCenter=new THREE.Vector3(),bondDirection=new THREE.Vector3(),bondMid=new THREE.Vector3(),bondStart=new THREE.Vector3(),bondEnd=new THREE.Vector3(),yAxis=new THREE.Vector3(0,1,0),unitQuaternion=new THREE.Quaternion();
  const pointA=new THREE.Vector3(),pointB=new THREE.Vector3(),pointC=new THREE.Vector3(),flightPoint=new THREE.Vector3(),flightSource=new THREE.Vector3(),feedOffset=new THREE.Vector3(),feedOrigin=new THREE.Vector3(-4,3.5,0),tipVector=new THREE.Vector3(),tipSample=[0,0,0];
  const chainMeshes={atoms:chainAtoms,bonds:chainBonds},feedMeshes={atoms:feedAtoms,bonds:feedBonds},moleculeResult={atomEnd:0,bondEnd:0};
  const lodInput={heavyAtomDiameterPx:8,backboneBondLengthPx:8,previousWeight:1},lodResult={readabilityScore:1,molecularWeight:1,coarseWeight:0};
  const initialCameraDistance=15,stats={
    active:true,phase:'anchored',progress:0,heroChainId:sampleId,heroChainProgress:0,heroChainSegmentCount:0,heroChainVertexCount:0,
    coarseBackboneAlphaMean:0,coarseLodWeight:0,molecularLodWeight:1,molecularLodMode:'molecular',lodReadabilityScore:null,
    projectedHeavyAtomDiameterPx:null,projectedBackboneBondLengthPx:null,projectedStrandWidthPx:0,
    feedFullMoleculeWeight:1,feedRepeatMarkerWeight:0,feedParticleWeight:0,
    feedVisualActiveCount:0,feedVisualCapacity:HERO_CHAIN_BUDGET.feedCapacity,recognizableFeedUnitCount:0,
    molecularDetailUnitCount:0,molecularAtomInstanceCount:0,molecularBondInstanceCount:0,tipDetailAtomCount:0,tipDetailBondCount:0,
    chainAtomInstanceCapacity:chainAtomCapacity,chainBondInstanceCapacity:chainBondCapacity,
    feedAtomInstanceCapacity:feedAtomCapacity,feedBondInstanceCapacity:feedBondCapacity,
    markerAtomInstanceCapacity:markerAtomCapacity,markerBondInstanceCapacity:markerBondCapacity,
    particleInstanceCapacity:HERO_CHAIN_BUDGET.feedCapacity,coarseGeometryVertexCapacity:vertices,coarseGeometryIndexCapacity:indices.length,
    growthTipScreenPosition:{x:0,y:0,visible:false},safeRegion:{left:0,top:0,width:0,height:0},projectedBounds:{left:0,right:0,top:0,bottom:0},
    cameraDistance:initialCameraDistance,initialCameraDistance,initialBackbonePointCount:plan.basePointCount,
    initialBackboneAtomIndices:[...anchor.backboneAtomIndices],growthEndAtomIndex:anchor.growthEndAtomIndex,anchorStart:[...plan.points[0]],anchorTip:[...plan.points[plan.basePointCount-1]],
    visiblePointCount:plan.basePointCount,centerlinePointCount:plan.baseUnitCount,actualRepeatUnitCount:plan.baseUnitCount,
    presentationUnitCount:plan.baseUnitCount,extensionUnitCapacity:plan.growthUnits,molecularChunkSizeUnits:HERO_CHAIN_BUDGET.chunkUnits,
    molecularChunkCount:plan.molecularChunks.length,backboneBondLengthWorld:plan.medianBackboneBondLength,localZigzagTurnRad:plan.medianTurnAngleRad,
    continuationTurnAngleRad:plan.continuationTurnAngleRad,maximumContinuationTurnDeviationRad:plan.maximumContinuationTurnDeviationRad,
    molecularTemplateAtomCount:chainTemplate?.atoms.length??0,molecularTemplateBondCount:chainTemplate?.bonds.length??0,
    recognizableFeedUnitProofMask:0,lastIncomingPresentationUnit:0,objectCount:0,geometryCount:0,materialCount:0,updateCount:0,incorporatedUnits:0,incorporationPulse:0,
    coarseBackboneAlignmentError:0,resourcesDisposed:false,lod:'molecular',
  };
  const resources=census(root);Object.assign(stats,resources);stats.heroChainVertexCount=stats.coarseGeometryVertexCapacity;
  const geometries=new Set(),materials=new Set();root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)materials.add(material);});
  let elapsed=0,disposed=false,cameraDistance=initialCameraDistance,lastTubeRadius=.15,lastFrame=heroGrowthFrame(0,reducedMotion,durationMultiplier,{},plan.growthUnits);

  function writeBond(mesh,index,left,right,thickness=1){
    bondDirection.subVectors(right,left);const length=bondDirection.length();
    if(length<1e-6){dummy.position.copy(left);dummy.quaternion.identity();dummy.scale.setScalar(0);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);return index+1;}
    bondMid.copy(left).add(right).multiplyScalar(.5);dummy.position.copy(bondMid);dummy.quaternion.setFromUnitVectors(yAxis,bondDirection.multiplyScalar(1/length));dummy.scale.set(thickness,length,thickness);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);return index+1;
  }

  function writeMolecule(template,targetAtoms,targetBonds,atomOffset,bondOffset,center,direction,scale,formation=1,includeBoundary=false,boundaryLeft=null,boundaryRight=null){
    if(!template){moleculeResult.atomEnd=atomOffset;moleculeResult.bondEnd=bondOffset;return moleculeResult;}
    fromAxis.set(...template.axis);toAxis.copy(direction).normalize();unitQuaternion.setFromUnitVectors(fromAxis,toAxis);
    let atomIndex=atomOffset,bondIndex=bondOffset;
    for(let atomTemplateIndex=0;atomTemplateIndex<template.atoms.length;atomTemplateIndex++){
      const atom=template.atoms[atomTemplateIndex];
      atomPosition.fromArray(atom.point).sub(axisCenter.fromArray(template.center)).multiplyScalar(scale).applyQuaternion(unitQuaternion).add(center);
      dummy.position.copy(atomPosition);dummy.quaternion.copy(unitQuaternion);dummy.scale.setScalar(modelAtomRadius(atom.element)*formation);dummy.updateMatrix();targetAtoms.setMatrixAt(atomIndex++,dummy.matrix);
    }
    for(let bondTemplateIndex=0;bondTemplateIndex<template.bonds.length;bondTemplateIndex++){
      const bond=template.bonds[bondTemplateIndex];
      atomPosition.fromArray(template.atoms[bond.a].point).sub(axisCenter.fromArray(template.center)).multiplyScalar(scale).applyQuaternion(unitQuaternion).add(center);
      bondStart.copy(atomPosition);
      atomPosition.fromArray(template.atoms[bond.b].point).sub(axisCenter.fromArray(template.center)).multiplyScalar(scale).applyQuaternion(unitQuaternion).add(center);
      bondIndex=writeBond(targetBonds,bondIndex,bondStart,atomPosition,formation);
    }
    if(includeBoundary&&boundaryLeft&&boundaryRight)bondIndex=writeBond(targetBonds,bondIndex,boundaryLeft,boundaryRight,formation);
    moleculeResult.atomEnd=atomIndex;moleculeResult.bondEnd=bondIndex;return moleculeResult;
  }

  function advance(deltaMs){
    if(disposed)return{phase:'disposed',done:true};
    const delta=Math.min(50,Math.max(0,Number.isFinite(deltaMs)?deltaMs:0));elapsed+=delta;
    heroGrowthFrame(elapsed,reducedMotion,durationMultiplier,lastFrame,plan.growthUnits);
    const visiblePointCount=visibleHeroPointCount(plan,lastFrame),tipStation=visiblePointCount-1;
    const centerlinePointCount=visibleHeroCenterlinePointCount(plan,lastFrame);
    sampleHeroPoint(plan.points,tipStation,tipSample);
    stats.phase=lastFrame.phase;stats.progress=lastFrame.progress;stats.updateCount++;stats.visiblePointCount=visiblePointCount;stats.centerlinePointCount=centerlinePointCount;
    stats.heroChainProgress=plan.baseUnitCount+lastFrame.units+lastFrame.unitProgress;
    stats.incorporatedUnits=Math.min(plan.growthUnits,lastFrame.units+(lastFrame.unitProgress>=.82?1:0));
    stats.presentationUnitCount=plan.baseUnitCount+stats.incorporatedUnits;
    stats.heroChainSegmentCount=Math.max(0,visiblePointCount-1);
    stats.cameraDistance=cameraDistance;stats.heroChainVertexCount=stats.coarseGeometryVertexCapacity;
    stats.incorporationPulse=lastFrame.unitProgress>=.82?1:0;
    tipVector.fromArray(tipSample);tipPulse.position.copy(tipVector);
    const pulse=lastFrame.phase==='anchored'?0:Math.max(0,1-(elapsed%Math.max(1,reducedMotion?180:540))/(reducedMotion?180:540));
    tipPulse.scale.setScalar(.11+pulse*.055);tipPulse.visible=lastFrame.phase!=='anchored'&&lastFrame.phase!=='long-chain-hold';tipPulse.material.opacity=.22+pulse*.35;
    return lastFrame;
  }

  function setTubeRadius(radius,visiblePointCount){
    const pointCount=Math.min(plan.centerlinePoints.length,visiblePointCount);
    if(Math.abs(radius-lastTubeRadius)<.002&&pointCount===stats.lastTubePointCount)return;
    lastTubeRadius=radius;stats.lastTubePointCount=pointCount;
    for(let pointIndex=0;pointIndex<pointCount;pointIndex++)for(let ring=0;ring<radial;ring++){
      const vertex=pointIndex*radial+ring,index=vertex*3,point=plan.centerlinePoints[pointIndex];
      positions[index]=point[0]+radialDirections[index]*radius;positions[index+1]=point[1]+radialDirections[index+1]*radius;positions[index+2]=point[2]+radialDirections[index+2]*radius;
    }
    tubeGeometry.attributes.position.needsUpdate=true;
  }

  function render(metrics=EMPTY_METRICS){
    if(disposed)return stats;
    cameraDistance=Number.isFinite(metrics.cameraDistance)?metrics.cameraDistance:cameraDistance;
    const heavyAtomDiameterPx=Number.isFinite(metrics.projectedHeavyAtomDiameterPx)?metrics.projectedHeavyAtomDiameterPx:8;
    const backboneBondLengthPx=Number.isFinite(metrics.projectedBackboneBondLengthPx)?metrics.projectedBackboneBondLengthPx:8;
    lodInput.heavyAtomDiameterPx=heavyAtomDiameterPx;lodInput.backboneBondLengthPx=backboneBondLengthPx;lodInput.previousWeight=stats.molecularLodWeight;
    const lod=screenSpaceMolecularWeight(lodInput,lodResult);
    const molecularWeight=lod.molecularWeight,coarseWeight=lod.coarseWeight;
    stats.projectedHeavyAtomDiameterPx=heavyAtomDiameterPx;stats.projectedBackboneBondLengthPx=backboneBondLengthPx;
    stats.lodReadabilityScore=lod.readabilityScore;stats.molecularLodWeight=molecularWeight;stats.coarseLodWeight=coarseWeight;
    stats.molecularLodMode=molecularWeight>.99?'molecular':molecularWeight<.01?'coarse':'transition';stats.lod=stats.molecularLodMode;
    stats.coarseBackboneAlphaMean=coarseWeight;stats.cameraDistance=cameraDistance;

    const pixelScale=Number.isFinite(metrics.localUnitsPerCssPixel)?metrics.localUnitsPerCssPixel:.025;
    const radius=clamp(POLYMER_VISUAL_AUTHORITY.coarseStrandWidthPx*pixelScale*.5,.008,POLYMER_VISUAL_AUTHORITY.coarseStrandWorldRadiusMax);
    setTubeRadius(radius,stats.centerlinePointCount);
    tubeGeometry.setDrawRange(0,Math.max(0,(stats.centerlinePointCount-1)*radial*6));
    tubeMaterial.opacity=coarseWeight;tubeMaterial.visible=coarseWeight>.001;stats.projectedStrandWidthPx=2*radius/Math.max(1e-6,pixelScale);

    const atomOpacity=molecularWeight>.02?molecularWeight:0;
    chainAtomMaterial.opacity=atomOpacity;chainBondMaterial.opacity=atomOpacity;
    chainAtomMaterial.depthWrite=atomOpacity>.99;chainBondMaterial.depthWrite=atomOpacity>.99;
    let chainAtomCount=0,chainBondCount=0,detailUnitCount=0,tipDetailAtomCount=0,tipDetailBondCount=0;
    if(chainTemplate&&atomOpacity>0){
      const completeUnits=Math.min(plan.growthUnits,lastFrame.units);
      for(let unit=0;unit<completeUnits;unit++){
        const firstStation=plan.basePointCount+unit*plan.pointsPerUnit,secondStation=firstStation+1;
        if(secondStation>=stats.visiblePointCount)break;
        sampleInto(plan.points,firstStation,pointA);sampleInto(plan.points,secondStation,pointB);
        atomCenter.copy(pointA).add(pointB).multiplyScalar(.5);toAxis.subVectors(pointB,pointA);
        const scale=toAxis.length()/chainTemplate.axisLength;
        sampleInto(plan.points,firstStation-1,pointC);
        const result=writeMolecule(chainTemplate,chainAtoms,chainBonds,chainAtomCount,chainBondCount,atomCenter,toAxis,scale,1,true,pointC,pointA);
        chainAtomCount=result.atomEnd;chainBondCount=result.bondEnd;detailUnitCount++;
        if(unit===completeUnits-1){tipDetailAtomCount=chainTemplateAtomCount;tipDetailBondCount=chainTemplateBondCount+1;}
      }
      const unit=lastFrame.units,progress=lastFrame.unitProgress;
      if(unit<plan.growthUnits&&progress>.005){
        const previousStation=plan.basePointCount-1+unit*plan.pointsPerUnit;
        sampleInto(plan.points,previousStation+progress,pointA);sampleInto(plan.points,previousStation+2*progress,pointB);sampleInto(plan.points,previousStation,pointC);
        atomCenter.copy(pointA).add(pointB).multiplyScalar(.5);toAxis.subVectors(pointB,pointA);
        const scale=toAxis.length()/chainTemplate.axisLength,formation=clamp(progress/.24,0,1);
        if(scale>1e-4&&formation>0){
          const result=writeMolecule(chainTemplate,chainAtoms,chainBonds,chainAtomCount,chainBondCount,atomCenter,toAxis,scale,formation,true,pointC,pointA);
          chainAtomCount=result.atomEnd;chainBondCount=result.bondEnd;detailUnitCount++;
          tipDetailAtomCount=Math.max(tipDetailAtomCount,chainTemplateAtomCount);tipDetailBondCount=Math.max(tipDetailBondCount,chainTemplateBondCount+1);
        }
      }
    }
    chainAtoms.count=chainAtomCount;chainBonds.count=chainBondCount;chainAtoms.instanceMatrix.needsUpdate=true;chainBonds.instanceMatrix.needsUpdate=true;
    if(chainAtoms.instanceColor)chainAtoms.instanceColor.needsUpdate=true;

    const fullFeedWeight=smoothstep((heavyAtomDiameterPx-3.5)/(4.5-3.5));
    const particleWeight=1-smoothstep((heavyAtomDiameterPx-1.5)/(2.5-1.5));
    const markerWeight=clamp(1-fullFeedWeight-particleWeight,0,1);
    feedAtomMaterial.opacity=fullFeedWeight;feedBondMaterial.opacity=fullFeedWeight;
    markerAtomMaterial.opacity=markerWeight;markerBondMaterial.opacity=markerWeight;particleMaterial.opacity=particleWeight;
    feedAtomMaterial.depthWrite=fullFeedWeight>.99;feedBondMaterial.depthWrite=fullFeedWeight>.99;
    markerAtomMaterial.depthWrite=markerWeight>.99;markerBondMaterial.depthWrite=markerWeight>.99;
    let feedAtomCount=0,feedBondCount=0,markerAtomCount=0,markerBondCount=0,particleCount=0,activeFeeds=0;
    const flightCapacity=lastFrame.phase==='recognizable-incorporation'?1:lastFrame.phase==='extension'?4:0;
    let recognizableFeedCount=0,lastIncomingPresentationUnit=0;
    for(let slot=0;slot<flightCapacity;slot++){
      const unit=lastFrame.units+slot;if(unit>=plan.growthUnits)continue;
      const startFraction=lastFrame.phase==='recognizable-incorporation'?0:slot*.2,duration=lastFrame.phase==='recognizable-incorporation'?.82:.66;
      const flightProgress=(lastFrame.unitProgress-startFraction)/duration;if(flightProgress<0||flightProgress>=1)continue;
      const t=flightProgress*(2-flightProgress);
      const targetStation=Math.min(plan.points.length-1,plan.basePointCount-1+unit*plan.pointsPerUnit);
      sampleInto(plan.points,targetStation,pointA);feedOffset.set((slot%3-1)*.42,Math.floor(slot/3)*.28,(slot%2?1:-1)*.22);
      flightSource.copy(feedOrigin).add(feedOffset);flightPoint.lerpVectors(flightSource,pointA,t);
      flightPoint.x+=Math.sin(Math.PI*t)*(slot%2?-.6:.6);flightPoint.y+=Math.sin(Math.PI*t*.7)*(slot-1.5)*.16;flightPoint.z+=Math.sin(Math.PI*t)*(slot%2?.34:-.34);
      bondDirection.subVectors(pointA,flightSource).normalize();
      if(feedTemplate&&fullFeedWeight>.001){
        const result=writeMolecule(feedTemplate,feedAtoms,feedBonds,feedAtomCount,feedBondCount,flightPoint,bondDirection,clamp(plan.targetStep/feedTemplate.axisLength,.35,.9));
        feedAtomCount=result.atomEnd;feedBondCount=result.bondEnd;
      }
      if(markerWeight>.001&&feedTemplate){
        const length=plan.targetStep*.82;bondDirection.multiplyScalar(length*.5);pointB.copy(flightPoint).sub(bondDirection);pointC.copy(flightPoint).add(bondDirection);
        dummy.position.copy(pointB);dummy.quaternion.identity();dummy.scale.setScalar(.13);dummy.updateMatrix();markers.setMatrixAt(markerAtomCount++,dummy.matrix);
        dummy.position.copy(pointC);dummy.scale.setScalar(.13);dummy.updateMatrix();markers.setMatrixAt(markerAtomCount++,dummy.matrix);
        markerBondCount=writeBond(markerBonds,markerBondCount,pointB,pointC,1);
      }
      if(particleWeight>.001&&particleCount<HERO_CHAIN_BUDGET.feedCapacity){dummy.position.copy(flightPoint);dummy.quaternion.identity();dummy.scale.setScalar(.12);dummy.updateMatrix();particles.setMatrixAt(particleCount++,dummy.matrix);}
      if(unit<HERO_CHAIN_BUDGET.recognizableFeedUnits&&fullFeedWeight>.95){recognizableFeedCount++;stats.recognizableFeedUnitProofMask|=1<<unit;}
      lastIncomingPresentationUnit=Math.max(lastIncomingPresentationUnit,plan.baseUnitCount+unit+1);
      activeFeeds++;
    }
    feedAtoms.count=feedAtomCount;feedBonds.count=feedBondCount;markers.count=markerAtomCount;markerBonds.count=markerBondCount;particles.count=particleCount;
    feedAtoms.instanceMatrix.needsUpdate=true;feedBonds.instanceMatrix.needsUpdate=true;markers.instanceMatrix.needsUpdate=true;markerBonds.instanceMatrix.needsUpdate=true;particles.instanceMatrix.needsUpdate=true;
    if(feedAtoms.instanceColor)feedAtoms.instanceColor.needsUpdate=true;if(markers.instanceColor)markers.instanceColor.needsUpdate=true;
    stats.feedFullMoleculeWeight=fullFeedWeight;stats.feedRepeatMarkerWeight=markerWeight;stats.feedParticleWeight=particleWeight;
    stats.feedVisualActiveCount=activeFeeds;stats.recognizableFeedUnitCount=recognizableFeedCount;
    stats.lastIncomingPresentationUnit=lastIncomingPresentationUnit;
    stats.molecularDetailUnitCount=atomOpacity>0?plan.baseUnitCount+detailUnitCount:0;stats.molecularAtomInstanceCount=chainAtomCount;stats.molecularBondInstanceCount=chainBondCount;
    stats.tipDetailAtomCount=molecularWeight>.05?tipDetailAtomCount:0;stats.tipDetailBondCount=molecularWeight>.05?tipDetailBondCount:0;
    stats.coarseBackboneAlignmentError=0;stats.objectCount=resources.objectCount;stats.geometryCount=resources.geometryCount;stats.materialCount=resources.materialCount;
    return stats;
  }

  function update(deltaMs,metrics=EMPTY_METRICS){const frame=advance(deltaMs);render(metrics);return frame;}
  function visiblePoints(){return plan.points.slice(0,stats.visiblePointCount);}
  function detailOpacityForStation(){return stats.molecularLodWeight;}
  function dispose(){
    if(disposed)return;disposed=true;root.removeFromParent();
    for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();root.clear();
    stats.active=false;stats.objectCount=0;stats.geometryCount=0;stats.materialCount=0;stats.feedVisualActiveCount=0;
    stats.molecularAtomInstanceCount=0;stats.molecularBondInstanceCount=0;stats.resourcesDisposed=true;
  }
  return{root,plan,anchor,stats,feedOrigin,advance,render,update,visiblePoints,detailOpacityForStation,dispose};
}
