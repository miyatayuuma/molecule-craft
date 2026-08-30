export const POINTER_ARBITRATION = Object.freeze({
  atomCoreRadiusPx: 20,
  atomReactiveRadiusPx: 24,
  atomStructureRadiusPx: 34,
  bondRadiusPx: 14,
  bondEndpointExclusionPx: 24,
});

export function pickAtomAtPointer(clientX, clientY, candidates, radiusPx) {
  const ranked = candidates
    .map(candidate => ({
      ...candidate,
      distance: Math.hypot(clientX - candidate.screenX, clientY - candidate.screenY),
    }))
    .filter(candidate => candidate.distance <= (candidate.radiusPx ?? radiusPx))
    .sort((left, right) => left.distance - right.distance || (left.depth ?? 0) - (right.depth ?? 0) || left.atomId - right.atomId);
  return ranked[0] ?? null;
}

// A filled atom keeps its generous target even beside reactive fragments.
// Atom centers always win; outside them, the nearest actual target wins rather
// than a distant electron's enlarged assist zone stealing a filled atom.
export function chooseAtomOrElectron(clientX, clientY, atoms, electronPick) {
  const core = pickAtomAtPointer(clientX, clientY, atoms, POINTER_ARBITRATION.atomCoreRadiusPx);
  if (core) return { kind: 'atom', ...core };
  const atom = pickAtomAtPointer(clientX, clientY, atoms.map(item => ({ ...item,
    radiusPx: item.unpaired > 0 ? POINTER_ARBITRATION.atomReactiveRadiusPx : POINTER_ARBITRATION.atomStructureRadiusPx,
  })));
  if (electronPick && (!atom || atom.unpaired > 0 || electronPick.distance < atom.distance)) return { kind: 'electron', ...electronPick };
  return atom ? { kind: 'atom', ...atom } : null;
}

export function pickBondAtPointer(clientX, clientY, candidates, target = POINTER_ARBITRATION) {
  const ranked = candidates
    .map(candidate => {
      const projection = projectToSegment(
        clientX,
        clientY,
        candidate.startX,
        candidate.startY,
        candidate.endX,
        candidate.endY,
      );
      return {
        ...candidate,
        distance: projection.distance,
        segmentPosition: projection.t,
        startDistance: Math.hypot(clientX - candidate.startX, clientY - candidate.startY),
        endDistance: Math.hypot(clientX - candidate.endX, clientY - candidate.endY),
      };
    })
    .filter(candidate => candidate.distance <= target.bondRadiusPx
      && candidate.startDistance >= target.bondEndpointExclusionPx
      && candidate.endDistance >= target.bondEndpointExclusionPx)
    .sort((left, right) => left.distance - right.distance || (left.depth ?? 0) - (right.depth ?? 0) || String(left.key).localeCompare(String(right.key)));
  return ranked[0] ?? null;
}

export function hasCompatibleElectronPair(electrons, canPairAtoms) {
  const atomIds = [...new Set(electrons.filter(electron => electron.interactive !== false).map(electron => electron.atomId))];
  for (let left = 0; left < atomIds.length; left++) {
    for (let right = left + 1; right < atomIds.length; right++) {
      if (canPairAtoms(atomIds[left], atomIds[right])) return true;
    }
  }
  return false;
}

export function projectToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1e-6) return { t: 0, distance: Math.hypot(px - ax, py - ay) };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return { t, distance: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) };
}
