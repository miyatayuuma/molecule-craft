import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMoleculeGraph} from '../src/molecule-graph.js';
import {
  GRAPH_NODE_STATE,
  buildVisibleGraphProjection,
  canonicalGraphPositions,
  graphNodePresentation,
  graphSectorAnchors,
  adjacentGraphSectorAnchor,
  graphNodeState,
  layoutFocusNeighborhood,
  localBoundsOverlap,
  searchKnownGraphNodes,
  selectInitialGraphFocus,
  transitionGraphFocus,
} from '../src/encyclopedia-graph.js';
import {ENCYCLOPEDIA_MOTION,graphEdgeChevronGeometry,graphEdgeMotionStart,graphEdgeVisualState,graphNodeMotionStart,graphVisibleEdgeInterval} from '../src/encyclopedia-graph-view.js';

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

const sectorState={registeredIds:new Set(['a','b','c','d']),recipes:new Set(),hints:new Set()};
const sectorAnchors=graphSectorAnchors(fixture,sectorState);
assert.deepEqual(sectorAnchors.map(row=>row.sectorCode),[0,1,2,3],'Sector navigation exposes only sectors with known identity');
assert.equal(sectorAnchors.find(row=>row.sectorCode===1)?.id,'b','Sector anchor prefers the shallowest structural entry');
assert.equal(adjacentGraphSectorAnchor(fixture,'a',sectorState,1)?.id,'b');
assert.equal(adjacentGraphSectorAnchor(fixture,'a',sectorState,-1)?.id,'c','Reverse navigation wraps to the previous known sector without exposing unknown nodes');
assert.equal(graphSectorAnchors(fixture,{registeredIds:new Set(['a']),recipes:new Set(),hints:new Set()}).length,1,'Unknown-only sectors must not become swipe destinations');
assert.equal(adjacentGraphSectorAnchor(fixture,'a',{registeredIds:new Set(['a']),recipes:new Set(),hints:new Set()},1),null,'Single known sector has no synthetic destination');

const canonicalA=canonicalGraphPositions(fixture),canonicalB=canonicalGraphPositions(fixture);
assert.deepEqual([...canonicalA],[...canonicalB],'Canonical layout must be deterministic');
const layoutA=layoutFocusNeighborhood(fixture,'a',{width:360,height:480}),layoutB=layoutFocusNeighborhood(fixture,'a',{width:360,height:480});
assert.deepEqual([...layoutA.positions],[...layoutB.positions],'Local layout must be deterministic');
assert.equal(layoutA.positions.get('b').y<layoutA.center.y,true,'N-sector neighbor should remain north-biased');
assert.equal(layoutA.positions.get('c').x>layoutA.center.x,true,'E-sector neighbor should remain east-biased');

assert.equal(ENCYCLOPEDIA_MOTION.graphNavigationDuration,560,'Branch traversal must be slow enough to preserve spatial orientation');
assert.equal(ENCYCLOPEDIA_MOTION.graphEdgeDelay,48,'Edges may trail node motion only by a short readable stagger');
assert.ok(ENCYCLOPEDIA_MOTION.graphEdgeDelay<ENCYCLOPEDIA_MOTION.graphNavigationDuration*.12,'Edge stagger must remain a small fraction of reroot motion');
assert.equal(ENCYCLOPEDIA_MOTION.detailZoomDuration,760,'Graph/Detail shared-element zoom should read as a distinct, longer scale transition');
assert.equal(ENCYCLOPEDIA_MOTION.easing,'cubic-bezier(.4,0,.2,1)');
const layoutToB=layoutFocusNeighborhood(fixture,'b',{width:360,height:480});
const incomingB=graphNodeMotionStart(layoutA.positions.get('b'),layoutToB.positions.get('b'),{nodeDiameter:66,focusDiameter:124});
const outgoingA=graphNodeMotionStart(layoutA.positions.get('a'),layoutToB.positions.get('a'),{nodeDiameter:66,focusDiameter:124});
assert(incomingB&&incomingB.scale<1,'Selected neighbor must grow continuously from neighbor scale while moving into the center');
assert(outgoingA&&outgoingA.scale>1,'Previous focus must shrink continuously from focus scale while retreating into its neighbor position');
assert(Math.hypot(incomingB.dx,incomingB.dy)>40,'Incoming focus must preserve a readable directional travel vector');
assert(Math.hypot(outgoingA.dx,outgoingA.dy)>40,'Outgoing focus must preserve the inverse directional travel vector');

