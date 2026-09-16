import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js?v=32';
import {RESONANCE_STYLE,sharedBondCurves,createSharedBonds,updateSharedBonds} from '../src/special-bonds.js?v=32';
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
const cases=[['sulfur-dioxide',[117]],['sulfur-trioxide',[120,120,120]],['phosphoric-acid',Array(6).fill(109.47)],['sulfuric-acid',Array(6).fill(109.47)],['phosphorus-pentachloride',[...Array(6).fill(90),120,120,120,180]]];
for(const[id,expected]of cases){
  const record=records.find(r=>r.id===id),model=createPreviewModel(THREE,record);
  for(let i=0;i<220;i++)model.step();const layout=model.snapshot(),center=layout.atoms[0].point;
  const ns=record.bonds.filter(b=>b[0]===0).map(b=>layout.atoms[b[1]].point.clone().sub(center)),angles=[];
  for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++)angles.push(ns[i].angleTo(ns[j])*180/Math.PI);
  angles.sort((a,b)=>a-b);expected.sort((a,b)=>a-b);angles.forEach((a,i)=>assert.ok(Math.abs(a-expected[i])<1,`${id}: ${angles}`));
  if(id==='sulfur-trioxide'){
    const normal=new THREE.Vector3().crossVectors(ns[0],ns[1]).normalize();assert.ok(Math.abs(ns[2].dot(normal))<1e-5,'SO3 must be planar');
    const group=layout.sharedGroups[0],point=id=>layout.atoms[id].point,original=JSON.stringify(layout.bonds);
    const curves=sharedBondCurves(THREE,group,point),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,2,3).normalize(),.7);
    const rotated=sharedBondCurves(THREE,group,id=>point(id).clone().applyQuaternion(q));
    curves.forEach((curve,i)=>curve.forEach((p,j)=>assert.ok(p.clone().applyQuaternion(q).distanceTo(rotated[i][j])<1e-9,'Shared display must follow molecule, not camera')));
    const resources=[],visual=createSharedBonds(THREE,x=>{resources.push(x);return x;});updateSharedBonds(THREE,visual,group,point);
    assert.equal(visual.children.filter(l=>l.userData.sharedOxoLine&&l.visible).length,6);
    assert.equal(JSON.stringify(layout.bonds),original,'Special rendering must not mutate chemistry');
    let disposed=0;resources.forEach(r=>{r.addEventListener('dispose',()=>disposed++);r.dispose();});assert.equal(disposed,28);
  }
}
assert.equal(records.some(record=>record.id==='sulfur-hexafluoride'),false,'Production-excluded SF6 must not be required by the production visual regression');

