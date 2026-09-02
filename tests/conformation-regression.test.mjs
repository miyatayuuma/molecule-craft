import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {Molecule,ELEMENTS} from '../src/chemistry.js?v=20';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom,nonbondedDistance} from '../src/bonding-model.js?v=31';
import {createStructureSolver} from '../src/structure-relaxation.js?v=32';
import {createTorsionModel} from '../src/torsion-model.js?v=33';
import {createConformationEngine} from '../src/conformation-engine.js?v=1';
import {createStructureSettlement} from '../src/structure-settlement.js?v=32';

const pairKey=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;

function fixture(elements,bonds,coordinates){
  const molecule=new Molecule(),ids=elements.map(element=>molecule.addAtom(element).id);
  for(const[a,b,order=1]of bonds)molecule.setBond(ids[a],ids[b],order);
  const placements=new Map(ids.map((id,index)=>[id,{position:new THREE.Vector3(...coordinates[index])}]));
  const atomById=id=>molecule.atoms.find(atom=>atom.id===id);
  const bondBetween=(a,b)=>molecule.bonds.find(bond=>bond.a===a&&bond.b===b||bond.a===b&&bond.b===a);
  const bondLengthFor=(a,b,order)=>(ATOMIC_MODEL[atomById(a).element].covalentRadius+ATOMIC_MODEL[atomById(b).element].covalentRadius)*.78*bondLengthScale(order);
  const solver=createStructureSolver({THREE,molecule,placements,atomById,bondBetween,bondLengthFor,
    geometryFor:id=>geometryForAtom(molecule,id),radiusFor:id=>ELEMENTS[atomById(id).element].radius,
    nonbondedDistanceFor:(a,b)=>nonbondedDistance(atomById(a).element,atomById(b).element)});
  solver.rebuildTopology();
  return{molecule,ids,placements,solver,atomById,bondBetween,bondLengthFor,
    geometryFor:id=>geometryForAtom(molecule,id),pos:index=>placements.get(ids[index]).position,positionFor:id=>placements.get(id)?.position};
}

function benzeneWithChain(chainLength=1){
  const elements=[...Array(6+chainLength).fill('C')],bonds=[],coordinates=[];
  for(let index=0;index<6;index++){
    bonds.push([index,(index+1)%6,index%2===0?2:1]);
    coordinates.push([Math.cos(index*Math.PI/3)*1.03,Math.sin(index*Math.PI/3)*1.03,0]);
  }
  for(let index=0;index<chainLength;index++){
    bonds.push([index===0?0:5+index,6+index,1]);
    coordinates.push([2.08+index*1.05,.18*index,index%2?.28:-.18]);
  }
  return fixture(elements,bonds,coordinates);
}

function saturatedChain(length=6){
  const elements=Array(length).fill('C'),bonds=[],coordinates=[];
  for(let index=0;index<length;index++){
    coordinates.push([index*1.12,index%2?.45:-.45,index%3===0?.2:-.15]);
    if(index)bonds.push([index-1,index,1]);
  }
  for(let index=0;index<length;index++){
    const hydrogens=index===0||index===length-1?3:2;
    for(let h=0;h<hydrogens;h++){
      elements.push('H');
      const atomIndex=elements.length-1;
      bonds.push([index,atomIndex,1]);
      coordinates.push([coordinates[index][0],coordinates[index][1]+(h-1)*.74,coordinates[index][2]+(h%2?.72:-.72)]);
    }
  }
  return fixture(elements,bonds,coordinates);
}

