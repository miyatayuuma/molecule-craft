// Owner: docs/validation/polymer-local-fragment-task5-model-consistency.md.
// Minimal local proposal model. Quantized seed constants, raw local derivatives;
// depth-order OR silhouette conditions. Not an interval proof or formal oracle.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {seed,poseAt,projectMeshes,convexHull,clearance} from './diagnose-polymer-task5-boundaries.mjs';
import {snapshot,frozen} from './analyze-polymer-task5-orientation-feasibility.mjs';
import {render} from './analyze-polymer-task5-exact-mesh.mjs';
const root='docs/validation/polymer-local-fragment-task5-evidence/recovery/';
const out=process.argv[2];assert.ok(out&&fs.existsSync(out+'/protocol.json'));
assert.ok(!fs.existsSync(out+'/active-model.json.gz'),'no preparation overwrite');
const protocol=JSON.parse(fs.readFileSync(out+'/protocol.json'));
const old=JSON.parse(gunzipSync(fs.readFileSync(root+'pib-pixel-exchange-a664c1da/model.json.gz')));
const audit=JSON.parse(fs.readFileSync(root+'pib-model-consistency-8227174d/seed-consistency.json'));assert.ok(audit.knownStateRepresentable);
const S=snapshot(seed.pose),raw=projectMeshes(S),triangles=render(S,'legacy4',{trace:true,exactEdges:true,projectOnly:true}).triangles;
const quant=Object.fromEntries(Object.values(raw).map(m=>{const ts=triangles.filter(t=>t.id===m.id);return[m.id,{...m,triangles:ts,hull:convexHull(ts.flatMap(t=>[t.a,t.b,t.c]))}];}));
const eps=.01,derivatives=[0,1,2].map(axis=>{const a=[...seed.rotationDegrees],b=[...a];a[axis]+=eps;b[axis]-=eps;return{A:projectMeshes(snapshot(poseAt(a).pose)),B:projectMeshes(snapshot(poseAt(b).pose))};});
function triangleDepth(t,p,ndc=false){const {a,b,c,den}=t;if(t.culled||Math.abs(den)<1e-12)return null;const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/den,v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/den,w=((a.y-b.y)*(p.x-b.x)+(b.x-a.x)*(p.y-b.y))/den;if(Math.min(u,v,w)<0)return null;if(!ndc)return 1/(u/a.depth+v/b.depth+w/c.depth);const r=Math.fround,D=r(1/r(r(b.x-a.x)*r(c.y-a.y)-r(c.x-a.x)*r(b.y-a.y))),za=r(b.ndc-a.ndc),zb=r(c.ndc-a.ndc),DA=r(r(r(c.y-a.y)*za-r(b.y-a.y)*zb)*D),DB=r(r(r(b.x-a.x)*zb-r(c.x-a.x)*za)*D);return r(r(DA*r(p.x-a.x)+DB*r(p.y-a.y))+a.ndc);}
function front(model,p){let best=null;for(let i=0;i<model.triangles.length;i++){const t=model.triangles[i],z=triangleDepth(t,p,!!t.a.ndc);if(z!==null&&(!best||z<=best.z))best={i,z,t};}return best;}
const hullCache=new Map();
function hull(id,p,sign){const key=[id,p.x,p.y,sign].join(':');if(hullCache.has(key))return hullCache.get(key);const f={key,id,point:p,sign,value:sign*clearance(quant[id].hull,p),gradient:derivatives.map(d=>sign*(clearance(d.A[id].hull,p)-clearance(d.B[id].hull,p))/(2*eps))};hullCache.set(key,f);return f;}
// A blocker may overlap a target silhouette while its front surface is behind
// the target. The old model prohibited overlap after freezing "front" once.
// Approximate depth planes are used only when both surfaces cover the seed cell;
// elsewhere the conservative silhouette proposal remains, checked by full mesh.
const corrections=[];
const objects=old.objects.filter(o=>protocol.activeObjectIds.includes(o.id)).map(o=>{
 const cells=[];
 for(const c of o.cells){const p={x:c.x+.5,y:c.y+.5},own=hull(o.id,p,-1),conditions=[own],disjunctions=[],target=front(quant[o.id],p);
  for(const blockerModel of Object.values(quant)){
   if(blockerModel.id===o.id||blockerModel.minDepth>quant[o.id].maxDepth)continue;
   const oldF={id:blockerModel.id},outside=hull(oldF.id,p,1);
   if(outside.value-protocol.trustBoxesDegrees[0]*outside.gradient.reduce((s,v)=>s+Math.abs(v),0)>2)continue;
   const blocker=front(blockerModel,p);
   if(target&&blocker){const depth=blocker.z-target.z;
    // Pixel-depth decision at the seed comes from the exact same native
    // triangle/Float32 plane arithmetic as the retained legacy4 raster.
    // Smooth reciprocal-depth gradients use the same selected native facets.
    // NDC and camera-depth have different units; convert local derivatives by
    // camera projection dz_ndc/dz at the two selected front surfaces.
    const near=S.visual.camera.near,far=S.visual.camera.far,K=far*near/(far-near);
    const grads=derivatives.map(d=>{const f=models=>{const a=trianglePlane(models[oldF.id].triangles[blocker.i],p),b=trianglePlane(models[o.id].triangles[target.i],p);return K*(1/b-1/a);};return(f(d.A)-f(d.B))/(2*eps);});
    if(grads.every(Number.isFinite))disjunctions.push([outside,{key:`depth:${oldF.id}:${o.id}:${c.x}:${c.y}`,value:1e6*(depth-(S.meshes.findIndex(m=>m.id===oldF.id)>S.meshes.findIndex(m=>m.id===o.id)?1e-10:0)),gradient:grads.map(g=>1e6*g)}]);else conditions.push(outside);
   }else if(blockerModel.maxDepth<quant[o.id].minDepth||(blockerModel.minDepth+blockerModel.maxDepth)/2<(quant[o.id].minDepth+quant[o.id].maxDepth)/2)conditions.push(outside);
  }
  // Annotation edges underneath model silhouettes are not erased by the
  // formal visibility layer. Keep the formal seed decision, not every circle.
  const annotationBoundary=c.annotationBoundary&&!frozen.views[0].domOcclusions.modelOccluders.some(m=>{if(m.kind==='atom')return Math.hypot(p.x-m.x,p.y-m.y)<=m.radius;const dx=m.b.x-m.a.x,dy=m.b.y-m.a.y,n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((p.x-m.a.x)*dx+(p.y-m.a.y)*dy)/n)):0;return Math.hypot(p.x-m.a.x-t*dx,p.y-m.a.y-t*dy)<=m.width/2;});
  const cell={...c,annotationBoundary,conditions,disjunctions};
  const oldVisible=!c.annotationBoundary&&c.conditions.every(f=>f.value>=.005),visible=!annotationBoundary&&conditions.every(f=>f.value>=0)&&disjunctions.every(d=>d.some(f=>f.value>=0));
  if(oldVisible!==visible)corrections.push({id:o.id,x:c.x,y:c.y,savedOwner:c.seedOwner,oldVisible,visible});cells.push(cell);
 }
 return{...o,cells};
});
function trianglePlane(t,p){const {a,b,c,den}=t;if(Math.abs(den)<1e-12)return NaN;const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/den,v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/den,w=1-u-v;return 1/(u/a.depth+v/b.depth+w/c.depth);}
const model={...old,protocol:{...old.protocol,...protocol,proposalClearancePixels:0},objects,continuity:old.continuity,corrections,limits:['Native legacy4 hull/Float32 depth intercepts match seed; derivatives are local raw affine approximations.','Finite old screen pool; no safe exclusion claim.','Depth disjunction uses selected front facets, not all changing facets.','Other16 objects omitted only in proposal; full21-target native oracle mandatory.']};
const consistency=objects.map(o=>{const eligible=o.cells.filter(c=>!c.annotationBoundary&&c.conditions.every(f=>f.value>=0)&&c.disjunctions.every(d=>d.some(f=>f.value>=0)));return{id:o.id,seedCount:o.seedCount,predicted:eligible.length,falseNegatives:o.cells.filter(c=>c.seedOwner===o.id&&!eligible.includes(c)).map(c=>[c.x,c.y]),falsePositives:eligible.filter(c=>c.seedOwner!==o.id).map(c=>[c.x,c.y,c.seedOwner])};});
fs.writeFileSync(out+'/active-model.json.gz',gzipSync(JSON.stringify(model)+'\n'));
fs.writeFileSync(out+'/active-seed-membership.json',JSON.stringify({consistency,corrections,projectionOnly:true,newCPURasters:0},null,2)+'\n');
console.log(JSON.stringify({consistency,corrections:corrections.length,cells:objects.reduce((s,o)=>s+o.cells.length,0)}));
