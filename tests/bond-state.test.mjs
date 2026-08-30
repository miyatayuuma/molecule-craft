import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Molecule, setMoleculeDatabase} from '../src/chemistry.js';
import {atomBondState, bondAddition, geometryForAtom} from '../src/bonding-model.js?v=30';
import {sharedOxoGroups, specialEdgeKeys} from '../src/special-bonds.js?v=30';
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
setMoleculeDatabase(records);
// Build through the same permission gate as a real drag. Do not seed bonds.
for(const record of records)for(const reverse of [false,true]){
  const m=new Molecule(),ids=record.atoms.map(e=>m.addAtom(e).id);
  for(const [a,b,order] of reverse?[...record.bonds].reverse():record.bonds){
    for(let step=1;step<=order;step++){
      assert.ok(atomBondState(m,ids[a]).sites.length,`${record.id}: source handle missing`);
      assert.ok(atomBondState(m,ids[b]).sites.length,`${record.id}: target handle missing`);
      const addition=bondAddition(m,ids[a],ids[b]);
      assert.equal(addition.allowed,true,`${record.id}: denied ${a}-${b} order ${step}`);
      m.setBond(ids[a],ids[b],addition.order);
    }
  }
  assert.equal(m.validation().level,'ok',record.id);
  assert.equal(m.recognizedMolecule()?.id,record.id);
}
function build(elements,bonds){const m=new Molecule(),ids=elements.map(e=>m.addAtom(e).id);for(const[a,b,o]of bonds)m.setBond(ids[a],ids[b],o);return{m,ids};}
{
  const {m,ids}=build(['O','H','H','C'],[[0,1,1],[0,2,1]]);
  assert.equal(bondAddition(m,ids[0],ids[3]).allowed,false,'Water must not gain neutral O(III)');
}
{
  const {m,ids}=build(['C','O','H'],[[0,1,2],[0,2,1]]);
  assert.equal(bondAddition(m,ids[0],ids[1]).allowed,false,'Aldehydes must not use the isolated CO exception');
}
{
  const {m,ids}=build(['C','O','H'],[[0,1,2]]);
  assert.equal(bondAddition(m,ids[0],ids[1]).kind,'pair');
  m.setBond(ids[0],ids[1],3);
  assert.equal(atomBondState(m,ids[0]).charge,-1);assert.equal(atomBondState(m,ids[1]).charge,1);
  assert.equal(bondAddition(m,ids[0],ids[2]).allowed,false,'CO must not keep a phantom free C electron');
  m.setBond(ids[0],ids[1],2);assert.equal(atomBondState(m,ids[0]).charge,0);
}
{
  const {m,ids}=build(['S','H','H'],[[0,1,1],[0,2,1]]);
  assert.equal(m.validation().level,'ok');assert.deepEqual(atomBondState(m,ids[0]).sites,['extension']);
}
{
  const acid=records.find(r=>r.id==='sulfuric-acid'),{m,ids}=build(acid.atoms,acid.bonds);
  const shared=sharedOxoGroups(m);assert.equal(shared[0].ends.length,2);
  assert.equal(specialEdgeKeys(shared).size,2,'S–OH bonds stay distinct');
  m.removeBond(ids[0],shared[0].ends[0]);assert.equal(sharedOxoGroups(m).length,0);
}
for(const [id,kind]of [['sulfur-dioxide','trigonal'],['sulfur-trioxide','trigonal'],['sulfuric-acid','sp3'],['phosphoric-acid','sp3'],['phosphorus-pentachloride','tbp'],['sulfur-hexafluoride','octahedral']]){
  const record=records.find(r=>r.id===id),{m,ids}=build(record.atoms,record.bonds);
  assert.equal(geometryForAtom(m,ids[0]).kind,kind,id);
}
console.log('162 molecules reachable in two construction orders; CO scope/charges, extension ports and distinct oxo groups passed.');
