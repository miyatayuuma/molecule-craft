import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {Molecule,ELEMENTS} from '../src/chemistry.js';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom,nonbondedDistance} from '../src/bonding-model.js';
import {seedCraftCoordinates} from '../src/craft-structures.js';
import {createStructureSolver} from '../src/structure-relaxation.js';
import {createStructureSettlement} from '../src/structure-settlement.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const recordById=id=>records.find(record=>record.id===id);
const pairKey=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;
const bondBetween=(molecule,a,b)=>molecule.bonds.find(bond=>pairKey(bond.a,bond.b)===pairKey(a,b));
const connectedComponent=(molecule,start)=>{
  const ids=new Set([start]),queue=[start];
  for(let index=0;index<queue.length;index++)for(const {atomId} of molecule.neighbors(queue[index]))if(!ids.has(atomId)){ids.add(atomId);queue.push(atomId);}
  return ids;
};

function buildCraftFixture(record){
  const molecule=new Molecule(),ids=record.atoms.map(element=>molecule.addAtom(element).id);
  const seeds=seedCraftCoordinates({...record,attachments:record.attachments??[{atom:0}]});
  const placements=new Map(ids.map((id,index)=>[id,{position:new THREE.Vector3(seeds[index].x,seeds[index].y,seeds[index].z)}]));
  const atomById=id=>molecule.atoms.find(atom=>atom.id===id);
  const bondLengthFor=(a,b,order)=>(ATOMIC_MODEL[atomById(a).element].covalentRadius+ATOMIC_MODEL[atomById(b).element].covalentRadius)*.78*bondLengthScale(order);
  const geometryFor=id=>geometryForAtom(molecule,id);
  const radiusFor=id=>ELEMENTS[atomById(id).element].radius;
  const nonbondedDistanceFor=(a,b)=>nonbondedDistance(atomById(a).element,atomById(b).element);
  const solver=createStructureSolver({THREE,molecule,placements,atomById,bondBetween:(a,b)=>bondBetween(molecule,a,b),bondLengthFor,geometryFor,radiusFor,nonbondedDistanceFor});
  return{molecule,ids,placements,solver,atomById,bondLengthFor,geometryFor,radiusFor,nonbondedDistanceFor};
}

function settleAfterCraftBond(item,aIndex,bIndex,order){
  const {molecule,ids,placements,solver}=item;
  molecule.setBond(ids[aIndex],ids[bIndex],order);
  solver.markTopologyDirty();
  solver.rebuildTopology();
  const scope=connectedComponent(molecule,ids[aIndex]);
  const session=createStructureSettlement({THREE,molecule,placements,ids:scope,bondLengthFor:item.bondLengthFor,geometryFor:item.geometryFor,
    radiusFor:item.radiusFor,nonbondedDistanceFor:item.nonbondedDistanceFor,now:0,duration:1});
  let result=null,time=0;
  for(let frame=0;frame<80&&!result?.done;frame++,time+=16)result=session.advance(time,{clock:()=>0,budgetMs:5});
  assert.ok(result?.done,'CRAFT settlement did not finish its bounded transaction');
  solver.rebuildTopology({resetFrames:true});
  return result;
}

function ringEdges(record){return record.bonds.filter(([a,b])=>a<6&&b<6);}
function closingEdge(record,pair){return record.bonds.find(([a,b])=>(a===pair[0]&&b===pair[1])||(a===pair[1]&&b===pair[0]));}
function constructionEdges(record,kind,closedBy=[5,0]){
  const edges=record.bonds.map(edge=>[...edge]),close=closingEdge(record,closedBy);
  assert.ok(close,`${record.id}: missing requested closing edge`);
  const rest=edges.filter(edge=>edge!==close&&!((edge[0]===close[0]&&edge[1]===close[1])||(edge[0]===close[1]&&edge[1]===close[0])));
  const ring=rest.filter(([a,b])=>a<6&&b<6),substituents=rest.filter(([a,b])=>!(a<6&&b<6));
  if(kind==='early')return[...ring,close,...substituents];
  if(kind==='late')return[...substituents,...ring,close];
  return[...rest,close];
}

function ringMetrics(item,cycle){
  const points=cycle.map(id=>item.placements.get(id).position);
  const center=points.reduce((sum,point)=>sum.add(point),new THREE.Vector3()).divideScalar(points.length);
  const normal=new THREE.Vector3();
  for(let index=0;index<points.length;index++)normal.add(new THREE.Vector3().crossVectors(points[index].clone().sub(center),points[(index+1)%points.length].clone().sub(center)));
  normal.normalize();
  const radii=points.map(point=>point.distanceTo(center)),meanRadius=radii.reduce((sum,value)=>sum+value,0)/radii.length;
  const planeMax=Math.max(...points.map(point=>Math.abs(point.clone().sub(center).dot(normal))));
  const radiusSpread=(Math.max(...radii)-Math.min(...radii))/meanRadius;
  const angles=points.map((point,index)=>points[(index+points.length-1)%points.length].clone().sub(point).angleTo(points[(index+1)%points.length].clone().sub(point))*180/Math.PI);
  const targetAngle=(points.length-2)*180/points.length;
  const maxAngleError=Math.max(...angles.map(angle=>Math.abs(angle-targetAngle)));
  const edgeRelativeValues=cycle.flatMap((id,index)=>{
    const next=cycle[(index+1)%cycle.length],bond=bondBetween(item.molecule,id,next);
    return bond?[Math.abs(item.placements.get(id).position.distanceTo(item.placements.get(next).position)/item.bondLengthFor(id,next,bond.order)-1)]:[];
  });
  const edgeRelative=Math.max(0,...edgeRelativeValues);
  const ringSet=new Set(cycle),outside=[];
  for(const id of cycle)for(const {atomId} of item.molecule.neighbors(id))if(!ringSet.has(atomId))outside.push(atomId);
  const substituentPlaneMax=Math.max(0,...outside.map(id=>Math.abs(item.placements.get(id).position.clone().sub(center).dot(normal))));
  const substituentAngleErrors=[];
  for(let index=0;index<cycle.length;index++){
    const id=cycle[index],external=item.molecule.neighbors(id).find(item=>!ringSet.has(item.atomId));
    if(!external)continue;
    for(const neighborIndex of [(index+cycle.length-1)%cycle.length,(index+1)%cycle.length]){
      const a=item.placements.get(cycle[neighborIndex]).position.clone().sub(item.placements.get(id).position);
      const b=item.placements.get(external.atomId).position.clone().sub(item.placements.get(id).position);
      substituentAngleErrors.push(Math.abs(a.angleTo(b)*180/Math.PI-120));
    }
  }
  return{planeMax,radiusSpread,maxAngleError,edgeRelative,substituentPlaneMax,substituentAngleError:Math.max(0,...substituentAngleErrors)};
}

