import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ELEMENTS } from '../src/chemistry.js';
import { createPolymerDrawingInput, readPolymerFragmentSources, validatePolymerFragmentAuthority } from './polymer-fragment-authority.mjs';

export const POLYMER_STRUCTURE_SVG_VERSION = 'task8-2d-v4';
export const POLYMER_STRUCTURE_CANVAS = Object.freeze({ width: 960, height: 540 });
export const POLYMER_2D_PILOT_IDS = Object.freeze([
  'polyethylene', 'polypropylene', 'polyvinyl-chloride', 'polystyrene',
  'polyethylene-terephthalate', 'nylon-6-6', 'polytetrafluoroethylene',
  'styrene-butadiene-copolymer', 'phenol-formaldehyde-resin'
]);
export const POLYMER_2D_ROLLOUT_IDS = Object.freeze([
  'ethylene-propylene-copolymer', 'polyisobutylene', 'polychlorotrifluoroethylene',
  'polyacrylonitrile', 'polyacrylic-acid', 'polyethylene-oxide', 'polyethylene-adipate',
  'polylactic-acid', 'polyglycolic-acid', 'polyethylene-adipamide',
  'polybutadiene', 'nitrile-butadiene-rubber', 'polyisoprene', 'butyl-rubber',
  'polyvinylidene-fluoride', 'vinylidene-fluoride-hexafluoropropylene-copolymer'
]);
export const POLYMER_2D_PRODUCTION_IDS = Object.freeze([...POLYMER_2D_PILOT_IDS, ...POLYMER_2D_ROLLOUT_IDS]);
const pilotSet = new Set(POLYMER_2D_PILOT_IDS);
const productionSet = new Set(POLYMER_2D_PRODUCTION_IDS);
const BOND_LENGTH = 44;
// These hints change only drawing orientation. They preserve authority atom and bond identity.
const POLYMER_LAYOUT_HINTS = Object.freeze({
  'vinylidene-fluoride-hexafluoropropylene-copolymer': Object.freeze({
    branchAngleOffsets: Object.freeze({ 'unit-1.a1': 5 * Math.PI / 6 })
  })
});
const COLORS = Object.freeze({
  ink: '#182b3b', muted: '#536779', paper: '#f8fafc', paperEdge: '#dce5ec',
  continuation: '#007f78', chip: '#e9f2f6', chipText: '#19384a'
});
const labelJa = Object.freeze({
  'terephthalic-acid residue': 'テレフタレート残基',
  'ethylene-glycol residue': 'エチレングリコール残基',
  'adipic-acid residue': 'アジピン酸残基',
  'hexamethylenediamine residue': 'ヘキサメチレンジアミン残基',
  'pendant phenyl group': '側鎖フェニル基',
  'pendant phenyl ring; styrene-derived': 'スチレン由来フェニル基',
  'styrene-derived pendant phenyl ring': 'スチレン由来フェニル基',
  'covalent halogen substituent(s)': '共有結合したハロゲン',
  'ester linkage inside repeat': '反復単位内のエステル結合',
  'ester linkage across repeat boundary': '反復境界のエステル結合',
  'amide linkage inside repeat': '反復単位内のアミド結合',
  'amide linkage across repeat boundary': '反復境界のアミド結合',
  '1,4-addition residual backbone C=C; cis/trans unspecified': '1,4-付加後に残る主鎖C=C',
  'phenolic hydroxyl': 'フェノール性OH',
  'formaldehyde-derived methylene bridge': 'ホルムアルデヒド由来CH₂架橋'
});

function fail(input, code, message) {
  throw new Error(`${input?.polymerId ?? '(unknown polymer)'}: ${code}: ${message}`);
}

function assertValidatedDrawingInput(input) {
  if (!input || typeof input !== 'object') fail(input, 'DRAWING_INPUT', 'A validated drawing input is required.');
  if (input.validation?.status !== 'passed') fail(input, 'AUTHORITY_NOT_VALIDATED', 'Refusing to render an input whose Task⑥ validation status is not passed.');
  if (input.validation.polymerId !== input.polymerId) fail(input, 'POLYMER_ID_MISMATCH', 'Validation and drawing input polymer IDs differ.');
  if (!Array.isArray(input.atoms) || !input.atoms.length || !Array.isArray(input.bonds)) fail(input, 'GRAPH_MISSING', 'The validated input must include non-empty atoms and a bond array.');
  if (!['linear-repeat', 'copolymer-local-motif', 'network-junction'].includes(input.representationType)) fail(input, 'UNSUPPORTED_REPRESENTATION', `Unsupported representation type ${String(input.representationType)}.`);
  const ids = new Set();
  for (const atom of input.atoms) {
    if (!atom?.id || ids.has(atom.id)) fail(input, 'ATOM_ID', `Missing or duplicate atom ID ${String(atom?.id)}.`);
    if (!ELEMENTS[atom.element]) fail(input, 'ELEMENT', `Unsupported element ${String(atom.element)} at ${atom.id}.`);
    ids.add(atom.id);
  }
  const pairs = new Set();
  for (const bond of input.bonds) {
    if (!ids.has(bond.a) || !ids.has(bond.b)) fail(input, 'BOND_ATOM_REFERENCE', `Bond references a missing atom (${bond.a}, ${bond.b}).`);
    if (![1, 2, 3].includes(bond.order)) fail(input, 'BOND_ORDER', `Unsupported bond order ${String(bond.order)} for ${bond.a}–${bond.b}.`);
    const key = [bond.a, bond.b].sort().join('\u0000');
    if (pairs.has(key)) fail(input, 'DUPLICATE_BOND', `Duplicate bond ${bond.a}–${bond.b}.`);
    pairs.add(key);
  }
  if (input.qualifiers?.stereochemistry?.drawing !== 'no-stereo-wedges') fail(input, 'STEREO_DRAWING', 'The authority must explicitly request no-stereo-wedges.');
  for (const port of input.continuationPorts ?? []) if (!ids.has(port.atomRef)) fail(input, 'CONTINUATION_PORT', `Port ${port.id} references missing atom ${port.atomRef}.`);
  if (input.representationType === 'linear-repeat' && (!input.repeatClosure || (input.continuationPorts?.length ?? 0) !== 2)) fail(input, 'REPEAT_BOUNDARY', 'A linear repeat requires its validated closure and two continuation ports.');
  if (input.representationType === 'copolymer-local-motif' && !input.localSequence) fail(input, 'LOCAL_SEQUENCE', 'A copolymer image requires the validated local sequence.');
  if (input.representationType === 'copolymer-local-motif' && (input.repeatClosure || (input.repeatGroups?.length ?? 0) || input.qualifiers?.bulkComposition !== 'not-asserted' || input.qualifiers?.localSequence !== 'local-example-only')) fail(input, 'COPOLYMER_QUALIFIERS', 'A copolymer must remain a local example without repeat closure or a fixed composition claim.');
  if (input.representationType === 'network-junction' && (input.continuationPorts?.length ?? 0) < 3) fail(input, 'NETWORK_BRANCHES', 'A network image requires at least three validated continuation ports.');
  if (input.representationType === 'network-junction' && input.repeatClosure) fail(input, 'NETWORK_REPEAT', 'A network junction cannot use a linear repeat closure.');
  return ids;
}

