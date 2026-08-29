export const ELEMENTS = {
  H:  { name: '水素',   color: '#f8fafc', radius: 0.32, valences: [1] },
  C:  { name: '炭素',   color: '#64748b', radius: 0.46, valences: [4] },
  N:  { name: '窒素',   color: '#3b82f6', radius: 0.44, valences: [3] },
  O:  { name: '酸素',   color: '#ef4444', radius: 0.42, valences: [2] },
  F:  { name: 'フッ素', color: '#22c55e', radius: 0.40, valences: [1] },
  P:  { name: 'リン',   color: '#f97316', radius: 0.49, valences: [3, 5] },
  S:  { name: '硫黄',   color: '#eab308', radius: 0.50, valences: [2, 4, 6] },
  Cl: { name: '塩素',   color: '#16a34a', radius: 0.48, valences: [1] },
};

export const UNKNOWN_NAME = '未知 / 未登録の構造';
let nextAtomId = 1;
let knownMolecules = [];
let knownFingerprints = new Map();
let databaseState = { loaded: false, count: 0, error: null };

export class Molecule {
  constructor() {
    this.atoms = [];
    this.bonds = [];
  }

  addAtom(element) {
    if (!ELEMENTS[element]) throw new Error(`Unknown element: ${element}`);
    const atom = { id: nextAtomId++, element };
    this.atoms.push(atom);
    return atom;
  }

  removeAtom(id) {
    this.atoms = this.atoms.filter(atom => atom.id !== id);
    this.bonds = this.bonds.filter(bond => bond.a !== id && bond.b !== id);
  }

  clear() {
    this.atoms = [];
    this.bonds = [];
  }

  setBond(a, b, order) {
    if (a === b || ![1, 2, 3].includes(order)) return;
    const existing = this.bonds.find(bond => samePair(bond, a, b));
    if (existing) existing.order = order;
    else this.bonds.push({ a, b, order });
  }

  removeBond(a, b) {
    this.bonds = this.bonds.filter(bond => !samePair(bond, a, b));
  }

  bondOrderForAtom(id) {
    return this.bonds.reduce((sum, bond) => sum + ((bond.a === id || bond.b === id) ? bond.order : 0), 0);
  }

  neighbors(id) {
    return this.bonds
      .filter(bond => bond.a === id || bond.b === id)
      .map(bond => ({ atomId: bond.a === id ? bond.b : bond.a, order: bond.order }));
  }

  formula() {
    if (!this.atoms.length) return '—';
    const counts = countElements(this.atoms);
    return hillOrder(Object.keys(counts)).map(symbol => `${symbol}${counts[symbol] > 1 ? counts[symbol] : ''}`).join('');
  }

  validation() {
    if (!this.atoms.length) return { level: 'ok', message: '原子を追加してください' };
    for (const atom of this.atoms) {
      const used = this.bondOrderForAtom(atom.id);
      const max = Math.max(...ELEMENTS[atom.element].valences);
      if (used > max && !isCarbonMonoxideException(this, used)) {
        return { level: 'error', message: `${atom.element} の結合価 ${used} は、このモデルで扱う上限 ${max} を超えています。` };
      }
    }
    const openAtoms = this.atoms.filter(atom => {
      const used = this.bondOrderForAtom(atom.id);
      return !ELEMENTS[atom.element].valences.includes(used) && !isCarbonMonoxideException(this, used);
    });
    if (openAtoms.length) return { level: 'warn', message: `未充足の原子が ${openAtoms.length} 個あります。制作途中として保持できます。` };
    return { level: 'ok', message: '典型原子価の範囲で結合が満たされています。' };
  }

  recognizedMolecule() {
    if (!this.atoms.length || !databaseState.loaded) return null;
    const fingerprint = moleculeFingerprint(this.atoms, this.bonds);
    const candidates = knownFingerprints.get(fingerprint) ?? [];
    return candidates.find(candidate => graphsAreIsomorphic(this.atoms, this.bonds, candidate.atoms, candidate.bonds)) ?? null;
  }

  recognizedName() {
    if (!this.atoms.length) return '自由制作';
    return this.recognizedMolecule()?.nameJa ?? UNKNOWN_NAME;
  }
}

export async function loadMoleculeDatabase(url = new URL('../data/molecules.json', import.meta.url)) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    setMoleculeDatabase(await response.json());
    return { ok: true, count: databaseState.count };
  } catch (error) {
    knownMolecules = [];
    knownFingerprints = new Map();
    databaseState = { loaded: false, count: 0, error: String(error?.message ?? error) };
    console.warn('Molecule database unavailable; name recognition is disabled.', error);
    return { ok: false, count: 0, error: databaseState.error };
  }
}

