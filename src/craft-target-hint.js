function normalizeAtoms(graph){
  if(!Array.isArray(graph?.atoms)||!Array.isArray(graph?.bonds))return null;
  const atoms=graph.atoms.map((atom,index)=>{
    if(typeof atom==='string')return{id:index,element:atom,index};
    return{id:atom?.id??index,element:atom?.element,index};
  });
  if(atoms.some(atom=>!atom.element))return null;
  const byId=new Map(atoms.map((atom,index)=>[atom.id,index]));
  const edges=atoms.map(()=>new Map());
  for(const bond of graph.bonds){
    let a,b,order;
    if(Array.isArray(bond)){[a,b,order]=bond;}
    else{a=byId.get(bond?.a)??bond?.a;b=byId.get(bond?.b)??bond?.b;order=bond?.order;}
    if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=atoms.length||b>=atoms.length||a===b||!Number.isInteger(order)||order<=0)return null;
    edges[a].set(b,order);edges[b].set(a,order);
  }
  return{atoms,edges};
}

function incidentOrder(edges,index){let total=0;for(const order of edges[index].values())total+=order;return total;}
function elementCounts(atoms){const counts=new Map();for(const atom of atoms)counts.set(atom.element,(counts.get(atom.element)??0)+1);return counts;}
function graphSignature(graph,{includeIds=false}={}){
  const atoms=graph.atoms.map(atom=>includeIds?[atom.id,atom.element]:atom.element),bonds=[];
  for(let a=0;a<graph.edges.length;a++)for(const [b,order]of graph.edges[a])if(a<b)bonds.push([a,b,order]);
  return JSON.stringify([atoms,bonds]);
}
function candidateTargets(target,workspace,workspaceIndex,{extraOrder=0,extraDegree=0}={}){
  const atom=workspace.atoms[workspaceIndex],used=incidentOrder(workspace.edges,workspaceIndex),degree=workspace.edges[workspaceIndex].size;
  return target.atoms.filter(targetAtom=>targetAtom.element===atom.element&&target.edges[targetAtom.index].size>=degree+extraDegree&&incidentOrder(target.edges,targetAtom.index)>=used+extraOrder).map(targetAtom=>targetAtom.index);
}
const bump=(stats,key,amount=1)=>{if(stats)stats[key]=(stats[key]??0)+amount;};

function findEmbedding(target,workspace,{requiredPair=null,stats=null}={}){
  bump(stats,'embeddingCalls');
  const [requiredA,requiredB]=requiredPair??[-1,-1],requiredCurrent=requiredPair?(workspace.edges[requiredA].get(requiredB)??0):0;
  const candidates=workspace.atoms.map((_,index)=>{
    const requiredEndpoint=index===requiredA||index===requiredB;
    return candidateTargets(target,workspace,index,{extraOrder:requiredEndpoint?1:0,extraDegree:requiredEndpoint&&requiredCurrent===0?1:0});
  });
  bump(stats,'candidateTargets',candidates.reduce((sum,list)=>sum+list.length,0));
  if(candidates.some(list=>!list.length)){bump(stats,'emptyCandidatePrunes');return null;}
  const order=workspace.atoms.map((_,index)=>index).sort((a,b)=>{
    // requiredPair is a real embedding constraint, just like an existing bond.
    // Check its endpoints before interchangeable loose atoms so a failed pair
    // does not enumerate permutations that cannot affect the outcome.
    const requiredPriority=Number(b===requiredA||b===requiredB)-Number(a===requiredA||a===requiredB);
    return requiredPriority||candidates[a].length-candidates[b].length||workspace.edges[b].size-workspace.edges[a].size||incidentOrder(workspace.edges,b)-incidentOrder(workspace.edges,a)||a-b;
  });
  const targetForWorkspace=Array(workspace.atoms.length).fill(-1),usedTarget=new Set();

  function compatible(workspaceIndex,targetIndex){
    // Subgraph matching only constrains existing workspace edges. Iterating the
    // actual neighbors keeps compatibility O(degree) instead of O(atom count).
    for(const [other,workspaceOrder]of workspace.edges[workspaceIndex]){
      const mappedTarget=targetForWorkspace[other];if(mappedTarget<0)continue;
      const targetOrder=target.edges[targetIndex].get(mappedTarget)??0;
      if(workspaceOrder>targetOrder)return false;
    }
    if(requiredPair){
      if(workspaceIndex===requiredA&&targetForWorkspace[requiredB]>=0&&(target.edges[targetIndex].get(targetForWorkspace[requiredB])??0)<=requiredCurrent)return false;
      if(workspaceIndex===requiredB&&targetForWorkspace[requiredA]>=0&&(target.edges[targetIndex].get(targetForWorkspace[requiredA])??0)<=requiredCurrent)return false;
    }
    return true;
  }

  function visit(depth){
    bump(stats,'recursiveVisits');
    if(depth===order.length)return targetForWorkspace.slice();
    const workspaceIndex=order[depth];
    for(const targetIndex of candidates[workspaceIndex]){
      bump(stats,'candidateAssignments');
      if(usedTarget.has(targetIndex)||!compatible(workspaceIndex,targetIndex))continue;
      targetForWorkspace[workspaceIndex]=targetIndex;usedTarget.add(targetIndex);
      const result=visit(depth+1);if(result)return result;
      usedTarget.delete(targetIndex);targetForWorkspace[workspaceIndex]=-1;
    }
    return null;
  }
  return visit(0);
}

