import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {Molecule,setMoleculeDatabase,ELEMENTS} from '../src/chemistry.js';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom,nonbondedDistance} from '../src/bonding-model.js';
import {createStructureSolver} from '../src/structure-relaxation.js';
import {createStructureSettlement} from '../src/structure-settlement.js';
import {createTorsionModel} from '../src/torsion-model.js';
import {describeAlkeneRelativeSide} from '../src/stereo-descriptor.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
setMoleculeDatabase(records);
const record=id=>records.find(item=>item.id===id);

const SAME=[
  [-1.15,.78,0],[-.58,0,0],[.58,0,0],[1.15,.78,0],
  [-1.65,1.15,.55],[-1.62,1.12,-.55],[-1.2,.95,0],
  [-1.08,-.78,0],[1.08,-.78,0],
  [1.65,1.15,.55],[1.62,1.12,-.55],[1.2,.95,0],
];
const OPPOSITE=[
  [-1.15,.78,0],[-.58,0,0],[.58,0,0],[1.15,-.78,0],
  [-1.65,1.15,.55],[-1.62,1.12,-.55],[-1.2,.95,0],
  [-1.08,-.78,0],[1.08,.78,0],
  [1.65,-1.15,.55],[1.62,-1.12,-.55],[1.2,-.95,0],
];

function runtimeFromRecord(source,coordinates=null){
  const molecule=new Molecule(),ids=source.atoms.map(element=>molecule.addAtom(element).id);
  source.bonds.forEach(([a,b,order])=>molecule.setBond(ids[a],ids[b],order));
  const fallback=source.atoms.map((_,index)=>[index*.71,Math.sin(index*.9),Math.cos(index*.6)]);
  const points=coordinates??fallback;
  const placements=new Map(ids.map((id,index)=>[id,{position:new THREE.Vector3(...points[index])}]));
  const sourceDouble=source.bonds.find(([a,b,order])=>order===2&&source.atoms[a]==='C'&&source.atoms[b]==='C');
  const doubleBond=sourceDouble?molecule.bonds.find(candidate=>(candidate.a===ids[sourceDouble[0]]&&candidate.b===ids[sourceDouble[1]])||(candidate.a===ids[sourceDouble[1]]&&candidate.b===ids[sourceDouble[0]])):null;
  return{molecule,ids,placements,doubleBond};
}

const relation=item=>describeAlkeneRelativeSide(item.molecule,item.placements,item.doubleBond)?.relation??null;
const atomById=item=>id=>item.molecule.atoms.find(atom=>atom.id===id);
const bondBetween=item=>(a,b)=>item.molecule.bonds.find(bond=>bond.a===a&&bond.b===b||bond.a===b&&bond.b===a);
const bondLengthFor=item=>(a,b,order)=>{
  const get=atomById(item),left=ATOMIC_MODEL[get(a).element]?.covalentRadius??.75,right=ATOMIC_MODEL[get(b).element]?.covalentRadius??.75;
  return(left+right)*.78*bondLengthScale(order);
};
const radiusFor=item=>id=>ELEMENTS[atomById(item)(id).element].radius;
const nonbondedFor=item=>(a,b)=>nonbondedDistance(atomById(item)(a).element,atomById(item)(b).element);
const geometryFor=item=>id=>geometryForAtom(item.molecule,id);

function solverFor(item){
  return createStructureSolver({
    THREE,molecule:item.molecule,placements:item.placements,
    atomById:atomById(item),bondBetween:bondBetween(item),bondLengthFor:bondLengthFor(item),
    geometryFor:geometryFor(item),radiusFor:radiusFor(item),nonbondedDistanceFor:nonbondedFor(item),
  });
}

function transformedPlacements(item,transform){
  return new Map([...item.placements].map(([id,entry])=>[id,{position:transform(entry.position.clone())}]));
}

test('2-butene distinguishes same-side and opposite-side without changing constitutional identity',()=>{
  const same=runtimeFromRecord(record('2-butene'),SAME),opposite=runtimeFromRecord(record('2-butene'),OPPOSITE);
  const sameDescriptor=describeAlkeneRelativeSide(same.molecule,same.placements,same.doubleBond);
  const oppositeDescriptor=describeAlkeneRelativeSide(opposite.molecule,opposite.placements,opposite.doubleBond);
  assert.equal(sameDescriptor?.kind,'alkene-relative-side');
  assert.equal(sameDescriptor?.relation,'same-side');
  assert.equal(oppositeDescriptor?.relation,'opposite-side');
  assert.deepEqual(sameDescriptor.referenceSubstituentIds,[same.ids[0],same.ids[3]]);
  assert.deepEqual(oppositeDescriptor.referenceSubstituentIds,[opposite.ids[0],opposite.ids[3]]);
  assert.equal(same.molecule.recognizedMolecule()?.id,'2-butene');
  assert.equal(opposite.molecule.recognizedMolecule()?.id,'2-butene');
});

