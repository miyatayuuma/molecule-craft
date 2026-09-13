export const GRAPH_NODE_STATE=Object.freeze({UNKNOWN:'unknown',KNOWN:'known',REGISTERED:'registered'});
const SECTOR_ANGLE=Object.freeze({0:-Math.PI/2,1:-Math.PI/2,2:-Math.PI/4,3:0,4:Math.PI/4,5:Math.PI/2,6:3*Math.PI/4,7:Math.PI,8:-3*Math.PI/4});
const TAU=Math.PI*2;
const normAngle=value=>{let angle=value%TAU;if(angle<=-Math.PI)angle+=TAU;if(angle>Math.PI)angle-=TAU;return angle;};
const angleDistance=(a,b)=>Math.abs(normAngle(a-b));
const stableHash=value=>{let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;};
const asSet=value=>value instanceof Set?value:new Set(value??[]);

export function graphNodeState(id,{registeredIds=[],recipes=[],hints=[]}={}){
  if(asSet(registeredIds).has(id))return GRAPH_NODE_STATE.REGISTERED;
  if(asSet(recipes).has(id)||asSet(hints).has(id))return GRAPH_NODE_STATE.KNOWN;
  return GRAPH_NODE_STATE.UNKNOWN;
}

export function graphNodePresentation(record,state,{selected=false}={}){
  if(state===GRAPH_NODE_STATE.UNKNOWN)return {state,name:'',formula:'',ariaLabel:selected?'選択中の未知の分子':'未知の分子',canOpenDetail:false,canCraft:false};
  const name=record?.commonNameJa??record?.nameJa??record?.nameEn??record?.id??'';
  const formula=record?.formula??'';
  return {state,name,formula,ariaLabel:[name,formula,state===GRAPH_NODE_STATE.REGISTERED?'登録済み':'レシピ判明'].filter(Boolean).join(' '),canOpenDetail:state===GRAPH_NODE_STATE.REGISTERED,canCraft:state===GRAPH_NODE_STATE.KNOWN};
}

export function canonicalGraphPositions(graph){
  const positions=new Map();
  for(const node of graph.nodes){
    const base=SECTOR_ANGLE[node.sectorCode]??-Math.PI/2;
    const branch=(node.branchCodes?.[0]??0)%7,family=(node.familyCode??0)%5;
    const jitter=((stableHash(node.id)%2001)/2000-.5)*.24+(branch-3)*.014+(family-2)*.009;
    const radius=node.sectorCode===0?(34+(stableHash(node.id)%3)*24):(112+node.depth*112+node.tier*18);
    const angle=base+jitter;
    positions.set(node.id,{x:Math.cos(angle)*radius,y:Math.sin(angle)*radius,angle,radius});
  }
  return positions;
}

export function selectInitialGraphFocus(graph,{registeredIds=[],recipes=[],hints=[],previousId=null,entriesById=new Map()}={}){
  const registered=asSet(registeredIds),known=new Set([...asSet(recipes),...asSet(hints)]);
  const identity=id=>registered.has(id)||known.has(id);
  if(previousId&&graph.nodeById(previousId)&&identity(previousId))return previousId;
  let latest=null,latestOrder=-Infinity;
  for(const id of registered){const order=entriesById.get(id)?.order??-Infinity;if(graph.nodeById(id)&&order>latestOrder){latest=id;latestOrder=order;}}
  if(latest)return latest;
  const hub=graph.nodes.find(node=>identity(node.id)&&String(node.roleCodes??'').includes('H'))?.id;if(hub)return hub;
  const root=graph.roots.find(identity);if(root)return root;
  const first=graph.nodes.find(node=>identity(node.id))?.id;if(first)return first;
  return graph.roots.find(id=>graph.nodeById(id))??graph.nodes[0]?.id??null;
}

