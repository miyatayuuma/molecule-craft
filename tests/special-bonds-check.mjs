import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js?v=31';
import {sharedBondCurves,createSharedBonds,updateSharedBonds} from '../src/special-bonds.js?v=30';
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
const cases=[['sulfur-dioxide',[117]],['sulfur-trioxide',[120,120,120]],['phosphoric-acid',Array(6).fill(109.47)],['sulfuric-acid',Array(6).fill(109.47)],['phosphorus-pentachloride',[...Array(6).fill(90),120,120,120,180]],['sulfur-hexafluoride',[...Array(12).fill(90),180,180,180]]];
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
    assert.equal(visual.children.filter(l=>l.visible).length,6);
    assert.equal(JSON.stringify(layout.bonds),original,'Special rendering must not mutate chemistry');
    let disposed=0;resources.forEach(r=>{r.addEventListener('dispose',()=>disposed++);r.dispose();});assert.equal(disposed,12);
  }
}
console.log('Special geometry/display passed: all pair angles, SO3 plane, rotation, immutable bonds and graphics disposal.');
