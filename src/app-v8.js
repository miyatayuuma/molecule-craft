import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js/+esm';
import { ELEMENTS, Molecule, countElements } from './chemistry.js';
import { ATOMIC_MODEL, preferredValence, unpairedElectronCount, lonePairCount, idealBondAngleDeg, valenceShellRadius, optimizeBondOrders, tapsToWeakenBond, bondEnergyKJ, bondLengthScale } from './bonding-model.js';

const molecule = new Molecule();
const placements = new Map();
const bondDamage = new Map();
const atomDamage = new Map();
const activePointers = new Map();
const atomTapState = new Map();
let selectedAtomId = null;
let dragState = null;
let electronDrag = null;
let hoveredSnap = null;
let lastCelebrated = '';
let toastTimer = 0;
let lastInteractionAt = performance.now();
let idleLastTime = performance.now();
let spawnSerial = 0;
let gestureState = null;

const viewer = document.querySelector('#viewer');
const palette = document.querySelector('#element-palette');
const statusEl = document.querySelector('#status');
const formulaEl = document.querySelector('#formula');
const nameEl = document.querySelector('#molecule-name');
const countsEl = document.querySelector('#atom-counts');
const selectedElementEl = document.querySelector('#selected-element');
const selectedValenceEl = document.querySelector('#selected-valence');
const selectedLimitEl = document.querySelector('#selected-limit');
const selectionChip = document.querySelector('#selection-chip');
const discovery = document.querySelector('#discovery');
const discoveryFormula = document.querySelector('#discovery-formula');
const discoveryName = document.querySelector('#discovery-name');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(5.5, 4.3, 8.2);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.touchAction = 'none';
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 1.35;
controls.maxDistance = 34;
controls.screenSpacePanning = true;
controls.addEventListener('start', markInteraction);

scene.add(new THREE.HemisphereLight(0xffffff, 0x182235, 2.8));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.4); keyLight.position.set(7, 9, 8); scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x8fd3ff, 1.25); rimLight.position.set(-6, -3, 4); scene.add(rimLight);

const moleculeGroup = new THREE.Group();
const interactionGroup = new THREE.Group();
const effectGroup = new THREE.Group();
scene.add(moleculeGroup, interactionGroup, effectGroup);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane();

buildPalette(); bindUI(); refresh(); resize(); animate();

function buildPalette() {
  for (const [symbol, element] of Object.entries(ELEMENTS)) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'element-button'; button.textContent = symbol;
    button.title = `${element.name}を追加`;
    button.style.setProperty('--element-color', element.color);
    button.addEventListener('click', () => addElement(symbol));
    palette.appendChild(button);
  }
}

function bindUI() {
  document.querySelector('#delete-selected')?.addEventListener('click', () => {
    if (selectedAtomId == null) return;
    const now = performance.now();
    atomDamage.set(selectedAtomId, { damage: 0.86, lastHit: now, lastUpdate: now });
    damageAtom(selectedAtomId, true);
  });
  document.querySelector('#clear-all')?.addEventListener('click', () => {
    markInteraction(); molecule.clear(); placements.clear(); bondDamage.clear(); atomDamage.clear(); atomTapState.clear();
    selectedAtomId = null; dragState = null; electronDrag = null; hoveredSnap = null; lastCelebrated = '';
    camera.position.set(5.5,4.3,8.2); controls.target.set(0,0,0); controls.update(); refresh();
  });
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('wheel', markInteraction, { passive: true });
  new ResizeObserver(resize).observe(viewer);
}

function addElement(symbol) {
  markInteraction();
  const selected = atomById(selectedAtomId);
  if (!selected) return addFreeAtom(symbol);
  return attachToSelected(symbol, selected.id);
}

function addFreeAtom(symbol) {
  const atom = molecule.addAtom(symbol);
  const angle = spawnSerial++ * 2.399963;
  const right = cameraRight();
  const up = cameraUp();
  const r = molecule.atoms.length === 1 ? 0 : 0.58 + 0.11 * Math.sqrt(spawnSerial);
  const position = controls.target.clone().add(right.multiplyScalar(Math.cos(angle)*r)).add(up.multiplyScalar(Math.sin(angle)*r*.72));
  placements.set(atom.id,{position}); selectedAtomId=atom.id;
  pulse(`${symbol} を作業位置へ配置`); refresh();
}

function attachToSelected(symbol, centerId) {
  const center = atomById(centerId); if (!center) return;
  const capacity = freeCapacity(centerId);
  if (capacity <= 0) { pulse(`${center.element} には追加できる結合余地がありません`); return; }
  const childModel = ATOMIC_MODEL[symbol];
  const monovalent = Math.max(...(childModel?.preferredValences ?? [1])) === 1;
  const count = monovalent ? Math.max(1, capacity) : 1;
  const centerPos = placements.get(centerId)?.position; if (!centerPos) return;
  const dirs = attachmentDirections(centerId, count);
  const created = [];
  for (let i=0; i<count && freeCapacity(centerId)>0; i++) {
    const atom = molecule.addAtom(symbol);
    const dist = bondLengthByElements(center.element, symbol, 1) * 1.08;
    placements.set(atom.id,{ position: centerPos.clone().add(dirs[i % dirs.length].clone().multiplyScalar(dist)) });
    molecule.setBond(centerId, atom.id, 1);
    created.push(atom.id);
  }
  optimizeBondOrders(molecule,[...connectedComponent(centerId)]);
  settleMolecule(78);
  selectedAtomId = centerId;
  pulse(created.length > 1 ? `${symbol} × ${created.length} を空いている結合位置へ追加` : `${symbol} を選択原子へ結合`);
  if (navigator.vibrate) navigator.vibrate(created.length > 1 ? [10,12,16] : 12);
  refresh();
}

