import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js/+esm';
import { ELEMENTS, Molecule, countElements } from './chemistry.js';
import {
  ATOMIC_MODEL,
  preferredValence,
  unpairedElectronCount,
  lonePairCount,
  idealBondAngleDeg,
  valenceShellRadius,
  optimizeBondOrders,
  tapsToWeakenBond,
  bondEnergyKJ,
  bondLengthScale,
} from './bonding-model.js';

const molecule = new Molecule();
const placements = new Map();
const bondDamage = new Map();
const atomDamage = new Map();
const activePointers = new Map();
let selectedAtomId = null;
let dragState = null;
let electronDrag = null;
let hoveredSnap = null;
let lastCelebrated = '';
let toastTimer = 0;
let lastInteractionAt = performance.now();
let idleLastTime = performance.now();
let spawnSerial = 0;
let twoFingerGesture = null;
let pivotVisibleUntil = 0;

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
if (THREE.TOUCH?.DOLLY_ROTATE !== undefined) controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
controls.addEventListener('start', markInteraction);

scene.add(new THREE.HemisphereLight(0xffffff, 0x182235, 2.8));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.4); keyLight.position.set(7, 9, 8); scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x8fd3ff, 1.25); rimLight.position.set(-6, -3, 4); scene.add(rimLight);

const moleculeGroup = new THREE.Group();
const interactionGroup = new THREE.Group();
const effectGroup = new THREE.Group();
const pivotGroup = new THREE.Group();
scene.add(moleculeGroup, interactionGroup, effectGroup, pivotGroup);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane();

buildPalette();
bindUI();
refresh();
resize();
animate();

function buildPalette() {
  for (const [symbol, element] of Object.entries(ELEMENTS)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'element-button';
    button.textContent = symbol;
    button.title = `${element.name}を現在の作業位置へ置く`;
    button.style.setProperty('--element-color', element.color);
    button.addEventListener('click', () => addFreeAtom(symbol));
    palette.appendChild(button);
  }
}

function bindUI() {
  document.querySelector('#delete-selected')?.addEventListener('click', () => {
    if (selectedAtomId == null) return;
    atomDamage.set(selectedAtomId, { damage: 0.84, lastHit: performance.now() });
    damageAtom(selectedAtomId);
  });
  document.querySelector('#clear-all')?.addEventListener('click', () => {
    markInteraction();
    molecule.clear(); placements.clear(); bondDamage.clear(); atomDamage.clear();
    selectedAtomId = null; dragState = null; electronDrag = null; hoveredSnap = null; lastCelebrated = '';
    camera.position.set(5.5, 4.3, 8.2); controls.target.set(0, 0, 0); controls.update();
    showPivot(controls.target); refresh();
  });
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('wheel', markInteraction, { passive: true });
  new ResizeObserver(resize).observe(viewer);
}

function addFreeAtom(symbol) {
  markInteraction();
  const atom = molecule.addAtom(symbol);
  const angle = spawnSerial++ * 2.399963;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const r = molecule.atoms.length === 1 ? 0 : 0.62 + 0.12 * Math.sqrt(spawnSerial);
  const position = controls.target.clone()
    .add(right.multiplyScalar(Math.cos(angle) * r))
    .add(up.multiplyScalar(Math.sin(angle) * r * 0.72));
  placements.set(atom.id, { position });
  selectedAtomId = atom.id;
  pulse(`${symbol} を現在の回転中心付近へ配置`);
  refresh();
}

function onPointerDown(e) {
  markInteraction();
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, downAt: performance.now() });
  if (activePointers.size === 2) {
    const pts = [...activePointers.values()];
    twoFingerGesture = {
      startedAt: performance.now(),
      maxMove: 0,
      midpoint: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
    };
    dragState = null; electronDrag = null; hoveredSnap = null; controls.enabled = true;
    return;
  }
  if (activePointers.size > 1) return;

  setPointer(e); raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(moleculeGroup.children, true);
  const bondHit = hits.find(hit => hit.object.userData.bondKey);
  if (bondHit) { damageBond(bondHit.object.userData.bondKey); return; }

  const electronHit = hits.find(hit => hit.object.userData.electronAtomId !== undefined);
  if (electronHit) {
    electronDrag = { atomId: electronHit.object.userData.electronAtomId, current: electronHit.point.clone() };
    selectedAtomId = electronDrag.atomId; controls.enabled = false; capture(e); refresh(); return;
  }

  const atomHit = hits.find(hit => hit.object.userData.atomCore);
  if (!atomHit) { selectedAtomId = null; controls.enabled = true; refreshInfo(); return; }

  const atomId = atomHit.object.userData.atomId;
  selectedAtomId = atomId;
  const torsion = chooseTorsionForAtom(atomId);
  if (torsion) {
    dragState = {
      mode: 'torsion', atomId, bondA: torsion.a, bondB: torsion.b, movingIds: torsion.movingIds,
      startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, downAt: performance.now(), moved: false,
    };
    controls.enabled = false; capture(e); refresh(); return;
  }

  const component = [...connectedComponent(atomId)];
  const normal = camera.getWorldDirection(new THREE.Vector3()).normalize();
  dragPlane.setFromNormalAndCoplanarPoint(normal, placements.get(atomId).position);
  const world = rayToPlane(e); if (!world) return;
  dragState = {
    mode: 'translate', atomId, component, startWorld: world.clone(),
    starts: new Map(component.map(id => [id, placements.get(id).position.clone()])),
    startX: e.clientX, startY: e.clientY, downAt: performance.now(), moved: false,
  };
  controls.enabled = false; capture(e); refresh();
}

