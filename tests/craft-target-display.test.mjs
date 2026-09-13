import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compactPartNotation,craftTargetMaterialsFor} from '../src/craft-panel.js';
const templates=JSON.parse(await readFile(new URL('../data/craft-structures.json',import.meta.url)));
const part=id=>templates.find(item=>item.id===id);
assert.equal(compactPartNotation(part('n-butyl')),'–C4H9','Long chain notation compacts while retaining the attachment dash');
assert.equal(compactPartNotation(part('hydroxyl')),'–OH','Short functional-group notation stays structural');
assert.equal(compactPartNotation(part('phenyl')),'–C₆H₅','Already compact notation is preserved');

const phenol={id:'phenol',atoms:['C','C','C','C','C','C','H','H','H','H','H','H','O']};
const hydroxyl={partId:'hydroxyl',template:part('hydroxyl')};
const fiveHydrogen=[...Array(6).fill('C'),...Array(5).fill('H'),'O'].map(element=>({element}));
assert.deepEqual(craftTargetMaterialsFor(phenol,fiveHydrogen,[hydroxyl]).map(item=>item.partId??item.element),['H'],'workspace atoms already reserved for the target are not requested again through a structural shortcut');
const completeAtoms=phenol.atoms.map(element=>({element}));
assert.deepEqual(craftTargetMaterialsFor(phenol,completeAtoms,[hydroxyl]),[],'all workspace atoms satisfy target material demand regardless of their current bond topology');
const ethanol={id:'ethanol',atoms:['C','C','O','H','H','H','H','H','H']};
const onlyCarbons=[{element:'C'},{element:'C'}];
assert.equal(craftTargetMaterialsFor(ethanol,onlyCarbons,[hydroxyl]).some(item=>item.partId==='hydroxyl'),true,'whole structural shortcuts remain available while their complete atom composition is still missing');

const craftPanelSource=await readFile(new URL('../src/craft-panel.js',import.meta.url),'utf8');
assert.doesNotMatch(craftPanelSource,/requestCraftHintHighlight|craft-target-hint|>ヒント</,'target materials no longer carry a redundant hint control');
assert.match(craftPanelSource,/craftTargetMaterialsFor\(record,placedAtoms,targetParts\?\?\[\]\)/,'target rendering derives shortage from atoms already reserved in the workspace');
console.log('Craft target display policy passed: compact notation, workspace-reserved material accounting and no redundant hint label.');
