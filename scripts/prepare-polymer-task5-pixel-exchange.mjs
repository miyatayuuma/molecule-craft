// Owner: docs/validation/polymer-local-fragment-task5-pixel-exchange.md.
// Offline affine candidate construction; not a visibility grader or proof.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {seed, poseAt, projectMeshes, clearance} from './diagnose-polymer-task5-boundaries.mjs';
import {snapshot, frozen} from './analyze-polymer-task5-orientation-feasibility.mjs';
import {pngPixels, maskColor} from '../tests/helpers/polymer-task5-visual.mjs';

const dir = process.argv[2];
assert.ok(dir && fs.existsSync(dir + '/protocol.json'));
assert.ok(!fs.existsSync(dir + '/model.json.gz'), 'do not repeat preparation');
const protocol = JSON.parse(fs.readFileSync(dir + '/protocol.json'));
const S = snapshot(seed.pose), models = projectMeshes(S), eps = protocol.finiteDifferenceDegrees;
const derivatives = [0,1,2].map(axis => {
  const plus = [...seed.rotationDegrees], minus = [...plus]; plus[axis] += eps; minus[axis] -= eps;
  const a = snapshot(poseAt(plus).pose), b = snapshot(poseAt(minus).pose);
  return {a,b,A:projectMeshes(a),B:projectMeshes(b)};
});
const affine = fn => ({value: fn(S), gradient: derivatives.map(d => (fn(d.a)-fn(d.b))/(2*eps))});
const extent = (f,r) => r*f.gradient.reduce((s,v)=>s+Math.abs(v),0);
const maxRadius = Math.max(...protocol.trustBoxesDegrees);
const idMask = pngPixels(fs.readFileSync(new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-boundary-92da7771/baseline-CPU-id.png', import.meta.url)));
const colorToId = new Map([[0,0],...S.meshes.map(m=>[maskColor(m.id),m.id])]);
const ids = new Uint32Array(idMask.width*idMask.height);
for(let i=0;i<ids.length;i++){const k=i*idMask.channels;ids[i]=colorToId.get((idMask.pixels[k]<<16)|(idMask.pixels[k+1]<<8)|idMask.pixels[k+2]);assert.notEqual(ids[i],undefined);}

function depthAt(model,p){
  let z=Infinity;
  for(const t of model.triangles){
    if(t.culled||Math.abs(t.den)<1e-12)continue;
    const {a,b,c,den}=t,u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/den;
    const v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/den;
    const w=((a.y-b.y)*(p.x-b.x)+(b.x-a.x)*(p.y-b.y))/den;
    if(Math.min(u,v,w)>=0)z=Math.min(z,1/(u/a.depth+v/b.depth+w/c.depth));
  }return z;
}
const scalarCache = new Map();
function hullAffine(id,p,sign){
  const key=[id,p.x,p.y,sign].join(':');if(scalarCache.has(key))return scalarCache.get(key);
  const value=sign*clearance(models[id].hull,p);
  const gradient=derivatives.map(d=>sign*(clearance(d.A[id].hull,p)-clearance(d.B[id].hull,p))/(2*eps));
  const f={key,id,point:p,sign,value,gradient};scalarCache.set(key,f);return f;
}
function underRect(p){return frozen.views[0].domOcclusions.rectangles.some(r=>p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom);}
function onAnnotation(p){return frozen.views[0].domOcclusions.circles.some(c=>Math.abs(Math.hypot(p.x-c.x,p.y-c.y)-c.radius)<=c.stroke/2);}
const objects=[];
for(const target of [...seed.grade.atoms.map(a=>({id:a.index+1,index:a.index,kind:'atom'})),...seed.grade.bonds.map(b=>({id:1024+b.index,index:b.index,kind:'bond'}))]){
  const model=models[target.id],localVertices=model.hull;
  // Finite proposal pool, padded by the largest affine vertex displacement.
  // This is not claimed to enclose the true nonlinear projection over the box.
  const allHulls=[model.hull,...derivatives.flatMap(d=>[d.A[target.id].hull,d.B[target.id].hull])];
  const xs=localVertices.map(p=>p.x),ys=localVertices.map(p=>p.y);
  const move=Math.max(3,...derivatives.flatMap(d=>['x','y'].map(k=>maxRadius*Math.max(...d.A[target.id].hull.map(p=>p[k]))-maxRadius*Math.max(...d.B[target.id].hull.map(p=>p[k])))).map(v=>Math.abs(v)/(2*eps)))+2;
  assert.ok(Number.isFinite(move));
  const box={left:Math.max(0,Math.floor(Math.min(...xs)-move)),right:Math.min(idMask.width-1,Math.ceil(Math.max(...xs)+move)),top:Math.max(0,Math.floor(Math.min(...ys)-move)),bottom:Math.min(idMask.height-1,Math.ceil(Math.max(...ys)+move))};
  const cells=[];
  for(let y=box.top;y<=box.bottom;y++)for(let x=box.left;x<=box.right;x++){
    const p={x:x+.5,y:y+.5};if(underRect(p))continue;
    const own=hullAffine(target.id,p,-1);
    if(own.value+extent(own,maxRadius)<protocol.proposalClearancePixels)continue;
    const conditions=[own],targetDepth=depthAt(model,p),depth=Number.isFinite(targetDepth)?targetDepth:(model.minDepth+model.maxDepth)/2;
    let impossible=false;
    for(const blocker of Object.values(models)){
      if(blocker.id===target.id||blocker.minDepth>model.maxDepth)continue;
      const outside=hullAffine(blocker.id,p,1);
      if(outside.value-extent(outside,maxRadius)>2)continue;
      const blockerDepth=depthAt(blocker,p);
      // Depth assignment is frozen locally. New depth-order switches, facet
      // changes and overlapping endpoint surfaces are checked by full raster.
      const front=Number.isFinite(blockerDepth)?blockerDepth<depth-1e-7:blocker.maxDepth<model.minDepth||(blocker.minDepth+blocker.maxDepth)/2<depth;
      if(!front)continue;
      if(outside.value+extent(outside,maxRadius)<protocol.proposalClearancePixels){impossible=true;break;}
      conditions.push(outside);
    }
    if(!impossible)cells.push({x,y,seedOwner:ids[y*idMask.width+x],annotationBoundary:onAnnotation(p),conditions});
  }
  const required=target.kind==='atom'?affine(s=>.6*Math.PI*s.visual.atoms[target.index].radius**2):affine(s=>{const l=s.visual.lanes.find(l=>l.bondIndex===target.index);return Math.hypot(l.b.x-l.a.x,l.b.y-l.a.y)*l.radius;});
  const seedCount=ids.reduce((s,id)=>s+(id===target.id),0);
  objects.push({...target,box,move,required,seedCount,cells});
}

function laneSamples(bondIndex,n){
  const length=affine(s=>{const l=s.visual.lanes.find(l=>l.bondIndex===bondIndex);return Math.hypot(l.b.x-l.a.x,l.b.y-l.a.y);});
  const samples=[];
  for(let j=0;j<=n;j++)for(const k of [-.5,0,.5]){
    const point=s=>{const l=s.visual.lanes.find(l=>l.bondIndex===bondIndex),dx=l.b.x-l.a.x,dy=l.b.y-l.a.y,L=Math.hypot(dx,dy);return{x:l.a.x+dx*j/n-k*dy/L,y:l.a.y+dy*j/n+k*dx/L};};
    samples.push({j,k,x:affine(s=>point(s).x),y:affine(s=>point(s).y)});
  }return{n,length,samples};
}
const continuity=[32,34].map(index=>{
  const length=affine(s=>{const l=s.visual.lanes.find(l=>l.bondIndex===index);return Math.hypot(l.b.x-l.a.x,l.b.y-l.a.y);});
  const range=[length.value-extent(length,maxRadius),length.value+extent(length,maxRadius)];
  const steps=index===34?protocol.bond34StepBranches:Array.from({length:Math.ceil(2*range[1])-Math.ceil(2*range[0])+1},(_,i)=>Math.ceil(2*range[0])+i);
  return {index,range,branches:steps.map(n=>laneSamples(index,n))};
});
const events={bond33:objects.find(o=>o.kind==='bond'&&o.index===33).cells.filter(c=>c.seedOwner!==1057).map(c=>({x:c.x,y:c.y,seedOwner:c.seedOwner,conditions:c.conditions.filter(f=>f.value<0)})),bond34:continuity.find(c=>c.index===34),aggregateSeedMargins:objects.map(o=>({kind:o.kind,index:o.index,rawSeedPixels:o.seedCount,required:o.required.value,rawSeedSurplus:o.seedCount-o.required.value,variableCellCount:o.cells.filter(c=>c.conditions.some(f=>f.value-extent(f,maxRadius)<protocol.proposalClearancePixels)).length}))};
const model={protocol,seed:seed.rotationDegrees,graphDigest:frozen.graphDigest,objects,continuity,scalarCount:scalarCache.size,limits:protocol.limits};
fs.writeFileSync(dir+'/model.json.gz',gzipSync(JSON.stringify(model)+'\n'));
fs.writeFileSync(dir+'/events.json.gz',gzipSync(JSON.stringify(events)+'\n'));
console.log(JSON.stringify({objects:objects.length,cells:objects.reduce((s,o)=>s+o.cells.length,0),continuity:continuity.map(c=>({index:c.index,range:c.range,branches:c.branches.map(b=>b.n)})),scalarCount:scalarCache.size}));
