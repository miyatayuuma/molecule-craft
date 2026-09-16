import assert from 'node:assert/strict';
import './molecule-graph-series-edges.test.mjs';
import {access,readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createMoleculeGraph} from '../src/molecule-graph.js';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [graph,molecules,encyclopedia]=await Promise.all([
  read('data/molecule-graph.json').then(JSON.parse),
  read('data/molecules.json').then(JSON.parse),
  read('data/encyclopedia.json').then(JSON.parse),
]);
const deletedIds=['sulfur-hexafluoride','isopentane','neopentane','1-pentene','2-pentene','o-xylene','m-xylene','chloroethane','1-propanol','isobutanol','propylene-glycol','1-4-dioxane','ethanethiol','butyraldehyde','isobutyraldehyde','2-pentanone','3-pentanone','isobutyric-acid','valeric-acid','methyl-formate','ethyl-formate','methyl-acetate','methyl-propionate','ethyl-propionate','ethylamine','formamide','propionamide','resorcinol','acetanilide','o-cresol','m-cresol','p-cresol','methyl-benzoate','ethyl-benzoate','n-butyl-acetate','isopropyl-acetate','cumene'];
const addedFormulas=new Map([
  ['cyclohexene','C6H10'],['pyruvic-acid','C3H4O3'],['furan','C4H4O'],['dimethyl-sulfoxide','C2H6OS'],
  ['ozone','O3'],['nitromethane','CH3NO2'],['nitrobenzene','C6H5NO2'],['2-nitrotoluene','C7H7NO2'],['2-4-dinitrotoluene','C7H6N2O4'],['2-4-6-trinitrotoluene','C7H5N3O6'],
]);
assert.equal(molecules.length,135,'production molecule DB must contain 135 molecules');
const moleculeIds=molecules.map(item=>item.id),moleculeSet=new Set(moleculeIds);
assert.equal(moleculeSet.size,135,'production molecule IDs must be unique');
for(const id of deletedIds)assert(!moleculeSet.has(id),`deleted molecule remains in production DB: ${id}`);
for(const [id,formula] of addedFormulas){const molecule=molecules.find(item=>item.id===id);assert(molecule,`missing ADD molecule: ${id}`);assert.equal(molecule.formula,formula,`formula drift: ${id}`);assert(molecule.atoms.length>0&&molecule.bonds.length>0,`missing structural definition: ${id}`);assert.equal(typeof molecule.category,'string',`missing category: ${id}`);}

assert.equal(graph.schemaVersion,1);
assert.equal(graph.nodes.length,135,'production graph must contain 135 nodes');
assert.equal(graph.edges.length,157,'production graph must contain 157 edges');
assert(!Object.hasOwn(graph,'status')&&!Object.hasOwn(graph,'basedOnMain')&&!Object.hasOwn(graph,'additions')&&!Object.hasOwn(graph,'existingInventory'),'proposal/audit metadata must not remain in production graph');
const rowsToObjects=(columns,rows)=>rows.map(row=>Object.fromEntries(columns.map((key,index)=>[key,row[index]])));
const nodes=rowsToObjects(graph.nodeColumns,graph.nodes),byId=new Map(nodes.map(node=>[node.id,node]));
assert.equal(byId.size,135,'graph node IDs must be unique');
assert.deepEqual([...byId.keys()].sort(),[...moleculeSet].sort(),'production molecule DB and graph IDs must match 1:1');
const endpointId=value=>Number.isInteger(value)?nodes[value]?.id:value;
const rawEdges=rowsToObjects(graph.edgeColumns,graph.edges),edges=rawEdges.map(edge=>({...edge,from:endpointId(edge.from),to:endpointId(edge.to)}));
const validFamilyCodes=new Set(Object.keys(graph.familyCodes).map(Number)),validRoleCodes=new Set(Object.keys(graph.roleCodes)),validSectorCodes=new Set(Object.keys(graph.sectorCodes).map(Number)),validBranchCodes=new Set(Object.keys(graph.branchCodes).map(Number)),validRelationCodes=new Set(Object.keys(graph.relationCodes).map(Number));
const adjacency=new Map(nodes.map(node=>[node.id,new Set()])),incident=new Map(nodes.map(node=>[node.id,[]])),pairs=new Set();
rawEdges.forEach((edge,index)=>{if(Number.isInteger(edge.from))assert(edge.from>=0&&edge.from<nodes.length,`edge.from out of range: ${index}`);if(Number.isInteger(edge.to))assert(edge.to>=0&&edge.to<nodes.length,`edge.to out of range: ${index}`);});
edges.forEach((edge,index)=>{assert(byId.has(edge.from)&&byId.has(edge.to),`missing edge endpoint: ${index}`);assert.notEqual(edge.from,edge.to,`self edge: ${edge.from}`);assert(validRelationCodes.has(edge.relationCode),`invalid relation: ${index}`);const key=[edge.from,edge.to].sort().join('\0');assert(!pairs.has(key),`duplicate edge: ${edge.from}/${edge.to}`);pairs.add(key);adjacency.get(edge.from).add(edge.to);adjacency.get(edge.to).add(edge.from);incident.get(edge.from).push(index);incident.get(edge.to).push(index);});
const affinityPattern=/^(?:[HCODF](?:1|0?(?:\.\d+)?))(?:,(?:[HCODF](?:1|0?(?:\.\d+)?)))*$/;
for(const node of nodes){assert(validFamilyCodes.has(node.familyCode),`missing/invalid family: ${node.id}`);assert.equal(typeof node.roleCodes,'string');assert(node.roleCodes.length>0,`missing roles: ${node.id}`);for(const role of node.roleCodes)assert(validRoleCodes.has(role),`invalid role ${role}: ${node.id}`);assert(Number.isInteger(node.depth)&&node.depth>=0,`invalid depth: ${node.id}`);assert(Number.isInteger(node.tier)&&node.tier>=0,`invalid tier: ${node.id}`);assert(validSectorCodes.has(node.sectorCode),`invalid sector: ${node.id}`);assert.equal(typeof node.affinities,'string');assert(affinityPattern.test(node.affinities),`invalid region affinity: ${node.id}`);assert(Array.isArray(node.branchCodes)&&node.branchCodes.length>0,`missing branch keys: ${node.id}`);for(const code of node.branchCodes)assert(validBranchCodes.has(code),`invalid branch key ${code}: ${node.id}`);assert.deepEqual([...node.connectionEdgeIndexes].sort((a,b)=>a-b),incident.get(node.id),`incident edge indexes drifted: ${node.id}`);assert(adjacency.get(node.id).size>0,`isolated node: ${node.id}`);}