function onPointerMove(e) {
  const pstate = activePointers.get(e.pointerId);
  if (pstate) {
    pstate.x = e.clientX; pstate.y = e.clientY;
    const move = Math.hypot(pstate.x - pstate.startX, pstate.y - pstate.startY);
    if (twoFingerGesture) twoFingerGesture.maxMove = Math.max(twoFingerGesture.maxMove, move);
  }
  markInteraction();
  if (activePointers.size > 1) return;

  if (electronDrag) {
    const p = rayToPlaneThrough(e, placements.get(electronDrag.atomId)?.position ?? new THREE.Vector3());
    if (p) electronDrag.current.copy(p);
    hoveredSnap = findElectronTarget(electronDrag.atomId, electronDrag.current); renderInteraction(); return;
  }
  if (!dragState) return;

  const moved = Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY) > 7;
  dragState.moved ||= moved;

  if (dragState.mode === 'torsion') {
    if (!dragState.moved) return;
    const dx = e.clientX - dragState.lastX, dy = e.clientY - dragState.lastY;
    dragState.lastX = e.clientX; dragState.lastY = e.clientY;
    const angle = THREE.MathUtils.clamp((dx - dy * 0.35) * 0.012, -0.12, 0.12);
    rotateBranchAroundBond(dragState.bondA, dragState.bondB, dragState.movingIds, angle);
    hoveredSnap = findAutoBondCandidate(dragState.movingIds, true); renderMolecule(); return;
  }

  if (!dragState.moved) return;
  const world = rayToPlane(e); if (!world) return;
  const delta = world.clone().sub(dragState.startWorld);
  for (const id of dragState.component) placements.get(id).position.copy(dragState.starts.get(id)).add(delta);
  hoveredSnap = findAutoBondCandidate(dragState.component, false); renderMolecule();
}

function onPointerUp(e) {
  markInteraction();
  const before = activePointers.size;
  const pointerState = activePointers.get(e.pointerId);
  activePointers.delete(e.pointerId);

  if (before >= 2) {
    if (twoFingerGesture && performance.now() - twoFingerGesture.startedAt < 330 && twoFingerGesture.maxMove < 16) {
      setOrbitPivotFromScreen(twoFingerGesture.midpoint.x, twoFingerGesture.midpoint.y);
      pulse('2本指タップ位置を回転中心に設定');
    }
    if (activePointers.size === 0) twoFingerGesture = null;
    controls.enabled = true; return;
  }

  if (electronDrag) {
    const target = hoveredSnap ?? findElectronTarget(electronDrag.atomId, electronDrag.current);
    if (target) formBond(electronDrag.atomId, target.atomId, true);
    electronDrag = null; hoveredSnap = null; controls.enabled = true; release(e); refresh(); return;
  }

  if (!dragState) { controls.enabled = true; return; }
  const state = dragState;
  const isTap = !state.moved && pointerState && performance.now() - pointerState.downAt < 330;
  if (isTap) {
    damageAtom(state.atomId);
  } else {
    const moving = state.mode === 'torsion' ? state.movingIds : state.component;
    const candidate = hoveredSnap ?? findAutoBondCandidate(moving, state.mode === 'torsion');
    if (candidate) formBond(candidate.a, candidate.b, false);
    if (state.mode === 'torsion') settleMolecule(22);
  }
  dragState = null; hoveredSnap = null; controls.enabled = true; release(e); refresh();
}

