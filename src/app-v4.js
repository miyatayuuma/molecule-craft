import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js/+esm';
import { ELEMENTS, Molecule, countElements } from './chemistry.js';

const molecule = new Molecule();
const placements = new Map();
let selectedAtomId = null;
let dragState = null;
let electronDrag = null;
let hoveredSnap = null;
let lastTap = { kind: null, key: null, time: 0 };
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
const key = new THREE.DirectionalLight(0xffffff, 3.4); key.position.set(7, 9, 8); scene.add(key);
const rim = new THREE.DirectionalLight(0x8fd3ff, 1.25); rim.position.set(-6, -3, 4); scene.add(rim);

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
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'element-button'; b.textContent = symbol;
    b.title = `${element.name}を置く`; b.style.setProperty('--element-color', element.color);
    b.addEventListener('click', () => addFreeAtom(symbol));
    palette.appendChild(b);
  }
}

function bindUI() {
  document.querySelector('#delete-selected')?.addEventListener('click', () => {
    if (selectedAtomId == null) return;
    const component = connectedComponent(selectedAtomId);
    if (component.size > 1) {
      pulse('結合中の原子は共有電子対をダブルタップして分離できます');
      return;
    }
    molecule.removeAtom(selectedAtomId); placements.delete(selectedAtomId); selectedAtomId = null; refresh();
  });
  document.querySelector('#clear-all')?.addEventListener('click', () => {
    molecule.clear(); placements.clear(); selectedAtomId = null; electronDrag = null; dragState = null; hoveredSnap = null; lastCelebrated = '';
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
  selectedAtomId = atom.id; refresh();
}

function onPointerDown(e) {
  setPointer(e); raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(moleculeGroup.children, true);
  const bondHit = hits.find(h => h.object.userData.bondKey);
  if (bondHit) {
    const key = bondHit.object.userData.bondKey;
    const now = performance.now();
    if (lastTap.kind === 'bond' && lastTap.key === key && now - lastTap.time < 360) {
      breakBond(key); lastTap = { kind: null, key: null, time: 0 }; return;
    }
    lastTap = { kind: 'bond', key, time: now };
  }
  const electronHit = hits.find(h => h.object.userData.electronAtomId !== undefined);
  if (electronHit) {
    electronDrag = { atomId: electronHit.object.userData.electronAtomId, current: electronHit.point.clone() };
    selectedAtomId = electronDrag.atomId; controls.enabled = false; capture(e); refresh(); return;
  }
  const atomHit = hits.find(h => h.object.userData.atomCore);
  if (atomHit) {
    const atomId = atomHit.object.userData.atomId; selectedAtomId = atomId;
    const now = performance.now();
    if (lastTap.kind === 'atom' && lastTap.key === atomId && now - lastTap.time < 330) {
      focusAtom(atomId); lastTap = { kind: null, key: null, time: 0 }; refresh(); return;
    }
    lastTap = { kind: 'atom', key: atomId, time: now };
    const component = [...connectedComponent(atomId)];
    const normal = camera.getWorldDirection(new THREE.Vector3()).normalize();
    dragPlane.setFromNormalAndCoplanarPoint(normal, placements.get(atomId).position);
    const world = rayToPlane(e);
    if (world) {
      dragState = {
        atomId,
        component,
        startWorld: world.clone(),
        starts: new Map(component.map(id => [id, placements.get(id).position.clone()])),
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
      };
      controls.enabled = false; capture(e);
    }
    refresh(); return;
  }
  selectedAtomId = null; refreshInfo();
}

function onPointerMove(e) {
  if (electronDrag) {
    const p = rayToPlaneThrough(e, placements.get(electronDrag.atomId)?.position ?? new THREE.Vector3());
    if (p) electronDrag.current.copy(p);
    hoveredSnap = findElectronTarget(electronDrag.atomId, electronDrag.current);
    renderInteraction(); return;
  }
  if (!dragState) return;
  const world = rayToPlane(e); if (!world) return;
  const delta = world.clone().sub(dragState.startWorld);
  for (const id of dragState.component) placements.get(id).position.copy(dragState.starts.get(id)).add(delta);
  dragState.moved ||= Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY) > 4;
  hoveredSnap = findAutoBondCandidate(dragState.component);
  renderMolecule();
}

function onPointerUp(e) {
  if (electronDrag) {
    const target = hoveredSnap ?? findElectronTarget(electronDrag.atomId, electronDrag.current);
    if (target) formBond(electronDrag.atomId, target.atomId);
    electronDrag = null; hoveredSnap = null; controls.enabled = true; release(e); refresh(); return;
  }
  if (dragState) {
    const candidate = hoveredSnap ?? findAutoBondCandidate(dragState.component);
    if (candidate) formBond(candidate.a, candidate.b);
    dragState = null; hoveredSnap = null; controls.enabled = true; release(e); refresh();
  }
}

function cancelInteraction(e) { electronDrag = null; dragState = null; hoveredSnap = null; controls.enabled = true; release(e); refresh(); }
function capture(e) { try { renderer.domElement.setPointerCapture(e.pointerId); } catch {} }
function release(e) { try { renderer.domElement.releasePointerCapture(e.pointerId); } catch {} }

function findAutoBondCandidate(movingIds) {
  let best = null;
  for (const a of movingIds) {
    if (freeValence(a) < 1) continue;
    for (const atom of molecule.atoms) {
      const b = atom.id;
      if (movingIds.includes(b) || freeValence(b) < 1) continue;
      if (bondBetween(a, b)) continue;
      const d = placements.get(a).position.distanceTo(placements.get(b).position);
      const threshold = bondLengthFor(a, b, 1) * 1.42;
      if (d < threshold && (!best || d < best.distance)) best = { a, b, atomId: b, distance: d };
    }
  }
  return best;
}

function findElectronTarget(sourceId, point) {
  let best = null;
  for (const atom of molecule.atoms) {
    if (atom.id === sourceId || freeValence(atom.id) < 1) continue;
    const d = placements.get(atom.id).position.distanceTo(point);
    if (d < 0.95 && (!best || d < best.distance)) best = { atomId: atom.id, distance: d };
  }
  return best;
}

function formBond(a, b) {
  if (a === b || freeValence(a) < 1 || freeValence(b) < 1) return;
  const existing = bondBetween(a, b);
  const nextOrder = existing ? existing.order + 1 : 1;
  if (nextOrder > 3) return;
  if (freeValence(a) < 1 || freeValence(b) < 1) return;
  molecule.setBond(a, b, nextOrder);
  settleMolecule(26);
  selectedAtomId = b;
  pulse(nextOrder === 1 ? 'カチッ — 共有電子対ができました' : nextOrder === 2 ? '二重結合になりました' : '三重結合になりました');
  if (navigator.vibrate) navigator.vibrate(nextOrder === 1 ? 18 : [14, 24, 14]);
  checkDiscovery();
}

function breakBond(key) {
  const [a, b] = key.split(':').map(Number);
  const bond = bondBetween(a, b); if (!bond) return;
  if (bond.order > 1) molecule.setBond(a, b, bond.order - 1); else molecule.removeBond(a, b);
  settleMolecule(18);
  pulse(bond.order === 3 ? '共有電子対を1組ほどきました — 二重結合' : bond.order === 2 ? '共有電子対を1組ほどきました — 単結合' : '結合が切れて分離しました');
  lastCelebrated = ''; refresh();
}

function settleMolecule(iterations = 18) {
  for (let k = 0; k < iterations; k++) {
    for (const bond of molecule.bonds) {
      const pa = placements.get(bond.a).position, pb = placements.get(bond.b).position;
      const delta = pb.clone().sub(pa); const dist = Math.max(0.001, delta.length());
      const target = bondLengthFor(bond.a, bond.b, bond.order);
      const correction = delta.normalize().multiplyScalar((dist - target) * 0.34);
      if (degree(bond.a) > 1) pb.sub(correction); else { pa.add(correction.clone().multiplyScalar(0.5)); pb.sub(correction.clone().multiplyScalar(0.5)); }
    }
    for (const center of molecule.atoms) {
      const neighbors = molecule.neighbors(center.id).map(n => n.atomId);
      if (neighbors.length < 2) continue;
      const c = placements.get(center.id).position;
      const targetCos = neighbors.length === 2 ? targetCosFor(center.element) : neighbors.length === 3 ? -0.5 : -1 / 3;
      for (let i = 0; i < neighbors.length; i++) for (let j = i + 1; j < neighbors.length; j++) {
        const pi = placements.get(neighbors[i]).position, pj = placements.get(neighbors[j]).position;
        const vi = pi.clone().sub(c).normalize(), vj = pj.clone().sub(c).normalize();
        const err = vi.dot(vj) - targetCos;
        if (Math.abs(err) < 0.015) continue;
        const tangentI = vj.clone().sub(vi.clone().multiplyScalar(vi.dot(vj))).normalize().multiplyScalar(err * 0.055);
        const tangentJ = vi.clone().sub(vj.clone().multiplyScalar(vj.dot(vi))).normalize().multiplyScalar(err * 0.055);
        pi.add(tangentI.multiplyScalar(-1)); pj.add(tangentJ.multiplyScalar(-1));
      }
    }
  }
}

function targetCosFor(element) { return element === 'O' ? Math.cos(THREE.MathUtils.degToRad(104.5)) : -1; }
function bondLengthFor(a, b, order) {
  const aa = molecule.atoms.find(x => x.id === a), bb = molecule.atoms.find(x => x.id === b);
  const ra = ELEMENTS[aa?.element]?.radius ?? .45, rb = ELEMENTS[bb?.element]?.radius ?? .45;
  const base = 1.05 + ra + rb;
  return order === 2 ? base * .91 : order === 3 ? base * .86 : base;
}
function maxValence(id) { const atom = molecule.atoms.find(x => x.id === id); return atom ? Math.max(...ELEMENTS[atom.element].valences) : 0; }
function freeValence(id) { return Math.max(0, maxValence(id) - molecule.bondOrderForAtom(id)); }
function degree(id) { return molecule.neighbors(id).length; }
function bondBetween(a, b) { return molecule.bonds.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)); }
function bondKey(a, b) { return `${Math.min(a, b)}:${Math.max(a, b)}`; }

