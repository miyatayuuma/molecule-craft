import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js/+esm';
import { ELEMENTS, Molecule, countElements } from './chemistry.js';

const molecule = new Molecule();
const placements = new Map();
let selectedAtomId = null;
let selectedSlot = null;
let bondOrder = 1;

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
camera.position.set(5.5, 4.2, 7.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.touchAction = 'none';
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 2.5;
controls.maxDistance = 24;

scene.add(new THREE.HemisphereLight(0xffffff, 0x172033, 2.8));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
keyLight.position.set(6, 8, 8);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x8fd3ff, 1.1);
fillLight.position.set(-5, -3, 4);
scene.add(fillLight);

const moleculeGroup = new THREE.Group();
scene.add(moleculeGroup);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerStart = null;

const tetra = [
  new THREE.Vector3(1, 1, 1).normalize(),
  new THREE.Vector3(1, -1, -1).normalize(),
  new THREE.Vector3(-1, 1, -1).normalize(),
  new THREE.Vector3(-1, -1, 1).normalize(),
];

const electronModels = {
  H:  { hands: [new THREE.Vector3(1, 0, 0)], lonePairs: [] },
  C:  { hands: tetra.map(v => v.clone()), lonePairs: [] },
  N:  { hands: tetra.slice(0, 3).map(v => v.clone()), lonePairs: [tetra[3].clone()] },
  O:  { hands: [tetra[0].clone(), tetra[1].clone()], lonePairs: [tetra[2].clone(), tetra[3].clone()] },
  F:  { hands: [tetra[0].clone()], lonePairs: tetra.slice(1).map(v => v.clone()) },
  P:  { hands: tetra.slice(0, 3).map(v => v.clone()), lonePairs: [tetra[3].clone()] },
  S:  { hands: [tetra[0].clone(), tetra[1].clone()], lonePairs: [tetra[2].clone(), tetra[3].clone()] },
  Cl: { hands: [tetra[0].clone()], lonePairs: tetra.slice(1).map(v => v.clone()) },
};

buildPalette();
bindControls();
refresh();
resize();
animate();

function buildPalette() {
  for (const [symbol, element] of Object.entries(ELEMENTS)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'element-button';
    button.textContent = symbol;
    button.title = `${element.name}を追加`;
    button.style.setProperty('--element-color', element.color);
    button.addEventListener('click', () => addAtom(symbol));
    palette.appendChild(button);
  }
}

function bindControls() {
  document.querySelectorAll('.bond-order').forEach(button => {
    button.addEventListener('click', () => {
      bondOrder = Number(button.dataset.order);
      document.querySelectorAll('.bond-order').forEach(item => item.classList.toggle('active', item === button));
      refreshInfo();
    });
  });

  document.querySelector('#delete-selected').addEventListener('click', () => {
    if (selectedAtomId === null) return;
    const id = selectedAtomId;
    molecule.removeAtom(id);
    placements.delete(id);
    for (const placement of placements.values()) {
      for (const [slotIndex, reservation] of placement.used.entries()) {
        if (reservation.otherAtomId === id) placement.used.delete(slotIndex);
      }
    }
    selectedAtomId = null;
    selectedSlot = null;
    refresh();
  });

  document.querySelector('#clear-all').addEventListener('click', () => {
    molecule.clear();
    placements.clear();
    selectedAtomId = null;
    selectedSlot = null;
    refresh();
    controls.target.set(0, 0, 0);
    camera.position.set(5.5, 4.2, 7.5);
    controls.update();
  });

  renderer.domElement.addEventListener('pointerdown', event => {
    pointerStart = { x: event.clientX, y: event.clientY };
  });

  renderer.domElement.addEventListener('pointerup', event => {
    if (!pointerStart) return;
    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    pointerStart = null;
    if (distance > 7) return;
    pickScene(event);
  });

  new ResizeObserver(resize).observe(viewer);
}

