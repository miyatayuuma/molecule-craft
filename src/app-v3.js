import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js/+esm';
import { ELEMENTS, Molecule, countElements } from './chemistry.js';

const molecule = new Molecule();
const placements = new Map();
let selectedAtomId = null;
let dragState = null;
let electronDrag = null;
let lastTap = { atomId: null, time: 0 };

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
controls.minDistance = 1.6;
controls.maxDistance = 28;

scene.add(new THREE.HemisphereLight(0xffffff, 0x182235, 2.8));
const key = new THREE.DirectionalLight(0xffffff, 3.4); key.position.set(7, 9, 8); scene.add(key);
const rim = new THREE.DirectionalLight(0x8fd3ff, 1.25); rim.position.set(-6, -3, 4); scene.add(rim);

const moleculeGroup = new THREE.Group();
const interactionGroup = new THREE.Group();
scene.add(moleculeGroup, interactionGroup);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const tmpVec = new THREE.Vector3();

const tetra = [
  new THREE.Vector3(1, 1, 1).normalize(), new THREE.Vector3(1, -1, -1).normalize(),
  new THREE.Vector3(-1, 1, -1).normalize(), new THREE.Vector3(-1, -1, 1).normalize(),
];
const trigonal = [0,1,2].map(i => new THREE.Vector3(Math.cos(i*Math.PI*2/3), Math.sin(i*Math.PI*2/3), 0));
const electronModels = {
  H:  { singles:[new THREE.Vector3(1,0,0)], lonePairs:[] },
  C:  { singles:tetra.map(v=>v.clone()), lonePairs:[] },
  N:  { singles:tetra.slice(0,3).map(v=>v.clone()), lonePairs:[tetra[3].clone()] },
  O:  { singles:[tetra[0].clone(),tetra[1].clone()], lonePairs:[tetra[2].clone(),tetra[3].clone()] },
  F:  { singles:[tetra[0].clone()], lonePairs:tetra.slice(1).map(v=>v.clone()) },
  P:  { singles:tetra.slice(0,3).map(v=>v.clone()), lonePairs:[tetra[3].clone()] },
  S:  { singles:[tetra[0].clone(),tetra[1].clone()], lonePairs:[tetra[2].clone(),tetra[3].clone()] },
  Cl: { singles:[tetra[0].clone()], lonePairs:tetra.slice(1).map(v=>v.clone()) },
};

buildPalette();
bindUI();
refresh();
resize();
animate();

function buildPalette(){
  for(const [symbol, element] of Object.entries(ELEMENTS)){
    const b=document.createElement('button'); b.type='button'; b.className='element-button'; b.textContent=symbol;
    b.title=`${element.name}を置く`; b.style.setProperty('--element-color', element.color);
    b.addEventListener('click',()=>addFreeAtom(symbol)); palette.appendChild(b);
  }
}

function bindUI(){
  document.querySelector('#delete-selected')?.addEventListener('click',()=>{
    if(selectedAtomId==null)return; const id=selectedAtomId; molecule.removeAtom(id); placements.delete(id);
    for(const p of placements.values()) for(const [slot,r] of [...p.used]) if(r.otherAtomId===id) p.used.delete(slot);
    selectedAtomId=null; refresh();
  });
  document.querySelector('#clear-all')?.addEventListener('click',()=>{
    molecule.clear(); placements.clear(); selectedAtomId=null; electronDrag=null; dragState=null;
    camera.position.set(5.5,4.3,8.2); controls.target.set(0,0,0); controls.update(); refresh();
  });

  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',onPointerDown);
  canvas.addEventListener('pointermove',onPointerMove);
  canvas.addEventListener('pointerup',onPointerUp);
  canvas.addEventListener('pointercancel',cancelInteraction);
  new ResizeObserver(resize).observe(viewer);
}

function addFreeAtom(symbol){
  const atom=molecule.addAtom(symbol);
  const n=molecule.atoms.length-1, angle=n*2.399963, radius=Math.min(4.5,1.2+0.32*Math.sqrt(n));
  placements.set(atom.id,{position:new THREE.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius*0.65,0),quaternion:new THREE.Quaternion(),used:new Map()});
  selectedAtomId=atom.id; refresh();
}

