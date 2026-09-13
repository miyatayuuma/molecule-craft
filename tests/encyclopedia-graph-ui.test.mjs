import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMoleculeGraph} from '../src/molecule-graph.js';
import {
  GRAPH_NODE_STATE,
  buildVisibleGraphProjection,
  canonicalGraphPositions,
  graphNodePresentation,
  graphNodeState,
  layoutFocusNeighborhood,
  localBoundsOverlap,
  searchKnownGraphNodes,
  selectInitialGraphFocus,
  transitionGraphFocus,
} from '../src/encyclopedia-graph.js';

const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const [productionRaw,records]=await Promise.all([json('../data/molecule-graph.json'),json('../data/molecules.json')]);
const production=createMoleculeGraph(productionRaw),recordById=new Map(records.map(record=>[record.id,record]));

const fixture=createMoleculeGraph({
  schemaVersion:1,
  graphRoots:['a'],
  familyCodes:{0:'fundamentals',1:'carbon'},
  roleCodes:{R:'ROOT',H:'HUB',B:'BRANCH',L:'LEAF'},
  sectorCodes:{0:'CENTER',1:'N',2:'NE',3:'E',4:'SE',5:'S',6:'SW',7:'W',8:'NW'},
  branchCodes:{0:'fundamentals',1:'carbon-chain'},
  relationCodes:{0:'bridge'},
  nodeColumns:['id','familyCode','roleCodes','depth','tier','sectorCode','affinities','branchCodes','connectionEdgeIndexes'],
  nodes:[
    ['a',0,'RH',0,0,0,'H1',[0],[0,1]],
    ['b',1,'H',1,1,1,'C1',[1],[0,2,3,4]],
    ['c',1,'B',1,1,3,'C1',[1],[1,2,5]],
    ['d',1,'B',2,2,2,'C1',[1],[3]],
    ['e',1,'L',2,2,4,'C1',[1],[4]],
    ['f',1,'L',2,2,5,'C1',[1],[5]],
  ],
  edgeColumns:['from','to','relationCode'],
  edges:[[0,1,0],[0,2,0],[1,2,0],[1,3,0],[1,4,0],[2,5,0]],
});
const fixtureRecords=[
  {id:'a',nameJa:'A',nameEn:'A',formula:'A1',aliases:[]},
  {id:'b',nameJa:'B',nameEn:'B',formula:'B1',aliases:[]},
  {id:'c',nameJa:'C',nameEn:'C',formula:'C1',aliases:[]},
  {id:'d',nameJa:'D',nameEn:'D',formula:'D1',aliases:[]},
  {id:'e',nameJa:'E',nameEn:'E',formula:'E1',aliases:[]},
  {id:'f',nameJa:'F',nameEn:'F',formula:'F1',aliases:[]},
];

const state={registeredIds:new Set(['a']),recipes:new Set(['b']),hints:new Set()};
assert.equal(graphNodeState('d',state),GRAPH_NODE_STATE.UNKNOWN);
assert.equal(graphNodeState('b',state),GRAPH_NODE_STATE.KNOWN);
assert.equal(graphNodeState('a',state),GRAPH_NODE_STATE.REGISTERED);

const unknownPresentation=graphNodePresentation(fixtureRecords[3],GRAPH_NODE_STATE.UNKNOWN);
assert.equal(unknownPresentation.name,'');
assert.equal(unknownPresentation.formula,'');
assert.equal(unknownPresentation.canOpenDetail,false);
assert.equal(unknownPresentation.canCraft,false);
assert.equal(unknownPresentation.showThumbnail,false,'Unknown focus must never reveal a molecule thumbnail');
assert.match(unknownPresentation.ariaLabel,/未知の分子/);
assert.doesNotMatch(unknownPresentation.ariaLabel,/D|D1/);
assert.deepEqual(searchKnownGraphNodes(fixtureRecords,state,'D'),[],'Unknown nodes must not leak through search');
const knownPresentation=graphNodePresentation(fixtureRecords[1],GRAPH_NODE_STATE.KNOWN,{selected:true});
assert.equal(knownPresentation.canOpenDetail,false);assert.equal(knownPresentation.canCraft,true);assert.equal(knownPresentation.showThumbnail,true,'Focused known recipe should show its molecule thumbnail');
const registeredPresentation=graphNodePresentation(fixtureRecords[0],GRAPH_NODE_STATE.REGISTERED,{selected:true});
assert.equal(registeredPresentation.canOpenDetail,true);assert.equal(registeredPresentation.canCraft,false);assert.equal(registeredPresentation.showThumbnail,true,'Focused registered molecule should show its molecule thumbnail');

