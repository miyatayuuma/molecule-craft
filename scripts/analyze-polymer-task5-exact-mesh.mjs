// Owner: Task5 PIB recovery. Offline calibration of actual production transforms.
// No orientation search, threshold changes or browser acceptance.
import fs from 'node:fs';
import {deflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three/three.module.min.js';
import {pngPixels,maskColor,rasterLayers,continuousLanes} from '../tests/helpers/polymer-task5-visual.mjs';

const dir=process.argv[2];assert.ok(dir,'Provide the exact-mesh artifact directory');
const index=JSON.parse(fs.readFileSync(dir+'/index.json'));
const base=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/',import.meta.url);
const conflict=JSON.parse(fs.readFileSync(new URL('pib-visibility-conflict.json',base)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const round=Math.fround;

function render(snapshot,precision){
  const v=snapshot.visual,W=v.canvas.bufferWidth,H=v.canvas.bufferHeight;
  const ids=new Uint32Array(W*H),depths=new Float64Array(W*H).fill(Infinity);
  const inverse=new THREE.Matrix4().fromArray(v.camera.matrix).invert(),projection=new THREE.Matrix4().fromArray(v.camera.projection);
  const mul=(m,p)=>{const a=m.elements;return [0,1,2,3].map(i=>precision!=='float64'?round(round(round(round(a[i])*p[0])+round(round(a[i+4])*p[1]))+round(round(round(a[i+8])*p[2])+round(a[i+12])*p[3])):a[i]*p[0]+a[i+4]*p[1]+a[i+8]*p[2]+a[i+12]*p[3]);};
  for(const mesh of snapshot.meshes){
    if(!mesh.visible)continue;
    const g=snapshot.geometries[mesh.geometry],matrix=inverse.clone().multiply(new THREE.Matrix4().fromArray(mesh.matrixWorld)),vertices=[];
    for(let i=0;i<g.positions.length;i+=3){const c=mul(matrix,[...g.positions.slice(i,i+3),1]),p=mul(projection,c),x=(p[0]/p[3]+1)*W/2,y=(1-p[1]/p[3])*H/2;vertices.push({x:precision!=='float64'?Math.round(x*(precision==='legacy4'?16:256))/(precision==='legacy4'?16:256):x,y:precision!=='float64'?Math.round(y*(precision==='legacy4'?16:256))/(precision==='legacy4'?16:256):y,depth:-c[2],ndc:round(round(round(p[2]+p[3])*.5)/p[3])});}
    for(let k=0;k<g.indices.length;k+=3){const a=vertices[g.indices[k]],b=vertices[g.indices[k+1]],c=vertices[g.indices[k+2]],den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(den)<1e-12||mesh.materialSide===0&&den>=0||mesh.materialSide===1&&den<=0)continue;
      const r=round,D=r(1/r(r(b.x-a.x)*r(c.y-a.y)-r(c.x-a.x)*r(b.y-a.y))),za=r(b.ndc-a.ndc),zb=r(c.ndc-a.ndc),DA=r(r(r(c.y-a.y)*za-r(b.y-a.y)*zb)*D),DB=r(r(r(b.x-a.x)*zb-r(c.x-a.x)*za)*D);
      const minX=Math.max(0,Math.ceil(Math.min(a.x,b.x,c.x)-.5)),maxX=Math.min(W-1,Math.floor(Math.max(a.x,b.x,c.x)-.5)),minY=Math.max(0,Math.ceil(Math.min(a.y,b.y,c.y)-.5)),maxY=Math.min(H-1,Math.floor(Math.max(a.y,b.y,c.y)-.5));
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const u=((b.y-c.y)*(x+.5-c.x)+(c.x-b.x)*(y+.5-c.y))/den,w1=((c.y-a.y)*(x+.5-c.x)+(a.x-c.x)*(y+.5-c.y))/den,w2=1-u-w1;if(u<0||w1<0||w2<0)continue;const inclusive=(a,b)=>{if(den<0)[a,b]=[b,a];return b.y<a.y||b.y===a.y&&b.x>a.x;};if(u===0&&!inclusive(b,c)||w1===0&&!inclusive(c,a)||w2===0&&!inclusive(a,b))continue;const d=1/(u/a.depth+w1/b.depth+w2/c.depth),z=precision==='float64'?d:r(r(DA*r(x+.5-a.x)+DB*r(y+.5-a.y))+a.ndc),i=y*W+x;if(d>v.camera.near&&d<v.camera.far&&z<=depths[i]){depths[i]=z;ids[i]=mesh.id;}}
    }
  }
  const pixels=Buffer.alloc(W*H*3);for(let i=0;i<ids.length;i++){const color=ids[i]?maskColor(ids[i]):0;pixels[i*3]=color>>16;pixels[i*3+1]=color>>8;pixels[i*3+2]=color;}
  return{pixels,ids,width:W,height:H,channels:3};
}
function png(r){
  const crc=data=>{let c=0xffffffff;for(const b of data){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
  const chunk=(kind,data)=>{const head=Buffer.alloc(8);head.writeUInt32BE(data.length);head.write(kind,4);const body=Buffer.concat([Buffer.from(kind),data]),tail=Buffer.alloc(4);tail.writeUInt32BE(crc(body));return Buffer.concat([head,data,tail]);};
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(r.width);ihdr.writeUInt32BE(r.height,4);ihdr[8]=8;ihdr[9]=2;const raw=Buffer.alloc(r.height*(r.width*3+1));for(let y=0;y<r.height;y++)r.pixels.copy(raw,y*(r.width*3+1)+1,y*r.width*3,(y+1)*r.width*3);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
function compare(a,b){assert.equal(a.width,b.width);assert.equal(a.height,b.height);let mismatch=0,union=0;const objects=new Map();for(let i=0;i<a.width*a.height;i++){const color=r=>(r.pixels[i*r.channels]<<16)|(r.pixels[i*r.channels+1]<<8)|r.pixels[i*r.channels+2],A=color(a),B=color(b);if(A||B){union++;if(A!==B){mismatch++;objects.set(A,(objects.get(A)??0)+1);}}}return{mismatch,union,ratio:mismatch/union,actualOwnersOfMismatch:Object.fromEntries(objects)};}
function grade(bytes,row){
  const v=row.snapshot.visual,group=conflict.groups.find(g=>g.anchor===row.anchor),view={canvas:v.canvas,lanes:v.lanes,domOcclusions:row.domOcclusions};
  const {counts,photometryMask}=rasterLayers(bytes,view),dpr=v.canvas.dpr;
  const atoms=group.atomIndices.map(index=>{const a=v.atoms[index],visibleFraction=(counts.get(maskColor(index+1))??0)/(Math.PI*(a.radius*dpr)**2);return{index,visibleFraction,diameter:2*a.radius,pass:visibleFraction>=.60&&2*a.radius>=(a.element==='H'?6:10)-.5};});
  const bonds=group.bondIndices.map(index=>{const lane=v.lanes.find(l=>l.bondIndex===index),length=Math.hypot(lane.b.x-lane.a.x,lane.b.y-lane.a.y),width=2*lane.radius,visiblePixels=counts.get(maskColor(1024+v.lanes.indexOf(lane)))??0,continuous=continuousLanes(view,[lane],photometryMask),requiredPixels=length*width*dpr*dpr*.50;return{index,length,width,visiblePixels,requiredPixels,continuous,pass:length>=7.75&&width>=1.25&&visiblePixels>=requiredPixels&&continuous>=7.75};});
  return{atoms,bonds,jointPartialPixelPass:atoms.every(a=>a.pass)&&bonds.every(b=>b.pass)};
}
const rows=[];
for(const retained of index.rows){
  const bytes=fs.readFileSync(dir+'/'+retained.name+'.json'),row=JSON.parse(bytes),actualBytes=fs.readFileSync(dir+'/'+row.name+'-id.png'),actual=pngPixels(actualBytes),measurements={};
  assert.equal(sha(actualBytes),retained.maskSha256);
  const v=row.snapshot.visual,inverse=new THREE.Matrix4().fromArray(v.camera.matrix).invert(),projection=new THREE.Matrix4().fromArray(v.camera.projection),project=p=>{const c=p.clone().applyMatrix4(inverse),n=c.clone().applyMatrix4(projection);return{x:(n.x+1)*v.canvas.width/2,y:(1-n.y)*v.canvas.height/2,depth:-c.z};};
  let maxProjectionError=0,maxMatrixError=0;
  for(const mesh of row.snapshot.meshes){
    const local=new THREE.Matrix4().compose(new THREE.Vector3(...mesh.position),new THREE.Quaternion(...mesh.quaternion),new THREE.Vector3(...mesh.scale)),world=new THREE.Matrix4().fromArray(row.snapshot.groupMatrix).multiply(local);
    maxMatrixError=Math.max(maxMatrixError,...world.elements.map((n,i)=>Math.abs(n-mesh.matrixWorld[i])),...local.elements.map((n,i)=>Math.abs(n-mesh.matrix[i])));
    const matrix=new THREE.Matrix4().fromArray(mesh.matrixWorld),pairs=mesh.kind==='atom'?[[new THREE.Vector3(),v.atoms.find(a=>a.index===mesh.index).center]]:[[new THREE.Vector3(0,-.5,0),v.lanes.find(l=>l.bondIndex===mesh.index).a],[new THREE.Vector3(0,.5,0),v.lanes.find(l=>l.bondIndex===mesh.index).b]];
    for(const [local,actual]of pairs){const p=project(local.applyMatrix4(matrix));maxProjectionError=Math.max(maxProjectionError,...['x','y','depth'].map(k=>Math.abs(p[k]-actual[k])));}
  }
  assert.ok(maxMatrixError<1e-10&&maxProjectionError<1e-6,'captured actual mesh matrices reproduce production projection');

  for(const mode of ['float64','shader32','legacy4']){const model=render(row.snapshot,mode),cpu=png(model);fs.writeFileSync(dir+'/'+row.name+'-'+mode+'-CPU.png',cpu);measurements[mode]={parity:compare(actual,model),grade:grade(cpu,row)};}
  rows.push({name:row.name,anchor:row.anchor,kind:row.kind,transformSha256:sha(bytes),maxProjectionError,maxMatrixError,historicalQuaternion:'NOT_CAPTURED',originalMaskComparison:row.oldMask?compare(pngPixels(fs.readFileSync(new URL(row.oldMask,base))),actual):null,actualMeshGrade:grade(actualBytes,row),measurements});
}
const production=JSON.parse(fs.readFileSync(dir+'/production-before-replay.json'));
const report={kind:'EXACT_MESH_DIAGNOSTIC_NOT_ACCEPTANCE',protocol:index.protocol,actualAtomLocalQuaternions:production.meshes.filter(m=>m.kind==='atom').map(m=>({index:m.index,quaternion:m.quaternion})),cpuModes:['float64 perspective triangle depth','shader32 uniform/vertex arithmetic and documented 1/256 subpixel grid','documented SWIFTSHADER_LEGACY_PRECISION 1/16 subpixel grid (build flag not captured)' ],limits:['Historical quaternion is unobservable from the saved JSON; no assertion of exact historical tessellation reproduction','Current actual mesh transforms are authoritative for their own nine captures','A03/A04 partial measurements only; no A06, pointer or production acceptance','Neither shader arithmetic variant is claimed to reproduce the uncaptured exact ANGLE/SPIR-V build; the 4-bit mode is a documented compile option, not a formal GPU calibration pass'],rows};
fs.writeFileSync(dir+'/analysis.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({name:r.name,originalDifference:r.originalMaskComparison?.ratio,actualPartial:r.actualMeshGrade.jointPartialPixelPass,missingAtoms:r.actualMeshGrade.atoms.filter(a=>!a.pass),missingBonds:r.actualMeshGrade.bonds.filter(b=>!b.pass),cpu:Object.fromEntries(Object.entries(r.measurements).map(([k,v])=>[k,{parity:v.parity,partial:v.grade.jointPartialPixelPass}]))})),null,2));
