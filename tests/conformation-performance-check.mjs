import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import * as THREE from '../vendor/three/three.module.min.js';
import {Molecule,ELEMENTS} from '../src/chemistry.js?v=20';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom,nonbondedDistance} from '../src/bonding-model.js?v=31';
import {createPreviewModel} from '../src/preview-model.js?v=31';
import {createStructureSolver} from '../src/structure-relaxation.js?v=32';
import {createTorsionModel} from '../src/torsion-model.js?v=33';
import {createConformationEngine} from '../src/conformation-engine.js?v=1';

const carbonCount=24,atoms=Array(carbonCount).fill('C'),bonds=[];
for(let index=1;index<carbonCount;index++)bonds.push([index-1,index,1]);
for(let index=0;index<carbonCount;index++)for(let h=0;h<(index===0||index===carbonCount-1?3:2);h++){
  bonds.push([index,atoms.length,1]);atoms.push('H');
}
const preview=createPreviewModel(THREE,{atoms,bonds});for(let step=0;step<280;step++)preview.step();
const layout=preview.snapshot(),molecule=new Molecule(),ids=atoms.map(element=>molecule.addAtom(element).id);
for(const[a,b,order]of bonds)molecule.setBond(ids[a],ids[b],order);
const placements=new Map(ids.map((id,index)=>[id,{position:layout.atoms[index].point.clone()}])),positionFor=id=>placements.get(id)?.position;
const atomById=id=>molecule.atoms.find(atom=>atom.id===id),bondBetween=(a,b)=>molecule.bonds.find(bond=>bond.a===a&&bond.b===b||bond.a===b&&bond.b===a);
const bondLengthFor=(a,b,order)=>(ATOMIC_MODEL[atomById(a).element].covalentRadius+ATOMIC_MODEL[atomById(b).element].covalentRadius)*.78*bondLengthScale(order);
const solver=createStructureSolver({THREE,molecule,placements,atomById,bondBetween,bondLengthFor,geometryFor:id=>geometryForAtom(molecule,id),
  radiusFor:id=>ELEMENTS[atomById(id).element].radius,nonbondedDistanceFor:(a,b)=>nonbondedDistance(atomById(a).element,atomById(b).element)});
const torsion=createTorsionModel(molecule),engine=createConformationEngine({THREE,molecule,solver,positionFor,modelFor:()=>torsion});
const session=engine.beginDrag(ids[0]);assert.equal(session.plan.mode,'conformation');assert.ok(session.axes.length<=8);
const origin=positionFor(ids[0]).clone(),durations=[];let accepted=0;
for(let update=0;update<120;update++){
  const phase=update/119*Math.PI*2,target=origin.clone().add(new THREE.Vector3(-.4,Math.sin(phase)*2.2,Math.cos(phase)*1.8));
  const started=performance.now(),result=engine.updateDrag(target);durations.push(performance.now()-started);if(result.accepted)accepted++;
}
const release=engine.release(),sorted=[...durations].sort((a,b)=>a-b),average=durations.reduce((sum,value)=>sum+value,0)/durations.length,p95=sorted[Math.floor(sorted.length*.95)];
const validation=solver.validateConformation({ids:release.ids,rigidReference:release.rigidReference,mode:'drag'});
const metrics={atoms:atoms.length,bonds:bonds.length,axes:session.axes.length,updates:durations.length,accepted,rollbacks:release.rollbacks,averageMs:+average.toFixed(2),p95Ms:+p95.toFixed(2)};
console.log(metrics);assert.ok(accepted>=48,`Only ${accepted}/120 large-chain updates were accepted`);assert.equal(validation.valid,true);assert.ok(average<16&&p95<40,`Pointer solve too slow: avg ${average.toFixed(2)}ms, p95 ${p95.toFixed(2)}ms`);
