from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one replacement, found {count}")
    p.write_text(text.replace(old, new, 1))


path = "src/encyclopedia-graph-view.js"
replace_once(
    path,
    """export const ENCYCLOPEDIA_MOTION=Object.freeze({
  graphNavigationDuration:560,
  detailZoomDuration:760,
  easing:'cubic-bezier(.4,0,.2,1)',
});""",
    """export const ENCYCLOPEDIA_MOTION=Object.freeze({
  graphNavigationDuration:560,
  detailZoomDuration:760,
  edgeChevronDuration:260,
  easing:'cubic-bezier(.4,0,.2,1)',
});""",
)
replace_once(
    path,
    ".graph-edge{stroke:#6b94a4;stroke-width:1.25;opacity:.22}.graph-edge.direct{stroke:#8fe2d5;stroke-width:1.8;opacity:.68}.graph-edge.cross",
    ".graph-edge{stroke:#6b94a4;stroke-width:1.25;opacity:.22}.graph-edge.direct{stroke:#8fe2d5;stroke-width:1.8;opacity:.68}.graph-edge-chevron{fill:none;stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round;opacity:.9;pointer-events:none;transform-box:view-box;transform-origin:0 0}.graph-edge.direct.relation-chain-extension,.graph-edge-chevron.relation-chain-extension{stroke:#61c7bb}.graph-edge.direct.relation-bond-order,.graph-edge-chevron.relation-bond-order{stroke:#d4aa59}.graph-edge.direct.relation-ring-formation,.graph-edge-chevron.relation-ring-formation{stroke:#66b8cf}.graph-edge.direct.relation-aromatization,.graph-edge-chevron.relation-aromatization{stroke:#a78ad1}.graph-edge.direct.relation-oxygenation,.graph-edge-chevron.relation-oxygenation{stroke:#76bb86}.graph-edge.direct.relation-functional-group,.graph-edge-chevron.relation-functional-group{stroke:#b9bf67}.graph-edge.direct.relation-substitution,.graph-edge-chevron.relation-substitution{stroke:#c481aa}.graph-edge.direct.relation-isomer{stroke:#9aaab2;stroke-dasharray:5 4}.graph-edge.direct.relation-bridge{stroke:#7e8e97;stroke-dasharray:2 5}.graph-edge.cross",
)
replace_once(
    path,
    """export function graphNodeMotionStart(previous,next,{nodeDiameter=66,focusDiameter=124}={}){
  if(!previous||!next)return null;
  const previousDiameter=previous.kind==='focus'?focusDiameter:nodeDiameter,currentDiameter=next.kind==='focus'?focusDiameter:nodeDiameter;
  return {dx:previous.x-next.x,dy:previous.y-next.y,scale:previousDiameter/currentDiameter};
}

function graphMotionState(host,win){
  let state=graphMotionStates.get(host);if(!state){state={token:0,rafId:null,animations:new Set(),win};graphMotionStates.set(host,state);}
  if(state.rafId!=null)(state.win?.cancelAnimationFrame?.bind(state.win)??clearTimeout)(state.rafId);
  for(const animation of state.animations)animation.cancel?.();state.animations.clear();state.rafId=null;state.win=win;state.token+=1;return state;
}""",
    """export function graphNodeMotionStart(previous,next,{nodeDiameter=66,focusDiameter=124}={}){
  if(!previous||!next)return null;
  const previousDiameter=previous.kind==='focus'?focusDiameter:nodeDiameter,currentDiameter=next.kind==='focus'?focusDiameter:nodeDiameter;
  return {dx:previous.x-next.x,dy:previous.y-next.y,scale:previousDiameter/currentDiameter};
}

const DIRECTIONAL_GRAPH_EDGE_RELATIONS=new Set(['chain-extension','bond-order','aromatization','oxygenation']);
export function graphFocusEdgePresentation(graph,edge,focusId){
  const relation=graph?.relationCodes?.[edge?.relationCode]??'',direct=!!focusId&&!!edge&&(edge.from===focusId||edge.to===focusId),directional=direct&&DIRECTIONAL_GRAPH_EDGE_RELATIONS.has(relation);
  return {direct,relation,relationClass:direct&&relation?`relation-${relation}`:'',directional,forwardFrom:directional?edge.from:null,forwardTo:directional?edge.to:null};
}
export function graphEdgeChevronGeometry(edge,positions,{focusId,nodeDiameter=66,focusDiameter=124,startFraction=.3,endFraction=.7}={}){
  const from=positions?.get?.(edge?.from),to=positions?.get?.(edge?.to);if(!from||!to)return null;
  const dx=to.x-from.x,dy=to.y-from.y,distance=Math.hypot(dx,dy);if(distance<1)return null;
  const fromRadius=(edge.from===focusId?focusDiameter:nodeDiameter)/2,toRadius=(edge.to===focusId?focusDiameter:nodeDiameter)/2,visibleLength=distance-fromRadius-toRadius;if(visibleLength<12)return null;
  const ux=dx/distance,uy=dy/distance,point=fraction=>{const offset=fromRadius+visibleLength*clamp(fraction,0,1);return {x:from.x+ux*offset,y:from.y+uy*offset};};
  return {start:point(startFraction),end:point(endFraction),angle:Math.atan2(dy,dx),visibleLength};
}
const edgeChevronTransform=(point,angle)=>`translate(${point.x}px,${point.y}px) rotate(${angle*180/Math.PI}deg)`;
function animateFocusEdgeChevron(chevron,motion,state,{animate=false}={}){
  const end=edgeChevronTransform(motion.end,motion.angle);chevron.style.transform=end;
  if(!animate||!chevron.animate)return;
  const animation=chevron.animate([{transform:edgeChevronTransform(motion.start,motion.angle),opacity:0},{transform:end,opacity:.92}],{duration:ENCYCLOPEDIA_MOTION.edgeChevronDuration,delay:ENCYCLOPEDIA_MOTION.graphNavigationDuration,easing:ENCYCLOPEDIA_MOTION.easing,fill:'both'});
  state.animations.add(animation);animation.finished.catch(()=>{}).then(()=>state.animations.delete(animation));
}

function graphMotionState(host,win,focusId){
  let state=graphMotionStates.get(host);if(!state){state={token:0,rafId:null,animations:new Set(),win,focusId:null,focusChanged:false};graphMotionStates.set(host,state);}
  const previousFocusId=state.focusId;
  if(state.rafId!=null)(state.win?.cancelAnimationFrame?.bind(state.win)??clearTimeout)(state.rafId);
  for(const animation of state.animations)animation.cancel?.();state.animations.clear();state.rafId=null;state.win=win;state.token+=1;state.focusChanged=previousFocusId!==null&&previousFocusId!==focusId;state.focusId=focusId;return state;
}""",
)
replace_once(
    path,
    "const document=host.ownerDocument??globalThis.document;ensureStyles(document);const reduceMotion=!!win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,graphMotion=graphMotionState(host,win);host.className='encyclopedia-graph-host';host.replaceChildren();",
    "const document=host.ownerDocument??globalThis.document;ensureStyles(document);const reduceMotion=!!win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,graphMotion=graphMotionState(host,win,focusId);host.className='encyclopedia-graph-host';host.replaceChildren();",
)
replace_once(
    path,
    """  const oneHopSet=new Set(projection.oneHop),twoHopSet=new Set(projection.twoHop);
  const addLine=(edge,className)=>{const a=positions.get(edge.from)??contextPosition(edge.from),b=positions.get(edge.to)??contextPosition(edge.to);if(!a||!b)return;const line=svgEl(document,'line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:className});svg.append(line);if(!reduceMotion){const pa=previousPositions.get(edge.from),pb=previousPositions.get(edge.to),tween=geometryTween(line,pa&&pb?{x1:pa.x,y1:pa.y,x2:pb.x,y2:pb.y}:null,{x1:a.x,y1:a.y,x2:b.x,y2:b.y},[['x1','x1'],['y1','y1'],['x2','x2'],['y2','y2']]);if(tween)geometryTweens.push(tween);}};
  for(const edge of projection.visibleEdges){const direct=edge.from===focusId&&oneHopSet.has(edge.to)||edge.to===focusId&&oneHopSet.has(edge.from),cross=oneHopSet.has(edge.from)&&oneHopSet.has(edge.to),teaser=twoHopSet.has(edge.from)||twoHopSet.has(edge.to);addLine(edge,`graph-edge${direct?' direct':cross?' cross':teaser?' teaser':''}`);}
  for(const edge of projection.teaserEdges)addLine(edge,'graph-edge teaser');""",
    """  const oneHopSet=new Set(projection.oneHop),twoHopSet=new Set(projection.twoHop),focusDirectionalEdges=[];
  const addLine=(edge,className,attrs={})=>{const a=positions.get(edge.from)??contextPosition(edge.from),b=positions.get(edge.to)??contextPosition(edge.to);if(!a||!b)return null;const line=svgEl(document,'line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:className,...attrs});svg.append(line);if(!reduceMotion){const pa=previousPositions.get(edge.from),pb=previousPositions.get(edge.to),tween=geometryTween(line,pa&&pb?{x1:pa.x,y1:pa.y,x2:pb.x,y2:pb.y}:null,{x1:a.x,y1:a.y,x2:b.x,y2:b.y},[['x1','x1'],['y1','y1'],['x2','x2'],['y2','y2']]);if(tween)geometryTweens.push(tween);}return line;};
  for(const edge of projection.visibleEdges){
    const direct=edge.from===focusId&&oneHopSet.has(edge.to)||edge.to===focusId&&oneHopSet.has(edge.from),cross=oneHopSet.has(edge.from)&&oneHopSet.has(edge.to),teaser=twoHopSet.has(edge.from)||twoHopSet.has(edge.to);
    if(direct){const presentation=graphFocusEdgePresentation(graph,edge,focusId);addLine(edge,`graph-edge direct${presentation.relationClass?` ${presentation.relationClass}`:''}`,{'data-edge-from':edge.from,'data-edge-to':edge.to,'data-relation':presentation.relation});if(presentation.directional)focusDirectionalEdges.push({edge,presentation});}
    else addLine(edge,`graph-edge${cross?' cross':teaser?' teaser':''}`);
  }
  for(const edge of projection.teaserEdges)addLine(edge,'graph-edge teaser');
  for(const {edge,presentation} of focusDirectionalEdges){
    const motion=graphEdgeChevronGeometry(edge,positions,{focusId,nodeDiameter,focusDiameter});if(!motion)continue;
    const chevron=svgEl(document,'path',{d:'M -4 -3 L 0 0 L -4 3',class:`graph-edge-chevron ${presentation.relationClass}`,'data-edge-from':presentation.forwardFrom,'data-edge-to':presentation.forwardTo,'data-relation':presentation.relation});svg.append(chevron);animateFocusEdgeChevron(chevron,motion,graphMotion,{animate:!reduceMotion&&graphMotion.focusChanged});
  }""",
)

