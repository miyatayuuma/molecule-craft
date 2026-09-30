import { createPreviewModel } from './preview-model.js?v=35';
import { ELEMENTS, formalChargeForRecordAtom, modelAtomRadius } from './chemistry.js?v=20';
import { aromaticBondKeys, aromaticRingFrame, createAromaticRing, displayedBondOrder, setAromaticOpacity, updateAromaticRing } from './aromatic-rendering.js?v=27';
import { createChargeLabel, createSharedBonds, sharedOxoGroups, specialEdgeKeys, updateSharedBonds } from './special-bonds.js?v=34';
import {
  reactionCandidates, planReactionExecution, resolveCandidateInstanceIds,
  compileReactionCatalog, createContactMatcher, scoreReactionGeometry,
  arbitrateReactionCandidateComponents, resolveSupplementalParticipants, supplementalSelectionCenter, environmentMatches, CONTACT_DWELL_MS,
} from './reaction-lab-core.js?v=13';
import { createReactionLabEnvironment, environmentTokensFromSnapshot } from './reaction-lab-environment.js?v=1';
import { createReactionLabBatch, deterministicFeedVariation, planFeedSchedule, REACTION_LAB_BATCH_PHASES } from './reaction-lab-batch.js?v=2';
import {createReactionLabPolymerizationCore,POLYMERIZATION_STATES,POLYMER_COMMIT_DWELL_MS} from './reaction-lab-polymerization.js?v=1';
import {createPolymerPresentationPlan} from './reaction-lab-polymer-presentation.js?v=1';
import {
  REACTION_LAB_WORLD_UNITS_PER_ANGSTROM, STAGE_A_GAME_STEP_SECONDS,
  STAGE_A_MAX_CATCH_UP_STEPS, STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,
  KCAL_MOL_AMU_TO_ANGSTROM_PS2, STANDARD_ATOMIC_MASS_AMU, createFixedStepAccumulator, createStageABody, evaluateStageAForces,
  integrateStageA, rigidBodyMassProperties, stageABodySnapshot, canonicalNonbondedPairGeometry,
} from './reaction-lab-stage-a.js?v=4';
import { STAGE_B_TEST_QA_E, createStageBPairSafetyOracle, createStageBVirtualSites, detectCarbonylAnisotropySites, evaluateStageBForces, evaluateStageBPairForcesReadOnly, integrateStageB, stageBCarbonylDiagnostics } from './reaction-lab-stage-b.js?v=3';
import { bondLaneSegments, fitRigidBodyVelocity, formalChargeVisualTransition, mapProductAtomOrigins, planBondLaneTransition, REACTION_PRESENTATION_NORMAL_PHASES as NORMAL_PRESENTATION_PHASES, REACTION_PRESENTATION_REDUCED_PHASES as REDUCED_PRESENTATION_PHASES, resolveProductTargetGeometry, resolveStaticFormalCharge, smoothPresentationProgress, staticBondLaneOffsets, transportBondLaneSide } from './reaction-lab-presentation.js?v=1';
import {
  chooseDepthTarget, CHAMBER_TIME_MODES, createChamberTimeAuthority,
  DEPTH_DOCKING_TIME_CONSTANT_MS, DEPTH_TARGET_ACQUIRE_PADDING_PX,
  DEPTH_TARGET_RELEASE_PADDING_PX, GRAB_FALLBACK_RADIUS_PX,
  MAX_DOCK_RELEASE_SEPARATION_ACCELERATION,
  MAX_DOCKING_COMPRESSION_WORLD, minimumMoleculeSurfaceGap, projectedSurfaceGap,
  scaleSimulationElapsed, solveSafeDepthDocking,
} from './reaction-lab-manipulation.js?v=3';

const vector=(THREE,point)=>Array.isArray(point)?new THREE.Vector3(point[0],point[1],point[2]):new THREE.Vector3(point.x,point.y,point.z);
const recordAtomElement=(record,index)=>typeof record?.atoms?.[index]==='string'?record.atoms[index]:record?.atoms?.[index]?.element;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const FIXED_CAMERA_AZIMUTH=0;
const FIXED_CAMERA_ELEVATION=0;
const CHAMBER_PRESENTATION_MS=1200;
const MAX_HANDOFF_CORRECTION_ANGSTROM=20;
const FLUSH_PRESENTATION_MS=760;
const FEED_TRAVEL_MS=330;
const CAMERA_MIN_DISTANCE=7;
const CAMERA_MAX_DISTANCE=64;
const POLYMER_DOCK_ACQUIRE_PX=DEPTH_TARGET_ACQUIRE_PADDING_PX;
const POLYMER_DOCK_RELEASE_PX=DEPTH_TARGET_RELEASE_PADDING_PX;
const POLYMER_DOCK_DISTANCE_ANGSTROM=1.48;
const POLYMER_DOCK_MS=430;
const POLYMER_DOCK_PRESENT_MS=450;
const POLYMER_SAMPLE_HOLD_MS=650;
const POLYMER_SAMPLE_REDUCED_HOLD_MS=250;

export function reserveParticipantInstances(participantInstances,instances,generation,requiredRoles=Object.keys(participantInstances??{})){
  if(!participantInstances||!Array.isArray(requiredRoles)||!requiredRoles.length)return{ok:false,reason:'missing-reaction-participant'};
  const ids=requiredRoles.map(role=>participantInstances[role]);
  if(ids.some(id=>typeof id!=='string'||!id))return{ok:false,reason:'missing-reaction-participant'};
  if(new Set(ids).size!==ids.length)return{ok:false,reason:'duplicate-reaction-participant'};
  const byId=new Map(instances.map(item=>[item.id,item])),participants=ids.map(id=>byId.get(id));
  if(participants.some(item=>!item))return{ok:false,reason:'participant-missing'};
  if(participants.some(item=>item.busy))return{ok:false,reason:'participant-busy'};
  if(participants.some(item=>item.batchGeneration!==generation))return{ok:false,reason:'batch-generation-mismatch'};
  participants.sort((a,b)=>a.id.localeCompare(b.id));
  for(const item of participants)item.busy=true;
  return{ok:true,participants};
}

