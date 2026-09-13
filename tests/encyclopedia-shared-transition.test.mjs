import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/collection-ui.js',import.meta.url),'utf8');
const graphToDetail=source.match(/async function showMoleculeDetailFromGraph[\s\S]*?(?=\n  async function returnMoleculeDetailToGraph)/)?.[0]??'';
const detailToGraph=source.match(/async function returnMoleculeDetailToGraph[\s\S]*?(?=\n  function installDetailGraphReturn)/)?.[0]??'';
const sharedVisual=source.match(/async function createMoleculeSharedVisual[\s\S]*?(?=\n  async function animateMoleculeSharedElement)/)?.[0]??'';

assert.ok(graphToDetail&&detailToGraph&&sharedVisual,'shared-element transition functions must remain present');
assert.ok(graphToDetail.indexOf('createMoleculeSharedVisual')<graphToDetail.indexOf('renderBook()'),'Graph -> Detail must create the persistent molecule visual before the Graph UI is replaced');
assert.ok(detailToGraph.indexOf('createMoleculeSharedVisual')<detailToGraph.indexOf('fadeDetailChrome'),'Detail -> Graph must create the persistent molecule visual before Detail starts fading');
assert.ok(detailToGraph.indexOf('createMoleculeSharedVisual')<detailToGraph.indexOf('renderBook()'),'Detail -> Graph must keep a molecule visual alive before the Graph UI is rendered');
assert.match(sharedVisual,/sourceImage\?\.cloneNode\?\.\(false\)/,'Graph thumbnail should be cloned when possible so the already-loaded visual survives the handoff');
assert.match(sharedVisual,/document\.body\.append\(ghost\)[\s\S]*ghost\.decode/,'Detail -> Graph fallback image must be attached and decoded while the source model is still visible');
assert.match(graphToDetail,/if\(source&&ghost\)source\.style\.opacity='0'/,'Graph source is hidden only after a transition visual exists');
assert.match(detailToGraph,/if\(modelHost&&ghost\)modelHost\.style\.opacity='0'/,'Detail model is hidden only after a transition visual exists');

console.log('Encyclopedia shared transition passed: molecule visual is established before either source surface disappears.');
