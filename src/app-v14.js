import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ELEMENTS, Molecule, countElements, loadMoleculeDatabase, moleculeCatalog, UNKNOWN_NAME } from './chemistry.js?v=20';
import { ATOMIC_MODEL, preferredValence, unpairedElectronCount, lonePairCount, valenceShellRadius, bondLengthScale, idealBondAngleDeg } from './bonding-model.js';
import { createStructureSolver } from './structure-relaxation.js?v=18';
import { ELECTRON_POINTER_TARGET, pickElectronAtPointer } from './electron-interaction.js?v=16';
import { chooseAtomOrElectron, pickBondAtPointer } from './gesture-arbitration.js?v=19';
import { connectedStructures, chooseMainStructure, createCompletionTracker, createDebrisTracker, DEBRIS_POLICY, structureFrame } from './workspace-model.js?v=20';
import { expandCraftStructure, seedCraftCoordinates } from './craft-structures.js';

const molecule=new Molecule();
const placements=new Map();
const activePointers=new Map();
const bondTapState=new Map();
let selectedAtomId=null,activeTorsionKey=null,dragState=null,multiGesture=null;
let bondHoldTimer=null,relaxation=null;
let electronReturn=null,hoverElectron=null,bondTransition=null;
let selectionChangedAt=performance.now(),renderTopologyDirty=true;
const atomVisuals=new Map(),bondVisuals=new Map();
let electronVisuals=[],aromaticVisuals=[];
const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
const ELECTRON_SNAP_PX=58;
let structures=[],mainStructure=null,structureByAtom=new Map();
const completionTracker=createCompletionTracker(),debrisTracker=createDebrisTracker();
const protectedUntil=new Map(),cleanupUndo=[];
let discoveryQueue=[],discoveryUntil=0,activeDiscovery=null;
let lastBackgroundTap=null,frameTransition=null,pendingFrame=false;
let cleanupCheckedAt=0,debrisOpacity=new Map(),fadeTargets=new Map();
let collectionGame=null,collectionOpen=false,collectionRevision=0,collectionCheckedRevision=-1;

const viewer=document.querySelector('#viewer');
const palette=document.querySelector('#element-palette');
const statusEl=document.querySelector('#status');
const formulaEl=document.querySelector('#formula');
const nameEl=document.querySelector('#molecule-name');
const iupacNameEl=document.querySelector('#molecule-iupac');
const countsEl=document.querySelector('#atom-counts');
const selectedElementEl=document.querySelector('#selected-element');
const selectedValenceEl=document.querySelector('#selected-valence');
const selectedLimitEl=document.querySelector('#selected-limit');
const selectionChip=document.querySelector('#selection-chip');
const discovery=document.querySelector('#discovery');
const discoveryFormula=document.querySelector('#discovery-formula');
const discoveryName=document.querySelector('#discovery-name');
const discoveryIupac=document.querySelector('#discovery-iupac');
const structureList=document.querySelector('#structure-list');
const structureCount=document.querySelector('#structure-count');

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(44,1,.1,100);camera.position.set(5.2,4,7.6);
const cameraTarget=new THREE.Vector3();
let renderer=null;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{statusEl.textContent='3D表示を開始できませんでした。WebGL対応ブラウザで開いてください。図鑑は利用できます。';}
if(renderer){renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.domElement.style.touchAction='none';viewer.appendChild(renderer.domElement);}
scene.add(new THREE.HemisphereLight(0xffffff,0x172033,2.7));
const keyLight=new THREE.DirectionalLight(0xffffff,3.2);keyLight.position.set(6,8,8);scene.add(keyLight);
const rim=new THREE.DirectionalLight(0x7dd3fc,1);rim.position.set(-5,1,4);scene.add(rim);
const moleculeGroup=new THREE.Group();scene.add(moleculeGroup);
const interactionOverlay=new THREE.Group();scene.add(interactionOverlay);
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();

const solver=createStructureSolver({
  THREE,molecule,placements,atomById,bondBetween,bondLengthFor,geometryFor,
  radiusFor:id=>ELEMENTS[atomById(id)?.element]?.radius??.42,
});

if(renderer){bindPalette();bindUI();refresh();resize();animate();}
loadMoleculeDatabase().then(async result=>{
  syncWorkspace();if(renderer){refreshInfo();checkDiscovery();}
  if(!result.ok){if(renderer)pulse('分子名DBを読み込めませんでした · 制作機能は利用できます');document.querySelector('#game-save-status').textContent='分子DBを読めないため図鑑は利用できません';return;}
  try{
    const {createCollectionUI}=await import('./collection-ui.js?v=20');
    collectionGame=await createCollectionUI({records:moleculeCatalog(),onPlace:template=>addCraftPart(template.id),canOpen:()=>!dragState&&!activePointers.size,onOpenChange:open=>{collectionOpen=open;}});
    collectionCheckedRevision=-1;if(renderer)checkDiscovery();
  }catch(error){console.warn('Collection unavailable; sandbox remains usable.',error);document.querySelector('#game-save-status').textContent='図鑑を読み込めませんでした。原子からの制作は続けられます。';}
});

function bindPalette(){
  if(!palette)return;
  for(const b of palette.querySelectorAll('[data-element]')){
    const symbol=b.dataset.element;if(ELEMENTS[symbol])b.style.setProperty('--element-color',ELEMENTS[symbol].color);
    b.addEventListener('click',()=>addElement(symbol));
  }
}
function bindUI(){
  document.querySelector('#frame-structure')?.addEventListener('click',requestStructureFrame);
  document.querySelector('#undo-cleanup')?.addEventListener('click',undoCleanup);
  document.addEventListener('visibilitychange',()=>{debrisTracker.reset();fadeTargets.clear();});
  document.querySelector('#delete-selected')?.addEventListener('click',()=>{
    if(selectedAtomId==null||interactionLocked())return;
    molecule.removeAtom(selectedAtomId);placements.delete(selectedAtomId);selectAtom(null);activeTorsionKey=null;topologyChanged();
    startRelaxation('削除後の構造を安定化しています');
  });
  document.querySelector('#clear-all')?.addEventListener('click',()=>{
    stopRelaxation();clearBondTransition();molecule.clear();placements.clear();selectAtom(null);activeTorsionKey=null;dragState=null;electronReturn=null;hoverElectron=null;
    activePointers.clear();multiGesture=null;frameTransition=null;pendingFrame=false;lastBackgroundTap=null;
    cleanupUndo.length=0;protectedUntil.clear();debrisTracker.reset();fadeTargets.clear();debrisOpacity.clear();completionTracker.clear();discoveryQueue=[];activeDiscovery=null;discoveryUntil=0;discovery.classList.remove('show');topologyChanged();refresh();
  });
  const c=renderer.domElement;
  c.addEventListener('pointerdown',onPointerDown);c.addEventListener('pointermove',onPointerMove);c.addEventListener('pointerup',onPointerUp);c.addEventListener('pointercancel',onPointerCancel);
  c.addEventListener('wheel',e=>{e.preventDefault();if(interactionLocked()){pulse('構造変化中は視点を固定しています');return;}zoomCamera(Math.exp(e.deltaY*.001));},{passive:false});
  new ResizeObserver(resize).observe(viewer);
}

function addElement(symbol){
  if(!ELEMENTS[symbol]||interactionLocked())return;
  const atom=molecule.addAtom(symbol);
  protectedUntil.set(atom.id,performance.now()+DEBRIS_POLICY.protectionMs);
  placements.set(atom.id,{position:molecule.atoms.length===1?cameraTarget.clone():spawnPosition()});
  selectAtom(atom.id);topologyChanged();refresh();
  pulse(molecule.atoms.length===1?`${symbol} を中心原子として追加`:`${symbol} を未結合原子として追加 · 不対電子をドラッグして結合`);
}

