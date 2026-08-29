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
controls.minDistance = 1.6;
controls.maxDistance = 28;
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
    button.type = 'button';
    button.className = 'element-button';
    button.textContent = symbol;
    button.title = `${element.name}を置く`;
    button.style.setProperty('--element-color', element.color);
    button.addEventListener('click', () => addFreeAtom(symbol));
    palette.appendChild(button);
  }
}

function bindUI() {
  document.querySelector('#delete-selected')?.addEventListener('click', () => {
    if (selectedAtomId == null) return;
    if (connectedComponent(selectedAtomId).size > 1) {
      pulse('結合中の原子は結合を連続タップして分離します');
      return;
    }
    molecule.removeAtom(selectedAtomId);
    placements.delete(selectedAtomId);
    selectedAtomId = null;
    refresh();
  });
  document.querySelector('#clear-all')?.addEventListener('click', () => {
    molecule.clear(); placements.clear(); bondDamage.clear();
    selectedAtomId = null; dragState = null; electronDrag = null; hoveredSnap = null; lastCelebrated = '';
    camera.position.set(5.5, 4.3, 8.2); controls.target.set(0, 0, 0); controls.update(); refresh();
  });
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', cancelInteraction);
  new ResizeObserver(resize).observe(viewer);
}

function addFreeAtom(symbol) {
  const atom = molecule.addAtom(symbol);
  const n = molecule.atoms.length - 1;
  const angle = n * 2.399963;
  const radius = Math.min(4.2, 1.1 + 0.36 * Math.sqrt(n));
  placements.set(atom.id, { position: new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.62, 0) });
  selectedAtomId = atom.id;
  refresh();
}

function onPointerDown(e) {
  setPointer(e); raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(moleculeGroup.children, true);
  const bondHit = hits.find(hit => hit.object.userData.bondKey);
  if (bondHit) {
    damageBond(bondHit.object.userData.bondKey);
    return;
  }
  const electronHit = hits.find(hit => hit.object.userData.electronAtomId !== undefined);
  if (electronHit) {
    electronDrag = { atomId: electronHit.object.userData.electronAtomId, current: electronHit.point.clone() };
    selectedAtomId = electronDrag.atomId;
    controls.enabled = false;
    capture(e);
    refresh();
    return;
  }
  const atomHit = hits.find(hit => hit.object.userData.atomCore);
  if (!atomHit) { selectedAtomId = null; refreshInfo(); return; }

  const atomId = atomHit.object.userData.atomId;
  selectedAtomId = atomId;
  const now = performance.now();
  if (lastAtomTap.id === atomId && now - lastAtomTap.time < 330) {
    focusAtom(atomId);
    lastAtomTap = { id: null, time: 0 };
    refresh();
    return;
  }
  lastAtomTap = { id: atomId, time: now };
  const component = [...connectedComponent(atomId)];
  const normal = camera.getWorldDirection(new THREE.Vector3()).normalize();
  dragPlane.setFromNormalAndCoplanarPoint(normal, placements.get(atomId).position);
  const world = rayToPlane(e);
  if (!world) return;
  dragState = {
    component,
    startWorld: world.clone(),
    starts: new Map(component.map(id => [id, placements.get(id).position.clone()])),
    startX: e.clientX,
    startY: e.clientY,
  };
  controls.enabled = false;
  capture(e);
  refresh();
}

function onPointerMove(e) {
  if (electronDrag) {
    const p = rayToPlaneThrough(e, placements.get(electronDrag.atomId)?.position ?? new THREE.Vector3());
    if (p) electronDrag.current.copy(p);
    hoveredSnap = findElectronTarget(electronDrag.atomId, electronDrag.current);
    renderInteraction();
    return;
  }
  if (!dragState) return;
  const world = rayToPlane(e); if (!world) return;
  const delta = world.clone().sub(dragState.startWorld);
  for (const id of dragState.component) placements.get(id).position.copy(dragState.starts.get(id)).add(delta);
  hoveredSnap = findAutoBondCandidate(dragState.component);
  renderMolecule();
}

