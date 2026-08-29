export function createStructureSolver({
  THREE,
  molecule,
  placements,
  atomById,
  bondBetween,
  bondLengthFor,
  geometryFor,
  radiusFor,
}) {
  let dirty = true;
  let cycles = [];
  let aromaticCycles = [];
  let aromaticEdges = new Set();
  let doubleFrames = new Map();
  let aromaticFrames = new Map();
  let stericExclusions = new Set();

  const pos = id => placements.get(id)?.position;
  const pairKey = (a, b) => `${Math.min(a, b)}:${Math.max(a, b)}`;

  function markTopologyDirty() {
    dirty = true;
  }

  function rebuildTopology() {
    cycles = findCycles(8);
    aromaticCycles = cycles.filter(isAromaticSixCarbonCycle);
    aromaticEdges = new Set();
    for (const cycle of aromaticCycles) cycle.forEach((id, index) => aromaticEdges.add(pairKey(id, cycle[(index + 1) % cycle.length])));

    const nextDoubleFrames = new Map();
    for (const bond of molecule.bonds) {
      const key = pairKey(bond.a, bond.b);
      if (bond.order !== 2 || aromaticEdges.has(key)) continue;
      const atomIds = planarSubstituentGroup(bond);
      const previous = doubleFrames.get(key);
      nextDoubleFrames.set(key, {
        key,
        bond: { a: bond.a, b: bond.b },
        atomIds,
        normal: previous && sameMembers(previous.atomIds, atomIds) ? previous.normal.clone() : doublePlaneNormal(bond, atomIds),
      });
    }
    doubleFrames = nextDoubleFrames;

    const nextAromaticFrames = new Map();
    for (const cycle of aromaticCycles) {
      const key = canonicalCycleKey(cycle);
      const atomIds = aromaticPlanarGroup(cycle);
      const previous = aromaticFrames.get(key);
      nextAromaticFrames.set(key, {
        key,
        cycle: [...cycle],
        atomIds,
        normal: previous && sameMembers(previous.atomIds, atomIds) ? previous.normal.clone() : cycleNormal(cycle),
      });
    }
    aromaticFrames = nextAromaticFrames;
    stericExclusions = buildStericExclusions();
    dirty = false;
  }

  function step(scale = 0.5, passes = 1, options = {}) {
    if (dirty) rebuildTopology();
    const locked = options.lockedIds ?? new Set();
    let maxMove = 0;
    for (let pass = 0; pass < passes; pass++) {
      const before = new Map(molecule.atoms.map(atom => [atom.id, pos(atom.id)?.clone()]));

      // A. Bond lengths
      for (const bond of molecule.bonds) enforceBondLength(bond, 0.12 * scale, locked);

      // B. Local electron-domain angles
      for (const atom of molecule.atoms) enforceLocalAngles(atom.id, 0.085 * scale, locked);

      // C/E. sp2 planes and sp linear axes
      for (const frame of doubleFrames.values()) enforcePlane(frame.atomIds, frame.normal, [frame.bond.a, frame.bond.b], 0.22 * scale, locked, frame.bond);
      for (const atom of molecule.atoms) if (geometryFor(atom.id).kind === 'sp') enforceLinearCenter(atom.id, 0.16 * scale, locked);

      // D. Aromatic ring and directly attached substituents share one plane.
      for (const frame of aromaticFrames.values()) {
        enforcePlane(frame.atomIds, frame.normal, frame.cycle, 0.26 * scale, locked);
        enforceRegularAromaticCycle(frame, 0.045 * scale, locked);
      }

      // G. A deliberately light final separation avoids atom overlap without fighting angles.
      enforceStericSeparation(0.018 * scale, locked);

      for (const atom of molecule.atoms) {
        const point = pos(atom.id);
        const old = before.get(atom.id);
        if (point && old) maxMove = Math.max(maxMove, point.distanceTo(old));
      }
    }
    return maxMove;
  }

  function rotateReferenceFrames(quaternion, affectedIds = null) {
    if (dirty) rebuildTopology();
    const shouldRotate = frame => !affectedIds || frame.atomIds.every(id => affectedIds.has(id));
    for (const frame of doubleFrames.values()) if (shouldRotate(frame)) frame.normal.applyQuaternion(quaternion).normalize();
    for (const frame of aromaticFrames.values()) if (shouldRotate(frame)) frame.normal.applyQuaternion(quaternion).normalize();
  }

  function enforceBondLength(bond, strength, locked) {
    const a = pos(bond.a);
    const b = pos(bond.b);
    if (!a || !b) return;
    const delta = b.clone().sub(a);
    const length = Math.max(0.001, delta.length());
    const correction = delta.normalize().multiplyScalar((length - bondLengthFor(bond.a, bond.b, bond.order)) * strength);
    displacePair(bond.a, bond.b, correction, locked);
  }

  function enforceLocalAngles(centerId, strength, locked) {
    const center = pos(centerId);
    const neighbors = molecule.neighbors(centerId).map(neighbor => neighbor.atomId);
    if (!center || neighbors.length < 2) return;
    const geometry = geometryFor(centerId);
    for (let left = 0; left < neighbors.length; left++) {
      for (let right = left + 1; right < neighbors.length; right++) {
        enforceAngle(center, neighbors[left], neighbors[right], geometry.angle, strength, locked);
      }
    }
  }

  function enforceLinearCenter(centerId, strength, locked) {
    const center = pos(centerId);
    const neighbors = molecule.neighbors(centerId).sort((left, right) => right.order - left.order);
    if (!center || neighbors.length !== 2) return;
    const primaryId = neighbors[0].atomId, secondaryId = neighbors[1].atomId, primary = pos(primaryId), secondary = pos(secondaryId);
    if (!primary || !secondary || (locked.has(primaryId) && locked.has(secondaryId))) return;
    if (!locked.has(secondaryId)) {
      const length = secondary.distanceTo(center), target = center.clone().addScaledVector(primary.clone().sub(center).normalize(), -length);
      secondary.lerp(target, Math.min(1, strength * 2.4));
    } else if (!locked.has(primaryId)) {
      const length = primary.distanceTo(center), target = center.clone().addScaledVector(secondary.clone().sub(center).normalize(), -length);
      primary.lerp(target, Math.min(1, strength * 2.4));
    }
  }

  function enforceAngle(center, aId, bId, target, strength, locked) {
    const a = pos(aId);
    const b = pos(bId);
    if (!a || !b || (locked.has(aId) && locked.has(bId))) return;
    const va = a.clone().sub(center);
    const vb = b.clone().sub(center);
    const la = va.length();
    const lb = vb.length();
    if (la < 0.001 || lb < 0.001) return;
    va.normalize(); vb.normalize();
    const current = Math.acos(THREE.MathUtils.clamp(va.dot(vb), -1, 1));
    const difference = target - current;
    if (Math.abs(difference) < 0.0015) return;
    let axis = new THREE.Vector3().crossVectors(va, vb);
    if (axis.lengthSq() < 1e-8) axis = perpendicular(va);
    else axis.normalize();
    const aWeight = locked.has(aId) ? 0 : locked.has(bId) ? 1 : 0.5;
    const bWeight = locked.has(bId) ? 0 : locked.has(aId) ? 1 : 0.5;
    if (aWeight) {
      const targetA = center.clone().addScaledVector(va.applyAxisAngle(axis, -difference * strength * aWeight), la);
      a.lerp(targetA, 0.7);
    }
    if (bWeight) {
      const targetB = center.clone().addScaledVector(vb.applyAxisAngle(axis, difference * strength * bWeight), lb);
      b.lerp(targetB, 0.7);
    }
  }

  function enforcePlane(atomIds, normal, anchorIds, strength, locked, centralBond = null) {
    const points = atomIds.map(pos).filter(Boolean);
    if (points.length < 3 || normal.lengthSq() < 1e-8) return;
    const anchors = anchorIds.map(pos).filter(Boolean);
    const center = anchors.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / anchors.length);
    const central = centralBond ? new Set([centralBond.a, centralBond.b]) : new Set();
    for (const id of atomIds) {
      const point = pos(id);
      if (!point || locked.has(id)) continue;
      const offset = point.clone().sub(center).dot(normal);
      const weight = central.has(id) ? 0.55 : 1;
      point.addScaledVector(normal, -offset * strength * weight);
    }
  }

  function enforceRegularAromaticCycle(frame, strength, locked) {
    const points = frame.cycle.map(pos);
    if (points.some(point => !point)) return;
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
    let u = points[0].clone().sub(center);
    u.addScaledVector(frame.normal, -u.dot(frame.normal));
    if (u.lengthSq() < 1e-8) u = perpendicular(frame.normal);
    u.normalize();
    const v = new THREE.Vector3().crossVectors(frame.normal, u).normalize();
    const targetSide = frame.cycle.reduce((sum, id, index) => {
      const next = frame.cycle[(index + 1) % frame.cycle.length];
      return sum + bondLengthFor(id, next, bondBetween(id, next)?.order ?? 1);
    }, 0) / frame.cycle.length;
    const radius = targetSide / (2 * Math.sin(Math.PI / frame.cycle.length));
    const second = points[1].clone().sub(center);
    const sign = second.dot(v) >= 0 ? 1 : -1;
    frame.cycle.forEach((id, index) => {
      if (locked.has(id)) return;
      const angle = sign * index * 2 * Math.PI / frame.cycle.length;
      const target = center.clone().addScaledVector(u, Math.cos(angle) * radius).addScaledVector(v, Math.sin(angle) * radius);
      pos(id).lerp(target, strength);
    });
  }

  function enforceStericSeparation(strength, locked) {
    const atoms = molecule.atoms;
    for (let left = 0; left < atoms.length; left++) {
      for (let right = left + 1; right < atoms.length; right++) {
        const aId = atoms[left].id;
        const bId = atoms[right].id;
        if (stericExclusions.has(pairKey(aId, bId))) continue;
        const a = pos(aId);
        const b = pos(bId);
        if (!a || !b) continue;
        const delta = b.clone().sub(a);
        const length = delta.length();
        const minimum = (radiusFor(aId) + radiusFor(bId)) * 0.72;
        if (length >= minimum || length < 0.0001) continue;
        const correction = delta.normalize().multiplyScalar((minimum - length) * strength);
        displacePair(aId, bId, correction.clone().multiplyScalar(-1), locked);
      }
    }
  }

  function displacePair(aId, bId, correction, locked) {
    const a = pos(aId);
    const b = pos(bId);
    if (!a || !b || (locked.has(aId) && locked.has(bId))) return;
    if (locked.has(aId)) b.addScaledVector(correction, -1);
    else if (locked.has(bId)) a.add(correction);
    else {
      a.addScaledVector(correction, 0.5);
      b.addScaledVector(correction, -0.5);
    }
  }

  function planarSubstituentGroup(bond) {
    const ids = new Set([bond.a, bond.b]);
    molecule.neighbors(bond.a).forEach(neighbor => ids.add(neighbor.atomId));
    molecule.neighbors(bond.b).forEach(neighbor => ids.add(neighbor.atomId));
    return [...ids];
  }

  function aromaticPlanarGroup(cycle) {
    const ids = new Set(cycle);
    for (const id of cycle) molecule.neighbors(id).forEach(neighbor => ids.add(neighbor.atomId));
    return [...ids];
  }

  function doublePlaneNormal(bond, atomIds) {
    const a = pos(bond.a);
    const b = pos(bond.b);
    if (!a || !b) return new THREE.Vector3(0, 0, 1);
    const axis = b.clone().sub(a).normalize();
    let bestSide = null;
    let bestLength = 0;
    for (const id of atomIds) {
      if (id === bond.a || id === bond.b) continue;
      const anchor = molecule.neighbors(bond.a).some(neighbor => neighbor.atomId === id) ? a : b;
      const side = pos(id)?.clone().sub(anchor);
      if (!side) continue;
      side.addScaledVector(axis, -side.dot(axis));
      if (side.lengthSq() > bestLength) { bestLength = side.lengthSq(); bestSide = side; }
    }
    if (!bestSide || bestSide.lengthSq() < 1e-8) bestSide = perpendicular(axis);
    return new THREE.Vector3().crossVectors(axis, bestSide.normalize()).normalize();
  }

  function cycleNormal(cycle) {
    const points = cycle.map(pos);
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
    const normal = new THREE.Vector3();
    for (let index = 0; index < points.length; index++) {
      normal.add(new THREE.Vector3().crossVectors(points[index].clone().sub(center), points[(index + 1) % points.length].clone().sub(center)));
    }
    return normal.lengthSq() < 1e-8 ? new THREE.Vector3(0, 0, 1) : normal.normalize();
  }

  function buildStericExclusions() {
    const excluded = new Set();
    for (const atom of molecule.atoms) {
      const direct = molecule.neighbors(atom.id).map(neighbor => neighbor.atomId);
      direct.forEach(id => excluded.add(pairKey(atom.id, id)));
      direct.forEach(id => molecule.neighbors(id).forEach(neighbor => excluded.add(pairKey(atom.id, neighbor.atomId))));
    }
    return excluded;
  }

  function findCycles(maxLength = 8) {
    const found = new Map();
    for (const start of molecule.atoms.map(atom => atom.id)) {
      const walk = (current, path, visited) => {
        if (path.length > maxLength) return;
        for (const neighbor of molecule.neighbors(current)) {
          const next = neighbor.atomId;
          if (next === start && path.length >= 3) {
            found.set(canonicalCycleKey(path), [...path]);
            continue;
          }
          if (visited.has(next) || next < start) continue;
          visited.add(next);
          path.push(next);
          walk(next, path, visited);
          path.pop();
          visited.delete(next);
        }
      };
      walk(start, [start], new Set([start]));
    }
    return [...found.values()];
  }

  function isAromaticSixCarbonCycle(cycle) {
    if (cycle.length !== 6 || !cycle.every(id => atomById(id)?.element === 'C')) return false;
    const orders = cycle.map((id, index) => bondBetween(id, cycle[(index + 1) % 6])?.order ?? 0);
    return orders.filter(order => order === 2).length === 3
      && orders.every((order, index) => (order === 1 || order === 2) && order !== orders[(index + 1) % 6]);
  }

  function sameMembers(left, right) {
    return left.length === right.length && left.every(id => right.includes(id));
  }

  function perpendicular(vector) {
    const reference = Math.abs(vector.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    return new THREE.Vector3().crossVectors(vector, reference).normalize();
  }

  function canonicalCycleKey(cycle) {
    const variants = [];
    for (const sequence of [cycle, [...cycle].reverse()]) {
      for (let index = 0; index < sequence.length; index++) variants.push([...sequence.slice(index), ...sequence.slice(0, index)].join('-'));
    }
    return variants.sort()[0];
  }

  function snapshot() {
    if (dirty) rebuildTopology();
    return {
      cycles: cycles.map(cycle => [...cycle]),
      aromaticCycles: aromaticCycles.map(cycle => [...cycle]),
      doublePlanarGroups: [...doubleFrames.values()].map(frame => [...frame.atomIds]),
      aromaticPlanarGroups: [...aromaticFrames.values()].map(frame => [...frame.atomIds]),
    };
  }

  return { step, markTopologyDirty, rebuildTopology, rotateReferenceFrames, snapshot };
}
