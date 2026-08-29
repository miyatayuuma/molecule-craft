import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ELEMENTS, Molecule, countElements } from './chemistry.js';
import { ATOMIC_MODEL, preferredValence, unpairedElectronCount, lonePairCount, valenceShellRadius, bondLengthScale } from './bonding-model.js';

const molecule = new Molecule();
const placements = new Map();
const activePointers = new Map();
const bondTapState = new Map();
let selectedAtomId = null;
let activeTorsionKey = null;
let dragState = null;
let multiGesture = null;
let bondHoldTimer = null;
let bondHoldInterval = null;
let hoverTargetId = null;
let lastCelebrated = '';

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
const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
camera.position.set(5.2, 4.0, 7.6);
const cameraTarget = new THREE.Vector3();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.touchAction = 'none';
viewer.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff, 0x172033, 2.7));
const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(6, 8, 8); scene.add(key);
const rim = new THREE.DirectionalLight(0x7dd3fc, 1.0); rim.position.set(-5, 1, 4); scene.add(rim);
const moleculeGroup = new THREE.Group(); scene.add(moleculeGroup);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

bindPalette();
bindUI();
refresh();
resize();
animate();

function bindPalette() {
  if (!palette) return;
  for (const b of palette.querySelectorAll('[data-element]')) {
    const symbol = b.dataset.element;
    if (ELEMENTS[symbol]) b.style.setProperty('--element-color', ELEMENTS[symbol].color);
    b.addEventListener('click', () => addElement(symbol));
  }
}

function bindUI() {
  document.querySelector('#delete-selected')?.addEventListener('click', () => {
    if (selectedAtomId == null) return;
    molecule.removeAtom(selectedAtomId); placements.delete(selectedAtomId);
    selectedAtomId = null; activeTorsionKey = null; settleGeometry(80); refresh();
  });
  document.querySelector('#clear-all')?.addEventListener('click', () => {
    molecule.clear(); placements.clear(); selectedAtomId = null; activeTorsionKey = null; dragState = null; lastCelebrated = '';
    camera.position.set(5.2,4.0,7.6); cameraTarget.set(0,0,0); refresh();
  });
  const c = renderer.domElement;
  c.addEventListener('pointerdown', onPointerDown);
  c.addEventListener('pointermove', onPointerMove);
  c.addEventListener('pointerup', onPointerUp);
  c.addEventListener('pointercancel', onPointerCancel);
  c.addEventListener('wheel', e => { e.preventDefault(); zoomCamera(Math.exp(e.deltaY * 0.001)); }, { passive:false });
  new ResizeObserver(resize).observe(viewer);
}

function addElement(symbol) {
  if (!ELEMENTS[symbol]) return;
  if (!molecule.atoms.length) {
    const atom = molecule.addAtom(symbol);
    placements.set(atom.id, { position: cameraTarget.clone() });
    selectedAtomId = atom.id; pulse(`${symbol} を中心原子として追加`); refresh(); return;
  }
  const center = atomById(selectedAtomId);
  if (!center) { pulse('結合先の原子を先に選択してください'); return; }
  if (freeCapacity(center.id) <= 0) { pulse(`${center.element} には追加できる結合余地がありません`); return; }
  const dir = freeDirections(center.id)[0];
  if (!dir) { pulse('追加できる結合位置がありません'); return; }
  const atom = molecule.addAtom(symbol);
  const d = bondLengthByElements(center.element, symbol, 1);
  placements.set(atom.id, { position: pos(center.id).clone().add(dir.clone().multiplyScalar(d)) });
  molecule.setBond(center.id, atom.id, 1);
  selectedAtomId = center.id;
  settleGeometry(110); pulse(`${symbol} を ${center.element} に単結合で追加`); refresh();
}