path = "tests/encyclopedia-graph-ui.test.mjs"
replace_once(
    path,
    "import {ENCYCLOPEDIA_MOTION,graphNodeMotionStart} from '../src/encyclopedia-graph-view.js';",
    "import {ENCYCLOPEDIA_MOTION,graphEdgeChevronGeometry,graphFocusEdgePresentation,graphNodeMotionStart} from '../src/encyclopedia-graph-view.js';",
)
replace_once(
    path,
    "assert.equal(ENCYCLOPEDIA_MOTION.detailZoomDuration,760,'Graph/Detail shared-element zoom should read as a distinct, longer scale transition');\nassert.equal(ENCYCLOPEDIA_MOTION.easing,'cubic-bezier(.4,0,.2,1)');",
    "assert.equal(ENCYCLOPEDIA_MOTION.detailZoomDuration,760,'Graph/Detail shared-element zoom should read as a distinct, longer scale transition');\nassert.equal(ENCYCLOPEDIA_MOTION.edgeChevronDuration,260,'Focused relation direction should read as a brief one-shot cue after navigation settles');\nassert.equal(ENCYCLOPEDIA_MOTION.easing,'cubic-bezier(.4,0,.2,1)');",
)
replace_once(
    path,
    """assert(Math.hypot(outgoingA.dx,outgoingA.dy)>40,'Outgoing focus must preserve the inverse directional travel vector');

const maxDegreeNode=""",
    """assert(Math.hypot(outgoingA.dx,outgoingA.dy)>40,'Outgoing focus must preserve the inverse directional travel vector');

const productionEdge=(from,to)=>{const edge=production.edges.find(candidate=>candidate.from===from&&candidate.to===to);assert.ok(edge,`${from} → ${to} production edge must exist in semantic forward order`);return edge;};
const chainIntoFocus=productionEdge('propane','n-butane'),chainOutOfFocus=productionEdge('n-butane','n-pentane');
const incomingChainPresentation=graphFocusEdgePresentation(production,chainIntoFocus,'n-butane'),outgoingChainPresentation=graphFocusEdgePresentation(production,chainOutOfFocus,'n-butane');
assert.deepEqual({relation:incomingChainPresentation.relation,directional:incomingChainPresentation.directional,from:incomingChainPresentation.forwardFrom,to:incomingChainPresentation.forwardTo},{relation:'chain-extension',directional:true,from:'propane',to:'n-butane'},'Incoming chain-extension direction must follow semantic from → to, even when that points toward focus');
assert.deepEqual({relation:outgoingChainPresentation.relation,directional:outgoingChainPresentation.directional,from:outgoingChainPresentation.forwardFrom,to:outgoingChainPresentation.forwardTo},{relation:'chain-extension',directional:true,from:'n-butane',to:'n-pentane'});
const backgroundChainPresentation=graphFocusEdgePresentation(production,chainIntoFocus,'benzene');
assert.equal(backgroundChainPresentation.direct,false,'Unfocused background edges must not receive focus relation presentation');assert.equal(backgroundChainPresentation.relationClass,'');assert.equal(backgroundChainPresentation.directional,false);
const bondPresentation=graphFocusEdgePresentation(production,productionEdge('cyclohexane','cyclohexene'),'cyclohexene');assert.deepEqual({relation:bondPresentation.relation,from:bondPresentation.forwardFrom,to:bondPresentation.forwardTo},{relation:'bond-order',from:'cyclohexane',to:'cyclohexene'});
const aromaticPresentation=graphFocusEdgePresentation(production,productionEdge('cyclohexene','benzene'),'cyclohexene');assert.deepEqual({relation:aromaticPresentation.relation,from:aromaticPresentation.forwardFrom,to:aromaticPresentation.forwardTo},{relation:'aromatization',from:'cyclohexene',to:'benzene'});
const oxygenPresentation=graphFocusEdgePresentation(production,productionEdge('methane','methanol'),'methane');assert.deepEqual({relation:oxygenPresentation.relation,from:oxygenPresentation.forwardFrom,to:oxygenPresentation.forwardTo},{relation:'oxygenation',from:'methane',to:'methanol'});
for(const [from,to,relation] of [['n-butane','isobutane','isomer'],['oxygen','water','bridge'],['n-hexane','cyclohexane','ring-formation']]){const presentation=graphFocusEdgePresentation(production,productionEdge(from,to),from);assert.equal(presentation.relation,relation);assert.equal(presentation.directional,false,`${relation} must remain non-directional in the focus edge cue`);}
const nButaneLayout=layoutFocusNeighborhood(production,'n-butane',{width:360,height:480,nodeDiameter:66,focusDiameter:124}),incomingChainMotion=graphEdgeChevronGeometry(chainIntoFocus,nButaneLayout.positions,{focusId:'n-butane',nodeDiameter:66,focusDiameter:124}),outgoingChainMotion=graphEdgeChevronGeometry(chainOutOfFocus,nButaneLayout.positions,{focusId:'n-butane',nodeDiameter:66,focusDiameter:124});assert.ok(incomingChainMotion&&outgoingChainMotion,'Focused chain edges need enough exposed line length for a compact chevron');
const nButanePoint=nButaneLayout.positions.get('n-butane');assert(Math.hypot(incomingChainMotion.end.x-nButanePoint.x,incomingChainMotion.end.y-nButanePoint.y)<Math.hypot(incomingChainMotion.start.x-nButanePoint.x,incomingChainMotion.start.y-nButanePoint.y),'propane → n-butane chevron must move toward the focused node, proving direction is not focus-outward');assert(Math.hypot(outgoingChainMotion.end.x-nButanePoint.x,outgoingChainMotion.end.y-nButanePoint.y)>Math.hypot(outgoingChainMotion.start.x-nButanePoint.x,outgoingChainMotion.start.y-nButanePoint.y),'n-butane → n-pentane chevron must move away from focus on the opposite edge');
const nButaneMobile=layoutFocusNeighborhood(production,'n-butane',{width:320,height:430,nodeDiameter:62,focusDiameter:116});for(const edge of [chainIntoFocus,chainOutOfFocus]){const motion=graphEdgeChevronGeometry(edge,nButaneMobile.positions,{focusId:'n-butane',nodeDiameter:62,focusDiameter:116});assert.ok(motion);const from=nButaneMobile.positions.get(edge.from),to=nButaneMobile.positions.get(edge.to),fromRadius=(edge.from==='n-butane'?116:62)/2,toRadius=(edge.to==='n-butane'?116:62)/2;for(const point of [motion.start,motion.end]){assert(Math.hypot(point.x-from.x,point.y-from.y)>fromRadius+3,'mobile chevron must stay outside its source node');assert(Math.hypot(point.x-to.x,point.y-to.y)>toRadius+3,'mobile chevron must stay outside its target node');}}

const maxDegreeNode=""",
)
replace_once(
    path,
    "assert.match(graphViewSource,/graphMotionState\\(host,win\\)/,'Graph rerender must cancel stale node/geometry motion before starting the next focus move');",
    "assert.match(graphViewSource,/graphMotionState\\(host,win,focusId\\)/,'Graph rerender must cancel stale node/geometry/chevron motion before starting the next focus move');\nassert.match(graphViewSource,/focusChanged=previousFocusId!==null&&previousFocusId!==focusId/,'Chevron motion must run only when the actual focused molecule changes');\nassert.match(graphViewSource,/graph-edge\\.direct\\.relation-chain-extension/,'Relation colors must be scoped to direct focus edges');\nassert.match(graphViewSource,/graph-edge-chevron/,'Directional direct edges must render a compact chevron');\nassert.match(graphViewSource,/delay:ENCYCLOPEDIA_MOTION\\.graphNavigationDuration/,'Chevron motion must wait for graph focus navigation to settle');\nassert.match(graphViewSource,/animate:!reduceMotion&&graphMotion\\.focusChanged/,'Reduced motion must keep static relation cues without moving the chevron');\nassert.match(graphViewSource,/'data-edge-from':presentation\\.forwardFrom/,'Rendered chevron direction must preserve semantic edge from → to metadata');",
)
replace_once(
    path,
    "console.log(`Encyclopedia graph UI passed: state/privacy, spatial branch motion, continuous ${ENCYCLOPEDIA_MOTION.detailZoomDuration}ms Detail zoom, cancellation, reduced-motion, degree-${maxDegreeNode.degree} mobile geometry.`);",
    "console.log(`Encyclopedia graph UI passed: state/privacy, focus-edge relation colors + semantic one-shot direction, spatial branch motion, continuous ${ENCYCLOPEDIA_MOTION.detailZoomDuration}ms Detail zoom, cancellation, reduced-motion, degree-${maxDegreeNode.degree} mobile geometry.`);",
)