function connectedComponent(start) {
  const seen = new Set([start]), q = [start];
  while (q.length) {
    const id = q.shift();
    for (const n of molecule.neighbors(id)) if (!seen.has(n.atomId)) { seen.add(n.atomId); q.push(n.atomId); }
  }
  return seen;
}

function checkDiscovery() {
  const name = molecule.recognizedName();
  const formula = molecule.formula();
  const allSatisfied = molecule.atoms.length > 1 && molecule.atoms.every(a => {
    const used = molecule.bondOrderForAtom(a.id);
    return ELEMENTS[a.element].valences.includes(used);
  });
  const signature = `${formula}|${name}|${molecule.bonds.map(b => `${bondKey(b.a,b.b)}=${b.order}`).sort().join(',')}`;
  if (!allSatisfied || !name || name === '自由制作' || signature === lastCelebrated) return;
  lastCelebrated = signature;
  discoveryFormula.textContent = formula;
  discoveryName.textContent = name;
  discovery.classList.remove('show'); void discovery.offsetWidth; discovery.classList.add('show');
  moleculeGroup.userData.flashUntil = performance.now() + 900;
  if (navigator.vibrate) navigator.vibrate([25, 35, 55]);
}

function refresh() { renderMolecule(); refreshInfo(); checkDiscovery(); }
function refreshInfo() {
  formulaEl.textContent = molecule.formula(); nameEl.textContent = molecule.recognizedName();
  const validation = molecule.validation(); statusEl.className = `status ${validation.level}`; statusEl.textContent = validation.message;
  const counts = countElements(molecule.atoms); countsEl.replaceChildren();
  if (!molecule.atoms.length) countsEl.textContent = '—';
  else for (const symbol of Object.keys(counts).sort()) { const s = document.createElement('span'); s.className = 'atom-count'; s.textContent = `${symbol} × ${counts[symbol]}`; countsEl.appendChild(s); }
  const selected = molecule.atoms.find(a => a.id === selectedAtomId);
  if (!selected) {
    selectedElementEl.textContent = '—'; selectedValenceEl.textContent = '—'; selectedLimitEl.textContent = '—';
    selectionChip.textContent = molecule.atoms.length ? '原子を近づけると不対電子が自動で結合' : '元素を押して原子を置く'; return;
  }
  const used = molecule.bondOrderForAtom(selected.id), free = freeValence(selected.id);
  selectedElementEl.textContent = `${selected.element} / ${ELEMENTS[selected.element].name}`;
  selectedValenceEl.textContent = `${used} / 最大 ${maxValence(selected.id)}`;
  selectedLimitEl.textContent = `不対電子 ${free}個`;
  selectionChip.textContent = connectedComponent(selected.id).size > 1 ? '分子としてまとめて移動 · 共有電子対をダブルタップでほどく' : '別の原子へ近づけると自動結合';
}

