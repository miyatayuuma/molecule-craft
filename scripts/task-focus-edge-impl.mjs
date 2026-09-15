import fs from 'node:fs';

const replaceOnce=(text,from,to,label)=>{
  const count=text.split(from).length-1;
  if(count!==1)throw new Error(`${label}: expected one match, got ${count}`);
  return text.replace(from,to);
};

const viewPath='src/encyclopedia-graph-view.js';
let view=fs.readFileSync(viewPath,'utf8');
view=replaceOnce(view,
`export const ENCYCLOPEDIA_MOTION=Object.freeze({
  graphNavigationDuration:560,
  detailZoomDuration:760,
  easing:'cubic-bezier(.4,0,.2,1)',
});`,
`export const ENCYCLOPEDIA_MOTION=Object.freeze({
  graphNavigationDuration:560,
  detailZoomDuration:760,
  edgeChevronDuration:320,
  easing:'cubic-bezier(.4,0,.2,1)',
});`,
'encyclopedia motion');

view=replaceOnce(view,
`.graph-edge{stroke:#6b94a4;stroke-width:1.25;opacity:.22}.graph-edge.direct{stroke:#8fe2d5;stroke-width:1.8;opacity:.68}.graph-edge.cross{stroke:#7db8be;opacity:.38}.graph-edge.teaser{stroke-dasharray:3 5;opacity:.18}`,
`.graph-edge{stroke:#6b94a4;stroke-width:1.25;opacity:.22}.graph-edge.direct{stroke:var(--graph-edge-relation,#8fe2d5);stroke-width:1.8;opacity:.76}.graph-edge-chevron{fill:none;stroke:var(--graph-edge-relation,#8fe2d5);stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round;opacity:.94}.graph-edge.direct.relation-chain-extension,.graph-edge-chevron.relation-chain-extension{--graph-edge-relation:#59b9ad}.graph-edge.direct.relation-bond-order,.graph-edge-chevron.relation-bond-order{--graph-edge-relation:#d2a24f}.graph-edge.direct.relation-ring-formation,.graph-edge-chevron.relation-ring-formation{--graph-edge-relation:#5ca8c5}.graph-edge.direct.relation-aromatization,.graph-edge-chevron.relation-aromatization{--graph-edge-relation:#9b84cb}.graph-edge.direct.relation-oxygenation,.graph-edge-chevron.relation-oxygenation{--graph-edge-relation:#73b783}.graph-edge.direct.relation-functional-group,.graph-edge-chevron.relation-functional-group{--graph-edge-relation:#b7b55f}.graph-edge.direct.relation-substitution,.graph-edge-chevron.relation-substitution{--graph-edge-relation:#b97ca6}.graph-edge.direct.relation-isomer,.graph-edge-chevron.relation-isomer{--graph-edge-relation:#a6b0b7}.graph-edge.direct.relation-bridge,.graph-edge-chevron.relation-bridge{--graph-edge-relation:#788b95}.graph-edge.direct.relation-isomer{stroke-dasharray:5 4}.graph-edge.direct.relation-bridge{stroke-dasharray:2 5}.graph-edge.cross{stroke:#7db8be;opacity:.38}.graph-edge.teaser{stroke-dasharray:3 5;opacity:.18}`,
'focus edge styles');

