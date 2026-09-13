import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMoleculeGraph,getFrontierCandidates,scoreFrontierCandidates} from '../src/molecule-graph.js';
import {expandGraph,expansionSummary,sampleIds} from './molecule-frontier-fixtures.mjs';

const raw=JSON.parse(await readFile(new URL('../data/molecule-graph.json',import.meta.url),'utf8')),graph=createMoleculeGraph(raw),seeds=[7,19,43,101,313],reports=[];
function dominantBranchShare(rows,count){const counts=new Map();for(const row of rows.slice(0,count))for(const branch of row.branchKeys)counts.set(branch,(counts.get(branch)??0)+1);return counts.size?Math.max(...counts.values())/count:0;}
const graphMaxDepth=Math.max(...graph.nodes.map(node=>node.depth));
for(const seed of seeds){
  const run=expandGraph(graph,{initial:graph.roots,seed}),at25=expansionSummary(run.selected,25),at50=expansionSummary(run.selected,50),at100=expansionSummary(run.selected,100),dominant25=dominantBranchShare(run.selected,25);
  assert.equal(run.discovered.size,graph.nodes.length,`seed ${seed}: all ROOT-reachable production nodes must complete`);
  assert.equal(run.selected.length,graph.nodes.length-graph.roots.length,`seed ${seed}: expansion must not stall or duplicate discoveries`);
  assert(at25.branchCount>=4,`seed ${seed}: early expansion collapsed below four branches`);
  assert(at25.familyCount>=4,`seed ${seed}: early expansion collapsed below four families`);
  assert(dominant25<.8,`seed ${seed}: one branch dominates more than 80% of first 25 selections`);
  assert(at25.meanDepth<3.5,`seed ${seed}: early expansion is too deep on average`);
  assert(at50.branchCount>=at25.branchCount&&at50.familyCount>=at25.familyCount,`seed ${seed}: diversity must not shrink at 50 discoveries`);
  assert(at100.maxDepth>=Math.min(4,graphMaxDepth),`seed ${seed}: deep nodes must remain reachable by 100 discoveries`);
  assert.equal(Math.max(...run.selected.map(row=>row.depth)),graphMaxDepth,`seed ${seed}: deepest production depth must be reachable`);
  reports.push({seed,at25,at50,at100,dominant25:Number(dominant25.toFixed(3))});
}

const affinity=(node,key)=>{const match=new RegExp(`(?:^|,)${key}(1|0?(?:\\.\\d+)?)(?:,|$)`).exec(node.affinities??'');return match?Number(match[1]):0;};
const carbonNode=graph.nodes.find(node=>affinity(node,'C')>=.8&&affinity(node,'O')===0&&graph.getNeighbors(node.id).length>1),oxygenNode=graph.nodes.find(node=>affinity(node,'O')>=.8&&affinity(node,'C')===0&&graph.getNeighbors(node.id).length>1);
assert(carbonNode&&oxygenNode,'production graph must expose distinct Carbon/Oxygen affinity probes');
const probeDiscovered=graph.nodes.map(node=>node.id).filter(id=>id!==carbonNode.id&&id!==oxygenNode.id),probe=getFrontierCandidates(graph,{discoveredIds:probeDiscovered});
assert(probe.some(row=>row.id===carbonNode.id)&&probe.some(row=>row.id===oxygenNode.id),'affinity probes must both be on the same production frontier');
const carbonScores=scoreFrontierCandidates(graph,probe,{discoveredIds:probeDiscovered,region:'carbon'}),oxygenScores=scoreFrontierCandidates(graph,probe,{discoveredIds:probeDiscovered,region:'oxygen'}),find=(rows,id)=>rows.find(row=>row.id===id);
assert(find(carbonScores,carbonNode.id).weight>find(oxygenScores,carbonNode.id).weight,'Carbon region must raise production carbon-affinity weight');
assert(find(oxygenScores,oxygenNode.id).weight>find(carbonScores,oxygenNode.id).weight,'Oxygen region must raise production oxygen-affinity weight');
const carbonPicks=sampleIds(carbonScores,{seed:20260913,count:4000}),oxygenPicks=sampleIds(oxygenScores,{seed:20260913,count:4000});
assert((carbonPicks.get(carbonNode.id)??0)>(oxygenPicks.get(carbonNode.id)??0),'Carbon region must increase deterministic carbon-affinity selection frequency');
assert((oxygenPicks.get(oxygenNode.id)??0)>(carbonPicks.get(oxygenNode.id)??0),'Oxygen region must increase deterministic oxygen-affinity selection frequency');

console.log(`Frontier simulation passed: ${graph.nodes.length} nodes, max depth ${graphMaxDepth}, seeds ${seeds.join(', ')}.`);
console.log(JSON.stringify(reports));
