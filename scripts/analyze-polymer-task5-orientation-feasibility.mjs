// Owner: docs/validation/polymer-local-fragment-task5-orientation-feasibility.md.
// Frozen-input diagnosis only; CPU predictions never certify GPU acceptance.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.min.js';
import {modelAtomRadius} from '../src/chemistry.js';
import {render,png,grade} from './analyze-polymer-task5-exact-mesh.mjs';

const root=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/',import.meta.url);
const read=p=>JSON.parse(gunzipSync(fs.readFileSync(new URL(p,root))));
export const frozen=read('ba94cb-pib-visual.json.gz'),initial=frozen.initial;
export const authority=read('pib-exact-mesh-519a686c/production-before-replay.json.gz');
const references=read('pib-raster-parity-d100a76b/focus-rule-analysis.json.gz').rows.filter(r=>r.rule==='reference');
assert.equal(createHash('sha256').update(JSON.stringify(initial.graph)).digest('hex'),frozen.graphDigest);
export const camera=new T.PerspectiveCamera(initial.camera.fov,initial.canvas.width/initial.canvas.height,initial.camera.near,initial.camera.far);
new T.Matrix4().fromArray(initial.camera.matrix).decompose(camera.position,camera.quaternion,camera.scale);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
export const targetFor=anchor=>initial.observation.targets.find(t=>t.target.anchor===anchor&&t.target.kind.startsWith('local:')).target;
export function inputFor(anchor){const target=targetFor(anchor),indices=new Set(target.atomIndices);for(const b of initial.graph.bonds)if(indices.has(b.a)||indices.has(b.b)){if(target.atomIndices.includes(b.a)||target.atomIndices.includes(b.b)){indices.add(b.a);indices.add(b.b);}}return{plan:{atoms:initial.layoutAtoms,bonds:initial.graph.bonds},camera,width:initial.canvas.width,height:initial.canvas.height,safeRegion:initial.fit.safeRegion,atomIndices:[...indices],requiredAtomIndices:target.atomIndices,requiredBondIndices:target.bondIndices};}
export function snapshot(pose){
 const s=structuredClone(authority),group=new T.Matrix4().compose(new T.Vector3(...pose.position),new T.Quaternion(...pose.quaternion),new T.Vector3().setScalar(pose.scale)),f=initial.canvas.height/(2*Math.tan(camera.fov*Math.PI/360));
 const project=p=>{const c=p.clone().applyMatrix4(camera.matrixWorldInverse),q=p.clone().project(camera);return{x:(q.x+1)*initial.canvas.width/2,y:(1-q.y)*initial.canvas.height/2,depth:-c.z};};
 s.groupMatrix=group.toArray();s.visual=structuredClone(initial);s.visual.pose=pose;s.visual.atoms=[];s.visual.lanes=[];
 for(const m of s.meshes){const matrix=group.clone().multiply(new T.Matrix4().fromArray(m.matrix));m.matrixWorld=matrix.toArray();
  if(m.kind==='atom'){const center=project(new T.Vector3().applyMatrix4(matrix));s.visual.atoms[m.index]={...initial.atoms[m.index],center,radius:f*pose.scale*modelAtomRadius(initial.graph.atoms[m.index].element)/center.depth};}
  else{const a=project(new T.Vector3(0,-.5,0).applyMatrix4(matrix)),b=project(new T.Vector3(0,.5,0).applyMatrix4(matrix));s.visual.lanes.push({bondIndex:m.index,a,b,radius:f*m.scale[0]*pose.scale/((a.depth+b.depth)/2)});}
 }return s;
}
export function measure(pose,anchor,filter=null,precision='legacy4'){
 const s=snapshot(pose);if(filter)for(const m of s.meshes)m.visible=m.visible&&filter(m);
 const raster=render(s,precision,{exactEdges:true}),row={anchor,snapshot:s,domOcclusions:frozen.views[0].domOcclusions};
 return {grade:grade(png(raster),row),raster,snapshot:s};
}
export function normalized(g,q){return [...g.atoms.flatMap(a=>[{kind:'atomFraction',index:a.index,value:a.visibleFraction/.60},{kind:'atomDiameter',index:a.index,value:a.diameter/(initial.graph.atoms[a.index].element==='H'?5.5:9.5)}]),...g.bonds.flatMap(b=>[{kind:'area',index:b.index,value:b.visiblePixels/b.requiredPixels},{kind:'continuous',index:b.index,value:b.continuous/7.75},{kind:'width',index:b.index,value:b.width/1.25},{kind:'length',index:b.index,value:b.length/7.75}]),{kind:'Q',value:q/20}].sort((a,b)=>a.value-b.value);}