const motionFn=`export function graphNodeMotionStart(previous,next,{nodeDiameter=66,focusDiameter=124}={}){
  if(!previous||!next)return null;
  const previousDiameter=previous.kind==='focus'?focusDiameter:nodeDiameter,currentDiameter=next.kind==='focus'?focusDiameter:nodeDiameter;
  return {dx:previous.x-next.x,dy:previous.y-next.y,scale:previousDiameter/currentDiameter};
}`;
const helpers=`${motionFn}

const DIRECTIONAL_GRAPH_EDGE_RELATIONS=new Set(['chain-extension','bond-order','ring-formation','aromatization','oxygenation']);
const graphRelationClass=relation=>\`relation-\${String(relation??'bridge').toLowerCase().replace(/[^a-z0-9-]+/g,'-')}\`;

export function graphEdgeVisualState(graph,edge,{direct=false}={}){
  const relation=graph?.relationCodes?.[edge?.relationCode]??'bridge',directional=!!direct&&DIRECTIONAL_GRAPH_EDGE_RELATIONS.has(relation);
  return {relation,relationClass:direct?graphRelationClass(relation):'',directional,from:directional?edge.from:null,to:directional?edge.to:null};
}

export function graphEdgeChevronGeometry(edge,positions,{focusId,nodeDiameter=66,focusDiameter=124,padding=5}={}){
  const from=positions?.get?.(edge?.from),to=positions?.get?.(edge?.to);if(!from||!to)return null;
  const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);if(!Number.isFinite(length)||length<1)return null;
  const fromRadius=(edge.from===focusId?focusDiameter:nodeDiameter)/2,toRadius=(edge.to===focusId?focusDiameter:nodeDiameter)/2;
  const minT=clamp((fromRadius+padding)/length,0,1),maxT=clamp(1-(toRadius+padding)/length,0,1);if(maxT-minT<.025)return null;
  const span=maxT-minT,startT=minT+span*.15,endT=minT+span*.7,pointAt=t=>({x:from.x+dx*t,y:from.y+dy*t});
  const start=pointAt(startT),end=pointAt(endT),ux=dx/length,uy=dy/length,px=-uy,py=ux,back={x:end.x-ux*2.7,y:end.y-uy*2.7},tip={x:end.x+ux*2,y:end.y+uy*2};
  const armA={x:back.x+px*3,y:back.y+py*3},armB={x:back.x-px*3,y:back.y-py*3},points=[armA,tip,armB].map(point=>\`\${point.x.toFixed(2)},\${point.y.toFixed(2)}\`).join(' ');
  return {start,end,delta:{x:start.x-end.x,y:start.y-end.y},points,fromRadius,toRadius};
}`;
view=replaceOnce(view,motionFn,helpers,'edge visual helpers');

view=replaceOnce(view,
`  const oneHopSet=new Set(projection.oneHop),twoHopSet=new Set(projection.twoHop);
  const addLine=(edge,className)=>{const a=positions.get(edge.from)??contextPosition(edge.from),b=positions.get(edge.to)??contextPosition(edge.to);if(!a||!b)return;const line=svgEl(document,'line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:className});svg.append(line);if(!reduceMotion){const pa=previousPositions.get(edge.from),pb=previousPositions.get(edge.to),tween=geometryTween(line,pa&&pb?{x1:pa.x,y1:pa.y,x2:pb.x,y2:pb.y}:null,{x1:a.x,y1:a.y,x2:b.x,y2:b.y},[['x1','x1'],['y1','y1'],['x2','x2'],['y2','y2']]);if(tween)geometryTweens.push(tween);}};
  for(const edge of projection.visibleEdges){const direct=edge.from===focusId&&oneHopSet.has(edge.to)||edge.to===focusId&&oneHopSet.has(edge.from),cross=oneHopSet.has(edge.from)&&oneHopSet.has(edge.to),teaser=twoHopSet.has(edge.from)||twoHopSet.has(edge.to);addLine(edge,\`graph-edge\${direct?' direct':cross?' cross':teaser?' teaser':''}\`);}`,
`  const oneHopSet=new Set(projection.oneHop),twoHopSet=new Set(projection.twoHop),previousFocusId=[...previousPositions].find(([,point])=>point?.kind==='focus')?.[0]??null,focusChanged=previousFocusId!==focusId;
  const addLine=(edge,className)=>{const a=positions.get(edge.from)??contextPosition(edge.from),b=positions.get(edge.to)??contextPosition(edge.to);if(!a||!b)return null;const line=svgEl(document,'line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:className});svg.append(line);if(!reduceMotion){const pa=previousPositions.get(edge.from),pb=previousPositions.get(edge.to),tween=geometryTween(line,pa&&pb?{x1:pa.x,y1:pa.y,x2:pb.x,y2:pb.y}:null,{x1:a.x,y1:a.y,x2:b.x,y2:b.y},[['x1','x1'],['y1','y1'],['x2','x2'],['y2','y2']]);if(tween)geometryTweens.push(tween);}return line;};
  const addChevron=(edge,visual)=>{const geometry=graphEdgeChevronGeometry(edge,positions,{focusId,nodeDiameter,focusDiameter});if(!geometry)return;const chevron=svgEl(document,'polyline',{points:geometry.points,class:\`graph-edge-chevron \${visual.relationClass}\`,'data-edge-from':edge.from,'data-edge-to':edge.to,'data-relation':visual.relation});svg.append(chevron);if(focusChanged&&!reduceMotion&&chevron.animate){const animation=chevron.animate([{transform:\`translate(\${geometry.delta.x}px,\${geometry.delta.y}px)\`,opacity:0},{transform:\`translate(\${geometry.delta.x}px,\${geometry.delta.y}px)\`,opacity:.94,offset:.16},{transform:'translate(0px,0px)',opacity:.94}],{duration:ENCYCLOPEDIA_MOTION.edgeChevronDuration,delay:previousFocusId?ENCYCLOPEDIA_MOTION.graphNavigationDuration:80,easing:ENCYCLOPEDIA_MOTION.easing,fill:'both',iterations:1});if(animation){graphMotion.animations.add(animation);animation.finished.catch(()=>{}).then(()=>graphMotion.animations.delete(animation));}}};
  for(const edge of projection.visibleEdges){const direct=edge.from===focusId&&oneHopSet.has(edge.to)||edge.to===focusId&&oneHopSet.has(edge.from),cross=oneHopSet.has(edge.from)&&oneHopSet.has(edge.to),teaser=twoHopSet.has(edge.from)||twoHopSet.has(edge.to),visual=graphEdgeVisualState(graph,edge,{direct});addLine(edge,\`graph-edge\${direct?\` direct \${visual.relationClass}\`:cross?' cross':teaser?' teaser':''}\`);if(visual.directional)addChevron(edge,visual);}`,
'edge render loop');
fs.writeFileSync(viewPath,view);