test('relative-side classification is rigid-transform and reflection invariant',()=>{
  const axis=new THREE.Vector3(1,2,-.7).normalize(),rotation=new THREE.Quaternion().setFromAxisAngle(axis,1.137),translation=new THREE.Vector3(4.2,-7.1,2.6);
  for(const [coordinates,expected] of [[SAME,'same-side'],[OPPOSITE,'opposite-side']]){
    const item=runtimeFromRecord(record('2-butene'),coordinates);
    const variants=[
      transformedPlacements(item,point=>point.applyQuaternion(rotation)),
      transformedPlacements(item,point=>point.add(translation)),
      transformedPlacements(item,point=>point.applyQuaternion(rotation).add(translation)),
      transformedPlacements(item,point=>point.set(-point.x,point.y,point.z)),
    ];
    for(const placements of variants)assert.equal(describeAlkeneRelativeSide(item.molecule,placements,item.doubleBond)?.relation,expected);
  }
});

test('endpoint direction and atom-array ordering do not change the classification',()=>{
  for(const [coordinates,expected] of [[SAME,'same-side'],[OPPOSITE,'opposite-side']]){
    const item=runtimeFromRecord(record('2-butene'),coordinates);
    const reversed={a:item.doubleBond.b,b:item.doubleBond.a,order:2};
    assert.equal(describeAlkeneRelativeSide(item.molecule,item.placements,reversed)?.relation,expected);
    item.molecule.atoms.reverse();item.molecule.bonds.reverse();
    assert.equal(describeAlkeneRelativeSide(item.molecule,item.placements,reversed)?.relation,expected);
  }
});

test('existing solver and topology rebuild preserve the formed double-bond side relation',()=>{
  for(const [coordinates,expected] of [[SAME,'same-side'],[OPPOSITE,'opposite-side']]){
    const item=runtimeFromRecord(record('2-butene'),coordinates),solver=solverFor(item);
    assert.equal(relation(item),expected);
    solver.rebuildTopology();
    for(let index=0;index<180;index++)solver.step(.65,2);
    assert.equal(relation(item),expected,'settled double bond changed side relation');
    solver.rebuildTopology({resetFrames:true});
    for(let index=0;index<120;index++)solver.step(.5,2);
    assert.equal(relation(item),expected,'topology rebuild changed side relation');
  }
});

test('structure settlement preserves same-side and opposite-side configurations',()=>{
  for(const [coordinates,expected] of [[SAME,'same-side'],[OPPOSITE,'opposite-side']]){
    const item=runtimeFromRecord(record('2-butene'),coordinates);
    const settlement=createStructureSettlement({
      THREE,molecule:item.molecule,placements:item.placements,ids:new Set(item.ids),
      bondLengthFor:bondLengthFor(item),geometryFor:geometryFor(item),radiusFor:radiusFor(item),nonbondedDistanceFor:nonbondedFor(item),
      now:0,duration:80,
    });
    let state=null;
    for(let time=16;time<=1600&&!state?.done;time+=16)state=settlement.advance(time,{clock:()=>0,budgetMs:100});
    assert.equal(state?.done,true,'settlement did not finish');
    assert.equal(relation(item),expected,'settlement flipped double-bond side relation');
  }
});

test('C=C remains rotation-locked independently of the descriptor',()=>{
  const item=runtimeFromRecord(record('2-butene'),SAME),model=createTorsionModel(item.molecule);
  const key=[item.doubleBond.a,item.doubleBond.b].sort((a,b)=>a-b).join(':');
  assert.equal(model.bonds.get(key)?.classification,'LOCKED');
  assert.equal(model.bonds.get(key)?.kind,'multiple');
});

test('unsupported alkene topologies are not guessed',()=>{
  for(const id of ['ethene','propene','1-butene','isobutene','cyclohexene','chlorotrifluoroethylene']){
    const item=runtimeFromRecord(record(id));
    assert.equal(describeAlkeneRelativeSide(item.molecule,item.placements,item.doubleBond),null,id);
  }
});

test('nonfinite, degenerate and strongly twisted geometry is rejected safely',()=>{
  const item=runtimeFromRecord(record('2-butene'),SAME);
  const nonfinite=transformedPlacements(item,point=>point);nonfinite.get(item.ids[0]).position.x=NaN;
  assert.equal(describeAlkeneRelativeSide(item.molecule,nonfinite,item.doubleBond),null);

  const zeroAxis=transformedPlacements(item,point=>point);zeroAxis.get(item.ids[2]).position.copy(zeroAxis.get(item.ids[1]).position);
  assert.equal(describeAlkeneRelativeSide(item.molecule,zeroAxis,item.doubleBond),null);

  const parallel=transformedPlacements(item,point=>point);
  parallel.get(item.ids[0]).position.set(-1.7,0,0);
  assert.equal(describeAlkeneRelativeSide(item.molecule,parallel,item.doubleBond),null);

  const twisted=transformedPlacements(item,point=>point);
  const center=twisted.get(item.ids[2]).position,reference=twisted.get(item.ids[3]).position;
  const offset=reference.clone().sub(center),quarter=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
  reference.copy(center.clone().add(offset.applyQuaternion(quarter)));
  assert.equal(describeAlkeneRelativeSide(item.molecule,twisted,item.doubleBond),null);
});

test('descriptor is read-only, topology-driven and contains no molecule-specific or E/Z authority',async()=>{
  const source=await readFile(new URL('../src/stereo-descriptor.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/2-butene/);
  assert.doesNotMatch(source,/\bCIP\b|relation\s*:\s*['"](?:E|Z)['"]/);
  assert.doesNotMatch(source,/structure-relaxation|torsion-model/);
});
