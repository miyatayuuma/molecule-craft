// Pure guarded graph edits shared by molecular reactions and finite polymer
// fragments. This module deliberately has no database, DOM, or Three.js import.
const edgeKey=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
const multiset=values=>{const result=new Map();for(const value of values)result.set(value,(result.get(value)??0)+1);return result;};
const equalMultisets=(a,b)=>a.size===b.size&&[...a].every(([key,value])=>b.get(key)===value);
const refParts=ref=>{const split=String(ref).indexOf('.');return split>0?[String(ref).slice(0,split),String(ref).slice(split+1)]:[];};

function resolveRef(ref,bindings){
  const [role,label]=refParts(ref);
  if(!role||!label||!Number.isInteger(bindings?.[role]?.[label]))throw new Error(`unbound-graph-edit-reference:${ref}`);
  return `${role}:${bindings[role][label]}`;
}

export function validateGraphAtomConservation(source,transformed){
  const sourceAtoms=source?.atoms??[],atoms=transformed?.atoms??[];
  if(atoms.length!==sourceAtoms.length||new Set(atoms.map(atom=>atom.id)).size!==sourceAtoms.length)throw new Error('atom-conservation-failed');
  if(!equalMultisets(multiset(sourceAtoms.map(atom=>atom.element)),multiset(atoms.map(atom=>atom.element))))throw new Error('element-conservation-failed');
  if(sourceAtoms.reduce((sum,atom)=>sum+(atom.formalCharge??0),0)!==atoms.reduce((sum,atom)=>sum+(atom.formalCharge??0),0))throw new Error('formal-charge-conservation-failed');
  const sourceById=new Map(sourceAtoms.map(atom=>[atom.id,atom]));
  if(atoms.some(atom=>!sourceById.has(atom.id)||sourceById.get(atom.id).element!==atom.element))throw new Error('atom-origin-conservation-failed');
  return true;
}

export function graphConnectedComponents(atoms,bonds){
  const adjacency=new Map(atoms.map(atom=>[atom.id,[]]));
  for(const bond of bonds){adjacency.get(bond.a)?.push(bond.b);adjacency.get(bond.b)?.push(bond.a);}
  const seen=new Set(),components=[];
  for(const atom of atoms){
    if(seen.has(atom.id))continue;
    const ids=[],queue=[atom.id];
    for(let cursor=0;cursor<queue.length;cursor++){const id=queue[cursor];if(seen.has(id))continue;seen.add(id);ids.push(id);queue.push(...(adjacency.get(id)??[]));}
    const set=new Set(ids);
    components.push({atoms:atoms.filter(item=>set.has(item.id)).sort((a,b)=>String(a.id).localeCompare(String(b.id))),bonds:bonds.filter(bond=>set.has(bond.a)&&set.has(bond.b)).sort((a,b)=>edgeKey(a.a,a.b).localeCompare(edgeKey(b.a,b.b)))});
  }
  return components.sort((a,b)=>String(a.atoms[0]?.id??'').localeCompare(String(b.atoms[0]?.id??'')));
}

export function applyGuardedGraphEdits(source,edits,{bindings=source?.bindings??{}}={}){
  if(!source||!Array.isArray(source.atoms)||!Array.isArray(source.bonds)||!Array.isArray(edits))throw new TypeError('invalid-graph-edit-input');
  const atoms=source.atoms.map(atom=>({...atom})),bonds=source.bonds.map(bond=>({...bond}));
  const sourceBonds=new Map(source.bonds.map(bond=>[edgeKey(bond.a,bond.b),bond.order]));
  const byAtom=new Map(atoms.map(atom=>[atom.id,atom]));
  for(const edit of edits){
    if(!edit||!['breakBond','formBond','changeBondOrder','changeFormalCharge'].includes(edit.op))throw new Error(`unsupported-graph-edit:${edit?.op}`);
    const a=resolveRef(edit.a,bindings),atomA=byAtom.get(a);if(!atomA)throw new Error(`unknown-source-atom:${a}`);
    if(edit.op==='changeFormalCharge'){
      if(atomA.formalCharge!==edit.from)throw new Error(`source-state-guard-failed:${edit.op}:${edit.a}`);
      atomA.formalCharge=edit.to;continue;
    }
    const b=resolveRef(edit.b,bindings),atomB=byAtom.get(b);if(!atomB)throw new Error(`unknown-source-atom:${b}`);
    const key=edgeKey(a,b),bond=bonds.find(item=>edgeKey(item.a,item.b)===key);
    if(edit.op==='breakBond'){
      if(!bond||bond.order!==edit.from)throw new Error(`source-state-guard-failed:${edit.op}:${edit.a}:${edit.b}`);
      bonds.splice(bonds.indexOf(bond),1);
    }else if(edit.op==='formBond'){
      if(edit.from!=='absent'||bond)throw new Error(`source-state-guard-failed:${edit.op}:${edit.a}:${edit.b}`);
      bonds.push({a,b,order:edit.order});
    }else if(edit.op==='changeBondOrder'){
      if(!bond||bond.order!==edit.from)throw new Error(`source-state-guard-failed:${edit.op}:${edit.a}:${edit.b}`);
      bond.order=edit.to;
    }
  }
  bonds.sort((a,b)=>edgeKey(a.a,a.b).localeCompare(edgeKey(b.a,b.b)));
  const transformedGraph={atoms,bonds};
  validateGraphAtomConservation(source,transformedGraph);
  const transformedEdges=new Map(bonds.map(bond=>[edgeKey(bond.a,bond.b),bond]));
  const brokenBonds=[],formedBonds=[],bondOrderChanges=[];
  for(const[sourceKey,sourceOrder]of sourceBonds){
    const current=transformedEdges.get(sourceKey),[a,b]=sourceKey.split('|');
    if(!current)brokenBonds.push({a,b,from:sourceOrder});
    else if(current.order!==sourceOrder)bondOrderChanges.push({a,b,from:sourceOrder,to:current.order});
  }
  for(const bond of bonds)if(!sourceBonds.has(edgeKey(bond.a,bond.b)))formedBonds.push({...bond});
  const sourceById=new Map(source.atoms.map(atom=>[atom.id,atom]));
  const formalChargeChanges=atoms.filter(atom=>atom.formalCharge!==sourceById.get(atom.id)?.formalCharge).map(atom=>({atom:atom.id,from:sourceById.get(atom.id).formalCharge,to:atom.formalCharge}));
  return{ok:true,reactantGraph:source,transformedGraph,brokenBonds,formedBonds,bondOrderChanges,formalChargeChanges};
}
