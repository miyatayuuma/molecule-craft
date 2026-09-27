// Shared, graph-only aromatic cycle authority for the currently supported
// benzene, pyridine and furan topologies. Geometry and drawing consume the
// same classification as structural site matching.
const idKey=id=>`${typeof id}:${JSON.stringify(id)}`;
const pairKey=(a,b)=>JSON.stringify([idKey(a),idKey(b)].sort());

export function isSupportedAromaticCycleGraph(atoms,bonds,cycle){
  if(!Array.isArray(cycle)||(cycle.length!==5&&cycle.length!==6))return false;
  const byId=new Map(atoms.map((atom,index)=>[atom.id??index,atom]));
  const adjacency=new Map([...byId.keys()].map(id=>[id,[]]));
  const bondByKey=new Map();
  for(const raw of bonds){
    const a=Array.isArray(raw)?(atoms[raw[0]]?.id??raw[0]):raw.a;
    const b=Array.isArray(raw)?(atoms[raw[1]]?.id??raw[1]):raw.b;
    const order=Array.isArray(raw)?raw[2]:raw.order;
    if(!byId.has(a)||!byId.has(b))continue;
    adjacency.get(a).push({id:b,order});adjacency.get(b).push({id:a,order});bondByKey.set(pairKey(a,b),order);
  }
  const cycleAtoms=cycle.map(id=>byId.get(id));
  if(cycleAtoms.some(atom=>!atom))return false;
  const orders=cycle.map((id,index)=>bondByKey.get(pairKey(id,cycle[(index+1)%cycle.length]))??0);
  if(orders.some(order=>order!==1&&order!==2))return false;
  const doubleCount=orders.filter(order=>order===2).length;
  const totalBondOrder=id=>(adjacency.get(id)??[]).reduce((sum,neighbor)=>sum+neighbor.order,0);
  const formalCharge=atom=>atom.formalCharge??0;
  const isPiCenter=id=>{
    const atom=byId.get(id),total=totalBondOrder(id);
    return formalCharge(atom)===0&&((atom.element==='C'&&total<=4)||(atom.element==='N'&&total<=3));
  };
  if(cycle.length===6){
    return doubleCount===3
      &&orders.every((order,index)=>order!==orders[(index+1)%cycle.length])
      &&cycle.every(id=>['C','N'].includes(byId.get(id).element)&&isPiCenter(id));
  }
  if(doubleCount!==2)return false;
  let lonePairContributors=0;
  for(let index=0;index<cycle.length;index++){
    const id=cycle[index],atom=byId.get(id);
    const previous=orders[(index+cycle.length-1)%cycle.length],next=orders[index];
    const incidentDoubleCount=(previous===2?1:0)+(next===2?1:0);
    if(incidentDoubleCount===1){if(!isPiCenter(id))return false;continue;}
    if(incidentDoubleCount===0&&atom.element==='O'&&formalCharge(atom)===0&&totalBondOrder(id)===2){lonePairContributors++;continue;}
    return false;
  }
  return lonePairContributors===1;
}

export function aromaticGraphAtomIds(atoms,bonds){
  const ids=atoms.map((atom,index)=>atom.id??index),adjacency=new Map(ids.map(id=>[id,[]]));
  for(const raw of bonds){
    const a=Array.isArray(raw)?ids[raw[0]]:raw.a,b=Array.isArray(raw)?ids[raw[1]]:raw.b;
    if(!adjacency.has(a)||!adjacency.has(b))continue;
    adjacency.get(a).push(b);adjacency.get(b).push(a);
  }
  const found=new Set(),result=new Set();
  const canonical=cycle=>{
    const variants=[];
    for(const sequence of [cycle,[...cycle].reverse()])for(let offset=0;offset<sequence.length;offset++)variants.push(JSON.stringify([...sequence.slice(offset),...sequence.slice(0,offset)].map(idKey)));
    return variants.sort()[0];
  };
  for(const start of ids){
    const walk=(current,path,visited)=>{
      if(path.length>6)return;
      for(const next of adjacency.get(current)??[]){
        if(next===start&&path.length>=5&&path.length<=6){
          const key=canonical(path);if(found.has(key))continue;found.add(key);
          if(isSupportedAromaticCycleGraph(atoms,bonds,path))path.forEach(id=>result.add(id));
          continue;
        }
        if(visited.has(next)||path.length>=6)continue;
        visited.add(next);path.push(next);walk(next,path,visited);path.pop();visited.delete(next);
      }
    };
    walk(start,[start],new Set([start]));
  }
  return result;
}