function addAtom(symbol) {
  const atom = molecule.addAtom(symbol);
  const model = electronModels[symbol] ?? electronModels.H;

  if (selectedSlot) {
    const parentId = selectedSlot.atomId;
    const parentPlacement = placements.get(parentId);
    if (!parentPlacement) return;

    const parentDir = selectedSlot.worldDirection.clone().normalize();
    const childCanonical = model.hands[0]?.clone() ?? new THREE.Vector3(-1, 0, 0);
    const childQuat = new THREE.Quaternion().setFromUnitVectors(childCanonical, parentDir.clone().negate());
    const parentAtom = molecule.atoms.find(item => item.id === parentId);
    const distance = bondLength(parentAtom?.element ?? 'C', symbol, bondOrder);
    const childPos = parentPlacement.position.clone().add(parentDir.multiplyScalar(distance));

    placements.set(atom.id, { position: childPos, quaternion: childQuat, used: new Map() });
    molecule.setBond(parentId, atom.id, bondOrder);
    reserveBondHands(parentId, selectedSlot.slotIndex, atom.id, bondOrder);
    reserveBondHands(atom.id, 0, parentId, bondOrder);
    selectedAtomId = atom.id;
    selectedSlot = null;
  } else {
    const x = molecule.atoms.length === 1 ? 0 : (molecule.atoms.length - 1) * 1.8;
    placements.set(atom.id, {
      position: new THREE.Vector3(x, 0, 0),
      quaternion: new THREE.Quaternion(),
      used: new Map(),
    });
    selectedAtomId = atom.id;
  }
  refresh();
}

function reserveBondHands(atomId, primarySlot, otherAtomId, order) {
  const placement = placements.get(atomId);
  const atom = molecule.atoms.find(item => item.id === atomId);
  if (!placement || !atom) return;
  const handCount = (electronModels[atom.element]?.hands.length ?? 1);
  const candidates = Array.from({ length: handCount }, (_, i) => i);
  const ordered = [primarySlot, ...candidates.filter(i => i !== primarySlot)];
  let remaining = Math.max(1, order);
  for (const index of ordered) {
    if (remaining <= 0) break;
    if (placement.used.has(index)) continue;
    placement.used.set(index, { otherAtomId, order, primary: index === primarySlot });
    remaining--;
  }
}

function pickScene(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(moleculeGroup.children, true);
  const slotHit = hits.find(hit => hit.object.userData.slotIndex !== undefined);
  if (slotHit) {
    const { atomId, slotIndex } = slotHit.object.userData;
    const atom = molecule.atoms.find(item => item.id === atomId);
    const placement = placements.get(atomId);
    if (!atom || !placement) return;
    const local = electronModels[atom.element].hands[slotIndex].clone();
    const worldDirection = local.applyQuaternion(placement.quaternion).normalize();
    selectedAtomId = atomId;
    selectedSlot = { atomId, slotIndex, worldDirection };
    refresh();
    return;
  }

  const atomHit = hits.find(hit => hit.object.userData.atomId !== undefined);
  if (atomHit) {
    selectedAtomId = atomHit.object.userData.atomId;
    selectedSlot = null;
    refresh();
    return;
  }

  selectedAtomId = null;
  selectedSlot = null;
  refresh();
}

function refresh() {
  renderMolecule();
  refreshInfo();
}

function refreshInfo() {
  formulaEl.textContent = molecule.formula();
  nameEl.textContent = molecule.recognizedName();

  const validation = molecule.validation();
  statusEl.className = `status ${validation.level}`;
  statusEl.textContent = validation.message;

  const counts = countElements(molecule.atoms);
  countsEl.replaceChildren();
  if (!molecule.atoms.length) {
    countsEl.textContent = '—';
  } else {
    Object.keys(counts).sort().forEach(symbol => {
      const item = document.createElement('span');
      item.className = 'atom-count';
      item.textContent = `${symbol} × ${counts[symbol]}`;
      countsEl.appendChild(item);
    });
  }

  const selected = molecule.atoms.find(atom => atom.id === selectedAtomId);
  if (!selected) {
    selectedElementEl.textContent = '—';
    selectedValenceEl.textContent = '—';
    selectedLimitEl.textContent = '—';
    selectionChip.textContent = molecule.atoms.length ? '原子の「手」をタップして結合位置を選択' : '元素を選んで最初の原子を置く';
    return;
  }

  const used = molecule.bondOrderForAtom(selected.id);
  const allowed = ELEMENTS[selected.element].valences;
  const model = electronModels[selected.element];
  selectedElementEl.textContent = `${selected.element} / ${ELEMENTS[selected.element].name}`;
  selectedValenceEl.textContent = String(used);
  selectedLimitEl.textContent = `手 ${model.hands.length}本 / 孤立電子対 ${model.lonePairs.length}組`;

  if (selectedSlot) {
    const bondLabel = bondOrder === 1 ? '単結合' : bondOrder === 2 ? '二重結合' : '三重結合';
    selectionChip.textContent = `位置を選択中 → 付けたい元素を押す（${bondLabel}）`;
  } else {
    selectionChip.textContent = `${selected.element} を選択中 → 光っている「手」をタップ`;
  }
}

