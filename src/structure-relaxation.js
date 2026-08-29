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
      const normal = previous && sameMembers(previous.atomIds, atomIds) ? previous.normal.clone() : doublePlaneNormal(bond, atomIds);
      const frame = {
        key,
        bond: { a: bond.a, b: bond.b },
        atomIds,
        normal,
      };
      frame.substituentSlots = doubleSubstituentSlots(frame, previous?.substituentSlots);
      frame.slottedRootIds = new Set(frame.substituentSlots.flatMap(endpoint => endpoint.branches.map(branch => branch.rootId)));
      nextDoubleFrames.set(key, frame);
    }
    doubleFrames = nextDoubleFrames;

    const nextAromaticFrames = new Map();
    for (const cycle of aromaticCycles) {
      const key = canonicalCycleKey(cycle);
      const atomIds = aromaticPlanarGroup(cycle);
      const previous = aromaticFrames.get(key);
      const frame = {
        key,
        cycle: [...cycle],
        atomIds,
        normal: previous && sameMembers(previous.atomIds, atomIds) ? previous.normal.clone() : cycleNormal(cycle),
      };
      frame.substituents = aromaticSubstituentBranches(frame.cycle);
      frame.substituentRootIds = new Set(frame.substituents.map(substituent => substituent.rootId));
      nextAromaticFrames.set(key, frame);
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

      // C/E. sp2 planes, distinct in-plane substituent slots, and sp linear axes.
      for (const frame of doubleFrames.values()) {
        enforcePlane(frame.atomIds, frame.normal, [frame.bond.a, frame.bond.b], 0.22 * scale, locked, frame.bond, frame.slottedRootIds);
        enforceDoubleSubstituentDirections(frame, 0.24 * scale, locked);
      }
      for (const atom of molecule.atoms) if (geometryFor(atom.id).kind === 'sp') enforceLinearCenter(atom.id, 0.16 * scale, locked);

      // D. Aromatic rings stay planar; external branches return to the outward
      // direction instead of being allowed to settle inside the ring.
      for (const frame of aromaticFrames.values()) {
        enforcePlane(frame.atomIds, frame.normal, frame.cycle, 0.26 * scale, locked, null, frame.substituentRootIds);
        enforceRegularAromaticCycle(frame, 0.045 * scale, locked);
        enforceAromaticSubstituentDirections(frame, 0.28 * scale, locked);
        enforceConjugatedSubstituentPlane(frame, 0.22 * scale, locked);
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

  function enforcePlane(atomIds, normal, anchorIds, strength, locked, centralBond = null, skipIds = null) {
    const points = atomIds.map(pos).filter(Boolean);
    if (points.length < 3 || normal.lengthSq() < 1e-8) return;
    const anchors = anchorIds.map(pos).filter(Boolean);
    const center = anchors.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / anchors.length);
    const central = centralBond ? new Set([centralBond.a, centralBond.b]) : new Set();
    for (const id of atomIds) {
      const point = pos(id);
      if (!point || locked.has(id) || skipIds?.has(id)) continue;
      const offset = point.clone().sub(center).dot(normal);
      const weight = central.has(id) ? 0.55 : 1;
      point.addScaledVector(normal, -offset * strength * weight);
    }
  }

  function enforceDoubleSubstituentDirections(frame, strength, locked) {
    for (const endpoint of frame.substituentSlots) {
      const center = pos(endpoint.centerId);
      const partner = pos(endpoint.partnerId);
      if (!center || !partner) continue;
      const axis = partner.clone().sub(center);
      if (axis.lengthSq() < 1e-8) continue;
      axis.normalize();
      let side = new THREE.Vector3().crossVectors(frame.normal, axis);
      if (side.lengthSq() < 1e-8) side = perpendicular(axis);
      else side.normalize();
      for (const branch of endpoint.branches) {
        const direction = axis.clone().multiplyScalar(-0.5).addScaledVector(side, branch.sign * Math.sqrt(3) / 2).normalize();
        moveBranchRootToward(endpoint.centerId, branch, direction, strength, locked);
      }
    }
  }

  function enforceAromaticSubstituentDirections(frame, strength, locked) {
    const ringPoints = frame.cycle.map(pos);
    if (ringPoints.some(point => !point)) return;
    const ringCenter = ringPoints.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / ringPoints.length);
    for (const substituent of frame.substituents) {
      const index = frame.cycle.indexOf(substituent.ringId);
      const center = pos(substituent.ringId);
      const previous = pos(frame.cycle[(index - 1 + frame.cycle.length) % frame.cycle.length]);
      const next = pos(frame.cycle[(index + 1) % frame.cycle.length]);
      if (!center || !previous || !next) continue;
      let outward = previous.clone().sub(center).add(next.clone().sub(center)).multiplyScalar(-1);
      outward.addScaledVector(frame.normal, -outward.dot(frame.normal));
      const radial = center.clone().sub(ringCenter).addScaledVector(frame.normal, -center.clone().sub(ringCenter).dot(frame.normal));
      if (outward.lengthSq() < 1e-8) outward = radial;
      if (outward.lengthSq() < 1e-8) outward = perpendicular(frame.normal);
      outward.normalize();
      if (radial.lengthSq() > 1e-8 && outward.dot(radial) < 0) outward.multiplyScalar(-1);
      moveBranchRootToward(substituent.ringId, substituent, outward, strength, locked);
    }
  }

  function enforceConjugatedSubstituentPlane(frame, strength, locked) {
    const ringPoints = frame.cycle.map(pos);
    if (ringPoints.some(point => !point)) return;
    const planeCenter = ringPoints.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / ringPoints.length);
    for (const substituent of frame.substituents) {
      for (const follower of substituent.planarFollowers) {
        const root = pos(follower.rootId);
        if (!root || follower.atomIds.some(id => locked.has(id))) continue;
        const correction = frame.normal.clone().multiplyScalar(-root.clone().sub(planeCenter).dot(frame.normal) * Math.min(1, strength));
        for (const id of follower.atomIds) pos(id)?.add(correction);
      }
    }
  }

  function moveBranchRootToward(centerId, branch, direction, strength, locked) {
    const center = pos(centerId);
    const root = pos(branch.rootId);
    if (!center || !root || branch.atomIds.some(id => locked.has(id))) return;
    const bond = bondBetween(centerId, branch.rootId);
    if (!bond) return;
    const target = center.clone().addScaledVector(direction, bondLengthFor(centerId, branch.rootId, bond.order));
    const correction = target.sub(root).multiplyScalar(Math.min(1, strength));
    for (const id of branch.atomIds) pos(id)?.add(correction);
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

  function doubleSubstituentSlots(frame, previousSlots = null) {
    const previousSigns = new Map();
    for (const endpoint of previousSlots ?? []) for (const branch of endpoint.branches) previousSigns.set(`${endpoint.centerId}:${branch.rootId}`, branch.sign);
    const endpoints = [];
    for (const [centerId, partnerId] of [[frame.bond.a, frame.bond.b], [frame.bond.b, frame.bond.a]]) {
      if (geometryFor(centerId).kind !== 'sp2') continue;
      const branches = molecule.neighbors(centerId)
        .filter(neighbor => neighbor.atomId !== partnerId)
        .map(neighbor => ({ rootId: neighbor.atomId, atomIds: branchFromBond(centerId, neighbor.atomId) }))
        .filter(branch => branch.atomIds);
      if (!branches.length || branches.length > 2) continue;
      const remembered = branches.map(branch => previousSigns.get(`${centerId}:${branch.rootId}`));
      let signs;
      if (remembered.every(sign => sign === -1 || sign === 1) && new Set(remembered).size === remembered.length) signs = remembered;
      else signs = assignDoubleSlotSigns(centerId, partnerId, branches, frame.normal);
      endpoints.push({ centerId, partnerId, branches: branches.map((branch, index) => ({ ...branch, sign: signs[index] })) });
    }
    return endpoints;
  }

  function assignDoubleSlotSigns(centerId, partnerId, branches, normal) {
    const center = pos(centerId);
    const partner = pos(partnerId);
    if (!center || !partner) return branches.map((_, index) => index === 0 ? 1 : -1);
    const axis = partner.clone().sub(center).normalize();
    let side = new THREE.Vector3().crossVectors(normal, axis);
    if (side.lengthSq() < 1e-8) side = perpendicular(axis);
    else side.normalize();
    const slots = [1, -1].map(sign => axis.clone().multiplyScalar(-0.5).addScaledVector(side, sign * Math.sqrt(3) / 2).normalize());
    const directions = branches.map(branch => pos(branch.rootId)?.clone().sub(center).normalize() ?? slots[0]);
    if (branches.length === 1) return [directions[0].dot(slots[0]) >= directions[0].dot(slots[1]) ? 1 : -1];
    const direct = directions[0].dot(slots[0]) + directions[1].dot(slots[1]);
    const crossed = directions[0].dot(slots[1]) + directions[1].dot(slots[0]);
    return direct >= crossed ? [1, -1] : [-1, 1];
  }

  function aromaticSubstituentBranches(cycle) {
    const cycleIds = new Set(cycle);
    const branches = [];
    for (const ringId of cycle) {
      for (const neighbor of molecule.neighbors(ringId)) {
        if (cycleIds.has(neighbor.atomId)) continue;
        const atomIds = branchFromBond(ringId, neighbor.atomId, cycleIds);
        if (atomIds) branches.push({ ringId, rootId: neighbor.atomId, atomIds, planarFollowers: conjugatedFollowerBranches(ringId, neighbor.atomId) });
      }
    }
    return branches;
  }

  function conjugatedFollowerBranches(ringId, rootId) {
    const root = atomById(rootId);
    if (!root || (root.element !== 'O' && root.element !== 'N' && geometryFor(rootId).kind !== 'sp2')) return [];
    return molecule.neighbors(rootId)
      .filter(neighbor => neighbor.atomId !== ringId)
      .map(neighbor => ({ rootId: neighbor.atomId, atomIds: branchFromBond(rootId, neighbor.atomId) }))
      .filter(branch => branch.atomIds);
  }

  function branchFromBond(centerId, rootId, forbiddenIds = null) {
    const seen = new Set([rootId]);
    const queue = [rootId];
    while (queue.length) {
      const current = queue.shift();
      for (const neighbor of molecule.neighbors(current)) {
        const next = neighbor.atomId;
        if ((current === rootId && next === centerId) || seen.has(next)) continue;
        if (next === centerId || forbiddenIds?.has(next)) return null;
        seen.add(next);
        queue.push(next);
      }
    }
    return [...seen];
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
      doubleSubstituentSlots: [...doubleFrames.values()].flatMap(frame => frame.substituentSlots.map(endpoint => ({ centerId: endpoint.centerId, roots: endpoint.branches.map(branch => ({ id: branch.rootId, sign: branch.sign })) }))),
      aromaticOutwardGroups: [...aromaticFrames.values()].map(frame => frame.substituents.map(substituent => ({ ringId: substituent.ringId, rootId: substituent.rootId }))),
    };
  }

  return { step, markTopologyDirty, rebuildTopology, rotateReferenceFrames, snapshot };
}
