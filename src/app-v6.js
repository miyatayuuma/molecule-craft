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
let selectedAtomId = null;
let dragState = null;
let electronDrag = null;
let hoveredSnap = null;
let lastAtomTap = { id: null, time: 0 };
let lastCelebrated = '';
let toastTimer = 0;
let lastInteractionAt = performance.now();
let idleLastTime = performance.now();
let activePointerCount = 0;

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
controls.addEventListener('start', () => {
  markInteraction();
  if (!dragState && !electronDrag) setOrbitPivotFromViewCenter();
});
scene.add(new THREE.HemisphereLight(0xffffff, 0x182235, 2.8));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.4); keyLight.position.set(7, 9, 8); scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x8fd3ff, 1.25); rimLight.position.set(-6, -3, 4); scene.add(rimLight);

const moleculeGroup = new THREE.Group();
const interactionGroup = new THREE.Group();
scene.add(moleculeGroup, interactionGroup);
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
    button.type = 'button'; button.className = 'element-button'; button.textContent = symbol;
    button.title = `${element.name}を置く`; button.style.setProperty('--element-color', element.color);
    button.addEventListener('click', () => addFreeAtom(symbol));
    palette.appendChild(button);
  }
}

function bindUI() {
  document.querySelector('#delete-selected')?.addEventListener('click', () => {
    markInteraction();
    if (selectedAtomId == null) return;
    if (connectedComponent(selectedAtomId).size > 1) { pulse('結合中の原子は結合を連続タップして分離します'); return; }
    molecule.removeAtom(selectedAtomId); placements.delete(selectedAtomId); selectedAtomId = null; refresh();
  });
  document.querySelector('#clear-all')?.addEventListener('click', () => {
    markInteraction();
    molecule.clear(); placements.clear(); bondDamage.clear(); selectedAtomId = null; dragState = null; electronDrag = null; hoveredSnap = null; lastCelebrated = '';
    camera.position.set(5.5, 4.3, 8.2); controls.target.set(0, 0, 0); controls.update(); refresh();
  });
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', cancelInteraction);
  canvas.addEventListener('pointerenter', markInteraction);
  canvas.addEventListener('wheel', markInteraction, { passive: true });
  new ResizeObserver(resize).observe(viewer);
}

function addFreeAtom(symbol) {
  markInteraction();
  const atom = molecule.addAtom(symbol);
  const n = molecule.atoms.length - 1, angle = n * 2.399963, radius = Math.min(4.2, 1.1 + 0.36 * Math.sqrt(n));
  placements.set(atom.id, { position: new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.62, 0) });
  selectedAtomId = atom.id; refresh();
}