function targetCapacityByElement(target){
  const capacity=new Map();
  for(const atom of target.atoms){
    const current=capacity.get(atom.element)??{degree:0,order:0};
    current.degree=Math.max(current.degree,target.edges[atom.index].size);current.order=Math.max(current.order,incidentOrder(target.edges,atom.index));capacity.set(atom.element,current);
  }
  return capacity;
}
function canGrowEndpoint(workspace,index,currentOrder,capacity){
  const max=capacity.get(workspace.atoms[index].element);if(!max)return false;
  if(max.order<incidentOrder(workspace.edges,index)+1)return false;
  return currentOrder>0||max.degree>=workspace.edges[index].size+1;
}

export function nextCraftBondHint(targetGraph,workspaceGraph,{stats=null}={}){
  const target=normalizeAtoms(targetGraph),workspace=normalizeAtoms(workspaceGraph);
  if(!target||!workspace||workspace.atoms.length<2||workspace.atoms.length>target.atoms.length)return null;
  const targetCounts=elementCounts(target.atoms),workspaceCounts=elementCounts(workspace.atoms);
  for(const [element,count] of workspaceCounts)if(count>(targetCounts.get(element)??0))return null;
  if(!findEmbedding(target,workspace,{stats}))return null;

  const maxTargetOrderByElements=new Map(),capacity=targetCapacityByElement(target);
  for(let a=0;a<target.atoms.length;a++)for(const [b,order] of target.edges[a])if(a<b){
    const pair=[target.atoms[a].element,target.atoms[b].element].sort().join('\0');
    maxTargetOrderByElements.set(pair,Math.max(maxTargetOrderByElements.get(pair)??0,order));
  }
  const candidates=[];
  for(let a=0;a<workspace.atoms.length;a++)for(let b=a+1;b<workspace.atoms.length;b++){
    bump(stats,'pairChecks');
    const currentOrder=workspace.edges[a].get(b)??0,elementPair=[workspace.atoms[a].element,workspace.atoms[b].element].sort().join('\0');
    if((maxTargetOrderByElements.get(elementPair)??0)<=currentOrder)continue;
    if(!canGrowEndpoint(workspace,a,currentOrder,capacity)||!canGrowEndpoint(workspace,b,currentOrder,capacity)){bump(stats,'capacityPrunes');continue;}
    bump(stats,'pairEmbeddingCalls');
    const embedding=findEmbedding(target,workspace,{requiredPair:[a,b],stats});if(!embedding)continue;
    const targetOrder=target.edges[embedding[a]].get(embedding[b])??0;
    if(targetOrder<=currentOrder)continue;
    candidates.push({atomIds:[workspace.atoms[a].id,workspace.atoms[b].id],workspaceIndices:[a,b],currentOrder,nextOrder:currentOrder+1,targetOrder,targetAtomIndices:[embedding[a],embedding[b]]});
  }
  if(!candidates.length)return null;
  const targetPair=candidate=>[...candidate.targetAtomIndices].sort((a,b)=>a-b);
  candidates.sort((left,right)=>{const l=targetPair(left),r=targetPair(right);return right.currentOrder-left.currentOrder||l[0]-r[0]||l[1]-r[1]||left.workspaceIndices[0]-right.workspaceIndices[0]||left.workspaceIndices[1]-right.workspaceIndices[1];});
  const selected=candidates[0],contextKey=`${graphSignature(target)}\n${graphSignature(workspace,{includeIds:true})}`;
  return{...selected,contextKey,equivalentCandidates:candidates.map(candidate=>({atomIds:[...candidate.atomIds],workspaceIndices:[...candidate.workspaceIndices],currentOrder:candidate.currentOrder,nextOrder:candidate.nextOrder,targetOrder:candidate.targetOrder}))};
}

let presentedContextKey=null,requestedContextKey=null,requestPending=false;
export function requestCraftHintHighlight(){requestPending=true;}
export function craftHintElectronKeys(hint,electronVisuals){
  const contextKey=hint?.contextKey??null;
  if(contextKey!==presentedContextKey){presentedContextKey=contextKey;requestedContextKey=null;}
  if(requestPending){requestPending=false;requestedContextKey=contextKey;}
  if(!hint||requestedContextKey!==contextKey||!Array.isArray(hint.atomIds)||hint.atomIds.length!==2||!Array.isArray(electronVisuals))return new Set();
  const selected=[];
  for(const atomId of hint.atomIds){
    const electron=electronVisuals.filter(item=>item?.atomId===atomId&&item?.kind==='electron').sort((a,b)=>a.index-b.index)[0];
    if(!electron)return new Set();
    selected.push(`${electron.atomId}:${electron.index}`);
  }
  return new Set(selected);
}