function onPointerDown(e) {
  activePointers.set(e.pointerId, {x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,downAt:performance.now()});
  if (activePointers.size === 2) { beginTwoFinger(); dragState = null; hoverTargetId = null; return; }
  if (activePointers.size > 1) return;
  const hits = hitsAt(e);
  const electronHit = hits.find(h => h.object.userData.electronAtomId != null);
  if (electronHit) {
    const atomId = electronHit.object.userData.electronAtomId;
    dragState = { mode:'electron', atomId, startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false };
    selectedAtomId = atomId; capture(e); refresh(); return;
  }
  const bondHit = hits.find(h => h.object.userData.bondKey);
  if (bondHit) {
    const key = bondHit.object.userData.bondKey;
    dragState = { mode:'bond', key, startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,holding:false };
    clearTimeout(bondHoldTimer); clearInterval(bondHoldInterval);
    bondHoldTimer = setTimeout(() => {
      if (!dragState || dragState.mode !== 'bond' || dragState.key !== key || dragState.moved) return;
      dragState.holding = true; weakenBond(key);
      bondHoldInterval = setInterval(() => weakenBond(key), 420);
    }, 560);
    capture(e); return;
  }
  const atomHit = hits.find(h => h.object.userData.atomId != null);
  if (!atomHit) {
    dragState = { mode:'camera', startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false };
    capture(e); return;
  }
  const atomId = atomHit.object.userData.atomId; selectedAtomId = atomId;
  if (activeTorsionKey) {
    const bond = bondFromKey(activeTorsionKey); const sides = bond && cutSides(bond.a,bond.b);
    if (bond && sides) {
      const side = sides.a.has(atomId) ? sides.a : sides.b.has(atomId) ? sides.b : null;
      if (side) {
        dragState = {mode:'torsion', atomId, bond, ids:[...side], lastX:e.clientX,lastY:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};
        capture(e); refresh(); return;
      }
    }
    activeTorsionKey = null;
  }
  const plan = structurePlan(atomId);
  dragState = plan ? {mode:'structure', atomId, pivotId:plan.pivotId, ids:plan.ids, lastX:e.clientX,lastY:e.clientY,startX:e.clientX,startY:e.clientY,moved:false} : {mode:'select',atomId,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};
  capture(e); refresh();
}

function onPointerMove(e) {
  const p = activePointers.get(e.pointerId); if (p) { p.x=e.clientX; p.y=e.clientY; }
  if (activePointers.size === 2) { updateTwoFinger(); return; }
  if (!dragState) return;
  dragState.moved ||= Math.hypot(e.clientX-dragState.startX,e.clientY-dragState.startY) > 7;
  if (dragState.mode === 'bond') {
    if (dragState.moved && !dragState.holding) { clearTimeout(bondHoldTimer); clearInterval(bondHoldInterval); }
    return;
  }
  if (dragState.mode === 'electron') {
    if (dragState.moved) { hoverTargetId = pickAtomAt(e, dragState.atomId); renderMolecule(); }
    return;
  }
  if (!dragState.moved) return;
  const dx=e.clientX-dragState.lastX, dy=e.clientY-dragState.lastY;
  dragState.lastX=e.clientX; dragState.lastY=e.clientY;
  if (dragState.mode === 'camera') orbitCamera(dx,dy);
  if (dragState.mode === 'torsion') rotateAroundBond(dragState.bond, dragState.ids, (dx-dy*.25)*.012);
  if (dragState.mode === 'structure') rotateBranchTowardScreen(dragState.pivotId, dragState.atomId, dragState.ids, dx, dy);
  if (dragState.mode !== 'electron') renderMolecule();
}

function onPointerUp(e) {
  const state = dragState; const p = activePointers.get(e.pointerId); activePointers.delete(e.pointerId);
  if (activePointers.size < 2) multiGesture = null;
  if (!state) return;
  const elapsed = p ? performance.now()-p.downAt : Infinity;
  const isTap = !state.moved && elapsed < 400;
  if (state.mode === 'bond') {
    clearTimeout(bondHoldTimer); clearInterval(bondHoldInterval); bondHoldTimer=null; bondHoldInterval=null;
    if (isTap && !state.holding) handleBondTap(state.key);
    else if (state.moved && !state.holding) {
      const dx=e.clientX-state.startX, dy=e.clientY-state.startY;
      if (dy < -22 && Math.abs(dy) > Math.abs(dx)*.65) strengthenBond(state.key);
    }
  } else if (state.mode === 'electron') {
    if (!state.moved) selectedAtomId = state.atomId; else electronDrop(state.atomId, e);
    hoverTargetId = null;
  } else if (state.mode === 'structure') {
    if (isTap) selectedAtomId = state.atomId; else settleGeometry(100);
  } else if (state.mode === 'torsion') {
    if (!isTap) settleGeometry(45);
  } else if (state.mode === 'camera') {
    if (isTap) { selectedAtomId = null; activeTorsionKey = null; }
  }
  dragState = null; release(e); refresh();
}

function onPointerCancel(e){
  activePointers.delete(e.pointerId); clearTimeout(bondHoldTimer); clearInterval(bondHoldInterval);
  dragState=null; multiGesture=null; hoverTargetId=null; release(e); refresh();
}

