// Owner: docs/validation/polymer-local-fragment-task5-model-consistency.md.
// Fixed retained seed only. Set/triangle inspection, never a new-pose raster.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {seed,poseAt,projectMeshes,clearance} from './diagnose-polymer-task5-boundaries.mjs';
import {snapshot,frozen,initial} from './analyze-polymer-task5-orientation-feasibility.mjs';
import {grade} from './analyze-polymer-task5-exact-mesh.mjs';
import {pngPixels,maskColor,continuousLanes,rasterLayers} from '../tests/helpers/polymer-task5-visual.mjs';
const root='docs/validation/polymer-local-fragment-task5-evidence/recovery/';
const out=process.argv[2];assert.ok(out&&fs.existsSync(out+'/protocol.json'));
assert.ok(!fs.existsSync(out+'/seed-consistency.json'),'no audit overwrite');
const data=JSON.parse(gunzipSync(fs.readFileSync(root+'pib-pixel-exchange-a664c1da/model.json.gz')));
const bytes=fs.readFileSync(root+'pib-boundary-92da7771/baseline-CPU-id.png'),mask=pngPixels(bytes),S=snapshot(seed.pose),models=projectMeshes(S),W=mask.width;
const lookup=new Map([[0,0],...S.meshes.map(m=>[maskColor(m.id),m.id])]),ids=new Uint32Array(W*mask.height);
for(let i=0;i<ids.length;i++){const k=i*mask.channels;ids[i]=lookup.get((mask.pixels[k]<<16)|(mask.pixels[k+1]<<8)|mask.pixels[k+2]);assert.notEqual(ids[i],undefined);}
const view={canvas:S.visual.canvas,lanes:S.visual.lanes,domOcclusions:frozen.views[0].domOcclusions};
const actual=grade(bytes,{anchor:30,snapshot:S,domOcclusions:view.domOcclusions});assert.deepEqual(actual,seed.grade);
const layers=rasterLayers(bytes,view);
function depthAt(model,p){let z=Infinity;for(const t of model.triangles){if(t.culled||Math.abs(t.den)<1e-12)continue;const {a,b,c,den}=t,u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/den,v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/den,w=((a.y-b.y)*(p.x-b.x)+(b.x-a.x)*(p.y-b.y))/den;if(Math.min(u,v,w)>=0)z=Math.min(z,1/(u/a.depth+v/b.depth+w/c.depth));}return Number.isFinite(z)?z:null;}
const rows=[];
for(const o of data.objects){
 const map=new Map(o.cells.map(c=>[c.y*W+c.x,c])),predicted=new Set(o.cells.filter(c=>!c.annotationBoundary&&c.conditions.every(f=>f.value>=data.protocol.proposalClearancePixels)).map(c=>c.y*W+c.x));
 const raw=new Set();for(let i=0;i<ids.length;i++)if(ids[i]===o.id)raw.add(i);
 const difference=(a,b)=>[...a].filter(i=>!b.has(i));
 const inspect=i=>{const p={x:i%W+.5,y:Math.floor(i/W)+.5},c=map.get(i),own=depthAt(models[o.id],p),depths=Object.values(models).map(m=>({id:m.id,depth:depthAt(m,p)})).filter(d=>d.depth!==null).sort((a,b)=>a.depth-b.depth);return{x:i%W,y:Math.floor(i/W),savedOwner:ids[i],inPool:!!c,annotationBoundary:c?.annotationBoundary??null,rejectingConditions:c?.conditions.filter(f=>f.value<data.protocol.proposalClearancePixels),rawHullClearance:clearance(models[o.id].hull,p),targetTriangleDepth:own,rawTriangleOwner:depths[0]?.id??0,frontDepths:depths.slice(0,3)};};
 const artificial={...mask,pixels:Buffer.alloc(mask.pixels.length)},color=maskColor(o.id);for(const i of predicted){const k=i*mask.channels;artificial.pixels[k]=color>>16;artificial.pixels[k+1]=color>>8;artificial.pixels[k+2]=color;}
 const lane=o.kind==='bond'?S.visual.lanes.find(l=>l.bondIndex===o.index):null;
 const formalPixels=layers.counts.get(color)??0;
 const row={id:o.id,kind:o.kind,index:o.index,rawPixels:raw.size,formalPixels,modelPixels:predicted.size,requiredArea:o.required.value,areaPass:predicted.size>=o.required.value,falseNegatives:difference(raw,predicted).map(inspect),falsePositives:difference(predicted,raw).map(inspect)};
 if(lane){const L=Math.hypot(lane.b.x-lane.a.x,lane.b.y-lane.a.y),n=Math.ceil(2*L);row.continuity={length:L,steps:n,formal:continuousLanes(view,[lane],layers.photometryMask),model:continuousLanes(view,[lane],artificial),samples:Array.from({length:n+1},(_,j)=>({j,cells:[-.5,0,.5].map(k=>{const x=lane.a.x+(lane.b.x-lane.a.x)*j/n-k*(lane.b.y-lane.a.y)/L,y=lane.a.y+(lane.b.y-lane.a.y)*j/n+k*(lane.b.x-lane.a.x)/L,i=Math.floor(y)*W+Math.floor(x);return{x,y,floorX:Math.floor(x),floorY:Math.floor(y),savedOwner:ids[i],inPool:map.has(i),modelHit:predicted.has(i)};})}))};}
 rows.push(row);
}
const fit=poseAt(seed.rotationDegrees).fit,f=initial.canvas.height/(2*Math.tan(initial.camera.fov*Math.PI/360));
const depths=S.visual.atoms.flatMap(a=>[a.center.depth-a.radius*a.center.depth/f,a.center.depth+a.radius*a.center.depth/f]);
const guards={fit:fit.fits,Q:fit.qMin>=20,near:Math.min(...depths)>.2,far:Math.max(...depths)<initial.camera.far};
const fixedGate=Object.values(guards).every(Boolean)&&actual.atoms.every(a=>a.pass)&&actual.bonds.every(b=>b.index===33||b.index===34||b.pass)&&rows.every(o=>(o.id===1057||o.areaPass)&&(!o.continuity||o.index===34||o.continuity.model>=7.75));
const result={kind:'RETAINED_SEED_MEMBERSHIP_AND_NATIVE_TRIANGLE_AUDIT_NO_RASTER',graphDigest:frozen.graphDigest,rotationDegrees:seed.rotationDegrees,disabledOnly:['bond33 area','bond34 continuity'],actualGrade:actual,guards,fit,rows,knownStateRepresentable:fixedGate,newPoseCandidates:0,newCPURasters:0,newGPU:0,limits:['Seed membership fidelity and threshold feasibility are distinct.','Raw triangle coverage is float64 projection; retained raster uses legacy4 quantization.','No new pose evaluated, no safe excluded region.']};
fs.writeFileSync(out+'/seed-consistency.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({fixedGate,guards,rows:rows.map(r=>({id:r.id,raw:r.rawPixels,model:r.modelPixels,areaPass:r.areaPass,falseNegatives:r.falseNegatives.length,falsePositives:r.falsePositives.length,continuity:r.continuity&&{formal:r.continuity.formal,model:r.continuity.model,steps:r.continuity.steps}}))}));