function onPointerCancel(e) {
  activePointers.delete(e.pointerId);
  if (!activePointers.size) twoFingerGesture = null;
  dragState = null; electronDrag = null; hoveredSnap = null; controls.enabled = true; release(e); refresh();
}

function setOrbitPivotFromScreen(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(moleculeGroup.children, true);
  let point = null;
  if (hits.length) point = hits[0].point.clone();
  if (!point) {
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).normalize(), controls.target);
    point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, point)) point.copy(controls.target);
  }
  controls.target.copy(point); controls.update(); showPivot(point);
}

function showPivot(point) {
  disposeGroup(pivotGroup);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.018, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.9, depthTest: false })
  );
  ring.position.copy(point); ring.quaternion.copy(camera.quaternion); pivotGroup.add(ring);
  const h1 = cylinderBetween(point.clone().add(new THREE.Vector3(-0.27,0,0)), point.clone().add(new THREE.Vector3(0.27,0,0)), 0.008, 0x7dd3fc, 0.8);
  const h2 = cylinderBetween(point.clone().add(new THREE.Vector3(0,-0.27,0)), point.clone().add(new THREE.Vector3(0,0.27,0)), 0.008, 0x7dd3fc, 0.8);
  h1.material.depthTest = false; h2.material.depthTest = false; pivotGroup.add(h1,h2);
  pivotVisibleUntil = performance.now() + 900;
}

function chooseTorsionForAtom(atomId) {
  const candidates = [];
  for (const bond of molecule.bonds) {
    if (!isRotatableBond(bond)) continue;
    const sides = cutSides(bond.a, bond.b); if (!sides) continue;
    const inA = sides.aSide.has(atomId), inB = sides.bSide.has(atomId); if (!inA && !inB) continue;
    const movingIds = [...(inA ? sides.aSide : sides.bSide)];
    if (!movingIds.includes(atomId) || movingIds.every(id => atomById(id)?.element === 'H')) continue;
    candidates.push({ a: bond.a, b: bond.b, movingIds, size: movingIds.length });
  }
  candidates.sort((x,y) => x.size - y.size); return candidates[0] ?? null;
}

function isRotatableBond(bond) {
  if (bond.order !== 1) return false;
  const a = atomById(bond.a), b = atomById(bond.b);
  if (!a || !b || a.element === 'H' || b.element === 'H') return false;
  return cutSides(bond.a, bond.b) !== null;
}

function cutSides(a,b) {
  const aSide = bfsIgnoringBond(a,a,b); if (aSide.has(b)) return null;
  const bSide = bfsIgnoringBond(b,a,b); return { aSide, bSide };
}
function bfsIgnoringBond(start, skipA, skipB) {
  const seen = new Set([start]), q = [start];
  while (q.length) {
    const id=q.shift();
    for (const n of molecule.neighbors(id)) {
      if ((id===skipA&&n.atomId===skipB)||(id===skipB&&n.atomId===skipA)) continue;
      if (!seen.has(n.atomId)) { seen.add(n.atomId); q.push(n.atomId); }
    }
  }
  return seen;
}
function rotateBranchAroundBond(a,b,movingIds,angle) {
  const moving = new Set(movingIds), pivotId = moving.has(a)?b:a, movingAnchorId = moving.has(a)?a:b;
  const pivot=placements.get(pivotId)?.position, anchor=placements.get(movingAnchorId)?.position; if(!pivot||!anchor)return;
  const axis=anchor.clone().sub(pivot).normalize();
  for(const id of movingIds){ if(id===movingAnchorId)continue; const p=placements.get(id)?.position;if(!p)continue;p.sub(pivot).applyAxisAngle(axis,angle).add(pivot); }
}

function findAutoBondCandidate(movingIds, allowSameComponent) {
  const movingSet=new Set(movingIds); let best=null;
  for(const a of movingIds){
    if(!canAcceptBond(a))continue;
    for(const atom of molecule.atoms){
      const b=atom.id; if(movingSet.has(b)||!canAcceptBond(b)||bondBetween(a,b))continue;
      if(!allowSameComponent&&connectedComponent(a).has(b))continue;
      if(allowSameComponent&&connectedComponent(a).has(b)&&graphDistance(a,b)<3)continue;
      const d=placements.get(a).position.distanceTo(placements.get(b).position), threshold=bondLengthFor(a,b,1)*1.28;
      if(d<threshold&&(!best||d<best.distance))best={a,b,atomId:b,distance:d};
    }
  }
  return best;
}
function graphDistance(start,goal){const q=[[start,0]],seen=new Set([start]);while(q.length){const[id,d]=q.shift();if(id===goal)return d;for(const n of molecule.neighbors(id))if(!seen.has(n.atomId)){seen.add(n.atomId);q.push([n.atomId,d+1]);}}return Infinity;}
function findElectronTarget(sourceId,point){let best=null;for(const atom of molecule.atoms){if(atom.id===sourceId||!canAcceptBond(atom.id))continue;const d=placements.get(atom.id).position.distanceTo(point);if(d<0.82&&(!best||d<best.distance))best={atomId:atom.id,distance:d};}return best;}
function canAcceptBond(id){const atom=atomById(id);if(!atom)return false;const used=molecule.bondOrderForAtom(id),max=Math.max(...(ATOMIC_MODEL[atom.element]?.preferredValences??[1]));return used<max||molecule.neighbors(id).some(n=>n.order>1);}