export function setMoleculeDatabase(records) {
  if (!Array.isArray(records)) throw new Error('Molecule database must be an array.');
  const ids = new Set();
  const validated = records.map(record => validateMoleculeRecord(record, ids));
  const index = new Map();
  for (const record of validated) {
    const fingerprint = moleculeFingerprint(
      record.atoms.map((element, index) => ({ id: index, element })),
      record.bonds.map(([a, b, order]) => ({ a, b, order })),
    );
    if (!index.has(fingerprint)) index.set(fingerprint, []);
    index.get(fingerprint).push(record);
  }
  knownMolecules = validated;
  knownFingerprints = index;
  databaseState = { loaded: true, count: validated.length, error: null };
}

export function moleculeDatabaseStatus() {
  return { ...databaseState };
}

export function countElements(atoms) {
  return atoms.reduce((acc, atom) => {
    const symbol = typeof atom === 'string' ? atom : atom.element;
    acc[symbol] = (acc[symbol] ?? 0) + 1;
    return acc;
  }, {});
}

export function moleculeFingerprint(atoms, bonds) {
  const graph = normalizedGraph(atoms, bonds);
  const ids = graph.atoms.map(atom => atom.id);
  let labels = new Map(graph.atoms.map(atom => [atom.id, atom.element]));
  const rounds = Math.min(16, Math.max(6, graph.atoms.length));
  for (let round = 0; round < rounds; round++) {
    const next = new Map();
    for (const id of ids) {
      const neighbors = graph.adjacency.get(id).map(neighbor => `${neighbor.order}:${labels.get(neighbor.id)}`).sort().join(',');
      next.set(id, hashString(`${graph.byId.get(id).element}[${neighbors}]`));
    }
    labels = next;
  }
  const atomPart = [...labels.values()].sort().join('|');
  const edgePart = graph.bonds.map(bond => {
    const ends = [labels.get(bond.a), labels.get(bond.b)].sort();
    return `${ends[0]}-${bond.order}-${ends[1]}`;
  }).sort().join('|');
  return `${graph.atoms.length};${graph.bonds.length};${atomPart};${edgePart}`;
}

function validateMoleculeRecord(record, ids) {
  if (!record || typeof record !== 'object') throw new Error('Invalid molecule record.');
  for (const key of ['id', 'nameJa', 'nameEn', 'iupacNameEn']) if (typeof record[key] !== 'string' || !record[key]) throw new Error(`Missing ${key}.`);
  if (record.commonNameJa != null && (typeof record.commonNameJa !== 'string' || !record.commonNameJa)) throw new Error(`Invalid commonNameJa in ${record.id}.`);
  if (record.commonNameEn != null && (typeof record.commonNameEn !== 'string' || !record.commonNameEn)) throw new Error(`Invalid commonNameEn in ${record.id}.`);
  if (ids.has(record.id)) throw new Error(`Duplicate molecule id: ${record.id}`);
  ids.add(record.id);
  if (!Array.isArray(record.atoms) || !record.atoms.length || record.atoms.some(element => !ELEMENTS[element])) throw new Error(`Invalid atoms in ${record.id}.`);
  if (!Array.isArray(record.bonds)) throw new Error(`Invalid bonds in ${record.id}.`);
  const pairs = new Set();
  for (const bond of record.bonds) {
    if (!Array.isArray(bond) || bond.length !== 3) throw new Error(`Invalid bond in ${record.id}.`);
    const [a, b, order] = bond;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= record.atoms.length || b >= record.atoms.length || a === b || ![1, 2, 3].includes(order)) throw new Error(`Invalid bond in ${record.id}.`);
    const key = pairKey(a, b);
    if (pairs.has(key)) throw new Error(`Duplicate bond in ${record.id}.`);
    pairs.add(key);
  }
  return Object.freeze({ ...record, atoms: Object.freeze([...record.atoms]), bonds: Object.freeze(record.bonds.map(bond => Object.freeze([...bond]))) });
}

function normalizedGraph(atoms, bonds) {
  const normalizedAtoms = atoms.map((atom, index) => ({ id: atom.id ?? index, element: atom.element ?? atom }));
  const normalizedBonds = bonds.map(bond => Array.isArray(bond)
    ? { a: normalizedAtoms[bond[0]].id, b: normalizedAtoms[bond[1]].id, order: bond[2] }
    : { a: bond.a, b: bond.b, order: bond.order });
  const byId = new Map(normalizedAtoms.map(atom => [atom.id, atom]));
  const adjacency = adjacencyFor(normalizedAtoms, normalizedBonds);
  const aromaticEdges = aromaticCarbonEdges(normalizedAtoms, normalizedBonds, adjacency, byId);
  const aromaticBonds = normalizedBonds.map(bond => ({ ...bond, order: aromaticEdges.has(pairKey(bond.a, bond.b)) ? 'a' : bond.order }));
  return { atoms: normalizedAtoms, bonds: aromaticBonds, byId, adjacency: adjacencyFor(normalizedAtoms, aromaticBonds) };
}