function onPointerDown(e) {
  markInteraction();
  activePointerCount += 1;
  if (activePointerCount > 1) {
    dragState = null; electronDrag = null; hoveredSnap = null; controls.enabled = true;
    setOrbitPivotFromViewCenter();
    return;
  }
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
  if (!atomHit) { selectedAtomId = null; controls.enabled = true; setOrbitPivotFromViewCenter(); refreshInfo(); return; }

  const atomId = atomHit.object.userData.atomId;
  selectedAtomId = atomId;
  const now = performance.now();
  if (lastAtomTap.id === atomId && now - lastAtomTap.time < 330) {
    focusAtom(atomId); lastAtomTap = { id: null, time: 0 }; refresh(); return;
  }
  lastAtomTap = { id: atomId, time: now };

  const torsion = chooseTorsionForAtom(atomId);
  if (torsion) {
    dragState = {
      mode: 'torsion',
      atomId,
      bondA: torsion.a,
      bondB: torsion.b,
      movingIds: torsion.movingIds,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    controls.enabled = false; capture(e); refresh();
    pulse('単結合まわりを回転中 — 末端を近づければ環化できます');
    return;
  }

  const component = [...connectedComponent(atomId)];
  const normal = camera.getWorldDirection(new THREE.Vector3()).normalize();
  dragPlane.setFromNormalAndCoplanarPoint(normal, placements.get(atomId).position);
  const world = rayToPlane(e); if (!world) return;
  dragState = {
    mode: 'translate', component, startWorld: world.clone(),
    starts: new Map(component.map(id => [id, placements.get(id).position.clone()])),
  };
  controls.enabled = false; capture(e); refresh();
}

function onPointerMove(e) {
  markInteraction();
  if (activePointerCount > 1) return;
  if (electronDrag) {
    const p = rayToPlaneThrough(e, placements.get(electronDrag.atomId)?.position ?? new THREE.Vector3());
    if (p) electronDrag.current.copy(p);
    hoveredSnap = findElectronTarget(electronDrag.atomId, electronDrag.current); renderInteraction(); return;
  }
  if (!dragState) return;

  if (dragState.mode === 'torsion') {
    const dx = e.clientX - dragState.lastX;
    const dy = e.clientY - dragState.lastY;
    dragState.lastX = e.clientX; dragState.lastY = e.clientY;
    const angle = THREE.MathUtils.clamp((dx - dy * 0.35) * 0.012, -0.12, 0.12);
    rotateBranchAroundBond(dragState.bondA, dragState.bondB, dragState.movingIds, angle);
    hoveredSnap = findAutoBondCandidate(dragState.movingIds, true);
    renderMolecule();
    return;
  }

  const world = rayToPlane(e); if (!world) return;
  const delta = world.clone().sub(dragState.startWorld);
  for (const id of dragState.component) placements.get(id).position.copy(dragState.starts.get(id)).add(delta);
  hoveredSnap = findAutoBondCandidate(dragState.component, false);
  renderMolecule();
}

function onPointerUp(e) {
  markInteraction();
  activePointerCount = Math.max(0, activePointerCount - 1);
  if (activePointerCount > 0) return;
  if (electronDrag) {
    const target = hoveredSnap ?? findElectronTarget(electronDrag.atomId, electronDrag.current);
    if (target) formBond(electronDrag.atomId, target.atomId, true);
    electronDrag = null; hoveredSnap = null; controls.enabled = true; release(e); refresh(); return;
  }
  if (!dragState) { controls.enabled = true; return; }
  const candidate = hoveredSnap ?? findAutoBondCandidate(dragState.mode === 'torsion' ? dragState.movingIds : dragState.component, dragState.mode === 'torsion');
  if (candidate) formBond(candidate.a, candidate.b, false);
  if (dragState.mode === 'torsion') settleMolecule(22);
  dragState = null; hoveredSnap = null; controls.enabled = true; release(e); refresh();
}

function cancelInteraction(e) {
  activePointerCount = Math.max(0, activePointerCount - 1);
  dragState = null; electronDrag = null; hoveredSnap = null; controls.enabled = true; release(e); refresh();
}

function chooseTorsionForAtom(atomId) {
  const candidates = [];
  for (const bond of molecule.bonds) {
    if (bond.order !== 1 || !isRotatableBond(bond)) continue;
    const sides = cutSides(bond.a, bond.b);
    if (!sides) continue;
    const inA = sides.aSide.has(atomId), inB = sides.bSide.has(atomId);
    if (!inA && !inB) continue;
    const movingIds = [...(inA ? sides.aSide : sides.bSide)];
    if (!movingIds.includes(atomId)) continue;
    const otherSize = molecule.atoms.length - movingIds.length;
    if (otherSize <= 0) continue;
    const movingContainsHOnly = movingIds.every(id => atomById(id)?.element === 'H');
    if (movingContainsHOnly) continue;
    candidates.push({ a: bond.a, b: bond.b, movingIds, size: movingIds.length });
  }
  candidates.sort((x, y) => x.size - y.size);
  return candidates[0] ?? null;
}

function isRotatableBond(bond) {
  if (bond.order !== 1) return false;
  const a = atomById(bond.a), b = atomById(bond.b);
  if (!a || !b || a.element === 'H' || b.element === 'H') return false;
  return cutSides(bond.a, bond.b) !== null;
}

function cutSides(a, b) {
  const aSide = bfsIgnoringBond(a, a, b);
  if (aSide.has(b)) return null;
  const bSide = bfsIgnoringBond(b, a, b);
  return { aSide, bSide };
}

function bfsIgnoringBond(start, skipA, skipB) {
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const id = q.shift();
    for (const n of molecule.neighbors(id)) {
      if ((id === skipA && n.atomId === skipB) || (id === skipB && n.atomId === skipA)) continue;
      if (!seen.has(n.atomId)) { seen.add(n.atomId); q.push(n.atomId); }
    }
  }
  return seen;
}

