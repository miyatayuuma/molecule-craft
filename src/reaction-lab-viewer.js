import { createPreviewModel } from './preview-model.js?v=32';
import { ELEMENTS, modelAtomRadius } from './chemistry.js?v=20';
import {
  deriveInteractionModel, hydrogenBondEligibility, decomposeMoleculePairInteraction,
  planVisiblePopulation, reactionCandidates, planReactionExecution, resolveCandidateInstanceIds,
  hydrogenBondVisualEndpoints, createHydrogenBondTracker, createContactMatcher,
  CONTACT_DWELL_MS,
} from './reaction-lab-core.js?v=6';

const vector=(THREE,point)=>Array.isArray(point)?new THREE.Vector3(point[0],point[1],point[2]):new THREE.Vector3(point.x,point.y,point.z);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function createReactionLabViewer({THREE,dialog,root,records,collectionState,onDialogStateChange=()=>{},onPointerLockChange=()=>{}}){
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
  const contactMatcher=createContactMatcher(),hydrogenBonds=createHydrogenBondTracker();let lastHydrogenBondLifecycle={active:[],broken:[],challengers:[]};
  const activePointers=new Set();

  function resize(){const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);resize();
  function updateCamera(){camera.position.set(distance*Math.sin(azimuth)*Math.cos(elevation),distance*Math.sin(elevation),distance*Math.cos(azimuth)*Math.cos(elevation));camera.lookAt(0,0,0);camera.updateMatrixWorld();}
  function cameraNormal(){camera.updateMatrixWorld();return camera.getWorldDirection(new THREE.Vector3());}
  function cameraRight(){camera.updateMatrixWorld();return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).normalize();}
  function rayForEvent(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);}
  function atomWorld(item,index){const atom=item.record.atoms[index];return item.group.localToWorld(vector(THREE,atom.point));}
  function instanceById(id){return instances.find(item=>item.id===id)??null;}
  function clearBonds(){hydrogenBonds.reset();lastHydrogenBondLifecycle={active:[],broken:[],challengers:[]};}
  function clear(){for(const item of instances){world.remove(item.group);item.group.traverse(object=>{object.geometry?.dispose?.();object.material?.dispose?.();});}instances=[];clearBonds();contactMatcher.reset();reactionContactPairs.clear();selected=null;testIsolation=null;}

  function hydrogenBondGeometry(donorItem,donorAtom,hydrogenAtom,acceptorItem,acceptorAtom){
    const donor=atomWorld(donorItem,donorAtom),hydrogen=atomWorld(donorItem,hydrogenAtom),acceptor=atomWorld(acceptorItem,acceptorAtom);
    const donorDirection=donor.clone().sub(hydrogen).normalize(),hydrogenDirection=acceptor.clone().sub(hydrogen).normalize();
    const angle=Math.acos(clamp(donorDirection.dot(hydrogenDirection),-1,1))*180/Math.PI;
    const bonded=acceptorItem.record.bonds.filter(bond=>bond.a===acceptorAtom||bond.b===acceptorAtom);
    const neighborDirection=new THREE.Vector3();
    for(const bond of bonded){const other=bond.a===acceptorAtom?bond.b:bond.a;neighborDirection.add(atomWorld(acceptorItem,other).sub(acceptor).normalize());}
    const acceptorOpenDirection=neighborDirection.lengthSq()<1e-6?new THREE.Vector3():neighborDirection.negate().normalize();
    const acceptorOpenness=acceptorOpenDirection.lengthSq()<1e-6?1:clamp((acceptorOpenDirection.dot(hydrogen.clone().sub(acceptor).normalize())+.25)/1.25,0,1);
    const approach=hydrogen.clone().sub(acceptor).normalize();
    return {angle,acceptorOpenness,acceptorOpenDirection:{x:acceptorOpenDirection.x,y:acceptorOpenDirection.y,z:acceptorOpenDirection.z},acceptorApproachDirection:{x:approach.x,y:approach.y,z:approach.z}};
  }

  function createInstance(record,position){
    const preview=createPreviewModel(THREE,record);for(let index=0;index<190;index++)preview.step();
    const model=preview.snapshot(),group=new THREE.Group();group.position.copy(position);
    for(const atom of model.atoms){const geometry=new THREE.SphereGeometry(modelAtomRadius(atom.element),16,12),material=new THREE.MeshStandardMaterial({color:ELEMENTS[atom.element]?.color??'#cbd5e1',roughness:.32,metalness:.08}),mesh=new THREE.Mesh(geometry,material);mesh.position.copy(atom.point);mesh.userData.atomIndex=atom.id;group.add(mesh);}
    for(const bond of model.bonds){const a=vector(THREE,model.atoms[bond.a].point),b=vector(THREE,model.atoms[bond.b].point),direction=b.clone().sub(a),length=direction.length(),geometry=new THREE.CylinderGeometry(.055,.055,length,8),material=new THREE.MeshStandardMaterial({color:'#c3d2dc',roughness:.6}),mesh=new THREE.Mesh(geometry,material);mesh.position.copy(a.add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());group.add(mesh);}
    world.add(group);
    const interaction=deriveInteractionModel(record);
    const interactionRadius=Math.max(...model.atoms.map(atom=>atom.point.length()+modelAtomRadius(atom.element)));
    const item={id:`${record.id}-${crypto.randomUUID?.()??Math.random().toString(36).slice(2)}`,species:record.id,record:{...record,atoms:model.atoms,bonds:model.bonds},group,
      interactionCharges:interaction.atoms.map(atom=>atom.interactionCharge),formalCharges:interaction.atoms.map(atom=>atom.formalCharge),netIonicCharge:interaction.netIonicCharge,donors:interaction.donors,acceptors:interaction.acceptors,
      interactionRadius,
      velocity:new THREE.Vector3((Math.random()-.5)*.003,(Math.random()-.5)*.003,(Math.random()-.5)*.003),angularVelocity:new THREE.Vector3((Math.random()-.5)*.01,(Math.random()-.5)*.01,(Math.random()-.5)*.006),dragSpeed:0,lastDragAt:0,busy:false};
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
      createInstance(record,new THREE.Vector3(x,y,(Math.random()-.5)*.6));
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
    if(selected){gesture.position=selected.group.position.clone();gesture.rotation=selected.group.rotation.clone();gesture.plane=new THREE.Plane().setFromNormalAndCoplanarPoint(cameraNormal(),gesture.position);rayForEvent(event);const hit=raycaster.ray.intersectPlane(gesture.plane,new THREE.Vector3());gesture.grabOffset=hit?hit.sub(gesture.position):new THREE.Vector3();gesture.lastPosition=gesture.position.clone();gesture.lastTime=performance.now();}
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
        const now=performance.now(),elapsed=Math.max(8,now-down.lastTime),dragDelta=next.clone().sub(down.lastPosition);down.group.velocity.copy(dragDelta).multiplyScalar(16/elapsed);
        down.group.dragSpeed=dragDelta.length()*16/elapsed;down.group.lastDragAt=now;
        down.group.group.position.copy(next);down.lastPosition.copy(next);down.lastTime=now;
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

  function bondKey(identity){return `${identity.donorInstanceId}:${identity.donorAtom}:${identity.donorHydrogenAtom}:${identity.acceptorInstanceId}:${identity.acceptorAtom}`;}
  // Internal interaction state is exposed to deterministic probes only;
  // production shows hydrogen bonding through molecular motion, without lines.
  function collectHydrogenBondCandidates(){
    const candidates=[];
    for(let i=0;i<instances.length;i++)for(let j=i+1;j<instances.length;j++){
      const left=instances[i],right=instances[j];if(left.busy||right.busy||left.group.position.distanceTo(right.group.position)>4.25+left.interactionRadius+right.interactionRadius)continue;
      if(testIsolation&&!(testIsolation.has(left.id)&&testIsolation.has(right.id)))continue;
      for(const [donorItem,acceptorItem] of [[left,right],[right,left]])for(const donor of donorItem.donors)for(const hydrogen of donor.hydrogens)for(const acceptor of acceptorItem.acceptors){
        const donorPoint=atomWorld(donorItem,donor.atom),hydrogenPoint=atomWorld(donorItem,hydrogen),acceptorPoint=atomWorld(acceptorItem,acceptor.atom);
        const distance=hydrogenPoint.distanceTo(acceptorPoint),geometry=hydrogenBondGeometry(donorItem,donor.atom,hydrogen,acceptorItem,acceptor.atom);
        const identity={donorInstanceId:donorItem.id,donorAtom:donor.atom,donorHydrogenAtom:hydrogen,acceptorInstanceId:acceptorItem.id,acceptorAtom:acceptor.atom,acceptorCapacity:acceptor.capacity,donorElement:donorItem.record.atoms[donor.atom].element,acceptorElement:acceptorItem.record.atoms[acceptor.atom].element,acceptorOpenDirection:geometry.acceptorOpenDirection};
        const key=bondKey(identity),tracked=hydrogenBonds.get(key);
        if(distance<=4.35&&(tracked||hydrogenBondEligibility({...donor,kind:'donor'},{...acceptor,kind:'acceptor'},{distance,angle:geometry.angle})))candidates.push({identity,key,donorItem,acceptorItem,donorPoint,hydrogenPoint,acceptorPoint,distance,...geometry});
      }
    }
    return candidates;
  }
  function updateHydrogenBondStates(now){
    const candidates=collectHydrogenBondCandidates().map(candidate=>{
      const previous=hydrogenBonds.get(candidate.key),elapsed=Math.max(1,now-(previous?.lastSampleAt??now)),sampledSpeed=previous?Math.abs(candidate.distance-(previous.lastDistance??candidate.distance))/(elapsed/16):0;
      const recentDragSpeed=[candidate.donorItem,candidate.acceptorItem].reduce((speed,item)=>now-item.lastDragAt<140?Math.max(speed,item.dragSpeed):speed,0);
      return {...candidate,...candidate.identity,relativeSpeed:Math.max(sampledSpeed,recentDragSpeed),tensileLoad:Math.max(0,candidate.distance-(previous?.equilibriumDistance??1.95))*.028};
    });
    lastHydrogenBondLifecycle=hydrogenBonds.updateAll(candidates,now);
    for(const bond of hydrogenBonds.values()){bond.lastDistance=bond.distance;bond.lastSampleAt=now;}
    return lastHydrogenBondLifecycle;
  }

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
    for(const bond of hydrogenBonds.values())if(ids.includes(bond.donorInstanceId)||ids.includes(bond.acceptorInstanceId))hydrogenBonds.delete(bond.key);
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

  function physicalInteractions(dtScale,now,thermal=true){
    const accumulators=new Map(instances.map(item=>[item,{force:new THREE.Vector3(),torque:new THREE.Vector3(),inertia:Math.max(.8,item.record.atoms.reduce((sum,atom)=>sum+atom.point.lengthSq(),0))}]));
    const atomWorldPositions=new Map(instances.map(item=>{item.group.updateWorldMatrix(true,false);return [item,item.record.atoms.map(atom=>vector(THREE,atom.point).applyMatrix4(item.group.matrixWorld))];}));
    const forceDescriptors=new Map(instances.map(item=>[item,{id:item.id,species:item.species,center:{x:item.group.position.x,y:item.group.position.y,z:item.group.position.z},atoms:item.record.atoms.map((atom,index)=>{const point=atomWorldPositions.get(item)[index];return {element:atom.element,interactionCharge:item.interactionCharges[index],position:{x:point.x,y:point.y,z:point.z},excludedRadius:modelAtomRadius(atom.element)};})}]));
    const activePairs=[];
    for(let i=0;i<instances.length;i++)for(let j=i+1;j<instances.length;j++){
      const a=instances[i],b=instances[j];if(a.busy||b.busy)continue;
      if(testIsolation&&!(testIsolation.has(a.id)&&testIsolation.has(b.id)))continue;
      if(reactionContactPairs.has([a.id,b.id].sort().join('|')))continue;
      const centerDelta=b.group.position.clone().sub(a.group.position),centerDistance=centerDelta.length();if(centerDistance>4.25+a.interactionRadius+b.interactionRadius)continue;
      activePairs.push([a,b]);
      const pairBonds=hydrogenBonds.values().filter(bond=>[bond.donorInstanceId,bond.acceptorInstanceId].includes(a.id)&&[bond.donorInstanceId,bond.acceptorInstanceId].includes(b.id)).map(bond=>({...bond,relativeSeparationSpeed:bond.donorInstanceId===a.id?b.velocity.clone().sub(a.velocity).dot(atomWorld(b,bond.acceptorAtom).sub(atomWorld(a,bond.donorHydrogenAtom)).normalize()):a.velocity.clone().sub(b.velocity).dot(atomWorld(a,bond.acceptorAtom).sub(atomWorld(b,bond.donorHydrogenAtom)).normalize())}));
      const decomposition=decomposeMoleculePairInteraction(forceDescriptors.get(a),forceDescriptors.get(b),{hbonds:pairBonds,chargeOptions:{strength:.42,softening:.85,cutoff:4.25,maxForce:.025},stericOptions:{stiffness:4.5,maxForce:.24},includePairs:false});
      for(const [item,aggregate] of [[a,decomposition.molecules[a.id]],[b,decomposition.molecules[b.id]]]){
        if(item===selected&&down?.group===item)continue;const accumulator=accumulators.get(item);
        accumulator.force.add(vector(THREE,aggregate.totalForce));accumulator.torque.add(vector(THREE,aggregate.torque));
      }
    }
    for(const [item,accumulator] of accumulators){
      const dragged=item===selected&&down?.group===item;if(dragged)continue;
      item.velocity.addScaledVector(accumulator.force,.07*dtScale).multiplyScalar(Math.pow(.985,dtScale));
      if(thermal){item.velocity.x+=(Math.random()-.5)*.001*dtScale;item.velocity.y+=(Math.random()-.5)*.001*dtScale;}
      item.velocity.clampLength(0,.045);item.group.position.addScaledVector(item.velocity,dtScale);
      item.angularVelocity.addScaledVector(accumulator.torque,.22/accumulator.inertia*dtScale).multiplyScalar(Math.pow(.94,dtScale));
      if(thermal)item.angularVelocity.add(new THREE.Vector3((Math.random()-.5)*.00012,(Math.random()-.5)*.00012,(Math.random()-.5)*.00008).multiplyScalar(dtScale));item.angularVelocity.clampLength(0,.026);
      item.group.rotation.x+=item.angularVelocity.x*dtScale;item.group.rotation.y+=item.angularVelocity.y*dtScale;item.group.rotation.z+=item.angularVelocity.z*dtScale;
      item.group.position.clamp(new THREE.Vector3(-5,-3,-2.5),new THREE.Vector3(5,3,2.5));
    }
    return activePairs;
  }
  function tick(now){
    if(disposed)return;requestAnimationFrame(tick);if(!dialog.open){last=now;return;}
    const dt=Math.min(40,now-last);last=now;const scale=dt/16;
    const activePairs=physicalInteractions(scale,now);
    updateHydrogenBondStates(now);
    reactionStep(now);
    if(reactionAnimation){const progress=clamp((now-reactionAnimation.started)/CONTACT_DWELL_MS,0,1);for(const item of [reactionAnimation.left,reactionAnimation.right]){item.group.position.lerp(reactionAnimation.center,progress*.18);item.group.scale.setScalar(1-progress*.12);}}
    renderer.render(scene,camera);
  }
  updateCamera();requestAnimationFrame(tick);

  function setDialogOpen(open){onDialogStateChange(open);}
  function open(){renderSlotOptions();if(!dialog.open)dialog.showModal();setDialogOpen(true);resize();}
  root.querySelector('[data-lab-close]')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{activePointers.clear();down=null;selected=null;onPointerLockChange(false);setDialogOpen(false);});

  if(new URLSearchParams(location.search).get('reactionLabTest')==='1'&&['localhost','127.0.0.1'].includes(location.hostname)){
    const project=point=>{camera.updateMatrixWorld();const projected=point.clone().project(camera),rect=canvas.getBoundingClientRect();return{x:rect.left+(projected.x+1)*.5*rect.width,y:rect.top+(1-projected.y)*.5*rect.height};};
    window.__reactionLabProbe={
      snapshot:()=>({instances:instances.map(item=>({id:item.id,species:item.species,atomCount:item.record.atoms.length,busy:item.busy,position:item.group.position.toArray(),dragSpeed:item.dragSpeed,charges:[...item.interactionCharges]})),bonds:hydrogenBonds.values().map(bond=>({key:bond.key,endpoints:hydrogenBondVisualEndpoints(bond),distance:bond.distance,angle:bond.angle,equilibriumDistance:bond.equilibriumDistance,score:bond.score,acceptorCapacity:bond.acceptorCapacity})),hydrogenBondVisualCount:0,camera:{distance,azimuth,elevation},selectedInstanceId:selected?.id??null,downInstanceId:down?.group?.id??null,dialogOpen:dialog.open,pointerActive:activePointers.size>0}),
      decomposePair(instanceAId,instanceBId,options={}){
        const a=instanceById(instanceAId),b=instanceById(instanceBId);if(!a||!b)throw Error('Missing molecule instance for force decomposition');
        const descriptor=item=>({id:item.id,species:item.species,center:{x:item.group.position.x,y:item.group.position.y,z:item.group.position.z},atoms:item.record.atoms.map((atom,index)=>{const point=atomWorld(item,index);return {element:atom.element,interactionCharge:item.interactionCharges[index],position:{x:point.x,y:point.y,z:point.z},excludedRadius:modelAtomRadius(atom.element)};})});
        const hbonds=hydrogenBonds.values().filter(bond=>[bond.donorInstanceId,bond.acceptorInstanceId].includes(a.id)&&[bond.donorInstanceId,bond.acceptorInstanceId].includes(b.id));
        return decomposeMoleculePairInteraction(descriptor(a),descriptor(b),{stericOptions:{stiffness:4.5,maxForce:.24},hbonds,...options});
      },
      hydrogenBondDiagnostics(instanceAId,instanceBId){
        const a=instanceById(instanceAId),b=instanceById(instanceBId);if(!a||!b)throw Error('Missing molecule instance for H-bond diagnostics');
        const bonds=hydrogenBonds.values().filter(bond=>new Set([bond.donorInstanceId,bond.acceptorInstanceId]).has(a.id)&&new Set([bond.donorInstanceId,bond.acceptorInstanceId]).has(b.id)).map(bond=>{
          const donor=instanceById(bond.donorInstanceId),acceptor=instanceById(bond.acceptorInstanceId),geometry=hydrogenBondGeometry(donor,bond.donorAtom,bond.donorHydrogenAtom,acceptor,bond.acceptorAtom),decomposition=this.decomposePair(donor.id,acceptor.id,{includeCoulomb:false,includeSteric:false});
          const row=decomposition.pairs.find(pair=>pair.instanceAId===donor.id&&pair.atomA===bond.donorHydrogenAtom&&pair.instanceBId===acceptor.id&&pair.atomB===bond.acceptorAtom);
          return {key:bond.key,donor:bond.donorInstanceId,donorAtom:bond.donorAtom,donorHydrogenAtom:bond.donorHydrogenAtom,acceptor:bond.acceptorInstanceId,acceptorAtom:bond.acceptorAtom,distance:atomWorld(donor,bond.donorHydrogenAtom).distanceTo(atomWorld(acceptor,bond.acceptorAtom)),angle:geometry.angle,equilibriumDistance:bond.equilibriumDistance,radialForce:row?.hbondMagnitude??0,angularTorque:row?.hbondTorqueMagnitude??0,score:bond.score,occupancy:{acceptorCapacity:bond.acceptorCapacity},replacementPending:lastHydrogenBondLifecycle.challengers.some(item=>item.key===bond.key)};
        });
        return {bonds,challengers:hydrogenBonds.diagnostics(),broken:lastHydrogenBondLifecycle.broken};
      },
      positionPairOnAtoms(instanceAId,atomA,instanceBId,atomB,targetDistance=.45){
        const a=instanceById(instanceAId),b=instanceById(instanceBId);if(!a||!b)throw Error('Missing molecule instance for deterministic force fixture');
        testIsolation=new Set([a.id,b.id]);clearBonds();contactMatcher.reset();
        for(const item of instances){item.velocity.set(0,0,0);item.angularVelocity.set(0,0,0);item.group.rotation.set(0,0,0);if(item!==a&&item!==b)item.group.position.set(4.8,2.65,0);}
        const pointA=a.record.atoms[atomA].point,pointB=b.record.atoms[atomB].point;
        a.group.position.set(-pointA.x,-pointA.y,-pointA.z);b.group.position.set(targetDistance-pointB.x,-pointB.y,-pointB.z);
        return {instanceAId:a.id,instanceBId:b.id,atomA,atomB,distance:atomWorld(a,atomA).distanceTo(atomWorld(b,atomB))};
      },
      advanceDeterministic(frames=45){
        const count=Math.max(0,Math.min(600,Math.floor(frames))),start=performance.now();
        for(let frame=0;frame<count;frame++){const now=start+frame*16;physicalInteractions(1,now,false);updateHydrogenBondStates(now);}
        return this.snapshot();
      },
      prepareContact(ruleId,startDistance=2.25){
        const candidate=instances.flatMap((left,index)=>instances.slice(index+1).flatMap(right=>reactionCandidates([{species:left.species,id:left.id},{species:right.species,id:right.id}],records))).find(item=>item.ruleId===ruleId);
        if(!candidate)throw Error(`No live instance pair for ${ruleId}`);
        const ids=resolveCandidateInstanceIds(candidate,instances.map(item=>item.id)),[left,right]=ids.map(instanceById),[atomA,atomB]=candidate.siteAtomIndices;
        testIsolation=new Set(ids);
        for(const item of instances){item.busy=false;item.velocity.set(0,0,0);item.angularVelocity.set(0,0,0);item.group.rotation.set(0,0,0);}
        clearBonds();contactMatcher.reset();
        const screenRight=cameraRight(),pointA=left.record.atoms[atomA].point,pointB=right.record.atoms[atomB].point;
        left.group.position.copy(screenRight.clone().multiplyScalar(-1));
        right.group.position.copy(left.group.position).addScaledVector(screenRight,startDistance).add(vector(THREE,pointA)).sub(vector(THREE,pointB));
        for(const item of instances)if(item!==left&&item!==right)item.group.position.set(4.8,2.65,0);
        const startWorld=atomWorld(left,atomA),endWorld=startWorld.clone().addScaledVector(screenRight,startDistance-.82),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(cameraNormal(),left.group.position);
        const rect=canvas.getBoundingClientRect();pointer.set((project(startWorld).x-rect.left)/rect.width*2-1,-(project(startWorld).y-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
        const hit=raycaster.ray.intersectPlane(plane,new THREE.Vector3()),offset=hit?hit.sub(left.group.position):new THREE.Vector3();
        return {instanceId:left.id,start:project(startWorld),end:project(endWorld.clone().add(offset)),initialDistance:atomWorld(left,atomA).distanceTo(atomWorld(right,atomB)),expectedDistance:.82};
      },
      arrangeHydrogenBond(angleOffsetDegrees=0){
        const waters=instances.filter(item=>item.species==='water');if(waters.length<2)throw Error('Water-only population is required');
        const [donor,acceptor]=waters,axis=cameraRight();
        testIsolation=new Set([donor.id,acceptor.id]);
        for(const item of instances){item.velocity.set(0,0,0);item.angularVelocity.set(0,0,0);item.group.position.set(4.8,2.65,0);item.group.rotation.set(0,0,0);}
        clearBonds();contactMatcher.reset();
        const donorVector=vector(THREE,donor.record.atoms[1].point).sub(vector(THREE,donor.record.atoms[0].point)).normalize();
        donor.group.quaternion.setFromUnitVectors(donorVector,axis);donor.group.position.set(0,0,0);
        const acceptorVector=vector(THREE,acceptor.record.atoms[1].point).sub(vector(THREE,acceptor.record.atoms[0].point)).normalize().add(vector(THREE,acceptor.record.atoms[2].point).sub(vector(THREE,acceptor.record.atoms[0].point)).normalize()).normalize();
        acceptor.group.quaternion.setFromUnitVectors(acceptorVector,axis);
        const donorH=atomWorld(donor,1),acceptorO=atomWorld(acceptor,0),offset=axis.clone().multiplyScalar(Math.cos(angleOffsetDegrees*Math.PI/180)).add(new THREE.Vector3(0,1,0).multiplyScalar(Math.sin(angleOffsetDegrees*Math.PI/180))).normalize();acceptor.group.position.add(donorH.clone().addScaledVector(offset,2.3).sub(acceptorO));
        const others=waters.slice(2);others.forEach((item,index)=>item.group.position.set(index%2?4.8:-4.8,index<2?2.65:-2.65,0));
        const lifecycle=updateHydrogenBondStates(performance.now()),candidates=collectHydrogenBondCandidates().map(candidate=>({key:candidate.key,distance:candidate.distance,angle:candidate.angle,acceptorOpenness:candidate.acceptorOpenness,acceptorCapacity:candidate.identity.acceptorCapacity}));
        const lifecycleSummary={active:lifecycle.active.map(bond=>({key:bond.key,distance:bond.distance,angle:bond.angle,equilibriumDistance:bond.equilibriumDistance,score:bond.score})),broken:lifecycle.broken.map(bond=>({key:bond.key,reason:bond.reason})),challengers:lifecycle.challengers};
        return {donorId:donor.id,acceptorId:acceptor.id,axis:axis.toArray(),bonds:hydrogenBonds.values().length,angle:hydrogenBondGeometry(donor,0,1,acceptor,0).angle,distance:atomWorld(donor,1).distanceTo(atomWorld(acceptor,0)),lifecycle:lifecycleSummary,candidates,geometry:{from:atomWorld(donor,1).toArray(),to:atomWorld(acceptor,0).toArray()}};
      },
      rebindDifferentPartner(){
        const waters=instances.filter(item=>item.species==='water');if(waters.length<3)throw Error('Water-only population with three instances is required');
        const [donor,oldPartner,newPartner]=waters,axis=cameraRight(),now=performance.now();testIsolation=new Set([donor.id,oldPartner.id,newPartner.id]);clearBonds();contactMatcher.reset();
        waters.forEach((item,index)=>{item.velocity.set(0,0,0);item.angularVelocity.set(0,0,0);item.group.rotation.set(0,0,0);if(index>2)item.group.position.set(4.8,2.65,0);});
        const donorVector=vector(THREE,donor.record.atoms[1].point).sub(vector(THREE,donor.record.atoms[0].point)).normalize();donor.group.quaternion.setFromUnitVectors(donorVector,axis);donor.group.position.set(0,0,0);
        const placeAcceptor=(item,oxygenPosition)=>{const oxygen=vector(THREE,item.record.atoms[0].point),bisector=vector(THREE,item.record.atoms[1].point).sub(oxygen).normalize().add(vector(THREE,item.record.atoms[2].point).sub(oxygen).normalize()).normalize();item.group.quaternion.setFromUnitVectors(bisector,axis);item.group.position.copy(oxygenPosition).sub(oxygen.applyQuaternion(item.group.quaternion));};
        placeAcceptor(oldPartner,atomWorld(donor,1).addScaledVector(axis,2.3));placeAcceptor(newPartner,new THREE.Vector3(4.8,2.65,0));
        updateHydrogenBondStates(now);const formedWith=hydrogenBonds.values().map(bond=>bond.acceptorInstanceId);
        oldPartner.group.position.addScaledVector(axis,6);updateHydrogenBondStates(now+24);const afterBreak=hydrogenBonds.values().length;
        placeAcceptor(newPartner,atomWorld(donor,1).addScaledVector(axis,2.3));updateHydrogenBondStates(now+48);
        return {formedWith,oldPartnerId:oldPartner.id,newPartnerId:newPartner.id,afterBreak,final:hydrogenBonds.values().map(bond=>({donor:bond.donorInstanceId,acceptor:bond.acceptorInstanceId,angle:bond.angle,distance:bond.distance}))};
      },
      arrangeHydrogenBondPair(donorSpecies,acceptorSpecies,donorAtom,hydrogenAtom,acceptorAtom,angleOffsetDegrees=0){
        const donor=instances.find(item=>item.species===donorSpecies),acceptor=instances.find(item=>item.species===acceptorSpecies);if(!donor||!acceptor)throw Error('Requested H-bond pair is not present');
        const axis=cameraRight();testIsolation=new Set([donor.id,acceptor.id]);clearBonds();contactMatcher.reset();
        for(const item of instances){item.velocity.set(0,0,0);item.angularVelocity.set(0,0,0);item.group.rotation.set(0,0,0);if(item!==donor&&item!==acceptor)item.group.position.set(4.8,2.65,0);}
        const localDonor=vector(THREE,donor.record.atoms[hydrogenAtom].point).sub(vector(THREE,donor.record.atoms[donorAtom].point)).normalize();donor.group.quaternion.setFromUnitVectors(localDonor,axis);donor.group.position.set(0,0,0);
        const acceptorO=vector(THREE,acceptor.record.atoms[acceptorAtom].point),neighbors=acceptor.record.bonds.filter(bond=>bond.a===acceptorAtom||bond.b===acceptorAtom).map(bond=>vector(THREE,acceptor.record.atoms[bond.a===acceptorAtom?bond.b:bond.a].point).sub(acceptorO).normalize()),open=neighbors.reduce((sum,item)=>sum.sub(item),new THREE.Vector3()).normalize();
        acceptor.group.quaternion.setFromUnitVectors(open,axis.clone().negate());const donorH=atomWorld(donor,hydrogenAtom),offset=axis.clone().multiplyScalar(Math.cos(angleOffsetDegrees*Math.PI/180)).add(new THREE.Vector3(0,1,0).multiplyScalar(Math.sin(angleOffsetDegrees*Math.PI/180))).normalize();acceptor.group.position.copy(donorH).addScaledVector(offset,2.3).sub(acceptorO.applyQuaternion(acceptor.group.quaternion));
        updateHydrogenBondStates(performance.now());const bond=hydrogenBonds.values()[0]??null;
        return {donorId:donor.id,acceptorId:acceptor.id,bondCount:hydrogenBonds.values().length,angle:bond?.angle??hydrogenBondGeometry(donor,donorAtom,hydrogenAtom,acceptor,acceptorAtom).angle,distance:bond?.distance??atomWorld(donor,hydrogenAtom).distanceTo(atomWorld(acceptor,acceptorAtom)),diagnostics:bond?this.hydrogenBondDiagnostics(donor.id,acceptor.id):null};
      },
      placeSpeciesPair(speciesA,speciesB,targetDistance=.82){
        const left=instances.find(item=>item.species===speciesA),right=instances.find(item=>item.species===speciesB);if(!left||!right)throw Error('Requested pair is not present');
        testIsolation=new Set([left.id,right.id]);
        const axis=cameraRight();for(const item of instances){item.velocity.set(0,0,0);item.angularVelocity.set(0,0,0);item.group.rotation.set(0,0,0);}
        clearBonds();contactMatcher.reset();left.group.position.copy(axis.clone().multiplyScalar(-1));right.group.position.copy(left.group.position).addScaledVector(axis,targetDistance).add(vector(THREE,left.record.atoms[0].point)).sub(vector(THREE,right.record.atoms[0].point));
        for(const item of instances)if(item!==left&&item!==right)item.group.position.set(4.8,2.65,0);
        return {distance:atomWorld(left,0).distanceTo(atomWorld(right,0)),left:left.id,right:right.id};
      },
      dragPlan(instanceId,atomIndex=0,displacement){
        const item=instanceById(instanceId);if(!item)throw Error(`Missing instance ${instanceId}`);
        const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(cameraNormal(),item.group.position),startWorld=atomWorld(item,atomIndex),start=project(startWorld);
        const rect=canvas.getBoundingClientRect();pointer.set((start.x-rect.left)/rect.width*2-1,-(start.y-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
        const hit=raycaster.ray.intersectPlane(plane,new THREE.Vector3()),offset=hit?hit.sub(item.group.position):new THREE.Vector3();
        const delta=vector(THREE,displacement),endCenter=item.group.position.clone().add(delta);
        return {instanceId,start,end:project(endCenter.add(offset)),before:item.group.position.toArray(),target:endCenter.toArray()};
      },
      refresh(){updateHydrogenBondStates(performance.now());return this.snapshot();},
    };
  }
  return {open,dispose(){disposed=true;resizeObserver.disconnect();clear();renderer.dispose();}};
}
