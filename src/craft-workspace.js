import {Molecule,countElements} from './chemistry.js?v=20';
import {expandCraftStructure} from './craft-structures.js?v=31';

// Owns the atomic boundary between BASE STOCK and the craft workspace.
// Visual placement and interaction remain in app.js; every graph mutation that
// changes checked-out atoms passes through this module.
export function createCraftWorkspace({molecule,placements,resources,resolveUnlockedPart=()=>null,onStockChange=()=>{}}){
  const costOf=atoms=>countElements(atoms);

  function addAtom(element,position){
    if(!resources.spend({[element]:1}))return null;
    const atom=molecule.addAtom(element);placements.set(atom.id,{position});onStockChange();return atom;
  }

  function addStructure(template,positions){
    // Prepare in isolation before checking out any stock. Malformed templates
    // or interrupted expansion cannot leave a half-built component in the field.
    if(!Array.isArray(positions)||positions.length!==template?.atoms?.length||positions.some(p=>!p))return null;
    const staged=new Molecule();let expanded;
    try{
      const pairs=new Set();
      for(const [a,b,order] of template.bonds){
        const key=[a,b].sort((x,y)=>x-y).join(':');
        if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=template.atoms.length||b>=template.atoms.length||a===b||![1,2,3].includes(order)||pairs.has(key))return null;
        pairs.add(key);
      }
      expanded=expandCraftStructure(staged,template);
    }catch{return null;}
    const cost=costOf(staged.atoms);if(!resources.spend(cost))return null;
    molecule.atoms.push(...staged.atoms);molecule.bonds.push(...staged.bonds);
    for(const [index,atomId] of expanded.ids.entries())placements.set(atomId,{position:positions[index]});
    onStockChange();return expanded;
  }

  function addPart(id,positions){
    const template=resolveUnlockedPart(id);return template?addStructure(template,positions):null;
  }

  function removeAtom(id){
    const atom=molecule.atoms.find(item=>item.id===id);if(!atom)return false;
    resources.refund(costOf([atom]));molecule.removeAtom(id);placements.delete(id);onStockChange();return true;
  }

  function clear(){
    resources.refund(costOf(molecule.atoms));molecule.clear();placements.clear();onStockChange();
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
    onStockChange();return snapshot;
  }

  function restore(snapshots){
    if(!snapshots.length||!resources.spend(costOf(snapshots.flatMap(saved=>saved.atoms))))return false;
    for(const saved of snapshots){
      molecule.atoms.push(...saved.atoms);molecule.bonds.push(...saved.bonds);
      for(const [id,position] of saved.positions)placements.set(id,{position:position.clone()});
    }
    onStockChange();return true;
  }

  return{addAtom,addStructure,addPart,removeAtom,clear,removeAtoms,restore};
}
