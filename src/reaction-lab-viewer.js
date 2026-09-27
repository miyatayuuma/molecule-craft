Warning: truncated output (original token count: 17121)
Total output lines: 624

import { createPreviewModel } from './preview-model.js?v=32';
import { ELEMENTS, modelAtomRadius } from './chemistry.js?v=20';
import {
  reactionCandidates, planReactionExecution, resolveCandidateInstanceIds,
  compileReactionCatalog, createContactMatcher, scoreReactionGeometry,
  arbitrateReactionCandidates, resolveSupplementalParticipants, environmentMatches, CONTACT_DWELL_MS,
} from './reaction-lab-core.js?v=10';
import { createReactionLabBatch, deterministicFeedVariation, planFeedSchedule, REACTION_LAB_BATCH_PHASES } from './reaction-lab-batch.js?v=1';
import {
  REACTION_LAB_WORLD_UNITS_PER_ANGSTROM, STAGE_A_GAME_STEP_SECONDS,
  STAGE_A_MAX_CATCH_UP_STEPS, STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,
  createFixedStepAccumulator, createStageABody, evaluateStageAForces,
  integrateStageA, rigidBodyMassProperties, stageABodySnapshot, canonicalNonbondedPairGeometry,
} from './reaction-lab-stage-a.js?v=4';
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
const FLUSH_PRESENTATION_MS=760;
const FEED_TRAVEL_MS=330;
const CAMERA_MIN_DISTANCE=7;
const CAMERA_MAX_DISTANCE=64;

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
  const feedButton=root.querySelector('[data-lab-feed]'),commandState=root.querySelector('[data-lab-command-state]');
  const picker=root.querySelector('[data-lab-picker]'),pickerList=root.querySelector('[data-lab-picker-list]'),pickerSearch=root.querySelector('[data-lab-search]');
  const batch=createReactionLabBatch(records),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  let instances=[],purgeItems=[],selected=null,down=null,testIsolation=null;
  let distance=15,last=performance.now(),disposed=false,reactionAnimation=null,batchTransition=null,simulationClockSeconds=0,animationFrameId=0,pickerOpen=false,pickerSlotIndex=-1,pickerSource=null;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const contactMatcher=createContactMatcher();
  const reactionEnvironment=new Set();let reactionDiagnostics=[],reactionTrajectoryTrace=null;
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
  function clearDepthTarget(){depthTarget=null;depthDockingState='none';pointerAnchorErrorPx=0;targetIndicator.hidden=true;}
  function endManipulation(){
    const item=selected;
    if(item){syncStageABodyFromGroup(item);item.stageBody.velocityAngstromPerPs=[0,0,0];}
    selected=null;down=null;chamberTime.setMode(CHAMBER_TIME_MODES.NORMAL);clearDepthTarget();
  }
  function instanceById(id){return instances.find(item=>item.id===id)??null;}
  function disposeItem(item){world.remove(item.group);item.group.traverse(object=>{object.geometry?.dispose?.();object.material?.dispose?.();});}
  function clear(){endManipulation();for(const pointerId of activePointers.keys())try{if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}activePointers.clear();for(const item of new Set([...instances,...purgeItems,...(batchTransition?.items??[])]))disposeItem(item);instances=[];purgeItems=[];batchTransition=null;reactionAnimation=null;contactMatcher.reset();testIsolation=null;reactionDiagnostics=[];}

  function createInstance(record,position,{generation=batch.generation,orientation=null,originPortIndex=null,feedPhase='chamber',preparedModel=null}={}){
    let model=preparedModel;
    if(!model){const preview=createPreviewModel(THREE,record);for(let index=0;index<190;index++)preview.step();model=preview.snapshot();}
    const group=new THREE.Group(),id=`${record.id}-${++instanceSequence}`;
    if(!record.nonbonded)throw new Error(`Canonical nonbonded data is required for ${record.id}.`);
    const massProperties=rigidBodyMassProperties(model.atoms.map(atom=>({element:atom.element,positionAngstrom:atom.point.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)})));
    const renderAtoms=model.atoms.map((atom,index)=>({...atom,point:vector(THREE,massProperties.centeredPositionsAngstrom[index].map(value=>value*REACTION_LAB_WORLD_UNITS_PER_ANGSTROM))}));
    group.position.copy(position);if(orientation)group.rotation.set(orientation.pitch,orientation.yaw,orientation.roll);
    for(const atom of renderAtoms){const geometry=new THREE.SphereGeometry(modelAtomRadius(atom.element),16,12),material=new THREE.MeshStandardMaterial({color:ELEMENTS[atom.element]?.color??'#cbd5e1',roughness:.32,metalness:.08}),mesh=new THREE.Mesh(geometry,material);mesh.position.copy(atom.point);mesh.userData.atomIndex=atom.id;group.add(mesh);}
    for(const bond of model.bonds){const a=vector(THREE,renderAtoms[bond.a].point),b=vector(THREE,renderAtoms[bond.b].point),direction=b.clone().sub(a),length=direction.length(),geometry=new THREE.CylinderGeometry(.055,.055,length,8),material=new THREE.MeshStandardMaterial({color:'#c3d2dc',roughness:.6}),mesh=new THREE.Mesh(geometry,material);mesh.position.copy(a.add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());group.add(mesh);}
    world.add(group);
    const item={id,species:record.id,record:{...record,atoms:renderAtoms,bonds:model.bonds},group,busy:false,batchGeneration:generation,feedOriginPortIndex:originPortIndex,feedPhase,feedHandoff:false};
    if(localhostPhysicsTest)item.initialPositionAtSpawn=position.toArray();
    item.stageBody=createStageABody({id,positionAngstrom:position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM),orientation:[group.quaternion.x,group.quaternion.y,group.quaternion.z,group.quaternion.w],atoms:renderAtoms.map((atom,index)=>({element:atom.element,chargeE:record.nonbonded.atomicChargesE[index],sigmaAngstrom:record.nonbonded.sigmaAngstrom[index],epsilonKcalMol:record.nonbonded.epsilonKcalMol[index],positionAngstrom:atom.point.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)})),virtualChargeSites:record.nonbonded.virtualChargeSites.map(site=>({chargeE:site.chargeE,positionAngstrom:site.positionAngstromAngstrom??site.positionAngstrom})),massProperties});
    if(stageBPhysicsEnabled){
      const geometryAtoms=renderAtoms.map(atom=>({element:atom.element,positionAngstrom:atom.point.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)}));
      item.stageBody.carbonylAnisotropySites=detectCarbonylAnisotropySites(geometryAtoms,record.bonds,{qA:stageBChargeE});
      item.stageBody.stageBVirtualChargeSites=createStageBVirtualSites(geometryAtoms,record.bonds,{qA:stageBChargeE});
    }else{item.stageBody.carbonylAnisotropySites=[];item.stageBody.stageBVirtualChargeSites=[];}
    instances.push(item);return item;
  }

  function isTransitionLocked(){return batch.phase===REACTION_LAB_BATCH_PHASES.FLUSHING||batch.phase===REACTION_LAB_BATCH_PHASES.FEEDING;}
  function hasPointerGesture(){return !!selected||activePointers.size>0||pinchActive;}
  function canEditRack(){return !disposed&&!pickerOpen&&!isTransitionLocked()&&!reactionAnimation&&!hasPointerGesture();}
  function updateCommandBar(){
    const state=batch.snapshot(),dirty=state.draftSlots.some((species,index)=>species!==state.activeSlots[index]);
    commandState.textContent=state.phase===REACTION_LAB_BATCH_PHASES.FLUSHING?'FLUSHING':state.phase===REACTION_LAB_BATCH_PHASES.FEEDING?'FEEDING':reactionAnimation?'REACTION':state.phase===REACTION_LAB_BATCH_PHASES.ACTIVE?dirty?'DRAFT READY':'BATCH ACTIVE':'RACK READY';
    slots.forEach((tile,index)=>{tile.disabled=!canEditRack();tile.setAttribute('aria-expanded',String(pickerOpen&&pickerSlotIndex===index));});
    feedButton.disabled=!canEditRack()||(!state.draftSlots.some(Boolean)&&state.phase===REACTION_LAB_BATCH_PHASES.IDLE);
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
  dialog.addEventListener('cancel',event=>{if(pickerOpen){event.preventDefault();closePicker();}},{signal:eventController.signal});
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
    const entries=schedule.map(row=>{const variation=deterministicFeedVariation(row.slotIndex,row.waveIndex,row.index),travelMs=reducedMotion?Math.max(150,Math.round(220/variation.speed)):Math.round(FEED_TRAVEL_MS/variation.speed);return{...row,variation,travelMs,startedAt:null,item:null};}).sort((a,b)=>a.startDelayMs-b.startDelayMs||a.slotIndex-b.slotIndex||a.index-b.index);
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
    purgeItems=instances;instances=[];const durationMs=reducedMotion?360:FLUSH_PRESENTATION_MS;
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
    instances.forEach(item=>{item.feedPhase='dynamic';});fitPopulation();status.textContent=`ACTIVE · ${instances.length} 個`;renderSlotTiles();
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
      const depth=viewDepth(item.group.localToWorld(localAnchor.clone())),worldPerPixel=2*depth*Math.tan(THREE.MathUtils.degToRad…1121 tokens truncated…d){
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
    if(down?.pointerId===event.pointerId&&!wasPinching)endManipulation();
    activePointers.delete(event.pointerId);try{canvas.releasePointerCapture(event.pointerId);}catch{}
    if(wasPinching){if(activePointers.size===0){pinchActive=false;pinchDistance=0;clearDepthTarget();}onPointerLockChange(activePointers.size>0);updateCommandBar();return;}
    onPointerLockChange(activePointers.size>0);updateCommandBar();
  }
  canvas.addEventListener('pointerup',endPointer,eventOptions);canvas.addEventListener('pointercancel',endPointer,eventOptions);
  canvas.addEventListener('wheel',event=>{event.preventDefault();if(pickerOpen||isTransitionLocked()||reactionAnimation)return;distance=clamp(distance*Math.exp(event.deltaY*.001),CAMERA_MIN_DISTANCE,CAMERA_MAX_DISTANCE);updateCamera();},{passive:false,signal:eventController.signal});

  function reactionStep(stepMs){
    if(batch.phase!==REACTION_LAB_BATCH_PHASES.ACTIVE||reactionAnimation)return;
    const manipulating=isManipulating(),rows=[],ready=[];
    if(manipulating)contactMatcher.reset();
    contactMatcher.beginStep();
    const active=[...instances].filter(item=>!item.feedMotion&&item.batchGeneration===batch.generation).sort((a,b)=>a.id.localeCompare(b.id));
    function assess(candidate){
      const rejectionReasons=[],encounterIds=candidate.reactantInstanceIds,encounter=encounterIds.map(instanceById);
      if(encounter.some(item=>!item))rejectionReasons.push('participant-missing');
      if(encounter.some(item=>item?.busy))rejectionReasons.push('participant-busy');
      if(encounter.some(item=>item&&testIsolation&&!testIsolation.has(item.id)))rejectionReasons.push('outside-test-isolation');
      const anchor=candidate.geometryConstraints[0];
      const anchorA=anchor?atomWorldAngstrom(instanceById(candidate.participantInstances[anchor.from.role]),anchor.from.atomIndex):[0,0,0];
      const anchorB=anchor?atomWorldAngstrom(instanceById(candidate.participantInstances[anchor.to.role]),anchor.to.atomIndex):[0,0,0];
      const center=anchorA.map((value,index)=>(value+anchorB[index])*.5);
      const supplemental=resolveSupplementalParticipants(candidate.reaction,candidate,active,item=>Math.hypot(...item.stageBody.positionAngstrom.map((value,index)=>value-center[index])));
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
      const environmentMatched=environmentMatches(candidate.reaction,reactionEnvironment);if(!environmentMatched)rejectionReasons.push('environment-mismatch');
      if(!stageBPhysicsEnabled)rejectionReasons.push('non-production-physics');
      const ids=Object.values(participantInstances).filter(Boolean).sort(),dwellKey=`${candidate.reactionId}:${candidate.pathwayId}:${ids.join('|')}:g${batch.generation}`;
      const eligible=!manipulating&&!rejectionReasons.length;
      if(supplemental.ok)contactMatcher.markActive(dwellKey);
      const elapsed=manipulating?0:(contactMatcher.update(dwellKey,eligible,stepMs),contactMatcher.elapsed(dwellKey));
      if(manipulating)rejectionReasons.push('participant-manipulating');
      const commitReady=eligible&&elapsed>=CONTACT_DWELL_MS;
      const diagnostic={reactionId:candidate.reactionId,familyId:candidate.familyId,pathwayId:candidate.pathwayId,encounterParticipantIds:encounterIds,participants:participantInstances,matchedSites:Object.fromEntries(Object.entries(candidate.bindings).map(([role,atomBindings])=>[role,{patternId:candidate.matchedPatterns[role],atomBindings}])),distanceConstraints:geometry.constraints,geometryReady:geometry.geometryReady,geometryQuality:{worstNormalizedDeviation:geometry.worstNormalizedDeviation,meanNormalizedDeviation:geometry.meanNormalizedDeviation},minimumRealAtomDistance,minimumNonbondedSeparationRatio,severeOverlap,manipulating,normalPhysicsStepObserved:stageBPhysicsEnabled&&!manipulating,environmentMatched,stoichiometricRequirement:supplemental.ok?null:{reason:supplemental.reason,species:supplemental.species,count:supplemental.count},dwellElapsed:elapsed,dwellRequired:CONTACT_DWELL_MS,commitReady,rejectionReasons};
      rows.push(diagnostic);
      if(commitReady){
        const staged={...candidate,participantInstances,environmentConditions:[...reactionEnvironment],geometryQuality:{worstNormalizedDeviation:geometry.worstNormalizedDeviation,meanNormalizedDeviation:geometry.meanNormalizedDeviation}};
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
        trace.samples.push({fixedStepIndex:stageAPerformance.fixedSteps,fixedStepMs:stepMs,simulationClockSeconds,participantIds:{...diagnostic.participants},matchedSites:diagnostic.matchedSites,distanceConstraints:diagnostic.distanceConstraints.map(({actual,min,target,max,normalizedError})=>({actual,min,target,max,normalizedError})),geometryReady:diagnostic.geometryReady,severeOverlap:diagnostic.severeOverlap,minimumRealAtomDistance:diagnostic.minimumRealAtomDistance,minimumNonbondedSeparationRatio:diagnostic.minimumNonbondedSeparationRatio,manipulating:diagnostic.manipulating,normalPhysicsStepObserved:diagnostic.normalPhysicsStepObserved,environmentMatched:diagnostic.environmentMatched,dwellElapsed:diagnostic.dwellElapsed,commitReady:diagnostic.commitReady,rejectionReasons:[...diagnostic.rejectionReasons],bodies});
        if(trace.samples.length>2400)trace.samples.shift();
      }
    }
    if(manipulating||!ready.length)return;
    const arbitration=arbitrateReactionCandidates(ready);
    if(arbitration.selected)commit(arbitration.selected);
    else if(arbitration.reason==='geometry-deadband')for(const contender of arbitration.contenders??[]){const diagnostic=rows.find(row=>row.pathwayId===contender.pathwayId&&row.encounterParticipantIds.join('|')===contender.reactantInstanceIds.join('|'));if(diagnostic){diagnostic.commitReady=false;diagnostic.rejectionReasons.push('geometry-deadband');}}
  }
  function cancelPointerFor(item){
    if(selected===item){const pointerId=down?.pointerId;endManipulation();if(pointerId!==undefined){activePointers.delete(pointerId);try{if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}}onPointerLockChange(activePointers.size>0);}
    if(!down||down.group!==item)return;
    const pointerId=down.pointerId;down=null;activePointers.delete(pointerId);try{if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}onPointerLockChange(activePointers.size>0);
  }
  function commit(candidate){
    if(isManipulating())return;
    if(!environmentMatches(candidate.reaction,reactionEnvironment))return;
    const execution=planReactionExecution(candidate,records);if(!execution.ok){status.textContent='反応経路を検証できないため、反応を確定できません。';return;}
    // Reserve all real participants together only after arbitration and the
    // final liveness/environment checks have succeeded.
    const reservation=reserveParticipantInstances(candidate.participantInstances,instances,batch.generation,candidate.reaction.reactants.map(row=>row.role));if(!reservation.ok)return;
    const participants=reservation.participants;
    for(const item of participants)cancelPointerFor(item);
    status.textContent='REACTION · 反応中心で再構成中';
    const center=participants.reduce((sum,item)=>sum.add(item.group.position),new THREE.Vector3()).multiplyScalar(1/participants.length);
    reactionAnimation={generation:batch.generation,participants,center,elapsedMs:0,execution};updateCommandBar();
  }
  function advanceReactionAnimation(elapsedMs){
    const animation=reactionAnimation;if(!animation)return;
    if(animation.generation!==batch.generation||batch.phase!==REACTION_LAB_BATCH_PHASES.ACTIVE){reactionAnimation=null;updateCommandBar();return;}
    animation.elapsedMs+=elapsedMs;const progress=clamp(animation.elapsedMs/(reducedMotion?220:CHAMBER_PRESENTATION_MS),0,1);
    for(const item of animation.participants){item.group.position.lerp(animation.center,progress*.18);item.group.scale.setScalar(1-progress*.12);}
    if(progress<1)return;
    const {participants,center,execution}=animation;for(const item of participants)world.remove(item.group);instances=instances.filter(item=>!participants.includes(item));for(const item of participants)disposeItem(item);
    execution.products.forEach((record,index)=>createInstance(record,center.clone().add(new THREE.Vector3(index?1:-1,0,0)),{generation:animation.generation}));
    reactionAnimation=null;contactMatcher.reset();reactionDiagnostics=[];
    status.textContent=`反応完了 · ${execution.products.map(record=>record.nameJa??record.id).join(' + ')}`;
    window.dispatchEvent(new CustomEvent('molecule-craft:reaction-lab-product',{detail:{reactionId:execution.reactionId,familyId:execution.familyId,pathwayId:execution.pathwayId,reaction:execution.reaction,environmentConditions:execution.environmentConditions,participants:execution.participants,matchedSites:execution.matchedSites,products:execution.products.map(record=>record.id),atomOrigins:execution.atomOrigins,graphDiff:execution.graphDiff,consumed:execution.consumedInstanceIds,batchGeneration:animation.generation}}));
    updateCommandBar();
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
    const active=instances.filter(item=>!item.busy&&!item.feedMotion&&(!testIsolation||testIsolation.has(item.id))).map(item=>{
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
    for(const item of instances)if(!item.busy&&!item.feedMotion){
      if(item===selected&&isManipulating()&&down?.group===item){
        item.stageBody.positionAngstrom=item.group.position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM);
        item.stageBody.velocityAngstromPerPs=[0,0,0];item.group.quaternion.set(...item.stageBody.orientation);item.group.updateMatrixWorld(true);
      }else syncGroupFromStageABody(item);
    }
    if(batch.phase===REACTION_LAB_BATCH_PHASES.ACTIVE)reactionStep(STAGE_A_GAME_STEP_SECONDS*1000);
  }
  const stageAStepper=createFixedStepAccumulator(integrateStageAStep,{gameStepSeconds:STAGE_A_GAME_STEP_SECONDS,physicalPsPerGameSecond:STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,maxCatchUpSteps:STAGE_A_MAX_CATCH_UP_STEPS});
  function tick(now){
    if(disposed)return;animationFrameId=requestAnimationFrame(tick);
    const elapsed=Math.max(0,now-last);last=now;
    if(!dialog.open||pickerOpen){renderer.render(scene,camera);return;}
    updateManipulation(elapsed);
    advanceBatchTransition(elapsed);
    const timeScale=chamberTime.scale,scaledElapsed=scaleSimulationElapsed(elapsed/1000,timeScale),acceptedElapsed=Math.min(scaledElapsed,STAGE_A_GAME_STEP_SECONDS*STAGE_A_MAX_CATCH_UP_STEPS);
    const timing=stageAStepper.advance(scaledElapsed);simulationClockSeconds+=acceptedElapsed;stageAPerformance.lastFrameStepCount=timing.steps;stageAPerformance.lastDroppedGameSeconds=timing.droppedGameSeconds;
    advanceReactionAnimation(elapsed);
    renderer.render(scene,camera);
  }
  updateCamera();animationFrameId=requestAnimationFrame(tick);

  function setDialogOpen(open){onDialogStateChange(open);}
  function open(){renderSlotTiles();if(!dialog.open)dialog.showModal();setDialogOpen(true);last=performance.now();resize();}
  root.querySelector('[data-lab-close]')?.addEventListener('click',()=>dialog.close(),eventOptions);
  dialog.addEventListener('close',()=>{closePicker({returnFocus:false});cancelAllPointers();last=performance.now();setDialogOpen(false);},{signal:eventController.signal});

  if(localhostPhysicsTest){
    const probeForces=()=>stageBPhysicsEnabled?evaluateStageBForces(instances.filter(item=>!item.busy&&!item.feedMotion&&(!testIsolation||testIsolation.has(item.id))).map(item=>item.stageBody)):stageAForces;
    const probe={
      physicsMode:stageBPhysicsEnabled?'stage-b':'stage-a',physicalPsPerGameSecond:STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,qA:stageBPhysicsEnabled?stageBChargeE:null,
      snapshot:()=>{
        const current=probeForces(),state=batch.snapshot();
        return{
          physicsMode:stageBPhysicsEnabled?'stage-b':'stage-a',physicalPsPerGameSecond:STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,fixedGameStepSeconds:STAGE_A_GAME_STEP_SECONDS,qA:stageBPhysicsEnabled?stageBChargeE:null,
          simulationTimeMode:chamberTime.mode,simulationTimeScale:chamberTime.scale,simulationClockSeconds,simulationSuspended:pickerOpen||!dialog.open,pickerOpen,manipulationActive:isManipulating(),draggedInstanceId:selected?.id??null,depthTargetId:depthTarget,depthDockingState,pointerAnchorErrorPx,
          batch:{...state,transitionKind:batchTransition?.kind??null,transitionGeneration:batchTransition?.generation??null,feedEntryCount:batchTransition?.entries?.length??0,feedEntriesHandedOff:batchTransition?.entries?.filter(row=>row.item?.feedHandoff).length??0,reactionEnabled:state.phase===REACTION_LAB_BATCH_PHASES.ACTIVE&&!reactionAnimation,reactionPresentationActive:!!reactionAnimation},
          instances:instances.map(item=>({...stageABodySnapshot(item.stageBody),species:item.species,atomCount:item.record.atoms.length,busy:item.busy,position:item.group.position.toArray(),initialPositionAtSpawn:item.initialPositionAtSpawn?[...item.initialPositionAtSpawn]:null,batchGeneration:item.batchGeneration,originPortIndex:item.feedOriginPortIndex,feedPhase:item.feedPhase,feedHandoff:item.feedHandoff,kinematic:!!item.stageBody.kinematic,charges:[...item.record.nonbonded.atomicChargesE],carbonylSites:stageBPhysicsEnabled?stageBCarbonylDiagnostics(item.stageBody):[],renderedObjectCount:stageBPhysicsEnabled?item.group.children.length:null,expectedRealObjectCount:stageBPhysicsEnabled?item.record.atoms.length+item.record.bonds.length:null})),
          purging:purgeItems.map(item=>({id:item.id,species:item.species,position:item.group.position.toArray()})),pairs:current.pairDiagnostics.map(pair=>({...pair})),
          diagnostics:{overlapGuardActivationCount:current.overlapGuardActivationCount,carbonylSiteCount:instances.reduce((sum,item)=>sum+(item.stageBody?.carbonylAnisotropySites?.length??0),0),...stageAPerformance,lastInteractionPairCount:current.pairDiagnostics.length},
          reactionCandidates:[...reactionDiagnostics],reactionEnvironment:[...reactionEnvironment].sort(),
          camera:{distance,azimuth:FIXED_CAMERA_AZIMUTH,elevation:FIXED_CAMERA_ELEVATION},selectedInstanceId:selected?.id??null,downInstanceId:down?.group?.id??null,dialogOpen:dialog.open,pointerActive:activePointers.size>0,
        };
      },
      setGeometry(poses){const ids=new Set(poses.map(pose=>pose.id));if(ids.size!==poses.length)throw Error('Stage A geometry fixture contains duplicate molecule IDs');endManipulation();activePointers.clear();pinchActive=false;pinchDistance=0;onPointerLockChange(false);testIsolation=ids.size?ids:null;contactMatcher.reset();reactionDiagnostics=[];for(const pose of poses){const item=instanceById(pose.id);if(!item)throw Error(`Missing fixture molecule ${pose.id}`);if(pose.positionAngstrom)item.stageBody.positionAngstrom=[...pose.positionAngstrom];if(pose.orientation)item.stageBody.orientation=[...pose.orientation];item.stageBody.velocityAngstromPerPs=[...(pose.velocityAngstromPerPs??[0,0,0])];item.stageBody.angularVelocityRadPerPs=[...(pose.angularVelocityRadPerPs??[0,0,0])];syncGroupFromStageABody(item);}clearDepthTarget();updateCommandBar();return this.snapshot();},
      advanceDeterministic(steps=1){const count=Math.max(0,Math.min(600,Math.floor(steps)));stageAStepper.reset();for(let index=0;index<count;index++){integrateStageAStep(STAGE_A_GAME_STEP_SECONDS*STAGE_A_PHYSICAL_PS_PER_GAME_SECOND);simulationClockSeconds+=STAGE_A_GAME_STEP_SECONDS;}return this.snapshot();},
      decomposePair(aId,bId){const a=instanceById(aId),b=instanceById(bId);if(!a||!b)throw Error('Missing Reaction Lab molecule instance');const result=stageBPhysicsEnabled?evaluateStageBForces([a.stageBody,b.stageBody]):evaluateStageAForces([a.stageBody,b.stageBody]);return{pairs:result.pairDiagnostics,bodies:Object.fromEntries([...result.bodies].map(([id,state])=>[id,state])),overlapGuardActivationCount:result.overlapGuardActivationCount};},
      reactionContactDiagnostics(reactionId){return reactionDiagnostics.filter(item=>item.reactionId===reactionId);},
      startReactionTrajectoryTrace(reactionId,participantIds){if(!localhostPhysicsTest)throw Error('Reaction trajectory tracing is localhost-only');reactionTrajectoryTrace={reactionId,participantIds:participantIds?[...participantIds].sort():null,samples:[]};return{reactionId,participantIds:reactionTrajectoryTrace.participantIds};},
      reactionTrajectoryTrace(){return reactionTrajectoryTrace?{reactionId:reactionTrajectoryTrace.reactionId,participantIds:reactionTrajectoryTrace.participantIds,samples:reactionTrajectoryTrace.samples.map(sample=>({...sample}))}:null;},
      stopReactionTrajectoryTrace(){const trace=reactionTrajectoryTrace?{reactionId:reactionTrajectoryTrace.reactionId,participantIds:reactionTrajectoryTrace.participantIds,samples:reactionTrajectoryTrace.samples.map(sample=>({...sample}))}:null;reactionTrajectoryTrace=null;return trace;},
      setEnvironmentConditions(tokens){if(!Array.isArray(tokens)||tokens.some(token=>typeof token!=='string'))throw Error('Environment conditions must be normalized string tokens.');reactionEnvironment.clear();for(const token of tokens)reactionEnvironment.add(token);contactMatcher.reset();return this.snapshot();},
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
      prepareCalibratedReactionPose(reactionId){
        // Localhost-only deterministic release fixture. User interaction never
        // calls this chemistry-specific pose utility.
        const candidates=instances.flatMap((left,index)=>instances.slice(index+1).flatMap(right=>reactionCandidates([{species:left.species,id:left.id},{species:right.species,id:right.id}],reactionCatalog)));
        const candidate=candidates.find(item=>item.reactionId===reactionId&&item.bindings.acyl?.acylC===1&&item.bindings.nucleophile?.oxygen=== (item.speciesIds.includes('water')?0:2));
        if(!candidate)throw Error(`No calibrated production pathway for ${reactionId}`);
        const [leftId,rightId]=candidate.reactantInstanceIds,left=instanceById(leftId),right=instanceById(rightId),anchor=candidate.geometryConstraints[0],siteA=anchor.from.atomIndex,siteB=anchor.to.atomIndex;
        const seed=item=>{const count=180,y=1-2*(item.seed+.5)/count,r=Math.sqrt(1-y*y),angle=item.seed*2.399963229728653+item.phase,axis=new THREE.Vector3(r*Math.cos(angle),y,r*Math.sin(angle)),turn=(item.seed*.61803398875%1)*Math.PI*2;return new THREE.Quaternion().setFromAxisAngle(axis,turn);};
        const firstSeed=reactionId==='anhydride-hydrolysis'?88:35,secondSeed=(firstSeed*73)%180,qA=seed({seed:firstSeed,phase:0}),qB=seed({seed:secondSeed,phase:.7});
        testIsolation=new Set([leftId,rightId]);contactMatcher.reset();reactionDiagnostics=[];endManipulation();
        for(const item of instances){item.busy=false;item.stageBody.velocityAngstromPerPs=[0,0,0];item.stageBody.angularVelocityRadPerPs=[0,0,0];if(item!==left&&item!==right)item.group.position.set(9,9,0);}
        left.group.position.set(0,0,0);left.group.quaternion.copy(qA);right.group.quaternion.copy(qB);
        const pointA=left.record.atoms[siteA].point.clone().applyQuaternion(qA),pointB=right.record.atoms[siteB].point.clone().applyQuaternion(qB);
        right.group.position.copy(pointA).add(new THREE.Vector3(2.7*REACTION_LAB_WORLD_UNITS_PER_ANGSTROM,0,0)).sub(pointB);
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
      projectedBounds(){const rect=canvas.getBoundingClientRect();return instances.map(item=>{const rows=item.record.atoms.map((atom,index)=>{const point=atomWorld(item,index),screen=projectPoint(point),radius=modelAtomRadius(atom.element)*rect.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*viewDepth(point));return{x:screen.x,y:screen.y,z:screen.z,radius};});return{id:item.id,atoms:rows,bounds:rows.length?{left:Math.min(...rows.map(row=>row.x-row.radius)),right:Math.max(...rows.map(row=>row.x+row.radius)),top:Math.min(...rows.map(row=>row.y-row.radius)),bottom:Math.max(...rows.map(row=>row.y+row.radius))}:null};});},
      setSimulationClock(seconds){if(!Number.isFinite(seconds)||seconds<0)throw Error('Simulation clock must be a finite non-negative number.');simulationClockSeconds=seconds;contactMatcher.reset();return this.snapshot();},
      refresh(){return this.snapshot();},
    };
    window.__reactionLabProbe=probe;
  }
  return {open,dispose(){disposed=true;cancelAnimationFrame(animationFrameId);closePicker({returnFocus:false});eventController.abort();batch.invalidate();resizeObserver.disconnect();clear();renderer.dispose();onPointerLockChange(false);}};
}
