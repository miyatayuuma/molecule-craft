import assert from 'node:assert/strict';
import {CURRENT_COLLECTION_SCHEMA_VERSION,migrateCollectionSave} from '../src/collection-migrations.js';
import {COLLECTION_STORAGE_KEY,createCollectionPersistence} from '../src/collection-persistence.js';

const records=[
  {id:'methanol',atoms:['C','O','H','H','H','H']},
  {id:'methane',atoms:['C','H','H','H','H']},
  {id:'water',atoms:['O','H','H']},
];
const milestoneIds=['double-bond','ring'];
const migrate=saved=>migrateCollectionSave(saved,{records,milestoneIds});
const memory=(entries=[])=>{
  const data=new Map(entries),writes=[];
  return {getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value);writes.push([key,value]);},removeItem:key=>data.delete(key),raw:key=>data.get(key)??null,writes};
};

assert.equal(CURRENT_COLLECTION_SCHEMA_VERSION,3,'molecule DB v2 requires a collection schema boundary');
for(const legacy of [
  {schemaVersion:0,discoveredMoleculeIds:['methanol']},
  {schemaVersion:1,discoveredMolecules:[{id:'methanol'}]},
  {schemaVersion:2,discoveredMolecules:[{id:'methanol',at:25,order:1}],legacyElements:['C','O'],milestones:['ring']},
])assert.equal(migrate(legacy),null,`legacy collection schema ${legacy.schemaVersion} must reset instead of migrating discoveries`);

const current={
  schemaVersion:CURRENT_COLLECTION_SCHEMA_VERSION,
  discoveredMolecules:[{id:'methanol',at:25,order:99},{id:'methane',at:null,order:40}],
  discoveredGroups:[{id:'derived',sources:['methanol']}],
  unlockedStructures:['derived'],
  legacyElements:['O','bogus','O'],
  milestones:['ring','forged','ring'],
};
assert.deepEqual(migrate(current),{
  schemaVersion:CURRENT_COLLECTION_SCHEMA_VERSION,
  discoveredMolecules:[{id:'methanol',at:25,order:1},{id:'methane',at:null,order:2}],
  legacyElements:['O'],
  milestones:['ring'],
},'current saves normalize only canonical persisted collection fields');

const legacyRaw=JSON.stringify({schemaVersion:2,discoveredMolecules:[{id:'methanol',at:10,order:1}],legacyElements:['O'],milestones:['ring']}),legacyStorage=memory([[COLLECTION_STORAGE_KEY,legacyRaw]]),legacyPersistence=createCollectionPersistence({storage:legacyStorage,records,milestoneIds});
assert.equal(legacyPersistence.load(),null,'old collection save loads as clean initial state');
assert.equal(legacyStorage.raw(COLLECTION_STORAGE_KEY),legacyRaw,'collection load does not need a migration rewrite to reset runtime state');

const malformedRaw='{broken',malformedStorage=memory([[COLLECTION_STORAGE_KEY,malformedRaw]]),malformed=createCollectionPersistence({storage:malformedStorage,records,milestoneIds});
assert.equal(malformed.load(),null);assert.match(malformed.storageMessage,/読み取れなかった/,'malformed JSON remains recoverable without startup exception');

const writableStorage=memory(),writable=createCollectionPersistence({storage:writableStorage,records,milestoneIds});writable.load();
const currentSnapshot={schemaVersion:CURRENT_COLLECTION_SCHEMA_VERSION,discoveredMolecules:[{id:'methanol',at:1,order:1},{id:'water',at:2,order:2}],discoveredGroups:[],unlockedStructures:[],legacyElements:['O'],milestones:['ring']};
assert.equal(writable.save(currentSnapshot),true);assert.deepEqual(JSON.parse(writableStorage.raw(COLLECTION_STORAGE_KEY)),currentSnapshot,'current schema egress persists discovery state');
const reloaded=createCollectionPersistence({storage:writableStorage,records,milestoneIds});
assert.deepEqual(reloaded.load(),{schemaVersion:CURRENT_COLLECTION_SCHEMA_VERSION,discoveredMolecules:currentSnapshot.discoveredMolecules,legacyElements:['O'],milestones:['ring']},'current schema save/reload retains canonical discovery progress');
const beforeOldAttempt=writableStorage.raw(COLLECTION_STORAGE_KEY);assert.equal(writable.save({...currentSnapshot,schemaVersion:2}),false);assert.equal(writableStorage.raw(COLLECTION_STORAGE_KEY),beforeOldAttempt,'egress refuses incompatible schema output');

const resetStorage=memory([['molecule-craft.resources.v1',JSON.stringify({resetEpoch:3})],[COLLECTION_STORAGE_KEY,JSON.stringify(currentSnapshot)]]),resetPersistence=createCollectionPersistence({storage:resetStorage,records,milestoneIds});
assert.equal(resetPersistence.load()?.discoveredMolecules.length,2);resetStorage.setItem('molecule-craft.resources.v1',JSON.stringify({resetEpoch:4}));
assert.equal(resetPersistence.save(currentSnapshot),false);assert.match(resetPersistence.storageMessage,/初期化/,'resource reset epoch still prevents stale collection writes');

console.log('Collection persistence v3 passed: incompatible saves reset cleanly and current discovery state round-trips.');
