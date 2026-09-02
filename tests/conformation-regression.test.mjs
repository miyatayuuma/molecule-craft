import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {Molecule,ELEMENTS} from '../src/chemistry.js?v=20';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom,nonbondedDistance} from '../src/bonding-model.js?v=31';
import {createStructureSolver} from '../src/structure-relaxation.js?v=31';
import {createTorsionModel} from '../src/torsion-model.js?v=32';

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
  return{molecule,ids,placements,solver,pos:index=>placements.get(ids[index]).position};
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
  const benzene=benzeneWithChain(2),ringIds=benzene.ids.slice(0,6);
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
  assert.equal(model.bonds.get(pairKey(item.ids[3],item.ids[4])).classification,'ROTATABLE');
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
