// Owner: docs/validation/polymer-local-fragment-task5-boundary-recovery.md.
// One frozen, finite boundary experiment; never production or RAF code.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {gunzipSync, gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as T from '../vendor/three/three.module.min.js';
import {frozen, snapshot, inputFor} from './analyze-polymer-task5-orientation-feasibility.mjs';
import {render, png, grade} from './analyze-polymer-task5-exact-mesh.mjs';
import {fitPolymerObservation} from '../src/reaction-lab-polymer-presentation.js';
import {evaluateCoupledMesh} from './polymer-task5-coupled-mesh-oracle.mjs';
import {pngPixels,maskColor} from '../tests/helpers/polymer-task5-visual.mjs';

const root = new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/', import.meta.url);
const previous = JSON.parse(gunzipSync(fs.readFileSync(new URL('pib-coupled-6d508e75/result.json.gz', root))));
export const seed = previous.best;
const ref = JSON.parse(gunzipSync(fs.readFileSync(new URL('pib-orientation-6a2f056a/decomposition.json.gz', root)))).rows.find(r => r.anchor === 30);
const sha = b => createHash('sha256').update(b).digest('hex');

export function poseAt(rotationDegrees) {
  const v = new T.Vector3(...rotationDegrees).multiplyScalar(Math.PI / 180);
  const q = new T.Quaternion();
  if (v.length()) q.setFromAxisAngle(v.clone().normalize(), v.length());
  q.multiply(new T.Quaternion(...ref.pose.quaternion));
  const fit = fitPolymerObservation(T, {...inputFor(30), quaternion:q, requiredAtomIndices:[], requiredBondIndices:[]});
  return {fit, pose:{quaternion:q.toArray(),position:fit.position,scale:fit.scale}};
}

export function convexHull(points) {
  const p = [...new Map(points.map(p => [p.x+','+p.y,p])).values()].sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross = (o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const half = arr => {const h=[];for(const q of arr){while(h.length>=2&&cross(h.at(-2),h.at(-1),q)<=0)h.pop();h.push(q);}return h;};
  return [...half(p).slice(0,-1),...half([...p].reverse()).slice(0,-1)];
}

// Positive = outside the projected convex native mesh. Faceted spheres and
// cylinders are convex; hull boundaries are native vertices, not smooth radii.
export function clearance(hull,p) {
  return Math.max(...hull.map((a,i)=>{const b=hull[(i+1)%hull.length];return ((b.y-a.y)*(p.x-a.x)-(b.x-a.x)*(p.y-a.y))/Math.hypot(b.x-a.x,b.y-a.y);}));
}

export function projectMeshes(s) {
  const inv = new T.Matrix4().fromArray(s.visual.camera.matrix).invert();
  const P = new T.Matrix4().fromArray(s.visual.camera.projection), W=s.visual.canvas.bufferWidth,H=s.visual.canvas.bufferHeight;
  return Object.fromEntries(s.meshes.filter(m=>m.visible).map(m=>{
    const M=inv.clone().multiply(new T.Matrix4().fromArray(m.matrixWorld)),g=s.geometries[m.geometry],vertices=[];
    for(let i=0;i<g.positions.length;i+=3){const p=new T.Vector3(...g.positions.slice(i,i+3)).applyMatrix4(M),q=p.clone().applyMatrix4(P);vertices.push({x:(q.x+1)*W/2,y:(1-q.y)*H/2,depth:-p.z});}
    const triangles=[];for(let k=0;k<g.indices.length;k+=3){const [a,b,c]=g.indices.slice(k,k+3).map(i=>vertices[i]),den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);triangles.push({id:m.id,a,b,c,den,culled:m.materialSide===0&&den>=0||m.materialSide===1&&den<=0});}
    return [m.id,{id:m.id,kind:m.kind,index:m.index,hull:convexHull(vertices),triangles,minDepth:Math.min(...vertices.map(p=>p.depth)),maxDepth:Math.max(...vertices.map(p=>p.depth))}];
  }));
}