function onPointerUp(e) {
  if (electronDrag) {
    const target = hoveredSnap ?? findElectronTarget(electronDrag.atomId, electronDrag.current);
    if (target) formBond(electronDrag.atomId, target.atomId, true);
    electronDrag = null; hoveredSnap = null; controls.enabled = true; release(e); refresh();
    return;
  }
  if (!dragState) return;
  const candidate = hoveredSnap ?? findAutoBondCandidate(dragState.component);
  if (candidate) formBond(candidate.a, candidate.b, false);
  dragState = null; hoveredSnap = null; controls.enabled = true; release(e); refresh();
}

function cancelInteraction(e) {
  dragState = null; electronDrag = null; hoveredSnap = null; controls.enabled = true; release(e); refresh();
}

function findAutoBondCandidate(movingIds) {
  let best = null;
  for (const a of movingIds) {
    if (!canAcceptBond(a)) continue;
    for (const atom of molecule.atoms) {
      const b = atom.id;
      if (movingIds.includes(b) || !canAcceptBond(b) || bondBetween(a, b)) continue;
      const d = placements.get(a).position.distanceTo(placements.get(b).position);
      const threshold = bondLengthFor(a, b, 1) * 1.36;
      if (d < threshold && (!best || d < best.distance)) best = { a, b, atomId: b, distance: d };
    }
  }
  return best;
}

function findElectronTarget(sourceId, point) {
  let best = null;
  for (const atom of molecule.atoms) {
    if (atom.id === sourceId || !canAcceptBond(atom.id)) continue;
    const d = placements.get(atom.id).position.distanceTo(point);
    if (d < 0.95 && (!best || d < best.distance)) best = { atomId: atom.id, distance: d };
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
  if (existing && directElectronEdit) {
    if (existing.order < 3) existing.order += 1;
  } else if (!existing) {
    molecule.setBond(a, b, 1);
  } else {
    return;
  }
  const component = [...connectedComponent(a)];
  optimizeBondOrders(molecule, component);
  settleMolecule(72);
  bondDamage.clear();
  selectedAtomId = b;
  const bond = bondBetween(a, b);
  pulse(bond?.order === 3 ? '電子配置から三重結合へ安定化' : bond?.order === 2 ? '電子配置から二重結合へ安定化' : '共有電子対ができました');
  if (navigator.vibrate) navigator.vibrate(bond?.order > 1 ? [16, 20, 24] : 18);
  checkDiscovery();
}

function damageBond(key) {
  const [a, b] = key.split(':').map(Number);
  const bond = bondBetween(a, b); if (!bond) return;
  const atomA = atomById(a), atomB = atomById(b); if (!atomA || !atomB) return;
  const required = tapsToWeakenBond(atomA.element, atomB.element, bond.order);
  const now = performance.now();
  const prev = bondDamage.get(key);
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
  settleMolecule(52);
  lastCelebrated = '';
  pulse(bond.order === 3 ? 'π結合が1組ほどけて二重結合へ' : bond.order === 2 ? 'π結合がほどけて単結合へ' : '結合が切れて分離しました');
  if (navigator.vibrate) navigator.vibrate([18, 18, 30]);
  refresh();
}

function settleMolecule(iterations = 60) {
  for (let step = 0; step < iterations; step++) {
    for (const bond of molecule.bonds) {
      const pa = placements.get(bond.a)?.position, pb = placements.get(bond.b)?.position;
      if (!pa || !pb) continue;
      const delta = pb.clone().sub(pa);
      const dist = Math.max(0.001, delta.length());
      const target = bondLengthFor(bond.a, bond.b, bond.order);
      const correction = delta.normalize().multiplyScalar((dist - target) * 0.24);
      pa.add(correction.clone().multiplyScalar(0.5));
      pb.sub(correction.clone().multiplyScalar(0.5));
    }
    for (const center of molecule.atoms) {
      const neighbors = molecule.neighbors(center.id).map(n => n.atomId);
      if (neighbors.length < 2) continue;
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
  const va = pa.clone().sub(center), vb = pb.clone().sub(center);
  const la = va.length(), lb = vb.length(); if (la < 0.001 || lb < 0.001) return;
  va.normalize(); vb.normalize();
  const current = Math.acos(THREE.MathUtils.clamp(va.dot(vb), -1, 1));
  const diff = targetAngle - current;
  if (Math.abs(diff) < 0.002) return;
  let axis = new THREE.Vector3().crossVectors(va, vb);
  if (axis.lengthSq() < 1e-6) axis = perpendicular(va); else axis.normalize();
  va.applyAxisAngle(axis, -diff * 0.20);
  vb.applyAxisAngle(axis, diff * 0.20);
  pa.lerp(center.clone().add(va.multiplyScalar(la)), 0.42);
  pb.lerp(center.clone().add(vb.multiplyScalar(lb)), 0.42);
}

function relaxMultiNeighborAngles(center, neighborIds, targetCos) {
  for (let i = 0; i < neighborIds.length; i++) {
    for (let j = i + 1; j < neighborIds.length; j++) {
      const pi = placements.get(neighborIds[i])?.position, pj = placements.get(neighborIds[j])?.position;
      if (!pi || !pj) continue;
      const vi = pi.clone().sub(center).normalize();
      const vj = pj.clone().sub(center).normalize();
      const err = vi.dot(vj) - targetCos;
      if (Math.abs(err) < 0.012) continue;
      const ti = vj.clone().sub(vi.clone().multiplyScalar(vi.dot(vj)));
      const tj = vi.clone().sub(vj.clone().multiplyScalar(vj.dot(vi)));
      if (ti.lengthSq() > 1e-6) pi.add(ti.normalize().multiplyScalar(-err * 0.09));
      if (tj.lengthSq() > 1e-6) pj.add(tj.normalize().multiplyScalar(-err * 0.09));
    }
  }
}

function bondLengthFor(a, b, order) {
  const aa = atomById(a), bb = atomById(b);
  const ra = ELEMENTS[aa?.element]?.radius ?? 0.45;
  const rb = ELEMENTS[bb?.element]?.radius ?? 0.45;
  return (0.84 + ra + rb) * bondLengthScale(order);
}

function connectedComponent(start) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift();
    for (const n of molecule.neighbors(id)) if (!seen.has(n.atomId)) { seen.add(n.atomId); queue.push(n.atomId); }
  }
  return seen;
}

function atomById(id) { return molecule.atoms.find(a => a.id === id); }
function bondBetween(a, b) { return molecule.bonds.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)); }
function bondKey(a, b) { return `${Math.min(a, b)}:${Math.max(a, b)}`; }

