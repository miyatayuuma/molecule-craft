import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {ELEMENTS,MODEL_ATOM_RADIUS_SCALE,modelAtomRadius} from '../src/chemistry.js';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom,nonbondedDistance} from '../src/bonding-model.js';
import {createPreviewModel} from '../src/preview-model.js';
import {createStructureSolver} from '../src/structure-relaxation.js';
import {seedCraftCoordinates} from '../src/craft-structures.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const record=id=>{const found=records.find(item=>item.id===id);assert.ok(found,`Missing ${id}`);return found;};
const pair=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;

function graph(source){
  const atoms=source.atoms.map((element,id)=>({id,element})),bonds=source.bonds.map(([a,b,order])=>({a,b,order})),adj=atoms.map(()=>[]);
  for(const b of bonds){adj[b.a].push({atomId:b.b,order:b.order});adj[b.b].push({atomId:b.a,order:b.order});}
  return {atoms,bonds,neighbors:id=>adj[id],bondOrderForAtom:id=>adj[id].reduce((s,n)=>s+n.order,0),adj};
}
function findCycle(source,size){
  const g=graph(source),found=[];
  const dfs=(start,current,path,seen)=>{
    if(path.length===size){
      if(g.adj[current].some(n=>n.atomId===start))found.push([...path]);
      return;
    }
    for(const n of g.adj[current]){
      if(seen.has(n.atomId)||n.atomId<start)continue;
      seen.add(n.atomId);path.push(n.atomId);dfs(start,n.atomId,path,seen);path.pop();seen.delete(n.atomId);
    }
  };
  for(const atom of g.atoms)dfs(atom.id,atom.id,[atom.id],new Set([atom.id]));
  assert.ok(found.length,`${source.id}: no ${size}-member cycle`);
  const canonical=cycle=>{const variants=[];for(const seq of [cycle,[...cycle].reverse()])for(let i=0;i<seq.length;i++)variants.push([...seq.slice(i),...seq.slice(0,i)].join('-'));return variants.sort()[0];};
  const unique=new Map(found.map(c=>[canonical(c),c]));return [...unique.values()][0];
}
function solverFixture(id){
  const source=record(id),g=graph(source),seeds=seedCraftCoordinates({...source,attachments:source.attachments??[{atom:0}]});
  const placements=new Map(seeds.map((point,id)=>[id,{position:new THREE.Vector3(point.x,point.y,point.z)}]));
  const bondBetween=(a,b)=>g.bonds.find(item=>pair(item.a,item.b)===pair(a,b));
  const bondLengthFor=(a,b,order)=>(ATOMIC_MODEL[g.atoms[a].element].covalentRadius+ATOMIC_MODEL[g.atoms[b].element].covalentRadius)*.78*bondLengthScale(order);
  const geometryFor=id=>geometryForAtom(g,id,source.attachments?.find(port=>port.atom===id)?.slots??0);
  const solver=createStructureSolver({THREE,molecule:g,placements,atomById:id=>g.atoms[id],bondBetween,bondLengthFor,geometryFor,
    radiusFor:id=>ELEMENTS[g.atoms[id].element].radius,nonbondedDistanceFor:(a,b)=>nonbondedDistance(g.atoms[a].element,g.atoms[b].element)});
  solver.rebuildTopology({resetFrames:true});
  return {source,g,placements,solver,bondBetween,bondLengthFor,geometryFor};
}
const settleFixture=(item,steps=420)=>{for(let i=0;i<steps;i++)item.solver.step(.65,2);return item;};