export function createReactionLabViewer({THREE,dialog,root,records,collectionState,polymerRoutes=[],polymerSitePatterns=[],onDialogStateChange=()=>{},onPointerLockChange=()=>{}}){
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
  const feedButton=root.querySelector('[data-lab-feed]'),commandState=root.querySelector('[data-lab-command-state]');
  const picker=root.querySelector('[data-lab-picker]'),pickerList=root.querySelector('[data-lab-picker-list]'),pickerSearch=root.querySelector('[data-lab-search]');
  const lightButton=root.querySelector('[data-lab-light]'),heatButton=root.querySelector('[data-lab-heat]'),mediumButton=root.querySelector('[data-lab-medium-port]'),mediumSelector=root.querySelector('[data-lab-medium-selector]'),mediumInputs=[...root.querySelectorAll('[data-lab-medium]')];
  const activationEnvironment=createReactionLabEnvironment();let mediumSelectorOpen=false;
  const batch=createReactionLabBatch(records),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const polymerCore=createReactionLabPolymerizationCore({records,routes:polymerRoutes,sitePatterns:polymerSitePatterns});
  const reactionCatalog=compileReactionCatalog(records);
  const eventController=new AbortController(),eventOptions={signal:eventController.signal};
  const recordsById=new Map(records.map(record=>[record.id,record]));
  const scene=new THREE.Scene();scene.background=new THREE.Color('#0a1724');
  const camera=new THREE.PerspectiveCamera(42,1,.1,100);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene.add(new THREE.HemisphereLight(0xd9efff,0x162231,2.2));
  const keyLight=new THREE.DirectionalLight(0xffffff,3);keyLight.position.set(3,6,7);scene.add(keyLight);
  const world=new THREE.Group();scene.add(world);

  let instances=[],purgeItems=[],selected=null,down=null,testIsolation=null,polymerRouteOwned=false,polymerBeginError=null;
  let polymerReservedById=new Map(),polymerSourceRecordsById={},polymerGraphVisual=null,polymerDocking=null,polymerAutoMotion=null,polymerSamplePresentation=null,polymerDockAttempt=null,polymerAutoAttempt=null;
  let distance=15,last=performance.now(),disposed=false,reactionAnimation=null,lastReactionPresentation=null,batchTransition=null,simulationClockSeconds=0,animationFrameId=0,pickerOpen=false,pickerSlotIndex=-1,pickerSource=null;
  let dialogOpenState=!!dialog.open;const closeWaiters=new Set();
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const contactMatcher=createContactMatcher();
  let reactionDiagnostics=[],reactionTrajectoryTrace=null;
  let instanceSequence=0,stageAForces={bodies:new Map(),pairDiagnostics:[],overlapGuardActivationCount:0},stageAPerformance={lastPhysicsDurationMs:0,lastFixedStepDurationMs:0,lastInteractionPairCount:0,lastFrameStepCount:0,lastDroppedGameSeconds:0,fixedSteps:0};
  const activePointers=new Map();
  const chamberTime=createChamberTimeAuthority(),isManipulating=()=>chamberTime.mode===CHAMBER_TIME_MODES.MANIPULATING;
  let pinchActive=false,pinchDistance=0,depthTarget=null,depthDockingState='none',pointerAnchorErrorPx=0,depthSafetyOracle=null,depthSafetyPairKey=null,depthOutwardAcceleration=Infinity,depthSafetySampleCount=0;
  const chamber=root.querySelector('.reaction-lab-space');
  let targetIndicator=root.querySelector('[data-depth-target-indicator]');
  if(!targetIndicator){targetIndicator=document.createElement('div');targetIndicator.className='reaction-lab-target-indicator';targetIndicator.dataset.depthTargetIndicator='';targetIndicator.setAttribute('aria-hidden','true');targetIndicator.hidden=true;chamber.append(targetIndicator);}
  let polymerSiteIndicator=root.querySelector('[data-polymer-site-indicator]');
  if(!polymerSiteIndicator){polymerSiteIndicator=document.createElement('div');polymerSiteIndicator.className='reaction-lab-polymer-site';polymerSiteIndicator.dataset.polymerSiteIndicator='';polymerSiteIndicator.setAttribute('aria-hidden','true');polymerSiteIndicator.hidden=true;chamber.append(polymerSiteIndicator);}
  let polymerIncomingIndicator=root.querySelector('[data-polymer-incoming-indicator]');
  if(!polymerIncomingIndicator){polymerIncomingIndicator=document.createElement('div');polymerIncomingIndicator.className='reaction-lab-polymer-incoming';polymerIncomingIndicator.dataset.polymerIncomingIndicator='';polymerIncomingIndicator.setAttribute('aria-hidden','true');polymerIncomingIndicator.hidden=true;chamber.append(polymerIncomingIndicator);}
  let polymerSampleBay=root.querySelector('[data-polymer-sample-bay]');
  if(!polymerSampleBay){polymerSampleBay=document.createElement('div');polymerSampleBay.className='reaction-lab-sample-bay';polymerSampleBay.dataset.polymerSampleBay='';polymerSampleBay.hidden=true;polymerSampleBay.innerHTML='<span>SAMPLE BAY</span><small data-polymer-sample-label>REPRESENTATIVE SEGMENT</small>';chamber.append(polymerSampleBay);}

  function resize(){const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);resize();
  function updateCamera(){camera.position.set(distance*Math.sin(FIXED_CAMERA_AZIMUTH)*Math.cos(FIXED_CAMERA_ELEVATION),distance*Math.sin(FIXED_CAMERA_ELEVATION),distance*Math.cos(FIXED_CAMERA_AZIMUTH)*Math.cos(FIXED_CAMERA_ELEVATION));camera.lookAt(0,0,0);camera.updateMatrixWorld();}
  function cameraNormal(){camera.updateMatrixWorld();return camera.getWorldDirection(new THREE.Vector3());}
  function cameraRight(){camera.updateMatrixWorld();return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).normalize();}
  function cameraUp(){camera.updateMatrixWorld();return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1).normalize();}
  function rayForEvent(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);}
  function atomWorld(item,index){const atom=item.record.atoms[index];return item.group.localToWorld(vector(THREE,atom.point));}
  function atomWorldAngstrom(item,index){return atomWorld(item,index).toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM);}
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
  function clearDepthTarget(){depthTarget=null;depthDockingState='none';pointerAnchorErrorPx=0;depthSafetyOracle=null;depthSafetyPairKey=null;depthOutwardAcceleration=Infinity;depthSafetySampleCount=0;targetIndicator.hidden=true;}
  function endManipulation(){
    const item=selected;
    if(item){syncStageABodyFromGroup(item);item.stageBody.velocityAngstromPerPs=[0,0,0];}
    selected=null;down=null;chamberTime.setMode(CHAMBER_TIME_MODES.NORMAL);clearDepthTarget();
  }
  function instanceById(id){return instances.find(item=>item.id===id)??null;}
  function disposeObject(object){object?.traverse?.(child=>{child.geometry?.dispose?.();if(child.userData?.formalCharge)child.material?.map?.dispose?.();if(Array.isArray(child.material))child.material.forEach(material=>material.dispose?.());else child.material?.dispose?.();});}
  function disposeItem(item){world.remove(item.group);disposeObject(item.group);}
  function clear(){endManipulation();for(const pointerId of activePointers.keys())try{if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}activePointers.clear();const extra=polymerGraphVisual? [{id:polymerSamplePresentation?.sampleId??'polymer-fragment',species:'PolymerSample',group:polymerGraphVisual.group}]:[];for(const item of new Set([...instances,...purgeItems,...(batchTransition?.items??[]),...extra]))disposeItem(item);if(reactionAnimation){if(!reactionAnimation.sourceGroupsDisposed)for(const item of reactionAnimation.participants)disposeItem(item);world.remove(reactionAnimation.root);disposeObject(reactionAnimation.root);}instances=[];purgeItems=[];batchTransition=null;reactionAnimation=null;polymerGraphVisual=null;polymerSamplePresentation=null;polymerDocking=null;polymerAutoMotion=null;polymerReservedById.clear();polymerRouteOwned=false;polymerSiteIndicator.hidden=true;polymerSampleBay.hidden=true;lastReactionPresentation=null;contactMatcher.reset();testIsolation=null;reactionDiagnostics=[];}

  function buildStageBody(id,record,atoms,position,orientation,massProperties){
    const body=createStageABody({id,positionAngstrom:position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM),orientation:[orientation.x,orientation.y,orientation.z,orientation.w],atoms:atoms.map((atom,index)=>({element:atom.element,chargeE:record.nonbonded.atomicChargesE[index],sigmaAngstrom:record.nonbonded.sigmaAngstrom[index],epsilonKcalMol:record.nonbonded.epsilonKcalMol[index],positionAngstrom:atom.point.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)})),virtualChargeSites:record.nonbonded.virtualChargeSites.map(site=>({chargeE:site.chargeE,positionAngstrom:site.positionAngstromAngstrom??site.positionAngstrom})),massProperties});
    if(stageBPhysicsEnabled){const geometryAtoms=atoms.map(atom=>({element:atom.element,positionAngstrom:atom.point.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)}));body.carbonylAnisotropySites=detectCarbonylAnisotropySites(geometryAtoms,record.bonds,{qA:stageBChargeE});body.stageBVirtualChargeSites=createStageBVirtualSites(geometryAtoms,record.bonds,{qA:stageBChargeE});}
    else{body.carbonylAnisotropySites=[];body.stageBVirtualChargeSites=[];}
    return body;
  }
  function withStaticChargeAuthority(model,record){
    const suppressed=new Set((model.sharedGroups??[]).filter(group=>['nitro','ozone'].includes(group.kind)).flatMap(group=>[group.center,...group.ends]));
    return{...model,atoms:model.atoms.map((atom,index)=>({...atom,charge:resolveStaticFormalCharge(atom.charge,Object.hasOwn(record,'formalCharges')?formalChargeForRecordAtom(record,index):null,suppressed.has(index))}))};
  }
  function sourceContinuityPreview(product){
    const atoms=product.record.atoms.map((value,index)=>({id:index,element:typeof value==='string'?value:value.element,charge:formalChargeForRecordAtom(product.record,index),point:product.sourcePoints[index].clone().sub(product.sourceCenter)})),bonds=product.record.bonds.map(([a,b,order])=>({a,b,order}));
    return withStaticChargeAuthority({atoms,bonds,ports:[],aromaticCycles:[],sharedGroups:sharedOxoGroups(product.record)},product.record);
  }

  function createInstance(record,position,{generation=batch.generation,orientation=null,originPortIndex=null,feedPhase='chamber',preparedModel=null,instanceId=null}={}){
    let model=preparedModel;
    if(!model){const preview=createPreviewModel(THREE,record);for(let index=0;index<190;index++)preview.step();model=preview.snapshot();}
    model=withStaticChargeAuthority(model,record);
    const group=new THREE.Group(),id=instanceId??`${record.id}-${++instanceSequence}`;if(instanceId)instanceSequence++;
    if(!record.nonbonded)throw new Error(`Canonical nonbonded data is required for ${record.id}.`);
    const massProperties=rigidBodyMassProperties(model.atoms.map(atom=>({element:atom.element,positionAngstrom:atom.point.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)})));
    const renderAtoms=model.atoms.map((atom,index)=>({...atom,point:vector(THREE,massProperties.centeredPositionsAngstrom[index].map(value=>value*REACTION_LAB_WORLD_UNITS_PER_ANGSTROM))}));
    group.position.copy(position);if(orientation)group.rotation.set(orientation.pitch,orientation.yaw,orientation.roll);
    const atomMeshes=new Map();
    for(const atom of renderAtoms){const geometry=new THREE.SphereGeometry(modelAtomRadius(atom.element),16,12),material=new THREE.MeshStandardMaterial({color:ELEMENTS[atom.element]?.color??'#cbd5e1',roughness:.32,metalness:.08}),mesh=new THREE.Mesh(geometry,material);mesh.position.copy(atom.point);mesh.userData.atomIndex=atom.id;atomMeshes.set(atom.id,mesh);group.add(mesh);if(atom.charge){const label=createChargeLabel(THREE,atom.charge,document);label.position.copy(atom.point).add(new THREE.Vector3(0,modelAtomRadius(atom.element)+.12,0));group.add(label);}}
    const sharedGroups=model.sharedGroups??[],aromaticCycles=model.aromaticCycles??[],specialEdges=specialEdgeKeys(sharedGroups),aromaticEdges=aromaticBondKeys(aromaticCycles),adjacency=renderAtoms.map(()=>[]);
    for(const bond of model.bonds){adjacency[bond.a].push(bond.b);adjacency[bond.b].push(bond.a);}
    const bondMaterial=new THREE.MeshStandardMaterial({color:'#c3d2dc',roughness:.6});
    for(const bond of model.bonds){
      const order=displayedBondOrder(bond,new Set([...aromaticEdges,...specialEdges])),a=renderAtoms[bond.a].point,b=renderAtoms[bond.b].point,axis=b.clone().sub(a).normalize(),midpoint=a.clone().add(b).multiplyScalar(.5);
      const neighbor=[...adjacency[bond.a],...adjacency[bond.b]].find(index=>index!==bond.a&&index!==bond.b),reference=neighbor===undefined?new THREE.Vector3(Math.abs(axis.z)<.85?0:1,0,Math.abs(axis.z)<.85?1:0):renderAtoms[neighbor].point.clone().sub(midpoint);
      const side=new THREE.Vector3().crossVectors(axis,reference).normalize();if(side.lengthSq()<1e-9)side.set(0,1,0);
      const offsets=staticBondLaneOffsets(order);
      for(const offset of offsets){const geometry=new THREE.CylinderGeometry(.055,.055,a.distanceTo(b),8),material=bondMaterial.clone(),mesh=new THREE.Mesh(geometry,material);mesh.position.copy(midpoint).addScaledVector(side,offset);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);group.add(mesh);}
    }
    for(const cycle of aromaticCycles){const ring=createAromaticRing(THREE);updateAromaticRing(THREE,ring,aromaticRingFrame(THREE,cycle.map(id=>renderAtoms[id].point)));group.add(ring);}
    const positionFor=id=>renderAtoms[id]?.point??null;
    for(const shared of sharedGroups){const visual=createSharedBonds(THREE);updateSharedBonds(THREE,visual,shared,positionFor);group.add(visual);}
    world.add(group);
    const item={id,species:record.id,record:{...record,atoms:renderAtoms,bonds:model.bonds,aromaticCycles,sharedGroups},atomMeshes,group,busy:false,batchGeneration:generation,feedOriginPortIndex:originPortIndex,feedPhase,feedHandoff:false};
    if(localhostPhysicsTest)item.initialPositionAtSpawn=position.toArray();
    item.stageBody=buildStageBody(id,record,renderAtoms,group.position,group.quaternion,massProperties);
    instances.push(item);return item;
  }

  const polymerOriginKey=origin=>`${origin.instanceId}:${origin.sourceAtomIndex}`;
  function disposePolymerVisual(){
    if(polymerGraphVisual){world.remove(polymerGraphVisual.group);disposeObject(polymerGraphVisual.group);}
    polymerGraphVisual=null;polymerSiteIndicator.hidden=true;polymerIncomingIndicator.hidden=true;polymerSampleBay.hidden=true;polymerSamplePresentation=null;
  }
  function polymerPresentationPlan(fragment,representation={}){
    return createPolymerPresentationPlan({polymerId:polymerCore.snapshot()?.polymerId??'polymer',routeId:polymerCore.snapshot()?.routeId??'polymer',fragment,representation},{sourceRecordsByInstanceId:polymerSourceRecordsById});
  }
  function updatePolymerBondVisuals(){
    const visual=polymerGraphVisual;if(!visual)return;
    for(const mesh of visual.bondMeshes){visual.group.remove(mesh);disposeObject(mesh);}visual.bondMeshes=[];
    const graph=visual.graph;if(!graph)return;
    for(const bond of graph.bonds){
      const a=visual.atomByGraphIndex.get(bond.a),b=visual.atomByGraphIndex.get(bond.b);if(!a||!b)continue;
      const axis=b.position.clone().sub(a.position),length=axis.length();if(!Number.isFinite(length)||length<.001)continue;
      const direction=axis.clone().normalize(),reference=new THREE.Vector3(0,0,1),side=new THREE.Vector3().crossVectors(direction,reference).normalize();if(side.lengthSq()<1e-8)side.set(0,1,0);
      const lanes=bond.order>=2?[-.055,.055]:[0];
      for(const offset of lanes){const geometry=new THREE.CylinderGeometry(.038,.038,length,8),material=new THREE.MeshStandardMaterial({color:'#b8d1de',roughness:.5}),mesh=new THREE.Mesh(geometry,material);mesh.position.copy(a.position).add(b.position).multiplyScalar(.5).addScaledVector(side,offset);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);visual.group.add(mesh);visual.bondMeshes.push(mesh);}
    }
    if(visual.representation?.continuations?.length){
      for(const item of visual.representation.continuations){const atomIndex=Number.isInteger(item.atomRef)?item.atomRef:Number.parseInt(String(item.atomRef).split(':').at(-1),10),atom=visual.atomByGraphIndex.get(atomIndex);if(!atom)continue;
        const point=atom.position.clone().add(new THREE.Vector3(0,.82,0)),ring=new THREE.Mesh(new THREE.TorusGeometry(.14,.025,6,18),new THREE.MeshBasicMaterial({color:'#83d7cd'}));ring.position.copy(point);visual.group.add(ring);visual.bondMeshes.push(ring);
      }
    }
  }
  function mergePolymerSourceAtoms(fragment){
    if(!polymerGraphVisual){polymerGraphVisual={group:new THREE.Group(),atomMeshesByOrigin:new Map(),atomByGraphIndex:new Map(),bondMeshes:[],animation:null,graph:null,representation:{}};world.add(polymerGraphVisual.group);}
    const visual=polymerGraphVisual;
    for(const origin of fragment.atomOrigins){
      const key=polymerOriginKey(origin);if(visual.atomMeshesByOrigin.has(key))continue;
      const item=polymerReservedById.get(origin.instanceId),mesh=item?.atomMeshes?.get(origin.sourceAtomIndex);if(!item||!mesh)throw new Error(`Polymer source atom visual is missing: ${key}`);
      visual.group.attach(mesh);mesh.userData.atomIndex=origin.sourceAtomIndex;visual.atomMeshesByOrigin.set(key,mesh);
    }
    const consumed=new Set(fragment.atomOrigins.map(origin=>origin.instanceId));
    for(const id of consumed){const item=polymerReservedById.get(id);if(!item||!instances.includes(item))continue;instances=instances.filter(candidate=>candidate!==item);item.polymerDocking=false;item.stageBody.kinematic=true;disposeItem(item);}
    return visual;
  }
  function renderPolymerGraph(fragment,{representation={},durationMs=260}={}){
    const plan=polymerPresentationPlan(fragment,representation),visual=mergePolymerSourceAtoms(fragment),from=new Map();visual.atomByGraphIndex.clear();
    for(let index=0;index<fragment.atomOrigins.length;index++){
      const mesh=visual.atomMeshesByOrigin.get(polymerOriginKey(fragment.atomOrigins[index]));if(!mesh)continue;
      from.set(index,mesh.position.clone());visual.atomByGraphIndex.set(index,mesh);mesh.userData.polymerAtom=true;
    }
    visual.graph=fragment;visual.representation=representation;visual.animation={from,to:plan.atoms.map(atom=>new THREE.Vector3(atom.x,atom.y,atom.z)),elapsedMs:0,durationMs};
    updatePolymerBondVisuals();updatePolymerSiteIndicator();return plan;
  }
  function updatePolymerGraphVisual(elapsedMs){
    const visual=polymerGraphVisual;if(!visual)return;
    const animation=visual.animation;
    if(animation){animation.elapsedMs+=elapsedMs;const progress=clamp(animation.elapsedMs/animation.durationMs,0,1),eased=progress*progress*(3-2*progress);
      for(let index=0;index<animation.to.length;index++){const mesh=visual.atomByGraphIndex.get(index),from=animation.from.get(index),to=animation.to[index];if(mesh&&from)mesh.position.lerpVectors(from,to,eased);}
      if(progress>=1)visual.animation=null;
      updatePolymerBondVisuals();
    }
    visual.group.updateMatrixWorld(true);
  }
  function polymerNextCandidates(){
    const tx=polymerCore.snapshot();if(!tx)return[];const route=polymerRoutes.find(item=>item.routeId===tx.routeId),species=route?.representativeSequence[tx.sequenceIndex];if(!species)return[];
    const consumed=new Set(tx.consumedInstanceIds);return[...polymerReservedById.values()].filter(item=>item.species===species&&!consumed.has(item.id)&&instances.includes(item)).sort((a,b)=>a.id.localeCompare(b.id));
  }
  function polymerInteraction(item){return polymerCore.previewManualStep(item?.id);}
  function polymerTargetWorld(interaction){
    const mesh=polymerGraphVisual?.atomByGraphIndex.get(interaction?.fragmentAtomIndex);if(!mesh)return null;polymerGraphVisual.group.updateMatrixWorld(true);return mesh.getWorldPosition(new THREE.Vector3());
  }
  function updatePolymerSiteIndicator(){
    const hide=()=>{polymerSiteIndicator.hidden=true;polymerSiteIndicator.dataset.acquired='false';polymerSiteIndicator.classList.remove('acquired');polymerIncomingIndicator.hidden=true;};
    const tx=polymerCore.snapshot();if(!polymerRouteOwned||!tx||![POLYMERIZATION_STATES.WAITING,POLYMERIZATION_STATES.AUTO_PENDING].includes(tx.state)||tx.waitReason==='conditions'||!polymerGraphVisual){hide();return;}
    if(polymerGraphVisual.animation){hide();return;}
    const item=polymerNextCandidates()[0],preview=polymerInteraction(item);if(!item||!preview.ok){hide();return;}
    const point=polymerTargetWorld(preview.interaction);if(!point){hide();return;}
    const screen=projectPoint(point),rect=chamber.getBoundingClientRect();if(screen.z < -1||screen.z>1||screen.x<rect.left||screen.x>rect.right||screen.y<rect.top||screen.y>rect.bottom){hide();return;}
    const draggingPolymer=selected?.polymerReservation===polymerCore.routeId,dragged=draggingPolymer?selected:item,draggedPreview=polymerInteraction(dragged),site=draggedPreview.ok?projectPoint(atomWorld(dragged,draggedPreview.interaction.incomingAtomIndex)):null,wasAcquired=polymerSiteIndicator.dataset.acquired==='true',acquired=site&&Math.hypot(site.x-screen.x,site.y-screen.y)<=(wasAcquired?POLYMER_DOCK_RELEASE_PX:POLYMER_DOCK_ACQUIRE_PX);
    polymerSiteIndicator.textContent=preview.interaction.semantic;polymerSiteIndicator.dataset.instanceId=item.id;polymerSiteIndicator.dataset.targetX=String(screen.x);polymerSiteIndicator.dataset.targetY=String(screen.y);polymerSiteIndicator.dataset.acquired=String(!!acquired);polymerSiteIndicator.classList.toggle('acquired',!!acquired);polymerSiteIndicator.style.left=`${screen.x-rect.left}px`;polymerSiteIndicator.style.top=`${screen.y-rect.top}px`;polymerSiteIndicator.hidden=false;
    if(draggingPolymer&&site&&site.z>=-1&&site.z<=1){polymerIncomingIndicator.style.left=`${site.x-rect.left}px`;polymerIncomingIndicator.style.top=`${site.y-rect.top}px`;polymerIncomingIndicator.hidden=false;}else polymerIncomingIndicator.hidden=true;
  }
  function polymerGeometrySafe(item,interaction,position,{allowFormingBond=true}={}){
    if(!item||!polymerGraphVisual||!interaction||!position?.toArray?.().every(Number.isFinite))return false;
    const target=polymerTargetWorld(interaction);if(!target)return false;
    const incomingSite=item.record.atoms[interaction.incomingAtomIndex],incomingPosition=position.clone().add(incomingSite.point.clone().applyQuaternion(item.group.quaternion));
    const distance=incomingPosition.distanceTo(target),ideal=POLYMER_DOCK_DISTANCE_ANGSTROM*REACTION_LAB_WORLD_UNITS_PER_ANGSTROM;
    if(Math.abs(distance-ideal)>.03)return false;
    for(let index=0;index<item.record.atoms.length;index++){
      const incomingAtom=item.record.atoms[index],worldPoint=position.clone().add(incomingAtom.point.clone().applyQuaternion(item.group.quaternion));
      for(const [fragmentIndex,fragmentAtom]of polymerGraphVisual.atomByGraphIndex){
        if(allowFormingBond&&index===interaction.incomingAtomIndex&&fragmentIndex===interaction.fragmentAtomIndex)continue;
        const required=(modelAtomRadius(incomingAtom.element)+modelAtomRadius(recordAtomElement(polymerGraphVisual.graph,fragmentIndex)))*.58;
        if(worldPoint.distanceTo(fragmentAtom.getWorldPosition(new THREE.Vector3()))<required)return false;
      }
    }
    return true;
  }
  function polymerDockPose(item,interaction){
    const target=polymerTargetWorld(interaction);if(!target)return null;
    const incoming=atomWorld(item,interaction.incomingAtomIndex),direction=incoming.clone().sub(target);if(direction.lengthSq()<1e-9)direction.copy(cameraRight());direction.normalize();
    const local=item.record.atoms[interaction.incomingAtomIndex].point.clone().applyQuaternion(item.group.quaternion),desiredAtom=target.addScaledVector(direction,POLYMER_DOCK_DISTANCE_ANGSTROM*REACTION_LAB_WORLD_UNITS_PER_ANGSTROM),position=desiredAtom.sub(local);
    if(!position.toArray().every(Number.isFinite)||position.distanceTo(item.group.position)>2.8)return null;
    return position;
  }
  function startManualPolymerDock(item,event){
    const reject=(reason,detail={})=>{if(localhostPhysicsTest)polymerDockAttempt={ok:false,reason,...detail};return false;};
    if(!polymerRouteOwned||polymerCore.state!==POLYMERIZATION_STATES.WAITING||!item?.polymerReservation||item.polymerReservation!==polymerCore.routeId)return reject('ownership-or-state');
    if(polymerGraphVisual?.animation)return reject('graph-presentation-in-progress');
    updatePolymerSiteIndicator();const preview=polymerInteraction(item);if(!preview.ok)return reject('preview',{previewReason:preview.reason});
    const target=polymerTargetWorld(preview.interaction),targetScreen=target?projectPoint(target):null,incomingScreen=projectPoint(atomWorld(item,preview.interaction.incomingAtomIndex));
    const targetIncomingDistancePx=targetScreen?Math.hypot(targetScreen.x-incomingScreen.x,targetScreen.y-incomingScreen.y):Infinity,targetPointerDistancePx=targetScreen?Math.hypot(targetScreen.x-event.clientX,targetScreen.y-event.clientY):Infinity;
    if(!targetScreen||targetScreen.z < -1||targetScreen.z>1)return reject('target-outside-view',{targetScreen});
    if(polymerSiteIndicator.dataset.acquired!=='true'||targetIncomingDistancePx>POLYMER_DOCK_RELEASE_PX||targetPointerDistancePx>POLYMER_DOCK_RELEASE_PX)return reject('site-not-acquired',{acquired:polymerSiteIndicator.dataset.acquired==='true',targetIncomingDistancePx,targetPointerDistancePx,targetScreen,incomingScreen,pointer:{x:event.clientX,y:event.clientY}});
    const position=polymerDockPose(item,preview.interaction);if(!position)return reject('no-dock-pose',{current:item.group.position.toArray()});
    if(!polymerGeometrySafe(item,preview.interaction,position))return reject('unsafe-dock-pose',{current:item.group.position.toArray(),position:position.toArray()});
    endManipulation();item.group.position.copy(position);item.group.updateMatrixWorld(true);item.polymerDocking=true;item.stageBody.kinematic=true;syncStageABodyFromGroup(item);
    const begun=polymerCore.beginManualStep(item.id,{geometryValid:true});if(!begun.ok){item.polymerDocking=false;item.stageBody.kinematic=false;return reject('core-rejected',{coreReason:begun.reason});}
    polymerDocking={item,interaction:preview.interaction,kind:'manual'};clearDepthTarget();if(localhostPhysicsTest)polymerDockAttempt={ok:true,instanceId:item.id};return true;
  }
  function createPolymerByproduct(item){
    const record=recordsById.get(item.species);if(!record)return null;
    const center=polymerGraphVisual?.group.position??new THREE.Vector3(),position=center.clone().add(new THREE.Vector3(.7+(item.formationIndex??0)*.24,-1.2,0));
    return createInstance(record,position,{generation:batch.generation,instanceId:item.instanceId,feedPhase:'polymer-byproduct'});
  }
  function dispatchPolymerEvent(name,detail){window.dispatchEvent(new CustomEvent(name,{detail}));}
  function finishPolymerSample(result){
    const sample=result.sample,snapshot=polymerCore.snapshot(),route=polymerRoutes.find(item=>item.routeId===sample.routeId);if(!sample||!snapshot||!route)return;
    const byproducts=sample.evidence.byproducts.map(item=>({species:item.species,instanceId:item.instanceId,formationIndex:item.formationIndex}));
    for(const item of byproducts)if(!instances.some(instance=>instance.id===item.instanceId))createPolymerByproduct(item);
    polymerGraphVisual.representation=sample.representation;polymerGraphVisual.graph=sample.fragment;updatePolymerBondVisuals();
    polymerSamplePresentation={sampleId:sample.sampleId,batchGeneration:sample.batchGeneration,elapsedMs:0,ready:false,dismissed:false,phase:'settle',dockElapsedMs:0};
    dispatchPolymerEvent('molecule-craft:reaction-lab-polymer-sample',{routeId:sample.routeId,polymerId:sample.polymerId,sampleId:sample.sampleId,batchGeneration:sample.batchGeneration,sourceInstanceIds:[...snapshot.consumedInstanceIds],byproducts});
    polymerSiteIndicator.hidden=true;polymerSampleBay.hidden=false;polymerSampleBay.dataset.polymerId=sample.polymerId;polymerSampleBay.querySelector('[data-polymer-sample-label]').textContent='REPRESENTATIVE SEGMENT';
    status.textContent='POLYMER SAMPLE · READY FOR NEXT FEED';updatePolymerSiteIndicator();updateCommandBar();
  }
  function polymerSampleBayLayout(){
    if(!polymerGraphVisual)return null;
    const bounds=chamber.getBoundingClientRect(),bayWidth=Math.min(154,bounds.width*.42),bayHeight=Math.min(148,bounds.height*.34),margin=12,equipment=[...chamber.querySelectorAll('.reaction-lab-equipment,.reaction-lab-medium-selector:not([hidden]),.reaction-lab-purge-outlet')].filter(node=>!node.hidden).map(node=>{const rect=node.getBoundingClientRect();return{left:rect.left-margin,right:rect.right+margin,top:rect.top-margin,bottom:rect.bottom+margin};});
    const candidateFor=name=>{
      const leftEdge=bounds.left+14,rightEdge=bounds.right-14,top=bounds.top+14;let width=bayWidth,left=name==='upper-right'?rightEdge-width:leftEdge;
      for(const rect of equipment){if(rect.bottom<=top||rect.top>=top+bayHeight)continue;
        if(name==='upper-left'&&rect.right>left&&rect.left<left+width){if(rect.left<=left)width=0;else width=Math.min(width,rect.left-left);}
        if(name==='upper-right'&&rect.left<left+width&&rect.right>left){if(rect.right>=rightEdge)width=0;else{width=Math.min(width,rightEdge-rect.right);left=rightEdge-width;}}
      }
      const candidate={name,left,top,width,height:bayHeight};candidate.freeArea=width>=64?width*bayHeight:0;return candidate;
    };
    const candidates=['upper-right','upper-left'].map(candidateFor);
    const selected=candidates.sort((a,b)=>b.freeArea-a.freeArea||(a.name==='upper-right'?-1:1))[0],chamberRect=chamber.getBoundingClientRect();
    polymerSampleBay.style.left=`${selected.left-chamberRect.left}px`;polymerSampleBay.style.top=`${selected.top-chamberRect.top}px`;polymerSampleBay.style.width=`${selected.width}px`;polymerSampleBay.style.height=`${selected.height}px`;polymerSampleBay.dataset.region=selected.name;
    const canvasRect=canvas.getBoundingClientRect(),centerX=selected.left+selected.width*.5,centerY=selected.top+selected.height*.5,worldPerPixel=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/Math.max(1,canvasRect.height);
    const position=cameraRight().multiplyScalar((centerX-(canvasRect.left+canvasRect.width*.5))*worldPerPixel).addScaledVector(cameraUp(),-(centerY-(canvasRect.top+canvasRect.height*.5))*worldPerPixel);
    const plan=polymerPresentationPlan(polymerGraphVisual.graph,polymerGraphVisual.representation),fitWidth=(selected.width*.72)*worldPerPixel,fitHeight=(selected.height*.6)*worldPerPixel;
    const scale=clamp(Math.min(fitWidth/Math.max(plan.bounds.width,1),fitHeight/Math.max(plan.bounds.height,1)),.34,1);
    return{region:selected.name,position,scale};
  }
  function dockPolymerSample(progress=1){
    if(!polymerGraphVisual||!polymerSamplePresentation)return;
    const presentation=polymerSamplePresentation,layout=polymerSampleBayLayout();if(!layout)return;
    if(!presentation.fromPosition){presentation.fromPosition=polymerGraphVisual.group.position.clone();presentation.fromScale=polymerGraphVisual.group.scale.x;presentation.targetPosition=layout.position.clone();presentation.targetScale=layout.scale;presentation.region=layout.region;}
    if(presentation.phase==='hold'){polymerGraphVisual.group.position.copy(layout.position);polymerGraphVisual.group.scale.setScalar(layout.scale);presentation.targetPosition=layout.position.clone();presentation.targetScale=layout.scale;presentation.region=layout.region;}
    else{polymerGraphVisual.group.position.lerpVectors(presentation.fromPosition,layout.position,progress);polymerGraphVisual.group.scale.setScalar(presentation.fromScale+(layout.scale-presentation.fromScale)*progress);presentation.targetPosition=layout.position.clone();presentation.targetScale=layout.scale;presentation.region=layout.region;}
    polymerGraphVisual.group.updateMatrixWorld(true);
  }
  function reconcilePolymerCommit(result){
    const snapshot=polymerCore.snapshot();if(!snapshot)return;
    const made=[];
    for(const [formationIndex,id]of snapshot.byproductInstanceIds.entries())if(!instances.some(item=>item.id===id))made.push({species:'water',instanceId:id,formationIndex});
    for(const item of made)createPolymerByproduct(item);
    try{renderPolymerGraph(snapshot.fragment,{durationMs:reducedMotion?150:280});}
    catch(error){console.error('Polymer graph presentation fell back after chemistry commit.',error);if(!polymerGraphVisual){polymerGraphVisual={group:new THREE.Group(),atomMeshesByOrigin:new Map(),atomByGraphIndex:new Map(),bondMeshes:[],animation:null,graph:snapshot.fragment,representation:{}};world.add(polymerGraphVisual.group);}polymerGraphVisual.graph=snapshot.fragment;}
    if(result.finished)finishPolymerSample(result);
    polymerDocking=null;polymerAutoMotion=null;for(const item of polymerReservedById.values())item.polymerDocking=false;
    updatePolymerSiteIndicator();updateCommandBar();
  }
  function ensurePolymerProcessSetup(){
    const tx=polymerCore.snapshot();if(!polymerRouteOwned||!tx||tx.waitReason==='conditions'||polymerGraphVisual)return;
    const initialId=tx.consumedInstanceIds[0],fragment=tx.fragment;
    try{renderPolymerGraph(fragment,{durationMs:220});}catch(error){polymerBeginError=String(error?.message??error);status.textContent='POLYMERIZATION PAUSED';return;}
    const initial=polymerReservedById.get(initialId);if(initial&&instances.includes(initial)){instances=instances.filter(item=>item!==initial);disposeItem(initial);}
    status.textContent='POLYMERIZATION · CHAIN START';updatePolymerSiteIndicator();
  }
  function initializePolymerBatch(){
    polymerRouteOwned=!!polymerCore.routeFor(batch.activeSlots);polymerBeginError=null;polymerDockAttempt=null;polymerAutoAttempt=null;polymerReservedById=new Map();polymerSourceRecordsById={};polymerDocking=null;polymerAutoMotion=null;disposePolymerVisual();
    if(!polymerRouteOwned){updateCommandBar();return;}
    const begun=polymerCore.beginBatch({activeSlots:batch.activeSlots,batchGeneration:batch.generation,instances,environment:activationEnvironment.conditions()});
    if(!begun.ok){polymerBeginError=begun.reason;status.textContent='POLYMERIZATION PAUSED';updateCommandBar();return;}
    for(const id of begun.reservedInstanceIds){const item=instanceById(id);if(!item)continue;item.polymerReservation=begun.routeId;polymerReservedById.set(id,item);polymerSourceRecordsById[id]=item.record;}
    ensurePolymerProcessSetup();
    if(polymerCore.snapshot()?.waitReason==='conditions')status.textContent='POLYMERIZATION PAUSED';
    updateCommandBar();
  }
  function advancePolymerRuntime(stepMs){
    if(!polymerRouteOwned||!polymerCore.snapshot())return;
    ensurePolymerProcessSetup();
    const conditions=activationEnvironment.conditions();
    if(polymerDocking){
      const dock=polymerDocking,item=dock.item,valid=polymerGeometrySafe(item,dock.interaction,item.group.position),route=polymerRoutes.find(candidate=>candidate.routeId===polymerCore.routeId),conditionsValid=route?environmentMatches({requires:route.environment.requires,forbids:route.environment.forbids},conditions):false;
      const result=polymerCore.advanceFixedStep(stepMs,{visible:!document.hidden,labOpen:dialog.open,normal:!isManipulating(),conditionsValid,geometryValid:valid});
      if(result.committed)reconcilePolymerCommit(result);
      else if(polymerCore.state!==POLYMERIZATION_STATES.TRANSFORMING){if(localhostPhysicsTest&&dock.kind==='automatic')polymerAutoAttempt={stage:'dwell',reason:result.reason,geometryValid:valid,position:item.group.position.toArray()};item.polymerDocking=false;item.stageBody.kinematic=false;polymerDocking=null;status.textContent='POLYMERIZATION PAUSED';updatePolymerSiteIndicator();}
      return;
    }
    const tx=polymerCore.snapshot();if(tx?.state===POLYMERIZATION_STATES.AUTO_PENDING&&!polymerAutoMotion){
      if(polymerGraphVisual?.animation)return;
      const candidates=polymerNextCandidates().map(item=>({item,preview:polymerInteraction(item)})).filter(row=>row.preview.ok).sort((a,b)=>a.item.group.position.distanceTo(polymerTargetWorld(a.preview.interaction))-b.item.group.position.distanceTo(polymerTargetWorld(b.preview.interaction))||a.item.id.localeCompare(b.item.id));
      const evaluated=candidates.map(row=>{const target=polymerTargetWorld(row.preview.interaction),pose=polymerDockPose(row.item,row.preview.interaction),geometrySafe=!!pose&&polymerGeometrySafe(row.item,row.preview.interaction,pose);return{...row,target,pose,geometrySafe};});
      const choice=evaluated.find(row=>row.geometrySafe);
      if(!choice){if(localhostPhysicsTest)polymerAutoAttempt={stage:'select',reason:'no-safe-candidate',candidates:evaluated.map(row=>({id:row.item.id,position:row.item.group.position.toArray(),target:row.target?.toArray()??null,pose:row.pose?.toArray()??null,displacement:row.pose?.distanceTo(row.item.group.position)??null,geometrySafe:row.geometrySafe}))};polymerCore.autoFallback();status.textContent='POLYMERIZATION PAUSED';updatePolymerSiteIndicator();return;}
      polymerAutoMotion={item:choice.item,interaction:choice.preview.interaction,from:choice.item.group.position.clone(),to:choice.pose,elapsedMs:0,durationMs:reducedMotion?300:POLYMER_DOCK_MS};if(localhostPhysicsTest)polymerAutoAttempt={stage:'motion',instanceId:choice.item.id,from:choice.item.group.position.toArray(),to:choice.pose.toArray()};choice.item.polymerDocking=true;choice.item.stageBody.kinematic=true;status.textContent='POLYMERIZATION · PROCESS';
    }
  }
  function advancePolymerPresentation(elapsedMs){
    updatePolymerGraphVisual(elapsedMs);
    if(polymerAutoMotion){const motion=polymerAutoMotion;motion.elapsedMs+=elapsedMs;const progress=clamp(motion.elapsedMs/motion.durationMs,0,1),eased=progress*progress*(3-2*progress);motion.item.group.position.lerpVectors(motion.from,motion.to,eased);motion.item.group.updateMatrixWorld(true);syncStageABodyFromGroup(motion.item);
      if(progress>=1){motion.item.group.position.copy(motion.to);motion.item.group.updateMatrixWorld(true);syncStageABodyFromGroup(motion.item);const valid=polymerGeometrySafe(motion.item,motion.interaction,motion.item.group.position),begun=polymerCore.beginAutomaticStep(motion.item.id,{geometryValid:valid});if(begun.ok){polymerDocking={item:motion.item,interaction:motion.interaction,kind:'automatic'};if(localhostPhysicsTest)polymerAutoAttempt={...polymerAutoAttempt,stage:'dwell',geometryValid:valid};}else{if(localhostPhysicsTest)polymerAutoAttempt={...polymerAutoAttempt,stage:'begin',geometryValid:valid,reason:begun.reason};motion.item.polymerDocking=false;motion.item.stageBody.kinematic=false;polymerCore.autoFallback();status.textContent='POLYMERIZATION PAUSED';}polymerAutoMotion=null;updatePolymerSiteIndicator();}
    }
    if(polymerSamplePresentation){const presentation=polymerSamplePresentation;
      if(presentation.phase==='settle'&&!polymerGraphVisual?.animation)presentation.phase='dock';
      if(presentation.phase==='dock'){presentation.dockElapsedMs+=elapsedMs;const duration=reducedMotion?240:POLYMER_DOCK_PRESENT_MS,progress=clamp(presentation.dockElapsedMs/duration,0,1),eased=progress*progress*(3-2*progress);dockPolymerSample(eased);if(progress>=1){presentation.phase='hold';presentation.elapsedMs=0;}}
      else if(presentation.phase==='hold'&&!presentation.ready){presentation.elapsedMs+=elapsedMs;const hold=reducedMotion?POLYMER_SAMPLE_REDUCED_HOLD_MS:POLYMER_SAMPLE_HOLD_MS;if(presentation.elapsedMs>=hold){presentation.ready=true;if(!presentation.dismissed)dispatchPolymerEvent('molecule-craft:reaction-lab-polymer-sample-present',{sampleId:presentation.sampleId,batchGeneration:presentation.batchGeneration});}}
      else if(presentation.phase==='hold')dockPolymerSample(1);
    }
    updatePolymerSiteIndicator();
  }

  function isPolymerRackLocked(){const tx=polymerCore.snapshot();return polymerRouteOwned&&!!tx&&tx.state!==POLYMERIZATION_STATES.SAMPLE;}
  function isTransitionLocked(){return batch.phase===REACTION_LAB_BATCH_PHASES.FLUSHING||batch.phase===REACTION_LAB_BATCH_PHASES.FEEDING;}
  function hasPointerGesture(){return !!selected||activePointers.size>0||pinchActive;}
  function canEditRack(){return !disposed&&!pickerOpen&&!isTransitionLocked()&&!reactionAnimation&&!isPolymerRackLocked()&&!hasPointerGesture();}
  function environmentControlsLocked(){const tx=polymerCore.snapshot(),polymerLocked=polymerRouteOwned&&!!tx&&![POLYMERIZATION_STATES.WAITING,POLYMERIZATION_STATES.AUTO_PENDING].includes(tx.state);return disposed||pickerOpen||isManipulating()||pinchActive||isTransitionLocked()||!!reactionAnimation||polymerLocked;}
  function closeMediumSelector({returnFocus=false}={}){
    if(!mediumSelectorOpen)return;mediumSelectorOpen=false;mediumSelector.hidden=true;mediumButton?.setAttribute('aria-expanded','false');
    if(returnFocus){const target=environmentControlsLocked()?root.querySelector('[data-lab-close]'):mediumButton;target?.focus({preventScroll:true});}
  }
  function updateEnvironmentControls(){
    const locked=environmentControlsLocked();if(locked&&mediumSelectorOpen)closeMediumSelector({returnFocus:mediumSelector.contains(document.activeElement)});
    const state=activationEnvironment.snapshot(),mediumLabels={neutral:'NEUTRAL',acidic:'ACID',basic:'BASE'};
    if(lightButton){lightButton.disabled=locked;lightButton.setAttribute('aria-pressed',String(state.light));lightButton.setAttribute('aria-label',`LIGHT：${state.light?'ON':'OFF'}`);lightButton.dataset.active=String(state.light);lightButton.querySelector('[data-lab-equipment-state]').textContent=state.light?'ON':'OFF';}
    if(heatButton){heatButton.disabled=locked;heatButton.setAttribute('aria-pressed',String(state.heat));heatButton.setAttribute('aria-label',`HEAT：${state.heat?'ON':'OFF'}`);heatButton.dataset.active=String(state.heat);heatButton.querySelector('[data-lab-equipment-state]').textContent=state.heat?'ON':'OFF';}
    if(mediumButton){mediumButton.disabled=locked;mediumButton.setAttribute('aria-label',`pH medium：${mediumLabels[state.medium]}`);mediumButton.dataset.medium=state.medium;mediumButton.querySelector('[data-lab-medium-value]').textContent=mediumLabels[state.medium];}
    for(const input of mediumInputs){input.disabled=locked;input.checked=input.value===state.medium;}
  }
  function setMediumSelectorOpen(open,{returnFocus=false}={}){
    if(open&&environmentControlsLocked())return false;
    if(open){mediumSelectorOpen=true;mediumSelector.hidden=false;mediumButton?.setAttribute('aria-expanded','true');updateEnvironmentControls();mediumInputs.find(input=>input.checked)?.focus({preventScroll:true});return true;}
    closeMediumSelector({returnFocus});updateEnvironmentControls();return true;
  }
  function syncPolymerEnvironment(){
    if(!polymerRouteOwned)return;const changed=polymerCore.setEnvironment(activationEnvironment.conditions());if(!changed.ok)return;
    if(changed.valid){ensurePolymerProcessSetup();status.textContent='POLYMERIZATION · PROCESS';}else{status.textContent='POLYMERIZATION PAUSED';polymerSiteIndicator.hidden=true;}
    updatePolymerSiteIndicator();updateCommandBar();
  }
  lightButton?.addEventListener('click',()=>{if(environmentControlsLocked())return;activationEnvironment.toggleLight();syncPolymerEnvironment();updateEnvironmentControls();},eventOptions);
  heatButton?.addEventListener('click',()=>{if(environmentControlsLocked())return;activationEnvironment.toggleHeat();syncPolymerEnvironment();updateEnvironmentControls();},eventOptions);
  mediumButton?.addEventListener('click',()=>setMediumSelectorOpen(!mediumSelectorOpen),eventOptions);
  for(const input of mediumInputs)input.addEventListener('change',()=>{if(!input.checked)return;if(environmentControlsLocked()){updateEnvironmentControls();return;}activationEnvironment.setMedium(input.value);syncPolymerEnvironment();setMediumSelectorOpen(false,{returnFocus:true});},eventOptions);
  mediumSelector?.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setMediumSelectorOpen(false,{returnFocus:true});}},eventOptions);
  function updateCommandBar(){
    const state=batch.snapshot(),dirty=state.draftSlots.some((species,index)=>species!==state.activeSlots[index]);
    const polymerState=polymerCore.snapshot();commandState.textContent=state.phase===REACTION_LAB_BATCH_PHASES.FLUSHING?'FLUSHING':state.phase===REACTION_LAB_BATCH_PHASES.FEEDING?'FEEDING':reactionAnimation?'REACTION':polymerRouteOwned&&polymerState?.state===POLYMERIZATION_STATES.SAMPLE?'POLYMER SAMPLE':polymerRouteOwned&&polymerState?.waitReason==='conditions'?'POLYMERIZATION PAUSED':polymerRouteOwned?'POLYMERIZATION':state.phase===REACTION_LAB_BATCH_PHASES.ACTIVE?dirty?'DRAFT READY':'BATCH ACTIVE':'RACK READY';
    slots.forEach((tile,index)=>{tile.disabled=!canEditRack();tile.setAttribute('aria-expanded',String(pickerOpen&&pickerSlotIndex===index));});
    feedButton.disabled=!canEditRack()||(!state.draftSlots.some(Boolean)&&state.phase===REACTION_LAB_BATCH_PHASES.IDLE);
    updateEnvironmentControls();
  }
  function renderSlotTiles(){
    const active=batch.activeSlots,draft=batch.draftSlots;
    slots.forEach((tile,index)=>{
      const id=draft[index],record=id?recordsById.get(id):null,socket=tile.querySelector('.reaction-lab-slot-socket'),formula=tile.querySelector('[data-slot-formula]'),name=tile.querySelector('[data-slot-name]');
      if(record){
        let image=socket.querySelector('img');
        if(image?.dataset.moleculeId!==record.id){socket.replaceChildren();image=document.createElement('img');image.dataset.moleculeId=record.id;image.src=new URL(`../assets/models/molecule-${record.id}.svg`,import.meta.url).href;image.alt='';image.width=76;image.height=54;image.loading='lazy';image.decoding='async';image.addEventListener('error',()=>image.remove(),{once:true});socket.append(image);}
        formula.textContent=record.formula??record.id;name.textContent=record.commonNameJa??record.nameJa??record.nameEn??record.id;tile.setAttribute('aria-label',`Feed slot ${String.fromCharCode(65+index)}：${formula.textContent} ${name.textContent}`);
      }else{socket.replaceChildren();formula.textContent='—';name.textContent='未接続';tile.setAttribute('aria-label',`Feed slot ${String.fromCharCode(65+index)}：未接続。分子を選ぶ`);}
      tile.dataset.species=id;tile.classList.toggle('is-active',!!id&&active[index]===id);tile.classList.toggle('is-draft',id!==active[index]);
    });
    updateCommandBar();
  }
  function filterPicker(){
    const query=pickerSearch.value.trim().toLocaleLowerCase();
    for(const option of pickerList.children){const text=`${option.dataset.search??''}`.toLocaleLowerCase();option.hidden=!!query&&!text.includes(query);}
  }
  function renderPickerOptions(){
    pickerList.replaceChildren();const discovered=records.filter(record=>collectionState.hasMolecule(record.id)),draft=batch.draftSlots;
    for(const record of discovered){
      const option=document.createElement('button'),copy=document.createElement('span'),formula=document.createElement('strong'),name=document.createElement('small'),index=draft.findIndex(id=>id===record.id),unavailable=index>=0&&index!==pickerSlotIndex;
      option.type='button';option.className='reaction-lab-picker-option';option.role='option';option.dataset.species=record.id;option.dataset.search=`${record.formula??''} ${record.commonNameJa??record.nameJa??''} ${record.nameEn??''} ${record.id}`;option.disabled=unavailable;option.setAttribute('aria-disabled',String(unavailable));option.setAttribute('aria-selected',String(draft[pickerSlotIndex]===record.id));
      formula.textContent=record.formula??record.id;name.textContent=record.commonNameJa??record.nameJa??record.nameEn??record.id;copy.append(formula,name);option.append(copy);
      if(unavailable)option.setAttribute('aria-label',`${formula.textContent} ${name.textContent}。別のfeed slotですでに選択されています`);
      option.addEventListener('click',()=>{if(!pickerOpen||option.disabled)return;const result=batch.setDraftSlot(pickerSlotIndex,record.id);if(!result.ok){status.textContent='同じ分子は複数のfeed headへ接続できません。';return;}closePicker();renderSlotTiles();status.textContent='draftを更新しました。FEEDでchamberへ投入します。';});pickerList.append(option);
    }
    filterPicker();
  }
  function closePicker({returnFocus=true}={}){
    if(!pickerOpen)return;pickerOpen=false;picker.hidden=true;picker.setAttribute('aria-hidden','true');pickerSlotIndex=-1;const source=pickerSource;pickerSource=null;renderSlotTiles();if(returnFocus&&source?.isConnected)source.focus();
  }
  function openPicker(index){
    if(!canEditRack())return;pickerSlotIndex=index;pickerSource=slots[index];pickerOpen=true;pickerSearch.value='';renderPickerOptions();picker.hidden=false;picker.setAttribute('aria-hidden','false');renderSlotTiles();root.querySelector('[data-lab-picker-close]')?.focus({preventScroll:true});
  }
  slots.forEach((tile,index)=>tile.addEventListener('click',()=>openPicker(index),eventOptions));
  pickerSearch.addEventListener('input',filterPicker,eventOptions);
  root.querySelector('[data-lab-picker-close]')?.addEventListener('click',()=>closePicker(),eventOptions);
  root.querySelector('[data-lab-disconnect]')?.addEventListener('click',()=>{if(!pickerOpen)return;const result=batch.setDraftSlot(pickerSlotIndex,'');if(!result.ok)return;closePicker();renderSlotTiles();status.textContent='feed headを切断しました。FEEDで変更を適用します。';},eventOptions);
  dialog.addEventListener('cancel',event=>{if(mediumSelectorOpen){event.preventDefault();setMediumSelectorOpen(false,{returnFocus:true});return;}if(pickerOpen){event.preventDefault();closePicker();}},{signal:eventController.signal});
  root.addEventListener('keydown',event=>{if(pickerOpen&&event.key==='Escape'){event.preventDefault();event.stopPropagation();closePicker();}},eventOptions);

  function fitPopulation(){
    if(!instances.length)return;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const item of instances)for(const atom of item.record.atoms){const radius=modelAtomRadius(atom.element),point=atom.point.clone().add(item.group.position);minX=Math.min(minX,point.x-radius);maxX=Math.max(maxX,point.x+radius);minY=Math.min(minY,point.y-radius);maxY=Math.max(maxY,point.y+radius);}
    const rect=canvas.getBoundingClientRect(),aspect=Math.max(.1,rect.width/Math.max(1,rect.height)),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)),required=Math.max((maxX-minX)/(2*tan*aspect*.88),(maxY-minY)/(2*tan*.88));
    distance=clamp(Math.max(15,required),CAMERA_MIN_DISTANCE,CAMERA_MAX_DISTANCE);updateCamera();
  }
  function cancelAllPointers(){
    endManipulation();for(const pointerId of activePointers.keys())try{if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}
    activePointers.clear();pinchActive=false;pinchDistance=0;onPointerLockChange(false);
  }
  function feedOrigin(slotIndex){
    const rect=canvas.getBoundingClientRect(),aspect=Math.max(.1,rect.width/Math.max(1,rect.height)),halfHeight=distance*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)),halfWidth=halfHeight*aspect;
    return new THREE.Vector3((slotIndex-1)*halfWidth*(2/3),halfHeight-.55,0);
  }
  function createFeedTransition(generation,schedule){
    const polymerFeed=!!polymerCore.routeFor(batch.activeSlots),entries=schedule.map(row=>{const base=deterministicFeedVariation(row.slotIndex,row.waveIndex,row.index),variation=polymerFeed?{...base,yaw:0,pitch:0,roll:0,angular:[0,0,0]}:base,travelMs=reducedMotion?Math.max(150,Math.round(220/variation.speed)):Math.round(FEED_TRAVEL_MS/variation.speed);return{...row,variation,travelMs,startedAt:null,item:null};}).sort((a,b)=>a.startDelayMs-b.startDelayMs||a.slotIndex-b.slotIndex||a.index-b.index);
    const preparations=[...new Set(entries.map(row=>row.species))].map(species=>({species,preview:null,steps:0,model:null,ready:false}));
    return{kind:'feed',generation,elapsedMs:0,feedStartedAt:null,entries,preparations,preparationBySpecies:new Map(preparations.map(preparation=>[preparation.species,preparation])),preparationCursor:0,feedLayoutReady:false};
  }
  function startFeedTransition(generation,schedule,preparedTransition=null){
    batchTransition=preparedTransition??createFeedTransition(generation,schedule);
    if(preparedTransition)prepareFeedModels(batchTransition);
    status.textContent='FEEDING · 分子をchamberへ投入中';renderSlotTiles();
  }
  function startPurge(generation,nextSlots,feedSchedule){
    cancelAllPointers();contactMatcher.reset();testIsolation=null;reactionDiagnostics=[];
    purgeItems=instances;instances=[];
    if(polymerSamplePresentation&&!polymerSamplePresentation.ready&&!polymerSamplePresentation.dismissed){polymerSamplePresentation.dismissed=true;dispatchPolymerEvent('molecule-craft:reaction-lab-polymer-sample-dismiss',{sampleId:polymerSamplePresentation.sampleId,batchGeneration:polymerSamplePresentation.batchGeneration});}
    if(polymerGraphVisual){purgeItems.push({id:polymerSamplePresentation?.sampleId??'polymer-fragment',species:'PolymerSample',group:polymerGraphVisual.group,polymerSample:true});polymerGraphVisual=null;}
    polymerCore.sampleDismiss();polymerRouteOwned=false;polymerReservedById.clear();polymerSourceRecordsById={};polymerSamplePresentation=null;polymerDocking=null;polymerAutoMotion=null;polymerSiteIndicator.hidden=true;polymerSampleBay.hidden=true;
    const durationMs=reducedMotion?360:FLUSH_PRESENTATION_MS;
    for(const item of purgeItems){item.busy=false;item.purgeStart=item.group.position.clone();item.group.scale.setScalar(1);}
    batchTransition={kind:'flush',generation,elapsedMs:0,durationMs,items:purgeItems,nextSlots:[...nextSlots],nextFeed:feedSchedule?.length?createFeedTransition(generation,feedSchedule):null};
    status.textContent='FLUSHING · 旧batchを下部outletへ排出中';renderSlotTiles();
  }
  function beginFeed(){
    if(!canEditRack())return;
    const result=batch.beginFeed({hasCurrentBatch:batch.phase===REACTION_LAB_BATCH_PHASES.ACTIVE});if(!result.ok)return;
    contactMatcher.reset();reactionDiagnostics=[];testIsolation=null;
    if(result.phase===REACTION_LAB_BATCH_PHASES.FLUSHING)startPurge(result.generation,result.activeSlots,result.feedSchedule);
    else startFeedTransition(result.generation,result.feedSchedule);
    renderSlotTiles();
  }
  feedButton.addEventListener('click',beginFeed,eventOptions);
  function progressFlush(transition){
    if(batch.generation!==transition.generation){for(const item of transition.items)disposeItem(item);purgeItems=[];batchTransition=null;return;}
    const progress=clamp(transition.elapsedMs/transition.durationMs,0,1),approach=clamp(progress/.78,0,1),eased=approach*approach*(3-2*approach),rect=canvas.getBoundingClientRect(),halfHeight=distance*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)),outletY=-halfHeight+.45,crossing=Math.max(0,(progress-.78)/.22);
    for(const item of transition.items){item.group.position.lerpVectors(item.purgeStart,new THREE.Vector3(0,outletY,0),eased);if(progress>.78)item.group.position.y-=crossing*.85;const scale=progress>.66?1-(progress-.66)/.34*.86:1;item.group.scale.setScalar(Math.max(.08,scale));}
    if(progress<1)return;
    for(const item of transition.items)disposeItem(item);purgeItems=[];const preparedFeed=transition.nextFeed;batchTransition=null;
    const next=batch.completeFlush(transition.generation);if(!next.ok)return;
    if(next.phase===REACTION_LAB_BATCH_PHASES.FEEDING)startFeedTransition(next.generation,next.feedSchedule,preparedFeed);
    else{status.textContent='Chamber empty';renderSlotTiles();}
  }
  function spawnFeedEntry(transition,row){
    const record=recordsById.get(row.species);if(!record)return null;
    const origin=feedOrigin(row.slotIndex),destination=row.destination.clone(),item=createInstance(record,origin,{generation:transition.generation,orientation:row.variation,originPortIndex:row.slotIndex,feedPhase:'feeding',preparedModel:transition.preparationBySpecies.get(row.species)?.model});
    item.feedMotion={generation:transition.generation,origin:origin.clone(),destination:destination.clone(),startedAt:transition.elapsedMs,durationMs:row.travelMs,variation:row.variation};item.stageBody.kinematic=true;row.item=item;row.startedAt=transition.elapsedMs;
    return item;
  }
  function prepareFeedModels(transition,{fitLayout=true}={}){
    const preparations=transition.preparations;if(!preparations.length)return;
    const started=performance.now();let cursor=transition.preparationCursor??0,skipped=0;
    while(performance.now()-started<6&&skipped<preparations.length){
      const preparation=preparations[cursor];cursor=(cursor+1)%preparations.length;
      if(preparation.ready){skipped++;continue;}
      skipped=0;
      const record=recordsById.get(preparation.species);if(!record){preparation.ready=true;continue;}
      if(!preparation.preview)preparation.preview=createPreviewModel(THREE,record);
      preparation.preview.step();preparation.steps++;
      if(preparation.steps>=190){preparation.model=preparation.preview.snapshot();preparation.preview=null;preparation.ready=true;}
    }
    transition.preparationCursor=cursor;
    if(fitLayout&&!transition.feedLayoutReady&&preparations.every(preparation=>preparation.ready)){
      const maxRadius=Math.max(...preparations.map(preparation=>Math.max(...preparation.model.atoms.map(atom=>atom.point.length()+modelAtomRadius(atom.element))))),spacing=Math.max(2.6,maxRadius*2+.65),positions=transition.entries.length===6?[[-spacing,spacing*.5],[0,spacing*.5],[spacing,spacing*.5],[spacing,-spacing*.5],[0,-spacing*.5],[-spacing,-spacing*.5]]:[[-spacing*.5,spacing*.5],[spacing*.5,spacing*.5],[spacing*.5,-spacing*.5],[-spacing*.5,-spacing*.5]];
      transition.entries.forEach((row,index)=>{const variation=row.variation,point=positions[index]??[0,0];row.destination=new THREE.Vector3(point[0]+variation.lateral*.25,point[1]+variation.pitch*.25,0);});
      const minX=Math.min(...transition.entries.map(row=>row.destination.x-maxRadius)),maxX=Math.max(...transition.entries.map(row=>row.destination.x+maxRadius)),minY=Math.min(...transition.entries.map(row=>row.destination.y-maxRadius)),maxY=Math.max(...transition.entries.map(row=>row.destination.y+maxRadius)),rect=canvas.getBoundingClientRect(),aspect=Math.max(.1,rect.width/Math.max(1,rect.height)),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)),required=Math.max((maxX-minX)/(2*tan*aspect*.88),(maxY-minY)/(2*tan*.88));
      distance=clamp(Math.max(15,required),CAMERA_MIN_DISTANCE,CAMERA_MAX_DISTANCE);updateCamera();transition.feedLayoutReady=true;
    }
  }
  function progressFeed(transition,elapsedMs){
    if(batch.generation!==transition.generation){for(const row of transition.entries)if(row.item){instances=instances.filter(item=>item!==row.item);disposeItem(row.item);}batchTransition=null;return;}
    transition.elapsedMs+=elapsedMs;
    prepareFeedModels(transition);
    if(transition.feedStartedAt===null&&transition.feedLayoutReady)transition.feedStartedAt=transition.elapsedMs;
    let spawnedThisFrame=false;
    for(const row of transition.entries){
      if(!row.item&&!spawnedThisFrame&&transition.feedLayoutReady&&transition.feedStartedAt!==null&&transition.elapsedMs>=transition.feedStartedAt+row.startDelayMs){spawnFeedEntry(transition,row);spawnedThisFrame=true;}
      const item=row.item;if(!item)continue;
      const motion=item.feedMotion;if(!motion)continue;
      const progress=clamp((transition.elapsedMs-motion.startedAt)/motion.durationMs,0,1),eased=progress*progress*(3-2*progress),arc=Math.sin(Math.PI*progress)*motion.variation.lateral;
      item.group.position.lerpVectors(motion.origin,motion.destination,eased);item.group.position.x+=arc;item.group.updateMatrixWorld(true);syncStageABodyFromGroup(item);
      if(progress>=1){item.group.position.copy(motion.destination);syncStageABodyFromGroup(item);item.stageBody.kinematic=false;const ejection=motion.destination.clone().sub(motion.origin).add(new THREE.Vector3(motion.variation.lateral,0,0)).normalize().multiplyScalar(.11*motion.variation.speed/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM);item.stageBody.velocityAngstromPerPs=ejection.toArray();item.stageBody.angularVelocityRadPerPs=motion.variation.angular.map(value=>value*.12);item.feedMotion=null;item.feedPhase='dynamic';item.feedHandoff=true;item.initialPositionAtSpawn=motion.destination.toArray();}
    }
    if(transition.entries.some(row=>row.species&&!row.item?.feedHandoff))return;
    batchTransition=null;contactMatcher.reset();reactionDiagnostics=[];const completed=batch.completeFeed(transition.generation);if(!completed.ok)return;
    instances.forEach(item=>{item.feedPhase='dynamic';});fitPopulation();initializePolymerBatch();if(!polymerRouteOwned)status.textContent=`ACTIVE · ${instances.length} 個`;renderSlotTiles();
  }
  function advanceBatchTransition(elapsedMs){
    const transition=batchTransition;if(!transition)return;
    if(transition.kind==='flush'){transition.elapsedMs+=elapsedMs;if(transition.nextFeed)prepareFeedModels(transition.nextFeed,{fitLayout:false});progressFlush(transition);}
    else progressFeed(transition,elapsedMs);
  }

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
    const previousOffset=previousCenter.clone().sub(baseCenter).dot(normal);
    let desiredDepthOffset=0,solution=null,candidateSafetySampleCount=0;
    if(target){
      const pairKey=`${item.id}|${target.id}`;
      if(depthSafetyPairKey!==pairKey){depthSafetyPairKey=pairKey;depthSafetyOracle=createStageBPairSafetyOracle(item.stageBody,target.stageBody);}
      solution=solveSafeDepthDocking({dragged:shapeFor(item,baseCenter),target:shapeFor(target),cameraNormal:normal.toArray(),previousCenter:previousCenter.toArray(),maxCompression:MAX_DOCKING_COMPRESSION_WORLD,outwardAccelerationAt:(center,_offset,branchSign)=>{candidateSafetySampleCount++;return depthSafetyOracle({draggedPositionAngstrom:center.map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM),targetPositionAngstrom:target.group.position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM),cameraNormal:normal.toArray(),branchSign}).outwardRelativeAcceleration;},worldUnitsPerAngstrom:REACTION_LAB_WORLD_UNITS_PER_ANGSTROM});
      if(solution){desiredDepthOffset=solution.offset;depthOutwardAcceleration=solution.acceleration;depthSafetySampleCount=solution.safetySampleCount;depthDockingState='docking';}
      else{desiredDepthOffset=previousOffset;depthOutwardAcceleration=Infinity;depthSafetySampleCount=candidateSafetySampleCount;depthDockingState='acquired-no-safe-solution';}
    }
    const alpha=1-Math.exp(-Math.max(0,elapsedMs)/DEPTH_DOCKING_TIME_CONSTANT_MS),currentOffset=previousOffset+(desiredDepthOffset-previousOffset)*alpha;
    item.group.position.copy(baseCenter).addScaledVector(normal,currentOffset);correctPointerAnchor(item,down.localAnchor,down.clientX,down.clientY);
    if(target&&solution)depthDockingState=Math.abs(currentOffset-desiredDepthOffset)<.025?'safe':'docking';
    else if(!target)depthDockingState=Math.abs(currentOffset)<.025?'none':'returning';
  }
  function currentPinchDistance(){const points=[...activePointers.values()];return points.length<2?0:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);}
  function capturePointer(event){try{canvas.setPointerCapture(event.pointerId);}catch{}}
  canvas.addEventListener('pointerdown',event=>{
    if(disposed||pickerOpen||isTransitionLocked()||reactionAnimation)return;
    event.preventDefault();activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});capturePointer(event);
    if(pinchActive||activePointers.size>1){if(!pinchActive){endManipulation();pinchActive=true;}pinchDistance=currentPinchDistance();onPointerLockChange(true);updateEnvironmentControls();return;}
    const hit=raycastAtoms(event)??fallbackGrab(event);selected=hit?.item??null;
    down={pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,group:selected};
    if(selected){
      const center=selected.group.position.clone(),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(cameraNormal(),center);
      const localAnchor=selected.group.worldToLocal(hit.point.clone());
      down.plane=plane;down.localAnchor=localAnchor;down.startDepth=center.dot(cameraNormal());
      chamberTime.setMode(CHAMBER_TIME_MODES.MANIPULATING);contactMatcher.reset();syncStageABodyFromGroup(selected);selected.stageBody.velocityAngstromPerPs=[0,0,0];clearDepthTarget();
    }
    onPointerLockChange(true);
    updateCommandBar();
  },eventOptions);
  canvas.addEventListener('pointermove',event=>{
    const point=activePointers.get(event.pointerId);if(!point)return;
    point.x=event.clientX;point.y=event.clientY;
    if(pinchActive){const next=currentPinchDistance();if(next>0&&pinchDistance>0){distance=clamp(distance*pinchDistance/Math.max(1,next),CAMERA_MIN_DISTANCE,CAMERA_MAX_DISTANCE);updateCamera();}pinchDistance=next;return;}
    if(down?.pointerId===event.pointerId){down.clientX=event.clientX;down.clientY=event.clientY;}
  },eventOptions);
  function endPointer(event){
    const active=activePointers.has(event.pointerId),wasPinching=pinchActive;
    if(!active)return;
    if(!wasPinching&&event.type==='pointerup'&&down?.pointerId===event.pointerId&&selected)updateManipulation(16);
    let polymerCommitted=false;if(!wasPinching&&event.type==='pointerup'&&down?.pointerId===event.pointerId&&selected?.polymerReservation)polymerCommitted=startManualPolymerDock(selected,event);
    if(down?.pointerId===event.pointerId&&!wasPinching&&!polymerCommitted)endManipulation();
    activePointers.delete(event.pointerId);try{canvas.releasePointerCapture(event.pointerId);}catch{}
    if(wasPinching){if(activePointers.size===0){pinchActive=false;pinchDistance=0;clearDepthTarget();}onPointerLockChange(activePointers.size>0);updateCommandBar();return;}
    onPointerLockChange(activePointers.size>0);updateCommandBar();
  }
  canvas.addEventListener('pointerup',endPointer,eventOptions);canvas.addEventListener('pointercancel',endPointer,eventOptions);
  canvas.addEventListener('wheel',event=>{event.preventDefault();if(pickerOpen||isTransitionLocked()||reactionAnimation)return;distance=clamp(distance*Math.exp(event.deltaY*.001),CAMERA_MIN_DISTANCE,CAMERA_MAX_DISTANCE);updateCamera();},{passive:false,signal:eventController.signal});

  function reactionStep(stepMs){
    if(batch.phase!==REACTION_LAB_BATCH_PHASES.ACTIVE)return;
    if(polymerRouteOwned){reactionDiagnostics=[];contactMatcher.reset();return;}
    if(reactionAnimation){contactMatcher.reset();reactionDiagnostics=[];return;}
    const manipulating=isManipulating(),rows=[],ready=[],activeConditions=activationEnvironment.conditions();
    if(manipulating)contactMatcher.reset();
    contactMatcher.beginStep();
    const active=[...instances].filter(item=>!item.feedMotion&&item.batchGeneration===batch.generation).sort((a,b)=>a.id.localeCompare(b.id));
    function assess(candidate){
      const rejectionReasons=[],encounterIds=candidate.reactantInstanceIds,encounter=encounterIds.map(instanceById);
      if(encounter.some(item=>!item))rejectionReasons.push('participant-missing');
      if(encounter.some(item=>item?.busy))rejectionReasons.push('participant-busy');
      if(encounter.some(item=>item&&testIsolation&&!testIsolation.has(item.id)))rejectionReasons.push('outside-test-isolation');
      const center=supplementalSelectionCenter(candidate,(role,atomIndex)=>{
        const item=instanceById(candidate.participantInstances[role]);return item?atomWorldAngstrom(item,atomIndex):null;
      });
      const supplemental=center?resolveSupplementalParticipants(candidate.reaction,candidate,active,item=>Math.hypot(...item.stageBody.positionAngstrom.map((value,index)=>value-center[index]))):{ok:false,reason:'participant-missing'};
      const participantInstances=supplemental.ok?supplemental.participantInstances:{...candidate.participantInstances};
      if(!supplemental.ok)rejectionReasons.push(supplemental.reason);
      const participantItems=Object.values(participantInstances).map(instanceById).filter(Boolean);
      if(participantItems.some(item=>item.busy))rejectionReasons.push('participant-busy');
      const bindingsPosition=(role,index)=>atomWorldAngstrom(instanceById(candidate.participantInstances[role]),index);
      const geometry=scoreReactionGeometry(candidate.geometryConstraints,bindingsPosition);
      if(!geometry.geometryReady)rejectionReasons.push('geometry-outside-window');
      let minimumRealAtomDistance=Infinity,minimumNonbondedSeparationRatio=Infinity,severeOverlap=false;
      for(let i=0;i<participantItems.length;i++)for(let j=i+1;j<participantItems.length;j++){
        const left=participantItems[i],right=participantItems[j];
        for(let a=0;a<left.record.atoms.length;a++)for(let b=0;b<right.record.atoms.length;b++){
          const pa=atomWorldAngstrom(left,a),pb=atomWorldAngstrom(right,b),distance=Math.hypot(pa[0]-pb[0],pa[1]-pb[1],pa[2]-pb[2]);
          const physical=canonicalNonbondedPairGeometry({sigmaAngstrom:left.record.nonbonded.sigmaAngstrom[a],epsilonKcalMol:left.record.nonbonded.epsilonKcalMol[a]},{sigmaAngstrom:right.record.nonbonded.sigmaAngstrom[b],epsilonKcalMol:right.record.nonbonded.epsilonKcalMol[b]},distance);
          minimumRealAtomDistance=Math.min(minimumRealAtomDistance,distance);minimumNonbondedSeparationRatio=Math.min(minimumNonbondedSeparationRatio,physical.minimumNonbondedSeparationRatio);severeOverlap||=physical.severeOverlap;
        }
      }
      if(severeOverlap)rejectionReasons.push('severe-overlap');
      const environmentMatched=environmentMatches(candidate.reaction,activeConditions);if(!environmentMatched)rejectionReasons.push('environment-mismatch');
      if(!stageBPhysicsEnabled)rejectionReasons.push('non-production-physics');
      const roleAssignments=Object.entries(participantInstances).sort(([a],[b])=>a.localeCompare(b)).map(([role,id])=>`${role}=${id}`),dwellKey=`${candidate.reactionId}:${candidate.pathwayId}:${roleAssignments.join('|')}:g${batch.generation}`;
      const eligible=!manipulating&&!rejectionReasons.length;
      if(supplemental.ok)contactMatcher.markActive(dwellKey);
      const elapsed=manipulating?0:(contactMatcher.update(dwellKey,eligible,stepMs),contactMatcher.elapsed(dwellKey));
      if(manipulating)rejectionReasons.push('participant-manipulating');
      const commitReady=eligible&&elapsed>=CONTACT_DWELL_MS;
      const diagnostic={reactionId:candidate.reactionId,familyId:candidate.familyId,pathwayId:candidate.pathwayId,encounterParticipantIds:encounterIds,participants:participantInstances,matchedSites:Object.fromEntries(Object.entries(candidate.bindings).map(([role,atomBindings])=>[role,{patternId:candidate.matchedPatterns[role],atomBindings}])),distanceConstraints:geometry.constraints,geometryReady:geometry.geometryReady,geometryQuality:{worstNormalizedDeviation:geometry.worstNormalizedDeviation,meanNormalizedDeviation:geometry.meanNormalizedDeviation},minimumRealAtomDistance,minimumNonbondedSeparationRatio,severeOverlap,manipulating,normalPhysicsStepObserved:stageBPhysicsEnabled&&!manipulating,environmentMatched,stoichiometricRequirement:supplemental.ok?null:{reason:supplemental.reason,species:supplemental.species,count:supplemental.count},dwellElapsed:elapsed,dwellRequired:CONTACT_DWELL_MS,commitReady,rejectionReasons};
      rows.push(diagnostic);
      if(commitReady){
        const staged={...candidate,participantInstances,environmentConditions:[...activeConditions],environmentSnapshot:activationEnvironment.snapshot(),geometryQuality:{worstNormalizedDeviation:geometry.worstNormalizedDeviation,meanNormalizedDeviation:geometry.meanNormalizedDeviation}};
        const participantByRole=new Map(Object.entries(participantInstances).map(([role,id])=>[role,instanceById(id)]));
        const sourcePoint=sourceAtom=>{const split=sourceAtom.indexOf(':'),role=sourceAtom.slice(0,split),index=Number(sourceAtom.slice(split+1)),item=participantByRole.get(role);return item?atomWorldAngstrom(item,index):null;};
        staged.newBondEndpointDistanceSum=(candidate.graphTransition?.formedBonds??[]).reduce((sum,bond)=>{const a=sourcePoint(bond.a),b=sourcePoint(bond.b);return sum+(a&&b?Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]):0);},0);
        ready.push(staged);
      }
    }
    for(let first=0;first<active.length;first++)for(let second=first+1;second<active.length;second++){
      const left=active[first],right=active[second];
      if(testIsolation&&!(testIsolation.has(left.id)&&testIsolation.has(right.id)))continue;
      const candidates=reactionCandidates([{species:left.species,id:left.id},{species:right.species,id:right.id}],reactionCatalog);
      for(const candidate of candidates)assess(candidate);
    }
    contactMatcher.endStep();
    reactionDiagnostics=rows;
    if(reactionTrajectoryTrace){
      const trace=reactionTrajectoryTrace;
      for(const diagnostic of rows.filter(item=>item.reactionId===trace.reactionId&&(!trace.participantIds||trace.participantIds.every(id=>Object.values(item.participants??{}).includes(id))))){
        const bodies=Object.values(diagnostic.participants??{}).map(instanceById).filter(Boolean).map(item=>({id:item.id,positionAngstrom:[...item.stageBody.positionAngstrom],orientation:[...item.stageBody.orientation],velocityAngstromPerPs:[...item.stageBody.velocityAngstromPerPs],angularVelocityRadPerPs:[...item.stageBody.angularVelocityRadPerPs]}));
        trace.samples.push({fixedStepIndex:stageAPerformance.fixedSteps,fixedStepMs:stepMs,simulationClockSeconds,reactionId:diagnostic.reactionId,familyId:diagnostic.familyId,pathwayId:diagnostic.pathwayId,participantIds:{...diagnostic.participants},matchedSites:diagnostic.matchedSites,distanceConstraints:diagnostic.distanceConstraints.map(({actual,min,target,max,normalizedError})=>({actual,min,target,max,normalizedError})),geometryReady:diagnostic.geometryReady,severeOverlap:diagnostic.severeOverlap,minimumRealAtomDistance:diagnostic.minimumRealAtomDistance,minimumNonbondedSeparationRatio:diagnostic.minimumNonbondedSeparationRatio,manipulating:diagnostic.manipulating,normalPhysicsStepObserved:diagnostic.normalPhysicsStepObserved,environmentMatched:diagnostic.environmentMatched,dwellElapsed:diagnostic.dwellElapsed,dwellRequired:diagnostic.dwellRequired,commitReady:diagnostic.commitReady,rejectionReasons:[...diagnostic.rejectionReasons],bodies});
        if(trace.samples.length>2400)trace.samples.shift();
      }
    }
    if(manipulating||!ready.length)return;
    const arbitration=arbitrateReactionCandidateComponents(ready);
    if(arbitration.selected)commit(arbitration.selected);
    for(const component of arbitration.components.filter(item=>item.status==='geometry-deadband'))for(const contender of component.contenders){const diagnostic=rows.find(row=>row.pathwayId===contender.pathwayId&&row.encounterParticipantIds.join('|')===contender.reactantInstanceIds.join('|'));if(diagnostic){diagnostic.commitReady=false;diagnostic.rejectionReasons.push('geometry-deadband');}}
  }
  function cancelPointerFor(item){
    if(selected===item){const pointerId=down?.pointerId;endManipulation();if(pointerId!==undefined){activePointers.delete(pointerId);try{if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}}onPointerLockChange(activePointers.size>0);}
    if(!down||down.group!==item)return;
    const pointerId=down.pointerId;down=null;activePointers.delete(pointerId);try{if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}onPointerLockChange(activePointers.size>0);
  }
  const sourceAtomId=(role,index)=>`${role}:${index}`;
  const pairKey=(a,b)=>[a,b].sort((left,right)=>left.localeCompare(right)).join('|');
  function roleItemsFor(execution){return new Map(execution.participants.map(row=>[row.role,instanceById(row.instanceId)]));}
  function captureAtomVelocity(item,index){
    const orientation=new THREE.Quaternion(...item.stageBody.orientation),offset=item.record.atoms[index].point.clone().divideScalar(REACTION_LAB_WORLD_UNITS_PER_ANGSTROM).applyQuaternion(orientation),angular=new THREE.Vector3(...item.stageBody.angularVelocityRadPerPs),linear=new THREE.Vector3(...item.stageBody.velocityAngstromPerPs);
    return linear.add(angular.cross(offset)).toArray();
  }
  function commit(candidate){
    if(isManipulating()||reactionAnimation)return;
    const environmentSnapshot=activationEnvironment.snapshot(),environmentConditions=[...environmentTokensFromSnapshot(environmentSnapshot)];
    if(!environmentMatches(candidate.reaction,environmentConditions))return;
    const execution=planReactionExecution({...candidate,environmentSnapshot,environmentConditions},records);if(!execution.ok){status.textContent='反応経路を検証できないため、反応を確定できません。';return;}
    const reservation=reserveParticipantInstances(candidate.participantInstances,instances,batch.generation,candidate.reaction.reactants.map(row=>row.role));if(!reservation.ok)return;
    const participants=reservation.participants,participantByRole=roleItemsFor(execution),sourcePositions=new Map(),sourceMeshes=new Map(),sourceVelocities=new Map(),sourceCharges=new Map(),sourceElements=new Map(),sourceModels=new Map();
    for(const[role,item]of participantByRole){
      if(!item)continue;item.group.updateMatrixWorld(true);sourceModels.set(role,item);
      for(let index=0;index<item.record.atoms.length;index++){
        const atomId=sourceAtomId(role,index),point=atomWorld(item,index);sourcePositions.set(atomId,point.toArray());sourceVelocities.set(atomId,captureAtomVelocity(item,index));sourceCharges.set(atomId,item.record.atoms[index].charge??0);sourceElements.set(atomId,item.record.atoms[index].element);sourceMeshes.set(atomId,item.atomMeshes.get(index));
      }
    }
    const correspondence=mapProductAtomOrigins(execution,sourcePositions,sourceElements),root=new THREE.Group();root.name='reaction-transformation-presentation';world.add(root);
    for(const[atomId,mesh]of sourceMeshes){if(!mesh)continue;const item=sourceModels.get(atomId.slice(0,atomId.indexOf(':'))),index=Number(atomId.slice(atomId.indexOf(':')+1)),point=sourcePositions.get(atomId);item.group.remove(mesh);root.add(mesh);mesh.position.fromArray(point);mesh.userData.sourceAtomId=atomId;mesh.userData.atomIndex=index;}
    instances=instances.filter(item=>!participants.includes(item));
    const center=sourcePositions.size?new THREE.Vector3(...[0,1,2].map(axis=>[...sourcePositions.values()].reduce((sum,point)=>sum+point[axis],0)/sourcePositions.size)):new THREE.Vector3();
    const sourceBodyStates=new Map(participants.map(item=>[item.id,{positionAngstrom:[...item.stageBody.positionAngstrom],orientation:[...item.stageBody.orientation],linearVelocityAngstromPerPs:[...item.stageBody.velocityAngstromPerPs],angularVelocityRadPerPs:[...item.stageBody.angularVelocityRadPerPs],batchGeneration:item.batchGeneration}]));
    lastReactionPresentation=null;reactionAnimation={generation:batch.generation,participants,center,elapsedMs:0,phase:'PREPARING',phaseElapsedMs:0,execution,root,sourcePositions,sourceMeshes,sourceVelocities,sourceCharges,sourceElements,sourceModels,sourceBodyStates,sourceGroupsDisposed:false,correspondence,products:[],atomPositionsNow:new Map([...sourcePositions].map(([id,point])=>[id,new THREE.Vector3(...point)])),bondVisuals:[],aromaticVisuals:[],sharedVisuals:[],chargeVisuals:[],productTargetsReady:false,handoffMaxAtomError:null,clearanceSafe:false,clearanceCorrectionAngstrom:0};
    if(!correspondence.ok){
      const fallbackProducts=execution.atomOrigins.map((product,index)=>({productIndex:index,record:execution.products[index],origins:(product.origins??[]).map(origin=>({sourceAtom:origin.sourceAtom,position:[...(sourcePositions.get(origin.sourceAtom)??[0,0,0])]}))}));
      reactionAnimation.correspondence={ok:false,reason:correspondence.reason,products:fallbackProducts};reactionAnimation.targetPreparationFailed=correspondence.reason;
    }
    initializeProductPreparations(reactionAnimation);
    status.textContent='REACTION · 原子配置を準備中';updateCommandBar();
  }
  function initializeProductPreparations(animation){
    const products=animation.correspondence.products;
    animation.products=products.map(product=>{
      const source=product.origins.map(origin=>origin.position),center=source.reduce((sum,point)=>sum.add(vector(THREE,point)),new THREE.Vector3()).multiplyScalar(1/source.length),seedPositions=source.map(point=>vector(THREE,point).sub(center));
      let seedPreview=null,canonicalPreview=null;try{seedPreview=createPreviewModel(THREE,product.record,{seedPositions});}catch{animation.targetPreparationFailed='source-seeded-solver-failure';}try{canonicalPreview=createPreviewModel(THREE,product.record);}catch{animation.targetPreparationFailed='canonical-preview-solver-failure';}
      return{...product,sourceCenter:center,sourcePoints:source.map(point=>new THREE.Vector3(...point)),seedPositions,seedPreview,canonicalPreview,seedSteps:0,canonicalSteps:0,seedModel:null,canonicalModel:null,shiftAngstrom:[0,0,0],layout:null};
    });
  }
  function advanceProductPreparation(animation,elapsedMs){
    if(!animation.correspondence.ok)animation.targetPreparationFailed='invalid-core-atom-mapping';
    const start=performance.now(),taskCount=animation.products.length*2;let cursor=animation.preparationCursor??0,spins=0;
    while(taskCount&&performance.now()-start<2.5&&spins<taskCount*12){
      const task=cursor%taskCount,product=animation.products[Math.floor(task/2)],seed=task%2===0;cursor=(cursor+1)%taskCount;spins++;
      if(seed&&product.seedPreview){product.seedPreview.step();product.seedSteps++;if(product.seedSteps>=190){product.seedModel=product.seedPreview.snapshot();product.seedQuality=product.seedPreview.quality();product.seedPreview=null;}}
      else if(!seed&&product.canonicalPreview){product.canonicalPreview.step();product.canonicalSteps++;if(product.canonicalSteps>=190){product.canonicalModel=product.canonicalPreview.snapshot();product.canonicalPreview=null;}}
    }
    animation.preparationCursor=cursor;animation.phaseElapsedMs+=elapsedMs;
    const timedOut=animation.phaseElapsedMs>=(reducedMotion?REDUCED_PRESENTATION_PHASES.prepare:NORMAL_PRESENTATION_PHASES.prepare),finished=animation.products.every(product=>product.seedModel&&product.canonicalModel);
    if(!timedOut&&!finished)return false;
    for(const product of animation.products){
      if(!product.seedModel&&product.seedPreview){product.seedModel=product.seedPreview.snapshot();product.seedQuality=product.seedPreview.quality();product.seedPreview=null;}
      if(!product.canonicalModel&&product.canonicalPreview){product.canonicalModel=product.canonicalPreview.snapshot();product.canonicalPreview=null;}
      const valid=model=>model?.atoms?.length===product.record.atoms.length&&model.atoms.every(atom=>atom.point&&[atom.point.x,atom.point.y,atom.point.z].every(Number.isFinite));
      const target=resolveProductTargetGeometry({seededPoints:valid(product.seedModel)?product.seedModel.atoms.map(atom=>atom.point.toArray()):null,seedConverged:!!product.seedQuality?.validation?.valid,canonicalPoints:valid(product.canonicalModel)?product.canonicalModel.atoms.map(atom=>atom.point.toArray()):null,sourcePoints:product.sourcePoints.map(point=>point.toArray()),elements:product.record.atoms.map((_,index)=>recordAtomElement(product.record,index))});
      product.model=withStaticChargeAuthority(target.geometry==='source-seeded'?product.seedModel:product.canonicalModel??product.seedModel??sourceContinuityPreview(product),product.record);
      product.targetPositions=target.points.map(point=>new THREE.Vector3(...point));product.targetGeometry=target.geometry;
      if(!target.ok||!product.model||product.targetPositions.some(point=>![point.x,point.y,point.z].every(Number.isFinite))){product.model=product.canonicalModel??product.seedModel;product.targetPositions=product.sourcePoints.map(point=>point.clone());product.targetGeometry='source-continuity-fallback';animation.targetPreparationFailed=target.reason??'non-finite-target';}
    }
    setupPresentationVisuals(animation);animation.productTargetsReady=true;animation.phase='TRANSFORMING';animation.phaseElapsedMs=0;updatePresentationFrame(animation,0,0);return true;
  }
  function sourceOrdersAndVisuals(animation){
    const oldOrders=new Map(),oldAromatic=new Map(),oldShared=new Map(),adjacency=new Map();
    for(const[role,item]of animation.sourceModels){
      const idFor=index=>sourceAtomId(role,index);
      for(const bond of item.record.bonds){const a=idFor(bond.a),b=idFor(bond.b);oldOrders.set(pairKey(a,b),{a,b,order:Number(bond.order)});adjacency.set(a,[...(adjacency.get(a)??[]),b]);adjacency.set(b,[...(adjacency.get(b)??[]),a]);}
      for(const cycle of item.record.aromaticCycles??[]){const atoms=cycle.map(idFor),key=atoms.slice().sort().join('|');oldAromatic.set(key,{atoms,key});}
      for(const shared of item.record.sharedGroups??[]){const row={kind:shared.kind,center:idFor(shared.center),ends:shared.ends.map(idFor)},key=`${row.kind}|${[row.center,...row.ends].sort().join('|')}`;oldShared.set(key,{...row,key});}
    }
    const newOrders=new Map([...oldOrders].map(([key,row])=>[key,{...row}]));
    for(const bond of animation.execution.graphDiff.brokenBonds)newOrders.delete(pairKey(bond.a,bond.b));
    for(const bond of animation.execution.graphDiff.formedBonds)newOrders.set(pairKey(bond.a,bond.b),{a:bond.a,b:bond.b,order:Number(bond.order)});
    for(const bond of animation.execution.graphDiff.bondOrderChanges)newOrders.set(pairKey(bond.a,bond.b),{a:bond.a,b:bond.b,order:Number(bond.to)});
    const newAromatic=new Map(),newShared=new Map();
    for(const product of animation.products){
      const sourceFor=index=>product.origins[index]?.sourceAtom;
      for(const cycle of product.model?.aromaticCycles??[]){const atoms=cycle.map(sourceFor);if(atoms.every(Boolean)){const key=atoms.slice().sort().join('|');newAromatic.set(key,{atoms,key});}}
      for(const shared of product.model?.sharedGroups??[]){const center=sourceFor(shared.center),ends=shared.ends.map(sourceFor);if(center&&ends.every(Boolean)){const row={kind:shared.kind,center,ends},key=`${row.kind}|${[center,...ends].sort().join('|')}`;newShared.set(key,{...row,key});}}
    }
    return{oldOrders,newOrders,oldAromatic,newAromatic,oldShared,newShared,adjacency};
  }
  function setupPresentationVisuals(animation){
    const graph=sourceOrdersAndVisuals(animation),oldSpecial=new Set([...graph.oldShared.values()].flatMap(group=>group.ends.map(end=>pairKey(group.center,end)))),newSpecial=new Set([...graph.newShared.values()].flatMap(group=>group.ends.map(end=>pairKey(group.center,end)))),oldAromaticEdges=new Set([...graph.oldAromatic.values()].flatMap(row=>row.atoms.map((id,index)=>pairKey(id,row.atoms[(index+1)%row.atoms.length])))),newAromaticEdges=new Set([...graph.newAromatic.values()].flatMap(row=>row.atoms.map((id,index)=>pairKey(id,row.atoms[(index+1)%row.atoms.length]))));
    const allKeys=new Set([...graph.oldOrders.keys(),...graph.newOrders.keys()]);
    for(const key of allKeys){
      const old=graph.oldOrders.get(key),next=graph.newOrders.get(key);if(!old&&!next)continue;const[a,b]=key.split('|');
      const wasSpecial=oldSpecial.has(key),isSpecial=newSpecial.has(key),wasAromatic=oldAromaticEdges.has(key),isAromatic=newAromaticEdges.has(key),oldOrder=old?(wasSpecial||wasAromatic?1:old.order):0,newOrder=next?(isSpecial||isAromatic?1:next.order):0,plan=planBondLaneTransition(oldOrder,newOrder),pa=new THREE.Vector3(...animation.sourcePositions.get(a)),pb=new THREE.Vector3(...animation.sourcePositions.get(b)),axis=pb.clone().sub(pa).normalize(),neighbor=(graph.adjacency.get(a)??[]).concat(graph.adjacency.get(b)??[]).find(id=>id!==a&&id!==b);let side;
      if(neighbor){const reference=new THREE.Vector3(...animation.sourcePositions.get(neighbor)).sub(pa.clone().add(pb).multiplyScalar(.5));side=reference.addScaledVector(axis,-reference.dot(axis));}
      else side=new THREE.Vector3().crossVectors(axis,Math.abs(axis.y)<.8?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0));
      if(side.lengthSq()<1e-9)side.set(0,0,1);side.normalize();
      const lanes=plan.lanes.map(lane=>{const meshes=Array.from({length:lane.kind==='broken'||lane.kind==='formed'?2:1},()=>{const material=new THREE.MeshStandardMaterial({color:'#c3d2dc',roughness:.6,transparent:true,opacity:1,depthWrite:false}),mesh=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,8),material);animation.root.add(mesh);return mesh;});return{...lane,meshes,side:side.clone(),previousAxis:axis.clone(),oldOrder,newOrder};});
      animation.bondVisuals.push({a,b,oldOrder,newOrder,lanes});
    }
    const ringKeys=new Set([...graph.oldAromatic.keys(),...graph.newAromatic.keys()]);
    for(const key of ringKeys){const row=graph.newAromatic.get(key)??graph.oldAromatic.get(key),ring=createAromaticRing(THREE);animation.root.add(ring);animation.aromaticVisuals.push({atoms:row.atoms,old:graph.oldAromatic.has(key),next:graph.newAromatic.has(key),ring});}
    const sharedKeys=new Set([...graph.oldShared.keys(),...graph.newShared.keys()]);
    for(const key of sharedKeys){const row=graph.newShared.get(key)??graph.oldShared.get(key),visual=createSharedBonds(THREE);animation.root.add(visual);animation.sharedVisuals.push({group:row,old:graph.oldShared.has(key),next:graph.newShared.has(key),visual});}
    for(const product of animation.products)for(let index=0;index<product.origins.length;index++){
      const atomId=product.origins[index].sourceAtom,hasSharedChargeSuppression=groups=>groups.some(group=>['nitro','ozone'].includes(group.kind)&&[group.center,...group.ends].includes(index)),chargeTransition=formalChargeVisualTransition(animation.execution.graphDiff,atomId,{oldVisualCharge:animation.sourceCharges.get(atomId)??0,newVisualCharge:product.model.atoms[index].charge??0,newSuppressed:hasSharedChargeSuppression(product.model.sharedGroups??[])}),oldCharge=chargeTransition.oldCharge,newCharge=chargeTransition.newCharge;
      if(oldCharge===newCharge&&oldCharge===0)continue;
      const oldLabel=oldCharge?createChargeLabel(THREE,oldCharge,document):null,newLabel=newCharge&&newCharge!==oldCharge?createChargeLabel(THREE,newCharge,document):null;
      for(const label of [oldLabel,newLabel])if(label)animation.root.add(label);
      animation.chargeVisuals.push({atomId,element:product.model.atoms[index].element,oldCharge,newCharge,oldLabel,newLabel});
    }
    for(const item of animation.participants)disposeItem(item);animation.sourceGroupsDisposed=true;
    animation.graph=graph;
  }
  function rotateBodyVector(point,orientation){return new THREE.Vector3(...point).applyQuaternion(new THREE.Quaternion(...orientation));}
  function bodyAtomWorldPositions(body){return body.atoms.map(atom=>rotateBodyVector(atom.positionAngstrom,body.orientation).add(new THREE.Vector3(...body.positionAngstrom)));}
  function pairSafety(left,right){
    const result=evaluateStageBPairForcesReadOnly([left,right]),leftForce=result.bodies.get(left.id)?.forceKcalMolAngstrom??[0,0,0],rightForce=result.bodies.get(right.id)?.forceKcalMolAngstrom??[0,0,0],axis=new THREE.Vector3(...left.positionAngstrom).sub(new THREE.Vector3(...right.positionAngstrom));
    if(axis.lengthSq()<1e-12){const a=bodyAtomWorldPositions(left),b=bodyAtomWorldPositions(right);let best=null,distance=Infinity;for(const p of a)for(const q of b){const d=p.distanceToSquared(q);if(d<distance){distance=d;best=p.clone().sub(q);}}axis.copy(best??new THREE.Vector3(1,0,0));}
    axis.normalize();const relative=leftForce.map((force,index)=>KCAL_MOL_AMU_TO_ANGSTROM_PS2*(force/left.massAmu-rightForce[index]/right.massAmu)),outward=Math.max(0,relative.reduce((sum,value,index)=>sum+value*axis.getComponent(index),0));
    return{safe:result.overlapGuardActivationCount===0&&Number.isFinite(outward)&&outward<=MAX_DOCK_RELEASE_SEPARATION_ACCELERATION,outwardAcceleration:outward,overlapGuardActivationCount:result.overlapGuardActivationCount};
  }
  function correctionDirection(product,otherBody){
    const pointA=new THREE.Vector3(...product.layout.body.positionAngstrom),pointB=new THREE.Vector3(...otherBody.positionAngstrom),direction=pointA.sub(pointB);
    if(direction.lengthSq()<1e-10){const a=bodyAtomWorldPositions(product.layout.body),b=bodyAtomWorldPositions(otherBody);let nearest=null,best=Infinity;for(const left of a)for(const right of b){const distance=left.distanceToSquared(right);if(distance<best){best=distance;nearest=left.clone().sub(right);}}direction.copy(nearest??new THREE.Vector3());}
    if(direction.lengthSq()<1e-10)direction.set(1,0,0);return direction.normalize();
  }
  function applyProductShift(product,shift){product.shiftAngstrom=[...shift];product.layout.position.add(new THREE.Vector3(...shift).multiplyScalar(REACTION_LAB_WORLD_UNITS_PER_ANGSTROM));product.layout.body.positionAngstrom=product.layout.position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM);}
  function makeRuntimeLayout(product,index,generation){
    const worldPoints=product.targetPositions.map(point=>point.clone()),atomsAngstrom=worldPoints.map((point,atomIndex)=>({element:recordAtomElement(product.record,atomIndex),positionAngstrom:point.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)})),massProperties=rigidBodyMassProperties(atomsAngstrom),position=new THREE.Vector3(...massProperties.centerOfMassAngstrom).multiplyScalar(REACTION_LAB_WORLD_UNITS_PER_ANGSTROM),model={...product.model,atoms:product.model.atoms.map((atom,atomIndex)=>({...atom,point:new THREE.Vector3(...massProperties.centeredPositionsAngstrom[atomIndex]).multiplyScalar(REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)}))},record=product.record,orientation=new THREE.Quaternion(),id=`handoff-${generation}-${index}`,atoms=model.atoms.map(atom=>({...atom,point:atom.point.clone()})),body=buildStageBody(id,record,atoms,position,orientation,massProperties);
    return{position,model,massProperties,body,worldPoints};
  }
  function resolveHandoffClearance(animation){
    const products=animation.products;for(const product of products){const previousShift=[...product.shiftAngstrom];product.layout=makeRuntimeLayout(product,product.productIndex,animation.generation);if(previousShift.some(value=>Math.abs(value)>1e-12))applyProductShift(product,previousShift);}
    const bystanders=instances.filter(item=>!item.busy&&!item.feedMotion&&item.batchGeneration===animation.generation),safeAgainst=(product,other)=>pairSafety(product.layout.body,other.stageBody??other);
    const orderedPairs=[];for(let index=0;index<products.length;index++)for(let other=index+1;other<products.length;other++)orderedPairs.push([products[other],products[index].layout.body]);
    for(const product of products)for(const bystander of bystanders)orderedPairs.push([product,bystander.stageBody]);
    let maxCorrection=Math.max(0,...products.map(product=>Math.hypot(...product.shiftAngstrom)));
    for(let pass=0;pass<3;pass++)for(const[product,other]of orderedPairs){
      if(safeAgainst(product,other).safe)continue;
      const direction=correctionDirection(product,other),base=[...product.shiftAngstrom];let safe=false;
      for(let step=1;step<=Math.ceil(MAX_HANDOFF_CORRECTION_ANGSTROM/.05);step++){
        const shift=base.map((value,axis)=>value+direction.getComponent(axis)*step*.05);product.shiftAngstrom=shift;product.layout.position.add(new THREE.Vector3(...direction.toArray()).multiplyScalar(.05*REACTION_LAB_WORLD_UNITS_PER_ANGSTROM));product.layout.body.positionAngstrom=product.layout.position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM);
        if(safeAgainst(product,other).safe){safe=true;maxCorrection=Math.max(maxCorrection,Math.hypot(...shift));break;}
      }
      if(!safe)maxCorrection=Math.max(maxCorrection,Math.hypot(...product.shiftAngstrom));
    }
    animation.clearancePairResults=orderedPairs.map(([product,other])=>({productIndex:product.productIndex,otherId:other.id,...safeAgainst(product,other)}));animation.clearanceSafe=animation.clearancePairResults.every(row=>row.safe);animation.clearanceCorrectionAngstrom=maxCorrection;
    if(!animation.clearanceSafe){animation.clearanceFallback='geometry-directed-conservative-translation';for(let pass=0;pass<3;pass++)for(const[product,other]of orderedPairs){if(safeAgainst(product,other).safe)continue;const direction=correctionDirection(product,other);for(let step=0;step<128;step++){product.shiftAngstrom=product.shiftAngstrom.map((value,axis)=>value+direction.getComponent(axis));product.layout.position.add(direction.clone().multiplyScalar(REACTION_LAB_WORLD_UNITS_PER_ANGSTROM));product.layout.body.positionAngstrom=product.layout.position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM);if(safeAgainst(product,other).safe)break;}}
      animation.clearancePairResults=orderedPairs.map(([product,other])=>({productIndex:product.productIndex,otherId:other.id,...safeAgainst(product,other)}));animation.clearanceSafe=animation.clearancePairResults.every(row=>row.safe);animation.clearanceCorrectionAngstrom=Math.max(0,...products.map(product=>Math.hypot(...product.shiftAngstrom)));if(!animation.clearanceSafe)animation.clearanceFallback='bounded-geometry-directed-translation-failed';
    }
    for(const product of products)product.finalTargetPositions=product.targetPositions.map(point=>point.clone().add(new THREE.Vector3(...product.shiftAngstrom).multiplyScalar(REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)));
  }
  function currentAtomPosition(animation,atomId,morph,settle){
    const start=new THREE.Vector3(...animation.sourcePositions.get(atomId)),product=animation.products.find(item=>item.origins.some(origin=>origin.sourceAtom===atomId)),index=product?.origins.findIndex(origin=>origin.sourceAtom===atomId)??-1;
    if(!product||index<0||!product.targetPositions?.[index])return start;const base=product.targetPositions[index],targetShift=product.shiftAngstrom??[0,0,0],startShift=animation.settleStartShifts?.get(product.productIndex)??[0,0,0],shift=targetShift.map((value,axis)=>startShift[axis]+(value-startShift[axis])*settle),target=base.clone().add(new THREE.Vector3(...shift).multiplyScalar(REACTION_LAB_WORLD_UNITS_PER_ANGSTROM));
    return start.lerp(target,morph);
  }
  function updatePresentationFrame(animation,morphProgress,settleProgress){
    const morph=smoothPresentationProgress(morphProgress),settle=smoothPresentationProgress(settleProgress),positions=new Map();
    for(const atomId of animation.sourcePositions.keys()){const point=currentAtomPosition(animation,atomId,morph,settle);positions.set(atomId,point);animation.atomPositionsNow.set(atomId,point);const mesh=animation.sourceMeshes.get(atomId);if(mesh)mesh.position.copy(point);}
    for(const row of animation.bondVisuals){const a=positions.get(row.a),b=positions.get(row.b);if(!a||!b)continue;const axis=b.clone().sub(a).normalize();for(const lane of row.lanes){
      lane.side.fromArray(transportBondLaneSide(lane.side.toArray(),lane.previousAxis.toArray(),axis.toArray()));lane.previousAxis.copy(axis);
      const oldOffset=lane.oldOrder?staticBondLaneOffsets(lane.oldOrder)[lane.index]:0,newOffset=lane.newOrder?staticBondLaneOffsets(lane.newOrder)[lane.index]:0,offset=lane.oldOrder&&lane.newOrder?oldOffset+(newOffset-oldOffset)*morph:lane.oldOrder?oldOffset:newOffset,segments=bondLaneSegments(lane.kind,morph);
      lane.meshes.forEach((mesh,index)=>{const segment=segments[index];mesh.visible=!!segment;if(!segment)return;const from=a.clone().lerp(b,segment.from).addScaledVector(lane.side,offset),to=a.clone().lerp(b,segment.to).addScaledVector(lane.side,offset),delta=to.clone().sub(from),length=delta.length();mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());mesh.scale.set(.045,length,.045);mesh.material.opacity=segment.opacity;});
    }}
    for(const row of animation.aromaticVisuals){const points=row.atoms.map(id=>positions.get(id)),opacity=row.old&&row.next?1:row.old?1-morph:morph;updateAromaticRing(THREE,row.ring,aromaticRingFrame(THREE,points));setAromaticOpacity(row.ring,opacity);}
    for(const row of animation.sharedVisuals){const opacity=row.old&&row.next?1:row.old?1-morph:morph;updateSharedBonds(THREE,row.visual,row.group,id=>positions.get(id));for(const mesh of row.visual.children){mesh.material.opacity=(mesh.userData.baseOpacity??.68)*opacity;mesh.visible&&=opacity>0;}}
    for(const row of animation.chargeVisuals){const point=positions.get(row.atomId);if(!point)continue;const offset=modelAtomRadius(row.element)+.12;if(row.oldLabel){row.oldLabel.position.copy(point).add(new THREE.Vector3(0,offset,0));row.oldLabel.material.opacity=row.oldCharge===row.newCharge?1:1-morph;}if(row.newLabel){row.newLabel.position.copy(point).add(new THREE.Vector3(0,offset,0));row.newLabel.material.opacity=morph;}}
    animation.currentProgress=morphProgress;animation.settleProgress=settleProgress;
  }
  function finishReactionHandoff(animation){
    if(!animation.clearanceSafe){status.textContent='REACTION · handoff安全配置を確認中';return;}updatePresentationFrame(animation,1,1);const productInstances=[];let maximumError=0;
    for(const product of animation.products){
      product.targetPositions=product.finalTargetPositions.map(point=>point.clone());const layout=makeRuntimeLayout(product,product.productIndex,animation.generation),item=createInstance(product.record,layout.position,{generation:animation.generation,preparedModel:layout.model});item.stageBody=layout.body;item.stageBody.id=item.id;
      const positions=product.finalTargetPositions.map(point=>point.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)),velocities=product.origins.map(origin=>animation.sourceVelocities.get(origin.sourceAtom)??[0,0,0]),massValues=product.record.atoms.map((_,index)=>STANDARD_ATOMIC_MASS_AMU[recordAtomElement(product.record,index)]),fit=fitRigidBodyVelocity(positions,velocities,massValues);
      if(fit.finite){item.stageBody.velocityAngstromPerPs=[...fit.linear];item.stageBody.angularVelocityRadPerPs=[...fit.angular];}
      for(let atomIndex=0;atomIndex<product.origins.length;atomIndex++){
        const sourceMesh=animation.sourceMeshes.get(product.origins[atomIndex].sourceAtom),replacement=item.atomMeshes.get(atomIndex);if(!sourceMesh||!replacement)continue;
        item.group.remove(replacement);replacement.geometry.dispose();replacement.material.dispose();animation.root.remove(sourceMesh);sourceMesh.userData.atomIndex=atomIndex;delete sourceMesh.userData.sourceAtomId;sourceMesh.position.copy(item.record.atoms[atomIndex].point);item.group.add(sourceMesh);item.atomMeshes.set(atomIndex,sourceMesh);
      }
      item.group.updateMatrixWorld(true);for(let atomIndex=0;atomIndex<product.origins.length;atomIndex++){const actual=item.group.localToWorld(item.record.atoms[atomIndex].point.clone()),expected=product.finalTargetPositions[atomIndex];maximumError=Math.max(maximumError,actual.distanceTo(expected));}
      productInstances.push({productIndex:product.productIndex,species:product.record.id,instanceId:item.id});
    }
    animation.handoffMaxAtomError=maximumError;animation.productInstances=productInstances;lastReactionPresentation={active:false,phase:'COMPLETE',elapsedMs:animation.elapsedMs,normalDurationMs:CHAMBER_PRESENTATION_MS,reducedMotionDurationMs:Object.values(REDUCED_PRESENTATION_PHASES).reduce((sum,value)=>sum+value,0),reducedMotion,reactionId:animation.execution.reactionId,pathwayId:animation.execution.pathwayId,participantIds:animation.execution.consumedInstanceIds,productCount:animation.products.length,sourceAtomCount:animation.sourcePositions.size,handoffMaxAtomError:maximumError,clearanceSafe:animation.clearanceSafe,clearanceCorrectionAngstrom:animation.clearanceCorrectionAngstrom,clearanceFallback:animation.clearanceFallback??null,clearancePairResults:animation.clearancePairResults??[],targetGeometry:animation.products.map(product=>product.targetGeometry??null),targetPreparationFailed:animation.targetPreparationFailed??null};world.remove(animation.root);disposeObject(animation.root);reactionAnimation=null;contactMatcher.reset();reactionDiagnostics=[];
    status.textContent=`反応完了 · ${animation.execution.products.map(record=>record.nameJa??record.id).join(' + ')}`;
    window.dispatchEvent(new CustomEvent('molecule-craft:reaction-lab-product',{detail:{reactionId:animation.execution.reactionId,familyId:animation.execution.familyId,pathwayId:animation.execution.pathwayId,reaction:animation.execution.reaction,environmentSnapshot:animation.execution.environmentSnapshot,environmentConditions:animation.execution.environmentConditions,participants:animation.execution.participants,matchedSites:animation.execution.matchedSites,products:animation.execution.products.map(record=>record.id),productInstances,atomOrigins:animation.execution.atomOrigins,graphDiff:animation.execution.graphDiff,consumed:animation.execution.consumedInstanceIds,batchGeneration:animation.generation}}));updateCommandBar();
  }
  function advanceReactionAnimation(elapsedMs){
    const animation=reactionAnimation;if(!animation)return;animation.elapsedMs+=elapsedMs;
    if(animation.phase==='PREPARING'){
      if(!animation.productTargetsReady){const ready=advanceProductPreparation(animation,elapsedMs);if(!ready){updatePresentationFrame(animation,0,0);return;}}
      return;
    }
    const phases=reducedMotion?REDUCED_PRESENTATION_PHASES:NORMAL_PRESENTATION_PHASES;
    if(animation.phase==='TRANSFORMING'){
      animation.phaseElapsedMs+=elapsedMs;const progress=clamp(animation.phaseElapsedMs/phases.transform,0,1);updatePresentationFrame(animation,progress,0);
      if(progress>=1){const starts=animation.products.map(product=>[product.productIndex,[...product.shiftAngstrom]]);animation.phase='SETTLING';animation.phaseElapsedMs=0;resolveHandoffClearance(animation);animation.settleStartShifts=new Map(starts);}return;
    }
    animation.phaseElapsedMs+=elapsedMs;const progress=clamp(animation.phaseElapsedMs/phases.settle,0,1);updatePresentationFrame(animation,1,progress);
    if(progress>=1){const starts=new Map(animation.products.map(product=>[product.productIndex,[...product.shiftAngstrom]]));resolveHandoffClearance(animation);const changed=animation.products.some(product=>Math.hypot(...product.shiftAngstrom.map((value,axis)=>value-starts.get(product.productIndex)[axis]))>1e-5);if(changed||!animation.clearanceSafe){animation.settleStartShifts=starts;animation.phaseElapsedMs=0;animation.settleRetryCount=(animation.settleRetryCount??0)+1;if(!animation.clearanceSafe&&animation.clearanceRetryDiagnostic!==true){animation.clearanceRetryDiagnostic=true;status.textContent='REACTION · handoff安全配置を確認中';}return;}finishReactionHandoff(animation);}
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
    const fixedStepStarted=performance.now();
    const active=instances.filter(item=>!item.busy&&!item.polymerDocking&&!item.feedMotion&&(!testIsolation||testIsolation.has(item.id))).map(item=>{
      const body=item.stageBody,dragged=item===selected&&isManipulating()&&down?.group===item;
      if(dragged){syncStageABodyFromGroup(item);body.velocityAngstromPerPs=[0,0,0];}
      body.kinematic=false;
      return body;
    });
    const started=performance.now();
    stageAForces=stageBPhysicsEnabled?integrateStageB(active,physicalDeltaPs,{collectPairDiagnostics:false}):integrateStageA(active,physicalDeltaPs,{collectPairDiagnostics:false});
    stageAPerformance.lastPhysicsDurationMs=performance.now()-started;
    stageAPerformance.lastInteractionPairCount=stageAForces.pairDiagnostics.length;
    stageAPerformance.fixedSteps++;
    for(const item of instances)if(!item.busy&&!item.polymerDocking&&!item.feedMotion){
      if(item===selected&&isManipulating()&&down?.group===item){
        item.stageBody.positionAngstrom=item.group.position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM);
        item.stageBody.velocityAngstromPerPs=[0,0,0];item.group.quaternion.set(...item.stageBody.orientation);item.group.updateMatrixWorld(true);
      }else syncGroupFromStageABody(item);
    }
    if(batch.phase===REACTION_LAB_BATCH_PHASES.ACTIVE){const stepMs=STAGE_A_GAME_STEP_SECONDS*1000;advancePolymerRuntime(stepMs);reactionStep(stepMs);}
    stageAPerformance.lastFixedStepDurationMs=performance.now()-fixedStepStarted;
  }
  const stageAStepper=createFixedStepAccumulator(integrateStageAStep,{gameStepSeconds:STAGE_A_GAME_STEP_SECONDS,physicalPsPerGameSecond:STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,maxCatchUpSteps:STAGE_A_MAX_CATCH_UP_STEPS});
  function tick(now){
    if(disposed)return;animationFrameId=requestAnimationFrame(tick);
    const elapsed=Math.max(0,now-last);last=now;
    if(document.hidden)return;
    if(!dialog.open||pickerOpen){renderer.render(scene,camera);return;}
    updateManipulation(elapsed);
    advanceBatchTransition(elapsed);
    const timeScale=chamberTime.scale,scaledElapsed=scaleSimulationElapsed(elapsed/1000,timeScale),acceptedElapsed=Math.min(scaledElapsed,STAGE_A_GAME_STEP_SECONDS*STAGE_A_MAX_CATCH_UP_STEPS);
    const timing=stageAStepper.advance(scaledElapsed);simulationClockSeconds+=acceptedElapsed;stageAPerformance.lastFrameStepCount=timing.steps;stageAPerformance.lastDroppedGameSeconds=timing.droppedGameSeconds;
    advanceReactionAnimation(elapsed);
    advancePolymerPresentation(elapsed);
    renderer.render(scene,camera);
  }
  updateCamera();animationFrameId=requestAnimationFrame(tick);
  document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden)setMediumSelectorOpen(false);},{signal:eventController.signal});

  function setDialogOpen(open){onDialogStateChange(open);}
  function open(){renderSlotTiles();if(!dialog.open)dialog.showModal();dialogOpenState=true;setDialogOpen(true);last=performance.now();resize();if(polymerSamplePresentation?.phase==='hold')dockPolymerSample(1);return true;}
  function closeAndWait(){if(!dialogOpenState&&!dialog.open)return Promise.resolve(false);return new Promise(resolve=>{closeWaiters.add(resolve);if(dialog.open)dialog.close();});}
  root.querySelector('[data-lab-close]')?.addEventListener('click',()=>dialog.close(),eventOptions);
  dialog.addEventListener('close',()=>{closePicker({returnFocus:false});setMediumSelectorOpen(false);if(polymerSamplePresentation&&!polymerSamplePresentation.ready&&!polymerSamplePresentation.dismissed){polymerSamplePresentation.dismissed=true;dispatchPolymerEvent('molecule-craft:reaction-lab-polymer-sample-dismiss',{sampleId:polymerSamplePresentation.sampleId,batchGeneration:polymerSamplePresentation.batchGeneration});}cancelAllPointers();last=performance.now();dialogOpenState=false;setDialogOpen(false);for(const resolve of closeWaiters)resolve(true);closeWaiters.clear();},{signal:eventController.signal});

  if(localhostPhysicsTest){
    const probeForces=()=>stageBPhysicsEnabled?evaluateStageBForces(instances.filter(item=>!item.busy&&!item.polymerDocking&&!item.feedMotion&&(!testIsolation||testIsolation.has(item.id))).map(item=>item.stageBody)):stageAForces;
    const probe={
      physicsMode:stageBPhysicsEnabled?'stage-b':'stage-a',physicalPsPerGameSecond:STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,qA:stageBPhysicsEnabled?stageBChargeE:null,
      snapshot:()=>{
        const current=probeForces(),state=batch.snapshot();
        return{
          physicsMode:stageBPhysicsEnabled?'stage-b':'stage-a',physicalPsPerGameSecond:STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,fixedGameStepSeconds:STAGE_A_GAME_STEP_SECONDS,qA:stageBPhysicsEnabled?stageBChargeE:null,
          simulationTimeMode:chamberTime.mode,simulationTimeScale:chamberTime.scale,simulationClockSeconds,simulationSuspended:pickerOpen||!dialog.open,pickerOpen,manipulationActive:isManipulating(),draggedInstanceId:selected?.id??null,depthTargetId:depthTarget,depthDockingState,pointerAnchorErrorPx,depthOutwardAcceleration,depthSafetySampleCount,
          batch:{...state,transitionKind:batchTransition?.kind??null,transitionGeneration:batchTransition?.generation??null,feedEntryCount:batchTransition?.entries?.length??0,feedEntriesHandedOff:batchTransition?.entries?.filter(row=>row.item?.feedHandoff).length??0,reactionEnabled:state.phase===REACTION_LAB_BATCH_PHASES.ACTIVE&&!reactionAnimation&&!polymerRouteOwned,reactionPresentationActive:!!reactionAnimation},
          polymerization:(()=>{const tx=polymerCore.snapshot();return{routeOwned:polymerRouteOwned,beginError:polymerBeginError,routeId:tx?.routeId??polymerCore.routeId??null,polymerId:tx?.polymerId??null,state:tx?.state??null,stepKind:tx?.stepKind??null,waitReason:tx?.waitReason??null,manualStepCount:tx?.manualStepCount??0,automaticStepCount:tx?.automaticStepCount??0,reservedInstanceIds:tx?.reservedInstanceIds??[],consumedInstanceIds:tx?.consumedInstanceIds??[],sourceMeshCount:polymerGraphVisual?.atomMeshesByOrigin.size??0,sampleId:polymerSamplePresentation?.sampleId??null,sampleReady:!!polymerSamplePresentation?.ready,samplePhase:polymerSamplePresentation?.phase??null,sampleBayRegion:polymerSamplePresentation?.region??null,sampleEvidence:tx?.sample?.evidence??null,siteTarget:polymerSiteIndicator.hidden?null:{x:Number(polymerSiteIndicator.dataset.targetX),y:Number(polymerSiteIndicator.dataset.targetY),semantic:polymerSiteIndicator.textContent,acquired:polymerSiteIndicator.dataset.acquired==='true'},dockAttempt:polymerDockAttempt,autoAttempt:polymerAutoAttempt};})(),
          reactionPresentation:reactionAnimation?{active:true,phase:reactionAnimation.phase,phaseElapsedMs:reactionAnimation.phaseElapsedMs,progress:reactionAnimation.currentProgress??0,settleProgress:reactionAnimation.settleProgress??0,reactionId:reactionAnimation.execution.reactionId,pathwayId:reactionAnimation.execution.pathwayId,participantIds:reactionAnimation.execution.consumedInstanceIds,productTargetsReady:reactionAnimation.productTargetsReady,productCount:reactionAnimation.products.length,sourceAtomCount:reactionAnimation.sourcePositions.size,presentationAtomCount:reactionAnimation.sourceMeshes.size,visiblePresentationAtomCount:[...reactionAnimation.sourceMeshes.values()].filter(mesh=>mesh?.parent===reactionAnimation.root).length,handoffMaxAtomError:reactionAnimation.handoffMaxAtomError,clearanceSafe:reactionAnimation.clearanceSafe,clearanceCorrectionAngstrom:reactionAnimation.clearanceCorrectionAngstrom,clearancePairResults:reactionAnimation.clearancePairResults??[],targetGeometry:reactionAnimation.products.map(product=>product.targetGeometry??null),targetPreparationFailed:reactionAnimation.targetPreparationFailed??null,phaseDurationMs:(reducedMotion?REDUCED_PRESENTATION_PHASES:NORMAL_PRESENTATION_PHASES)[reactionAnimation.phase==='PREPARING'?'prepare':reactionAnimation.phase==='TRANSFORMING'?'transform':'settle']}:lastReactionPresentation,
          instances:instances.map(item=>({...stageABodySnapshot(item.stageBody),species:item.species,atomCount:item.record.atoms.length,busy:item.busy,polymerReservation:item.polymerReservation??null,polymerDocking:!!item.polymerDocking,position:item.group.position.toArray(),initialPositionAtSpawn:item.initialPositionAtSpawn?[...item.initialPositionAtSpawn]:null,batchGeneration:item.batchGeneration,originPortIndex:item.feedOriginPortIndex,feedPhase:item.feedPhase,feedHandoff:item.feedHandoff,kinematic:!!item.stageBody.kinematic,charges:[...item.record.nonbonded.atomicChargesE],carbonylSites:stageBPhysicsEnabled?stageBCarbonylDiagnostics(item.stageBody):[],renderedAtomCount:stageBPhysicsEnabled?item.atomMeshes.size:null,expectedRealAtomCount:stageBPhysicsEnabled?item.record.atoms.length:null,renderedGroupChildCount:stageBPhysicsEnabled?item.group.children.length:null})),
          purging:purgeItems.map(item=>({id:item.id,species:item.species,position:item.group.position.toArray()})),pairs:current.pairDiagnostics.map(pair=>({...pair})),
          diagnostics:{overlapGuardActivationCount:current.overlapGuardActivationCount,carbonylSiteCount:instances.reduce((sum,item)=>sum+(item.stageBody?.carbonylAnisotropySites?.length??0),0),...stageAPerformance,lastInteractionPairCount:current.pairDiagnostics.length},
          reactionCandidates:[...reactionDiagnostics],environment:activationEnvironment.snapshot(),reactionEnvironment:[...activationEnvironment.conditions()].sort(),
          camera:{distance,azimuth:FIXED_CAMERA_AZIMUTH,elevation:FIXED_CAMERA_ELEVATION},selectedInstanceId:selected?.id??null,downInstanceId:down?.group?.id??null,dialogOpen:dialog.open,pointerActive:activePointers.size>0,
        };
      },
      setGeometry(poses){const ids=new Set(poses.map(pose=>pose.id));if(ids.size!==poses.length)throw Error('Stage A geometry fixture contains duplicate molecule IDs');endManipulation();activePointers.clear();pinchActive=false;pinchDistance=0;onPointerLockChange(false);testIsolation=ids.size?ids:null;contactMatcher.reset();reactionDiagnostics=[];for(const pose of poses){const item=instanceById(pose.id);if(!item)throw Error(`Missing fixture molecule ${pose.id}`);if(pose.positionAngstrom)item.stageBody.positionAngstrom=[...pose.positionAngstrom];if(pose.orientation)item.stageBody.orientation=[...pose.orientation];item.stageBody.velocityAngstromPerPs=[...(pose.velocityAngstromPerPs??[0,0,0])];item.stageBody.angularVelocityRadPerPs=[...(pose.angularVelocityRadPerPs??[0,0,0])];syncGroupFromStageABody(item);}clearDepthTarget();updateCommandBar();return this.snapshot();},
      advanceDeterministic(steps=1){const count=Math.max(0,Math.min(600,Math.floor(steps)));stageAStepper.reset();for(let index=0;index<count;index++){integrateStageAStep(STAGE_A_GAME_STEP_SECONDS*STAGE_A_PHYSICAL_PS_PER_GAME_SECOND);simulationClockSeconds+=STAGE_A_GAME_STEP_SECONDS;}return this.snapshot();},
      measureFixedSteps(steps=1){const count=Math.max(0,Math.min(600,Math.floor(steps))),durationsMs=[];stageAStepper.reset();for(let index=0;index<count;index++){integrateStageAStep(STAGE_A_GAME_STEP_SECONDS*STAGE_A_PHYSICAL_PS_PER_GAME_SECOND);simulationClockSeconds+=STAGE_A_GAME_STEP_SECONDS;durationsMs.push(stageAPerformance.lastFixedStepDurationMs);}return{durationsMs,candidateCount:reactionDiagnostics.length,reactionIds:[...new Set(reactionDiagnostics.map(item=>item.reactionId))].sort()};},
      decomposePair(aId,bId){const a=instanceById(aId),b=instanceById(bId);if(!a||!b)throw Error('Missing Reaction Lab molecule instance');const result=stageBPhysicsEnabled?evaluateStageBForces([a.stageBody,b.stageBody]):evaluateStageAForces([a.stageBody,b.stageBody]);return{pairs:result.pairDiagnostics,bodies:Object.fromEntries([...result.bodies].map(([id,state])=>[id,state])),overlapGuardActivationCount:result.overlapGuardActivationCount};},
      measurePairReleaseTrajectory(aId,bId){
        if(!stageBPhysicsEnabled)throw Error('Release handoff measurement requires production Stage B');
        const source=[instanceById(aId),instanceById(bId)];if(source.some(item=>!item)||source[0]===source[1])throw Error('Missing distinct Reaction Lab molecule pair');
        const bodies=source.map(item=>({...item.stageBody,positionAngstrom:[...item.stageBody.positionAngstrom],orientation:[...item.stageBody.orientation],velocityAngstromPerPs:[...item.stageBody.velocityAngstromPerPs],angularVelocityRadPerPs:[...item.stageBody.angularVelocityRadPerPs]})),normal=cameraNormal().toArray();
        const rotate=(point,q)=>{const[x,y,z,w]=q,[px,py,pz]=point,tx=2*(y*pz-z*py),ty=2*(z*px-x*pz),tz=2*(x*py-y*px);return[px+w*tx+(y*tz-z*ty),py+w*ty+(z*tx-x*tz),pz+w*tz+(x*ty-y*tx)];};
        const measure=()=>{const separation=Math.abs(bodies[0].positionAngstrom.reduce((sum,value,index)=>sum+(value-bodies[1].positionAngstrom[index])*normal[index],0)),left=[],right=[];for(const atom of bodies[0].atoms)left.push(rotate(atom.positionAngstrom,bodies[0].orientation).map((value,index)=>value+bodies[0].positionAngstrom[index]));for(const atom of bodies[1].atoms)right.push(rotate(atom.positionAngstrom,bodies[1].orientation).map((value,index)=>value+bodies[1].positionAngstrom[index]));let minimumAtomDistance=Infinity;for(const a of left)for(const b of right)minimumAtomDistance=Math.min(minimumAtomDistance,Math.hypot(...a.map((value,index)=>value-b[index])));return{centerDepthSeparationAngstrom:separation,minimumAtomDistanceAngstrom:minimumAtomDistance};};
        const initial=measure(),rows=[];let completed=0,overlapGuardActivationCount=0;
        for(const steps of [3,8,16]){for(;completed<steps;completed++)overlapGuardActivationCount+=integrateStageB(bodies,STAGE_A_GAME_STEP_SECONDS*STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,{collectPairDiagnostics:false}).overlapGuardActivationCount??0;const current=measure();rows.push({steps,centerDepthSeparationAngstrom:current.centerDepthSeparationAngstrom,separationIncreaseAngstrom:current.centerDepthSeparationAngstrom-initial.centerDepthSeparationAngstrom,minimumAtomDistanceAngstrom:current.minimumAtomDistanceAngstrom,overlapGuardActivationCount,finite:[current.centerDepthSeparationAngstrom,current.minimumAtomDistanceAngstrom].every(Number.isFinite)});}
        return{pairIds:[aId,bId],initial,rows};
      },
      reactionContactDiagnostics(reactionId){return reactionDiagnostics.filter(item=>item.reactionId===reactionId);},
      startReactionTrajectoryTrace(reactionId,participantIds){if(!localhostPhysicsTest)throw Error('Reaction trajectory tracing is localhost-only');reactionTrajectoryTrace={reactionId,participantIds:participantIds?[...participantIds].sort():null,samples:[]};return{reactionId,participantIds:reactionTrajectoryTrace.participantIds};},
      reactionTrajectoryTrace(){return reactionTrajectoryTrace?{reactionId:reactionTrajectoryTrace.reactionId,participantIds:reactionTrajectoryTrace.participantIds,samples:reactionTrajectoryTrace.samples.map(sample=>({...sample}))}:null;},
      stopReactionTrajectoryTrace(){const trace=reactionTrajectoryTrace?{reactionId:reactionTrajectoryTrace.reactionId,participantIds:reactionTrajectoryTrace.participantIds,samples:reactionTrajectoryTrace.samples.map(sample=>({...sample}))}:null;reactionTrajectoryTrace=null;return trace;},
      setEnvironmentConditions(tokens){if(environmentControlsLocked())throw Error('Environment controls are locked.');activationEnvironment.setFromConditionTokens(tokens);syncPolymerEnvironment();updateEnvironmentControls();return this.snapshot();},
      setStageAPair(aId,positionA,bId,positionB){return this.setGeometry([{id:aId,positionAngstrom:positionA},{id:bId,positionAngstrom:positionB}]);},
      settlePair(aId,bId){for(const id of [aId,bId]){const item=instanceById(id);if(!item)throw Error(`Missing Reaction Lab molecule ${id}`);item.stageBody.velocityAngstromPerPs=[0,0,0];item.stageBody.angularVelocityRadPerPs=[0,0,0];syncGroupFromStageABody(item);}return this.snapshot();},
      // Localhost deterministic approach fixture for calibration and Stage A
      // comparison only. User-reachable acceptance uses real pointer events.
      prepareReactionApproach(reactionId,separationWorld=4.2){
        const candidate=instances.flatMap((left,index)=>instances.slice(index+1).flatMap(right=>reactionCandidates([{species:left.species,id:left.id},{species:right.species,id:right.id}],reactionCatalog))).find(item=>item.reactionId===reactionId);
        if(!candidate)throw Error(`No live instance pair for ${reactionId}`);
        distance=15;updateCamera();
        const ids=resolveCandidateInstanceIds(candidate,instances.map(item=>item.id)),[left,right]=ids.map(instanceById),anchor=candidate.geometryConstraints[0],atomA=anchor.from.atomIndex,atomB=anchor.to.atomIndex;
        testIsolation=new Set(ids);contactMatcher.reset();clearDepthTarget();endManipulation();
        for(const item of instances){item.busy=false;item.stageBody.velocityAngstromPerPs=[0,0,0];item.stageBody.angularVelocityRadPerPs=[0,0,0];item.group.quaternion.identity();if(item!==left&&item!==right)item.group.position.set(9,9,0);}
        const axis=cameraRight(),normal=cameraNormal(),pointA=left.record.atoms[atomA].point,pointB=right.record.atoms[atomB].point;
        left.group.position.copy(axis.clone().multiplyScalar(-2.4));
        right.group.position.copy(left.group.position).addScaledVector(axis,separationWorld).add(vector(THREE,pointA)).sub(vector(THREE,pointB)).addScaledVector(normal,3.4);
        for(const item of instances)syncStageABodyFromGroup(item);
        const plan=this.dragPlan(left.id,atomA,separationWorld?axis.clone().multiplyScalar(separationWorld):[0,0,0]);
        return{...plan,reactionId,left:left.id,right:right.id,siteA:atomA,siteB:atomB,initialSiteDistance:atomWorld(left,atomA).distanceTo(atomWorld(right,atomB)),initialDepthDelta:Math.abs(left.group.position.clone().sub(right.group.position).dot(normal))};
      },
      prepareGenericReactionPose(reactionId){
        // Localhost-only geometry probe. It selects a candidate by ID for the
        // test but uses one family-agnostic target placement and no tuned pose.
        const candidates=instances.flatMap((left,index)=>instances.slice(index+1).flatMap(right=>reactionCandidates([{species:left.species,id:left.id},{species:right.species,id:right.id}],reactionCatalog)));
        const candidate=candidates.find(item=>item.reactionId===reactionId);
        if(!candidate)throw Error(`No production pathway for ${reactionId}`);
        const [leftId,rightId]=candidate.reactantInstanceIds,left=instanceById(leftId),right=instanceById(rightId),anchor=candidate.geometryConstraints[0],siteA=anchor.from.atomIndex,siteB=anchor.to.atomIndex;
        testIsolation=new Set([leftId,rightId]);contactMatcher.reset();reactionDiagnostics=[];endManipulation();
        for(const item of instances){item.busy=false;item.stageBody.velocityAngstromPerPs=[0,0,0];item.stageBody.angularVelocityRadPerPs=[0,0,0];item.group.quaternion.identity();if(item!==left&&item!==right)item.group.position.set(9,9,0);}
        left.group.position.set(0,0,0);const axis=cameraRight(),pointA=left.record.atoms[siteA].point,pointB=right.record.atoms[siteB].point;
        right.group.position.copy(pointA).addScaledVector(axis,anchor.target*REACTION_LAB_WORLD_UNITS_PER_ANGSTROM).sub(pointB);
        for(const item of instances)syncStageABodyFromGroup(item);
        clearDepthTarget();return{reactionId,ids:[leftId,rightId],siteA,siteB,distanceAngstrom:atomWorldAngstrom(left,siteA).reduce((sum,value,index)=>sum+(value-atomWorldAngstrom(right,siteB)[index])**2,0)**.5};
      },
      preparePairApproach(speciesA,speciesB,separationWorld=4.2,depthDeltaWorld=3.4){
        const left=instances.find(item=>item.species===speciesA),right=instances.find(item=>item!==left&&item.species===speciesB);if(!left||!right)throw Error('Requested molecule pair is not present');
        distance=15;updateCamera();
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
      polymerDockPlan(instanceId){const item=instanceById(instanceId);if(!item)throw Error(`Missing polymer Feed molecule ${instanceId}`);const preview=polymerInteraction(item);if(!preview.ok)throw Error(`Polymer interaction is not available: ${preview.reason}`);const target=polymerTargetWorld(preview.interaction);return{instanceId,species:item.species,interaction:preview.interaction,start:projectPoint(atomWorld(item,preview.interaction.incomingAtomIndex)),end:projectPoint(target),target:polymerSiteIndicator.hidden?null:{x:Number(polymerSiteIndicator.dataset.targetX),y:Number(polymerSiteIndicator.dataset.targetY)},position:item.group.position.toArray()};},
      projectedBounds(){const rect=canvas.getBoundingClientRect();return instances.map(item=>{const rows=item.record.atoms.map((atom,index)=>{const point=atomWorld(item,index),screen=projectPoint(point),radius=modelAtomRadius(atom.element)*rect.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*viewDepth(point));return{x:screen.x,y:screen.y,z:screen.z,radius};});return{id:item.id,atoms:rows,bounds:rows.length?{left:Math.min(...rows.map(row=>row.x-row.radius)),right:Math.max(...rows.map(row=>row.x+row.radius)),top:Math.min(...rows.map(row=>row.y-row.radius)),bottom:Math.max(...rows.map(row=>row.y+row.radius))}:null};});},
      setSimulationClock(seconds){if(!Number.isFinite(seconds)||seconds<0)throw Error('Simulation clock must be a finite non-negative number.');simulationClockSeconds=seconds;contactMatcher.reset();return this.snapshot();},
      refresh(){return this.snapshot();},
    };
    window.__reactionLabProbe=probe;
  }
  return {open,closeAndWait,isOpen:()=>dialog.open,getBatchGeneration:()=>batch.snapshot().generation,dispose(){disposed=true;cancelAnimationFrame(animationFrameId);closePicker({returnFocus:false});eventController.abort();batch.invalidate();resizeObserver.disconnect();clear();renderer.dispose();for(const resolve of closeWaiters)resolve(false);closeWaiters.clear();onPointerLockChange(false);}};
}
