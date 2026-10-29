import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js?v=35';
import {RESONANCE_STYLE,SULFUR_OXO_STYLE,sharedBondCurves,sulfurOxoBondAxes,sharedOxoGroups,specialEdgeKeys,createSharedBonds,updateSharedBonds} from '../src/special-bonds.js?v=34';
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

function assertResonanceCurves(label,curves,center,ends){
  assert.equal(curves.length,ends.length,`${label}: one dashed contributor component per branch`);
  curves.forEach((curve,index)=>{
    assert.equal(curve.length,2,`${label}: branch ${index} stays a straight dashed component`);
    const axis=ends[index].clone().sub(center),lengthSq=axis.lengthSq();
    for(const point of curve){
      assert([point.x,point.y,point.z].every(Number.isFinite),`${label}: finite component coordinates`);
      const relative=point.clone().sub(center),t=relative.dot(axis)/lengthSq,closest=center.clone().addScaledVector(axis,t),offset=point.distanceTo(closest);
      assert(t>.18&&t<.82,`${label}: branch ${index} remains inside the center-terminal span`);
      assert(offset>axis.length()*.02&&offset<axis.length()*.18,`${label}: branch ${index} is parallel to, but separate from, the bond axis`);
    }
  });
}
function assertSulfurHaloAxes(label,axes,center,ends){
  assert.equal(axes.length,ends.length,`${label}: one halo sleeve per terminal S–O branch`);
  axes.forEach(({branch,start,end},index)=>{
    assert.equal(branch,index,`${label}: stable terminal branch identity`);
    const axis=ends[index].clone().sub(center),lengthSq=axis.lengthSq();
    for(const point of [start,end]){
      assert([point.x,point.y,point.z].every(Number.isFinite),`${label}: finite halo endpoint`);
      const relative=point.clone().sub(center),t=relative.dot(axis)/lengthSq,closest=center.clone().addScaledVector(axis,t);
      assert(Math.abs(point.distanceTo(closest))<1e-9,`${label}: halo is centered on the S–O bond axis`);
      assert(t>.19&&t<.81,`${label}: halo stays between the atoms and cannot read as a second bond`);
    }
    const startT=start.clone().sub(center).dot(axis)/lengthSq,endT=end.clone().sub(center).dot(axis)/lengthSq;
    assert(Math.abs(startT-SULFUR_OXO_STYLE.spanStart)<1e-9&&Math.abs(endT-SULFUR_OXO_STYLE.spanEnd)<1e-9,`${label}: stable qualitative sleeve span`);
  });
}

