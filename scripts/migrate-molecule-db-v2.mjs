import {readFile,writeFile,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url),cwd=fileURLToPath(root);
const file=path=>new URL(path,root);
const read=path=>readFile(file(path),'utf8');
const write=(path,text)=>writeFile(file(path),text);
const remove=async path=>{try{await unlink(file(path));}catch(error){if(error.code!=='ENOENT')throw error;}};
const run=(script,...args)=>execFileSync(process.execPath,[script,...args],{cwd,stdio:'inherit'});
const deletedIds=['sulfur-hexafluoride','isopentane','neopentane','1-pentene','2-pentene','o-xylene','m-xylene','chloroethane','1-propanol','isobutanol','propylene-glycol','1-4-dioxane','ethanethiol','butyraldehyde','isobutyraldehyde','2-pentanone','3-pentanone','isobutyric-acid','valeric-acid','methyl-formate','ethyl-formate','methyl-acetate','methyl-propionate','ethyl-propionate','ethylamine','formamide','propionamide','resorcinol','acetanilide','o-cresol','m-cresol','p-cresol','methyl-benzoate','ethyl-benzoate','n-butyl-acetate','isopropyl-acetate','cumene'];
const descriptionOverrides={
  cyclobutane:'4員環はsp3炭素の理想結合角から大きく外れるため環ひずみが大きい。完全な平面を避けて少し折れ曲がるがひずみは残り、シクロプロパン・シクロペンタン・シクロヘキサンとの比較で環サイズと安定性の違いが見える。',
  propyne:'端に三重結合を持つ小さなアルキン。三重結合部分はほぼ直線形で、末端水素を手がかりにC–C結合形成へ展開できる。propane/propeneとの結合次数比較にも向く。',
  '1-butyne':'鎖の端に三重結合を持つC4アルキン。2-butyneと比べ、三重結合が端か内部かで反応点が変わる。',
  '2-butyne':'鎖中央に三重結合を持つ対称なC4アルキン。末端水素を持たず、1-butyneとの位置異性比較に向く。',
  propionaldehyde:'propanalとも呼ばれるC3 aldehyde。酸化でpropionic acidへつながり、同式のacetoneとのaldehyde/ketone比較BRIDGEになる。',
  acetamide:'acetic acidのOHがNH2へ置換されたamide。水素結合とacid→amideの官能基変換を比較できる。',
  pyridine:'benzeneのCHを1つNへ置換した6員芳香族heterocycle。芳香族性を保ちつつNの孤立電子対が塩基性・配位性を与える。',
  'methyl-ethyl-ether':'Oを挟んでmethyl/ethyl基を持つ非対称ether。dimethyl ether→diethyl etherを1 carbon stepでつなぐ。',
  cyclohexene:'6員環に1本のC=C二重結合を持つシクロアルケン。水素化するとシクロヘキサンになり、さらに不飽和化したベンゼンと比べると環状炭化水素の結合次数と反応性の違いが見える。',
  'pyruvic-acid':'ピルビン酸はカルボキシ基とケトン基を同時に持つα-ケト酸。解糖系でグルコース分解の要所に現れ、乳酸やアラニンへ変換されるため、生体化学とカルボニル化学をつなぐ。',
  furan:'酸素1個を含む5員芳香族複素環。テトラヒドロフランとは同じO含有環でも芳香族性と不飽和度が異なり、バイオマス由来原料から得られるフラン化合物の基本骨格でもある。',
  'dimethyl-sulfoxide':'硫黄に酸素が結合したスルホキシドで、強い極性を持つ非プロトン性溶媒。硫化ジメチルの酸化体にあたり、有機反応の溶媒や生体試料の凍結保護などに広く使われる。',
};

// Promote the audited graph while dropping proposal/audit-only metadata.
const proposed=JSON.parse(await read('data/molecule-graph.proposed.json'));
const graph={schemaVersion:proposed.schemaVersion,graphRoots:proposed.graphRoots,nodeColumns:proposed.nodeColumns,familyCodes:proposed.familyCodes,roleCodes:proposed.roleCodes,sectorCodes:proposed.sectorCodes,branchCodes:proposed.branchCodes,relationCodes:proposed.relationCodes,affinityEncoding:proposed.affinityEncoding,nodes:proposed.nodes,edgeColumns:proposed.edgeColumns,edges:proposed.edges};
await write('data/molecule-graph.json',`${JSON.stringify(graph,null,2)}\n`);