function adjacencyFor(input) {
  const map = new Map(input.atoms.map(atom => [atom.id, []]));
  for (const bond of input.bonds) {
    map.get(bond.a).push({ id: bond.b, bond });
    map.get(bond.b).push({ id: bond.a, bond });
  }
  for (const list of map.values()) list.sort((a, b) => a.id.localeCompare(b.id));
  return map;
}

function cycleKey(ids) { return [...ids].sort().join('\u0000'); }

function findAromaticCycles(input, adjacency) {
  const atomById = new Map(input.atoms.map(atom => [atom.id, atom]));
  const found = new Map();
  for (const start of [...adjacency.keys()].sort()) {
    if (atomById.get(start)?.element !== 'C') continue;
    const walk = (current, path) => {
      if (path.length === 6) {
        if (!adjacency.get(current).some(edge => edge.id === start) || path.some(id => id < start)) return;
        const edges = path.map((id, index) => adjacency.get(id).find(edge => edge.id === path[(index + 1) % 6])?.bond);
        if (edges.some(edge => !edge) || edges.filter(edge => edge.order === 2).length !== 3 || edges.filter(edge => edge.order === 1).length !== 3) return;
        if (edges.some((edge, index) => edge.order === edges[(index + 1) % 6].order)) return;
        found.set(cycleKey(path), path);
        return;
      }
      for (const edge of adjacency.get(current)) {
        if (edge.id === start || path.includes(edge.id) || atomById.get(edge.id)?.element !== 'C') continue;
        walk(edge.id, [...path, edge.id]);
      }
    };
    walk(start, [start]);
  }
  return [...found.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, atoms]) => ({ id: `ring:${key}`, atoms, atomSet: new Set(atoms) }));
}

const vec = (x, y) => ({ x, y });
const add = (a, b) => vec(a.x + b.x, a.y + b.y);
const sub = (a, b) => vec(a.x - b.x, a.y - b.y);
const mul = (a, n) => vec(a.x * n, a.y * n);
const magnitude = a => Math.hypot(a.x, a.y);
function unit(a, fallback = vec(1, 0)) { const n = magnitude(a); return n > 1e-8 ? mul(a, 1 / n) : fallback; }
function normal(a, side = -1) { return vec(-a.y * side, a.x * side); }
const angleVector = angle => vec(Math.cos(angle), Math.sin(angle));
const componentRef = atomId => atomId.split('.a')[0];
const bondRef = bond => `${bond.a}::${bond.b}`;
const round = value => Number(value.toFixed(2));

function cycleForComponent(rings, ref) { return rings.find(ring => ring.atoms.every(id => componentRef(id) === ref)); }

function placeRing(cycle, positions, center, radius, anchorRef, anchorAngle, direction = 1) {
  const anchorIndex = cycle.atoms.indexOf(anchorRef);
  if (anchorIndex < 0) throw new Error(`Ring ${cycle.id} does not contain anchor ${anchorRef}.`);
  for (let index = 0; index < cycle.atoms.length; index++) {
    const angle = anchorAngle + (index - anchorIndex) * direction * Math.PI / 3;
    positions.set(cycle.atoms[index], add(center, mul(angleVector(angle), radius)));
  }
}

function branchDirection(input, adjacency, positions, parentId, role) {
  const backbone = new Set(input.backboneAtomRefs ?? []);
  const pathNeighbors = adjacency.get(parentId).map(edge => edge.id).filter(id => backbone.has(id) && positions.has(id));
  let tangent = vec(1, 0);
  if (pathNeighbors.length >= 2) tangent = unit(sub(positions.get(pathNeighbors.at(-1)), positions.get(pathNeighbors[0])));
  else if (pathNeighbors.length === 1) tangent = unit(sub(positions.get(parentId), positions.get(pathNeighbors[0])));
  const side = role === 'phenyl' || role === 'side-chain' ? -1 : -1;
  return unit(normal(tangent, side), vec(0, -1));
}

function createBackbonePath(input, adjacency, rings) {
  const backbone = new Set(input.backboneAtomRefs ?? []);
  if (!backbone.size) return null;
  const ringByAtom = new Map();
  for (const ring of rings) if (ring.atoms.every(id => backbone.has(id))) for (const id of ring.atoms) ringByAtom.set(id, ring);
  const virtual = id => ringByAtom.get(id)?.id ?? `atom:${id}`;
  const nodes = new Map();
  for (const id of backbone) {
    const ring = ringByAtom.get(id), nodeId = ring?.id ?? `atom:${id}`;
    if (!nodes.has(nodeId)) nodes.set(nodeId, { id: nodeId, kind: ring ? 'ring' : 'atom', atomRef: ring ? null : id, ring });
  }
  const links = new Map([...nodes.keys()].map(id => [id, new Map()]));
  const link = (a, b, ringAtomRef = null) => {
    if (a === b) return;
    links.get(a).set(b, { nodeId: b, ringAtomRef });
    links.get(b).set(a, { nodeId: a, ringAtomRef });
  };
  for (const bond of input.bonds) {
    if (!backbone.has(bond.a) || !backbone.has(bond.b)) continue;
    const a = virtual(bond.a), b = virtual(bond.b);
    if (nodes.get(a)?.kind === 'ring') link(a, b, bond.a);
    else if (nodes.get(b)?.kind === 'ring') link(a, b, bond.b);
    else link(a, b);
  }
  const ports = input.continuationPorts ?? [];
  const left = ports.find(port => port.direction === 'left') ?? ports[0];
  const right = ports.find(port => port.direction === 'right') ?? ports.at(-1);
  if (!left || !right) throw new Error('The validated linear repeat has no left/right port pair.');
  const start = virtual(left.atomRef), end = virtual(right.atomRef), paths = [];
  const walk = (current, path, previous) => {
    if (current === end) { paths.push(path); return; }
    for (const next of [...links.get(current).keys()].sort()) if (next !== previous && !path.includes(next)) walk(next, [...path, next], current);
  };
  walk(start, [start], null);
  if (paths.length !== 1) throw new Error(`The backbone has ${paths.length} paths between continuation ports.`);
  return { path: paths[0].map(id => nodes.get(id)), links, left, right };
}