const roots=new Set(graph.graphRoots);assert.deepEqual([...roots].sort(),['hydrogen','methane','oxygen']);
for(const id of roots){const node=byId.get(id);assert(node?.roleCodes.includes('R'),`ROOT role missing: ${id}`);assert.equal(node.depth,0,`ROOT depth must be zero: ${id}`);}
const distance=new Map([...roots].map(id=>[id,0])),queue=[...roots];for(let cursor=0;cursor<queue.length;cursor++)for(const neighbor of adjacency.get(queue[cursor]))if(!distance.has(neighbor)){distance.set(neighbor,distance.get(queue[cursor])+1);queue.push(neighbor);}
assert.equal(distance.size,nodes.length,'all production nodes must be ROOT-reachable');for(const node of nodes)assert.equal(node.depth,distance.get(node.id),`stored shortest-path depth drifted: ${node.id}`);
for(const node of nodes){const degree=adjacency.get(node.id).size,limit=['acetic-acid','benzene'].includes(node.id)?7:6;assert(degree<=limit,`production graph degree guardrail exceeded: ${node.id} (${degree} > ${limit})`);}assert.equal(adjacency.get('acetic-acid').size,7,'acetic-acid degree 7 must be explained only by the C1→C2 series completion');assert.equal(adjacency.get('benzene').size,7,'benzene degree 7 must be explained only by the nitrobenzene substitution branch');
let longestCorridor=0;const walked=new Set(),edgeKey=(a,b)=>[a,b].sort().join('\0');for(const start of nodes.filter(node=>adjacency.get(node.id).size!==2))for(const first of adjacency.get(start.id)){if(walked.has(edgeKey(start.id,first)))continue;let previous=start.id,current=first,interior=0;walked.add(edgeKey(previous,current));while(adjacency.get(current).size===2){interior++;const next=[...adjacency.get(current)].find(id=>id!==previous);previous=current;current=next;const key=edgeKey(previous,current);if(walked.has(key))break;walked.add(key);}longestCorridor=Math.max(longestCorridor,interior);}assert(longestCorridor<=5,`degree-2 corridor guardrail exceeded: ${longestCorridor}`);

const encyclopediaIds=Object.keys(encyclopedia.molecules??{});assert.deepEqual(encyclopediaIds.sort(),[...moleculeSet].sort(),'encyclopedia entries must match production DB 1:1');for(const id of addedFormulas.keys())assert((encyclopedia.molecules[id]?.description??'').length>=30,`ADD encyclopedia description missing: ${id}`);
const runtimeGraph=createMoleculeGraph(graph);for(const node of nodes)assert.deepEqual(new Set(runtimeGraph.getNeighbors(node.id)),adjacency.get(node.id),`runtime adjacency drift: ${node.id}`);

async function collectFiles(relative){const base=new URL(relative,root),entries=await readdir(base,{withFileTypes:true}),out=[];for(const entry of entries){const child=`${relative.replace(/\/$/,'')}/${entry.name}`;if(entry.isDirectory())out.push(...await collectFiles(`${child}/`));else out.push(child);}return out;}
for(const file of [...await collectFiles('src/'),...await collectFiles('data/')]){const text=await read(file);for(const id of deletedIds)assert(!text.includes(`'${id}'`)&&!text.includes(`\"${id}\"`),`deleted molecule production reference remains: ${file} -> ${id}`);}
const modelFiles=new Set(await readdir(new URL('assets/models/',root)));for(const id of moleculeSet)assert(modelFiles.has(`molecule-${id}.svg`),`missing generated molecule preview: ${id}`);for(const id of deletedIds)assert(!modelFiles.has(`molecule-${id}.svg`),`stale deleted molecule preview: ${id}`);
const precache=await read('precache-manifest.js');for(const id of deletedIds)assert(!precache.includes(`molecule-${id}.svg`),`deleted preview remains precached: ${id}`);
for(const path of ['data/molecule-graph.proposed.json','docs/maps/molecule-graph-proposed.svg','scripts/export-molecule-graph-proposal.mjs','tests/molecule-graph-proposal.test.mjs'])await assert.rejects(access(new URL(path,root)),undefined,`proposal artifact must not remain: ${path}`);
const exporter=spawnSync(process.execPath,['scripts/export-molecule-graph.mjs','--check'],{cwd:new URL('.',root),encoding:'utf8'});assert.equal(exporter.status,0,exporter.stderr||exporter.stdout||'production graph SVG freshness check failed');
console.log(`Production molecule graph passed: ${nodes.length} nodes, ${edges.length} edges, max degree ${Math.max(...nodes.map(node=>adjacency.get(node.id).size))}, longest degree-2 corridor ${longestCorridor}.`);
