import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {createCollectionState} from '../src/collection-state.js';
import {inventoryDepletion} from '../src/veil/map.js';
import {createUniverse} from '../src/veil/universe.js';

const memory=(entries=[])=>{const data=new Map(entries);return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),raw:key=>data.get(key)??null};};
const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));

test('resources.canUseElement is the gameplay authority and fails closed outside current CHO progression',()=>{
  const resources=createResources({storage:memory()});
  assert.equal(resources.canUseElement('H'),true);
  assert.equal(resources.canUseElement('C'),false);assert.equal(resources.canUseElement('O'),false);
  assert.equal(resources.findElement('C'),true);assert.equal(resources.findElement('O'),true);
  assert.equal(resources.canUseElement('C'),true);assert.equal(resources.canUseElement('O'),true);
  assert.equal(resources.findElement('N'),true,'N is a managed internal resource');
  for(const symbol of ['N','F','P','S','Cl','Xe',''])assert.equal(resources.canUseElement(symbol),false,(symbol||'empty')+' must not be gameplay-accessible');
});

test('collection discovery count cannot unlock N or rare elements',async()=>{
  const [records,groups,templates]=await Promise.all([json('../data/molecules.json'),json('../data/functional-groups.json'),json('../data/craft-structures.json')]);
  const resources=createResources({storage:memory()});resources.findElement('C');resources.findElement('O');
  const collection=createCollectionState({records,groups,templates,storage:null,elementAccess:symbol=>resources.canUseElement(symbol)});
  const cho=records.filter(record=>record.atoms.every(symbol=>['H','C','O'].includes(symbol))).slice(0,30);
  const structures=cho.map(record=>({complete:true,record,graph:record,signature:record.id}));collection.observeStructures(structures);
  assert.ok(collection.discoveredCount>=15);
  for(const symbol of ['N','Cl','S','P','F'])assert.equal(collection.canUseElement(symbol),false,symbol+' cannot unlock from discoveries');
});

test('N collection, expedition settlement and schema-v9 reload preserve BASE STOCK while N stays locked',()=>{
  const storage=memory(),resources=createResources({storage});
  resources.collect({N:7});assert.equal(resources.state.elements.N,7);assert.equal(resources.canUseElement('N'),false);assert.equal(resources.save(),true);
  const reloaded=createResources({storage});assert.equal(reloaded.state.elements.N,7);assert.equal(reloaded.canUseElement('N'),false);
  const settled=reloaded.settleExpedition({H:0,C:0,O:0,N:11},0,false);
  assert.equal(settled.atoms.N,11);assert.equal(reloaded.state.elements.N,18);assert.equal(reloaded.canUseElement('N'),false);assert.equal(reloaded.save(),true);
  const again=createResources({storage});assert.equal(again.state.elements.N,18);assert.equal(JSON.parse(storage.raw(RESOURCE_KEY)).schemaVersion,9);
});

test('N depletion is computable without spawning N in the current CHO FIELD',()=>{
  assert.equal(inventoryDepletion({N:120},'N'),0);assert.ok(inventoryDepletion({N:300},'N')>0);assert.equal(inventoryDepletion({N:450},'N'),1);
  const seed=0x4e17,base=createUniverse(seed,{H:0,C:0,O:0}),nRich=createUniverse(seed,{H:0,C:0,N:100000,O:0});
  const signature=map=>map.dust.map(({route,element,x,y,kind,value})=>[route,element,x,y,kind,value]);
  assert.deepEqual(signature(nRich),signature(base),'N stock must not change existing CHO particle generation');
  assert.equal(nRich.dust.some(d=>d.element==='N'),false,'Nitrogen FIELD dust is explicitly out of scope');
});