const ids=['nitromethane','ozone','sulfur-dioxide','sulfur-trioxide','sulfuric-acid'];
for(const record of records.filter(item=>ids.includes(item.id))){
  const model=createPreviewModel(THREE,record);for(let i=0;i<220;i++)model.step();const layout=model.snapshot();
  const group=layout.sharedGroups.find(item=>['nitro','ozone','sulfur-oxo'].includes(item.kind));assert(group,`${record.id}: structural shared-bond group`);
  const point=id=>layout.atoms[id].point,center=point(group.center),ends=group.ends.map(point),expected=record.id==='sulfur-trioxide'?3:2,original=JSON.stringify(layout.bonds);
  assert.equal(group.ends.length,expected,`${record.id}: expected special branch count`);
  if(record.id==='sulfuric-acid')assert.equal(group.hydroxyls.length,2,'Neutral H₂SO₄ has two S–OH branches outside the sulfur-oxo halo authority');
  const curves=sharedBondCurves(THREE,group,point,{mode:'encyclopedia'}),craft=sharedBondCurves(THREE,group,point,{mode:'craft'}),axes=sulfurOxoBondAxes(THREE,group,point);
  if(group.kind==='sulfur-oxo'){
    assert.equal(curves.length,0,`${record.id}: sulfur oxo never receives the parallel dashed grammar`);
    assertSulfurHaloAxes(`${record.id} halo`,axes,center,ends);
    const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,2,3).normalize(),.7),rotated=sulfurOxoBondAxes(THREE,group,id=>point(id).clone().applyQuaternion(rotation));
    axes.forEach((axis,index)=>{for(const key of ['start','end'])assert(axis[key].clone().applyQuaternion(rotation).distanceTo(rotated[index][key])<1e-9,`${record.id}: halo follows molecule rotation`);});
  }else{
    assert.equal(axes.length,0,`${record.id}: Nitro / Ozone never receive sulfur halos`);
    assertResonanceCurves(`${record.id} resonance`,curves,center,ends);assertResonanceCurves(`${record.id} CRAFT resonance`,craft,center,ends);
    curves.forEach((curve,i)=>curve.forEach((p,j)=>assert(p.distanceTo(craft[i][j])<1e-9,`${record.id}: CRAFT and Encyclopedia share resonance geometry`)));
    const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,2,3).normalize(),.7),rotated=sharedBondCurves(THREE,group,id=>point(id).clone().applyQuaternion(rotation),{mode:'encyclopedia'});
    curves.forEach((curve,i)=>curve.forEach((p,j)=>assert(p.clone().applyQuaternion(rotation).distanceTo(rotated[i][j])<1e-9,`${record.id}: resonance visual follows molecule rotation`)));
  }
  const edges=specialEdgeKeys([group]);assert.equal(edges.size,expected,`${record.id}: every marked S–O edge has one ordinary base bond`);
  for(const bond of layout.bonds.filter(item=>edges.has(`${Math.min(item.a,item.b)}:${Math.max(item.a,item.b)}`)))assert.equal(displayedBondOrder(bond,edges),1,`${record.id}: visual metadata does not add a constitutional bond line`);
  const resources=[],visual=createSharedBonds(THREE,x=>{resources.push(x);return x;},{mode:'encyclopedia'});updateSharedBonds(THREE,visual,group,point,{mode:'encyclopedia'});
  const visibleDashes=visual.children.filter(mesh=>mesh.userData.distributedBondComponent&&mesh.visible),visibleHalos=visual.children.filter(mesh=>mesh.userData.sulfurOxoHalo&&mesh.visible);
  assert.equal(visual.children.some(mesh=>mesh.userData.sharedOxoLine),false,'Legacy curved shared-oxo bands are absent');
  if(group.kind==='sulfur-oxo'){
    assert.equal(visibleDashes.length,0,`${record.id}: no sulfur parallel dashed paths`);assert.equal(visibleHalos.length,expected,`${record.id}: one visible halo mesh per terminal S–O`);
    visibleHalos.forEach(mesh=>{assert.equal(mesh.userData.sulfurOxoStyle,'bond-axis-halo');assert(group.ends.includes(mesh.userData.sulfurOxoAtomId),`${record.id}: only group terminal S–O atom ids receive a halo`);assert(!group.hydroxyls?.includes(mesh.userData.sulfurOxoAtomId),`${record.id}: S–OH never receives a halo`);assert.equal(mesh.geometry.parameters.openEnded,true);assert.equal(mesh.material.color.getHex(),SULFUR_OXO_STYLE.color);assert.equal(mesh.material.opacity,SULFUR_OXO_STYLE.opacity);assert.equal(mesh.userData.resonanceVisual,undefined);assert.equal(mesh.scale.x,SULFUR_OXO_STYLE.encyclopediaRadius);assert(mesh.scale.y>0&&Number.isFinite(mesh.scale.y));});
  }else{
    assert.equal(visibleHalos.length,0,`${record.id}: no sulfur halos on resonance structures`);assert.equal(visibleDashes.length,RESONANCE_STYLE.dashCount*expected,`${record.id}: existing resonance dash count unchanged`);
    visibleDashes.forEach(mesh=>{assert.equal(mesh.userData.resonanceVisual,'distributed-bond-component');assert.equal(mesh.userData.distributedBondStyle,'distributed-dashed');assert.equal(mesh.userData.distributedBondLineWidth,'bond');assert.equal(mesh.material.color.getHex(),RESONANCE_STYLE.color);assert.equal(mesh.material.opacity,RESONANCE_STYLE.opacity);assert.equal(mesh.scale.x,RESONANCE_STYLE.encyclopediaRadius);});
  }
  assert.equal(JSON.stringify(layout.bonds),original,'Special rendering must not mutate constitutional graph or bond order');
  let disposed=0;resources.forEach(resource=>{resource.addEventListener('dispose',()=>disposed++);resource.dispose();});assert.equal(disposed,30,'All dash and sleeve geometry/material resources are disposed');
}