function attachmentDirections(centerId, count) {
  const neighbors = molecule.neighbors(centerId).map(n => placements.get(n.atomId)?.position).filter(Boolean);
  const origin = placements.get(centerId)?.position ?? new THREE.Vector3();
  const candidates = [
    new THREE.Vector3(1,1,1), new THREE.Vector3(1,-1,-1), new THREE.Vector3(-1,1,-1), new THREE.Vector3(-1,-1,1),
    new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)
  ].map(v=>v.normalize());
  candidates.sort((a,b)=>clearance(b)-clearance(a));
  return candidates.slice(0,Math.max(1,count));
  function clearance(dir) {
    if (!neighbors.length) return 10;
    return Math.min(...neighbors.map(p => 1 - dir.dot(p.clone().sub(origin).normalize())));
  }
}

function onPointerDown(e) {
  markInteraction();
  activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,downAt:performance.now()});
  if (activePointers.size===2) { beginTwoFingerGesture(); dragState=null; electronDrag=null; hoveredSnap=null; controls.enabled=false; return; }
  if (activePointers.size>1) return;

  setPointer(e); raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(moleculeGroup.children,true);
  const bondHit=hits.find(h=>h.object.userData.bondKey);
  if (bondHit) {
    const key=bondHit.object.userData.bondKey;
    const [a,b]=key.split(':').map(Number);
    const bond=bondBetween(a,b);
    dragState={mode:'bond',key,a,b,rotatable:!!bond&&isRotatableBond(bond),startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,downAt:performance.now()};
    controls.enabled=false; capture(e); return;
  }
  const electronHit=hits.find(h=>h.object.userData.electronAtomId!==undefined);
  if (electronHit) {
    electronDrag={atomId:electronHit.object.userData.electronAtomId,current:electronHit.point.clone()};selectedAtomId=electronDrag.atomId;controls.enabled=false;capture(e);refresh();return;
  }
  const atomHit=hits.find(h=>h.object.userData.atomCore);
  if (!atomHit) { selectedAtomId=null; controls.enabled=true; refreshInfo(); return; }

  const atomId=atomHit.object.userData.atomId;
  selectedAtomId=atomId;
  const component=[...connectedComponent(atomId)];
  dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).normalize(),placements.get(atomId).position);
  const world=rayToPlane(e); if(!world)return;
  dragState={mode:'translate',atomId,component,startWorld:world.clone(),starts:new Map(component.map(id=>[id,placements.get(id).position.clone()])),startX:e.clientX,startY:e.clientY,moved:false,downAt:performance.now()};
  controls.enabled=false; capture(e); refresh();
}

function beginTwoFingerGesture() {
  const pts=[...activePointers.values()];
  const p0=pts[0],p1=pts[1];
  gestureState={
    prevMid:{x:(p0.x+p1.x)/2,y:(p0.y+p1.y)/2},
    prevDist:Math.hypot(p1.x-p0.x,p1.y-p0.y),
    prevAngle:Math.atan2(p1.y-p0.y,p1.x-p0.x)
  };
}

function updateTwoFingerGesture() {
  if (activePointers.size!==2 || !gestureState) return;
  const pts=[...activePointers.values()],p0=pts[0],p1=pts[1];
  const mid={x:(p0.x+p1.x)/2,y:(p0.y+p1.y)/2};
  const dist=Math.max(10,Math.hypot(p1.x-p0.x,p1.y-p0.y));
  const angle=Math.atan2(p1.y-p0.y,p1.x-p0.x);
  const dx=mid.x-gestureState.prevMid.x, dy=mid.y-gestureState.prevMid.y;
  const distRatio=gestureState.prevDist/dist;
  const dAngle=normalizeAngle(angle-gestureState.prevAngle);

  if (Math.hypot(dx,dy)>0.1) panCamera(dx,dy);
  if (Math.abs(Math.log(distRatio))>0.001) zoomCamera(distRatio);
  if (Math.abs(dAngle)>0.002) twistCamera(dAngle);

  gestureState.prevMid=mid; gestureState.prevDist=dist; gestureState.prevAngle=angle;
  pulse('2本指: 平行移動＝中心移動 / ピンチ＝ズーム / ひねり＝回転');
}

