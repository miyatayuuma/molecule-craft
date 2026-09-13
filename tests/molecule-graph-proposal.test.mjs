import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const root=new URL('../',import.meta.url);
const [graphRaw,moleculesRaw,audit]=await Promise.all([
  readFile(new URL('data/molecule-graph.proposed.json',root),'utf8'),
  readFile(new URL('data/molecules.json',root),'utf8'),
  readFile(new URL('docs/molecule-db-audit.md',root),'utf8'),
]);
const graph=JSON.parse(graphRaw),molecules=JSON.parse(moleculesRaw);
const rowsToObjects=(columns,rows)=>rows.map(row=>Object.fromEntries(columns.map((key,index)=>[key,row[index]])));
const nodes=rowsToObjects(graph.nodeColumns,graph.nodes),edges=rowsToObjects(graph.edgeColumns,graph.edges);
const byId=new Map(nodes.map(node=>[node.id,node]));
assert.equal(byId.size,nodes.length,'node IDs must be unique');
assert.equal(nodes.length,129,'proposal node count is design-locked');
assert.equal(edges.length,144,'proposal edge count is design-locked');
assert.equal(graph.status,'PROPOSAL_ONLY');
assert.equal(graph.basedOnMain,'0fc76f0a05bf3ae137f3a604a5f8a5ecd658ad1f');

const productionIds=molecules.map(m=>m.id);
assert.equal(new Set(productionIds).size,162,'production inventory remains 162 unique molecule IDs for this proposal baseline');
if(graph.existingInventory)assert.deepEqual(graph.existingInventory,productionIds,'existingInventory must exactly track production molecule IDs/order');

const auditRows=[...audit.matchAll(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*\*\*(RETAIN|REWRITE|DELETE)\*\*/gm)].map(match=>({index:Number(match[1]),id:match[2],decision:match[3]}));
assert.equal(auditRows.length,162,'audit must classify every production molecule exactly once');
assert.deepEqual(auditRows.map(row=>row.id),productionIds,'audit row order must track production molecule order');
assert.deepEqual(Object.fromEntries(['RETAIN','REWRITE','DELETE'].map(decision=>[decision,auditRows.filter(row=>row.decision===decision).length])),{RETAIN:117,REWRITE:8,DELETE:37});
const deleteIds=new Set(auditRows.filter(row=>row.decision==='DELETE').map(row=>row.id));
for(const id of deleteIds)assert(!byId.has(id),`DELETE molecule leaked into proposal: ${id}`);

const additions=new Map((graph.additions??[]).map(item=>[item.id,item]));
assert.equal(additions.size,4,'exactly four structural gap-fill ADD candidates are proposed');
for(const [id,item] of additions){
  assert(byId.has(id),`ADD must exist as proposal node: ${id}`);
  assert(!productionIds.includes(id),`ADD must not already exist in production inventory: ${id}`);
  assert.equal(typeof item.reason,'string');assert(item.reason.trim().length>12,`ADD needs a substantive reason: ${id}`);
  const auditLine=audit.split('\n').find(line=>line.includes(`\`${id}\``)&&line.includes('**ADD**'));
  assert(auditLine,`ADD must have an audit entry: ${id}`);
}

const validFamilyCodes=new Set(Object.keys(graph.familyCodes).map(Number));
const validRoleCodes=new Set(Object.keys(graph.roleCodes));
const validSectorCodes=new Set(Object.keys(graph.sectorCodes).map(Number));
const validBranchCodes=new Set(Object.keys(graph.branchCodes).map(Number));
const validRelationCodes=new Set(Object.keys(graph.relationCodes).map(Number));
const adjacency=new Map(nodes.map(node=>[node.id,new Set()]));
const incident=new Map(nodes.map(node=>[node.id,[]]));
const pairs=new Set();
edges.forEach((edge,index)=>{
  assert(byId.has(edge.from),`missing edge.from ${edge.from}`);assert(byId.has(edge.to),`missing edge.to ${edge.to}`);assert.notEqual(edge.from,edge.to,`self edge ${edge.from}`);
  assert(validRelationCodes.has(edge.relationCode),`invalid relationCode on edge ${index}`);
  const key=[edge.from,edge.to].sort().join('\u0000');assert(!pairs.has(key),`duplicate undirected edge ${edge.from} / ${edge.to}`);pairs.add(key);
  adjacency.get(edge.from).add(edge.to);adjacency.get(edge.to).add(edge.from);incident.get(edge.from).push(index);incident.get(edge.to).push(index);
});

