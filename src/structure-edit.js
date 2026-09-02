import {createTorsionModel} from './torsion-model.js?v=33';

// Atom handles only translate isolated atoms or turn a smaller branch about a
// valid axis. Background gestures alone rotate the whole selected molecule.
export function planStructureEdit(molecule,atomId,options={}) {
  return (options.model??createTorsionModel(molecule,options)).forAtom(atomId,options);
}

export function editRelaxationOptions(molecule,state) {
  const movableIds=new Set(state.ids??[state.atomId]);
  return {ids:state.scope,lockedIds:new Set(molecule.atoms.filter(atom=>!movableIds.has(atom.id)).map(atom=>atom.id))};
}