function buildVariant(record,{kind='late',close=[5,0],perturb=false}={}){
  const item=buildCraftFixture(record),edges=constructionEdges(record,kind,close);
  let preClosure=null,lastResult=null;
  for(const edge of edges){
    const [a,b,order]=edge;
    const isClosing=(a===close[0]&&b===close[1])||(a===close[1]&&b===close[0]);
    if(isClosing&&perturb){
      // A modest hand-placeable disturbance: a shallow fold and an uneven
      // projected hexagon, applied to an already assembled open chain.
      item.placements.get(item.ids[2]).position.add(new THREE.Vector3(.05,-.06,.18));
      item.placements.get(item.ids[3]).position.add(new THREE.Vector3(-.06,.04,-.09));
      preClosure=ringMetrics(item,item.ids.slice(0,6));
    }
    lastResult=settleAfterCraftBond(item,a,b,order);
  }
  const cycles=item.solver.snapshot().aromaticCycles;
  const cycle=cycles.find(candidate=>candidate.length===6&&candidate.every(id=>item.ids.slice(0,6).includes(id)));
  assert.ok(cycle,`${record.id} ${kind}: completed CRAFT graph was not recognized as aromatic`);
  return{item,cycle,metrics:ringMetrics(item,cycle),preClosure,lastResult};
}

function assertAromaticContract(result,label){
  const m=result.metrics;
  assert.ok(m.planeMax<.03,`${label}: ring plane deviation ${m.planeMax}`);
  assert.ok(m.radiusSpread<.03,`${label}: radius spread ${m.radiusSpread}; settlement=${JSON.stringify(result.lastResult)}`);
  assert.ok(m.maxAngleError<2.5,`${label}: ring angle error ${m.maxAngleError}°; settlement=${JSON.stringify(result.lastResult)}`);
  assert.ok(m.edgeRelative<.03,`${label}: aromatic ring bond error ${m.edgeRelative}`);
  assert.ok(m.substituentPlaneMax<.075,`${label}: aromatic substituent left ring plane ${m.substituentPlaneMax}; settlement=${JSON.stringify(result.lastResult)}`);
  assert.ok(m.substituentAngleError<8,`${label}: aromatic substituent orientation error ${m.substituentAngleError}°`);
}

test('salicylic acid aromatic geometry is independent of incremental CRAFT ring-closure history',()=>{
  const record=recordById('salicylic-acid');
  const variants=[
    ['ring early',buildVariant(record,{kind:'early'})],
    ['ring late',buildVariant(record,{kind:'late'})],
    ['different closing double bond',buildVariant(record,{kind:'late',close:[0,1]})],
    ['mildly perturbed pre-closure pose',buildVariant(record,{kind:'late',perturb:true})],
  ];
  for(const [label,result] of variants)assertAromaticContract(result,`salicylic acid ${label}`);
  assert.ok(variants[3][1].preClosure.planeMax<.16,'Pre-closure pose exceeded the realistic shallow-fold fixture');
  assert.ok(variants[3][1].preClosure.radiusSpread<.13,'Pre-closure hexagon exceeded the realistic uneven-pose fixture');
  const reference=variants[0][1].metrics;
  for(const [label,{metrics}] of variants.slice(1)){
    assert.ok(Math.abs(metrics.planeMax-reference.planeMax)<.015,`${label}: final ring plane depends on construction order`);
    assert.ok(Math.abs(metrics.radiusSpread-reference.radiusSpread)<.02,`${label}: final ring radius depends on construction order`);
    assert.ok(Math.abs(metrics.maxAngleError-reference.maxAngleError)<1.5,`${label}: final ring angles depend on construction order`);
    assert.ok(Math.abs(metrics.edgeRelative-reference.edgeRelative)<.015,`${label}: final ring bond lengths depend on construction order`);
    assert.ok(Math.abs(metrics.substituentPlaneMax-reference.substituentPlaneMax)<.05,`${label}: substituent plane depends on construction order`);
    assert.ok(Math.abs(metrics.substituentAngleError-reference.substituentAngleError)<3,`${label}: substituent orientation depends on construction order`);
  }
});

test('benzene, phenol, and benzoic acid retain the aromatic CRAFT geometry contract',()=>{
  for(const id of ['benzene','phenol','benzoic-acid']){
    const record=recordById(id);
    for(const variant of [
      buildVariant(record,{kind:'early'}),
      buildVariant(record,{kind:'late'}),
      buildVariant(record,{kind:'late',close:[0,1]}),
    ])assertAromaticContract(variant,`${id} incremental topology`);
  }
});