const maxDegreeNode=production.nodes.map(node=>({id:node.id,degree:production.getNeighbors(node.id).length})).sort((a,b)=>b.degree-a.degree||a.id.localeCompare(b.id))[0];
assert.equal(maxDegreeNode.id,'acetic-acid','C1→C2 acid series completion should make acetic-acid the sole seven-neighbor production hub');
assert.equal(maxDegreeNode.degree,7,'Production max-degree regression fixture should exercise seven neighbors');
const mobileLayout=layoutFocusNeighborhood(production,maxDegreeNode.id,{width:320,height:430,nodeDiameter:62,focusDiameter:116});
assert.equal(mobileLayout.neighbors.length,7);
assert.equal(mobileLayout.positions.size,8);
assert.equal(localBoundsOverlap(mobileLayout,{diameter:62,focusDiameter:116}),false,'Enlarged focus thumbnail node and seven neighbors must not overlap in representative portrait geometry');
for(const point of mobileLayout.positions.values()){
  assert(point.x>=31&&point.x<=289,`mobile x tap bound: ${point.x}`);
  assert(point.y>=31&&point.y<=399,`mobile y tap bound: ${point.y}`);
}

const productionEdge=(from,to)=>production.edges.find(edge=>edge.from===from&&edge.to===to);
const chainIntoButane=productionEdge('propane','n-butane'),chainOutOfButane=productionEdge('n-butane','n-pentane'),aromatizationEdge=productionEdge('cyclohexene','benzene'),isomerEdge=productionEdge('n-butane','isobutane'),bridgeEdge=productionEdge('oxygen','water');
for(const edge of [chainIntoButane,chainOutOfButane,aromatizationEdge,isomerEdge,bridgeEdge])assert.ok(edge,'focus-edge regression fixture must exist in production graph');
assert.deepEqual(graphEdgeVisualState(production,chainIntoButane,{direct:true}),{relation:'chain-extension',relationClass:'relation-chain-extension',directional:true,from:'propane',to:'n-butane'});
assert.deepEqual(graphEdgeVisualState(production,chainOutOfButane,{direct:true}),{relation:'chain-extension',relationClass:'relation-chain-extension',directional:true,from:'n-butane',to:'n-pentane'});
assert.deepEqual(graphEdgeVisualState(production,aromatizationEdge,{direct:true}),{relation:'aromatization',relationClass:'relation-aromatization',directional:true,from:'cyclohexene',to:'benzene'});
assert.equal(graphEdgeVisualState(production,isomerEdge,{direct:true}).directional,false,'isomer relation must remain non-directional');
assert.equal(graphEdgeVisualState(production,bridgeEdge,{direct:true}).directional,false,'bridge relation must remain non-directional');
assert.equal(graphEdgeVisualState(production,chainIntoButane,{direct:false}).relationClass,'','background edges must not receive relation styling');
assert.equal(graphEdgeVisualState(production,chainIntoButane,{direct:false}).directional,false,'background edges must not create directional motion state');
const butaneMobile=layoutFocusNeighborhood(production,'n-butane',{width:320,height:430,nodeDiameter:62,focusDiameter:116});
for(const edge of [chainIntoButane,chainOutOfButane]){
  const geometry=graphEdgeChevronGeometry(edge,butaneMobile.positions,{focusId:'n-butane',nodeDiameter:62,focusDiameter:116});assert.ok(geometry,`${edge.from} → ${edge.to}: mobile visible-gap chevron geometry`);
  const from=butaneMobile.positions.get(edge.from),to=butaneMobile.positions.get(edge.to),direction={x:to.x-from.x,y:to.y-from.y},movement={x:geometry.end.x-geometry.start.x,y:geometry.end.y-geometry.start.y},edgeLength=Math.hypot(direction.x,direction.y),visibleGap=geometry.visibleGap;
  assert(movement.x*direction.x+movement.y*direction.y>0,`${edge.from} → ${edge.to}: Chevron must move along semantic from→to direction even when focus is in the middle`);
  assert(Math.abs(Math.hypot(movement.x,movement.y)-visibleGap)<.02,`${edge.from} → ${edge.to}: Chevron interval must equal the safe visible edge gap`);
  assert(Math.hypot(geometry.end.x-from.x,geometry.end.y-from.y)>geometry.fromRadius,`${edge.from} → ${edge.to}: Chevron must stay outside source node on mobile`);
  assert(Math.hypot(geometry.end.x-to.x,geometry.end.y-to.y)>geometry.toRadius,`${edge.from} → ${edge.to}: Chevron must stay outside target node on mobile`);
  const expectedAnchor={x:geometry.start.x+(geometry.end.x-geometry.start.x)*.62,y:geometry.start.y+(geometry.end.y-geometry.start.y)*.62};assert(Math.hypot(geometry.anchor.x-expectedAnchor.x,geometry.anchor.y-expectedAnchor.y)<.01,`${edge.from} → ${edge.to}: directional Chevron anchor must stay inside the current visible gap while avoiding an invariant midpoint`);
  const points=geometry.points.split(' ').map(pair=>pair.split(',').map(Number)),pairDistances=[];for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)pairDistances.push(Math.hypot(points[i][0]-points[j][0],points[i][1]-points[j][1]));
  const lineDistance=point=>Math.abs(direction.x*(from.y-point[1])-direction.y*(from.x-point[0]))/edgeLength;assert(points.every(point=>lineDistance(point)<=1.55),`${edge.from} → ${edge.to}: every Chevron vertex must stay on the current edge geometry within glyph width`);
  const chevronSize=Math.max(...pairDistances);assert(chevronSize>=2.95&&chevronSize<=3.05,`${edge.from} → ${edge.to}: Chevron glyph should remain compact while direction is encoded by tangent orientation`);
}
const movingVisibleGap=graphVisibleEdgeInterval({x:0,y:0},{x:100,y:0},{circles:[{x:18,y:0,radius:28},{x:88,y:0,radius:18}],padding:3,chevronExtent:2.4,minGap:7});
assert.ok(movingVisibleGap,'motion-time visible gap should be derived from displayed node circles, not only endpoint radii');
const movingAnchor=(movingVisibleGap.startT+movingVisibleGap.endT)/2*100;
assert.ok(movingAnchor>51.4&&movingAnchor<64.6,'motion-time anchor must remain between actual displayed source/target circle boundaries with glyph clearance');
assert.equal(graphVisibleEdgeInterval({x:0,y:0},{x:54,y:0},{circles:[{x:0,y:0,radius:24},{x:54,y:0,radius:24}],padding:3,chevronExtent:2.4,minGap:7}),null,'unsafe short visible gaps must hide the Chevron instead of pushing it into a node');