function renderMolecule() {
  disposeGroup(moleculeGroup);
  if (!molecule.atoms.length) return;

  for (const bond of molecule.bonds) {
    const pa = placements.get(bond.a)?.position;
    const pb = placements.get(bond.b)?.position;
    if (pa && pb) addBondMeshes(pa, pb, bond.order);
  }

  for (const atom of molecule.atoms) {
    const placement = placements.get(atom.id);
    if (!placement) continue;
    renderAtom(atom, placement);
  }

  const box = new THREE.Box3().setFromObject(moleculeGroup);
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    moleculeGroup.position.copy(center).multiplyScalar(-1);
    controls.target.set(0, 0, 0);
  }
}

function renderAtom(atom, placement) {
  const config = ELEMENTS[atom.element];
  const model = electronModels[atom.element];
  const selected = atom.id === selectedAtomId;

  const geometry = new THREE.SphereGeometry(config.radius, 32, 24);
  const material = new THREE.MeshStandardMaterial({
    color: config.color,
    roughness: 0.25,
    metalness: 0.02,
    emissive: selected ? 0x0b6f9f : 0x000000,
    emissiveIntensity: selected ? 0.45 : 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(placement.position);
  mesh.userData.atomId = atom.id;
  moleculeGroup.add(mesh);

  model.hands.forEach((localDirection, slotIndex) => {
    if (placement.used.has(slotIndex)) return;
    const direction = localDirection.clone().applyQuaternion(placement.quaternion).normalize();
    addBondHand(atom, placement.position, direction, slotIndex, selected);
  });

  model.lonePairs.forEach(localDirection => {
    const direction = localDirection.clone().applyQuaternion(placement.quaternion).normalize();
    addLonePair(placement.position, direction, config.radius);
  });
}

function addBondHand(atom, origin, direction, slotIndex, selected) {
  const radius = ELEMENTS[atom.element].radius;
  const start = origin.clone().add(direction.clone().multiplyScalar(radius * 0.82));
  const end = origin.clone().add(direction.clone().multiplyScalar(radius + 0.55));
  const isChosen = selectedSlot?.atomId === atom.id && selectedSlot?.slotIndex === slotIndex;

  const shaft = cylinderBetween(start, end, selected ? 0.055 : 0.04, isChosen ? 0xfacc15 : selected ? 0x38bdf8 : 0x7b8798);
  shaft.userData.atomId = atom.id;
  shaft.userData.slotIndex = slotIndex;
  moleculeGroup.add(shaft);

  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(selected ? 0.12 : 0.09, 18, 14),
    new THREE.MeshStandardMaterial({
      color: isChosen ? 0xfacc15 : selected ? 0x7dd3fc : 0xaab4c3,
      emissive: isChosen ? 0x8a5a00 : selected ? 0x064e68 : 0x000000,
      emissiveIntensity: isChosen || selected ? 0.6 : 0,
      roughness: 0.3,
    })
  );
  knob.position.copy(end);
  knob.userData.atomId = atom.id;
  knob.userData.slotIndex = slotIndex;
  moleculeGroup.add(knob);
}

function addLonePair(origin, direction, atomRadius) {
  const center = origin.clone().add(direction.clone().multiplyScalar(atomRadius + 0.31));
  const side = perpendicular(direction).multiplyScalar(0.065);
  for (const sign of [-1, 1]) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })
    );
    dot.position.copy(center).add(side.clone().multiplyScalar(sign));
    moleculeGroup.add(dot);
  }
}

function addBondMeshes(start, end, order) {
  const axis = end.clone().sub(start).normalize();
  let side = perpendicular(axis);
  const offsets = order === 1 ? [0] : order === 2 ? [-0.09, 0.09] : [-0.15, 0, 0.15];
  for (const offset of offsets) {
    const shift = side.clone().multiplyScalar(offset);
    moleculeGroup.add(cylinderBetween(start.clone().add(shift), end.clone().add(shift), 0.055, 0xcbd5e1));
  }
}

function cylinderBetween(start, end, radius, color) {
  const delta = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, Math.max(0.01, delta.length()), 14),
    new THREE.MeshStandardMaterial({ color, roughness: 0.42 })
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  return mesh;
}

function bondLength(a, b, order) {
  const ra = ELEMENTS[a]?.radius ?? 0.45;
  const rb = ELEMENTS[b]?.radius ?? 0.45;
  const base = 1.2 + ra + rb;
  if (order === 2) return base * 0.91;
  if (order === 3) return base * 0.86;
  return base;
}

function perpendicular(direction) {
  const candidate = Math.abs(direction.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3().crossVectors(direction, candidate).normalize();
}

function disposeGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse(object => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach(item => item.dispose?.());
      else object.material?.dispose?.();
    });
  }
}

function resize() {
  const width = Math.max(1, viewer.clientWidth);
  const height = Math.max(1, viewer.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
