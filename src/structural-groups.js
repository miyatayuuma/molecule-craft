import {supportedResonanceGroups} from './resonance-model.js?v=2';

// Shared graph-only structural motifs. Constitutional bond orders stay
// integer-valued; these groups describe geometry and notation authority only.
function graphOf(source){
  const atoms=(source?.atoms??[]).map((atom,index)=>({id:typeof atom==='string'?index:(atom?.id??index),element:typeof atom==='string'?atom:atom?.element}));
  const byId=new Map(atoms.map(atom=>[atom.id,atom])),adjacency=new Map(atoms.map(atom=>[atom.id,[]]));
  for(const raw of source?.bonds??[]){
    let a,b,order;if(Array.isArray(raw)){a=atoms[raw[0]]?.id;b=atoms[raw[1]]?.id;order=raw[2];}else{a=raw?.a;b=raw?.b;order=raw?.order;}
    if(!byId.has(a)||!byId.has(b)||a===b||![1,2,3].includes(order))continue;
    adjacency.get(a).push({atomId:b,order});adjacency.get(b).push({atomId:a,order});
  }
  return{atoms,byId,adjacency};
}

export function sulfurOxoGroups(source){
  const graph=graphOf(source);
  return graph.atoms.filter(atom=>atom.element==='S').flatMap(atom=>{
    const neighbors=graph.adjacency.get(atom.id)??[];
    const ends=neighbors.filter(edge=>edge.order===2&&graph.byId.get(edge.atomId)?.element==='O'&&(graph.adjacency.get(edge.atomId)?.length??0)===1).map(edge=>edge.atomId);
    if(ends.length<2)return[];
    const hydroxyls=neighbors.filter(edge=>edge.order===1&&graph.byId.get(edge.atomId)?.element==='O'&&(graph.adjacency.get(edge.atomId)??[]).some(other=>other.order===1&&graph.byId.get(other.atomId)?.element==='H')).map(edge=>edge.atomId);
    return[{kind:'sulfur-oxo',center:atom.id,ends,hydroxyls}];
  });
}

export function structuralOxoGroups(source){
  return[...sulfurOxoGroups(source),...supportedResonanceGroups(source)];
}
