// A bonded atom is a handle for its whole molecule. Ordinary dragging must
// never stretch a bond or change its angle, even in an unfinished/unknown graph.
// Only a deliberately selected single-bond axis enables internal torsion.
export function planStructureEdit(molecule, atomId) {
  if (!molecule.atoms.some(atom => atom.id === atomId)) return null;
  const scope = new Set([atomId]), queue = [atomId];
  for (let i = 0; i < queue.length; i++) for (const neighbor of molecule.neighbors(queue[i])) {
    if (scope.has(neighbor.atomId)) continue;
    scope.add(neighbor.atomId); queue.push(neighbor.atomId);
  }
  return { mode: scope.size > 1 ? 'molecule-rotate' : 'atom-translate', ids: [...scope], scope };
}

export function editRelaxationOptions(molecule, state) {
  const movableIds = new Set(state.ids ?? [state.atomId]);
  return {
    ids: state.scope,
    lockedIds: new Set(molecule.atoms.filter(atom => !movableIds.has(atom.id)).map(atom => atom.id)),
  };
}