function preview(id,steps=420){
  const source=record(id),model=createPreviewModel(THREE,source);for(let i=0;i<steps;i++)model.step();return {source,g:graph(source),view:model.snapshot()};
}
function planeDistances(points){
  const center=points.reduce((s,p)=>s.add(p),new THREE.Vector3()).multiplyScalar(1/points.length);
  let bestNormal=null,best=0;
  for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++)for(let c=b+1;c<points.length;c++){
    const n=new THREE.Vector3().crossVectors(points[b].clone().sub(points[a]),points[c].clone().sub(points[a])),q=n.lengthSq();
    if(q>best){best=q;bestNormal=n;}
  }
  if(!bestNormal||best<1e-12)return points.map(()=>0);
  bestNormal.normalize();return points.map(p=>p.clone().sub(center).dot(bestNormal));
}
function dihedral(a,b,c,d){
  const b0=b.clone().sub(a),b1=c.clone().sub(b),b2=d.clone().sub(c),n0=new THREE.Vector3().crossVectors(b0,b1),n1=new THREE.Vector3().crossVectors(b1,b2);
  if(n0.lengthSq()<1e-12||n1.lengthSq()<1e-12)return 0;
  n0.normalize();n1.normalize();const m1=new THREE.Vector3().crossVectors(n0,b1.clone().normalize());
  return Math.atan2(m1.dot(n1),n0.dot(n1))*180/Math.PI;
}
function metrics(id,size){
  const item=preview(id),cycle=findCycle(item.source,size),p=i=>item.view.atoms[i].point,pts=cycle.map(p),distances=planeDistances(pts);
  const bonds=cycle.map((a,i)=>{const b=cycle[(i+1)%size],bond=item.g.bonds.find(x=>pair(x.a,x.b)===pair(a,b)),target=(ATOMIC_MODEL[item.g.atoms[a].element].covalentRadius+ATOMIC_MODEL[item.g.atoms[b].element].covalentRadius)*.78*bondLengthScale(bond.order);return {actual:p(a).distanceTo(p(b)),target};});
  const angles=cycle.map((center,i)=>p(cycle[(i-1+size)%size]).clone().sub(p(center)).angleTo(p(cycle[(i+1)%size]).clone().sub(p(center)))*180/Math.PI);
  const local=cycle.map(id=>geometryForAtom(item.g,id).angle*180/Math.PI);
  const torsions=cycle.map((_,i)=>dihedral(p(cycle[i]),p(cycle[(i+1)%size]),p(cycle[(i+2)%size]),p(cycle[(i+3)%size])));
  const graphDistance=(start,target)=>{const q=[[start,0]],seen=new Set([start]);for(let i=0;i<q.length;i++){const [id,d]=q[i];if(id===target)return d;if(d>=4)continue;for(const n of item.g.adj[id])if(!seen.has(n.atomId)){seen.add(n.atomId);q.push([n.atomId,d+1]);}}return Infinity;};
  let overlap=0,worst=null;
  for(let a=0;a<item.g.atoms.length;a++)for(let b=a+1;b<item.g.atoms.length;b++){
    const d=graphDistance(a,b);if(d<=2)continue;const minimum=nonbondedDistance(item.g.atoms[a].element,item.g.atoms[b].element)*(d===3?.84:1),actual=p(a).distanceTo(p(b)),relative=1-actual/minimum;
    if(relative>overlap){overlap=relative;worst={a,b,d,actual,minimum};}
  }
  const again=preview(id);let regen=0;for(let i=0;i<item.view.atoms.length;i++)regen=Math.max(regen,p(i).distanceTo(again.view.atoms[i].point));
  return {
    id,cycle,
    planeMax:Math.max(...distances.map(Math.abs)),
    planeSigned:distances.map(v=>Number(v.toFixed(4))),
    bondRelative:Math.max(...bonds.map(b=>Math.abs(b.actual/b.target-1))),
    angles:angles.map(v=>Number(v.toFixed(2))),
    local:local.map(v=>Number(v.toFixed(2))),
    torsions:torsions.map(v=>Number(v.toFixed(2))),
    overlap:Number(overlap.toFixed(4)),worst,
    deterministic:regen,
  };
}
const report=[
  metrics('cyclopentane',5),
  metrics('tetrahydrofuran',5),
  metrics('cyclobutane',4),
  metrics('cyclohexane',6),
  metrics('benzene',6),
  metrics('pyridine',6),
  metrics('furan',5),
  metrics('cyclohexene',6),
  metrics('cyclohexanone',6),
];
const byId=new Map(report.map(row=>[row.id,row]));
for(const row of report){
  assert.ok(row.bondRelative<.08,`${row.id}: bond error ${row.bondRelative}`);
  assert.ok(row.overlap<.18,`${row.id}: severe overlap ${row.overlap}`);
  assert.ok(row.deterministic<1e-9,`${row.id}: nondeterministic regeneration`);
}