// Keep the molecule generator canonical: build the four gap-fill structures, then emit only the audited production inventory.
let builder=await read('scripts/build-molecule-db.mjs');
const marker='const ids = new Set();';
if(!builder.includes(marker))throw Error('Molecule DB validation marker not found');
const productionBlock=`const PRODUCTION_EXCLUDED_MOLECULE_IDS = new Set(${JSON.stringify(deletedIds)});\n\n{\n  const graph = ring(6);\n  graph.bonds[0][2] = 2;\n  add({ id: 'cyclohexene', nameJa: 'シクロヘキセン', nameEn: 'Cyclohexene', category: 'cyclic-hydrocarbon', ...graph, iupacNameEn: 'Cyclohex-1-ene', learningNote: ${JSON.stringify(descriptionOverrides.cyclohexene)} });\n}\nadd({ id: 'pyruvic-acid', nameJa: 'ピルビン酸', nameEn: 'Pyruvic acid', category: 'carboxylic-acid', atoms: ['C','C','C','O','O','O'], bonds: [[0,1,1],[1,2,1],[1,3,2],[2,4,2],[2,5,1]], iupacNameEn: '2-Oxopropanoic acid', learningNote: ${JSON.stringify(descriptionOverrides['pyruvic-acid'])} });\nadd({ id: 'furan', nameJa: 'フラン', nameEn: 'Furan', category: 'ether-cyclic-ether', atoms: ['O','C','C','C','C'], bonds: [[0,1,1],[1,2,2],[2,3,1],[3,4,2],[4,0,1]], valences: {0:2}, iupacNameEn: 'Furan', learningNote: ${JSON.stringify(descriptionOverrides.furan)} });\nadd({ id: 'dimethyl-sulfoxide', nameJa: 'ジメチルスルホキシド', nameEn: 'Dimethyl sulfoxide', aliases: ['DMSO'], category: 'sulfur-compounds', atoms: ['C','S','C','O'], bonds: [[0,1,1],[1,2,1],[1,3,2]], valences: {1:4}, iupacNameEn: 'Dimethyl sulfoxide', learningNote: ${JSON.stringify(descriptionOverrides['dimethyl-sulfoxide'])} });\n\nfor (let index = molecules.length - 1; index >= 0; index--) {\n  if (PRODUCTION_EXCLUDED_MOLECULE_IDS.has(molecules[index].id)) molecules.splice(index, 1);\n}\nif (molecules.length !== 129) throw new Error(\`Production molecule inventory drifted: \${molecules.length}\`);\n\n`;
builder=builder.replace(marker,productionBlock+marker);
await write('scripts/build-molecule-db.mjs',builder);
run('scripts/build-molecule-db.mjs');

// Encyclopedia follows the canonical molecule DB while retaining the independent craft-part catalog.
const molecules=JSON.parse(await read('data/molecules.json')),oldEncyclopedia=JSON.parse(await read('data/encyclopedia.json'));
if(molecules.length!==129)throw Error(`Expected 129 generated molecules, got ${molecules.length}`);
const encyclopedia={...oldEncyclopedia,molecules:{}};
for(const [index,molecule] of molecules.entries()){
  const previous=oldEncyclopedia.molecules?.[molecule.id],description=descriptionOverrides[molecule.id]??previous?.description??molecule.learningNote;
  if(!description)throw Error(`Missing encyclopedia description: ${molecule.id}`);
  encyclopedia.molecules[molecule.id]={number:index+1,description};
}
await write('data/encyclopedia.json',`${JSON.stringify(encyclopedia,null,2)}\n`);

// Drop stale previews before invoking the official collection asset generator.
for(const id of deletedIds)await remove(`assets/models/molecule-${id}.svg`);
run('scripts/build-collection-assets.mjs');