function onPointerDown(e){
  setPointer(e); raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(moleculeGroup.children,true);
  const electronHit=hits.find(h=>h.object.userData.electronSlot!==undefined);
  if(electronHit){
    const {atomId,electronSlot}=electronHit.object.userData;
    if(isSlotFree(atomId,electronSlot)){
      electronDrag={atomId,slot:electronSlot,start:getElectronWorld(atomId,electronSlot),current:getElectronWorld(atomId,electronSlot)};
      controls.enabled=false; canvasCapture(e); refresh(); return;
    }
  }
  const atomHit=hits.find(h=>h.object.userData.atomCore===true);
  if(atomHit){
    const atomId=atomHit.object.userData.atomId; selectedAtomId=atomId;
    const now=performance.now();
    if(lastTap.atomId===atomId && now-lastTap.time<330){ focusAtom(atomId); lastTap={atomId:null,time:0}; refresh(); return; }
    lastTap={atomId,time:now};
    const p=placements.get(atomId); if(!p)return;
    const normal=camera.getWorldDirection(new THREE.Vector3()).normalize(); dragPlane.setFromNormalAndCoplanarPoint(normal,p.position);
    const world=rayToPlane(e); if(world){dragState={atomId,offset:p.position.clone().sub(world),moved:false,startX:e.clientX,startY:e.clientY}; controls.enabled=false; canvasCapture(e);}
    refresh(); return;
  }
  selectedAtomId=null; refreshInfo();
}

function onPointerMove(e){
  if(electronDrag){
    const hit=rayToPlaneThrough(e,electronDrag.start); if(hit) electronDrag.current.copy(hit); renderInteraction(); return;
  }
  if(dragState){
    const world=rayToPlane(e); if(!world)return;
    const p=placements.get(dragState.atomId); if(!p)return;
    p.position.copy(world.add(dragState.offset));
    if(Math.hypot(e.clientX-dragState.startX,e.clientY-dragState.startY)>4) dragState.moved=true;
    renderMolecule(); return;
  }
}

function onPointerUp(e){
  if(electronDrag){
    setPointer(e); raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(moleculeGroup.children,true);
    const target=hits.find(h=>h.object.userData.electronSlot!==undefined && h.object.userData.atomId!==electronDrag.atomId && isSlotFree(h.object.userData.atomId,h.object.userData.electronSlot));
    if(target) connectElectrons(electronDrag.atomId,electronDrag.slot,target.object.userData.atomId,target.object.userData.electronSlot);
    electronDrag=null; controls.enabled=true; releaseCapture(e); refresh(); return;
  }
  if(dragState){ dragState=null; controls.enabled=true; releaseCapture(e); refresh(); }
}

function cancelInteraction(e){electronDrag=null;dragState=null;controls.enabled=true;releaseCapture(e);refresh();}
function canvasCapture(e){try{renderer.domElement.setPointerCapture(e.pointerId)}catch{}}
function releaseCapture(e){try{renderer.domElement.releasePointerCapture(e.pointerId)}catch{}}

function connectElectrons(a,slotA,b,slotB){
  if(a===b)return;
  const pa=placements.get(a), pb=placements.get(b); if(!pa||!pb)return;
  const existing=molecule.bonds.find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));
  const nextOrder=existing?existing.order+1:1;
  if(nextOrder>3){pulse('三重結合が上限です');return;}
  const atomA=molecule.atoms.find(x=>x.id===a), atomB=molecule.atoms.find(x=>x.id===b);
  if(!atomA||!atomB)return;
  if(molecule.bondOrderForAtom(a)+1>Math.max(...ELEMENTS[atomA.element].valences) || molecule.bondOrderForAtom(b)+1>Math.max(...ELEMENTS[atomB.element].valences)){
    pulse('この結合では典型原子価を超えます'); return;
  }
  molecule.setBond(a,b,nextOrder);
  pa.used.set(slotA,{otherAtomId:b,bondOrder:nextOrder}); pb.used.set(slotB,{otherAtomId:a,bondOrder:nextOrder});
  snapBondGeometry(a,b,slotA,slotB,nextOrder);
  selectedAtomId=b;
  pulse(nextOrder===1?'共有電子対ができました':nextOrder===2?'二重結合になりました':'三重結合になりました');
  if(navigator.vibrate) navigator.vibrate(nextOrder===1?20:[18,25,18]);
}

