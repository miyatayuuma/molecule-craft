const rowsToObjects=(columns,rows)=>rows.map(row=>Object.fromEntries(columns.map((key,index)=>[key,row[index]])));

export function createMoleculeGraph(raw){
  if(!raw||raw.schemaVersion!==1||!Array.isArray(raw.nodeColumns)||!Array.isArray(raw.nodes)||!Array.isArray(raw.edgeColumns)||!Array.isArray(raw.edges))throw Error('Invalid molecule graph');
  const nodes=rowsToObjects(raw.nodeColumns,raw.nodes),byId=new Map(nodes.map(node=>[node.id,node]));
  if(byId.size!==nodes.length)throw Error('Duplicate molecule graph node');
  const endpointId=value=>Number.isInteger(value)?nodes[value]?.id:value;
  const edges=rowsToObjects(raw.edgeColumns,raw.edges).map(edge=>({...edge,from:endpointId(edge.from),to:endpointId(edge.to)}));
  const adjacency=new Map(nodes.map(node=>[node.id,[]]));
  for(const edge of edges){
    if(!byId.has(edge.from)||!byId.has(edge.to)||edge.from===edge.to)throw Error('Invalid molecule graph edge');
    adjacency.get(edge.from).push(edge.to);adjacency.get(edge.to).push(edge.from);
  }
  const graph={
    schemaVersion:raw.schemaVersion,
    roots:Object.freeze([...(raw.graphRoots??[])]),
    familyCodes:Object.freeze({...raw.familyCodes}),
    branchCodes:Object.freeze({...raw.branchCodes}),
    nodes:Object.freeze(nodes),
    edges:Object.freeze(edges),
    nodeById:id=>byId.get(id)??null,
    getNeighbors:id=>Object.freeze([...(adjacency.get(id)??[])]),
  };
  return Object.freeze(graph);
}

export async function loadMoleculeGraph({fetchImpl=globalThis.fetch,url='./data/molecule-graph.json'}={}){
  if(typeof fetchImpl!=='function')throw Error('Molecule graph fetch is unavailable');
  const response=await fetchImpl(url);
  if(!response?.ok)throw Error(`Molecule graph load failed: ${response?.status??'network'}`);
  return createMoleculeGraph(await response.json());
}

export {getFrontierCandidates,FRONTIER_WEIGHTING,scoreFrontierCandidates,selectFrontierCandidate,createSeededFrontierRng} from './molecule-frontier.js';