function formBond(a,b,directElectronEdit){
  if(a===b)return; const existing=bondBetween(a,b);
  if(existing&&directElectronEdit){if(existing.order<3)existing.order+=1;}else if(!existing)molecule.setBond(a,b,1);else return;
  optimizeBondOrders(molecule,[...connectedComponent(a)]); settleMolecule(88); bondDamage.clear(); selectedAtomId=b;
  const bond=bondBetween(a,b); pulse(bond?.order===3?'電子配置から三重結合へ安定化':bond?.order===2?'電子配置から二重結合へ安定化':'共有電子対ができました');
  if(navigator.vibrate)navigator.vibrate(bond?.order>1?[16,20,24]:18); checkDiscovery();
}

function damageBond(key){
  const[a,b]=key.split(':').map(Number),bond=bondBetween(a,b);if(!bond)return;
  const aa=atomById(a),bb=atomById(b);if(!aa||!bb)return;
  const required=tapsToWeakenBond(aa.element,bb.element,bond.order),now=performance.now();
  const prev=bondDamage.get(key); const recovered=prev?currentDamage(prev,now):0;
  const damage=Math.min(1,recovered+1/required); bondDamage.set(key,{damage,lastHit:now,required});
  moleculeGroup.userData.shakeUntil=now+150;
  const energy=Math.round(bondEnergyKJ(aa.element,bb.element,bond.order));
  if(damage<0.999){pulse(`結合がほどけています ${Math.round(damage*100)}% · 約${energy} kJ/mol`);if(navigator.vibrate)navigator.vibrate(8);refresh();return;}
  bondDamage.delete(key); const oldOrder=bond.order;
  if(oldOrder>1)molecule.setBond(a,b,oldOrder-1);else molecule.removeBond(a,b);
  settleMolecule(48);lastCelebrated='';pulse(oldOrder===3?'π結合が1組ほどけて二重結合へ':oldOrder===2?'π結合がほどけて単結合へ':'結合が切れて分離しました');
  if(navigator.vibrate)navigator.vibrate([18,18,30]);refresh();
}

function damageAtom(id){
  const atom=atomById(id);if(!atom)return;
  const now=performance.now(),required=atomBreakTaps(atom.element),prev=atomDamage.get(id),recovered=prev?currentDamage(prev,now):0;
  const damage=Math.min(1,recovered+1/required);atomDamage.set(id,{damage,lastHit:now,required});selectedAtomId=id;
  if(damage<0.999){pulse(`${atom.element} が崩れています ${Math.round(damage*100)}%`);moleculeGroup.userData.shakeUntil=now+110;if(navigator.vibrate)navigator.vibrate(7);refresh();return;}
  atomDamage.delete(id); const pos=placements.get(id)?.position.clone()??new THREE.Vector3(), color=ELEMENTS[atom.element].color;
  spawnMist(pos,color); molecule.removeAtom(id); placements.delete(id); selectedAtomId=null; lastCelebrated=''; settleMolecule(30);
  pulse(`${atom.element} が霧散しました`); if(navigator.vibrate)navigator.vibrate([12,18,35]); refresh();
}
function atomBreakTaps(element){const v=ATOMIC_MODEL[element]?.valenceElectrons??4;return Math.max(4,Math.min(7,3+Math.round(Math.sqrt(v))));}
function currentDamage(state,now){const grace=520,elapsed=Math.max(0,now-state.lastHit-grace);return Math.max(0,state.damage-elapsed/1600);}

