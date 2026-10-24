// Owner: docs/validation/polymer-local-fragment-task5-conflict-isolation.md.
// Retained nonzero observations and masks only. No solver or new raster.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three/three.module.min.js';
import {poseAt,seed,convexHull,clearance} from './diagnose-polymer-task5-boundaries.mjs';
import {snapshot} from './analyze-polymer-task5-orientation-feasibility.mjs';
import {render,grade} from './analyze-polymer-task5-exact-mesh.mjs';
import {pngPixels,maskColor,rasterLayers} from '../tests/helpers/polymer-task5-visual.mjs';

const root='docs/validation/polymer-local-fragment-task5-evidence/recovery/';
const out=process.argv[2];assert.ok(out);
assert.ok(!fs.existsSync(out+'/native-audit.json.gz'),'no audit overwrite');
const read=p=>JSON.parse(gunzipSync(fs.readFileSync(root+p)));
const model=read('pib-active-constraints-8227174d/active-model.json.gz');
const retained=read('pib-boundary-92da7771/results.json.gz');
const saved=read('pib-exact-mesh-519a686c/boundary-30-0.json.gz');
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const protocol={kind:'RETAINED_NATIVE_DISCRIMINATION_NO_SEARCH',
  aggregateCases:'all12 retained boundary candidate legacy4 grades; no re-evaluation',
  maskCases:['retained baseline CPU mask','retained boundary-30-0 actual GPU mask'],
  facetCases:'seed and retained boundary-30-0 only; projection-only, no pixel raster loops',
  probeCapPerObject:12,solverCalls:0,newCPURasters:0,newGPUCalls:0,
  frozenFiles:[import.meta.filename,root+'pib-active-constraints-8227174d/active-model.json.gz',root+'pib-boundary-92da7771/results.json.gz',root+'pib-exact-mesh-519a686c/boundary-30-0.json.gz',root+'pib-exact-mesh-519a686c/boundary-30-0-id.png'].map(path=>({path,sha256:sha(path)}))};
fs.writeFileSync(out+'/native-protocol.json',JSON.stringify(protocol,null,2)+'\n');
const affine=(f,d)=>f.value+f.gradient.reduce((s,g,i)=>s+g*d[i],0);
const delta=r=>r.map((v,i)=>v-model.seed[i]);
const eligible=(o,d)=>new Set(o.cells.filter(c=>!c.annotationBoundary&&c.conditions.every(f=>affine(f,d)>=0)&&c.disjunctions.every(cl=>cl.some(f=>affine(f,d)>=0))).map(c=>c.x+','+c.y));
function continuity(c,d,pixels){
 const length=affine(c.branches[0].length,d),n=Math.ceil(2*length),b=c.branches.find(b=>b.n===n);
 if(!b)return{length,steps:n,represented:false};
 const hits=Array.from({length:n+1},(_,j)=>b.samples.filter(s=>s.j===j).some(s=>pixels.has(Math.floor(affine(s.x,d))+','+Math.floor(affine(s.y,d)))));
 let best=0,run=0;for(const h of hits){run=h?run+1:0;best=Math.max(best,run);}
 return{length,steps:n,represented:true,continuous:Math.max(0,best-1)*length/n,hits};
}
const aggregate=retained.rows.map(row=>{
 const obs=row.observations.find(o=>o.precision==='legacy4'),d=delta(row.rotationDegrees),S=snapshot(obs.pose);
 return{name:row.name,rotationDegrees:row.rotationDegrees,deltaDegrees:d,objects:model.objects.map(o=>{
  const p=eligible(o,d),actual=o.kind==='bond'?obs.grade.bonds.find(b=>b.index===o.index):obs.grade.atoms.find(a=>a.index===o.index);
  const pixels=o.kind==='bond'?actual.visiblePixels:actual.visibleFraction*Math.PI*S.visual.atoms[o.index].radius**2;
  const c=model.continuity.find(c=>c.index===o.index&&o.kind==='bond');
  return{id:o.id,modelPixels:p.size,nativePixels:pixels,areaError:p.size-pixels,modelRequired:affine(o.required,d),
   nativeRequired:o.kind==='bond'?actual.requiredPixels:.60*Math.PI*S.visual.atoms[o.index].radius**2,
   modelContinuity:c?continuity(c,d,p):null,nativeContinuity:actual.continuous??null};
 })};
});

