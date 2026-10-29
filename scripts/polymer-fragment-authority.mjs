import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

export const POLYMER_FRAGMENT_AUTHORITY_SCHEMA_VERSION = 1;
export const POLYMER_FRAGMENT_COUNT = 25;
const REQUIRED_AUTHORITY_SOURCES = Object.freeze([
  'data/polymers.json', 'data/polymerization-routes.json', 'data/polymer-encyclopedia.json', 'data/molecules.json',
  'src/reaction-lab-polymerization.js', 'src/reaction-graph-edits.js',
  'src/polymerization-routes.js', 'src/polymer-catalog.js',
  'docs/planning/polymer-presentation-rebaseline.md',
]);
const representationTypes = new Set(['linear-repeat', 'copolymer-local-motif', 'network-junction']);
const valenceByElement = Object.freeze({ H: 1, C: 4, N: 3, O: 2, F: 1, Cl: 1 });
const keyFor = (a, b) => [a, b].sort().join('|');
const sourceKey = (componentRef, atomIndex) => `${componentRef}:${atomIndex}`;

export class PolymerFragmentAuthorityError extends Error {
  constructor(diagnostics) {
    super(diagnostics.map(item => `${item.polymerId ?? 'authority'} ${item.field}: ${item.message}`).join('\n'));
    this.name = 'PolymerFragmentAuthorityError';
    this.diagnostics = diagnostics;
  }
}

function sourceElement(molecule, index) {
  const atom = molecule?.atoms?.[index];
  return typeof atom === 'string' ? atom : atom?.element;
}
function sourceCharge(molecule, index) {
  const atom = molecule?.atoms?.[index];
  return typeof atom === 'string' ? 0 : (atom?.formalCharge ?? atom?.charge ?? 0);
}
function sourceBonds(molecule) {
  return (molecule?.bonds ?? []).map((bond, bondIndex) => ({ bondIndex, a: bond[0], b: bond[1], order: bond[2] }));
}
function sourceNeighbors(molecule, atomIndex) {
  return sourceBonds(molecule).flatMap(bond => bond.a === atomIndex ? [{ atomIndex: bond.b, order: bond.order }] : bond.b === atomIndex ? [{ atomIndex: bond.a, order: bond.order }] : []);
}
function graphAdjacency(record) {
  const adjacency = new Map(record.atoms.map(atom => [atom.id, []]));
  for (const bond of record.bonds) {
    adjacency.get(bond.a)?.push({ atomRef: bond.b, order: bond.order });
    adjacency.get(bond.b)?.push({ atomRef: bond.a, order: bond.order });
  }
  return adjacency;
}
function connectedCount(atomRefs, bonds) {
  if (!atomRefs.length) return 0;
  const members = new Set(atomRefs);
  const adjacency = new Map(atomRefs.map(ref => [ref, []]));
  for (const bond of bonds) {
    if (members.has(bond.a) && members.has(bond.b)) {
      adjacency.get(bond.a).push(bond.b);
      adjacency.get(bond.b).push(bond.a);
    }
  }
  const seen = new Set([atomRefs[0]]);
  const pending = [atomRefs[0]];
  while (pending.length) {
    for (const next of adjacency.get(pending.pop()) ?? []) {
      if (!seen.has(next)) { seen.add(next); pending.push(next); }
    }
  }
  return seen.size;
}
function findDienePath(molecule) {
  const adjacency = Array.from({ length: molecule.atoms.length }, () => []);
  for (const bond of sourceBonds(molecule)) {
    adjacency[bond.a].push({ to: bond.b, order: bond.order, bondIndex: bond.bondIndex });
    adjacency[bond.b].push({ to: bond.a, order: bond.order, bondIndex: bond.bondIndex });
  }
  for (let c1 = 0; c1 < molecule.atoms.length; c1 += 1) {
    if (sourceElement(molecule, c1) !== 'C') continue;
    for (const first of adjacency[c1].filter(edge => edge.order === 2 && sourceElement(molecule, edge.to) === 'C')) {
      for (const middle of adjacency[first.to].filter(edge => edge.to !== c1 && edge.order === 1 && sourceElement(molecule, edge.to) === 'C')) {
        const last = adjacency[middle.to].find(edge => edge.to !== first.to && edge.order === 2 && sourceElement(molecule, edge.to) === 'C');
        if (last) return { atoms: [c1, first.to, middle.to, last.to], bonds: [first.bondIndex, middle.bondIndex, last.bondIndex] };
      }
    }
  }
  return null;
}
function hasDieneTransform(record, componentRef, molecule) {
  const path = findDienePath(molecule);
  if (!path) return true;
  const edits = (record.transformations ?? []).filter(edit => edit.componentRef === componentRef && edit.family === 'diene');
  const expected = new Map([[path.bonds[0], [2, 1]], [path.bonds[1], [1, 2]], [path.bonds[2], [2, 1]]]);
  for (const [bondIndex, [from, to]] of expected) {
    if (!edits.some(edit => edit.type === 'change' && edit.bondIndex === bondIndex && edit.from === from && edit.to === to)) return false;
    const [a, b] = molecule.bonds[bondIndex];
    const aRef = record.atoms.find(atom => atom.source.componentRef === componentRef && atom.source.atomIndex === a)?.id;
    const bRef = record.atoms.find(atom => atom.source.componentRef === componentRef && atom.source.atomIndex === b)?.id;
    const graphBond = record.bonds.find(edge => keyFor(edge.a, edge.b) === keyFor(aRef, bRef));
    if (!graphBond || graphBond.order !== to) return false;
  }
  return true;
}
function addDiagnostic(diagnostics, code, polymerId, field, message) {
  diagnostics.push({ code, polymerId: polymerId ?? null, field, message });
}

function validateByproductAccounting(record, { excludedByKey, fail }) {
  const rawGroups = record.sourceAccounting?.byproductGroups;
  const groups = Array.isArray(rawGroups) ? rawGroups : [];
  if (rawGroups !== undefined && !Array.isArray(rawGroups)) fail('HYDROGEN_ACCOUNTING', 'sourceAccounting.byproductGroups', 'Byproduct groups must be an array.');
  const excludedByproductAtoms = [...excludedByKey.entries()].filter(([, excluded]) => typeof excluded.byproductId === 'string' && excluded.byproductId);
  const families = new Set([...(record.transformations ?? []).map(operation => operation.family), record.repeatClosure?.transformFamily]);
  const isCondensation = [...families].some(family => ['ester-condensation', 'amide-condensation'].includes(family));
  if (isCondensation && (!groups.length || !excludedByproductAtoms.length)) fail('HYDROGEN_ACCOUNTING', 'sourceAccounting.byproductGroups', 'Condensation records require explicit byproduct groups that account for excluded source atoms.');

  const expectedIds = new Set(excludedByproductAtoms.map(([, excluded]) => excluded.byproductId));
  const groupIds = new Set();
  const coverage = new Map();
  for (const group of groups) {
    if (!group || typeof group.id !== 'string' || !group.id || groupIds.has(group.id)) {
      fail('HYDROGEN_ACCOUNTING', 'sourceAccounting.byproductGroups', 'Byproduct group ids must be non-empty and unique.');
      continue;
    }
    groupIds.add(group.id);
    if (!expectedIds.has(group.id)) fail('HYDROGEN_ACCOUNTING', `sourceAccounting.byproductGroups.${group.id}`, 'Byproduct group has no excluded source atoms assigned to it.');
    const refs = Array.isArray(group.sourceAtomRefs) ? group.sourceAtomRefs : [];
    if (!Array.isArray(group.sourceAtomRefs)) fail('HYDROGEN_ACCOUNTING', `sourceAccounting.byproductGroups.${group.id}`, 'Byproduct sourceAtomRefs must be an array.');
    for (const ref of refs) {
      if (!ref || typeof ref.componentRef !== 'string' || !Number.isInteger(ref.atomIndex)) continue;
      const key = sourceKey(ref.componentRef, ref.atomIndex);
      coverage.set(key, (coverage.get(key) ?? 0) + 1);
      const excluded = excludedByKey.get(key);
      if (!excluded || excluded.byproductId !== group.id) fail('HYDROGEN_ACCOUNTING', `sourceAccounting.byproductGroups.${group.id}`, 'Every mapped byproduct atom must be excluded under the same byproduct id.');
    }
  }
  for (const [key, excluded] of excludedByproductAtoms) {
    if (coverage.get(key) !== 1) fail('HYDROGEN_ACCOUNTING', 'sourceAccounting.byproductGroups', `Excluded byproduct source atom ${key} must be mapped exactly once under ${excluded.byproductId}.`);
  }
}