// Nitro / ozone resonance hybrids use two weak second-bond components. Each
// component belongs to exactly one center-terminal bond; there is no terminal-
// terminal path and the geometry is contributor-order independent in meaning.
function assertDistributedBondContract(label,curves,center,ends){
  assert.equal(curves.length,2,`${label}: exactly one auxiliary line per center-terminal bond`);
  curves.forEach((curve,index)=>{
    assert(curve.length>=2,`${label}: branch ${index} has drawable geometry`);
    const axis=ends[index].clone().sub(center),length=axis.length(),lengthSq=axis.lengthSq();
    for(const point of curve){
      assert([point.x,point.y,point.z].every(Number.isFinite),`${label}: finite distributed-bond coordinates`);
      const relative=point.clone().sub(center),t=relative.dot(axis)/lengthSq,closest=center.clone().addScaledVector(axis,t),offset=point.distanceTo(closest);
      assert(t>.18&&t<.82,`${label}: branch ${index} remains inside its center-terminal bond span`);
      assert(offset>length*.02&&offset<length*.18,`${label}: branch ${index} is a parallel auxiliary line, not the main bond`);
    }
    assert(curve[0].distanceTo(ends[index])>length*.3&&curve.at(-1).distanceTo(ends[index])>length*.2,`${label}: branch ${index} does not attach to terminal O`);
  });
}
for(const record of records.filter(record=>['nitromethane','ozone'].includes(record.id))){
  const model=createPreviewModel(THREE,record);for(let i=0;i<220;i++)model.step();const layout=model.snapshot(),group=layout.sharedGroups.find(item=>['nitro','ozone'].includes(item.kind));
  assert(group,`${record.id}: supported resonance group`);const point=id=>layout.atoms[id].point,center=point(group.center),ends=group.ends.map(point);
  const encyclopedia=sharedBondCurves(THREE,group,point,{mode:'encyclopedia'}),craft=sharedBondCurves(THREE,group,point,{mode:'craft'});
  assertDistributedBondContract(`${record.id} Encyclopedia`,encyclopedia,center,ends);assertDistributedBondContract(`${record.id} CRAFT`,craft,center,ends);
  encyclopedia.forEach((curve,i)=>curve.forEach((point,j)=>assert(point.distanceTo(craft[i][j])<1e-9,`${record.id}: CRAFT and Encyclopedia share the same resonance geometry`)));
  assert.equal(layout.atoms.filter(atom=>[group.center,...group.ends].includes(atom.id)).some(atom=>atom.charge!==0),false,`${record.id}: normal resonance hybrid carries no contributor-specific formal charge`);
  const resources=[],visual=createSharedBonds(THREE,x=>{resources.push(x);return x;},{mode:'encyclopedia'});updateSharedBonds(THREE,visual,group,point,{mode:'encyclopedia'});
  const visible=visual.children.filter(mesh=>mesh.userData.resonanceVisual==='distributed-bond-component'&&mesh.visible);assert.equal(visible.length,RESONANCE_STYLE.dashCount*2,`${record.id}: renderer exposes thick dash segments on both auxiliary bonds`);
  for(const branch of [0,1])assert.equal(visible.filter(mesh=>mesh.userData.resonanceBranch===branch).length,RESONANCE_STYLE.dashCount,`${record.id}: each branch has a complete dash sequence`);
  visible.forEach(mesh=>{assert.equal(mesh.userData.resonanceStyle,'distributed-dashed');assert.equal(mesh.userData.resonanceLineWidth,'bond');assert.equal(mesh.material.color.getHex(),RESONANCE_STYLE.color);assert.equal(mesh.material.opacity,RESONANCE_STYLE.opacity);assert.equal(mesh.scale.x,RESONANCE_STYLE.encyclopediaRadius);assert(mesh.scale.y>0&&Number.isFinite(mesh.scale.y),`${record.id}: finite visible dash length`);});
  let disposed=0;resources.forEach(resource=>{resource.addEventListener('dispose',()=>disposed++);resource.dispose();});assert.equal(disposed,28);
  const alternate=structuredClone(record);for(const resonanceGroup of alternate.resonanceGroups??[]){const edges=alternate.bonds.filter(([a,b])=>(a===resonanceGroup.center&&resonanceGroup.ends.includes(b))||(b===resonanceGroup.center&&resonanceGroup.ends.includes(a)));[edges[0][2],edges[1][2]]=[edges[1][2],edges[0][2]];}
  const altModel=createPreviewModel(THREE,alternate);for(let i=0;i<220;i++)altModel.step();const alt=altModel.snapshot(),altGroup=alt.sharedGroups.find(item=>item.kind===group.kind),altPoint=id=>alt.atoms[id].point;
  const altCurves=sharedBondCurves(THREE,altGroup,altPoint,{mode:'encyclopedia'});assertDistributedBondContract(`${record.id} reversed contributor`,altCurves,altPoint(altGroup.center),altGroup.ends.map(altPoint));
}
console.log('Special geometry/display passed: sulfur oxo contract preserved; nitro/ozone use two bond-local distributed resonance components with no terminal-terminal edge.');