function snapBondGeometry(a,b,slotA,slotB,order){
  const pa=placements.get(a),pb=placements.get(b), aa=molecule.atoms.find(x=>x.id===a),ab=molecule.atoms.find(x=>x.id===b); if(!pa||!pb||!aa||!ab)return;
  const dir=getSlotDirection(a,slotA); const targetDist=bondLength(aa.element,ab.element,order);
  const desired=pa.position.clone().add(dir.multiplyScalar(targetDist));
  pb.position.lerp(desired,0.88);
  const childLocal=electronModels[ab.element].singles[slotB]?.clone(); if(childLocal){
    const toward=pa.position.clone().sub(pb.position).normalize(); pb.quaternion.setFromUnitVectors(childLocal.normalize(),toward);
  }
}

function renderMolecule(){
  disposeGroup(moleculeGroup);
  for(const bond of molecule.bonds){const a=placements.get(bond.a)?.position,b=placements.get(bond.b)?.position;if(a&&b)addBondMeshes(a,b,bond.order,bond.a,bond.b);}
  for(const atom of molecule.atoms){const p=placements.get(atom.id);if(p)renderAtom(atom,p);}
  renderInteraction();
}

function renderAtom(atom,p){
  const cfg=ELEMENTS[atom.element], model=electronModels[atom.element]??electronModels.H, selected=atom.id===selectedAtomId;
  const core=new THREE.Mesh(new THREE.SphereGeometry(cfg.radius,32,24),new THREE.MeshStandardMaterial({color:cfg.color,roughness:.22,metalness:.03,emissive:selected?0x075985:0,emissiveIntensity:selected?.42:0}));
  core.position.copy(p.position); core.userData={atomCore:true,atomId:atom.id}; moleculeGroup.add(core);
  model.singles.forEach((local,i)=>{ if(p.used.has(i)) return; const dir=local.clone().applyQuaternion(p.quaternion).normalize(); addSingleElectron(atom,p.position,dir,i,selected); });
  model.lonePairs.forEach(local=>addLonePair(p.position,local.clone().applyQuaternion(p.quaternion).normalize(),cfg.radius));
}

function addSingleElectron(atom,origin,dir,slot,selected){
  const r=ELEMENTS[atom.element].radius; const stalkStart=origin.clone().add(dir.clone().multiplyScalar(r*.78)); const electronPos=origin.clone().add(dir.clone().multiplyScalar(r+.43));
  const stalk=cylinderBetween(stalkStart,electronPos,.025,selected?0x64748b:0x475569,.48); moleculeGroup.add(stalk);
  const halo=new THREE.Mesh(new THREE.SphereGeometry(selected?.125:.105,18,14),new THREE.MeshStandardMaterial({color:selected?0x7dd3fc:0xdbeafe,emissive:selected?0x0284c7:0x1e3a8a,emissiveIntensity:selected?.9:.4,roughness:.18}));
  halo.position.copy(electronPos); halo.userData={electronSlot:slot,atomId:atom.id}; moleculeGroup.add(halo);
}

function addLonePair(origin,dir,r){
  const center=origin.clone().add(dir.clone().multiplyScalar(r+.3)); const side=perpendicular(dir).multiplyScalar(.065);
  for(const s of [-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(.052,12,10),new THREE.MeshStandardMaterial({color:0x94a3b8,emissive:0x334155,emissiveIntensity:.35}));e.position.copy(center).add(side.clone().multiplyScalar(s));moleculeGroup.add(e);}
}

function addBondMeshes(start,end,order,aId,bId){
  const axis=end.clone().sub(start).normalize(), side=perpendicular(axis); const offsets=order===1?[0]:order===2?[-.095,.095]:[-.155,0,.155];
  offsets.forEach(off=>{const shift=side.clone().multiplyScalar(off);const mesh=cylinderBetween(start.clone().add(shift),end.clone().add(shift),.055,0xcbd5e1,1);mesh.userData={bond:true,aId,bId};moleculeGroup.add(mesh);});
  for(let i=0;i<order;i++){const t=(i+1)/(order+1);const pairCenter=start.clone().lerp(end,t).add(side.clone().multiplyScalar((i-(order-1)/2)*.12));const pside=perpendicular(axis).multiplyScalar(.045);for(const s of [-1,1]){const dot=new THREE.Mesh(new THREE.SphereGeometry(.035,10,8),new THREE.MeshBasicMaterial({color:0xe0f2fe}));dot.position.copy(pairCenter).add(pside.clone().multiplyScalar(s));moleculeGroup.add(dot);}}
}