function addCraftPart(id){
  const template=collectionGame?.templateFor(id);
  if(!renderer||!template||interactionLocked()||dragState)return false;
  // Place an unconnected component beside the selection. No hidden auto-bond,
  // hydrogen completion, or prebuilt-molecule award: the final gesture is yours.
  const origin=molecule.atoms.length?spawnPosition():cameraTarget.clone(),coordinates=seedCraftCoordinates(template);
  const expanded=expandCraftStructure(molecule,template),right=cameraRight(),up=cameraUp(),depth=cameraDirection();
  for(const [index,atomId]of expanded.ids.entries()){
    const p=coordinates[index];placements.set(atomId,{position:origin.clone().addScaledVector(right,p.x).addScaledVector(up,p.y).addScaledVector(depth,p.z)});protectedUntil.set(atomId,performance.now()+DEBRIS_POLICY.protectionMs);
  }
  activeTorsionKey=null;selectAtom(expanded.attachments[0].atomId);topologyChanged();
  startRelaxation(`${template.nameJa}を配置 · 安定化後に光る接続点を電子ドラッグでつなぐ`);return true;
}

function onPointerDown(e){
  if(interactionLocked()){pulse('構造変化中 · 視点は固定されています');return;}
  activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,downAt:performance.now()});
  if(activePointers.size===2){lastBackgroundTap=null;clearTimeout(bondHoldTimer);beginTwoFinger();dragState=null;hoverElectron=null;return;}if(activePointers.size>1)return;
  const picked=chooseAtomOrElectron(e.clientX,e.clientY,screenAtomCandidates(),pickScreenElectron(e.clientX,e.clientY));
  if(picked){lastBackgroundTap=null;if(picked.kind==='electron')beginElectronDrag(e,picked);else beginAtomDrag(e,picked.atomId);return;}
  const bondPick=pickScreenBond(e.clientX,e.clientY);
  if(bondPick){
    lastBackgroundTap=null;
    const key=bondPick.key;dragState={mode:'bond',key,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,holding:false};
    clearTimeout(bondHoldTimer);
    bondHoldTimer=setTimeout(()=>{if(!dragState||dragState.mode!=='bond'||dragState.key!==key||dragState.moved)return;dragState.holding=true;weakenBond(key);},580);
    capture(e);return;
  }
  dragState={mode:'molecule-rotate',startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};capture(e);
}
function beginAtomDrag(e,atomId){
  selectAtom(atomId);
  if(activeTorsionKey){
    const bond=bondFromKey(activeTorsionKey),sides=bond&&cutSides(bond.a,bond.b);
    if(bond&&sides){const side=sides.a.has(atomId)?sides.a:sides.b.has(atomId)?sides.b:null;if(side){dragState={mode:'torsion',atomId,bond,ids:[...side],lastX:e.clientX,lastY:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};capture(e);refresh();return;}}
    activeTorsionKey=null;
  }
  const plan=structurePlan(atomId),home=pos(atomId)?.clone();
  dragState=plan?{mode:'structure',atomId,pivotId:plan.pivotId,ids:plan.ids,lastX:e.clientX,lastY:e.clientY,startX:e.clientX,startY:e.clientY,moved:false}:{mode:'atom-translate',atomId,homeWorld:home,planeNormal:cameraDirection(),startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};
  capture(e);refresh();
}
function onPointerMove(e){
  const p=activePointers.get(e.pointerId);if(p){p.x=e.clientX;p.y=e.clientY;}if(activePointers.size===2){updateTwoFinger();return;}if(!dragState)return;
  dragState.moved||=Math.hypot(e.clientX-dragState.startX,e.clientY-dragState.startY)>6;
  if(dragState.mode==='bond'){if(dragState.moved&&!dragState.holding)clearTimeout(bondHoldTimer);return;}
  if(dragState.mode==='electron'){
    if(!dragState.moved)return;
    const dragX=e.clientX,dragY=e.clientY-dragState.liftPx,free=screenPointToWorldOnPlane(dragX,dragY,dragState.homeWorld,dragState.planeNormal);dragState.currentWorld.lerp(free,.82);
    const nearest=findNearestCompatibleElectron(dragX,dragY,dragState.atomId,dragState.index);hoverElectron=nearest?.distance<=ELECTRON_SNAP_PX?nearest:null;
    const snapKey=hoverElectron?`${hoverElectron.atomId}:${hoverElectron.index}`:null;if(snapKey&&snapKey!==dragState.snapKey)vibrateFeedback(18,dragState.pointerType);dragState.snapKey=snapKey;
    if(hoverElectron){
      const snapWorld=screenPointToWorldOnPlane(hoverElectron.screenX,hoverElectron.screenY,dragState.homeWorld,dragState.planeNormal);
      dragState.currentWorld.lerp(snapWorld,.86);
    }
    updateMoleculeTransforms();return;
  }
  if(!dragState.moved)return;
  if(dragState.mode==='atom-translate'){
    const next=pointerWorldOnPlane(e,dragState.homeWorld,dragState.planeNormal);pos(dragState.atomId)?.copy(next);updateMoleculeTransforms();return;
  }
  const dx=e.clientX-dragState.lastX,dy=e.clientY-dragState.lastY;dragState.lastX=e.clientX;dragState.lastY=e.clientY;
  if(dragState.mode==='molecule-rotate')rotateWholeMolecule(dx,dy);
  if(dragState.mode==='torsion'){rotateAroundBond(dragState.bond,dragState.ids,(dx-dy*.25)*.012);solver.step(.12,1,{lockedIds:new Set(dragState.ids)});}
  if(dragState.mode==='structure'){rotateBranchTowardScreen(dragState.pivotId,dragState.atomId,dragState.ids,dx,dy);solver.step(.10,1,{lockedIds:new Set(dragState.ids)});}
  updateMoleculeTransforms();
}
function onPointerUp(e){
  const state=dragState,p=activePointers.get(e.pointerId);activePointers.delete(e.pointerId);if(activePointers.size<2)multiGesture=null;if(!state)return;
  const elapsed=p?performance.now()-p.downAt:Infinity,isTap=!state.moved&&elapsed<400;
  if(state.mode==='bond'){
    clearTimeout(bondHoldTimer);bondHoldTimer=null;if(isTap&&!state.holding)handleBondTap(state.key);
  }else if(state.mode==='electron'){
    if(!state.moved)selectAtom(state.atomId);else finishElectronDrag(state,e);hoverElectron=null;
  }else if(state.mode==='structure'){
    if(isTap)selectAtom(state.atomId);else startRelaxation('立体構造を安定化しています');
  }else if(state.mode==='atom-translate'){
    if(isTap)selectAtom(state.atomId);else startRelaxation('原子移動後の構造を安定化しています');
  }else if(state.mode==='torsion'){
    if(!isTap)startRelaxation('単結合回転後の安定配置へ移動中',{maxDuration:1250});
  }else if(state.mode==='molecule-rotate'){
    if(isTap){
      const now=performance.now(),previous=lastBackgroundTap;
      if(previous&&now-previous.at<350&&Math.hypot(e.clientX-previous.x,e.clientY-previous.y)<28){lastBackgroundTap=null;pendingFrame=true;}
      else lastBackgroundTap={at:now,x:e.clientX,y:e.clientY};
      selectAtom(null);activeTorsionKey=null;
    }else lastBackgroundTap=null;
  }
  dragState=null;release(e);if(!interactionLocked())refresh();else refreshInfo(true);
}
function onPointerCancel(e){
  lastBackgroundTap=null;
  activePointers.delete(e.pointerId);clearTimeout(bondHoldTimer);
  if(dragState?.mode==='electron'&&dragState.moved)startElectronReturn(dragState);
  dragState=null;multiGesture=null;hoverElectron=null;release(e);if(!interactionLocked())refresh();else refreshInfo(true);
}

