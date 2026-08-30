import { mkdir, writeFile } from 'node:fs/promises';

const molecules = [];
const defaultValence = { C: 4, N: 3, O: 2, F: 1, P: 3, S: 2, Cl: 1 };
const iupacNames = {
  hydrogen: 'Dihydrogen', oxygen: 'Dioxygen', nitrogen: 'Dinitrogen', chlorine: 'Dichlorine', water: 'Oxidane', ammonia: 'Azane', phosphine: 'Phosphane',
  'hydrogen-sulfide': 'Sulfane', 'n-butane': 'Butane', isobutane: '2-Methylpropane', 'n-pentane': 'Pentane', isopentane: '2-Methylbutane', neopentane: '2,2-Dimethylpropane', 'n-hexane': 'Hexane',
  '1-butene': 'But-1-ene', '2-butene': 'But-2-ene', isobutene: '2-Methylprop-1-ene', '1-pentene': 'Pent-1-ene', '2-pentene': 'Pent-2-ene', '1-butyne': 'But-1-yne', '2-butyne': 'But-2-yne',
  toluene: 'Methylbenzene', 'o-xylene': '1,2-Dimethylbenzene', 'm-xylene': '1,3-Dimethylbenzene', 'p-xylene': '1,4-Dimethylbenzene', styrene: 'Ethenylbenzene',
  chloroform: 'Trichloromethane', 'carbon-tetrachloride': 'Tetrachloromethane',
  '1-propanol': 'Propan-1-ol', '2-propanol': 'Propan-2-ol', '1-butanol': 'Butan-1-ol', '2-butanol': 'Butan-2-ol', isobutanol: '2-Methylpropan-1-ol', 'tert-butanol': '2-Methylpropan-2-ol',
  'ethylene-glycol': 'Ethane-1,2-diol', 'propylene-glycol': 'Propane-1,2-diol', glycerol: 'Propane-1,2,3-triol',
  'dimethyl-ether': 'Methoxymethane', 'methyl-ethyl-ether': 'Methoxyethane', 'diethyl-ether': 'Ethoxyethane', tetrahydrofuran: 'Oxolane', 'ethylene-oxide': 'Oxirane',
  formaldehyde: 'Methanal', acetaldehyde: 'Ethanal', propionaldehyde: 'Propanal', butyraldehyde: 'Butanal', isobutyraldehyde: '2-Methylpropanal',
  acetone: 'Propan-2-one', '2-butanone': 'Butan-2-one', '2-pentanone': 'Pentan-2-one', '3-pentanone': 'Pentan-3-one',
  'formic-acid': 'Methanoic acid', 'acetic-acid': 'Ethanoic acid', 'propionic-acid': 'Propanoic acid', 'butyric-acid': 'Butanoic acid', 'isobutyric-acid': '2-Methylpropanoic acid', 'valeric-acid': 'Pentanoic acid', 'oxalic-acid': 'Ethanedioic acid', 'lactic-acid': '2-Hydroxypropanoic acid',
  'methyl-formate': 'Methyl methanoate', 'ethyl-formate': 'Ethyl methanoate', 'methyl-acetate': 'Methyl ethanoate', 'ethyl-acetate': 'Ethyl ethanoate', 'methyl-propionate': 'Methyl propanoate', 'ethyl-propionate': 'Ethyl propanoate',
  methylamine: 'Methanamine', ethylamine: 'Ethanamine', dimethylamine: 'N-Methylmethanamine', trimethylamine: 'N,N-Dimethylmethanamine', aniline: 'Benzenamine', formamide: 'Methanamide', acetamide: 'Ethanamide', propionamide: 'Propanamide', urea: 'Carbamide', acetonitrile: 'Ethanenitrile', acrylonitrile: 'Prop-2-enenitrile',
  anisole: 'Methoxybenzene', acetophenone: '1-Phenylethan-1-one', catechol: 'Benzene-1,2-diol', resorcinol: 'Benzene-1,3-diol', hydroquinone: 'Benzene-1,4-diol', 'salicylic-acid': '2-Hydroxybenzoic acid', acetanilide: 'N-Phenylacetamide',
  'hydrogen-peroxide': 'Hydrogen peroxide', 'hypochlorous-acid': 'Hypochlorous acid', 'carbonic-acid': 'Carbonic acid', 'vinyl-chloride': 'Chloroethene',
  methanethiol: 'Methanethiol', ethanethiol: 'Ethanethiol', 'dimethyl-sulfide': 'Methylsulfanylmethane', 'acrylic-acid': 'Prop-2-enoic acid', acrolein: 'Prop-2-enal',
  'acetic-anhydride': 'Ethanoic anhydride', glycine: '2-Aminoethanoic acid', alanine: '2-Aminopropanoic acid', ethylenediamine: 'Ethane-1,2-diamine', 'terephthalic-acid': 'Benzene-1,4-dicarboxylic acid', aspirin: '2-(Acetyloxy)benzoic acid',
};
const commonNameIds = new Set([
  'hydrogen', 'oxygen', 'nitrogen', 'chlorine', 'water', 'ammonia', 'phosphine', 'hydrogen-sulfide',
  'n-butane', 'isobutane', 'n-pentane', 'isopentane', 'neopentane', 'n-hexane', 'ethene', 'propene', 'isobutene', 'ethyne', 'toluene', 'o-xylene', 'm-xylene', 'p-xylene', 'styrene',
  'chloroform', 'carbon-tetrachloride', 'ethylene-glycol', 'propylene-glycol', 'glycerol', 'dimethyl-ether', 'methyl-ethyl-ether', 'diethyl-ether', 'tetrahydrofuran', 'ethylene-oxide',
  'formaldehyde', 'acetaldehyde', 'propionaldehyde', 'butyraldehyde', 'isobutyraldehyde', 'acetone', 'formic-acid', 'acetic-acid', 'propionic-acid', 'butyric-acid', 'isobutyric-acid', 'valeric-acid', 'oxalic-acid', 'lactic-acid',
  'aniline', 'formamide', 'acetamide', 'propionamide', 'urea', 'acetonitrile', 'acrylonitrile', 'phenol', 'anisole', 'acetophenone', 'catechol', 'resorcinol', 'hydroquinone', 'salicylic-acid', 'acetanilide',
  'vinyl-chloride', 'dimethyl-sulfide', 'acrylic-acid', 'acrolein', 'acetic-anhydride', 'glycine', 'alanine', 'terephthalic-acid', 'aspirin',
]);
const conventionalFormulas = {
  water: 'H2O', 'carbon-dioxide': 'CO2', 'carbon-monoxide': 'CO', ammonia: 'NH3', 'hydrogen-sulfide': 'H2S', 'hydrogen-chloride': 'HCl', 'hydrogen-fluoride': 'HF',
  'sulfur-dioxide': 'SO2', 'sulfur-trioxide': 'SO3', phosphine: 'PH3', 'phosphorus-trichloride': 'PCl3', 'phosphorus-pentachloride': 'PCl5', 'sulfur-hexafluoride': 'SF6', 'carbon-disulfide': 'CS2', 'carbonyl-sulfide': 'COS', 'phosphoric-acid': 'H3PO4', 'sulfuric-acid': 'H2SO4',
  'hydrogen-peroxide': 'H2O2', 'hypochlorous-acid': 'HClO', 'carbonic-acid': 'H2CO3',
};

