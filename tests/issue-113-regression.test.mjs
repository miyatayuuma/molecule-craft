import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {Molecule,loadMoleculeDatabase,moleculeCatalog,moleculeDatabaseStatus} from '../src/chemistry.js?v=20';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {createCollectionState,COLLECTION_STORAGE_KEY} from '../src/collection-state.js';
import {validateFunctionalGroups} from '../src/functional-groups.js';
import {validateCraftStructures} from '../src/craft-structures.js?v=31';
import {installEmptyDeparturePolicy} from '../src/craft-connections.js?v=3';
import {unfinishedCraftIds} from '../src/pending-craft.js?v=1';

const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url)));
const database=await json('../data/molecules.json');
const groups=validateFunctionalGroups(await json('../data/functional-groups.json'));
const templates=validateCraftStructures(await json('../data/craft-structures.json'),groups);
const USES=['propellant','fuel','oxidizer','coolant'];
const REQUIRED=['hydrogen','methane','oxygen','water','carbon-dioxide'];
const discovered=[...REQUIRED,...database.map(record=>record.id).filter(id=>!REQUIRED.includes(id))].slice(0,30);
const unfinished=database.map(record=>record.id).filter(id=>!discovered.includes(id)).slice(0,2);
const undiscovered=database.find(record=>!discovered.includes(record.id)&&!unfinished.includes(record.id))?.id;
assert.equal(discovered.length,30);assert.equal(unfinished.length,2);assert.ok(undiscovered);

const memory=(entries=[])=>{
  const data=new Map(entries);
  return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),dump:()=>new Map(data)};
};
const makeResponse=()=>new Response(JSON.stringify(database),{status:200,headers:{'content-type':'application/json'}});
const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;
try{
  let networkCalls=0;
  globalThis.fetch=async()=>{networkCalls++;throw new Error('simulated network database outage');};
  globalThis.caches={match:async()=>makeResponse()};
  const recovered=await loadMoleculeDatabase(new URL('https://example.test/data/molecules.json'));
  assert.equal(recovered.ok,true);assert.equal(recovered.source,'precache');assert.equal(recovered.count,database.length);assert.equal(networkCalls,1);
  assert.equal(moleculeDatabaseStatus().loaded,true);

  const methane=database.find(record=>record.id==='methane'),model=new Molecule(),ids=methane.atoms.map(element=>model.addAtom(element).id);
  for(const [a,b,order]of methane.bonds)model.setBond(ids[a],ids[b],order);
  assert.equal(model.recognizedMolecule()?.id,'methane','a registered molecule must remain recognized when network DB loading falls back to the verified cache');

  let retryCalls=0;globalThis.caches=undefined;
  globalThis.fetch=async()=>{retryCalls++;if(retryCalls===1)throw new Error('first request failed');return makeResponse();};
  const retried=await loadMoleculeDatabase(new URL('https://example.test/data/molecules.json'));
  assert.equal(retried.ok,true);assert.equal(retried.source,'network-retry');assert.equal(retryCalls,2);
}finally{
  globalThis.fetch=originalFetch;
  if(originalCaches===undefined)delete globalThis.caches;else globalThis.caches=originalCaches;
}

function seedSavedProgress(){
  const storage=memory(),resources=createResources({storage});resources.setCatalog(moleculeCatalog());
  for(const id of discovered)assert.equal(resources.discover(id),true,id);
  for(const id of unfinished)assert.equal(resources.hint(id),true,id);
  Object.assign(resources.state.elements,{H:800,C:500,O:800});
  const loadout={propellant:'hydrogen',fuel:'methane',oxidizer:'oxygen',coolant:'water'};
  for(const use of USES)assert.equal(resources.setLoadoutTank(use,loadout[use]),true,use);
  assert.equal(resources.save(),true);
  storage.setItem(COLLECTION_STORAGE_KEY,JSON.stringify({schemaVersion:2,discoveredMolecules:discovered.map((id,index)=>({id,at:1700000000000+index,order:index+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]}));
  return storage.dump();
}
const saved=seedSavedProgress();
const workspace={schemaVersion:2,atoms:[{element:'H',position:[0,0,0]}],bonds:[],selected:0,focus:0,pivot:[0,0,0],targetMoleculeId:'hydrogen',camera:{position:[5.2,4,7.6],target:[0,0,0],up:[0,1,0]}};

for(const withWorkspace of [false,true]){
  const entries=new Map(saved),resourceState=JSON.parse(entries.get(RESOURCE_KEY));resourceState.workspace=withWorkspace?workspace:null;entries.set(RESOURCE_KEY,JSON.stringify(resourceState));
  const storage=memory(entries),collectionBefore=storage.getItem(COLLECTION_STORAGE_KEY),resources=createResources({storage});resources.setCatalog(moleculeCatalog());
  const collection=createCollectionState({records:moleculeCatalog(),groups,templates,storage,elementAccess:()=>true});

  assert.equal(collection.discoveredCount,30,`saved collection count must survive hydrate (workspace=${withWorkspace})`);
  for(const id of discovered)assert.equal(collection.hasMolecule(id),true,id);
  for(const id of unfinished)assert.equal(collection.hasMolecule(id),false,id);
  assert.equal(collection.hasMolecule(undiscovered),false);
  assert.deepEqual(unfinishedCraftIds(resources.state),unfinished,'completed / discovered-unfinished must remain distinct');

  for(const use of USES){
    const expected=discovered.filter(id=>resources.tankUses(id).includes(use)).sort(),actual=resources.tankCatalog(use).map(record=>record.id).sort();
    assert.deepEqual(actual,expected,`${use} candidates must be the discovered eligible molecules after full catalog hydrate`);
  }

  for(const id of Object.values(resources.selectedLoadout())){
    const record=resources.record(id);assert.equal(record?.id,id);assert.ok(Array.isArray(record.bonds),`${id} must resolve to the full molecule DB record`);
    await access(new URL(`../assets/models/molecule-${id}.svg`,import.meta.url));
  }

  assert.equal(resources.setLoadoutTank('propellant','carbon-dioxide'),true);
  assert.equal(storage.getItem(COLLECTION_STORAGE_KEY),collectionBefore,'LOADOUT selection must not rewrite collection progress');
  installEmptyDeparturePolicy(resources);
  const plan=resources.launchFillPlan();assert.equal(plan.invalid.length,0);assert.notEqual(plan.status,'IMPOSSIBLE','saved LOADOUT must reach launch preparation after DB recovery');
  const launched=resources.commitLaunchFill({partial:plan.status==='PARTIAL'});assert.ok(launched?.committed,'launch fill must commit without clearing saved progress');
  assert.equal(storage.getItem(COLLECTION_STORAGE_KEY),collectionBefore);

  const reloadedResources=createResources({storage});reloadedResources.setCatalog(moleculeCatalog());
  const reloadedCollection=createCollectionState({records:moleculeCatalog(),groups,templates,storage,elementAccess:()=>true});
  assert.equal(reloadedCollection.discoveredCount,30,'reload must preserve the same discovery count');
  assert.equal(reloadedResources.selectedLoadout().propellant,'carbon-dioxide','reload must preserve LOADOUT selection');
  assert.deepEqual(unfinishedCraftIds(reloadedResources.state),unfinished,'reload must preserve unfinished discovery hints');
}

console.log('Issue #113 regression passed: DB cache/retry recovery, known-molecule recognition, 30-discovery saved-state hydrate, role candidates, model IDs/assets, launch preparation/commit, workspace variants and reload preservation.');