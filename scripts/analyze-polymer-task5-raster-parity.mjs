// Owner: Task5 PIB recovery. Fixed captures only; NEVER GPU/visual acceptance.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {render,png,compare,grade} from './analyze-polymer-task5-exact-mesh.mjs';
import {pngPixels,maskColor} from '../tests/helpers/polymer-task5-visual.mjs';

const dir=process.argv[2];assert.ok(dir,'Provide the decompressed exact-mesh directory');
const index=JSON.parse(fs.readFileSync(dir+'/index.json'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const modes=[
  {name:'legacy4',precision:'legacy4',options:{trace:true}},
  {name:'independent-edges',precision:'legacy4',options:{exactEdges:true}},
  {name:'raw-cull',precision:'legacy4',options:{exactEdges:true,rawCull:true}},
  {name:'no-cull',precision:'legacy4',options:{exactEdges:true,noCull:true}},
  {name:'sequential32',precision:'legacy4',options:{exactEdges:true,sequential:true}},
  {name:'perspective-depth',precision:'legacy4',options:{exactEdges:true,perspectiveDepth:true}},
  {name:'grid8',precision:'shader32',options:{exactEdges:true}},
  {name:'float64',precision:'float64',options:{exactEdges:true}},
];
const protocol={kind:'FIXED_NINE_CAPTURE_RASTER_PARITY_NOT_ACCEPTANCE',captures:9,rasterModes:modes.map(({name,precision,options})=>({name,precision,options})),totalRasterBudget:72,newPoses:0,GPUExperiments:0,limits:['Captured quaternions only; historical quaternion remains NOT_CAPTURED','Finite mode comparison is a mechanism discriminator, not proof of the native compiler arithmetic','Calibration error is not an a-priori bound for unseen candidate poses','A03/A04 only; A06, pointer, local Q and clipping acceptance remain separate']};
assert.equal(index.rows.length,protocol.captures);
fs.writeFileSync(dir+'/parity-protocol.json',JSON.stringify(protocol,null,2)+'\n');

function decode(r,lookup){
  const ids=new Uint32Array(r.width*r.height);let invalid=0;
  for(let i=0;i<ids.length;i++){const j=i*r.channels,color=(r.pixels[j]<<16)|(r.pixels[j+1]<<8)|r.pixels[j+2];if(!lookup.has(color)){invalid++;ids[i]=0xffffffff;}else ids[i]=lookup.get(color);}
  return{ids,invalid};
}
function triangleAt(t,x,y){
  const {a,b,c,den}=t;if(Math.abs(den)<1e-12)return null;
  const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den,v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den,w=((a.y-b.y)*(x-b.x)+(b.x-a.x)*(y-b.y))/den;
  const distances=[u*Math.abs(den)/Math.hypot(b.x-c.x,b.y-c.y),v*Math.abs(den)/Math.hypot(c.x-a.x,c.y-a.y),w*Math.abs(den)/Math.hypot(a.x-b.x,a.y-b.y)];
  const inclusive=(a,b)=>{if(den<0)[a,b]=[b,a];return b.y<a.y||b.y===a.y&&b.x>a.x;};
  const owned=Math.min(u,v,w)>=0&&!(u===0&&!inclusive(b,c)||v===0&&!inclusive(c,a)||w===0&&!inclusive(a,b));
  const r=Math.fround,D=r(1/r(r(b.x-a.x)*r(c.y-a.y)-r(c.x-a.x)*r(b.y-a.y))),za=r(b.ndc-a.ndc),zb=r(c.ndc-a.ndc),DA=r(r(r(c.y-a.y)*za-r(b.y-a.y)*zb)*D),DB=r(r(r(b.x-a.x)*zb-r(c.x-a.x)*za)*D),z=r(r(DA*r(x-a.x)+DB*r(y-a.y))+a.ndc);
  return{triangle:t.triangle,culled:t.culled,rawDen:t.rawDen,snappedDen:den,barycentric:[u,v,w],legacyThirdWeight:1-u-v,minimumSignedEdgeDistance:Math.min(...distances),z,covered:owned,closedCoverage:Math.min(u,v,w)>=0};
}
function inspect(triangles,id,x,y){
  if(!id)return null;
  const rows=triangles.filter(t=>t.id===id).map(t=>triangleAt(t,x,y)).filter(Boolean);
  const covered=rows.filter(t=>t.covered&&!t.culled).sort((a,b)=>a.z-b.z)[0];
  const nearest=rows.toSorted((a,b)=>b.minimumSignedEdgeDistance-a.minimumSignedEdgeDistance)[0];
  return{covered:covered??null,nearest:nearest??null};
}
const rows=[];
for(const retained of index.rows){
  const rowBytes=fs.readFileSync(dir+'/'+retained.name+'.json'),row=JSON.parse(rowBytes),actualBytes=fs.readFileSync(dir+'/'+retained.name+'-id.png'),actual=pngPixels(actualBytes);
  assert.equal(sha(actualBytes),retained.maskSha256);
  const lookup=new Map([[0,0],...row.snapshot.meshes.map(m=>[maskColor(m.id),m.id])]),native=decode(actual,lookup);
  const models=modes.map(m=>{const image=render(row.snapshot,m.precision,m.options);return{...m,image,parity:compare(actual,image),grade:grade(png(image),row)};});
  const base=models[0],deltas=[],categories={},objects={};
  for(let i=0;i<native.ids.length;i++)if(native.ids[i]!==base.image.ids[i]){
    const x=i%actual.width,y=Math.floor(i/actual.width),A=native.ids[i],B=base.image.ids[i],a=inspect(base.image.triangles,A,x+.5,y+.5),b=inspect(base.image.triangles,B,x+.5,y+.5);
    const matchedModes=models.slice(1).filter(m=>m.image.ids[i]===A).map(m=>m.name);
    let mechanism;
    if(models[1].image.ids[i]===A)mechanism='triangle-coverage-edge-ownership';
    else if(models[2].image.ids[i]===A||models[3].image.ids[i]===A)mechanism='face-culling-compatible';
    else if(Math.abs(a?.nearest?.minimumSignedEdgeDistance??b?.nearest?.minimumSignedEdgeDistance??Infinity)<=1/16)mechanism='subpixel-boundary-compatible';
    else if(a?.covered&&b?.covered)mechanism='depth-interpolation-comparison-compatible';
    else mechanism='unresolved';
    categories[mechanism]=(categories[mechanism]??0)+1;
    const boundary=A===0||B===0?'background-object':'object-object';
    for(const [id,side]of [[A,'native'],[B,'cpu']]){objects[id]??={native:0,cpu:0};objects[id][side]++;}
    deltas.push({x,y,nativeId:A,cpuId:B,boundary,mechanism,matchedModes,nativeTriangles:a,cpuTriangles:b,depthDifference:a?.covered&&b?.covered?Math.abs(a.covered.z-b.covered.z):null});
  }
  const actualGrade=grade(actualBytes,row),metricDelta={atoms:actualGrade.atoms.map((a,i)=>({index:a.index,nativeFraction:a.visibleFraction,cpuFraction:base.grade.atoms[i].visibleFraction,delta:a.visibleFraction-base.grade.atoms[i].visibleFraction,nativePass:a.pass,cpuPass:base.grade.atoms[i].pass})),bonds:actualGrade.bonds.map((b,i)=>({index:b.index,nativePixels:b.visiblePixels,cpuPixels:base.grade.bonds[i].visiblePixels,areaDelta:b.visiblePixels-base.grade.bonds[i].visiblePixels,nativeContinuous:b.continuous,cpuContinuous:base.grade.bonds[i].continuous,continuousDelta:b.continuous-base.grade.bonds[i].continuous,nativePass:b.pass,cpuPass:base.grade.bonds[i].pass}))};
  const corrected=models[1],residual=[];
  for(let i=0;i<native.ids.length;i++)if(native.ids[i]!==corrected.image.ids[i]){
    const x=i%actual.width,y=Math.floor(i/actual.width),A=native.ids[i],B=corrected.image.ids[i],a=inspect(base.image.triangles,A,x+.5,y+.5),b=inspect(base.image.triangles,B,x+.5,y+.5),edge=Math.min(Math.abs(a?.nearest?.minimumSignedEdgeDistance??Infinity),Math.abs(b?.nearest?.minimumSignedEdgeDistance??Infinity));
    residual.push({x,y,nativeId:A,cpuId:B,boundary:!A||!B?'background-object':'object-object',mechanism:edge<=1/16?'subpixel-boundary-compatible':a?.covered&&b?.covered?'depth-interpolation-comparison-compatible':'unresolved',nativeTriangles:a,cpuTriangles:b,depthDifference:a?.covered&&b?.covered?Math.abs(a.covered.z-b.covered.z):null});
  }
  const correctedMetricDelta={atoms:actualGrade.atoms.map((a,i)=>({index:a.index,nativeFraction:a.visibleFraction,cpuFraction:corrected.grade.atoms[i].visibleFraction,delta:a.visibleFraction-corrected.grade.atoms[i].visibleFraction,nativePass:a.pass,cpuPass:corrected.grade.atoms[i].pass})),bonds:actualGrade.bonds.map((b,i)=>({index:b.index,nativePixels:b.visiblePixels,cpuPixels:corrected.grade.bonds[i].visiblePixels,areaDelta:b.visiblePixels-corrected.grade.bonds[i].visiblePixels,nativeContinuous:b.continuous,cpuContinuous:corrected.grade.bonds[i].continuous,continuousDelta:b.continuous-corrected.grade.bonds[i].continuous,nativePass:b.pass,cpuPass:corrected.grade.bonds[i].pass}))};
  const vertices=base.image.triangles.flatMap(t=>[t.a,t.b,t.c]),clipping={minVertexDepth:Math.min(...vertices.map(v=>v.depth)),maxVertexDepth:Math.max(...vertices.map(v=>v.depth)),near:row.snapshot.visual.camera.near,far:row.snapshot.visual.camera.far};
  rows.push({correctedResidual:residual,correctedMetricDelta,clipping,name:retained.name,anchor:row.anchor,inputSha256:sha(rowBytes),maskSha256:sha(actualBytes),invalidNativeColors:native.invalid,totalDifference:deltas.length,backgroundObject:deltas.filter(d=>d.boundary==='background-object').length,objectObject:deltas.filter(d=>d.boundary==='object-object').length,categories,objects,metricDelta,nativeJointPartial:actualGrade.jointPartialPixelPass,modes:models.map(m=>({name:m.name,parity:m.parity,jointPartial:m.grade.jointPartialPixelPass,grade:m.grade})),pixels:deltas});
  console.log(JSON.stringify({name:retained.name,mismatches:deltas.length,categories,modes:models.map(m=>[m.name,m.parity.mismatch]),targetChanges:metricDelta.bonds.filter(b=>b.areaDelta||b.continuousDelta)}));
}
fs.writeFileSync(dir+'/parity-analysis.json',JSON.stringify({protocol,rows},null,2)+'\n');