function rotateBranchAroundBond(a, b, movingIds, angle) {
  const moving = new Set(movingIds);
  const pivotId = moving.has(a) ? b : a;
  const movingAnchorId = moving.has(a) ? a : b;
  const pivot = placements.get(pivotId)?.position;
  const anchor = placements.get(movingAnchorId)?.position;
  if (!pivot || !anchor) return;
  const axis = anchor.clone().sub(pivot).normalize();
  for (const id of movingIds) {
    if (id === movingAnchorId) continue;
    const p = placements.get(id)?.position; if (!p) continue;
    p.sub(pivot).applyAxisAngle(axis, angle).add(pivot);
  }
}

function findAutoBondCandidate(movingIds, allowSameComponent) {
  const movingSet = new Set(movingIds);
  let best = null;
  for (const a of movingIds) {
    if (!canAcceptBond(a)) continue;
    for (const atom of molecule.atoms) {
      const b = atom.id;
      if (movingSet.has(b) || !canAcceptBond(b) || bondBetween(a, b)) continue;
      if (!allowSameComponent && connectedComponent(a).has(b)) continue;
      if (allowSameComponent && connectedComponent(a).has(b) && graphDistance(a, b) < 3) continue;
      const d = placements.get(a).position.distanceTo(placements.get(b).position);
      const threshold = bondLengthFor(a, b, 1) * 1.28;
      if (d < threshold && (!best || d < best.distance)) best = { a, b, atomId: b, distance: d };
    }
  }
  return best;
}

function graphDistance(start, goal) {
  const q = [[start, 0]], seen = new Set([start]);
  while (q.length) {
    const [id, d] = q.shift();
    if (id === goal) return d;
    for (const n of molecule.neighbors(id)) if (!seen.has(n.atomId)) { seen.add(n.atomId); q.push([n.atomId, d + 1]); }
  }
  return Infinity;
}

function findElectronTarget(sourceId, point) {
  let best = null;
  for (const atom of molecule.atoms) {
    if (atom.id === sourceId || !canAcceptBond(atom.id)) continue;
    const d = placements.get(atom.id).position.distanceTo(point);
    if (d < 0.82 && (!best || d < best.distance)) best = { atomId: atom.id, distance: d };
  }
  return best;
}

function canAcceptBond(id) {
  const atom = atomById(id); if (!atom) return false;
  const used = molecule.bondOrderForAtom(id);
  const max = Math.max(...(ATOMIC_MODEL[atom.element]?.preferredValences ?? [1]));
  if (used < max) return true;
  return molecule.neighbors(id).some(n => n.order > 1);
}

function formBond(a, b, directElectronEdit) {
  if (a === b) return;
  const existing = bondBetween(a, b);
  if (existing && directElectronEdit) { if (existing.order < 3) existing.order += 1; }
  else if (!existing) molecule.setBond(a, b, 1);
  else return;
  const component = [...connectedComponent(a)];
  optimizeBondOrders(molecule, component);
  settleMolecule(88);
  bondDamage.clear(); selectedAtomId = b;
  const bond = bondBetween(a, b);
  pulse(bond?.order === 3 ? '電子配置から三重結合へ安定化' : bond?.order === 2 ? '電子配置から二重結合へ安定化' : graphDistance(a,b) > 2 ? '環が閉じました' : '共有電子対ができました');
  if (navigator.vibrate) navigator.vibrate(bond?.order > 1 ? [16, 20, 24] : 18);
  checkDiscovery();
}