function panCamera(dx,dy) {
  const distance=camera.position.distanceTo(controls.target);
  const scale=distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*2/Math.max(1,renderer.domElement.clientHeight);
  const delta=cameraRight().multiplyScalar(-dx*scale).add(cameraUp().multiplyScalar(dy*scale));
  camera.position.add(delta); controls.target.add(delta); controls.update();
}
function zoomCamera(ratio) {
  const offset=camera.position.clone().sub(controls.target);
  const next=THREE.MathUtils.clamp(offset.length()*ratio,controls.minDistance,controls.maxDistance);
  camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(next)); controls.update();
}
function twistCamera(angle) {
  const offset=camera.position.clone().sub(controls.target);
  const worldUp=new THREE.Vector3(0,1,0);
  offset.applyAxisAngle(worldUp,-angle*.72);
  camera.position.copy(controls.target).add(offset); camera.lookAt(controls.target); controls.update();
}
function normalizeAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}

function onPointerMove(e) {
  const ps=activePointers.get(e.pointerId);
  if(ps){ps.x=e.clientX;ps.y=e.clientY;}
  markInteraction();
  if(activePointers.size===2){updateTwoFingerGesture();return;}
  if(activePointers.size>1)return;
  if(electronDrag){const p=rayToPlaneThrough(e,placements.get(electronDrag.atomId)?.position??new THREE.Vector3());if(p)electronDrag.current.copy(p);hoveredSnap=findElectronTarget(electronDrag.atomId,electronDrag.current);renderInteraction();return;}
  if(!dragState)return;
  dragState.moved ||= Math.hypot(e.clientX-dragState.startX,e.clientY-dragState.startY)>7;

  if(dragState.mode==='bond'){
    if(!dragState.moved)return;
    if(!dragState.rotatable){pulse('この結合は回転できません');return;}
    const sides=cutSides(dragState.a,dragState.b);if(!sides)return;
    const moving=sides.aSide.size<=sides.bSide.size?[...sides.aSide]:[...sides.bSide];
    const dx=e.clientX-dragState.lastX,dy=e.clientY-dragState.lastY;dragState.lastX=e.clientX;dragState.lastY=e.clientY;
    rotateBranchAroundBond(dragState.a,dragState.b,moving,THREE.MathUtils.clamp((dx-dy*.35)*.012,-.12,.12));
    hoveredSnap=findAutoBondCandidate(moving,true);renderMolecule();return;
  }

  if(!dragState.moved)return;
  const world=rayToPlane(e);if(!world)return;const delta=world.clone().sub(dragState.startWorld);
  for(const id of dragState.component)placements.get(id).position.copy(dragState.starts.get(id)).add(delta);
  hoveredSnap=findAutoBondCandidate(dragState.component,false);renderMolecule();
}

function onPointerUp(e) {
  markInteraction();
  const before=activePointers.size,ps=activePointers.get(e.pointerId);activePointers.delete(e.pointerId);
  if(before>=2){if(activePointers.size<2)gestureState=null;controls.enabled=true;return;}
  if(electronDrag){const target=hoveredSnap??findElectronTarget(electronDrag.atomId,electronDrag.current);if(target)formBond(electronDrag.atomId,target.atomId,true);electronDrag=null;hoveredSnap=null;controls.enabled=true;release(e);refresh();return;}
  if(!dragState){controls.enabled=true;return;}
  const state=dragState,isTap=!state.moved&&ps&&performance.now()-ps.downAt<360;
  if(state.mode==='bond'){
    if(isTap)damageBond(state.key);
    else if(state.rotatable){const sides=cutSides(state.a,state.b);const moving=sides?(sides.aSide.size<=sides.bSide.size?[...sides.aSide]:[...sides.bSide]):[];const candidate=hoveredSnap??findAutoBondCandidate(moving,true);if(candidate)formBond(candidate.a,candidate.b,false);settleMolecule(24);}
  } else if(isTap) {
    handleAtomTap(state.atomId);
  } else {
    const candidate=hoveredSnap??findAutoBondCandidate(state.component,false);if(candidate)formBond(candidate.a,candidate.b,false);
  }
  dragState=null;hoveredSnap=null;controls.enabled=true;release(e);refresh();
}
function onPointerCancel(e){activePointers.delete(e.pointerId);if(activePointers.size<2)gestureState=null;dragState=null;electronDrag=null;hoveredSnap=null;controls.enabled=true;release(e);refresh();}

function handleAtomTap(id){
  const now=performance.now(),prev=atomTapState.get(id);
  selectedAtomId=id;
  if(prev&&now-prev.time<520){prev.count+=1;prev.time=now;atomTapState.set(id,prev);damageAtom(id,false);}
  else{atomTapState.clear();atomTapState.set(id,{count:1,time:now});pulse(`${atomById(id)?.element??''} を選択 · 元素ボタンでここへ追加`);}
}