function formulaFor(atoms) {
  const counts = atoms.reduce((out, atom) => ((out[atom] = (out[atom] ?? 0) + 1), out), {});
  const symbols = counts.C
    ? ['C', ...(counts.H ? ['H'] : []), ...Object.keys(counts).filter(s => s !== 'C' && s !== 'H').sort()]
    : Object.keys(counts).sort();
  return symbols.map(symbol => `${symbol}${counts[symbol] > 1 ? counts[symbol] : ''}`).join('');
}

function add({ id, nameJa, nameEn, aliases = [], category, atoms, bonds, valences = {}, iupacNameEn, learningNote, stereochemistry }) {
  const expandedAtoms = [...atoms];
  const expandedBonds = bonds.map(bond => [...bond]);
  const used = atoms.map(() => 0);
  for (const [a, b, order] of bonds) {
    used[a] += order;
    used[b] += order;
  }
  atoms.forEach((element, index) => {
    if (element === 'H') return;
    const target = valences[index] ?? defaultValence[element] ?? used[index];
    for (let n = Math.max(0, target - used[index]); n > 0; n--) {
      expandedBonds.push([index, expandedAtoms.length, 1]);
      expandedAtoms.push('H');
    }
  });
  molecules.push({ id, nameJa, nameEn, ...(aliases.length ? { aliases } : {}), atoms: expandedAtoms, bonds: expandedBonds, formula: formulaFor(expandedAtoms), category, ...(iupacNameEn?{iupacNameEn,commonNameJa:nameJa,commonNameEn:nameEn}:{}), ...(learningNote?{learningNote}:{}), ...(stereochemistry?{stereochemistry}:{}) });
}

function raw(def) {
  molecules.push({ ...def, formula: def.formula ?? formulaFor(def.atoms) });
}

function chain(count, orderByEdge = {}) {
  return {
    atoms: Array(count).fill('C'),
    bonds: Array.from({ length: count - 1 }, (_, index) => [index, index + 1, orderByEdge[index] ?? 1]),
  };
}

function ring(elements, alternating = false) {
  const atoms = Array.isArray(elements) ? elements : Array(elements).fill('C');
  return {
    atoms,
    bonds: atoms.map((_, index) => [index, (index + 1) % atoms.length, alternating && index % 2 === 0 ? 2 : 1]),
  };
}

function aromatic(substitutions = []) {
  const graph = ring(6, true);
  for (const substitution of substitutions) substitution(graph);
  return graph;
}

function attach(graph, ringIndex, elements, bonds) {
  const offset = graph.atoms.length;
  graph.atoms.push(...elements);
  graph.bonds.push([ringIndex, offset, 1], ...bonds.map(([a, b, order]) => [a + offset, b + offset, order]));
  return offset;
}

function alcoholChain(count, carbonIndex) {
  const graph = chain(count);
  graph.atoms.push('O');
  graph.bonds.push([carbonIndex, count, 1]);
  return graph;
}

function aldehyde(count) {
  const graph = chain(count);
  graph.atoms.push('O');
  graph.bonds.push([count - 1, count, 2]);
  return graph;
}

function ketone(count, carbonIndex) {
  const graph = chain(count);
  graph.atoms.push('O');
  graph.bonds.push([carbonIndex, count, 2]);
  return graph;
}

function acid(count) {
  const graph = chain(count);
  const carbonyl = count - 1;
  graph.atoms.push('O', 'O');
  graph.bonds.push([carbonyl, count, 2], [carbonyl, count + 1, 1]);
  return graph;
}

function ester(acylCarbons, alkylCarbons) {
  const graph = chain(acylCarbons);
  const carbonyl = acylCarbons - 1;
  const carbonylO = graph.atoms.length;
  const bridgeO = carbonylO + 1;
  graph.atoms.push('O', 'O');
  graph.bonds.push([carbonyl, carbonylO, 2], [carbonyl, bridgeO, 1]);
  let previous = bridgeO;
  for (let i = 0; i < alkylCarbons; i++) {
    const next = graph.atoms.length;
    graph.atoms.push('C');
    graph.bonds.push([previous, next, 1]);
    previous = next;
  }
  return graph;
}

