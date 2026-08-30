// Editing has a movable region and an untouched reference skeleton. These are
// graph sets, not camera-space pins: no recentering or camera compensation.
export function planStructureEdit(molecule, atomId) {
  const atom = molecule.atoms.find(item => item.id === atomId);
  if (!atom) return null;
  const component = (start, skipA = null, skipB = null) => {
    const seen = new Set([start]), queue = [start];
    for (let i = 0; i < queue.length; i++) for (const neighbor of molecule.neighbors(queue[i])) {
      const next = neighbor.atomId;
      if ((queue[i] === skipA && next === skipB) || (queue[i] === skipB && next === skipA) || seen.has(next)) continue;
      seen.add(next); queue.push(next);
    }
    return seen;
  };
  const scope = component(atomId);
  const heavy = ids => molecule.atoms.filter(item => ids.has(item.id) && item.element !== 'H').length;
  const totalHeavy = heavy(scope);
  let best = null;
  for (const neighbor of molecule.neighbors(atomId)) {
    const pivot = molecule.atoms.find(item => item.id === neighbor.atomId);
    // Never swing a carbon skeleton around a terminal hydrogen.
    if (atom.element !== 'H' && pivot.element === 'H') continue;
    const ids = component(atomId, atomId, pivot.id);
    if (ids.has(pivot.id)) continue; // Ring edge: local deformation, not torsion.
    const movingHeavy = heavy(ids);
    // A small substituent can move relative to a ring, not the other way round.
    if (movingHeavy > totalHeavy - movingHeavy) continue;
    if (!best || ids.size < best.ids.length) best = { mode: 'structure', pivotId: pivot.id, ids: [...ids], scope };
  }
  if (best) return best;
  const ids = [atomId];
  for (const neighbor of molecule.neighbors(atomId)) {
    if (molecule.atoms.find(item => item.id === neighbor.atomId)?.element === 'H' && molecule.neighbors(neighbor.atomId).length === 1) ids.push(neighbor.atomId);
  }
  return { mode: 'atom-translate', ids, scope };
}

export function editRelaxationOptions(molecule, state) {
  const movableIds = new Set(state.ids ?? [state.atomId]);
  // Hold every untouched atom, including those in other components. Do not
  // release these anchors on timeout: that would turn a local edit into a jump.
  return {
    ids: state.scope,
    lockedIds: new Set(molecule.atoms.filter(atom => !movableIds.has(atom.id)).map(atom => atom.id)),
    strength: .18,
    rampMs: 180,
    minDuration: 650,
  };
}