function recoverDamage(now){
  let changed=false;
  for(const[key,state]of[...bondDamage]){const d=currentDamage(state,now);if(d<=0.002){bondDamage.delete(key);changed=true;}else if(Math.abs(d-state.damage)>0.012){state.damage=d;state.lastHit=now-520;changed=true;}}
  for(const[id,state]of[...atomDamage]){const d=currentDamage(state,now);if(d<=0.002){atomDamage.delete(id);changed=true;}else if(Math.abs(d-state.damage)>0.012){state.damage=d;state.lastHit=now-520;changed=true;}}
  if(changed)renderMolecule();
}

function spawnMist(position,color){
  const count=34,positions=new Float32Array(count*3),velocities=[];
  for(let i=0;i<count;i++){positions[i*3]=position.x;positions[i*3+1]=position.y;positions[i*3+2]=position.z;const v=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize().multiplyScalar(.35+Math.random()*.65);velocities.push(v);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const material=new THREE.PointsMaterial({color,size:.075,transparent:true,opacity:.9,depthWrite:false});
  const points=new THREE.Points(geometry,material);points.userData={born:performance.now(),velocities};effectGroup.add(points);
}
function updateEffects(now){
  for(const obj of [...effectGroup.children]){const age=(now-obj.userData.born)/1000;if(age>1.35){effectGroup.remove(obj);obj.geometry.dispose();obj.material.dispose();continue;}const attr=obj.geometry.attributes.position;for(let i=0;i<attr.count;i++){const v=obj.userData.velocities[i];attr.array[i*3]+=v.x*.016;attr.array[i*3+1]+=v.y*.016;attr.array[i*3+2]+=v.z*.016;v.multiplyScalar(.986);}attr.needsUpdate=true;obj.material.opacity=Math.max(0,.9*(1-age/1.35));obj.material.size=.075+age*.035;}
}

function settleMolecule(iterations=60){
  for(let step=0;step<iterations;step++){
    for(const bond of molecule.bonds){const pa=placements.get(bond.a)?.position,pb=placements.get(bond.b)?.position;if(!pa||!pb)continue;const delta=pb.clone().sub(pa),dist=Math.max(.001,delta.length()),target=bondLengthFor(bond.a,bond.b,bond.order),correction=delta.normalize().multiplyScalar((dist-target)*.20);pa.add(correction.clone().multiplyScalar(.5));pb.sub(correction.clone().multiplyScalar(.5));}
    for(const center of molecule.atoms){const neighbors=molecule.neighbors(center.id).map(n=>n.atomId);if(neighbors.length<2)continue;const c=placements.get(center.id)?.position;if(!c)continue;const used=molecule.bondOrderForAtom(center.id),angle=THREE.MathUtils.degToRad(idealBondAngleDeg(center.element,used,neighbors.length));if(neighbors.length===2)enforceTwoNeighborAngle(c,neighbors[0],neighbors[1],angle);else relaxMultiNeighborAngles(c,neighbors,Math.cos(angle));}
  }
}
function enforceTwoNeighborAngle(center,aId,bId,targetAngle){const pa=placements.get(aId)?.position,pb=placements.get(bId)?.position;if(!pa||!pb)return;const va=pa.clone().sub(center),vb=pb.clone().sub(center),la=va.length(),lb=vb.length();if(la<.001||lb<.001)return;va.normalize();vb.normalize();const current=Math.acos(THREE.MathUtils.clamp(va.dot(vb),-1,1)),diff=targetAngle-current;if(Math.abs(diff)<.002)return;let axis=new THREE.Vector3().crossVectors(va,vb);if(axis.lengthSq()<1e-6)axis=perpendicular(va);else axis.normalize();va.applyAxisAngle(axis,-diff*.18);vb.applyAxisAngle(axis,diff*.18);pa.lerp(center.clone().add(va.multiplyScalar(la)),.36);pb.lerp(center.clone().add(vb.multiplyScalar(lb)),.36);}
function relaxMultiNeighborAngles(center,ids,targetCos){for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const pi=placements.get(ids[i])?.position,pj=placements.get(ids[j])?.position;if(!pi||!pj)continue;const vi=pi.clone().sub(center).normalize(),vj=pj.clone().sub(center).normalize(),err=vi.dot(vj)-targetCos;if(Math.abs(err)<.012)continue;const ti=vj.clone().sub(vi.clone().multiplyScalar(vi.dot(vj))),tj=vi.clone().sub(vj.clone().multiplyScalar(vj.dot(vi)));if(ti.lengthSq()>1e-6)pi.add(ti.normalize().multiplyScalar(-err*.075));if(tj.lengthSq()>1e-6)pj.add(tj.normalize().multiplyScalar(-err*.075));}}
function bondLengthFor(a,b,order){const aa=atomById(a),bb=atomById(b),ra=ATOMIC_MODEL[aa?.element]?.covalentRadius??.75,rb=ATOMIC_MODEL[bb?.element]?.covalentRadius??.75;return(ra+rb)*.78*bondLengthScale(order);}
function connectedComponent(start){const seen=new Set([start]),q=[start];while(q.length){const id=q.shift();for(const n of molecule.neighbors(id))if(!seen.has(n.atomId)){seen.add(n.atomId);q.push(n.atomId);}}return seen;}
function atomById(id){return molecule.atoms.find(a=>a.id===id);}function bondBetween(a,b){return molecule.bonds.find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));}function bondKey(a,b){return`${Math.min(a,b)}:${Math.max(a,b)}`;}

