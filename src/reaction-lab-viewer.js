import { createPreviewModel } from './preview-model.js?v=32';
import { ELEMENTS, modelAtomRadius } from './chemistry.js?v=20';
import {
  planVisiblePopulation, reactionCandidates, planReactionExecution, resolveCandidateInstanceIds,
  createContactMatcher,
  CONTACT_DWELL_MS,
} from './reaction-lab-core.js?v=7';
import {
  REACTION_LAB_WORLD_UNITS_PER_ANGSTROM, STAGE_A_GAME_STEP_SECONDS,
  STAGE_A_MAX_CATCH_UP_STEPS, STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,
  createFixedStepAccumulator, createStageABody, evaluateStageAForces,
  integrateStageA, rigidBodyMassProperties, stageABodySnapshot,
} from './reaction-lab-stage-a.js?v=2';
import { STAGE_B_TEST_QA_E, createStageBVirtualSites, detectCarbonylAnisotropySites, evaluateStageBForces, integrateStageB, stageBCarbonylDiagnostics } from './reaction-lab-stage-b.js?v=2';
import {
  chooseDepthTarget, CHAMBER_TIME_MODES, createChamberTimeAuthority,
  DEPTH_DOCKING_TIME_CONSTANT_MS, DEPTH_TARGET_ACQUIRE_PADDING_PX,
  DEPTH_TARGET_RELEASE_PADDING_PX, GRAB_FALLBACK_RADIUS_PX,
  MAX_DOCKING_COMPRESSION_WORLD, minimumMoleculeSurfaceGap, projectedSurfaceGap,
  scaleSimulationElapsed, solveDepthDocking,
} from './reaction-lab-manipulation.js?v=2';

const vector=(THREE,point)=>Array.isArray(point)?new THREE.Vector3(point[0],point[1],point[2]):new THREE.Vector3(point.x,point.y,point.z);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const FIXED_CAMERA_AZIMUTH=0;
const FIXED_CAMERA_ELEVATION=0;
const CHAMBER_PRESENTATION_MS=520;