function renderInteraction(){
  disposeGroup(interactionGroup); if(!electronDrag)return;
  const a=electronDrag.start,b=electronDrag.current;
  interactionGroup.add(cylinderBetween(a,b,.028,0x38bdf8,.75));
  const end=new THREE.Mesh(new THREE.SphereGeometry(.075,14,10),new THREE.MeshBasicMaterial({color:0x7dd3fc}));end.position.copy(b);interactionGroup.add(end);
}

function isSlotFree(atomId,slot){return !placements.get(atomId)?.used.has(slot);}
function getSlotDirection(atomId,slot){const atom=molecule.atoms.find(x=>x.id===atomId),p=placements.get(atomId);return (electronModels[atom?.element]?.singles[slot]??new THREE.Vector3(1,0,0)).clone().applyQuaternion(p?.quaternion??new THREE.Quaternion()).normalize();}
function getElectronWorld(atomId,slot){const atom=molecule.atoms.find(x=>x.id===atomId),p=placements.get(atomId);if(!atom||!p)return new THREE.Vector3();return p.position.clone().add(getSlotDirection(atomId,slot).multiplyScalar(ELEMENTS[atom.element].radius+.43));}

function focusAtom(id){
  const p=placements.get(id);if(!p)return; const currentTarget=controls.target.clone(); const delta=p.position.clone().sub(currentTarget); controls.target.copy(p.position); camera.position.add(delta);
  const dir=camera.position.clone().sub(p.position).normalize(); camera.position.copy(p.position).add(dir.multiplyScalar(2.4)); controls.update(); pulse('電子をつまんで別の電子へドラッグ');
}

function refresh(){renderMolecule();refreshInfo();}
function refreshInfo(){
  formulaEl.textContent=molecule.formula(); nameEl.textContent=molecule.recognizedName(); const v=molecule.validation(); statusEl.className=`status ${v.level}`; statusEl.textContent=v.message;
  const counts=countElements(molecule.atoms);countsEl.replaceChildren(); if(!molecule.atoms.length)countsEl.textContent='—';else Object.keys(counts).sort().forEach(s=>{const x=document.createElement('span');x.className='atom-count';x.textContent=`${s} × ${counts[s]}`;countsEl.appendChild(x);});
  const atom=molecule.atoms.find(x=>x.id===selectedAtomId); if(!atom){selectedElementEl.textContent='—';selectedValenceEl.textContent='—';selectedLimitEl.textContent='—';selectionChip.textContent=molecule.atoms.length?'原子はドラッグで移動。電子を別の電子へドラッグして結合':'元素を押して原子を置く';return;}
  const model=electronModels[atom.element];selectedElementEl.textContent=`${atom.element} / ${ELEMENTS[atom.element].name}`;selectedValenceEl.textContent=String(molecule.bondOrderForAtom(atom.id));selectedLimitEl.textContent=`不対電子 ${model.singles.length} / 孤立電子対 ${model.lonePairs.length}`;
  selectionChip.textContent=`${atom.element}: ドラッグで移動 / ダブルタップで電子へズーム`;
}
function pulse(text){selectionChip.textContent=text; selectionChip.classList.remove('pulse'); void selectionChip.offsetWidth; selectionChip.classList.add('pulse');}

function setPointer(e){const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;}
function rayToPlane(e){setPointer(e);raycaster.setFromCamera(pointer,camera);return raycaster.ray.intersectPlane(dragPlane,tmpVec)?tmpVec.clone():null;}
function rayToPlaneThrough(e,point){const normal=camera.getWorldDirection(new THREE.Vector3()).normalize(),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,point);setPointer(e);raycaster.setFromCamera(pointer,camera);return raycaster.ray.intersectPlane(plane,tmpVec)?tmpVec.clone():null;}
function bondLength(a,b,order){const base=1.1+(ELEMENTS[a]?.radius??.45)+(ELEMENTS[b]?.radius??.45);return order===2?base*.92:order===3?base*.87:base;}
function perpendicular(d){const c=Math.abs(d.y)<.85?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);return new THREE.Vector3().crossVectors(d,c).normalize();}
function cylinderBetween(a,b,r,color,opacity=1){const d=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,Math.max(.01,d.length()),12),new THREE.MeshStandardMaterial({color,roughness:.38,transparent:opacity<1,opacity}));m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());return m;}
function disposeGroup(g){while(g.children.length){const c=g.children.pop();c.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material?.dispose?.();});}}
function resize(){const w=Math.max(1,viewer.clientWidth),h=Math.max(1,viewer.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}