function chooseTorsionForAtom(atomId){const candidates=[];for(const bond of molecule.bonds){if(!isRotatableBond(bond))continue;const sides=cutSides(bond.a,bond.b);if(!sides)continue;const inA=sides.aSide.has(atomId),inB=sides.bSide.has(atomId);if(!inA&&!inB)continue;const movingIds=[...(inA?sides.aSide:sides.bSide)];candidates.push({a:bond.a,b:bond.b,movingIds,size:movingIds.length});}candidates.sort((a,b)=>a.size-b.size);return candidates[0]??null;}
function isRotatableBond(bond){if(bond.order!==1)return false;const a=atomById(bond.a),b=atomById(bond.b);if(!a||!b||a.element==='H'||b.element==='H')return false;return cutSides(bond.a,bond.b)!==null;}
function cutSides(a,b){const aSide=bfsIgnoringBond(a,a,b);if(aSide.has(b))return null;return{aSide,bSide:bfsIgnoringBond(b,a,b)};}
function bfsIgnoringBond(start,skipA,skipB){const seen=new Set([start]),q=[start];while(q.length){const id=q.shift();for(const n of molecule.neighbors(id)){if((id===skipA&&n.atomId===skipB)||(id===skipB&&n.atomId===skipA))continue;if(!seen.has(n.atomId)){seen.add(n.atomId);q.push(n.atomId);}}}return seen;}
function rotateBranchAroundBond(a,b,movingIds,angle){const moving=new Set(movingIds),pivotId=moving.has(a)?b:a,anchorId=moving.has(a)?a:b,pivot=placements.get(pivotId)?.position,anchor=placements.get(anchorId)?.position;if(!pivot||!anchor)return;const axis=anchor.clone().sub(pivot).normalize();for(const id of movingIds){if(id===anchorId)continue;const p=placements.get(id)?.position;if(p)p.sub(pivot).applyAxisAngle(axis,angle).add(pivot);}}

function findAutoBondCandidate(movingIds,allowSame){const movingSet=new Set(movingIds);let best=null;for(const a of movingIds){if(!canAcceptBond(a))continue;for(const atom of molecule.atoms){const b=atom.id;if(movingSet.has(b)||!canAcceptBond(b)||bondBetween(a,b))continue;if(!allowSame&&connectedComponent(a).has(b))continue;if(allowSame&&connectedComponent(a).has(b)&&graphDistance(a,b)<3)continue;const d=placements.get(a).position.distanceTo(placements.get(b).position),threshold=bondLengthFor(a,b,1)*1.28;if(d<threshold&&(!best||d<best.distance))best={a,b,atomId:b,distance:d};}}return best;}
function graphDistance(start,goal){const q=[[start,0]],seen=new Set([start]);while(q.length){const[id,d]=q.shift();if(id===goal)return d;for(const n of molecule.neighbors(id))if(!seen.has(n.atomId)){seen.add(n.atomId);q.push([n.atomId,d+1]);}}return Infinity;}
function findElectronTarget(sourceId,point){let best=null;for(const atom of molecule.atoms){if(atom.id===sourceId||!canAcceptBond(atom.id))continue;const d=placements.get(atom.id).position.distanceTo(point);if(d<.82&&(!best||d<best.distance))best={atomId:atom.id,distance:d};}return best;}
function canAcceptBond(id){return freeCapacity(id)>0||molecule.neighbors(id).some(n=>n.order>1);}
function freeCapacity(id){const atom=atomById(id);if(!atom)return 0;const used=molecule.bondOrderForAtom(id),max=Math.max(...(ATOMIC_MODEL[atom.element]?.preferredValences??[1]));return Math.max(0,max-used);}
function formBond(a,b,direct){if(a===b)return;const existing=bondBetween(a,b);if(existing&&direct){if(existing.order<3)existing.order+=1;}else if(!existing)molecule.setBond(a,b,1);else return;optimizeBondOrders(molecule,[...connectedComponent(a)]);settleMolecule(88);bondDamage.clear();selectedAtomId=b;const bond=bondBetween(a,b);pulse(bond?.order===3?'電子配置から三重結合へ安定化':bond?.order===2?'電子配置から二重結合へ安定化':'共有電子対ができました');if(navigator.vibrate)navigator.vibrate(bond?.order>1?[16,20,24]:18);checkDiscovery();}

