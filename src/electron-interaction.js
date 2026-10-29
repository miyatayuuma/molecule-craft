export const ELECTRON_POINTER_TARGET = Object.freeze({
  coreRadiusPx: 36,
  assistRadiusPx: 52,
  touchLiftPx: 24,
});

export function pickElectronAtPointer(clientX, clientY, candidates, target = ELECTRON_POINTER_TARGET) {
  const ranked = candidates
    .filter(candidate => candidate.interactive !== false)
    .map(candidate => ({
      ...candidate,
      distance: distanceToSegment(
        clientX,
        clientY,
        candidate.screenX,
        candidate.screenY,
        candidate.restScreenX ?? candidate.screenX,
        candidate.restScreenY ?? candidate.screenY,
      ),
    }))
    .filter(candidate => Number.isFinite(candidate.distance))
    .sort((left, right) => left.distance - right.distance || (right.priority ?? 0) - (left.priority ?? 0) || left.atomId - right.atomId || left.index - right.index);

  const nearest = ranked[0];
  if (!nearest) return null;
  if (nearest.distance <= target.coreRadiusPx) return { ...nearest, assisted: false };
  const assisted = ranked.filter(candidate => candidate.distance <= target.assistRadiusPx);
  return assisted.length === 1 ? { ...nearest, assisted: true } : null;
}

export function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1e-6) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