test('freedom analysis classifies rigid, restricted, locked and rotatable bonds',()=>{
  const benzene=benzeneWithChain(3),ringIds=benzene.ids.slice(0,6);
  const aromatic=createTorsionModel(benzene.molecule,{aromaticCycles:[ringIds]});
  assert.equal(aromatic.bonds.get(pairKey(ringIds[0],ringIds[1])).classification,'LOCKED');
  assert.equal(aromatic.bonds.get(pairKey(benzene.ids[6],benzene.ids[7])).classification,'ROTATABLE');

  const vinyl=fixture(['H','C','C','C','H'],[[0,1],[1,2,2],[2,3],[3,4]],[[-1.5,.8,0],[-.6,0,0],[.6,0,0],[1.7,.6,.2],[2.3,1.2,.5]]);
  const vinylModel=createTorsionModel(vinyl.molecule);
  assert.equal(vinylModel.bonds.get(pairKey(vinyl.ids[1],vinyl.ids[2])).classification,'LOCKED');

  const alkyne=fixture(['H','C','C','C','H'],[[0,1],[1,2,3],[2,3],[3,4]],[[-1.6,0,0],[-.55,0,0],[.55,0,0],[1.65,0,0],[2.4,.5,0]]);
  assert.equal(createTorsionModel(alkyne.molecule).bonds.get(pairKey(alkyne.ids[1],alkyne.ids[2])).classification,'LOCKED');

  const ringFixture=fixture(Array(7).fill('C'),[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,6]],[
    [1,0,0],[.5,.866,0],[-.5,.866,0],[-1,0,0],[-.5,-.866,0],[.5,-.866,0],[2,0,.2],
  ]);
  assert.equal(createTorsionModel(ringFixture.molecule).bonds.get(pairKey(ringFixture.ids[0],ringFixture.ids[1])).classification,'LOCKED');

  const conjugated=fixture(['O','C','N','C','H','H'],[[0,1,2],[1,2],[2,3],[1,4],[3,5]],[[0,0,0],[1.1,0,0],[2.1,.5,0],[3.2,.2,.3],[1.1,-1,0],[3.8,.8,.6]]);
  assert.equal(createTorsionModel(conjugated.molecule).bonds.get(pairKey(conjugated.ids[1],conjugated.ids[2])).classification,'RESTRICTED');

  const diene=fixture(['C','C','C','C','H','H'],[[0,1,2],[1,2],[2,3,2],[0,4],[3,5]],[[0,0,0],[1.1,0,0],[2.15,.25,0],[3.2,.25,0],[-.6,.8,0],[3.8,-.55,0]]);
  assert.equal(createTorsionModel(diene.molecule).bonds.get(pairKey(diene.ids[1],diene.ids[2])).classification,'RESTRICTED');
});

test('benzene plus side chain rejects an atom placed in the ring center',()=>{
  const item=benzeneWithChain(2);
  item.pos(7).set(0,0,.01);
  const errors=item.solver.measureError();
  assert.ok(errors.ringPenetrations>0,'ring-center intrusion was not detected');
  assert.equal(item.solver.validateConformation().valid,false,'ring-center intrusion was accepted');
});

test('benzene plus a longer chain exposes a rigid ring fragment without freezing the chain',()=>{
  const item=benzeneWithChain(4),snapshot=item.solver.snapshot();
  assert.ok(snapshot.rigidFragments.some(fragment=>item.ids.slice(0,6).every(id=>fragment.atomIds.includes(id))),'benzene ring has no rigid fragment');
  const model=createTorsionModel(item.molecule,{aromaticCycles:[item.ids.slice(0,6)]});
  assert.ok([...model.bonds.values()].filter(bond=>bond.classification==='ROTATABLE').length>=2,'long side chain was over-locked');
});

test('vinyl and double-bond chains keep their sp2 rigid fragment',()=>{
  const item=fixture(['H','C','C','C','C','H','H'],[[0,1],[1,2,2],[2,3],[3,4],[1,5],[2,6]],[
    [-1.5,.9,0],[-.6,0,0],[.6,0,0],[1.65,.65,.15],[2.7,.15,-.2],[-1.5,-.9,0],[1.45,-.9,0],
  ]);
  const fragment=item.solver.snapshot().rigidFragments.find(group=>group.atomIds.includes(item.ids[1])&&group.atomIds.includes(item.ids[2]));
  assert.ok(fragment&&[0,1,2,3,5,6].every(index=>fragment.atomIds.includes(item.ids[index])),'C=C neighbourhood is not represented as one rigid fragment');
  const model=createTorsionModel(item.molecule);
  assert.equal(model.bonds.get(pairKey(item.ids[1],item.ids[2])).classification,'LOCKED');
  assert.equal(model.bonds.get(pairKey(item.ids[2],item.ids[3])).classification,'ROTATABLE');
});

test('long and branched chains provide distributed torsion paths',()=>{
  const chain=saturatedChain(6),plan=createTorsionModel(chain.molecule).forAtom(chain.ids[0]);
  assert.equal(plan.mode,'conformation','long-chain atom drag still requires one selected axis');
  assert.ok(plan.candidates.length>=3,'long-chain drag did not expose multiple torsions');

  const branched=fixture(['C','C','C','C','C','C','H','H'],[[0,1],[1,2],[2,3],[2,4],[4,5],[0,6],[5,7]],[
    [0,0,0],[1.1,.5,0],[2.2,0,.2],[3.1,.7,-.1],[2.4,-1,.4],[3.5,-1.4,-.2],[-.7,.5,.4],[4.1,-.8,.5],
  ]);
  const branchModel=createTorsionModel(branched.molecule);
  assert.ok([...branchModel.bonds.values()].some(bond=>bond.classification==='ROTATABLE'),'branched chain has no usable torsion');
});