function validateCondensationHydrogenAccounting(record, { components, moleculeById, excludedByKey, fail }) {
  const families = new Set([...record.transformations.map(operation => operation.family), record.repeatClosure?.transformFamily]);
  if (![...families].some(family => ['ester-condensation', 'amide-condensation'].includes(family))) return;
  for (const group of Array.isArray(record.sourceAccounting?.byproductGroups) ? record.sourceAccounting.byproductGroups : []) {
    const refs = group.sourceAtomRefs ?? [];
    const oxygenRef = refs.find(ref => {
      const component = components.get(ref.componentRef);
      return sourceElement(moleculeById.get(component?.moleculeId), ref.atomIndex) === 'O';
    });
    const hydrogenRefs = refs.filter(ref => {
      const component = components.get(ref.componentRef);
      return sourceElement(moleculeById.get(component?.moleculeId), ref.atomIndex) === 'H';
    });
    if (!oxygenRef || hydrogenRefs.length !== 2) continue;
    const oxygenComponent = components.get(oxygenRef.componentRef);
    const oxygenMolecule = moleculeById.get(oxygenComponent?.moleculeId);
    const oxygenNeighbors = sourceNeighbors(oxygenMolecule, oxygenRef.atomIndex);
    const carbonylCarbon = oxygenNeighbors.find(neighbor => sourceElement(oxygenMolecule, neighbor.atomIndex) === 'C'
      && sourceBonds(oxygenMolecule).some(bond => bond.order === 2
        && ((bond.a === neighbor.atomIndex && sourceElement(oxygenMolecule, bond.b) === 'O') || (bond.b === neighbor.atomIndex && sourceElement(oxygenMolecule, bond.a) === 'O'))));
    const acidHydrogen = hydrogenRefs.find(ref => ref.componentRef === oxygenRef.componentRef
      && sourceNeighbors(oxygenMolecule, ref.atomIndex).some(neighbor => neighbor.atomIndex === oxygenRef.atomIndex && sourceElement(oxygenMolecule, neighbor.atomIndex) === 'O'));
    const donorHydrogen = hydrogenRefs.find(ref => ref !== acidHydrogen);
    const donorComponent = components.get(donorHydrogen?.componentRef);
    const donorMolecule = moleculeById.get(donorComponent?.moleculeId);
    const donorNeighbor = donorHydrogen && sourceNeighbors(donorMolecule, donorHydrogen.atomIndex)
      .find(neighbor => ['O', 'N'].includes(sourceElement(donorMolecule, neighbor.atomIndex))
        && !(donorHydrogen.componentRef === oxygenRef.componentRef && neighbor.atomIndex === oxygenRef.atomIndex));
    const donorAtomNeighbors = donorNeighbor ? sourceNeighbors(donorMolecule, donorNeighbor.atomIndex) : [];
    const donorCarbon = donorAtomNeighbors.some(neighbor => sourceElement(donorMolecule, neighbor.atomIndex) === 'C'
      && !sourceBonds(donorMolecule).some(bond => bond.order === 2
        && ((bond.a === neighbor.atomIndex && sourceElement(donorMolecule, bond.b) === 'O') || (bond.b === neighbor.atomIndex && sourceElement(donorMolecule, bond.a) === 'O'))));
    const accountingIsExplicit = [oxygenRef, ...hydrogenRefs].every(ref => {
      const excluded = excludedByKey.get(sourceKey(ref.componentRef, ref.atomIndex));
      return excluded?.byproductId === group.id
        && excluded.reason === (ref === oxygenRef ? 'condensation-byproduct-water-oxygen' : 'condensation-byproduct-water-hydrogen');
    });
    if (!carbonylCarbon || !acidHydrogen || !donorHydrogen || !donorNeighbor || !donorCarbon || !accountingIsExplicit) fail('HYDROGEN_ACCOUNTING', `sourceAccounting.byproductGroups.${group.id}`, 'Condensation water must map the carboxylic-acid hydroxyl oxygen and hydrogen plus one hydrogen from the alcohol or amine donor; all three source atoms must be excluded under the same byproduct id.');
  }
}

