import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const chemistry = await import(new URL('../src/chemistry.js?recognition-test=1', import.meta.url));
const records = JSON.parse(await readFile(new URL('../data/molecules.json', import.meta.url), 'utf8'));
chemistry.setMoleculeDatabase(records);
assert.ok(records.length >= 100, `Expected at least 100 molecule records, got ${records.length}`);

function moleculeFrom(record, reverse = false, positions = null) {
  const molecule = new chemistry.Molecule();
  const order = reverse ? [...record.atoms.keys()].reverse() : [...record.atoms.keys()];
  const ids = new Map(order.map(index => {
    const atom = molecule.addAtom(record.atoms[index]);
    if (positions?.[index]) atom.position = { x: positions[index][0], y: positions[index][1], z: positions[index][2] };
    return [index, atom.id];
  }));
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

assert.equal(chemistry.MOLECULE_IDENTITY_SCOPE, 'constitutional');
assert.equal(chemistry.LEGACY_STEREOCHEMISTRY_UNSPECIFIED, 'unspecified');

const legacyStereoIds = records.filter(record => Object.hasOwn(record, 'stereochemistry')).map(record => record.id).sort();
assert.deepEqual(legacyStereoIds, ['cysteine', 'malic-acid', 'methionine', 'serine'], 'Legacy stereochemistry coverage must not expand as a side effect of the identity contract');

const butene2 = records.find(record => record.id === '2-butene');
const transLike2Butene = [
  [-1.70, 0.90, 0], [-0.60, 0, 0], [0.60, 0, 0], [1.70, -0.90, 0],
  [-2.20, 1.35, 0.70], [-2.20, 1.35, -0.70], [-1.95, 0.20, 0],
  [-1.10, -0.95, 0], [1.10, 0.95, 0],
  [1.95, -0.20, 0], [2.20, -1.35, 0.70], [2.20, -1.35, -0.70],
];
const cisLike2Butene = transLike2Butene.map(point => [...point]);
cisLike2Butene[3] = [1.70, 0.90, 0];
cisLike2Butene[8] = [1.10, -0.95, 0];
cisLike2Butene[9] = [1.95, 0.20, 0];
cisLike2Butene[10] = [2.20, 1.35, 0.70];
cisLike2Butene[11] = [2.20, 1.35, -0.70];
assert.notDeepEqual(cisLike2Butene, transLike2Butene);
assert.equal(moleculeFrom(butene2, false, transLike2Butene).recognizedMolecule()?.id, '2-butene', 'Trans-like 2-butene pose changed constitutional identity');
assert.equal(moleculeFrom(butene2, false, cisLike2Butene).recognizedMolecule()?.id, '2-butene', 'Cis-like 2-butene pose changed constitutional identity');

const butanol2 = records.find(record => record.id === '2-butanol');
const tetrahedralPose = butanol2.atoms.map((_, index) => [index * 0.17, index * -0.09, index * 0.05]);
tetrahedralPose[1] = [0, 0, 0];
tetrahedralPose[0] = [1, 1, 1];
tetrahedralPose[2] = [1, -1, -1];
tetrahedralPose[4] = [-1, 1, -1];
tetrahedralPose[8] = [-1, -1, 1];
const mirrorPose = tetrahedralPose.map(([x, y, z]) => [-x, y, z]);
const signedTetraVolume = (pose, [a, b, c, d]) => {
  const subtract = (left, right) => left.map((value, index) => value - right[index]);
  const cross = (left, right) => [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
  const u = subtract(pose[a], pose[d]), v = subtract(pose[b], pose[d]), w = subtract(pose[c], pose[d]);
  const vxw = cross(v, w);
  return u[0] * vxw[0] + u[1] * vxw[1] + u[2] * vxw[2];
};
const stereoNeighbors = [0, 2, 4, 8];
assert.ok(signedTetraVolume(tetrahedralPose, stereoNeighbors) * signedTetraVolume(mirrorPose, stereoNeighbors) < 0, 'Mirror fixture did not invert tetrahedral handedness');
assert.equal(moleculeFrom(butanol2, false, tetrahedralPose).recognizedMolecule()?.id, '2-butanol', 'Tetrahedral pose A changed constitutional identity');
assert.equal(moleculeFrom(butanol2, false, mirrorPose).recognizedMolecule()?.id, '2-butanol', 'Mirror-related tetrahedral pose changed constitutional identity');

const wrongButeneBondOrder = moleculeFrom(butene2, false, transLike2Butene);
wrongButeneBondOrder.bonds.find(bond => bond.order === 2).order = 1;
assert.notEqual(wrongButeneBondOrder.recognizedMolecule()?.id, '2-butene', 'Bond order must remain part of constitutional identity');

const unmarkedButanol = structuredClone(butanol2);
delete unmarkedButanol.stereochemistry;
const legacyMarkedButanol = { ...structuredClone(unmarkedButanol), stereochemistry: 'unspecified' };
const butanolProbe = moleculeFrom(butanol2, false, tetrahedralPose);
chemistry.setMoleculeDatabase([unmarkedButanol]);
assert.equal(butanolProbe.recognizedMolecule()?.id, '2-butanol', 'Unmarked constitutional record did not recognize');
chemistry.setMoleculeDatabase([legacyMarkedButanol]);
assert.equal(butanolProbe.recognizedMolecule()?.id, '2-butanol', 'Legacy unspecified metadata changed recognition');
assert.throws(
  () => chemistry.setMoleculeDatabase([{ ...structuredClone(unmarkedButanol), stereochemistry: 'R' }]),
  /Invalid legacy stereochemistry/,
  'Legacy molecule-level stereochemistry must not grow into a configuration schema',
);
chemistry.setMoleculeDatabase(records);

console.log(`Recognition tests passed for ${records.length} molecule records.`);
