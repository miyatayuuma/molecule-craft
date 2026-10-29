// Owner: docs/validation/polymer-local-fragment-task5-native-projection.md.
// Fixed retained poses only. No solver, candidate generation or new GPU call.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {nativeConstraints} from './polymer-task5-native-projection.mjs';
import {seed,poseAt,convexHull,clearance} from './diagnose-polymer-task5-boundaries.mjs';
import {snapshot,frozen} from './analyze-polymer-task5-orientation-feasibility.mjs';
import {render,png,grade} from './analyze-polymer-task5-exact-mesh.mjs';
import {pngPixels,maskColor,rasterLayers} from '../tests/helpers/polymer-task5-visual.mjs';

const root='docs/validation/polymer-local-fragment-task5-evidence/recovery/';
const output=process.argv[2];assert.ok(output);
assert.ok(!fs.existsSync(output+'/consistency.json.gz'),'retained-pose campaign already recorded');
fs.mkdirSync(output,{recursive:true});
const read=p=>JSON.parse(gunzipSync(fs.readFileSync(root+p)));
const retained=read('pib-boundary-92da7771/results.json.gz');
const saved=read('pib-exact-mesh-519a686c/boundary-30-0.json.gz');
const model=read('pib-active-constraints-8227174d/active-model.json.gz');
const group=JSON.parse(fs.readFileSync(root+'pib-visibility-conflict.json')).groups.find(g=>g.anchor===30);
const rows=[{name:'seed',rotationDegrees:seed.rotationDegrees,snapshot:snapshot(seed.pose),savedGrade:seed.grade},
  {name:saved.name,rotationDegrees:[0,0,0],snapshot:saved.snapshot,savedGrade:null,domOcclusions:saved.domOcclusions}];
for(const row of retained.rows){
  const match=rows.find(r=>JSON.stringify(r.rotationDegrees)===JSON.stringify(row.rotationDegrees));
  if(match){(match.aliases??=[]).push(row.name);continue;}
  const observation=row.observations.find(o=>o.precision==='legacy4');
  rows.push({name:row.name,rotationDegrees:row.rotationDegrees,snapshot:snapshot(observation.pose),savedGrade:observation.grade});
}
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=[import.meta.filename,'scripts/polymer-task5-native-projection.mjs','scripts/analyze-polymer-task5-exact-mesh.mjs',
  'scripts/analyze-polymer-task5-orientation-feasibility.mjs','scripts/diagnose-polymer-task5-boundaries.mjs',
  'tests/helpers/polymer-task5-visual.mjs',...['pib-boundary-92da7771/results.json.gz',
    'pib-exact-mesh-519a686c/boundary-30-0.json.gz','pib-exact-mesh-519a686c/boundary-30-0-id.png',
    'pib-active-constraints-8227174d/active-model.json.gz','pib-visibility-conflict.json'].map(p=>root+p)];
const protocol={kind:'RETAINED_NATIVE_PROJECTION_CONSISTENCY_NO_SEARCH',startHead:'87abab18f9a4ad71fe5b9df946c07224fad8d034',
  poses:rows.map(({name,rotationDegrees,aliases})=>({name,rotationDegrees,aliases})),
  nativeConstraintEvaluations:rows.length,independentCPURasterCap:rows.length,allTargets:{atoms:11,bonds:10},
  candidateSolves:0,newPoses:0,GPUCalls:0,graphDigest:frozen.graphDigest,
  gate:'zero target pixel/area/run/sample-floor/ceil differences against legacy4 CPU at every retained pose; zero target ownership differences at retained actual GPU pose',
  scope:'per-pose exact CPU expression; one actual GPU capture. No all-SO(3) or unseen-GPU equivalence claim.',
  files:files.map(path=>({path,sha256:sha(path)}))};
