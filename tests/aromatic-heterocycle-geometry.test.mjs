import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {ELEMENTS} from '../src/chemistry.js';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom} from '../src/bonding-model.js';
import {createStructureSolver} from '../src/structure-relaxation.js';
import {createPreviewModel} from '../src/preview-model.js';

const ringBonds=orders=>orders.map((order,index)=>[index,(index+1)%orders.length,order]);
const graph=(elements,bonds)=>{
  const atoms=elements.map((element,id)=>({id,element}));
  const adjacency=atoms.map(()=>[]);
  const normalized=bonds.map(([a,b,order])=>({a,b,order}));
  for(const {a,b,order} of normalized){adjacency[a].push({atomId:b,order});adjacency[b].push({atomId:a,order});}
  return {atoms,bonds:normalized,neighbors:id=>adjacency[id],bondOrderForAtom:id=>adjacency[id].reduce((sum,item)=>sum+item.order,0)};
};
const bondBetween=(molecule,a,b)=>molecule.bonds.find(item=>(item.a===a&&item.b===b)||(item.a===b&&item.b===a));
const lengthFor=(molecule,a,b,order)=>{
  const left=molecule.atoms[a].element,right=molecule.atoms[b].element;
  return (ATOMIC_MODEL[left].covalentRadius+ATOMIC_MODEL[right].covalentRadius)*.78*bondLengthScale(order);
};
function solverFixture(elements,bonds,{pucker=.28}={}){
  const molecule=graph(elements,bonds),count=elements.length;
  const placements=new Map(elements.map((_,id)=>{
    const angle=id*2*Math.PI/count,z=(id%2?-.7:1)*pucker*(1-id/(count*4));
    return [id,{position:new THREE.Vector3(Math.cos(angle)*1.2,Math.sin(angle)*1.2,z)}];
  }));
  const solver=createStructureSolver({
    THREE,molecule,placements,
    atomById:id=>molecule.atoms[id],
    bondBetween:(a,b)=>bondBetween(molecule,a,b),
    bondLengthFor:(a,b,order)=>lengthFor(molecule,a,b,order),
    geometryFor:id=>geometryForAtom(molecule,id),
    radiusFor:id=>ELEMENTS[molecule.atoms[id].element].radius,
  });
  solver.rebuildTopology({resetFrames:true});
  return {molecule,placements,solver};
}
const settle=(fixture,steps=260)=>{for(let i=0;i<steps;i++)fixture.solver.step(.8,2);};
function planeFrame(points){
  const center=points.reduce((sum,point)=>sum.add(point),new THREE.Vector3()).multiplyScalar(1/points.length);
  const normal=new THREE.Vector3();
  for(let i=0;i<points.length;i++)normal.add(new THREE.Vector3().crossVectors(points[i].clone().sub(center),points[(i+1)%points.length].clone().sub(center)));
  return {center,normal:normal.normalize()};
}
const planeDeviation=points=>{
  const {center,normal}=planeFrame(points);
  return Math.max(...points.map(point=>Math.abs(point.clone().sub(center).dot(normal))));
};
const angleDeg=(a,center,b)=>a.clone().sub(center).angleTo(b.clone().sub(center))*180/Math.PI;
function ringAngle(points,index){
  const count=points.length;
  return angleDeg(points[(index-1+count)%count],points[index],points[(index+1)%count]);
}
function maxRingBondRelative(molecule,points,cycle){
  return Math.max(...cycle.map((id,index)=>{
    const next=cycle[(index+1)%cycle.length],bond=bondBetween(molecule,id,next),target=lengthFor(molecule,id,next,bond.order);
    return Math.abs(points[id].distanceTo(points[next])/target-1);
  }));
}

const topologies=[
  {name:'benzene topology',elements:Array(6).fill('C'),orders:[2,1,2,1,2,1],aromatic:true},
  {name:'pyridine topology',elements:['N','C','C','C','C','C'],orders:[2,1,2,1,2,1],aromatic:true},
  {name:'furan topology',elements:['O','C','C','C','C'],orders:[1,2,1,2,1],aromatic:true},
  {name:'cyclohexane topology',elements:Array(6).fill('C'),orders:[1,1,1,1,1,1],aromatic:false},
  {name:'cyclohexene topology',elements:Array(6).fill('C'),orders:[2,1,1,1,1,1],aromatic:false},
  {name:'cyclopentane topology',elements:Array(5).fill('C'),orders:[1,1,1,1,1],aromatic:false},
  {name:'THF topology',elements:['O','C','C','C','C'],orders:[1,1,1,1,1],aromatic:false},
  {name:'cyclobutane topology',elements:Array(4).fill('C'),orders:[1,1,1,1],aromatic:false},
];
for(const item of topologies){
  const fixture=solverFixture(item.elements,ringBonds(item.orders),{pucker:0});
  const cycles=fixture.solver.snapshot().aromaticCycles;
  assert.equal(cycles.length,item.aromatic?1:0,`${item.name}: aromatic detection mismatch`);
  if(item.aromatic)assert.equal(cycles[0].length,item.elements.length,`${item.name}: wrong ring size`);
}