const laggedVisible=graphVisibleEdgeInterval({x:0,y:0},{x:100,y:0},{circles:[{x:15,y:0,radius:20},{x:85,y:0,radius:20}],padding:1.5,chevronExtent:2.2,minGap:1.5});
assert.ok(laggedVisible,'current edge must retain a safe interval while endpoint nodes visually lead the staggered edge');
assert.ok(laggedVisible.startT>.38&&laggedVisible.endT<.62,'visible interval must be clipped by the actual displayed node circles, not ideal endpoint centers');
const unsafeShort=graphVisibleEdgeInterval({x:0,y:0},{x:70,y:0},{circles:[{x:0,y:0,radius:31},{x:70,y:0,radius:31}],padding:3,chevronExtent:2.4,minGap:7});
assert.equal(unsafeShort,null,'short edges with no safe visible gap must hide the Chevron rather than place it inside a node');
const thirdNodeBlock=graphVisibleEdgeInterval({x:0,y:0},{x:120,y:0},{circles:[{x:0,y:0,radius:20},{x:120,y:0,radius:20},{x:60,y:0,radius:12}],padding:1.5,chevronExtent:2.2,minGap:1.5});
assert.ok(thirdNodeBlock,'a crossing node should split, not necessarily eliminate, the visible edge interval');
assert.ok(thirdNodeBlock.endT<.5||thirdNodeBlock.startT>.5,'Chevron anchor interval must avoid a third displayed node that occludes the edge midpoint');