function finishElectronDrag(state,e){
  const target=findNearestCompatibleElectron(e.clientX,e.clientY-state.liftPx,state.atomId,state.index);
  if(!target||target.distance>ELECTRON_SNAP_PX){startElectronReturn(state);pulse('結合相手に届かなかったため電子が元の位置へ戻ります');return;}
  const sourceId=state.atomId,targetId=target.atomId,existing=bondBetween(sourceId,targetId);
  if(existing){
    if(existing.order>=3||freeCapacity(sourceId)<=0||freeCapacity(targetId)<=0){startElectronReturn(state);pulse('これ以上電子対を共有できません');return;}
    const old=existing.order;
    queueBondFormation(state,target,{sourceId,targetId,oldOrder:old,newOrder:old+1,message:old===1?'共有電子対を形成 · 二重結合の平面構造へ移動中':'共有電子対を形成 · 三重結合の直線構造へ移動中'});
  }else{
    if(freeCapacity(sourceId)<=0||freeCapacity(targetId)<=0){startElectronReturn(state);pulse('結合余地がありません');return;}
    const same=connectedComponent(sourceId).has(targetId);
    queueBondFormation(state,target,{sourceId,targetId,oldOrder:0,newOrder:1,message:same?'共有電子対を形成 · 環を閉じながら安定化中':'共有電子対を形成 · 新しい単結合を安定化中'});
  }
}
function startElectronReturn(state){electronReturn={atomId:state.atomId,index:state.index,from:state.currentWorld.clone(),startedAt:performance.now(),duration:190};}

function pickScreenElectron(clientX,clientY){
  const candidates=electronVisuals.filter(ev=>ev.visible.visible).map(ev=>{
    const screen=worldToScreen(ev.visible.position),restScreen=worldToScreen(electronRestPosition(ev));
    return{atomId:ev.atomId,index:ev.index,interactive:screen.depth>=-1&&screen.depth<=1,screenX:screen.x,screenY:screen.y,restScreenX:restScreen.x,restScreenY:restScreen.y,priority:ev.atomId===selectedAtomId?1:0,world:ev.visible.position.clone()};
  });
  return pickElectronAtPointer(clientX,clientY,candidates);
}
function screenAtomCandidates(){
  return molecule.atoms.map(atom=>{
    const screen=worldToScreen(pos(atom.id));return{atomId:atom.id,unpaired:unpairedElectronCount(atom.element,molecule.bondOrderForAtom(atom.id)),screenX:screen.x,screenY:screen.y,depth:screen.depth};
  }).filter(atom=>atom.depth>=-1&&atom.depth<=1);
}
function pickScreenBond(clientX,clientY){
  const candidates=molecule.bonds.map(bond=>{
    const start=worldToScreen(pos(bond.a)),end=worldToScreen(pos(bond.b));
    return{key:bondKey(bond.a,bond.b),startX:start.x,startY:start.y,endX:end.x,endY:end.y,depth:(start.depth+end.depth)/2};
  });
  return pickBondAtPointer(clientX,clientY,candidates);
}
function beginElectronDrag(e,picked){
  const home=picked.world,liftPx=e.pointerType==='touch'||e.pointerType==='pen'?ELECTRON_POINTER_TARGET.touchLiftPx:0;
  dragState={mode:'electron',atomId:picked.atomId,index:picked.index,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,homeWorld:home.clone(),currentWorld:home.clone(),planeNormal:cameraDirection(),liftPx,pointerType:e.pointerType,snapKey:null};
  selectAtom(picked.atomId);electronReturn=null;vibrateFeedback(10,e.pointerType);capture(e);refresh();
}

function queueBondFormation(state,target,change){
  const targetVisual=electronVisuals.find(item=>item.atomId===target.atomId&&item.index===target.index),to=targetVisual?.visible.position.clone()??pos(target.atomId).clone(),from=state.currentWorld.clone(),midpoint=from.clone().lerp(to,.5);
  const pair=[from,to].map(point=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(.055,12,10),new THREE.MeshStandardMaterial({color:0xa5f3fc,emissive:0x22d3ee,emissiveIntensity:2.6,roughness:.08,depthTest:false}));mesh.position.copy(point);mesh.renderOrder=40;interactionOverlay.add(mesh);return mesh;});
  bondTransition={kind:'form',...change,sourceIndex:state.index,targetIndex:target.index,startedAt:performance.now(),applied:false,from,to,midpoint,pair};
  selectionChip.textContent='電子同士が接近 · 電子対を形成中';
}

function handleBondTap(key){
  const now=performance.now(),prev=bondTapState.get(key);
  if(prev&&now-prev<430){bondTapState.clear();const bond=bondFromKey(key);if(bond&&isRotatableBond(bond)){activeTorsionKey=activeTorsionKey===key?null:key;pulse(activeTorsionKey?'回転軸を固定 · 片側の原子をドラッグ':'回転軸を解除');}else pulse('この結合は軸回転できません');}else bondTapState.set(key,now);
}
function weakenBond(key){
  const bond=bondFromKey(key);if(!bond||interactionLocked())return;const old=bond.order;
  bondTransition={kind:'weaken',key,a:bond.a,b:bond.b,oldOrder:old,newOrder:old-1,startedAt:performance.now(),applied:false,message:old===3?'共有電子対を1組解放 · 二重結合へ安定化中':old===2?'共有電子対を1組解放 · 単結合へ安定化中':'結合解除後の構造を安定化中'};
  activeTorsionKey=null;selectionChip.textContent=old>1?'共有電子対を1組解放中':'結合を切断中';
}

function updateBondTransition(now){
  if(!bondTransition)return;
  const transition=bondTransition,elapsed=now-transition.startedAt;
  if(transition.kind==='form'){
    const pairT=THREE.MathUtils.clamp(elapsed/130,0,1),ease=1-Math.pow(1-pairT,3);
    transition.pair[0]?.position.copy(transition.from).lerp(transition.midpoint,ease);
    transition.pair[1]?.position.copy(transition.to).lerp(transition.midpoint,ease);
    transition.pair.forEach(mesh=>mesh.scale.setScalar(1+.35*Math.sin(pairT*Math.PI)));
    if(!transition.applied&&elapsed>=130){
      molecule.setBond(transition.sourceId,transition.targetId,transition.newOrder);transition.applied=true;transition.bondStartedAt=now;selectAtom(transition.targetId);topologyChanged();ensureMoleculeMeshes();
    }
    if(transition.applied)setBondTransitionVisual(transition,THREE.MathUtils.clamp((now-transition.bondStartedAt)/150,0,1));
    if(elapsed>=300){const message=transition.message;clearBondTransition();startRelaxation(message,{maxDuration:1500});}
  }else{
    const progress=THREE.MathUtils.clamp(elapsed/180,0,1);setBondTransitionVisual(transition,1-progress);
    if(!transition.applied&&elapsed>=180){
      if(transition.newOrder>0)molecule.setBond(transition.a,transition.b,transition.newOrder);else molecule.removeBond(transition.a,transition.b);
      transition.applied=true;topologyChanged();const message=transition.message;clearBondTransition();startRelaxation(message,{maxDuration:1300});
    }
  }
}

