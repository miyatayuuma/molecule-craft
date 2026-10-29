// Owner: docs/validation/polymer-local-fragment-task5-discrete-events.md.
// One pre-registered event construction; never a production orientation scorer.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {seed,poseAt} from './diagnose-polymer-task5-boundaries.mjs';
import {snapshot,frozen} from './analyze-polymer-task5-orientation-feasibility.mjs';
import {nativeTriangle,nativeConstraints} from './polymer-task5-native-projection.mjs';
import {render,png,grade} from './analyze-polymer-task5-exact-mesh.mjs';

export const base='docs/validation/polymer-local-fragment-task5-evidence/recovery/';
export const prior=base+'pib-native-projection-87abab18/';
export const directory=base+'pib-discrete-events-7a88b20c/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p));
const packed=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const save=(name,data)=>fs.writeFileSync(directory+name,JSON.stringify(data,null,2)+'\n');
const zip=(name,data)=>fs.writeFileSync(directory+name,gzipSync(JSON.stringify(data)+'\n'));

export function bracketBoolean(predicate,iterations=24){
  let lo=0,hi=1;const before=predicate(lo),after=predicate(hi);
  if(before===after)return {bracketed:false,before,after,reason:'endpoint predicates equal; no monotonicity or absence of interior events inferred'};
  for(let i=0;i<iterations;i++){const mid=(lo+hi)/2;if(predicate(mid)===before)lo=mid;else hi=mid;}
  return {bracketed:true,lo,hi,before,after,iterations};
}

export function laneSample(lane,j,k,steps){
  const dx=lane.b.x-lane.a.x,dy=lane.b.y-lane.a.y,L=Math.hypot(dx,dy),t=j/steps;
  return {x:lane.a.x+dx*t-k*dy/L,y:lane.a.y+dy*t+k*dx/L,length:L};
}

