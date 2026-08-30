// A small declarative subgraph matcher, deliberately not a SMARTS interpreter.
function graphIndex(graph) {
  const atoms = graph.atoms.map((atom,index) => typeof atom === 'string' ? {id:index,element:atom} : atom);
  const bonds = graph.bonds.map(bond => Array.isArray(bond) ? {a:bond[0],b:bond[1],order:bond[2]} : bond);
  const byId = new Map(atoms.map(atom=>[atom.id,atom]));
  const adjacency = new Map(atoms.map(atom=>[atom.id,[]]));
  for(const bond of bonds){adjacency.get(bond.a)?.push({id:bond.b,order:bond.order});adjacency.get(bond.b)?.push({id:bond.a,order:bond.order});}
  return {atoms,bonds,byId,adjacency};
}

function matchesPattern(index, pattern, aromatic = new Set(), limit = 128) {
  const adjacent = id => index.adjacency.get(id) ?? [];
  const candidates = pattern.atoms.map(spec => index.atoms.filter(atom=>{
    const neighbors=adjacent(atom.id), element=id=>index.byId.get(id)?.element;
    if(atom.element!==spec.element)return false;
    if(spec.degree!=null && neighbors.length!==spec.degree)return false;
    if(spec.aromatic===false && aromatic.has(atom.id))return false;
    if(spec.singleBondsOnly && neighbors.some(item=>item.order!==1))return false;
    if(spec.notCarbonyl && neighbors.some(item=>item.order===2&&element(item.id)==='O'))return false;
    if(spec.neighborElementsAny && !neighbors.some(item=>spec.neighborElementsAny.includes(element(item.id))))return false;
    if(spec.singleNeighborElementsOnly && neighbors.some(item=>item.order===1&&!spec.singleNeighborElementsOnly.includes(element(item.id))))return false;
    return true;
  }).map(atom=>atom.id));
  if(candidates.some(items=>!items.length))return [];
  const edges=pattern.atoms.map((_,node)=>pattern.bonds.filter(([a,b])=>a===node||b===node));
  const order=pattern.atoms.map((_,i)=>i).sort((a,b)=>candidates[a].length-candidates[b].length||edges[b].length-edges[a].length);
  const mapping=new Map(),used=new Set(),matches=new Map();
  function search(depth){
    if(matches.size>=limit)return;
    if(depth===order.length){const ids=pattern.atoms.map((_,i)=>mapping.get(i));matches.set([...ids].sort((a,b)=>a-b).join(','),ids);return;}
    const node=order[depth];
    for(const id of candidates[node]){
      if(used.has(id))continue;
      if(!edges[node].every(([a,b,bondOrder])=>{const other=a===node?b:a;return !mapping.has(other)||adjacent(id).some(n=>n.id===mapping.get(other)&&n.order===bondOrder);}))continue;
      used.add(id);mapping.set(node,id);search(depth+1);mapping.delete(node);used.delete(id);
    }
  }
  search(0);return [...matches.values()];
}

export function validateFunctionalGroups(groups) {
  if(!Array.isArray(groups))throw new Error('Invalid functional group database');
  const ids=new Set();
  for(const group of groups){
    if(!group.id||ids.has(group.id)||!group.nameJa||!group.nameEn||!group.notation||!group.family||!group.pattern?.atoms?.length||!Array.isArray(group.pattern.bonds))throw new Error('Invalid functional group');
    ids.add(group.id);
    if(group.pattern.atoms.some(atom=>!['H','C','N','O','F','P','S','Cl'].includes(atom.element)))throw new Error(`Invalid pattern atom: ${group.id}`);
    for(const [a,b,order] of group.pattern.bonds)if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=group.pattern.atoms.length||b>=group.pattern.atoms.length||a===b||![1,2,3].includes(order))throw new Error(`Invalid pattern bond: ${group.id}`);
  }
  return groups;
}

export function detectFunctionalGroups(graph, groups) {
  const index=graphIndex(graph),aromaticDefinition=groups.find(group=>group.id==='aromatic-ring');
  const rings=aromaticDefinition?matchesPattern(index,aromaticDefinition.pattern):[];
  const aromatic=new Set(rings.flat());
  return groups.flatMap(group=>{
    const matches=group===aromaticDefinition?rings:matchesPattern(index,group.pattern,aromatic);
    return matches.length?[{id:group.id,matches,count:matches.length}]:[];
  });
}

export function structuralMilestones(graph, detected, groups) {
  const index=graphIndex(graph),result=[];
  if(index.bonds.some(bond=>bond.order===2))result.push('double-bond');
  if(index.bonds.some(bond=>bond.order===3))result.push('triple-bond');
  const visited=new Set();
  function cyclic(id,parent){visited.add(id);for(const n of index.adjacency.get(id)){if(n.id===parent)continue;if(visited.has(n.id)||cyclic(n.id,id))return true;}return false;}
  if(index.atoms.some(atom=>!visited.has(atom.id)&&cyclic(atom.id,null)))result.push('ring');
  if(detected.some(item=>item.id==='aromatic-ring'))result.push('aromatic-ring');
  const families=new Set(detected.map(item=>groups.find(group=>group.id===item.id)).filter(group=>group?.milestoneFamily!==false).map(group=>group?.family).filter(family=>family&&!['skeleton','aromatic','unsaturation'].includes(family)));
  if(detected.some(item=>['carboxyl','ester','amide'].includes(item.id)))families.delete('carbonyl');
  if(families.size>=2)result.push('multiple-groups');
  return result;
}
