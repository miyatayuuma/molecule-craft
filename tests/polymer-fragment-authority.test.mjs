import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createPolymerDrawingInput,
  POLYMER_FRAGMENT_COUNT,
  readPolymerFragmentSources,
  validatePolymerFragmentAuthority,
} from '../scripts/polymer-fragment-authority.mjs';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const authority = await readJson('../data/polymer-fragment-authority.json');
const polymers = await readJson('../data/polymers.json');
const routeAuthority = await readJson('../data/polymerization-routes.json');
const encyclopedia = await readJson('../data/polymer-encyclopedia.json');
const routeSpecies = new Set(routeAuthority.routes.flatMap(route => route.feedSpecies));
const molecules = (await readJson('../data/molecules.json')).filter(molecule => routeSpecies.has(molecule.id));
const sources = { polymers, routes: routeAuthority.routes, encyclopedia, molecules };
const clone = () => structuredClone(authority);
const record = (input, polymerId) => input.records.find(item => item.polymerId === polymerId);

function expectDiagnostic(name, mutate, code, polymerId = 'polyethylene') {
  test(name, () => {
    const input = clone();
    mutate(input);
    const result = validatePolymerFragmentAuthority(input, sources);
    assert.equal(result.ok, false, 'corrupted authority must fail closed');
    const diagnostic = result.diagnostics.find(item => item.code === code);
    assert.ok(diagnostic, `expected ${code}; received ${JSON.stringify(result.diagnostics)}`);
    assert.equal(diagnostic.polymerId, polymerId);
    assert.equal(typeof diagnostic.field, 'string');
    assert.ok(diagnostic.message.length > 0);
  });
}

test('all 25 route and catalog structures validate and map one-to-one', () => {
  const result = validatePolymerFragmentAuthority(authority, sources);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.count, POLYMER_FRAGMENT_COUNT);
  assert.equal(new Set(result.polymerIds).size, POLYMER_FRAGMENT_COUNT);
  assert.deepEqual(new Set(authority.records.map(item => item.routeId)), new Set(routeAuthority.routes.map(item => item.routeId)));
  assert.equal(new Set(authority.records.map(item => item.encyclopediaNumber)).size, POLYMER_FRAGMENT_COUNT);
  assert.ok(authority.records.every(item => encyclopedia.some(entry => entry.id === item.polymerId && entry.number === item.encyclopediaNumber)));
  assert.equal(authority.records.filter(item => item.representationType === 'linear-repeat').length, 19);
  assert.equal(authority.records.filter(item => item.representationType === 'copolymer-local-motif').length, 5);
  assert.equal(authority.records.filter(item => item.representationType === 'network-junction').length, 1);
  assert.ok(authority.records.every(item => item.review.status === 'reviewed' && item.review.checks.length === 7));
  assert.ok(authority.records.every(item => item.review.checks.every(check => check.status === 'pass' && check.result && check.evidence.length > 0)));
});

test('Task⑦ drawing input is validated, normalized and deterministic', () => {
  const first = createPolymerDrawingInput(authority, 'polyethylene-terephthalate', sources);
  const second = createPolymerDrawingInput(authority, 'polyethylene-terephthalate', sources);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.encyclopediaNumber, 11);
  assert.equal(first.representationType, 'linear-repeat');
  assert.equal(first.backboneAtomRefs.length, 12);
  assert.equal(first.continuationPorts.length, 2);
  assert.ok(first.bonds.every(bond => [1, 2, 3].includes(bond.order)));
  assert.equal(first.provenance.sourceCommit, authority.sourceCommit);
  assert.equal(Object.hasOwn(first, 'coordinates'), false);
});

test('all 25 authority records produce deterministic renderer-ready drawing input', () => {
  for (const sourceRecord of authority.records) {
    const first = createPolymerDrawingInput(authority, sourceRecord.polymerId, sources);
    const second = createPolymerDrawingInput(authority, sourceRecord.polymerId, sources);
    assert.equal(first.polymerId, sourceRecord.polymerId);
    assert.equal(first.validation.status, 'passed');
    assert.ok(first.atoms.length > 0, `${sourceRecord.polymerId} has drawing atoms`);
    assert.ok(first.bonds.length > 0, `${sourceRecord.polymerId} has drawing bonds`);
    assert.equal(JSON.stringify(first), JSON.stringify(second), `${sourceRecord.polymerId} output is deterministic`);
    assert.equal(Object.hasOwn(first, 'coordinates'), false, `${sourceRecord.polymerId} does not prescribe layout coordinates`);
  }
});

