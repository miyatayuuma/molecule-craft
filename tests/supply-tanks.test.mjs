import assert from 'node:assert/strict';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';

const memory=()=>{const data=new Map();let reject=false;return {getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(reject)throw Error('quota');data.set(key,value);},removeItem:key=>data.delete(key),reject(value=true){reject=value;},data};};
const emptyTanks={propellant:{molecule:null,amount:0},fuel:{molecule:null,amount:0},oxidizer:{molecule:null,amount:0},coolant:{molecule:null,amount:0}};

const storage=memory(),resources=createResources({storage});assert.equal(resources.state.schemaVersion,4);assert.deepEqual(resources.state.tanks,emptyTanks);
resources.discover('hydrogen');resources.state.elements.H=8;resources.save();
assert.ok(resources.spend({H:2}),'The handmade H2 template checks two atoms out of BASE STOCK');resources.save();
for(let i=0;i<3;i++)assert.ok(resources.fillTankFromElements('propellant','hydrogen'));
assert.equal(resources.fillTankFromElements('propellant','hydrogen'),false,'Production stops at the tank capacity');
assert.deepEqual(resources.state.tanks.propellant,{molecule:'hydrogen',amount:3});assert.equal(resources.state.elements.H,0,'Checked-out template atoms are never counted as production stock');assert.equal(resources.state.molecules.hydrogen,0,'Direct fill has no molecule-stock intermediate');
assert.deepEqual(resources.prepareExpedition(),{hydrogen:3,methane:0,oxygen:0});assert.ok(resources.consumeDrive('hydrogen'));assert.deepEqual(resources.state.tanks.propellant,{molecule:'hydrogen',amount:2});

const alternate={id:'test-propellant',formula:'HX',nameJa:'試験噴射剤',atoms:['H'],bonds:[],tankUses:['propellant','fuel']};resources.setCatalog([alternate]);resources.discover(alternate.id);assert.deepEqual(resources.tankUses(alternate.id),['propellant','fuel']);resources.state.elements.H=2;resources.save();
assert.equal(resources.tankStatus('propellant',alternate.id).replacing,true);assert.ok(resources.fillTankFromElements('propellant',alternate.id));assert.deepEqual(resources.state.tanks.propellant,{molecule:alternate.id,amount:1},'A different molecule empties and replaces the one-kind tank');assert.ok(resources.fillTankFromElements('propellant',alternate.id));assert.deepEqual(resources.state.tanks.propellant,{molecule:alternate.id,amount:2},'The same molecule tops up without replacement');resources.state.elements.H=1;resources.save();assert.ok(resources.fillTankFromElements('fuel',alternate.id),'One molecule can serve multiple configured tank uses');
const reloaded=createResources({storage});reloaded.setCatalog([alternate]);assert.deepEqual(reloaded.state.tanks.propellant,{molecule:alternate.id,amount:2},'Residual tank contents survive reload');

const combustionStorage=memory(),combustion=createResources({storage:combustionStorage});for(const id of ['methane','oxygen'])combustion.discover(id);Object.assign(combustion.state.elements,{H:12,C:3,O:8});combustion.save();
for(let i=0;i<3;i++)assert.ok(combustion.fillTankFromElements('fuel','methane'));for(let i=0;i<4;i++)assert.ok(combustion.fillTankFromElements('oxidizer','oxygen'));
assert.deepEqual(combustion.prepareExpedition(),{hydrogen:0,methane:3,oxygen:4});const baseBefore={...combustion.state.elements};assert.ok(combustion.consumeDrive('combustion'));assert.deepEqual(combustion.prepareExpedition(),{hydrogen:0,methane:2,oxygen:2});assert.deepEqual(combustion.state.elements,baseBefore,'Expedition use spends tank contents, not BASE STOCK');assert.deepEqual(createResources({storage:combustionStorage}).prepareExpedition(),{hydrogen:0,methane:2,oxygen:2},'Post-expedition remainder persists');

const failingStorage=memory(),failing=createResources({storage:failingStorage});failing.discover('hydrogen');failing.state.elements.H=2;failing.save();const beforeFailure=failing.snapshot();failingStorage.reject();assert.equal(failing.fillTankFromElements('propellant','hydrogen'),false);assert.deepEqual(failing.snapshot(),beforeFailure,'A failed direct-fill save rolls back stock and tank atomically');

const legacy3=memory();legacy3.setItem(RESOURCE_KEY,JSON.stringify({schemaVersion:3,elements:{H:0,C:0,N:0,O:0,F:0,P:0,S:0,Cl:0},molecules:{hydrogen:17,methane:2,oxygen:4,water:0},tanks:{hydrogen:3,methane:18,oxygen:36},recipes:['hydrogen','methane','oxygen'],hints:[],dust:{H:0,C:0,O:0},loadout:{drive:'hydrogen',cooling:true},progress:{bestChain:0,runs:0,cleared:false,craftPrompt:false,sound:true,foundElements:['H'],regions:['veil'],checkpoint:'veil',frontier:false,totalCollected:0,signalMisses:0,signalLast:{}},workspace:null}));
const migrated3=createResources({storage:legacy3});assert.equal(migrated3.state.schemaVersion,4);assert.deepEqual(migrated3.state.tanks,{propellant:{molecule:'hydrogen',amount:3},fuel:{molecule:'methane',amount:18},oxidizer:{molecule:'oxygen',amount:36},coolant:{molecule:null,amount:0}});assert.deepEqual(migrated3.state.molecules,{hydrogen:17,methane:2,oxygen:4,water:0},'v3 already-separated stock is not transferred twice');

const legacy2=memory();legacy2.setItem(RESOURCE_KEY,JSON.stringify({schemaVersion:2,elements:{H:0,C:0,O:0},molecules:{hydrogen:20,methane:20,oxygen:40,water:0},recipes:['hydrogen','methane','oxygen'],hints:[],dust:{H:0,C:0,O:0},loadout:{drive:'hydrogen',cooling:true},progress:{bestChain:0,runs:0,cleared:false,craftPrompt:false,sound:true,foundElements:['H'],regions:['veil'],checkpoint:'veil',frontier:false,totalCollected:0,signalMisses:0,signalLast:{}},workspace:null}));
const migrated2=createResources({storage:legacy2});assert.deepEqual(migrated2.state.tanks,migrated3.state.tanks);assert.deepEqual(migrated2.state.molecules,{hydrogen:17,methane:2,oxygen:4,water:0});

console.log('Tank supply passed: direct atom production, checked-out exclusion, hard stop, one-kind replacement, top-up, persistence, expedition consumption, rollback, and v2/v3 migration.');
