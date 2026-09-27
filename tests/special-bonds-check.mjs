import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js?v=32';
import {RESONANCE_STYLE,sharedBondCurves,sharedOxoGroups,specialEdgeKeys,createSharedBonds,updateSharedBonds} from '../src/special-bonds.js?v=32';
import {displayedBondOrder} from '../src/aromatic-rendering.js?v=27';
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
const byId=new Map(records.map(record=>[record.id,record]));
const cases=[['sulfur-dioxide',[117]],['sulfur-trioxide',[120,120,120]],['phosphoric-acid',Array(6).fill(109.47)],['sulfuric-acid',Array(6).fill(109.47)],['phosphorus-pentachloride',[...Array(6).fill(90),120,120,120,180]]];
for(const[id,expected]of cases){
  const record=byId.get(id),model=createPreviewModel(THREE,record);
  for(let i=0;i<220;i++)model.step();const layout=model.snapshot(),center=layout.atoms[0].point;
  const ns=record.bonds.filter(b=>b[0]===0).map(b=>layout.atoms[b[1]].point.clone().sub(center)),angles=[];
  for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++)angles.push(ns[i].angleTo(ns[j])*180/Math.PI);
  angles.sort((a,b)=>a-b);expected.sort((a,b)=>a-b);angles.forEach((a,i)=>assert.ok(Math.abs(a-expected[i])<1,`${id}: ${angles}`));
}
assert.equal(byId.has('sulfur-hexafluoride'),false,'Production-excluded SF6 must not be required by the production visual regression');

function assertDistributedBondContract(label,curves,center,ends){
  assert.equal(curves.length,ends.length,`${label}: one auxiliary component per supported center-terminal bond`);
  curves.forEach((curve,index)=>{
    assert.equal(curve.length,2,`${label}: branch ${index} has a single straight parallel component`);
    const axis=ends[index].clone().sub(center),length=axis.length(),lengthSq=axis.lengthSq();
    for(const point of curve){
      assert([point.x,point.y,point.z].every(Number.isFinite),`${label}: finite distributed-bond coordinates`);
      const relative=point.clone().sub(center),t=relative.dot(axis)/lengthSq,closest=center.clone().addScaledVector(axis,t),offset=point.distanceTo(closest);
      assert(t>.18&&t<.82,`${label}: branch ${index} remains inside its center-terminal bond span`);
      assert(offset>length*.02&&offset<length*.18,`${label}: branch ${index} is a parallel auxiliary line, not the main bond`);
    }
    assert(curve[0].distanceTo(ends[index])>length*.3&&curve.at(-1).distanceTo(ends[index])>length*.2,`${label}: branch ${index} does not attach to terminal atom`);
  });
}