export function createReactionLabViewer({THREE,dialog,root,records,collectionState,onDialogStateChange=()=>{},onPointerLockChange=()=>{}}){
  const query=new URLSearchParams(location.search);
  const localhostPhysicsTest=query.get('reactionLabTest')==='1'&&['localhost','127.0.0.1'].includes(location.hostname);
  const stageAPhysicsEnabled=localhostPhysicsTest&&query.get('reactionLabPhysics')==='stage-a';
  // RL-NB6 evidence passed every physical and fixed-step performance gate.
  // Stage B is now the production authority; Stage A remains an explicit local probe.
  const stageBPhysicsEnabled=!stageAPhysicsEnabled;
  const stageBChargeE=STAGE_B_TEST_QA_E;
  const canvas=root.querySelector('canvas');
  const status=root.querySelector('[data-lab-status]');
  const slots=[...root.querySelectorAll('[data-lab-slot]')];
  const recordsById=new Map(records.map(record=>[record.id,record]));
  const scene=new THREE.Scene();scene.background=new THREE.Color('#0a1724');
  const camera=new THREE.PerspectiveCamera(42,1,.1,100);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene.add(new THREE.HemisphereLight(0xd9efff,0x162231,2.2));
  const keyLight=new THREE.DirectionalLight(0xffffff,3);keyLight.position.set(3,6,7);scene.add(keyLight);
  const world=new THREE.Group();scene.add(world);

  let slotValues=['','',''],instances=[],selected=null,down=null,testIsolation=null,reactionContactPairs=new Set();
  let distance=15,last=performance.now(),disposed=false,reactionAnimation=null,simulationClockSeconds=0;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const contactMatcher=createContactMatcher();
  let instanceSequence=0,stageAForces={bodies:new Map(),pairDiagnostics:[],overlapGuardActivationCount:0},stageAPerformance={lastPhysicsDurationMs:0,lastInteractionPairCount:0,lastFrameStepCount:0,lastDroppedGameSeconds:0,fixedSteps:0};
  const activePointers=new Map();
  const chamberTime=createChamberTimeAuthority(),isManipulating=()=>chamberTime.mode===CHAMBER_TIME_MODES.MANIPULATING;
  let pinchActive=false,pinchDistance=0,depthTarget=null,depthDockingState='none',pointerAnchorErrorPx=0;
  const chamber=root.querySelector('.reaction-lab-space');
  let targetIndicator=root.querySelector('[data-depth-target-indicator]');
  if(!targetIndicator){targetIndicator=document.createElement('div');targetIndicator.className='reaction-lab-target-indicator';targetIndicator.dataset.depthTargetIndicator='';targetIndicator.setAttribute('aria-hidden','true');targetIndicator.hidden=true;chamber.append(targetIndicator);}

  function resize(){const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);resize();
  function updateCamera(){camera.position.set(distance*Math.sin(FIXED_CAMERA_AZIMUTH)*Math.cos(FIXED_CAMERA_ELEVATION),distance*Math.sin(FIXED_CAMERA_ELEVATION),distance*Math.cos(FIXED_CAMERA_AZIMUTH)*Math.cos(FIXED_CAMERA_ELEVATION));camera.lookAt(0,0,0);camera.updateMatrixWorld();}
  function cameraNormal(){camera.updateMatrixWorld();return camera.getWorldDirection(new THREE.Vector3());}
  function cameraRight(){camera.updateMatrixWorld();return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).normalize();}
  function cameraUp(){camera.updateMatrixWorld();return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1).normalize();}
  function rayForEvent(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);}
  function atomWorld(item,index){const atom=item.record.atoms[index];return item.group.localToWorld(vector(THREE,atom.point));}
  function projectPoint(point){camera.updateMatrixWorld();const projected=point.clone().project(camera),rect=canvas.getBoundingClientRect();return{x:rect.left+(projected.x+1)*.5*rect.width,y:rect.top+(1-projected.y)*.5*rect.height,z:projected.z};}
  function viewDepth(point){return point.clone().sub(camera.position).dot(cameraNormal());}
  function projectedAtoms(item){
    item.group.updateMatrixWorld(true);const rect=canvas.getBoundingClientRect(),forward=cameraNormal();
    return item.record.atoms.map(atom=>{
      const worldPoint=item.group.localToWorld(vector(THREE,atom.point)),depth=worldPoint.clone().sub(camera.position).dot(forward),projected=projectPoint(worldPoint);
      if(depth<=camera.near||depth>=camera.far||projected.z < -1||projected.z > 1)return null;
      const radiusPx=modelAtomRadius(atom.element)*rect.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*depth);
      return{x:projected.x,y:projected.y,radiusPx,depth};
    }).filter(Boolean);
  }
  function shapeFor(item,center=item.group.position){return{center:center.toArray(),orientation:[item.group.quaternion.x,item.group.quaternion.y,item.group.quaternion.z,item.group.quaternion.w],atoms:item.record.atoms.map(atom=>({position:atom.point.toArray(),radius:modelAtomRadius(atom.element)}))};}
  function clearDepthTarget(){depthTarget=null;depthDockingState='none';pointerAnchorErrorPx=0;targetIndicator.hidden=true;}
  function endManipulation(){
    const item=selected;
    if(item){syncStageABodyFromGroup(item);item.stageBody.velocityAngstromPerPs=[0,0,0];}
    selected=null;down=null;chamberTime.setMode(CHAMBER_TIME_MODES.NORMAL);clearDepthTarget();
  }
  function instanceById(id){return instances.find(item=>item.id===id)??null;}
  function clear(){endManipulation();for(const item of instances){world.remove(item.group);item.group.traverse(object=>{object.geometry?.dispose?.();object.material?.dispose?.();});}instances=[];contactMatcher.reset();reactionContactPairs.clear();testIsolation=null;}

  function createInstance(record,position){
    const preview=createPreviewModel(THREE,record);for(let index=0;index<190;index++)preview.step();
    const model=preview.snapshot(),group=new THREE.Group(),id=`${record.id}-${++instanceSequence}`;
    if(!record.nonbonded)throw new Error(`Canonical nonbonded data is required for ${record.id}.`);
    const massProperties=rigidBodyMassProperties(model.atoms.map(atom=>({element:atom.element,positionAngstrom:atom.point.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)})));
    const renderAtoms=model.atoms.map((atom,index)=>({...atom,point:vector(THREE,massProperties.centeredPositionsAngstrom[index].map(value=>value*REACTION_LAB_WORLD_UNITS_PER_ANGSTROM))}));
    group.position.copy(position);
    for(const atom of renderAtoms){const geometry=new THREE.SphereGeometry(modelAtomRadius(atom.element),16,12),material=new THREE.MeshStandardMaterial({color:ELEMENTS[atom.element]?.color??'#cbd5e1',roughness:.32,metalness:.08}),mesh=new THREE.Mesh(geometry,material);mesh.position.copy(atom.point);mesh.userData.atomIndex=atom.id;group.add(mesh);}
    for(const bond of model.bonds){const a=vector(THREE,renderAtoms[bond.a].point),b=vector(THREE,renderAtoms[bond.b].point),direction=b.clone().sub(a),length=direction.length(),geometry=new THREE.CylinderGeometry(.055,.055,length,8),material=new THREE.MeshStandardMaterial({color:'#c3d2dc',roughness:.6}),mesh=new THREE.Mesh(geometry,material);mesh.position.copy(a.add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());group.add(mesh);}
    world.add(group);
    const item={id,species:record.id,record:{...record,atoms:renderAtoms,bonds:model.bonds},group,busy:false};
    item.stageBody=createStageABody({id,positionAngstrom:position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM),orientation:[group.quaternion.x,group.quaternion.y,group.quaternion.z,group.quaternion.w],atoms:renderAtoms.map((atom,index)=>({element:atom.element,chargeE:record.nonbonded.atomicChargesE[index],sigmaAngstrom:record.nonbonded.sigmaAngstrom[index],epsilonKcalMol:record.nonbonded.epsilonKcalMol[index],positionAngstrom:atom.point.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)})),virtualChargeSites:record.nonbonded.virtualChargeSites.map(site=>({chargeE:site.chargeE,positionAngstrom:site.positionAngstromAngstrom??site.positionAngstrom})),massProperties});
    if(stageBPhysicsEnabled){
      const geometryAtoms=renderAtoms.map(atom=>({element:atom.element,positionAngstrom:atom.point.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)}));
      item.stageBody.carbonylAnisotropySites=detectCarbonylAnisotropySites(geometryAtoms,record.bonds,{qA:stageBChargeE});
      item.stageBody.stageBVirtualChargeSites=createStageBVirtualSites(geometryAtoms,record.bonds,{qA:stageBChargeE});
    }else{item.stageBody.carbonylAnisotropySites=[];item.stageBody.stageBVirtualChargeSites=[];}
    instances.push(item);return item;
  }

  function renderSlotOptions(){
    const discovered=records.filter(record=>collectionState.hasMolecule(record.id));
    slots.forEach((select,index)=>{const previous=slotValues[index];select.replaceChildren(new Option('空のslot',''));for(const record of discovered){if(slotValues.includes(record.id)&&record.id!==previous)continue;select.add(new Option(record.nameJa??record.id,record.id));}select.value=previous;});
  }
  function repopulate(){
    clear();const selectedCount=slotValues.filter(Boolean).length,planned=planVisiblePopulation(slotValues),groupCounts=new Map();
    for(const entry of planned){
      const record=recordsById.get(entry.species);if(!record)continue;
      const same=planned.filter(item=>item.species===entry.species).length,offset=groupCounts.get(entry.species)??0;groupCounts.set(entry.species,offset+1);
      const speciesIndex=slotValues.filter(Boolean).indexOf(entry.species),angle=2*Math.PI*offset/same,radius=2.05;
      const originX=selectedCount===1?0:(speciesIndex-(selectedCount-1)/2)*1.5;
      const x=selectedCount===1?originX+radius*Math.cos(angle):originX+(offset%2 ? .32 : -.32),y=selectedCount===1?radius*Math.sin(angle):(offset%2 ? .78 : -.78);
      createInstance(record,new THREE.Vector3(x,y,0));
    }
    fitPopulation();
    renderSlotOptions();status.textContent=instances.length?`${instances.length} 個の分子があります。ドラッグして近づけると、奥行きを自動で調整します。`:'空のslotから分子を選んでください。';
  }
  function fitPopulation(){
    if(!instances.length)return;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const item of instances)for(const atom of item.record.atoms){const radius=modelAtomRadius(atom.element),point=atom.point.clone().add(item.group.position);minX=Math.min(minX,point.x-radius);maxX=Math.max(maxX,point.x+radius);minY=Math.min(minY,point.y-radius);maxY=Math.max(maxY,point.y+radius);}
    const rect=canvas.getBoundingClientRect(),aspect=Math.max(.1,rect.width/Math.max(1,rect.height)),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)),required=Math.max((maxX-minX)/(2*tan*aspect*.88),(maxY-minY)/(2*tan*.88));
    distance=clamp(Math.max(15,required),7,24);updateCamera();
  }
  slots.forEach((select,index)=>select.addEventListener('change',()=>{const proposed=slotValues.slice();proposed[index]=select.value;if(new Set(proposed.filter(Boolean)).size!==proposed.filter(Boolean).length){select.value=slotValues[index];status.textContent='同じspeciesは複数slotへ設定できません。';return;}slotValues=proposed;repopulate();}));
  function raycastAtoms(event){
    rayForEvent(event);
    const hits=raycaster.intersectObjects(instances.filter(item=>!item.busy).map(item=>item.group),true)
      .filter(hit=>Number.isInteger(hit.object.userData.atomIndex));
    const rows=hits.map(hit=>{
      let group=hit.object;while(group&&group.parent!==world)group=group.parent;
      return{item:instances.find(item=>item.group===group)??null,point:hit.point.clone(),distance:hit.distance};
    }).filter(hit=>hit.item).sort((a,b)=>a.distance-b.distance||a.item.id.localeCompare(b.item.id));
    return rows[0]??null;
  }
  function fallbackGrab(event){
    const rows=instances.filter(item=>!item.busy).map(item=>{
      const atoms=projectedAtoms(item),surfaceGap=Math.min(...atoms.map(atom=>Math.hypot(atom.x-event.clientX,atom.y-event.clientY)-atom.radiusPx));
      return{item,atoms,surfaceGap,depth:Math.min(...atoms.map(atom=>atom.depth))};
    }).filter(row=>row.atoms.length&&row.surfaceGap<=GRAB_FALLBACK_RADIUS_PX)
      .sort((a,b)=>a.surfaceGap-b.surfaceGap||a.depth-b.depth||a.item.id.localeCompare(b.item.id));
    if(!rows.length)return null;
    const item=rows[0].item,plane=new THREE.Plane().setFromNormalAndCoplanarPoint(cameraNormal(),item.group.position);
    rayForEvent(event);const point=raycaster.ray.intersectPlane(plane,new THREE.Vector3());
    return point?{item,point,distance:Infinity}:null;
  }
  function positionOnMovePlane(event,gesture){rayForEvent(event);return raycaster.ray.intersectPlane(gesture.plane,new THREE.Vector3());}
  function pointerPlanePoint(x,y,gesture){return positionOnMovePlane({clientX:x,clientY:y},gesture);}
  function correctPointerAnchor(item,localAnchor,x,y){
    const rect=canvas.getBoundingClientRect();if(rect.height<=0)return Infinity;
    for(let attempt=0;attempt<2;attempt++){
      item.group.updateMatrixWorld(true);
      const projected=projectPoint(item.group.localToWorld(localAnchor.clone())),errorX=x-projected.x,errorY=y-projected.y;
      pointerAnchorErrorPx=Math.hypot(errorX,errorY);if(pointerAnchorErrorPx<.25)break;
      const depth=viewDepth(item.group.localToWorld(localAnchor.clone())),worldPerPixel=2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/rect.height;
      item.group.position.addScaledVector(cameraRight(),errorX*worldPerPixel);
      item.group.position.addScaledVector(cameraUp(),-errorY*worldPerPixel);
    }
    item.group.updateMatrixWorld(true);
    const projected=projectPoint(item.group.localToWorld(localAnchor.clone()));pointerAnchorErrorPx=Math.hypot(x-projected.x,y-projected.y);
    return pointerAnchorErrorPx;
  }
  function updateTargetIndicator(item){
    if(!item){targetIndicator.hidden=true;return;}
    const atoms=projectedAtoms(item);if(!atoms.length){targetIndicator.hidden=true;return;}
    const rect=chamber.getBoundingClientRect(),left=Math.min(...atoms.map(atom=>atom.x-atom.radiusPx)),right=Math.max(...atoms.map(atom=>atom.x+atom.radiusPx)),top=Math.min(...atoms.map(atom=>atom.y-atom.radiusPx)),bottom=Math.max(...atoms.map(atom=>atom.y+atom.radiusPx));
    const diameter=Math.max(36,Math.hypot(right-left,bottom-top)+14);
    targetIndicator.style.left=`${(left+right)*.5-rect.left}px`;targetIndicator.style.top=`${(top+bottom)*.5-rect.top}px`;
    targetIndicator.style.width=`${diameter}px`;targetIndicator.style.height=`${diameter}px`;targetIndicator.hidden=false;
  }
  function projectedTargetRows(dragged){
    const moving=projectedAtoms(dragged),candidates=[];
    for(const item of instances){if(item===dragged||item.busy)continue;const atoms=projectedAtoms(item);if(!atoms.length)continue;candidates.push({id:item.id,gapPx:projectedSurfaceGap(moving,atoms),busy:item.busy,present:instances.includes(item)});}
    return candidates;
  }
  function updateManipulation(elapsedMs){
    if(!isManipulating()||!selected||!down||selected.busy){updateTargetIndicator(null);return;}
    const item=selected,point=pointerPlanePoint(down.clientX,down.clientY,down);if(!point)return;
    const previousCenter=item.group.position.clone(),normal=cameraNormal(),anchorOffset=down.localAnchor.clone().applyQuaternion(item.group.quaternion);
    const baseCenter=point.sub(anchorOffset);baseCenter.addScaledVector(normal,down.startDepth-baseCenter.dot(normal));
    baseCenter.x=clamp(baseCenter.x,-5,5);baseCenter.y=clamp(baseCenter.y,-3,3);
    item.group.position.copy(baseCenter);item.group.updateMatrixWorld(true);
    const candidates=projectedTargetRows(item),nextId=chooseDepthTarget(depthTarget,candidates,{acquirePaddingPx:DEPTH_TARGET_ACQUIRE_PADDING_PX,releasePaddingPx:DEPTH_TARGET_RELEASE_PADDING_PX});
    depthTarget=nextId;const target=instanceById(depthTarget);updateTargetIndicator(target);
    let desiredDepthOffset=0,solution=null;
    if(target){solution=solveDepthDocking({dragged:shapeFor(item,baseCenter),target:shapeFor(target),cameraNormal:normal.toArray(),previousCenter:previousCenter.toArray(),maxCompression:MAX_DOCKING_COMPRESSION_WORLD});
      if(solution){desiredDepthOffset=solution.offset;depthDockingState='docking';}else depthDockingState='acquired-no-solution';}
    const previousOffset=previousCenter.clone().sub(baseCenter).dot(normal),alpha=1-Math.exp(-Math.max(0,elapsedMs)/DEPTH_DOCKING_TIME_CONSTANT_MS),currentOffset=previousOffset+(desiredDepthOffset-previousOffset)*alpha;
    item.group.position.copy(baseCenter).addScaledVector(normal,currentOffset);correctPointerAnchor(item,down.localAnchor,down.clientX,down.clientY);
    if(target&&solution){const actualGap=minimumMoleculeSurfaceGap({dragged:shapeFor(item),target:shapeFor(target)});depthDockingState=Math.abs(currentOffset-desiredDepthOffset)<.025&&actualGap>=-MAX_DOCKING_COMPRESSION_WORLD-.01?'contact':'docking';}
    else if(!target)depthDockingState=Math.abs(currentOffset)<.025?'none':'returning';
  }
  function currentPinchDistance(){const points=[...activePointers.values()];return points.length<2?0:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);}
  function capturePointer(event){try{canvas.setPointerCapture(event.pointerId);}catch{}}
  canvas.addEventListener('pointerdown',event=>{
    event.preventDefault();activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});capturePointer(event);
    if(pinchActive||activePointers.size>1){if(!pinchActive){endManipulation();pinchActive=true;}pinchDistance=currentPinchDistance();onPointerLockChange(true);return;}
    const hit=raycastAtoms(event)??fallbackGrab(event);selected=hit?.item??null;
    down={pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,group:selected};
    if(selected){
      const center=selected.group.position.clone(),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(cameraNormal(),center);
      const localAnchor=selected.group.worldToLocal(hit.point.clone());
      down.plane=plane;down.localAnchor=localAnchor;down.startDepth=center.dot(cameraNormal());
      chamberTime.setMode(CHAMBER_TIME_MODES.MANIPULATING);syncStageABodyFromGroup(selected);selected.stageBody.velocityAngstromPerPs=[0,0,0];clearDepthTarget();
    }
    onPointerLockChange(true);
  });
  canvas.addEventListener('pointermove',event=>{
    const point=activePointers.get(event.pointerId);if(!point)return;
    point.x=event.clientX;point.y=event.clientY;
    if(pinchActive){const next=currentPinchDistance();if(next>0&&pinchDistance>0){distance=clamp(distance*pinchDistance/Math.max(1,next),7,24);updateCamera();}pinchDistance=next;return;}
    if(down?.pointerId===event.pointerId){down.clientX=event.clientX;down.clientY=event.clientY;}
  });
  function endPointer(event){
    const active=activePointers.has(event.pointerId),wasPinching=pinchActive;
    if(!active)return;
    if(!wasPinching&&event.type==='pointerup'&&down?.pointerId===event.pointerId&&selected)updateManipulation(16);
    if(down?.pointerId===event.pointerId&&!wasPinching)endManipulation();
    activePointers.delete(event.pointerId);try{canvas.releasePointerCapture(event.pointerId);}catch{}
    if(wasPinching){if(activePointers.size===0){pinchActive=false;pinchDistance=0;clearDepthTarget();}onPointerLockChange(activePointers.size>0);return;}
    onPointerLockChange(activePointers.size>0);
  }
  canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
  canvas.addEventListener('wheel',event=>{event.preventDefault();distance=clamp(distance*Math.exp(event.deltaY*.001),7,24);updateCamera();},{passive:false});

  function reactionStep(simulationTimeMs){
    const touchingPairs=new Set();
    for(let first=0;first<instances.length;first++)for(let second=first+1;second<instances.length;second++){
      const left=instances[first],right=instances[second];if(left.busy||right.busy)continue;
      if(testIsolation&&!(testIsolation.has(left.id)&&testIsolation.has(right.id)))continue;
      for(const candidate of reactionCandidates([{species:left.species,id:left.id},{species:right.species,id:right.id}],records)){
        const resolvedIds=resolveCandidateInstanceIds(candidate,instances.map(item=>item.id));if(!resolvedIds)continue;
        const [reactantA,reactantB]=resolvedIds.map(instanceById);if(!reactantA||!reactantB)continue;
        const [siteA,siteB]=candidate.siteAtomIndices,distance=atomWorld(reactantA,siteA).distanceTo(atomWorld(reactantB,siteB));
        const key=`${candidate.ruleId}:${[...resolvedIds].sort().join('|')}:${siteA}-${siteB}`;
        if(distance<candidate.rule.maxDistance)touchingPairs.add([...resolvedIds].sort().join('|'));
        if(contactMatcher.update(key,distance<candidate.rule.maxDistance,simulationTimeMs)){commit(candidate);return;}
      }
    }
    reactionContactPairs=touchingPairs;
  }
  function cancelPointerFor(item){
    if(selected===item){const pointerId=down?.pointerId;endManipulation();if(pointerId!==undefined){activePointers.delete(pointerId);try{if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}}onPointerLockChange(activePointers.size>0);}
    if(!down||down.group!==item)return;
    const pointerId=down.pointerId;down=null;activePointers.delete(pointerId);try{if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}onPointerLockChange(activePointers.size>0);
  }
  function commit(candidate){
    const ids=resolveCandidateInstanceIds(candidate,instances.map(item=>item.id));if(!ids)return;
    const reactants=ids.map(instanceById);if(reactants.some(item=>!item||item.busy))return;
    const execution=planReactionExecution(candidate,records,slotValues);if(!execution.ok){status.textContent='登録済みreactant/productを解決できず反応を中断しました。';return;}
    const [left,right]=reactants;reactionContactPairs.delete([...ids].sort().join('|'));left.busy=right.busy=true;cancelPointerFor(left);cancelPointerFor(right);
    slots.forEach(slot=>slot.disabled=true);status.textContent='接触が続き、反応中心へ分子が集まっています。';
    const center=left.group.position.clone().add(right.group.position).multiplyScalar(.5);
    reactionAnimation={left,right,center,started:performance.now()};
    setTimeout(()=>{
      if(disposed)return;
      world.remove(left.group,right.group);instances=instances.filter(item=>item!==left&&item!==right);
      for(const item of [left,right])item.group.traverse(object=>{object.geometry?.dispose?.();object.material?.dispose?.();});
      execution.products.forEach((record,index)=>createInstance(record,center.clone().add(new THREE.Vector3(index?1:-1,0,0))));
      reactionAnimation=null;slots.forEach(slot=>slot.disabled=false);
      status.textContent=`反応完了: ${execution.products.map(record=>record.nameJa??record.id).join(' + ')}`;
      window.dispatchEvent(new CustomEvent('molecule-craft:reaction-lab-product',{detail:{ruleId:execution.rule.id,products:execution.products.map(record=>record.id),consumed:execution.consumedInstanceIds,temporarySupply:execution.temporarySupply}}));
      contactMatcher.reset();
    },CHAMBER_PRESENTATION_MS);
  }

  function syncStageABodyFromGroup(item){
    item.stageBody.positionAngstrom=item.group.position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM);
    item.stageBody.orientation=[item.group.quaternion.x,item.group.quaternion.y,item.group.quaternion.z,item.group.quaternion.w];
  }
  function syncGroupFromStageABody(item){
    item.group.position.set(...item.stageBody.positionAngstrom.map(value=>value*REACTION_LAB_WORLD_UNITS_PER_ANGSTROM));
    item.group.quaternion.set(...item.stageBody.orientation);
    item.group.updateMatrixWorld(true);
  }
  function integrateStageAStep(physicalDeltaPs){
    const active=instances.filter(item=>!item.busy&&(!testIsolation||testIsolation.has(item.id))).map(item=>{
      const body=item.stageBody,dragged=item===selected&&isManipulating()&&down?.group===item;
      if(dragged){syncStageABodyFromGroup(item);body.velocityAngstromPerPs=[0,0,0];}
      body.kinematic=false;
      return body;
    });
    const started=performance.now();
    stageAForces=stageBPhysicsEnabled?integrateStageB(active,physicalDeltaPs,{excludedMoleculePairs:reactionContactPairs,collectPairDiagnostics:false}):integrateStageA(active,physicalDeltaPs,{excludedMoleculePairs:reactionContactPairs,collectPairDiagnostics:false});
    stageAPerformance.lastPhysicsDurationMs=performance.now()-started;
    stageAPerformance.lastInteractionPairCount=stageAForces.pairDiagnostics.length;
    stageAPerformance.fixedSteps++;
    for(const item of instances)if(!item.busy){
      if(item===selected&&isManipulating()&&down?.group===item){
        item.stageBody.positionAngstrom=item.group.position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM);
        item.stageBody.velocityAngstromPerPs=[0,0,0];item.group.quaternion.set(...item.stageBody.orientation);item.group.updateMatrixWorld(true);
      }else syncGroupFromStageABody(item);
    }
  }
  const stageAStepper=createFixedStepAccumulator(integrateStageAStep,{gameStepSeconds:STAGE_A_GAME_STEP_SECONDS,physicalPsPerGameSecond:STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,maxCatchUpSteps:STAGE_A_MAX_CATCH_UP_STEPS});
  function tick(now){
    if(disposed)return;requestAnimationFrame(tick);if(!dialog.open){last=now;return;}
    const elapsed=Math.max(0,now-last);last=now;
    updateManipulation(elapsed);
    const timeScale=chamberTime.scale,scaledElapsed=scaleSimulationElapsed(elapsed/1000,timeScale),acceptedElapsed=Math.min(scaledElapsed,STAGE_A_GAME_STEP_SECONDS*STAGE_A_MAX_CATCH_UP_STEPS);
    const timing=stageAStepper.advance(scaledElapsed);simulationClockSeconds+=acceptedElapsed;stageAPerformance.lastFrameStepCount=timing.steps;stageAPerformance.lastDroppedGameSeconds=timing.droppedGameSeconds;
    reactionStep(simulationClockSeconds*1000);
    if(reactionAnimation){const progress=clamp((now-reactionAnimation.started)/CHAMBER_PRESENTATION_MS,0,1);for(const item of [reactionAnimation.left,reactionAnimation.right]){item.group.position.lerp(reactionAnimation.center,progress*.18);item.group.scale.setScalar(1-progress*.12);}}
    renderer.render(scene,camera);
  }
  updateCamera();requestAnimationFrame(tick);

  function setDialogOpen(open){onDialogStateChange(open);}
  function open(){renderSlotOptions();if(!dialog.open)dialog.showModal();setDialogOpen(true);resize();}
  root.querySelector('[data-lab-close]')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{endManipulation();activePointers.clear();pinchActive=false;pinchDistance=0;onPointerLockChange(false);setDialogOpen(false);});

  if(localhostPhysicsTest){
    const probeForces=()=>stageBPhysicsEnabled?evaluateStageBForces(instances.filter(item=>!item.busy&&(!testIsolation||testIsolation.has(item.id))).map(item=>item.stageBody),{excludedMoleculePairs:reactionContactPairs}):stageAForces;
    const probe={
      physicsMode:stageBPhysicsEnabled?'stage-b':'stage-a',physicalPsPerGameSecond:STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,qA:stageBPhysicsEnabled?stageBChargeE:null,
      snapshot:()=>{const current=probeForces();return{physicsMode:stageBPhysicsEnabled?'stage-b':'stage-a',physicalPsPerGameSecond:STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,fixedGameStepSeconds:STAGE_A_GAME_STEP_SECONDS,qA:stageBPhysicsEnabled?stageBChargeE:null,simulationTimeMode:chamberTime.mode,simulationTimeScale:chamberTime.scale,simulationClockSeconds,manipulationActive:isManipulating(),draggedInstanceId:selected?.id??null,depthTargetId:depthTarget,depthDockingState,pointerAnchorErrorPx,instances:instances.map(item=>({...stageABodySnapshot(item.stageBody),species:item.species,atomCount:item.record.atoms.length,busy:item.busy,position:item.group.position.toArray(),charges:[...item.record.nonbonded.atomicChargesE],carbonylSites:stageBPhysicsEnabled?stageBCarbonylDiagnostics(item.stageBody):[],renderedObjectCount:stageBPhysicsEnabled?item.group.children.length:null,expectedRealObjectCount:stageBPhysicsEnabled?item.record.atoms.length+item.record.bonds.length:null})),pairs:current.pairDiagnostics.map(pair=>({...pair})),diagnostics:{overlapGuardActivationCount:current.overlapGuardActivationCount,carbonylSiteCount:instances.reduce((sum,item)=>sum+(item.stageBody?.carbonylAnisotropySites?.length??0),0),...stageAPerformance,lastInteractionPairCount:current.pairDiagnostics.length},camera:{distance,azimuth:FIXED_CAMERA_AZIMUTH,elevation:FIXED_CAMERA_ELEVATION},selectedInstanceId:selected?.id??null,downInstanceId:down?.group?.id??null,dialogOpen:dialog.open,pointerActive:activePointers.size>0};},
      setGeometry(poses){const ids=new Set(poses.map(pose=>pose.id));if(ids.size!==poses.length)throw Error('Stage A geometry fixture contains duplicate molecule IDs');endManipulation();activePointers.clear();pinchActive=false;pinchDistance=0;onPointerLockChange(false);testIsolation=ids.size?ids:null;reactionContactPairs.clear();contactMatcher.reset();for(const pose of poses){const item=instanceById(pose.id);if(!item)throw Error(`Missing fixture molecule ${pose.id}`);if(pose.positionAngstrom)item.stageBody.positionAngstrom=[...pose.positionAngstrom];if(pose.orientation)item.stageBody.orientation=[...pose.orientation];item.stageBody.velocityAngstromPerPs=[...(pose.velocityAngstromPerPs??[0,0,0])];item.stageBody.angularVelocityRadPerPs=[...(pose.angularVelocityRadPerPs??[0,0,0])];syncGroupFromStageABody(item);}clearDepthTarget();return this.snapshot();},
      advanceDeterministic(steps=1){const count=Math.max(0,Math.min(600,Math.floor(steps)));stageAStepper.reset();for(let index=0;index<count;index++){integrateStageAStep(STAGE_A_GAME_STEP_SECONDS*STAGE_A_PHYSICAL_PS_PER_GAME_SECOND);simulationClockSeconds+=STAGE_A_GAME_STEP_SECONDS;}return this.snapshot();},
      decomposePair(aId,bId){const a=instanceById(aId),b=instanceById(bId);if(!a||!b)throw Error('Missing Reaction Lab molecule instance');const result=stageBPhysicsEnabled?evaluateStageBForces([a.stageBody,b.stageBody],{excludedMoleculePairs:reactionContactPairs}):evaluateStageAForces([a.stageBody,b.stageBody]);return{pairs:result.pairDiagnostics,bodies:Object.fromEntries([...result.bodies].map(([id,state])=>[id,state])),overlapGuardActivationCount:result.overlapGuardActivationCount};},
      reactionContactDiagnostics(ruleId){const matches=[];for(let i=0;i<instances.length;i++)for(let j=i+1;j<instances.length;j++)for(const candidate of reactionCandidates([{species:instances[i].species,id:instances[i].id},{species:instances[j].species,id:instances[j].id}],records)){if(candidate.ruleId!==ruleId)continue;const ids=resolveCandidateInstanceIds(candidate,instances.map(item=>item.id)),[a,b]=ids.map(instanceById),[atomA,atomB]=candidate.siteAtomIndices;matches.push({ids,atomA,atomB,distance:atomWorld(a,atomA).distanceTo(atomWorld(b,atomB)),maxDistance:candidate.rule.maxDistance,contactPairActive:reactionContactPairs.has([...ids].sort().join('|')),busy:[a.busy,b.busy],isolationEligible:!testIsolation||ids.every(id=>testIsolation.has(id)),status:status.textContent});}return matches;},
      setStageAPair(aId,positionA,bId,positionB){return this.setGeometry([{id:aId,positionAngstrom:positionA},{id:bId,positionAngstrom:positionB}]);},
      prepareReactionApproach(ruleId,separationWorld=4.2){
        const candidate=instances.flatMap((left,index)=>instances.slice(index+1).flatMap(right=>reactionCandidates([{species:left.species,id:left.id},{species:right.species,id:right.id}],records))).find(item=>item.ruleId===ruleId);
        if(!candidate)throw Error(`No live instance pair for ${ruleId}`);
        const ids=resolveCandidateInstanceIds(candidate,instances.map(item=>item.id)),[left,right]=ids.map(instanceById),[atomA,atomB]=candidate.siteAtomIndices;
        testIsolation=new Set(ids);contactMatcher.reset();clearDepthTarget();endManipulation();
        for(const item of instances){item.busy=false;item.stageBody.velocityAngstromPerPs=[0,0,0];item.stageBody.angularVelocityRadPerPs=[0,0,0];item.group.quaternion.identity();if(item!==left&&item!==right)item.group.position.set(9,9,0);}
        const axis=cameraRight(),normal=cameraNormal(),pointA=left.record.atoms[atomA].point,pointB=right.record.atoms[atomB].point;
        left.group.position.copy(axis.clone().multiplyScalar(-2.4));
        right.group.position.copy(left.group.position).addScaledVector(axis,separationWorld).add(vector(THREE,pointA)).sub(vector(THREE,pointB)).addScaledVector(normal,3.4);
        for(const item of instances)syncStageABodyFromGroup(item);
        const plan=this.dragPlan(left.id,atomA,separationWorld?axis.clone().multiplyScalar(separationWorld):[0,0,0]);
        return{...plan,ruleId,left:left.id,right:right.id,siteA:atomA,siteB:atomB,initialSiteDistance:atomWorld(left,atomA).distanceTo(atomWorld(right,atomB)),initialDepthDelta:Math.abs(left.group.position.clone().sub(right.group.position).dot(normal))};
      },
      preparePairApproach(speciesA,speciesB,separationWorld=4.2,depthDeltaWorld=3.4){
        const left=instances.find(item=>item.species===speciesA),right=instances.find(item=>item!==left&&item.species===speciesB);if(!left||!right)throw Error('Requested molecule pair is not present');
        testIsolation=new Set([left.id,right.id]);contactMatcher.reset();clearDepthTarget();endManipulation();
        for(const item of instances){item.busy=false;item.stageBody.velocityAngstromPerPs=[0,0,0];item.stageBody.angularVelocityRadPerPs=[0,0,0];item.group.quaternion.identity();if(item!==left&&item!==right)item.group.position.set(9,9,0);}
        const axis=cameraRight(),normal=cameraNormal(),pointA=left.record.atoms[0].point,pointB=right.record.atoms[0].point;
        left.group.position.copy(axis.clone().multiplyScalar(-2.4));right.group.position.copy(left.group.position).addScaledVector(axis,separationWorld).add(vector(THREE,pointA)).sub(vector(THREE,pointB)).addScaledVector(normal,depthDeltaWorld);
        for(const item of instances)syncStageABodyFromGroup(item);
        return{...this.dragPlan(left.id,0,axis.clone().multiplyScalar(separationWorld)),left:left.id,right:right.id,initialDepthDelta:depthDeltaWorld};
      },
      currentSurfaceGap(aId,bId){const a=instanceById(aId),b=instanceById(bId);return a&&b?minimumMoleculeSurfaceGap({dragged:shapeFor(a),target:shapeFor(b)}):Infinity;},
      placeSpeciesPair(speciesA,speciesB,targetDistance=8){const a=instances.find(item=>item.species===speciesA),b=instances.find(item=>item!==a&&item.species===speciesB);if(!a||!b)throw Error('Requested molecule pair is not present');testIsolation=new Set([a.id,b.id]);contactMatcher.reset();clearDepthTarget();const axis=cameraRight();for(const item of instances){item.stageBody.velocityAngstromPerPs=[0,0,0];item.stageBody.angularVelocityRadPerPs=[0,0,0];item.group.rotation.set(0,0,0);}a.group.position.copy(axis.clone().multiplyScalar(-1));b.group.position.copy(a.group.position).addScaledVector(axis,targetDistance).add(vector(THREE,a.record.atoms[0].point)).sub(vector(THREE,b.record.atoms[0].point));for(const item of instances)if(item!==a&&item!==b)item.group.position.set(9,9,0);for(const item of instances)syncStageABodyFromGroup(item);return{distance:atomWorld(a,0).distanceTo(atomWorld(b,0)),left:a.id,right:b.id};},
      dragPlan(instanceId,atomIndex=0,displacement){const item=instanceById(instanceId);if(!item)throw Error(`Missing molecule ${instanceId}`);const start=projectPoint(atomWorld(item,atomIndex)),target=item.group.position.clone().add(vector(THREE,displacement)),targetAtom=target.add(item.record.atoms[atomIndex].point.clone().applyQuaternion(item.group.quaternion));return{instanceId,start,end:projectPoint(targetAtom),before:item.group.position.toArray(),target:target.toArray()};},
      projectedBounds(){const rect=canvas.getBoundingClientRect();return instances.map(item=>{const rows=item.record.atoms.map((atom,index)=>{const point=atomWorld(item,index),screen=projectPoint(point),radius=modelAtomRadius(atom.element)*rect.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*viewDepth(point));return{x:screen.x,y:screen.y,z:screen.z,radius};});return{id:item.id,atoms:rows,bounds:rows.length?{left:Math.min(...rows.map(row=>row.x-row.radius)),right:Math.max(...rows.map(row=>row.x+row.radius)),top:Math.min(...rows.map(row=>row.y-row.radius)),bottom:Math.max(...rows.map(row=>row.y+row.radius))}:null};});},
      setSimulationClock(seconds){if(!Number.isFinite(seconds)||seconds<0)throw Error('Simulation clock must be a finite non-negative number.');simulationClockSeconds=seconds;contactMatcher.reset();return this.snapshot();},
      refresh(){return this.snapshot();},
    };
    window.__reactionLabProbe=probe;
  }
  return {open,dispose(){disposed=true;resizeObserver.disconnect();clear();renderer.dispose();}};
}