export function validatePolymerFragmentAuthority(input, { polymers, routes, encyclopedia, molecules } = {}) {
  const diagnostics = [];
  if (!input || input.schemaVersion !== POLYMER_FRAGMENT_AUTHORITY_SCHEMA_VERSION || !Array.isArray(input.records)) {
    return { ok: false, diagnostics: [{ code: 'AUTHORITY_ENVELOPE', polymerId: null, field: 'schemaVersion/records', message: 'Expected schemaVersion 1 and a records array.' }], count: 0 };
  }
  if (!Array.isArray(polymers) || polymers.length !== POLYMER_FRAGMENT_COUNT) addDiagnostic(diagnostics, 'CATALOG_POPULATION', null, 'polymers', `Expected exactly ${POLYMER_FRAGMENT_COUNT} catalog records.`);
  if (!Array.isArray(routes) || routes.length !== POLYMER_FRAGMENT_COUNT) addDiagnostic(diagnostics, 'ROUTE_POPULATION', null, 'routes', `Expected exactly ${POLYMER_FRAGMENT_COUNT} routes.`);
  if (!Array.isArray(encyclopedia) || encyclopedia.length !== POLYMER_FRAGMENT_COUNT) addDiagnostic(diagnostics, 'ENCYCLOPEDIA_POPULATION', null, 'encyclopedia', `Expected exactly ${POLYMER_FRAGMENT_COUNT} encyclopedia entries.`);
  if (!Array.isArray(molecules)) addDiagnostic(diagnostics, 'MOLECULE_SOURCE', null, 'molecules', 'Source molecule records are required.');
  if (typeof input.sourceCommit !== 'string' || !input.sourceCommit || REQUIRED_AUTHORITY_SOURCES.some(path => !(input.sourceFiles ?? []).includes(path))) addDiagnostic(diagnostics, 'AUTHORITY_PROVENANCE', null, 'sourceCommit/sourceFiles', 'Authority must identify its source commit and all current structure, route and transformation authorities.');
  const catalogById = new Map((polymers ?? []).map(record => [record.id, record]));
  const routeById = new Map((routes ?? []).map(route => [route.routeId, route]));
  const encyclopediaById = new Map((encyclopedia ?? []).map(entry => [entry.id, entry]));
  const moleculeById = new Map((molecules ?? []).map(molecule => [molecule.id, molecule]));
  if (catalogById.size !== (polymers ?? []).length) addDiagnostic(diagnostics, 'DUPLICATE_CATALOG_POLYMER_ID', null, 'polymers.id', 'Catalog polymer ids must be unique.');
  if (routeById.size !== (routes ?? []).length) addDiagnostic(diagnostics, 'DUPLICATE_ROUTE_ID', null, 'routes.routeId', 'Route ids must be unique.');
  if (encyclopediaById.size !== (encyclopedia ?? []).length) addDiagnostic(diagnostics, 'DUPLICATE_ENCYCLOPEDIA_POLYMER_ID', null, 'encyclopedia.id', 'Encyclopedia polymer ids must be unique.');
  if (new Set((encyclopedia ?? []).map(entry => entry.number)).size !== (encyclopedia ?? []).length) addDiagnostic(diagnostics, 'DUPLICATE_ENCYCLOPEDIA_NUMBER', null, 'encyclopedia.number', 'Encyclopedia entry numbers must be unique.');
  if (input.records.length !== POLYMER_FRAGMENT_COUNT) addDiagnostic(diagnostics, 'AUTHORITY_POPULATION', null, 'records', `Expected exactly ${POLYMER_FRAGMENT_COUNT} records; found ${input.records.length}.`);
  const recordById = new Map();
  for (const record of input.records) {
    if (!record || typeof record.polymerId !== 'string') {
      addDiagnostic(diagnostics, 'POLYMER_ID_MISSING', null, 'polymerId', 'Every record must have a polymerId.');
      continue;
    }
    if (recordById.has(record.polymerId)) addDiagnostic(diagnostics, 'DUPLICATE_POLYMER_ID', record.polymerId, 'polymerId', 'Duplicate structural authority record.');
    else recordById.set(record.polymerId, record);
  }
  for (const polymerId of catalogById.keys()) if (!recordById.has(polymerId)) addDiagnostic(diagnostics, 'AUTHORITY_RECORD_MISSING', polymerId, 'records', 'Catalog polymer has no structural authority record.');
  for (const polymerId of recordById.keys()) if (!catalogById.has(polymerId)) addDiagnostic(diagnostics, 'UNKNOWN_POLYMER_ID', polymerId, 'polymerId', 'Record does not map to the current polymer catalog.');
  for (const polymerId of catalogById.keys()) if (!encyclopediaById.has(polymerId)) addDiagnostic(diagnostics, 'ENCYCLOPEDIA_ENTRY_MISSING', polymerId, 'encyclopedia', 'Catalog polymer has no encyclopedia entry.');
  for (const polymerId of encyclopediaById.keys()) if (!catalogById.has(polymerId)) addDiagnostic(diagnostics, 'ENCYCLOPEDIA_UNKNOWN_POLYMER_ID', polymerId, 'encyclopedia.id', 'Encyclopedia entry does not map to the current polymer catalog.');
  const routePolymerCounts = new Map();
  for (const route of routes ?? []) routePolymerCounts.set(route.polymerId, (routePolymerCounts.get(route.polymerId) ?? 0) + 1);
  for (const record of input.records) {
    const polymerId = record?.polymerId;
    if (!polymerId || !catalogById.has(polymerId)) continue;
    const fail = (code, field, message) => addDiagnostic(diagnostics, code, polymerId, field, message);
    const catalog = catalogById.get(polymerId);
    const encyclopediaEntry = encyclopediaById.get(polymerId);
    if (encyclopediaEntry && (!Number.isInteger(encyclopediaEntry.number) || record.encyclopediaNumber !== encyclopediaEntry.number)) fail('ENCYCLOPEDIA_MAPPING', 'encyclopediaNumber', 'Structural authority encyclopediaNumber must match the current narrative entry number.');
    const route = routeById.get(record.routeId);
    if (!route || route.polymerId !== polymerId || routePolymerCounts.get(polymerId) !== 1) fail('ROUTE_MAPPING', 'routeId', 'routeId must resolve one-to-one to this catalog polymer.');
    if (!representationTypes.has(record.representationType)) fail('REPRESENTATION_TYPE', 'representationType', 'Unsupported structural representation type.');
    const expectedType = catalog.topology === 'network' ? 'network-junction' : catalog.topology === 'copolymer' ? 'copolymer-local-motif' : 'linear-repeat';
    if (record.representationType !== expectedType) fail('TOPOLOGY_MISMATCH', 'representationType/topology', `Catalog topology ${catalog.topology} requires ${expectedType}.`);
    if (record.topology !== catalog.topology) fail('TOPOLOGY_MISMATCH', 'topology', 'Record topology differs from the catalog.');
    if (record.source?.routeId !== record.routeId) fail('SOURCE_ROUTE_MISMATCH', 'source.routeId', 'Source route provenance must match routeId.');
    if (record.source?.sourceCommit !== input.sourceCommit) fail('SOURCE_COMMIT_MISMATCH', 'source.sourceCommit', 'Record provenance must identify the authority source commit.');
    if (record.source?.kind === 'independent-encyclopedia-motif') {
      if (record.source.routeSampleRelation !== 'independent-motif-not-gameplay-polymer-sample') fail('ROUTE_SAMPLE_RELATION', 'source.routeSampleRelation', 'Independent motif must be explicitly separate from the gameplay sample.');
      if (!(record.source.citations ?? []).length || (record.source.citations ?? []).some(citation => !citation.id || !citation.title || !citation.url || !Array.isArray(citation.supports) || !citation.supports.length)) fail('INDEPENDENT_SOURCE_MISSING', 'source.citations', 'Every independent structural motif requires complete, claim-specific source provenance.');
    } else {
      const expectedRelation = record.representationType === 'copolymer-local-motif'
        ? 'route-transformation-equivalent-local-sequence'
        : 'repeat-template-not-identical-to-finite-sample';
      if (record.source?.kind !== (record.representationType === 'copolymer-local-motif' ? 'route-derived-local-sequence' : 'route-derived-repeat')) fail('SOURCE_KIND', 'source.kind', 'Source kind must match route-derived representation type.');
      if (record.source?.routeSampleRelation !== expectedRelation) fail('ROUTE_SAMPLE_RELATION', 'source.routeSampleRelation', 'Route-derived representation must describe its relationship to the finite PolymerSample accurately.');
      const evidence = record.source?.routeEvidence;
      if (!route || evidence?.unitCount !== route.completionEvidence?.unitCount || evidence?.interUnitLinks !== route.completionEvidence?.interUnitLinks || JSON.stringify(evidence?.transformFamilies) !== JSON.stringify(route.transformFamilies)) fail('ROUTE_EVIDENCE_MISMATCH', 'source.routeEvidence', 'Route-derived source evidence must match current completion counts and authorized transformation families.');
    }
    if (!Array.isArray(record.atoms) || !Array.isArray(record.bonds) || !record.atoms.length) {
      fail('GRAPH_MISSING', 'atoms/bonds', 'A non-empty atom graph and bond array are required.');
      continue;
    }
    const components = new Map((record.source?.components ?? []).map(component => [component.id, component]));
    if (!components.size) fail('SOURCE_COMPONENTS_MISSING', 'source.components', 'At least one mapped source component is required.');
    if (components.size !== (record.source?.components ?? []).length) fail('SOURCE_COMPONENT_DUPLICATE', 'source.components', 'Source component ids must be unique.');
    if (record.source?.routeId !== record.routeId) fail('SOURCE_ROUTE_MISMATCH', 'source.routeId', 'Source route provenance must match routeId.');
    const atomById = new Map();
    const originOwners = new Map();
    const accounting = new Map();
    const sourceAtomToGraph = new Map();
    for (const component of components.values()) {
      const molecule = moleculeById.get(component.moleculeId);
      if (!molecule) { fail('UNKNOWN_SOURCE_MOLECULE', `source.components.${component.id}`, `Unknown source molecule ${component.moleculeId}.`); continue; }
      if (component.sourceAtomCount !== molecule.atoms.length) fail('SOURCE_ATOM_COUNT', `source.components.${component.id}.sourceAtomCount`, 'Source atom count differs from data/molecules.json.');
      if (record.source.kind !== 'independent-encyclopedia-motif' && Number.isInteger(component.sequenceIndex)) {
        if (!route || route.representativeSequence[component.sequenceIndex] !== component.moleculeId) fail('SOURCE_SEQUENCE_MAPPING', `source.components.${component.id}.sequenceIndex`, 'Source molecule does not match the corresponding route representativeSequence position.');
      }
      accounting.set(component.id, new Set());
    }
    for (const atom of record.atoms) {
      if (!atom || typeof atom.id !== 'string' || atomById.has(atom.id)) { fail('ATOM_ID', 'atoms.id', 'Atom ids must be unique non-empty strings.'); continue; }
      atomById.set(atom.id, atom);
      if (!Object.hasOwn(valenceByElement, atom.element)) fail('ATOM_ELEMENT', `atoms.${atom.id}.element`, `Unsupported element ${atom.element}.`);
      const component = components.get(atom.source?.componentRef);
      const molecule = component && moleculeById.get(component.moleculeId);
      const index = atom.source?.atomIndex;
      if (!component || !molecule || !Number.isInteger(index) || !molecule.atoms[index]) {
        fail('SOURCE_ATOM_MISSING', `atoms.${atom.id}.source`, 'Atom source mapping does not resolve to a source molecule atom.');
        continue;
      }
      if (typeof atom.role !== 'string' || !atom.role) fail('ATOM_ROLE', `atoms.${atom.id}.role`, 'Every atom needs a stable structural role.');
      if (atom.source.moleculeId !== component.moleculeId) fail('SOURCE_ATOM_MOLECULE', `atoms.${atom.id}.source.moleculeId`, 'Atom molecule id differs from its source component.');
      if (atom.element !== sourceElement(molecule, index)) fail('SOURCE_ATOM_ELEMENT', `atoms.${atom.id}.element`, 'Atom element differs from its source atom.');
      if (atom.formalCharge !== sourceCharge(molecule, index)) fail('SOURCE_ATOM_CHARGE', `atoms.${atom.id}.formalCharge`, 'Formal charge differs from its source atom.');
      const key = sourceKey(component.id, index);
      if (originOwners.has(key)) fail('DUPLICATE_SOURCE_ATOM', `atoms.${atom.id}.source`, `Source atom ${key} is mapped more than once.`);
      originOwners.set(key, atom.id);
      accounting.get(component.id)?.add(index);
      sourceAtomToGraph.set(key, atom.id);
    }
    const excludedByKey = new Map();
    for (const excluded of record.source?.excludedSourceAtoms ?? []) {
      const component = components.get(excluded.componentRef);
      const molecule = component && moleculeById.get(component.moleculeId);
      if (!molecule || !Number.isInteger(excluded.atomIndex) || !molecule.atoms[excluded.atomIndex] || typeof excluded.reason !== 'string' || !excluded.reason) {
        fail('EXCLUDED_SOURCE_ATOM', 'source.excludedSourceAtoms', 'Excluded atom needs a resolvable source atom and an explicit reason.');
        continue;
      }
      const key = sourceKey(component.id, excluded.atomIndex);
      if (originOwners.has(key) || excludedByKey.has(key)) fail('SOURCE_ATOM_ACCOUNTING_DUPLICATE', `source.excludedSourceAtoms.${key}`, 'Source atom is accounted more than once.');
      excludedByKey.set(key, excluded);
      accounting.get(component.id)?.add(excluded.atomIndex);
    }
    for (const [componentId, seen] of accounting) {
      const molecule = moleculeById.get(components.get(componentId)?.moleculeId);
      if (molecule && seen.size !== molecule.atoms.length) fail('SOURCE_ATOM_ACCOUNTING_INCOMPLETE', `source.components.${componentId}`, `Mapped ${seen.size} of ${molecule.atoms.length} source atoms.`);
    }
    const edgeByKey = new Map();
    const valence = new Map(record.atoms.map(atom => [atom.id, 0]));
    for (const bond of record.bonds) {
      if (!atomById.has(bond.a) || !atomById.has(bond.b) || bond.a === bond.b) { fail('BOND_ENDPOINT', `bonds.${bond.a}-${bond.b}`, 'Bond endpoint is missing or self-referential.'); continue; }
      if (![1, 2, 3].includes(bond.order)) fail('BOND_ORDER', `bonds.${bond.a}-${bond.b}.order`, `Invalid bond order ${bond.order}.`);
      const key = keyFor(bond.a, bond.b);
      if (edgeByKey.has(key)) fail('DUPLICATE_BOND', `bonds.${key}`, 'Duplicate undirected bond.');
      edgeByKey.set(key, bond);
      valence.set(bond.a, (valence.get(bond.a) ?? 0) + (bond.order ?? 0));
      valence.set(bond.b, (valence.get(bond.b) ?? 0) + (bond.order ?? 0));
    }
    const operations = record.transformations ?? [];
    const operationById = new Map(operations.map(operation => [operation.id, operation]));
    if (operationById.size !== operations.length) fail('TRANSFORMATION_OPERATION', 'transformations.id', 'Transformation operation ids must be unique.');
    const editBySourceBond = new Map(operations.filter(operation => ['change', 'remove'].includes(operation.type)).map(operation => [`${operation.componentRef}:${operation.bondIndex}`, operation]));
    for (const component of components.values()) {
      const molecule = moleculeById.get(component.moleculeId);
      if (!molecule) continue;
      for (const sourceBond of sourceBonds(molecule)) {
        const a = sourceAtomToGraph.get(sourceKey(component.id, sourceBond.a));
        const b = sourceAtomToGraph.get(sourceKey(component.id, sourceBond.b));
        if (!a || !b) continue;
        const graphBond = edgeByKey.get(keyFor(a, b));
        const operation = editBySourceBond.get(`${component.id}:${sourceBond.bondIndex}`);
        if (operation?.type === 'remove') {
          if (graphBond) fail('SOURCE_BOND_NOT_REMOVED', `transformations.${operation.id}`, 'Declared source-bond removal is still present in the fragment.');
          if (operation.from !== undefined && operation.from !== sourceBond.order) fail('SOURCE_BOND_EDIT', `transformations.${operation.id}.from`, 'Removal source bond order does not match the molecule graph.');
        } else {
          const expectedOrder = operation?.type === 'change' ? operation.to : sourceBond.order;
          if (!graphBond || graphBond.order !== expectedOrder) fail('SOURCE_BOND_MISMATCH', `source.components.${component.id}.bonds[${sourceBond.bondIndex}]`, `Expected mapped bond order ${expectedOrder}.`);
          if (operation?.type === 'change' && operation.from !== sourceBond.order) fail('SOURCE_BOND_EDIT', `transformations.${operation.id}.from`, 'Changed source-bond order does not match the molecule graph.');
        }
      }
    }
    for (const bond of record.bonds) {
      const provenance = bond.provenance ?? {};
      if (provenance.kind === 'source-molecule') {
        const component = components.get(provenance.componentRef);
        const molecule = component && moleculeById.get(component.moleculeId);
        const sourceBond = sourceBonds(molecule).find(item => item.bondIndex === provenance.bondIndex);
        const mappedA = sourceBond && sourceAtomToGraph.get(sourceKey(component.id, sourceBond.a));
        const mappedB = sourceBond && sourceAtomToGraph.get(sourceKey(component.id, sourceBond.b));
        if (!sourceBond || keyFor(mappedA, mappedB) !== keyFor(bond.a, bond.b) || sourceBond.order !== bond.order) fail('BOND_PROVENANCE', `bonds.${bond.a}-${bond.b}.provenance`, 'Source-molecule bond provenance does not match endpoints/order.');
      } else if (provenance.kind === 'route-transformation') {
        const operation = operationById.get(provenance.operationId);
        if (!operation || operation.type !== 'form' && operation.type !== 'change') fail('BOND_TRANSFORM_PROVENANCE', `bonds.${bond.a}-${bond.b}.provenance`, 'Route-derived bond has no matching transformation operation.');
        else {
          if (provenance.routeId !== record.routeId) fail('BOND_TRANSFORM_PROVENANCE', `bonds.${bond.a}-${bond.b}.provenance.routeId`, 'Bond transformation provenance must match the record route.');
          if (operation.family !== provenance.transformFamily || record.source.kind !== 'independent-encyclopedia-motif' && (!operation.family || !(route?.transformFamilies ?? []).includes(operation.family))) fail('BOND_TRANSFORM_FAMILY', `transformations.${operation.id}.family`, 'Transformation family is missing, mismatched or not authorized by the route.');
          if (operation.type === 'form' && (keyFor(operation.a, operation.b) !== keyFor(bond.a, bond.b) || operation.order !== bond.order)) fail('BOND_TRANSFORM_PROVENANCE', `bonds.${bond.a}-${bond.b}.provenance`, 'Form-bond operation endpoints/order do not match this graph edge.');
          if (operation.type === 'change') {
            const component = components.get(operation.componentRef);
            const molecule = component && moleculeById.get(component.moleculeId);
            const sourceBond = sourceBonds(molecule).find(item => item.bondIndex === operation.bondIndex);
            const mapped = sourceBond && [sourceAtomToGraph.get(sourceKey(component.id, sourceBond.a)), sourceAtomToGraph.get(sourceKey(component.id, sourceBond.b))];
            if (!sourceBond || !mapped?.[0] || keyFor(mapped[0], mapped[1]) !== keyFor(bond.a, bond.b) || operation.to !== bond.order || provenance.sourceBondRef?.componentRef !== operation.componentRef || provenance.sourceBondRef?.bondIndex !== operation.bondIndex) fail('BOND_TRANSFORM_PROVENANCE', `bonds.${bond.a}-${bond.b}.provenance`, 'Changed-bond provenance does not match its mapped source bond, operation or output order.');
          }
        }
      } else if (provenance.kind === 'independent-structural-source') {
        const cited = new Set((record.source?.citations ?? []).map(citation => citation.id));
        if (!Array.isArray(provenance.sourceIds) || !provenance.sourceIds.length || provenance.sourceIds.some(sourceId => !cited.has(sourceId))) fail('INDEPENDENT_BOND_PROVENANCE', `bonds.${bond.a}-${bond.b}.provenance`, 'Independent bond must cite every structural source used.');
        const operation = operationById.get(provenance.operationId);
        const component = operation && components.get(operation.componentRef);
        const molecule = component && moleculeById.get(component.moleculeId);
        const sourceBond = operation?.type === 'change' && sourceBonds(molecule).find(item => item.bondIndex === operation.bondIndex);
        const mappedChange = sourceBond && [sourceAtomToGraph.get(sourceKey(component.id, sourceBond.a)), sourceAtomToGraph.get(sourceKey(component.id, sourceBond.b))];
        const operationMatches = operation?.type === 'form'
          ? keyFor(operation.a, operation.b) === keyFor(bond.a, bond.b) && operation.order === bond.order
          : operation?.type === 'change' && sourceBond && mappedChange?.[0] && keyFor(mappedChange[0], mappedChange[1]) === keyFor(bond.a, bond.b) && operation.to === bond.order;
        if (!operationMatches || (operation.sourceIds ?? []).some(sourceId => !cited.has(sourceId))) fail('INDEPENDENT_BOND_PROVENANCE', `bonds.${bond.a}-${bond.b}.provenance.operationId`, 'Independent bond has no matching, cited authored transformation record.');
      } else fail('BOND_PROVENANCE', `bonds.${bond.a}-${bond.b}.provenance`, 'Every bond must have source-molecule, route-transform or independent-source provenance.');
    }
    for (const operation of operations) {
      if (!operation.id || !['change', 'remove', 'form'].includes(operation.type)) fail('TRANSFORMATION_OPERATION', 'transformations', 'Unknown or unlabelled transformation operation.');
      if (operation.type === 'form') {
        if (!atomById.has(operation.a) || !atomById.has(operation.b) || !edgeByKey.has(keyFor(operation.a, operation.b)) || ![1, 2, 3].includes(operation.order) || edgeByKey.get(keyFor(operation.a, operation.b))?.order !== operation.order) fail('TRANSFORMATION_BOND_MISSING', `transformations.${operation.id}`, 'Form-bond operation does not resolve to a graph edge with the declared bond order.');
        if (record.source.kind !== 'independent-encyclopedia-motif' && (!operation.family || !(route?.transformFamilies ?? []).includes(operation.family))) fail('TRANSFORMATION_FAMILY', `transformations.${operation.id}.family`, 'Route does not authorize this transformation family.');
        if (record.source.kind === 'independent-encyclopedia-motif' && !(record.source.citations ?? []).some(citation => (operation.sourceIds ?? []).includes(citation.id))) fail('INDEPENDENT_SOURCE_MISSING', `transformations.${operation.id}.sourceIds`, 'Independent authored bond operation must cite its structural authority.');
        const atomA = atomById.get(operation.a), atomB = atomById.get(operation.b);
        const componentA = components.get(atomA?.source?.componentRef), componentB = components.get(atomB?.source?.componentRef);
        const moleculeA = componentA && moleculeById.get(componentA.moleculeId);
        const sourceAlreadyConnected = componentA?.id === componentB?.id
          ? sourceBonds(moleculeA).some(bond => keyFor(String(bond.a), String(bond.b)) === keyFor(String(atomA?.source?.atomIndex), String(atomB?.source?.atomIndex)))
          : false;
        if (sourceAlreadyConnected) fail('TRANSFORMATION_BOND_ALREADY_PRESENT', `transformations.${operation.id}`, 'A formed bond must connect source atoms that were not already bonded in the source molecule.');
      }
      if (operation.type === 'change' || operation.type === 'remove') {
        const component = components.get(operation.componentRef);
        const molecule = component && moleculeById.get(component.moleculeId);
        const sourceBond = sourceBonds(molecule).find(item => item.bondIndex === operation.bondIndex);
        if (!sourceBond || operation.from !== undefined && operation.from !== sourceBond.order || (operation.type === 'change' && ![1, 2, 3].includes(operation.to)) || !(route?.transformFamilies ?? []).includes(operation.family)) fail('TRANSFORMATION_OPERATION', `transformations.${operation.id}`, 'Source-bond operation must resolve to a source bond and an authorized transformation family.');
      }
    }
    const portsById = new Map();
    for (const port of record.continuationPorts ?? []) {
      if (!port.id || portsById.has(port.id)) fail('CONTINUATION_ID', 'continuationPorts.id', 'Continuation port ids must be unique.');
      else portsById.set(port.id, port);
      if (!atomById.has(port.atomRef) || !Number.isInteger(port.requiredExternalValence) || port.requiredExternalValence < 1 || port.requiredExternalValence !== port.externalBondOrder) fail('CONTINUATION_PORT', `continuationPorts.${port.id}`, 'Continuation port atom, external bond order or required valence is invalid.');
      else valence.set(port.atomRef, (valence.get(port.atomRef) ?? 0) + port.externalBondOrder);
      if (!Object.hasOwn(valenceByElement, port.partnerElement) || typeof port.connectionType !== 'string' || !port.connectionType || !port.direction || !port.role) fail('CONTINUATION_PORT', `continuationPorts.${port.id}`, 'Continuation port requires a partner element, connection type, direction and role.');
    }
    for (const atom of record.atoms) {
      const expected = valenceByElement[atom.element];
      if (atom.formalCharge !== 0) fail('FORMAL_CHARGE_UNSUPPORTED', `atoms.${atom.id}.formalCharge`, 'Current authority contains only neutral source atoms; non-zero charge requires explicit reviewed valence rules.');
      if (expected !== undefined && valence.get(atom.id) !== expected) fail('VALENCE', `atoms.${atom.id}`, `Bond valence ${valence.get(atom.id)} does not equal neutral ${atom.element} valence ${expected}, counting continuation ports.`);
    }
    const backbone = new Set(record.backboneAtomRefs ?? []);
    for (const atom of record.atoms) {
      if (atom.role === 'backbone' && !backbone.has(atom.id)) fail('BACKBONE_ROLE', 'backboneAtomRefs', `Backbone atom ${atom.id} is missing from backboneAtomRefs.`);
      if (atom.role === 'side-chain' && !(record.sideChains ?? []).some(group => group.atomRefs?.includes(atom.id)) && !(record.functionalGroups ?? []).some(group => group.atomRefs?.includes(atom.id))) fail('SIDECHAIN_ROLE', 'sideChains/functionalGroups', `Side-chain or functional-group atom ${atom.id} is not assigned to a labelled structural group.`);
    }
    for (const ref of record.backboneAtomRefs ?? []) if (atomById.get(ref)?.role !== 'backbone') fail('BACKBONE_ROLE', `backboneAtomRefs.${ref}`, 'Backbone reference must point to an atom classified as backbone.');
    if (connectedCount(record.atoms.map(atom => atom.id), record.bonds) !== record.atoms.length) fail('GRAPH_DISCONNECTED', 'bonds', 'Structural fragment must be one connected graph.');
    for (const field of ['backboneAtomRefs', 'junctionAtomRefs']) for (const ref of record[field] ?? []) if (!atomById.has(ref)) fail('GROUP_REFERENCE', field, `Unknown atom reference ${ref}.`);
    for (const field of ['repeatGroups', 'componentGroups', 'functionalGroups', 'sideChains']) {
      for (const group of record[field] ?? []) {
        if (!group.id || !group.label && ['componentGroups', 'functionalGroups', 'sideChains'].includes(field)) fail('GROUP_LABEL', `${field}.${group.id ?? 'unknown'}`, 'Groups require a stable id and a renderer-readable label.');
        for (const ref of group.atomRefs ?? []) if (!atomById.has(ref)) fail('GROUP_REFERENCE', `${field}.${group.id}`, `Unknown atom reference ${ref}.`);
      }
    }
    const groupCoverage = field => (record[field] ?? []).flatMap(group => group.atomRefs ?? []);
    const componentGroupMembers = groupCoverage('componentGroups');
    if (componentGroupMembers.length !== atomById.size || new Set(componentGroupMembers).size !== atomById.size || componentGroupMembers.some(ref => !atomById.has(ref))) fail('COMPONENT_GROUP_COVERAGE', 'componentGroups', 'Component groups must cover every graph atom exactly once.');
    if ((record.componentGroups ?? []).length !== components.size || new Set((record.componentGroups ?? []).map(group => group.sourceComponentRef)).size !== components.size) fail('COMPONENT_GROUP_MAPPING', 'componentGroups', 'Every source component must map to exactly one component group.');
    for (const group of record.componentGroups ?? []) {
      const component = components.get(group.sourceComponentRef);
      const refs = group.atomRefs ?? [];
      if (!component || !refs.length || refs.some(ref => atomById.get(ref)?.source?.componentRef !== group.sourceComponentRef)) fail('COMPONENT_GROUP_MAPPING', `componentGroups.${group.id}.sourceComponentRef`, 'Each component group must map exactly to one source component.');
      const sourceRefs = record.atoms.filter(atom => atom.source?.componentRef === group.sourceComponentRef).map(atom => atom.id);
      if (JSON.stringify([...new Set(refs)].sort()) !== JSON.stringify(sourceRefs.sort())) fail('COMPONENT_GROUP_MAPPING', `componentGroups.${group.id}.atomRefs`, 'Component group membership must match every mapped atom in its source component.');
    }
    if (record.representationType === 'linear-repeat') {
      const members = groupCoverage('repeatGroups');
      if (members.length !== atomById.size || new Set(members).size !== atomById.size || members.some(ref => !atomById.has(ref))) fail('REPEAT_GROUP_COVERAGE', 'repeatGroups', 'Repeat grouping must cover every graph atom exactly once.');
      if (connectedCount(record.backboneAtomRefs ?? [], record.bonds) !== (record.backboneAtomRefs ?? []).length) fail('BACKBONE_DISCONNECTED', 'backboneAtomRefs', 'Linear repeat backbone must be connected.');
      if ((record.continuationPorts ?? []).length !== 2) fail('CONTINUATION_COUNT', 'continuationPorts', 'Linear repeat requires exactly two continuation ports.');
      if ((record.continuationPorts ?? []).some(port => !backbone.has(port.atomRef)) || new Set((record.continuationPorts ?? []).map(port => port.direction)).size !== 2 || !['left', 'right'].every(direction => (record.continuationPorts ?? []).some(port => port.direction === direction))) fail('CONTINUATION_PORT', 'continuationPorts', 'Linear continuation ports must identify distinct backbone boundaries labelled left and right.');
      const closure = record.repeatClosure;
      const left = portsById.get(closure?.leftPortId), right = portsById.get(closure?.rightPortId);
      const endpointConnection = left && right ? [atomById.get(left.atomRef)?.element, atomById.get(right.atomRef)?.element].sort().join('-') : null;
      if (!closure || !left || !right || left === right || left.atomRef === right.atomRef || closure.bondOrder !== 1 || left.externalBondOrder !== closure.bondOrder || right.externalBondOrder !== closure.bondOrder || left.partnerElement !== atomById.get(right.atomRef)?.element || right.partnerElement !== atomById.get(left.atomRef)?.element || !left.connectionType || left.connectionType !== right.connectionType || closure.connectionType !== endpointConnection || !closure.transformFamily || !(route?.transformFamilies ?? []).includes(closure.transformFamily)) fail('REPEAT_BOUNDARY', 'repeatClosure', 'Repeat boundary ports must define distinct, compatible single-bond endpoints and an authorized route transformation family.');
      if (record.source.routeSampleRelation !== 'repeat-template-not-identical-to-finite-sample') fail('ROUTE_SAMPLE_RELATION', 'source.routeSampleRelation', 'A repeat template must not be mislabeled as the finite route sample.');
    }
    if (record.representationType === 'copolymer-local-motif') {
      const members = groupCoverage('componentGroups');
      if (members.length !== atomById.size || new Set(members).size !== atomById.size || members.some(ref => !atomById.has(ref))) fail('COMPONENT_GROUP_COVERAGE', 'componentGroups', 'Copolymer component groups must cover every atom exactly once.');
      if (connectedCount(record.backboneAtomRefs ?? [], record.bonds) !== (record.backboneAtomRefs ?? []).length) fail('BACKBONE_DISCONNECTED', 'backboneAtomRefs', 'Copolymer local backbone must be connected.');
      if ((record.continuationPorts ?? []).length !== 2) fail('CONTINUATION_COUNT', 'continuationPorts', 'Copolymer local motif requires two segment-boundary ports.');
      if ((record.continuationPorts ?? []).some(port => !backbone.has(port.atomRef)) || new Set((record.continuationPorts ?? []).map(port => port.direction)).size !== 2 || !['left', 'right'].every(direction => (record.continuationPorts ?? []).some(port => port.direction === direction))) fail('CONTINUATION_PORT', 'continuationPorts', 'Copolymer continuation ports must identify distinct backbone segment boundaries labelled left and right.');
      if (JSON.stringify(record.localSequence?.monomerIds) !== JSON.stringify(route?.representativeSequence)) fail('COPOLYMER_SEQUENCE', 'localSequence.monomerIds', 'Local component order must match the route representativeSequence exactly.');
      if (record.qualifiers?.bulkComposition !== 'not-asserted' || record.qualifiers?.localSequence !== 'local-example-only') fail('COPOLYMER_QUALIFIER', 'qualifiers', 'Copolymer must be marked local-example-only with no bulk-composition claim.');
      if (Object.keys(record.qualifiers ?? {}).some(key => /molarRatio|bulkRatio|fixedComposition|compositionRatio/i.test(key))) fail('COPOLYMER_RATIO', 'qualifiers', 'A fixed copolymer composition or molar ratio is unsupported.');
      if (record.source.kind !== 'independent-encyclopedia-motif' && record.source.routeSampleRelation !== 'route-transformation-equivalent-local-sequence') fail('ROUTE_SAMPLE_RELATION', 'source.routeSampleRelation', 'Route-derived copolymer motif must identify its route-local sequence relationship.');
    }
    for (const component of components.values()) {
      const molecule = moleculeById.get(component.moleculeId);
      if (molecule && route?.transformFamilies.includes('diene') && ['1-3-butadiene', 'isoprene'].includes(molecule.id) && !hasDieneTransform(record, component.id, molecule)) fail('DIENE_CONNECTIVITY', `source.components.${component.id}`, 'Diene unit must use 1,4 connectivity with C1–C2 and C3–C4 single bonds and residual C2=C3.');
    }
    const stereo = record.qualifiers?.stereochemistry?.status;
    if (!['unspecified', 'not-asserted', 'not-applicable'].includes(stereo)) fail('UNSUPPORTED_STEREOCHEMISTRY', 'qualifiers.stereochemistry', 'Unspecified source stereochemistry must not be promoted to a fixed stereoisomer.');
    if (stereo !== 'not-applicable' && record.qualifiers?.stereochemistry?.drawing !== 'no-stereo-wedges') fail('UNSUPPORTED_STEREOCHEMISTRY', 'qualifiers.stereochemistry.drawing', 'Unspecified stereochemistry must use a non-stereochemical drawing instruction.');
    if (['isotactic', 'syndiotactic', 'atactic', 'cis', 'trans', 'E', 'Z'].some(value => JSON.stringify(record.qualifiers ?? {}).includes(`"${value}"`))) fail('UNSUPPORTED_STEREOCHEMISTRY', 'qualifiers', 'Unsupported tacticity or cis/trans assignment is present.');
    const qualifierFields = ['tacticity', 'cisTrans', 'dieneMicrostructure', 'regiochemistry', 'localSequence', 'bulkComposition', 'molecularWeightDistribution', 'vulcanization'];
    for (const field of qualifierFields) if (typeof record.qualifiers?.[field] !== 'string' || !record.qualifiers[field]) fail('QUALIFIER_MISSING', `qualifiers.${field}`, 'Required stereochemistry, composition or material-state qualifier is missing.');
    if (record.qualifiers?.crosslinking !== (record.representationType === 'network-junction' ? 'local-network-motif-only' : 'not-implied')) fail('CROSSLINKING_QUALIFIER', 'qualifiers.crosslinking', 'Route-derived linear/copolymer motifs must not imply crosslinking; the independent network motif is local-only.');
    const dienePresent = operations.some(operation => operation.family === 'diene');
    if (dienePresent && (record.qualifiers?.cisTrans !== 'unspecified' || record.qualifiers?.dieneMicrostructure !== 'varies' || !record.qualifiers?.regiochemistry?.includes('1,4-motif-only'))) fail('DIENE_QUALIFIER', 'qualifiers.cisTrans/dieneMicrostructure/regiochemistry', 'A local 1,4 diene motif must preserve unspecified cis/trans and bulk regiosequence qualifiers.');
    if (['polypropylene', 'polyisobutylene', 'polystyrene', 'polyvinyl-chloride', 'polyacrylonitrile', 'polyacrylic-acid', 'polyvinylidene-fluoride'].includes(polymerId) && record.qualifiers?.tacticity !== 'not-asserted') fail('UNSUPPORTED_STEREOCHEMISTRY', 'qualifiers.tacticity', 'Tacticity must remain unasserted where the route/catalog does not specify it.');
    if (['polyvinylidene-fluoride', 'vinylidene-fluoride-hexafluoropropylene-copolymer'].includes(polymerId) && record.qualifiers?.regiochemistry !== 'varies') fail('UNSUPPORTED_REGIOCHEMISTRY', 'qualifiers.regiochemistry', 'PVDF-containing motifs must not assert one bulk regiochemistry.');
    const requiredReview = ['source-monomer', 'route-transform', 'backbone', 'functional-groups', 'repeat-or-local-ports', 'stereochemistry-regiochemistry', 'chemical-plausibility'];
    const reviewChecks = record.review?.checks ?? [];
    const reviewById = new Map(reviewChecks.map(check => [check?.id, check]));
    if (record.review?.status !== 'reviewed' || reviewChecks.length !== requiredReview.length || reviewById.size !== reviewChecks.length || requiredReview.some(id => {
      const check = reviewById.get(id);
      return check?.status !== 'pass' || typeof check?.result !== 'string' || !check.result.trim() || !Array.isArray(check?.evidence) || !check.evidence.length || check.evidence.some(ref => typeof ref !== 'string' || !ref.trim());
    })) fail('SCIENTIFIC_REVIEW', 'review.checks', 'All seven polymer-specific structural review checks require an individual PASS result and evidence references.');
    validateByproductAccounting(record, { excludedByKey, fail });
    for (const group of Array.isArray(record.sourceAccounting?.byproductGroups) ? record.sourceAccounting.byproductGroups : []) {
      const refs = group.sourceAtomRefs ?? [];
      if (group.species !== 'water' || refs.length !== 3 || refs.filter(ref => sourceElement(moleculeById.get(components.get(ref.componentRef)?.moleculeId), ref.atomIndex) === 'O').length !== 1 || refs.filter(ref => sourceElement(moleculeById.get(components.get(ref.componentRef)?.moleculeId), ref.atomIndex) === 'H').length !== 2) fail('HYDROGEN_ACCOUNTING', `sourceAccounting.byproductGroups.${group.id}`, 'Water byproduct mapping must identify one O and two source H atoms.');
      for (const ref of refs) if (!excludedByKey.has(sourceKey(ref.componentRef, ref.atomIndex))) fail('HYDROGEN_ACCOUNTING', `sourceAccounting.byproductGroups.${group.id}`, 'Byproduct atom is not declared excluded from the fragment.');
    }
    validateCondensationHydrogenAccounting(record, { components, moleculeById, excludedByKey, fail });
    if (record.representationType === 'network-junction') validatePhenolicNetwork(record, { fail, atomById, edgeByKey, portsById, components, moleculeById, excludedByKey });
    if (record.polymerId === 'styrene-butadiene-copolymer') validateSbrRouteMotif(record, { fail, atomById, edgeByKey, components, route });
    if (record.polymerId === 'vinylidene-fluoride-hexafluoropropylene-copolymer') validateVdfHfpRouteMotif(record, { fail, edgeByKey, components, route });
  }
  return { ok: diagnostics.length === 0, diagnostics, count: input.records.length, polymerIds: [...recordById.keys()] };
}