test('ring plus side chain locks ring edges and reports explicit exclusion geometry',()=>{
  const item=fixture(Array(8).fill('C'),[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,6],[6,7]],[
    [1,0,0],[.5,.866,.1],[-.5,.866,-.1],[-1,0,0],[-.5,-.866,.1],[.5,-.866,-.1],[2.05,0,.2],[3.1,.3,-.2],
  ]),snapshot=item.solver.snapshot();
  assert.ok(snapshot.ringExclusionVolumes.length>0,'ring exclusion volume was not built');
  assert.equal(createTorsionModel(item.molecule).bonds.get(pairKey(item.ids[0],item.ids[1])).classification,'LOCKED');
});

test('severe 1-4 overlap, chain crossing and non-finite poses are invalid',()=>{
  const overlap=fixture(Array(4).fill('C'),[[0,1],[1,2],[2,3]],[[0,0,0],[1.1,.5,0],[2.1,0,0],[.03,.02,0]]);
  assert.ok(overlap.solver.measureError().overlapRelative>.5,'1-4 severe overlap was not measured');
  assert.equal(overlap.solver.validateConformation().valid,false,'severe overlap was accepted');

  const crossing=fixture(Array(4).fill('C'),[[0,1],[1,2],[2,3]],[[-1,0,0],[1,0,0],[1,1,0],[-1,-1,0]]);
  assert.ok(crossing.solver.measureError().bondIntersections>0,'non-adjacent bond crossing was not detected');
  assert.equal(crossing.solver.validateConformation().valid,false,'chain self-intersection was accepted');

  const valid=crossing.solver.captureConformation();
  crossing.pos(0).x=Number.NaN;
  assert.equal(crossing.solver.validateConformation().valid,false,'NaN pose was accepted');
  crossing.solver.restoreConformation(valid);
  assert.ok(Number.isFinite(crossing.pos(0).x),'rollback did not restore finite coordinates');
});

test('terminal drag distributes motion over multiple torsions without breaking the chain',()=>{
  const item=saturatedChain(6);
  for(let index=0;index<420;index++)item.solver.step(.62,2);
  const model=createTorsionModel(item.molecule),engine=createConformationEngine({THREE,molecule:item.molecule,solver:item.solver,
    positionFor:item.positionFor,modelFor:()=>model});
  const initial=item.pos(0).clone(),target=initial.clone().add(new THREE.Vector3(-.35,2.4,1.8));
  const session=engine.beginDrag(item.ids[0]);assert.equal(session.plan.mode,'conformation');
  let result;for(let update=0;update<10;update++)result=engine.updateDrag(target);
  assert.ok(result.accepted,'reachable drag target never produced a valid conformation');
  assert.ok(result.changedAxes.size>=2,`only ${result.changedAxes.size} torsion changed`);
  assert.ok(result.afterDistance<result.beforeDistance,'drag did not move the terminal atom toward the target');
  assert.equal(item.solver.validateConformation({ids:session.plan.scope,rigidReference:session.rigidReference,mode:'drag'}).valid,true);
  for(const bond of item.molecule.bonds){
    const targetLength=item.bondLengthFor(bond.a,bond.b,bond.order),actual=item.positionFor(bond.a).distanceTo(item.positionFor(bond.b));
    assert.ok(Math.abs(actual/targetLength-1)<.1,'multi-torsion drag stretched a bond beyond drag tolerance');
  }
});

test('invalid drag rolls back and release relaxation preserves the new conformation',()=>{
  const item=saturatedChain(6);for(let index=0;index<420;index++)item.solver.step(.62,2);
  const model=createTorsionModel(item.molecule),engine=createConformationEngine({THREE,molecule:item.molecule,solver:item.solver,
    positionFor:item.positionFor,modelFor:()=>model});
  const initial=item.pos(0).clone(),target=initial.clone().add(new THREE.Vector3(-.2,2.1,1.4));
  const session=engine.beginDrag(item.ids[0]);let accepted;
  for(let update=0;update<8;update++)accepted=engine.updateDrag(target);
  assert.ok(accepted.accepted);const dragged=item.pos(0).clone(),release=engine.release();
  const settlement=createStructureSettlement({THREE,molecule:item.molecule,placements:item.placements,ids:release.ids,lockedIds:release.lockedIds,
    bondLengthFor:item.bondLengthFor,geometryFor:item.geometryFor,radiusFor:id=>ELEMENTS[item.atomById(id).element].radius,
    nonbondedDistanceFor:(a,b)=>nonbondedDistance(item.atomById(a).element,item.atomById(b).element),rigidReference:release.rigidReference,duration:1});
  let settled;for(let frame=0;frame<80;frame++){settled=settlement.advance(frame*16,{clock:()=>0});if(settled.done)break;}
  assert.ok(item.pos(0).distanceTo(initial)>.15,'release returned to the initial conformation');
  assert.ok(item.pos(0).distanceTo(dragged)<1.2,'release discarded the user-created conformation');
  assert.equal(item.solver.validateConformation({ids:release.ids,rigidReference:release.rigidReference}).valid,true,'release ended invalid');

  const rollbackEngine=createConformationEngine({THREE,molecule:item.molecule,solver:item.solver,positionFor:item.positionFor,modelFor:()=>model});
  rollbackEngine.beginDrag(item.ids[0]);const safe=item.positionFor(item.ids[0]).clone();item.positionFor(item.ids[0]).x=Number.NaN;
  const rolledBack=rollbackEngine.updateDrag(new THREE.Vector3(Number.NaN,0,0));
  assert.equal(rolledBack.rolledBack,true);assert.ok(item.positionFor(item.ids[0]).distanceTo(safe)<1e-9,'last valid pose was not restored');
});