if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){
 const dir='test-results/pib-orientation-feasibility';fs.mkdirSync(dir,{recursive:true});
 const protocol={kind:'FIXED_OCCLUSION_COMPONENT_ANALYSIS_NOT_ACCEPTANCE',anchors:[0,17,30],poses:'one retained reference pose per anchor, boundary30#0; no new orientations',rasterBudget:123,components:['isolated cylinder','cylinder plus endpoint spheres','cylinder plus all atom spheres','complete graph'],inputs:{graphDigest:frozen.graphDigest,source:'6a2f056a13ddea48c1d55218f3a58f1b3d058c62'},limits:['CPU legacy4 independent edges is approximate','Removed occluders are diagnostic counterfactuals only','No universal rigid-pose impossibility proof or formal GPU acceptance']};
 fs.writeFileSync(dir+'/decomposition-protocol.json',JSON.stringify(protocol,null,2)+'\n');
 const rows=[];
 for(const anchor of protocol.anchors){const ref=references.find(r=>r.anchor===anchor),pose=ref.pose,full=measure(pose,anchor),bonds=[];
  for(const i of targetFor(anchor).bondIndices){const b=initial.graph.bonds[i],g=full.grade.bonds.find(b=>b.index===i),components={complete:g},lossOwners={};
   for(const [name,filter]of [['isolated',m=>m.kind==='bond'&&m.index===i],['endpoints',m=>m.kind==='bond'?m.index===i:m.index===b.a||m.index===b.b],['allAtoms',m=>m.kind==='atom'||m.index===i]]){const m=measure(pose,anchor,filter);components[name]=m.grade.bonds.find(b=>b.index===i);if(name==='endpoints'){for(let j=0;j<m.raster.ids.length;j++)if(m.raster.ids[j]===1024+i&&full.raster.ids[j]!==1024+i){const id=full.raster.ids[j],key=id>=1024?'bond:'+(id-1024):id?'atom:'+(id-1):'background';lossOwners[key]=(lossOwners[key]??0)+1;}}}
   const a=new T.Vector3(...['x','y','z'].map(k=>initial.layoutAtoms[b.a][k])),z=new T.Vector3(...['x','y','z'].map(k=>initial.layoutAtoms[b.b][k])),axis=z.clone().sub(a).normalize(),q=new T.Quaternion(...pose.quaternion),normal=new T.Vector3(0,0,1).applyQuaternion(q.clone().invert());
   bonds.push({index:i,endpoints:[b.a,b.b],axis:axis.toArray(),normal:normal.toArray(),angleDegrees:Math.acos(Math.abs(normal.dot(axis)))*180/Math.PI,components,lossOwners});
  }
  rows.push({anchor,pose,qMin:ref.qMin,atoms:full.grade.atoms,bonds});
  console.log(JSON.stringify({anchor,bonds:bonds.map(b=>({index:b.index,angle:b.angleDegrees,components:Object.fromEntries(Object.entries(b.components).map(([k,g])=>[k,{area:g.visiblePixels,required:g.requiredPixels,continuous:g.continuous}]))}))}));
 }
 fs.writeFileSync(dir+'/decomposition.json',JSON.stringify({protocol,rows},null,2)+'\n');
 fs.writeFileSync(dir+'/frozen-input.json',JSON.stringify({initial,authority,references,graphDigest:frozen.graphDigest})+'\n');
}
