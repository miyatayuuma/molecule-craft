import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {Molecule,setMoleculeDatabase,ELEMENTS} from '../src/chemistry.js';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom,nonbondedDistance} from '../src/bonding-model.js';
import {createStructureSettlement} from '../src/structure-settlement.js';
import {connectedStructures} from '../src/workspace-model.js';
import {captureWorkspace,restoreWorkspace} from '../src/workspace-save.js';
import {observeCraftStereo,craftStereoPresentationFor} from '../src/stereo-observation.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const graph=JSON.parse(await readFile(new URL('../data/molecule-graph.json',import.meta.url),'utf8'));
const encyclopedia=JSON.parse(await readFile(new URL('../data/encyclopedia.json',import.meta.url),'utf8'));
setMoleculeDatabase(records);
const record=id=>records.find(item=>item.id===id);
const butene=record('2-butene');

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

function runtime(source,coordinates){
  const molecule=new Molecule(),ids=source.atoms.map(element=>molecule.addAtom(element).id);
  source.bonds.forEach(([a,b,order])=>molecule.setBond(ids[a],ids[b],order));
  const placements=new Map(ids.map((id,index)=>[id,{position:new THREE.Vector3(...coordinates[index])}]));
  return{molecule,ids,placements};
}
const atomById=item=>id=>item.molecule.atoms.find(atom=>atom.id===id);
const bondBetween=item=>(a,b)=>item.molecule.bonds.find(bond=>bond.a===a&&bond.b===b||bond.a===b&&bond.b===a);
const bondLengthFor=item=>(a,b,order)=>{
  const get=atomById(item),left=ATOMIC_MODEL[get(a).element]?.covalentRadius??.75,right=ATOMIC_MODEL[get(b).element]?.covalentRadius??.75;
  return(left+right)*.78*bondLengthScale(order);
};
const radiusFor=item=>id=>ELEMENTS[atomById(item)(id).element].radius;
const nonbondedFor=item=>(a,b)=>nonbondedDistance(atomById(item)(a).element,atomById(item)(b).element);
const geometryFor=item=>id=>geometryForAtom(item.molecule,id);

function settle(source,coordinates){
  const item=runtime(source,coordinates);
  const session=createStructureSettlement({
    THREE,molecule:item.molecule,placements:item.placements,ids:new Set(item.ids),
    bondLengthFor:bondLengthFor(item),geometryFor:geometryFor(item),radiusFor:radiusFor(item),nonbondedDistanceFor:nonbondedFor(item),
    now:0,duration:80,
  });
  let result=null;
  for(let time=16;time<=1800&&!result?.done;time+=16)result=session.advance(time,{clock:()=>0,budgetMs:100});
  assert.equal(result?.done,true,'settlement must finish');
  return item;
}
const observe=item=>observeCraftStereo({record:item.molecule.recognizedMolecule(),molecule:item.molecule,positions:item.placements});

test('same-side and opposite-side settled CRAFT poses complete as the same 2-butene identity',()=>{
  const same=settle(butene,SAME),opposite=settle(butene,OPPOSITE);
  for(const item of [same,opposite]){
    const structures=connectedStructures(item.molecule);
    assert.equal(structures.length,1);
    assert.equal(structures[0].complete,true);
    assert.equal(structures[0].record?.id,'2-butene');
    assert.equal(item.molecule.recognizedMolecule()?.id,'2-butene');
  }
  assert.equal(observe(same)?.relation,'same-side');
  assert.equal(observe(same)?.label,'cis (Z)');
  assert.equal(observe(opposite)?.relation,'opposite-side');
  assert.equal(observe(opposite)?.label,'trans (E)');
});

test('CRAFT observation uses the actual pose and refuses an indeterminate pose',()=>{
  const same=settle(butene,SAME);
  assert.equal(observe(same)?.label,'cis (Z)');
  const ids=same.ids,center=same.placements.get(ids[1]).position,partner=same.placements.get(ids[2]).position;
  const axis=partner.clone().sub(center).normalize();
  same.placements.get(ids[0]).position.copy(center).addScaledVector(axis,-1.2);
  assert.equal(observe(same),null,'indeterminate descriptor must not be guessed into a player-facing label');
});

test('non-2-butene molecules do not receive a CRAFT stereo observation',()=>{
  const ethene=record('ethene'),coords=ethene.atoms.map((_,index)=>[index*.8,Math.sin(index),0]),item=runtime(ethene,coords);
  assert.equal(observeCraftStereo({record:ethene,molecule:item.molecule,positions:item.placements}),null);
  assert.equal(craftStereoPresentationFor('ethene'),null);
});

test('workspace reload recomputes the same observation from restored coordinates without persisting stereo state',()=>{
  const original=settle(butene,SAME),camera=new THREE.PerspectiveCamera(44,1,.1,100),cameraTarget=new THREE.Vector3();
  camera.position.set(5.2,4,7.6);camera.lookAt(cameraTarget);
  const saved=captureWorkspace({molecule:original.molecule,positionFor:id=>original.placements.get(id).position,camera,cameraTarget,selectedAtomId:null,focusId:original.ids[0],targetMoleculeId:null});
  assert.equal(Object.hasOwn(saved,'stereoObservation'),false);
  const restored={molecule:new Molecule(),placements:new Map(),camera:new THREE.PerspectiveCamera(44,1,.1,100),cameraTarget:new THREE.Vector3()};
  restoreWorkspace(saved,{THREE,...restored});
  const recordAfter=restored.molecule.recognizedMolecule();
  const observation=observeCraftStereo({record:recordAfter,molecule:restored.molecule,positions:restored.placements});
  assert.equal(recordAfter?.id,'2-butene');
  assert.equal(observation?.relation,'same-side');
  assert.equal(observation?.label,'cis (Z)');
});

test('CRAFT labels stay presentation-only and consistent with the Encyclopedia 2-butene content',()=>{
  const craft=craftStereoPresentationFor('2-butene'),ency=encyclopedia.molecules['2-butene'].stereoComparison;
  assert.deepEqual(Object.entries(craft.states).map(([relation,state])=>[relation,state.label]),ency.states.map(state=>[state.relation,state.label]));
  const idColumn=graph.nodeColumns.indexOf('id');
  assert.equal(graph.nodes.filter(row=>row[idColumn]==='2-butene').length,1);
  assert.equal(records.filter(item=>item.id==='2-butene').length,1);
  assert.equal(records.some(item=>/^\((?:E|Z)\)-2-butene$/i.test(item.id)),false);
});

test('production wiring observes only after CRAFT settlement and does not enter target matching',async()=>{
  const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
  const targetMatch=await readFile(new URL('../src/craft-target-match.js',import.meta.url),'utf8');
  const targetSatisfaction=await readFile(new URL('../src/craft-target-satisfaction.js',import.meta.url),'utf8');
  assert.match(app,/function craftStereoObservationFor\(focus\)\{\s*if\(relaxation\|\|bondTransition\|\|!focus\?\.complete/);
  assert.match(app,/observeCraftStereo\(\{record:focus\.record,molecule:focus\.graph,positions:pos\}\)/);
  assert.doesNotMatch(targetMatch,/stereo-observation|observeCraftStereo|describeAlkeneRelativeSide/);
  assert.doesNotMatch(targetSatisfaction,/stereo-observation|observeCraftStereo|describeAlkeneRelativeSide/);
});