function layoutLinear(input, adjacency, rings, positions) {
  const graph = createBackbonePath(input, adjacency, rings);
  if (!graph) throw new Error('A linear polymer has no validated backbone.');
  const { path, links, left, right } = graph;
  const units = path.reduce((sum, node) => sum + (node.kind === 'ring' ? 4 : 1), 0);
  let x = -((units - 1) * BOND_LENGTH) / 2, atomIndex = 0;
  for (let index = 0; index < path.length; index++) {
    const node = path[index];
    if (node.kind === 'atom') {
      const y = path.length < 3 ? 0 : (atomIndex % 2 ? 13 : -13);
      positions.set(node.atomRef, vec(x, y));
      x += BOND_LENGTH;
      atomIndex++;
    } else {
      const previous = path[index - 1], next = path[index + 1];
      if (!previous || !next) throw new Error(`Backbone ring ${node.ring.id} needs two external neighbors.`);
      const leftAtom = links.get(node.id).get(previous.id)?.ringAtomRef;
      const rightAtom = links.get(node.id).get(next.id)?.ringAtomRef;
      if (!leftAtom || !rightAtom || Math.abs(node.ring.atoms.indexOf(leftAtom) - node.ring.atoms.indexOf(rightAtom)) !== 3) throw new Error(`Backbone ring ${node.ring.id} lacks opposite atom-mapped attachments.`);
      placeRing(node.ring, positions, vec(x + 2 * BOND_LENGTH, 0), BOND_LENGTH, leftAtom, Math.PI);
      x += 4 * BOND_LENGTH;
    }
  }
  const mainRings = new Set(path.filter(node => node.kind === 'ring').map(node => node.ring.id));
  for (const ring of rings) {
    if (mainRings.has(ring.id)) continue;
    const attachments = [];
    for (const ringAtom of ring.atoms) for (const edge of adjacency.get(ringAtom)) if (!ring.atomSet.has(edge.id) && positions.has(edge.id)) attachments.push({ ringAtom, outside: edge.id });
    if (attachments.length !== 1) throw new Error(`Pendant ring ${ring.id} needs one mapped attachment; found ${attachments.length}.`);
    const { ringAtom, outside } = attachments[0], direction = branchDirection(input, adjacency, positions, outside, 'phenyl');
    const anchor = add(positions.get(outside), mul(direction, BOND_LENGTH));
    placeRing(ring, positions, add(anchor, mul(direction, BOND_LENGTH)), BOND_LENGTH, ringAtom, Math.atan2(-direction.y, -direction.x));
  }
  return { path, left, right };
}

function layoutPhenolNetwork(input, rings, positions) {
  if (input.provenance?.kind !== 'independent-encyclopedia-motif' || input.provenance?.routeSampleRelation !== 'independent-motif-not-gameplay-polymer-sample') throw new Error('Phenol-formaldehyde must use its separately sourced independent motif.');
  const core = cycleForComponent(rings, 'phenol-core');
  if (!core) throw new Error('The independent phenol motif is missing its central six-carbon ring.');
  placeRing(core, positions, vec(0, 0), 38, 'phenol-core.a0', -Math.PI / 2);
  const bridges = (input.functionalGroups ?? []).filter(group => group.label === 'formaldehyde-derived methylene bridge');
  if (bridges.length !== 3) throw new Error(`Expected three source-mapped methylene bridges; found ${bridges.length}.`);
  for (const group of bridges) {
    const [coreRef, bridgeRef, armRef] = group.atomRefs, direction = unit(positions.get(coreRef));
    if (!positions.has(coreRef) || !input.atoms.some(atom => atom.id === bridgeRef && atom.role === 'network-bridge')) throw new Error(`Bridge ${group.id} does not match the independent motif topology.`);
    const bridge = add(positions.get(coreRef), mul(direction, 50)), armAnchor = add(bridge, mul(direction, 50));
    positions.set(bridgeRef, bridge);
    const arm = cycleForComponent(rings, componentRef(armRef));
    if (!arm) throw new Error(`Bridge ${group.id} has no mapped phenolic arm ring.`);
    placeRing(arm, positions, add(armAnchor, mul(direction, 38)), 38, armRef, Math.atan2(-direction.y, -direction.x));
  }
  return { networkCenter: vec(0, 0) };
}

function layoutBranches(input, adjacency, rings, positions, layoutHints = {}) {
  const atomById = new Map(input.atoms.map(atom => [atom.id, atom]));
  const ringByAtom = new Map();
  for (const ring of rings) for (const id of ring.atoms) ringByAtom.set(id, ring);
  const ringAtoms = new Set(ringByAtom.keys());
  const backbone = new Set(input.backboneAtomRefs ?? []);
  const queue = [...positions.keys()].sort();
  for (let index = 0; index < queue.length; index++) {
    const parentId = queue[index], parent = positions.get(parentId);
    const children = adjacency.get(parentId).filter(edge => atomById.get(edge.id).element !== 'H' && !backbone.has(edge.id) && !ringAtoms.has(edge.id) && !positions.has(edge.id));
    if (!children.length) continue;
    let directions;
    const branchAngleOffset = layoutHints.branchAngleOffsets?.[parentId] ?? 0;
    if (children.length === 2 && atomById.get(parentId).element === 'C') {
      const tangent = adjacency.get(parentId).map(edge => positions.get(edge.id)).find(Boolean) ? unit(sub(parent, adjacency.get(parentId).map(edge => positions.get(edge.id)).find(Boolean))) : vec(1, 0);
      const baseNormal = normal(tangent, -1), angle = Math.atan2(baseNormal.y, baseNormal.x) + branchAngleOffset;
      const n = angleVector(angle);
      directions = [n, mul(n, -1)];
    } else {
      const role = input.sideChains?.some(group => group.atomRefs.includes(children[0].id)) ? 'side-chain' : 'group';
      const ring = ringByAtom.get(parentId);
      const ringCenter = ring?.atoms.map(id => positions.get(id)).reduce((sum, point) => add(sum, point), vec(0, 0));
      const base = ring ? unit(sub(parent, mul(ringCenter, 1 / ring.atoms.length))) : branchDirection(input, adjacency, positions, parentId, role);
      const angle = Math.atan2(base.y, base.x) + branchAngleOffset;
      directions = children.map((_, childIndex) => angleVector(angle + (childIndex - (children.length - 1) / 2) * (children.length > 1 ? Math.PI / 3 : 0)));
    }
    children.forEach((child, childIndex) => {
      positions.set(child.id, add(parent, mul(directions[childIndex] ?? directions[0], BOND_LENGTH)));
      queue.push(child.id);
    });
  }
  for (const atom of input.atoms) {
    if (atom.element === 'H') {
      const parent = adjacency.get(atom.id).find(edge => atomById.get(edge.id).element !== 'H')?.id;
      if (parent && positions.has(parent)) positions.set(atom.id, positions.get(parent));
    } else if (!positions.has(atom.id)) throw new Error(`No deterministic layout rule placed heavy atom ${atom.id} (${atom.element}, ${atom.role}).`);
  }
  return atomById;
}

function atomLabel(atom, adjacency, atomById) {
  if (atom.element === 'H') return null;
  const hydrogenRefs = adjacency.get(atom.id).filter(edge => atomById.get(edge.id).element === 'H').map(edge => edge.id);
  if (atom.element === 'C') {
    if (atom.role === 'network-bridge') return { text: 'CH₂', atomRefs: [atom.id, ...hydrogenRefs], color: ELEMENTS.C.color, kind: 'condensed-atom' };
    const heavyDegree = adjacency.get(atom.id).filter(edge => atomById.get(edge.id).element !== 'H').length;
    if (heavyDegree === 1 && hydrogenRefs.length >= 3) return { text: 'CH₃', atomRefs: [atom.id, ...hydrogenRefs], color: ELEMENTS.C.color, kind: 'condensed-atom' };
    return null;
  }
  if (atom.element === 'O' && hydrogenRefs.length) return { text: 'OH', atomRefs: [atom.id, ...hydrogenRefs], color: ELEMENTS.O.color, kind: 'heteroatom-group' };
  if (atom.element === 'N' && hydrogenRefs.length) return { text: `NH${hydrogenRefs.length > 1 ? '₂' : ''}`, atomRefs: [atom.id, ...hydrogenRefs], color: ELEMENTS.N.color, kind: 'heteroatom-group' };
  const charge = atom.formalCharge > 0 ? '+' : atom.formalCharge < 0 ? '−' : '';
  return { text: `${atom.element}${charge}`, atomRefs: [atom.id], color: ELEMENTS[atom.element].color, kind: 'element-label' };
}

