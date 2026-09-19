import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const chemistry = await import(new URL('../src/chemistry.js?recognition-test=1', import.meta.url));
const records = JSON.parse(await readFile(new URL('../data/molecules.json', import.meta.url), 'utf8'));
chemistry.setMoleculeDatabase(records);
assert.ok(records.length >= 100, `Expected at least 100 molecule records, got ${records.length}`);

function moleculeFrom(record, reverse = false, coordinates = null) {
  const molecule = new chemistry.Molecule();
  const order = reverse ? [...record.atoms.keys()].reverse() : [...record.atoms.keys()];
  const ids = new Map(order.map(index => [index, molecule.addAtom(record.atoms[index]).id]));
  for (const [a, b, bondOrder] of record.bonds) molecule.setBond(ids.get(a), ids.get(b), bondOrder);
  if (coordinates) for (const [index, point] of coordinates.entries()) {
    const atom = molecule.atoms.find(item => item.id === ids.get(index));
    atom.position = { x: point[0], y: point[1], z: point[2] };
  }
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


assert.equal(chemistry.MOLECULE_IDENTITY_SCOPE, 'constitutional');
assert.equal(chemistry.LEGACY_STEREOCHEMISTRY_UNSPECIFIED, 'unspecified');

const legacyStereoRecords = records.filter(record => Object.hasOwn(record, 'stereochemistry'));
assert.ok(legacyStereoRecords.length > 0, 'Expected legacy stereochemistry metadata records');
assert.ok(legacyStereoRecords.every(record => record.stereochemistry === 'unspecified'), 'Legacy stereochemistry must remain identity-scope "unspecified" metadata');

const butene2 = records.find(record => record.id === '2-butene');
const cisLike2Butene = [
  [-1.15,.78,0],[-.58,0,0],[.58,0,0],[1.15,.78,0],
  [-1.65,1.15,.55],[-1.62,1.12,-.55],[-1.2,.95,0],
  [-1.08,-.78,0],[1.08,-.78,0],
  [1.65,1.15,.55],[1.62,1.12,-.55],[1.2,.95,0],
];
const transLike2Butene = [
  [-1.15,.78,0],[-.58,0,0],[.58,0,0],[1.15,-.78,0],
  [-1.65,1.15,.55],[-1.62,1.12,-.55],[-1.2,.95,0],
  [-1.08,-.78,0],[1.08,.78,0],
  [1.65,-1.15,.55],[1.62,-1.12,-.55],[1.2,-.95,0],
];
assert.equal(moleculeFrom(butene2, false, cisLike2Butene).recognizedMolecule()?.id, '2-butene', 'cis-like pose must keep 2-butene constitutional identity');
assert.equal(moleculeFrom(butene2, false, transLike2Butene).recognizedMolecule()?.id, '2-butene', 'trans-like pose must keep 2-butene constitutional identity');

const butanol2 = records.find(record => record.id === '2-butanol');
const tetraBase = Array.from({length:butanol2.atoms.length},(_,index)=>[index*.11,index*.07,-index*.05]);
tetraBase[1]=[0,0,0];
tetraBase[0]=[1,1,1]; tetraBase[2]=[1,-1,-1]; tetraBase[4]=[-1,1,-1]; tetraBase[8]=[-1,-1,1];
const tetraMirror = tetraBase.map(([x,y,z])=>[-x,y,z]);
assert.equal(moleculeFrom(butanol2, false, tetraBase).recognizedMolecule()?.id, '2-butanol', 'tetrahedral pose must recognize by constitution');
assert.equal(moleculeFrom(butanol2, false, tetraMirror).recognizedMolecule()?.id, '2-butanol', 'mirror-related tetrahedral pose must keep constitutional identity');

const wrongBondOrder = structuredClone(butene2);
wrongBondOrder.bonds.find(([a,b]) => (a===1&&b===2)||(a===2&&b===1))[2]=1;
assert.notEqual(moleculeFrom(wrongBondOrder).recognizedMolecule()?.id, '2-butene', 'Bond order remains part of molecule identity');
const wrongConnectivity = structuredClone(butene2);
wrongConnectivity.bonds[0]=[0,2,1];
assert.notEqual(moleculeFrom(wrongConnectivity).recognizedMolecule()?.id, '2-butene', 'Connectivity remains part of molecule identity');

const legacyButene = {...structuredClone(butene2), stereochemistry:'unspecified'};
chemistry.setMoleculeDatabase([legacyButene]);
assert.equal(moleculeFrom(butene2, false, cisLike2Butene).recognizedMolecule()?.id, '2-butene', 'Legacy unspecified metadata must not alter recognition');
chemistry.setMoleculeDatabase([{...structuredClone(butene2), stereochemistry:undefined}]);
assert.equal(moleculeFrom(butene2, false, transLike2Butene).recognizedMolecule()?.id, '2-butene', 'Absence of legacy metadata must not alter recognition');
assert.throws(
  () => chemistry.setMoleculeDatabase([{...structuredClone(butene2), stereochemistry:'E'}]),
  /Invalid legacy stereochemistry/,
  'Legacy molecule-level stereochemistry must not become a configuration schema',
);
chemistry.setMoleculeDatabase(records);

console.log(`Recognition tests passed for ${records.length} molecule records.`);