function clearBondTransition(){
  for(const object of[...interactionOverlay.children]){interactionOverlay.remove(object);disposeObject(object);}
  bondTransition=null;
}

function structurePlan(atomId){let best=null;for(const n of molecule.neighbors(atomId)){const sides=cutSides(atomId,n.atomId);if(!sides)continue;const side=sides.a.has(atomId)?sides.a:sides.b;if(!best||side.size<best.ids.length)best={pivotId:n.atomId,ids:[...side]};}return best;}
function rotateBranchTowardScreen(pivotId,anchorId,ids,dx,dy){
  const pivot=pos(pivotId),anchor=pos(anchorId);if(!pivot||!anchor)return;const old=anchor.clone().sub(pivot).normalize();
  const q1=new THREE.Quaternion().setFromAxisAngle(cameraUp(),-dx*.01),q2=new THREE.Quaternion().setFromAxisAngle(cameraRight(),-dy*.01),next=old.clone().applyQuaternion(q1).applyQuaternion(q2).normalize(),q=new THREE.Quaternion().setFromUnitVectors(old,next);
  for(const id of ids){const p=pos(id);if(p)p.sub(pivot).applyQuaternion(q).add(pivot);}solver.rotateReferenceFrames(q,new Set(ids));
}
function rotateAroundBond(bond,ids,angle){
  const moving=new Set(ids),pivotId=moving.has(bond.a)?bond.b:bond.a,anchorId=moving.has(bond.a)?bond.a:bond.b,pivot=pos(pivotId),anchor=pos(anchorId);if(!pivot||!anchor)return;
  const axis=anchor.clone().sub(pivot).normalize(),q=new THREE.Quaternion().setFromAxisAngle(axis,angle);for(const id of ids){if(id===anchorId)continue;const p=pos(id);if(p)p.sub(pivot).applyQuaternion(q).add(pivot);}solver.rotateReferenceFrames(q,new Set(ids));
}
function rotateWholeMolecule(dx,dy,roll=0){
  if(!molecule.atoms.length)return;const center=moleculeCenter(),qYaw=new THREE.Quaternion().setFromAxisAngle(cameraUp(),-dx*.009),qPitch=new THREE.Quaternion().setFromAxisAngle(cameraRight(),-dy*.009),q=qYaw.multiply(qPitch);
  if(roll)q.multiply(new THREE.Quaternion().setFromAxisAngle(cameraDirection(),roll));
  for(const a of molecule.atoms){const p=pos(a.id);if(p)p.sub(center).applyQuaternion(q).add(center);}solver.rotateReferenceFrames(q);
}
function moleculeCenter(){const pts=(mainStructure?.graph.atoms??molecule.atoms).map(a=>pos(a.id)).filter(Boolean);return pts.length?pts.reduce((s,p)=>s.add(p),new THREE.Vector3()).multiplyScalar(1/pts.length):cameraTarget.clone();}

function startRelaxation(message='安定構造へ移動中',options={}){
  if(!molecule.atoms.length){stopRelaxation();refresh();return;}
  solver.rebuildTopology();
  if(reduceMotion){for(let i=0;i<90;i++)solver.step(1,1);stopRelaxation();updateMoleculeTransforms();refresh();return;}
  relaxation={startedAt:performance.now(),minDuration:options.minDuration??600,maxDuration:options.maxDuration??1380,stableFrames:0,message};
  selectionChip.textContent=`${message} · 視点固定`;ensureMoleculeMeshes();updateMoleculeTransforms();refreshInfo(true);
}
function stopRelaxation(){relaxation=null;}
function updateRelaxation(now){
  if(!relaxation)return;
  const elapsed=now-relaxation.startedAt,strengthScale=elapsed<280?.76:elapsed<760?.54:.36,maxMove=solver.step(strengthScale,2);
  updateMoleculeTransforms();selectionChip.textContent=`${relaxation.message} · 視点固定`;
  if(maxMove<.0015)relaxation.stableFrames++;else relaxation.stableFrames=0;
  if((elapsed>=relaxation.minDuration&&relaxation.stableFrames>=7)||elapsed>=relaxation.maxDuration){relaxation=null;refresh();}
}
function geometryFor(id){
  const atom=atomById(id),neighbors=molecule.neighbors(id),orders=neighbors.map(neighbor=>neighbor.order),triple=orders.some(order=>order===3),doubleCount=orders.filter(order=>order===2).length;
  if(triple||doubleCount>=2)return{kind:'sp',angle:Math.PI,cos:-1};
  if(doubleCount===1)return{kind:'sp2',angle:2*Math.PI/3,cos:-.5};
  const degrees=idealBondAngleDeg(atom?.element,molecule.bondOrderForAtom(id),neighbors.length),angle=THREE.MathUtils.degToRad(degrees);
  return{kind:degrees>=175?'linear':degrees>=116?'trigonal':'sp3',angle,cos:Math.cos(angle)};
}
function freeDirections(id){
  const atom=atomById(id);if(!atom)return[];const origin=pos(id),ns=molecule.neighbors(id),usedDirs=ns.map(n=>pos(n.atomId)?.clone().sub(origin).normalize()).filter(Boolean),g=geometryFor(id);let candidates;
  if(g.kind==='sp')candidates=[new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0)];else if(g.kind==='sp2')candidates=[0,1,2].map(i=>new THREE.Vector3(Math.cos(i*2*Math.PI/3),Math.sin(i*2*Math.PI/3),0));else candidates=[new THREE.Vector3(1,1,1),new THREE.Vector3(1,-1,-1),new THREE.Vector3(-1,1,-1),new THREE.Vector3(-1,-1,1)].map(v=>v.normalize());
  if(usedDirs.length){const q=bestAlignment(candidates,usedDirs[0]);candidates=candidates.map(v=>v.clone().applyQuaternion(q));}
  return candidates.map(v=>({v,score:usedDirs.length?Math.min(...usedDirs.map(u=>1-v.dot(u))):10})).sort((a,b)=>b.score-a.score).filter(x=>x.score>.18).map(x=>x.v);
}
function bestAlignment(candidates,target){let best=candidates[0],dot=-Infinity;for(const c of candidates){const d=c.dot(target);if(d>dot){dot=d;best=c;}}return new THREE.Quaternion().setFromUnitVectors(best,target);}

