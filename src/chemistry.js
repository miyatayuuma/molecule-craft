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

const KNOWN_MOLECULES = [
  { name: '水素', atoms: ['H','H'], bonds: [[0,1,1]] },
  { name: '酸素', atoms: ['O','O'], bonds: [[0,1,2]] },
  { name: '窒素', atoms: ['N','N'], bonds: [[0,1,3]] },
  { name: '水', atoms: ['O','H','H'], bonds: [[0,1,1],[0,2,1]] },
  { name: '二酸化炭素', atoms: ['C','O','O'], bonds: [[0,1,2],[0,2,2]] },
  { name: 'メタン', atoms: ['C','H','H','H','H'], bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1]] },
  { name: 'アンモニア', atoms: ['N','H','H','H'], bonds: [[0,1,1],[0,2,1],[0,3,1]] },
  { name: 'エタン', atoms: ['C','C','H','H','H','H','H','H'], bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1],[1,5,1],[1,6,1],[1,7,1]] },
  { name: 'エチレン', atoms: ['C','C','H','H','H','H'], bonds: [[0,1,2],[0,2,1],[0,3,1],[1,4,1],[1,5,1]] },
  { name: 'アセチレン', atoms: ['C','C','H','H'], bonds: [[0,1,3],[0,2,1],[1,3,1]] },
  { name: 'メタノール', atoms: ['C','O','H','H','H','H'], bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1],[1,5,1]] },
  { name: 'エタノール', atoms: ['C','C','O','H','H','H','H','H','H'], bonds: [[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1],[1,6,1],[1,7,1],[2,8,1]] },
  { name: 'ジメチルエーテル', atoms: ['C','O','C','H','H','H','H','H','H'], bonds: [[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1],[2,6,1],[2,7,1],[2,8,1]] },
  { name: 'ホルムアルデヒド', atoms: ['C','O','H','H'], bonds: [[0,1,2],[0,2,1],[0,3,1]] },
  { name: 'アセトン', atoms: ['C','C','O','C','H','H','H','H','H','H'], bonds: [[0,1,1],[1,2,2],[1,3,1],[0,4,1],[0,5,1],[0,6,1],[3,7,1],[3,8,1],[3,9,1]] },
];

let nextAtomId = 1;

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
    if (a === b) return;
    const existing = this.bonds.find(bond => samePair(bond, a, b));
    if (existing) {
      existing.order = order;
    } else {
      this.bonds.push({ a, b, order });
    }
  }

  removeBond(a, b) {
    this.bonds = this.bonds.filter(bond => !samePair(bond, a, b));
  }

  bondOrderForAtom(id) {
    return this.bonds.reduce((sum, bond) => {
      return sum + ((bond.a === id || bond.b === id) ? bond.order : 0);
    }, 0);
  }

  neighbors(id) {
    return this.bonds
      .filter(bond => bond.a === id || bond.b === id)
      .map(bond => ({
        atomId: bond.a === id ? bond.b : bond.a,
        order: bond.order,
      }));
  }

  formula() {
    if (!this.atoms.length) return '—';
    const counts = countElements(this.atoms);
    const order = hillOrder(Object.keys(counts));
    return order.map(symbol => `${symbol}${counts[symbol] > 1 ? counts[symbol] : ''}`).join('');
  }

  validation() {
    if (!this.atoms.length) return { level: 'ok', message: '原子を追加してください' };

    for (const atom of this.atoms) {
      const used = this.bondOrderForAtom(atom.id);
      const allowed = ELEMENTS[atom.element].valences;
      const max = Math.max(...allowed);
      if (used > max) {
        return {
          level: 'error',
          message: `${atom.element} の結合価 ${used} は、このMVPで扱う上限 ${max} を超えています。`,
        };
      }
    }

    const openAtoms = this.atoms.filter(atom => {
      const used = this.bondOrderForAtom(atom.id);
      const allowed = ELEMENTS[atom.element].valences;
      return !allowed.includes(used);
    });

    if (openAtoms.length) {
      return {
        level: 'warn',
        message: `未充足の原子が ${openAtoms.length} 個あります。制作途中として保持できます。`,
      };
    }

    return { level: 'ok', message: '典型原子価の範囲で結合が満たされています。' };
  }

  recognizedName() {
    if (!this.atoms.length) return '自由制作';
    const fp = fingerprint(this.atoms, this.bonds);
    const match = KNOWN_FINGERPRINTS.get(fp);
    return match ?? '未知 / 未登録の構造';
  }
}

export function countElements(atoms) {
  return atoms.reduce((acc, atom) => {
    acc[atom.element] = (acc[atom.element] ?? 0) + 1;
    return acc;
  }, {});
}

function hillOrder(symbols) {
  if (symbols.includes('C')) {
    return ['C', ...(symbols.includes('H') ? ['H'] : []), ...symbols.filter(s => s !== 'C' && s !== 'H').sort()];
  }
  return [...symbols].sort();
}

function samePair(bond, a, b) {
  return (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a);
}

function fingerprint(atoms, bonds) {
  const ids = atoms.map(atom => atom.id);
  const byId = new Map(atoms.map(atom => [atom.id, atom]));
  const adjacency = new Map(ids.map(id => [id, []]));
  bonds.forEach(bond => {
    adjacency.get(bond.a)?.push({ id: bond.b, order: bond.order });
    adjacency.get(bond.b)?.push({ id: bond.a, order: bond.order });
  });

  let labels = new Map(atoms.map(atom => [atom.id, atom.element]));
  for (let round = 0; round < 5; round++) {
    const next = new Map();
    for (const id of ids) {
      const neighborLabels = adjacency.get(id)
        .map(n => `${n.order}:${labels.get(n.id)}`)
        .sort()
        .join(',');
      next.set(id, `${byId.get(id).element}[${neighborLabels}]`);
    }
    labels = next;
  }

  const atomPart = [...labels.values()].sort().join('|');
  const edgePart = bonds.map(bond => {
    const left = labels.get(bond.a);
    const right = labels.get(bond.b);
    return [left, right].sort().join(`-${bond.order}-`);
  }).sort().join('|');

  return `${atoms.length};${bonds.length};${atomPart};${edgePart}`;
}

function templateFingerprint(template) {
  const atoms = template.atoms.map((element, index) => ({ id: index + 1, element }));
  const bonds = template.bonds.map(([a, b, order]) => ({ a: a + 1, b: b + 1, order }));
  return fingerprint(atoms, bonds);
}

const KNOWN_FINGERPRINTS = new Map(KNOWN_MOLECULES.map(molecule => [templateFingerprint(molecule), molecule.name]));
