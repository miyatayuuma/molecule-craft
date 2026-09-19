import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {ELEMENTS} from '../src/chemistry.js';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom,nonbondedDistance} from '../src/bonding-model.js';
import {seedCraftCoordinates} from '../src/craft-structures.js';
import {createStructureSolver} from '../src/structure-relaxation.js';
import {createStructureSettlement} from '../src/structure-settlement.js';
import {createPreviewModel} from '../src/preview-model.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const record=id=>{const found=records.find(item=>item.id===id);assert.ok(found,`Missing production molecule ${id}`);return found;};
const pair=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;

function fixture(id){
  const source=record(id),atoms=source.atoms.map((element,id)=>({id,element})),bonds=source.bonds.map(([a,b,order])=>({a,b,order}));
  const adjacency=atoms.map(()=>[]);
  for(const bond of bonds){adjacency[bond.a].push({atomId:bond.b,order:bond.order});adjacency[bond.b].push({atomId:bond.a,order:bond.order});}
  const molecule={atoms,bonds,neighbors:id=>adjacency[id],bondOrderForAtom:id=>adjacency[id].reduce((sum,item)=>sum+item.order,0)};
  const seeds=seedCraftCoordinates({...source,attachments:source.attachments??[{atom:0}]});
  const placements=new Map(seeds.map((point,id)=>[id,{position:new THREE.Vector3(point.x,point.y,point.z)}]));
  const atomById=id=>atoms[id],bondBetween=(a,b)=>bonds.find(item=>(item.a===a&&item.b===b)||(item.a===b&&item.b===a));
  const bondLengthFor=(a,b,order)=>(ATOMIC_MODEL[atoms[a].element].covalentRadius+ATOMIC_MODEL[atoms[b].element].covalentRadius)*.78*bondLengthScale(order);
  const geometryFor=id=>geometryForAtom(molecule,id,source.attachments?.find(port=>port.atom===id)?.slots??0);
  const solver=createStructureSolver({THREE,molecule,placements,atomById,bondBetween,bondLengthFor,geometryFor,
    radiusFor:id=>ELEMENTS[atoms[id].element].radius,nonbondedDistanceFor:(a,b)=>nonbondedDistance(atoms[a].element,atoms[b].element)});
  solver.rebuildTopology({resetFrames:true});
  return {id,source,atoms,bonds,molecule,placements,solver,bondBetween,bondLengthFor,geometryFor};
}
const relax=(item,steps=420)=>{for(let i=0;i<steps;i++)item.solver.step(.78,2);return item;};
const pointsFor=(item,ids)=>ids.map(id=>item.placements.get(id).position);
function planeFrame(points){
  const center=points.reduce((sum,point)=>sum.add(point),new THREE.Vector3()).multiplyScalar(1/points.length);
  const normal=new THREE.Vector3();
  for(let i=0;i<points.length;i++)normal.add(new THREE.Vector3().crossVectors(points[i].clone().sub(center),points[(i+1)%points.length].clone().sub(center)));
  if(normal.lengthSq()<1e-10)normal.set(0,0,1);else normal.normalize();
  return {center,normal};
}
function signedPlaneDistances(points){
  const {center,normal}=planeFrame(points);return points.map(point=>point.clone().sub(center).dot(normal));
}
const planeSpread=points=>Math.max(...signedPlaneDistances(points).map(Math.abs));
function dihedral(a,b,c,d){
  const b0=b.clone().sub(a),b1=c.clone().sub(b),b2=d.clone().sub(c),n0=new THREE.Vector3().crossVectors(b0,b1),n1=new THREE.Vector3().crossVectors(b1,b2);
  if(n0.lengthSq()<1e-10||n1.lengthSq()<1e-10)return 0;
  n0.normalize();n1.normalize();const axis=b1.clone().normalize(),m1=new THREE.Vector3().crossVectors(n0,axis);
  return Math.atan2(m1.dot(n1),n0.dot(n1))*180/Math.PI;
}
const ringTorsions=(item,cycle)=>{
  const p=id=>item.placements.get(id).position;
  return cycle.map((id,index)=>dihedral(p(id),p(cycle[(index+1)%6]),p(cycle[(index+2)%6]),p(cycle[(index+3)%6])));
};
function ringBondError(item,cycle){
  return Math.max(...cycle.map((id,index)=>{
    const next=cycle[(index+1)%6],bond=item.bondBetween(id,next),target=item.bondLengthFor(id,next,bond.order);
    return Math.abs(item.placements.get(id).position.distanceTo(item.placements.get(next).position)/target-1);
  }));
}
function ringAngle(item,cycle,index){
  const center=item.placements.get(cycle[index]).position;
  return item.placements.get(cycle[(index-1+6)%6]).position.clone().sub(center)
    .angleTo(item.placements.get(cycle[(index+1)%6]).position.clone().sub(center))*180/Math.PI;
}
function worstOverlap(item){
  let worst={relative:0,a:null,b:null,distance:null,minimum:null};
  const shortest=(start,target)=>{
    const queue=[[start,0]],seen=new Set([start]);
    for(let i=0;i<queue.length;i++){const [id,depth]=queue[i];if(id===target)return depth;if(depth>=3)continue;
      for(const n of item.molecule.neighbors(id))if(!seen.has(n.atomId)){seen.add(n.atomId);queue.push([n.atomId,depth+1]);}}
    return Infinity;
  };
  for(let a=0;a<item.atoms.length;a++)for(let b=a+1;b<item.atoms.length;b++){
    const graphDistance=shortest(a,b);if(graphDistance<=2)continue;
    const minimum=nonbondedDistance(item.atoms[a].element,item.atoms[b].element)*(graphDistance===3?.84:1);
    const distance=item.placements.get(a).position.distanceTo(item.placements.get(b).position),relative=1-distance/minimum;
    if(relative>worst.relative)worst={relative,a,b,distance,minimum};
  }
  return worst;
}
function conformation(item){
  const frames=item.solver.snapshot().sixMemberConformations;
  assert.equal(frames.length,1,`${item.id}: expected one supported six-member conformation`);
  return frames[0];
}
function assertHealthy(item,{angleTolerance=13}={}){
  const frame=conformation(item),cycle=frame.cycle,errors=item.solver.measureError();
  assert.ok(errors.finite,`${item.id}: non-finite geometry`);
  assert.ok(ringBondError(item,cycle)<.08,`${item.id}: ring bond lengths regressed`);
  for(let i=0;i<6;i++){
    const expected=item.geometryFor(cycle[i]).angle*180/Math.PI;
    assert.ok(Math.abs(ringAngle(item,cycle,i)-expected)<angleTolerance,`${item.id}: ring angle at ${i} outside local geometry`);
  }
  const overlap=worstOverlap(item);assert.ok((errors.overlapRelative??0)<.20,`${item.id}: severe nonbonded overlap ${errors.overlapRelative}; pair ${overlap.a}-${overlap.b} d=${overlap.distance} min=${overlap.minimum}`);
  assert.equal(errors.ringPenetrations,0,`${item.id}: ring penetration introduced`);
  assert.equal(errors.bondIntersections,0,`${item.id}: bond intersection introduced`);
  assert.ok((errors.sixMemberConformationRelative??Infinity)<.08,`${item.id}: ring conformation authority did not converge`);
  return frame;
}
function assertChair(item){
  const frame=assertHealthy(item),cycle=frame.cycle,points=pointsFor(item,cycle),target=frame.mode;
  assert.equal(target,'chair',`${item.id}: wrong saturated conformation mode`);
  const average=cycle.reduce((sum,id,index)=>sum+item.bondLengthFor(id,cycle[(index+1)%6],item.bondBetween(id,cycle[(index+1)%6]).order),0)/6;
  assert.ok(planeSpread(points)>.10*average,`${item.id}: saturated ring remained effectively planar`);
  const torsions=ringTorsions(item,cycle);
  assert.ok(torsions.every(value=>Math.abs(value)>32&&Math.abs(value)<82),`${item.id}: torsions are not chair-like: ${torsions.join(', ')}`);
  assert.ok(torsions.every((value,index)=>value*torsions[(index+1)%6]<0),`${item.id}: chair torsion signs do not alternate`);
  return frame;
}
function assertDeterministic(id){
  const left=relax(fixture(id)),right=relax(fixture(id));
  for(const atom of left.atoms)assert.ok(left.placements.get(atom.id).position.distanceTo(right.placements.get(atom.id).position)<1e-9,`${id}: regenerated pose is not deterministic`);
}