function ensureMoleculeMeshes(){
  if(renderTopologyDirty)rebuildMoleculeMeshes();
}
function rebuildMoleculeMeshes(){
  disposeGroup(moleculeGroup);atomVisuals.clear();bondVisuals.clear();electronVisuals=[];aromaticVisuals=[];
  for(const bond of molecule.bonds)createBondVisual(bond);
  const structural=solver.snapshot();for(const cycle of structural.aromaticCycles)createAromaticVisual(cycle);
  for(const atom of molecule.atoms)createAtomVisual(atom);
  renderTopologyDirty=false;updateMoleculeTransforms();
}
function createAtomVisual(atom){
  const cfg=ELEMENTS[atom.element],mesh=new THREE.Mesh(new THREE.SphereGeometry(cfg.radius*1.04,30,22),new THREE.MeshStandardMaterial({color:cfg.color,roughness:.24,metalness:0}));
  mesh.userData.atomId=atom.id;moleculeGroup.add(mesh);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:selectionHaloTexture(),color:0xe6fbff,transparent:true,opacity:0,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending}));
  halo.visible=false;halo.renderOrder=30;moleculeGroup.add(halo);
  const singles=unpairedElectronCount(atom.element,molecule.bondOrderForAtom(atom.id)),dirs=freeDirections(atom.id),shell=valenceShellRadius(atom.element,cfg.radius*1.02),lonePairs=[];
  for(let index=0;index<Math.min(singles,dirs.length);index++)renderUnpairedElectron(atom.id,index,dirs[index],shell);
  const pairCount=lonePairCount(atom.element,molecule.bondOrderForAtom(atom.id));
  for(let index=0;index<pairCount;index++){
    const meshes=[];
    for(const sign of[-1,1]){const electron=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),new THREE.MeshStandardMaterial({color:0x64748b,emissive:0x334155,emissiveIntensity:.18,roughness:.5}));electron.userData.lonePairAtomId=atom.id;moleculeGroup.add(electron);meshes.push({electron,sign});}
    lonePairs.push({index,meshes});
  }
  atomVisuals.set(atom.id,{mesh,halo,cfg,lonePairs,singles,shell});
}
function renderUnpairedElectron(atomId,index,dir,shell){
  const visible=new THREE.Mesh(new THREE.SphereGeometry(.054,12,10),new THREE.MeshStandardMaterial({color:0x67e8f9,emissive:0x06b6d4,emissiveIntensity:1.45,roughness:.12}));
  const hit=new THREE.Mesh(new THREE.SphereGeometry(.145,10,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,depthTest:false}));
  for(const object of[visible,hit]){object.userData.electronAtomId=atomId;object.userData.electronIndex=index;moleculeGroup.add(object);}
  electronVisuals.push({atomId,index,dir:dir.clone(),shell,visible,hit,phase:(atomId*1.71+index*2.37)%6.28});
}
function createBondVisual(bond){
  const key=bondKey(bond.a,bond.b),offsets=bond.order===1?[0]:bond.order===2?[-.09,.09]:[-.16,0,.16],baseColor=bond.order===1?0x94a3b8:bond.order===2?0xfbbf24:0xf472b6;
  const hit=unitCylinder(.13,0xffffff,0);hit.userData.bondKey=key;moleculeGroup.add(hit);
  const lines=offsets.map(offset=>{
    const mesh=unitCylinder(bond.order===1?.022:bond.order===2?.026:.028,baseColor,1);mesh.userData.bondKey=key;
    if(bond.order>1){mesh.material.emissive=new THREE.Color(baseColor);mesh.material.emissiveIntensity=bond.order===2?.32:.44;}
    moleculeGroup.add(mesh);return{mesh,offset};
  });
  bondVisuals.set(key,{bond,key,hit,lines,baseColor,transitionScale:1});
}
function unitCylinder(radius,color,opacity=1){
  const geometry=new THREE.CylinderGeometry(radius,radius,1,12),material=new THREE.MeshStandardMaterial({color,roughness:.32,transparent:opacity<1,opacity,depthWrite:opacity>0});
  return new THREE.Mesh(geometry,material);
}
function updateMoleculeTransforms(){
  ensureMoleculeMeshes();
  for(const atom of molecule.atoms){
    const visual=atomVisuals.get(atom.id),point=pos(atom.id);if(!visual||!point)continue;
    visual.mesh.position.copy(point);visual.halo.position.copy(point);
    const dirs=freeDirections(atom.id);
    for(const electron of electronVisuals.filter(item=>item.atomId===atom.id))electron.dir.copy(dirs[electron.index]??electron.dir);
    visual.lonePairs.forEach((pair,pairIndex)=>{
      const direction=dirs[(visual.singles+pairIndex)%Math.max(1,dirs.length)]??perpendicular(new THREE.Vector3(1,0,0)),center=point.clone().addScaledVector(direction,visual.shell),side=perpendicular(direction).multiplyScalar(.03);
      pair.meshes.forEach(({electron,sign})=>electron.position.copy(center).addScaledVector(side,sign));
    });
  }
  for(const visual of bondVisuals.values())updateBondVisual(visual);
  for(const visual of aromaticVisuals)updateAromaticVisual(visual);
}
function updateBondVisual(visual){
  const a=pos(visual.bond.a),b=pos(visual.bond.b);if(!a||!b)return;
  const axis=b.clone().sub(a),length=Math.max(.001,axis.length()),direction=axis.clone().normalize(),side=perpendicular(direction),active=visual.key===activeTorsionKey,color=active?0x22d3ee:visual.baseColor;
  placeUnitCylinder(visual.hit,a,b,1);
  for(const {mesh,offset} of visual.lines){
    const shift=side.clone().multiplyScalar(offset),left=a.clone().add(shift),right=b.clone().add(shift);
    placeUnitCylinder(mesh,left,right,visual.transitionScale);mesh.material.color.setHex(color);
  }
}
function placeUnitCylinder(mesh,a,b,lengthScale=1){
  const delta=b.clone().sub(a),length=Math.max(.001,delta.length()),mid=a.clone().lerp(b,.5);
  mesh.position.copy(mid);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());mesh.scale.set(1,length*lengthScale,1);
}
function setBondTransitionVisual(transition,scale){
  const visual=bondVisuals.get(transition.key??bondKey(transition.sourceId,transition.targetId));if(!visual)return;
  visual.transitionScale=THREE.MathUtils.clamp(scale,0.001,1);updateBondVisual(visual);
}
function createAromaticVisual(cycle){
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array(64*3);geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const line=new THREE.LineLoop(geometry,new THREE.LineBasicMaterial({color:0xfde68a,transparent:true,opacity:.82,depthTest:true}));moleculeGroup.add(line);aromaticVisuals.push({cycle:[...cycle],line});
}
function updateAromaticVisual(visual){
  const points=visual.cycle.map(pos);if(points.some(point=>!point)){visual.line.visible=false;return;}visual.line.visible=true;
  const center=points.reduce((sum,point)=>sum.add(point),new THREE.Vector3()).multiplyScalar(1/points.length);let normal=new THREE.Vector3();
  for(let index=0;index<points.length;index++)normal.add(new THREE.Vector3().crossVectors(points[index].clone().sub(center),points[(index+1)%points.length].clone().sub(center)));
  if(normal.lengthSq()<1e-8)return;normal.normalize();let u=points[0].clone().sub(center);u.addScaledVector(normal,-u.dot(normal));if(u.lengthSq()<1e-8)return;u.normalize();
  const v=new THREE.Vector3().crossVectors(normal,u).normalize(),radius=points.reduce((sum,point)=>sum+point.distanceTo(center),0)/points.length*.48,attribute=visual.line.geometry.getAttribute('position');
  for(let index=0;index<64;index++){const angle=index*2*Math.PI/64,point=center.clone().addScaledVector(u,Math.cos(angle)*radius).addScaledVector(v,Math.sin(angle)*radius);attribute.setXYZ(index,point.x,point.y,point.z);}attribute.needsUpdate=true;visual.line.geometry.computeBoundingSphere();
}
function selectionHaloTexture(){
  if(selectionHaloTexture.value)return selectionHaloTexture.value;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const context=canvas.getContext('2d'),gradient=context.createRadialGradient(64,64,35,64,64,61);
  gradient.addColorStop(0,'rgba(186,245,255,0)');gradient.addColorStop(.58,'rgba(186,245,255,.08)');gradient.addColorStop(.72,'rgba(255,255,255,.98)');gradient.addColorStop(.79,'rgba(165,243,252,.72)');gradient.addColorStop(1,'rgba(56,189,248,0)');
  context.fillStyle=gradient;context.fillRect(0,0,128,128);selectionHaloTexture.value=new THREE.CanvasTexture(canvas);return selectionHaloTexture.value;
}
function animateSelection(now){
  const elapsed=Math.max(0,now-selectionChangedAt),wave=.5+.5*Math.sin(now*.0034),flash=Math.exp(-elapsed/430);
  for(const [id,visual] of atomVisuals){
    const selected=id===selectedAtomId;visual.halo.visible=selected;
    visual.mesh.scale.setScalar(selected?1.0+.045*(.35+.65*wave)+.02*flash:1);
    if(selected){visual.halo.material.opacity=.45+.22*wave+.32*flash;const size=visual.cfg.radius*(3.15+.20*wave+.32*flash);visual.halo.scale.set(size,size,1);}
  }
}
function animateUnpairedElectrons(now){
  for(const ev of electronVisuals){
    const atomPos=pos(ev.atomId);if(!atomPos)continue;let world;
    const pairing=bondTransition?.kind==='form'&&!bondTransition.applied&&((ev.atomId===bondTransition.sourceId&&ev.index===bondTransition.sourceIndex)||(ev.atomId===bondTransition.targetId&&ev.index===bondTransition.targetIndex));
    ev.visible.visible=!pairing;ev.hit.visible=!pairing;if(pairing)continue;
    const dragged=dragState?.mode==='electron'&&dragState.atomId===ev.atomId&&dragState.index===ev.index;
    const compatible=dragState?.mode==='electron'&&!dragged&&canPairAtoms(dragState.atomId,ev.atomId);
    if(dragged)world=dragState.currentWorld.clone();
    else if(electronReturn&&electronReturn.atomId===ev.atomId&&electronReturn.index===ev.index){const t=THREE.MathUtils.clamp((now-electronReturn.startedAt)/electronReturn.duration,0,1),ease=1-Math.pow(1-t,3),home=electronHomePosition(ev.atomId,ev.index,now);world=electronReturn.from.clone().lerp(home,ease);if(t>=1)electronReturn=null;}
    else world=unstableElectronPosition(ev,now);
    if(compatible){
      const screen=worldToScreen(world);
      world=screenPointToWorldOnPlane(screen.x,screen.y,dragState.homeWorld,dragState.planeNormal);
    }
    const target=hoverElectron&&hoverElectron.atomId===ev.atomId&&hoverElectron.index===ev.index;
    ev.visible.position.copy(world);ev.hit.position.copy(world);
    ev.visible.material.depthTest=false;ev.visible.renderOrder=(compatible||dragged)?20:10;
    ev.visible.scale.setScalar(dragged?1.55:target?1.62:compatible?1.18:1+.10*Math.sin(now*.008+ev.phase));
    ev.visible.material.emissiveIntensity=dragged?2.5:target?3.0:compatible?1.9:1.25+.45*(.5+.5*Math.sin(now*.006+ev.phase));
  }
}
function unstableElectronPosition(ev,now){
  const p=pos(ev.atomId),base=ev.dir.clone().normalize(),t1=perpendicular(base),t2=new THREE.Vector3().crossVectors(base,t1).normalize(),a=.13*ev.shell,s=now*.0021+ev.phase;
  return p.clone().addScaledVector(base,ev.shell).addScaledVector(t1,Math.sin(s*1.7)*a).addScaledVector(t2,Math.sin(s*2.3+1.4)*a*.75);
}
function electronRestPosition(ev){const p=pos(ev.atomId);return p?p.clone().addScaledVector(ev.dir.clone().normalize(),ev.shell):new THREE.Vector3();}
function electronHomePosition(atomId,index,now){
  const atom=atomById(atomId),p=pos(atomId);if(!atom||!p)return new THREE.Vector3();const cfg=ELEMENTS[atom.element],dirs=freeDirections(atomId),dir=dirs[index]??dirs[0]??new THREE.Vector3(1,0,0),shell=valenceShellRadius(atom.element,cfg.radius*1.02),base=dir.clone().normalize(),t1=perpendicular(base),t2=new THREE.Vector3().crossVectors(base,t1).normalize(),phase=(atomId*1.71+index*2.37)%6.28,a=.13*shell,s=now*.0021+phase;
  return p.clone().addScaledVector(base,shell).addScaledVector(t1,Math.sin(s*1.7)*a).addScaledVector(t2,Math.sin(s*2.3+1.4)*a*.75);
}
function findNearestCompatibleElectron(clientX,clientY,sourceAtomId,sourceIndex){
  let best=null;for(const ev of electronVisuals){
    if(ev.atomId===sourceAtomId||!canPairAtoms(sourceAtomId,ev.atomId))continue;
    const screen=worldToScreen(ev.visible.position),distance=Math.hypot(clientX-screen.x,clientY-screen.y),bonded=!!bondBetween(sourceAtomId,ev.atomId),score=distance-(bonded?8:0);
    if(!best||score<best.score)best={atomId:ev.atomId,index:ev.index,distance,score,screenX:screen.x,screenY:screen.y,bonded};
  }return best;
}
function canPairAtoms(a,b){if(a===b||freeCapacity(a)<=0||freeCapacity(b)<=0)return false;const existing=bondBetween(a,b);return !existing||existing.order<3;}

