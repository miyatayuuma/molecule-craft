import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {ATOMIC_MODEL,bondLengthScale} from '../src/bonding-model.js';
import {createStructuralBondLengthResolver,genericBondLengthAngstrom,structuralBondLengthAngstrom,STRUCTURAL_GEOMETRY_WORLD_UNITS_PER_ANGSTROM} from '../src/bond-geometry.js';
import {supportedResonanceGroups} from '../src/resonance-model.js';
import {sharedOxoGroups} from '../src/special-bonds.js';
import {createPreviewModel} from '../src/preview-model.js';
import {REACTION_LAB_WORLD_UNITS_PER_ANGSTROM} from '../src/reaction-lab-stage-a.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const byId=new Map(records.map(record=>[record.id,record]));
const record=id=>{const item=byId.get(id);assert(item,`missing molecule ${id}`);return item;};
const target=(id,a,b)=>{const item=record(id),bond=item.bonds.find(([x,y])=>(x===a&&y===b)||(x===b&&y===a));assert(bond,`${id}: missing ${a}-${b}`);return structuralBondLengthAngstrom(item,a,b,bond[2]);};
const allLengths=id=>{const item=record(id),model=createPreviewModel(THREE,item);for(let index=0;index<220;index++)model.step();const layout=model.snapshot();return item.bonds.map(([a,b,order])=>({a,b,order,target:structuralBondLengthAngstrom(item,a,b,order),actual:layout.atoms[a].point.distanceTo(layout.atoms[b].point)/STRUCTURAL_GEOMETRY_WORLD_UNITS_PER_ANGSTROM}));};

assert.equal(bondLengthScale(1),1);
assert.equal(bondLengthScale(2),.90);
assert.equal(bondLengthScale(3),.79);
assert.equal(genericBondLengthAngstrom('C','C',1),1.52);
assert.equal(genericBondLengthAngstrom('C','C',2),1.368);
assert.equal(genericBondLengthAngstrom('C','C',3),1.2008);
assert.equal(genericBondLengthAngstrom('C','N',3),1.1613);
assert.equal(genericBondLengthAngstrom('N','N',3),1.1218);
assert.equal(genericBondLengthAngstrom('C','O',3),1.1218);
assert.equal(target('hydrogen',0,1),.74);
assert.equal(target('hydrogen-peroxide',0,1),1.47);
assert.equal(STRUCTURAL_GEOMETRY_WORLD_UNITS_PER_ANGSTROM,.78);
assert.equal(STRUCTURAL_GEOMETRY_WORLD_UNITS_PER_ANGSTROM,REACTION_LAB_WORLD_UNITS_PER_ANGSTROM,'preview geometry and Reaction Lab retain the same world conversion');

const mutableNitro={atoms:['C','N','O','O'],bonds:[[0,1,1],[1,2,1],[1,3,1]]},liveMetric=createStructuralBondLengthResolver(mutableNitro);
assert.equal(liveMetric(1,2,1),genericBondLengthAngstrom('N','O',1),'unfinished CRAFT motif uses generic geometry');
mutableNitro.bonds[1][2]=2;liveMetric.invalidate();assert.equal(liveMetric(1,2,2),1.23,'topology refresh activates the shared resonance geometry');

