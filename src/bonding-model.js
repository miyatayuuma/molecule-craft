export const ATOMIC_MODEL = {
  H:  { valenceElectrons: 1, shell: 2,  preferredValences: [1],    electronegativity: 2.20, covalentRadius: 0.31 },
  C:  { valenceElectrons: 4, shell: 8,  preferredValences: [4],    electronegativity: 2.55, covalentRadius: 0.76 },
  N:  { valenceElectrons: 5, shell: 8,  preferredValences: [3],    electronegativity: 3.04, covalentRadius: 0.71 },
  O:  { valenceElectrons: 6, shell: 8,  preferredValences: [2],    electronegativity: 3.44, covalentRadius: 0.66 },
  F:  { valenceElectrons: 7, shell: 8,  preferredValences: [1],    electronegativity: 3.98, covalentRadius: 0.57 },
  P:  { valenceElectrons: 5, shell: 8,  preferredValences: [3, 5], electronegativity: 2.19, covalentRadius: 1.07 },
  S:  { valenceElectrons: 6, shell: 8,  preferredValences: [2,4,6],electronegativity: 2.58, covalentRadius: 1.05 },
  Cl: { valenceElectrons: 7, shell: 8,  preferredValences: [1],    electronegativity: 3.16, covalentRadius: 1.02 },
};

export function preferredValence(element, currentBondOrder = 0) {
  const values = ATOMIC_MODEL[element]?.preferredValences ?? [1];
  return values.reduce((best, v) => {
    const penalty = v < currentBondOrder ? 100 + currentBondOrder - v : v - currentBondOrder;
    const bestPenalty = best < currentBondOrder ? 100 + currentBondOrder - best : best - currentBondOrder;
    return penalty < bestPenalty ? v : best;
  }, values[0]);
}

export function lonePairCount(element, bondOrderSum) {
  const model = ATOMIC_MODEL[element];
  if (!model) return 0;
  if (element === 'H') return 0;
  return Math.max(0, Math.floor((model.shell - 2 * bondOrderSum) / 2));
}

export function unpairedElectronCount(element, bondOrderSum) {
  return Math.max(0, preferredValence(element, bondOrderSum) - bondOrderSum);
}

export function electronDomainCount(element, bondOrderSum, neighborCount) {
  return neighborCount + lonePairCount(element, bondOrderSum);
}

export function idealBondAngleDeg(element, bondOrderSum, neighborCount) {
  const domains = electronDomainCount(element, bondOrderSum, neighborCount);
  const lonePairs = lonePairCount(element, bondOrderSum);
  if (neighborCount <= 1) return 180;
  if (domains <= 2) return 180;
  if (domains === 3) return lonePairs > 0 ? 117 : 120;
  if (domains === 4) {
    if (neighborCount === 2 && lonePairs >= 2) return 104.5;
    if (neighborCount === 3 && lonePairs >= 1) return 107.0;
    return 109.47;
  }
  if (domains === 5) return neighborCount === 2 ? 180 : 120;
  if (domains >= 6) return 90;
  return 109.47;
}

export function valenceShellRadius(element, visualRadius = 0.45) {
  const covalent = ATOMIC_MODEL[element]?.covalentRadius ?? 0.75;
  return visualRadius + 0.28 + Math.min(0.16, covalent * 0.08);
}

export function optimizeBondOrders(molecule, atomIds = null) {
  const scope = atomIds ? new Set(atomIds) : new Set(molecule.atoms.map(a => a.id));
  const bonds = molecule.bonds.filter(b => scope.has(b.a) && scope.has(b.b));
  if (!bonds.length) return false;
  let changed = false;
  for (let pass = 0; pass < 12; pass++) {
    let bestMove = null;
    let bestDelta = -1e-9;
    const baseline = structurePenalty(molecule, scope);
    for (const bond of bonds) {
      for (const delta of [-1, 1]) {
        const next = bond.order + delta;
        if (next < 1 || next > 3) continue;
        const old = bond.order;
        bond.order = next;
        const score = structurePenalty(molecule, scope);
        bond.order = old;
        const improvement = baseline - score;
        if (improvement > bestDelta) {
          bestDelta = improvement;
          bestMove = { bond, next };
        }
      }
    }
    if (!bestMove || bestDelta <= 1e-6) break;
    bestMove.bond.order = bestMove.next;
    changed = true;
  }
  return changed;
}

export function structurePenalty(molecule, atomIds = null) {
  const scope = atomIds ?? new Set(molecule.atoms.map(a => a.id));
  let penalty = 0;
  for (const atom of molecule.atoms) {
    if (!scope.has(atom.id)) continue;
    const used = molecule.bondOrderForAtom(atom.id);
    const allowed = ATOMIC_MODEL[atom.element]?.preferredValences ?? [1];
    const deficit = Math.min(...allowed.map(v => Math.abs(v - used)));
    const excess = Math.max(0, used - Math.max(...allowed));
    penalty += deficit * deficit * 6 + excess * excess * 40;
    if (used === 0 && molecule.atoms.length > 1) penalty += 0.6;
  }
  for (const bond of molecule.bonds) {
    if (!scope.has(bond.a) || !scope.has(bond.b)) continue;
    penalty += Math.max(0, bond.order - 1) * 0.12;
  }
  return penalty;
}

export function bondEnergyKJ(elementA, elementB, order) {
  const key = [elementA, elementB].sort().join('-');
  const known = {
    'H-H': [0, 436],
    'C-H': [0, 413],
    'C-C': [0, 348, 614, 839],
    'C-N': [0, 293, 615, 891],
    'C-O': [0, 358, 799, 1072],
    'N-N': [0, 163, 418, 945],
    'N-H': [0, 391],
    'N-O': [0, 201, 607],
    'O-H': [0, 463],
    'O-O': [0, 146, 498],
    'F-F': [0, 159],
    'Cl-Cl': [0, 243],
    'C-F': [0, 485],
    'C-Cl': [0, 327],
  };
  const values = known[key];
  if (values?.[order]) return values[order];
  const a = ATOMIC_MODEL[elementA], b = ATOMIC_MODEL[elementB];
  const polarity = a && b ? Math.abs(a.electronegativity - b.electronegativity) : 0;
  const single = 300 + Math.min(150, polarity * 45);
  return single * (order === 1 ? 1 : order === 2 ? 1.72 : 2.35);
}

export function tapsToWeakenBond(elementA, elementB, order) {
  const energy = bondEnergyKJ(elementA, elementB, order);
  return Math.max(2, Math.min(7, Math.round(energy / 165)));
}

export function bondLengthScale(order) {
  return order === 2 ? 0.90 : order === 3 ? 0.84 : 1;
}