// Basic inorganic molecules
raw({ id: 'hydrogen', nameJa: '水素', nameEn: 'Hydrogen', aliases: ['dihydrogen'], atoms: ['H', 'H'], bonds: [[0, 1, 1]], category: 'basic-inorganic' });
raw({ id: 'oxygen', nameJa: '酸素', nameEn: 'Oxygen', aliases: ['dioxygen'], atoms: ['O', 'O'], bonds: [[0, 1, 2]], category: 'basic-inorganic' });
raw({ id: 'nitrogen', nameJa: '窒素', nameEn: 'Nitrogen', aliases: ['dinitrogen'], atoms: ['N', 'N'], bonds: [[0, 1, 3]], category: 'basic-inorganic' });
add({ id: 'water', nameJa: '水', nameEn: 'Water', atoms: ['O'], bonds: [], category: 'basic-inorganic' });
add({ id: 'carbon-dioxide', nameJa: '二酸化炭素', nameEn: 'Carbon dioxide', atoms: ['C', 'O', 'O'], bonds: [[0, 1, 2], [0, 2, 2]], category: 'basic-inorganic' });
raw({ id: 'carbon-monoxide', nameJa: '一酸化炭素', nameEn: 'Carbon monoxide', atoms: ['C', 'O'], bonds: [[0, 1, 3]], category: 'basic-inorganic' });
add({ id: 'ammonia', nameJa: 'アンモニア', nameEn: 'Ammonia', atoms: ['N'], bonds: [], category: 'basic-inorganic' });
add({ id: 'hydrogen-sulfide', nameJa: '硫化水素', nameEn: 'Hydrogen sulfide', atoms: ['S'], bonds: [], category: 'basic-inorganic' });
add({ id: 'hydrogen-chloride', nameJa: '塩化水素', nameEn: 'Hydrogen chloride', atoms: ['Cl'], bonds: [], category: 'basic-inorganic' });
add({ id: 'hydrogen-fluoride', nameJa: 'フッ化水素', nameEn: 'Hydrogen fluoride', atoms: ['F'], bonds: [], category: 'basic-inorganic' });
raw({ id: 'chlorine', nameJa: '塩素', nameEn: 'Chlorine', aliases: ['dichlorine'], atoms: ['Cl', 'Cl'], bonds: [[0, 1, 1]], category: 'basic-inorganic' });
add({ id: 'sulfur-dioxide', nameJa: '二酸化硫黄', nameEn: 'Sulfur dioxide', atoms: ['S', 'O', 'O'], bonds: [[0, 1, 2], [0, 2, 2]], valences: { 0: 4 }, category: 'basic-inorganic' });
add({ id: 'sulfur-trioxide', nameJa: '三酸化硫黄', nameEn: 'Sulfur trioxide', atoms: ['S', 'O', 'O', 'O'], bonds: [[0, 1, 2], [0, 2, 2], [0, 3, 2]], valences: { 0: 6 }, category: 'basic-inorganic' });
add({ id: 'phosphine', nameJa: 'ホスフィン', nameEn: 'Phosphine', atoms: ['P'], bonds: [], category: 'basic-inorganic' });
add({ id: 'phosphorus-trichloride', nameJa: '三塩化リン', nameEn: 'Phosphorus trichloride', atoms: ['P', 'Cl', 'Cl', 'Cl'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]], category: 'basic-inorganic' });
add({ id: 'phosphorus-pentachloride', nameJa: '五塩化リン', nameEn: 'Phosphorus pentachloride', atoms: ['P', 'Cl', 'Cl', 'Cl', 'Cl', 'Cl'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1]], valences: { 0: 5 }, category: 'basic-inorganic' });
add({ id: 'sulfur-hexafluoride', nameJa: '六フッ化硫黄', nameEn: 'Sulfur hexafluoride', atoms: ['S', 'F', 'F', 'F', 'F', 'F', 'F'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1], [0, 6, 1]], valences: { 0: 6 }, category: 'basic-inorganic' });
add({ id: 'carbon-disulfide', nameJa: '二硫化炭素', nameEn: 'Carbon disulfide', atoms: ['C', 'S', 'S'], bonds: [[0, 1, 2], [0, 2, 2]], category: 'basic-inorganic' });
add({ id: 'carbonyl-sulfide', nameJa: '硫化カルボニル', nameEn: 'Carbonyl sulfide', atoms: ['C', 'O', 'S'], bonds: [[0, 1, 2], [0, 2, 2]], category: 'basic-inorganic' });
add({ id: 'phosphoric-acid', nameJa: 'リン酸', nameEn: 'Phosphoric acid', atoms: ['P', 'O', 'O', 'O', 'O'], bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [0, 4, 1]], valences: { 0: 5 }, category: 'basic-inorganic' });
add({ id: 'sulfuric-acid', nameJa: '硫酸', nameEn: 'Sulfuric acid', atoms: ['S', 'O', 'O', 'O', 'O'], bonds: [[0, 1, 2], [0, 2, 2], [0, 3, 1], [0, 4, 1]], valences: { 0: 6 }, category: 'basic-inorganic' });
add({ id: 'hydrogen-peroxide', nameJa: '過酸化水素', nameEn: 'Hydrogen peroxide', atoms: ['O', 'O'], bonds: [[0, 1, 1]], category: 'basic-inorganic' });
add({ id: 'hypochlorous-acid', nameJa: '次亜塩素酸', nameEn: 'Hypochlorous acid', atoms: ['O', 'Cl'], bonds: [[0, 1, 1]], category: 'basic-inorganic' });
add({ id: 'carbonic-acid', nameJa: '炭酸', nameEn: 'Carbonic acid', atoms: ['C', 'O', 'O', 'O'], bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1]], category: 'basic-inorganic' });

