import assert from 'node:assert/strict';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {SCHEMA_VERSION,createInitialResourcesState,loadPersistedResources,migrateResourcesSave,serializeResourcesState} from '../src/veil/resources-persistence.js';

const memory=(entries=[])=>{const data=new Map(entries);return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),raw:key=>data.get(key)??null};};

assert.equal(SCHEMA_VERSION,8,'molecule DB v2 requires a hard resource-save schema boundary');
const initial=createInitialResourcesState();
for(const version of [1,2,3,4,5,6,7]){
  const legacy={...initial,schemaVersion:version,elements:{...initial.elements,H:999,C:500,O:250},recipes:['hydrogen','methane','oxygen','water'],progress:{...initial.progress,bestChain:99,runs:42,foundElements:['H','C','O'],regions:['veil','carbon','oxygen'],checkpoint:'oxygen',frontier:true,thermalStrainExperienced:true,driveThermalInterruptions:2}};
  assert.deepEqual(migrateResourcesSave(JSON.stringify(legacy)),initial,`schema v${version} must reset rather than migrate resource/progression state`);
  const storage=memory([[RESOURCE_KEY,JSON.stringify(legacy)],['molecule-craft.collection.v1',JSON.stringify({schemaVersion:2,discoveredMolecules:[{id:'water',at:1,order:1}]})]]);
  const loaded=loadPersistedResources(storage);
  assert.deepEqual(loaded.state,initial,`schema v${version} load must return clean initial resources without exception`);
  assert.equal(JSON.parse(storage.raw(RESOURCE_KEY)).schemaVersion,SCHEMA_VERSION,`schema v${version} reset must write the current resource schema`);
  assert.equal(storage.raw('molecule-craft.collection.v1'),null,`schema v${version} reset must discard incompatible collection discovery state`);
}

const current={...createInitialResourcesState(),upgrades:{oxygenTank:1},elements:{...initial.elements,H:311,C:144,O:92,N:8},recipes:['hydrogen','methane','oxygen','water'],hints:['water'],dust:{H:1,C:2,O:1},loadout:{drive:'hydrogen',cooling:true,tanks:{propellant:'hydrogen',fuel:'methane',oxidizer:'oxygen',coolant:'water'}},tanks:{propellant:{molecule:'hydrogen',amount:40},fuel:{molecule:'methane',amount:3},oxidizer:{molecule:'oxygen',amount:4},coolant:{molecule:'water',amount:2}},progress:{...initial.progress,bestChain:7,runs:3,cleared:true,foundElements:['H','C','O'],regions:['veil','carbon','oxygen'],checkpoint:'oxygen',frontier:true,totalCollected:91,thermalStrainExperienced:true,driveThermalInterruptions:2}};
const serialized=serializeResourcesState(current);assert.deepEqual(JSON.parse(serialized),current,'current schema serialization preserves BASE STOCK, recipes, tanks, progression and loadout capability state');
const storage=memory([[RESOURCE_KEY,serialized]]),loaded=loadPersistedResources(storage);assert.deepEqual(loaded.state,current,'current schema direct load round-trips without normalization loss');
const resources=createResources({storage});assert.equal(resources.blocked,false);assert.deepEqual(resources.state,current,'runtime hydration preserves current save state');assert.equal(resources.save(),true,'current save remains writable');assert.deepEqual(JSON.parse(storage.raw(RESOURCE_KEY)),current,'normal save/reload keeps current state stable');

const malformedStorage=memory([[RESOURCE_KEY,'{broken']]);const malformed=createResources({storage:malformedStorage});assert.equal(malformed.blocked,false,'corrupt persisted resource JSON resets rather than blank-screening or write-blocking');assert.deepEqual(malformed.state,initial);assert.equal(malformed.save(),true);
assert.throws(()=>serializeResourcesState({...current,schemaVersion:7}),/schema/i,'egress rejects old resource schema states');

console.log('Resources persistence v8 passed: v1-v7 reset cleanly and current BASE STOCK/progression/capability state round-trips.');