function handleBondTap(key) {
  const now=performance.now(), prev=bondTapState.get(key);
  if (prev && now-prev < 430) {
    bondTapState.clear(); const bond=bondFromKey(key);
    if (bond && isRotatableBond(bond)) {
      activeTorsionKey = activeTorsionKey===key?null:key;
      pulse(activeTorsionKey?'回転軸を固定 · 片側の原子をドラッグ':'回転軸を解除');
    } else pulse('この結合は軸回転できません');
  } else bondTapState.set(key, now);
}

function strengthenBond(key) {
  const bond=bondFromKey(key); if (!bond) return;
  if (bond.order >= 3) { pulse('三重結合が上限です'); return; }
  if (freeCapacity(bond.a)<=0 || freeCapacity(bond.b)<=0) { pulse('両方の原子に追加の結合余地が必要です'); return; }
  const old=bond.order; molecule.setBond(bond.a,bond.b,old+1); activeTorsionKey=null;
  settleGeometry(135); pulse(old===1?'上スワイプで二重結合にしました':'上スワイプで三重結合にしました'); refresh();
}

function weakenBond(key) {
  const bond=bondFromKey(key); if (!bond) { clearInterval(bondHoldInterval); return; }
  const old=bond.order;
  if (old>1) molecule.setBond(bond.a,bond.b,old-1); else molecule.removeBond(bond.a,bond.b);
  activeTorsionKey=null; settleGeometry(80);
  pulse(old===3?'長押しで二重結合へ':'長押しで結合を解除しました'); refresh();
}

function electronDrop(sourceId,e) {
  const targetId = pickAtomAt(e, sourceId);
  if (targetId == null) { pulse('不対電子を結合相手の原子へドラッグしてください'); return; }
  const existing=bondBetween(sourceId,targetId);
  if (existing) {
    if (existing.order>=3 || freeCapacity(sourceId)<=0 || freeCapacity(targetId)<=0) { pulse('これ以上結合次数を上げられません'); return; }
    const old=existing.order; molecule.setBond(sourceId,targetId,old+1);
    pulse(old===1?'電子を共有して二重結合にしました':'電子を共有して三重結合にしました');
  } else {
    if (freeCapacity(sourceId)<=0 || freeCapacity(targetId)<=0) { pulse('結合余地がありません'); return; }
    const sameComponent = connectedComponent(sourceId).has(targetId);
    molecule.setBond(sourceId,targetId,1);
    pulse(sameComponent?'環を閉じました':'単結合を作りました');
  }
  settleGeometry(180); selectedAtomId=targetId;
}

function structurePlan(atomId){
  let best=null;
  for(const n of molecule.neighbors(atomId)){
    const sides=cutSides(atomId,n.atomId); if(!sides) continue;
    const side=sides.a.has(atomId)?sides.a:sides.b;
    if(!best||side.size<best.ids.length) best={pivotId:n.atomId,ids:[...side]};
  }
  return best;
}

function rotateBranchTowardScreen(pivotId,anchorId,ids,dx,dy){
  const pivot=pos(pivotId), anchor=pos(anchorId); if(!pivot||!anchor)return;
  const old=anchor.clone().sub(pivot).normalize();
  const q1=new THREE.Quaternion().setFromAxisAngle(cameraUp(),-dx*.010);
  const q2=new THREE.Quaternion().setFromAxisAngle(cameraRight(),-dy*.010);
  const next=old.clone().applyQuaternion(q1).applyQuaternion(q2).normalize();
  const q=new THREE.Quaternion().setFromUnitVectors(old,next);
  for(const id of ids){const p=pos(id); if(p)p.sub(pivot).applyQuaternion(q).add(pivot);}
}

function rotateAroundBond(bond,ids,angle){
  const moving=new Set(ids), pivotId=moving.has(bond.a)?bond.b:bond.a, anchorId=moving.has(bond.a)?bond.a:bond.b;
  const pivot=pos(pivotId), anchor=pos(anchorId); if(!pivot||!anchor)return;
  const axis=anchor.clone().sub(pivot).normalize();
  for(const id of ids){if(id===anchorId)continue;const p=pos(id);if(p)p.sub(pivot).applyAxisAngle(axis,angle).add(pivot);}
}