for(const id of ['dimethyl-sulfoxide','phosphoric-acid']){
  const record=byId.get(id),groups=sharedOxoGroups({atoms:record.atoms.map((element,id)=>({id,element})),bonds:record.bonds.map(([a,b,order])=>({a,b,order}))});
  assert.equal(groups.some(group=>group.kind==='sulfur-oxo'||group.kind==='nitro'||group.kind==='ozone'),false,`${id}: negative control has no sulfur / resonance motif`);
  assert.equal(sulfurOxoBondAxes(THREE,{kind:'sulfur-oxo',center:0,ends:[]},()=>null).length,0,`${id}: no unsupported halo branch`);
}
for(const [id,count]of [['nitromethane',2],['ozone',2]]){
  const svg=await readFile(new URL(`../assets/models/molecule-${id}.svg`,import.meta.url),'utf8'),paths=[...svg.matchAll(/<path([^>]*)>/g)].filter(match=>match[1].includes('data-resonance-distributed-bond="true"'));
  assert.equal(paths.length,count,`${id}: generated resonance thumbnail keeps its dashed branch count`);
  for(const path of paths){assert.match(path[1],/stroke-dasharray=/);assert.doesNotMatch(path[1],/data-sulfur-oxo-halo/);}
}
for(const [id,count]of [['sulfur-dioxide',2],['sulfur-trioxide',3],['sulfuric-acid',2]]){
  const svg=await readFile(new URL(`../assets/models/molecule-${id}.svg`,import.meta.url),'utf8'),halos=[...svg.matchAll(/<path([^>]*)>/g)].filter(match=>match[1].includes('data-sulfur-oxo-halo="true"'));
  assert.equal(halos.length,count,`${id}: generated thumbnail has ${count} terminal S–O halos`);
  for(const halo of halos){const attrs=halo[1],d=attrs.match(/\sd="([^"]+)"/)?.[1]??'';assert.match(attrs,/data-sulfur-oxo-style="bond-axis-halo"/);assert.match(attrs,/data-sulfur-bond-role="terminal"/);assert.doesNotMatch(attrs,/stroke-dasharray|data-distributed-bond=/);assert.equal((d.match(/L/g)??[]).length,1);assert.doesNotMatch(d,/[CQ]/);}
  assert.doesNotMatch(svg,/data-resonance-distributed-bond="true"|data-distributed-style="distributed-dashed"/,`${id}: sulfur thumbnail must not reuse the Nitro / Ozone dashed grammar`);
}
for(const id of ['dimethyl-sulfoxide','phosphoric-acid']){const svg=await readFile(new URL(`../assets/models/molecule-${id}.svg`,import.meta.url),'utf8');assert.doesNotMatch(svg,/data-sulfur-oxo-halo="true"|data-resonance-distributed-bond="true"/,`${id}: negative-control asset has no sulfur halo or resonance branch`);}
console.log('Special geometry/display passed: Nitro / Ozone retain rotatable resonance dashes; sulfur oxo uses distinct axis-centered translucent sleeves with unchanged molecular graphs and bond orders.');
