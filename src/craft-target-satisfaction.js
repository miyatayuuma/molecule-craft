// Match complete workspace components to exact target-piece occurrences first.
// Remaining loose/partial material is then reserved compositionally, so the
// presentation order of the hint row cannot steal atoms from a spawned part.
const atomOf=(atom,index)=>typeof atom==='string'?{id:index,element:atom}:{id:atom?.id??index,element:atom?.element};
const compare=(a,b)=>a<b?-1:a>b?1:0;

function normalize(graph){
  const atoms=(graph?.atoms??[]).map(atomOf),ids=new Map(atoms.map((atom,index)=>[atom.id,index])),edges=atoms.map(()=>Array(atoms.length).fill(0));
  for(const bond of graph?.bonds??[]){let a,b,order;if(Array.isArray(bond))[a,b,order]=bond;else{a=ids.get(bond.a)??bond.a;b=ids.get(bond.b)??bond.b;order=bond.order;}if(Number.isInteger(a)&&Number.isInteger(b)&&edges[a]&&edges[b]&&a!==b)edges[a][b]=edges[b][a]=order||1;}
  return{atoms,edges};
}
function components(graph){
  const seen=new Set(),result=[];
  for(let start=0;start<graph.atoms.length;start++){if(seen.has(start))continue;const indices=[],stack=[start];seen.add(start);while(stack.length){const i=stack.pop();indices.push(i);for(let j=0;j<graph.atoms.length;j++)if(graph.edges[i][j]&&!seen.has(j)){seen.add(j);stack.push(j);}}indices.sort((a,b)=>a-b);result.push(indices);}
  return result;
}
function exactMapping(target,indices,workspace,component){
  if(indices.length!==component.length)return null;
  const order=indices.map((_,i)=>i).sort((a,b)=>indices.filter(j=>target.edges[indices[a]][indices[j]]).length-indices.filter(j=>target.edges[indices[b]][indices[j]]).length||a-b),mapped=Array(indices.length).fill(-1),used=new Set();
  function visit(depth){if(depth===order.length)return [...mapped];const local=order[depth],targetIndex=indices[local],expected=target.atoms[targetIndex].element;
    for(const workspaceIndex of component){if(used.has(workspaceIndex)||workspace.atoms[workspaceIndex].element!==expected)continue;let ok=true;for(let other=0;other<mapped.length;other++){if(mapped[other]<0)continue;if(target.edges[targetIndex][indices[other]]!==workspace.edges[workspaceIndex][mapped[other]]){ok=false;break;}}if(!ok)continue;mapped[local]=workspaceIndex;used.add(workspaceIndex);const result=visit(depth+1);if(result)return result;used.delete(workspaceIndex);mapped[local]=-1;}return null;}
  return visit(0);
}

export function matchCraftTarget(target,pieces,workspace){
  const targetGraph=normalize(target),workspaceGraph=normalize(workspace),targetAtoms=targetGraph.atoms,workspaceAtoms=workspaceGraph.atoms;
  const available=new Map();for(const atom of workspaceAtoms){if(typeof atom.element!=='string')continue;if(!available.has(atom.element))available.set(atom.element,[]);available.get(atom.element).push(atom);}
  for(const queue of available.values())queue.sort((a,b)=>compare(a.id,b.id));
  const assignments=[],satisfiedPieces=[],unsatisfiedPieces=[],claimedComponents=new Set(),claimedWorkspace=new Set(),claimedTargets=new Set();
  const occurrences=(pieces??[]).map((piece,index)=>({piece,index,indices:Array.isArray(piece?.atomIndices)?piece.atomIndices:[]}));
  const workspaceComponents=components(workspaceGraph);
  // Exact connected structure wins over composition, across every occurrence.
  for(const occurrence of occurrences){if(!occurrence.piece?.partId||!occurrence.indices.length)continue;
    const match=workspaceComponents.map((component,index)=>({component,index,mapping:claimedComponents.has(index)?null:exactMapping(targetGraph,occurrence.indices,workspaceGraph,component)})).find(candidate=>candidate.mapping);
    if(!match)continue;claimedComponents.add(match.index);satisfiedPieces.push(occurrence.piece);
    occurrence.indices.forEach((targetIndex,local)=>{const workspaceIndex=match.mapping[local],atom=workspaceAtoms[workspaceIndex];claimedWorkspace.add(workspaceIndex);claimedTargets.add(targetIndex);assignments.push({targetIndex,workspaceAtomId:atom.id});});
  }
  // Reserve already present material for remaining pieces in a stable order.
  for(const occurrence of occurrences){if(satisfiedPieces.includes(occurrence.piece))continue;const missing=[],secured=[];
    for(const index of occurrence.indices){if(claimedTargets.has(index))continue;const element=targetAtoms[index]?.element,queue=available.get(element),atom=queue?.find(candidate=>!claimedWorkspace.has(workspaceAtoms.indexOf(candidate)));
      if(atom){const workspaceIndex=workspaceAtoms.indexOf(atom);claimedWorkspace.add(workspaceIndex);claimedTargets.add(index);assignments.push({targetIndex:index,workspaceAtomId:atom.id});secured.push(index);}else missing.push(index);
    }
    if(!missing.length){if(occurrence.piece.partId)satisfiedPieces.push(occurrence.piece);continue;}
    if(!secured.length){unsatisfiedPieces.push(occurrence.piece);continue;}
    for(const index of missing){const element=targetAtoms[index]?.element;if(element)unsatisfiedPieces.push({partId:null,element,atomIndices:[index]});}
  }
  assignments.sort((a,b)=>a.targetIndex-b.targetIndex||compare(a.workspaceAtomId,b.workspaceAtomId));
  return{satisfiedPieces,unsatisfiedPieces,assignments};
}