function checkDiscovery() {
  const name = molecule.recognizedName();
  const formula = molecule.formula();
  const allSatisfied = molecule.atoms.length > 1 && molecule.atoms.every(atom => {
    const used = molecule.bondOrderForAtom(atom.id);
    return (ATOMIC_MODEL[atom.element]?.preferredValences ?? []).includes(used);
  });
  const signature = `${formula}|${name}|${molecule.bonds.map(b => `${bondKey(b.a,b.b)}=${b.order}`).sort().join(',')}`;
  if (!allSatisfied || !name || name === '自由制作' || name === '未知 / 未登録の構造' || signature === lastCelebrated) return;
  lastCelebrated = signature;
  discoveryFormula.textContent = formula;
  discoveryName.textContent = name;
  discovery.classList.remove('show'); void discovery.offsetWidth; discovery.classList.add('show');
  moleculeGroup.userData.flashUntil = performance.now() + 950;
  if (navigator.vibrate) navigator.vibrate([25, 35, 55]);
}

function refresh() { renderMolecule(); refreshInfo(); checkDiscovery(); }

function refreshInfo() {
  formulaEl.textContent = molecule.formula();
  nameEl.textContent = molecule.recognizedName();
  const validation = molecule.validation();
  statusEl.className = `status ${validation.level}`;
  statusEl.textContent = validation.message;
  const counts = countElements(molecule.atoms);
  countsEl.replaceChildren();
  if (!molecule.atoms.length) countsEl.textContent = '—';
  else for (const symbol of Object.keys(counts).sort()) {
    const span = document.createElement('span'); span.className = 'atom-count'; span.textContent = `${symbol} × ${counts[symbol]}`; countsEl.appendChild(span);
  }
  const selected = atomById(selectedAtomId);
  if (!selected) {
    selectedElementEl.textContent = '—'; selectedValenceEl.textContent = '—'; selectedLimitEl.textContent = '—';
    selectionChip.textContent = molecule.atoms.length ? '原子を近づけると電子配置から結合次数まで自動安定化' : '元素を押して原子を置く';
    return;
  }
  const used = molecule.bondOrderForAtom(selected.id);
  const singles = unpairedElectronCount(selected.element, used);
  const pairs = lonePairCount(selected.element, used);
  selectedElementEl.textContent = `${selected.element} / ${ELEMENTS[selected.element].name}`;
  selectedValenceEl.textContent = `${used} / 目標 ${preferredValence(selected.element, used)}`;
  selectedLimitEl.textContent = `不対電子 ${singles} · 非共有電子対 ${pairs}`;
  selectionChip.textContent = connectedComponent(selected.id).size > 1 ? '分子として一体移動 · 結合を連続タップで切断' : '近づけるだけで最適な結合へ';
}