function currentDamage(state,now){const graceEnd=state.lastHit+520;if(now<=graceEnd)return state.damage;const from=Math.max(state.lastUpdate??graceEnd,graceEnd);return Math.max(0,state.damage-(now-from)/1600);}
function damageBond(key){const[a,b]=key.split(':').map(Number),bond=bondBetween(a,b);if(!bond)return;const aa=atomById(a),bb=atomById(b);if(!aa||!bb)return;const required=tapsToWeakenBond(aa.element,bb.element,bond.order),now=performance.now(),prev=bondDamage.get(key),base=prev?currentDamage(prev,now):0,damage=Math.min(1,base+1/required);bondDamage.set(key,{damage,lastHit:now,lastUpdate:now,required});moleculeGroup.userData.shakeUntil=now+150;const energy=Math.round(bondEnergyKJ(aa.element,bb.element,bond.order));if(damage<.999){pulse(`結合がほどけています ${Math.round(damage*100)}% · 約${energy} kJ/mol`);if(navigator.vibrate)navigator.vibrate(8);refresh();return;}bondDamage.delete(key);const oldOrder=bond.order;if(oldOrder>1)molecule.setBond(a,b,oldOrder-1);else molecule.removeBond(a,b);settleMolecule(48);lastCelebrated='';pulse(oldOrder===3?'π結合が1組ほどけて二重結合へ':oldOrder===2?'π結合がほどけて単結合へ':'結合が切れて分離しました');if(navigator.vibrate)navigator.vibrate([18,18,30]);refresh();}
function atomBreakTaps(element){const v=ATOMIC_MODEL[element]?.valenceElectrons??4;return Math.max(4,Math.min(7,3+Math.round(Math.sqrt(v))));}
function damageAtom(id,force){const atom=atomById(id);if(!atom)return;const now=performance.now(),required=atomBreakTaps(atom.element),prev=atomDamage.get(id),base=prev?currentDamage(prev,now):0,increment=force?.22:1/required,damage=Math.min(1,base+increment);atomDamage.set(id,{damage,lastHit:now,lastUpdate:now,required});selectedAtomId=id;if(damage<.999){pulse(`${atom.element} が崩れています ${Math.round(damage*100)}%`);moleculeGroup.userData.shakeUntil=now+110;if(navigator.vibrate)navigator.vibrate(7);refresh();return;}atomDamage.delete(id);const pos=placements.get(id)?.position.clone()??new THREE.Vector3(),color=ELEMENTS[atom.element].color;spawnMist(pos,color);molecule.removeAtom(id);placements.delete(id);selectedAtomId=null;lastCelebrated='';settleMolecule(30);pulse(`${atom.element} が霧散しました`);if(navigator.vibrate)navigator.vibrate([12,18,35]);refresh();}
function recoverDamage(now){let changed=false;for(const[key,state]of[...bondDamage]){const d=currentDamage(state,now);if(d<=.002){bondDamage.delete(key);changed=true;}else if(Math.abs(d-state.damage)>.004){state.damage=d;state.lastUpdate=now;changed=true;}}for(const[id,state]of[...atomDamage]){const d=currentDamage(state,now);if(d<=.002){atomDamage.delete(id);changed=true;}else if(Math.abs(d-state.damage)>.004){state.damage=d;state.lastUpdate=now;changed=true;}}if(changed)renderMolecule();}

function spawnMist(position,color){const count=34,positions=new Float32Array(count*3),velocities=[];for(let i=0;i<count;i++){positions[i*3]=position.x;positions[i*3+1]=position.y;positions[i*3+2]=position.z;velocities.push(new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize().multiplyScalar(.35+Math.random()*.65));}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const material=new THREE.PointsMaterial({color,size:.075,transparent:true,opacity:.9,depthWrite:false});const points=new THREE.Points(geometry,material);points.userData={born:performance.now(),velocities};effectGroup.add(points);}
function updateEffects(now){for(const obj of[...effectGroup.children]){const age=(now-obj.userData.born)/1000;if(age>1.35){effectGroup.remove(obj);obj.geometry.dispose();obj.material.dispose();continue;}const attr=obj.geometry.attributes.position;for(let i=0;i<attr.count;i++){const v=obj.userData.velocities[i];attr.array[i*3]+=v.x*.016;attr.array[i*3+1]+=v.y*.016;attr.array[i*3+2]+=v.z*.016;v.multiplyScalar(.986);}attr.needsUpdate=true;obj.material.opacity=Math.max(0,.9*(1-age/1.35));obj.material.size=.075+age*.035;}}

