// Owner: Task⑤ visual acceptance ledger. Frozen raster diagnosis, not acceptance.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {modelAtomRadius} from '../src/chemistry.js';
import {polymerLaneOffsets,polymerLaneRadius} from '../src/reaction-lab-polymer-presentation.js';
import {pngPixels,maskColor,rasterLayers,continuousLanes,rgbAt} from '../tests/helpers/polymer-task5-visual.mjs';

const base=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/',import.meta.url);
const frozen=fs.readFileSync(new URL('ba94cb-pib-visual.json.gz',base));
const report=JSON.parse(gunzipSync(frozen)),initial=report.initial,graph=initial.graph;
const conflict=JSON.parse(fs.readFileSync(new URL('pib-visibility-conflict.json',base)));
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(frozen),conflict.frozenReportSha256);
assert.equal(sha(JSON.stringify(graph)),report.graphDigest);
const inverse=new THREE.Matrix4().fromArray(initial.camera.matrix).invert();
const f=initial.canvas.height/(2*Math.tan(initial.camera.fov*Math.PI/360));
const project=p=>({x:initial.canvas.width/2+f*p.x/-p.z,y:initial.canvas.height/2-f*p.y/-p.z,depth:-p.z});
const rayAt=p=>new THREE.Vector3((p.x-initial.canvas.width/2)/f,(initial.canvas.height/2-p.y)/f,-1).normalize();
const colors=new Map(graph.atoms.map((_,i)=>[maskColor(i+1),{kind:'atom',index:i}]));
for(let i=0;i<graph.bonds.length;i++)colors.set(maskColor(1024+i),{kind:'bond',index:i});
function reconstruct(pose){
  const transform=new THREE.Matrix4().compose(new THREE.Vector3(...pose.position),new THREE.Quaternion(...pose.quaternion),new THREE.Vector3().setScalar(pose.scale));
  const atoms=initial.layoutAtoms.map((a,index)=>{const point=new THREE.Vector3(a.x,a.y,a.z).applyMatrix4(transform).applyMatrix4(inverse);return{index,element:a.element,point,r:pose.scale*modelAtomRadius(a.element),center:project(point),radius:f*pose.scale*modelAtomRadius(a.element)/-point.z};});
  const lanes=graph.bonds.flatMap((b,bondIndex)=>polymerLaneOffsets(b.order).map(offset=>{
    assert.equal(offset,0,'This frozen PIB has only single bonds; no camera-facing ambiguity');
    const a=atoms[b.a],z=atoms[b.b],axis=z.point.clone().sub(a.point),length=axis.length(),direction=axis.clone().normalize();
    const A=a.point.clone().addScaledVector(direction,pose.scale*(modelAtomRadius(a.element)-.01)),B=z.point.clone().addScaledVector(direction,-pose.scale*(modelAtomRadius(z.element)-.01));
    return{bondIndex,order:b.order,offset,atomIndices:[b.a,b.b],A,B,direction,length:A.distanceTo(B),r:pose.scale*polymerLaneRadius(b.order),a:project(A),b:project(B),radius:f*pose.scale*polymerLaneRadius(b.order)/(-(A.z+B.z)/2),axis:axis.toArray(),bondLength:length/pose.scale};
  }));return{atoms,lanes};
}
const old=reconstruct(initial.pose);
for(const lane of old.lanes){const saved=initial.lanes.find(l=>l.bondIndex===lane.bondIndex);assert.ok(Math.hypot(saved.a.x-lane.a.x,saved.a.y-lane.a.y,saved.b.x-lane.b.x,saved.b.y-lane.b.y)<1e-6);}
function sphereHit(ray,a){const b=ray.dot(a.point),disc=b*b-a.point.lengthSq()+a.r*a.r;if(disc<0)return Infinity;const t=b-Math.sqrt(disc);return t>0?t:Infinity;}
const rows=[];
for(const group of conflict.groups)for(const retained of group.retained){
  const view=report.views.find(v=>v.mode==='local-'+group.anchor&&v.yaw===retained.yaw&&v.pitch===retained.pitch);
  for(const file of retained.files)assert.equal(sha(fs.readFileSync(new URL(file.path,base))),file.sha256);
  const model=reconstruct(view.pose),grading={...view,canvas:initial.canvas,lanes:model.lanes};
  const {counts,visibilityMask,photometryMask}=rasterLayers(fs.readFileSync(new URL(view.mask,base)),grading);
  const bonds=[];
  for(const i of group.bondIndices){
    const lane=model.lanes[i],b=graph.bonds[i],n=Math.hypot(lane.b.x-lane.a.x,lane.b.y-lane.a.y),blockers=new Map(),observed=new Map();let own=0,endpoint=0,other=0;
    for(let j=0;j<=128;j++){
      const t=j/128,p={x:lane.a.x+(lane.b.x-lane.a.x)*t,y:lane.a.y+(lane.b.y-lane.a.y)*t},ray=rayAt(p);
      const ranked=model.atoms.map(a=>({index:a.index,t:sphereHit(ray,a)})).filter(a=>Number.isFinite(a.t)).sort((a,b)=>a.t-b.t);
      // Exact center-line intersection with the infinite cylinder, bounded to its ends.
      const oa=lane.A.clone().negate(),dr=ray.dot(lane.direction),da=oa.dot(lane.direction),qa=1-dr*dr,qb=ray.dot(oa)-dr*da,qc=oa.lengthSq()-da*da-lane.r*lane.r,disc=qb*qb-qa*qc;
      const infiniteNear=qa>1e-12&&disc>=0?(-qb-Math.sqrt(disc))/qa:Infinity,h=da+infiniteNear*dr;
      const near=infiniteNear>0&&h>=0&&h<=lane.length?infiniteNear:Infinity;
      if(ranked[0]?.t<near){const a=ranked[0];blockers.set(a.index,(blockers.get(a.index)??0)+1);if(a.index===b.a||a.index===b.b)endpoint++;else other++;}
      const rgb=rgbAt(visibilityMask,p.x*initial.canvas.dpr,p.y*initial.canvas.dpr),color=(rgb[0]<<16)|(rgb[1]<<8)|rgb[2],object=colors.get(color),key=object?object.kind+':'+object.index:'background/other';observed.set(key,(observed.get(key)??0)+1);if(object?.kind==='bond'&&object.index===i)own++;
    }
    bonds.push({index:i,endpoints:[b.a,b.b],endpointOrigins:[graph.atomOrigins[b.a],graph.atomOrigins[b.b]],order:b.order,lane:0,modelAxis:initial.layoutAtoms[b.b]?['x','y','z'].map(k=>initial.layoutAtoms[b.b][k]-initial.layoutAtoms[b.a][k]):null,cameraAxis:lane.axis,angleToViewDegrees:Math.acos(Math.abs(lane.direction.z))*180/Math.PI,bondLength:lane.bondLength,trimmedWorldLength:lane.length,projectedTrimmedLength:n,width:2*lane.radius,visibleMaskPixels:counts.get(maskColor(1024+i))??0,requiredMaskPixels:n*2*lane.radius*.50,continuousVisibleCSS:continuousLanes(grading,[lane],photometryMask),centerlineMask:Object.fromEntries(observed),sphereBlockers:[...blockers].map(([index,count])=>({index,element:graph.atoms[index].element,count,centerDepth:model.atoms[index].center.depth,endpoint:index===b.a||index===b.b})),predictedEndpointBlockedSamples:endpoint,predictedOtherBlockedSamples:other,accepted:view.visibleBonds.includes(i)});
  }
  const atoms=group.atomIndices.map(i=>{const a=model.atoms[i],owners=new Map();
    if(!view.visibleAtoms.includes(i))for(let y=Math.floor(a.center.y-a.radius);y<=a.center.y+a.radius;y++)for(let x=Math.floor(a.center.x-a.radius);x<=a.center.x+a.radius;x++){
      if(Math.hypot(x+.5-a.center.x,y+.5-a.center.y)>a.radius)continue;
      const rgb=rgbAt(visibilityMask,x*initial.canvas.dpr,y*initial.canvas.dpr),color=(rgb[0]<<16)|(rgb[1]<<8)|rgb[2],object=colors.get(color);if(object?.kind==='atom'&&object.index!==i)owners.set(object.index,(owners.get(object.index)??0)+1);
    }
    return{index:i,element:a.element,origin:graph.atomOrigins[i],center:a.center,diameter:2*a.radius,visibleFraction:(counts.get(maskColor(i+1))??0)/(Math.PI*a.radius*a.radius),accepted:view.visibleAtoms.includes(i),otherAtomPixelsInsideProjectedDisk:[...owners].map(([index,pixels])=>({index,element:graph.atoms[index].element,pixels,centerDepth:model.atoms[index].center.depth}))};});
  rows.push({anchor:group.anchor,yaw:view.yaw,pitch:view.pitch,pose:view.pose,localQMin:view.localQMin,safeRectangle:initial.fit.safeRegion,dom:view.domOcclusions.rectangles,annotationCircles:view.domOcclusions.circles,files:retained.files,atoms,bonds});
}
const output=process.argv[2]??'test-results/pib-occlusion.json';fs.mkdirSync(new URL('../test-results/',import.meta.url),{recursive:true});
fs.writeFileSync(output,JSON.stringify({kind:'FROZEN_PNG_AND_ANALYTIC_OCCLUSION_DIAGNOSIS_NOT_ACCEPTANCE',sourceSha:report.sourceSha,analyzedAtHead:'6036606df10126840c5c51ada9fde76cb4d57f84',graphDigest:report.graphDigest,inputSha256:sha(frozen),initialLaneProjectionReconstruction:'PASS <1e-6 CSS px',limits:['Analytic spheres approximate the tessellated mesh; original ID pixels are authoritative','No new view, browser trial, threshold or source modification'],rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({anchor:r.anchor,yaw:r.yaw,pitch:r.pitch,missingAtoms:r.atoms.filter(a=>!a.accepted),missingBonds:r.bonds.filter(b=>!b.accepted)})),null,2));