function register(){
  assert.ok(!fs.existsSync(directory),'campaign exists: no restart or replacement');
  const history=fs.readFileSync(prior+'native-history.jsonl','utf8').trim().split('\n').map(JSON.parse);
  const gate=packed(prior+'consistency.json.gz');assert.equal(gate.consistencyGate,true);
  const b33=r=>r.objects.find(o=>o.kind==='bond'&&o.index===33);
  const b34=r=>r.objects.find(o=>o.kind==='bond'&&o.index===34);
  // Select directions using retained observations only. No new seed or grid.
  const area=history.map((r,i)=>({r,i})).sort((a,b)=>b33(b.r).pixels-b33(a.r).pixels||a.i-b.i)[0];
  const length=history.map((r,i)=>({r,i})).sort((a,b)=>b34(b.r).length-b34(a.r).length||a.i-b.i)[0];
  const distinct=gate.rows.filter(r=>r.name!=='seed'&&Math.hypot(...r.rotationDegrees.map((x,i)=>x-seed.rotationDegrees[i]))>0);
  const alt=distinct.sort((a,b)=>b33(b).visiblePixels.length-b33(a).visiblePixels.length||a.name.localeCompare(b.name))[0];
  const ray=(label,v,source)=>{const norm=Math.max(...v.map(Math.abs));assert.ok(norm>0);return {label,source,delta:v.map(x=>x/norm)};};
  const rays=[ray('retained-area-gain',area.r.deltaDegrees,{historyIndex:area.i}),
    ray('retained-length-gain',length.r.deltaDegrees,{historyIndex:length.i}),
    ray('retained-alternate-area',alt.rotationDegrees.map((v,i)=>v-seed.rotationDegrees[i]),{consistencyName:alt.name})];
  const inputs=[prior+'native-history.jsonl',prior+'consistency.json.gz',prior+'manifest.json',
    base+'pib-boundary-92da7771/boundaries.json.gz',base+'pib-visibility-conflict.json',
    base+'ba94cb-pib-visual.json.gz',base+'pib-exact-mesh-519a686c/production-before-replay.json.gz'];
  const sources=['scripts/recover-polymer-task5-discrete-events.mjs','scripts/polymer-task5-native-projection.mjs',
    'scripts/diagnose-polymer-task5-boundaries.mjs','scripts/analyze-polymer-task5-orientation-feasibility.mjs',
    'scripts/analyze-polymer-task5-exact-mesh.mjs','tests/helpers/polymer-task5-visual.mjs',
    'src/reaction-lab-polymer-presentation.js','src/chemistry.js','vendor/three/three.module.min.js'];
  const protocol={kind:'DISCRETE_NATIVE_EVENT_CONSTRUCTION_R1',startHead:'7a88b20c58eb4cb5281e3738b3b63e2012d3817e',
    main:'593ac571e4d664f7af885855352142874dd227ab',graphDigest:frozen.graphDigest,seed:seed.rotationDegrees,rays,
    candidateCap:24,nativeFullConstraintEvaluationCap:24,evaluationsPerCandidate:1,
    independentFullFramePoseCap:6,independentModes:['legacy4','shader32','float64'],limitedGPUCap:1,
    eventSlotsPerRay:['floor j10 offset -0.5 x next integer, fixed26','ceil 26/27',
      'third retained H5-loss pixel coverage switch','joint of third area switch and floor or ceil'],
    eventPixels:'first three H5-loss pixels in retained boundary distance order; no frozen ownership preservation',
    bisectionsPerEvent:24,endpointOnlyBracketing:true,eventPredicateCap:3*5*26,
    eventPredicates:'projection-only lane floor/ceil or native H5 triangle coverage at three named points; no global raster, ownership score, solver or full constraints during construction',
    sides:'root bracket endpoints, expanded by 1e-6 ray parameter if predicate still differs; no local derivative guarantee',
    deduplication:'quaternion/position/scale serialized; also exclude all retained history and six consistency poses',
    stop:'construct at most four event pairs per ray, three retained-data-derived rays; absent bracket gives no candidate; no replacement, blind sweep, seed, solver restart or unused-budget transfer',
    gpuSelection:'first candidate with native full21/Q/fit PASS and three independent full-frame modes PASS; otherwise GPU NOT_RUN',
    limitations:['bracket is a witnessed switch, not an exhaustive event catalogue or monotonicity proof','point coverage change does not imply acquired bond33 ownership; full native predicate independently decides both sides','no infeasibility proof from rejected candidates'],
    sources:sources.map(path=>({path,sha256:hash(fs.readFileSync(path))})),inputs:inputs.map(path=>({path,sha256:hash(fs.readFileSync(path))}))};
  fs.mkdirSync(directory,{recursive:true});save('protocol.json',protocol);
  fs.writeFileSync(directory+'protocol.sha256',hash(fs.readFileSync(directory+'protocol.json'))+'\n');
  const production=read(prior+'production-identity.json').map(r=>({path:r.path,sha256:hash(fs.readFileSync(r.path))}));
  save('production-before.json',production);
  console.log(JSON.stringify({registered:true,rays,candidateGenerationStarted:false,protocolSha256:hash(fs.readFileSync(directory+'protocol.json'))}));
}