function labelWidth(text, fontSize) { return Math.max(fontSize * 0.72, [...text].length * fontSize * 0.6); }

function buildLabels(input, adjacency, atomById) {
  const labels = new Map();
  for (const atom of input.atoms) {
    const label = atomLabel(atom, adjacency, atomById);
    if (!label) continue;
    const fontSize = label.text.length > 2 ? 30 : 34;
    labels.set(atom.id, { ...label, fontSize, width: labelWidth(label.text, fontSize), height: 42 });
  }
  return labels;
}

function portVector(input, positions, port) {
  const point = positions.get(port.atomRef);
  if (port.direction === 'left') return vec(-1, 0);
  if (port.direction === 'right') return vec(1, 0);
  const neighbors = input.bonds.filter(bond => bond.a === port.atomRef || bond.b === port.atomRef)
    .map(bond => positions.get(bond.a === port.atomRef ? bond.b : bond.a)).filter(Boolean);
  if (neighbors.length === 1) return unit(sub(point, neighbors[0]));
  return unit(point, vec(1, 0));
}

function portLabelGeometry(input, port) {
  const { direction, end } = port;
  const text = input.representationType === 'network-junction' ? '網目へ' : '鎖へ';
  const horizontal = Math.abs(direction.y) < 0.45;
  const axialVertical = Math.abs(direction.x) < 0.35 && Math.abs(direction.y) > 0.85;
  const x = horizontal ? end.x : axialVertical ? end.x + (direction.x >= 0 ? 44 : -44) : end.x + direction.x * 18;
  const y = horizontal ? end.y + 24 : axialVertical ? end.y - 8 : end.y + direction.y * 24;
  const anchor = horizontal ? 'middle' : axialVertical ? direction.x >= 0 ? 'start' : 'end' : direction.x < -0.2 ? 'end' : direction.x > 0.2 ? 'start' : 'middle';
  const width = [...text].length * 18;
  const left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x;
  return { text, x, y, anchor, rect: { left, right: left + width, top: y - 18, bottom: y + 5 } };
}

function rawBounds(input, positions, labels, includeBracket) {
  const points = [];
  for (const atom of input.atoms) {
    if (atom.element === 'H') continue;
    const point = positions.get(atom.id), label = labels.get(atom.id);
    if (!point) continue;
    const halfWidth = label ? label.width / 2 + 8 : 5, halfHeight = label ? label.height / 2 + 4 : 5;
    points.push(vec(point.x - halfWidth, point.y - halfHeight), vec(point.x + halfWidth, point.y + halfHeight));
  }
  for (const port of input.continuationPorts ?? []) points.push(add(positions.get(port.atomRef), mul(portVector(input, positions, port), 42)));
  const bounds = extent(points);
  if (includeBracket) points.push(vec(bounds.minX - 26, bounds.minY - 18), vec(bounds.maxX + 26, bounds.maxY + 18));
  return extent(points);
}

function extent(points) {
  const list = points.length ? points : [vec(0, 0)];
  return {
    minX: Math.min(...list.map(point => point.x)), maxX: Math.max(...list.map(point => point.x)),
    minY: Math.min(...list.map(point => point.y)), maxY: Math.max(...list.map(point => point.y))
  };
}

function normalize(input, positions, labels) {
  const bounds = rawBounds(input, positions, labels, input.representationType === 'linear-repeat');
  const width = Math.max(1, bounds.maxX - bounds.minX), height = Math.max(1, bounds.maxY - bounds.minY);
  const layoutScale = Math.min(4.8, 852 / width, 324 / height);
  if (!Number.isFinite(layoutScale) || layoutScale <= 0) throw new Error('Could not fit deterministic layout to the illustration canvas.');
  const usedWidth = width * layoutScale, usedHeight = height * layoutScale;
  const left = (960 - usedWidth) / 2, top = 89 + (324 - usedHeight) / 2;
  const mapPoint = point => vec(left + (point.x - bounds.minX) * layoutScale, top + (point.y - bounds.minY) * layoutScale);
  const screenPositions = new Map([...positions].map(([id, point]) => [id, mapPoint(point)]));
  const ports = (input.continuationPorts ?? []).map(port => {
    const origin = screenPositions.get(port.atomRef), direction = unit(portVector(input, positions, port));
    return { ...port, origin, direction, end: add(origin, mul(direction, 42 * layoutScale)) };
  });
  return { positions: screenPositions, ports, layoutScale, bounds };
}

function segmentCrossesRect(a, b, rect) {
  let low = 0, high = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - rect.left], [dx, rect.right - a.x], [-dy, a.y - rect.top], [dy, rect.bottom - a.y]]) {
    if (Math.abs(p) < 1e-8) { if (q < 0) return false; continue; }
    const ratio = q / p;
    if (p < 0) low = Math.max(low, ratio); else high = Math.min(high, ratio);
    if (low > high) return false;
  }
  return true;
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function collisionCheck(input, layout, labels) {
  const atomById = new Map(input.atoms.map(atom => [atom.id, atom]));
  const adjacency = adjacencyFor(input);
  const visible = input.atoms.filter(atom => labels.has(atom.id)).map(atom => ({ id: atom.id, point: layout.positions.get(atom.id), label: labels.get(atom.id) }));
  const collisions = [];
  for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) {
    const a = visible[i], b = visible[j];
    if (Math.abs(a.point.x - b.point.x) < (a.label.width + b.label.width) / 2 + 3 && Math.abs(a.point.y - b.point.y) < (a.label.height + b.label.height) / 2 + 3) collisions.push(`${a.id}/${b.id}`);
  }
  const bondByRef = input.bonds;
  for (const label of visible) {
    const members = new Set(label.label.atomRefs), halfWidth = label.label.width / 2 + 5;
    const halfHeight = label.label.height / 2;
    const rect = { left: label.point.x - halfWidth, right: label.point.x + halfWidth, top: label.point.y - halfHeight, bottom: label.point.y + halfHeight };
    for (const bond of bondByRef) {
      // Carbon-bound hydrogens are deliberately collapsed into skeletal notation.
      // Their zero-length SVG bonds are metadata only and cannot collide visually.
      const isCollapsedCarbonHydrogen = atomRef => atomById.get(atomRef)?.element === 'H'
        && hydrogenMode(adjacency, atomById, atomRef) === 'implicit-carbon-bound-hydrogen';
      if (isCollapsedCarbonHydrogen(bond.a) || isCollapsedCarbonHydrogen(bond.b)) continue;
      if (members.has(bond.a) || members.has(bond.b)) continue;
      if (segmentCrossesRect(layout.positions.get(bond.a), layout.positions.get(bond.b), rect)) collisions.push(`${label.id}/bond:${bondRef(bond)}`);
    }
    for (const port of layout.ports) {
      if (members.has(port.atomRef)) continue;
      if (segmentCrossesRect(port.origin, port.end, rect)) collisions.push(`${label.id}/port:${port.id}`);
    }
    if (rect.left < 20 || rect.right > 940 || rect.top < 73 || rect.bottom > 428) collisions.push(`${label.id}/canvas-edge`);
  }
  const portLabels = layout.ports.map(port => ({ port, ...portLabelGeometry(input, port) }));
  for (const item of portLabels) {
    const { port, rect } = item;
    if (rect.left < 20 || rect.right > 940 || rect.top < 20 || rect.bottom > 530) collisions.push(`${port.id}/label-canvas-edge`);
    for (const label of visible) {
      const other = { left: label.point.x - label.label.width / 2 - 5, right: label.point.x + label.label.width / 2 + 5, top: label.point.y - label.label.height / 2, bottom: label.point.y + label.label.height / 2 };
      if (rectsOverlap(rect, other)) collisions.push(`${port.id}/label:${label.id}`);
    }
    for (const bond of input.bonds) if (segmentCrossesRect(layout.positions.get(bond.a), layout.positions.get(bond.b), rect)) collisions.push(`${port.id}/label-bond:${bondRef(bond)}`);
    for (const other of layout.ports) if (other.id !== port.id && segmentCrossesRect(other.origin, other.end, rect)) collisions.push(`${port.id}/label-port:${other.id}`);
  }
  for (let i = 0; i < portLabels.length; i++) for (let j = i + 1; j < portLabels.length; j++) {
    if (rectsOverlap(portLabels[i].rect, portLabels[j].rect)) collisions.push(`${portLabels[i].port.id}/${portLabels[j].port.id}-label`);
  }
  for (const port of layout.ports) if (port.end.x < 26 || port.end.x > 934 || port.end.y < 73 || port.end.y > 428) collisions.push(`${port.id}/canvas-edge`);
  if (collisions.length) throw new Error(`Atom label collision: ${collisions.join(', ')}.`);
  for (const atom of input.atoms) {
    const point = layout.positions.get(atom.id);
    if (!point || point.x < 22 || point.x > 938 || point.y < 20 || point.y > 428) throw new Error(`Atom ${atom.id} is outside the safe drawing region.`);
  }
}