{
  const fixture=solverFixture(['N','C','C','C','C','C'],ringBonds([2,1,2,1,2,1]));
  assert.equal(geometryForAtom(fixture.molecule,0).kind,'sp2','Pyridine-like N must retain local sp2 geometry');
  settle(fixture);
  const cycle=fixture.solver.snapshot().aromaticCycles[0],points=fixture.molecule.atoms.map(atom=>fixture.placements.get(atom.id).position);
  assert.ok(planeDeviation(cycle.map(id=>points[id]))<.04,'Pyridine-like ring did not settle planar');
  assert.ok(Math.abs(ringAngle(cycle.map(id=>points[id]),cycle.indexOf(0))-120)<2.5,'Pyridine-like N ring angle left sp2 range');
  assert.ok(maxRingBondRelative(fixture.molecule,points,cycle)<.08,'Pyridine-like ring bond lengths regressed');
}
{
  const fixture=solverFixture(['O','C','C','C','C'],ringBonds([1,2,1,2,1]));
  const local=geometryForAtom(fixture.molecule,0);
  assert.equal(local.kind,'sp3','Furan O local lone-pair/VSEPR model must remain intact');
  assert.ok(Math.abs(local.angle*180/Math.PI-104.5)<.01,'Furan O local VSEPR angle changed');
  settle(fixture);
  let cycle=fixture.solver.snapshot().aromaticCycles[0],points=fixture.molecule.atoms.map(atom=>fixture.placements.get(atom.id).position);
  assert.ok(planeDeviation(cycle.map(id=>points[id]))<.04,'Furan-like ring did not settle planar');
  assert.ok(Math.abs(ringAngle(cycle.map(id=>points[id]),cycle.indexOf(0))-108)<2.5,'Ring-level furan angle did not override local O bend');
  assert.ok(maxRingBondRelative(fixture.molecule,points,cycle)<.08,'Furan-like ring bond lengths regressed');
  fixture.placements.get(0).position.z+=.45;
  settle(fixture,180);
  cycle=fixture.solver.snapshot().aromaticCycles[0];points=fixture.molecule.atoms.map(atom=>fixture.placements.get(atom.id).position);
  assert.ok(planeDeviation(cycle.map(id=>points[id]))<.05,'Furan-like ring did not recover planarity after perturbation');
}

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const record=id=>records.find(item=>item.id===id);
function preview(id){
  const source=record(id);assert.ok(source,`Missing production molecule ${id}`);
  const model=createPreviewModel(THREE,source);
  for(let i=0;i<260;i++)model.step();
  return model.snapshot();
}
for(const [id,size] of [['benzene',6],['pyridine',6],['furan',5]]){
  const view=preview(id);
  assert.equal(view.aromaticCycles.length,1,`${id}: production preview lost aromatic authority`);
  assert.equal(view.aromaticCycles[0].length,size,`${id}: production preview ring size mismatch`);
  const ring=view.aromaticCycles[0],ringPoints=ring.map(index=>view.atoms[index].point),frame=planeFrame(ringPoints);
  const direct=new Set(ring);
  for(const bond of view.bonds){
    if(direct.has(bond.a)&&!direct.has(bond.b))direct.add(bond.b);
    if(direct.has(bond.b)&&!direct.has(bond.a))direct.add(bond.a);
  }
  const groupDeviation=Math.max(...[...direct].map(index=>Math.abs(view.atoms[index].point.clone().sub(frame.center).dot(frame.normal))));
  assert.ok(groupDeviation<.065,`${id}: ring/external H group is not planar (${groupDeviation})`);
}
for(const id of ['cyclohexane','cyclohexene','cyclopentane','tetrahydrofuran','cyclobutane']){
  assert.equal(preview(id).aromaticCycles.length,0,`${id}: non-aromatic ring entered aromatic authority`);
}

const [solverSource,appSource,previewSource,viewerSource,assetBuilder,pyridineAsset,furanAsset,thfAsset]=await Promise.all([
  readFile(new URL('../src/structure-relaxation.js',import.meta.url),'utf8'),
  readFile(new URL('../src/app.js',import.meta.url),'utf8'),
  readFile(new URL('../src/preview-model.js',import.meta.url),'utf8'),
  readFile(new URL('../src/collection-viewer.js',import.meta.url),'utf8'),
  readFile(new URL('../scripts/build-collection-assets.mjs',import.meta.url),'utf8'),
  readFile(new URL('../assets/models/molecule-pyridine.svg',import.meta.url),'utf8'),
  readFile(new URL('../assets/models/molecule-furan.svg',import.meta.url),'utf8'),
  readFile(new URL('../assets/models/molecule-tetrahydrofuran.svg',import.meta.url),'utf8'),
]);
assert.match(solverSource,/isSupportedAromaticCycle/);
assert.doesNotMatch(solverSource,/isAromaticSixCarbonCycle|molecule\.id\s*===\s*['\"](?:pyridine|furan)/i,'Aromatic solver must stay topology-driven');
assert.match(appSource,/createStructureSolver\(/,'CRAFT must use the common structure solver');
assert.match(previewSource,/createStructureSolver\(/,'Encyclopedia preview must use the common structure solver');
assert.match(viewerSource,/createPreviewModel\(/,'Encyclopedia viewer must use the shared preview geometry');
assert.match(assetBuilder,/createPreviewModel\(/,'Graph/static thumbnails must derive from shared preview geometry');
assert.match(pyridineAsset,/data-aromatic-ring="true"/,'Pyridine Graph asset was not regenerated from aromatic geometry');
assert.match(furanAsset,/data-aromatic-ring="true"/,'Furan Graph asset was not regenerated from aromatic geometry');
assert.doesNotMatch(thfAsset,/data-aromatic-ring="true"/,'THF Graph asset was incorrectly made aromatic');

console.log('Generalized aromatic topology, heteroaromatic planarity, shared geometry paths, and negative controls passed.');