path = "tests/encyclopedia-transition-browser.test.mjs"
replace_once(
    path,
    """  const initial=await evaluate(`(()=>{const node=document.querySelector('.graph-node.focus.registered'),visual=node?.querySelector('.graph-focus-thumbnail'),r=visual?.getBoundingClientRect();return{id:node?.dataset.graphId,rect:r&&{left:r.left,top:r.top,width:r.width,height:r.height}}})()`);
  assert.equal(initial.id,'isobutane','latest registered molecule is the Graph focus');assert.ok(initial.rect?.width>0);

  await evaluate(`document.querySelector('.graph-node.focus.registered').click()`);""",
    """  let initial=await evaluate(`(()=>{const node=document.querySelector('.graph-node.focus.registered'),visual=node?.querySelector('.graph-focus-thumbnail'),r=visual?.getBoundingClientRect();return{id:node?.dataset.graphId,rect:r&&{left:r.left,top:r.top,width:r.width,height:r.height}}})()`);
  assert.equal(initial.id,'isobutane','latest registered molecule is the Graph focus');assert.ok(initial.rect?.width>0);

  await evaluate(`document.querySelector('[data-graph-id="n-butane"]')?.click()`);await new Promise(r=>setTimeout(r,90));
  const edgeVisuals=await evaluate(`(()=>{const lines=[...document.querySelectorAll('.graph-edge.direct')],chevrons=[...document.querySelectorAll('.graph-edge-chevron')],strokes=Object.fromEntries(lines.map(line=>[line.dataset.relation,getComputedStyle(line).stroke])),isomer=lines.find(line=>line.dataset.relation==='isomer');return{focus:document.querySelector('.graph-node.focus')?.dataset.graphId,chainPairs:lines.filter(line=>line.dataset.relation==='chain-extension').map(line=>line.dataset.edgeFrom+'→'+line.dataset.edgeTo).sort(),strokes,isomerDash:isomer?getComputedStyle(isomer).strokeDasharray:'none',backgroundRelationAttrs:document.querySelectorAll('.graph-edge:not(.direct)[data-relation]').length,nonDirectionalChevrons:chevrons.filter(node=>['isomer','bridge','ring-formation','functional-group','substitution'].includes(node.dataset.relation)).length,animatedChevrons:chevrons.filter(node=>node.getAnimations().length).length};})()`);
  assert.equal(edgeVisuals.focus,'n-butane');assert.deepEqual(edgeVisuals.chainPairs,['n-butane→n-pentane','propane→n-butane'],'focused n-butane must expose both semantic chain-extension directions');assert.notEqual(edgeVisuals.strokes['chain-extension'],edgeVisuals.strokes['bond-order'],'relation colors must be visibly distinct');assert.notEqual(edgeVisuals.strokes['chain-extension'],edgeVisuals.strokes['ring-formation'],'ring topology must not reuse chain-extension color');assert.notEqual(edgeVisuals.isomerDash,'none','isomer focus edge should remain visually neutral but distinct');assert.equal(edgeVisuals.backgroundRelationAttrs,0,'background edges must not receive relation styling metadata');assert.equal(edgeVisuals.nonDirectionalChevrons,0,'non-directional relations must not render chevrons');assert.ok(edgeVisuals.animatedChevrons>=1,'focus change must schedule one-shot directional chevrons');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:740,deviceScaleFactor:1,mobile:true});await evaluate(`document.querySelector('[data-graph-id="isobutane"]')?.click()`);await new Promise(r=>setTimeout(r,25));await evaluate(`document.querySelector('[data-graph-id="n-butane"]')?.click()`);await new Promise(r=>setTimeout(r,650));
  const mobileEdges=await evaluate(`(()=>{const stage=document.querySelector('.graph-stage')?.getBoundingClientRect(),nodes=[...document.querySelectorAll('.graph-node')].map(node=>node.getBoundingClientRect()),chevrons=[...document.querySelectorAll('.graph-edge-chevron')],overlap=chevrons.some(node=>{const r=node.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return nodes.some(n=>x>n.left+2&&x<n.right-2&&y>n.top+2&&y<n.bottom-2);});return{focus:document.querySelector('.graph-node.focus')?.dataset.graphId,stageWidth:stage?.width??999,chevrons:chevrons.length,overlap,allCurrent:chevrons.every(node=>node.dataset.edgeFrom==='n-butane'||node.dataset.edgeTo==='n-butane')};})()`);
  assert.equal(mobileEdges.focus,'n-butane');assert.ok(mobileEdges.stageWidth<=360,'narrow portrait harness must exercise mobile graph geometry');assert.ok(mobileEdges.chevrons>0);assert.equal(mobileEdges.overlap,false,'mobile chevrons must remain in exposed edge space instead of entering molecule nodes');assert.equal(mobileEdges.allCurrent,true,'rapid focus replacement must leave only current-focus chevrons');
  await send('Emulation.clearDeviceMetricsOverride');await evaluate(`document.querySelector('[data-graph-id="isobutane"]')?.click()`);await new Promise(r=>setTimeout(r,620));initial=await evaluate(`(()=>{const node=document.querySelector('.graph-node.focus.registered'),visual=node?.querySelector('.graph-focus-thumbnail'),r=visual?.getBoundingClientRect();return{id:node?.dataset.graphId,rect:r&&{left:r.left,top:r.top,width:r.width,height:r.height}}})()`);assert.equal(initial.id,'isobutane');assert.ok(initial.rect?.width>0);

  await evaluate(`document.querySelector('.graph-node.focus.registered').click()`);""",
)