function settleMolecule(iterations=60){for(let step=0;step<iterations;step++){for(const bond of molecule.bonds){const pa=placements.get(bond.a)?.position,pb=placements.get(bond.b)?.position;if(!pa||!pb)continue;const delta=pb.clone().sub(pa),dist=Math.max(.001,delta.length()),target=bondLengthFor(bond.a,bond.b,bond.order),corr=delta.normalize().multiplyScalar((dist-target)*.20);pa.add(corr.clone().multiplyScalar(.5));pb.sub(corr.clone().multiplyScalar(.5));}for(const center of molecule.atoms){const neighbors=molecule.neighbors(center.id).map(n=>n.atomId);if(neighbors.length<2)continue;const c=placements.get(center.id)?.position;if(!c)continue;const used=molecule.bondOrderForAtom(center.id),angle=THREE.MathUtils.degToRad(idealBondAngleDeg(center.element,used,neighbors.length));if(neighbors.length===2)enforceTwoNeighborAngle(c,neighbors[0],neighbors[1],angle);else relaxMultiNeighborAngles(c,neighbors,Math.cos(angle));}}}
function enforceTwoNeighborAngle(center,aId,bId,target){const pa=placements.get(aId)?.position,pb=placements.get(bId)?.position;if(!pa||!pb)return;const va=pa.clone().sub(center),vb=pb.clone().sub(center),la=va.length(),lb=vb.length();if(la<.001||lb<.001)return;va.normalize();vb.normalize();const current=Math.acos(THREE.MathUtils.clamp(va.dot(vb),-1,1)),diff=target-current;if(Math.abs(diff)<.002)return;let axis=new THREE.Vector3().crossVectors(va,vb);if(axis.lengthSq()<1e-6)axis=perpendicular(va);else axis.normalize();va.applyAxisAngle(axis,-diff*.18);vb.applyAxisAngle(axis,diff*.18);pa.lerp(center.clone().add(va.multiplyScalar(la)),.36);pb.lerp(center.clone().add(vb.multiplyScalar(lb)),.36);}
function relaxMultiNeighborAngles(center,ids,targetCos){for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const pi=placements.get(ids[i])?.position,pj=placements.get(ids[j])?.position;if(!pi||!pj)continue;const vi=pi.clone().sub(center).normalize(),vj=pj.clone().sub(center).normalize(),err=vi.dot(vj)-targetCos;if(Math.abs(err)<.012)continue;const ti=vj.clone().sub(vi.clone().multiplyScalar(vi.dot(vj))),tj=vi.clone().sub(vj.clone().multiplyScalar(vj.dot(vi)));if(ti.lengthSq()>1e-6)pi.add(ti.normalize().multiplyScalar(-err*.075));if(tj.lengthSq()>1e-6)pj.add(tj.normalize().multiplyScalar(-err*.075));}}
function bondLengthFor(a,b,order){const aa=atomById(a),bb=atomById(b);return bondLengthByElements(aa?.element,bb?.element,order);}
function bondLengthByElements(a,b,order){const ra=ATOMIC_MODEL[a]?.covalentRadius??.75,rb=ATOMIC_MODEL[b]?.covalentRadius??.75;return(ra+rb)*.78*bondLengthScale(order);}
function connectedComponent(start){const seen=new Set([start]),q=[start];while(q.length){const id=q.shift();for(const n of molecule.neighbors(id))if(!seen.has(n.atomId)){seen.add(n.atomId);q.push(n.atomId);}}return seen;}
function atomById(id){return molecule.atoms.find(a=>a.id===id);}function bondBetween(a,b){return molecule.bonds.find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));}function bondKey(a,b){return`${Math.min(a,b)}:${Math.max(a,b)}`;}

function checkDiscovery(){const name=molecule.recognizedName(),formula=molecule.formula();const allSatisfied=molecule.atoms.length>1&&molecule.atoms.every(atom=>(ATOMIC_MODEL[atom.element]?.preferredValences??[]).includes(molecule.bondOrderForAtom(atom.id)));const signature=`${formula}|${name}|${molecule.bonds.map(b=>`${bondKey(b.a,b.b)}=${b.order}`).sort().join(',')}`;if(!allSatisfied||!name||name==='自由制作'||name==='未知 / 未登録の構造'||signature===lastCelebrated)return;lastCelebrated=signature;discoveryFormula.textContent=formula;discoveryName.textContent=name;discovery.classList.remove('show');void discovery.offsetWidth;discovery.classList.add('show');moleculeGroup.userData.flashUntil=performance.now()+950;if(navigator.vibrate)navigator.vibrate([25,35,55]);}
function refresh(){renderMolecule();refreshInfo();checkDiscovery();}
function refreshInfo(){formulaEl.textContent=molecule.formula();nameEl.textContent=molecule.recognizedName();const validation=molecule.validation();statusEl.className=`status ${validation.level}`;statusEl.textContent=validation.message;const counts=countElements(molecule.atoms);countsEl.replaceChildren();if(!molecule.atoms.length)countsEl.textContent='—';else for(const symbol of Object.keys(counts).sort()){const span=document.createElement('span');span.className='atom-count';span.textContent=`${symbol} × ${counts[symbol]}`;countsEl.appendChild(span);}const selected=atomById(selectedAtomId);if(!selected){selectedElementEl.textContent='—';selectedValenceEl.textContent='—';selectedLimitEl.textContent='—';selectionChip.textContent=molecule.atoms.length?'原子タップで選択 · 2本指スワイプで作業中心を移動':'元素を押して原子を置く';return;}const used=molecule.bondOrderForAtom(selected.id),singles=unpairedElectronCount(selected.element,used),pairs=lonePairCount(selected.element,used);selectedElementEl.textContent=`${selected.element} / ${ELEMENTS[selected.element].name}`;selectedValenceEl.textContent=`${used} / 目標 ${preferredValence(selected.element,used)}`;selectedLimitEl.textContent=`不対電子 ${singles} · 非共有電子対 ${pairs}`;selectionChip.textContent=`${selected.element} 選択中 · 元素ボタンで結合追加 · 原子ドラッグで分子移動`;}