const pentane=byId.get('cyclopentane');
assert.ok(pentane.planeMax>.10&&pentane.planeMax<.28,'cyclopentane: pucker must be moderate, not planar or extreme');
assert.ok(pentane.angles.every(angle=>angle>101&&angle<114),`cyclopentane: ring angles distorted ${pentane.angles}`);
assert.ok(pentane.torsions.filter(value=>Math.abs(value)>10).length>=3,'cyclopentane: pucker must involve multiple torsions');
assert.ok(Math.max(...pentane.torsions.map(Math.abs))<35,'cyclopentane: pucker is too sharp');

const thf=byId.get('tetrahydrofuran'),thfSource=record('tetrahydrofuran'),thfCycle=thf.cycle;
assert.ok(thf.planeMax>.10&&thf.planeMax<.30,'THF: pucker must be moderate');
thf.angles.forEach((angle,index)=>{
  const element=thfSource.atoms[thfCycle[index]],range=element==='O'?[100,111]:[100,114];
  assert.ok(angle>range[0]&&angle<range[1],`THF: ${element} ring angle distorted at ${angle}`);
});
assert.ok(thf.torsions.filter(value=>Math.abs(value)>8).length>=3,'THF: pucker must be distributed across the ring');
assert.ok(Math.max(...thf.torsions.map(Math.abs))<38,'THF: one fold is too sharp');

const butane=byId.get('cyclobutane');
assert.ok(butane.planeMax>.08&&butane.planeMax<.30,'cyclobutane: mild butterfly pucker expected');
assert.ok(butane.angles.every(angle=>angle>84&&angle<95),`cyclobutane: strained ring angles regressed ${butane.angles}`);
assert.ok(butane.torsions.every(value=>Math.abs(value)>8&&Math.abs(value)<25),'cyclobutane: butterfly torsions should remain mild');

for(const id of ['benzene','pyridine','furan']){
  const row=byId.get(id);assert.ok(row.planeMax<.03,`${id}: aromatic planarity regressed`);
  const item=settleFixture(solverFixture(id));const snap=item.solver.snapshot();
  assert.equal(snap.aromaticCycles.length,1,`${id}: aromatic authority lost`);
  assert.equal(snap.fiveMemberConformations.length,0,`${id}: aromatic entered saturated five-member authority`);
}
for(const id of ['cyclohexane','cyclohexene','cyclohexanone']){
  const row=byId.get(id);assert.ok(row.planeMax>.07,`${id}: six-member non-aromatic ring flattened`);
  const item=settleFixture(solverFixture(id));assert.equal(item.solver.snapshot().sixMemberConformations.length,1,`${id}: six-member authority lost`);
}
for(const id of ['cyclopentane','tetrahydrofuran']){
  const item=settleFixture(solverFixture(id)),snap=item.solver.snapshot();
  assert.equal(snap.fiveMemberConformations.length,1,`${id}: saturated five-member classification missing`);
  assert.equal(snap.fiveMemberConformations[0].mode,'distributed-pucker');
  const cycle=snap.fiveMemberConformations[0].cycle;
  item.placements.get(cycle[2]).position.add(new THREE.Vector3(.16,-.11,.31));
  item.solver.rebuildTopology({resetFrames:true});settleFixture(item,360);
  const errors=item.solver.measureError();
  assert.ok(errors.finite,`${id}: perturbation recovery became non-finite`);
  assert.ok(errors.fiveMemberConformationRelative<.075,`${id}: pucker authority did not recover after perturbation (${errors.fiveMemberConformationRelative})`);
  assert.ok(errors.bondRelative<.08,`${id}: bond length did not recover after perturbation`);
  assert.ok(errors.overlapRelative<.18,`${id}: perturbation recovery created overlap`);
}
{
  const item=settleFixture(solverFixture('cyclobutane')),snap=item.solver.snapshot();
  assert.equal(snap.fiveMemberConformations.length,0,'cyclobutane must not enter five-member authority');
  assert.equal(snap.sixMemberConformations.length,0,'cyclobutane must not enter six-member authority');
}