// Hard save boundary: v7 and earlier resource saves reset rather than translate IDs/progression.
let resources=await read('src/veil/resources-persistence.js');
resources=resources.replace("import { performanceFor } from './molecule-roles.js';\n",'').replace("import { validatePersistedWorkspace,migrateWorkspaceSave } from '../workspace-migrations.js?v=1';","import { validatePersistedWorkspace } from '../workspace-migrations.js?v=1';").replace('export const SCHEMA_VERSION=7;','export const SCHEMA_VERSION=8;').replace('const emptyCollection=()=>({schemaVersion:2,','const emptyCollection=()=>({schemaVersion:3,').replace("if(!s||![1,2,3,4,5,6,7].includes(s.schemaVersion)||!s.elements||!ids(s.recipes)||!s.progress)throw Error('Invalid resources');","if(!s||s.schemaVersion!==SCHEMA_VERSION||!s.elements||!ids(s.recipes)||!s.progress)throw Error('Invalid resources');").replace('if(s.schemaVersion===7&&(!s.upgrades||![0,1,2].includes(s.upgrades.oxygenTank)))','if(s.schemaVersion>=7&&(!s.upgrades||![0,1,2].includes(s.upgrades.oxygenTank)))').replaceAll('s.schemaVersion===7?s.upgrades:{}','s.schemaVersion>=7?s.upgrades:{}');
const migrateStart=resources.indexOf('\nfunction migrate(old){'),parseStart=resources.indexOf('\nfunction parsePersistedResources(raw)');
if(migrateStart<0||parseStart<0||parseStart<=migrateStart)throw Error('Resource migration block not found');
resources=resources.slice(0,migrateStart)+resources.slice(parseStart);
const tailStart=resources.indexOf('function parsePersistedResources(raw)');
if(tailStart<0)throw Error('Resource persistence tail not found');
resources=resources.slice(0,tailStart)+`function parseResourceEnvelope(raw){if(typeof raw!=='string'||raw.length>3e6)throw Error('Invalid resources');const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object')throw Error('Invalid resources');return parsed;}\nfunction parsePersistedResources(raw){return validatePersistedState(parseResourceEnvelope(raw));}\nexport function migrateResourcesSave(raw){try{const persisted=parseResourceEnvelope(raw);return persisted.schemaVersion===SCHEMA_VERSION?validatePersistedState(persisted):createInitialResourcesState();}catch{return createInitialResourcesState();}}\nexport function loadPersistedResources(storage){let previous=storage?.getItem(RESOURCE_KEY)??null;if(!previous)return {state:null,previous:null};let envelope;try{envelope=parseResourceEnvelope(previous);}catch{const state=createInitialResourcesState();try{storage?.setItem(RESOURCE_KEY,serializeResourcesState(state));storage?.removeItem(COLLECTION_KEY);storage?.removeItem(WORKSPACE_STORAGE_KEY);previous=storage?.getItem(RESOURCE_KEY)??previous;}catch{}return {state,previous};}if(envelope.schemaVersion!==SCHEMA_VERSION){const state=createInitialResourcesState();try{storage?.setItem(RESOURCE_KEY,serializeResourcesState(state));storage?.removeItem(COLLECTION_KEY);storage?.removeItem(WORKSPACE_STORAGE_KEY);previous=storage?.getItem(RESOURCE_KEY)??previous;}catch{}return {state,previous};}let persisted=validatePersistedState(envelope);if(persisted.pendingReset){finishPendingResourcesReset(storage,persisted);previous=storage.getItem(RESOURCE_KEY);persisted=parsePersistedResources(previous);}return {state:persisted,previous};}\nexport function serializeResourcesState(state){if(state?.schemaVersion!==SCHEMA_VERSION)throw Error('Invalid resources schema');return JSON.stringify(validatePersistedState(state));}\n`;
await write('src/veil/resources-persistence.js',resources);
for(const path of ['src/collection-persistence.js','src/collection-state.js']){let text=await read(path);text=text.replace("collection-migrations.js?v=1","collection-migrations.js?v=2");await write(path,text);}

// Promote graph documentation and CI names to production terminology/source paths.
let design=await read('docs/molecule-graph-design.md');
const reduction=design.indexOf('The main reduction');
if(reduction<0)throw Error('Graph design summary marker not found');
design=`# Molecule Graph production design\n\n> Production source of truth: \`data/molecule-graph.json\`, paired 1:1 with \`data/molecules.json\`. The 162-entry legacy inventory was replaced by the audited 129-node graph in Molecule DB v2.\n\n## 1. Decision summary\n\nThe production database and discovery graph now contain **129 molecules / nodes** connected by **144 edges**. The migration applied the PR #176 audit outcome: RETAIN 117, REWRITE 8, DELETE 37, and ADD 4. The graph is one connected component, has no isolated nodes, a maximum direct-neighbor count of **6**, and a longest degree-2 corridor of **4**.\n\n`+design.slice(reduction);
design=design.replaceAll('data/molecule-graph.proposed.json','data/molecule-graph.json').replaceAll('docs/maps/molecule-graph-proposed.svg','docs/maps/molecule-graph.svg').replaceAll('this proposal','the production graph').replaceAll('This proposal','The production graph').replaceAll('compact proposal','compact graph').replaceAll('machine proposal','machine graph');
await write('docs/molecule-graph-design.md',design);
let audit=await read('docs/molecule-db-audit.md');audit=audit.replaceAll('data/molecule-graph.proposed.json','data/molecule-graph.json').replaceAll('docs/maps/molecule-graph-proposed.svg','docs/maps/molecule-graph.svg');await write('docs/molecule-db-audit.md',audit);
let workflow=await read('.github/workflows/repository-validation.yml');
workflow=workflow.replace(`      - name: Molecule graph proposal\n        run: |\n          node tests/molecule-graph-proposal.test.mjs\n          node scripts/export-molecule-graph-proposal.mjs --check`,`      - name: Production molecule graph\n        run: |\n          node tests/molecule-graph.test.mjs\n          node scripts/export-molecule-graph.mjs --check`);
workflow=workflow.replace(`      - name: CRAFT input recovery`,`      - name: Save schema boundaries\n        run: |\n          node tests/collection-persistence.test.mjs\n          node tests/resources-persistence.test.mjs\n      - name: CRAFT input recovery`);
await write('.github/workflows/repository-validation.yml',workflow);

for(const path of ['data/molecule-graph.proposed.json','docs/maps/molecule-graph-proposed.svg','scripts/export-molecule-graph-proposal.mjs','tests/molecule-graph-proposal.test.mjs'])await remove(path);
run('scripts/export-molecule-graph.mjs');
await remove('scripts/migrate-molecule-db-v2.mjs');
await remove('.github/workflows/molecule-db-v2-migration.yml');
run('scripts/build-precache.mjs');
console.log('Molecule DB v2 production migration complete.');
