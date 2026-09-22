import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {readFile} from 'node:fs/promises';
import {Molecule,ELEMENTS} from '../src/chemistry.js?v=20';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom,nonbondedDistance} from '../src/bonding-model.js?v=31';
import {seedCraftCoordinates} from '../src/craft-structures.js?v=31';
import {createStructureSolver} from '../src/structure-relaxation.js?v=33';
import {createTorsionModel} from '../src/torsion-model.js?v=35';
import {createPreviewModel} from '../src/preview-model.js?v=32';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const recordById=id=>records.find(record=>record.id===id);
const pairKey=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;

function fixture(record,{twist=false}={}){
  const molecule=new Molecule(),ids=record.atoms.map(element=>molecule.addAtom(element).id);
  const seeds=seedCraftCoordinates({...record,attachments:record.attachments??[{atom:0}]});
  const placements=new Map(ids.map((id,index)=>[id,{position:new THREE.Vector3(seeds[index].x,seeds[index].y,seeds[index].z)}]));
  if(twist){
    for(const index of record.atoms.map((_,index)=>index).filter(index=>index===2||index===3||index===4))
      placements.get(ids[index]).position.applyAxisAngle(new THREE.Vector3(1,0,0),index%2?.48:-.38);
  }
  const atomById=id=>molecule.atoms.find(atom=>atom.id===id);
  const bondBetween=(a,b)=>molecule.bonds.find(bond=>pairKey(bond.a,bond.b)===pairKey(a,b));
  const bondLengthFor=(a,b,order)=>(ATOMIC_MODEL[atomById(a).element].covalentRadius+ATOMIC_MODEL[atomById(b).element].covalentRadius)*.78*bondLengthScale(order);
  const geometryFor=id=>geometryForAtom(molecule,id);
  const solver=createStructureSolver({THREE,molecule,placements,atomById,bondBetween,bondLengthFor,geometryFor,
    radiusFor:id=>ELEMENTS[atomById(id).element].radius,
    nonbondedDistanceFor:(a,b)=>nonbondedDistance(atomById(a).element,atomById(b).element)});
  return{molecule,ids,placements,solver,atomById,bondBetween,bondLengthFor,geometryFor};
}

function addInOrder(item,edges){
  for(const [a,b,order] of edges){
    item.molecule.setBond(item.ids[a],item.ids[b],order);
    item.solver.markTopologyDirty();
    item.solver.rebuildTopology();
    for(let step=0;step<18;step++)item.solver.step(.68,2);
  }
  for(let step=0;step<420;step++)item.solver.step(.62,2);
  return item;
}

function dihedral(a,b,c,d){
  const first=b.clone().sub(a),middle=c.clone().sub(b),last=d.clone().sub(c);
  const left=new THREE.Vector3().crossVectors(first,middle).normalize();
  const right=new THREE.Vector3().crossVectors(middle,last).normalize();
  return Math.atan2(middle.clone().normalize().dot(new THREE.Vector3().crossVectors(left,right)),left.dot(right))*180/Math.PI;
}

function coplanarityError(points){
  const value=dihedral(...points),absolute=Math.abs(value);
  return Math.min(absolute,Math.abs(180-absolute));
}

function corePoints(item,indices=[0,1,2,3]){return indices.map(index=>item.placements.get(item.ids[index]).position.clone());}

function acrylicEdges(variant){
  const record=recordById('acrylic-acid'),central=record.bonds.find(edge=>pairKey(edge[0],edge[1])===pairKey(1,2));
  const doubles=record.bonds.filter(edge=>edge[2]===2),singles=record.bonds.filter(edge=>edge[2]===1&&edge!==central);
  if(variant==='alkene-first')return[...doubles.filter(edge=>edge[0]===0),...singles,...doubles.filter(edge=>edge[0]!==0),central];
  if(variant==='carbonyl-first')return[...doubles.filter(edge=>edge[0]===2),...singles,central,...doubles.filter(edge=>edge[0]!==2)];
  if(variant==='central-last')return[...record.bonds.filter(edge=>edge!==central),central];
  if(variant==='central-early')return[central,...record.bonds.filter(edge=>edge!==central)];
  return[...record.bonds];
}

function resultFor(recordId,variant,{twist=false}={}){
  const record=recordById(recordId),item=addInOrder(fixture(record,{twist}),recordId==='acrylic-acid'?acrylicEdges(variant):record.bonds);
  const points=corePoints(item),snapshot=item.solver.snapshot();
  return{item,points,error:coplanarityError(points),snapshot};
}

test('acrylic acid converges to one conjugated plane across construction histories',()=>{
  const results=['alkene-first','carbonyl-first','central-last','central-early','twisted'].map(variant=>
    resultFor('acrylic-acid',variant,{twist:variant==='twisted'}));
  for(const [index,result] of results.entries()){
    assert.ok(result.snapshot.conjugatedPlanarFragmentCount>=1,`variant ${index} did not build a conjugated planar fragment`);
    assert.ok(result.snapshot.restrictedConjugatedBondKeys.length>=2,`variant ${index} lost restricted conjugated topology`);
    assert.ok(result.error<=5,`variant ${index} coplanarity error ${result.error}°`);
  }
  const reference=results[0].error;
  for(const result of results.slice(1))assert.ok(Math.abs(result.error-reference)<=1.5,'construction order changed the final planarity class');
});

