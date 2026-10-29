import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {nativeTriangle,nativeProjection,laneBranch} from '../scripts/polymer-task5-native-projection.mjs';
import {frozenSourcePath} from './helpers/polymer-task5-evidence-path.mjs';
import {rasterLayers,continuousLanes,maskColor} from './helpers/polymer-task5-visual.mjs';
import {png} from '../scripts/analyze-polymer-task5-exact-mesh.mjs';

const root='docs/validation/polymer-local-fragment-task5-evidence/recovery/';
const directory=root+'pib-native-projection-87abab18/';
const read=p=>JSON.parse(fs.readFileSync(directory+p));
const compressed=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const sha=b=>createHash('sha256').update(b).digest('hex');

test('native independent edge ownership is half-open; shared edge has exactly one owner',()=>{
  const vertex=(x,y)=>({x,y,depth:1,ndc:.5});
  const a=vertex(0,0),b=vertex(0,2),c=vertex(2,0),d=vertex(2,2);
  const left=nativeTriangle({a,b,c,den:-4,culled:false,triangle:0},1,1,.1,10);
  const right=nativeTriangle({a:d,b:c,c:b,den:-4,culled:false,triangle:1},1,1,.1,10);
  assert.equal(left.covered,false);assert.equal(right.covered,true);
  assert.equal(right.depth,.5);
  assert.equal(nativeTriangle({a,b,c,den:-4,culled:true},.5,.5,.1,10),null);
});

test('equal native Float32 depth is owned by the later draw without a depth slack',()=>{
  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const snapshot={visual:{canvas:{bufferWidth:4,bufferHeight:4},camera:{matrix:identity,projection:identity,near:.1,far:10}},
    geometries:{g:{positions:[-.75,-.75,-1,.75,-.75,-1,0,.75,-1],indices:[0,1,2]}},
    meshes:[1,2].map(id=>({id,kind:'atom',index:id-1,geometry:'g',matrixWorld:identity,visible:true,materialSide:0}))};
  const projection=nativeProjection(snapshot);
  assert.equal(projection.pixel(1,2).id,2);
  snapshot.meshes.reverse();assert.equal(nativeProjection(snapshot).pixel(1,2).id,1);
});

test('named false negatives are repaired by current native predicates, including the same-facet depth case',()=>{
  const saved=compressed(root+'pib-exact-mesh-519a686c/boundary-30-0.json.gz'),p=nativeProjection(saved.snapshot);
  const target=p.front(1056,157.5,262.5),blocker=p.front(31,157.5,262.5);
  assert.equal(p.pixel(157,262).id,1056);
  assert.equal(target.triangle,3);assert.equal(blocker.triangle,355);
  assert.equal(1e6*(blocker.depth-target.depth),.7748603820800781);
  const bond34=p.front(1058,224.5,238.5);
  assert.equal(p.pixel(224,238).id,1058);assert.equal(bond34.triangle,18);
  assert.ok(Math.min(...bond34.edgeDistances)>0);
});

test('native floor and ceil branches match the formal operation order on both sides of a ceil boundary',()=>{
  const view={domOcclusions:{rectangles:[],circles:[],modelOccluders:[]}};
  for(const length of [13,13+1e-12]){
    const lane={a:{x:10.125,y:20.25},b:{x:10.125+length,y:20.25}};
    const b=laneBranch(lane,1,()=>({id:7}),view,7);
    assert.equal(b.steps,length===13?26:27);assert.equal(b.continuous,b.length);
    for(const sample of b.samples)for(const c of sample.cells){
      const t=sample.j/b.steps;
      assert.equal(c.floorX,Math.floor(lane.a.x+(lane.b.x-lane.a.x)*t));
      assert.equal(c.floorY,Math.floor(lane.a.y+c.k));
    }
  }
});

test('continuous samples obey the formal integer rectangle erasure even outside the continuous rectangle',()=>{
  const lane={bondIndex:0,a:{x:10.1,y:5},b:{x:10.1,y:13},radius:1};
  const view={canvas:{dpr:1,bufferWidth:24,bufferHeight:24},lanes:[lane],
    domOcclusions:{rectangles:[{left:10.2,right:10.3,top:0,bottom:20}],circles:[],modelOccluders:[]}};
  const pixels=Buffer.alloc(24*24*3),color=maskColor(1024);
  for(let y=0;y<24;y++){const i=(y*24+10)*3;pixels[i]=color>>16;pixels[i+1]=color>>8;pixels[i+2]=color;}
  const bytes=png({width:24,height:24,pixels}),mask=rasterLayers(bytes,view).photometryMask;
  const raw=(x,y)=>({id:x===10&&y>=0&&y<24?1024:0});
  const native=laneBranch(lane,1,raw,view,1024),formal=continuousLanes(view,[lane],mask);
  assert.equal(native.continuous,0);assert.equal(formal,0);
  assert.ok(native.samples.every(s=>!s.hit));
});

