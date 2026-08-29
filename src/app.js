import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js/+esm';
import { ELEMENTS, Molecule, countElements } from './chemistry.js';

const molecule = new Molecule();
let selectedAtomId = null;
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
camera.position.set(4.8, 3.6, 6.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 2.5;
controls.maxDistance = 22;

scene.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 2.5));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(5, 7, 8);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x7dd3fc, 1.2);
fillLight.position.set(-6, -2, 4);
scene.add(fillLight);

const moleculeGroup = new THREE.Group();
scene.add(moleculeGroup);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerStart = null;

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
    button.title = element.name;
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
    });
  });

  document.querySelector('#delete-selected').addEventListener('click', () => {
    if (selectedAtomId === null) return;
    molecule.removeAtom(selectedAtomId);
    selectedAtomId = null;
    refresh();
  });

  document.querySelector('#clear-all').addEventListener('click', () => {
    molecule.clear();
    selectedAtomId = null;
    refresh();
    controls.target.set(0, 0, 0);
    camera.position.set(4.8, 3.6, 6.8);
    controls.update();
  });

  renderer.domElement.addEventListener('pointerdown', event => {
    pointerStart = { x: event.clientX, y: event.clientY };
  });

  renderer.domElement.addEventListener('pointerup', event => {
    if (!pointerStart) return;
    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    pointerStart = null;
    if (distance > 6) return;
    pickAtom(event);
  });

  const observer = new ResizeObserver(resize);
  observer.observe(viewer);
}

function addAtom(symbol) {
  const atom = molecule.addAtom(symbol);
  if (selectedAtomId !== null) {
    molecule.setBond(selectedAtomId, atom.id, bondOrder);
  }
  selectedAtomId = atom.id;
  refresh();
}

function pickAtom(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(moleculeGroup.children, true);
  const hit = hits.find(result => result.object.userData.atomId !== undefined);
  if (!hit) {
    selectedAtomId = null;
    refresh();
    return;
  }

  const clickedId = hit.object.userData.atomId;
  if (selectedAtomId === null) {
    selectedAtomId = clickedId;
  } else if (selectedAtomId === clickedId) {
    selectedAtomId = null;
  } else {
    molecule.setBond(selectedAtomId, clickedId, bondOrder);
    selectedAtomId = clickedId;
  }
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
    selectionChip.textContent = '原子を選択してください';
    return;
  }

  const used = molecule.bondOrderForAtom(selected.id);
  const allowed = ELEMENTS[selected.element].valences;
  selectedElementEl.textContent = `${selected.element} / ${ELEMENTS[selected.element].name}`;
  selectedValenceEl.textContent = String(used);
  selectedLimitEl.textContent = allowed.join(' / ');
  selectionChip.textContent = `${selected.element} を選択中 · 次の原子と ${bondOrder === 1 ? '単' : bondOrder === 2 ? '二重' : '三重'}結合`;
}

function renderMolecule() {
  while (moleculeGroup.children.length) {
    const child = moleculeGroup.children.pop();
    child.traverse(object => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
      else object.material?.dispose?.();
    });
  }

  if (!molecule.atoms.length) return;

  const positions = layoutMolecule();

  for (const bond of molecule.bonds) {
    const a = positions.get(bond.a);
    const b = positions.get(bond.b);
    if (!a || !b) continue;
    addBondMeshes(a, b, bond.order);
  }

  for (const atom of molecule.atoms) {
    const config = ELEMENTS[atom.element];
    const geometry = new THREE.SphereGeometry(config.radius, 32, 22);
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.28,
      metalness: 0.03,
      emissive: atom.id === selectedAtomId ? 0x0ea5e9 : 0x000000,
      emissiveIntensity: atom.id === selectedAtomId ? 0.7 : 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(positions.get(atom.id));
    mesh.userData.atomId = atom.id;
    moleculeGroup.add(mesh);
  }

  const box = new THREE.Box3().setFromObject(moleculeGroup);
  const center = box.getCenter(new THREE.Vector3());
  moleculeGroup.position.sub(center);
  controls.target.set(0, 0, 0);
}

function addBondMeshes(start, end, order) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length === 0) return;

  const axis = direction.clone().normalize();
  let side = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0));
  if (side.lengthSq() < 0.01) side = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(1, 0, 0));
  side.normalize();

  const offsets = order === 1 ? [0] : order === 2 ? [-0.095, 0.095] : [-0.15, 0, 0.15];
  offsets.forEach(offset => {
    const shift = side.clone().multiplyScalar(offset);
    const a = start.clone().add(shift);
    const b = end.clone().add(shift);
    moleculeGroup.add(cylinderBetween(a, b, 0.055));
  });
}

function cylinderBetween(start, end, radius) {
  const delta = new THREE.Vector3().subVectors(end, start);
  const geometry = new THREE.CylinderGeometry(radius, radius, delta.length(), 14);
  const material = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.45 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  return mesh;
}