// Hydrocarbons and halogenated hydrocarbons
add({ id: 'methane', nameJa: 'メタン', nameEn: 'Methane', ...chain(1), category: 'hydrocarbon' });
add({ id: 'ethane', nameJa: 'エタン', nameEn: 'Ethane', ...chain(2), category: 'hydrocarbon' });
add({ id: 'propane', nameJa: 'プロパン', nameEn: 'Propane', ...chain(3), category: 'hydrocarbon' });
add({ id: 'n-butane', nameJa: 'n-ブタン', nameEn: 'n-Butane', aliases: ['butane'], ...chain(4), category: 'hydrocarbon' });
add({ id: 'isobutane', nameJa: 'イソブタン', nameEn: 'Isobutane', aliases: ['2-methylpropane'], atoms: ['C', 'C', 'C', 'C'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]], category: 'hydrocarbon' });
add({ id: 'n-pentane', nameJa: 'n-ペンタン', nameEn: 'n-Pentane', aliases: ['pentane'], ...chain(5), category: 'hydrocarbon' });
add({ id: 'isopentane', nameJa: 'イソペンタン', nameEn: 'Isopentane', aliases: ['2-methylbutane'], atoms: ['C', 'C', 'C', 'C', 'C'], bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [1, 4, 1]], category: 'hydrocarbon' });
add({ id: 'neopentane', nameJa: 'ネオペンタン', nameEn: 'Neopentane', aliases: ['2,2-dimethylpropane'], atoms: ['C', 'C', 'C', 'C', 'C'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], category: 'hydrocarbon' });
add({ id: 'n-hexane', nameJa: 'n-ヘキサン', nameEn: 'n-Hexane', aliases: ['hexane'], ...chain(6), category: 'hydrocarbon' });
add({ id: 'ethene', nameJa: 'エチレン', nameEn: 'Ethene', aliases: ['ethylene'], ...chain(2, { 0: 2 }), category: 'hydrocarbon' });
add({ id: 'propene', nameJa: 'プロピレン', nameEn: 'Propene', aliases: ['propylene'], ...chain(3, { 0: 2 }), category: 'hydrocarbon' });
add({ id: '1-butene', nameJa: '1-ブテン', nameEn: '1-Butene', ...chain(4, { 0: 2 }), category: 'hydrocarbon' });
add({ id: '2-butene', nameJa: '2-ブテン', nameEn: '2-Butene', ...chain(4, { 1: 2 }), category: 'hydrocarbon' });
add({ id: 'isobutene', nameJa: 'イソブテン', nameEn: 'Isobutene', aliases: ['2-methylpropene'], atoms: ['C', 'C', 'C', 'C'], bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1]], category: 'hydrocarbon' });
add({ id: '1-pentene', nameJa: '1-ペンテン', nameEn: '1-Pentene', ...chain(5, { 0: 2 }), category: 'hydrocarbon' });
add({ id: '2-pentene', nameJa: '2-ペンテン', nameEn: '2-Pentene', ...chain(5, { 1: 2 }), category: 'hydrocarbon' });
add({ id: 'ethyne', nameJa: 'アセチレン', nameEn: 'Ethyne', aliases: ['acetylene'], ...chain(2, { 0: 3 }), category: 'hydrocarbon' });
add({ id: 'propyne', nameJa: 'プロピン', nameEn: 'Propyne', ...chain(3, { 0: 3 }), category: 'hydrocarbon' });
add({ id: '1-butyne', nameJa: '1-ブチン', nameEn: '1-Butyne', ...chain(4, { 0: 3 }), category: 'hydrocarbon' });
add({ id: '2-butyne', nameJa: '2-ブチン', nameEn: '2-Butyne', ...chain(4, { 1: 3 }), category: 'hydrocarbon' });
add({ id: 'cyclopropane', nameJa: 'シクロプロパン', nameEn: 'Cyclopropane', ...ring(3), category: 'hydrocarbon' });
add({ id: 'cyclobutane', nameJa: 'シクロブタン', nameEn: 'Cyclobutane', ...ring(4), category: 'hydrocarbon' });
add({ id: 'cyclopentane', nameJa: 'シクロペンタン', nameEn: 'Cyclopentane', ...ring(5), category: 'hydrocarbon' });
add({ id: 'cyclohexane', nameJa: 'シクロヘキサン', nameEn: 'Cyclohexane', ...ring(6), category: 'hydrocarbon' });
{
  const graph = ring(6); graph.atoms.push('C'); graph.bonds.push([0, 6, 1]);
  add({ id: 'methylcyclohexane', nameJa: 'メチルシクロヘキサン', nameEn: 'Methylcyclohexane', ...graph, category: 'hydrocarbon' });
}
add({ id: 'benzene', nameJa: 'ベンゼン', nameEn: 'Benzene', ...aromatic(), category: 'aromatic' });
{
  const graph = aromatic([g => attach(g, 0, ['C'], [])]);
  add({ id: 'toluene', nameJa: 'トルエン', nameEn: 'Toluene', aliases: ['methylbenzene'], ...graph, category: 'aromatic' });
}
{
  const graph = aromatic([g => attach(g, 0, ['C', 'C'], [[0, 1, 1]])]);
  add({ id: 'ethylbenzene', nameJa: 'エチルベンゼン', nameEn: 'Ethylbenzene', ...graph, category: 'aromatic' });
}
for (const [id, nameJa, nameEn, second] of [['o-xylene', 'o-キシレン', 'o-Xylene', 1], ['m-xylene', 'm-キシレン', 'm-Xylene', 2], ['p-xylene', 'p-キシレン', 'p-Xylene', 3]]) {
  const graph = aromatic([g => attach(g, 0, ['C'], []), g => attach(g, second, ['C'], [])]);
  add({ id, nameJa, nameEn, ...graph, category: 'aromatic' });
}
{
  const graph = aromatic([g => attach(g, 0, ['C', 'C'], [[0, 1, 2]])]);
  add({ id: 'styrene', nameJa: 'スチレン', nameEn: 'Styrene', aliases: ['vinylbenzene'], ...graph, category: 'aromatic' });
}
for (const [id, nameJa, nameEn, halogens] of [
  ['chloromethane', 'クロロメタン', 'Chloromethane', ['Cl']],
  ['dichloromethane', 'ジクロロメタン', 'Dichloromethane', ['Cl', 'Cl']],
  ['chloroform', 'クロロホルム', 'Chloroform', ['Cl', 'Cl', 'Cl']],
  ['carbon-tetrachloride', '四塩化炭素', 'Carbon tetrachloride', ['Cl', 'Cl', 'Cl', 'Cl']],
  ['fluoromethane', 'フルオロメタン', 'Fluoromethane', ['F']],
  ['difluoromethane', 'ジフルオロメタン', 'Difluoromethane', ['F', 'F']],
]) {
  add({ id, nameJa, nameEn, atoms: ['C', ...halogens], bonds: halogens.map((_, i) => [0, i + 1, 1]), category: 'halogenated-hydrocarbon' });
}
add({ id: 'chloroethane', nameJa: 'クロロエタン', nameEn: 'Chloroethane', atoms: ['C', 'C', 'Cl'], bonds: [[0, 1, 1], [1, 2, 1]], category: 'halogenated-hydrocarbon' });
add({ id: '1-2-dichloroethane', nameJa: '1,2-ジクロロエタン', nameEn: '1,2-Dichloroethane', atoms: ['C', 'C', 'Cl', 'Cl'], bonds: [[0, 1, 1], [0, 2, 1], [1, 3, 1]], category: 'halogenated-hydrocarbon' });
add({ id: 'vinyl-chloride', nameJa: '塩化ビニル', nameEn: 'Vinyl chloride', atoms: ['C', 'C', 'Cl'], bonds: [[0, 1, 2], [1, 2, 1]], category: 'halogenated-hydrocarbon' });
{
  const graph = aromatic([g => attach(g, 0, ['Cl'], [])]);
  add({ id: 'chlorobenzene', nameJa: 'クロロベンゼン', nameEn: 'Chlorobenzene', ...graph, category: 'halogenated-aromatic' });
}

