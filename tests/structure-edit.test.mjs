import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Molecule} from '../src/chemistry.js';
import {planStructureEdit,editRelaxationOptions} from '../src/structure-edit.js';
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
function graph(name){const record=records.find(r=>r.id===name),molecule=new Molecule(),ids=record.atoms.map(e=>molecule.addAtom(e).id);for(const [a,b,order]of record.bonds)molecule.setBond(ids[a],ids[b],order);return{molecule,ids};}
for(const name of ['benzene','anisole','phenol']) {
  const {molecule,ids}=graph(name),plan=planStructureEdit(molecule,ids[1]);
  assert.equal(plan.mode,'atom-translate',`${name}: ring must not swing around H`);
  assert.ok(plan.ids.length<=2,`${name}: whole ring selected as a branch`);
  const h=molecule.atoms.find(a=>a.element==='H'),hPlan=planStructureEdit(molecule,h.id);
  assert.deepEqual(hPlan.ids,[h.id]);assert.equal(hPlan.mode,'structure');
  const options=editRelaxationOptions(molecule,{...hPlan,atomId:h.id});
  assert.equal(options.lockedIds.size,molecule.atoms.length-1);
}
{
  const {molecule,ids}=graph('anisole');
  const ringPlan=planStructureEdit(molecule,ids[0]);assert.equal(ringPlan.mode,'atom-translate','Do not move ring around methoxy branch');
  const oxygen=molecule.atoms.find(a=>a.element==='O'),plan=planStructureEdit(molecule,oxygen.id);
  assert.equal(plan.mode,'structure');assert.ok(plan.ids.length<molecule.atoms.length/2);
}
{
  const {molecule,ids}=graph('methane'),plan=planStructureEdit(molecule,ids[0]);
  assert.equal(plan.mode,'atom-translate');assert.equal(plan.ids.length,5,'One-heavy-atom molecule moves together, never around one of its H');
  const extra=molecule.addAtom('O');const opts=editRelaxationOptions(molecule,{...plan,atomId:ids[0]});
  assert.ok(opts.lockedIds.has(extra.id));assert.ok(!opts.ids.has(extra.id));
}
assert.equal(planStructureEdit(new Molecule(),999),null);
console.log('Structure edit plans passed: local ring edits, outward substituents, fixed untouched atoms and independent scope.');