function validatePhenolicNetwork(record, { fail, atomById, edgeByKey, portsById, components, moleculeById, excludedByKey }) {
  if (record.polymerId !== 'phenol-formaldehyde-resin') fail('NETWORK_EXCEPTION_SCOPE', 'polymerId', 'The only current independent network motif is phenol-formaldehyde resin.');
  if (record.source.kind !== 'independent-encyclopedia-motif' || record.source.routeSampleRelation !== 'independent-motif-not-gameplay-polymer-sample') fail('NETWORK_SAMPLE_EQUIVALENCE', 'source.kind/routeSampleRelation', 'Encyclopedia motif must remain independent from the route PolymerSample.');
  if (record.networkAuthority?.routeSampleEquivalent !== false) fail('NETWORK_SAMPLE_EQUIVALENCE', 'networkAuthority.routeSampleEquivalent', 'Independent motif must not claim equivalence to the finite route sample.');
  const citations = new Map((record.source.citations ?? []).map(citation => [citation.id, citation]));
  for (const sourceId of record.networkAuthority?.sourceIds ?? []) if (!citations.has(sourceId) || !citations.get(sourceId)?.url || !citations.get(sourceId)?.supports?.length) fail('INDEPENDENT_SOURCE_MISSING', 'source.citations', `Missing complete independent source ${sourceId}.`);
  if ((record.continuationPorts ?? []).length < 3 || (record.branches ?? []).length < 3 || record.networkAuthority?.branchCount < 3) fail('NETWORK_BRANCH_COUNT', 'branches', 'Network motif requires at least three mapped branch paths and continuation ports.');
  const map = record.networkAuthority?.reactiveSiteMap;
  if (!map || map.corePhenol?.hydroxylCarbonSourceAtomIndex !== 0 || map.corePhenol?.hydroxylOxygenSourceAtomIndex !== 6 || JSON.stringify(map.corePhenol?.orthoCarbonSourceAtomIndices) !== JSON.stringify([1, 5]) || map.corePhenol?.paraCarbonSourceAtomIndex !== 3 || JSON.stringify(map.corePhenol?.selectedBridgeSiteSourceAtomIndices) !== JSON.stringify([1, 3, 5]) || map.armPhenol?.hydroxylCarbonSourceAtomIndex !== 0 || map.armPhenol?.hydroxylOxygenSourceAtomIndex !== 6 || map.armPhenol?.selectedBridgeSiteSourceAtomIndex !== 3 || map.armPhenol?.continuationPortSourceAtomIndex !== 1 || map.formaldehyde?.bridgeCarbonSourceAtomIndex !== 0 || map.formaldehyde?.oxygenSourceAtomIndex !== 1 || JSON.stringify(map.formaldehyde?.retainedCarbonHydrogensSourceAtomIndices) !== JSON.stringify([2, 3])) fail('PHENOLIC_SITE_MAPPING', 'networkAuthority.reactiveSiteMap', 'Phenolic ortho/para, arm continuation and formaldehyde source atom mapping is incomplete or incorrect.');
  const phenol = moleculeById.get('phenol');
  const ringPairs = [[0, 1, 2], [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 5, 2], [5, 0, 1]];
  for (const componentId of ['phenol-core', 'phenol-arm-1', 'phenol-arm-2', 'phenol-arm-3']) {
    const component = components.get(componentId);
    if (!component || component.moleculeId !== 'phenol') { fail('PHENOLIC_SOURCE_MAPPING', `source.components.${componentId}`, 'Phenolic ring component must map to source molecule phenol.'); continue; }
    for (const [a, b, order] of ringPairs) {
      const sourceBond = sourceBonds(phenol).find(item => keyFor(String(item.a), String(item.b)) === keyFor(String(a), String(b)));
      const aRef = record.atoms.find(atom => atom.source.componentRef === componentId && atom.source.atomIndex === a)?.id;
      const bRef = record.atoms.find(atom => atom.source.componentRef === componentId && atom.source.atomIndex === b)?.id;
      const graphBond = aRef && bRef ? edgeByKey.get(keyFor(aRef, bRef)) : null;
      if (!sourceBond || sourceBond.order !== order || graphBond?.order !== order) fail('PHENOLIC_AROMATIC_SUBSTITUTION', `source.components.${componentId}.ring`, 'Aromatic ring connectivity/bond order differs from mapped phenol source.');
    }
    const ohRef = record.atoms.find(atom => atom.source.componentRef === componentId && atom.source.atomIndex === 6)?.id;
    const ohHydrogenRef = record.atoms.find(atom => atom.source.componentRef === componentId && atom.source.atomIndex === 12)?.id;
    const ipsoRef = record.atoms.find(atom => atom.source.componentRef === componentId && atom.source.atomIndex === 0)?.id;
    if (!ohRef || !ipsoRef || !ohHydrogenRef || edgeByKey.get(keyFor(ohRef, ipsoRef))?.order !== 1 || edgeByKey.get(keyFor(ohRef, ohHydrogenRef))?.order !== 1) fail('PHENOLIC_AROMATIC_SUBSTITUTION', `source.components.${componentId}.phenolicOH`, 'Phenolic hydroxyl must retain source C0–O6–H12 connectivity.');
  }
  const expectedCoreSites = [1, 3, 5];
  const expectedHydrogen = new Set();
  const portRefs = new Set((record.continuationPorts ?? []).map(port => port.atomRef));
  if (portRefs.size !== (record.continuationPorts ?? []).length) fail('FAKE_PHENOLIC_BRANCH_PORT', 'continuationPorts', 'Network continuation ports must identify distinct branch atoms.');
  for (let index = 0; index < 3; index += 1) {
    const branch = record.branches?.[index];
    const i = index + 1;
    const path = branch?.pathAtomRefs ?? [];
    const expected = [`phenol-core.a${expectedCoreSites[index]}`, `formaldehyde-${i}.a0`, `phenol-arm-${i}.a3`, `phenol-arm-${i}.a2`, `phenol-arm-${i}.a1`];
    if (JSON.stringify(path) !== JSON.stringify(expected)) fail('PHENOLIC_BRANCH_MAPPING', `branches.${branch?.id ?? i}.pathAtomRefs`, 'Branch path must traverse mapped core, methylene, para phenol atom, ring neighbor and ortho continuation site.');
    // The first two edges are methylene linkages; the final ring edges retain
    // the source phenol's alternating aromatic bond orders (1 or 2).
    for (let step = 0; step < 2; step += 1) if (edgeByKey.get(keyFor(path[step], path[step + 1]))?.order !== 1) fail('NETWORK_BRANCH_DISCONNECTED', `branches.${branch?.id ?? i}.pathAtomRefs`, `Methylene branch edge ${step} is missing or not single.`);
    for (let step = 2; step < path.length - 1; step += 1) if (![1, 2].includes(edgeByKey.get(keyFor(path[step], path[step + 1]))?.order)) fail('NETWORK_BRANCH_DISCONNECTED', `branches.${branch?.id ?? i}.pathAtomRefs`, `Phenolic ring edge ${step} is missing or has invalid bond order.`);
    const port = record.continuationPorts?.find(item => item.id === `branch-${i}-continuation`);
    if (!port || port.atomRef !== path.at(-1) || !portRefs.has(path.at(-1))) fail('FAKE_PHENOLIC_BRANCH_PORT', `continuationPorts.branch-${i}`, 'Branch continuation must be the mapped ortho atom on an independent phenol arm.');
    expectedHydrogen.add(sourceKey(`phenol-core`, [7, 9, 11][index]));
    expectedHydrogen.add(sourceKey(`phenol-arm-${i}`, 9));
    expectedHydrogen.add(sourceKey(`phenol-arm-${i}`, 7));
    const bridgeCarbon = path[1];
    if (atomById.get(bridgeCarbon)?.element !== 'C') fail('PHENOLIC_BRIDGE_ATOM', `branches.${branch?.id ?? i}.pathAtomRefs`, 'Methylene bridge must be carbon.');
    const bridgeH = record.atoms.filter(atom => atom.source.componentRef === `formaldehyde-${i}` && [2, 3].includes(atom.source.atomIndex));
    if (bridgeH.length !== 2 || bridgeH.some(atom => !edgeByKey.has(keyFor(atom.id, bridgeCarbon)))) fail('PHENOLIC_BRIDGE_HYDROGENS', `source.components.formaldehyde-${i}`, 'Methylene carbon must retain both formaldehyde-derived hydrogens.');
  }
  for (const key of expectedHydrogen) if (!excludedByKey.has(key)) fail('HYDROGEN_ACCOUNTING', 'source.excludedSourceAtoms', `Expected displaced source hydrogen ${key} is not accounted for.`);
  const waterGroups = record.sourceAccounting?.byproductGroups ?? [];
  if (waterGroups.length !== 3 || waterGroups.some((group, index) => group.id !== `water-${index + 1}`)) fail('HYDROGEN_ACCOUNTING', 'sourceAccounting.byproductGroups', 'Three explicit condensation-water source mappings are required.');
  for (let index = 0; index < 3; index += 1) {
    const i = index + 1;
    const expected = new Set([sourceKey(`formaldehyde-${i}`, 1), sourceKey('phenol-core', [7, 9, 11][index]), sourceKey(`phenol-arm-${i}`, 9)]);
    const actual = new Set((waterGroups.find(group => group.id === `water-${i}`)?.sourceAtomRefs ?? []).map(ref => sourceKey(ref.componentRef, ref.atomIndex)));
    if (actual.size !== expected.size || [...expected].some(key => !actual.has(key))) fail('HYDROGEN_ACCOUNTING', `sourceAccounting.byproductGroups.water-${i}`, 'Each mapped water must contain its formaldehyde oxygen and the two displaced phenolic hydrogens from its specific bridge sites.');
  }
  const boundary = record.sourceAccounting?.boundaryDisplacements ?? [];
  if (boundary.length !== 3 || boundary.some(item => !excludedByKey.has(sourceKey(item.sourceAtomRef?.componentRef, item.sourceAtomRef?.atomIndex)))) fail('HYDROGEN_ACCOUNTING', 'sourceAccounting.boundaryDisplacements', 'Three displaced ortho hydrogens must be recorded as network boundary ports, not water.');
  for (let index = 0; index < 3; index += 1) {
    const i = index + 1;
    const displacement = boundary.find(item => item.portId === `branch-${i}-continuation`);
    if (displacement?.sourceAtomRef?.componentRef !== `phenol-arm-${i}` || displacement?.sourceAtomRef?.atomIndex !== 7 || excludedByKey.get(sourceKey(`phenol-arm-${i}`, 7))?.reason !== 'network-boundary-displaced-hydrogen') fail('HYDROGEN_ACCOUNTING', `sourceAccounting.boundaryDisplacements.branch-${i}`, 'Each continuation port must account for the hydrogen displaced at its mapped ortho carbon, separately from condensation water.');
  }
  if ((record.backboneAtomRefs ?? []).length !== 0 || (record.junctionAtomRefs ?? []).length < 9) fail('NETWORK_TOPOLOGY', 'backboneAtomRefs/junctionAtomRefs', 'Network junction must identify a central ring and three bridge atoms, without linearizing the graph.');
}