for(const record of records.filter(item=>['nitromethane','ozone','sulfur-dioxide','sulfur-trioxide','sulfuric-acid'].includes(item.id))){
  const model=createPreviewModel(THREE,record);for(let i=0;i<220;i++)model.step();const layout=model.snapshot();
  const group=layout.sharedGroups.find(item=>['nitro','ozone','sulfur-oxo'].includes(item.kind));assert(group,`${record.id}: structural shared-bond group`);
  const point=id=>layout.atoms[id].point,center=point(group.center),ends=group.ends.map(point),expected=record.id==='sulfur-trioxide'?3:2,original=JSON.stringify(layout.bonds);
  assert.equal(group.ends.length,expected,`${record.id}: expected special branch count`);
  const encyclopedia=sharedBondCurves(THREE,group,point,{mode:'encyclopedia'}),craft=sharedBondCurves(THREE,group,point,{mode:'craft'});
  assertDistributedBondContract(`${record.id} Encyclopedia`,encyclopedia,center,ends);assertDistributedBondContract(`${record.id} CRAFT`,craft,center,ends);
  encyclopedia.forEach((curve,i)=>curve.forEach((p,j)=>assert(p.distanceTo(craft[i][j])<1e-9,`${record.id}: CRAFT and Encyclopedia share geometry`)));
  const edges=specialEdgeKeys([group]);assert.equal(edges.size,expected,`${record.id}: all special edges have one base stroke`);
  for(const bond of layout.bonds.filter(item=>edges.has(`${Math.min(item.a,item.b)}:${Math.max(item.a,item.b)}`)))assert.equal(displayedBondOrder(bond,edges),1,`${record.id}: order-2 constitutional edge gets a single solid base stroke`);
  const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,2,3).normalize(),.7),rotated=sharedBondCurves(THREE,group,id=>point(id).clone().applyQuaternion(rotation),{mode:'encyclopedia'});
  encyclopedia.forEach((curve,i)=>curve.forEach((p,j)=>assert(p.clone().applyQuaternion(rotation).distanceTo(rotated[i][j])<1e-9,`${record.id}: display follows molecule rotation`)));
  const resources=[],visual=createSharedBonds(THREE,x=>{resources.push(x);return x;},{mode:'encyclopedia'});updateSharedBonds(THREE,visual,group,point,{mode:'encyclopedia'});
  assert.equal(visual.children.filter(mesh=>mesh.visible).length,RESONANCE_STYLE.dashCount*expected,`${record.id}: one full dashed sequence per branch`);
  assert.equal(visual.children.some(mesh=>mesh.userData.sharedOxoLine),false,'Legacy curved shared-oxo bands are absent');
  const visible=visual.children.filter(mesh=>mesh.userData.distributedBondComponent&&mesh.visible);
  assert.equal(visible.length,RESONANCE_STYLE.dashCount*expected);
  for(let branch=0;branch<expected;branch++)assert.equal(visible.filter(mesh=>mesh.userData.distributedBondBranch===branch).length,RESONANCE_STYLE.dashCount);
  if(group.kind==='sulfur-oxo')assert(visible.every(mesh=>mesh.userData.resonanceVisual==null),'Sulfur distributed visual must not be labelled as resonance');
  else assert(visible.every(mesh=>mesh.userData.resonanceVisual==='distributed-bond-component'),'Nitro / ozone retain resonance component compatibility metadata');
  visible.forEach(mesh=>{assert.equal(mesh.userData.distributedBondStyle,'distributed-dashed');assert.equal(mesh.userData.distributedBondLineWidth,'bond');assert.equal(mesh.material.color.getHex(),RESONANCE_STYLE.color);assert.equal(mesh.material.opacity,RESONANCE_STYLE.opacity);assert.equal(mesh.scale.x,RESONANCE_STYLE.encyclopediaRadius);assert(mesh.scale.y>0&&Number.isFinite(mesh.scale.y));});
  assert.equal(JSON.stringify(layout.bonds),original,'Special rendering must not mutate constitutional graph or bond order');
  let disposed=0;resources.forEach(resource=>{resource.addEventListener('dispose',()=>disposed++);resource.dispose();});assert.equal(disposed,24);
}

for(const id of ['dimethyl-sulfoxide','phosphoric-acid']){
  const record=byId.get(id),groups=sharedOxoGroups({atoms:record.atoms.map((element,id)=>({id,element})),bonds:record.bonds.map(([a,b,order])=>({a,b,order}))});
  assert.equal(groups.some(group=>group.kind==='sulfur-oxo'||group.kind==='nitro'||group.kind==='ozone'),false,`${id}: negative control has no distributed motif`);
}
for(const [id,count,attribute]of [['nitromethane',2,'data-resonance-distributed-bond="true"'],['ozone',2,'data-resonance-distributed-bond="true"'],['sulfur-dioxide',2,'data-distributed-bond="true"'],['sulfur-trioxide',3,'data-distributed-bond="true"'],['sulfuric-acid',2,'data-distributed-bond="true"']]){
  const svg=await readFile(new URL(`../assets/models/molecule-${id}.svg`,import.meta.url),'utf8'),paths=[...svg.matchAll(/<path([^>]*)>/g)].filter(match=>match[1].includes(attribute));
  assert.equal(paths.length,count,`${id}: generated preview has ${count} matching neutral/distributed branches`);
  for(const path of paths){const d=path[1].match(/\sd="([^"]+)"/)?.[1]??'';assert.equal((d.match(/L/g)??[]).length,1,`${id}: each generated auxiliary branch is one straight, non-curved component`);assert.doesNotMatch(d,/[CQ]/,`${id}: no legacy curved-band path`);}
  if(id.startsWith('sulfur'))assert.doesNotMatch(svg,/data-resonance-distributed-bond="true"/,'sulfur asset carries neutral distributed-bond metadata');
}
for(const id of ['dimethyl-sulfoxide','phosphoric-acid']){const svg=await readFile(new URL(`../assets/models/molecule-${id}.svg`,import.meta.url),'utf8');assert.doesNotMatch(svg,/data-distributed-bond="true"|data-resonance-distributed-bond="true"/,`${id}: generated negative-control asset stays generic`);}
console.log('Special geometry/display passed: nitro, ozone and sulfur oxo use the same rotatable parallel dashed grammar; SO3 renders three branches, with no sulfur resonance metadata or curved bands.');