function execute(){
  const protocol=read(directory+'protocol.json');
  assert.equal(hash(fs.readFileSync(directory+'protocol.json')),fs.readFileSync(directory+'protocol.sha256','utf8').trim());
  for(const f of [...protocol.sources,...protocol.inputs])assert.equal(hash(fs.readFileSync(f.path)),f.sha256,f.path);
  assert.ok(!fs.existsSync(directory+'events.json'),'no repeated event construction');
  const boundary=packed(base+'pib-boundary-92da7771/boundaries.json.gz');
  const points=boundary.losses.slice(0,3).map(r=>r.point);
  const group=read(base+'pib-visibility-conflict.json').groups.find(g=>g.anchor===30);
  const events=[],plans=[],exclusions=[];let eventPredicateCalls=0,projectionBuilds=0;
  const retained=[...fs.readFileSync(prior+'native-history.jsonl','utf8').trim().split('\n').map(JSON.parse).map(r=>r.pose),
    ...packed(prior+'consistency.json.gz').rows.map(r=>poseAt(r.rotationDegrees).pose)];
  const seen=new Set(retained.map(p=>JSON.stringify(p)));
  for(const ray of protocol.rays){
    const cache=new Map();
    const at=t=>{if(!cache.has(t)){const rotation=seed.rotationDegrees.map((v,i)=>v+t*ray.delta[i]),p=poseAt(rotation),s=snapshot(p.pose);cache.set(t,{rotation,p,s});}return cache.get(t);};
    const lane=t=>at(t).s.visual.lanes.find(l=>l.bondIndex===34);
    const triangleCache=new Map();
    const triangles=t=>{if(!triangleCache.has(t)){const s=structuredClone(at(t).s);for(const m of s.meshes)m.visible=m.visible&&m.id===6;
      triangleCache.set(t,render(s,'legacy4',{trace:true,exactEdges:true,projectOnly:true}).triangles);projectionBuilds++;}return triangleCache.get(t);};
    const cover=(t,point)=>{const s=at(t).s;return triangles(t).some(tr=>nativeTriangle(tr,point.x,point.y,s.visual.camera.near,s.visual.camera.far)?.covered);};
    const make=(kind,fn,detail)=>{const measured=t=>{assert.ok(++eventPredicateCalls<=protocol.eventPredicateCap);return fn(t);};
      const bracket=bracketBoolean(measured,protocol.bisectionsPerEvent),e={ray:ray.label,kind,...detail,...bracket};events.push(e);return e;};
    const x0=laneSample(lane(0),10,-.5,26).x,x1=laneSample(lane(1),10,-.5,26).x;
    const integer=x1>x0?Math.floor(x0)+1:Math.ceil(x0)-1;
    const floor=make('floor-cell-switch',t=>laneSample(lane(t),10,-.5,26).x>=integer,{sample:10,offset:-.5,steps:26,axis:'x',integer,x0,x1});
    const ceil=make('ceil-step-switch',t=>Math.hypot(lane(t).b.x-lane(t).a.x,lane(t).b.y-lane(t).a.y)>13,{boundaryLength:13});
    const area=points.map((point,i)=>make('quantized-triangle-coverage-switch',t=>cover(t,point),{point,occluderId:6,requiredBondId:1057,areaPixelOrdinal:i+1}));
    // Third area event means all three named loss predicates have switched only
    // if independently observed below. It never stands in for aggregate area.
    const third=area.every(e=>e.bracketed)?area.reduce((a,b)=>a.hi>b.hi?a:b):null;
    const continuity=[floor,ceil].filter(e=>e.bracketed).sort((a,b)=>a.hi-b.hi)[0];
    const joint=third&&continuity?{kind:'joint-event-combination',ray:ray.label,bracketed:true,
      lo:Math.max(third.lo,continuity.lo),hi:Math.max(third.hi,continuity.hi),components:[...area,continuity].map(e=>({kind:e.kind,point:e.point,lo:e.lo,hi:e.hi}))}:null;
    if(joint)events.push(joint);
    for(const [slot,e] of [['floor',floor],['ceil',ceil],['area-three',third],['joint',joint]]){
      if(!e?.bracketed){exclusions.push({ray:ray.label,slot,reason:'required event endpoints do not bracket; no unrelated replacement'});continue;}
      // Root endpoints alone independently exhibit the event. Expansion avoids
      // identical transforms from a Float32 plateau; both sides are rechecked.
      const ts=[Math.max(0,e.lo-1e-6),Math.min(1,e.hi+1e-6)];
      for(let side=0;side<2;side++){
        const t=ts[side],a=at(t),key=JSON.stringify(a.p.pose);
        if(seen.has(key)){exclusions.push({ray:ray.label,slot,side,reason:'duplicate or retained pose'});continue;}seen.add(key);
        plans.push({id:plans.length+1,ray:ray.label,slot,side:side?'after':'before',t,event:e,
          rotationDegrees:a.rotation,pose:a.p.pose});
      }
    }
  }
  assert.ok(plans.length<=protocol.candidateCap);
  save('events.json',{eventPredicateCalls,projectionBuilds,events,exclusions,points});
  save('candidates.json',plans); // frozen before any full native constraint call
  let evaluations=0,fullFramePoses=0;const results=[];
  for(const plan of plans){
    const p=poseAt(plan.rotationDegrees),s=snapshot(p.pose);
    assert.ok(++evaluations<=protocol.nativeFullConstraintEvaluationCap);
    const exact=nativeConstraints(s,group,frozen.views[0].domOcclusions);
    const objects=exact.objects.map(o=>({...o,box:undefined,falseNegatives:undefined,falsePositives:undefined}));
    const row={...plan,objects,qMin:p.fit.qMin,fit:p.fit.fits,
      jointPass:exact.jointPass&&p.fit.qMin>=20&&p.fit.fits,
      eventActual:{floorX:Math.floor(laneSample(s.visual.lanes.find(l=>l.bondIndex===34),10,-.5,26).x),
        steps:objects.find(o=>o.id===1058).branch.steps},
      areaEvents:points.map(point=>{const h=exact.projection.front(6,point.x,point.y),b=exact.projection.front(1057,point.x,point.y);
        return {point,owner:exact.projection.pixel(Math.floor(point.x),Math.floor(point.y)).id,
          occluderCovered:!!h,occluderTriangle:h?.triangle,bondCovered:!!b,bondTriangle:b?.triangle,
          occluderDepth:h?.depth,bondDepth:b?.depth};}),
      rejection:objects.filter(o=>!o.pass).map(o=>({id:o.id,kind:o.kind,index:o.index,
        area:o.visiblePixels.length,required:o.required,continuous:o.branch?.continuous,
        reason:o.kind==='atom'?'atom formal visibility/dimension':'bond formal area/continuity/dimension'}))};
    if(row.jointPass&&fullFramePoses<protocol.independentFullFramePoseCap){
      fullFramePoses++;row.fullFrame=[];
      for(const mode of protocol.independentModes){const r=render(s,mode,{exactEdges:true}),bytes=png(r),g=grade(bytes,{anchor:30,snapshot:s,domOcclusions:frozen.views[0].domOcclusions});
        const file=`candidate-${plan.id}-${mode}-id.png`;fs.writeFileSync(directory+file,bytes);row.fullFrame.push({mode,file,sha256:hash(bytes),grade:g});}
      row.gpuEligible=row.fullFrame.every(m=>m.grade.jointPartialPixelPass);
    }
    results.push(row);zip('results.json.gz',{evaluations,fullFramePoses,rows:results});
    console.log(JSON.stringify({id:row.id,ray:row.ray,slot:row.slot,side:row.side,jointPass:row.jointPass,
      bonds:objects.filter(o=>o.kind==='bond'&&o.index>=32).map(o=>({index:o.index,area:o.visiblePixels.length,required:o.required,
        continuous:o.branch.continuous,steps:o.branch.steps,start:o.branch.bestStart,end:o.branch.bestEnd,pass:o.pass})),rejected:row.rejection.map(o=>o.id)}));
    if(row.gpuEligible)break;
  }
  const production=read(directory+'production-before.json').map(f=>({...f,actual:hash(fs.readFileSync(f.path))}));
  assert.ok(production.every(f=>f.sha256===f.actual));save('production-after.json',production);
  save('summary.json',{status:results.some(r=>r.gpuEligible)?'CPU_WITNESS_REQUIRES_GPU':'UNRESOLVED',
    candidatesConstructed:plans.length,evaluations,fullFramePoses,fullFrameRasters:fullFramePoses*3,
    eventPredicateCalls,projectionBuilds,GPUCalls:0,formalGPU:'0/3',certifiedExcludedRegions:0,
    productionFilesUnchanged:production.length,productionChanged:false,
    note:'Point-specific triangle coverage extraction is reported separately from full21 native constraint evaluations; no raster ownership or aggregate score used for candidate generation.'});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  assert.ok(['--register','--execute'].includes(process.argv[2]));
  if(process.argv[2]==='--register')register();else execute();
}
