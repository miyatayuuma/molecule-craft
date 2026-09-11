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
function candidateTargets(target,workspace,workspaceIndex){
  const atom=workspace.atoms[workspaceIndex],used=incidentOrder(workspace.edges,workspaceIndex);
  return target.atoms.filter(targetAtom=>targetAtom.element===atom.element&&incidentOrder(target.edges,targetAtom.index)>=used).map(targetAtom=>targetAtom.index);
}

function findEmbedding(target,workspace,{requiredPair=null}={}){
  const candidates=workspace.atoms.map((_,index)=>candidateTargets(target,workspace,index));
  if(candidates.some(list=>!list.length))return null;
  const order=workspace.atoms.map((_,index)=>index).sort((a,b)=>candidates[a].length-candidates[b].length||workspace.edges[b].size-workspace.edges[a].size||incidentOrder(workspace.edges,b)-incidentOrder(workspace.edges,a)||a-b);
  const targetForWorkspace=Array(workspace.atoms.length).fill(-1),usedTarget=new Set();
  const [requiredA,requiredB]=requiredPair??[-1,-1];
  const requiredCurrent=requiredPair?(workspace.edges[requiredA].get(requiredB)??0):0;

  function compatible(workspaceIndex,targetIndex){
    for(let other=0;other<targetForWorkspace.length;other++){
      const mappedTarget=targetForWorkspace[other];if(mappedTarget<0)continue;
      const workspaceOrder=workspace.edges[workspaceIndex].get(other)??0;
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
    if(depth===order.length)return targetForWorkspace.slice();
    const workspaceIndex=order[depth];
    for(const targetIndex of candidates[workspaceIndex]){
      if(usedTarget.has(targetIndex)||!compatible(workspaceIndex,targetIndex))continue;
      targetForWorkspace[workspaceIndex]=targetIndex;usedTarget.add(targetIndex);
      const result=visit(depth+1);if(result)return result;
      usedTarget.delete(targetIndex);targetForWorkspace[workspaceIndex]=-1;
    }
    return null;
  }
  return visit(0);
}

export function nextCraftBondHint(targetGraph,workspaceGraph){
  const target=normalizeAtoms(targetGraph),workspace=normalizeAtoms(workspaceGraph);
  if(!target||!workspace||workspace.atoms.length<2||workspace.atoms.length>target.atoms.length)return null;
  const targetCounts=elementCounts(target.atoms),workspaceCounts=elementCounts(workspace.atoms);
  for(const [element,count] of workspaceCounts)if(count>(targetCounts.get(element)??0))return null;
  if(!findEmbedding(target,workspace))return null;

  const maxTargetOrderByElements=new Map();
  for(let a=0;a<target.atoms.length;a++)for(const [b,order] of target.edges[a])if(a<b){
    const pair=[target.atoms[a].element,target.atoms[b].element].sort().join('\0');
    maxTargetOrderByElements.set(pair,Math.max(maxTargetOrderByElements.get(pair)??0,order));
  }
  const candidates=[];
  for(let a=0;a<workspace.atoms.length;a++)for(let b=a+1;b<workspace.atoms.length;b++){
    const currentOrder=workspace.edges[a].get(b)??0,elementPair=[workspace.atoms[a].element,workspace.atoms[b].element].sort().join('\0');
    if((maxTargetOrderByElements.get(elementPair)??0)<=currentOrder)continue;
    const embedding=findEmbedding(target,workspace,{requiredPair:[a,b]});if(!embedding)continue;
    const targetOrder=target.edges[embedding[a]].get(embedding[b])??0;
    if(targetOrder<=currentOrder)continue;
    candidates.push({atomIds:[workspace.atoms[a].id,workspace.atoms[b].id],workspaceIndices:[a,b],currentOrder,nextOrder:currentOrder+1,targetOrder,targetAtomIndices:[embedding[a],embedding[b]]});
  }
  if(!candidates.length)return null;
  candidates.sort((left,right)=>right.currentOrder-left.currentOrder||left.workspaceIndices[0]-right.workspaceIndices[0]||left.workspaceIndices[1]-right.workspaceIndices[1]||left.targetAtomIndices[0]-right.targetAtomIndices[0]||left.targetAtomIndices[1]-right.targetAtomIndices[1]);
  const selected=candidates[0],contextKey=`${graphSignature(target)}\n${graphSignature(workspace,{includeIds:true})}`;
  return{...selected,contextKey,equivalentCandidates:candidates.map(candidate=>({atomIds:[...candidate.atomIds],workspaceIndices:[...candidate.workspaceIndices],currentOrder:candidate.currentOrder,nextOrder:candidate.nextOrder,targetOrder:candidate.targetOrder}))};
}

let presentedContextKey=null,requestedContextKey=null,latestHint=null;
export function requestCraftHintHighlight(){
  if(!latestHint?.contextKey)return false;
  requestedContextKey=latestHint.contextKey;return true;
}
export function craftHintElectronKeys(hint,electronVisuals){
  const contextKey=hint?.contextKey??null;
  if(contextKey!==presentedContextKey){presentedContextKey=contextKey;requestedContextKey=null;}
  latestHint=hint??null;
  if(!hint||requestedContextKey!==contextKey||!Array.isArray(hint.atomIds)||hint.atomIds.length!==2||!Array.isArray(electronVisuals))return new Set();
  const selected=[];
  for(const atomId of hint.atomIds){
    const electron=electronVisuals.filter(item=>item?.atomId===atomId&&item?.kind==='electron').sort((a,b)=>a.index-b.index)[0];
    if(!electron)return new Set();
    selected.push(`${electron.atomId}:${electron.index}`);
  }
  return new Set(selected);
}