function atTriangle(t,p) {
  const {a,b,c,den}=t;if(t.culled||Math.abs(den)<1e-12)return null;
  const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/den;
  const v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/den;
  const w=((a.y-b.y)*(p.x-b.x)+(b.x-a.x)*(p.y-b.y))/den;
  if(Math.min(u,v,w)<0)return null;
  return 1/(u/a.depth+v/b.depth+w/c.depth);
}

// The two probes at +/- .01deg only project meshes. They do not rasterize,
// optimize a score, select additional candidates, or establish interval bounds.
export function deriveBoundaries(full,endpoints,models,derivatives) {
  const W=full.width,triangles=new Map();
  for(const m of Object.values(models))triangles.set(m.id,m.triangles);
  const depthAt=(id,p)=>Math.min(...(triangles.get(id)??[]).map(t=>atTriangle(t,p)).filter(x=>x!==null));
  const features=new Map();
  function feature(objectId,p,sign,role,threshold=null){
    const key=[objectId,p.x,p.y,sign,role].join(':');if(features.has(key))return key;
    const f=m=>sign*clearance(m[objectId].hull,p),value=f(models);
    const gradient=derivatives.map(({plus,minus})=>(f(plus)-f(minus))/.02);
    features.set(key,{key,objectId,point:p,sign,role,value,gradient,threshold:threshold??Math.min(value-.04,.02)});return key;
  }
  function ensureVisible(id,p,role,guard=false){
    const keys=[feature(id,p,-1,role+':cylinder',guard?null:.08)],z=depthAt(id,p);
    // Silhouette exclusions are imposed only for objects whose front surface
    // is in front of this cylinder at this pixel, or disjoint depth envelopes
    // establish it is closer. Other depth changes are tested by the full raster.
    for(const m of Object.values(models))if(m.id!==id){const dz=depthAt(m.id,p),c=clearance(m.hull,p);
      if(c<3&&(dz<z-1e-7||m.maxDepth<models[id].minDepth))keys.push(feature(m.id,p,1,role+':occluder',guard?null:.08));
    }
    return keys;
  }
  const losses=[];
  for(let i=0;i<full.ids.length;i++)if(endpoints.ids[i]===1057&&full.ids[i]===6){
    const p={x:i%W+.5,y:Math.floor(i/W)+.5};losses.push({point:p,owner:6,distance:-clearance(models[6].hull,p),keys:ensureVisible(1057,p,'gain33')});
  }
  losses.sort((a,b)=>a.distance-b.distance||a.point.y-b.point.y||a.point.x-b.point.x);
  const guards=[];
  for(const id of [1056,1057,1059])for(let i=0;i<full.ids.length;i++)if(full.ids[i]===id)guards.push(...ensureVisible(id,{x:i%W+.5,y:Math.floor(i/W)+.5},'retain'+(id-1024),true));
  const lane=full.snapshot.visual.lanes.find(l=>l.bondIndex===34),dx=lane.b.x-lane.a.x,dy=lane.b.y-lane.a.y,L=Math.hypot(dx,dy),steps=Math.ceil(L*2),samples=[];
  for(let j=0;j<=steps;j++){
    const pixels=[-.5,0,.5].map(k=>{const x=lane.a.x+dx*j/steps-k*dy/L,y=lane.a.y+dy*j/steps+k*dx/L,p={x:Math.floor(x)+.5,y:Math.floor(y)+.5};return{...p,owner:full.ids[Math.floor(p.y)*W+Math.floor(p.x)],offset:k};});
    samples.push({j,t:j/steps,pixels,hit:pixels.some(p=>p.owner===1058)});
  }
  let best={start:0,end:-1},start=0;
  for(let j=0;j<samples.length;j++){if(!samples[j].hit)start=j+1;else if(j-start>best.end-best.start)best={start,end:j};}
  const retain34=[];
  for(let j=best.start;j<=best.end;j++){const p=samples[j].pixels.find(p=>p.owner===1058);retain34.push(...ensureVisible(1058,{x:p.x,y:p.y},'retain34',true));}
  const extensions=[];
  // One extra half-pixel sample on either side spans the recorded deficit.
  for(const [side,j] of [['start',best.start-1],['end',best.end+1]]){
    if(j<0||j>=samples.length){
      // At a trimmed cylinder end there is no additional in-lane sample.
      // Derive the other boundary direction from projected native lane length,
      // with the retained number of run intervals. This is only a linearized
      // construction; changed ceil(length*2) is always decided by the raster.
      const key='lane34:length',value=L,gradient=derivatives.map(({plusSnapshot,minusSnapshot})=>{
        const length=s=>{const l=s.visual.lanes.find(l=>l.bondIndex===34);return Math.hypot(l.b.x-l.a.x,l.b.y-l.a.y);};return(length(plusSnapshot)-length(minusSnapshot))/.02;
      });
      features.set(key,{key,objectId:1058,role:'extend34:'+side+':length',value,gradient,threshold:7.75*steps/(best.end-best.start)+.10});
      extensions.push({side,j:null,kind:'projected-cylinder-end-displacement',keys:[key]});continue;
    }
    const choices=samples[j].pixels.map(p=>({point:{x:p.x,y:p.y},owner:p.owner,clearance:Math.min(-clearance(models[1058].hull,p),...([36,33].map(id=>clearance(models[id].hull,p))))})).sort((a,b)=>b.clearance-a.clearance);
    extensions.push({side,j,...choices[0],keys:ensureVisible(1058,choices[0].point,'extend34:'+side)});
  }
  return {features:[...features.values()],losses,guards:[...new Set([...guards,...retain34])],continuity:{lane,length:L,steps,best,runLength:(best.end-best.start)*L/steps,samples,extensions},assumptions:['Fixed screen-cell retention is a conservative local construction, not a necessary condition for feasible poses.','Raw convex native-mesh silhouette linearization omits depth switches and subpixel rules. Exact full-graph raster decides every candidate.','No cell or SO(3) region is excluded by a failed linearization.']};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const dir='test-results/pib-boundary-92da7771',resume=process.argv.includes('--resume-preparation');
  if(resume){assert.ok(fs.existsSync(dir+'/baseline-CPU-id.png')&&!fs.existsSync(dir+'/candidates.json'),'only resume preparation before any candidate evaluation');}
  else {assert.ok(!fs.existsSync(dir),'experiment already exists; do not rerun');fs.mkdirSync(dir,{recursive:true});}
  const save=(name,value)=>fs.writeFileSync(dir+'/'+name+'.json.gz',gzipSync(JSON.stringify(value)+'\n'));
  const protocol={kind:'ONE_FINITE_NATIVE_BOUNDARY_DIAGNOSIS_NOT_ACCEPTANCE',sourceSha:'92da7771cb3f17930d3163236fd042bbd1499d85',main:'593ac571e4d664f7af885855352142874dd227ab',seedRotationDegrees:seed.rotationDegrees,anchor:30,candidateCount:12,areaPixelSets:[4,8,12],continuityExtensions:['start','end'],trustRadiiDegrees:[1,4],projectedDerivativeDegrees:.01,CPURasterCap:38,CPURasterAllocation:{baselineFullTrace:1,baselineEndpoints33:1,candidates:36},arithmeticModes:['legacy4','shader32','float64'],GPUCap:1,GPUSelection:'all-mode CPU PASS preferred; otherwise only exact-boundary/native-parity-supported near miss with a written justification before GPU',stop:'after twelve derived candidates; no restart, new seed, rescaling, sweep or unused-budget search',noGlobalProof:true,graphDigest:frozen.graphDigest};
  if(resume){const old=JSON.parse(fs.readFileSync(dir+'/protocol.json'));assert.deepEqual(protocol,old);}
  else fs.writeFileSync(dir+'/protocol.json',JSON.stringify(protocol,null,2)+'\n');
  const seedSnapshot=snapshot(seed.pose),decode=path=>{const r=pngPixels(fs.readFileSync(path)),lookup=new Map([[0,0],...seedSnapshot.meshes.map(m=>[maskColor(m.id),m.id])]),ids=new Uint32Array(r.width*r.height);for(let i=0;i<ids.length;i++){const j=i*r.channels,color=(r.pixels[j]<<16)|(r.pixels[j+1]<<8)|r.pixels[j+2];assert.ok(lookup.has(color));ids[i]=lookup.get(color);}return{...r,ids};};
  const full=resume?decode(dir+'/baseline-CPU-id.png'):render(seedSnapshot,'legacy4',{exactEdges:true,trace:true});full.snapshot=seedSnapshot;
  const only=structuredClone(seedSnapshot);for(const m of only.meshes)m.visible=m.visible&&(m.kind==='bond'?m.index===33:[30,35].includes(m.index));
  const endpoints=resume?decode(dir+'/baseline-endpoints33-CPU-id.png'):render(only,'legacy4',{exactEdges:true});let rasters=2;
  if(!resume){fs.writeFileSync(dir+'/baseline-CPU-id.png',png(full));fs.writeFileSync(dir+'/baseline-endpoints33-CPU-id.png',png(endpoints));}
  const models=projectMeshes(seedSnapshot),derivatives=[0,1,2].map(axis=>{
    const plus=[...seed.rotationDegrees],minus=[...seed.rotationDegrees];plus[axis]+=.01;minus[axis]-=.01;
    const plusSnapshot=snapshot(poseAt(plus).pose),minusSnapshot=snapshot(poseAt(minus).pose);
    return{plus:projectMeshes(plusSnapshot),minus:projectMeshes(minusSnapshot),plusSnapshot,minusSnapshot};
  });
  const boundaries=deriveBoundaries(full,endpoints,models,derivatives);save('boundaries',boundaries);
  const baselineGrade=grade(png(full),{anchor:30,snapshot:seedSnapshot,domOcclusions:frozen.views[0].domOcclusions});assert.deepEqual(baselineGrade,seed.grade);
  const plans=[];
  for(const areaPixels of protocol.areaPixelSets)for(const extension of boundaries.continuity.extensions)for(const radius of protocol.trustRadiiDegrees){
    const gains=boundaries.losses.slice(0,areaPixels).flatMap(p=>p.keys),guards=boundaries.guards,keys=new Set([...gains,...guards,...extension.keys]);
    plans.push({name:`a${areaPixels}-${extension.side}-r${radius}`,areaPixels,side:extension.side,radius,features:boundaries.features.filter(f=>keys.has(f.key)).map(f=>({...f,guard:guards.includes(f.key)}))});
  }
  fs.writeFileSync(dir+'/linear-input.json',JSON.stringify({seed:seed.rotationDegrees,plans})+'\n');
  const solver=spawnSync('python',['scripts/solve-polymer-task5-boundaries.py',dir],{encoding:'utf8'});assert.equal(solver.status,0,solver.stderr);fs.writeFileSync(dir+'/linear-solver.log',solver.stdout+solver.stderr);
  const candidates=JSON.parse(fs.readFileSync(dir+'/candidates.json'));assert.equal(candidates.rows.length,12);
  const rows=[];
  for(const candidate of candidates.rows){
    const observations=[];
    for(const precision of protocol.arithmeticModes){const result=evaluateCoupledMesh(candidate.rotationDegrees,precision);rasters++;observations.push({precision,...result});}
    rows.push({...candidate,observations});save('results',{protocol,CPURasters:rasters,baselineGrade,rows});
    console.log(JSON.stringify({candidate:candidate.name,rotationDegrees:candidate.rotationDegrees,linearSlack:candidate.linearSlack,modes:observations.map(r=>({precision:r.precision,minimum:r.minimumMargin,failAtoms:r.grade.atoms.filter(a=>!a.pass).map(a=>a.index),failBonds:r.grade.bonds.filter(b=>!b.pass)}))}));
  }
  assert.equal(rasters,protocol.CPURasterCap);
  save('results',{protocol,CPURasters:rasters,baselineGrade,rows,CPUJointWitness:rows.some(r=>r.observations.every(x=>x.minimumMargin>=1)),disposition:'UNRESOLVED_UNTIL_ACTUAL_GPU_WITNESS_OR_PROOF',certifiedExcludedRegions:0});
  const hashList=['protocol.json','boundaries.json.gz','linear-input.json','candidates.json','results.json.gz','baseline-CPU-id.png','baseline-endpoints33-CPU-id.png'].map(path=>({path,sha256:sha(fs.readFileSync(dir+'/'+path))}));
  fs.writeFileSync(dir+'/hashes.json',JSON.stringify(hashList,null,2)+'\n');
}