function adjacencyFor(atoms, bonds) {
  const adjacency = new Map(atoms.map(atom => [atom.id, []]));
  for (const bond of bonds) {
    adjacency.get(bond.a)?.push({ id: bond.b, order: bond.order });
    adjacency.get(bond.b)?.push({ id: bond.a, order: bond.order });
  }
  return adjacency;
}

function aromaticCarbonEdges(atoms, bonds, adjacency, byId) {
  const result = new Set();
  const found = new Set();
  const bondOrder = new Map(bonds.map(bond => [pairKey(bond.a, bond.b), bond.order]));
  for (const start of atoms.map(atom => atom.id)) {
    const walk = (current, path, visited) => {
      if (path.length > 6) return;
      for (const next of adjacency.get(current) ?? []) {
        if (next.id === start && path.length === 6) {
          const key = canonicalCycleKey(path);
          if (found.has(key) || !path.every(id => byId.get(id)?.element === 'C')) continue;
          found.add(key);
          const orders = path.map((id, index) => bondOrder.get(pairKey(id, path[(index + 1) % 6])));
          if (orders.every(order => order === 1 || order === 2) && orders.every((order, index) => order !== orders[(index + 1) % 6])) {
            path.forEach((id, index) => result.add(pairKey(id, path[(index + 1) % 6])));
          }
          continue;
        }
        if (visited.has(next.id) || path.length >= 6) continue;
        visited.add(next.id);
        path.push(next.id);
        walk(next.id, path, visited);
        path.pop();
        visited.delete(next.id);
      }
    };
    walk(start, [start], new Set([start]));
  }
  return result;
}

function graphsAreIsomorphic(actualAtoms, actualBonds, templateAtoms, templateBonds) {
  if (actualAtoms.length !== templateAtoms.length || actualBonds.length !== templateBonds.length) return false;
  const left = normalizedGraph(actualAtoms, actualBonds);
  const right = normalizedGraph(
    templateAtoms.map((element, index) => ({ id: index, element })),
    templateBonds.map(([a, b, order]) => ({ a, b, order })),
  );
  const descriptor = (graph, id) => {
    const atom = graph.byId.get(id);
    const edges = graph.adjacency.get(id).map(neighbor => `${neighbor.order}`).sort().join(',');
    return `${atom.element}|${graph.adjacency.get(id).length}|${edges}`;
  };
  const rightByDescriptor = new Map();
  for (const atom of right.atoms) {
    const key = descriptor(right, atom.id);
    if (!rightByDescriptor.has(key)) rightByDescriptor.set(key, []);
    rightByDescriptor.get(key).push(atom.id);
  }
  const candidates = new Map();
  for (const atom of left.atoms) {
    const matches = rightByDescriptor.get(descriptor(left, atom.id)) ?? [];
    if (!matches.length) return false;
    candidates.set(atom.id, matches);
  }
  const order = [...left.atoms].sort((a, b) => candidates.get(a.id).length - candidates.get(b.id).length || left.adjacency.get(b.id).length - left.adjacency.get(a.id).length);
  const mapping = new Map();
  const used = new Set();
  const edge = (graph, a, b) => graph.adjacency.get(a).find(neighbor => neighbor.id === b)?.order ?? null;
  const search = index => {
    if (index === order.length) return true;
    const leftId = order[index].id;
    for (const rightId of candidates.get(leftId)) {
      if (used.has(rightId)) continue;
      let compatible = true;
      for (const [mappedLeft, mappedRight] of mapping) {
        if (edge(left, leftId, mappedLeft) !== edge(right, rightId, mappedRight)) { compatible = false; break; }
      }
      if (!compatible) continue;
      mapping.set(leftId, rightId);
      used.add(rightId);
      if (search(index + 1)) return true;
      mapping.delete(leftId);
      used.delete(rightId);
    }
    return false;
  };
  return search(0);
}

function isCarbonMonoxideException(molecule, used) {
  return used === 3 && molecule.atoms.length === 2 && molecule.bonds.length === 1 && molecule.bonds[0].order === 3
    && molecule.atoms.map(atom => atom.element).sort().join('-') === 'C-O';
}

function hillOrder(symbols) {
  if (symbols.includes('C')) return ['C', ...(symbols.includes('H') ? ['H'] : []), ...symbols.filter(symbol => symbol !== 'C' && symbol !== 'H').sort()];
  return [...symbols].sort();
}

function samePair(bond, a, b) {
  return (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a);
}

function pairKey(a, b) {
  return String(a) < String(b) ? `${a}:${b}` : `${b}:${a}`;
}

function canonicalCycleKey(cycle) {
  const variants = [];
  for (const sequence of [cycle, [...cycle].reverse()]) {
    for (let index = 0; index < sequence.length; index++) variants.push([...sequence.slice(index), ...sequence.slice(0, index)].join('-'));
  }
  return variants.sort()[0];
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