// Alcohols and ethers
add({ id: 'methanol', nameJa: 'メタノール', nameEn: 'Methanol', ...alcoholChain(1, 0), category: 'alcohol' });
add({ id: 'ethanol', nameJa: 'エタノール', nameEn: 'Ethanol', ...alcoholChain(2, 1), category: 'alcohol' });
add({ id: '1-propanol', nameJa: '1-プロパノール', nameEn: '1-Propanol', ...alcoholChain(3, 2), category: 'alcohol' });
add({ id: '2-propanol', nameJa: '2-プロパノール', nameEn: '2-Propanol', aliases: ['isopropyl alcohol'], ...alcoholChain(3, 1), category: 'alcohol' });
add({ id: '1-butanol', nameJa: '1-ブタノール', nameEn: '1-Butanol', ...alcoholChain(4, 3), category: 'alcohol' });
add({ id: '2-butanol', nameJa: '2-ブタノール', nameEn: '2-Butanol', ...alcoholChain(4, 1), category: 'alcohol' });
add({ id: 'isobutanol', nameJa: 'イソブタノール', nameEn: 'Isobutanol', aliases: ['2-methyl-1-propanol'], atoms: ['C', 'C', 'C', 'C', 'O'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [3, 4, 1]], category: 'alcohol' });
add({ id: 'tert-butanol', nameJa: 'tert-ブタノール', nameEn: 'tert-Butanol', aliases: ['2-methyl-2-propanol'], atoms: ['C', 'C', 'C', 'C', 'O'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], category: 'alcohol' });
add({ id: 'ethylene-glycol', nameJa: 'エチレングリコール', nameEn: 'Ethylene glycol', aliases: ['ethane-1,2-diol'], atoms: ['C', 'C', 'O', 'O'], bonds: [[0, 1, 1], [0, 2, 1], [1, 3, 1]], category: 'polyol' });
add({ id: 'propylene-glycol', nameJa: 'プロピレングリコール', nameEn: 'Propylene glycol', aliases: ['propane-1,2-diol'], atoms: ['C', 'C', 'C', 'O', 'O'], bonds: [[0, 1, 1], [1, 2, 1], [0, 3, 1], [1, 4, 1]], category: 'polyol' });
add({ id: 'glycerol', nameJa: 'グリセリン', nameEn: 'Glycerol', aliases: ['propane-1,2,3-triol'], atoms: ['C', 'C', 'C', 'O', 'O', 'O'], bonds: [[0, 1, 1], [1, 2, 1], [0, 3, 1], [1, 4, 1], [2, 5, 1]], category: 'polyol' });
{
  const graph = ring(6); graph.atoms.push('O'); graph.bonds.push([0, 6, 1]);
  add({ id: 'cyclohexanol', nameJa: 'シクロヘキサノール', nameEn: 'Cyclohexanol', ...graph, category: 'alcohol' });
}
add({ id: 'dimethyl-ether', nameJa: 'ジメチルエーテル', nameEn: 'Dimethyl ether', atoms: ['C', 'O', 'C'], bonds: [[0, 1, 1], [1, 2, 1]], category: 'ether' });
add({ id: 'methyl-ethyl-ether', nameJa: 'メチルエチルエーテル', nameEn: 'Methyl ethyl ether', aliases: ['methoxyethane'], atoms: ['C', 'O', 'C', 'C'], bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 1]], category: 'ether' });
add({ id: 'diethyl-ether', nameJa: 'ジエチルエーテル', nameEn: 'Diethyl ether', aliases: ['ethoxyethane'], atoms: ['C', 'C', 'O', 'C', 'C'], bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 4, 1]], category: 'ether' });
add({ id: 'tetrahydrofuran', nameJa: 'テトラヒドロフラン', nameEn: 'Tetrahydrofuran', aliases: ['THF'], ...ring(['O', 'C', 'C', 'C', 'C']), category: 'cyclic-ether' });
add({ id: '1-4-dioxane', nameJa: '1,4-ジオキサン', nameEn: '1,4-Dioxane', ...ring(['O', 'C', 'C', 'O', 'C', 'C']), category: 'cyclic-ether' });
add({ id: 'ethylene-oxide', nameJa: 'エチレンオキシド', nameEn: 'Ethylene oxide', aliases: ['oxirane'], ...ring(['O', 'C', 'C']), category: 'cyclic-ether' });
add({ id: 'methanethiol', nameJa: 'メタンチオール', nameEn: 'Methanethiol', atoms: ['C', 'S'], bonds: [[0, 1, 1]], category: 'thiol' });
add({ id: 'ethanethiol', nameJa: 'エタンチオール', nameEn: 'Ethanethiol', atoms: ['C', 'C', 'S'], bonds: [[0, 1, 1], [1, 2, 1]], category: 'thiol' });
add({ id: 'dimethyl-sulfide', nameJa: '硫化ジメチル', nameEn: 'Dimethyl sulfide', atoms: ['C', 'S', 'C'], bonds: [[0, 1, 1], [1, 2, 1]], category: 'thioether' });

// Aldehydes and ketones
add({ id: 'formaldehyde', nameJa: 'ホルムアルデヒド', nameEn: 'Formaldehyde', aliases: ['methanal'], ...aldehyde(1), category: 'aldehyde' });
add({ id: 'acetaldehyde', nameJa: 'アセトアルデヒド', nameEn: 'Acetaldehyde', aliases: ['ethanal'], ...aldehyde(2), category: 'aldehyde' });
add({ id: 'propionaldehyde', nameJa: 'プロピオンアルデヒド', nameEn: 'Propionaldehyde', aliases: ['propanal'], ...aldehyde(3), category: 'aldehyde' });
add({ id: 'butyraldehyde', nameJa: 'ブチルアルデヒド', nameEn: 'Butyraldehyde', aliases: ['butanal'], ...aldehyde(4), category: 'aldehyde' });
add({ id: 'isobutyraldehyde', nameJa: 'イソブチルアルデヒド', nameEn: 'Isobutyraldehyde', aliases: ['2-methylpropanal'], atoms: ['C', 'C', 'C', 'C', 'O'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [3, 4, 2]], category: 'aldehyde' });
{
  const graph = aromatic([g => attach(g, 0, ['C', 'O'], [[0, 1, 2]])]);
  add({ id: 'benzaldehyde', nameJa: 'ベンズアルデヒド', nameEn: 'Benzaldehyde', ...graph, category: 'aldehyde' });
}
add({ id: 'acetone', nameJa: 'アセトン', nameEn: 'Acetone', aliases: ['propanone'], ...ketone(3, 1), category: 'ketone' });
add({ id: '2-butanone', nameJa: '2-ブタノン', nameEn: '2-Butanone', aliases: ['methyl ethyl ketone'], ...ketone(4, 1), category: 'ketone' });
add({ id: '2-pentanone', nameJa: '2-ペンタノン', nameEn: '2-Pentanone', ...ketone(5, 1), category: 'ketone' });
add({ id: '3-pentanone', nameJa: '3-ペンタノン', nameEn: '3-Pentanone', ...ketone(5, 2), category: 'ketone' });
{
  const graph = ring(6); graph.atoms.push('O'); graph.bonds.push([0, 6, 2]);
  add({ id: 'cyclohexanone', nameJa: 'シクロヘキサノン', nameEn: 'Cyclohexanone', ...graph, category: 'ketone' });
}

