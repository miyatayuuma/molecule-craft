import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {SCHEMA_VERSION,createInitialResourcesState,loadPersistedResources} from '../src/veil/resources-persistence.js';
import {tankCapacity} from '../src/veil/growth.js';
import {rareEcologyInventoryMultiplier} from '../src/veil/rare-ecology.js';
const polymerCatalog=JSON.parse(readFileSync(new URL('../data/polymers.json',import.meta.url),'utf8'));

const memory=(entries=[])=>{const values=new Map(entries);return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),raw:key=>values.get(key)??null};};
const initial=createInitialResourcesState();
assert.equal(SCHEMA_VERSION,9);
assert.equal(Object.hasOwn(initial,'upgrades'),false);
assert.equal(Object.hasOwn(initial,'treatments'),false);
assert.equal(tankCapacity('oxidizer','oxygen'),36);assert.equal((await import('../src/veil/config.js')).EXPEDITION.oxygenCapacity,36);
assert.deepEqual(['oxygenUpgradePlan','nextOxygenUpgrade','upgradeOxygenTank','treatmentPlan','applyHazardTreatment'].filter(key=>typeof createResources({storage:memory()})[key]==='function'),[]);

const legacy={...initial,schemaVersion:8,upgrades:{oxygenTank:2},treatments:{mechanical:0.4,electrical:0.8},elements:{...initial.elements,H:431,C:219,O:810,N:94,P:2},recipes:['hydrogen','water','oxygen'],hints:['nitrogen'],tanks:{...initial.tanks,oxidizer:{molecule:'oxygen',amount:72},shock:{molecule:'nitromethane',amount:1}},loadout:{...initial.loadout,tanks:{...initial.loadout.tanks,oxidizer:'oxygen',shock:'nitromethane'}},progress:{...initial.progress,choCompleted:true,regions:['veil','carbon','oxygen','nitrogen'],checkpoint:'nitrogen',foundElements:['H','C','O','N'],coreFractured:true,worldAwakened:true,rareEcologyEligible:true,runs:18},workspace:{schemaVersion:2,atoms:[],bonds:[],selected:null,focus:null,pivot:null,camera:{position:[0,0,1],target:[0,0,0],up:[0,1,0]}}};
const storage=memory([[RESOURCE_KEY,JSON.stringify(legacy)],['molecule-craft.collection.v1','collection-preserved'],['molecule-craft.workspace.v1','workspace-preserved']]);
const migrated=loadPersistedResources(storage).state;
assert.equal(migrated.schemaVersion,9);
assert.equal(migrated.elements.H,431);assert.equal(migrated.elements.P,2);
assert.deepEqual(migrated.recipes,legacy.recipes);assert.deepEqual(migrated.hints,legacy.hints);
assert.equal(migrated.progress.runs,18);assert.equal(migrated.progress.checkpoint,'nitrogen');assert.equal(migrated.progress.worldAwakened,true);assert.equal(migrated.progress.coreFractured,true);
assert.deepEqual(migrated.tanks.shock,legacy.tanks.shock);assert.deepEqual(migrated.loadout,legacy.loadout);assert.deepEqual(migrated.workspace,legacy.workspace,'workspace remains available through resource schema migration');
assert.equal(migrated.tanks.oxidizer.amount,36);assert.equal(Object.hasOwn(migrated,'upgrades'),false);assert.equal(Object.hasOwn(migrated,'treatments'),false);
assert.equal(storage.raw('molecule-craft.collection.v1'),'collection-preserved');assert.equal(storage.raw('molecule-craft.workspace.v1'),'workspace-preserved');
assert.equal(JSON.parse(storage.raw(RESOURCE_KEY)).schemaVersion,9,'v8 migration is written back as current schema');

const thresholds={P:[[0,1],[1,1],[2,.85],[3,.85],[4,.55],[5,.55],[6,.2],[7,.2],[8,.05]],S:[[0,1],[2,.85],[4,.55],[6,.2],[8,.05]],F:[[0,1],[3,1],[4,.85],[7,.85],[8,.55],[11,.55],[12,.2],[15,.2],[16,.05]]};
for(const [element,cases] of Object.entries(thresholds))for(const [stock,expected] of cases)assert.equal(rareEcologyInventoryMultiplier(element,stock),expected,`${element} stock ${stock} attenuation remains numerically equivalent`);
assert.equal(rareEcologyInventoryMultiplier('Cl',4),1,'Cl keeps its existing generic stock curve');
assert.equal(polymerCatalog.length,25,'Polymer Foundation is unaffected');

const production=[ 'src/app.js','src/reaction-lab.js','src/veil/resources.js','src/veil/resources-persistence.js','src/veil/supply.js','src/veil/engine.js','src/veil/ui.js','index.html','veil.css'].map(path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')).join('\n');
for(const token of ['#open-dock','#dock-dialog','dock-preflight','dock-migration','tank-upgrades','hazard-treatments','oxygenUpgradePlan','upgradeOxygenTank','HAZARD_TREATMENT_','hazardTreatmentPlan','applyHazardTreatment','veil-treatments','molecule-craft:dock-treatment-request'])assert.equal(production.includes(token),false,`retired source reference remains: ${token}`);
assert.match(production,/open-reaction-lab/,'Reaction Lab remains available');
console.log('Legacy retirement regression passed: schema v8 migration, preserved progression/workspace/collection, 36 O₂, neutral Rare stock curves, Polymer Foundation and retired-runtime absence.');
