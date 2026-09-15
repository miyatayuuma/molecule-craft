import fs from 'node:fs';

const viewPath='src/encyclopedia-graph-view.js';
let view=fs.readFileSync(viewPath,'utf8');
const replacements=[
  ["  edgeChevronDuration:320,","  edgeChevronDuration:760,"],
  [".graph-edge-chevron{fill:none;stroke:var(--graph-edge-relation,#8fe2d5);stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round;opacity:.94}",".graph-edge-chevron{fill:none;stroke:var(--graph-edge-relation,#8fe2d5);stroke-width:.9;stroke-linecap:round;stroke-linejoin:round;opacity:.72}"],
  ["  const span=maxT-minT,startT=minT+span*.15,endT=minT+span*.7,pointAt=t=>({x:from.x+dx*t,y:from.y+dy*t});","  const span=maxT-minT,startT=minT+span*.1,endT=minT+span*.78,pointAt=t=>({x:from.x+dx*t,y:from.y+dy*t});"],
  ["  const start=pointAt(startT),end=pointAt(endT),ux=dx/length,uy=dy/length,px=-uy,py=ux,back={x:end.x-ux*2.7,y:end.y-uy*2.7},tip={x:end.x+ux*2,y:end.y+uy*2};","  const start=pointAt(startT),end=pointAt(endT),ux=dx/length,uy=dy/length,px=-uy,py=ux,back={x:end.x-ux*1.25,y:end.y-uy*1.25},tip={x:end.x+ux*.7,y:end.y+uy*.7};"],
  ["  const armA={x:back.x+px*3,y:back.y+py*3},armB={x:back.x-px*3,y:back.y-py*3},points=[armA,tip,armB].map(point=>`${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');","  const armA={x:back.x+px*1.25,y:back.y+py*1.25},armB={x:back.x-px*1.25,y:back.y-py*1.25},points=[armA,tip,armB].map(point=>`${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');"],
  ["opacity:0},{transform:`translate(${geometry.delta.x}px,${geometry.delta.y}px)`,opacity:.94,offset:.16},{transform:'translate(0px,0px)',opacity:.94}","opacity:0},{transform:`translate(${geometry.delta.x}px,${geometry.delta.y}px)`,opacity:.88,offset:.12},{transform:'translate(0px,0px)',opacity:.72}"]
];
for(const [from,to] of replacements){
  if(!view.includes(from))throw new Error(`Missing view target: ${from.slice(0,80)}`);
  view=view.replace(from,to);
}
fs.writeFileSync(viewPath,view);

const testPath='tests/encyclopedia-graph-ui.test.mjs';
let test=fs.readFileSync(testPath,'utf8');
const timingNeedle="assert.equal(ENCYCLOPEDIA_MOTION.detailZoomDuration,760,'Graph/Detail shared-element zoom should read as a distinct, longer scale transition');";
const timingReplacement=`${timingNeedle}\nassert.equal(ENCYCLOPEDIA_MOTION.edgeChevronDuration,760,'Directional cue should travel slowly enough that motion, not arrow shape, communicates direction');`;
if(!test.includes(timingNeedle))throw new Error('Missing timing test target');
test=test.replace(timingNeedle,timingReplacement);
const geometryNeedle="  assert(Math.hypot(geometry.end.x-to.x,geometry.end.y-to.y)>geometry.toRadius,`${edge.from} → ${edge.to}: Chevron must stay outside target node on mobile`);";
const geometryReplacement=`${geometryNeedle}\n  const points=geometry.points.split(' ').map(pair=>pair.split(',').map(Number)),pairDistances=[];for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)pairDistances.push(Math.hypot(points[i][0]-points[j][0],points[i][1]-points[j][1]));\n  assert(Math.max(...pairDistances)<=2.7,\`${'${edge.from}'} → ${'${edge.to}'}: Chevron glyph should remain a tiny motion marker rather than a visible arrowhead\`);`;
if(!test.includes(geometryNeedle))throw new Error('Missing geometry test target');
test=test.replace(geometryNeedle,geometryReplacement);
const sourceNeedle="assert.match(graphViewSource,/graph-edge-chevron/,'directional focus edges must render the compact Chevron affordance');";
const sourceReplacement=`${sourceNeedle}\nassert.match(graphViewSource,/graph-edge-chevron\\{[^}]*stroke-width:\\.9[^}]*opacity:\\.72/,'Chevron should stay visually tiny and subordinate to its motion');\nassert.match(graphViewSource,/edgeChevronDuration:760/,'Chevron travel should be substantially slower than the original motion cue');`;
if(!test.includes(sourceNeedle))throw new Error('Missing source contract target');
test=test.replace(sourceNeedle,sourceReplacement);
fs.writeFileSync(testPath,test);