// Carboxylic acids and esters
add({ id: 'formic-acid', nameJa: 'ギ酸', nameEn: 'Formic acid', aliases: ['methanoic acid'], ...acid(1), category: 'carboxylic-acid' });
add({ id: 'acetic-acid', nameJa: '酢酸', nameEn: 'Acetic acid', aliases: ['ethanoic acid'], ...acid(2), category: 'carboxylic-acid' });
add({ id: 'propionic-acid', nameJa: 'プロピオン酸', nameEn: 'Propionic acid', aliases: ['propanoic acid'], ...acid(3), category: 'carboxylic-acid' });
add({ id: 'butyric-acid', nameJa: '酪酸', nameEn: 'Butyric acid', aliases: ['butanoic acid'], ...acid(4), category: 'carboxylic-acid' });
add({ id: 'isobutyric-acid', nameJa: 'イソ酪酸', nameEn: 'Isobutyric acid', aliases: ['2-methylpropanoic acid'], atoms: ['C', 'C', 'C', 'C', 'O', 'O'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [3, 4, 2], [3, 5, 1]], category: 'carboxylic-acid' });
add({ id: 'valeric-acid', nameJa: '吉草酸', nameEn: 'Valeric acid', aliases: ['pentanoic acid'], ...acid(5), category: 'carboxylic-acid' });
add({ id: 'oxalic-acid', nameJa: 'シュウ酸', nameEn: 'Oxalic acid', aliases: ['ethanedioic acid'], atoms: ['C', 'C', 'O', 'O', 'O', 'O'], bonds: [[0, 1, 1], [0, 2, 2], [0, 3, 1], [1, 4, 2], [1, 5, 1]], category: 'dicarboxylic-acid' });
add({ id: 'lactic-acid', nameJa: '乳酸', nameEn: 'Lactic acid', aliases: ['2-hydroxypropanoic acid'], atoms: ['C', 'C', 'C', 'O', 'O', 'O'], bonds: [[0, 1, 1], [1, 2, 1], [1, 3, 1], [2, 4, 2], [2, 5, 1]], category: 'hydroxy-acid' });
{
  const graph = aromatic([g => attach(g, 0, ['C', 'O', 'O'], [[0, 1, 2], [0, 2, 1]])]);
  add({ id: 'benzoic-acid', nameJa: '安息香酸', nameEn: 'Benzoic acid', ...graph, category: 'aromatic-acid' });
}
add({ id: 'methyl-formate', nameJa: 'ギ酸メチル', nameEn: 'Methyl formate', ...ester(1, 1), category: 'ester' });
add({ id: 'ethyl-formate', nameJa: 'ギ酸エチル', nameEn: 'Ethyl formate', ...ester(1, 2), category: 'ester' });
add({ id: 'methyl-acetate', nameJa: '酢酸メチル', nameEn: 'Methyl acetate', ...ester(2, 1), category: 'ester' });
add({ id: 'ethyl-acetate', nameJa: '酢酸エチル', nameEn: 'Ethyl acetate', ...ester(2, 2), category: 'ester' });
add({ id: 'methyl-propionate', nameJa: 'プロピオン酸メチル', nameEn: 'Methyl propionate', ...ester(3, 1), category: 'ester' });
add({ id: 'ethyl-propionate', nameJa: 'プロピオン酸エチル', nameEn: 'Ethyl propionate', ...ester(3, 2), category: 'ester' });
{
  const graph = acid(3); graph.bonds[0][2] = 2;
  add({ id: 'acrylic-acid', nameJa: 'アクリル酸', nameEn: 'Acrylic acid', ...graph, category: 'unsaturated-carboxylic-acid' });
}
add({ id: 'acetic-anhydride', nameJa: '無水酢酸', nameEn: 'Acetic anhydride', atoms: ['C', 'C', 'O', 'C', 'C', 'O', 'O'], bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 4, 1], [1, 5, 2], [3, 6, 2]], category: 'acid-anhydride' });

// Nitrogen compounds
add({ id: 'methylamine', nameJa: 'メチルアミン', nameEn: 'Methylamine', atoms: ['C', 'N'], bonds: [[0, 1, 1]], category: 'amine' });
add({ id: 'ethylamine', nameJa: 'エチルアミン', nameEn: 'Ethylamine', atoms: ['C', 'C', 'N'], bonds: [[0, 1, 1], [1, 2, 1]], category: 'amine' });
add({ id: 'dimethylamine', nameJa: 'ジメチルアミン', nameEn: 'Dimethylamine', atoms: ['C', 'N', 'C'], bonds: [[0, 1, 1], [1, 2, 1]], category: 'amine' });
add({ id: 'trimethylamine', nameJa: 'トリメチルアミン', nameEn: 'Trimethylamine', atoms: ['N', 'C', 'C', 'C'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]], category: 'amine' });
{
  const graph = aromatic([g => attach(g, 0, ['N'], [])]);
  add({ id: 'aniline', nameJa: 'アニリン', nameEn: 'Aniline', aliases: ['aminobenzene'], ...graph, category: 'aromatic-amine' });
}
add({ id: 'formamide', nameJa: 'ホルムアミド', nameEn: 'Formamide', atoms: ['C', 'O', 'N'], bonds: [[0, 1, 2], [0, 2, 1]], category: 'amide' });
add({ id: 'acetamide', nameJa: 'アセトアミド', nameEn: 'Acetamide', atoms: ['C', 'C', 'O', 'N'], bonds: [[0, 1, 1], [1, 2, 2], [1, 3, 1]], category: 'amide' });
add({ id: 'propionamide', nameJa: 'プロピオンアミド', nameEn: 'Propionamide', atoms: ['C', 'C', 'C', 'O', 'N'], bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 2], [2, 4, 1]], category: 'amide' });
add({ id: 'urea', nameJa: '尿素', nameEn: 'Urea', atoms: ['C', 'O', 'N', 'N'], bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1]], category: 'amide' });
add({ id: 'hydrogen-cyanide', nameJa: 'シアン化水素', nameEn: 'Hydrogen cyanide', atoms: ['C', 'N'], bonds: [[0, 1, 3]], category: 'nitrile' });
add({ id: 'acetonitrile', nameJa: 'アセトニトリル', nameEn: 'Acetonitrile', aliases: ['ethanenitrile'], atoms: ['C', 'C', 'N'], bonds: [[0, 1, 1], [1, 2, 3]], category: 'nitrile' });
add({ id: 'acrylonitrile', nameJa: 'アクリロニトリル', nameEn: 'Acrylonitrile', atoms: ['C', 'C', 'C', 'N'], bonds: [[0, 1, 2], [1, 2, 1], [2, 3, 3]], category: 'nitrile' });
add({ id: 'pyridine', nameJa: 'ピリジン', nameEn: 'Pyridine', ...ring(['N', 'C', 'C', 'C', 'C', 'C'], true), category: 'aromatic-heterocycle' });
add({ id: 'acrolein', nameJa: 'アクロレイン', nameEn: 'Acrolein', atoms: ['C', 'C', 'C', 'O'], bonds: [[0, 1, 2], [1, 2, 1], [2, 3, 2]], category: 'unsaturated-aldehyde' });
add({ id: 'glycine', nameJa: 'グリシン', nameEn: 'Glycine', atoms: ['N', 'C', 'C', 'O', 'O'], bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 2], [2, 4, 1]], category: 'amino-acid' });
add({ id: 'alanine', nameJa: 'アラニン', nameEn: 'Alanine', atoms: ['C', 'C', 'C', 'N', 'O', 'O'], bonds: [[0, 1, 1], [1, 2, 1], [1, 3, 1], [2, 4, 2], [2, 5, 1]], category: 'amino-acid' });
add({ id: 'ethylenediamine', nameJa: 'エチレンジアミン', nameEn: 'Ethylenediamine', atoms: ['N', 'C', 'C', 'N'], bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 1]], category: 'diamine' });