function hydrogenMode(adjacency, atomById, hydrogenRef) {
  const parent = adjacency.get(hydrogenRef)?.find(edge => atomById.get(edge.id).element !== 'H')?.id;
  if (!parent) return 'unattached-hydrogen';
  const element = atomById.get(parent).element;
  if (element === 'O') return 'represented-in-OH-label';
  if (element === 'N') return 'represented-in-NH-label';
  return 'implicit-carbon-bound-hydrogen';
}

function qualifierNotes(input) {
  const q = input.qualifiers ?? {}, notes = [];
  if (q.stereochemistry?.status === 'unspecified') notes.push('立体化学は未指定');
  if (q.stereochemistry?.status === 'not-asserted') notes.push('立体化学を特定しない');
  if (q.tacticity === 'not-asserted') notes.push('タクチシティを特定しない');
  if (q.cisTrans === 'unspecified') notes.push('cis/trans 未指定');
  if (q.dieneMicrostructure === 'varies') notes.push('ジエン微細構造は多様');
  if (q.regiochemistry?.startsWith('local-')) notes.push('局所的な1,4-構造の例');
  if (q.bulkComposition === 'not-asserted') notes.push('組成比を示さない');
  if (q.localSequence === 'local-example-only') notes.push('局所配列例。高分子全体の配列を示さない');
  if (q.crosslinking === 'local-network-motif-only') notes.push('局所網目モチーフ。硬化状態や網目密度を示さない');
  return [...new Set(notes)];
}