function renderMolecule(){disposeGroup(moleculeGroup);const now=performance.now(),flash=now<(moleculeGroup.userData.flashUntil||0),shake=now<(moleculeGroup.userData.shakeUntil||0);moleculeGroup.position.set(shake?Math.sin(now*.12)*.025:0,0,0);for(const bond of molecule.bonds)addBondMeshes(bond,flash);for(const atom of molecule.atoms)renderAtom(atom,flash);renderInteraction();}
function renderAtom(atom,flash){const p=placements.get(atom.id);if(!p)return;const cfg=ELEMENTS[atom.element],selected=atom.id===selectedAtomId,damage=atomDamage.get(atom.id)?.damage??0;const core=new THREE.Mesh(new THREE.SphereGeometry(cfg.radius*1.06*(1-damage*.10),32,24),new THREE.MeshStandardMaterial({color:cfg.color,roughness:.22,metalness:.03,transparent:damage>0,opacity:1-damage*.58,emissive:damage>.05?0x7f1d1d:flash?0x38bdf8:selected?0x075985:0,emissiveIntensity:damage>.05?.25+damage*.85:flash?.72:selected?.55:0}));core.position.copy(p.position);core.userData={atomCore:true,atomId:atom.id};moleculeGroup.add(core);if(selected){const ring=new THREE.Mesh(new THREE.TorusGeometry(cfg.radius*1.34,.022,10,34),new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.72,depthTest:false}));ring.position.copy(p.position);ring.quaternion.copy(camera.quaternion);moleculeGroup.add(ring);}if(damage>.04)addAtomCracks(p.position,cfg.radius*1.08,damage);const used=molecule.bondOrderForAtom(atom.id),singles=unpairedElectronCount(atom.element,used),lps=lonePairCount(atom.element,used),total=Math.max(1,singles+lps+molecule.neighbors(atom.id).length),dirs=electronDirections(total),shellR=valenceShellRadius(atom.element,cfg.radius*1.02);for(let i=0;i<singles;i++)addElectron(atom.id,p.position,dirs[i%dirs.length],shellR,selected);for(let i=0;i<lps;i++)addLonePair(p.position,dirs[(singles+i)%dirs.length],shellR);}
function addAtomCracks(origin,radius,damage){const count=2+Math.floor(damage*5);for(let i=0;i<count;i++){const dir=new THREE.Vector3(Math.sin(i*2.31+.7),Math.cos(i*1.73+.4),Math.sin(i*.91+1.1)).normalize(),side=perpendicular(dir),pts=[origin.clone().add(dir.clone().multiplyScalar(radius*.82)),origin.clone().add(dir.clone().multiplyScalar(radius*1.01)).add(side.clone().multiplyScalar(.08)),origin.clone().add(dir.clone().multiplyScalar(radius*.96)).add(side.clone().multiplyScalar(-.07))],g=new THREE.BufferGeometry().setFromPoints(pts),m=new THREE.LineBasicMaterial({color:0xfca5a5,transparent:true,opacity:.18+.72*damage,depthTest:false});moleculeGroup.add(new THREE.Line(g,m));}}
function addElectron(atomId,origin,direction,shellR,selected){const pos=origin.clone().add(direction.clone().multiplyScalar(shellR)),mesh=new THREE.Mesh(new THREE.SphereGeometry(selected?.115:.09,18,14),new THREE.MeshStandardMaterial({color:hoveredSnap?.atomId===atomId?0xfde68a:selected?0x7dd3fc:0xdbeafe,emissive:hoveredSnap?.atomId===atomId?0xf59e0b:0x0369a1,emissiveIntensity:hoveredSnap?.atomId===atomId?1:selected?.85:.35,roughness:.18}));mesh.position.copy(pos);mesh.userData={electronAtomId:atomId};moleculeGroup.add(mesh);}
function addLonePair(origin,direction,shellR){const center=origin.clone().add(direction.clone().multiplyScalar(shellR)),side=perpendicular(direction).multiplyScalar(.055);for(const sign of[-1,1]){const dot=new THREE.Mesh(new THREE.SphereGeometry(.047,10,8),new THREE.MeshStandardMaterial({color:0x94a3b8,roughness:.4}));dot.position.copy(center).add(side.clone().multiplyScalar(sign));moleculeGroup.add(dot);}}
function electronDirections(count){if(count<=1)return[new THREE.Vector3(1,0,0)];if(count===2)return[new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0)];if(count===3)return[0,1,2].map(i=>new THREE.Vector3(Math.cos(i*Math.PI*2/3),Math.sin(i*Math.PI*2/3),0));return[new THREE.Vector3(1,1,1),new THREE.Vector3(1,-1,-1),new THREE.Vector3(-1,1,-1),new THREE.Vector3(-1,-1,1)].map(v=>v.normalize());}

