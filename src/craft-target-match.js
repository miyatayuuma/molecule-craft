function normalizeGraph(graph){
  if(!Array.isArray(graph?.atoms)||!Array.isArray(graph?.bonds))return null;
  const atoms=graph.atoms.map((atom,index)=>typeof atom==='string'?{id:index,element:atom,index}:{id:atom?.id??index,element:atom?.element,index});
  if(atoms.some(atom=>!atom.element))return null;
  const byId=new Map(atoms.map((atom,index)=>[atom.id,index])),edges=atoms.map(()=>new Map());
  for(const bond of graph.bonds){
    let a,b,order;
    if(Array.isArray(bond)){[a,b,order]=bond;}else{a=byId.get(bond?.a)??bond?.a;b=byId.get(bond?.b)??bond?.b;order=bond?.order;}
    if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=atoms.length||b>=atoms.length||a===b||!Number.isInteger(order)||order<=0)return null;
    const existing=edges[a].get(b)??0;if(existing&&existing!==order)return null;edges[a].set(b,order);edges[b].set(a,order);
  }
  return{atoms,edges};
}

function bondsOf(graph){
  const bonds=[];for(let a=0;a<graph.atoms.length;a++)for(const [b,order]of graph.edges[a])if(a<b)bonds.push([a,b,order]);return bonds;
}
function bondUnits(graph){return bondsOf(graph).reduce((sum,bond)=>sum+bond[2],0);}
function incidentOrder(graph,index){let total=0;for(const order of graph.edges[index].values())total+=order;return total;}
function graphKey(graph,{includeIds=false}={}){
  if(!graph)return'';
  const atoms=graph.atoms.map(atom=>includeIds?[atom.id,atom.element]:atom.element),bonds=bondsOf(graph);return JSON.stringify([atoms,bonds]);
}
function targetKey(record,normalized){return `${record?.id??record?.formula??record?.name??''}\n${graphKey(normalized)}`;}

function connectedComponents(graph){
  const seen=new Set(),components=[];
  for(let start=0;start<graph.atoms.length;start++){
    if(seen.has(start))continue;const indices=[],stack=[start];seen.add(start);
    while(stack.length){const current=stack.pop();indices.push(current);for(const next of graph.edges[current].keys())if(!seen.has(next)){seen.add(next);stack.push(next);}}
    indices.sort((a,b)=>a-b);components.push(indices);
  }
  return components;
}
function componentGraph(graph,indices){
  const oldToNew=new Map(indices.map((index,local)=>[index,local])),atoms=indices.map(index=>({id:graph.atoms[index].id,element:graph.atoms[index].element})),bonds=[];
  for(const oldA of indices)for(const [oldB,order]of graph.edges[oldA])if(oldA<oldB&&oldToNew.has(oldB))bonds.push([oldToNew.get(oldA),oldToNew.get(oldB),order]);
  return normalizeGraph({atoms,bonds});
}

function candidateTargets(target,fragment,fragmentIndex){
  const atom=fragment.atoms[fragmentIndex],used=incidentOrder(fragment,fragmentIndex),degree=fragment.edges[fragmentIndex].size;
  return target.atoms.filter(targetAtom=>targetAtom.element===atom.element&&target.edges[targetAtom.index].size>=degree&&incidentOrder(target,targetAtom.index)>=used).map(targetAtom=>targetAtom.index);
}
function hasEmbedding(target,fragment){
  if(fragment.atoms.length>target.atoms.length)return false;
  const candidates=fragment.atoms.map((_,index)=>candidateTargets(target,fragment,index));if(candidates.some(list=>!list.length))return false;
  const order=fragment.atoms.map((_,index)=>index).sort((a,b)=>candidates[a].length-candidates[b].length||fragment.edges[b].size-fragment.edges[a].size||incidentOrder(fragment,b)-incidentOrder(fragment,a)||a-b);
  const mapped=Array(fragment.atoms.length).fill(-1),usedTargets=new Set();
  function compatible(fragmentIndex,targetIndex){
    for(let other=0;other<mapped.length;other++){
      const mappedTarget=mapped[other];if(mappedTarget<0)continue;const currentOrder=fragment.edges[fragmentIndex].get(other)??0;if(!currentOrder)continue;
      const targetOrder=target.edges[targetIndex].get(mappedTarget)??0;if(currentOrder>targetOrder)return false;
    }
    return true;
  }
  function visit(depth){
    if(depth===order.length)return true;const fragmentIndex=order[depth];
    for(const targetIndex of candidates[fragmentIndex]){if(usedTargets.has(targetIndex)||!compatible(fragmentIndex,targetIndex))continue;mapped[fragmentIndex]=targetIndex;usedTargets.add(targetIndex);if(visit(depth+1))return true;usedTargets.delete(targetIndex);mapped[fragmentIndex]=-1;}
    return false;
  }
  return visit(0);
}