function renderMolecule() {
  disposeGroup(moleculeGroup);
  const now = performance.now();
  const flash = now < (moleculeGroup.userData.flashUntil || 0);
  const shake = now < (moleculeGroup.userData.shakeUntil || 0);
  moleculeGroup.position.set(shake ? Math.sin(now * 0.12) * 0.025 : 0, 0, 0);
  for (const bond of molecule.bonds) addBondMeshes(bond, flash);
  for (const atom of molecule.atoms) renderAtom(atom, flash);
  renderInteraction();
}

function renderAtom(atom, flash) {
  const placement = placements.get(atom.id); if (!placement) return;
  const cfg = ELEMENTS[atom.element];
  const selected = atom.id === selectedAtomId;
  const core = new THREE.Mesh(new THREE.SphereGeometry(cfg.radius, 32, 24), new THREE.MeshStandardMaterial({
    color: cfg.color, roughness: 0.22, metalness: 0.03,
    emissive: flash ? 0x38bdf8 : selected ? 0x075985 : 0,
    emissiveIntensity: flash ? 0.72 : selected ? 0.42 : 0,
  }));
  core.position.copy(placement.position); core.userData = { atomCore: true, atomId: atom.id }; moleculeGroup.add(core);

  const used = molecule.bondOrderForAtom(atom.id);
  const singles = unpairedElectronCount(atom.element, used);
  const lonePairs = lonePairCount(atom.element, used);
  const totalSites = Math.max(1, singles + lonePairs + molecule.neighbors(atom.id).length);
  const dirs = electronDirections(totalSites);
  const shellR = valenceShellRadius(atom.element, cfg.radius);
  for (let i = 0; i < singles; i++) addElectron(atom.id, placement.position, dirs[i % dirs.length], shellR, selected);
  for (let i = 0; i < lonePairs; i++) addLonePair(placement.position, dirs[(singles + i) % dirs.length], shellR);
}

function addElectron(atomId, origin, direction, shellR, selected) {
  const pos = origin.clone().add(direction.clone().multiplyScalar(shellR));
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(selected ? 0.115 : 0.09, 18, 14), new THREE.MeshStandardMaterial({
    color: hoveredSnap?.atomId === atomId ? 0xfde68a : selected ? 0x7dd3fc : 0xdbeafe,
    emissive: hoveredSnap?.atomId === atomId ? 0xf59e0b : 0x0369a1,
    emissiveIntensity: hoveredSnap?.atomId === atomId ? 1 : selected ? 0.85 : 0.35,
    roughness: 0.18,
  }));
  mesh.position.copy(pos); mesh.userData = { electronAtomId: atomId }; moleculeGroup.add(mesh);
}

function addLonePair(origin, direction, shellR) {
  const center = origin.clone().add(direction.clone().multiplyScalar(shellR));
  const side = perpendicular(direction).multiplyScalar(0.055);
  for (const sign of [-1, 1]) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.047, 10, 8), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 }));
    dot.position.copy(center).add(side.clone().multiplyScalar(sign)); moleculeGroup.add(dot);
  }
}

