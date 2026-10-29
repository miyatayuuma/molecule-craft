// Owner: docs/validation/polymer-local-fragment-task5-native-projection.md.
// Scalar-only correction audit, no triangle projections/raster/solver/GPU.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {snapshot,frozen} from './analyze-polymer-task5-orientation-feasibility.mjs';
import {poseAt} from './diagnose-polymer-task5-boundaries.mjs';
import {underDom} from './polymer-task5-native-projection.mjs';
const dir=process.argv[2];assert.ok(dir);
const compressed=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const consistency=compressed(dir+'/consistency.json.gz'),history=fs.readFileSync(dir+'/native-history.jsonl','utf8').trim().split('\n').map(JSON.parse);
const saved=compressed('docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-exact-mesh-519a686c/boundary-30-0.json.gz');
const source='scripts/polymer-task5-native-projection.mjs';
let corrected=fs.readFileSync(source,'utf8');
if(fs.existsSync(dir+'/review-correction.json')){
  const edit=JSON.parse(fs.readFileSync(dir+'/review-correction.json')).sources.find(s=>s.path===source);
  for(const step of edit.edits){assert.equal(corrected.split(step.after).length,2);corrected=corrected.replace(step.after,step.before);}
}
// Later export decoupling preserves the predicate bodies. Recover the exact
// interpolation-correction revision before reconstructing campaign bytes.
if(fs.existsSync(dir+'/source-export-correction.json')){
  const edits=JSON.parse(fs.readFileSync(dir+'/source-export-correction.json')).sources;
  const edit=edits.find(e=>e.path===source);assert.equal(corrected.split(edit.after).length,2);
  corrected=corrected.replace(edit.after,edit.before);
}
const before='      const x=lane.a.x+dx*j/steps-k*dy/length,y=lane.a.y+dy*j/steps+k*dx/length;';
const after='      const t=j/steps;\n      const x=lane.a.x+dx*t-k*dy/length,y=lane.a.y+dy*t+k*dx/length;';
assert.equal(corrected.split(after).length,2);
const sha=b=>createHash('sha256').update(b).digest('hex');
const oldSource=corrected.replace(after,before),protocol=JSON.parse(fs.readFileSync(dir+'/candidate-protocol.json'));
assert.equal(sha(oldSource),protocol.files.find(f=>f.path===source).sha256);
const rows=[...consistency.rows.map(r=>({name:r.name,pose:r.name===saved.name?null:poseAt(r.rotationDegrees).pose})),
  ...history.map(r=>({name:'native-evaluation-'+r.serial,pose:r.pose}))];
let samples=0,floorMismatches=0,domMismatches=0,maxCoordinateDifference=0;
const details=[];
for(const row of rows){
  const s=row.pose?snapshot(row.pose):saved.snapshot,view={canvas:s.visual.canvas,lanes:s.visual.lanes,domOcclusions:row.pose?frozen.views[0].domOcclusions:saved.domOcclusions};
  for(const lane of s.visual.lanes.filter(l=>consistency.protocol.allTargets.bonds&&consistency.rows[0].objects.some(o=>o.kind==='bond'&&o.index===l.bondIndex))){
    const dx=lane.b.x-lane.a.x,dy=lane.b.y-lane.a.y,L=Math.hypot(dx,dy),n=Math.ceil(2*L),dpr=s.visual.canvas.dpr;
    for(let j=0;j<=n;j++)for(const k of [-.5,0,.5]){
      const a={x:lane.a.x+dx*j/n-k*dy/L,y:lane.a.y+dy*j/n+k*dx/L};
      const t=j/n,b={x:lane.a.x+dx*t-k*dy/L,y:lane.a.y+dy*t+k*dx/L};samples++;
      maxCoordinateDifference=Math.max(maxCoordinateDifference,Math.abs(a.x-b.x),Math.abs(a.y-b.y));
      const floor=Math.floor(a.x*dpr)!==Math.floor(b.x*dpr)||Math.floor(a.y*dpr)!==Math.floor(b.y*dpr);
      const dom=underDom(view,a)!==underDom(view,b);
      if(floor)floorMismatches++;if(dom)domMismatches++;
      if(floor||dom)details.push({name:row.name,bondIndex:lane.bondIndex,j,k,a,b,floor,dom});
    }
  }
}
const result={kind:'SCALAR_ONLY_INTERPOLATION_ORDER_CORRECTION',rows:rows.length,samples,floorMismatches,domMismatches,maxCoordinateDifference,
  noObservedConstraintChange:floorMismatches===0&&domMismatches===0,details,
  sourceCorrection:{path:source,before,after,campaignSHA256:sha(oldSource),correctedSHA256:sha(corrected),
    reconstruction:'replace after with before exactly once in current file to reconstruct frozen campaign source bytes'},
  newPoses:0,newNativeConstraintEvaluations:0,newCPURasters:0,solverCalls:0,GPUCalls:0,
  scope:'all6 consistency cases plus all76 consumed native evaluation rows, not an arbitrary-pose equivalence assertion'};
assert.ok(result.noObservedConstraintChange,'do not reuse old evaluation truth if a floor or DOM decision changed');
fs.writeFileSync(dir+'/floor-order-correction.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