assert.equal(rows.length,6);
fs.writeFileSync(output+'/consistency-protocol.json',JSON.stringify(protocol,null,2)+'\n',{flag:'wx'});
const oldValue=(f,d)=>f.value+f.gradient.reduce((s,g,i)=>s+g*d[i],0);
const oldEligible=(object,d)=>new Set(object.cells.filter(c=>!c.annotationBoundary&&c.conditions.every(f=>oldValue(f,d)>=0)&&c.disjunctions.every(cl=>cl.some(f=>oldValue(f,d)>=0))).map(c=>c.x+','+c.y));
const results=[];let totalCPU=0;
for(const row of rows){
  const dom=row.domOcclusions??frozen.views[0].domOcclusions,view={canvas:row.snapshot.visual.canvas,lanes:row.snapshot.visual.lanes,domOcclusions:dom};
  const exact=nativeConstraints(row.snapshot,group,dom);
  const oracle=render(row.snapshot,'legacy4',{exactEdges:true}),oracleBytes=png(oracle);totalCPU++;
  const oracleGrade=grade(oracleBytes,{anchor:30,snapshot:row.snapshot,domOcclusions:dom});
  if(row.savedGrade)assert.deepEqual(oracleGrade,row.savedGrade,'retained native CPU grade '+row.name);
  const layers=rasterLayers(oracleBytes,view),W=oracle.width;
  const targetMap=new Map(exact.objects.map(o=>[o.id,new Set()]));
  for(let i=0;i<oracle.ids.length;i++)if(targetMap.has(oracle.ids[i]))targetMap.get(oracle.ids[i]).add(i%W+','+Math.floor(i/W));
  const objects=exact.objects.map(o=>{
    const set=new Set(o.rawPixels.map(p=>p.join(','))),expected=targetMap.get(o.id),d=row.rotationDegrees.map((v,i)=>v-model.seed[i]);
    const falseNegatives=[...expected].filter(p=>!set.has(p)),falsePositives=[...set].filter(p=>!expected.has(p));
    const g=o.kind==='bond'?oracleGrade.bonds.find(b=>b.index===o.index):oracleGrade.atoms.find(a=>a.index===o.index);
    const old=model.objects.find(m=>m.id===o.id),oldSet=old?oldEligible(old,d):null;
    return {...o,branch:o.branch??null,falseNegatives,falsePositives,areaDelta:o.visiblePixels.length-(layers.counts.get(maskColor(o.id))??0),
      runDelta:o.branch?o.branch.continuous-g.continuous:null,passEqual:o.pass===g.pass,
      oldFalseNegatives:oldSet?[...expected].filter(p=>!oldSet.has(p)):null,oldFalsePositives:oldSet?[...oldSet].filter(p=>!expected.has(p)):null};
  });
  const result={name:row.name,rotationDegrees:row.rotationDegrees,aliases:row.aliases,objects,jointPass:exact.jointPass,
    cpuConsistent:objects.every(o=>!o.falseNegatives.length&&!o.falsePositives.length&&o.areaDelta===0&&(o.runDelta===null||o.runDelta===0)&&o.passEqual)};
  // Explicit floor/ceil comparison uses the oracle's continuousLanes result
  // above and the native lane endpoints, never old affine sample coordinates.
  if(row.name===saved.name){
    const bytes=fs.readFileSync(root+'pib-exact-mesh-519a686c/boundary-30-0-id.png'),gpu=pngPixels(bytes);
    const lookup=new Map([[0,0],...saved.snapshot.meshes.map(m=>[maskColor(m.id),m.id])]),gpuSets=new Map(exact.objects.map(o=>[o.id,new Set()]));
    const residual=[];
    for(let i=0;i<gpu.width*gpu.height;i++){
      const j=i*gpu.channels,id=lookup.get((gpu.pixels[j]<<16)|(gpu.pixels[j+1]<<8)|gpu.pixels[j+2]);assert.notEqual(id,undefined);
      if(gpuSets.has(id))gpuSets.get(id).add(i%W+','+Math.floor(i/W));
      if(id!==oracle.ids[i])residual.push({x:i%W,y:Math.floor(i/W),gpu:id,cpu:oracle.ids[i]});
    }
    result.actualGPU={allPixelResidual:residual,targets:objects.map(o=>{
      const expected=gpuSets.get(o.id),actual=new Set(o.rawPixels.map(p=>p.join(',')));
      return {id:o.id,falseNegatives:[...expected].filter(p=>!actual.has(p)),falsePositives:[...actual].filter(p=>!expected.has(p))};
    })};
    const inspect=(id,x,y)=>{
      const f=exact.projection.front(id,x+.5,y+.5),ts=exact.projection.triangles.filter(t=>t.id===id);
      return {owner:exact.projection.pixel(x,y).id,front:f,hullCoverage:-clearance(convexHull(ts.flatMap(t=>[t.a,t.b,t.c])),{x:x+.5,y:y+.5})};
    };
    const b32=inspect(1056,157,262),c30=inspect(31,157,262),b34=inspect(1058,224,238);
    result.namedProbes={bond32:{pixel:[157,262],target:b32,blocker:c30,scaledDepthDifference:1e6*(c30.front.depth-b32.front.depth)},bond34:{pixel:[224,238],target:b34}};
  }
  results.push(result);
  console.log(JSON.stringify({name:row.name,cpuConsistent:result.cpuConsistent,failing:objects.filter(o=>!o.pass).map(o=>({id:o.id,area:o.visiblePixels.length,required:o.required,continuous:o.branch?.continuous})),gpu:result.actualGPU,namedProbes:result.namedProbes}));
}
const gpu=results.find(r=>r.actualGPU).actualGPU;
const result={protocol,rows:results,totalCPURasters:totalCPU,cpuGate:results.every(r=>r.cpuConsistent),
  retainedGPUTargetGate:gpu.targets.every(o=>!o.falseNegatives.length&&!o.falsePositives.length),
  newCandidatePoses:0,solverCalls:0,GPUCalls:0,formalGPU:'0/3',certifiedExcludedRegions:0};
result.consistencyGate=result.cpuGate&&result.retainedGPUTargetGate;
fs.writeFileSync(output+'/consistency.json.gz',gzipSync(JSON.stringify(result)+'\n'),{flag:'wx'});
console.log(JSON.stringify({consistencyGate:result.consistencyGate,cpuGate:result.cpuGate,retainedGPUTargetGate:result.retainedGPUTargetGate,uniquePoses:rows.length,independentCPURasters:totalCPU}));
