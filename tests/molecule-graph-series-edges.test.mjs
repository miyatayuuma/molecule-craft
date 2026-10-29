import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMoleculeGraph,getFrontierCandidates} from '../src/molecule-graph.js';

const raw=JSON.parse(await readFile(new URL('../data/molecule-graph.json',import.meta.url),'utf8'));
const graph=createMoleculeGraph(raw);
const rowsToObjects=(columns,rows)=>rows.map(row=>Object.fromEntries(columns.map((key,index)=>[key,row[index]])));
const rawEdges=rowsToObjects(raw.edgeColumns,raw.edges);
const relationName=edge=>raw.relationCodes[String(edge.relationCode)];
const samePair=(edge,a,b)=>(edge.from===a&&edge.to===b)||(edge.from===b&&edge.to===a);

const expectedNeighbors=new Map([
  ['cyclopropane',['cyclobutane']],
  ['cyclobutane',['cyclopropane','cyclopentane']],
  ['cyclopentane',['cyclobutane','cyclohexane']],
  ['cyclohexane',['cyclopentane']],
  ['ethene',['propene']],
  ['propene',['ethene','1-butene']],
  ['1-butene',['propene']],
  ['formaldehyde',['acetaldehyde']],
  ['acetaldehyde',['formaldehyde']],
  ['formic-acid',['acetic-acid']],
  ['acetic-acid',['formic-acid']],
]);
for(const [id,expected] of expectedNeighbors){
  const neighbors=new Set(graph.getNeighbors(id));
  for(const neighbor of expected)assert(neighbors.has(neighbor),`${id} must include ${neighbor} as a graph neighbor`);
}

const expectedSeriesEdges=[
  ['cyclopropane','cyclobutane'],
  ['cyclobutane','cyclopentane'],
  ['cyclopentane','cyclohexane'],
  ['ethene','propene'],
  ['propene','1-butene'],
  ['formaldehyde','acetaldehyde'],
  ['formic-acid','acetic-acid'],
];
for(const [a,b] of expectedSeriesEdges){
  const edge=rawEdges.find(candidate=>samePair(candidate,a,b));
  assert(edge,`missing series edge: ${a} <-> ${b}`);
  assert.equal(relationName(edge),'chain-extension',`${a} <-> ${b} must use chain-extension`);
}

const frontierIds=discoveredIds=>new Set(getFrontierCandidates(graph,{discoveredIds}).map(candidate=>candidate.id));
assert.deepEqual(
  [...frontierIds(['methane','ethane'])].sort(),
  ['1-2-dichloroethane','chloromethane','ethanol','ethene','fluoromethane','methanol','nitromethane','propane'].sort(),
  'methane / ethane frontier may add only the explicit nitromethane substitution branch',
);
assert.deepEqual(
  [...frontierIds(['benzene'])].sort(),
  ['aniline','chlorobenzene','cyclohexene','nitrobenzene','phenol','pyridine','toluene'].sort(),
  'benzene frontier may add only the explicit nitrobenzene substitution branch',
);
const formaldehydeFrontier=frontierIds(['formaldehyde']);
assert(formaldehydeFrontier.has('acetaldehyde'),'formaldehyde must expose the immediate C2 aldehyde');
assert(!formaldehydeFrontier.has('propionaldehyde'),'formaldehyde must not skip directly to the C3 aldehyde');
const formicAcidFrontier=frontierIds(['formic-acid']);
assert(formicAcidFrontier.has('acetic-acid'),'formic acid must expose the immediate C2 carboxylic acid');
assert(!formicAcidFrontier.has('propionic-acid'),'formic acid must not skip directly to the C3 carboxylic acid');

console.log(`Molecule graph series-edge completion passed: ${expectedSeriesEdges.length} legacy chain-extension edges plus explicit nitro branches.`);