test('acrolein uses the same topology-derived C=C-C=O authority',()=>{
  const result=resultFor('acrolein','default');
  assert.ok(result.error<=5,`acrolein coplanarity error ${result.error}°`);
  assert.equal(result.snapshot.conjugatedPlanarFragmentCount,1);
  assert.ok(result.snapshot.conjugatedPlanarFragments[0].restrictedBondKeys.length>=1);
});

test('synthetic acyclic diene is planar without molecule-specific metadata',()=>{
  const record={atoms:['C','C','C','C','H','H','H','H','H','H'],bonds:[[0,1,2],[1,2,1],[2,3,2],[0,4,1],[0,5,1],[1,6,1],[2,7,1],[3,8,1],[3,9,1]]};
  const result=addInOrder(fixture(record,{twist:true}),record.bonds),points=corePoints(result),snapshot=result.solver.snapshot();
  assert.ok(coplanarityError(points)<=5,'synthetic diene did not settle coplanar');
  assert.equal(snapshot.conjugatedPlanarFragmentCount,1);
});

test('acetamide donor resonance shares the geometry and torsion authority',()=>{
  const result=resultFor('acetamide','default'),item=result.item;
  const model=createTorsionModel(item.molecule);
  assert.ok(result.snapshot.restrictedConjugatedBondKeys.includes(pairKey(item.ids[1],item.ids[3])));
  assert.equal(model.bonds.get(pairKey(item.ids[1],item.ids[3])).classification,'RESTRICTED');
  const carbonylO=item.placements.get(item.ids[2]).position,carbonylC=item.placements.get(item.ids[1]).position,amideN=item.placements.get(item.ids[3]).position,amideH=item.placements.get(item.ids[7]).position;
  assert.ok(coplanarityError([carbonylO,carbonylC,amideN,amideH])<=5,'amide donor geometry did not settle planar');
});

test('ethyl acetate keeps the current restricted C(=O)-O teaching contract',()=>{
  const result=resultFor('ethyl-acetate','default'),item=result.item,model=createTorsionModel(item.molecule);
  assert.equal(model.bonds.get(pairKey(item.ids[1],item.ids[3])).classification,'RESTRICTED');
  const points=[2,1,3,4].map(index=>item.placements.get(item.ids[index]).position.clone());
  assert.ok(coplanarityError(points)<=5,'ester C(=O)-O geometry diverged from torsion semantics');
});

test('ordinary torsion freedom and excluded pi cases remain unchanged',()=>{
  const butane=recordById('n-butane'),propene=recordById('propene');
  const butaneItem=fixture(butane),propeneItem=fixture(propene);
  for(const bond of butane.bonds)butaneItem.molecule.setBond(butaneItem.ids[bond[0]],butaneItem.ids[bond[1]],bond[2]);
  for(const bond of propene.bonds)propeneItem.molecule.setBond(propeneItem.ids[bond[0]],propeneItem.ids[bond[1]],bond[2]);
  assert.equal(createTorsionModel(butaneItem.molecule).bonds.get(pairKey(butaneItem.ids[1],butaneItem.ids[2])).classification,'ROTATABLE');
  assert.equal(createTorsionModel(propeneItem.molecule).bonds.get(pairKey(propeneItem.ids[1],propeneItem.ids[2])).classification,'ROTATABLE');

  const elements=Array(12).fill('C'),molecule=new Molecule();
  const ids=elements.map(element=>molecule.addAtom(element).id),cycles=[ids.slice(0,6),ids.slice(6,12)];
  for(const cycle of cycles)for(let index=0;index<6;index++)molecule.setBond(cycle[index],cycle[(index+1)%6],index%2?1:2);
  molecule.setBond(ids[0],ids[6],1);
  const biaryl=createTorsionModel(molecule,{aromaticCycles:cycles});
  assert.equal(biaryl.bonds.get(pairKey(ids[0],ids[6])).classification,'ROTATABLE','biaryl bridge was incorrectly planar-locked');
});

test('whole-molecule rotation follows the conjugated reference frame',()=>{
  const result=resultFor('acrolein','default'),item=result.item,ids=new Set(item.ids),before=result.error;
  const quaternion=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,2,3).normalize(),.83);
  const center=new THREE.Vector3();for(const id of item.ids)center.add(item.placements.get(id).position);center.multiplyScalar(1/item.ids.length);
  for(const id of item.ids)item.placements.get(id).position.sub(center).applyQuaternion(quaternion).add(center);
  item.solver.rotateReferenceFrames(quaternion,ids);
  for(let step=0;step<80;step++)item.solver.step(.62,2);
  assert.ok(coplanarityError(corePoints(item))<=5,`rotated conjugated plane lost coplanarity (before ${before}°)`);
});

test('Encyclopedia preview uses the same conjugated solver contract',()=>{
  for(const [id,indices] of [['acrylic-acid',[0,1,2,3]],['acrolein',[0,1,2,3]],['acetamide',[2,1,3,7]]]){
    const model=createPreviewModel(THREE,recordById(id));
    for(let step=0;step<220;step++)model.step();
    const layout=model.snapshot(),points=indices.map(index=>layout.atoms[index].point.clone());
    assert.ok(coplanarityError(points)<=5,`${id} preview coplanarity error ${coplanarityError(points)}°`);
  }
});