function renderMolecule() {
  disposeGroup(moleculeGroup);
  const flash = performance.now() < (moleculeGroup.userData.flashUntil || 0);
  for (const bond of molecule.bonds) addBondMeshes(bond, flash);
  for (const atom of molecule.atoms) renderAtom(atom, flash);
  renderInteraction();
}

function renderAtom(atom, flash) {
  const p = placements.get(atom.id); if (!p) return;
  const cfg = ELEMENTS[atom.element], selected = atom.id === selectedAtomId;
  const core = new THREE.Mesh(new THREE.SphereGeometry(cfg.radius, 32, 24), new THREE.MeshStandardMaterial({
    color: cfg.color, roughness: .22, metalness: .03,
    emissive: flash ? 0x38bdf8 : selected ? 0x075985 : 0,
    emissiveIntensity: flash ? .7 : selected ? .42 : 0,
  }));
  core.position.copy(p.position); core.userData = { atomCore: true, atomId: atom.id }; moleculeGroup.add(core);
  const free = freeValence(atom.id), dirs = electronDirections(atom.element, Math.max(free, 1));
  for (let i = 0; i < free; i++) {
    const dir = dirs[i % dirs.length];
    const ep = p.position.clone().add(dir.clone().multiplyScalar(cfg.radius + .38));
    const e = new THREE.Mesh(new THREE.SphereGeometry(selected ? .12 : .095, 18, 14), new THREE.MeshStandardMaterial({
      color: hoveredSnap?.atomId === atom.id ? 0xfde68a : selected ? 0x7dd3fc : 0xdbeafe,
      emissive: hoveredSnap?.atomId === atom.id ? 0xf59e0b : 0x0369a1,
      emissiveIntensity: hoveredSnap?.atomId === atom.id ? 1 : selected ? .85 : .35, roughness: .18,
    }));
    e.position.copy(ep); e.userData = { electronAtomId: atom.id }; moleculeGroup.add(e);
  }
  renderLonePairs(atom, p.position, dirs);
}