const previousEdgePositions=new Map([['source',{x:20,y:30,kind:'neighbor'}],['target',{x:90,y:30,kind:'focus'}]]);
assert.deepEqual(graphEdgeMotionStart(previousEdgePositions,{from:'source',to:'target'}),{from:previousEdgePositions.get('source'),to:previousEdgePositions.get('target'),mode:'pair'},'existing edges retain their real previous endpoint pair');
assert.deepEqual(graphEdgeMotionStart(new Map([['source',{x:20,y:30,kind:'neighbor'}]]),{from:'source',to:'target'}),{from:{x:20,y:30,kind:'neighbor'},to:{x:20,y:30,kind:'neighbor'},mode:'source-collapse'},'new edge with only source history must grow from the shared previous source position');
assert.deepEqual(graphEdgeMotionStart(new Map([['target',{x:90,y:30,kind:'focus'}]]),{from:'source',to:'target'}),{from:{x:90,y:30,kind:'focus'},to:{x:90,y:30,kind:'focus'},mode:'target-collapse'},'new edge with only target history must grow from the shared previous target position');
assert.equal(graphEdgeMotionStart(new Map(),{from:'source',to:'target'}),null,'edge motion must not invent a start geometry when neither previous endpoint exists');

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

const [graphViewSource,collectionUISource,stylesSource]=await Promise.all([
  readFile(new URL('../src/encyclopedia-graph-view.js',import.meta.url),'utf8'),
  readFile(new URL('../src/collection-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../styles.css',import.meta.url),'utf8'),
]);
assert.doesNotMatch(graphViewSource,/詳細を見る/,'Graph footer detail button must not return');
assert.doesNotMatch(collectionUISource,/‹ グラフ/,'Detail Graph back button must not return');
assert.match(graphViewSource,/graph-focus-label/,'focused identity belongs inside the selected thumbnail');
assert.match(graphViewSource,/graph-edge\.direct\.relation-chain-extension/,'focused edge relation colors must be scoped to direct edges');
assert.match(graphViewSource,/graph-edge-chevron/,'directional focus edges must render the compact Chevron affordance');
assert.match(graphViewSource,/graph-edge-chevron\{[^}]*stroke-width:\.9[^}]*opacity:\.72/,'Chevron should keep its existing stroke weight while only the glyph size changes');
assert.match(graphViewSource,/graphEdgeDelay:48/,'Graph edge follow-up must use only a short node→edge stagger');
assert.doesNotMatch(graphViewSource,/chevron\.animate/,'Chevron must not own an independent transition animation');
assert.match(graphViewSource,/graphEdgeChevronGeometryFromPoints/,'Chevron geometry must derive from the same current edge endpoints');
assert.match(graphViewSource,/graphVisibleEdgeInterval/,'Chevron anchor must be constrained to the currently visible edge interval');
assert.match(graphViewSource,/anchorT=visible\.startT\+\(visible\.endT-visible\.startT\)\*\.62/,'Directional Chevron anchor must use a safe target-biased point instead of an invariant midpoint');
assert.match(graphViewSource,/graphNodeCircleInSvg/,'reroot clipping must use displayed node circles without changing edge motion authority');
assert.match(graphViewSource,/const nodeCircles=\(\)=>\[\.\.\.interactiveNodeById\.values\(\)\]/,'visible-gap clipping must consider every displayed graph node, not a mobile-specific pair or layout hack');
assert.match(graphViewSource,/applyGraphEdgeTween\(tween,edgeEased,blockingCircles\)/,'Edge and Chevron must update together from one shared reroot tween while clipping against displayed node circles');
assert.match(graphViewSource,/if\(!reduceMotion&&!suppressMotion\)[\s\S]*graphEdgeMotionStart\(previousPositions,edge\)/,'suppressed or reduced reroots must not initialize edge motion from stale previous geometry');
assert.match(graphViewSource,/graphNavigationDuration:560/,'Graph branch navigation timing must remain deliberately readable');
assert.match(graphViewSource,/detailZoomDuration:760/,'Graph/Detail transition must remain longer than branch navigation');
assert.match(graphViewSource,/graphNodeMotionStart\(previous,point,\{nodeDiameter,focusDiameter\}\)/,'Interactive nodes must derive motion from the previous spatial layout');
assert.match(graphViewSource,/runGraphGeometryMotion\(graphMotion,geometryTweens,edgeTweens/,'Edges and Chevron markers must share the graph reroot motion authority');
assert.match(graphViewSource,/graphEdgeMotionStart\(previousPositions,edge\)/,'Graph edges must derive a real previous-pair or shared-endpoint start geometry before entering the reroot tween');
assert.match(graphViewSource,/previousFrom:start\.from,previousTo:start\.to,nextFrom:a,nextTo:b/,'Graph edges and Chevrons must share the same derived start/end geometry');
assert.match(graphViewSource,/circles=Array\.isArray\(blockingCircles\)[\s\S]*visible=graphVisibleEdgeInterval\(from,to,\{circles,padding,chevronExtent,minGap\}\)/,'Chevron anchor must come from the current edge interval remaining outside displayed blocking node circles');
assert.match(graphViewSource,/else record\.chevron\.setAttribute\('visibility','hidden'\)/,'unsafe short edge gaps must hide the Chevron rather than place it inside a node');
assert.match(graphViewSource,/presentation\.canOpenDetail\)onDetail\(id,node\)/,'Graph view must delegate the measured selected node to the single collection transition owner');
assert.match(collectionUISource,/returnMoleculeDetailToGraph\(currentMoleculeId\(\)\?\?record\.id,host\)/,'Detail return must use the current Detail molecule ID after navigation');
assert.match(collectionUISource,/host\.dataset\.moleculeId=record\.id/,'Detail return surface must expose the currently rendered molecule ID');
assert.match(graphViewSource,/const id=detailMoleculeId\(press\.host,state\.focusId\)/,'pre-switch bridge must follow Detail navigation instead of stale Graph focus');
assert.match(collectionUISource,/createMoleculeTransitionController/,'Graph and Detail must share one explicit transition owner');
assert.match(collectionUISource,/detailTransitionHandle/,'Detail renderer readiness must feed the active transition instead of spawning a second ghost');
assert.match(graphViewSource,/state\.animation\?\.cancel\?\.\(\);state\.surfaceAnimation\?\.cancel\?\.\(\)/,'rapid replacement must cancel both molecule and surface animations');
assert.match(graphViewSource,/state\.ghost\?\.remove\?\.\(\);state\.surface\?\.remove\?\.\(\)/,'rapid replacement must remove bridge and surface clones');
assert.match(graphViewSource,/graphMotionState\(host,win\)/,'Graph rerender must cancel stale node/geometry motion before starting the next focus move');
assert.match(collectionUISource,/showMoleculeDetailFromGraph/);
assert.match(collectionUISource,/returnMoleculeDetailToGraph/);
assert.match(collectionUISource,/function preview\(record,name,\{graphReturn=false,presentation=null\}=\{\}\)/,'shared preview defaults to no Graph return while presentation remains optional');
assert.match(collectionUISource,/preview\(record,moleculeDisplayName\(record\),\{graphReturn:true,presentation:defaultStereo\}\)/,'molecule Detail keeps Graph return while optionally supplying presentation state');
assert.match(collectionUISource,/Math\.hypot\(event\.clientX-start\.x,event\.clientY-start\.y\)>8/,'Detail tap return must distinguish tap from model drag');
assert.match(stylesSource,/molecule-shared-transition/,'shared-element ghost must render above both Graph and Detail');

console.log(`Encyclopedia graph UI passed: state/privacy, spatial branch motion, continuous ${ENCYCLOPEDIA_MOTION.detailZoomDuration}ms Detail zoom, cancellation, reduced-motion, degree-${maxDegreeNode.degree} mobile geometry.`);