function settleGeometry(iterations=80){
  const cycles=findCycles(8);
  const aromatic=cycles.filter(isAromaticSixCarbonCycle);
  for(let s=0;s<iterations;s++){
    for(const b of molecule.bonds){
      const a=pos(b.a),c=pos(b.b); if(!a||!c)continue;
      const d=c.clone().sub(a),len=Math.max(.001,d.length()),target=bondLengthFor(b.a,b.b,b.order),corr=d.normalize().multiplyScalar((len-target)*.20);
      a.addScaledVector(corr,.5); c.addScaledVector(corr,-.5);
    }
    for(const atom of molecule.atoms) relaxCenter(atom.id, s<iterations*.65?.15:.08);
    for(const b of molecule.bonds) if(b.order===2) enforceDoublePlanarity(b, s<iterations*.7?.38:.20);
    for(const cycle of aromatic) enforceRegularPlanarCycle(cycle, s<iterations*.75?.18:.10);
  }
}

function geometryFor(id){
  const atom=atomById(id), ns=molecule.neighbors(id), orders=ns.map(n=>n.order), max=orders.length?Math.max(...orders):0, doubles=orders.filter(o=>o===2).length;
  if(atom?.element==='C'){
    if(max>=3||doubles>=2) return {kind:'sp',angle:Math.PI,cos:-1};
    if(max===2) return {kind:'sp2',angle:2*Math.PI/3,cos:-.5};
    return {kind:'sp3',angle:THREE.MathUtils.degToRad(109.47),cos:-1/3};
  }
  const count=ns.length+lonePairCount(atom?.element,molecule.bondOrderForAtom(id));
  if(count<=2)return{kind:'linear',angle:Math.PI,cos:-1};
  if(count===3)return{kind:'trigonal',angle:2*Math.PI/3,cos:-.5};
  return{kind:'tetra',angle:THREE.MathUtils.degToRad(109.47),cos:-1/3};
}

function relaxCenter(id,strength){
  const c=pos(id), ids=molecule.neighbors(id).map(n=>n.atomId); if(!c||ids.length<2)return; const g=geometryFor(id);
  if(ids.length===2){enforceAngle(c,ids[0],ids[1],g.angle,strength);return;}
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const pi=pos(ids[i]),pj=pos(ids[j]);if(!pi||!pj)continue;
    let vi=pi.clone().sub(c),vj=pj.clone().sub(c);const li=vi.length(),lj=vj.length();if(li<.001||lj<.001)continue;
    vi.normalize();vj.normalize();const dot=THREE.MathUtils.clamp(vi.dot(vj),-1,1),err=dot-g.cos;if(Math.abs(err)<.002)continue;
    const ti=vj.clone().addScaledVector(vi,-dot),tj=vi.clone().addScaledVector(vj,-dot);
    if(ti.lengthSq()>1e-8){vi.addScaledVector(ti.normalize(),-err*strength).normalize();pi.lerp(c.clone().addScaledVector(vi,li),.45);}
    if(tj.lengthSq()>1e-8){vj.addScaledVector(tj.normalize(),-err*strength).normalize();pj.lerp(c.clone().addScaledVector(vj,lj),.45);}
  }
}

function enforceAngle(c,aId,bId,target,strength){
  const a=pos(aId),b=pos(bId);if(!a||!b)return;
  let va=a.clone().sub(c),vb=b.clone().sub(c);const la=va.length(),lb=vb.length();if(la<.001||lb<.001)return;
  va.normalize();vb.normalize();const cur=Math.acos(THREE.MathUtils.clamp(va.dot(vb),-1,1)),diff=target-cur;if(Math.abs(diff)<.002)return;
  let axis=new THREE.Vector3().crossVectors(va,vb);if(axis.lengthSq()<1e-7)axis=perpendicular(va);else axis.normalize();
  va.applyAxisAngle(axis,-diff*strength);vb.applyAxisAngle(axis,diff*strength);
  a.lerp(c.clone().addScaledVector(va,la),.48);b.lerp(c.clone().addScaledVector(vb,lb),.48);
}

function enforceDoublePlanarity(bond,strength){
  const a=pos(bond.a),b=pos(bond.b);if(!a||!b)return;
  const aSubs=molecule.neighbors(bond.a).map(n=>n.atomId).filter(id=>id!==bond.b),bSubs=molecule.neighbors(bond.b).map(n=>n.atomId).filter(id=>id!==bond.a);
  if(!aSubs.length||!bSubs.length)return;
  const axis=b.clone().sub(a).normalize();let ref=pos(aSubs[0]).clone().sub(a);ref.addScaledVector(axis,-ref.dot(axis));if(ref.lengthSq()<1e-8)return;
  ref.normalize();const normal=new THREE.Vector3().crossVectors(axis,ref).normalize();
  for(const id of bSubs){const p=pos(id);if(!p)continue;const off=p.clone().sub(b).dot(normal);p.addScaledVector(normal,-off*strength);}
  for(const id of aSubs.slice(1)){const p=pos(id);if(!p)continue;const off=p.clone().sub(a).dot(normal);p.addScaledVector(normal,-off*strength);}
}