function electronDirections(count) {
  if (count <= 1) return [new THREE.Vector3(1, 0, 0)];
  if (count === 2) return [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0)];
  if (count === 3) return [0,1,2].map(i => new THREE.Vector3(Math.cos(i*Math.PI*2/3), Math.sin(i*Math.PI*2/3), 0));
  return [new THREE.Vector3(1,1,1), new THREE.Vector3(1,-1,-1), new THREE.Vector3(-1,1,-1), new THREE.Vector3(-1,-1,1)].map(v => v.normalize());
}

function addBondMeshes(bond, flash) {
  const start = placements.get(bond.a)?.position, end = placements.get(bond.b)?.position; if (!start || !end) return;
  const axis = end.clone().sub(start).normalize();
  const side = perpendicular(axis);
  const offsets = bond.order === 1 ? [0] : bond.order === 2 ? [-0.09, 0.09] : [-0.15, 0, 0.15];
  const key = bondKey(bond.a, bond.b);
  for (const offset of offsets) {
    const shift = side.clone().multiplyScalar(offset);
    const mesh = cylinderBetween(start.clone().add(shift), end.clone().add(shift), 0.052, flash ? 0x7dd3fc : 0xcbd5e1, 1);
    mesh.userData = { bondKey: key }; moleculeGroup.add(mesh);
  }
  const center = start.clone().lerp(end, 0.5);
  for (let pair = 0; pair < bond.order; pair++) {
    const lateral = side.clone().multiplyScalar((pair - (bond.order - 1) / 2) * 0.14);
    const pairAxis = perpendicular(axis).multiplyScalar(0.05);
    for (const sign of [-1, 1]) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), new THREE.MeshStandardMaterial({
        color: 0xe0f2fe, emissive: flash ? 0x38bdf8 : 0x1e3a8a, emissiveIntensity: flash ? 1 : 0.35,
      }));
      dot.position.copy(center).add(lateral).add(pairAxis.clone().multiplyScalar(sign));
      dot.userData = { bondKey: key }; moleculeGroup.add(dot);
    }
  }
}

function renderInteraction() {
  disposeGroup(interactionGroup);
  if (electronDrag) {
    const start = placements.get(electronDrag.atomId)?.position; if (!start) return;
    interactionGroup.add(cylinderBetween(start, electronDrag.current, 0.026, hoveredSnap ? 0xfacc15 : 0x38bdf8, 0.8));
  } else if (hoveredSnap && dragState) {
    const a = placements.get(hoveredSnap.a)?.position, b = placements.get(hoveredSnap.b)?.position;
    if (a && b) interactionGroup.add(cylinderBetween(a, b, 0.025, 0xfacc15, 0.55));
  }
}

function cylinderBetween(start, end, radius, color, opacity = 1) {
  const delta = end.clone().sub(start); const len = Math.max(0.001, delta.length());
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.38, transparent: opacity < 1, opacity });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 14), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

function perpendicular(v) {
  const ref = Math.abs(v.y) < 0.85 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
  return new THREE.Vector3().crossVectors(v, ref).normalize();
}

function focusAtom(id) {
  const p = placements.get(id); if (!p) return;
  controls.target.copy(p.position);
  const dir = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(p.position).add(dir.multiplyScalar(2.7));
  controls.update();
  pulse('精密表示 — 電子を直接ドラッグして結合編集できます');
}

function pulse(text) {
  selectionChip.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(refreshInfo, 1800);
}
function capture(e) { try { renderer.domElement.setPointerCapture(e.pointerId); } catch {} }
function release(e) { try { renderer.domElement.releasePointerCapture(e.pointerId); } catch {} }
function setPointer(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}
function rayToPlane(e) {
  setPointer(e); raycaster.setFromCamera(pointer, camera);
  const out = new THREE.Vector3();
  return raycaster.ray.intersectPlane(dragPlane, out) ? out : null;
}
function rayToPlaneThrough(e, point) {
  const normal = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
  setPointer(e); raycaster.setFromCamera(pointer, camera);
  const out = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, out) ? out : null;
}
function disposeGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse(object => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
      else object.material?.dispose?.();
    });
  }
}
function resize() {
  const width = Math.max(1, viewer.clientWidth), height = Math.max(1, viewer.clientHeight);
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
}
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