test('aromatic anchor remains rigid and ring exclusion blocks a hostile drag',()=>{
  const item=benzeneWithChain(4);
  for(const [carbonIndex,count]of [[6,2],[7,2],[8,2],[9,3]])for(let h=0;h<count;h++){
    const atom=item.molecule.addAtom('H'),base=item.pos(carbonIndex);
    item.placements.set(atom.id,{position:base.clone().add(new THREE.Vector3(0,(h-.5)*.72,h%2?.76:-.76))});item.molecule.setBond(item.ids[carbonIndex],atom.id,1);
  }
  item.solver.markTopologyDirty();for(let index=0;index<520;index++)item.solver.step(.58,2);
  const ring=item.ids.slice(0,6),model=createTorsionModel(item.molecule,{aromaticCycles:[ring]}),engine=createConformationEngine({
    THREE,molecule:item.molecule,solver:item.solver,positionFor:item.positionFor,modelFor:()=>model,
  });
  const reference=[];for(let left=0;left<ring.length;left++)for(let right=left+1;right<ring.length;right++)reference.push([ring[left],ring[right],item.positionFor(ring[left]).distanceTo(item.positionFor(ring[right]))]);
  const session=engine.beginDrag(item.ids[9]);assert.equal(session.plan.mode,'conformation');
  const ordinary=item.positionFor(item.ids[9]).clone().add(new THREE.Vector3(.2,1.8,1.25));let result;
  for(let update=0;update<8;update++)result=engine.updateDrag(ordinary);
  assert.ok(result.accepted,'aromatic side chain could not flex');
  assert.ok(reference.every(([a,b,distance])=>Math.abs(item.positionFor(a).distanceTo(item.positionFor(b))/distance-1)<.015),'aromatic anchor deformed');
  const ringCenter=ring.reduce((sum,id)=>sum.add(item.positionFor(id)),new THREE.Vector3()).multiplyScalar(1/ring.length);
  for(let update=0;update<18;update++)engine.updateDrag(ringCenter);
  const validation=item.solver.validateConformation({ids:session.plan.scope,rigidReference:session.rigidReference,mode:'drag'});
  assert.equal(validation.valid,true,'hostile ring drag left an invalid pose');assert.equal(validation.errors.ringPenetrations,0);
  assert.ok(item.positionFor(item.ids[9]).distanceTo(ringCenter)>.2,'terminal atom entered the ring center');engine.release();
});

test('an unreachable target saturates torsions instead of stretching the molecule',()=>{
  const item=saturatedChain(6);for(let index=0;index<420;index++)item.solver.step(.62,2);
  const model=createTorsionModel(item.molecule),engine=createConformationEngine({THREE,molecule:item.molecule,solver:item.solver,
    positionFor:item.positionFor,modelFor:()=>model}),session=engine.beginDrag(item.ids[0]);
  const impossible=new THREE.Vector3(-90,80,70);for(let update=0;update<30;update++)engine.updateDrag(impossible);
  assert.ok(item.pos(0).distanceTo(impossible)>100,'unreachable target was reached by stretching topology');
  assert.equal(item.solver.validateConformation({ids:session.plan.scope,rigidReference:session.rigidReference,mode:'drag'}).valid,true);
  for(const bond of item.molecule.bonds){
    const expected=item.bondLengthFor(bond.a,bond.b,bond.order),actual=item.positionFor(bond.a).distanceTo(item.positionFor(bond.b));
    assert.ok(Math.abs(actual/expected-1)<.1,'unreachable drag broke a bond length');
  }
  engine.release();
});