function refresh(){ensureMoleculeMeshes();updateMoleculeTransforms();refreshInfo();checkDiscovery();}
function focusedStructure(){return structureByAtom.get(selectedAtomId)??mainStructure;}
function displayIdentity(structure=focusedStructure()){
  if(!structure)return{record:null,primary:'自由制作',iupac:'',formula:'—'};
  const record=structure.record;
  return record?{record,primary:record.commonNameJa??record.nameJa,iupac:record.iupacNameEn??record.nameEn,formula:record.formula??structure.formula}:{record:null,primary:UNKNOWN_NAME,iupac:'',formula:structure.formula};
}
function syncWorkspace(){
  collectionRevision++;
  const previousIds=mainStructure?.ids??new Set();
  structures=connectedStructures(molecule);mainStructure=chooseMainStructure(structures,previousIds);
  structureByAtom=new Map(structures.flatMap(item=>[...item.ids].map(id=>[id,item])));
  const current=new Set(structures.filter(item=>item.complete).map(item=>item.signature));
  discoveryQueue=discoveryQueue.filter(item=>current.has(item.signature));
  if(activeDiscovery&&!current.has(activeDiscovery)){activeDiscovery=null;discoveryUntil=0;discovery.classList.remove('show');}
  discoveryQueue.push(...completionTracker.update(structures).map(item=>({key:item.key,signature:item.signature})));
  for(const id of protectedUntil.keys())if(!structureByAtom.has(id))protectedUntil.delete(id);
}
function refreshInfo(keep=false){
  const focus=focusedStructure(),identity=displayIdentity(focus);formulaEl.textContent=identity.formula;nameEl.textContent=identity.primary;iupacNameEl.textContent=identity.iupac?`IUPAC: ${identity.iupac}`:'';
  const validation=focus?.validation??molecule.validation();statusEl.className=`status ${validation.level}`;statusEl.textContent=focus?.complete?'完成 · このモデルの典型原子価を満たしています':validation.message;
  countsEl.replaceChildren();const atoms=focus?.graph.atoms??[],counts=countElements(atoms);if(!atoms.length)countsEl.textContent='—';else for(const s of Object.keys(counts).sort()){const x=document.createElement('span');x.className='atom-count';x.textContent=`${s} × ${counts[s]}`;countsEl.appendChild(x);}
  refreshStructureList();
  document.querySelector('#undo-cleanup').hidden=!cleanupUndo.length;
  const selected=atomById(selectedAtomId);if(!selected){selectedElementEl.textContent=selectedValenceEl.textContent=selectedLimitEl.textContent='—';if(!keep)selectionChip.textContent=molecule.atoms.length?'原子中央＝骨格調整 · 不対電子の周辺＝結合 · 背景ダブルタップ＝構造を表示':'元素を押して中心原子を置く';return;}
  const used=molecule.bondOrderForAtom(selected.id);selectedElementEl.textContent=`${selected.element} / ${ELEMENTS[selected.element].name}`;selectedValenceEl.textContent=`${used} / 目標 ${preferredValence(selected.element,used)}`;selectedLimitEl.textContent=`不対電子 ${unpairedElectronCount(selected.element,used)} · 非共有電子対 ${lonePairCount(selected.element,used)}`;
  if(!keep)selectionChip.textContent=activeTorsionKey?'回転軸固定中 · 原子ドラッグでねじる':unpairedElectronCount(selected.element,used)>0?`${selected.element} · 電子周辺＝結合／原子中央＝移動`:`${selected.element} · 骨格操作優先 · 原子をドラッグ`;
}
function refreshStructureList(){
  structureCount.textContent=`完成 ${structures.filter(item=>item.complete).length} / 構造 ${structures.length}`;
  structureList.replaceChildren();
  for(const [index,item] of structures.entries()){
    const button=document.createElement('button');button.type='button';button.className='structure-item';button.setAttribute('aria-pressed',String(item===focusedStructure()));
    const identity=displayIdentity(item);button.textContent=`${index+1}. ${item.complete?'完成':'制作中'} · ${identity.formula}${item.record?` · ${identity.primary}`:''}`;
    button.addEventListener('click',()=>{if(interactionLocked())return;selectAtom(item.graph.atoms[0].id);activeTorsionKey=null;refresh();});structureList.appendChild(button);
  }
}
function checkDiscovery(now=performance.now()){
  if(interactionLocked()||dragState||activePointers.size)return;
  if(collectionGame&&collectionCheckedRevision!==collectionRevision){
    collectionCheckedRevision=collectionRevision;
    const result=collectionGame.observeStructures(structures);
    for(const gameEvent of result.events){
      const queued=discoveryQueue.find(item=>item.signature===gameEvent.signature);
      if(queued){if(!queued.gameEvent)queued.gameEvent=gameEvent;}
      else if(gameEvent.isNew)discoveryQueue.push({signature:gameEvent.signature,gameEvent});
    }
  }
  if(now<discoveryUntil)return;
  const event=discoveryQueue.shift();if(!event)return;
  const item=structures.find(item=>item.signature===event.signature&&item.complete);if(!item)return;
  const identity=displayIdentity(item),isNew=!!event.gameEvent?.isNew;activeDiscovery=item.signature;discoveryUntil=now+(isNew?2800:1300);
  document.querySelector('#discovery-kicker').textContent=isNew?'NEW DISCOVERY':'完成';
  document.querySelector('#discovery-english').textContent=isNew?identity.record?.nameEn??'':'';
  document.querySelector('#discovery-learning').textContent=collectionGame?.describeEvent(event.gameEvent)??'';
  discoveryFormula.textContent=identity.formula;discoveryName.textContent=identity.primary;discoveryIupac.textContent=isNew&&identity.iupac?`IUPAC: ${identity.iupac}`:'';
  discovery.classList.toggle('new-discovery',isNew);discovery.classList.toggle('repeat',!isNew);discovery.classList.remove('show');void discovery.offsetWidth;discovery.classList.add('show');
  if(isNew)vibrateFeedback(22,'touch');
}
function pulse(text){selectionChip.textContent=text;clearTimeout(pulse.t);pulse.t=setTimeout(()=>{if(relaxation)selectionChip.textContent=`${relaxation.message} · 視点固定`;else refreshInfo();},1700);}

