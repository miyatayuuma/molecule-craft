import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Molecule} from '../src/chemistry.js';
import {planStructureEdit,editRelaxationOptions} from '../src/structure-edit.js';
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
function graph(name){const record=records.find(r=>r.id===name),molecule=new Molecule(),ids=record.atoms.map(e=>molecule.addAtom(e).id);for(const [a,b,order]of record.bonds)molecule.setBond(ids[a],ids[b],order);return{molecule,ids};}
for(const name of ['benzene','anisole','phenol','methane','phosphoric-acid','sulfuric-acid']) {
  const {molecule,ids}=graph(name);
  for(const id of ids){
    const plan=planStructureEdit(molecule,id);
    assert.equal(plan.mode,'molecule-rotate',`${name}: bonded atom cannot be pulled out`);
    assert.deepEqual([...plan.scope].sort(),[...ids].sort());
  }
  const extra=molecule.addAtom('O'),plan=planStructureEdit(molecule,extra.id);
  assert.equal(plan.mode,'atom-translate');assert.deepEqual(plan.ids,[extra.id]);
  assert.ok(!planStructureEdit(molecule,ids[0]).scope.has(extra.id));
}
assert.equal(planStructureEdit(new Molecule(),999),null);
console.log('Bonded atoms rotate whole components; only isolated atoms translate.');
