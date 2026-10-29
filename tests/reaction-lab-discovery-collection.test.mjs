import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCollectionState,COLLECTION_STORAGE_KEY} from '../src/collection-state.js?v=38';
import {createReactionLabDiscoveryCoordinator} from '../src/reaction-lab-discovery.js?v=1';

const read=async path=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
const records=await read('data/molecules.json'),groups=await read('data/functional-groups.json'),templates=await read('data/craft-structures.json');
const byId=new Map(records.map(record=>[record.id,record]));
const event=(products,reactionId)=>({reactionId,pathwayId:`${reactionId}-pathway`,batchGeneration:2,products,productInstances:products.map((species,productIndex)=>({species,productIndex,instanceId:`${reactionId}-product-${productIndex}`}))});
function state(storage){return createCollectionState({records,groups,templates,storage,now:()=>991});}
function coordinator(collection,presented=[]){return createReactionLabDiscoveryCoordinator({records,collection,now:()=>991,isLabOpen:()=>false,getBatchGeneration:()=>2,present:({id})=>{presented.push(id);return true;},onDiagnostic:()=>{}});}

// Duplicate product instances stay distinct in the event; Collection registers their species once.
{
  const storage={getItem:()=>null,setItem(){}};const collection=state(storage),shown=[],discovery=coordinator({registerDiscoveredMolecule:(id,options)=>collection.registerDiscoveredMolecule(id,options),...collection},shown);
  const result=discovery.handleProductEvent(event(['acetic-acid','acetic-acid'],'complete-01-anhydride-hydrolysis'));
  assert.deepEqual(result.species,['acetic-acid']);assert.deepEqual(result.newSpecies,['acetic-acid']);
  assert.equal(collection.hasMolecule('acetic-acid'),true);assert.equal(discovery.snapshot().queue.length,1);
  assert.equal(discovery.snapshot().queue[0].productIds.length,2);assert.equal(discovery.snapshot().queue[0].firstProductIndex,0);
}

// Alcoholysis first discovers two unique products in product order, and only an unknown is queued in a mixed case.
{
  const collection=state({getItem:()=>null,setItem(){}}),wrapped={registerDiscoveredMolecule:(id,options)=>collection.registerDiscoveredMolecule(id,options)};
  const discovery=coordinator(wrapped),result=discovery.handleProductEvent(event(['ethyl-acetate','acetic-acid'],'complete-02-anhydride-alcoholysis'));
  assert.deepEqual(result.newSpecies,['ethyl-acetate','acetic-acid']);
  assert.deepEqual(discovery.snapshot().queue.map(item=>item.speciesId),['ethyl-acetate','acetic-acid']);
  assert.deepEqual(collection.groupSources('ester'),['ethyl-acetate']);assert.deepEqual(collection.groupSources('carboxyl'),['acetic-acid']);

  const mixed=state({getItem:()=>null,setItem(){}});mixed.registerDiscoveredMolecule('acetic-acid',{at:1});
  const mixedCoordinator=coordinator({registerDiscoveredMolecule:(id,options)=>mixed.registerDiscoveredMolecule(id,options)});
  mixedCoordinator.handleProductEvent(event(['ethyl-acetate','acetic-acid'],'complete-02-anhydride-alcoholysis'));
  assert.deepEqual(mixedCoordinator.snapshot().queue.map(item=>item.speciesId),['ethyl-acetate']);
}

// Direct registration from the Lab and complete CRAFT structures share motif/part sources and unlock thresholds.
{
  const reaction=state({getItem:()=>null,setItem(){}}),craft=state({getItem:()=>null,setItem(){}}),products=['ethyl-acetate','acetic-acid'];
  const discovery=coordinator({registerDiscoveredMolecule:(id,options)=>reaction.registerDiscoveredMolecule(id,options)});
  discovery.handleProductEvent(event(products,'parity-fixture'));
  for(const id of products){const record=byId.get(id);craft.observeStructures([{complete:true,record,graph:record,signature:`craft:${id}`}]);}
  for(const group of groups.filter(item=>['motif','part'].includes(item.learningRole)))assert.deepEqual(reaction.groupSources(group.id),craft.groupSources(group.id),`${group.id}: discovery sources match CRAFT completion`);
  assert.deepEqual(reaction.snapshot().unlockedStructures,craft.snapshot().unlockedStructures,'Part unlock eligibility uses the shared distinct-molecule source authority.');
}

// A successful existing Collection persistence write survives reload; only in-memory queue state is absent on reload.
{
  const memory=new Map(),storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
  const first=state(storage),discovery=coordinator({registerDiscoveredMolecule:(id,options)=>first.registerDiscoveredMolecule(id,options)});
  discovery.handleProductEvent(event(['acetic-acid','acetic-acid'],'reload-fixture'));
  const reloaded=state(storage);assert.equal(reloaded.hasMolecule('acetic-acid'),true);assert.ok(memory.has(COLLECTION_STORAGE_KEY));
  const afterReload=coordinator({registerDiscoveredMolecule:(id,options)=>reloaded.registerDiscoveredMolecule(id,options)});
  assert.deepEqual(afterReload.handleProductEvent(event(['acetic-acid','acetic-acid'],'reload-fixture')).newSpecies,[]);
  assert.deepEqual(afterReload.snapshot().queue,[],'A persisted discovery never reconstructs a NEW ENTRY presentation queue.');
}

// The canonical Collection keeps the in-memory registration when its established persistence write fails.
{
  const failed=state({getItem:()=>null,setItem(){throw Error('quota');}}),wrapped={registerDiscoveredMolecule:(id,options)=>failed.registerDiscoveredMolecule(id,options)};
  const discovery=coordinator(wrapped),result=discovery.handleProductEvent(event(['acetic-acid'],'storage-failure'));
  assert.deepEqual(result.newSpecies,['acetic-acid']);assert.equal(failed.hasMolecule('acetic-acid'),true);
  assert.match(failed.storageMessage,/保存できません/);assert.deepEqual(discovery.snapshot().queue.map(item=>item.speciesId),['acetic-acid']);
}

console.log('reaction-lab-discovery-collection.test.mjs: canonical Collection fixtures and parity passed');
