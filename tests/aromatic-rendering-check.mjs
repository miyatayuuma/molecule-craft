import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {checkAromaticRendering} from './aromatic-rendering-checks.js';
import * as special from '../src/special-bonds.js?v=30';
import * as rendering from '../src/aromatic-rendering.js?v=26';
import {createPreviewModel} from '../src/preview-model.js?v=31';
if(!process.argv[2])throw new Error('Pass the path to three.module.js');
const THREE=await import(pathToFileURL(process.argv[2]));
const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url)));
console.log(checkAromaticRendering(THREE,await json('../data/molecules.json'),await json('../data/craft-structures.json')));

// Exercise the real workspace mesh builder with actual Three.js geometry.
// No WebGL or production-only test hooks are needed to count visible sticks.
const app=await readFile(new URL('../src/app.js?v=40',import.meta.url),'utf8');
const section=(start,end)=>app.slice(app.indexOf(`function ${start}(`),app.indexOf(`function ${end}(`));
const workspaceCode=[section('rebuildMoleculeMeshes','createAtomVisual'),section('createBondVisual','updateMoleculeTransforms'),section('createAromaticVisual','selectionHaloTexture'),section('disposeObject','resize')].join('\n');
const benzene=(await json('../data/molecules.json')).find(r=>r.id==='benzene');
const model=createPreviewModel(THREE,benzene);for(let i=0;i<220;i++)model.step();const view=model.snapshot();
const molecule={atoms:view.atoms,bonds:view.bonds.map(b=>({...b}))},original=JSON.stringify(molecule.bonds);
const scope={THREE,...rendering,...special,molecule,moleculeGroup:new THREE.Group(),atomVisuals:new Map(),bondVisuals:new Map(),electronVisuals:[],aromaticVisuals:[],sharedVisuals:[],renderTopologyDirty:true,
  solver:{snapshot:()=>({aromaticCycles:view.aromaticCycles})},createAtomVisual:()=>{},updateMoleculeTransforms:()=>{},pos:id=>view.atoms[id].point,bondKey:(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`};
runInNewContext(workspaceCode+'\nrebuildMoleculeMeshes();',scope);
assert.equal(scope.aromaticVisuals.length,1);
assert.equal([...scope.bondVisuals.values()].reduce((n,b)=>n+b.lines.length,0),12,'Benzene must have 6 C-C + 6 C-H sticks, not 15');
assert.equal(new Set([...scope.bondVisuals.values()].map(b=>b.baseColor)).size,1,'Ring edges have inconsistent colors');
assert.equal(JSON.stringify(molecule.bonds),original,'Renderer changed bond orders');
for(const visual of scope.aromaticVisuals)scope.updateAromaticVisual(visual);
assert.ok(scope.aromaticVisuals[0].ring.visible);
const retired=scope.moleculeGroup.children.flatMap(object=>object.isGroup?object.children:[object]);let disposed=0;
for(const object of retired)object.geometry?.addEventListener('dispose',()=>disposed++);
const cut=molecule.bonds.findIndex(b=>b.order===1&&view.atoms[b.a].element==='C'&&view.atoms[b.b].element==='C'),removed=molecule.bonds.splice(cut,1)[0];
scope.solver.snapshot=()=>({aromaticCycles:[]});scope.rebuildMoleculeMeshes();
assert.equal(scope.aromaticVisuals.length,0,'Old aromatic ring survived rebuild');
assert.equal([...scope.bondVisuals.values()].filter(b=>b.lines.length===2).length,3,'Opening ring did not restore three doubles');
assert.equal(disposed,retired.length,'Old bond/ring geometry leaked');
molecule.bonds.splice(cut,0,removed);scope.solver.snapshot=()=>({aromaticCycles:view.aromaticCycles});scope.rebuildMoleculeMeshes();
assert.equal(scope.aromaticVisuals.length,1,'Closing ring did not restore marker');
assert.equal([...scope.bondVisuals.values()].reduce((n,b)=>n+b.lines.length,0),12);
scope.disposeGroup(scope.moleculeGroup);
console.log('Workspace production mesh checks passed: uniform sticks, unchanged topology, break/restore and disposal.');
