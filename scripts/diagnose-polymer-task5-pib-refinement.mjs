// Owner: Task⑤ visual acceptance ledger. One fixed numeric experiment, no raster acceptance.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three/three.module.min.js';
import {fitPolymerObservation} from '../src/reaction-lab-polymer-presentation.js';
const base=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/',import.meta.url);
const bytes=fs.readFileSync(new URL('ba94cb-pib-visual.json.gz',base)),r=JSON.parse(gunzipSync(bytes));
const old=JSON.parse(gunzipSync(fs.readFileSync(new URL('d29-pib-direction-diagnostic.json.gz',base))));
const conflict=JSON.parse(fs.readFileSync(new URL('pib-visibility-conflict.json',base)));
const c=r.initial.camera,camera=new THREE.PerspectiveCamera(c.fov,r.initial.canvas.width/r.initial.canvas.height,c.near,c.far);camera.position.fromArray(c.position);camera.updateMatrixWorld(true);
const plan={atoms:r.initial.layoutAtoms,bonds:r.initial.graph.bonds};
const protocol={kind:'FIXED_NUMERIC_LOCAL_REFINEMENT_NOT_ACCEPTANCE',inputSha256:createHash('sha256').update(bytes).digest('hex'),anchors:[0,17,30],seeds:'three retained numeric best + two retained closest raster poses per anchor',degrees:[12,6,3,1.5],candidatesPerLevel:'current + positive/negative camera X/Y/Z rotation',fitsPerAnchor:140,totalFits:420,selection:'unchanged production localReadability.score, then qMin',rasterBudget:'No browser trial. Any subsequent acceptance retains 40 directions and one local focus per anchor.',limits:['Not a proof of feasibility or impossibility','No chemistry, XYZ, production source, threshold, fit budget or grader change']};
fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/pib-refinement-protocol.json',JSON.stringify(protocol,null,2)+'\n');
const groups=[];
for(const anchor of protocol.anchors){
 const target=r.initial.observation.targets.find(t=>t.target.kind.startsWith('local:')&&t.target.anchor===anchor).target,indices=new Set(target.atomIndices);
 for(const b of plan.bonds)if(target.atomIndices.includes(b.a)||target.atomIndices.includes(b.b)){indices.add(b.a);indices.add(b.b);}
 const input={plan,camera,width:r.initial.canvas.width,height:r.initial.canvas.height,safeRegion:r.initial.fit.safeRegion,atomIndices:[...indices],requiredAtomIndices:target.atomIndices,requiredBondIndices:target.bondIndices};
 const seeds=[...old.rows.find(g=>g.anchor===anchor).best.map(v=>v.quaternion),...conflict.groups.find(g=>g.anchor===anchor).retained.map(v=>r.views.find(w=>w.mode==='local-'+anchor&&w.yaw===v.yaw&&w.pitch===v.pitch).pose.quaternion)],rows=[];
 for(let seed=0;seed<seeds.length;seed++){
  let q=new THREE.Quaternion(...seeds[seed]);
  for(const degrees of protocol.degrees){
   const candidates=[q.clone(),...[[1,0,0],[0,1,0],[0,0,1]].flatMap(axis=>[-1,1].map(sign=>new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis),sign*degrees*Math.PI/180).multiply(q)))];
   const level=candidates.map((quaternion,candidate)=>{const fit=fitPolymerObservation(THREE,{...input,quaternion});return{seed,degrees,candidate,score:fit.localReadability.score,qMin:fit.qMin,quaternion:fit.quaternion,scale:fit.scale,position:fit.position,readability:fit.localReadability};});
   rows.push(...level);level.sort((a,b)=>b.score-a.score||b.qMin-a.qMin||a.candidate-b.candidate);q.fromArray(level[0].quaternion);
  }
 }
 const best=rows.toSorted((a,b)=>b.score-a.score||b.qMin-a.qMin)[0];groups.push({anchor,rows,best});console.log(JSON.stringify({anchor,fits:rows.length,best}));
}
fs.writeFileSync('test-results/pib-refinement.json',JSON.stringify({protocol,groups},null,2)+'\n');
