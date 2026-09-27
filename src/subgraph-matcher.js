// Shared exhaustive backtracking primitive for small labelled subgraph
// patterns. Atom semantics stay with each caller; this module only enforces
// injective bindings and exact declared bond-order edges.
export function enumerateSubgraphMappings({labels,candidates,edges,adjacency,limit=Infinity,overflow='throw',identityKey=null}){
  if(!Array.isArray(labels)||!labels.length||!(limit===Infinity||(Number.isInteger(limit)&&limit>=0))||!['throw','truncate'].includes(overflow))throw new Error('invalid-subgraph-matcher-options');
  if(labels.some(label=>!candidates.has(label)||!Array.isArray(candidates.get(label))))throw new Error('invalid-subgraph-candidates');
  const degree=new Map(labels.map(label=>[label,edges.filter(edge=>edge.a===label||edge.b===label).length]));
  const order=[...labels].sort((a,b)=>candidates.get(a).length-candidates.get(b).length||degree.get(b)-degree.get(a)||String(a).localeCompare(String(b)));
  const bound=new Map(),used=new Set(),matches=[],seen=new Set();let truncated=false;
  function search(depth){
    if(truncated)return;
    if(depth===order.length){
      const binding=Object.fromEntries(labels.map(label=>[label,bound.get(label)])),key=identityKey?identityKey(binding):JSON.stringify(binding);
      if(seen.has(key))return;
      if(matches.length>=limit){if(overflow==='throw')throw new Error('pattern-match-overflow');truncated=true;return;}
      seen.add(key);matches.push(binding);return;
    }
    const label=order[depth];
    for(const targetId of candidates.get(label)){
      if(used.has(targetId))continue;
      const compatible=edges.every(edge=>{
        const other=edge.a===label?edge.b:edge.b===label?edge.a:null;
        if(other==null||!bound.has(other))return true;
        return(adjacency.get(targetId)??[]).some(neighbor=>neighbor.id===bound.get(other)&&neighbor.order===edge.order);
      });
      if(!compatible)continue;
      bound.set(label,targetId);used.add(targetId);search(depth+1);bound.delete(label);used.delete(targetId);
      if(truncated)return;
    }
  }
  search(0);
  return matches;
}
