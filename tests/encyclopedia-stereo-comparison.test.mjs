import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {Molecule,setMoleculeDatabase} from '../src/chemistry.js';
import {ATOMIC_MODEL,bondLengthScale,nonbondedDistance} from '../src/bonding-model.js';
import {createPreviewModel} from '../src/preview-model.js';
import {describeAlkeneRelativeSide} from '../src/stereo-descriptor.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const encyclopedia=JSON.parse(await readFile(new URL('../data/encyclopedia.json',import.meta.url),'utf8'));
const graph=JSON.parse(await readFile(new URL('../data/molecule-graph.json',import.meta.url),'utf8'));
setMoleculeDatabase(records);
const record=records.find(item=>item.id==='2-butene');
const spec=encyclopedia.molecules['2-butene'].stereoComparison;

function settle(relation){
  const model=createPreviewModel(THREE,record,{presentation:{kind:spec.kind,relation}});
  for(let index=0;index<260;index++)model.step();
  return model.snapshot();
}
function runtime(layout){
  const molecule=new Molecule(),ids=layout.atoms.map(atom=>molecule.addAtom(atom.element).id);
  for(const bond of layout.bonds)molecule.setBond(ids[bond.a],ids[bond.b],bond.order);
  const positions=new Map(layout.atoms.map((atom,index)=>[ids[index],{position:atom.point}]));
  const double=layout.bonds.find(bond=>bond.order===2&&layout.atoms[bond.a].element==='C'&&layout.atoms[bond.b].element==='C');
  const actual=molecule.bonds.find(bond=>(bond.a===ids[double.a]&&bond.b===ids[double.b])||(bond.a===ids[double.b]&&bond.b===ids[double.a]));
  return{molecule,ids,positions,double:actual,sourceDouble:double};
}
const angle=(a,c,b)=>a.clone().sub(c).angleTo(b.clone().sub(c))*180/Math.PI;

function validateGeometry(layout,relation){
  const item=runtime(layout),descriptor=describeAlkeneRelativeSide(item.molecule,item.positions,item.double);
  assert.equal(layout.stereoDescriptor?.relation,relation);
  assert.equal(descriptor?.relation,relation);
  assert.equal(item.molecule.recognizedMolecule()?.id,'2-butene');
  assert(layout.atoms.every(atom=>[atom.point.x,atom.point.y,atom.point.z].every(Number.isFinite)));

  const {a,b}=item.sourceDouble;
  const adjacency=layout.atoms.map(()=>[]);
  for(const bond of layout.bonds){adjacency[bond.a].push(bond.b);adjacency[bond.b].push(bond.a);}
  const group=[a,b,...adjacency[a].filter(id=>id!==b),...adjacency[b].filter(id=>id!==a)];
  const p0=layout.atoms[group[0]].point,p1=layout.atoms[group[1]].point;
  let normal=null;
  for(const id of group.slice(2)){const candidate=new THREE.Vector3().crossVectors(p1.clone().sub(p0),layout.atoms[id].point.clone().sub(p0));if(candidate.lengthSq()>1e-8){normal=candidate.normalize();break;}}
  assert(normal,'alkene plane normal required');
  const planeError=Math.max(...group.map(id=>Math.abs(layout.atoms[id].point.clone().sub(p0).dot(normal))));
  assert(planeError<.045,`${relation}: C=C group plane error ${planeError}`);

  for(const center of [a,b]){
    const neighbors=adjacency[center];
    assert.equal(neighbors.length,3);
    const values=[];
    for(let i=0;i<neighbors.length;i++)for(let j=i+1;j<neighbors.length;j++)values.push(angle(layout.atoms[neighbors[i]].point,layout.atoms[center].point,layout.atoms[neighbors[j]].point));
    assert(values.every(value=>Math.abs(value-120)<4.5),`${relation}: sp2 angles ${values.join(', ')}`);
  }

  let maxBondError=0;
  for(const bond of layout.bonds){
    const leftAtom=layout.atoms[bond.a],rightAtom=layout.atoms[bond.b];
    const target=(ATOMIC_MODEL[leftAtom.element].covalentRadius+ATOMIC_MODEL[rightAtom.element].covalentRadius)*.78*bondLengthScale(bond.order);
    maxBondError=Math.max(maxBondError,Math.abs(leftAtom.point.distanceTo(rightAtom.point)/target-1));
  }
  assert(maxBondError<.08,`${relation}: bond error ${maxBondError}`);

  const bonded=new Set(layout.bonds.flatMap(bond=>[`${bond.a}:${bond.b}`,`${bond.b}:${bond.a}`]));
  for(let i=0;i<layout.atoms.length;i++)for(let j=i+1;j<layout.atoms.length;j++){
    if(bonded.has(`${i}:${j}`)||adjacency[i].some(mid=>adjacency[mid].includes(j)))continue;
    const minimum=nonbondedDistance(layout.atoms[i].element,layout.atoms[j].element)*.55;
    assert(layout.atoms[i].point.distanceTo(layout.atoms[j].point)>minimum,`${relation}: severe overlap ${i}/${j}`);
  }
}

test('2-butene presentation metadata declares two educational states without changing identity data',()=>{
  assert.deepEqual(spec.states.map(state=>[state.relation,state.label]),[['same-side','cis (Z)'],['opposite-side','trans (E)']]);
  assert.equal(spec.defaultRelation,'opposite-side');
  assert.match(spec.message,/C=C.*回転できない/);
  assert.equal(records.find(item=>item.id==='2-butene').stereoComparison,undefined);
  const comparisonIds=Object.entries(encyclopedia.molecules).filter(([,entry])=>entry.stereoComparison).map(([id])=>id);
  assert.deepEqual(comparisonIds,['2-butene']);
});

test('same-side and opposite-side preview poses settle through the existing geometry authority',()=>{
  validateGeometry(settle('same-side'),'same-side');
  validateGeometry(settle('opposite-side'),'opposite-side');
});

test('Graph identity remains one constitutional 2-butene node',()=>{
  const idColumn=graph.nodeColumns.indexOf('id');
  assert.equal(graph.nodes.filter(row=>row[idColumn]==='2-butene').length,1);
});

test('production stereo comparison logic is metadata-driven rather than molecule-id special-cased',async()=>{
  const paths=['src/collection-ui.js','src/collection-viewer.js','src/preview-model.js'];
  const sources=await Promise.all(paths.map(path=>readFile(new URL('../'+path,import.meta.url),'utf8')));
  for(const source of sources)assert.doesNotMatch(source,/2-butene/);
  assert.doesNotMatch(sources.join('\n'),/\bCIP\b|relation\s*===?\s*['"](?:E|Z)['"]/);
});
