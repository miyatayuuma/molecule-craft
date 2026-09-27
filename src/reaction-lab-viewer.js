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

const vector=(THREE,point)=>Array.isArray(point)?new THREE.Vector3(point[0],point[1],point[2]):new THREE.Vector3(point.x,point.y,point.z);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

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

  let slotValues=['','',''],instances=[],mode='move',selected=null,down=null,testIsolation=null,reactionContactPairs=new Set();
  let azimuth=0,elevation=0,distance=15,last=performance.now(),disposed=false,reactionAnimation=null;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const contactMatcher=createContactMatcher();
  let instanceSequence=0,stageAForces={bodies:new Map(),pairDiagnostics:[],overlapGuardActivationCount:0},stageAPerformance={lastPhysicsDurationMs:0,lastInteractionPairCount:0,lastFrameStepCount:0,lastDroppedGameSeconds:0,fixedSteps:0};
  const activePointers=new Set();

  function resize(){const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);resize();
  function updateCamera(){camera.position.set(distance*Math.sin(azimuth)*Math.cos(elevation),distance*Math.sin(elevation),distance*Math.cos(azimuth)*Math.cos(elevation));camera.lookAt(0,0,0);camera.updateMatrixWorld();}
  function cameraNormal(){camera.updateMatrixWorld();return camera.getWorldDirection(new THREE.Vector3());}
  function cameraRight(){camera.updateMatrixWorld();return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).normalize();}
  function rayForEvent(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);}
  function atomWorld(item,index){const atom=item.record.atoms[index];return item.group.localToWorld(vector(THREE,atom.point));}
  function instanceById(id){return instances.find(item=>item.id===id)??null;}
  function clear(){for(const item of instances){world.remove(item.group);item.group.traverse(object=>{object.geometry?.dispose?.();object.material?.dispose?.();});}instances=[];contactMatcher.reset();reactionContactPairs.clear();selected=null;testIsolation=null;}

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
      const originX=selectedCount===1?0:(speciesIndex-(selectedCount-1)/2)*3.7;
      const x=selectedCount===1?originX+radius*Math.cos(angle):originX+(offset%2 ? .35 : -.35),y=selectedCount===1?radius*Math.sin(angle):(offset%2 ? .9 : -.9);
      createInstance(record,new THREE.Vector3(x,y,0));
    }
    renderSlotOptions();status.textContent=instances.length?`${instances.length} 個の代表的な分子が空間にあります。移動・回転・視点を切り替えて観察します。`:'空のslotから分子を選んでください。';
  }
  slots.forEach((select,index)=>select.addEventListener('change',()=>{const proposed=slotValues.slice();proposed[index]=select.value;if(new Set(proposed.filter(Boolean)).size!==proposed.filter(Boolean).length){select.value=slotValues[index];status.textContent='同じspeciesは複数slotへ設定できません。';return;}slotValues=proposed;repopulate();}));
  root.querySelectorAll('[data-lab-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.labMode;root.querySelectorAll('[data-lab-mode]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));status.textContent=`操作: ${button.textContent}`;}));

  function raycast(event){rayForEvent(event);const hit=raycaster.intersectObjects(instances.filter(item=>!item.busy).map(item=>item.group),true)[0];let object=hit?.object;while(object&&object.parent!==world)object=object.parent;return object?.parent===world?object:null;}
  function positionOnMovePlane(event,gesture){rayForEvent(event);return raycaster.ray.intersectPlane(gesture.plane,new THREE.Vector3());}
  canvas.addEventListener('pointerdown',event=>{
    if(activePointers.size){activePointers.add(event.pointerId);down=null;selected=null;try{canvas.setPointerCapture(event.pointerId);}catch{}onPointerLockChange(true);return;}
    if(mode==='view'){selected=null;down={pointerId:event.pointerId,x:event.clientX,y:event.clientY,azimuth,elevation,group:null};}
    else {const group=raycast(event);selected=instances.find(item=>item.group===group&&!item.busy)??null;}
    const gesture={pointerId:event.pointerId,x:event.clientX,y:event.clientY,group:selected,azimuth,elevation};
    if(selected){gesture.position=selected.group.position.clone();gesture.rotation=selected.group.rotation.clone();gesture.plane=new THREE.Plane().setFromNormalAndCoplanarPoint(cameraNormal(),gesture.position);rayForEvent(event);const hit=raycaster.ray.intersectPlane(gesture.plane,new THREE.Vector3());gesture.grabOffset=hit?hit.sub(gesture.position):new THREE.Vector3();}
    else if(mode!=='view')gesture.group=null;
    down=gesture;activePointers.add(event.pointerId);try{canvas.setPointerCapture(event.pointerId);}catch{}onPointerLockChange(true);
  });
  canvas.addEventListener('pointermove',event=>{
    if(!down||!activePointers.has(event.pointerId))return;
    const dx=event.clientX-down.x,dy=event.clientY-down.y;
    if(down.group){
      if(down.group.busy)return;
      if(mode==='move'){
        const point=positionOnMovePlane(event,down);if(!point)return;
        const next=point.sub(down.grabOffset);next.clamp(new THREE.Vector3(-5,-3,-2.5),new THREE.Vector3(5,3,2.5));
        down.group.group.position.copy(next);
      } else if(mode==='rotate'){
        down.group.group.rotation.set(down.rotation.x+dy*.01,down.rotation.y+dx*.01,down.rotation.z);
      }
    } else if(mode==='view'){
      azimuth=down.azimuth-dx*.007;elevation=clamp(down.elevation+dy*.007,-1.2,1.2);updateCamera();
    }
  });
  function endPointer(event){activePointers.delete(event.pointerId);try{canvas.releasePointerCapture(event.pointerId);}catch{}if(down?.pointerId===event.pointerId)down=null;onPointerLockChange(activePointers.size>0);}
  canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
  canvas.addEventListener('wheel',event=>{event.preventDefault();distance=clamp(distance*Math.exp(event.deltaY*.001),7,24);updateCamera();},{passive:false});
  let pinchDistance=0;
  canvas.addEventListener('touchstart',event=>{if(event.touches.length===2)pinchDistance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);},{passive:true});
  canvas.addEventListener('touchmove',event=>{if(event.touches.length===2&&pinchDistance){const next=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);distance=clamp(distance*pinchDistance/Math.max(1,next),7,24);pinchDistance=next;updateCamera();}},{passive:true});

  function reactionStep(now){
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
        if(contactMatcher.update(key,distance<candidate.rule.maxDistance,now)){commit(candidate);return;}
      }
    }
    reactionContactPairs=touchingPairs;
  }
  function cancelPointerFor(item){
    if(selected===item)selected=null;
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
    },CONTACT_DWELL_MS);
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
      const body=item.stageBody,kinematic=item===selected&&down?.group===item;
      if(kinematic)syncStageABodyFromGroup(item);
      body.kinematic=kinematic;
      return body;
    });
    const started=performance.now();
    stageAForces=stageBPhysicsEnabled?integrateStageB(active,physicalDeltaPs,{excludedMoleculePairs:reactionContactPairs,collectPairDiagnostics:false}):integrateStageA(active,physicalDeltaPs,{excludedMoleculePairs:reactionContactPairs,collectPairDiagnostics:false});
    stageAPerformance.lastPhysicsDurationMs=performance.now()-started;
    stageAPerformance.lastInteractionPairCount=stageAForces.pairDiagnostics.length;
    stageAPerformance.fixedSteps++;
    for(const item of instances)if(!item.busy&&!(item===selected&&down?.group===item))syncGroupFromStageABody(item);
  }
  const stageAStepper=createFixedStepAccumulator(integrateStageAStep,{gameStepSeconds:STAGE_A_GAME_STEP_SECONDS,physicalPsPerGameSecond:STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,maxCatchUpSteps:STAGE_A_MAX_CATCH_UP_STEPS});
  function tick(now){
    if(disposed)return;requestAnimationFrame(tick);if(!dialog.open){last=now;return;}
    const elapsed=Math.max(0,now-last);last=now;
    reactionStep(now);const timing=stageAStepper.advance(elapsed/1000);stageAPerformance.lastFrameStepCount=timing.steps;stageAPerformance.lastDroppedGameSeconds=timing.droppedGameSeconds;
    if(reactionAnimation){const progress=clamp((now-reactionAnimation.started)/CONTACT_DWELL_MS,0,1);for(const item of [reactionAnimation.left,reactionAnimation.right]){item.group.position.lerp(reactionAnimation.center,progress*.18);item.group.scale.setScalar(1-progress*.12);}}
    renderer.render(scene,camera);
  }
  updateCamera();requestAnimationFrame(tick);

  function setDialogOpen(open){onDialogStateChange(open);}
  function open(){renderSlotOptions();if(!dialog.open)dialog.showModal();setDialogOpen(true);resize();}
  root.querySelector('[data-lab-close]')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{activePointers.clear();down=null;selected=null;onPointerLockChange(false);setDialogOpen(false);});

  if(localhostPhysicsTest){
    const project=point=>{camera.updateMatrixWorld();const projected=point.clone().project(camera),rect=canvas.getBoundingClientRect();return{x:rect.left+(projected.x+1)*.5*rect.width,y:rect.top+(1-projected.y)*.5*rect.height};};
    const probeForces=()=>stageBPhysicsEnabled?evaluateStageBForces(instances.filter(item=>!item.busy&&(!testIsolation||testIsolation.has(item.id))).map(item=>item.stageBody),{excludedMoleculePairs:reactionContactPairs}):stageAForces;
    const probe={
      physicsMode:stageBPhysicsEnabled?'stage-b':'stage-a',physicalPsPerGameSecond:STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,qA:stageBPhysicsEnabled?stageBChargeE:null,
      snapshot:()=>{const current=probeForces();return{physicsMode:stageBPhysicsEnabled?'stage-b':'stage-a',physicalPsPerGameSecond:STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,qA:stageBPhysicsEnabled?stageBChargeE:null,instances:instances.map(item=>({...stageABodySnapshot(item.stageBody),species:item.species,atomCount:item.record.atoms.length,busy:item.busy,position:item.group.position.toArray(),charges:[...item.record.nonbonded.atomicChargesE],carbonylSites:stageBPhysicsEnabled?stageBCarbonylDiagnostics(item.stageBody):[],renderedObjectCount:stageBPhysicsEnabled?item.group.children.length:null,expectedRealObjectCount:stageBPhysicsEnabled?item.record.atoms.length+item.record.bonds.length:null})),pairs:current.pairDiagnostics.map(pair=>({...pair})),diagnostics:{overlapGuardActivationCount:current.overlapGuardActivationCount,carbonylSiteCount:instances.reduce((sum,item)=>sum+(item.stageBody?.carbonylAnisotropySites?.length??0),0),...stageAPerformance,lastInteractionPairCount:current.pairDiagnostics.length},camera:{distance,azimuth,elevation},selectedInstanceId:selected?.id??null,downInstanceId:down?.group?.id??null,dialogOpen:dialog.open,pointerActive:activePointers.size>0};},
      setGeometry(poses){const ids=new Set(poses.map(pose=>pose.id));if(ids.size!==poses.length)throw Error('Stage A geometry fixture contains duplicate molecule IDs');testIsolation=ids.size?ids:null;reactionContactPairs.clear();contactMatcher.reset();for(const pose of poses){const item=instanceById(pose.id);if(!item)throw Error(`Missing fixture molecule ${pose.id}`);if(pose.positionAngstrom)item.stageBody.positionAngstrom=[...pose.positionAngstrom];if(pose.orientation)item.stageBody.orientation=[...pose.orientation];item.stageBody.velocityAngstromPerPs=[...(pose.velocityAngstromPerPs??[0,0,0])];item.stageBody.angularVelocityRadPerPs=[...(pose.angularVelocityRadPerPs??[0,0,0])];syncGroupFromStageABody(item);}selected=null;down=null;return this.snapshot();},
      advanceDeterministic(steps=1){const count=Math.max(0,Math.min(600,Math.floor(steps)));stageAStepper.reset();for(let index=0;index<count;index++)integrateStageAStep(STAGE_A_GAME_STEP_SECONDS*STAGE_A_PHYSICAL_PS_PER_GAME_SECOND);return this.snapshot();},
      decomposePair(aId,bId){const a=instanceById(aId),b=instanceById(bId);if(!a||!b)throw Error('Missing Reaction Lab molecule instance');const result=stageBPhysicsEnabled?evaluateStageBForces([a.stageBody,b.stageBody],{excludedMoleculePairs:reactionContactPairs}):evaluateStageAForces([a.stageBody,b.stageBody]);return{pairs:result.pairDiagnostics,bodies:Object.fromEntries([...result.bodies].map(([id,state])=>[id,state])),overlapGuardActivationCount:result.overlapGuardActivationCount};},
      reactionContactDiagnostics(ruleId){const matches=[];for(let i=0;i<instances.length;i++)for(let j=i+1;j<instances.length;j++)for(const candidate of reactionCandidates([{species:instances[i].species,id:instances[i].id},{species:instances[j].species,id:instances[j].id}],records)){if(candidate.ruleId!==ruleId)continue;const ids=resolveCandidateInstanceIds(candidate,instances.map(item=>item.id)),[a,b]=ids.map(instanceById),[atomA,atomB]=candidate.siteAtomIndices;matches.push({ids,atomA,atomB,distance:atomWorld(a,atomA).distanceTo(atomWorld(b,atomB)),maxDistance:candidate.rule.maxDistance,contactPairActive:reactionContactPairs.has([...ids].sort().join('|')),busy:[a.busy,b.busy],isolationEligible:!testIsolation||ids.every(id=>testIsolation.has(id)),status:status.textContent});}return matches;},
      setStageAPair(aId,positionA,bId,positionB){return this.setGeometry([{id:aId,positionAngstrom:positionA},{id:bId,positionAngstrom:positionB}]);},
      prepareContact(ruleId,startDistance=2.25){const candidate=instances.flatMap((left,index)=>instances.slice(index+1).flatMap(right=>reactionCandidates([{species:left.species,id:left.id},{species:right.species,id:right.id}],records))).find(item=>item.ruleId===ruleId);if(!candidate)throw Error(`No live instance pair for ${ruleId}`);const ids=resolveCandidateInstanceIds(candidate,instances.map(item=>item.id)),[left,right]=ids.map(instanceById),[atomA,atomB]=candidate.siteAtomIndices;testIsolation=new Set(ids);for(const item of instances){item.busy=false;item.stageBody.velocityAngstromPerPs=[0,0,0];item.stageBody.angularVelocityRadPerPs=[0,0,0];item.group.rotation.set(0,0,0);}const screenRight=cameraRight(),pointA=left.record.atoms[atomA].point,pointB=right.record.atoms[atomB].point;left.group.position.copy(screenRight.clone().multiplyScalar(-1));right.group.position.copy(left.group.position).addScaledVector(screenRight,startDistance).add(vector(THREE,pointA)).sub(vector(THREE,pointB));for(const item of instances)if(item!==left&&item!==right)item.group.position.set(4.8,2.65,0);for(const item of instances)syncStageABodyFromGroup(item);const from=atomWorld(left,atomA),to=atomWorld(right,atomB),end=left.group.position.clone().addScaledVector(screenRight,startDistance-.82),contactLeft=end.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM),contactRight=right.group.position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(cameraNormal(),left.group.position);const rect=canvas.getBoundingClientRect();pointer.set((project(from).x-rect.left)/rect.width*2-1,-(project(from).y-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.ray.intersectPlane(plane,new THREE.Vector3()),offset=hit?hit.sub(left.group.position):new THREE.Vector3();return{instanceId:left.id,start:project(from),end:project(end.clone().add(offset)),initialDistance:from.distanceTo(to),expectedDistance:.82,contactPoses:[{id:left.id,positionAngstrom:contactLeft,orientation:left.stageBody.orientation},{id:right.id,positionAngstrom:contactRight,orientation:right.stageBody.orientation}]};},
      placeSpeciesPair(speciesA,speciesB,targetDistance=8){const a=instances.find(item=>item.species===speciesA),b=instances.find(item=>item.species===speciesB);if(!a||!b)throw Error('Requested molecule pair is not present');testIsolation=new Set([a.id,b.id]);contactMatcher.reset();const axis=cameraRight();for(const item of instances){item.stageBody.velocityAngstromPerPs=[0,0,0];item.stageBody.angularVelocityRadPerPs=[0,0,0];item.group.rotation.set(0,0,0);}a.group.position.copy(axis.clone().multiplyScalar(-1));b.group.position.copy(a.group.position).addScaledVector(axis,targetDistance).add(vector(THREE,a.record.atoms[0].point)).sub(vector(THREE,b.record.atoms[0].point));for(const item of instances)if(item!==a&&item!==b)item.group.position.set(4.8,2.65,0);for(const item of instances)syncStageABodyFromGroup(item);return{distance:atomWorld(a,0).distanceTo(atomWorld(b,0)),left:a.id,right:b.id};},
      dragPlan(instanceId,atomIndex=0,displacement){const item=instanceById(instanceId);if(!item)throw Error(`Missing molecule ${instanceId}`);const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(cameraNormal(),item.group.position),start=project(atomWorld(item,atomIndex)),rect=canvas.getBoundingClientRect();pointer.set((start.x-rect.left)/rect.width*2-1,-(start.y-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.ray.intersectPlane(plane,new THREE.Vector3()),offset=hit?hit.sub(item.group.position):new THREE.Vector3(),target=item.group.position.clone().add(vector(THREE,displacement));return{instanceId,start,end:project(target.add(offset)),before:item.group.position.toArray(),target:target.toArray()};},
      refresh(){return this.snapshot();},
    };
    window.__reactionLabProbe=probe;
  }
  return {open,dispose(){disposed=true;resizeObserver.disconnect();clear();renderer.dispose();}};
}