function validateSbrRouteMotif(record, { fail, atomById, edgeByKey, components, route }) {
  if (record.source.kind !== 'route-derived-local-sequence' || record.source.routeSampleRelation !== 'route-transformation-equivalent-local-sequence') fail('ROUTE_SAMPLE_STRUCTURAL_MISMATCH', 'source.routeSampleRelation', 'SBR authority must identify the verified route-local B–S–B graph and may not claim an independent mismatch.');
  const expected = ['1-3-butadiene', 'styrene', '1-3-butadiene'];
  if (JSON.stringify(record.localSequence?.monomerIds) !== JSON.stringify(expected) || JSON.stringify(route?.representativeSequence) !== JSON.stringify(expected)) fail('SBR_LOCAL_SEQUENCE', 'localSequence.monomerIds', 'SBR motif must preserve the route-listed local monomer example while disavowing the incorrect route graph.');
  const expectedComponents = ['unit-0', 'unit-1', 'unit-2'];
  if (JSON.stringify([...components.keys()]) !== JSON.stringify(expectedComponents) || expected.some((moleculeId, index) => components.get(expectedComponents[index])?.moleculeId !== moleculeId)) fail('SBR_SOURCE_MAPPING', 'source.components', 'SBR motif must map butadiene, styrene and butadiene source components in that order.');
  const styrene = components.get('unit-1');
  if (styrene?.moleculeId !== 'styrene') return;
  const expectedRing = [[0, 1, 2], [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 5, 2], [5, 0, 1]];
  for (const [a, b, order] of expectedRing) {
    const aRef = record.atoms.find(atom => atom.source.componentRef === 'unit-1' && atom.source.atomIndex === a)?.id;
    const bRef = record.atoms.find(atom => atom.source.componentRef === 'unit-1' && atom.source.atomIndex === b)?.id;
    if (!aRef || !bRef || edgeByKey.get(keyFor(aRef, bRef))?.order !== order) fail('SBR_STYRENE_PHENYL_RING', `source.components.unit-1.ring.${a}-${b}`, 'Styrene phenyl ring must retain its mapped source connectivity and alternating bond orders.');
  }
  const styreneVinyl = record.atoms.find(atom => atom.source.componentRef === 'unit-1' && atom.source.atomIndex === 6)?.id;
  const styreneTerminal = record.atoms.find(atom => atom.source.componentRef === 'unit-1' && atom.source.atomIndex === 7)?.id;
  const vinylEdit = (record.transformations ?? []).find(operation => operation.type === 'change' && operation.componentRef === 'unit-1' && operation.bondIndex === 7);
  if (!styreneVinyl || !styreneTerminal || edgeByKey.get(keyFor(styreneVinyl, styreneTerminal))?.order !== 1 || vinylEdit?.from !== 2 || vinylEdit?.to !== 1 || vinylEdit?.family !== 'vinyl') fail('SBR_STYRENE_VINYL', 'source.components.unit-1.vinyl', 'Styrene addition must consume its vinyl C=C while retaining the phenyl ring.');
  const expectedBackbone = ['unit-0.a0', 'unit-0.a1', 'unit-0.a2', 'unit-0.a3', 'unit-1.a6', 'unit-1.a7', 'unit-2.a0', 'unit-2.a1', 'unit-2.a2', 'unit-2.a3'];
  if (JSON.stringify(record.backboneAtomRefs) !== JSON.stringify(expectedBackbone)) fail('SBR_BACKBONE', 'backboneAtomRefs', 'SBR backbone must contain both 1,4-butadiene segments and the styrene vinyl carbons; phenyl atoms remain pendant.');
  const expectedLinks = [['unit-0.a3', 'unit-1.a6'], ['unit-1.a7', 'unit-2.a0']];
  for (let index = 0; index < expectedLinks.length; index += 1) {
    const [a, b] = expectedLinks[index];
    const bond = record.bonds.find(item => keyFor(item.a, item.b) === keyFor(a, b));
    if (!bond || bond.order !== 1 || bond.provenance?.kind !== 'route-transformation' || bond.provenance.routeId !== record.routeId) fail('SBR_INTERUNIT_LINK', `bonds.${a}-${b}`, 'Route SBR local sequence requires single links through open-chain vinyl atoms, not through styrene ring atoms.');
  }
  for (const componentRef of ['unit-0', 'unit-2']) {
    const moleculeId = components.get(componentRef)?.moleculeId;
    const edits = (record.transformations ?? []).filter(operation => operation.componentRef === componentRef && operation.family === 'diene' && operation.type === 'change');
    const expectedEdits = [0, 1, 2].map((bondIndex, index) => [bondIndex, [2, 1, 2][index], [1, 2, 1][index]]);
    if (moleculeId !== '1-3-butadiene' || expectedEdits.some(([bondIndex, from, to]) => !edits.some(edit => edit.bondIndex === bondIndex && edit.from === from && edit.to === to))) fail('DIENE_CONNECTIVITY', `source.components.${componentRef}`, 'Each SBR butadiene component requires the 1,4 transformation with residual central C=C.');
    const residual = record.bonds.find(bond => keyFor(bond.a, bond.b) === keyFor(`${componentRef}.a1`, `${componentRef}.a2`));
    if (!residual || residual.order !== 2 || residual.provenance?.kind !== 'route-transformation' || residual.provenance.sourceBondRef?.componentRef !== componentRef || residual.provenance.sourceBondRef?.bondIndex !== 1) fail('DIENE_CONNECTIVITY', `source.components.${componentRef}.residualBond`, 'Each represented 1,4-butadiene component requires one mapped residual backbone C=C bond.');
  }
  const citations = new Set((record.source.citations ?? []).map(citation => citation.id));
  for (const id of ['rsc-sbr-13c-sequence-1974', 'iso-21561-1-2015', 'openstax-copolymers-31-3']) if (!citations.has(id)) fail('INDEPENDENT_SOURCE_MISSING', 'source.citations', `SBR structural source ${id} is required.`);
  if (record.qualifiers?.localSequence !== 'local-example-only' || record.qualifiers?.bulkComposition !== 'not-asserted' || record.qualifiers?.cisTrans !== 'unspecified' || record.qualifiers?.dieneMicrostructure !== 'varies' || record.qualifiers?.vulcanization !== 'not-represented') fail('COPOLYMER_QUALIFIER', 'qualifiers', 'SBR must disclose the illustrative local sequence, variable butadiene microstructure and unrepresented vulcanization/composition.');
  const ports = new Map((record.continuationPorts ?? []).map(port => [port.direction, port.atomRef]));
  if (ports.get('left') !== 'unit-0.a0' || ports.get('right') !== 'unit-2.a3') fail('CONTINUATION_PORT', 'continuationPorts', 'SBR local continuation ports must terminate at the outer butadiene backbone carbons.');
}

