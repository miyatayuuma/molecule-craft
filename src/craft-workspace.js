import {countElements} from './chemistry.js?v=20';
import {expandCraftStructure} from './craft-structures.js?v=31';

// Owns the atomic boundary between BASE STOCK and the craft workspace.
// Visual placement and interaction remain in app.js; every graph mutation that
// changes checked-out atoms passes through this module.
export function createCraftWorkspace({molecule,placements,resources}){
  const costOf=atoms=>countElements(atoms);

  function addAtom(element,position){
    if(!resources.spend({[element]:1}))return null;
    const atom=molecule.addAtom(element);placements.set(atom.id,{position});return atom;
  }

  function addStructure(template,positions){
    const cost=costOf(template.atoms.map(element=>({element})));
    if(!resources.spend(cost))return null;
    const expanded=expandCraftStructure(molecule,template);
    for(const [index,atomId] of expanded.ids.entries())placements.set(atomId,{position:positions[index]});
    return expanded;
  }

  function removeAtom(id){
    const atom=molecule.atoms.find(item=>item.id===id);if(!atom)return false;
    resources.refund(costOf([atom]));molecule.removeAtom(id);placements.delete(id);return true;
  }

  function clear(){
    resources.refund(costOf(molecule.atoms));molecule.clear();placements.clear();
  }

  function removeAtoms(ids){
    const removed=new Set(ids),snapshot={
      atoms:molecule.atoms.filter(atom=>removed.has(atom.id)).map(atom=>({...atom})),
      bonds:molecule.bonds.filter(bond=>removed.has(bond.a)&&removed.has(bond.b)).map(bond=>({...bond})),
      positions:new Map([...removed].filter(id=>placements.has(id)).map(id=>[id,placements.get(id).position.clone()])),
    };
    resources.refund(costOf(snapshot.atoms));
    molecule.atoms=molecule.atoms.filter(atom=>!removed.has(atom.id));molecule.bonds=molecule.bonds.filter(bond=>!removed.has(bond.a)&&!removed.has(bond.b));
    for(const id of removed)placements.delete(id);
    return snapshot;
  }

  function restore(snapshots){
    if(!snapshots.length||!resources.spend(costOf(snapshots.flatMap(saved=>saved.atoms))))return false;
    for(const saved of snapshots){
      molecule.atoms.push(...saved.atoms);molecule.bonds.push(...saved.bonds);
      for(const [id,position] of saved.positions)placements.set(id,{position:position.clone()});
    }
    return true;
  }

  return{addAtom,addStructure,removeAtom,clear,removeAtoms,restore};
}
