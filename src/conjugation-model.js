const keyFor=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;

// Shared topology authority for the teaching model's conjugation-based
// rotation restriction. It is rebuilt only when topology changes. A returned
// bond is planar in this model; that is not a claim of an infinite physical
// rotation barrier.
export function createConjugationModel(molecule,{aromaticCycles=[]}={}){
  const atoms=new Map(molecule.atoms.map(atom=>[atom.id,atom]));
  const adjacency=new Map(molecule.atoms.map(atom=>[atom.id,[]]));
  for(const bond of molecule.bonds){
    adjacency.get(bond.a)?.push({atomId:bond.b,order:bond.order});
    adjacency.get(bond.b)?.push({atomId:bond.a,order:bond.order});
  }
  const neighbors=id=>adjacency.get(id)??[];
  const aromatic=new Set(aromaticCycles.flat());
  const pi=id=>neighbors(id).some(neighbor=>neighbor.order===2);
  const isRingBond=(a,b,key)=>{
    const seen=new Set([a]),queue=[a];
    for(let index=0;index<queue.length;index++)for(const neighbor of neighbors(queue[index])){
      if(keyFor(queue[index],neighbor.atomId)===key||seen.has(neighbor.atomId))continue;
      if(neighbor.atomId===b)return true;
      seen.add(neighbor.atomId);queue.push(neighbor.atomId);
    }
    return false;
  };
  const donor=(a,b)=>['N','O','S'].includes(atoms.get(a)?.element)&&atoms.get(b)?.element==='C'&&pi(b);
  const planarFollower=(a,b)=>aromatic.has(a)&&!aromatic.has(b)&&(pi(b)||['N','O'].includes(atoms.get(b)?.element));
  const restrictedBonds=new Map();
  for(const bond of molecule.bonds){
    if(bond.order!==1)continue;
    const key=keyFor(bond.a,bond.b);
    if(isRingBond(bond.a,bond.b,key))continue;
    if([bond.a,bond.b].some(id=>atoms.get(id)?.element==='H'||neighbors(id).length<2))continue;
    let kind=null,donorId=null,piId=null;
    if(pi(bond.a)&&pi(bond.b)&&!(aromatic.has(bond.a)&&aromatic.has(bond.b)))kind='pi-pi';
    else if(donor(bond.a,bond.b)){kind='donor-pi';donorId=bond.a;piId=bond.b;}
    else if(donor(bond.b,bond.a)){kind='donor-pi';donorId=bond.b;piId=bond.a;}
    else if(planarFollower(bond.a,bond.b)){kind='aromatic-follower';piId=bond.a;donorId=bond.b;}
    else if(planarFollower(bond.b,bond.a)){kind='aromatic-follower';piId=bond.b;donorId=bond.a;}
    if(kind)restrictedBonds.set(key,{key,bond:{a:bond.a,b:bond.b,order:bond.order},kind,donorId,piId});
  }
  return {
    restrictedBonds,
    isRestrictedConjugatedBond:(a,b)=>restrictedBonds.has(keyFor(a,b)),
    restrictedBondFor:(a,b)=>restrictedBonds.get(keyFor(a,b))??null,
  };
}

export function conjugatedBondKey(a,b){return keyFor(a,b);}