function electronDirections(element, count) {
  if (count <= 1) return [new THREE.Vector3(1, 0, 0)];
  if (count === 2 && element === 'O') { const h = THREE.MathUtils.degToRad(52.25); return [new THREE.Vector3(Math.cos(h), Math.sin(h), 0), new THREE.Vector3(Math.cos(h), -Math.sin(h), 0)]; }
  if (count === 2) return [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0)];
  if (count === 3) return [0,1,2].map(i => new THREE.Vector3(Math.cos(i*Math.PI*2/3), Math.sin(i*Math.PI*2/3), 0));
  return [new THREE.Vector3(1,1,1),new THREE.Vector3(1,-1,-1),new THREE.Vector3(-1,1,-1),new THREE.Vector3(-1,-1,1)].map(v=>v.normalize());
}

function renderLonePairs(atom, origin, dirs) {
  const valencePairs = atom.element === 'O' ? 2 : ['F','Cl'].includes(atom.element) ? 3 : atom.element === 'N' ? 1 : 0;
  if (!valencePairs) return;
  const cfg = ELEMENTS[atom.element];
  const lpDirs = electronDirections(atom.element, Math.max(4, valencePairs + freeValence(atom.id))).slice(-valencePairs);
  for (const dir of lpDirs) {
    const center = origin.clone().add(dir.clone().multiplyScalar(cfg.radius + .28));
    const side = perpendicular(dir).multiplyScalar(.055);
    for (const s of [-1,1]) { const dot = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: .4 })); dot.position.copy(center).add(side.clone().multiplyScalar(s)); moleculeGroup.add(dot); }
  }
}

