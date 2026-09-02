import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/chemistry.js', import.meta.url), 'utf8');
const chemistry = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const records = JSON.parse(await readFile(new URL('../data/molecules.json', import.meta.url), 'utf8'));
chemistry.setMoleculeDatabase(records);
assert.ok(records.length >= 100, `Expected at least 100 molecule records, got ${records.length}`);

function moleculeFrom(record, reverse = false) {
  const molecule = new chemistry.Molecule();
  const order = reverse ? [...record.atoms.keys()].reverse() : [...record.atoms.keys()];
  const ids = new Map(order.map(index => [index, molecule.addAtom(record.atoms[index]).id]));
  for (const [a, b, bondOrder] of record.bonds) molecule.setBond(ids.get(a), ids.get(b), bondOrder);
  return molecule;
}

function formulaCounts(formula) {
  const matches = [...formula.matchAll(/([A-Z][a-z]?)(\d*)/g)];
  assert.equal(matches.map(match => match[0]).join(''), formula, `Invalid formula: ${formula}`);
  return Object.fromEntries(matches.map(([, symbol, count]) => [symbol, Number(count || 1)]));
}

const required = [
  'acetic-acid', 'formic-acid', 'propionic-acid', 'acetaldehyde', 'ethylene-glycol',
  'glycerol', 'benzene', 'toluene', 'phenol', 'aniline', 'ethyl-acetate',
  'hydrogen-peroxide', 'carbonic-acid', 'vinyl-chloride', 'chlorobenzene', 'acrylic-acid',
  'acetic-anhydride', 'glycine', 'alanine', 'terephthalic-acid', 'aspirin',
];
for (const id of required) assert.ok(records.some(record => record.id === id), `Missing required record: ${id}`);

for (const record of records) {
  assert.ok(record.iupacNameEn, `Missing IUPAC name: ${record.id}`);
  assert.deepEqual(formulaCounts(record.formula), chemistry.countElements(record.atoms), `Formula does not match graph: ${record.id}`);
  const adjacency = record.atoms.map(() => []);
  for (const [a, b] of record.bonds) { adjacency[a].push(b); adjacency[b].push(a); }
  const visited = new Set([0]), queue = [0];
  while (queue.length) for (const next of adjacency[queue.shift()]) if (!visited.has(next)) { visited.add(next); queue.push(next); }
  assert.equal(visited.size, record.atoms.length, `Disconnected molecule record: ${record.id}`);
  assert.equal(moleculeFrom(record).recognizedMolecule()?.id, record.id, `Failed self-recognition: ${record.id}`);
}

assert.equal(records.find(record => record.id === 'acetic-acid').iupacNameEn, 'Ethanoic acid');
assert.equal(records.find(record => record.id === 'toluene').iupacNameEn, 'Methylbenzene');
assert.equal(records.find(record => record.id === 'hydrogen-chloride').formula, 'HCl');

for (const id of required) {
  const record = records.find(item => item.id === id);
  assert.equal(moleculeFrom(record, true).recognizedMolecule()?.id, id, `Atom order changed recognition: ${id}`);
}

const ethanol = records.find(record => record.id === 'ethanol');
const dimethylEther = records.find(record => record.id === 'dimethyl-ether');
assert.equal(ethanol.formula, dimethylEther.formula);
assert.equal(moleculeFrom(ethanol).recognizedMolecule()?.id, 'ethanol');
assert.equal(moleculeFrom(dimethylEther).recognizedMolecule()?.id, 'dimethyl-ether');

const phenol = structuredClone(records.find(record => record.id === 'phenol'));
for (let index = 0; index < 6; index++) phenol.bonds[index][2] = phenol.bonds[index][2] === 1 ? 2 : 1;
assert.equal(moleculeFrom(phenol).recognizedMolecule()?.id, 'phenol', 'Alternate Kekulé form should match phenol');

console.log(`Recognition tests passed for ${records.length} molecule records.`);
