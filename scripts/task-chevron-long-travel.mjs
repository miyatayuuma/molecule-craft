import {readFile,writeFile} from 'node:fs/promises';

const replaceOnce=(source,from,to,label)=>{
  const count=source.split(from).length-1;
  if(count!==1)throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(from,to);
};

const viewPath='src/encyclopedia-graph-view.js';
let view=await readFile(viewPath,'utf8');
view=replaceOnce(view,'  edgeChevronDuration:760,','  edgeChevronDuration:2000,','Chevron duration');
view=replaceOnce(view,'  const span=maxT-minT,startT=minT+span*.1,endT=minT+span*.78,pointAt=t=>({x:from.x+dx*t,y:from.y+dy*t});','  const startT=minT,endT=maxT,pointAt=t=>({x:from.x+dx*t,y:from.y+dy*t});','Chevron travel span');
await writeFile(viewPath,view);

const testPath='tests/encyclopedia-graph-ui.test.mjs';
let test=await readFile(testPath,'utf8');
test=replaceOnce(test,"assert.equal(ENCYCLOPEDIA_MOTION.edgeChevronDuration,760,'Directional cue should travel slowly enough that motion, not arrow shape, communicates direction');","assert.equal(ENCYCLOPEDIA_MOTION.edgeChevronDuration,2000,'Directional cue should use a deliberately long two-second travel so motion, not arrow shape, communicates direction');",'duration assertion');
test=replaceOnce(test,"  const from=butaneMobile.positions.get(edge.from),to=butaneMobile.positions.get(edge.to),direction={x:to.x-from.x,y:to.y-from.y},movement={x:geometry.end.x-geometry.start.x,y:geometry.end.y-geometry.start.y};","  const from=butaneMobile.positions.get(edge.from),to=butaneMobile.positions.get(edge.to),direction={x:to.x-from.x,y:to.y-from.y},movement={x:geometry.end.x-geometry.start.x,y:geometry.end.y-geometry.start.y},edgeLength=Math.hypot(direction.x,direction.y),visibleGap=edgeLength-geometry.fromRadius-geometry.toRadius-10;",'geometry variables');
test=replaceOnce(test,"  assert(movement.x*direction.x+movement.y*direction.y>0,`${edge.from} → ${edge.to}: Chevron must move along semantic from→to direction even when focus is in the middle`);","  assert(movement.x*direction.x+movement.y*direction.y>0,`${edge.from} → ${edge.to}: Chevron must move along semantic from→to direction even when focus is in the middle`);\n  assert(Math.hypot(movement.x,movement.y)>=visibleGap*.99,`${edge.from} → ${edge.to}: Chevron should traverse essentially the full visible edge gap`);",'full-gap assertion');
test=replaceOnce(test,"assert.match(graphViewSource,/edgeChevronDuration:760/,'Chevron travel should be substantially slower than the original motion cue');","assert.match(graphViewSource,/edgeChevronDuration:2000/,'Chevron travel should use the deliberate two-second motion cue');",'source duration assertion');
await writeFile(testPath,test);
