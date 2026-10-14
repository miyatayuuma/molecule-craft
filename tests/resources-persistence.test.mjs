import assert from 'node:assert/strict';
import {createResources,RESOURCE_KEY,RESET_CATEGORIES} from '../src/veil/resources.js';
import {SCHEMA_VERSION,UnsupportedFutureResourcesSchemaError,createInitialResourcesState,finishPendingResourcesReset,loadPersistedResources,migrateResourcesSave,serializeResourcesState} from '../src/veil/resources-persistence.js';
import {POLYMER_COLLECTION_STORAGE_KEY,clearPolymerCollectionSave,createPolymerCollectionPersistence} from '../src/polymer-collection-persistence.js';
import {COLLECTION_STORAGE_KEY,createCollectionPersistence} from '../src/collection-persistence.js';
import {WORKSPACE_STORAGE_KEY,createWorkspaceStorage} from '../src/workspace-persistence.js?v=1';
import {isFutureResourcesSchemaVersion} from '../src/veil/resources-persistence.js';

const memory=(entries=[])=>{const data=new Map(entries),operations=[];return {getItem(key){operations.push({type:'read',key});return data.get(key)??null;},setItem(key,value){value=String(value);operations.push({type:'write',key,value});data.set(key,value);},removeItem(key){operations.push({type:'remove',key});data.delete(key);},raw:key=>data.get(key)??null,operations,clearOperations(){operations.length=0;}};};

assert.equal(SCHEMA_VERSION,9,'legacy retirement requires a hard resource-save schema boundary');
const initial=createInitialResourcesState();
const emptyStorage=memory();assert.equal(loadPersistedResources(emptyStorage).state,null,'missing resources has no persisted default state');assert.deepEqual(emptyStorage.operations.filter(operation=>operation.type!=='read'),[],'missing resources does not create a storage entry during load');
for(const version of [1,2,3,4,5,6,7]){
  const legacy={...initial,schemaVersion:version,elements:{...initial.elements,H:999,C:500,O:250},recipes:['hydrogen','methane','oxygen','water'],progress:{...initial.progress,bestChain:99,runs:42,foundElements:['H','C','O'],regions:['veil','carbon','oxygen'],checkpoint:'oxygen',frontier:true,thermalStrainExperienced:true,driveThermalInterruptions:2}};
  assert.deepEqual(migrateResourcesSave(JSON.stringify(legacy)),initial,`schema v${version} must reset rather than migrate resource/progression state`);
  const storage=memory([[RESOURCE_KEY,JSON.stringify(legacy)],['molecule-craft.collection.v1',JSON.stringify({schemaVersion:2,discoveredMolecules:[{id:'water',at:1,order:1}]})],[POLYMER_COLLECTION_STORAGE_KEY,JSON.stringify({schemaVersion:1,discoveredPolymers:[{id:'polyethylene',at:1,order:1}]})]]);
  const loaded=loadPersistedResources(storage);
  assert.deepEqual(loaded.state,initial,`schema v${version} load must return clean initial resources without exception`);
  assert.equal(JSON.parse(storage.raw(RESOURCE_KEY)).schemaVersion,SCHEMA_VERSION,`schema v${version} reset must write the current resource schema`);
  assert.equal(storage.raw('molecule-craft.collection.v1'),null,`schema v${version} reset must discard incompatible collection discovery state`);
  assert.equal(storage.raw(POLYMER_COLLECTION_STORAGE_KEY),null,`schema v${version} reset must discard polymer discovery state too`);
}

const current={...createInitialResourcesState(),elements:{...initial.elements,H:311,C:144,O:92,N:8},recipes:['hydrogen','methane','oxygen','water'],hints:['water'],dust:{H:1,C:2,O:1},loadout:{drive:'hydrogen',cooling:true,tanks:{propellant:'hydrogen',fuel:'methane',oxidizer:'oxygen',coolant:'water',shock:null}},tanks:{propellant:{molecule:'hydrogen',amount:40},fuel:{molecule:'methane',amount:3},oxidizer:{molecule:'oxygen',amount:4},coolant:{molecule:'water',amount:2},shock:{molecule:null,amount:0}},progress:{...initial.progress,bestChain:7,runs:3,cleared:true,foundElements:['H','C','O'],regions:['veil','carbon','oxygen'],checkpoint:'oxygen',frontier:true,totalCollected:91,thermalStrainExperienced:true,driveThermalInterruptions:2}};
const serialized=serializeResourcesState(current);assert.deepEqual(JSON.parse(serialized),current,'current schema serialization preserves BASE STOCK, recipes, tanks, progression and loadout capability state');
const storage=memory([[RESOURCE_KEY,serialized]]),loaded=loadPersistedResources(storage);assert.deepEqual(loaded.state,current,'current schema direct load round-trips without normalization loss');
const resources=createResources({storage});assert.equal(resources.blocked,false);assert.deepEqual(resources.state,current,'runtime hydration preserves current save state');assert.equal(resources.save(),true,'current save remains writable');assert.deepEqual(JSON.parse(storage.raw(RESOURCE_KEY)),current,'normal save/reload keeps current state stable');