// The nearest retained actual pose is in the frozen component box. Other
// captured poses are intentionally not extrapolated into this local model.
const ref=read('pib-orientation-6a2f056a/decomposition.json.gz').rows.find(r=>r.anchor===30).pose;
const q=new T.Quaternion(...saved.pose.quaternion).multiply(new T.Quaternion(...ref.quaternion).invert());
if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);
const angle=2*Math.acos(Math.max(-1,Math.min(1,q.w))),den=Math.sin(angle/2);
const rotation=den<1e-12?[0,0,0]:[q.x,q.y,q.z].map(v=>v/den*angle*180/Math.PI),d=delta(rotation);
assert.ok(d.every(v=>Math.abs(v)<=1));
const reconstructed=poseAt(rotation).pose;
assert.ok(Math.max(...saved.pose.position.map((v,i)=>Math.abs(v-reconstructed.position[i])))<1e-10);
assert.ok(Math.abs(saved.pose.scale-reconstructed.scale)<1e-10);
const triangles=S=>{const ts=render(S,'legacy4',{trace:true,exactEdges:true,projectOnly:true}).triangles;
 return new Map([...new Set(ts.map(t=>t.id))].map(id=>[id,ts.filter(t=>t.id===id)]));};
const atSeed=triangles(snapshot(seed.pose)),atActual=triangles(saved.snapshot);
const front=(ts,p)=>{let best=null;for(const t of ts){if(t.culled||Math.abs(t.den)<1e-12)continue;
 const {a,b,c,den}=t,u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/den,v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/den,w=((a.y-b.y)*(p.x-b.x)+(b.x-a.x)*(p.y-b.y))/den;
 if(Math.min(u,v,w)<0)continue;
 const r=Math.fround,D=r(1/r(r(b.x-a.x)*r(c.y-a.y)-r(c.x-a.x)*r(b.y-a.y))),za=r(b.ndc-a.ndc),zb=r(c.ndc-a.ndc),DA=r(r(r(c.y-a.y)*za-r(b.y-a.y)*zb)*D),DB=r(r(r(b.x-a.x)*zb-r(c.x-a.x)*za)*D),z=r(r(DA*r(p.x-a.x)+DB*r(p.y-a.y))+a.ndc);
 if(!best||z<=best.depth)best={triangle:t.triangle,depth:z};}return best;};