function layoutMolecule() {
  const positions = new Map();
  const visited = new Set();
  const atomsById = new Map(molecule.atoms.map(atom => [atom.id, atom]));
  const components = connectedComponents();
  let componentOffset = 0;

  for (const component of components) {
    const rootId = [...component].sort((a, b) => scoreRoot(b) - scoreRoot(a))[0];
    positions.set(rootId, new THREE.Vector3(componentOffset, 0, 0));
    visited.add(rootId);

    const queue = [{ id: rootId, parentId: null }];
    while (queue.length) {
      const { id, parentId } = queue.shift();
      const atom = atomsById.get(id);
      const current = positions.get(id);
      const neighbors = molecule.neighbors(id);
      const pending = neighbors.filter(n => !visited.has(n.atomId));
      if (!pending.length) continue;

      const directions = childDirections(atom.element, neighbors.length, pending.length, parentId === null ? null : positions.get(parentId), current);
      pending.forEach((neighbor, index) => {
        const neighborAtom = atomsById.get(neighbor.atomId);
        const length = bondLength(atom.element, neighborAtom.element, neighbor.order);
        const position = current.clone().add(directions[index].clone().multiplyScalar(length));
        positions.set(neighbor.atomId, position);
        visited.add(neighbor.atomId);
        queue.push({ id: neighbor.atomId, parentId: id });
      });
    }

    for (const id of component) {
      if (!positions.has(id)) {
        positions.set(id, new THREE.Vector3(componentOffset, 0, 0));
      }
    }

    const componentBox = new THREE.Box3();
    component.forEach(id => componentBox.expandByPoint(positions.get(id)));
    componentOffset += Math.max(3.2, componentBox.getSize(new THREE.Vector3()).x + 2.6);
  }

  relaxCollisions(positions);
  return positions;
}

function connectedComponents() {
  const remaining = new Set(molecule.atoms.map(atom => atom.id));
  const result = [];
  while (remaining.size) {
    const start = remaining.values().next().value;
    const component = new Set([start]);
    const queue = [start];
    remaining.delete(start);
    while (queue.length) {
      const id = queue.shift();
      for (const neighbor of molecule.neighbors(id)) {
        if (!remaining.has(neighbor.atomId)) continue;
        remaining.delete(neighbor.atomId);
        component.add(neighbor.atomId);
        queue.push(neighbor.atomId);
      }
    }
    result.push(component);
  }
  return result;
}

function scoreRoot(id) {
  const atom = molecule.atoms.find(item => item.id === id);
  const degree = molecule.neighbors(id).length;
  return degree * 10 + (atom?.element === 'H' ? 0 : 5);
}

function childDirections(element, totalNeighbors, childCount, parentPosition, currentPosition) {
  if (parentPosition === null) {
    return rootDirections(element, totalNeighbors).slice(0, childCount);
  }

  const away = currentPosition.clone().sub(parentPosition).normalize();
  const basisA = perpendicular(away);
  const basisB = new THREE.Vector3().crossVectors(away, basisA).normalize();
  const angleFromAway = branchAngleFromAway(element, totalNeighbors);
  const cos = Math.cos(angleFromAway);
  const sin = Math.sin(angleFromAway);

  if (childCount === 1) {
    return [away.clone().multiplyScalar(cos).add(basisA.clone().multiplyScalar(sin)).normalize()];
  }

  return Array.from({ length: childCount }, (_, index) => {
    const phi = (index / childCount) * Math.PI * 2;
    return away.clone().multiplyScalar(cos)
      .add(basisA.clone().multiplyScalar(Math.cos(phi) * sin))
      .add(basisB.clone().multiplyScalar(Math.sin(phi) * sin))
      .normalize();
  });
}

function rootDirections(element, count) {
  if (count <= 1) return [new THREE.Vector3(1, 0, 0)];

  if (element === 'O' && count === 2) {
    const half = THREE.MathUtils.degToRad(104.5 / 2);
    return [
      new THREE.Vector3(Math.cos(half), Math.sin(half), 0),
      new THREE.Vector3(Math.cos(half), -Math.sin(half), 0),
    ];
  }

  if (element === 'N' && count === 3) {
    const z = 0.34;
    const r = Math.sqrt(1 - z * z);
    return [0, 1, 2].map(i => new THREE.Vector3(r * Math.cos(i * Math.PI * 2 / 3), r * Math.sin(i * Math.PI * 2 / 3), z));
  }

  if (count === 2) return [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)];
  if (count === 3) {
    return [0, 1, 2].map(i => new THREE.Vector3(Math.cos(i * Math.PI * 2 / 3), Math.sin(i * Math.PI * 2 / 3), 0));
  }

  if (count >= 4) {
    return [
      new THREE.Vector3(1, 1, 1).normalize(),
      new THREE.Vector3(1, -1, -1).normalize(),
      new THREE.Vector3(-1, 1, -1).normalize(),
      new THREE.Vector3(-1, -1, 1).normalize(),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];
  }

  return [new THREE.Vector3(1, 0, 0)];
}

function branchAngleFromAway(element, totalNeighbors) {
  if (element === 'O' && totalNeighbors === 2) return THREE.MathUtils.degToRad(75.5);
  if (element === 'N' && totalNeighbors === 3) return THREE.MathUtils.degToRad(73);
  if (totalNeighbors <= 2) return 0;
  if (totalNeighbors === 3) return THREE.MathUtils.degToRad(60);
  return THREE.MathUtils.degToRad(70.5);
}

function perpendicular(vector) {
  const candidate = Math.abs(vector.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3().crossVectors(vector, candidate).normalize();
}

function bondLength(a, b, order) {
  const radii = ELEMENTS[a].radius + ELEMENTS[b].radius;
  const orderFactor = order === 1 ? 1 : order === 2 ? 0.91 : 0.85;
  return Math.max(1.05, radii * 1.75 * orderFactor);
}

function relaxCollisions(positions) {
  const ids = [...positions.keys()];
  for (let pass = 0; pass < 12; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = positions.get(ids[i]);
        const b = positions.get(ids[j]);
        const delta = b.clone().sub(a);
        const distance = delta.length();
        if (distance >= 0.72 || distance < 0.0001) continue;
        const push = delta.normalize().multiplyScalar((0.72 - distance) * 0.18);
        a.sub(push);
        b.add(push);
      }
    }
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