function centerEnds(id,kind){const group=supportedResonanceGroups(record(id)).find(item=>item.kind===kind);assert(group,`${id}: ${kind} group`);return group;}
for(const id of ['nitromethane','nitrobenzene','2-nitrotoluene','2-4-dinitrotoluene','2-4-6-trinitrotoluene']){
  const groups=supportedResonanceGroups(record(id)).filter(group=>group.kind==='nitro');assert(groups.length,`${id}: at least one nitro group`);
  for(const group of groups){const values=group.ends.map(end=>structuralBondLengthAngstrom(record(id),group.center,end,record(id).bonds.find(([a,b])=>(a===group.center&&b===end)||(a===end&&b===group.center))[2]));assert.deepEqual(values,[1.23,1.23],`${id}: both N–O structural targets are equivalent`);}
}
const ozone=centerEnds('ozone','ozone');assert.deepEqual(ozone.ends.map(end=>target('ozone',ozone.center,end)),[1.28,1.28]);
for(const id of ['nitromethane','ozone']){
  const reversed=structuredClone(record(id));
  for(const group of supportedResonanceGroups(reversed)){
    const edges=reversed.bonds.filter(([a,b])=>(a===group.center&&group.ends.includes(b))||(b===group.center&&group.ends.includes(a)));
    [edges[0][2],edges[1][2]]=[edges[1][2],edges[0][2]];
  }
  for(const group of supportedResonanceGroups(reversed))assert.deepEqual(group.ends.map(end=>structuralBondLengthAngstrom(reversed,group.center,end,reversed.bonds.find(([a,b])=>(a===group.center&&b===end)||(a===end&&b===group.center))[2])).sort(),(group.kind==='nitro'?[1.23,1.23]:[1.28,1.28]),`${id}: contributor swap preserves both targets`);
}

for(const id of ['sulfur-dioxide','sulfur-trioxide','sulfuric-acid']){
  const group=sharedOxoGroups(record(id)).find(item=>item.kind==='sulfur-oxo');assert(group,`${id}: shared sulfur motif`);
  assert.equal(group.ends.length,id==='sulfur-trioxide'?3:2,`${id}: terminal oxo count`);
  assert.deepEqual(group.ends.map(end=>target(id,group.center,end)),group.ends.map(()=>1.43));
  if(id==='sulfuric-acid')assert.deepEqual(group.hydroxyls.map(end=>target(id,group.center,end)),[1.57,1.57]);
}
assert.equal(target('dimethyl-sulfoxide',1,3),1.539,'DMSO keeps the generic double-bond target');
assert.equal(target('phosphoric-acid',0,1),genericBondLengthAngstrom('P','O',2),'H3PO4 P=O stays generic');
assert.equal(target('phosphoric-acid',0,2),genericBondLengthAngstrom('P','O',1),'H3PO4 P–OH stays generic');

const settledIds=['hydrogen','hydrogen-peroxide','nitrogen','carbon-monoxide','ethyne','propyne','1-butyne','2-butyne','hydrogen-cyanide','acetonitrile','acrylonitrile','ozone','nitromethane','sulfur-dioxide','sulfur-trioxide','sulfuric-acid','dimethyl-sulfoxide','phosphoric-acid'];
for(const id of settledIds)for(const bond of allLengths(id))assert(Math.abs(bond.actual-bond.target)<=.02,`${id} ${bond.a}-${bond.b} order ${bond.order}: settled ${bond.actual.toFixed(4)} Å, target ${bond.target.toFixed(4)} Å`);

const expectedChanged=new Set(['nitrogen','carbon-monoxide','ethyne','propyne','1-butyne','2-butyne','hydrogen-cyanide','acetonitrile','acrylonitrile','ozone','nitromethane','nitrobenzene','2-nitrotoluene','2-4-dinitrotoluene','2-4-6-trinitrotoluene','sulfur-dioxide','sulfur-trioxide','sulfuric-acid','hydrogen','hydrogen-peroxide']);
const changed=[];
for(const item of records){
  const hasChangedTarget=item.bonds.some(([a,b,order])=>{
    const old=(ATOMIC_MODEL[item.atoms[a]]?.covalentRadius??.75)+(ATOMIC_MODEL[item.atoms[b]]?.covalentRadius??.75);
    return Math.abs(structuralBondLengthAngstrom(item,a,b,order)-old*(order===2?.90:order===3?.84:1))>1e-9;
  });if(hasChangedTarget)changed.push(item.id);
}
assert.deepEqual(new Set(changed),expectedChanged,'only the specified 20 catalog records have changed structural targets');
assert.equal(changed.length,20);

console.log(`Shared bond metric passed: ${changed.length} expected records; ${settledIds.length} settled models within ±0.02 Å.`);
