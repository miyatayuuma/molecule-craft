import assert from 'node:assert/strict';
import {getFrontierCandidates,scoreFrontierCandidates,selectFrontierCandidate} from '../src/molecule-graph.js';
import {makeGraph} from './molecule-frontier-fixtures.mjs';

const ids=rows=>rows.map(row=>row.id);
const linear=makeGraph({nodes:[{id:'a',depth:0,branches:['main']},{id:'b',depth:1,branches:['main']},{id:'c',depth:2,branches:['main']}],edges:[['a','b'],['b','c']],roots:['a']});
let candidates=getFrontierCandidates(linear,{discoveredIds:['missing','a']});
assert.deepEqual(ids(candidates),['b'],'linear frontier must expose only the direct undiscovered neighbor');
assert.deepEqual(candidates[0].directDiscoveredNeighbors,['a']);
assert.deepEqual(candidates[0].directUndiscoveredNeighbors,['c']);
assert.equal(candidates[0].family,'test');
assert.deepEqual(candidates[0].branchKeys,['main']);
assert.deepEqual(getFrontierCandidates(linear,{discoveredIds:['a'],knownRecipeIds:['b']}),[],'known recipe must not reappear');
assert.deepEqual(getFrontierCandidates(linear,{discoveredIds:['a','b','c']}),[],'fully discovered graph must have no frontier');

const hub=makeGraph({nodes:[{id:'hub',depth:0,branches:['base']},{id:'left',branches:['left']},{id:'middle',branches:['middle']},{id:'right',branches:['right']}],edges:[['hub','right'],['hub','left'],['hub','middle']]});
assert.deepEqual(ids(getFrontierCandidates(hub,{discoveredIds:['hub']})),['left','middle','right'],'candidate ordering must not depend on edge order');

const multi=makeGraph({nodes:[{id:'a',branches:['x']},{id:'b',branches:['y']},{id:'c',branches:['x','y']}],edges:[['a','c'],['b','c']]});
candidates=getFrontierCandidates(multi,{discoveredIds:['b','a']});
assert.deepEqual(ids(candidates),['c'],'multi-parent node must be returned once');
assert.deepEqual(candidates[0].directDiscoveredNeighbors,['a','b']);
assert.deepEqual(getFrontierCandidates(multi,{discoveredIds:['a','b']}),getFrontierCandidates(multi,{discoveredIds:['b','a']}),'discovered input order must not affect candidate metadata');

const diamond=makeGraph({nodes:[{id:'a',branches:['x']},{id:'b',branches:['x']},{id:'c',branches:['x']},{id:'d',branches:['x']}],edges:[['a','b'],['a','c'],['b','d'],['c','d']]});
assert.deepEqual(ids(getFrontierCandidates(diamond,{discoveredIds:['a','b','c']})),['d'],'duplicate paths must deduplicate the same candidate');

const malformed=makeGraph({nodes:[{id:'root',depth:0},{id:'blank',depth:-2,affinities:null}],edges:[['root','blank']]});
candidates=getFrontierCandidates(malformed,{discoveredIds:['root']});
assert.equal(candidates[0].depth,0);assert.deepEqual(candidates[0].branchKeys,[]);assert.deepEqual(candidates[0].regionAffinities,{});
const scored=scoreFrontierCandidates(malformed,candidates,{discoveredIds:['root'],region:'unknown'});
assert(scored[0].weight>0&&Number.isFinite(scored[0].weight),'missing metadata must retain a finite positive weight');
assert.equal(selectFrontierCandidate(scored)?.id,'blank','single candidate must be selectable without RNG');
assert.deepEqual(getFrontierCandidates(null,{discoveredIds:['root']}),[]);assert.deepEqual(scoreFrontierCandidates(null,[]),[]);assert.equal(selectFrontierCandidate([]),null);