const legacyFrontier={...current,progress:{...current.progress,regions:['veil','carbon','oxygen','frontier'],checkpoint:'frontier'}};
const legacyFrontierStorage=memory([[RESOURCE_KEY,serializeResourcesState(legacyFrontier)]]),legacyFrontierLoaded=loadPersistedResources(legacyFrontierStorage);
assert.equal(legacyFrontierLoaded.state.progress.checkpoint,'oxygen','legacy frontier checkpoint must fall back to the most advanced valid launch region');
assert.ok(legacyFrontierLoaded.state.progress.regions.includes('frontier'),'historical frontier visit state remains available to progression logic');
assert.equal(JSON.parse(legacyFrontierStorage.raw(RESOURCE_KEY)).progress.checkpoint,'oxygen','legacy fallback must be persisted without a schema bump');
assert.equal(migrateResourcesSave(serializeResourcesState(legacyFrontier)).progress.checkpoint,'oxygen','current-schema migration helper normalizes the legacy destination too');

const malformedStorage=memory([[RESOURCE_KEY,'{broken'],[POLYMER_COLLECTION_STORAGE_KEY,JSON.stringify({schemaVersion:1,discoveredPolymers:[{id:'polyethylene',at:1,order:1}]})]]);const malformed=createResources({storage:malformedStorage});assert.equal(malformed.blocked,false,'corrupt persisted resource JSON resets rather than blank-screening or write-blocking');assert.deepEqual(malformed.state,initial);assert.equal(malformedStorage.raw(POLYMER_COLLECTION_STORAGE_KEY),null,'corrupt resource recovery clears the current polymer collection save');assert.equal(malformed.save(),true);
const pendingReset={...createInitialResourcesState(),resetEpoch:9,pendingReset:{collection:true,legacy:false,help:false}};
const pendingStorage=memory([[RESOURCE_KEY,JSON.stringify(pendingReset)],[POLYMER_COLLECTION_STORAGE_KEY,JSON.stringify({schemaVersion:1,discoveredPolymers:[{id:'polyethylene',at:1,order:1}]})]]);
const completedReset=loadPersistedResources(pendingStorage);assert.equal(completedReset.state.pendingReset,undefined,'pending collection reset completes on the next load');assert.equal(pendingStorage.raw(POLYMER_COLLECTION_STORAGE_KEY),null,'resumed collection reset clears polymer discovery too');
const futurePolymer=JSON.stringify({schemaVersion:2,discoveredPolymers:[{id:'future-polymer',at:1,order:1}],futureField:{keep:true}}),futureResetStorage=memory([[RESOURCE_KEY,'{broken'],[POLYMER_COLLECTION_STORAGE_KEY,futurePolymer]]);
loadPersistedResources(futureResetStorage);assert.equal(futureResetStorage.raw(POLYMER_COLLECTION_STORAGE_KEY),futurePolymer,'resource recovery never overwrites a future polymer schema');
assert.throws(()=>serializeResourcesState({...current,schemaVersion:7}),/schema/i,'egress rejects old resource schema states');