function requestStructureFrame(){
  if(!focusedStructure())return;
  pendingFrame=true;
  if(interactionLocked()||dragState||activePointers.size){pulse('操作・構造変化の終了後に構造を表示します');return;}
  beginStructureFrame();
}
function beginStructureFrame(){
  pendingFrame=false;
  const fit=structureFrame(focusedStructure(),pos,camera.fov,camera.aspect);if(!fit)return;
  const target=new THREE.Vector3(fit.center.x,fit.center.y,fit.center.z),direction=camera.position.clone().sub(cameraTarget).normalize();
  const position=target.clone().addScaledVector(direction,fit.distance);
  frameTransition={startedAt:performance.now(),duration:reduceMotion?1:420,fromPosition:camera.position.clone(),fromTarget:cameraTarget.clone(),position,target};
  camera.far=Math.max(100,fit.distance+fit.radius*3,position.distanceTo(camera.position)+fit.radius*3);camera.updateProjectionMatrix();
}
function updateStructureFrame(now){
  if(!frameTransition||relaxation||bondTransition)return;
  const item=frameTransition,t=THREE.MathUtils.clamp((now-item.startedAt)/item.duration,0,1),ease=t*t*(3-2*t);
  camera.position.lerpVectors(item.fromPosition,item.position,ease);cameraTarget.lerpVectors(item.fromTarget,item.target,ease);
  if(t>=1){frameTransition=null;refreshInfo();}
}

function updateDebris(now){
  if(now-cleanupCheckedAt<160)return;cleanupCheckedAt=now;
  const protectedIds=new Set([...protectedUntil].filter(([,until])=>until>now).map(([id])=>id));
  if(selectedAtomId!=null)protectedIds.add(selectedAtomId);
  const result=debrisTracker.update({structures,main:mainStructure,positionFor:pos,protectedIds,now,suspended:document.hidden||interactionLocked()||!!dragState||activePointers.size>0||!!electronReturn});
  fadeTargets=new Map(structures.flatMap(item=>[...item.ids].map(id=>[id,result.opacity.get(item.key)??1])));
  if(!result.expired.length)return;
  const ids=new Set(result.expired.flatMap(item=>[...item.ids]));
  cleanupUndo.push({atoms:molecule.atoms.filter(atom=>ids.has(atom.id)).map(atom=>({...atom})),bonds:molecule.bonds.filter(bond=>ids.has(bond.a)&&ids.has(bond.b)).map(bond=>({...bond})),positions:new Map([...ids].map(id=>[id,pos(id).clone()]))});
  molecule.atoms=molecule.atoms.filter(atom=>!ids.has(atom.id));molecule.bonds=molecule.bonds.filter(bond=>!ids.has(bond.a)&&!ids.has(bond.b));
  for(const id of ids){placements.delete(id);debrisOpacity.delete(id);fadeTargets.delete(id);}
  if(activeTorsionKey&&!bondFromKey(activeTorsionKey))activeTorsionKey=null;
  topologyChanged();refresh();pulse('遠くの小片を整理しました · 「整理を元に戻す」で復元できます');
}
function animateDebris(){
  for(const [id,visual] of atomVisuals){
    const target=fadeTargets.get(id)??1,old=debrisOpacity.get(id)??1,alpha=Math.abs(old-target)<.005?target:old+(target-old)*.3;debrisOpacity.set(id,alpha);
    setOpacity(visual.mesh,alpha);for(const pair of visual.lonePairs)for(const {electron} of pair.meshes)setOpacity(electron,alpha);
  }
  for(const ev of electronVisuals)setOpacity(ev.visible,debrisOpacity.get(ev.atomId)??1);
  for(const visual of bondVisuals.values())for(const {mesh} of visual.lines)setOpacity(mesh,debrisOpacity.get(visual.bond.a)??1);
  for(const visual of aromaticVisuals)setOpacity(visual.line,.82*(debrisOpacity.get(visual.cycle[0])??1));
}
function setOpacity(mesh,opacity){const transparent=opacity<1;if(mesh.material.transparent!==transparent){mesh.material.transparent=transparent;mesh.material.needsUpdate=true;}mesh.material.opacity=opacity;mesh.material.depthWrite=!transparent;}
function undoCleanup(){
  if(interactionLocked()||!cleanupUndo.length)return;
  for(const saved of cleanupUndo){molecule.atoms.push(...saved.atoms);molecule.bonds.push(...saved.bonds);for(const [id,position] of saved.positions){placements.set(id,{position:position.clone()});protectedUntil.set(id,performance.now()+15000);}}
  const id=cleanupUndo.at(-1).atoms[0]?.id;cleanupUndo.length=0;debrisTracker.reset();fadeTargets.clear();debrisOpacity.clear();selectAtom(id??null);topologyChanged();refresh();pulse('整理した小片を復元しました · 「構造を表示」で確認できます');
}