test('copolymer, diene, fluoropolymer and independent network qualifiers remain explicit', () => {
  const copolymer = createPolymerDrawingInput(authority, 'butyl-rubber', sources);
  const diene = createPolymerDrawingInput(authority, 'polybutadiene', sources);
  const pvdf = createPolymerDrawingInput(authority, 'polyvinylidene-fluoride', sources);
  const sbr = createPolymerDrawingInput(authority, 'styrene-butadiene-copolymer', sources);
  const phenolic = createPolymerDrawingInput(authority, 'phenol-formaldehyde-resin', sources);
  assert.equal(copolymer.qualifiers.localSequence, 'local-example-only');
  assert.equal(copolymer.qualifiers.bulkComposition, 'not-asserted');
  assert.equal(copolymer.localSequence.meaning, 'finite route-local example only; not bulk sequence or composition');
  assert.equal(diene.qualifiers.cisTrans, 'unspecified');
  assert.equal(pvdf.qualifiers.regiochemistry, 'varies');
  assert.equal(sbr.provenance.routeSampleRelation, 'route-transformation-equivalent-local-sequence');
  assert.equal(sbr.qualifiers.regiochemistry, 'local-1,4-motif-only; bulk-regiosequence-unspecified');
  assert.ok(sbr.backboneAtomRefs.includes('unit-1.a6'));
  assert.equal(sbr.backboneAtomRefs.includes('unit-1.a0'), false);
  assert.equal(createPolymerDrawingInput(authority, 'polyethylene', sources).qualifiers.crosslinking, 'not-implied');
  assert.equal(phenolic.qualifiers.crosslinking, 'local-network-motif-only');
  assert.equal(phenolic.provenance.routeSampleRelation, 'independent-motif-not-gameplay-polymer-sample');
  assert.equal(phenolic.continuationPorts.length, 3);
  assert.equal(phenolic.backboneAtomRefs.length, 0);
});

expectDiagnostic('rejects an unknown polymerId', input => { input.records[0].polymerId = 'unknown-polymer'; }, 'UNKNOWN_POLYMER_ID', 'unknown-polymer');
expectDiagnostic('rejects duplicate polymer records', input => { input.records[1].polymerId = input.records[0].polymerId; }, 'DUPLICATE_POLYMER_ID', 'polyethylene');
expectDiagnostic('rejects a missing source atom mapping', input => { record(input, 'polyethylene').atoms[0].source.atomIndex = 999; }, 'SOURCE_ATOM_MISSING');
expectDiagnostic('rejects an invalid bond endpoint', input => { record(input, 'polyethylene').bonds[0].b = 'ghost.atom'; }, 'BOND_ENDPOINT');
expectDiagnostic('rejects an invalid bond order', input => { record(input, 'polyethylene').bonds[0].order = 4; }, 'BOND_ORDER');
expectDiagnostic('rejects duplicate bonds', input => { const r = record(input, 'polyethylene'); r.bonds.push(structuredClone(r.bonds[0])); }, 'DUPLICATE_BOND');
expectDiagnostic('rejects excess valence including open-boundary ports', input => { record(input, 'polyethylene').bonds[0].order = 3; }, 'VALENCE');
expectDiagnostic('rejects a continuation port with an unmapped atom', input => { record(input, 'polyethylene').continuationPorts[0].atomRef = 'ghost.atom'; }, 'CONTINUATION_PORT');
expectDiagnostic('rejects an incompatible repeat closure boundary', input => { record(input, 'polyethylene').repeatClosure.leftPortId = 'missing'; }, 'REPEAT_BOUNDARY');
expectDiagnostic('rejects a repeat closure with the wrong bond order', input => { record(input, 'polyethylene').repeatClosure.bondOrder = 2; }, 'REPEAT_BOUNDARY');
expectDiagnostic('rejects invalid copolymer component grouping', input => { record(input, 'ethylene-propylene-copolymer').componentGroups[0].sourceComponentRef = 'missing-component'; }, 'COMPONENT_GROUP_MAPPING', 'ethylene-propylene-copolymer');
expectDiagnostic('rejects unsupported stereochemistry', input => { record(input, 'polypropylene').qualifiers.stereochemistry.status = 'specified'; }, 'UNSUPPORTED_STEREOCHEMISTRY', 'polypropylene');
expectDiagnostic('rejects an unsupported fixed copolymer ratio', input => { record(input, 'butyl-rubber').qualifiers.bulkMolarRatio = '1:1'; }, 'COPOLYMER_RATIO', 'butyl-rubber');
expectDiagnostic('rejects a diene motif without its residual backbone C=C', input => { const r = record(input, 'polybutadiene'); r.bonds.find(bond => bond.a === 'repeat.a1' && bond.b === 'repeat.a2').order = 1; }, 'DIENE_CONNECTIVITY', 'polybutadiene');
expectDiagnostic('rejects a linearized or severed phenolic network branch', input => { const r = record(input, 'phenol-formaldehyde-resin'); r.bonds.splice(r.bonds.findIndex(bond => bond.provenance?.operationId === 'bridge-1-core'), 1); }, 'NETWORK_BRANCH_DISCONNECTED', 'phenol-formaldehyde-resin');
expectDiagnostic('rejects a fake phenolic branch continuation port', input => { record(input, 'phenol-formaldehyde-resin').continuationPorts[0].atomRef = 'phenol-core.a2'; }, 'FAKE_PHENOLIC_BRANCH_PORT', 'phenol-formaldehyde-resin');
expectDiagnostic('rejects an independently authored atom without source-atom mapping', input => { record(input, 'phenol-formaldehyde-resin').atoms.push({ id: 'unmapped.atom', element: 'C', formalCharge: 0, role: 'network-bridge', source: { componentRef: 'invented-component', moleculeId: 'phenol', atomIndex: 0 } }); }, 'SOURCE_ATOM_MISSING', 'phenol-formaldehyde-resin');
expectDiagnostic('rejects independent motif bonds without cited structural provenance', input => { record(input, 'phenol-formaldehyde-resin').source.citations = []; }, 'INDEPENDENT_SOURCE_MISSING', 'phenol-formaldehyde-resin');
expectDiagnostic('rejects incorrect phenolic aromatic substitution', input => { const r = record(input, 'phenol-formaldehyde-resin'); r.bonds.find(bond => bond.a === 'phenol-core.a0' && bond.b === 'phenol-core.a1').order = 1; }, 'PHENOLIC_AROMATIC_SUBSTITUTION', 'phenol-formaldehyde-resin');
expectDiagnostic('rejects styrene phenyl-ring edits in the independent SBR motif', input => { const r = record(input, 'styrene-butadiene-copolymer'); r.bonds.find(bond => bond.a === 'unit-1.a0' && bond.b === 'unit-1.a1').order = 1; }, 'SBR_STYRENE_PHENYL_RING', 'styrene-butadiene-copolymer');
expectDiagnostic('rejects incorrect hydrogen-to-water mapping', input => { record(input, 'phenol-formaldehyde-resin').sourceAccounting.byproductGroups[0].sourceAtomRefs.pop(); }, 'HYDROGEN_ACCOUNTING', 'phenol-formaldehyde-resin');
expectDiagnostic('rejects polycondensation water mapped to the wrong hydrogen source', input => { record(input, 'polyethylene-terephthalate').sourceAccounting.byproductGroups[0].sourceAtomRefs[2].atomIndex = 17; }, 'HYDROGEN_ACCOUNTING', 'polyethylene-terephthalate');
expectDiagnostic('rejects a false route-sample equivalence claim', input => { record(input, 'polyethylene').source.routeSampleRelation = 'route-sample-equivalent'; }, 'ROUTE_SAMPLE_RELATION');
expectDiagnostic('rejects an SBR graph incorrectly marked as independent from its matching route sample', input => { record(input, 'styrene-butadiene-copolymer').source.routeSampleRelation = 'independent-motif-not-gameplay-polymer-sample'; }, 'ROUTE_SAMPLE_RELATION', 'styrene-butadiene-copolymer');
expectDiagnostic('rejects a route transformation without an authorized family', input => { record(input, 'polyethylene').transformations[0].family = null; }, 'BOND_TRANSFORM_FAMILY');
expectDiagnostic('rejects an unreviewed structural check', input => { record(input, 'polyethylene').review.checks[0].status = 'pending'; }, 'SCIENTIFIC_REVIEW');