assert.equal(isFutureResourcesSchemaVersion(10),true);assert.equal(isFutureResourcesSchemaVersion(11),true);assert.equal(isFutureResourcesSchemaVersion(100),true);
assert.equal(isFutureResourcesSchemaVersion('10'),false,'schema values are not coerced from strings');assert.equal(isFutureResourcesSchemaVersion(9.5),false,'non-integer schema values retain the invalid-save contract');
const makeFutureRaw=version=>{
  const future={...current,schemaVersion:version,elements:{...current.elements,H:8765,C:4321},progress:{...current.progress,runs:88,foundElements:['H','C','O']},loadout:{...current.loadout,tanks:{...current.loadout.tanks,propellant:'hydrogen'}},engineering:{...current.engineering,fabricated:{...current.engineering.fabricated,WEAR_SKIN:true}},collectorShell:{...current.collectorShell,activeApplications:{...current.collectorShell.activeApplications,WEAR_SKIN:true}},futureAuthority:{resources:{revision:'v-next'},unknownInventory:{'Xx':17}}};
  return ` \n${JSON.stringify(future,null,2)}\n `;
};
const futureRelatedRaws=version=>new Map([
  [RESOURCE_KEY,makeFutureRaw(version)],
  [COLLECTION_STORAGE_KEY,` \n${JSON.stringify({schemaVersion:3,discoveredMolecules:[{id:'water',at:41,order:1}],discoveredGroups:[],unlockedStructures:[],legacyElements:['O'],milestones:['double-bond'],futureCollection:{v:version}})}\t`],
  [POLYMER_COLLECTION_STORAGE_KEY,`\n${JSON.stringify({schemaVersion:1,discoveredPolymers:[{id:'polyethylene',at:51,order:1}],futurePolymer:{v:version}})} `],
  [WORKSPACE_STORAGE_KEY,` ${JSON.stringify({schemaVersion:2,atoms:[],bonds:[],selected:null,focus:null,pivot:null,camera:{position:[0,0,1],target:[0,0,0],up:[0,1,0]},targetMoleculeId:null,futureWorkspace:{v:version}})}\n`],
  ['molecule-craft.help.v1',`future help state ${version}  \n`],
]);
for(const version of [10,11,100]){
  const entries=futureRelatedRaws(version),futureStorage=memory([...entries]);
  assert.throws(()=>loadPersistedResources(futureStorage),error=>error instanceof UnsupportedFutureResourcesSchemaError&&error.schemaVersion===version,`schema v${version} is explicitly unsupported as future data`);
  assert.throws(()=>migrateResourcesSave(entries.get(RESOURCE_KEY)),error=>error instanceof UnsupportedFutureResourcesSchemaError&&error.schemaVersion===version,`migration helper never silently converts schema v${version} to initial state`);
  for(const [key,raw]of entries)assert.equal(futureStorage.raw(key),raw,`${key} remains byte-for-byte intact for future schema v${version}`);
  assert.deepEqual(futureStorage.operations.filter(operation=>operation.type!=='read'),[],`schema v${version} performs no write or removal`);
}

const futureEntries=futureRelatedRaws(10),futureStorage=memory([...futureEntries]),futureStatus=[];
const futureResources=createResources({storage:futureStorage,onStatus:text=>futureStatus.push(text)});
assert.equal(futureResources.blocked,true);assert.equal(futureResources.blockedReason,'FUTURE_SCHEMA');assert.match(futureResources.message,/新しい版.*保護.*変更できません.*更新/);assert.equal(futureStatus.at(-1),futureResources.message,'unsupported schema reaches the existing status callback');
assert.equal(futureResources.save(),false);assert.equal(futureResources.spend({H:1}),false);assert.deepEqual(futureResources.collect(9),[]);assert.equal(futureResources.learn('hydrogen'),false);assert.equal(futureResources.setLoadoutTank('propellant','hydrogen'),false);assert.equal(futureResources.fillTankFromElements('propellant','hydrogen',1),false);assert.equal(futureResources.toggleApplication('WEAR_SKIN'),false);assert.equal(futureResources.engineeringEligibility('weave-thermal-shell').status,'STORAGE_BLOCKED');assert.equal(futureResources.fabricateEngineering('weave-thermal-shell').committed,false);assert.equal(futureResources.settleExpedition({H:9},0,false),null);
assert.equal(futureResources.reset(RESET_CATEGORIES).committed,false,'future-schema block cannot be bypassed by full reset');assert.equal(futureResources.reset(['elements']).committed,false,'future-schema block cannot be bypassed by category reset');
assert.equal(futureStorage.operations.some(operation=>operation.type!=='read'),false,'blocked runtime performs no storage write or removal');
for(const [key,raw]of futureEntries)assert.equal(futureStorage.raw(key),raw,`${key} remains raw-identical after runtime and reset attempts`);