function enforceRegularPlanarCycle(cycle,strength){
  const pts=cycle.map(pos); if(pts.some(p=>!p))return;
  const center=pts.reduce((s,p)=>s.add(p),new THREE.Vector3()).multiplyScalar(1/pts.length);
  let normal=new THREE.Vector3();
  for(let i=0;i<pts.length;i++) normal.add(new THREE.Vector3().crossVectors(pts[i].clone().sub(center),pts[(i+1)%pts.length].clone().sub(center)));
  if(normal.lengthSq()<1e-8) normal.copy(camera.position).sub(cameraTarget); normal.normalize();
  let u=pts[0].clone().sub(center);u.addScaledVector(normal,-u.dot(normal));if(u.lengthSq()<1e-8)u=perpendicular(normal);u.normalize();
  const v=new THREE.Vector3().crossVectors(normal,u).normalize();
  const avgSide=cycle.reduce((sum,id,i)=>sum+bondLengthFor(id,cycle[(i+1)%cycle.length],bondBetween(id,cycle[(i+1)%cycle.length])?.order??1),0)/cycle.length;
  const radius=avgSide/(2*Math.sin(Math.PI/cycle.length));
  const second=pts[1].clone().sub(center).normalize();const sign=second.dot(v)>=0?1:-1;
  for(let i=0;i<cycle.length;i++){
    const angle=sign*i*2*Math.PI/cycle.length;
    const target=center.clone().addScaledVector(u,Math.cos(angle)*radius).addScaledVector(v,Math.sin(angle)*radius);
    pts[i].lerp(target,strength);
  }
}

function freeDirections(id){
  const atom=atomById(id);if(!atom)return[];const origin=pos(id);const ns=molecule.neighbors(id);
  const usedDirs=ns.map(n=>pos(n.atomId)?.clone().sub(origin).normalize()).filter(Boolean);const g=geometryFor(id);
  let candidates;
  if(g.kind==='sp') candidates=[new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0)];
  else if(g.kind==='sp2') candidates=[0,1,2].map(i=>new THREE.Vector3(Math.cos(i*2*Math.PI/3),Math.sin(i*2*Math.PI/3),0));
  else candidates=[new THREE.Vector3(1,1,1),new THREE.Vector3(1,-1,-1),new THREE.Vector3(-1,1,-1),new THREE.Vector3(-1,-1,1)].map(v=>v.normalize());
  if(usedDirs.length){const q=bestAlignment(candidates,usedDirs[0]);candidates=candidates.map(v=>v.clone().applyQuaternion(q));}
  return candidates.map(v=>({v,score:usedDirs.length?Math.min(...usedDirs.map(u=>1-v.dot(u))):10})).sort((a,b)=>b.score-a.score).filter(x=>x.score>.18).map(x=>x.v);
}

function bestAlignment(candidates,target){let best=candidates[0],dot=-Infinity;for(const c of candidates){const d=c.dot(target);if(d>dot){dot=d;best=c;}}return new THREE.Quaternion().setFromUnitVectors(best,target);}

function findCycles(maxLen=8){
  const found=new Map();const ids=molecule.atoms.map(a=>a.id);
  for(const start of ids){
    const dfs=(current,path,seen)=>{
      if(path.length>maxLen)return;
      for(const n of molecule.neighbors(current)){
        const next=n.atomId;
        if(next===start&&path.length>=3){const cycle=[...path];found.set(canonicalCycleKey(cycle),cycle);continue;}
        if(seen.has(next)||next<start)continue;
        seen.add(next);path.push(next);dfs(next,path,seen);path.pop();seen.delete(next);
      }
    };
    dfs(start,[start],new Set([start]));
  }
  return [...found.values()];
}

function canonicalCycleKey(cycle){
  const variants=[];const n=cycle.length;
  for(const seq of [cycle,[...cycle].reverse()])for(let i=0;i<n;i++)variants.push([...seq.slice(i),...seq.slice(0,i)].join('-'));
  return variants.sort()[0];
}

