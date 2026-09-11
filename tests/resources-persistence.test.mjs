import assert from 'node:assert/strict';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {SCHEMA_VERSION,migrateResourcesSave,serializeResourcesState} from '../src/veil/resources-persistence.js';

const progress={bestChain:7,runs:3,cleared:false,foundElements:['H','C','O'],regions:['veil'],checkpoint:'veil',frontier:false,totalCollected:19,signalMisses:1,signalLast:{veil:4}};
const elements={H:11,C:4,O:6,N:2};
const molecules={hydrogen:9,methane:3};
const recipes=['hydrogen','methane','oxygen'];
const systems={hints:['water'],dust:{H:0,C:0,O:0},loadout:{drive:'hydrogen',cooling:true}};
const emptyTanks=()=>({propellant:{molecule:null,amount:0},fuel:{molecule:null,amount:0},oxidizer:{molecule:null,amount:0},coolant:{molecule:null,amount:0}});
const tanks=(propellant=0)=>({propellant:{molecule:propellant?'hydrogen':null,amount:propellant},fuel:{molecule:'methane',amount:3},oxidizer:{molecule:'oxygen',amount:4},coolant:{molecule:null,amount:0}});
const selected=(withTanks=false)=>({drive:'hydrogen',cooling:true,tanks:withTanks?{propellant:'hydrogen',fuel:'methane',oxidizer:'oxygen',coolant:null}:{propellant:null,fuel:null,oxidizer:null,coolant:null}});
const currentProgress={bestChain:7,runs:3,cleared:false,craftPrompt:false,sound:true,foundElements:['H','C','O'],regions:['veil'],checkpoint:'veil',frontier:false,choCompleted:false,totalCollected:19,signalMisses:1,signalLast:{veil:4}};
const currentElements={H:11,C:4,N:2,O:6,F:0,P:0,S:0,Cl:0};
function expected({hints=[],dust={H:0,C:0,O:0},tankState=emptyTanks(),loadout=selected(false),upgrade=0,migrateDiscoveries=false}={}){const result={schemaVersion:7,upgrades:{oxygenTank:upgrade},elements:currentElements,tanks:tankState,recipes,hints,dust,loadout,progress:currentProgress,workspace:null};if(migrateDiscoveries)result.migrateDiscoveries=true;return result;}

const fixtures=[
  {version:1,raw:{schemaVersion:1,elements,molecules,recipes,progress,workspace:null},want:expected({migrateDiscoveries:true})},
  {version:2,raw:{schemaVersion:2,elements,molecules,recipes,progress,workspace:null,...systems},want:expected({hints:systems.hints,dust:systems.dust})},
  {version:3,raw:{schemaVersion:3,elements,molecules,recipes,progress,workspace:null,...systems,tanks:{hydrogen:2,methane:3,oxygen:4}},want:expected({hints:systems.hints,dust:systems.dust,tankState:tanks(80),loadout:selected(true)})},
  {version:4,raw:{schemaVersion:4,elements,molecules,recipes,progress,workspace:null,...systems,tanks:{propellant:{molecule:'hydrogen',amount:2},fuel:{molecule:'methane',amount:3},oxidizer:{molecule:'oxygen',amount:4},coolant:{molecule:null,amount:0}}},want:expected({hints:systems.hints,dust:systems.dust,tankState:tanks(80),loadout:selected(true)})},
  {version:5,raw:{schemaVersion:5,elements,molecules,recipes,progress,workspace:null,...systems,tanks:tanks(40)},want:expected({hints:systems.hints,dust:systems.dust,tankState:tanks(40),loadout:selected(true)})},
  {version:6,raw:{schemaVersion:6,elements,recipes,progress,workspace:null,...systems,tanks:tanks(40)},want:expected({hints:systems.hints,dust:systems.dust,tankState:tanks(40),loadout:selected(true)})},
  {version:7,raw:{schemaVersion:7,upgrades:{oxygenTank:1},elements,recipes,progress,workspace:null,...systems,tanks:tanks(40)},want:expected({hints:systems.hints,dust:systems.dust,tankState:tanks(40),loadout:selected(true),upgrade:1})},
];

assert.equal(SCHEMA_VERSION,7);
for(const fixture of fixtures){const migrated=migrateResourcesSave(JSON.stringify(fixture.raw));assert.deepEqual(migrated,fixture.want,`v${fixture.version} -> v7 golden migration`);assert.equal(migrated.schemaVersion,7);assert.equal(Object.hasOwn(migrated,'molecules'),false,`v${fixture.version} must not expose legacy molecule inventory`);if(fixture.version<=6)assert.equal(migrated.upgrades.oxygenTank,0,`v${fixture.version} gets pre-upgrade default`);}

const normalizedV7=migrateResourcesSave(JSON.stringify(fixtures.at(-1).raw));assert.deepEqual(JSON.parse(serializeResourcesState(normalizedV7)),normalizedV7,'egress writes current canonical state only');assert.throws(()=>serializeResourcesState(fixtures[5].raw),/schema/i,'egress must reject legacy schema states');

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const legacyRaw=JSON.stringify(fixtures[2].raw),legacyStorage=memory();legacyStorage.setItem(RESOURCE_KEY,legacyRaw);const hydratedLegacy=createResources({storage:legacyStorage});assert.equal(hydratedLegacy.blocked,false);assert.equal(hydratedLegacy.state.schemaVersion,7);assert.equal(legacyStorage.getItem(RESOURCE_KEY),legacyRaw,'hydrate must not eagerly rewrite a valid legacy save');assert.equal(hydratedLegacy.save(),true);assert.equal(JSON.parse(legacyStorage.getItem(RESOURCE_KEY)).schemaVersion,7,'the next normal save writes canonical v7');

const malformed=[
  '{broken',
  JSON.stringify({...fixtures[6].raw,schemaVersion:99}),
  JSON.stringify({...fixtures[2].raw,tanks:{...fixtures[2].raw.tanks,hydrogen:'2'}}),
  JSON.stringify({...fixtures[6].raw,upgrades:{oxygenTank:3}}),
];
for(const raw of malformed){assert.throws(()=>migrateResourcesSave(raw));const storage=memory();storage.setItem(RESOURCE_KEY,raw);const resources=createResources({storage});assert.equal(resources.blocked,true,'invalid persisted state must block writes');assert.equal(resources.save(),false);assert.equal(storage.getItem(RESOURCE_KEY),raw,'invalid persisted state must remain untouched');}

console.log('Resources persistence migration passed: v1-v7 goldens, old inventory/tanks, pre-upgrade defaults, deferred canonical writeback, current-only egress, and malformed-save protection.');