function damageBond(key) {
  const [a, b] = key.split(':').map(Number);
  const bond = bondBetween(a, b); if (!bond) return;
  const atomA = atomById(a), atomB = atomById(b); if (!atomA || !atomB) return;
  const required = tapsToWeakenBond(atomA.element, atomB.element, bond.order);
  const now = performance.now(), prev = bondDamage.get(key);
  const count = prev && now - prev.time < 720 ? prev.count + 1 : 1;
  bondDamage.set(key, { count, time: now });
  const energy = Math.round(bondEnergyKJ(atomA.element, atomB.element, bond.order));
  if (count < required) {
    pulse(`結合へ衝撃 ${count}/${required} · 約${energy} kJ/mol`);
    moleculeGroup.userData.shakeUntil = now + 140;
    if (navigator.vibrate) navigator.vibrate(8);
    return;
  }
  bondDamage.delete(key);
  if (bond.order > 1) molecule.setBond(a, b, bond.order - 1); else molecule.removeBond(a, b);
  settleMolecule(48); lastCelebrated = '';
  pulse(bond.order === 3 ? 'π結合が1組ほどけて二重結合へ' : bond.order === 2 ? 'π結合がほどけて単結合へ' : '結合が切れて分離しました');
  if (navigator.vibrate) navigator.vibrate([18, 18, 30]);
  refresh();
}

function settleMolecule(iterations = 60) {
  for (let step = 0; step < iterations; step++) {
    for (const bond of molecule.bonds) {
      const pa = placements.get(bond.a)?.position, pb = placements.get(bond.b)?.position; if (!pa || !pb) continue;
      const delta = pb.clone().sub(pa), dist = Math.max(0.001, delta.length()), target = bondLengthFor(bond.a, bond.b, bond.order);
      const correction = delta.normalize().multiplyScalar((dist - target) * 0.20);
      pa.add(correction.clone().multiplyScalar(0.5)); pb.sub(correction.clone().multiplyScalar(0.5));
    }
    for (const center of molecule.atoms) {
      const neighbors = molecule.neighbors(center.id).map(n => n.atomId); if (neighbors.length < 2) continue;
      const c = placements.get(center.id)?.position; if (!c) continue;
      const used = molecule.bondOrderForAtom(center.id);
      const angle = THREE.MathUtils.degToRad(idealBondAngleDeg(center.element, used, neighbors.length));
      if (neighbors.length === 2) enforceTwoNeighborAngle(c, neighbors[0], neighbors[1], angle);
      else relaxMultiNeighborAngles(c, neighbors, Math.cos(angle));
    }
  }
}

function enforceTwoNeighborAngle(center, aId, bId, targetAngle) {
  const pa = placements.get(aId)?.position, pb = placements.get(bId)?.position; if (!pa || !pb) return;
  const va = pa.clone().sub(center), vb = pb.clone().sub(center), la = va.length(), lb = vb.length(); if (la < 0.001 || lb < 0.001) return;
  va.normalize(); vb.normalize();
  const current = Math.acos(THREE.MathUtils.clamp(va.dot(vb), -1, 1)), diff = targetAngle - current;
  if (Math.abs(diff) < 0.002) return;
  let axis = new THREE.Vector3().crossVectors(va, vb);
  if (axis.lengthSq() < 1e-6) axis = perpendicular(va); else axis.normalize();
  va.applyAxisAngle(axis, -diff * 0.18); vb.applyAxisAngle(axis, diff * 0.18);
  pa.lerp(center.clone().add(va.multiplyScalar(la)), 0.36); pb.lerp(center.clone().add(vb.multiplyScalar(lb)), 0.36);
}

function relaxMultiNeighborAngles(center, neighborIds, targetCos) {
  for (let i = 0; i < neighborIds.length; i++) for (let j = i + 1; j < neighborIds.length; j++) {
    const pi = placements.get(neighborIds[i])?.position, pj = placements.get(neighborIds[j])?.position; if (!pi || !pj) continue;
    const vi = pi.clone().sub(center).normalize(), vj = pj.clone().sub(center).normalize(), err = vi.dot(vj) - targetCos;
    if (Math.abs(err) < 0.012) continue;
    const ti = vj.clone().sub(vi.clone().multiplyScalar(vi.dot(vj))), tj = vi.clone().sub(vj.clone().multiplyScalar(vj.dot(vi)));
    if (ti.lengthSq() > 1e-6) pi.add(ti.normalize().multiplyScalar(-err * 0.075));
    if (tj.lengthSq() > 1e-6) pj.add(tj.normalize().multiplyScalar(-err * 0.075));
  }
}

function bondLengthFor(a, b, order) {
  const aa = atomById(a), bb = atomById(b);
  const ra = ATOMIC_MODEL[aa?.element]?.covalentRadius ?? 0.75;
  const rb = ATOMIC_MODEL[bb?.element]?.covalentRadius ?? 0.75;
  return (ra + rb) * 0.78 * bondLengthScale(order);
}