const local=buildVisibleGraphProjection(fixture,{focusId:'a',...state});
assert.deepEqual(new Set(local.oneHop),new Set(['b','c']));
assert.equal(new Set(local.oneHop).size,local.oneHop.length,'One-hop neighbors must be unique');
assert(local.visibleEdges.some(edge=>new Set([edge.from,edge.to]).has('b')&&new Set([edge.from,edge.to]).has('c')),'Cross-link must be preserved');
assert(local.twoHop.includes('d')&&local.twoHop.includes('e')&&local.twoHop.includes('f'),'Two-hop continuations must be retained as teasers');
assert(!local.visibleIds.includes('d')&&!local.visibleIds.includes('e')&&!local.visibleIds.includes('f'),'Two-hop teaser nodes must not become fully revealed nodes');

const beforeRegistration=buildVisibleGraphProjection(fixture,{focusId:'b',...state});
assert(!beforeRegistration.visibleIds.includes('d'),'Known recipe alone must not reveal downstream unknown branches');
const afterRegistration=buildVisibleGraphProjection(fixture,{focusId:'b',registeredIds:new Set(['a','b']),recipes:new Set(['b']),hints:new Set()});
assert(afterRegistration.visibleIds.includes('d')&&afterRegistration.visibleIds.includes('e'),'Registration must reveal downstream anonymous frontier branches');

assert.deepEqual(transitionGraphFocus(fixture,'a','d',state),{focusId:'a',highlightId:'d',changed:false},'Unknown tap must not disclose or center identity');
assert.deepEqual(transitionGraphFocus(fixture,'a','b',state),{focusId:'b',highlightId:null,changed:true},'Known node selection must move focus');

const canonicalA=canonicalGraphPositions(fixture),canonicalB=canonicalGraphPositions(fixture);
assert.deepEqual([...canonicalA],[...canonicalB],'Canonical layout must be deterministic');
const layoutA=layoutFocusNeighborhood(fixture,'a',{width:360,height:480}),layoutB=layoutFocusNeighborhood(fixture,'a',{width:360,height:480});
assert.deepEqual([...layoutA.positions],[...layoutB.positions],'Local layout must be deterministic');
assert.equal(layoutA.positions.get('b').y<layoutA.center.y,true,'N-sector neighbor should remain north-biased');
assert.equal(layoutA.positions.get('c').x>layoutA.center.x,true,'E-sector neighbor should remain east-biased');

const maxDegreeNode=production.nodes.map(node=>({id:node.id,degree:production.getNeighbors(node.id).length})).sort((a,b)=>b.degree-a.degree||a.id.localeCompare(b.id))[0];
assert.equal(maxDegreeNode.degree,6,'Production max-degree regression fixture should exercise six neighbors');
const mobileLayout=layoutFocusNeighborhood(production,maxDegreeNode.id,{width:320,height:430,nodeDiameter:62,focusDiameter:116});
assert.equal(mobileLayout.neighbors.length,6);
assert.equal(mobileLayout.positions.size,7);
assert.equal(localBoundsOverlap(mobileLayout,{diameter:62,focusDiameter:116}),false,'Enlarged focus thumbnail node and six neighbors must not overlap in representative portrait geometry');
for(const point of mobileLayout.positions.values()){
  assert(point.x>=31&&point.x<=289,`mobile x tap bound: ${point.x}`);
  assert(point.y>=31&&point.y<=399,`mobile y tap bound: ${point.y}`);
}

const entries=new Map([['c',{order:2}],['a',{order:1}]]);
assert.equal(selectInitialGraphFocus(fixture,{registeredIds:new Set(['a','c']),recipes:new Set(),hints:new Set(),entriesById:entries}),'c','Most recently registered molecule must win when no previous focus exists');
assert.equal(selectInitialGraphFocus(fixture,{registeredIds:new Set(['a','c']),recipes:new Set(),hints:new Set(),previousId:'a',entriesById:entries}),'a','Previous visible identity must be deterministic priority');
assert.equal(selectInitialGraphFocus(fixture,{registeredIds:new Set(),recipes:new Set(),hints:new Set()}),'a','Empty collection must fall back to graph root without auto-registering it');

const productionEmpty=buildVisibleGraphProjection(production,{focusId:'hydrogen',registeredIds:new Set(),recipes:new Set(),hints:new Set()});
for(const id of productionEmpty.visibleIds){
  assert.equal(graphNodeState(id,{registeredIds:new Set(),recipes:new Set(),hints:new Set()}),GRAPH_NODE_STATE.UNKNOWN);
  const presentation=graphNodePresentation(recordById.get(id),GRAPH_NODE_STATE.UNKNOWN,{selected:id==='hydrogen'});
  assert.equal(presentation.name,'');assert.equal(presentation.formula,'');
  assert.match(presentation.ariaLabel,/未知の分子/);
  const formula=recordById.get(id)?.formula;if(formula)assert.equal(presentation.ariaLabel.includes(formula),false,`${id}: unknown ARIA must not leak formula`);
}

console.log(`Encyclopedia graph UI passed: state/privacy, cross-links, teaser expansion, deterministic sector layout, degree-${maxDegreeNode.degree} mobile geometry.`);
