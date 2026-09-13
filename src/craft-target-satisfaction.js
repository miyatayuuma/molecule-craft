// Target material reservation is composition-based, not structure-based.
// Every workspace atom of a required element reserves at most one target atom,
// regardless of the atom's current bonds or which partial component contains it.
// This keeps the material bar stable while the player breaks/rebuilds bonds.
const atomOf=(atom,index)=>typeof atom==='string'?{id:index,element:atom}:{id:atom?.id??index,element:atom?.element};
const compare=(a,b)=>a<b?-1:a>b?1:0;

export function matchCraftTarget(target,pieces,workspace){
  const targetAtoms=(target?.atoms??[]).map(atomOf),workspaceAtoms=(workspace?.atoms??[]).map(atomOf).filter(atom=>typeof atom.element==='string').sort((a,b)=>compare(a.id,b.id));
  const openByElement=new Map();
  for(const [index,atom]of targetAtoms.entries()){
    if(!openByElement.has(atom.element))openByElement.set(atom.element,[]);
    openByElement.get(atom.element).push(index);
  }
  const assignments=[];
  for(const atom of workspaceAtoms){
    const queue=openByElement.get(atom.element);if(!queue?.length)continue;
    assignments.push({targetIndex:queue.shift(),workspaceAtomId:atom.id});
  }
  assignments.sort((a,b)=>a.targetIndex-b.targetIndex||compare(a.workspaceAtomId,b.workspaceAtomId));
  const secured=new Set(assignments.map(item=>item.targetIndex)),satisfiedPieces=[],unsatisfiedPieces=[];
  for(const piece of pieces??[]){
    const indices=Array.isArray(piece?.atomIndices)?piece.atomIndices:[],missing=indices.filter(index=>!secured.has(index));
    if(!missing.length){satisfiedPieces.push(piece);continue;}
    if(missing.length===indices.length){unsatisfiedPieces.push(piece);continue;}
    for(const index of missing){const element=targetAtoms[index]?.element;if(element)unsatisfiedPieces.push({partId:null,element,atomIndices:[index]});}
  }
  return {satisfiedPieces,unsatisfiedPieces,assignments};
}