function checkDiscovery(){const name=molecule.recognizedName(),formula=molecule.formula();const allSatisfied=molecule.atoms.length>1&&molecule.atoms.every(atom=>(ATOMIC_MODEL[atom.element]?.preferredValences??[]).includes(molecule.bondOrderForAtom(atom.id)));const signature=`${formula}|${name}|${molecule.bonds.map(b=>`${bondKey(b.a,b.b)}=${b.order}`).sort().join(',')}`;if(!allSatisfied||!name||name==='自由制作'||name==='未知 / 未登録の構造'||signature===lastCelebrated)return;lastCelebrated=signature;discoveryFormula.textContent=formula;discoveryName.textContent=name;discovery.classList.remove('show');void discovery.offsetWidth;discovery.classList.add('show');moleculeGroup.userData.flashUntil=performance.now()+950;if(navigator.vibrate)navigator.vibrate([25,35,55]);}
function refresh(){renderMolecule();refreshInfo();checkDiscovery();}
function refreshInfo(){formulaEl.textContent=molecule.formula();nameEl.textContent=molecule.recognizedName();const validation=molecule.validation();statusEl.className=`status ${validation.level}`;statusEl.textContent=validation.message;const counts=countElements(molecule.atoms);countsEl.replaceChildren();if(!molecule.atoms.length)countsEl.textContent='—';else for(const symbol of Object.keys(counts).sort()){const span=document.createElement('span');span.className='atom-count';span.textContent=`${symbol} × ${counts[symbol]}`;countsEl.appendChild(span);}const selected=atomById(selectedAtomId);if(!selected){selectedElementEl.textContent='—';selectedValenceEl.textContent='—';selectedLimitEl.textContent='—';selectionChip.textContent=molecule.atoms.length?'2本指タップで回転中心を変更 · 新原子はその周辺へ':'元素を押して原子を置く';return;}const used=molecule.bondOrderForAtom(selected.id),singles=unpairedElectronCount(selected.element,used),pairs=lonePairCount(selected.element,used);selectedElementEl.textContent=`${selected.element} / ${ELEMENTS[selected.element].name}`;selectedValenceEl.textContent=`${used} / 目標 ${preferredValence(selected.element,used)}`;selectedLimitEl.textContent=`不対電子 ${singles} · 非共有電子対 ${pairs}`;selectionChip.textContent='原子・結合を連打で破壊 · 中断すると回復';}

