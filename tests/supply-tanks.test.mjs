import assert from 'node:assert/strict';
import {EXPEDITION} from '../src/veil/config.js';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';

const memory=()=>{const data=new Map();let reject=false;return {getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(reject)throw Error('quota');data.set(key,value);},removeItem:key=>data.delete(key),reject(value=true){reject=value;},data};};
const unlock=resources=>{for(const id of ['hydrogen','methane','oxygen'])resources.discover(id);};

const storage=memory(),resources=createResources({storage});unlock(resources);Object.assign(resources.state.molecules,{hydrogen:5,methane:20,oxygen:40});resources.save();
assert.deepEqual(resources.state.tanks,{hydrogen:0,methane:0,oxygen:0});
assert.deepEqual(resources.tankPlan('hydrogen').shortage,{});assert.ok(resources.fillTank('hydrogen'));assert.equal(resources.state.tanks.hydrogen,EXPEDITION.hydrogenCapacity);assert.equal(resources.state.molecules.hydrogen,2);
const fullHydrogen=resources.snapshot();assert.equal(resources.fillTank('hydrogen'),false);assert.deepEqual(resources.snapshot(),fullHydrogen,'A repeated fill cannot double-transfer fuel');
assert.ok(resources.fillTank('combustion'));assert.deepEqual(resources.state.tanks,{hydrogen:3,methane:18,oxygen:36});assert.equal(resources.state.molecules.methane,2);assert.equal(resources.state.molecules.oxygen,4);
assert.deepEqual(resources.prepareExpedition(),resources.state.tanks);
const baseBeforeUse={...resources.state.molecules};assert.ok(resources.consumeDrive('hydrogen'));assert.ok(resources.consumeDrive('combustion'));assert.deepEqual(resources.state.tanks,{hydrogen:2,methane:17,oxygen:34});assert.deepEqual(resources.state.molecules,baseBeforeUse,'Expedition use spends loaded tanks, not BASE STOCK');
const reloaded=createResources({storage});assert.deepEqual(reloaded.state.tanks,resources.state.tanks);assert.deepEqual(reloaded.state.molecules,resources.state.molecules);

const short=createResources({storage:memory()});unlock(short);Object.assign(short.state.molecules,{hydrogen:2,methane:18,oxygen:20});short.save();
assert.deepEqual(short.tankPlan('hydrogen').shortage,{hydrogen:1});assert.equal(short.fillTank('hydrogen'),false);assert.equal(short.state.molecules.hydrogen,2);assert.equal(short.state.tanks.hydrogen,0);
assert.deepEqual(short.tankPlan('combustion').shortage,{oxygen:16});assert.equal(short.fillTank('combustion'),false);assert.deepEqual(short.state.tanks,{hydrogen:0,methane:0,oxygen:0});assert.equal(short.state.molecules.methane,18,'An incomplete pair never partially transfers CH₄');

const failingStorage=memory(),failing=createResources({storage:failingStorage});unlock(failing);failing.state.molecules.hydrogen=3;failing.save();const beforeFailure=failing.snapshot();failingStorage.reject();assert.equal(failing.fillTank('hydrogen'),false);assert.deepEqual(failing.snapshot(),beforeFailure,'A failed supply save rolls back both stock and tank');

const legacyStorage=memory();legacyStorage.setItem(RESOURCE_KEY,JSON.stringify({schemaVersion:2,elements:{H:0,C:0,O:0},molecules:{hydrogen:20,methane:20,oxygen:40,water:0},recipes:['hydrogen','methane','oxygen'],hints:[],dust:{H:0,C:0,O:0},loadout:{drive:'hydrogen',cooling:true},progress:{bestChain:0,runs:0,cleared:false,craftPrompt:false,sound:true,foundElements:['H'],regions:['veil'],checkpoint:'veil',frontier:false,totalCollected:0,signalMisses:0,signalLast:{}},workspace:null}));
const migrated=createResources({storage:legacyStorage});assert.equal(migrated.state.schemaVersion,3);assert.deepEqual(migrated.state.tanks,{hydrogen:3,methane:18,oxygen:36});assert.deepEqual(migrated.state.molecules,{hydrogen:17,methane:2,oxygen:4,water:0});assert.equal(migrated.state.tanks.hydrogen+migrated.state.molecules.hydrogen,20,'Migration preserves total molecular inventory');migrated.save();assert.deepEqual(createResources({storage:legacyStorage}).state.tanks,migrated.state.tanks);

const session=createResources({storage:null});session.discover('hydrogen');session.state.molecules.hydrogen=3;assert.ok(session.fillTank('hydrogen'));assert.ok(session.consumeDrive('hydrogen'));

console.log('Supply tanks passed: hard caps, atomic full fill, no partial shortage transfer, base decrement, expedition consumption, save/reload, rollback, and v2 migration.');
