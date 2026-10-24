// Owner: Task5 PIB recovery. One generic focus rule on retained orientations.
// Offline diagnosis only. This does not select or certify a production pose.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {modelAtomRadius} from '../src/chemistry.js';
import {fitPolymerObservation} from '../src/reaction-lab-polymer-presentation.js';
import {render,png,grade} from './analyze-polymer-task5-exact-mesh.mjs';

const dir=process.argv[2];assert.ok(dir,'Provide the decompressed exact-mesh directory');
const base=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/',import.meta.url);
const read=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL(name,base))));
const frozen=read('ba94cb-pib-visual.json.gz'),facets=read('pib-occlusion-6036606d/pib-facets.json.gz'),initial=frozen.initial;
const camera=new THREE.PerspectiveCamera(initial.camera.fov,initial.canvas.width/initial.canvas.height,initial.camera.near,initial.camera.far);new THREE.Matrix4().fromArray(initial.camera.matrix).decompose(camera.position,camera.quaternion,camera.scale);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
const authority=JSON.parse(fs.readFileSync(dir+'/production-before-replay.json'));
const frozenMeshes=JSON.parse(fs.readFileSync(dir+'/boundary-30-0.json')).snapshot;
assert.deepEqual(authority.meshes.map(m=>m.matrix),frozenMeshes.meshes.map(m=>m.matrix),'current local transforms must match the frozen XYZ and inherited quaternions');
assert.ok(camera.projectionMatrix.elements.every((v,i)=>Math.abs(v-initial.camera.projection[i])<1e-12),'retain the exact captured camera projection');
const poses=[...facets.groups.filter(g=>g.anchor===0||g.anchor===17).map(g=>({anchor:g.anchor,name:'retained-facet-'+g.anchor,quaternion:g.best[0].quaternion})),...[0,1,2].map(i=>{const r=JSON.parse(fs.readFileSync(dir+`/boundary-30-${i}.json`));return{anchor:30,name:r.name,quaternion:r.pose.quaternion};})];
const protocol={kind:'ONE_GENERIC_FOCUS_RULE_NOT_ACCEPTANCE',poses:5,fitComparisons:10,rasterModes:['legacy4 independent edges','grid8 independent edges','float64 independent edges'],rasterBudget:30,newOrientations:0,GPUExperiments:0,candidateRule:'selected feature AABB pivot (Task3 section8) plus maximal shell fit within measured safe rectangle; preserve whole-graph spherical near/far budget',referenceRule:'existing shell AABB pivot and .92 scale headroom',ranking:'minimum independent normalized atom fraction, lane area, continuous length, width, length and Q; never centerline fraction',screeningGuard:{areaPixels:2,continuousCSS:1,atomFraction:.01},limits:['Retained quaternion is not a production selection algorithm','Three arithmetic modes and empirical guards are sensitivity screening, not a proven bound for unseen poses','No photometry, pointer, reset or formal acceptance']};
fs.writeFileSync(dir+'/focus-rule-protocol.json',JSON.stringify(protocol,null,2)+'\n');
let source=fs.readFileSync(new URL('../src/reaction-lab-polymer-presentation.js',import.meta.url),'utf8').replace("'./chemistry.js?v=20'",JSON.stringify(new URL('../src/chemistry.js',import.meta.url).href)).replace("'./polymer-fragment-3d-layout.js?v=1'",JSON.stringify(new URL('../src/polymer-fragment-3d-layout.js',import.meta.url).href));
source=source.replace('const pivot=new THREE.Vector3(...min.map',`if(selected&&requiredAtomIndices.length){min=[Infinity,Infinity,Infinity];max=[-Infinity,-Infinity,-Infinity];for(const i of requiredAtomIndices){const p=plan.atoms[i],r=modelAtomRadius(p.element);for(let k=0;k<3;k++){const v=[p.x,p.y,p.z][k];min[k]=Math.min(min[k],v-r);max[k]=Math.max(max[k],v+r);}}}const pivot=new THREE.Vector3(...min.map`).replace('Math.min(low*.92,focusScaleLimit)','Math.min(low*(selected?1-1e-6:.92),focusScaleLimit)');
assert.ok(source.includes('if(selected&&requiredAtomIndices.length){min=')&&source.includes('Math.min(low*(selected?1-1e-6:.92),focusScaleLimit)'),'fail explicitly if the diagnostic source substitution becomes stale');
const candidateFit=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).fitPolymerObservation;
function snapshot(fit){
  const s=structuredClone(authority),group=new THREE.Matrix4().compose(new THREE.Vector3(...fit.position),new THREE.Quaternion(...fit.quaternion),new THREE.Vector3().setScalar(fit.scale)),inverse=camera.matrixWorldInverse,f=initial.canvas.height/(2*Math.tan(camera.fov*Math.PI/360)),project=p=>{const c=p.clone().applyMatrix4(inverse),q=p.clone().project(camera);return{x:(q.x+1)*initial.canvas.width/2,y:(1-q.y)*initial.canvas.height/2,depth:-c.z};};
  s.groupMatrix=group.toArray();s.visual=structuredClone(initial);s.visual.pose={position:fit.position,quaternion:fit.quaternion,scale:fit.scale};s.visual.atoms=[];s.visual.lanes=[];
  for(const mesh of s.meshes){const matrix=group.clone().multiply(new THREE.Matrix4().fromArray(mesh.matrix));mesh.matrixWorld=matrix.toArray();
    if(mesh.kind==='atom'){const index=mesh.index,center=project(new THREE.Vector3().applyMatrix4(matrix));s.visual.atoms[index]={...initial.atoms[index],center,radius:f*fit.scale*modelAtomRadius(initial.graph.atoms[index].element)/center.depth};}
    else{const a=project(new THREE.Vector3(0,-.5,0).applyMatrix4(matrix)),b=project(new THREE.Vector3(0,.5,0).applyMatrix4(matrix));s.visual.lanes.push({bondIndex:mesh.index,a,b,radius:f*mesh.scale[0]*fit.scale/((a.depth+b.depth)/2)});}
  }
  return s;
}
function margins(g,q){return[...g.atoms.map(a=>a.visibleFraction/.60),...g.bonds.flatMap(b=>[b.length/7.75,b.width/1.25,b.visiblePixels/b.requiredPixels,b.continuous/7.75]),q/20];}
const rows=[];
for(const pose of poses){
  const target=initial.observation.targets.find(t=>t.target.anchor===pose.anchor&&t.target.kind.startsWith('local:')).target,indices=new Set(target.atomIndices);
  for(const b of initial.graph.bonds)if(target.atomIndices.includes(b.a)||target.atomIndices.includes(b.b)){indices.add(b.a);indices.add(b.b);}
  const input={plan:{atoms:initial.layoutAtoms,bonds:initial.graph.bonds},camera,width:initial.canvas.width,height:initial.canvas.height,safeRegion:initial.fit.safeRegion,atomIndices:[...indices],requiredAtomIndices:target.atomIndices,requiredBondIndices:target.bondIndices,quaternion:new THREE.Quaternion(...pose.quaternion)};
  for(const [rule,fitFn]of [['reference',fitPolymerObservation],['candidate',candidateFit]]){
    const fit=fitFn(THREE,input),s=snapshot(fit),row={anchor:pose.anchor,snapshot:s,domOcclusions:frozen.views[0].domOcclusions};
    const measurements=['legacy4','shader32','float64'].map(mode=>{const image=render(s,mode,{exactEdges:true}),g=grade(png(image),row);return{mode,grade:g,minimumMargin:Math.min(...margins(g,fit.qMin))};});
    const conservative=measurements.every(m=>m.grade.atoms.every(a=>a.visibleFraction-.01>=.60)&&m.grade.bonds.every(b=>b.visiblePixels-2>=b.requiredPixels&&b.continuous-1>=7.75&&b.length>=7.75&&b.width>=1.25)&&fit.qMin>=20);
    const result={name:pose.name,anchor:pose.anchor,rule,pose:{quaternion:fit.quaternion,position:fit.position,scale:fit.scale},qMin:fit.qMin,fitBounds:fit.bounds,safeRegion:fit.safeRegion,minimumMargin:Math.min(...measurements.map(m=>m.minimumMargin)),conservativeScreen:conservative,measurements};rows.push(result);
    console.log(JSON.stringify({name:pose.name,rule,scale:fit.scale,minimumMargin:result.minimumMargin,partial:measurements.map(m=>m.grade.jointPartialPixelPass),conservativeScreen:conservative}));
  }
}
fs.writeFileSync(dir+'/focus-rule-analysis.json',JSON.stringify({protocol,rows},null,2)+'\n');