function isAromaticSixCarbonCycle(cycle){
  if(cycle.length!==6||!cycle.every(id=>atomById(id)?.element==='C'))return false;
  const orders=cycle.map((id,i)=>bondBetween(id,cycle[(i+1)%6])?.order??0);
  return orders.filter(o=>o===2).length===3&&orders.every((o,i)=>o!==orders[(i+1)%6]&&(o===1||o===2));
}

function completeBenzeneCycle(){
  const counts=countElements(molecule.atoms);if(counts.C!==6||counts.H!==6||molecule.atoms.length!==12)return null;
  for(const cycle of findCycles(6)){
    if(!isAromaticSixCarbonCycle(cycle))continue;
    const ring=new Set(cycle);
    const ok=cycle.every(id=>{
      const outside=molecule.neighbors(id).filter(n=>!ring.has(n.atomId));
      return outside.length===1&&atomById(outside[0].atomId)?.element==='H'&&outside[0].order===1;
    });
    if(ok)return cycle;
  }
  return null;
}

function renderMolecule(){
  disposeGroup(moleculeGroup);
  for(const b of molecule.bonds) renderBond(b);
  for(const cycle of findCycles(6).filter(isAromaticSixCarbonCycle)) renderAromaticRing(cycle);
  for(const a of molecule.atoms) renderAtom(a);
}

function renderAtom(atom){
  const p=pos(atom.id);if(!p)return;const cfg=ELEMENTS[atom.element],selected=atom.id===selectedAtomId,hover=atom.id===hoverTargetId;
  const m=new THREE.Mesh(new THREE.SphereGeometry(cfg.radius*1.04,30,22),new THREE.MeshStandardMaterial({color:cfg.color,roughness:.24,emissive:hover?0x15803d:selected?0x0e7490:0,emissiveIntensity:hover?1.1:selected?.8:0}));
  m.position.copy(p);m.userData.atomId=atom.id;moleculeGroup.add(m);
  const singles=unpairedElectronCount(atom.element,molecule.bondOrderForAtom(atom.id)), dirs=freeDirections(atom.id), shell=valenceShellRadius(atom.element,cfg.radius*1.02);
  for(let i=0;i<Math.min(singles,dirs.length);i++){
    const e=new THREE.Mesh(new THREE.SphereGeometry(.035,10,8),new THREE.MeshStandardMaterial({color:0xdbeafe,emissive:0x0369a1,emissiveIntensity:.35}));
    e.position.copy(p).addScaledVector(dirs[i],shell);e.userData.electronAtomId=atom.id;moleculeGroup.add(e);
  }
  const lps=lonePairCount(atom.element,molecule.bondOrderForAtom(atom.id));
  for(let i=0;i<lps;i++){
    const d=dirs[(singles+i)%Math.max(1,dirs.length)]??perpendicular(new THREE.Vector3(1,0,0));const c=p.clone().addScaledVector(d,shell),side=perpendicular(d).multiplyScalar(.028);
    for(const sign of[-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(.027,8,6),new THREE.MeshStandardMaterial({color:0x94a3b8}));e.position.copy(c).addScaledVector(side,sign);moleculeGroup.add(e);}
  }
}

function renderBond(bond){
  const a=pos(bond.a),b=pos(bond.b);if(!a||!b)return;
  const axis=b.clone().sub(a).normalize(),side=perpendicular(axis),key=bondKey(bond.a,bond.b),active=key===activeTorsionKey;
  const offsets=bond.order===1?[0]:bond.order===2?[-.09,.09]:[-.16,0,.16];
  const color=active?0x22d3ee:bond.order===1?0x94a3b8:bond.order===2?0xfbbf24:0xf472b6;
  const hit=cylinderBetween(a,b,.11,0xffffff,0);hit.material.transparent=true;hit.material.opacity=0;hit.material.depthWrite=false;hit.userData.bondKey=key;moleculeGroup.add(hit);
  for(const off of offsets){
    const shift=side.clone().multiplyScalar(off);const mesh=cylinderBetween(a.clone().add(shift),b.clone().add(shift),bond.order===1?.022:bond.order===2?.026:.028,color,1);
    mesh.userData.bondKey=key;if(bond.order>1){mesh.material.emissive=new THREE.Color(color);mesh.material.emissiveIntensity=bond.order===2?.32:.44;}moleculeGroup.add(mesh);
  }
}