const pendingState={...createInitialResourcesState(),pendingReset:{collection:true,legacy:true,help:true}},pendingFutureEntries=futureRelatedRaws(10),pendingFutureStorage=memory([...pendingFutureEntries]);pendingFutureStorage.clearOperations();
assert.throws(()=>finishPendingResourcesReset(pendingFutureStorage,pendingState),UnsupportedFutureResourcesSchemaError,'a pending v9 reset rechecks the current resources key before cross-key cleanup');
assert.deepEqual(pendingFutureStorage.operations.filter(operation=>operation.type!=='read'),[],'future resources block pending collection/workspace/help cleanup');
assert.equal(clearPolymerCollectionSave(pendingFutureStorage),false,'the standalone Polymer Collection cleanup helper also refuses future resources');assert.equal(pendingFutureStorage.raw(POLYMER_COLLECTION_STORAGE_KEY),pendingFutureEntries.get(POLYMER_COLLECTION_STORAGE_KEY));

const writerEntries=new Map([[RESOURCE_KEY,serialized]]),writerStorage=memory([...writerEntries]);
const writerCollectionRaw=JSON.stringify({schemaVersion:3,discoveredMolecules:[{id:'water',at:1,order:1}],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]});
const writerPolymerRaw=JSON.stringify({schemaVersion:1,discoveredPolymers:[{id:'polyethylene',at:2,order:1}]});
const writerWorkspace={schemaVersion:2,atoms:[],bonds:[],selected:null,focus:null,pivot:null,camera:{position:[0,0,1],target:[0,0,0],up:[0,1,0]},targetMoleculeId:null},writerWorkspaceRaw=JSON.stringify(writerWorkspace);
writerStorage.setItem(COLLECTION_STORAGE_KEY,writerCollectionRaw);writerStorage.setItem(POLYMER_COLLECTION_STORAGE_KEY,writerPolymerRaw);writerStorage.setItem(WORKSPACE_STORAGE_KEY,writerWorkspaceRaw);
const collectionWriter=createCollectionPersistence({storage:writerStorage,records:[{id:'water',atoms:['O','H','H']}],milestoneIds:[]});collectionWriter.load();
const polymerWriter=createPolymerCollectionPersistence({storage:writerStorage,polymerIds:['polyethylene']});polymerWriter.load();
const workspaceWriter=createWorkspaceStorage({storage:writerStorage});workspaceWriter.read();
const staleResourceWriter=createResources({storage:writerStorage});
writerStorage.setItem(RESOURCE_KEY,makeFutureRaw(10));writerStorage.clearOperations();
assert.equal(staleResourceWriter.save(),false,'a tab loaded on v9 cannot overwrite resources after another tab upgrades to v10');
assert.equal(staleResourceWriter.reset(RESET_CATEGORIES).committed,false,'an old tab cannot reset a newly upgraded resources save');
assert.equal(collectionWriter.save(JSON.parse(writerCollectionRaw)),false,'Collection writer checks future resources at the write boundary');
assert.equal(polymerWriter.save(JSON.parse(writerPolymerRaw)),false,'Polymer Collection writer checks future resources at the write boundary');
assert.equal(workspaceWriter.write(writerWorkspace),false,'Workspace writer checks future resources at the write boundary');
assert.equal(collectionWriter.storageMessage.includes('新しい版'),true);assert.equal(polymerWriter.storageMessage.includes('新しい版'),true);assert.match(workspaceWriter.message,/新しい版/);
assert.throws(()=>staleResourceWriter.workspaceAdapter.setItem(WORKSPACE_STORAGE_KEY,writerWorkspaceRaw),error=>error instanceof Error,'resources workspace adapter cannot commit after a future upgrade');
assert.equal(writerStorage.operations.some(operation=>operation.type==='write'||operation.type==='remove'),false,'old-tab save attempts do not write or remove any key');
assert.equal(writerStorage.raw(RESOURCE_KEY),makeFutureRaw(10));assert.equal(writerStorage.raw(COLLECTION_STORAGE_KEY),writerCollectionRaw);assert.equal(writerStorage.raw(POLYMER_COLLECTION_STORAGE_KEY),writerPolymerRaw);assert.equal(writerStorage.raw(WORKSPACE_STORAGE_KEY),writerWorkspaceRaw);

console.log('Resources persistence v9 passed: v1-v7 reset cleanly and current BASE STOCK/progression/capability state round-trips.');
