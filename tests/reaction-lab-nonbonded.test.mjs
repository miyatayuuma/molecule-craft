import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadMoleculeDatabase, moleculeCatalog, moleculeRecord, moleculeDatabaseStatus } from '../src/chemistry.js';

const records = JSON.parse(await readFile(new URL('../data/molecules.json', import.meta.url), 'utf8'));
globalThis.fetch = async () => ({ ok: true, json: async () => records });
const loaded = await loadMoleculeDatabase(new URL('../data/molecules.json', import.meta.url));
assert.equal(loaded.ok, true);
assert.equal(moleculeDatabaseStatus().source, 'network');

const catalog = moleculeCatalog();
assert.equal(catalog.length, 142);
for (const record of catalog) {
  const parameters = record.nonbonded;
  assert(parameters, `${record.id} must carry canonical nonbonded parameters`);
  for (const key of ['atomicChargesE', 'sigmaAngstrom', 'epsilonKcalMol', 'vdwParameterIds', 'atomMap']) {
    assert.equal(parameters[key].length, record.atoms.length, `${record.id}.${key} must map every atom`);
    assert(Object.isFrozen(parameters[key]), `${record.id}.${key} must be immutable in the published database`);
  }
}

assert.deepEqual(moleculeRecord('water').nonbonded.atomicChargesE, [-0.834, 0.417, 0.417]);
for (const id of ['hydrogen', 'oxygen', 'nitrogen', 'chlorine']) {
  assert(moleculeRecord(id).nonbonded.atomicChargesE.every(charge => charge === 0), `${id} must use explicit zero charges`);
}

console.log('Canonical nonbonded records validated and frozen in the molecule database.');