export function buildVisibleGraphProjection(graph,{focusId,registeredIds=[],recipes=[],hints=[]}={}){
  const registered=asSet(registeredIds),recipeSet=asSet(recipes),hintSet=asSet(hints);
  const stateFor=id=>graphNodeState(id,{registeredIds:registered,recipes:recipeSet,hints:hintSet});
  const identity=new Set(graph.nodes.filter(node=>stateFor(node.id)!==GRAPH_NODE_STATE.UNKNOWN).map(node=>node.id));
  const visible=new Set(identity);
  for(const id of registered)for(const neighbor of graph.getNeighbors(id))visible.add(neighbor);
  if(!identity.size)for(const id of graph.roots)visible.add(id);
  if(focusId&&graph.nodeById(focusId))visible.add(focusId);
  const direct=(focusId?graph.getNeighbors(focusId):[]),oneHop=direct.filter(id=>visible.has(id)),hiddenOneHop=direct.filter(id=>!visible.has(id));
  const directSet=new Set(direct),twoHopSet=new Set(),teaserEdges=[];
  for(const neighbor of direct)for(const id of graph.getNeighbors(neighbor))if(id!==focusId&&!directSet.has(id)){twoHopSet.add(id);teaserEdges.push({from:neighbor,to:id});}
  const twoHop=[...twoHopSet].sort();
  const local=new Set([focusId,...oneHop,...twoHop].filter(Boolean));
  const distant=[...visible].filter(id=>!local.has(id));
  const visibleEdges=graph.edges.filter(edge=>visible.has(edge.from)&&visible.has(edge.to));
  const continuation=oneHop.map(id=>({id,continues:graph.getNeighbors(id).some(next=>next!==focusId&&!visible.has(next))}));
  return {focusId,visibleIds:[...visible],oneHop,hiddenOneHop,twoHop,distant,visibleEdges,teaserEdges,continuation,stateFor};
}

export function layoutFocusNeighborhood(graph,focusId,{width=360,height=480,nodeDiameter=66}={}){
  const center={x:width/2,y:Math.max(150,Math.min(height*.46,height-150))};
  const neighbors=[...graph.getNeighbors(focusId)].sort((a,b)=>{
    const na=graph.nodeById(a),nb=graph.nodeById(b),aa=SECTOR_ANGLE[na?.sectorCode]??-Math.PI/2,ab=SECTOR_ANGLE[nb?.sectorCode]??-Math.PI/2;
    return aa-ab||a.localeCompare(b);
  });
  const slots=Array.from({length:8},(_,index)=>-Math.PI/2+index*Math.PI/4),used=new Set(),positions=new Map([[focusId,{...center,kind:'focus',angle:0}]]);
  const radius=Math.max(nodeDiameter+30,Math.min(138,width*.34,height*.29));
  for(const id of neighbors){
    const preferred=SECTOR_ANGLE[graph.nodeById(id)?.sectorCode]??-Math.PI/2;
    let best=-1,bestDistance=Infinity;
    for(let index=0;index<slots.length;index++)if(!used.has(index)){
      const distance=angleDistance(slots[index],preferred);if(distance<bestDistance-1e-9){best=index;bestDistance=distance;}
    }
    if(best<0)continue;used.add(best);const angle=slots[best];
    positions.set(id,{x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius,kind:'neighbor',angle});
  }
  return {center,radius,nodeDiameter,positions,neighbors};
}

export function localBoundsOverlap(layout,{diameter=layout.nodeDiameter??66}={}){
  const points=[...layout.positions.values()];
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)<diameter-1e-6)return true;
  return false;
}

export function transitionGraphFocus(graph,currentFocus,targetId,stateOptions={}){
  const targetState=graphNodeState(targetId,stateOptions);
  if(targetState===GRAPH_NODE_STATE.UNKNOWN)return {focusId:currentFocus,highlightId:targetId,changed:false};
  return {focusId:targetId,highlightId:null,changed:targetId!==currentFocus};
}

export function searchKnownGraphNodes(records,stateOptions,query){
  const needle=String(query??'').trim().toLocaleLowerCase();if(!needle)return [];
  return records.filter(record=>graphNodeState(record.id,stateOptions)!==GRAPH_NODE_STATE.UNKNOWN).map(record=>({record,presentation:graphNodePresentation(record,graphNodeState(record.id,stateOptions))})).filter(({record,presentation})=>[presentation.name,presentation.formula,record.nameEn,record.iupacNameEn,...(record.aliases??[])].filter(Boolean).some(value=>String(value).toLocaleLowerCase().includes(needle))).slice(0,8);
}
