from pathlib import Path
import json


def replace_once(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text:
        raise SystemExit(f'pattern missing in {path}: {old[:120]!r}')
    p.write_text(text.replace(old,new,1))

# Shared qualitative bond display: sulfur unchanged, nitro/ozone reuse it.
p=Path('src/special-bonds.js'); text=p.read_text()
marker='export const specialEdgeKeys = groups => new Set(groups.flatMap(g => g.ends.map(id => `${Math.min(g.center,id)}:${Math.max(g.center,id)}`)));'
pos=text.index(marker); suffix=text[pos+len(marker):]
head="""import {supportedResonanceGroups} from './resonance-model.js?v=1';

// Qualitative resonance notation, not an electron trajectory or orbital density.
// Existing sulfur oxo groups keep their visual contract; nitro and ozone share
// the same display primitive while formal charges are derived separately.
function sulfurOxoGroups(molecule) {
  return molecule.atoms.filter(a => a.element === 'S').flatMap(atom => {
    const ns = molecule.neighbors(atom.id), used = molecule.bondOrderForAtom(atom.id);
    if (![4,6].includes(used)) return [];
    const ends = ns.filter(n => n.order === 2 && molecule.atoms.find(a => a.id === n.atomId)?.element === 'O' && molecule.neighbors(n.atomId).length === 1).map(n => n.atomId);
    return ends.length >= 2 ? [{ kind:'sulfur-oxo', center: atom.id, ends }] : [];
  });
}
export function sharedOxoGroups(molecule) { return [...sulfurOxoGroups(molecule),...supportedResonanceGroups(molecule)]; }
export const specialEdgeKeys = groups => new Set(groups.flatMap(g => g.ends.map(id => `${Math.min(g.center,id)}:${Math.max(g.center,id)}`)));"""
p.write_text(head+suffix)

# Validation: charged valence is accepted only when a complete supported motif exists.
replace_once('src/chemistry.js','export const ELEMENTS = {',"import {supportedAtomState} from './resonance-model.js?v=1';\n\nexport const ELEMENTS = {")
replace_once('src/chemistry.js','if (used > max && !isCarbonMonoxideException(this, used)) {','if (used > max && !isCarbonMonoxideException(this, used) && !supportedAtomState(this, atom.id)) {')
replace_once('src/chemistry.js','return !ELEMENTS[atom.element].valences.includes(used) && !isCarbonMonoxideException(this, used);','return !ELEMENTS[atom.element].valences.includes(used) && !isCarbonMonoxideException(this, used) && !supportedAtomState(this, atom.id);')

# Bonding: allow only the extra bond that completes supported ozone/nitro resonance.
replace_once('src/bonding-model.js','export const ATOMIC_MODEL = {',"import {supportedAtomState,supportsResonanceBondUpgrade} from './resonance-model.js?v=1';\n\nexport const ATOMIC_MODEL = {")
replace_once('src/bonding-model.js',"  if (carbonMonoxidePartner(molecule, id)) return { singles: 0, pairs: 1, charge: atom.element === 'C' ? -1 : 1, sites: [] };\n  const singles = unpairedElectronCount(atom.element, used), pairs = lonePairCount(atom.element, used);", "  if (carbonMonoxidePartner(molecule, id)) return { singles: 0, pairs: 1, charge: atom.element === 'C' ? -1 : 1, sites: [] };\n  const supported=supportedAtomState(molecule,id);if(supported)return{singles:supported.singles,pairs:supported.pairs,charge:supported.charge,sites:[]};\n  const singles = unpairedElectronCount(atom.element, used), pairs = lonePairCount(atom.element, used);")
replace_once('src/bonding-model.js',"  const donor = carbonMonoxidePartner(molecule, a, 2)?.id === b;\n  if (donor) return { allowed: true, order: 3, kind: 'pair', donorId: left.element === 'O' ? a : b };", "  const donor = carbonMonoxidePartner(molecule, a, 2)?.id === b;\n  if (donor) return { allowed: true, order: 3, kind: 'pair', donorId: left.element === 'O' ? a : b };\n  if(order===1&&supportsResonanceBondUpgrade(molecule,a,b))return{allowed:true,order:2,kind:'extension'};")
replace_once('src/bonding-model.js',"    const allowed = ATOMIC_MODEL[atom.element]?.preferredValences ?? [1];\n    const nearest = Math.min(...allowed.map(v => Math.abs(v - used)));\n    const excess = Math.max(0, used - Math.max(...allowed));\n    penalty += nearest * nearest * 6 + excess * excess * 40;", "    const allowed = ATOMIC_MODEL[atom.element]?.preferredValences ?? [1],supported=supportedAtomState(molecule,atom.id);\n    const nearest = supported?0:Math.min(...allowed.map(v => Math.abs(v - used)));\n    const excess = supported?0:Math.max(0, used - Math.max(...allowed));\n    penalty += nearest * nearest * 6 + excess * excess * 40;")

# Generator can persist canonical formal-charge/resonance metadata.
replace_once('scripts/build-molecule-db.mjs','function add({ id, nameJa, nameEn, aliases = [], category, atoms, bonds, valences = {}, iupacNameEn, learningNote, stereochemistry }) {','function add({ id, nameJa, nameEn, aliases = [], category, atoms, bonds, valences = {}, formalCharges = null, resonanceGroups = null, iupacNameEn, learningNote, stereochemistry }) {')
replace_once('scripts/build-molecule-db.mjs',"  molecules.push({ id, nameJa, nameEn, ...(aliases.length ? { aliases } : {}), atoms: expandedAtoms, bonds: expandedBonds, formula: formulaFor(expandedAtoms), category, ...(iupacNameEn?{iupacNameEn,commonNameJa:nameJa,commonNameEn:nameEn}:{}), ...(learningNote?{learningNote}:{}), ...(stereochemistry?{stereochemistry}:{}) });", "  molecules.push({ id, nameJa, nameEn, ...(aliases.length ? { aliases } : {}), atoms: expandedAtoms, bonds: expandedBonds, formula: formulaFor(expandedAtoms), category, ...(formalCharges?{formalCharges}:{}), ...(resonanceGroups?.length?{resonanceGroups}:{}), ...(iupacNameEn?{iupacNameEn,commonNameJa:nameJa,commonNameEn:nameEn}:{}), ...(learningNote?{learningNote}:{}), ...(stereochemistry?{stereochemistry}:{}) });")
additions=r'''
// Supported formal-charge / resonance molecules. Canonical DB forms use one
// valid Lewis contributor; runtime recognition accepts the equivalent placement.
add({ id:'ozone', nameJa:'オゾン', nameEn:'Ozone', aliases:['trioxygen'], atoms:['O','O','O'], bonds:[[0,1,2],[1,2,1]], valences:{0:2,1:3,2:1}, formalCharges:{1:1,2:-1}, resonanceGroups:[{kind:'ozone',center:1,ends:[0,2]}], category:'basic-inorganic', iupacNameEn:'Trioxygen', learningNote:'3個の酸素原子からなる分子。2本のO–O結合は等価な共鳴として表せ、中央Oと末端Oに形式電荷を持つLewis構造で扱う。' });
add({ id:'nitromethane', nameJa:'ニトロメタン', nameEn:'Nitromethane', atoms:['C','N','O','O'], bonds:[[0,1,1],[1,2,2],[1,3,1]], valences:{1:4,3:1}, formalCharges:{1:1,3:-1}, resonanceGroups:[{kind:'nitro',center:1,ends:[2,3]}], category:'nitrogen-compounds', iupacNameEn:'Nitromethane', learningNote:'最小のニトロ化合物。N⁺とO⁻を含む2つの等価なLewis構造でニトロ基の共鳴を比べられる。' });
function nitroAromatic(nitroPositions,{methyl=false}={}){
  const graph=aromatic(),valences={},formalCharges={},resonanceGroups=[];
  if(methyl){const methylIndex=graph.atoms.length;graph.atoms.push('C');graph.bonds.push([0,methylIndex,1]);}
  for(const ringIndex of nitroPositions){const n=graph.atoms.length;graph.atoms.push('N','O','O');graph.bonds.push([ringIndex,n,1],[n,n+1,2],[n,n+2,1]);valences[n]=4;valences[n+2]=1;formalCharges[n]=1;formalCharges[n+2]=-1;resonanceGroups.push({kind:'nitro',center:n,ends:[n+1,n+2]});}
  return{...graph,valences,formalCharges,resonanceGroups};
}
add({ id:'nitrobenzene', nameJa:'ニトロベンゼン', nameEn:'Nitrobenzene', ...nitroAromatic([0]), category:'nitrogen-compounds', iupacNameEn:'Nitrobenzene', learningNote:'ベンゼン環にニトロ基が1つ結合した芳香族化合物。芳香環の共鳴とニトロ基内部の共鳴を同じ構造上で観察できる。' });
add({ id:'2-nitrotoluene', nameJa:'2-ニトロトルエン', nameEn:'2-Nitrotoluene', aliases:['o-nitrotoluene'], ...nitroAromatic([1],{methyl:true}), category:'nitrogen-compounds', iupacNameEn:'1-Methyl-2-nitrobenzene', learningNote:'トルエンのメチル基に隣接してニトロ基を持つ。ニトロ置換を1段ずつ増やす系列の入口。' });
add({ id:'2-4-dinitrotoluene', nameJa:'2,4-ジニトロトルエン', nameEn:'2,4-Dinitrotoluene', aliases:['2,4-DNT'], ...nitroAromatic([1,3],{methyl:true}), category:'nitrogen-compounds', iupacNameEn:'1-Methyl-2,4-dinitrobenzene', learningNote:'トルエン環にニトロ基が2つ入った化合物。各ニトロ基はそれぞれ等価な2つの共鳴Lewis構造を持つ。' });
add({ id:'2-4-6-trinitrotoluene', nameJa:'2,4,6-トリニトロトルエン', nameEn:'2,4,6-Trinitrotoluene', aliases:['TNT'], ...nitroAromatic([1,3,5],{methyl:true}), category:'nitrogen-compounds', iupacNameEn:'1-Methyl-2,4,6-trinitrobenzene', learningNote:'TNTとして知られる芳香族ニトロ化合物。この図鑑では用途ではなく、段階的なニトロ置換と複数ニトロ基の共鳴構造を扱う。' });
'''
replace_once('scripts/build-molecule-db.mjs','if (molecules.length !== 129) throw new Error(`Production molecule inventory drifted: ${molecules.length}`);',additions+'\nif (molecules.length !== 135) throw new Error(`Production molecule inventory drifted: ${molecules.length}`);')

# Existing recognition harness must import the real module now that chemistry has a dependency.
p=Path('tests/recognition.test.mjs'); text=p.read_text()
text=text.replace("const source = await readFile(new URL('../src/chemistry.js', import.meta.url), 'utf8');\nconst chemistry = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);","const chemistry = await import(new URL('../src/chemistry.js?recognition-test=1', import.meta.url));")
p.write_text(text)

# Graph extension: existing relation codes only; recompute edge index cache.
graph=json.loads(Path('data/molecule-graph.json').read_text())
node_index={row[0]:i for i,row in enumerate(graph['nodes'])}
new_nodes=[
 ['ozone',1,'B',1,1,4,'O1',[5],[]],
 ['nitromethane',16,'B',1,1,1,'F.7,C.5',[7],[]],
 ['nitrobenzene',16,'B',9,4,8,'D1,F.6',[7,1],[]],
 ['2-nitrotoluene',16,'B',9,4,7,'D1,F.7',[7,1],[]],
 ['2-4-dinitrotoluene',16,'B',10,5,7,'D1,F.8',[7,1],[]],
 ['2-4-6-trinitrotoluene',16,'L',11,5,7,'D1,F.9',[7,1],[]],
]
for row in new_nodes:
    if row[0] not in node_index:
        node_index[row[0]]=len(graph['nodes']); graph['nodes'].append(row)
specs=[('oxygen','ozone',2),('methane','nitromethane',7),('benzene','nitrobenzene',7),('toluene','2-nitrotoluene',7),('2-nitrotoluene','2-4-dinitrotoluene',7),('2-4-dinitrotoluene','2-4-6-trinitrotoluene',7)]
def edge_key(a,b,r): return (min(a,b),max(a,b),r)
existing={edge_key(*edge) for edge in graph['edges']}
for from_id,to_id,relation in specs:
    a,b=node_index[from_id],node_index[to_id]; key=edge_key(a,b,relation)
    if key not in existing: graph['edges'].append([a,b,relation]); existing.add(key)
connection_col=graph['nodeColumns'].index('connectionEdgeIndexes')
for row in graph['nodes']: row[connection_col]=[]
for i,(a,b,_) in enumerate(graph['edges']): graph['nodes'][a][connection_col].append(i); graph['nodes'][b][connection_col].append(i)
Path('data/molecule-graph.json').write_text(json.dumps(graph,ensure_ascii=False,indent=2)+'\n')

enc=json.loads(Path('data/encyclopedia.json').read_text())
enc['molecules'].update({
 'ozone':{'number':130,'description':'3個の酸素原子からなる分子。中央と末端に形式電荷を持つ2つの等価なLewis構造で表せ、結合は共鳴によって平均化している。'},
 'nitromethane':{'number':131,'description':'最小のニトロ化合物。N⁺とO⁻を持つ2つの等価なLewis構造があり、どちらのOを二重結合として描いても同じ分子。'},
 'nitrobenzene':{'number':132,'description':'ベンゼン環にニトロ基が1つ付いた分子。芳香環とニトロ基という2種類の共鳴表現を同時に観察できる。'},
 '2-nitrotoluene':{'number':133,'description':'トルエンのメチル基の隣にニトロ基が1つ付いた分子。ニトロ置換を段階的に増やす系列の出発点。'},
 '2-4-dinitrotoluene':{'number':134,'description':'トルエン環の2位と4位にニトロ基を持つ。2つのニトロ基それぞれでN⁺/O⁻と等価な共鳴結合を確認できる。'},
 '2-4-6-trinitrotoluene':{'number':135,'description':'TNTとして知られる2,4,6-トリニトロトルエン。ここでは用途ではなく、3段階のニトロ置換と各ニトロ基の共鳴構造を扱う。'},
})
Path('data/encyclopedia.json').write_text(json.dumps(enc,ensure_ascii=False,indent=2)+'\n')
