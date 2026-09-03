import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {combustionPacketFor} from '../src/veil/molecule-roles.js';

const database=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
const memory=()=>{const data=new Map();let reject=false;return {getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(reject)throw Error('quota');data.set(key,value);},removeItem:key=>data.delete(key),reject(value=true){reject=value;},data};};
const emptyTanks={propellant:{molecule:null,amount:0},fuel:{molecule:null,amount:0},oxidizer:{molecule:null,amount:0},coolant:{molecule:null,amount:0}};
const loadout=(propellant=null,fuel=null,oxidizer=null)=>({propellant:propellant??{molecule:null,amount:0},fuel:fuel??{molecule:null,amount:0},oxidizer:oxidizer??{molecule:null,amount:0}});

const storage=memory(),resources=createResources({storage});resources.setCatalog(database);assert.equal(resources.state.schemaVersion,5);assert.deepEqual(resources.state.tanks,emptyTanks);
resources.discover('hydrogen');resources.state.elements.H=82;resources.save();
assert.ok(resources.spend({H:2}),'The handmade H2 template checks two atoms out of BASE STOCK');resources.save();
for(let i=0;i<40;i++)assert.ok(resources.fillTankFromElements('propellant','hydrogen'));
assert.deepEqual(resources.state.tanks.propellant,{molecule:'hydrogen',amount:40});assert.equal(resources.state.elements.H,0,'Checked-out template atoms are never counted as production stock');
assert.deepEqual(resources.prepareExpedition(),loadout({molecule:'hydrogen',amount:40}));assert.ok(resources.consumeBoost());assert.deepEqual(resources.state.tanks.propellant,{molecule:'hydrogen',amount:0});

resources.discover('carbon-dioxide');resources.state.elements.C=2;resources.state.elements.O=4;resources.save();
assert.deepEqual(resources.tankUses('carbon-dioxide'),['propellant']);assert.equal(resources.tankStatus('propellant','carbon-dioxide').capacity,72);assert.ok(resources.fillTankFromElements('propellant','carbon-dioxide'));assert.deepEqual(resources.state.tanks.propellant,{molecule:'carbon-dioxide',amount:1},'A different molecule empties and replaces the one-kind tank');
assert.ok(resources.fillTankFromElements('propellant','carbon-dioxide'));assert.deepEqual(resources.state.tanks.propellant,{molecule:'carbon-dioxide',amount:2},'The same molecule tops up without replacement');
const reloaded=createResources({storage});assert.deepEqual(reloaded.state.tanks.propellant,{molecule:'carbon-dioxide',amount:2},'Residual generic tank contents survive reload');

const legacyStock=memory(),stocked=createResources({storage:legacyStock});stocked.setCatalog(database);stocked.discover('n-butane');stocked.state.molecules['n-butane']=7;stocked.save();
assert.ok(stocked.transferMoleculesToTank('propellant','n-butane',4));assert.equal(stocked.state.molecules['n-butane'],3);assert.deepEqual(stocked.state.tanks.propellant,{molecule:'n-butane',amount:4},'Legacy finished molecules can enter a compatible tank');
assert.ok(stocked.transferMoleculesToTank('fuel','n-butane'));assert.equal(stocked.state.molecules['n-butane'],0);assert.deepEqual(stocked.state.tanks.fuel,{molecule:'n-butane',amount:3},'A dual-role molecule can enter either compatible tank');

const combustionStorage=memory(),combustion=createResources({storage:combustionStorage});combustion.setCatalog(database);for(const id of ['hydrogen','oxygen'])combustion.discover(id);Object.assign(combustion.state.elements,{H:8,O:4});combustion.save();
for(let i=0;i<4;i++)assert.ok(combustion.fillTankFromElements('fuel','hydrogen'));for(let i=0;i<2;i++)assert.ok(combustion.fillTankFromElements('oxidizer','oxygen'));
const packet=combustionPacketFor('hydrogen');assert.ok(combustion.consumeCombustion(packet));assert.deepEqual(combustion.prepareExpedition(),loadout(null,{molecule:'hydrogen',amount:2},{molecule:'oxygen',amount:1}));assert.deepEqual(createResources({storage:combustionStorage}).prepareExpedition(),combustion.prepareExpedition(),'Post-expedition remainder persists');

const failingStorage=memory(),failing=createResources({storage:failingStorage});failing.discover('hydrogen');failing.state.elements.H=2;failing.save();const beforeFailure=failing.snapshot();failingStorage.reject();assert.equal(failing.fillTankFromElements('propellant','hydrogen'),false);assert.deepEqual(failing.snapshot(),beforeFailure,'A failed direct-fill save rolls back stock and tank atomically');

const base={elements:{H:0,C:0,N:0,O:0,F:0,P:0,S:0,Cl:0},molecules:{hydrogen:17,methane:2,oxygen:4,water:0},recipes:['hydrogen','methane','oxygen'],hints:[],dust:{H:0,C:0,O:0},loadout:{drive:'hydrogen',cooling:true},progress:{bestChain:0,runs:0,cleared:false,craftPrompt:false,sound:true,foundElements:['H'],regions:['veil'],checkpoint:'veil',frontier:false,totalCollected:0,signalMisses:0,signalLast:{}},workspace:null};
const legacy3=memory();legacy3.setItem(RESOURCE_KEY,JSON.stringify({...base,schemaVersion:3,tanks:{hydrogen:3,methane:18,oxygen:36}}));
const migrated3=createResources({storage:legacy3});assert.equal(migrated3.state.schemaVersion,5);assert.deepEqual(migrated3.state.tanks,{propellant:{molecule:'hydrogen',amount:120},fuel:{molecule:'methane',amount:18},oxidizer:{molecule:'oxygen',amount:36},coolant:{molecule:null,amount:0}});assert.deepEqual(migrated3.state.molecules,base.molecules,'v3 already-separated stock is not transferred twice');
const legacy4=memory();legacy4.setItem(RESOURCE_KEY,JSON.stringify({...base,schemaVersion:4,tanks:{propellant:{molecule:'hydrogen',amount:2},fuel:{molecule:'methane',amount:9},oxidizer:{molecule:'oxygen',amount:17},coolant:{molecule:null,amount:0}}}));
const migrated4=createResources({storage:legacy4});assert.deepEqual(migrated4.state.tanks,{propellant:{molecule:'hydrogen',amount:80},fuel:{molecule:'methane',amount:9},oxidizer:{molecule:'oxygen',amount:17},coolant:{molecule:null,amount:0}},'v4 H2 burst uses become molecule-count units while CH4/O2 remain unchanged');
const legacy2=memory();legacy2.setItem(RESOURCE_KEY,JSON.stringify({...base,schemaVersion:2,molecules:{hydrogen:20,methane:20,oxygen:40,water:0}}));
const migrated2=createResources({storage:legacy2});assert.deepEqual(migrated2.state.tanks,migrated3.state.tanks);assert.deepEqual(migrated2.state.molecules,{hydrogen:17,methane:2,oxygen:4,water:0});

console.log('Generic tank supply passed: role capacities, direct production, one-kind replacement, legacy inventory transfer, generic consumption, rollback, persistence, and v2-v4 migration.');