test('duplicate catalog IDs are diagnosed instead of being collapsed by the lookup map', () => {
  const duplicateCatalog = structuredClone(polymers);
  duplicateCatalog[1].id = duplicateCatalog[0].id;
  const result = validatePolymerFragmentAuthority(authority, { ...sources, polymers: duplicateCatalog });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(item => item.code === 'DUPLICATE_CATALOG_POLYMER_ID'));
});

expectDiagnostic('rejects an authority entry with the wrong encyclopedia number', input => { record(input, 'polyethylene').encyclopediaNumber = 25; }, 'ENCYCLOPEDIA_MAPPING');

test('duplicate encyclopedia IDs are diagnosed instead of being collapsed by the lookup map', () => {
  const duplicateEncyclopedia = structuredClone(encyclopedia);
  duplicateEncyclopedia[1].id = duplicateEncyclopedia[0].id;
  const result = validatePolymerFragmentAuthority(authority, { ...sources, encyclopedia: duplicateEncyclopedia });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(item => item.code === 'DUPLICATE_ENCYCLOPEDIA_POLYMER_ID'));
});

test('missing current sources fail with actionable diagnostics', () => {
  const result = validatePolymerFragmentAuthority(authority, { polymers, routes: routeAuthority.routes, encyclopedia, molecules: [] });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(item => item.code === 'UNKNOWN_SOURCE_MOLECULE' && item.polymerId === 'polyethylene'));
  assert.ok(result.diagnostics.every(item => item.field && item.message));
});

test('source loader and CLI contract load exactly the current structural inputs', async () => {
  const loaded = await readPolymerFragmentSources(new URL('../', import.meta.url).pathname);
  assert.equal(loaded.authority.records.length, POLYMER_FRAGMENT_COUNT);
  assert.equal(validatePolymerFragmentAuthority(loaded.authority, loaded.sources).ok, true);
});
