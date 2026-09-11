import assert from 'node:assert/strict';
import {CURRENT_COLLECTION_SCHEMA_VERSION,migrateCollectionSave} from '../src/collection-migrations.js';
import {COLLECTION_STORAGE_KEY,createCollectionPersistence} from '../src/collection-persistence.js';

const records=[
  {id:'methanol',atoms:['C','O','H','H','H','H']},
  {id:'methane',atoms:['C','H','H','H','H']},
  {id:'sulfur-hexafluoride',atoms:['S','F','F','F','F','F','F']},
];
const milestoneIds=['double-bond','ring'];
const migrate=saved=>migrateCollectionSave(saved,{records,milestoneIds});
const memory=(entries=[])=>{
  const data=new Map(entries),writes=[];
  return {getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value);writes.push([key,value]);},raw:key=>data.get(key)??null,writes};
};

assert.deepEqual(migrate({
  schemaVersion:2,
  discoveredMolecules:[{id:'methanol',at:25,order:99},{id:'methane',at:null,order:40}],
  discoveredGroups:[{id:'forged',sources:['methanol']}],
  unlockedStructures:['forged'],
  legacyElements:['F','bogus','F'],
  milestones:['ring','forged','ring'],
}),{
  schemaVersion:CURRENT_COLLECTION_SCHEMA_VERSION,
  discoveredMolecules:[{id:'methanol',at:25,order:1},{id:'methane',at:null,order:2}],
  legacyElements:['F'],
  milestones:['ring'],
},'current saves normalize to the canonical runtime ingress and derived persisted fields are not trusted');

assert.deepEqual(migrate({schemaVersion:0,discoveredMoleculeIds:['methanol']}),{
  schemaVersion:2,
  discoveredMolecules:[{id:'methanol',at:null,order:1}],
  legacyElements:['C','O','H'],
  milestones:[],
},'legacy discoveredMoleculeIds remain accepted and restore the elements actually used by valid discoveries');

assert.deepEqual(migrate({schemaVersion:1,discoveredMolecules:[{id:'sulfur-hexafluoride'}],unlockedElements:['P']}),{
  schemaVersion:2,
  discoveredMolecules:[{id:'sulfur-hexafluoride',at:null,order:1}],
  legacyElements:['S','F'],
  milestones:[],
},'current main derives legacy element grants from valid legacy discoveries; stale unlockedElements is not a discovery source');

assert.deepEqual(migrate({schemaVersion:2,discoveredMolecules:[],discoveredMoleculeIds:['methane'],legacyElements:[],milestones:[]}).discoveredMolecules,[],
  'when current and legacy discovery fields coexist, current discoveredMolecules keeps the existing nullish-precedence contract');

assert.deepEqual(migrate({schemaVersion:1,discoveredMolecules:[{id:'methanol',at:7},{id:'methanol',at:9},{id:'removed'},{id:null},'methane']}).discoveredMolecules,[
  {id:'methanol',at:7,order:1},{id:'methane',at:null,order:2},
],'duplicate ids keep the first valid occurrence and unknown/invalid ids are ignored');

const malformedRaw='{broken',malformedStorage=memory([[COLLECTION_STORAGE_KEY,malformedRaw]]),malformed=createCollectionPersistence({storage:malformedStorage,records,milestoneIds});
assert.equal(malformed.load(),null);assert.equal(malformedStorage.raw(COLLECTION_STORAGE_KEY),malformedRaw);assert.equal(malformedStorage.writes.length,0);
assert.match(malformed.storageMessage,/読み取れなかった/,'malformed JSON keeps the current recoverable-message contract without eager rewrite');

const unknownRaw=JSON.stringify({schemaVersion:2,discoveredMolecules:[{id:'removed'},{id:'methanol'}],legacyElements:[],milestones:[]}),unknownStorage=memory([[COLLECTION_STORAGE_KEY,unknownRaw]]),unknown=createCollectionPersistence({storage:unknownStorage,records,milestoneIds});
assert.deepEqual(unknown.load()?.discoveredMolecules,[{id:'methanol',at:null,order:1}]);assert.equal(unknownStorage.raw(COLLECTION_STORAGE_KEY),unknownRaw);assert.equal(unknownStorage.writes.length,0,
  'unknown ids are filtered from runtime ingress but loading alone does not rewrite the saved raw value');

const unavailableRaw=JSON.stringify({schemaVersion:2,discoveredMolecules:[{id:'methanol',at:10,order:1}],legacyElements:[],milestones:[]}),unavailableStorage=memory([[COLLECTION_STORAGE_KEY,unavailableRaw]]),unavailable=createCollectionPersistence({storage:unavailableStorage,records:[],milestoneIds});
assert.equal(unavailable.load()?.discoveredMolecules.length,0);assert.equal(unavailableStorage.raw(COLLECTION_STORAGE_KEY),unavailableRaw);assert.equal(unavailableStorage.writes.length,0,
  'an unavailable catalog cannot destroy persisted discovery raw data; Issue #119 keeps consumers outside this ingress until DB ready');

const writableStorage=memory(),writable=createCollectionPersistence({storage:writableStorage,records,milestoneIds});writable.load();
const currentSnapshot={schemaVersion:2,discoveredMolecules:[{id:'methanol',at:1,order:1}],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]};
assert.equal(writable.save(currentSnapshot),true);assert.deepEqual(JSON.parse(writableStorage.raw(COLLECTION_STORAGE_KEY)),currentSnapshot,'egress writes the current persisted shape only');
const beforeLegacyAttempt=writableStorage.raw(COLLECTION_STORAGE_KEY);assert.equal(writable.save({...currentSnapshot,schemaVersion:1}),false);assert.equal(writableStorage.raw(COLLECTION_STORAGE_KEY),beforeLegacyAttempt,'egress refuses legacy schema output');

const resetStorage=memory([['molecule-craft.resources.v1',JSON.stringify({resetEpoch:3})],[COLLECTION_STORAGE_KEY,JSON.stringify(currentSnapshot)]]),resetPersistence=createCollectionPersistence({storage:resetStorage,records,milestoneIds});
assert.equal(resetPersistence.load()?.discoveredMolecules.length,1);resetStorage.setItem('molecule-craft.resources.v1',JSON.stringify({resetEpoch:4}));
const beforeResetConflict=resetStorage.raw(COLLECTION_STORAGE_KEY);assert.equal(resetPersistence.save(currentSnapshot),false);assert.equal(resetStorage.raw(COLLECTION_STORAGE_KEY),beforeResetConflict);assert.match(resetPersistence.storageMessage,/初期化/);

console.log('Collection persistence migration tests passed: current/legacy ingress, element compatibility, precedence, duplicates, malformed/unknown ids, DB-unavailable raw preservation, current-only egress and reset protection.');
