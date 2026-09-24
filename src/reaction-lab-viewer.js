import { createPreviewModel } from './preview-model.js?v=32';
import { ELEMENTS, modelAtomRadius } from './chemistry.js?v=20';
import {
  deriveInteractionModel, hydrogenBondEligibility, coulombPairForces, hydrogenBondSpringForces, torqueFromForce,
  planVisiblePopulation, reactionCandidates, planReactionExecution, resolveCandidateInstanceIds,
  hydrogenBondVisualEndpoints, createHydrogenBondTracker, createContactMatcher,
  CONTACT_DWELL_MS,
} from './reaction-lab-core.js?v=2';

const vector=(THREE,point)=>new THREE.Vector3(point.x,point.y,point.z);
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

  let slotValues=['','',''],instances=[],mode='move',selected=null,down=null,testIsolation=null;
  let azimuth=0,elevation=0,distance=15,last=performance.now(),disposed=false,reactionAnimation=null;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const contactMatcher=createContactMatcher(),hydrogenBonds=createHydrogenBondTracker();
  const bondVisuals=new Map(),activePointers=new Set();

  function resize(){const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);resize();
  function updateCamera(){camera.position.set(distance*Math.sin(azimuth)*Math.cos(elevation),distance*Math.sin(elevation),distance*Math.cos(azimuth)*Math.cos(elevation));camera.lookAt(0,0,0);camera.updateMatrixWorld();}
  function cameraNormal(){camera.updateMatrixWorld();return camera.getWorldDirection(new THREE.Vector3());}
  function cameraRight(){camera.updateMatrixWorld();return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).normalize();}
  function rayForEvent(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);}
  function atomWorld(item,index){const atom=item.record.atoms[index];return item.group.localToWorld(vector(THREE,atom.point));}
  function instanceById(id){return instances.find(item=>item.id===id)??null;}
  function clearBonds(){for(const [key,line] of bondVisuals){world.remove(line);line.geometry.dispose();line.material.dispose();bondVisuals.delete(key);}hydrogenBonds.reset();}
  function clear(){for(const item of instances){world.remove(item.group);item.group.traverse(object=>{object.geometry?.dispose?.();object.material?.dispose?.();});}instances=[];clearBonds();contactMatcher.reset();selected=null;testIsolation=null;}

  function alignmentFor(donorItem,donorAtom,hydrogenAtom,acceptorItem,acceptorAtom){
    const donor=atomWorld(donorItem,donorAtom),hydrogen=atomWorld(donorItem,hydrogenAtom),acceptor=atomWorld(acceptorItem,acceptorAtom);
    const donorDirection=hydrogen.clone().sub(donor).normalize(),hydrogenDirection=acceptor.clone().sub(hydrogen).normalize();
    const donorScore=Math.max(0,donorDirection.dot(hydrogenDirection));
    const bonded=acceptorItem.record.bonds.filter(bond=>bond.a===acceptorAtom||bond.b===acceptorAtom);
    const neighborDirection=new THREE.Vector3();
    for(const bond of bonded){const other=bond.a===acceptorAtom?bond.b:bond.a;neighborDirection.add(atomWorld(acceptorItem,other).sub(acceptor).normalize());}
    const acceptorScore=neighborDirection.lengthSq()<1e-6?1:Math.max(0,neighborDirection.negate().normalize().dot(hydrogen.clone().sub(acceptor).normalize()));
    return donorScore*.7+acceptorScore*.3;
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

  function removeBondVisual(key){const line=bondVisuals.get(key);if(!line)return;world.remove(line);line.geometry.dispose();line.material.dispose();bondVisuals.delete(key);}
  function bondKey(identity){return `${identity.donorInstanceId}:${identity.donorAtom}:${identity.donorHydrogenAtom}:${identity.acceptorInstanceId}:${identity.acceptorAtom}`;}
  function bondGeometry(bond){
    const donor=instanceById(bond.donorInstanceId),acceptor=instanceById(bond.acceptorInstanceId);
    if(!donor||!acceptor)return null;
    const endpoints=hydrogenBondVisualEndpoints(bond);return {from:atomWorld(donor,endpoints.from.atom),to:atomWorld(acceptor,endpoints.to.atom)};
  }
  function drawHBonds(){
    const live=new Set();
    for(const bond of hydrogenBonds.values()){
      const endpoints=bondGeometry(bond);if(!endpoints)continue;live.add(bond.key);
      let line=bondVisuals.get(bond.key);
      if(!line){const geometry=new THREE.BufferGeometry().setFromPoints([endpoints.from,endpoints.to]),material=new THREE.LineDashedMaterial({color:'#63d9dc',dashSize:.12,gapSize:.09,transparent:true,opacity:.72,depthWrite:false});line=new THREE.Line(geometry,material);line.computeLineDistances();world.add(line);bondVisuals.set(bond.key,line);}
      line.geometry.setFromPoints([endpoints.from,endpoints.to]);line.computeLineDistances();
      const strain=clamp((bond.distance-bond.restLength)/Math.max(.1,4.05-bond.restLength),0,1);line.material.opacity=.72*(1-strain*.72);line.material.dashSize=.12+strain*.08;line.material.gapSize=.09+strain*.07;
    }
    for(const key of bondVisuals.keys())if(!live.has(key))removeBondVisual(key);
  }
  function collectHydrogenBondCandidates(){
    const candidates=[];
    for(let i=0;i<instances.length;i++)for(let j=i+1;j<instances.length;j++){
      const left=instances[i],right=instances[j];if(left.busy||right.busy||left.group.position.distanceTo(right.group.position)>4.25+left.interactionRadius+right.interactionRadius)continue;
      if(testIsolation&&!(testIsolation.has(left.id)&&testIsolation.has(right.id)))continue;
      for(const [donorItem,acceptorItem] of [[left,right],[right,left]])for(const donor of donorItem.donors)for(const hydrogen of donor.hydrogens)for(const acceptor of acceptorItem.acceptors){
        const donorPoint=atomWorld(donorItem,donor.atom),hydrogenPoint=atomWorld(donorItem,hydrogen),acceptorPoint=atomWorld(acceptorItem,acceptor.atom);
        const distance=hydrogenPoint.distanceTo(acceptorPoint),alignment=alignmentFor(donorItem,donor.atom,hydrogen,acceptorItem,acceptor.atom);
        const identity={donorInstanceId:donorItem.id,donorAtom:donor.atom,donorHydrogenAtom:hydrogen,acceptorInstanceId:acceptorItem.id,acceptorAtom:acceptor.atom};
        const key=bondKey(identity),tracked=hydrogenBonds.get(key);
        if(tracked||hydrogenBondEligibility({kind:'donor',...donor},{kind:'acceptor',...acceptor},{distance,alignment}))candidates.push({identity,key,donorItem,acceptorItem,donorPoint,hydrogenPoint,acceptorPoint,distance,alignment});
      }
    }
    return candidates;
  }
  function updateHydrogenBondStates(now){
    const candidates=collectHydrogenBondCandidates(),byKey=new Map(candidates.map(candidate=>[candidate.key,candidate]));
    for(const bond of hydrogenBonds.values()){
      const current=byKey.get(bond.key);
      if(!current){hydrogenBonds.delete(bond.key);removeBondVisual(bond.key);continue;}
      const elapsed=Math.max(1,now-(bond.lastSampleAt??now));
      const sampledSpeed=Math.abs(current.distance-(bond.lastDistance??current.distance))/(elapsed/16);
      const recentDragSpeed=[current.donorItem,current.acceptorItem].reduce((speed,item)=>now-item.lastDragAt<140?Math.max(speed,item.dragSpeed):speed,0);
      const relativeSpeed=Math.max(sampledSpeed,recentDragSpeed);
      const tensileLoad=Math.max(0,current.distance-bond.restLength)*.028;
      const result=hydrogenBonds.update(bond.key,bond,{distance:current.distance,alignment:current.alignment,relativeSpeed,tensileLoad},now);
      if(result.broken)removeBondVisual(bond.key);else Object.assign(bond,{lastDistance:current.distance,lastSampleAt:now});
    }
    for(const candidate of candidates){
      if(hydrogenBonds.get(candidate.key))continue;
      const result=hydrogenBonds.update(candidate.key,candidate.identity,{distance:candidate.distance,alignment:candidate.alignment},now);
      if(result.formed)Object.assign(result.bond,{lastDistance:candidate.distance,lastSampleAt:now});
    }
  }

  function reactionStep(now){
    for(let first=0;first<instances.length;first++)for(let second=first+1;second<instances.length;second++){
      const left=instances[first],right=instances[second];if(left.busy||right.busy)continue;
      if(testIsolation&&!(testIsolation.has(left.id)&&testIsolation.has(right.id)))continue;
      for(const candidate of reactionCandidates([{species:left.species,id:left.id},{species:right.species,id:right.id}],records)){
        const resolvedIds=resolveCandidateInstanceIds(candidate,instances.map(item=>item.id));if(!resolvedIds)continue;
        const [reactantA,reactantB]=resolvedIds.map(instanceById);if(!reactantA||!reactantB)continue;
        const [siteA,siteB]=candidate.siteAtomIndices,distance=atomWorld(reactantA,siteA).distanceTo(atomWorld(reactantB,siteB));
        const key=`${candidate.ruleId}:${[...resolvedIds].sort().join('|')}:${siteA}-${siteB}`;
        if(contactMatcher.update(key,distance<candidate.rule.maxDistance,now)){commit(candidate);return;}
      }
    }
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
    const [left,right]=reactants;left.busy=right.busy=true;cancelPointerFor(left);cancelPointerFor(right);
    for(const [key,bond] of bondVisuals)if(key.includes(left.id)||key.includes(right.id))removeBondVisual(key);
    for(const bond of hydrogenBonds.values())if(ids.includes(bond.donorInstanceId)||ids.includes(bond.acceptorInstanceId)){hydrogenBonds.delete(bond.key);removeBondVisual(bond.key);}
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

  function applyForce(accumulators,item,force,worldPoint){
    if(item===selected&&down?.group===item)return;
    const accumulator=accumulators.get(item);if(!accumulator)return;
    accumulator.force.add(force);
    const torque=torqueFromForce(worldPoint.clone().sub(item.group.position),force);accumulator.torque.add(vector(THREE,torque));
  }
  function physicalInteractions(dtScale,now){
    const accumulators=new Map(instances.map(item=>[item,{force:new THREE.Vector3(),torque:new THREE.Vector3(),inertia:Math.max(.8,item.record.atoms.reduce((sum,atom)=>sum+atom.point.lengthSq(),0))}]));
    const atomWorldPositions=new Map(instances.map(item=>{item.group.updateWorldMatrix(true,false);return [item,item.record.atoms.map(atom=>vector(THREE,atom.point).applyMatrix4(item.group.matrixWorld))];}));
    const activePairs=[];
    for(let i=0;i<instances.length;i++)for(let j=i+1;j<instances.length;j++){
      const a=instances[i],b=instances[j];if(a.busy||b.busy)continue;
      if(testIsolation&&!(testIsolation.has(a.id)&&testIsolation.has(b.id)))continue;
      const centerDelta=b.group.position.clone().sub(a.group.position),centerDistance=centerDelta.length();if(centerDistance>4.25+a.interactionRadius+b.interactionRadius)continue;
      activePairs.push([a,b]);
      for(let ai=0;ai<a.record.atoms.length;ai++)for(let bi=0;bi<b.record.atoms.length;bi++){
        const atomA=a.record.atoms[ai],atomB=b.record.atoms[bi],pointA=atomWorldPositions.get(a)[ai],pointB=atomWorldPositions.get(b)[bi],delta=pointB.clone().sub(pointA),separation=delta.length();if(separation<1e-5)continue;
        const minimum=(modelAtomRadius(atomA.element)+modelAtomRadius(atomB.element))*.92;
        if(separation<minimum){const magnitude=Math.min(.075,(minimum-separation)*.045),push=delta.normalize().multiplyScalar(-magnitude);applyForce(accumulators,a,push,pointA);applyForce(accumulators,b,push.clone().negate(),pointB);}
        if(separation<4.25&&Math.abs(a.interactionCharges[ai])>.004&&Math.abs(b.interactionCharges[bi])>.004){
          const forces=coulombPairForces(a.interactionCharges[ai],b.interactionCharges[bi],delta,{strength:.42,softening:.85,cutoff:4.25,maxForce:.025});
          applyForce(accumulators,a,vector(THREE,forces.onA),pointA);applyForce(accumulators,b,vector(THREE,forces.onB),pointB);
        }
      }
    }
    // A spring is created only for a tracked donor-H···acceptor state.
    for(const bond of hydrogenBonds.values()){
      const donor=instanceById(bond.donorInstanceId),acceptor=instanceById(bond.acceptorInstanceId);if(!donor||!acceptor)continue;
      const hydrogenPoint=atomWorld(donor,bond.donorHydrogenAtom),acceptorPoint=atomWorld(acceptor,bond.acceptorAtom),delta=acceptorPoint.clone().sub(hydrogenPoint),separation=delta.length();if(separation<1e-5)continue;
      const direction=delta.clone().normalize(),relative=acceptor.velocity.clone().sub(donor.velocity).dot(direction),forces=hydrogenBondSpringForces(delta,bond.restLength,relative);
      applyForce(accumulators,donor,vector(THREE,forces.onDonor),hydrogenPoint);applyForce(accumulators,acceptor,vector(THREE,forces.onAcceptor),acceptorPoint);
    }
    for(const [item,accumulator] of accumulators){
      const dragged=item===selected&&down?.group===item;if(dragged)continue;
      item.velocity.addScaledVector(accumulator.force,.07*dtScale).multiplyScalar(Math.pow(.985,dtScale));
      item.velocity.x+=(Math.random()-.5)*.001*dtScale;item.velocity.y+=(Math.random()-.5)*.001*dtScale;
      item.velocity.clampLength(0,.045);item.group.position.addScaledVector(item.velocity,dtScale);
      item.angularVelocity.addScaledVector(accumulator.torque,.22/accumulator.inertia*dtScale).multiplyScalar(Math.pow(.94,dtScale));
      item.angularVelocity.add(new THREE.Vector3((Math.random()-.5)*.00012,(Math.random()-.5)*.00012,(Math.random()-.5)*.00008).multiplyScalar(dtScale)).clampLength(0,.026);
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
    if(Math.floor(now/160)!==Math.floor((now-dt)/160)){drawHBonds();reactionStep(now);}
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
      snapshot:()=>({instances:instances.map(item=>({id:item.id,species:item.species,atomCount:item.record.atoms.length,busy:item.busy,position:item.group.position.toArray(),dragSpeed:item.dragSpeed,charges:[...item.interactionCharges]})),bonds:hydrogenBonds.values().map(bond=>({key:bond.key,endpoints:hydrogenBondVisualEndpoints(bond),distance:bond.distance})),camera:{distance,azimuth,elevation},selectedInstanceId:selected?.id??null,downInstanceId:down?.group?.id??null,dialogOpen:dialog.open,pointerActive:activePointers.size>0}),
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
      arrangeHydrogenBond(){
        const waters=instances.filter(item=>item.species==='water');if(waters.length<2)throw Error('Water-only population is required');
        const [donor,acceptor]=waters,axis=cameraRight();
        testIsolation=new Set([donor.id,acceptor.id]);
        for(const item of instances){item.velocity.set(0,0,0);item.angularVelocity.set(0,0,0);item.group.position.set(4.8,2.65,0);item.group.rotation.set(0,0,0);}
        clearBonds();contactMatcher.reset();
        const donorVector=vector(THREE,donor.record.atoms[1].point).sub(vector(THREE,donor.record.atoms[0].point)).normalize();
        donor.group.quaternion.setFromUnitVectors(donorVector,axis);donor.group.position.set(0,0,0);
        const acceptorVector=vector(THREE,acceptor.record.atoms[1].point).sub(vector(THREE,acceptor.record.atoms[0].point)).normalize().add(vector(THREE,acceptor.record.atoms[2].point).sub(vector(THREE,acceptor.record.atoms[0].point)).normalize()).normalize();
        acceptor.group.quaternion.setFromUnitVectors(acceptorVector,axis);
        const donorH=atomWorld(donor,1),acceptorO=atomWorld(acceptor,0);acceptor.group.position.add(donorH.clone().addScaledVector(axis,2.3).sub(acceptorO));
        const others=waters.slice(2);others.forEach((item,index)=>item.group.position.set(index%2?4.8:-4.8,index<2?2.65:-2.65,0));
        const started=updateHydrogenBondStates(performance.now());drawHBonds();
        return {donorId:donor.id,acceptorId:acceptor.id,axis:axis.toArray(),bonds:hydrogenBonds.values().length,alignment:alignmentFor(donor,0,1,acceptor,0),geometry:{from:atomWorld(donor,1).toArray(),to:atomWorld(acceptor,0).toArray()}};
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
      refresh(){updateHydrogenBondStates(performance.now());drawHBonds();return this.snapshot();},
    };
  }
  return {open,dispose(){disposed=true;resizeObserver.disconnect();clear();renderer.dispose();}};
}