const affinityPattern=/^(?:[HCODF](?:1|0?(?:\.\d+)?))(?:,(?:[HCODF](?:1|0?(?:\.\d+)?)))*$/;
for(const node of nodes){
  assert(validFamilyCodes.has(node.familyCode),`invalid familyCode: ${node.id}`);
  assert.equal(typeof node.roleCodes,'string');assert(node.roleCodes.length>0,`missing role: ${node.id}`);for(const role of node.roleCodes)assert(validRoleCodes.has(role),`invalid role ${role}: ${node.id}`);
  assert(Number.isInteger(node.depth)&&node.depth>=0,`invalid depth: ${node.id}`);assert(Number.isInteger(node.tier)&&node.tier>=0,`invalid tier: ${node.id}`);
  assert(validSectorCodes.has(node.sectorCode),`invalid sector: ${node.id}`);
  assert.equal(typeof node.affinities,'string');assert(affinityPattern.test(node.affinities),`invalid affinity encoding ${node.affinities}: ${node.id}`);
  assert(Array.isArray(node.branchCodes)&&node.branchCodes.length>0,`missing branchCodes: ${node.id}`);for(const code of node.branchCodes)assert(validBranchCodes.has(code),`invalid branchCode ${code}: ${node.id}`);
  assert.deepEqual([...node.connectionEdgeIndexes].sort((a,b)=>a-b),incident.get(node.id),`incident edge indexes drifted: ${node.id}`);
  assert(adjacency.get(node.id).size>0,`isolated node: ${node.id}`);
}

const roots=new Set(graph.graphRoots);assert.deepEqual([...roots].sort(),['hydrogen','methane','oxygen']);
for(const id of roots){const node=byId.get(id);assert(node,`missing ROOT ${id}`);assert(node.roleCodes.includes('R'),`ROOT role missing: ${id}`);assert.equal(node.depth,0,`ROOT depth must be zero: ${id}`);}
const distance=new Map([...roots].map(id=>[id,0])),queue=[...roots];
for(let cursor=0;cursor<queue.length;cursor++)for(const neighbor of adjacency.get(queue[cursor]))if(!distance.has(neighbor)){distance.set(neighbor,distance.get(queue[cursor])+1);queue.push(neighbor);}
assert.equal(distance.size,nodes.length,'all proposal nodes must be ROOT-reachable');
for(const node of nodes)assert.equal(node.depth,distance.get(node.id),`stored shortest-path depth drifted: ${node.id}`);

const degree6=nodes.filter(node=>adjacency.get(node.id).size===6).map(node=>node.id).sort();
assert.deepEqual(degree6,['acetic-acid','benzene','n-butane'],'degree-6 HUB set is design-locked');
assert(Math.max(...nodes.map(node=>adjacency.get(node.id).size))<=6,'radial phone layout guardrail: no node degree > 6');

let longestCorridor=0;const walked=new Set();
const edgeKey=(a,b)=>[a,b].sort().join('\u0000');
for(const start of nodes.filter(node=>adjacency.get(node.id).size!==2))for(const first of adjacency.get(start.id)){
  if(walked.has(edgeKey(start.id,first)))continue;
  let previous=start.id,current=first,interior=0;walked.add(edgeKey(previous,current));
  while(adjacency.get(current).size===2){interior++;const next=[...adjacency.get(current)].find(id=>id!==previous);previous=current;current=next;const key=edgeKey(previous,current);if(walked.has(key))break;walked.add(key);}
  longestCorridor=Math.max(longestCorridor,interior);
}
assert(longestCorridor<=5,`thin degree-2 corridor too long: ${longestCorridor}`);

const decodeAffinities=text=>Object.fromEntries(text.split(',').map(item=>[item[0],Number(item.slice(1))]));
const frontier=(discoveredIds,knownRecipeIds=[],region='C')=>{
  const discovered=new Set(discoveredIds),known=new Set(knownRecipeIds),representedBranches=new Set([...discovered].flatMap(id=>byId.get(id)?.branchCodes??[])),candidateMap=new Map();
  for(const id of discovered)for(const neighbor of adjacency.get(id)??[])if(!discovered.has(neighbor)&&!known.has(neighbor))candidateMap.set(neighbor,byId.get(neighbor));
  return [...candidateMap.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(node=>({id:node.id,depth:node.depth,tier:node.tier,unexplored:node.branchCodes.some(code=>!representedBranches.has(code)),regionWeight:decodeAffinities(node.affinities)[region]??0}));
};
const sampleA=frontier(graph.graphRoots,[],'C'),sampleB=frontier(graph.graphRoots,[],'C');assert.deepEqual(sampleA,sampleB,'frontier calculation must be deterministic');
assert.equal(new Set(sampleA.map(item=>item.id)).size,sampleA.length,'frontier candidates must dedupe by molecule id');assert(sampleA.every(item=>!roots.has(item.id)),'frontier excludes discovered nodes');
if(sampleA.length){const excluded=sampleA[0].id;assert(!frontier(graph.graphRoots,[excluded],'C').some(item=>item.id===excluded),'known recipe IDs must be excluded');}

const exporter=spawnSync(process.execPath,['scripts/export-molecule-graph-proposal.mjs','--check'],{cwd:new URL('.',root),encoding:'utf8'});assert.equal(exporter.status,0,exporter.stderr||exporter.stdout||'SVG freshness check failed');
console.log(`Molecule graph proposal passed: ${nodes.length} nodes, ${edges.length} undirected edges, max degree 6, longest degree-2 corridor ${longestCorridor}.`);
