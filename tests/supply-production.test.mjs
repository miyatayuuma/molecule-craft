import assert from 'node:assert/strict';
import {createResources} from '../src/veil/resources.js';
import {compressedAtoms} from '../src/veil/supply.js';

const memory=()=>{const data=new Map();let reject=false;return {getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(reject)throw Error('quota');data.set(key,value);},removeItem:key=>data.delete(key),reject(value=true){reject=value;}};};

const storage=memory(),resources=createResources({storage});resources.collect({H:41,C:10,O:8},0);resources.discover('methane');resources.discover('oxygen');resources.save();
assert.equal(resources.maxCraftable('methane'),10,'MAX uses the limiting element');
assert.deepEqual(resources.costFor('methane',7),{C:7,H:28});
const before={...resources.state.elements};assert.ok(resources.produceMolecule('methane',7));
assert.equal(resources.state.elements.C,before.C-7);assert.equal(resources.state.elements.H,before.H-28);assert.equal(resources.state.molecules.methane,7);
assert.equal(resources.maxCraftable('methane'),3);
const insufficient=resources.snapshot();assert.equal(resources.produceMolecule('methane',4),false);assert.deepEqual(resources.snapshot(),insufficient,'An unaffordable batch is a no-op');
assert.ok(resources.produceMolecule('oxygen',4));assert.equal(resources.state.elements.O,0);assert.equal(resources.state.molecules.oxygen,4);

const failed=resources.snapshot();storage.reject();assert.equal(resources.produceMolecule('methane',1),false);assert.deepEqual(resources.snapshot(),failed,'A failed durable save rolls the whole batch back');

const atoms=compressedAtoms({C:50,H:200});assert.equal(atoms.length,12);assert.ok(atoms.includes('C')&&atoms.includes('H'));assert.ok(atoms.filter(x=>x==='H').length>atoms.filter(x=>x==='C').length,'Compressed animation preserves the rough recipe ratio');
assert.deepEqual(compressedAtoms({O:2}),['O','O']);

console.log('Quantity production passed: MAX, preview cost, limiting stock, atomic batch mutation/save rollback, and capped representative atoms.');