function renderMolecule(){
  disposeGroup(moleculeGroup);const now=performance.now(),flash=now<(moleculeGroup.userData.flashUntil||0),shake=now<(moleculeGroup.userData.shakeUntil||0);moleculeGroup.position.set(shake?Math.sin(now*.12)*.025:0,0,0);
  for(const bond of molecule.bonds)addBondMeshes(bond,flash);
  for(const atom of molecule.atoms)renderAtom(atom,flash);
  renderInteraction();
}
function renderAtom(atom,flash){
  const p=placements.get(atom.id);if(!p)return;const cfg=ELEMENTS[atom.element],selected=atom.id===selectedAtomId,damage=atomDamage.get(atom.id)?.damage??0;
  const core=new THREE.Mesh(new THREE.SphereGeometry(cfg.radius*1.06*(1-damage*.10),32,24),new THREE.MeshStandardMaterial({color:cfg.color,roughness:.22,metalness:.03,transparent:damage>0,opacity:1-damage*.58,emissive:damage>.05?0x7f1d1d:flash?0x38bdf8:selected?0x075985:0,emissiveIntensity:damage>.05?.25+damage*.85:flash?.72:selected?.42:0}));
  core.position.copy(p.position);core.userData={atomCore:true,atomId:atom.id};moleculeGroup.add(core);
  if(damage>.04)addAtomCracks(p.position,cfg.radius*1.08,damage);
  const used=molecule.bondOrderForAtom(atom.id),singles=unpairedElectronCount(atom.element,used),lps=lonePairCount(atom.element,used),total=Math.max(1,singles+lps+molecule.neighbors(atom.id).length),dirs=electronDirections(total),shellR=valenceShellRadius(atom.element,cfg.radius*1.02);
  for(let i=0;i<singles;i++)addElectron(atom.id,p.position,dirs[i%dirs.length],shellR,selected);
  for(let i=0;i<lps;i++)addLonePair(p.position,dirs[(singles+i)%dirs.length],shellR);
}
function addAtomCracks(origin,radius,damage){
  const mat=new THREE.LineBasicMaterial({color:0xfca5a5,transparent:true,opacity:.18+.72*damage,depthTest:false});
  const count=2+Math.floor(damage*5);
  for(let i=0;i<count;i++){const dir=new THREE.Vector3(Math.sin(i*2.31+.7),Math.cos(i*1.73+.4),Math.sin(i*.91+1.1)).normalize();const side=perpendicular(dir);const pts=[origin.clone().add(dir.clone().multiplyScalar(radius*.82)),origin.clone().add(dir.clone().multiplyScalar(radius*1.01)).add(side.clone().multiplyScalar(.08)),origin.clone().add(dir.clone().multiplyScalar(radius*.96)).add(side.clone().multiplyScalar(-.07))];const g=new THREE.BufferGeometry().setFromPoints(pts);moleculeGroup.add(new THREE.Line(g,mat.clone()));}
  const flecks=Math.floor(damage*8);for(let i=0;i<flecks;i++){const d=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize();const s=new THREE.Mesh(new THREE.SphereGeometry(.018+.012*Math.random(),6,4),new THREE.MeshBasicMaterial({color:0xfca5a5,transparent:true,opacity:.4+.5*damage}));s.position.copy(origin).add(d.multiplyScalar(radius*(1.08+Math.random()*.35)));moleculeGroup.add(s);}
}
function addElectron(atomId,origin,direction,shellR,selected){const pos=origin.clone().add(direction.clone().multiplyScalar(shellR));const mesh=new THREE.Mesh(new THREE.SphereGeometry(selected?.115:.09,18,14),new THREE.MeshStandardMaterial({color:hoveredSnap?.atomId===atomId?0xfde68a:selected?0x7dd3fc:0xdbeafe,emissive:hoveredSnap?.atomId===atomId?0xf59e0b:0x0369a1,emissiveIntensity:hoveredSnap?.atomId===atomId?1:selected?.85:.35,roughness:.18}));mesh.position.copy(pos);mesh.userData={electronAtomId:atomId};moleculeGroup.add(mesh);}
function addLonePair(origin,direction,shellR){const center=origin.clone().add(direction.clone().multiplyScalar(shellR)),side=perpendicular(direction).multiplyScalar(.055);for(const sign of[-1,1]){const dot=new THREE.Mesh(new THREE.SphereGeometry(.047,10,8),new THREE.MeshStandardMaterial({color:0x94a3b8,roughness:.4}));dot.position.copy(center).add(side.clone().multiplyScalar(sign));moleculeGroup.add(dot);}}
function electronDirections(count){if(count<=1)return[new THREE.Vector3(1,0,0)];if(count===2)return[new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0)];if(count===3)return[0,1,2].map(i=>new THREE.Vector3(Math.cos(i*Math.PI*2/3),Math.sin(i*Math.PI*2/3),0));return[new THREE.Vector3(1,1,1),new THREE.Vector3(1,-1,-1),new THREE.Vector3(-1,1,-1),new THREE.Vector3(-1,-1,1)].map(v=>v.normalize());}