function addBondMeshes(bond,flash){
  const start=placements.get(bond.a)?.position,end=placements.get(bond.b)?.position;if(!start||!end)return;
  const axis=end.clone().sub(start).normalize(),side=perpendicular(axis),key=bondKey(bond.a,bond.b),damage=bondDamage.get(key)?.damage??0;
  const rotatable=isRotatableBond(bond), offsets=bond.order===1?[0]:bond.order===2?[-.075,.075]:[-.13,0,.13];
  const color=damage>.02?0xfca5a5:bond.order===1?(rotatable?0xb9f3ff:0xd1d5db):bond.order===2?0xf8fafc:0xffffff;
  for(const offset of offsets){
    const shift=side.clone().multiplyScalar(offset),radius=(bond.order===1?.054:.05)*(1-damage*.62),opacity=1-damage*.52;
    const shadow=cylinderBetween(start.clone().add(shift),end.clone().add(shift),Math.max(.018,radius+.024),0x111827,.82);shadow.userData={bondKey:key};moleculeGroup.add(shadow);
    if(damage<.82){const mesh=cylinderBetween(start.clone().add(shift),end.clone().add(shift),Math.max(.012,radius),color,opacity);mesh.userData={bondKey:key};moleculeGroup.add(mesh);}else{const mid=start.clone().lerp(end,.5),leftEnd=start.clone().lerp(mid,.72),rightEnd=end.clone().lerp(mid,.72);for(const seg of[[start,leftEnd],[end,rightEnd]]){const mesh=cylinderBetween(seg[0].clone().add(shift),seg[1].clone().add(shift),Math.max(.01,radius),color,opacity);mesh.userData={bondKey:key};moleculeGroup.add(mesh);}}
  }
  if(rotatable&&damage<.7){const marker=new THREE.Mesh(new THREE.TorusGeometry(.13,.018,9,28),new THREE.MeshBasicMaterial({color:0x67e8f9,transparent:true,opacity:.72,depthTest:false}));marker.position.copy(start).lerp(end,.5);marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis);marker.userData={bondKey:key};moleculeGroup.add(marker);}
  const center=start.clone().lerp(end,.5);for(let pair=0;pair<bond.order;pair++){const lateral=side.clone().multiplyScalar((pair-(bond.order-1)/2)*.11),pairAxis=perpendicular(axis).multiplyScalar(.042);for(const sign of[-1,1]){const dot=new THREE.Mesh(new THREE.SphereGeometry(.05,12,10),new THREE.MeshStandardMaterial({color:damage>.02?0xfecaca:0xe0f2fe,transparent:damage>0,opacity:1-damage*.5,emissive:damage>.02?0x7f1d1d:flash?0x38bdf8:0x1e3a8a,emissiveIntensity:damage>.02?.35+damage*.7:flash?1:.35}));const retreat=(sign<0?start:end).clone().lerp(center,1-damage*.55);dot.position.copy(retreat).add(lateral).add(pairAxis.clone().multiplyScalar(sign));dot.userData={bondKey:key};moleculeGroup.add(dot);}}}
function renderInteraction(){disposeGroup(interactionGroup);if(electronDrag){const start=placements.get(electronDrag.atomId)?.position;if(start)interactionGroup.add(cylinderBetween(start,electronDrag.current,.024,hoveredSnap?0xfacc15:0x38bdf8,.8));}else if(hoveredSnap&&dragState){const a=placements.get(hoveredSnap.a)?.position,b=placements.get(hoveredSnap.b)?.position;if(a&&b)interactionGroup.add(cylinderBetween(a,b,.022,0xfacc15,.55));}}
function cylinderBetween(start,end,radius,color,opacity=1){const delta=end.clone().sub(start),len=Math.max(.001,delta.length()),material=new THREE.MeshStandardMaterial({color,roughness:.38,transparent:opacity<1,opacity}),mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,len,14),material);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;}
function perpendicular(v){const ref=Math.abs(v.y)<.85?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);return new THREE.Vector3().crossVectors(v,ref).normalize();}
function cameraRight(){return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).normalize();}
function cameraUp(){return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1).normalize();}

function applyIdleTorsion(now){if(now-lastInteractionAt<3200||dragState||electronDrag||activePointers.size>0){idleLastTime=now;return;}const dt=Math.min(40,now-idleLastTime);idleLastTime=now;const bonds=molecule.bonds.filter(isRotatableBond).slice(0,4);for(let i=0;i<bonds.length;i++){const bond=bonds[i],sides=cutSides(bond.a,bond.b);if(!sides)continue;const moving=sides.aSide.size<=sides.bSide.size?[...sides.aSide]:[...sides.bSide];rotateBranchAroundBond(bond.a,bond.b,moving,Math.cos(now*.00035+i*1.7)*.00022*dt);}if(bonds.length)renderMolecule();}
function markInteraction(){lastInteractionAt=performance.now();}
function pulse(text){selectionChip.textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(refreshInfo,1800);}
function capture(e){try{renderer.domElement.setPointerCapture(e.pointerId);}catch{}}
function release(e){try{renderer.domElement.releasePointerCapture(e.pointerId);}catch{}}
function setPointer(e){const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;}
function rayToPlane(e){setPointer(e);raycaster.setFromCamera(pointer,camera);const out=new THREE.Vector3();return raycaster.ray.intersectPlane(dragPlane,out)?out:null;}
function rayToPlaneThrough(e,point){const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).normalize(),point);setPointer(e);raycaster.setFromCamera(pointer,camera);const out=new THREE.Vector3();return raycaster.ray.intersectPlane(plane,out)?out:null;}
function disposeGroup(group){while(group.children.length){const child=group.children.pop();child.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material?.dispose?.();});}}
function resize(){const w=Math.max(1,viewer.clientWidth),h=Math.max(1,viewer.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function animate(now=performance.now()){requestAnimationFrame(animate);recoverDamage(now);updateEffects(now);applyIdleTorsion(now);controls.update();renderer.render(scene,camera);}