function connectedComponent(start) {
  const seen = new Set([start]), q = [start];
  while (q.length) {
    const id = q.shift();
    for (const n of molecule.neighbors(id)) if (!seen.has(n.atomId)) { seen.add(n.atomId); q.push(n.atomId); }
  }
  return seen;
}

function atomById(id) { return molecule.atoms.find(a => a.id === id); }
function bondBetween(a, b) { return molecule.bonds.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)); }
function bondKey(a, b) { return `${Math.min(a, b)}:${Math.max(a, b)}`; }

function checkDiscovery() {
  const name = molecule.recognizedName(), formula = molecule.formula();
  const allSatisfied = molecule.atoms.length > 1 && molecule.atoms.every(atom => (ATOMIC_MODEL[atom.element]?.preferredValences ?? []).includes(molecule.bondOrderForAtom(atom.id)));
  const signature = `${formula}|${name}|${molecule.bonds.map(b => `${bondKey(b.a,b.b)}=${b.order}`).sort().join(',')}`;
  if (!allSatisfied || !name || name === '自由制作' || name === '未知 / 未登録の構造' || signature === lastCelebrated) return;
  lastCelebrated = signature; discoveryFormula.textContent = formula; discoveryName.textContent = name;
  discovery.classList.remove('show'); void discovery.offsetWidth; discovery.classList.add('show'); moleculeGroup.userData.flashUntil = performance.now() + 950;
  if (navigator.vibrate) navigator.vibrate([25, 35, 55]);
}

function refresh() { renderMolecule(); refreshInfo(); checkDiscovery(); }

function refreshInfo() {
  formulaEl.textContent = molecule.formula(); nameEl.textContent = molecule.recognizedName();
  const validation = molecule.validation(); statusEl.className = `status ${validation.level}`; statusEl.textContent = validation.message;
  const counts = countElements(molecule.atoms); countsEl.replaceChildren();
  if (!molecule.atoms.length) countsEl.textContent = '—';
  else for (const symbol of Object.keys(counts).sort()) { const span = document.createElement('span'); span.className = 'atom-count'; span.textContent = `${symbol} × ${counts[symbol]}`; countsEl.appendChild(span); }
  const selected = atomById(selectedAtomId);
  if (!selected) {
    selectedElementEl.textContent = '—'; selectedValenceEl.textContent = '—'; selectedLimitEl.textContent = '—';
    selectionChip.textContent = molecule.atoms.length ? '画面中央を中心に回転 · 単結合は原子を引いてねじる' : '元素を押して原子を置く'; return;
  }
  const used = molecule.bondOrderForAtom(selected.id), singles = unpairedElectronCount(selected.element, used), pairs = lonePairCount(selected.element, used);
  const torsion = chooseTorsionForAtom(selected.id);
  selectedElementEl.textContent = `${selected.element} / ${ELEMENTS[selected.element].name}`;
  selectedValenceEl.textContent = `${used} / 目標 ${preferredValence(selected.element, used)}`;
  selectedLimitEl.textContent = `不対電子 ${singles} · 非共有電子対 ${pairs}`;
  selectionChip.textContent = torsion ? 'この原子を引くと単結合まわりに回転' : connectedComponent(selected.id).size > 1 ? '分子として移動 · 2本指で視点回転' : '近づけるだけで最適な結合へ';
}

function renderMolecule() {
  disposeGroup(moleculeGroup);
  const now = performance.now(), flash = now < (moleculeGroup.userData.flashUntil || 0), shake = now < (moleculeGroup.userData.shakeUntil || 0);
  moleculeGroup.position.set(shake ? Math.sin(now * 0.12) * 0.025 : 0, 0, 0);
  for (const bond of molecule.bonds) addBondMeshes(bond, flash);
  for (const atom of molecule.atoms) renderAtom(atom, flash);
  renderInteraction();
}