test('frozen absolute paths are relocated to this checkout and path traversal is rejected',()=>{
  const expected=new URL('../scripts/check-polymer-task5-native-projection.mjs',import.meta.url);
  assert.equal(fs.realpathSync(frozenSourcePath('/workspace/old/molecule-craft/scripts/check-polymer-task5-native-projection.mjs')),fs.realpathSync(expected));
  assert.throws(()=>frozenSourcePath('/workspace/old/unrecognized/file.mjs'));
  assert.throws(()=>frozenSourcePath('../outside.mjs'));
});

test('six retained poses have no CPU target pixel/area/run differences; captured GPU target pixels also agree',()=>{
  const report=compressed(directory+'consistency.json.gz');
  assert.equal(report.rows.length,6);assert.equal(report.consistencyGate,true);
  assert.equal(report.totalCPURasters,6);
  for(const row of report.rows){
    assert.equal(row.objects.filter(o=>o.kind==='atom').length,11);
    assert.equal(row.objects.filter(o=>o.kind==='bond').length,10);
    for(const o of row.objects){assert.deepEqual(o.falseNegatives,[]);assert.deepEqual(o.falsePositives,[]);assert.equal(o.areaDelta,0);assert.ok(o.runDelta===null||o.runDelta===0);}
  }
  const gpu=report.rows.find(r=>r.actualGPU).actualGPU;
  assert.deepEqual(gpu.allPixelResidual,[{x:91,y:335,gpu:3,cpu:37}]);
  assert.ok(gpu.targets.every(t=>!t.falseNegatives.length&&!t.falsePositives.length));
  assert.ok(!gpu.targets.some(t=>[3,37].includes(t.id)),'global residual is not a required target');
});

test('consumed native constraint slots retain every outcome; local failure is never an infeasibility certificate',()=>{
  const protocol=read('candidate-protocol.json'),result=read('native-candidates.json');
  const history=fs.readFileSync(directory+'native-history.jsonl','utf8').trim().split('\n').map(JSON.parse);
  assert.equal(protocol.nativeConstraintEvaluationCap,128);assert.equal(protocol.opticalSlack,0);
  assert.equal(result.nativeConstraintEvaluations,history.length);assert.equal(history.length,76);
  assert.deepEqual(result.rows.map(r=>[r.branch,r.evaluations]),[[26,34],[27,42]]);
  for(const row of history){assert.equal(row.objects.length,21);assert.ok(row.deltaDegrees.every(v=>Math.abs(v)<=1));}
  assert.equal(result.qualifyingProposals,0);assert.equal(result.certifiedExcludedRegions,0);
  assert.equal(result.trueGeometryFeasibility,'UNRESOLVED');assert.equal(result.oldCampaignReruns,0);
  assert.equal(result.rows[1].best.branchQualified,false);
  assert.equal(result.GPUCalls,0);
});

test('frozen source provenance survives the scalar interpolation correction without rerunning any campaign',()=>{
  const correction=read('floor-order-correction.json'),c=correction.sourceCorrection;
  const exports=read('source-export-correction.json'),prior=new Map();
  const review=read('review-correction.json');
  for(const file of review.sources){
    let source=fs.readFileSync(frozenSourcePath(file.path),'utf8');assert.equal(sha(source),file.currentSHA256);
    for(const edit of file.edits){assert.equal(source.split(edit.after).length,2);source=source.replace(edit.after,edit.before);}
    assert.equal(sha(source),file.priorSHA256);prior.set(file.path,source);
  }
  for(const edit of exports.sources){
    const current=prior.get(edit.path)??fs.readFileSync(frozenSourcePath(edit.path),'utf8');assert.equal(sha(current),edit.currentSHA256);
    const previous=current.replace(edit.after,edit.before);assert.equal(sha(previous),edit.priorSHA256);prior.set(edit.path,previous);
  }
  const module=fs.readFileSync(c.path,'utf8'),helper=fs.readFileSync('tests/helpers/polymer-task5-visual.mjs','utf8');
  for(const name of ['modelOccludesAnnotation','underDom']){
    const line=helper.split('\n').find(l=>l.startsWith('function '+name+'('));
    assert.ok(module.includes(line),'complete frozen DOM predicate '+name+' is unchanged');
  }
  const current=prior.get(c.path);assert.equal(sha(current),c.correctedSHA256);
  const frozen=current.replace(c.after,c.before);assert.equal(sha(frozen),c.campaignSHA256);
  for(const name of ['candidate-protocol.json','consistency-protocol.json'])for(const item of read(name).files){
    assert.equal(sha(item.path===c.path?frozen:prior.get(item.path)??fs.readFileSync(frozenSourcePath(item.path))),item.sha256,item.path);
  }
  assert.equal(correction.rows,82);assert.equal(correction.samples,106983);
  assert.equal(correction.floorMismatches,0);assert.equal(correction.domMismatches,0);
  assert.equal(correction.newCPURasters,0);assert.equal(correction.solverCalls,0);
  const impact=read('review-dom-impact.json');
  assert.equal(impact.potentialChangedContinuousSamples,0);assert.equal(review.newNativeConstraintEvaluations,0);
});