function addBondMeshes(bond,flash){
  const start=placements.get(bond.a)?.position,end=placements.get(bond.b)?.position;if(!start||!end)return;const axis=end.clone().sub(start).normalize(),side=perpendicular(axis),key=bondKey(bond.a,bond.b),damage=bondDamage.get(key)?.damage??0;
  const offsets=bond.order===1?[0]:bond.order===2?[-.07,.07]:[-.115,0,.115];
  const gap=damage*.23;const innerStart=start.clone().lerp(end,.5-gap),innerEnd=end.clone().lerp(start,.5-gap);
  for(const offset of offsets){const shift=side.clone().multiplyScalar(offset);const radius=.045*(1-damage*.62);const color=damage>.02?0xfca5a5:flash?0x7dd3fc:0xcbd5e1;const opacity=1-damage*.52;if(damage<.86){const mesh=cylinderBetween(innerStart.clone().add(shift),innerEnd.clone().add(shift),Math.max(.012,radius),color,opacity);mesh.userData={bondKey:key};moleculeGroup.add(mesh);}else{const mid=start.clone().lerp(end,.5);for(const segment of[[start,mid.clone().lerp(start,.18)],[end,mid.clone().lerp(end,.18)]]){const mesh=cylinderBetween(segment[0].clone().add(shift),segment[1].clone().add(shift),Math.max(.01,radius),color,opacity);mesh.userData={bondKey:key};moleculeGroup.add(mesh);}}}
  const center=start.clone().lerp(end,.5);
  for(let pair=0;pair<bond.order;pair++){const lateral=side.clone().multiplyScalar((pair-(bond.order-1)/2)*.11),pairAxis=perpendicular(axis).multiplyScalar(.042);for(const sign of[-1,1]){const dot=new THREE.Mesh(new THREE.SphereGeometry(.05,12,10),new THREE.MeshStandardMaterial({color:damage>.02?0xfecaca:0xe0f2fe,transparent:damage>0,opacity:1-damage*.5,emissive:damage>.02?0x7f1d1d:flash?0x38bdf8:0x1e3a8a,emissiveIntensity:damage>.02?.35+damage*.7:flash?1:.35}));const retreat=(sign<0?start:end).clone().lerp(center,1-damage*.55);dot.position.copy(retreat).add(lateral).add(pairAxis.clone().multiplyScalar(sign));dot.userData={bondKey:key};moleculeGroup.add(dot);}}
}

function renderInteraction(){disposeGroup(interactionGroup);if(electronDrag){const start=placements.get(electronDrag.atomId)?.position;if(!start)return;interactionGroup.add(cylinderBetween(start,electronDrag.current,.024,hoveredSnap?0xfacc15:0x38bdf8,.8));}else if(hoveredSnap&&dragState){const a=placements.get(hoveredSnap.a)?.position,b=placements.get(hoveredSnap.b)?.position;if(a&&b)interactionGroup.add(cylinderBetween(a,b,.022,0xfacc15,.55));}}
function cylinderBetween(start,end,radius,color,opacity=1){const delta=end.clone().sub(start),len=Math.max(.001,delta.length());const material=new THREE.MeshStandardMaterial({color,roughness:.38,transparent:opacity<1,opacity});const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,len,14),material);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;}
function perpendicular(v){const ref=Math.abs(v.y)<.85?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);return new THREE.Vector3().crossVectors(v,ref).normalize();}

function applyIdleTorsion(now){if(now-lastInteractionAt<3200||dragState||electronDrag||activePointers.size>0){idleLastTime=now;return;}const dt=Math.min(40,now-idleLastTime);idleLastTime=now;const bonds=molecule.bonds.filter(isRotatableBond).slice(0,4);for(let i=0;i<bonds.length;i++){const bond=bonds[i],sides=cutSides(bond.a,bond.b);if(!sides)continue;const moving=sides.aSide.size<=sides.bSide.size?[...sides.aSide]:[...sides.bSide],phase=now*.00035+i*1.7;rotateBranchAroundBond(bond.a,bond.b,moving,Math.cos(phase)*.00022*dt);}if(bonds.length)renderMolecule();}
function markInteraction(){lastInteractionAt=performance.now();}
function pulse(text){selectionChip.textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(refreshInfo,1800);}
function capture(e){try{renderer.domElement.setPointerCapture(e.pointerId);}catch{}}
function release(e){try{renderer.domElement.releasePointerCapture(e.pointerId);}catch{}}
function setPointer(e){const rect=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;}
function rayToPlane(e){setPointer(e);raycaster.setFromCamera(pointer,camera);const out=new THREE.Vector3();return raycaster.ray.intersectPlane(dragPlane,out)?out:null;}
function rayToPlaneThrough(e,point){const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).normalize(),point);setPointer(e);raycaster.setFromCamera(pointer,camera);const out=new THREE.Vector3();return raycaster.ray.intersectPlane(plane,out)?out:null;}
function disposeGroup(group){while(group.children.length){const child=group.children.pop();child.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material?.dispose?.();});}}
function resize(){const width=Math.max(1,viewer.clientWidth),height=Math.max(1,viewer.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
function animate(now=performance.now()){requestAnimationFrame(animate);recoverDamage(now);updateEffects(now);applyIdleTorsion(now);if(pivotGroup.children.length&&now>pivotVisibleUntil)disposeGroup(pivotGroup);controls.update();renderer.render(scene,camera);}
