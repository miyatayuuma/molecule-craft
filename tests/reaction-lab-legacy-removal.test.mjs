import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const removedModules=[
  'src/reaction-lab-polymer-cinematic.js',
  'src/polymer-growth-plan.js',
  'src/polymer-morphology-authority.js',
  'src/polymer-morphology-plan.js',
  'src/polymer-morphology-renderer.js',
  'src/polymer-morphology-bridge.js',
  'src/polymer-morphology-bridge-renderer.js',
];
const preservedPaths=[
  'src/reaction-lab-polymerization.js',
  'src/reaction-lab-polymer-presentation.js',
  'src/reaction-lab-discovery.js',
  'src/polymer-catalog.js',
  'src/polymer-encyclopedia.js',
  'scripts/polymer-fragment-authority.mjs',
  'scripts/polymer-structure-svg.mjs',
  'scripts/build-collection-assets.mjs',
  'data/polymer-fragment-authority.json',
  'data/polymer-encyclopedia.json',
];

async function walk(directory){
  const entries=await readdir(directory,{withFileTypes:true}),files=[];
  for(const entry of entries){const path=join(directory,entry.name);if(entry.isDirectory())files.push(...await walk(path));else if(entry.isFile())files.push(path);}
  return files;
}
async function exists(path){try{await stat(join(root,path));return true;}catch{return false;}}

for(const path of removedModules)assert.equal(await exists(path),false,`retired module is absent: ${path}`);
for(const path of preservedPaths)assert.equal(await exists(path),true,`current finite-polymer or Encyclopedia authority remains: ${path}`);

const retiredReferences=/reaction-lab-polymer-cinematic|polymer-growth-plan|polymer-morphology-(?:authority|plan|renderer|bridge(?:-renderer)?)/;
const productionFiles=[
  ...await walk(join(root,'src')),
  ...await walk(join(root,'scripts')),
  ...['index.html','styles.css','sw.js','precache-manifest.js'].map(path=>join(root,path)),
];
const imports=/(?:\bfrom\s*|\bimport\s*\()\s*(['"])([^'"]+)\1/g;
for(const file of productionFiles){
  const source=await readFile(file,'utf8'),path=relative(root,file);
  assert.doesNotMatch(source,retiredReferences,`production/build/PWA source has no retired-module reference: ${path}`);
  for(const match of source.matchAll(imports))assert.doesNotMatch(match[2],retiredReferences,`import graph has no retired module edge: ${path} → ${match[2]}`);
}

const viewer=await readFile(join(root,'src/reaction-lab-viewer.js'),'utf8');
for(const symbol of ['morphologyPreview','showMorphologyPreview','hideMorphologyPreview','morphologyCleanupStats','morphologyEnvironmentSnapshot','legacyPresentation','heroStrand','polymerFrameProfile']){
  assert.equal(viewer.includes(symbol),false,`viewer has no retired state or probe API: ${symbol}`);
}
console.log(`Legacy morphology removal validated: ${removedModules.length} modules absent, current authorities retained, and ${productionFiles.length} production/build/PWA files free of retired runtime references.`);