const unitPath='tests/encyclopedia-graph-ui.test.mjs';
let unit=fs.readFileSync(unitPath,'utf8');
unit=replaceOnce(unit,
`import {ENCYCLOPEDIA_MOTION,graphNodeMotionStart} from '../src/encyclopedia-graph-view.js';`,
`import {ENCYCLOPEDIA_MOTION,graphEdgeChevronGeometry,graphEdgeVisualState,graphNodeMotionStart} from '../src/encyclopedia-graph-view.js';`,
'unit import');
unit=replaceOnce(unit,
`assert.equal(localBoundsOverlap(mobileLayout,{diameter:62,focusDiameter:116}),false,'Enlarged focus thumbnail node and seven neighbors must not overlap in representative portrait geometry');
for(const point of mobileLayout.positions.values()){
  assert(point.x>=31&&point.x<=289,\`mobile x tap bound: \${point.x}\`);
  assert(point.y>=31&&point.y<=399,\`mobile y tap bound: \${point.y}\`);
}`,
`assert.equal(localBoundsOverlap(mobileLayout,{diameter:62,focusDiameter:116}),false,'Enlarged focus thumbnail node and seven neighbors must not overlap in representative portrait geometry');
for(const point of mobileLayout.positions.values()){
  assert(point.x>=31&&point.x<=289,\`mobile x tap bound: \${point.x}\`);
  assert(point.y>=31&&point.y<=399,\`mobile y tap bound: \${point.y}\`);
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
  const geometry=graphEdgeChevronGeometry(edge,butaneMobile.positions,{focusId:'n-butane',nodeDiameter:62,focusDiameter:116});assert.ok(geometry,\`\${edge.from} → \${edge.to}: mobile visible-gap chevron geometry\`);
  const from=butaneMobile.positions.get(edge.from),to=butaneMobile.positions.get(edge.to),direction={x:to.x-from.x,y:to.y-from.y},movement={x:geometry.end.x-geometry.start.x,y:geometry.end.y-geometry.start.y};
  assert(movement.x*direction.x+movement.y*direction.y>0,\`\${edge.from} → \${edge.to}: Chevron must move along semantic from→to direction even when focus is in the middle\`);
  assert(Math.hypot(geometry.end.x-from.x,geometry.end.y-from.y)>geometry.fromRadius,\`\${edge.from} → \${edge.to}: Chevron must stay outside source node on mobile\`);
  assert(Math.hypot(geometry.end.x-to.x,geometry.end.y-to.y)>geometry.toRadius,\`\${edge.from} → \${edge.to}: Chevron must stay outside target node on mobile\`);
}`,
'unit focus edge tests');
unit=replaceOnce(unit,
`assert.match(graphViewSource,/graph-focus-label/,'focused identity belongs inside the selected thumbnail');`,
`assert.match(graphViewSource,/graph-focus-label/,'focused identity belongs inside the selected thumbnail');
assert.match(graphViewSource,/graph-edge\\.direct\\.relation-chain-extension/,'focused edge relation colors must be scoped to direct edges');
assert.match(graphViewSource,/graph-edge-chevron/,'directional focus edges must render the compact Chevron affordance');
assert.match(graphViewSource,/focusChanged&&!reduceMotion&&chevron\\.animate/,'Chevron motion must run only for a focus change and respect reduced motion');
assert.match(graphViewSource,/previousFocusId\\?ENCYCLOPEDIA_MOTION\\.graphNavigationDuration:80/,'Chevron motion must wait for spatial focus settlement on branch navigation');
assert.match(graphViewSource,/iterations:1/,'Chevron motion must be one-shot rather than looping');`,
'unit source contracts');
fs.writeFileSync(unitPath,unit);