// Oxygenated aromatics
{
  const graph = aromatic([g => attach(g, 0, ['O'], [])]);
  add({ id: 'phenol', nameJa: 'フェノール', nameEn: 'Phenol', aliases: ['hydroxybenzene'], ...graph, category: 'aromatic-alcohol' });
}
{
  const graph = aromatic([g => attach(g, 0, ['O', 'C'], [[0, 1, 1]])]);
  add({ id: 'anisole', nameJa: 'アニソール', nameEn: 'Anisole', aliases: ['methoxybenzene'], ...graph, category: 'aromatic-ether' });
}
{
  const graph = aromatic([g => attach(g, 0, ['C', 'O', 'C'], [[0, 1, 2], [0, 2, 1]])]);
  add({ id: 'acetophenone', nameJa: 'アセトフェノン', nameEn: 'Acetophenone', aliases: ['methyl phenyl ketone'], ...graph, category: 'aromatic-ketone' });
}
for (const [id, nameJa, nameEn, second] of [['catechol', 'カテコール', 'Catechol', 1], ['resorcinol', 'レゾルシノール', 'Resorcinol', 2], ['hydroquinone', 'ヒドロキノン', 'Hydroquinone', 3]]) {
  const graph = aromatic([g => attach(g, 0, ['O'], []), g => attach(g, second, ['O'], [])]);
  add({ id, nameJa, nameEn, ...graph, category: 'aromatic-diol' });
}
{
  const graph = aromatic([g => attach(g, 0, ['C', 'O', 'O'], [[0, 1, 2], [0, 2, 1]]), g => attach(g, 1, ['O'], [])]);
  add({ id: 'salicylic-acid', nameJa: 'サリチル酸', nameEn: 'Salicylic acid', aliases: ['2-hydroxybenzoic acid'], ...graph, category: 'aromatic-acid' });
}
{
  const graph = aromatic([g => attach(g, 0, ['N', 'C', 'O', 'C'], [[0, 1, 1], [1, 2, 2], [1, 3, 1]])]);
  add({ id: 'acetanilide', nameJa: 'アセトアニリド', nameEn: 'Acetanilide', ...graph, category: 'aromatic-amide' });
}
{
  const graph = aromatic([
    g => attach(g, 0, ['C', 'O', 'O'], [[0, 1, 2], [0, 2, 1]]),
    g => attach(g, 3, ['C', 'O', 'O'], [[0, 1, 2], [0, 2, 1]]),
  ]);
  add({ id: 'terephthalic-acid', nameJa: 'テレフタル酸', nameEn: 'Terephthalic acid', ...graph, category: 'aromatic-dicarboxylic-acid' });
}
{
  const graph = aromatic([
    g => attach(g, 0, ['C', 'O', 'O'], [[0, 1, 2], [0, 2, 1]]),
    g => attach(g, 1, ['O', 'C', 'O', 'C'], [[0, 1, 1], [1, 2, 2], [1, 3, 1]]),
  ]);
  add({ id: 'aspirin', nameJa: 'アスピリン', nameEn: 'Aspirin', ...graph, category: 'aromatic-ester-acid' });
}