function validateVdfHfpRouteMotif(record, { fail, edgeByKey, components, route }) {
  const expectedSequence = ['vinylidene-fluoride', 'hexafluoropropylene', 'vinylidene-fluoride'];
  if (JSON.stringify(record.localSequence?.monomerIds) !== JSON.stringify(expectedSequence) || JSON.stringify(route?.representativeSequence) !== JSON.stringify(expectedSequence)) fail('VDF_HFP_LOCAL_SEQUENCE', 'localSequence.monomerIds', 'VDF-HFP motif must preserve the route-listed VDF–HFP–VDF local example.');
  const expectedComponents = ['unit-0', 'unit-1', 'unit-2'];
  if (JSON.stringify([...components.keys()]) !== JSON.stringify(expectedComponents) || expectedSequence.some((moleculeId, index) => components.get(expectedComponents[index])?.moleculeId !== moleculeId)) fail('VDF_HFP_SOURCE_MAPPING', 'source.components', 'VDF-HFP motif must map VDF, HFP and VDF source components in that order.');
  const expectedLinks = [['unit-0.a0', 'unit-1.a0'], ['unit-1.a1', 'unit-2.a0']];
  for (let index = 0; index < expectedLinks.length; index += 1) {
    const [a, b] = expectedLinks[index];
    const operation = (record.transformations ?? []).find(item => item.id === `link-${index + 1}`);
    const bond = edgeByKey.get(keyFor(a, b));
    if (!operation || operation.type !== 'form' || keyFor(operation.a, operation.b) !== keyFor(a, b) || operation.order !== 1 || operation.family !== 'vinyl'
      || !bond || bond.order !== 1 || bond.provenance?.kind !== 'route-transformation' || bond.provenance.operationId !== operation.id || bond.provenance.routeId !== record.routeId) {
      fail('VDF_HFP_INTERUNIT_LINK', `transformations.link-${index + 1}`, 'VDF-HFP route must connect active vinyl carbons in the VDF–HFP–VDF order with single bonds.');
    }
  }
  const expectedBackbone = ['unit-0.a0', 'unit-0.a1', 'unit-1.a0', 'unit-1.a1', 'unit-2.a0', 'unit-2.a1'];
  if (JSON.stringify(record.backboneAtomRefs) !== JSON.stringify(expectedBackbone)) fail('VDF_HFP_BACKBONE', 'backboneAtomRefs', 'VDF-HFP backbone must follow the two alkene carbons from each local sequence unit.');
  const leftPort = record.continuationPorts?.find(port => port.direction === 'left');
  if (leftPort?.atomRef !== 'unit-0.a1' || leftPort.partnerElement !== 'C' || leftPort.externalBondOrder !== 1) fail('VDF_HFP_CONTINUATION_PORT', 'continuationPorts.left', 'The left VDF continuation must use the C2 atom opposite the first active C1 linkage.');
}