const browserPath='tests/encyclopedia-transition-browser.test.mjs';
let browser=fs.readFileSync(browserPath,'utf8');
browser=replaceOnce(browser,
`  const initial=await evaluate(\`(()=>{const node=document.querySelector('.graph-node.focus.registered'),visual=node?.querySelector('.graph-focus-thumbnail'),r=visual?.getBoundingClientRect();return{id:node?.dataset.graphId,rect:r&&{left:r.left,top:r.top,width:r.width,height:r.height}}})()\`);
  assert.equal(initial.id,'isobutane','latest registered molecule is the Graph focus');assert.ok(initial.rect?.width>0);

  await evaluate(\`document.querySelector('.graph-node.focus.registered').click()\`);`,
`  let initial=await evaluate(\`(()=>{const node=document.querySelector('.graph-node.focus.registered'),visual=node?.querySelector('.graph-focus-thumbnail'),r=visual?.getBoundingClientRect();return{id:node?.dataset.graphId,rect:r&&{left:r.left,top:r.top,width:r.width,height:r.height}}})()\`);
  assert.equal(initial.id,'isobutane','latest registered molecule is the Graph focus');assert.ok(initial.rect?.width>0);

  await evaluate(\`document.querySelector('[data-graph-id="n-butane"]').click()\`);await new Promise(r=>setTimeout(r,70));
  const focusEdges=await evaluate(\`(()=>{const focus=document.querySelector('.graph-node.focus')?.dataset.graphId,chevrons=[...document.querySelectorAll('.graph-edge-chevron')],backgroundStyled=[...document.querySelectorAll('.graph-edge:not(.direct)')].filter(edge=>[...edge.classList].some(name=>name.startsWith('relation-')));return{focus,chainLines:document.querySelectorAll('.graph-edge.direct.relation-chain-extension').length,chainChevrons:document.querySelectorAll('.graph-edge-chevron.relation-chain-extension').length,isomerChevrons:document.querySelectorAll('.graph-edge-chevron.relation-isomer').length,backgroundStyled:backgroundStyled.length,incident:chevrons.every(node=>node.dataset.edgeFrom===focus||node.dataset.edgeTo===focus),iterations:chevrons.flatMap(node=>node.getAnimations()).map(animation=>animation.effect?.getTiming?.().iterations)}})()\`);
  assert.equal(focusEdges.focus,'n-butane');assert.ok(focusEdges.chainLines>=2,'focused n-butane must expose both shorter and longer chain-extension edges');assert.ok(focusEdges.chainChevrons>=2,'directional chain-extension focus edges need Chevrons');assert.equal(focusEdges.isomerChevrons,0,'isomer edge must not receive a directional Chevron');assert.equal(focusEdges.backgroundStyled,0,'background edges must remain relation-neutral');assert.equal(focusEdges.incident,true,'only current-focus incident edges may own Chevrons');assert.ok(focusEdges.iterations.length&&focusEdges.iterations.every(value=>value===1),'Chevron animations must be one-shot');
  await evaluate(\`document.querySelector('[data-graph-id="isobutane"]').click()\`);await new Promise(r=>setTimeout(r,35));await evaluate(\`document.querySelector('[data-graph-id="n-butane"]').click()\`);await new Promise(r=>setTimeout(r,70));
  const rapidFocus=await evaluate(\`(()=>{const focus=document.querySelector('.graph-node.focus')?.dataset.graphId,chevrons=[...document.querySelectorAll('.graph-edge-chevron')];return{focus,incident:chevrons.every(node=>node.dataset.edgeFrom===focus||node.dataset.edgeTo===focus),count:chevrons.length}})()\`);assert.equal(rapidFocus.focus,'n-butane');assert.equal(rapidFocus.incident,true,'rapid focus replacement must leave no stale Chevron from the prior focus');assert.ok(rapidFocus.count>0);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await evaluate(\`document.querySelector('[data-graph-id="isobutane"]').click()\`);await new Promise(r=>setTimeout(r,70));
  const reducedEdges=await evaluate(\`(()=>{const direct=document.querySelectorAll('.graph-edge.direct[class*="relation-"]').length,chevrons=[...document.querySelectorAll('.graph-edge-chevron')];return{direct,chevrons:chevrons.length,animations:chevrons.flatMap(node=>node.getAnimations()).length}})()\`);assert.ok(reducedEdges.direct>0,'reduced motion must retain relation styling');assert.equal(reducedEdges.animations,0,'reduced motion must keep Chevron direction static');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await send('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});await evaluate(\`document.querySelector('[data-graph-id="n-butane"]').click()\`);await new Promise(r=>setTimeout(r,950));
  const mobileEdges=await evaluate(\`(()=>{const focus=document.querySelector('.graph-node.focus'),nodes=[...document.querySelectorAll('.graph-node')],chevrons=[...document.querySelectorAll('.graph-edge-chevron')],inside=(x,y,r)=>x>r.left&&x<r.right&&y>r.top&&y<r.bottom;return{width:innerWidth,count:chevrons.length,clear:chevrons.every(node=>{const r=node.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return !nodes.some(graphNode=>inside(x,y,graphNode.getBoundingClientRect()));}),focus:focus?.dataset.graphId}})()\`);assert.equal(mobileEdges.width,320);assert.equal(mobileEdges.focus,'n-butane');assert.ok(mobileEdges.count>0);assert.equal(mobileEdges.clear,true,'mobile Chevrons must remain in the visible line gap instead of node interiors');
  await send('Emulation.clearDeviceMetricsOverride');await evaluate(\`document.querySelector('[data-graph-id="isobutane"]').click()\`);await new Promise(r=>setTimeout(r,650));initial=await evaluate(\`(()=>{const node=document.querySelector('.graph-node.focus.registered'),visual=node?.querySelector('.graph-focus-thumbnail'),r=visual?.getBoundingClientRect();return{id:node?.dataset.graphId,rect:r&&{left:r.left,top:r.top,width:r.width,height:r.height}}})()\`);assert.equal(initial.id,'isobutane');assert.ok(initial.rect?.width>0);

  await evaluate(\`document.querySelector('.graph-node.focus.registered').click()\`);`,
'browser focus edge checks');
browser=replaceOnce(browser,
`console.log('Encyclopedia browser transition passed: measured Graph origin, continuous proxy, current prev/next + isomer return, reduced motion.');`,
`console.log('Encyclopedia browser transition passed: focus-edge relations/Chevrons, mobile/reduced-motion safety, measured Graph origin, continuous proxy, current prev/next + isomer return.');`,
'browser completion message');
fs.writeFileSync(browserPath,browser);