function renderAtom(atom, flash) {
  const placement = placements.get(atom.id); if (!placement) return;
  const cfg = ELEMENTS[atom.element], selected = atom.id === selectedAtomId;
  const core = new THREE.Mesh(new THREE.SphereGeometry(cfg.radius * 1.06, 32, 24), new THREE.MeshStandardMaterial({
    color: cfg.color, roughness: 0.22, metalness: 0.03,
    emissive: flash ? 0x38bdf8 : selected ? 0x075985 : 0, emissiveIntensity: flash ? 0.72 : selected ? 0.42 : 0,
  }));
  core.position.copy(placement.position); core.userData = { atomCore: true, atomId: atom.id }; moleculeGroup.add(core);
  const used = molecule.bondOrderForAtom(atom.id), singles = unpairedElectronCount(atom.element, used), lonePairs = lonePairCount(atom.element, used);
  const totalSites = Math.max(1, singles + lonePairs + molecule.neighbors(atom.id).length), dirs = electronDirections(totalSites), shellR = valenceShellRadius(atom.element, cfg.radius * 1.02);
  for (let i = 0; i < singles; i++) addElectron(atom.id, placement.position, dirs[i % dirs.length], shellR, selected);
  for (let i = 0; i < lonePairs; i++) addLonePair(placement.position, dirs[(singles + i) % dirs.length], shellR);
}

function addElectron(atomId, origin, direction, shellR, selected) {
  const pos = origin.clone().add(direction.clone().multiplyScalar(shellR));
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(selected ? 0.115 : 0.09, 18, 14), new THREE.MeshStandardMaterial({
    color: hoveredSnap?.atomId === atomId ? 0xfde68a : selected ? 0x7dd3fc : 0xdbeafe,
    emissive: hoveredSnap?.atomId === atomId ? 0xf59e0b : 0x0369a1, emissiveIntensity: hoveredSnap?.atomId === atomId ? 1 : selected ? 0.85 : 0.35, roughness: 0.18,
  }));
  mesh.position.copy(pos); mesh.userData = { electronAtomId: atomId }; moleculeGroup.add(mesh);
}

function addLonePair(origin, direction, shellR) {
  const center = origin.clone().add(direction.clone().multiplyScalar(shellR)), side = perpendicular(direction).multiplyScalar(0.055);
  for (const sign of [-1, 1]) { const dot = new THREE.Mesh(new THREE.SphereGeometry(0.047, 10, 8), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 })); dot.position.copy(center).add(side.clone().multiplyScalar(sign)); moleculeGroup.add(dot); }
}

function electronDirections(count) {
  if (count <= 1) return [new THREE.Vector3(1, 0, 0)];
  if (count === 2) return [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0)];
  if (count === 3) return [0,1,2].map(i => new THREE.Vector3(Math.cos(i*Math.PI*2/3), Math.sin(i*Math.PI*2/3), 0));
  return [new THREE.Vector3(1,1,1), new THREE.Vector3(1,-1,-1), new THREE.Vector3(-1,1,-1), new THREE.Vector3(-1,-1,1)].map(v => v.normalize());
}

function addBondMeshes(bond, flash) {
  const start = placements.get(bond.a)?.position, end = placements.get(bond.b)?.position; if (!start || !end) return;
  const axis = end.clone().sub(start).normalize(), side = perpendicular(axis);
  const offsets = bond.order === 1 ? [0] : bond.order === 2 ? [-0.07, 0.07] : [-0.115, 0, 0.115];
  const key = bondKey(bond.a, bond.b);
  for (const offset of offsets) {
    const shift = side.clone().multiplyScalar(offset);
    const mesh = cylinderBetween(start.clone().add(shift), end.clone().add(shift), 0.045, flash ? 0x7dd3fc : 0xcbd5e1, 1);
    mesh.userData = { bondKey: key }; moleculeGroup.add(mesh);
  }
  const center = start.clone().lerp(end, 0.5);
  for (let pair = 0; pair < bond.order; pair++) {
    const lateral = side.clone().multiplyScalar((pair - (bond.order - 1) / 2) * 0.11), pairAxis = perpendicular(axis).multiplyScalar(0.042);
    for (const sign of [-1, 1]) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: flash ? 0x38bdf8 : 0x1e3a8a, emissiveIntensity: flash ? 1 : 0.35 }));
      dot.position.copy(center).add(lateral).add(pairAxis.clone().multiplyScalar(sign)); dot.userData = { bondKey: key }; moleculeGroup.add(dot);
    }
  }
}