export function createPolymerDrawingInput(input, polymerId, sources) {
  const validation = validatePolymerFragmentAuthority(input, sources);
  if (!validation.ok) throw new PolymerFragmentAuthorityError(validation.diagnostics);
  const record = input.records.find(item => item.polymerId === polymerId);
  if (!record) throw new PolymerFragmentAuthorityError([{ code: 'UNKNOWN_POLYMER_ID', polymerId, field: 'polymerId', message: 'No validated drawing authority exists for this polymer.' }]);
  return {
    schemaVersion: 1,
    validation: { status: 'passed', authoritySchemaVersion: input.schemaVersion, sourceCommit: input.sourceCommit, polymerId: record.polymerId },
    polymerId: record.polymerId,
    routeId: record.routeId,
    representationType: record.representationType,
    topology: record.topology,
    atoms: record.atoms.map(({ id, element, formalCharge, role, source }) => ({ id, element, formalCharge, role, source })),
    bonds: record.bonds.map(({ a, b, order, provenance }) => ({ a, b, order, provenance })),
    backboneAtomRefs: [...record.backboneAtomRefs],
    junctionAtomRefs: [...record.junctionAtomRefs],
    repeatGroups: structuredClone(record.repeatGroups),
    componentGroups: structuredClone(record.componentGroups),
    functionalGroups: structuredClone(record.functionalGroups),
    sideChains: structuredClone(record.sideChains),
    continuationPorts: structuredClone(record.continuationPorts),
    repeatClosure: structuredClone(record.repeatClosure),
    localSequence: structuredClone(record.localSequence),
    encyclopediaNumber: record.encyclopediaNumber,
    qualifiers: structuredClone(record.qualifiers),
    caveats: [...record.caveats],
    provenance: { ...structuredClone(record.source), sourceCommit: input.sourceCommit, sourceFiles: structuredClone(input.sourceFiles ?? []) }
  };
}

export async function readPolymerFragmentSources(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const read = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
  const [authority, polymers, routeAuthority, encyclopedia, molecules] = await Promise.all([
    read('data/polymer-fragment-authority.json'), read('data/polymers.json'),
    read('data/polymerization-routes.json'), read('data/polymer-encyclopedia.json'), read('data/molecules.json')
  ]);
  return { authority, sources: { polymers, routes: routeAuthority.routes, encyclopedia, molecules } };
}

async function runCli() {
  const { authority, sources } = await readPolymerFragmentSources();
  const result = validatePolymerFragmentAuthority(authority, sources);
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else if (result.ok) console.log(`PASS polymer fragment authority: ${result.count}/${POLYMER_FRAGMENT_COUNT}`);
  else console.error(`FAIL polymer fragment authority: ${result.diagnostics.length} diagnostic(s)\n${new PolymerFragmentAuthorityError(result.diagnostics).message}`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await runCli();
