import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js?v=32';
import {sharedBondCurves,createSharedBonds,updateSharedBonds} from '../src/special-bonds.js?v=31';
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
    assert.equal(visual.children.filter(l=>l.visible).length,6);
    assert.equal(JSON.stringify(layout.bonds),original,'Special rendering must not mutate chemistry');
    let disposed=0;resources.forEach(r=>{r.addEventListener('dispose',()=>disposed++);r.dispose();});assert.equal(disposed,12);
  }
}
assert.equal(records.some(record=>record.id==='sulfur-hexafluoride'),false,'Production-excluded SF6 must not be required by the production visual regression');
console.log('Special geometry/display passed: production S/P geometry, SO3 plane, rotation, immutable bonds and graphics disposal.');


// Encyclopedia-only three-center resonance primitive: endpoints remain on
// center-terminal bond interiors and never create a terminal-terminal edge.
for(const record of records.filter(record=>['nitromethane','ozone'].includes(record.id))){
  const model=createPreviewModel(THREE,record);for(let i=0;i<220;i++)model.step();const layout=model.snapshot(),group=layout.sharedGroups.find(item=>['nitro','ozone'].includes(item.kind));
  assert(group,`${record.id}: supported resonance group`);const point=id=>layout.atoms[id].point,curves=sharedBondCurves(THREE,group,point,{mode:'encyclopedia'});assert.equal(curves.length,1,`${record.id}: one continuous three-center arc`);
  const curve=curves[0],center=point(group.center),ends=group.ends.map(point);assert(curve.every(p=>[p.x,p.y,p.z].every(Number.isFinite)),`${record.id}: finite three-center coordinates`);
  const expectedStart=center.clone().lerp(ends[0],.56),expectedEnd=center.clone().lerp(ends[1],.56);assert(curve[0].distanceTo(expectedStart)<1e-9,`${record.id}: arc starts on first bond midpoint region`);assert(curve.at(-1).distanceTo(expectedEnd)<1e-9,`${record.id}: arc ends on second bond midpoint region`);
  assert(curve[0].distanceTo(ends[0])>center.distanceTo(ends[0])*.3,`${record.id}: arc must not attach to first terminal O`);assert(curve.at(-1).distanceTo(ends[1])>center.distanceTo(ends[1])*.3,`${record.id}: arc must not attach to second terminal O`);
  assert(curve[0].distanceTo(ends[1])>1e-3&&curve.at(-1).distanceTo(ends[0])>1e-3,`${record.id}: arc is not a terminal-terminal direct edge`);
  assert.equal(layout.atoms.filter(atom=>[group.center,...group.ends].includes(atom.id)).some(atom=>atom.charge!==0),false,`${record.id}: Encyclopedia resonance hybrid carries no contributor-specific formal charge`);
  assert.equal(sharedBondCurves(THREE,group,point).length,4,`${record.id}: default CRAFT visual contract remains two curves per bond`);
  const alternate=structuredClone(record);for(const resonanceGroup of alternate.resonanceGroups??[]){const edges=alternate.bonds.filter(([a,b])=>(a===resonanceGroup.center&&resonanceGroup.ends.includes(b))||(b===resonanceGroup.center&&resonanceGroup.ends.includes(a)));[edges[0][2],edges[1][2]]=[edges[1][2],edges[0][2]];}
  const altModel=createPreviewModel(THREE,alternate);for(let i=0;i<220;i++)altModel.step();const alt=altModel.snapshot(),altGroup=alt.sharedGroups.find(item=>item.kind===group.kind),altCurves=sharedBondCurves(THREE,altGroup,id=>alt.atoms[id].point,{mode:'encyclopedia'});assert.equal(altCurves.length,1,`${record.id}: reversed contributor keeps same hybrid primitive`);assert(altCurves[0].every(p=>[p.x,p.y,p.z].every(Number.isFinite)),`${record.id}: reversed contributor remains finite`);
}
