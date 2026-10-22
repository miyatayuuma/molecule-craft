// Owner: Task⑤ acceptance ledger. Read-only analysis of saved actual PNG/masks.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {modelAtomRadius} from '../src/chemistry.js';
import {pngPixels,maskColor,contourGrade,rgbAt,matchesMask,luminance,rasterLayers} from '../tests/helpers/polymer-task5-visual.mjs';
const directory=resolve(process.argv[2]??'test-results/reaction-lab-polymer-simplification/task5/nitrile-butadiene-rubber');
const report=JSON.parse(await readFile(join(directory,'visual.json'),'utf8'));
const initial=report.initial,inv=new THREE.Matrix4().fromArray(initial.camera.matrix).invert(),projection=new THREE.Matrix4().fromArray(initial.camera.projection),f=initial.canvas.height/(2*Math.tan(initial.camera.fov*Math.PI/360));
function atomsAt(pose){const transform=new THREE.Matrix4().compose(new THREE.Vector3(...pose.position),new THREE.Quaternion(...pose.quaternion),new THREE.Vector3().setScalar(pose.scale));return initial.layoutAtoms.map((a,index)=>{const p=new THREE.Vector3(a.x,a.y,a.z).applyMatrix4(transform).applyMatrix4(inv),depth=-p.z,s=p.clone().applyMatrix4(projection);return{index,element:a.element,center:{x:(s.x+1)*initial.canvas.width/2,y:(1-s.y)*initial.canvas.height/2,depth},radius:f*modelAtomRadius(a.element)*pose.scale/depth};});}
for(const a of atomsAt(initial.pose)){const b=initial.atoms[a.index];assert.ok(Math.hypot(a.center.x-b.center.x,a.center.y-b.center.y)<1e-6);assert.ok(Math.abs(a.radius-b.radius)<1e-6);}
function bandDiagnostic(atom,mask,actual){const dpr=initial.canvas.dpr,r=atom.radius*dpr,cx=atom.center.x*dpr,cy=atom.center.y*dpr,ox=initial.canvas.left*dpr,oy=initial.canvas.top*dpr,color=maskColor(atom.index+1);let exposed=0,contrast=0;
  for(let k=0;k<72;k++){const angle=k*Math.PI/36,dx=Math.cos(angle),dy=Math.sin(angle);let edge=null;for(let rr=r*.7;rr<=r*1.15;rr+=.5)if(matchesMask(mask,color,cx+dx*rr,cy+dy*rr))edge=rr;if(edge===null||!matchesMask(mask,0,cx+dx*(edge+2*dpr),cy+dy*(edge+2*dpr)))continue;
    const band=offsets=>offsets.map(t=>luminance(rgbAt(actual,cx+dx*(edge+t*dpr)+ox,cy+dy*(edge+t*dpr)+oy))).reduce((a,b)=>a+b,0)/offsets.length;exposed++;if(Math.abs(band([-.5,-1.5])-band([.5,1.5]))>=.05)contrast++;
  }return{kind:'TWO_PX_BAND_DIAGNOSTIC_NOT_ACCEPTANCE_ANNOTATIONS_NOT_REMOVED',exposed,contrast,contrastRatio:exposed?contrast/exposed:0};}
const groups=report.simultaneous.filter(g=>!g.witness).map(g=>({...g,candidates:[]}));
for(const view of report.views){const relevant=groups.filter(g=>view.mode.startsWith('local-')&&view.localQMin>=20&&view.localShell.includes(g.anchor));if(!relevant.length)continue;
  const gradingView={canvas:initial.canvas,domOcclusions:view.domOcclusions??{rectangles:[],circles:[]}},bytes=await readFile(join(directory,view.mask)),{counts,photometryMask:mask}=rasterLayers(bytes,gradingView),actual=pngPixels(await readFile(join(directory,view.photometryPNG??view.actualPNG))),atoms=atomsAt(view.pose),needed=new Set(relevant.flatMap(g=>g.atomIndices)),grades=new Map();
  for(const i of needed){const a=atoms[i],visibleRatio=(counts.get(maskColor(i+1))??0)/(Math.PI*(a.radius*initial.canvas.dpr)**2),contour=contourGrade(a,gradingView,mask,actual);grades.set(i,{index:i,element:a.element,diameter:2*a.radius,q:a.radius/modelAtomRadius(a.element),visibleRatio,contour,bandDiagnostic:bandDiagnostic(a,mask,actual),accepted:view.visibleAtoms.includes(i)});}
  for(const group of relevant){const atoms=group.atomIndices.map(i=>grades.get(i)),missingBonds=group.bondIndices.filter(i=>!view.visibleBonds.includes(i));group.candidates.push({mode:view.mode,yaw:view.yaw,pitch:view.pitch,actualPNG:view.actualPNG,mask:view.mask,atoms,missingBonds,failureCount:atoms.filter(a=>!a.accepted).length+missingBonds.length});}
}
for(const g of groups){g.candidates.sort((a,b)=>a.failureCount-b.failureCount);g.best=g.candidates[0]??null;}
const result={kind:'SAVED_ACTUAL_PNG_RASTER_DIAGNOSTIC_NOT_ACCEPTANCE',sourceSha:report.sourceSha??null,graphDigest:report.graphDigest,directory,groups};
const output=process.argv[3]??join(directory,'raster-diagnostics.json');await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,groups:groups.map(g=>({...g,candidates:g.candidates.length}))},null,2));