function renderInteraction() {
  disposeGroup(interactionGroup);
  if (electronDrag) {
    const start = placements.get(electronDrag.atomId)?.position; if (!start) return;
    interactionGroup.add(cylinderBetween(start, electronDrag.current, 0.024, hoveredSnap ? 0xfacc15 : 0x38bdf8, 0.8));
  } else if (hoveredSnap && dragState) {
    const a = placements.get(hoveredSnap.a)?.position, b = placements.get(hoveredSnap.b)?.position;
    if (a && b) interactionGroup.add(cylinderBetween(a, b, 0.022, 0xfacc15, 0.55));
  }
}

function cylinderBetween(start, end, radius, color, opacity = 1) {
  const delta = end.clone().sub(start), len = Math.max(0.001, delta.length());
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.38, transparent: opacity < 1, opacity });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 14), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return mesh;
}

function perpendicular(v) {
  const ref = Math.abs(v.y) < 0.85 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
  return new THREE.Vector3().crossVectors(v, ref).normalize();
}

function focusAtom(id) {
  const p = placements.get(id); if (!p) return;
  controls.target.copy(p.position); const dir = camera.position.clone().sub(controls.target).normalize(); camera.position.copy(p.position).add(dir.multiplyScalar(2.5)); controls.update();
  pulse('精密表示 — 画面中央が回転中心になります');
}

function setOrbitPivotFromViewCenter() {
  if (!molecule.atoms.length) return;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(moleculeGroup.children, true);
  if (hits.length) { controls.target.copy(hits[0].point); controls.update(); return; }
  let best = null;
  for (const atom of molecule.atoms) {
    const p = placements.get(atom.id)?.position; if (!p) continue;
    const ndc = p.clone().project(camera); const score = ndc.x * ndc.x + ndc.y * ndc.y;
    if (!best || score < best.score) best = { p, score };
  }
  if (best) { controls.target.copy(best.p); controls.update(); }
}

function applyIdleTorsion(now) {
  if (now - lastInteractionAt < 3200 || dragState || electronDrag || activePointerCount > 0) { idleLastTime = now; return; }
  const dt = Math.min(40, now - idleLastTime); idleLastTime = now;
  const bonds = molecule.bonds.filter(isRotatableBond).slice(0, 4);
  if (!bonds.length) return;
  for (let i = 0; i < bonds.length; i++) {
    const bond = bonds[i], sides = cutSides(bond.a, bond.b); if (!sides) continue;
    const moving = sides.aSide.size <= sides.bSide.size ? [...sides.aSide] : [...sides.bSide];
    const phase = now * 0.00035 + i * 1.7;
    const angularVelocity = Math.cos(phase) * 0.00022;
    rotateBranchAroundBond(bond.a, bond.b, moving, angularVelocity * dt);
  }
  renderMolecule();
}

function markInteraction() { lastInteractionAt = performance.now(); }
function pulse(text) { selectionChip.textContent = text; clearTimeout(toastTimer); toastTimer = setTimeout(refreshInfo, 1800); }
function capture(e) { try { renderer.domElement.setPointerCapture(e.pointerId); } catch {} }
function release(e) { try { renderer.domElement.releasePointerCapture(e.pointerId); } catch {} }
function setPointer(e) { const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1; }
function rayToPlane(e) { setPointer(e); raycaster.setFromCamera(pointer, camera); const out = new THREE.Vector3(); return raycaster.ray.intersectPlane(dragPlane, out) ? out : null; }
function rayToPlaneThrough(e, point) { const normal = camera.getWorldDirection(new THREE.Vector3()).normalize(); const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point); setPointer(e); raycaster.setFromCamera(pointer,camera); const out = new THREE.Vector3(); return raycaster.ray.intersectPlane(plane,out) ? out : null; }
function disposeGroup(group) { while (group.children.length) { const child = group.children.pop(); child.traverse(object => { object.geometry?.dispose?.(); if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.()); else object.material?.dispose?.(); }); } }
function resize() { const width = Math.max(1, viewer.clientWidth), height = Math.max(1, viewer.clientHeight); renderer.setSize(width,height,false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
function animate(now = performance.now()) { requestAnimationFrame(animate); applyIdleTorsion(now); controls.update(); renderer.render(scene,camera); }