export function createPolymerStructureLayout(input, { layoutHints = POLYMER_LAYOUT_HINTS[input?.polymerId] ?? {} } = {}) {
  assertValidatedDrawingInput(input);
  try {
    const adjacency = adjacencyFor(input), rings = findAromaticCycles(input, adjacency), positions = new Map();
    if (input.representationType === 'network-junction') layoutPhenolNetwork(input, rings, positions);
    else layoutLinear(input, adjacency, rings, positions);
    const atomById = layoutBranches(input, adjacency, rings, positions, layoutHints), labels = buildLabels(input, adjacency, atomById);
    const normalized = normalize(input, positions, labels);
    collisionCheck(input, normalized, labels);
    const atomPositions = Object.fromEntries([...normalized.positions].map(([id, point]) => [id, { x: round(point.x), y: round(point.y) }]));
    const renderedLabels = Object.fromEntries([...labels].map(([id, label]) => [id, { ...label, x: atomPositions[id].x, y: atomPositions[id].y }]));
    const atomMetadata = input.atoms.map(atom => ({ ...atom, display: atom.element === 'H' ? hydrogenMode(adjacency, atomById, atom.id) : labels.has(atom.id) ? labels.get(atom.id).kind : atom.element === 'C' ? 'skeletal-carbon-vertex' : 'implicit-vertex' }));
    return {
      polymerId: input.polymerId, rendererVersion: POLYMER_STRUCTURE_SVG_VERSION, atomPositions,
      layoutHints: structuredClone(layoutHints),
      ports: normalized.ports.map(port => ({ ...port, origin: { x: round(port.origin.x), y: round(port.origin.y) }, end: { x: round(port.end.x), y: round(port.end.y) }, direction: { x: round(port.direction.x), y: round(port.direction.y) } })),
      rings: rings.map(ring => ({ id: ring.id, atomRefs: [...ring.atoms] })),
      labels: renderedLabels, atomMetadata, bondMetadata: input.bonds.map(bond => ({ ...bond })),
      backboneAtomRefs: [...(input.backboneAtomRefs ?? [])], componentGroups: structuredClone(input.componentGroups ?? []),
      layoutScale: round(normalized.layoutScale), layoutBounds: normalized.bounds,
      includeRepeatBracket: input.representationType === 'linear-repeat', qualifierNotes: qualifierNotes(input),
      _positions: normalized.positions
    };
  } catch (error) {
    fail(input, 'LAYOUT_FAILED', error instanceof Error ? error.message : String(error));
  }
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function textWidth(text, fontSize = 15) { return Math.max(fontSize * 0.72, [...text].length * fontSize * 0.6); }
function symbolTrim(label) { return label ? Math.max(13, label.width / 2 + 4) : 0; }

function segment(a, b, trimA, trimB) {
  const direction = unit(sub(b, a));
  return { start: add(a, mul(direction, trimA)), end: add(b, mul(direction, -trimB)), direction };
}

function renderBonds(input, layout) {
  const labelMap = new Map(Object.entries(layout.labels)), ringByAtom = new Map();
  for (const ring of layout.rings) for (const id of ring.atomRefs) ringByAtom.set(id, ring);
  return input.bonds.map(bond => {
    const a = layout._positions.get(bond.a), b = layout._positions.get(bond.b), line = segment(a, b, symbolTrim(labelMap.get(bond.a)), symbolTrim(labelMap.get(bond.b)));
    const nx = -line.direction.y, ny = line.direction.x, ring = ringByAtom.get(bond.a);
    let inward = null;
    if (bond.order > 1 && ring && ring === ringByAtom.get(bond.b)) {
      const center = ring.atomRefs.map(id => layout._positions.get(id)).reduce((sum, point) => add(sum, point), vec(0, 0));
      inward = unit(sub(mul(center, 1 / ring.atomRefs.length), mul(add(a, b), 0.5)));
    }
    const ringBond = inward !== null;
    const paths = [];
    for (let index = 0; index < bond.order; index++) {
      const offset = ringBond
        ? index === 0 ? vec(0, 0) : mul(inward, 7)
        : vec(nx * (index - (bond.order - 1) / 2) * 7, ny * (index - (bond.order - 1) / 2) * 7);
      const start = add(line.start, offset), end = add(line.end, offset);
      paths.push(`<path d="M${round(start.x)} ${round(start.y)}L${round(end.x)} ${round(end.y)}"/>`);
    }
    return `<g class="bond" data-bond-ref="${escapeXml(bondRef(bond))}" data-atom-a="${escapeXml(bond.a)}" data-atom-b="${escapeXml(bond.b)}" data-bond-order="${bond.order}">${paths.join('')}</g>`;
  }).join('');
}

function renderAtoms(input, layout) {
  const labels = new Map(Object.entries(layout.labels));
  return input.atoms.filter(atom => atom.element !== 'H').map(atom => {
    const point = layout._positions.get(atom.id), label = labels.get(atom.id);
    if (!label) return `<g class="atom-map skeletal-carbon" data-atom-ref="${escapeXml(atom.id)}" data-element="${atom.element}" data-display="skeletal-carbon-vertex" aria-hidden="true"><circle cx="${round(point.x)}" cy="${round(point.y)}" r="2.5" fill="${COLORS.ink}" opacity=".001"/></g>`;
    const width = label.width + 10, height = 42;
    return `<g class="atom-map atom-label" data-atom-ref="${escapeXml(atom.id)}" data-element="${atom.element}" data-display="${escapeXml(label.kind)}" data-label-atom-refs="${escapeXml(label.atomRefs.join(' '))}" aria-hidden="true"><rect x="${round(point.x - width / 2)}" y="${round(point.y - height / 2)}" width="${round(width)}" height="${height}" rx="8" fill="${COLORS.paper}"/><text x="${round(point.x)}" y="${round(point.y + label.fontSize * 0.34)}" text-anchor="middle" font-family="sans-serif" font-size="${label.fontSize}" font-weight="750" fill="${escapeXml(label.color)}">${escapeXml(label.text)}</text></g>`;
  }).join('');
}

function renderPorts(input, layout) {
  return layout.ports.map(port => {
    const { origin, end, direction } = port, tip = vec(end.x, end.y), label = portLabelGeometry(input, port);
    const base = vec(tip.x - direction.x * 7, tip.y - direction.y * 7), side = vec(direction.y * 4, -direction.x * 4);
    return `<g class="continuation-port" data-port-id="${escapeXml(port.id)}" data-port-atom-ref="${escapeXml(port.atomRef)}" data-connection-type="${escapeXml(port.connectionType)}" data-external-bond-order="${port.externalBondOrder}" data-partner-element="${escapeXml(port.partnerElement)}"><path d="M${round(origin.x)} ${round(origin.y)}L${round(end.x)} ${round(end.y)}" fill="none" stroke="${COLORS.continuation}" stroke-width="3.5" stroke-dasharray="7 6"/><path d="M${round(base.x + side.x)} ${round(base.y + side.y)}L${round(tip.x)} ${round(tip.y)}L${round(base.x - side.x)} ${round(base.y - side.y)}" fill="none" stroke="${COLORS.continuation}" stroke-width="3.5" stroke-linecap="round"/><text class="continuation-label" data-port-label-for="${escapeXml(port.id)}" x="${round(label.x)}" y="${round(label.y)}" text-anchor="${label.anchor}" font-family="sans-serif" font-size="18" font-weight="700" fill="${COLORS.continuation}">${label.text}</text></g>`;
  }).join('');
}

function renderBracket(input, layout) {
  if (input.representationType !== 'linear-repeat') return '';
  const points = input.atoms.filter(atom => atom.element !== 'H').map(atom => layout._positions.get(atom.id));
  for (const atom of input.atoms) {
    const point = layout._positions.get(atom.id), label = layout.labels[atom.id];
    if (atom.element === 'H' || !label) continue;
    points.push(vec(point.x - label.width / 2 - 5, point.y - 18), vec(point.x + label.width / 2 + 5, point.y + 18));
  }
  const bounds = extent(points), left = bounds.minX - 18, right = bounds.maxX + 18, top = bounds.minY - 14, bottom = bounds.maxY + 14;
  if (left < 20 || right > 920 || top < 73 || bottom > 424) throw new Error('The repeat bracket lies outside its safe region.');
  return `<g class="repeat-bracket" data-repeat-closure="${escapeXml(input.repeatClosure.kind)}" data-repeat-left-port="${escapeXml(input.repeatClosure.leftPortId)}" data-repeat-right-port="${escapeXml(input.repeatClosure.rightPortId)}" data-repeat-bond-order="${input.repeatClosure.bondOrder}" fill="none" stroke="${COLORS.ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M${left + 18} ${top}H${left}V${bottom}H${left + 18}"/><path d="M${right - 18} ${top}H${right}V${bottom}H${right - 18}"/></g><text class="repeat-n" data-repeat-count-notation="true" x="${round(right + 10)}" y="${round(bottom + 2)}" font-family="sans-serif" font-size="25" font-style="italic" fill="${COLORS.ink}">n</text>`;
}

function annotationLines(input) {
  if (input.representationType === 'network-junction') return [
    'フェノール樹脂の代表的な局所架橋構造。',
    '実際の樹脂全体の構造や硬化状態を一意に示すものではありません。',
    'この図はReaction LabのPolymerSampleと同一の構造ではありません。'
  ];
  if (input.representationType === 'copolymer-local-motif') {
    const names = {
      '1-3-butadiene': 'ブタジエン', styrene: 'スチレン',
      ethene: 'エチレン', propene: 'プロピレン', acrylonitrile: 'アクリロニトリル',
      isobutene: 'イソブテン', isoprene: 'イソプレン',
      'vinylidene-fluoride': 'フッ化ビニリデン',
      hexafluoropropylene: 'ヘキサフルオロプロピレン'
    };
    const sequence = (input.localSequence?.monomerIds ?? []).map(id => names[id] ?? id).join(' → ');
    const lines = ['局所配列例：' + sequence, '組成比や配列規則を示しません。'];
    const q = input.qualifiers ?? {};
    if (q.cisTrans === 'unspecified' && q.dieneMicrostructure === 'varies' && q.vulcanization === 'not-represented') lines.push('ジエンのcis/trans・微細構造は未指定または多様。加硫・架橋状態は図示していません。');
    else if (q.cisTrans === 'unspecified' && q.vulcanization === 'not-represented') lines.push('cis/trans は未指定。加硫・架橋状態は図示していません。');
    else if (q.cisTrans === 'unspecified') lines.push('cis/trans は未指定です。');
    else if (q.vulcanization === 'not-represented') lines.push('加硫・架橋状態は図示していません。');
    else if (q.regiochemistry === 'varies') lines.push('結合の向きや配向規則を特定しません。');
    return lines.slice(0, 3);
  }
  const lines = ['反復単位 · n は同じ単位の繰り返しを示す'];
  if (input.polymerId === 'polystyrene') lines.push('フェニル環は主鎖に結合した側鎖');
  if ((input.componentGroups?.length ?? 0) > 1) for (const group of input.componentGroups.slice(0, 2)) lines.push(labelJa[group.label] ?? group.label);
  if (input.qualifiers?.cisTrans === 'unspecified' && input.qualifiers?.vulcanization === 'not-represented') lines.push('cis/trans・ジエン微細構造は未指定または多様。加硫・架橋状態は図示していません');
  else if (input.qualifiers?.cisTrans === 'unspecified' || input.qualifiers?.dieneMicrostructure === 'varies') lines.push('cis/trans・ジエン微細構造は未指定または多様');
  else if (input.qualifiers?.stereochemistry?.status === 'unspecified') lines.push('立体化学は未指定');
  else if (input.qualifiers?.tacticity === 'not-asserted') lines.push('立体配置を特定しない');
  if (input.qualifiers?.regiochemistry === 'varies') lines.push('主鎖の配向規則を特定しない');
  if (input.qualifiers?.vulcanization === 'not-represented') lines.push('加硫・架橋状態は図示していません');
  return [...new Set(lines)].slice(0, 3);
}

function renderAnnotations(input) {
  return annotationLines(input).map((text, index) => {
    const primary = index === 0, y = 448 + index * 30, fontSize = primary ? 26 : 20, color = primary ? COLORS.chipText : COLORS.muted;
    return `<text class="annotation${primary ? ' primary' : ''}" x="480" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" font-weight="${primary ? 700 : 500}" fill="${color}">${escapeXml(text)}</text>`;
  }).join('');
}

function provenanceMetadata(input, layout) {
  const payload = {
    renderer: POLYMER_STRUCTURE_SVG_VERSION, polymerId: input.polymerId, routeId: input.routeId,
    representationType: input.representationType, sourceCommit: input.validation.sourceCommit,
    provenance: input.provenance, layoutCoordinates: 'deterministic 2D drawing positions; not molecular coordinates',
    hydrogenConvention: 'carbon-bound H omitted; O-H and N-H represented in OH/NH labels; every authority atom retained in this mapping',
    atoms: layout.atomMetadata.map(atom => ({ id: atom.id, element: atom.element, role: atom.role, display: atom.display, source: atom.source, point: layout.atomPositions[atom.id] })),
    bonds: layout.bondMetadata, backboneAtomRefs: input.backboneAtomRefs, junctionAtomRefs: input.junctionAtomRefs,
    repeatGroups: input.repeatGroups, componentGroups: input.componentGroups, sideChains: input.sideChains,
    layoutHints: layout.layoutHints,
    functionalGroups: input.functionalGroups, continuationPorts: input.continuationPorts, repeatClosure: input.repeatClosure,
    localSequence: input.localSequence, qualifiers: input.qualifiers, caveats: input.caveats
  };
  return escapeXml(JSON.stringify(payload));
}

export function renderPolymerStructureSvg(input, { polymerName, layout = createPolymerStructureLayout(input) } = {}) {
  assertValidatedDrawingInput(input);
  if (layout?.polymerId !== input.polymerId || layout?.rendererVersion !== POLYMER_STRUCTURE_SVG_VERSION) fail(input, 'LAYOUT_MISMATCH', 'The layout does not belong to this input and renderer version.');
  for (const atom of input.atoms) {
    const point = layout.atomPositions?.[atom.id], internal = layout._positions?.get(atom.id);
    if (!point || !internal || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 960 || point.y < 0 || point.y > 540 || internal.x < 0 || internal.x > 960 || internal.y < 0 || internal.y > 540) fail(input, 'DRAWING_BOUNDS', `Atom ${atom.id} is missing a safe in-bounds drawing position.`);
  }
  if (layout.atomMetadata?.length !== input.atoms.length || layout.bondMetadata?.length !== input.bonds.length) fail(input, 'DRAWING_MAPPING', 'The layout must retain every authority atom and bond mapping.');
  try {
    const name = polymerName ?? input.polymerId;
    const title = `${name} — 代表構造`;
    const description = input.representationType === 'network-junction'
      ? `${name}の独立した構造資料に基づく代表的な局所網目構造。樹脂全体や硬化状態を一意に表す図ではありません。`
      : input.representationType === 'copolymer-local-motif'
        ? `${name}の代表的な局所配列例。全体の配列や組成比を表すものではありません。`
        : `${name}の検証済み反復単位。表示位置は2D描画用で、分子座標ではありません。`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-labelledby="polymer-title polymer-description" data-polymer-id="${escapeXml(input.polymerId)}" data-generator-version="${POLYMER_STRUCTURE_SVG_VERSION}" data-structure-source-commit="${escapeXml(input.validation.sourceCommit)}" data-representation-type="${escapeXml(input.representationType)}" data-atom-count="${input.atoms.length}" data-bond-count="${input.bonds.length}">
<title id="polymer-title">${escapeXml(title)}</title><desc id="polymer-description">${escapeXml(description)}</desc>
<metadata id="polymer-structure-authority">${provenanceMetadata(input, layout)}</metadata>
<rect width="960" height="540" rx="20" fill="${COLORS.paper}"/><rect x="1" y="1" width="958" height="538" rx="19" fill="none" stroke="${COLORS.paperEdge}" stroke-width="2"/>
<text class="figure-title" x="32" y="39" font-family="sans-serif" font-size="26" font-weight="750" fill="${COLORS.ink}">${escapeXml(name)}</text>
<text class="figure-kicker" x="34" y="65" font-family="sans-serif" font-size="17" fill="${COLORS.muted}">${input.representationType === 'network-junction' ? '局所架橋モチーフ · 2D模式図' : input.representationType === 'copolymer-local-motif' ? '局所配列例 · 2D模式図' : '反復単位 · 2D模式図'}</text>
${renderBracket(input, layout)}
<g class="chemical-bonds" fill="none" stroke="${COLORS.ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${renderBonds(input, layout)}</g>
<g class="aromatic-rings" data-aromatic-cycle-count="${layout.rings.length}">${layout.rings.map(ring => `<g class="aromatic-ring" data-ring-id="ring-${escapeXml(ring.atomRefs.join('-'))}" data-aromatic-atom-refs="${escapeXml(ring.atomRefs.join(' '))}" aria-label="alternating single and double bonds"/>`).join('')}</g>
<g class="continuations">${renderPorts(input, layout)}</g><g class="atom-labels">${renderAtoms(input, layout)}</g>
${renderAnnotations(input)}
</svg>
`;
    validatePolymerStructureSvg(svg, input);
    return svg;
  } catch (error) {
    fail(input, 'SVG_RENDER_FAILED', error instanceof Error ? error.message : String(error));
  }
}

export function validatePolymerStructureSvg(svg, input) {
  assertValidatedDrawingInput(input);
  const reject = message => fail(input, 'SVG_VALIDATION', message);
  if (typeof svg !== 'string' || !svg.startsWith('<svg ') || !svg.includes('</svg>')) reject('Output is not a standalone SVG document.');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(svg)) reject('SVG contains XML 1.0 forbidden control characters.');
  if (!svg.includes('viewBox="0 0 960 540"')) reject('The stable 960×540 viewBox is missing.');
  if (!svg.includes('<title') || !svg.includes('<desc') || !svg.includes('aria-labelledby=')) reject('Accessible title and description are required.');
  if (!svg.includes(`data-polymer-id="${input.polymerId}"`) || !svg.includes(`data-generator-version="${POLYMER_STRUCTURE_SVG_VERSION}"`)) reject('Polymer identity or generator version metadata is missing.');
  if (/(?:href|xlink:href)\s*=|url\s*\(|<image\b|<foreignObject\b|<script\b/i.test(svg)) reject('External or embedded SVG dependencies are not allowed.');
  if ((svg.match(/class="continuation-label"/g) ?? []).length !== (input.continuationPorts ?? []).length) reject('A visible continuation label is required for every authority port.');
  const atomRefs = [...svg.matchAll(/class="atom-map(?:\s[^\"]*)?" data-atom-ref="([^\"]+)"/g)].map(match => match[1]).sort();
  const expected = input.atoms.filter(atom => atom.element !== 'H').map(atom => atom.id).sort();
  if (atomRefs.length !== expected.length || atomRefs.some((id, index) => id !== expected[index])) reject('Visible heavy-atom mapping differs from the validated graph.');
  const expectedH = input.atoms.filter(atom => atom.element === 'H').map(atom => atom.id).sort();
  if (expectedH.some(id => !svg.includes(`&quot;id&quot;:&quot;${escapeXml(id)}&quot;,&quot;element&quot;:&quot;H&quot;`))) reject('Explicit hydrogens are not preserved in authority metadata.');
  const bonds = [...svg.matchAll(/<g class="bond" data-bond-ref="([^"]+)"[^>]*data-bond-order="([123])">([\s\S]*?)<\/g>/g)].map(match => ({ ref: match[1], order: Number(match[2]), paths: [...match[3].matchAll(/<path\b/g)].length }));
  if (bonds.length !== input.bonds.length || input.bonds.some(bond => bonds.filter(rendered => rendered.ref === bondRef(bond) && rendered.order === bond.order && rendered.paths === bond.order).length !== 1)) reject('Bond identity, order, or visible bond-line count differs from the validated graph.');
  const annotations = [...svg.matchAll(/<text class="annotation(?: primary)?"[^>]*>([\s\S]*?)<\/text>/g)].map(match => match[1]);
  const annotationText = annotations.join(' ');
  if (input.representationType === 'linear-repeat') {
    if (!svg.includes('class="repeat-bracket"') || !svg.includes('data-repeat-count-notation="true"')) reject('A linear repeat requires its bracket and n notation.');
    for (const port of input.continuationPorts) if (!svg.includes(`data-port-id="${port.id}"`) || !svg.includes(`data-port-label-for="${port.id}"`)) reject(`Continuation port ${port.id} or its visible label is missing.`);
  } else if (svg.includes('data-repeat-count-notation="true"')) reject('A copolymer or network cannot claim a fixed repeat count.');
  if (input.representationType === 'copolymer-local-motif') {
    if (!annotationText.includes('局所配列例') || !annotationText.includes('組成比や配列規則を示しません')) reject('The local-sequence and non-asserted composition caveat is required.');
    if (/\b\d{1,3}\s*:\s*\d{1,3}\b|組成比.{0,24}\d/.test(annotationText)) reject('A local copolymer example cannot claim a bulk composition ratio.');
  }
  if (input.qualifiers?.cisTrans === 'unspecified' && !annotationText.includes('cis/trans')) reject('The authority-required cis/trans caveat is missing.');
  if (input.qualifiers?.cisTrans !== 'unspecified' && annotationText.includes('cis/trans')) reject('A cis/trans caveat cannot be shown when the authority does not mark it unspecified.');
  if (input.qualifiers?.regiochemistry === 'varies' && !/配向規則.{0,6}特定/.test(annotationText)) reject('The authority-required regiochemistry caveat is missing.');
  if (input.qualifiers?.vulcanization === 'not-represented' && !annotationText.includes('加硫・架橋状態は図示していません')) reject('The authority-required vulcanization caveat is missing.');
  if (input.representationType === 'network-junction') {
    if ((svg.match(/class="continuation-port"/g) ?? []).length !== 3) reject('The approved network motif requires three continuation ports.');
    for (const port of input.continuationPorts) if (!svg.includes(`data-port-id="${port.id}"`) || !svg.includes(`data-port-label-for="${port.id}"`)) reject(`Network port ${port.id} or its visible label is missing.`);
    if (!svg.includes('実際の樹脂全体の構造や硬化状態を一意に示すものではありません。') || !svg.includes('PolymerSampleと同一の構造ではありません')) reject('Phenol-formaldehyde caveats are required.');
    if ((svg.match(/class="aromatic-ring"/g) ?? []).length !== 4) reject('The independent motif requires its core ring and three phenol-arm rings.');
  }
  return { ok: true, polymerId: input.polymerId, atoms: input.atoms.length, bonds: input.bonds.length, visibleBondLines: input.bonds.reduce((sum, bond) => sum + bond.order, 0) };
}

export async function generatePolymerStructureAssets({ root, polymerIds = POLYMER_2D_PRODUCTION_IDS, outputDirectory = 'assets/models' } = {}) {
  const projectRoot = resolve(root ?? new URL('..', import.meta.url).pathname);
  const { authority, sources } = await readPolymerFragmentSources(projectRoot);
  const checked = validatePolymerFragmentAuthority(authority, sources);
  if (!checked.ok || checked.count !== 25) {
    const diagnostic = checked.diagnostics[0];
    throw new Error(`polymer-fragment-authority: ${diagnostic?.polymerId ?? 'authority'}: ${diagnostic?.code ?? 'COUNT'}: ${diagnostic?.message ?? `expected 25 valid records, found ${checked.count}`}`);
  }
  const ids = [...new Set(polymerIds)];
  if (ids.length !== polymerIds.length) throw new Error('Duplicate polymer ID in the requested asset set.');
  for (const id of ids) {
    try {
      if (!productionSet.has(id)) throw new Error('Requested polymer is not in the validated 25-polymer production asset set.');
      const input = createPolymerDrawingInput(authority, id, sources);
      if (input.validation?.status !== 'passed') throw new Error('Task⑥ drawing input did not pass validation.');
      const record = sources.polymers.find(polymer => polymer.id === id);
      const svg = renderPolymerStructureSvg(input, { polymerName: record?.nameJa });
      await mkdir(resolve(projectRoot, outputDirectory), { recursive: true });
      await writeFile(resolve(projectRoot, outputDirectory, `polymer-${id}.svg`), svg, 'utf8');
    } catch (error) {
      throw new Error(`${id}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
  return { authorityCount: checked.count, generated: ids, generatorVersion: POLYMER_STRUCTURE_SVG_VERSION };
}

export function isPolymer2DPilot(polymerId) { return pilotSet.has(polymerId); }

export function isPolymer2DProduction(polymerId) { return productionSet.has(polymerId); }
