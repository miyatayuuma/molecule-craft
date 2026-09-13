// Target material reservation is composition-based, not structure-based.
// Every workspace atom of a required element secures at most one target atom,
// regardless of the atom's current bonds or which partial component contains it.
// Larger target pieces are reserved whole when their complete composition is
// already present; partially covered pieces fall back to exact missing atoms.
const atomOf=(atom,index)=>typeof atom==='string'?{id:index,element:atom}:{id:atom?.id??index,element:atom?.element};
const compare=(a,b)=>a<b?-1:a>b?1:0;

export function matchCraftTarget(target,pieces,workspace){
  const targetAtoms=(target?.atoms??[]).map(atomOf),workspaceAtoms=(workspace?.atoms??[]).map(atomOf).filter(atom=>typeof atom.element==='string').sort((a,b)=>compare(a.id,b.id));
  const available=new Map();
  for(const atom of workspaceAtoms){if(!available.has(atom.element))available.set(atom.element,[]);available.get(atom.element).push(atom);}
  const assignments=[],satisfiedPieces=[],unsatisfiedPieces=[];
  const reserve=index=>{
    const element=targetAtoms[index]?.element,queue=available.get(element);if(!queue?.length)return false;
    assignments.push({targetIndex:index,workspaceAtomId:queue.shift().id});return true;
  };
  for(const piece of pieces??[]){
    const indices=Array.isArray(piece?.atomIndices)?piece.atomIndices:[],needed=new Map();
    for(const index of indices){const element=targetAtoms[index]?.element;if(element)needed.set(element,(needed.get(element)??0)+1);}
    const full=[...needed].every(([element,count])=>(available.get(element)?.length??0)>=count);
    if(full){for(const index of indices)reserve(index);satisfiedPieces.push(piece);continue;}
    const missing=[];let secured=0;
    for(const index of indices){if(reserve(index))secured++;else missing.push(index);}
    if(!secured){unsatisfiedPieces.push(piece);continue;}
    for(const index of missing){const element=targetAtoms[index]?.element;if(element)unsatisfiedPieces.push({partId:null,element,atomIndices:[index]});}
  }
  assignments.sort((a,b)=>a.targetIndex-b.targetIndex||compare(a.workspaceAtomId,b.workspaceAtomId));
  return {satisfiedPieces,unsatisfiedPieces,assignments};
}