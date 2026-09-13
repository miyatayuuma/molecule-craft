import assert from 'node:assert/strict';
import {getFrontierCandidates,scoreFrontierCandidates,selectFrontierCandidate,createSeededFrontierRng} from '../src/molecule-graph.js';
import {makeGraph,sampleIds} from './molecule-frontier-fixtures.mjs';

const shallowGraph=makeGraph({nodes:[{id:'root',depth:0,branches:['same']},{id:'shallow',depth:1,branches:['same']},{id:'deep',depth:4,branches:['same']}],edges:[['root','deep'],['root','shallow']]});
let candidates=getFrontierCandidates(shallowGraph,{discoveredIds:['root']}),scored=scoreFrontierCandidates(shallowGraph,candidates,{discoveredIds:['root']});
const shallow=scored.find(row=>row.id==='shallow'),deep=scored.find(row=>row.id==='deep');
assert(shallow.weight>deep.weight,'shallow frontier must receive a mild bonus');assert(deep.weight>0,'deep frontier must remain selectable');
assert(shallow.weighting.shallow.factor>deep.weighting.shallow.factor);

const branchGraph=makeGraph({nodes:[{id:'hub',depth:0,branches:['base']},{id:'a1',depth:1,branches:['worked']},{id:'a2',depth:2,branches:['worked']},{id:'a3',depth:2,branches:['worked']},{id:'b1',depth:2,branches:['fresh']}],edges:[['hub','a1'],['a1','a2'],['a2','a3'],['hub','b1']]});
const branchDiscovered=['hub','a1','a2'];candidates=getFrontierCandidates(branchGraph,{discoveredIds:branchDiscovered});scored=scoreFrontierCandidates(branchGraph,candidates,{discoveredIds:branchDiscovered});
const worked=scored.find(row=>row.id==='a3'),fresh=scored.find(row=>row.id==='b1');
assert(fresh.weighting.unexploredBranch.factor>worked.weighting.unexploredBranch.factor,'less advanced visible branch must be preferred');assert(fresh.weight>worked.weight);
assert.equal(fresh.weighting.unexploredBranch.branches[0].discoveredCount,0);assert.equal(worked.weighting.unexploredBranch.branches[0].discoveredCount,2);

const regionGraph=makeGraph({nodes:[{id:'hub',depth:0,branches:['same']},{id:'carbon',depth:2,branches:['same'],affinities:'C1'},{id:'oxygen',depth:2,branches:['same'],affinities:'O1'}],edges:[['hub','carbon'],['hub','oxygen']]});
candidates=getFrontierCandidates(regionGraph,{discoveredIds:['hub']});
const carbonScores=scoreFrontierCandidates(regionGraph,candidates,{discoveredIds:['hub'],region:'carbon'}),oxygenScores=scoreFrontierCandidates(regionGraph,candidates,{discoveredIds:['hub'],region:'oxygen'}),veilScores=scoreFrontierCandidates(regionGraph,candidates,{discoveredIds:['hub'],region:'veil'});
const byId=(rows,id)=>rows.find(row=>row.id===id);
assert(byId(carbonScores,'carbon').weight>byId(carbonScores,'oxygen').weight,'Carbon region must softly favor carbon affinity');
assert(byId(oxygenScores,'oxygen').weight>byId(oxygenScores,'carbon').weight,'Oxygen region must softly favor oxygen affinity');
assert(byId(veilScores,'carbon').weight>0&&byId(veilScores,'oxygen').weight>0,'region mismatch must never hard-gate a candidate');
assert.equal(byId(carbonScores,'carbon').weighting.regionAffinity.region,'Carbon');assert.equal(byId(carbonScores,'carbon').weighting.regionAffinity.affinity,1);

const carbonCounts=sampleIds(carbonScores,{seed:904,count:4000}),oxygenCounts=sampleIds(oxygenScores,{seed:904,count:4000});
assert((carbonCounts.get('carbon')??0)>(oxygenCounts.get('carbon')??0),'same deterministic draws must select carbon candidate more often in Carbon region');
assert((oxygenCounts.get('oxygen')??0)>(carbonCounts.get('oxygen')??0),'same deterministic draws must select oxygen candidate more often in Oxygen region');

assert.deepEqual(scoreFrontierCandidates(regionGraph,[...candidates].reverse(),{discoveredIds:['hub'],region:'carbon'}),carbonScores,'score ordering must be stable');
const sequence=seed=>{const rng=createSeededFrontierRng(seed);return Array.from({length:30},()=>selectFrontierCandidate(carbonScores,{rng})?.id);};
assert.deepEqual(sequence(123456),sequence(123456),'injected seeded RNG must reproduce selection exactly');
for(const row of carbonScores)assert(row.weight>0&&Number.isFinite(row.weight),'every eligible weight must be finite and positive');
