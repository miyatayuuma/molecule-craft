// Owner: Task⑤ PIB recovery. CPU mesh prediction, NEVER browser/PNG acceptance.
import fs from 'node:fs';
import {gunzipSync,deflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {modelAtomRadius} from '../src/chemistry.js';
import {polymerLaneOffsets,polymerLaneRadius,fitPolymerObservation} from '../src/reaction-lab-polymer-presentation.js';
import {pngPixels,maskColor,rasterLayers,continuousLanes} from '../tests/helpers/polymer-task5-visual.mjs';
const directory='test-results/pib-mesh';fs.mkdirSync(directory,{recursive:true});
const base=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/',import.meta.url);
const r=JSON.parse(gunzipSync(fs.readFileSync(new URL('ba94cb-pib-visual.json.gz',base))));
const initial=r.initial,graph=initial.graph,canvas=initial.canvas,W=canvas.width,H=canvas.height;
const conflict=JSON.parse(fs.readFileSync(new URL('pib-visibility-conflict.json',base)));
const facets=JSON.parse(fs.readFileSync('test-results/pib-facets.json'));
const coarse=JSON.parse(fs.readFileSync('test-results/pib-reachability.json'));
const refined=JSON.parse(fs.readFileSync('test-results/pib-reachability-refine.json'));
const protocol={kind:'FIXED_CPU_MESH_RASTER_DIAGNOSIS_NOT_ACCEPTANCE',controls:6,candidates:13,poses:'0/17 one best graph-facet each; 30 coarse top5 + refined best + facet top5',geometry:'24x16 sphere / 12 radial-segment cylinder from production tokens',limits:['No browser, photometry, actual pointer or acceptance','Original sphere local quaternion is not captured; identity is an approximation to tessellation orientation','Only already retained poses; no new direction, fit or threshold search']};
fs.writeFileSync(directory+'/protocol.json',JSON.stringify(protocol,null,2)+'\n');
const inverse=new THREE.Matrix4().fromArray(initial.camera.matrix).invert(),f=H/(2*Math.tan(initial.camera.fov*Math.PI/360));
const point=p=>({x:W/2+f*p.x/-p.z,y:H/2-f*p.y/-p.z,depth:-p.z});
const sphereGeometry=new Map(['C','H'].map(e=>[e,new THREE.SphereGeometry(modelAtomRadius(e),24,16)])),cylinder=new THREE.CylinderGeometry(1,1,1,12),up=new THREE.Vector3(0,1,0);
const shapes=initial.layoutAtoms.map((a,index)=>({kind:'atom',index,id:index+1,geometry:sphereGeometry.get(a.element),position:new THREE.Vector3(a.x,a.y,a.z),quaternion:new THREE.Quaternion(),scale:new THREE.Vector3(1,1,1)}));
for(const [index,b]of graph.bonds.entries())for(const offset of polymerLaneOffsets(b.order)){
 assert.equal(offset,0);const aa=initial.layoutAtoms[b.a],zz=initial.layoutAtoms[b.b],a=new THREE.Vector3(aa.x,aa.y,aa.z),z=new THREE.Vector3(zz.x,zz.y,zz.z),direction=z.clone().sub(a).normalize(),start=modelAtomRadius(aa.element)-.01,end=modelAtomRadius(zz.element)-.01,length=a.distanceTo(z)-start-end;
 shapes.push({kind:'bond',index,id:1024+index,geometry:cylinder,position:a.clone().addScaledVector(direction,start+length/2),quaternion:new THREE.Quaternion().setFromUnitVectors(up,direction),scale:new THREE.Vector3(polymerLaneRadius(b.order),length,polymerLaneRadius(b.order))});
}
function render(pose){
 const group=new THREE.Matrix4().compose(new THREE.Vector3(...pose.position),new THREE.Quaternion(...pose.quaternion),new THREE.Vector3().setScalar(pose.scale));
 const ids=new Uint32Array(W*H),depths=new Float64Array(W*H).fill(Infinity),atoms=[],lanes=[];
 for(const shape of shapes){
  const local=new THREE.Matrix4().compose(shape.position,shape.quaternion,shape.scale),matrix=inverse.clone().multiply(group).multiply(local),position=shape.geometry.getAttribute('position'),index=shape.geometry.index.array,vertices=[];
  for(let i=0;i<position.count;i++)vertices.push(point(new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(matrix)));
  for(let k=0;k<index.length;k+=3){const a=vertices[index[k]],b=vertices[index[k+1]],c=vertices[index[k+2]],den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(den)<1e-12)continue;
   const minX=Math.max(0,Math.ceil(Math.min(a.x,b.x,c.x)-.5)),maxX=Math.min(W-1,Math.floor(Math.max(a.x,b.x,c.x)-.5)),minY=Math.max(0,Math.ceil(Math.min(a.y,b.y,c.y)-.5)),maxY=Math.min(H-1,Math.floor(Math.max(a.y,b.y,c.y)-.5));
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const u=((b.y-c.y)*(x+.5-c.x)+(c.x-b.x)*(y+.5-c.y))/den,v=((c.y-a.y)*(x+.5-c.x)+(a.x-c.x)*(y+.5-c.y))/den,w=1-u-v;if(u<0||v<0||w<0)continue;const d=1/(u/a.depth+v/b.depth+w/c.depth),i=y*W+x;if(d>initial.camera.near&&d<depths[i]){depths[i]=d;ids[i]=shape.id;}}
  }
  if(shape.kind==='atom'){const center=point(new THREE.Vector3().applyMatrix4(matrix)),a=graph.atoms[shape.index];atoms.push({index:shape.index,element:a.element,center,radius:f*pose.scale*modelAtomRadius(a.element)/center.depth});}
  else{const a=point(new THREE.Vector3(0,-.5,0).applyMatrix4(matrix)),b=point(new THREE.Vector3(0,.5,0).applyMatrix4(matrix));lanes.push({bondIndex:shape.index,a,b,radius:f*shape.scale.x*pose.scale/((a.depth+b.depth)/2)});}
 }
 const pixels=Buffer.alloc(W*H*3);for(let i=0;i<ids.length;i++){const color=ids[i]?maskColor(ids[i]):0;pixels[i*3]=color>>16;pixels[i*3+1]=color>>8;pixels[i*3+2]=color;}
 return{ids,pixels,atoms,lanes};
}
function png(pixels){
 const crc=data=>{let c=0xffffffff;for(const b of data){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
 const chunk=(kind,data)=>{const head=Buffer.alloc(8);head.writeUInt32BE(data.length);head.write(kind,4);const body=Buffer.concat([Buffer.from(kind),data]),tail=Buffer.alloc(4);tail.writeUInt32BE(crc(body));return Buffer.concat([head,data,tail]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=2;const raw=Buffer.alloc(H*(W*3+1));for(let y=0;y<H;y++)pixels.copy(raw,y*(W*3+1)+1,y*W*3,(y+1)*W*3);
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
function grade(model,anchor,dom){
 const group=conflict.groups.find(g=>g.anchor===anchor),view={canvas,lanes:model.lanes,domOcclusions:dom??{rectangles:conflict.groups.length?r.views[0].domOcclusions.rectangles:[],circles:[],modelOccluders:[]}},bytes=png(model.pixels),{counts,photometryMask}=rasterLayers(bytes,view);
 const atoms=group.atomIndices.map(index=>{const a=model.atoms[index],visibleFraction=(counts.get(maskColor(index+1))??0)/(Math.PI*a.radius*a.radius);return{index,visibleFraction,diameter:2*a.radius,pass:visibleFraction>=.60&&2*a.radius>=(a.element==='H'?6:10)-.5};});
 const bonds=group.bondIndices.map(index=>{const lane=model.lanes[index],length=Math.hypot(lane.b.x-lane.a.x,lane.b.y-lane.a.y),width=2*lane.radius,visiblePixels=counts.get(maskColor(1024+index))??0,continuous=continuousLanes(view,[lane],photometryMask);return{index,length,width,visiblePixels,requiredPixels:length*width*.50,continuous,pass:length>=7.75&&width>=1.25&&visiblePixels>=length*width*.50&&continuous>=7.75};});
 return{atoms,bonds,jointPrediction:atoms.every(a=>a.pass)&&bonds.every(b=>b.pass),bytes};
}
const rows=[];
for(const group of conflict.groups)for(const retained of group.retained){
 const view=r.views.find(v=>v.mode==='local-'+group.anchor&&v.yaw===retained.yaw&&v.pitch===retained.pitch),model=render(view.pose),prediction=grade(model,group.anchor,view.domOcclusions),actual=pngPixels(fs.readFileSync(new URL(view.mask,base)));
 let foreground=0,mismatch=0,union=0;for(let i=0;i<W*H;i++){const j=i*actual.channels,color=(actual.pixels[j]<<16)|(actual.pixels[j+1]<<8)|actual.pixels[j+2],pred=model.ids[i]?maskColor(model.ids[i]):0;if(color||pred){union++;if(color!==pred)mismatch++;}if(color)foreground++;}
 const name=`control-${group.anchor}-y${view.yaw}-p${view.pitch}-CPU.png`;fs.writeFileSync(directory+'/'+name,prediction.bytes);delete prediction.bytes;rows.push({kind:'control',anchor:group.anchor,yaw:view.yaw,pitch:view.pitch,foregroundPixels:foreground,unionPixels:union,mismatchPixels:mismatch,mismatchRatio:mismatch/union,prediction,CPU:name,actual:view.mask});
}
for(const anchor of [0,17,30]){
 const candidates=anchor===30?[...coarse.best,refined.best,...facets.groups.find(g=>g.anchor===30).best]:[facets.groups.find(g=>g.anchor===anchor).best[0]];
 for(const [index,fit]of candidates.entries()){const pose={position:fit.position,quaternion:fit.quaternion,scale:fit.scale},model=render(pose),prediction=grade(model,anchor),name=`candidate-${anchor}-${index}-CPU.png`;fs.writeFileSync(directory+'/'+name,prediction.bytes);delete prediction.bytes;rows.push({kind:'candidate',anchor,index,pose,numericScore:fit.localReadability.score,prediction,CPU:name});}
}
fs.writeFileSync(directory+'/report.json',JSON.stringify({protocol,rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(v=>({kind:v.kind,anchor:v.anchor,index:v.index,mismatch:v.mismatchRatio,jointPrediction:v.prediction.jointPrediction,missingAtoms:v.prediction.atoms.filter(a=>!a.pass),missingBonds:v.prediction.bonds.filter(b=>!b.pass)})),null,2));

if(process.argv.includes('--fit-factors')){
 const factors=JSON.parse(fs.readFileSync('test-results/pib-fit-factors.json')).rows.filter(v=>v.pivotMode==='shell'&&v.region==='wide'&&v.seed>0),results=[];
 const protocol={kind:'FIXED_WIDE_REGION_PIXEL_FACTOR_NOT_ACCEPTANCE',poses:factors.length,source:'already retained pib-fit-factors.json; no new orientations',dom:'hypothetical visible pH control at existing right edge, top5,height64; must be verified in actual DOM before acceptance',limits:['No browser or acceptance','No source/XYZ/threshold changes','Only fixed factor poses are regraded']};
 fs.writeFileSync(directory+'/wide-region-protocol.json',JSON.stringify(protocol,null,2)+'\n');
 const rectangles=r.views[0].domOcclusions.rectangles.map(v=>v.left===282&&v.top===210?{...v,top:5,bottom:69}:v),dom={rectangles,circles:[],modelOccluders:[]};
 for(const fit of factors){const pose={position:fit.position,quaternion:fit.quaternion,scale:fit.scale},prediction=grade(render(pose),fit.anchor,dom);delete prediction.bytes;results.push({anchor:fit.anchor,seed:fit.seed,pose,prediction});}
 fs.writeFileSync(directory+'/wide-region.json',JSON.stringify({protocol,results},null,2)+'\n');
 console.log(JSON.stringify(results.map(v=>({anchor:v.anchor,seed:v.seed,jointPrediction:v.prediction.jointPrediction,atoms:v.prediction.atoms.filter(a=>!a.pass),bonds:v.prediction.bonds.filter(b=>!b.pass)}))));
}
if(process.argv.includes('--refine')){
 const protocol={kind:'ONE_BOUNDED_PIXEL_METRIC_REFINEMENT_NOT_ACCEPTANCE',anchor:30,seeds:3,seedSelection:'three best already-retained poses by unchanged A03/A04 mesh prediction',degrees:[4,2,1,.5,.25],candidatesPerLevel:27,totalFits:405,offsets:'Cartesian product of -angle/0/+angle camera X/Y/Z, applied to the current best pose',reason:'The former centerline fraction is not the formal lane-area metric; refine with the actual unchanged area and continuous-pixel metric',limits:['No browser/PNG acceptance','No XYZ, graph, threshold or fit constraint change','No repeat or expanded campaign after this result']};
 fs.writeFileSync(directory+'/pixel-refinement-protocol.json',JSON.stringify(protocol,null,2)+'\n');
 const camera=new THREE.PerspectiveCamera(initial.camera.fov,W/H,initial.camera.near,initial.camera.far);camera.position.fromArray(initial.camera.position);camera.updateMatrixWorld(true);
 const target=initial.observation.targets.find(t=>t.target.anchor===30&&t.target.kind.startsWith('local:')).target,indices=new Set(target.atomIndices);
 for(const b of graph.bonds)if(target.atomIndices.includes(b.a)||target.atomIndices.includes(b.b)){indices.add(b.a);indices.add(b.b);}
 const input={plan:{atoms:initial.layoutAtoms,bonds:graph.bonds},camera,width:W,height:H,safeRegion:initial.fit.safeRegion,atomIndices:[...indices],requiredAtomIndices:target.atomIndices,requiredBondIndices:target.bondIndices};
 const margins=p=>[...p.atoms.map(a=>a.visibleFraction/.60),...p.bonds.flatMap(b=>[b.length/7.75,b.width/1.25,b.visiblePixels/b.requiredPixels,b.continuous/7.75])].sort((a,b)=>a-b);
 const order=(a,b)=>{const A=margins(a.prediction),B=margins(b.prediction);for(let i=0;i<A.length;i++)if(Math.abs(A[i]-B[i])>1e-12)return B[i]-A[i];return 0;};
 const seeds=rows.filter(v=>v.kind==='candidate'&&v.anchor===30).toSorted(order).slice(0,3),evaluated=[],best=[];
 for(const [seed,start]of seeds.entries()){
  let q=new THREE.Quaternion(...start.pose.quaternion);
  for(const degrees of protocol.degrees){const candidates=[];
   for(const x of [-1,0,1])for(const y of [-1,0,1])for(const z of [-1,0,1]){
    const radians=degrees*Math.PI/180,quaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(x*radians,y*radians,z*radians,'XYZ')).multiply(q),fit=fitPolymerObservation(THREE,{...input,quaternion}),pose={position:fit.position,quaternion:fit.quaternion,scale:fit.scale},model=render(pose),prediction=grade(model,30);delete prediction.bytes;
    const row={seed,startIndex:start.index,degrees,offset:[x,y,z],pose,qMin:fit.qMin,fitScore:fit.localReadability.score,prediction};candidates.push(row);evaluated.push(row);
   }
   candidates.sort(order);q.fromArray(candidates[0].pose.quaternion);
  }
  const winner=evaluated.filter(v=>v.seed===seed).toSorted(order)[0];best.push(winner);fs.writeFileSync(directory+`/pixel-refinement-${seed}-CPU.png`,png(render(winner.pose).pixels));
  console.log(JSON.stringify({seed,best:margins(winner.prediction)[0],jointPrediction:winner.prediction.jointPrediction,pose:winner.pose,missingAtoms:winner.prediction.atoms.filter(a=>!a.pass),missingBonds:winner.prediction.bonds.filter(b=>!b.pass)}));
 }
 fs.writeFileSync(directory+'/pixel-refinement.json',JSON.stringify({protocol,best,evaluated},null,2)+'\n');
}
