import {createHeroChainPlan, heroGrowthFrame, HERO_CHAIN_BUDGET, sampleHeroPoint, visibleHeroPointCount} from './polymer-growth-plan.js?v=1';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

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
  let axis=[1,0,0],span=1;
  for(let a=0;a<carbons.length;a++)for(let b=a+1;b<carbons.length;b++){
    const delta=carbons[b].point.map((value,index)=>value-carbons[a].point[index]),length=Math.hypot(...delta);
    if(length>span*.99){span=length;axis=delta.map(value=>value/length);}
  }
  return{atoms,bonds,axis};
}

function asVector(THREE,point){return new THREE.Vector3(point[0],point[1],point[2]);}

/**
 * Presentation-only PE scale-up. Its first tube samples are the actual rendered
 * finite fragment's carbon backbone; the same bounded tube continues from its
 * active end. It never creates molecule instances or modifies chemistry.
 */
export function createPolymerCinematic({THREE,polymerId,anchor,sourceRecords=[],sampleId='polymer-sample',reducedMotion=false,durationMultiplier=1,viewPlane=null}){
  if(polymerId!=='polyethylene')throw new Error('Hero-chain continuity is currently enabled for polyethylene only.');
  const plan=createHeroChainPlan({polymerId,anchor,seed:sampleId,viewPlane}),root=new THREE.Group();root.name='polymer-hero-chain-presentation';
  const radial=HERO_CHAIN_BUDGET.radialSegments,vertices=plan.points.length*radial,positions=new Float32Array(vertices*3),colors=new Float32Array(vertices*4),indices=[];
  const center=asVector(THREE,[0,0,0]),tangent=new THREE.Vector3(),reference=new THREE.Vector3(),side=new THREE.Vector3(),up=new THREE.Vector3();
  const pathVectors=plan.points.map(point=>asVector(THREE,point));
  for(let i=0;i<pathVectors.length;i++){
    tangent.subVectors(pathVectors[Math.min(i+1,pathVectors.length-1)],pathVectors[Math.max(0,i-1)]).normalize();
    reference.set(Math.abs(tangent.dot(new THREE.Vector3(0,1,0)))<.88?0:0,Math.abs(tangent.dot(new THREE.Vector3(0,1,0)))<.88?1:0,Math.abs(tangent.dot(new THREE.Vector3(0,1,0)))<.88?0:1);
    side.crossVectors(tangent,reference).normalize();up.crossVectors(tangent,side).normalize();
    const radius=.078;
    for(let j=0;j<radial;j++){
      const angle=j/radial*Math.PI*2,index=(i*radial+j)*3;
      positions[index]=pathVectors[i].x+radius*(side.x*Math.cos(angle)+up.x*Math.sin(angle));
      positions[index+1]=pathVectors[i].y+radius*(side.y*Math.cos(angle)+up.y*Math.sin(angle));
      positions[index+2]=pathVectors[i].z+radius*(side.z*Math.cos(angle)+up.z*Math.sin(angle));
      const colorIndex=(i*radial+j)*4;colors[colorIndex]=.545;colors[colorIndex+1]=.847;colors[colorIndex+2]=.824;colors[colorIndex+3]=0;
      if(i<pathVectors.length-1){const a=i*radial+j,b=i*radial+(j+1)%radial,c=a+radial,d=b+radial;indices.push(a,b,c,b,d,c);}
    }
  }
  const tubeGeometry=new THREE.BufferGeometry();tubeGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));tubeGeometry.setAttribute('color',new THREE.BufferAttribute(colors,4));tubeGeometry.setIndex(indices);tubeGeometry.computeVertexNormals();tubeGeometry.setDrawRange(0,0);
  const tubeMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',emissive:'#113b43',roughness:.52,metalness:.06,transparent:true,vertexColors:true,opacity:.94});
  const tube=new THREE.Mesh(tubeGeometry,tubeMaterial);tube.name='continuous-polymer-backbone';root.add(tube);

  const firstRecord=sourceRecords[0],template=makeTemplate(firstRecord),feedCapacity=HERO_CHAIN_BUDGET.feedCapacity,detailCapacity=HERO_CHAIN_BUDGET.detailWindowUnits;
  const atomCapacity=Math.max(1,template?.atoms.length??0)*(feedCapacity+detailCapacity),bondCapacity=Math.max(1,template?.bonds.length??0)*(feedCapacity+detailCapacity);
  const sphereGeometry=new THREE.SphereGeometry(1,8,6),atomMaterial=new THREE.MeshStandardMaterial({color:'#e9f6ff',roughness:.43,metalness:.02,vertexColors:true,transparent:true});
  const atoms=new THREE.InstancedMesh(sphereGeometry,atomMaterial,atomCapacity);atoms.name='bounded-polymer-detail-and-feed-atoms';atoms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);atoms.frustumCulled=false;root.add(atoms);
  const bondGeometry=new THREE.CylinderGeometry(.035,.035,1,5),bondMaterial=new THREE.MeshStandardMaterial({color:'#c1d7df',roughness:.5,transparent:true});
  const bonds=new THREE.InstancedMesh(bondGeometry,bondMaterial,bondCapacity);bonds.name='bounded-polymer-detail-and-feed-bonds';bonds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);bonds.frustumCulled=false;root.add(bonds);
  const particleGeometry=new THREE.SphereGeometry(1,7,5),particleMaterial=new THREE.MeshStandardMaterial({color:'#cde5ed',emissive:'#1e4e5c',roughness:.5,transparent:true});
  const particles=new THREE.InstancedMesh(particleGeometry,particleMaterial,feedCapacity);particles.name='bounded-polymer-feed-lod';particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);particles.frustumCulled=false;root.add(particles);
  const pulseGeometry=new THREE.SphereGeometry(1,10,7),pulseMaterial=new THREE.MeshBasicMaterial({color:'#a7f0df',transparent:true,opacity:.48,depthWrite:false});
  const tipPulse=new THREE.Mesh(pulseGeometry,pulseMaterial);tipPulse.name='polymer-growth-tip-anchor';root.add(tipPulse);

  const dummy=new THREE.Object3D(),color=new THREE.Color(),yAxis=new THREE.Vector3(0,1,0),fromAxis=new THREE.Vector3(),toAxis=new THREE.Vector3(),atomPosition=new THREE.Vector3(),bondDirection=new THREE.Vector3(),bondMid=new THREE.Vector3(),unitQuaternion=new THREE.Quaternion(),flightPoint=new THREE.Vector3(),feedOrigin=new THREE.Vector3(-4,3.5,0);
  const sourceElementColors={C:'#c7d6e1',H:'#f2f8fb',O:'#f18177',N:'#8caeff',Cl:'#85cd91',S:'#f0c66f',P:'#f09a59',F:'#a5da9e'};
  const initialCameraDistance=15,stats={active:true,phase:'anchored',progress:0,heroChainId:sampleId,heroChainProgress:0,heroChainSegmentCount:0,heroChainVertexCount:0,coarseBackboneAlphaMean:0,feedVisualActiveCount:0,feedVisualCapacity:feedCapacity,recognizableFeedUnitCount:0,growthTipScreenPosition:null,cameraDistance:initialCameraDistance,highDetailWindowStart:0,highDetailWindowEnd:0,initialBackbonePointCount:plan.basePointCount,initialBackboneAtomIndices:[...anchor.backboneAtomIndices],growthEndAtomIndex:anchor.growthEndAtomIndex,anchorStart:[...plan.points[0]],anchorTip:[...plan.points[plan.basePointCount-1]],visiblePointCount:plan.basePointCount,objectCount:0,geometryCount:0,materialCount:0,updateCount:0,incorporatedUnits:0,incorporationPulse:0,lod:'molecular'};
  const objects=[],geometries=new Set(),materials=new Set();root.traverse(object=>{objects.push(object);if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
  stats.objectCount=objects.length;stats.geometryCount=geometries.size;stats.materialCount=materials.size;stats.heroChainVertexCount=stats.visiblePointCount*radial;
  let elapsed=0,disposed=false,cameraDistance=initialCameraDistance;

  function matrixForMolecule({template:sourceTemplate,centerPoint,direction,scale=.5,opacity=1,atomLimit=sourceTemplate?.atoms.length??0,bondLimit=sourceTemplate?.bonds.length??0,atomStart=0,bondStart=0}){
    if(!sourceTemplate)return{atomCount:atomStart,bondCount:bondStart};
    fromAxis.set(...sourceTemplate.axis);toAxis.copy(direction).normalize();unitQuaternion.setFromUnitVectors(fromAxis,toAxis);
    let atomCount=atomStart,bondCount=bondStart;
    for(let index=0;index<Math.min(atomLimit,sourceTemplate.atoms.length)&&atomCount<atomCapacity;index++){
      const atom=sourceTemplate.atoms[index],position=atomPosition.fromArray(atom.point).multiplyScalar(scale).applyQuaternion(unitQuaternion).add(centerPoint);
      const radius=atom.element==='H'?.105:.17;dummy.position.copy(position);dummy.quaternion.copy(unitQuaternion);dummy.scale.setScalar(radius*opacity);dummy.updateMatrix();atoms.setMatrixAt(atomCount,dummy.matrix);
      color.set(sourceElementColors[atom.element]??'#c7d6e1');atoms.setColorAt(atomCount,color);atomCount++;
    }
    for(let index=0;index<Math.min(bondLimit,sourceTemplate.bonds.length)&&bondCount<bondCapacity;index++){
      const bond=sourceTemplate.bonds[index],a=sourceTemplate.atoms[bond.a],b=sourceTemplate.atoms[bond.b];
      const pa=atomPosition.fromArray(a.point).multiplyScalar(scale).applyQuaternion(unitQuaternion).add(centerPoint),pb=atomPosition.fromArray(b.point).multiplyScalar(scale).applyQuaternion(unitQuaternion).add(centerPoint);
      bondDirection.subVectors(pb,pa);const length=bondDirection.length();if(length<1e-5)continue;
      bondMid.copy(pa).add(pb).multiplyScalar(.5);dummy.position.copy(bondMid);dummy.quaternion.setFromUnitVectors(yAxis,bondDirection.normalize());dummy.scale.set(1,length,1);dummy.updateMatrix();bonds.setMatrixAt(bondCount,dummy.matrix);bondCount++;
    }
    return{atomCount,bondCount};
  }

  function update(deltaMs,{cameraDistance:nextDistance=cameraDistance}={}){
    if(disposed)return{phase:'disposed',done:true};
    elapsed+=Math.min(50,Math.max(0,Number.isFinite(deltaMs)?deltaMs:0));cameraDistance=nextDistance;
    const frame=heroGrowthFrame(elapsed,reducedMotion,durationMultiplier),visiblePointCount=visibleHeroPointCount(plan,frame),tipStation=visiblePointCount-1,tip=sampleHeroPoint(plan.points,tipStation),recognizable=frame.units<HERO_CHAIN_BUDGET.recognizableFeedUnits;
    stats.phase=frame.phase;stats.progress=frame.progress;stats.updateCount++;stats.visiblePointCount=visiblePointCount;stats.heroChainProgress=frame.units+frame.unitProgress;stats.incorporatedUnits=Math.min(plan.growthUnits,frame.units+(frame.unitProgress>=.82?1:0));stats.heroChainSegmentCount=Math.max(0,visiblePointCount-1);stats.heroChainVertexCount=visiblePointCount*radial;stats.highDetailWindowEnd=tipStation;stats.highDetailWindowStart=Math.max(0,tipStation-HERO_CHAIN_BUDGET.detailWindowUnits*HERO_CHAIN_BUDGET.pointsPerUnit);stats.cameraDistance=cameraDistance;stats.lod=cameraDistance>initialCameraDistance*1.5?'particle':cameraDistance>initialCameraDistance*1.2?'simplified':'molecular';
    tubeGeometry.setDrawRange(0,Math.max(0,(visiblePointCount-1)*radial*6));
    let alphaSum=0;
    for(let station=0;station<visiblePointCount;station++){
      const age=tipStation-station,alpha=station<plan.basePointCount?1-detailOpacityForStation(station):clamp(age/(HERO_CHAIN_BUDGET.pointsPerUnit*2),.12,1);
      for(let ring=0;ring<radial;ring++){const colorIndex=(station*radial+ring)*4+3;colors[colorIndex]=alpha;alphaSum+=alpha;}
    }
    tubeGeometry.attributes.color.needsUpdate=true;stats.coarseBackboneAlphaMean=alphaSum/Math.max(1,visiblePointCount*radial);
    const tipVector=asVector(THREE,tip);tipPulse.position.copy(tipVector);const pulse=frame.phase==='anchored'?0:Math.max(0,1-(elapsed%Math.max(1,reducedMotion?180:540))/(reducedMotion?180:540));tipPulse.scale.setScalar(.11+pulse*.055);tipPulse.visible=frame.phase!=='anchored'&&frame.phase!=='long-chain-hold';tipPulse.material.opacity=.22+pulse*.35;
    let atomCount=0,bondCount=0,particleCount=0,activeFeeds=0,tipDetailAtomCount=0,tipDetailBondCount=0;
    const totalUnits=frame.units+frame.unitProgress,currentUnit=Math.min(plan.growthUnits-1,Math.floor(totalUnits));
    // The newest two incorporated repeat units retain molecular detail at the tip.
    if(template&&visiblePointCount>plan.basePointCount){
      for(let slot=0;slot<detailCapacity;slot++){
        const unit=currentUnit-slot;if(unit<0)continue;
        const start=plan.basePointCount+unit*plan.pointsPerUnit,end=Math.min(visiblePointCount-1,start+plan.pointsPerUnit);
        if(end<=start)continue;
        const a=asVector(THREE,sampleHeroPoint(plan.points,start)),b=asVector(THREE,sampleHeroPoint(plan.points,end)),centerPoint=a.clone().add(b).multiplyScalar(.5),direction=b.sub(a);
        const opacity=frame.phase==='long-chain-hold'?1:clamp((frame.unitProgress>.82?1:(frame.unitProgress+.15)),.45,1);
        const result=matrixForMolecule({template,centerPoint,direction,opacity,atomStart:atomCount,bondStart:bondCount});tipDetailAtomCount+=result.atomCount-atomCount;tipDetailBondCount+=result.bondCount-bondCount;atomCount=result.atomCount;bondCount=result.bondCount;
      }
    }
    const feedStart=asVector(THREE,feedOrigin),flightCapacity=frame.phase==='recognizable-incorporation'?1:4;
    for(let slot=0;slot<flightCapacity;slot++){
      const unit=frame.units+slot;if(unit>=plan.growthUnits)continue;
      const startFraction=frame.phase==='recognizable-incorporation'?0:slot*.2,duration=frame.phase==='recognizable-incorporation'?.82:.66;
      const flightProgress=(frame.unitProgress-startFraction)/duration;if(flightProgress<0||flightProgress>=1)continue;
      const t=flightProgress*(2-flightProgress),targetStation=Math.min(plan.points.length-1,plan.basePointCount-1+unit*plan.pointsPerUnit),targetPoint=asVector(THREE,sampleHeroPoint(plan.points,targetStation));
      const source=feedStart.clone().add(new THREE.Vector3((slot%3-1)*.42,Math.floor(slot/3)*.28,(slot%2?1:-1)*.22));
      flightPoint.lerpVectors(source,targetPoint,t);flightPoint.x+=Math.sin(Math.PI*t)*(slot%2?-.6:.6);flightPoint.y+=Math.sin(Math.PI*t*.7)*(slot-1.5)*.16;flightPoint.z+=Math.sin(Math.PI*t)*(slot%2?.34:-.34);
      const direction=targetPoint.clone().sub(source).normalize(),simple=cameraDistance>initialCameraDistance*1.5||(!recognizable&&cameraDistance>initialCameraDistance*1.2);
      if(template&&!simple){const atomLimit=recognizable?template.atoms.length:Math.min(template.atoms.length,2),bondLimit=recognizable?template.bonds.length:Math.min(template.bonds.length,1);const result=matrixForMolecule({template,centerPoint:flightPoint,direction,opacity:1,atomLimit,bondLimit,atomStart:atomCount,bondStart:bondCount});atomCount=result.atomCount;bondCount=result.bondCount;}
      else if(particleCount<feedCapacity){dummy.position.copy(flightPoint);dummy.quaternion.identity();dummy.scale.setScalar(simple ? .082 : .105);dummy.updateMatrix();particles.setMatrixAt(particleCount++,dummy.matrix);}
      activeFeeds++;
    }
    atoms.count=atomCount;bonds.count=bondCount;particles.count=particleCount;atoms.instanceMatrix.needsUpdate=true;bonds.instanceMatrix.needsUpdate=true;particles.instanceMatrix.needsUpdate=true;
    if(atoms.instanceColor)atoms.instanceColor.needsUpdate=true;
    stats.feedVisualActiveCount=activeFeeds;stats.recognizableFeedUnitCount=recognizable?activeFeeds:0;stats.tipDetailAtomCount=tipDetailAtomCount;stats.tipDetailBondCount=tipDetailBondCount;stats.incorporationPulse=frame.unitProgress>=.82?1:0;
    return{...frame,visiblePointCount,tipStation,tipPosition:tip,atomOpacity:1-detailCapacity};
  }
  function detailOpacityForStation(station){
    if(stats.phase==='anchored'||stats.incorporatedUnits===0)return 1;
    const delta=stats.highDetailWindowEnd-station,keep=HERO_CHAIN_BUDGET.detailWindowUnits*HERO_CHAIN_BUDGET.pointsPerUnit;
    if(delta<=keep)return 1;
    return clamp(1-(delta-keep)/(HERO_CHAIN_BUDGET.pointsPerUnit*4),0,1);
  }
  function visiblePoints(){return plan.points.slice(0,stats.visiblePointCount);}
  function dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();root.clear();stats.active=false;stats.objectCount=0;stats.geometryCount=0;stats.materialCount=0;stats.feedVisualActiveCount=0;}
  return{root,plan,anchor,stats,feedOrigin,update,visiblePoints,detailOpacityForStation,dispose};
}