function cycleKey(cycle){
  const n=cycle.length,variants=[];
  for(let direction=0;direction<2;direction++)for(let start=0;start<n;start++)variants.push(Array.from({length:n},(_,offset)=>cycle[(start+(direction?-offset:offset)+n*2)%n]).join(','));
  return variants.sort()[0];
}
function sixCycles(graph){
  const cycles=new Map();
  function walk(start,current,path,used){
    if(path.length===6){if(graph.edges[current].has(start)){const key=cycleKey(path);if(!cycles.has(key))cycles.set(key,[...path]);}return;}
    for(const next of graph.edges[current].keys()){if(next===start||used.has(next))continue;used.add(next);path.push(next);walk(start,next,path,used);path.pop();used.delete(next);}
  }
  for(let start=0;start<graph.atoms.length;start++)walk(start,start,[start],new Set([start]));return[...cycles.values()];
}
function aromaticAlternatingCycles(graph){
  return sixCycles(graph).filter(cycle=>{
    const orders=cycle.map((atom,index)=>graph.edges[atom].get(cycle[(index+1)%cycle.length])??0);if(orders.some(order=>order!==1&&order!==2))return false;
    for(let index=0;index<orders.length;index++)if(orders[index]===orders[(index+1)%orders.length])return false;return true;
  });
}
function toggledVariant(graph,cycle){
  const atoms=graph.atoms.map(atom=>({id:atom.id,element:atom.element})),cycleEdges=new Set(cycle.map((atom,index)=>{const other=cycle[(index+1)%cycle.length];return atom<other?`${atom}:${other}`:`${other}:${atom}`;}));
  const bonds=bondsOf(graph).map(([a,b,order])=>[a,b,cycleEdges.has(`${a}:${b}`)?3-order:order]);return normalizeGraph({atoms,bonds});
}
function targetVariants(target){
  const variants=[target],seen=new Set([graphKey(target)]);for(const cycle of aromaticAlternatingCycles(target)){const variant=toggledVariant(target,cycle),key=graphKey(variant);if(!seen.has(key)){seen.add(key);variants.push(variant);}}
  return variants;
}
function prepareTarget(record){const graph=normalizeGraph(record);if(!graph)return null;return{key:targetKey(record,graph),graph,variants:targetVariants(graph),totalUnits:bondUnits(graph)};}
function workspaceStructuralKey(workspace){const graph=normalizeGraph(workspace);return graph?graphKey(graph,{includeIds:true}):'';}
function assessComponents(prepared,workspace){
  const graph=normalizeGraph(workspace);if(!graph)return{graph:null,assessments:[]};const assessments=[];
  for(const indices of connectedComponents(graph)){
    const fragment=componentGraph(graph,indices),score=bondUnits(fragment),valid=prepared.variants.some(target=>hasEmbedding(target,fragment));
    assessments.push({atomIds:fragment.atoms.map(atom=>atom.id),score,valid,key:graphKey(fragment,{includeIds:true})});
  }
  return{graph,assessments};
}
function resultFor(score,totalUnits,state,atomIds=[]){const percent=totalUnits>0?Math.max(0,Math.min(100,Math.round(score/totalUnits*100))):0;return{score,matchedBondOrderUnits:score,targetBondOrderUnits:totalUnits,percent,state,atomIds:[...atomIds]};}

export function evaluateCraftTargetMatch(targetGraph,workspaceGraph){
  const prepared=prepareTarget(targetGraph);if(!prepared)return null;const {assessments}=assessComponents(prepared,workspaceGraph),valid=assessments.filter(item=>item.valid&&item.score>0).sort((a,b)=>b.score-a.score||String(a.key).localeCompare(String(b.key))),best=valid[0];
  if(!best)return resultFor(0,prepared.totalUnits,'matching');return resultFor(best.score,prepared.totalUnits,best.score===prepared.totalUnits?'complete':'matching',best.atomIds);
}

export function createCraftTargetMatchTracker(){
  let prepared=null,lastTargetKey='',lastWorkspaceKey='',lastResult=null,trackedIds=new Set(),deadEnd=false;
  function reset(){prepared=null;lastTargetKey='';lastWorkspaceKey='';lastResult=null;trackedIds=new Set();deadEnd=false;}
  function update(targetGraph,workspaceGraph){
    if(!targetGraph){reset();return null;}
    const nextPrepared=prepareTarget(targetGraph);if(!nextPrepared){reset();return null;}
    if(nextPrepared.key!==lastTargetKey){prepared=nextPrepared;lastTargetKey=nextPrepared.key;lastWorkspaceKey='';lastResult=null;trackedIds=new Set();deadEnd=false;}
    const nextWorkspaceKey=workspaceStructuralKey(workspaceGraph);if(nextWorkspaceKey===lastWorkspaceKey&&lastResult)return lastResult;lastWorkspaceKey=nextWorkspaceKey;
    const {assessments}=assessComponents(prepared,workspaceGraph),tracked=trackedIds.size?assessments.find(item=>[...trackedIds].every(id=>item.atomIds.includes(id))):null;
    if(tracked&&(!tracked.valid||deadEnd)){
      if(!tracked.valid){deadEnd=true;lastResult=resultFor(0,prepared.totalUnits,'dead-end',tracked.atomIds);return lastResult;}
      deadEnd=false;
    }else if(deadEnd){deadEnd=false;trackedIds=new Set();}
    const valid=assessments.filter(item=>item.valid&&item.score>0);
    valid.sort((a,b)=>b.score-a.score||(tracked&&a===tracked?-1:tracked&&b===tracked?1:String(a.key).localeCompare(String(b.key))));
    const best=valid[0];if(!best){trackedIds=new Set();lastResult=resultFor(0,prepared.totalUnits,'matching');return lastResult;}
    trackedIds=new Set(best.atomIds);lastResult=resultFor(best.score,prepared.totalUnits,best.score===prepared.totalUnits?'complete':'matching',best.atomIds);return lastResult;
  }
  return{update,reset};
}