function addBondMeshes(bond, flash) {
  const start = placements.get(bond.a)?.position, end = placements.get(bond.b)?.position; if (!start || !end) return;
  const axis = end.clone().sub(start).normalize(), side = perpendicular(axis);
  const offsets = bond.order === 1 ? [0] : bond.order === 2 ? [-.09,.09] : [-.15,0,.15];
  const key = bondKey(bond.a, bond.b);
  for (const off of offsets) {
    const shift = side.clone().multiplyScalar(off);
    const mesh = cylinderBetween(start.clone().add(shift), end.clone().add(shift), .052, flash ? 0x7dd3fc : 0xcbd5e1, 1);
    mesh.userData = { bondKey: key }; moleculeGroup.add(mesh);
  }
  const center = start.clone().lerp(end, .5);
  for (let pair = 0; pair < bond.order; pair++) {
    const lateral = side.clone().multiplyScalar((pair - (bond.order - 1) / 2) * .14);
    const pairAxis = perpendicular(axis).multiplyScalar(.05);
    for (const s of [-1,1]) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(.055, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: flash ? 0x38bdf8 : 0x1e3a8a, emissiveIntensity: flash ? 1 : .35 }));
      dot.position.copy(center).add(lateral).add(pairAxis.clone().multiplyScalar(s)); dot.userData = { bondKey: key }; moleculeGroup.add(dot);
    }
  }
}

function renderInteraction() {
  disposeGroup(interactionGroup);
  if (electronDrag) {
    const start = placements.get(electronDrag.atomId)?.position; if (!start) return;
    interactionGroup.add(cylinderBetween(start, electronDrag.current, .026, hoveredSnap ? 0xfacc15 : 0x38bdf8, .8));
  } else if (hoveredSnap && dragState) {
    const a = placements.get(hoveredSnap.a)?.position, b = placements.get(hoveredSnap.b)?.position;
    if (a && b) interactionGroup.add(cylinderBetween(a,b,.025,0xfacc15,.55));
  }
}

function cylinderBetween(start, end, radius, color, opacity = 1) {
  const delta = end.clone().sub(start); const len = Math.max(.001, delta.length());
  const mat = new THREE.MeshStandardMaterial({ color, roughness: .38, transparent: opacity < 1, opacity });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 14), mat);
  mesh.position.copy(start).add(end).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), delta.normalize()); return mesh;
}
function perpendicular(v) { const ref = Math.abs(v.y) < .85 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0); return new THREE.Vector3().crossVectors(v, ref).normalize(); }

function focusAtom(id) { const p = placements.get(id); if (!p) return; controls.target.copy(p.position); const dir = camera.position.clone().sub(controls.target).normalize(); camera.position.copy(p.position).add(dir.multiplyScalar(2.8)); controls.update(); pulse('精密表示 — 電子を直接ドラッグしても結合できます'); }
function pulse(text) { selectionChip.textContent = text; clearTimeout(toastTimer); toastTimer = setTimeout(refreshInfo, 1700); }
function setPointer(e) { const r = renderer.domElement.getBoundingClientRect(); pointer.x = ((e.clientX-r.left)/r.width)*2-1; pointer.y = -((e.clientY-r.top)/r.height)*2+1; }
function rayToPlane(e) { setPointer(e); raycaster.setFromCamera(pointer,camera); const out = new THREE.Vector3(); return raycaster.ray.intersectPlane(dragPlane,out) ? out : null; }
function rayToPlaneThrough(e, point) { const normal = camera.getWorldDirection(new THREE.Vector3()).normalize(); const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point); setPointer(e); raycaster.setFromCamera(pointer,camera); const out = new THREE.Vector3(); return raycaster.ray.intersectPlane(plane,out) ? out : null; }
function disposeGroup(group) { while (group.children.length) { const child = group.children.pop(); child.traverse(o => { o.geometry?.dispose?.(); if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose?.()); else o.material?.dispose?.(); }); } }
function resize() { const w = Math.max(1, viewer.clientWidth), h = Math.max(1, viewer.clientHeight); renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene,camera); }
