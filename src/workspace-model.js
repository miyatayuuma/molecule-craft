import { Molecule, ELEMENTS } from './chemistry.js';

// Topology-only state. Neither recognition nor cleanup depends on the camera.
export function connectedStructures(molecule) {
  const adjacency = new Map(molecule.atoms.map(atom => [atom.id, []]));
  for (const bond of molecule.bonds) {
    adjacency.get(bond.a)?.push(bond.b);
    adjacency.get(bond.b)?.push(bond.a);
  }
  const remaining = new Set(adjacency.keys()), result = [];
  while (remaining.size) {
    const ids = new Set(), queue = [remaining.values().next().value];
    remaining.delete(queue[0]);
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index]; ids.add(id);
      for (const next of adjacency.get(id)) if (remaining.delete(next)) queue.push(next);
    }
    const graph = new Molecule();
    graph.atoms = molecule.atoms.filter(atom => ids.has(atom.id));
    graph.bonds = molecule.bonds.filter(bond => ids.has(bond.a) && ids.has(bond.b));
    const key = [...ids].sort((a, b) => a - b).join(',');
    const signature = `${key}|${graph.bonds.map(bond => `${Math.min(bond.a,bond.b)}:${Math.max(bond.a,bond.b)}:${bond.order}`).sort().join(',')}`;
    const validation = graph.validation();
    result.push({ key, signature, ids, graph, validation,
      complete: graph.bonds.length > 0 && validation.level === 'ok',
      heavyCount: graph.atoms.filter(atom => atom.element !== 'H').length,
      record: graph.recognizedMolecule(), formula: graph.formula() });
  }
  return result;
}

export function chooseMainStructure(structures, previousIds = new Set()) {
  const overlap = item => [...item.ids].filter(id => previousIds.has(id)).length;
  // An abandoned first atom must not remain the framing/cleanup anchor once
  // an actual connected structure exists. Otherwise preserve the working graph.
  const connected = structures.filter(item => item.graph.bonds.length);
  const candidates = connected.length ? connected : structures;
  return [...candidates].sort((a,b) => overlap(b)-overlap(a) || b.heavyCount-a.heavyCount || b.ids.size-a.ids.size || a.graph.atoms[0].id-b.graph.atoms[0].id)[0] ?? null;
}

export function createCompletionTracker() {
  let completed = new Set();
  return {
    update(structures) {
      const current = structures.filter(item => item.complete);
      const newlyCompleted = current.filter(item => !completed.has(item.signature));
      completed = new Set(current.map(item => item.signature));
      return newlyCompleted;
    },
    clear() { completed.clear(); },
  };
}

export const DEBRIS_POLICY = Object.freeze({
  maxAtoms: 8, maxHeavyAtoms: 2,
  // World units: a C–C single bond is about 1.19 units in this model.
  distance: 7, delayMs: 4500, fadeMs: 650, protectionMs: 8000,
});

export function isSmallFragment(item, main, policy = DEBRIS_POLICY) {
  return !!main && item.key !== main.key && !item.complete
    && item.ids.size < main.ids.size && item.ids.size <= policy.maxAtoms
    && item.heavyCount <= policy.maxHeavyAtoms;
}

export function structureDistance(left, right, positionFor) {
  let distance = Infinity;
  for (const a of left.ids) for (const b of right.ids) {
    const p = positionFor(a), q = positionFor(b);
    if (p && q) distance = Math.min(distance, Math.hypot(p.x-q.x, p.y-q.y, p.z-q.z));
  }
  return distance;
}

export function createDebrisTracker(policy = DEBRIS_POLICY) {
  const since = new Map();
  return {
    reset() { since.clear(); },
    update({ structures, main, positionFor, protectedIds = new Set(), now, suspended = false }) {
      const opacity = new Map(), expired = [];
      if (suspended) { since.clear(); return { opacity, expired }; }
      const protectedStructure = item => [...item.ids].some(id => protectedIds.has(id));
      const anchors = structures.filter(item => !isSmallFragment(item, main, policy) || protectedStructure(item));
      const eligible = new Set();
      for (const item of structures) {
        if (!isSmallFragment(item, main, policy) || protectedStructure(item)) continue;
        const distance = Math.min(...anchors.filter(anchor => anchor.key !== item.key).map(anchor => structureDistance(item, anchor, positionFor)));
        if (!Number.isFinite(distance) || distance <= policy.distance) continue;
        eligible.add(item.signature);
        if (!since.has(item.signature)) since.set(item.signature, now);
        const elapsed = now - since.get(item.signature);
        opacity.set(item.key, Math.max(0, 1 - Math.max(0, elapsed-policy.delayMs)/policy.fadeMs));
        if (elapsed >= policy.delayMs + policy.fadeMs) expired.push(item);
      }
      for (const key of since.keys()) if (!eligible.has(key)) since.delete(key);
      return { opacity, expired };
    },
  };
}

// Bounding sphere includes atom radii; using the smaller screen dimension also
// fits portrait phones. Return a target, never mutate camera or atom coordinates.
export function structureFrame(structure, positionFor, verticalFovDeg, aspect, margin = .74) {
  if (!structure) return null;
  const atoms = structure.graph.atoms.map(atom => ({ atom, point: positionFor(atom.id) })).filter(item => item.point);
  if (!atoms.length) return null;
  const min = { x: Infinity, y: Infinity, z: Infinity }, max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const { atom, point } of atoms) for (const axis of ['x','y','z']) {
    const radius = ELEMENTS[atom.element].radius;
    min[axis] = Math.min(min[axis], point[axis]-radius); max[axis] = Math.max(max[axis], point[axis]+radius);
  }
  const center = { x: (min.x+max.x)/2, y: (min.y+max.y)/2, z: (min.z+max.z)/2 };
  const radius = Math.max(.5, ...atoms.map(({atom,point}) => Math.hypot(point.x-center.x,point.y-center.y,point.z-center.z)+ELEMENTS[atom.element].radius));
  const halfAngle = Math.atan(Math.tan(verticalFovDeg*Math.PI/360)*Math.min(1,Math.max(.01,aspect))*margin);
  return { center, radius, distance: radius/Math.sin(halfAngle) };
}