const bytes=fs.readFileSync(root+'pib-exact-mesh-519a686c/boundary-30-0-id.png'),mask=pngPixels(bytes);
const layers=rasterLayers(bytes,{canvas:saved.snapshot.visual.canvas,lanes:saved.snapshot.visual.lanes,domOcclusions:saved.domOcclusions});
const ids=new Map([[0,0],...saved.snapshot.meshes.map(m=>[maskColor(m.id),m.id])]);
const actualSets=new Map(model.objects.map(o=>[o.id,new Set()]));
for(let i=0;i<mask.width*mask.height;i++){const j=i*mask.channels,id=ids.get((mask.pixels[j]<<16)|(mask.pixels[j+1]<<8)|mask.pixels[j+2]);if(actualSets.has(id))actualSets.get(id).add(i%mask.width+','+Math.floor(i/mask.width));}
const masks=model.objects.map(o=>{
 const predicted=eligible(o,d),actual=actualSets.get(o.id),pool=new Map(o.cells.map(c=>[c.x+','+c.y,c]));
 const missing=[...actual].filter(p=>!predicted.has(p)),extra=[...predicted].filter(p=>!actual.has(p));
 const probes=missing.slice(0,protocol.probeCapPerObject).map(pixel=>{
  const [x,y]=pixel.split(',').map(Number),p={x:x+.5,y:y+.5},cell=pool.get(pixel);
  const inspect=f=>{const isDepth=f.key.startsWith('depth:'),blocker=isDepth?Number(f.key.split(':')[1]):f.id;
   const target=front(atActual.get(o.id),p),other=front(atActual.get(blocker),p),seedTarget=front(atSeed.get(o.id),p),seedOther=front(atSeed.get(blocker),p);
   return{key:f.key,affineValue:affine(f,d),nativeHullValue:!isDepth?f.sign*clearance(convexHull(atActual.get(blocker).flatMap(t=>[t.a,t.b,t.c])),p):null,
    target,other,seedTarget,seedOther,frontFacetChanged:(target?.triangle??null)!==(seedTarget?.triangle??null)||(other?.triangle??null)!==(seedOther?.triangle??null),
    targetInFront:!!target&&(!other||target.depth<other.depth)};};
  return{pixel,inPool:!!cell,rejectedConditions:cell?.conditions.filter(f=>affine(f,d)<0).map(inspect)??[],
   rejectedOR:cell?.disjunctions.filter(cl=>cl.every(f=>affine(f,d)<0)).map(cl=>cl.map(inspect))??[]};
 });
 return{id:o.id,predicted:predicted.size,actualRaw:actual.size,actualFormal:layers.counts.get(maskColor(o.id))??0,
  falseNegatives:missing,falsePositives:extra,poolMissing:[...actual].filter(p=>!pool.has(p)),probes};
});
const floor=retained.rows.map(row=>{
 const obs=row.observations.find(o=>o.precision==='legacy4'),S=snapshot(obs.pose),d=delta(row.rotationDegrees);
 return{name:row.name,rows:model.continuity.map(c=>{
  const lane=S.visual.lanes.find(l=>l.bondIndex===c.index),dx=lane.b.x-lane.a.x,dy=lane.b.y-lane.a.y,L=Math.hypot(dx,dy),n=Math.ceil(2*L),b=c.branches.find(b=>b.n===n);
  if(!b)return{index:c.index,n,represented:false};
  const mismatches=b.samples.filter(s=>Math.floor(affine(s.x,d))!==Math.floor(lane.a.x+dx*s.j/n-s.k*dy/L)||Math.floor(affine(s.y,d))!==Math.floor(lane.a.y+dy*s.j/n+s.k*dx/L));
  return{index:c.index,n,represented:true,affineSteps:Math.ceil(2*affine(b.length,d)),floorMismatches:mismatches.length,samples:b.samples.length};
 })};
});
const result={protocol,aggregate,floor,actualMask:{name:saved.name,rotationDegrees:rotation,deltaDegrees:d,grade:grade(bytes,saved),objects:masks},
 newCPURasters:0,newGPUCalls:0,newCandidatePoses:0,
 limits:['Retained GPU mask is an independent raster with GPU/legacy4 differences, not an exact CPU equality oracle.',
  'Aggregate12 comparisons use retained native CPU grades; no new masks were rendered.',
  'Boundary probes inspect selected native facets, never prove existence or exclusion of any orientation.',
  'A per-object false negative is not a full21-target joint feasible witness.']};
fs.writeFileSync(out+'/native-audit.json.gz',gzipSync(JSON.stringify(result)+'\n'));
console.log(JSON.stringify({aggregate:aggregate.map(r=>({name:r.name,errors:r.objects.map(o=>({id:o.id,areaError:o.areaError,modelContinuous:o.modelContinuity?.continuous,nativeContinuous:o.nativeContinuity}))})),actualMask:{deltaDegrees:d,objects:masks.map(o=>({id:o.id,falseNegatives:o.falseNegatives.length,falsePositives:o.falsePositives.length,poolMissing:o.poolMissing.length}))},floor}));