for(const id of ['cyclohexane','methylcyclohexane','cyclohexanol']){
  const item=relax(fixture(id));assertChair(item);assertDeterministic(id);
}
{
  const item=relax(fixture('methylcyclohexane')),frame=conformation(item),ring=new Set(frame.cycle),substituent=item.atoms.find(atom=>atom.element==='C'&&!ring.has(atom.id));
  assert.ok(substituent,'methylcyclohexane: methyl carbon not found');
  const nearest=Math.min(...frame.cycle.map(id=>item.placements.get(substituent.id).position.distanceTo(item.placements.get(id).position)));
  assert.ok(nearest>.65,'methylcyclohexane: methyl group collapsed into ring');
}
{
  const item=relax(fixture('cyclohexanol')),frame=conformation(item),ring=new Set(frame.cycle),oxygen=item.atoms.find(atom=>atom.element==='O');
  const nearest=Math.min(...frame.cycle.map(id=>item.placements.get(oxygen.id).position.distanceTo(item.placements.get(id).position)));
  assert.ok(nearest>.55,'cyclohexanol: OH oxygen collapsed into ring');
}
{
  const item=relax(fixture('cyclohexene')),frame=assertHealthy(item,{angleTolerance:15});
  assert.equal(frame.mode,'half-chair-ring-double','cyclohexene: wrong partial-sp2 mode');
  const ringPoints=pointsFor(item,frame.cycle),average=frame.cycle.reduce((sum,id,index)=>sum+item.bondLengthFor(id,frame.cycle[(index+1)%6],item.bondBetween(id,frame.cycle[(index+1)%6]).order),0)/6;
  assert.ok(planeSpread(ringPoints)>.075*average,'cyclohexene: ring remained planar');
  const doubleBond=item.bonds.find(b=>b.order===2&&frame.cycle.includes(b.a)&&frame.cycle.includes(b.b));assert.ok(doubleBond,'cyclohexene: ring C=C missing');
  const planar=item.solver.snapshot().doublePlanarGroups.find(group=>group.includes(doubleBond.a)&&group.includes(doubleBond.b));assert.ok(planar,'cyclohexene: C=C planar group missing');
  assert.ok(planeSpread(pointsFor(item,planar))<.055,'cyclohexene: C=C neighborhood lost planarity');
}
{
  const item=relax(fixture('cyclohexanone')),frame=assertHealthy(item,{angleTolerance:15});
  assert.equal(frame.mode,'half-chair-sp2-center','cyclohexanone: wrong carbonyl-sp2 mode');
  const ringPoints=pointsFor(item,frame.cycle),average=frame.cycle.reduce((sum,id,index)=>sum+item.bondLengthFor(id,frame.cycle[(index+1)%6],item.bondBetween(id,frame.cycle[(index+1)%6]).order),0)/6;
  assert.ok(planeSpread(ringPoints)>.075*average,'cyclohexanone: ring remained planar');
  const carbonyl=item.bonds.find(b=>b.order===2&&[item.atoms[b.a].element,item.atoms[b.b].element].includes('O'));assert.ok(carbonyl,'cyclohexanone: C=O missing');
  const planar=item.solver.snapshot().doublePlanarGroups.find(group=>group.includes(carbonyl.a)&&group.includes(carbonyl.b));assert.ok(planar,'cyclohexanone: carbonyl planar group missing');
  assert.ok(planeSpread(pointsFor(item,planar))<.055,'cyclohexanone: carbonyl neighborhood lost planarity');
}
for(const id of ['benzene','pyridine','furan']){
  const item=relax(fixture(id));
  assert.equal(item.solver.snapshot().sixMemberConformations.length,0,`${id}: aromatic ring entered non-aromatic six-member authority`);
  const cycle=item.solver.snapshot().aromaticCycles[0];assert.ok(cycle,`${id}: aromatic authority lost`);
  assert.ok(planeSpread(pointsFor(item,cycle))<.05,`${id}: aromatic ring puckered`);
}
for(const id of ['tetrahydrofuran','cyclopentane','cyclobutane']){
  const item=relax(fixture(id));assert.equal(item.solver.snapshot().sixMemberConformations.length,0,`${id}: wrong ring-size entered six-member authority`);
}
{
  const source={id:'acyclic-check',atoms:['C','C','C','C','C','C','H','H'],bonds:[[0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,5,1],[0,6,1],[5,7,1]],attachments:[{atom:0}]};
  const atoms=source.atoms.map((element,id)=>({id,element})),bonds=source.bonds.map(([a,b,order])=>({a,b,order})),adjacency=atoms.map(()=>[]);
  for(const b of bonds){adjacency[b.a].push({atomId:b.b,order:b.order});adjacency[b.b].push({atomId:b.a,order:b.order});}
  const molecule={atoms,bonds,neighbors:id=>adjacency[id],bondOrderForAtom:id=>adjacency[id].reduce((s,n)=>s+n.order,0)},placements=new Map(atoms.map(a=>[a.id,{position:new THREE.Vector3(a.id,0,0)}]));
  const solver=createStructureSolver({THREE,molecule,placements,atomById:id=>atoms[id],bondBetween:(a,b)=>bonds.find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a)),
    bondLengthFor:(a,b,o)=>(ATOMIC_MODEL[atoms[a].element].covalentRadius+ATOMIC_MODEL[atoms[b].element].covalentRadius)*.78*bondLengthScale(o),geometryFor:id=>geometryForAtom(molecule,id),
    radiusFor:id=>ELEMENTS[atoms[id].element].radius});
  solver.rebuildTopology();assert.equal(solver.snapshot().sixMemberConformations.length,0,'acyclic chain entered six-member authority');
}
{
  const item=fixture('cyclohexane'),ids=new Set(item.atoms.map(atom=>atom.id)),session=createStructureSettlement({THREE,molecule:item.molecule,placements:item.placements,ids,
    bondLengthFor:item.bondLengthFor,geometryFor:item.geometryFor,radiusFor:id=>ELEMENTS[item.atoms[id].element].radius,
    nonbondedDistanceFor:(a,b)=>nonbondedDistance(item.atoms[a].element,item.atoms[b].element),now:0,duration:1});
  let result=null,time=0;
  for(let i=0;i<120&&!result?.done;i++){time+=16;result=session.advance(time,{clock:()=>0,budgetMs:999});}
  assert.ok(result?.done,'CRAFT-style settlement did not finish');
  item.solver.rebuildTopology({resetFrames:true});assertChair(item);
}
for(const id of ['cyclohexane','methylcyclohexane','cyclohexanol','cyclohexene','cyclohexanone']){
  const model=createPreviewModel(THREE,record(id));for(let i=0;i<320;i++)model.step();const first=model.snapshot();
  const model2=createPreviewModel(THREE,record(id));for(let i=0;i<320;i++)model2.step();const second=model2.snapshot();
  assert.equal(first.atoms.length,second.atoms.length);
  for(let i=0;i<first.atoms.length;i++)assert.ok(first.atoms[i].point.distanceTo(second.atoms[i].point)<1e-9,`${id}: Encyclopedia regeneration changed pose`);
}
{
  const item=relax(fixture('cyclohexane')),frame=assertChair(item),before=ringTorsions(item,frame.cycle);
  item.placements.get(frame.cycle[0]).position.add(new THREE.Vector3(.12,-.08,.18));
  item.solver.rebuildTopology({resetFrames:true});relax(item,260);const afterFrame=assertChair(item),after=ringTorsions(item,afterFrame.cycle);
  assert.equal(before.length,after.length,'topology rebuild lost ring conformation');
}

const [solverSource,appSource,previewSource,assetBuilder]=await Promise.all([
  readFile(new URL('../src/structure-relaxation.js',import.meta.url),'utf8'),
  readFile(new URL('../src/app.js',import.meta.url),'utf8'),
  readFile(new URL('../src/preview-model.js',import.meta.url),'utf8'),
  readFile(new URL('../scripts/build-collection-assets.mjs',import.meta.url),'utf8'),
]);
assert.match(solverSource,/classifySixMemberConformation/);
assert.doesNotMatch(solverSource,/molecule\.id\s*===|cyclohexane|methylcyclohexane|cyclohexanol|cyclohexene|cyclohexanone/i,'Six-member authority must be topology-driven');
assert.match(appSource,/createStructureSolver\(/);assert.match(appSource,/createStructureSettlement\(/);
assert.match(previewSource,/createStructureSolver\(/);assert.match(assetBuilder,/createPreviewModel\(/);

console.log('Six-member non-aromatic conformation authority passed saturated, partial-sp2, settlement, determinism, and isolation checks.');