function beginTwoFinger(){if(interactionLocked())return;const p=[...activePointers.values()];multiGesture={mid:{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},dist:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),angle:Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x)};}
function updateTwoFinger(){
  if(interactionLocked()||activePointers.size!==2||!multiGesture)return;const p=[...activePointers.values()],mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},dist=Math.max(10,Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)),angle=Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x),dx=mid.x-multiGesture.mid.x,dy=mid.y-multiGesture.mid.y,twist=angle-multiGesture.angle;
  panCamera(dx,dy);zoomCamera(multiGesture.dist/dist);if(Math.abs(twist)>.002)rotateWholeMolecule(0,0,-twist*.8);multiGesture={mid,dist,angle};updateMoleculeTransforms();
}
function panCamera(dx,dy){const dist=camera.position.distanceTo(cameraTarget),scale=dist*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*2/Math.max(1,viewer.clientHeight),delta=cameraRight().multiplyScalar(-dx*scale).add(cameraUp().multiplyScalar(dy*scale));camera.position.add(delta);cameraTarget.add(delta);}
function zoomCamera(ratio){const off=camera.position.clone().sub(cameraTarget),next=THREE.MathUtils.clamp(off.length()*ratio,1.2,36);camera.position.copy(cameraTarget).add(off.normalize().multiplyScalar(next));}

function pointerWorldOnPlane(e,planePoint,planeNormal){return screenPointToWorldOnPlane(e.clientX,e.clientY,planePoint,planeNormal);}
function screenPointToWorldOnPlane(clientX,clientY,planePoint,planeNormal){
  const r=renderer.domElement.getBoundingClientRect();pointer.x=((clientX-r.left)/r.width)*2-1;pointer.y=-((clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal,planePoint),out=new THREE.Vector3();return raycaster.ray.intersectPlane(plane,out)??planePoint.clone();
}
function worldToScreen(world){const r=renderer.domElement.getBoundingClientRect(),v=world.clone().project(camera);return{x:r.left+(v.x+1)*.5*r.width,y:r.top+(1-v.y)*.5*r.height,depth:v.z};}
function isRotatableBond(b){return b.order===1&&atomById(b.a)?.element!=='H'&&atomById(b.b)?.element!=='H'&&!!cutSides(b.a,b.b);}
function cutSides(a,b){const A=bfs(a,a,b);if(A.has(b))return null;return{a:A,b:bfs(b,a,b)};}
function bfs(start,skipA,skipB){const seen=new Set([start]),q=[start];while(q.length){const id=q.shift();for(const n of molecule.neighbors(id)){if((id===skipA&&n.atomId===skipB)||(id===skipB&&n.atomId===skipA))continue;if(!seen.has(n.atomId)){seen.add(n.atomId);q.push(n.atomId);}}}return seen;}
function connectedComponent(start){const seen=new Set([start]),q=[start];while(q.length){const id=q.shift();for(const n of molecule.neighbors(id))if(!seen.has(n.atomId)){seen.add(n.atomId);q.push(n.atomId);}}return seen;}
function freeCapacity(id){const a=atomById(id);if(!a)return 0;const max=Math.max(...(ATOMIC_MODEL[a.element]?.preferredValences??[1]));return Math.max(0,max-molecule.bondOrderForAtom(id));}
function bondLengthFor(a,b,order){return bondLengthByElements(atomById(a)?.element,atomById(b)?.element,order);}
function bondLengthByElements(a,b,order){return((ATOMIC_MODEL[a]?.covalentRadius??.75)+(ATOMIC_MODEL[b]?.covalentRadius??.75))*.78*bondLengthScale(order);}
function atomById(id){return molecule.atoms.find(a=>a.id===id);}function bondBetween(a,b){return molecule.bonds.find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));}function bondKey(a,b){return`${Math.min(a,b)}:${Math.max(a,b)}`;}function bondFromKey(key){const[a,b]=key.split(':').map(Number);return bondBetween(a,b);}function pos(id){return placements.get(id)?.position;}
function cameraRight(){camera.updateMatrixWorld();return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).normalize();}function cameraUp(){camera.updateMatrixWorld();return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1).normalize();}function cameraDirection(){return cameraTarget.clone().sub(camera.position).normalize();}
function perpendicular(v){const ref=Math.abs(v.y)<.85?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);return new THREE.Vector3().crossVectors(v,ref).normalize();}
function vibrateFeedback(duration,pointerType){if(pointerType==='mouse')return;try{navigator.vibrate?.(duration);}catch{}}
function capture(e){try{renderer.domElement.setPointerCapture(e.pointerId)}catch{}}function release(e){try{renderer.domElement.releasePointerCapture(e.pointerId)}catch{}}
function selectAtom(id){if(selectedAtomId!==id){if(selectedAtomId!=null)protectedUntil.set(selectedAtomId,performance.now()+DEBRIS_POLICY.protectionMs);selectedAtomId=id;selectionChangedAt=performance.now();}}
function interactionLocked(){return!!relaxation||!!bondTransition||!!frameTransition||collectionOpen;}
function topologyChanged(){solver.markTopologyDirty();renderTopologyDirty=true;syncWorkspace();}
function spawnPosition(){
  const center=pos(selectedAtomId)?.clone()??moleculeCenter(),right=cameraRight(),up=cameraUp(),seed=molecule.atoms.length;
  for(let attempt=0;attempt<10;attempt++){
    const angle=(seed+attempt)*2.399963,range=1.65+.24*Math.floor(attempt/3),candidate=center.clone().addScaledVector(right,Math.cos(angle)*range).addScaledVector(up,Math.sin(angle)*range);
    if(molecule.atoms.every(atom=>!pos(atom.id)||candidate.distanceTo(pos(atom.id))>.95))return candidate;
  }return center.clone().addScaledVector(right,2.2);
}
function disposeObject(object){object.traverse?.(item=>{item.geometry?.dispose?.();if(Array.isArray(item.material))item.material.forEach(material=>material.dispose?.());else item.material?.dispose?.();});}
function disposeGroup(group){for(const object of[...group.children]){group.remove(object);disposeObject(object);}}
function resize(){const w=Math.max(1,viewer.clientWidth),h=Math.max(1,viewer.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function animate(now=performance.now()){
  requestAnimationFrame(animate);if(bondTransition)updateBondTransition(now);if(relaxation)updateRelaxation(now);
  if(pendingFrame&&!interactionLocked()&&!dragState&&!activePointers.size)beginStructureFrame();updateStructureFrame(now);
  camera.lookAt(cameraTarget);camera.updateMatrixWorld();updateDebris(now);animateUnpairedElectrons(now);animateSelection(now);animateDebris();checkDiscovery(now);renderer.render(scene,camera);
}