function renderAromaticRing(cycle){
  const pts=cycle.map(pos);if(pts.some(p=>!p))return;const center=pts.reduce((s,p)=>s.add(p),new THREE.Vector3()).multiplyScalar(1/pts.length);
  let normal=new THREE.Vector3();for(let i=0;i<pts.length;i++)normal.add(new THREE.Vector3().crossVectors(pts[i].clone().sub(center),pts[(i+1)%pts.length].clone().sub(center)));
  if(normal.lengthSq()<1e-8)return;normal.normalize();let u=pts[0].clone().sub(center);u.addScaledVector(normal,-u.dot(normal));if(u.lengthSq()<1e-8)return;u.normalize();const v=new THREE.Vector3().crossVectors(normal,u).normalize();
  const radius=pts.reduce((s,p)=>s+p.distanceTo(center),0)/pts.length*.48;const curve=[];
  for(let i=0;i<64;i++){const a=i*2*Math.PI/64;curve.push(center.clone().addScaledVector(u,Math.cos(a)*radius).addScaledVector(v,Math.sin(a)*radius));}
  const g=new THREE.BufferGeometry().setFromPoints(curve);const m=new THREE.LineBasicMaterial({color:0xfde68a,transparent:true,opacity:.82,depthTest:true});moleculeGroup.add(new THREE.LineLoop(g,m));
}

function cylinderBetween(a,b,r,color,opacity=1){
  const d=b.clone().sub(a),len=d.length(),g=new THREE.CylinderGeometry(r,r,len,12),m=new THREE.MeshStandardMaterial({color,roughness:.32,transparent:opacity<1,opacity});
  const mesh=new THREE.Mesh(g,m);mesh.position.copy(a).lerp(b,.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return mesh;
}

function refresh(){renderMolecule();refreshInfo();checkDiscovery();}

function displayName(){return completeBenzeneCycle()?'ベンゼン':molecule.recognizedName();}

function refreshInfo(){
  formulaEl.textContent=molecule.formula();nameEl.textContent=displayName();const validation=molecule.validation();statusEl.className=`status ${validation.level}`;statusEl.textContent=validation.message;
  countsEl.replaceChildren();const counts=countElements(molecule.atoms);if(!molecule.atoms.length)countsEl.textContent='—';else for(const s of Object.keys(counts).sort()){const x=document.createElement('span');x.className='atom-count';x.textContent=`${s} × ${counts[s]}`;countsEl.appendChild(x);}
  const selected=atomById(selectedAtomId);
  if(!selected){selectedElementEl.textContent=selectedValenceEl.textContent=selectedLimitEl.textContent='—';selectionChip.textContent=molecule.atoms.length?'背景ドラッグで回転 · 原子を選択して追加':'元素を押して中心原子を置く';return;}
  const used=molecule.bondOrderForAtom(selected.id);selectedElementEl.textContent=`${selected.element} / ${ELEMENTS[selected.element].name}`;selectedValenceEl.textContent=`${used} / 目標 ${preferredValence(selected.element,used)}`;selectedLimitEl.textContent=`不対電子 ${unpairedElectronCount(selected.element,used)} · 非共有電子対 ${lonePairCount(selected.element,used)}`;
  selectionChip.textContent=activeTorsionKey?'回転軸固定中 · 原子ドラッグでねじる':`${selected.element} 選択中 · 原子ドラッグで構造調整`;
}

function checkDiscovery(){
  const name=displayName(),formula=molecule.formula(),sig=`${formula}|${name}`;
  if(name==='自由制作'||name==='未知 / 未登録の構造'||sig===lastCelebrated)return;
  lastCelebrated=sig;discoveryFormula.textContent=formula;discoveryName.textContent=name;discovery.classList.remove('show');void discovery.offsetWidth;discovery.classList.add('show');
}

function pulse(text){selectionChip.textContent=text;clearTimeout(pulse.t);pulse.t=setTimeout(refreshInfo,1700);}

function beginTwoFinger(){
  const p=[...activePointers.values()];multiGesture={mid:{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},dist:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),angle:Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x)};
}

function updateTwoFinger(){
  if(activePointers.size!==2||!multiGesture)return;
  const p=[...activePointers.values()],mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},dist=Math.max(10,Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)),angle=Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x);
  panCamera(mid.x-multiGesture.mid.x,mid.y-multiGesture.mid.y);zoomCamera(multiGesture.dist/dist);rotateCameraTwist(angle-multiGesture.angle);multiGesture={mid,dist,angle};
}

