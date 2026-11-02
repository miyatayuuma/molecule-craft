import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js';
import {geometryForAtom} from '../src/bonding-model.js';
import {createStructuralBondLengthResolver,STRUCTURAL_GEOMETRY_WORLD_UNITS_PER_ANGSTROM} from '../src/bond-geometry.js';

// The same 220 steps used for saved Collection SVGs also settle the live 3D
// preview. Audit the entire catalog, not only the initially reported molecule.
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const byId=new Map(),angle=(a,b)=>THREE.MathUtils.radToDeg(a.angleTo(b));
let centers=0,bondsChecked=0;
for(const record of records){
  const atoms=record.atoms.map((element,id)=>({id,element})),adjacency=atoms.map(()=>[]);
  const bonds=record.bonds.map(([a,b,order])=>({a,b,order}));
  for(const bond of bonds){adjacency[bond.a].push({atomId:bond.b,order:bond.order});adjacency[bond.b].push({atomId:bond.a,order:bond.order});}
  const molecule={atoms,bonds,neighbors:id=>adjacency[id],bondOrderForAtom:id=>adjacency[id].reduce((sum,n)=>sum+n.order,0)};
  const lengthFor=createStructuralBondLengthResolver(molecule),model=createPreviewModel(THREE,record);
  for(let step=0;step<220;step++)model.step();
  const positions=model.snapshot().atoms.map(atom=>atom.point);
  const anglesAt=id=>{
    const neighbors=adjacency[id].map(n=>positions[n.atomId].clone().sub(positions[id])),values=[];
    for(let a=0;a<neighbors.length;a++)for(let b=a+1;b<neighbors.length;b++)values.push(angle(neighbors[a],neighbors[b]));
    return values;
  };
  for(const bond of bonds){
    const actual=positions[bond.a].distanceTo(positions[bond.b]);
    const target=lengthFor(bond.a,bond.b,bond.order)*STRUCTURAL_GEOMETRY_WORLD_UNITS_PER_ANGSTROM;
    assert.ok(Math.abs(actual/target-1)<.15,`${record.id}: severely shortened/stretched bond ${bond.a}–${bond.b}`);
    bondsChecked++;
  }
  for(const atom of atoms){
    if(adjacency[atom.id].length!==3||!['sp2','trigonal'].includes(geometryForAtom(molecule,atom.id).kind))continue;
    for(const degrees of anglesAt(atom.id))assert.ok(Math.abs(degrees-120)<15,`${record.id}: folded trigonal center ${atom.id} (${degrees.toFixed(1)}°)`);
    centers++;
  }
  byId.set(record.id,{record,adjacency,anglesAt,positions});
}

for(const [id,centersToCheck] of [['terephthalic-acid',[6,9]],['pyruvic-acid',[1,2]]]){
  const item=byId.get(id);assert.ok(item,`${id} missing`);
  for(const center of centersToCheck){
    const oxygens=item.adjacency[center].filter(n=>item.record.atoms[n.atomId]==='O').map(n=>n.atomId);
    if(oxygens.length===2){
      const oxygenAngle=angle(item.positions[oxygens[0]].clone().sub(item.positions[center]),item.positions[oxygens[1]].clone().sub(item.positions[center]));
      assert.ok(oxygenAngle>115&&oxygenAngle<125,`${id}: carbonyl oxygen branches folded (${oxygenAngle.toFixed(1)}°)`);
    }else{
      assert.ok(item.anglesAt(center).every(degrees=>degrees>115&&degrees<125),`${id}: adjacent carbonyl center ${center} folded`);
    }
  }
}
for(const [id,centersToCheck] of [['acetamide',[3]],['urea',[2,3]]]){
  const item=byId.get(id);assert.ok(item,`${id} missing`);
  for(const center of centersToCheck)assert.ok(item.anglesAt(center).every(degrees=>degrees>105&&degrees<135),`${id}: amide nitrogen hydrogens folded`);
}
const methylcyclohexane=byId.get('methylcyclohexane');
for(const center of [0,1,4,6])assert.ok(methylcyclohexane.anglesAt(center).every(degrees=>degrees>95&&degrees<125),`methylcyclohexane: coincident ring substituent at ${center}`);

console.log(`Preview geometry audit passed: ${records.length} molecules, ${centers} trigonal centers, ${bondsChecked} bonds; carbonyl, amide and saturated-ring controls intact.`);