assert.equal(MODEL_ATOM_RADIUS_SCALE,.72,'model atom display scale is an explicit shared visual authority');
const display=Object.fromEntries(Object.keys(ELEMENTS).map(element=>[element,modelAtomRadius(element)]));
assert.ok(display.H<display.F&&display.F<display.O&&display.O<display.N&&display.N<display.C,'H/F/O/N/C display hierarchy regressed');
for(const element of ['Cl','P','S'])assert.ok(display[element]>display.C,`${element}: large-period element should display larger than carbon`);
assert.ok(Math.max(display.C,display.N,display.O)/Math.min(display.C,display.N,display.O)<1.11,'C/N/O visual size differences became excessive');

const targetBond=(a,b,order=1)=>(ATOMIC_MODEL[a].covalentRadius+ATOMIC_MODEL[b].covalentRadius)*.78*bondLengthScale(order);
const visibleBond=(a,b,order=1)=>targetBond(a,b,order)-modelAtomRadius(a)-modelAtomRadius(b);
const visualPairs=[['H','C',1],['H','O',1],['C','C',1],['C','C',2],['C','O',1],['C','N',1],['C','F',1],['C','Cl',1]];
for(const [a,b,order] of visualPairs){
  const center=targetBond(a,b,order),visible=visibleBond(a,b,order);
  assert.ok(center>0&&visible>.18,`${a}-${b} order ${order}: sphere surfaces hide the bond segment`);
}
assert.ok(visibleBond('H','C')/targetBond('H','C')>.30,'C-H apparent segment remains too short');
assert.ok(visibleBond('H','O')/targetBond('H','O')>.28,'O-H apparent segment remains too short');
assert.ok(visibleBond('C','C')/targetBond('C','C')>.40,'C-C skeleton should remain clearly readable');
assert.ok(targetBond('C','C',2)<targetBond('C','C',1),'multiple-bond center distance authority regressed');

const [appSource,viewerSource,previewSource,assetSource]=await Promise.all([
  readFile(new URL('../src/app.js',import.meta.url),'utf8'),
  readFile(new URL('../src/collection-viewer.js',import.meta.url),'utf8'),
  readFile(new URL('../src/preview-model.js',import.meta.url),'utf8'),
  readFile(new URL('../scripts/build-collection-assets.mjs',import.meta.url),'utf8'),
]);
assert.match(appSource,/SphereGeometry\(modelAtomRadius\(atom\.element\)/,'CRAFT atom spheres must use shared display radius');
assert.doesNotMatch(appSource,/SphereGeometry\(cfg\.radius\*1\.04/,'legacy oversized CRAFT sphere scale must not return');
assert.match(viewerSource,/modelAtomRadius\(atom\.element\)/,'Encyclopedia must use shared display radius');
assert.match(previewSource,/modelAtomRadius\(atoms\[port\.atom\]\.element\)/,'preview attachment endpoints must use shared display radius');
assert.match(assetSource,/modelAtomRadius\(atom\.element\)\*scale/,'Graph assets must use shared display radius');
assert.match(appSource,/createStructureSolver\(/);assert.match(appSource,/createStructureSettlement\(/);
assert.match(viewerSource,/createPreviewModel\(/);assert.match(assetSource,/createPreviewModel\(/);
assert.match(viewerSource,/PerspectiveCamera\(38/,'Encyclopedia camera calibration changed unexpectedly');
assert.match(viewerSource,/radius\/Math\.sin\(halfFov\)/,'Encyclopedia auto-fit must remain geometry-bounds driven');
assert.match(assetSource,/viewBox="0 0 192 128"|viewBox=\\"0 0 192 128\\"/,'Graph thumbnail canvas contract changed unexpectedly');
assert.doesNotMatch(appSource,/cyclopentane|tetrahydrofuran|cyclobutane/i,'CRAFT must not contain molecule-id visual/geometry hacks');

const compact=report.map(({id,planeMax,bondRelative,angles,torsions,overlap})=>({id,planeMax:Number(planeMax.toFixed(4)),bondRelative:Number(bondRelative.toFixed(4)),angles,torsions,overlap}));
console.log('Ring geometry, atom radius hierarchy, visible bond segments, shared rendering authority, and controls passed.');
console.log(JSON.stringify(compact,null,2));