function orbitCamera(dx,dy){
  const off=camera.position.clone().sub(cameraTarget);const spherical=new THREE.Spherical().setFromVector3(off);
  spherical.theta-=dx*.008;spherical.phi=THREE.MathUtils.clamp(spherical.phi+dy*.008,.12,Math.PI-.12);
  off.setFromSpherical(spherical);camera.position.copy(cameraTarget).add(off);
}

function panCamera(dx,dy){
  const dist=camera.position.distanceTo(cameraTarget),scale=dist*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*2/Math.max(1,viewer.clientHeight),delta=cameraRight().multiplyScalar(-dx*scale).add(cameraUp().multiplyScalar(dy*scale));
  camera.position.add(delta);cameraTarget.add(delta);
}
function zoomCamera(ratio){const off=camera.position.clone().sub(cameraTarget),next=THREE.MathUtils.clamp(off.length()*ratio,1.2,36);camera.position.copy(cameraTarget).add(off.normalize().multiplyScalar(next));}
function rotateCameraTwist(angle){const off=camera.position.clone().sub(cameraTarget);off.applyAxisAngle(new THREE.Vector3(0,1,0),-angle*.75);camera.position.copy(cameraTarget).add(off);}

function hitsAt(e){setPointer(e);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(moleculeGroup.children,true);}
function pickAtomAt(e,excludeId=null){return hitsAt(e).find(h=>h.object.userData.atomId!=null&&h.object.userData.atomId!==excludeId)?.object.userData.atomId??null;}
function isRotatableBond(b){return b.order===1&&atomById(b.a)?.element!=='H'&&atomById(b.b)?.element!=='H'&&!!cutSides(b.a,b.b);}
function cutSides(a,b){const A=bfs(a,a,b);if(A.has(b))return null;return{a:A,b:bfs(b,a,b)};}
function bfs(start,skipA,skipB){const seen=new Set([start]),q=[start];while(q.length){const id=q.shift();for(const n of molecule.neighbors(id)){if((id===skipA&&n.atomId===skipB)||(id===skipB&&n.atomId===skipA))continue;if(!seen.has(n.atomId)){seen.add(n.atomId);q.push(n.atomId);}}}return seen;}
function connectedComponent(start){const seen=new Set([start]),q=[start];while(q.length){const id=q.shift();for(const n of molecule.neighbors(id))if(!seen.has(n.atomId)){seen.add(n.atomId);q.push(n.atomId);}}return seen;}
function freeCapacity(id){const a=atomById(id);if(!a)return 0;const max=Math.max(...(ATOMIC_MODEL[a.element]?.preferredValences??[1]));return Math.max(0,max-molecule.bondOrderForAtom(id));}
function bondLengthFor(a,b,order){return bondLengthByElements(atomById(a)?.element,atomById(b)?.element,order);}
function bondLengthByElements(a,b,order){return ((ATOMIC_MODEL[a]?.covalentRadius??.75)+(ATOMIC_MODEL[b]?.covalentRadius??.75))*.78*bondLengthScale(order);}
function atomById(id){return molecule.atoms.find(a=>a.id===id);}
function bondBetween(a,b){return molecule.bonds.find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));}
function bondKey(a,b){return `${Math.min(a,b)}:${Math.max(a,b)}`;}
function bondFromKey(key){const[a,b]=key.split(':').map(Number);return bondBetween(a,b);}
function pos(id){return placements.get(id)?.position;}
function cameraRight(){camera.updateMatrixWorld();return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).normalize();}
function cameraUp(){camera.updateMatrixWorld();return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1).normalize();}
function perpendicular(v){const ref=Math.abs(v.y)<.85?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);return new THREE.Vector3().crossVectors(v,ref).normalize();}
function setPointer(e){const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;}
function capture(e){try{renderer.domElement.setPointerCapture(e.pointerId)}catch{}}
function release(e){try{renderer.domElement.releasePointerCapture(e.pointerId)}catch{}}
function disposeGroup(group){for(const o of [...group.children]){group.remove(o);o.traverse?.(x=>{x.geometry?.dispose?.();if(Array.isArray(x.material))x.material.forEach(m=>m.dispose?.());else x.material?.dispose?.();});}}
function resize(){const w=Math.max(1,viewer.clientWidth),h=Math.max(1,viewer.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function animate(){requestAnimationFrame(animate);camera.lookAt(cameraTarget);camera.updateMatrixWorld();renderer.render(scene,camera);}