// Collection expansion: familiar names that reward functional-group assembly.
// Neutral connectivity only; optical isomers are not separate collection ids.
function diacid(count) {
  const graph=acid(count);
  attach(graph,0,['O'],[]);graph.bonds.at(-1)[2]=2;
  attach(graph,0,['O'],[]);
  return graph;
}
for(const [id,nameJa,nameEn,count,iupacNameEn,learningNote] of [
  ['malonic-acid','マロン酸','Malonic acid',3,'Propanedioic acid','カルボキシ基2個を、1個のCH₂がつなぐジカルボン酸。'],
  ['succinic-acid','コハク酸','Succinic acid',4,'Butanedioic acid','生体の代謝にも登場するジカルボン酸。両端にカルボキシ基を持ちます。'],
  ['adipic-acid','アジピン酸','Adipic acid',6,'Hexanedioic acid','ナイロン66の原料になるジカルボン酸。両端の官能基と炭素鎖に注目。'],
]) add({id,nameJa,nameEn,iupacNameEn,learningNote,...diacid(count),category:'dicarboxylic-acid'});
{
  const graph=diacid(4);attach(graph,1,['O'],[]);
  add({id:'malic-acid',nameJa:'リンゴ酸',nameEn:'Malic acid',iupacNameEn:'2-Hydroxybutanedioic acid',learningNote:'リンゴなどに含まれる有機酸。カルボキシ基2個とヒドロキシ基1個を組み合わせます。',stereochemistry:'unspecified',...graph,category:'hydroxy-acid'});
}
{
  const graph=diacid(5);attach(graph,2,['C','O','O'],[[0,1,2],[0,2,1]]);attach(graph,2,['O'],[]);
  add({id:'citric-acid',nameJa:'クエン酸',nameEn:'Citric acid',iupacNameEn:'2-Hydroxypropane-1,2,3-tricarboxylic acid',learningNote:'柑橘類などに含まれる有機酸。中央の炭素から枝分かれし、カルボキシ基を3個持ちます。',...graph,category:'hydroxy-acid'});
}
{
  const graph=acid(2);attach(graph,0,['O'],[]);
  add({id:'glycolic-acid',nameJa:'グリコール酸',nameEn:'Glycolic acid',iupacNameEn:'2-Hydroxyethanoic acid',learningNote:'ヒドロキシ酸の小さな例。CH₂にヒドロキシ基とカルボキシ基がつながります。',...graph,category:'hydroxy-acid'});
}
for(const [id,nameJa,nameEn,position] of [['o-cresol','o-クレゾール','o-Cresol',1],['m-cresol','m-クレゾール','m-Cresol',2],['p-cresol','p-クレゾール','p-Cresol',3]]){
  const graph=aromatic([g=>attach(g,0,['O'],[]),g=>attach(g,position,['C'],[])]);
  add({id,nameJa,nameEn,iupacNameEn:`${position+1}-Methylphenol`,learningNote:'フェノールの環にメチル基を1個追加した構造。置換位置が違う3種類を別々に収集できます。',...graph,category:'aromatic-alcohol'});
}
{
  const graph=aromatic([g=>attach(g,0,['C','O','O','C'],[[0,1,2],[0,2,1],[2,3,1]]),g=>attach(g,1,['O'],[])]);
  add({id:'methyl-salicylate',nameJa:'サリチル酸メチル',nameEn:'Methyl salicylate',iupacNameEn:'Methyl 2-hydroxybenzoate',learningNote:'ウィンターグリーンの香りに関係するエステル。芳香環・ヒドロキシ基・エステル結合を組み合わせます。',...graph,category:'aromatic-ester'});
}
for(const [id,nameJa,nameEn,carbonCount,iupacNameEn] of [
  ['methyl-benzoate','安息香酸メチル','Methyl benzoate',1,'Methyl benzoate'],
  ['ethyl-benzoate','安息香酸エチル','Ethyl benzoate',2,'Ethyl benzoate'],
]){
  const graph=aromatic([g=>attach(g,0,['C','O','O',...Array(carbonCount).fill('C')],[[0,1,2],[0,2,1],[2,3,1],...(carbonCount===2?[[3,4,1]]:[])])]);
  add({id,nameJa,nameEn,iupacNameEn,learningNote:'香料にも使われる芳香族エステル。酸素側の炭素鎖を替えると別の分子になります。',...graph,category:'aromatic-ester'});
}
add({id:'n-butyl-acetate',nameJa:'酢酸n-ブチル',nameEn:'n-Butyl acetate',aliases:['酢酸ブチル','butyl acetate'],iupacNameEn:'Butyl ethanoate',learningNote:'塗料などの溶剤に使われるエステル。n-ブチル基を長い炭素鎖として活用できます。',...ester(2,4),category:'ester'});
{
  const graph=ester(2,4);attach(graph,6,['C'],[]);
  add({id:'isoamyl-acetate',nameJa:'酢酸イソアミル',nameEn:'Isoamyl acetate',aliases:['isopentyl acetate'],iupacNameEn:'3-Methylbutyl ethanoate',learningNote:'バナナ様の香りで知られるエステル。直鎖の酢酸エステルとは異なり、末端近くで枝分かれします。',...graph,category:'ester'});
}
{
  const graph=ester(2,2);attach(graph,4,['C'],[]);
  add({id:'isopropyl-acetate',nameJa:'酢酸イソプロピル',nameEn:'Isopropyl acetate',iupacNameEn:'Propan-2-yl ethanoate',learningNote:'溶剤に使われるエステル。イソプロピル基の中央のCHが酸素につながります。',...graph,category:'ester'});
}
{
  const graph=aromatic([g=>attach(g,0,['C','C','C'],[[0,1,1],[0,2,1]])]);
  add({id:'cumene',nameJa:'クメン',nameEn:'Cumene',aliases:['イソプロピルベンゼン','isopropylbenzene'],iupacNameEn:'Propan-2-ylbenzene',learningNote:'フェノール製造の原料となる芳香族炭化水素。フェニル基とイソプロピル基を接続した骨格です。',...graph,category:'aromatic'});
}
{
  const graph=aromatic([g=>attach(g,0,['C','O'],[[0,1,1]])]);
  add({id:'benzyl-alcohol',nameJa:'ベンジルアルコール',nameEn:'Benzyl alcohol',iupacNameEn:'Phenylmethanol',learningNote:'芳香環にCH₂OHがつながるアルコール。酸素が環に直接つながるフェノールとは異なります。',...graph,category:'aromatic-alcohol'});
}
for(const [id,nameJa,nameEn,side,iupacNameEn,learningNote] of [
  ['serine','セリン','Serine',['O'],'2-Amino-3-hydroxypropanoic acid','側鎖にヒドロキシ基を持つアミノ酸。アミノ基・カルボキシ基との組み合わせを学べます。'],
  ['cysteine','システイン','Cysteine',['S'],'2-Amino-3-sulfanylpropanoic acid','側鎖にチオール基を持つアミノ酸。硫黄の解放で作れる生体分子が広がります。'],
  ['methionine','メチオニン','Methionine',['C','S','C'],'2-Amino-4-methylsulfanylbutanoic acid','側鎖の途中に硫黄を含むアミノ酸。システインのSHとは異なるC–S–Cを持ちます。'],
]){
  const graph=acid(3);attach(graph,1,['N'],[]);attach(graph,0,side,side.slice(1).map((_,i)=>[i,i+1,1]));
  add({id,nameJa,nameEn,iupacNameEn,learningNote,stereochemistry:'unspecified',...graph,category:'amino-acid'});
}

const ids = new Set();
for (const molecule of molecules) {
  if (ids.has(molecule.id)) throw new Error(`Duplicate id: ${molecule.id}`);
  ids.add(molecule.id);
  molecule.iupacNameEn ??= iupacNames[molecule.id] ?? molecule.nameEn;
  if (commonNameIds.has(molecule.id)) {
    molecule.commonNameJa = molecule.nameJa;
    molecule.commonNameEn = molecule.nameEn;
  }
  molecule.formula = conventionalFormulas[molecule.id] ?? molecule.formula;
  molecule.bonds.forEach(([a, b, order]) => {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= molecule.atoms.length || b >= molecule.atoms.length || a === b || ![1, 2, 3].includes(order)) {
      throw new Error(`Invalid bond in ${molecule.id}: ${a},${b},${order}`);
    }
  });
}

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/molecules.json', import.meta.url), `${JSON.stringify(molecules, null, 2)}\n`);
console.log(`Wrote ${molecules.length} validated molecule records.`);
