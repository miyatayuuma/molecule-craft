import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';

const database=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
const memory=()=>{const data=new Map();let reject=false;return {getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(reject)throw Error('quota');data.set(key,value);},removeItem:key=>data.delete(key),reject(value=true){reject=value;},data};};
const setup=()=>{const storage=memory(),resources=createResources({storage});resources.setCatalog(database);return {storage,resources};};
const tankUses=['propellant','fuel','oxidizer','coolant'];

{
 for(const [id,use] of [['hydrogen','propellant'],['methane','fuel'],['oxygen','oxidizer'],['water','coolant']]){
  const {resources}=setup(),before=resources.snapshot(),result=resources.discoverWithLoadout(id,use);
  assert.deepEqual(result,{learned:true,assignedUse:use});assert.equal(resources.selectedLoadout()[use],id);
  for(const other of tankUses)if(other!==use)assert.equal(resources.selectedLoadout()[other],null,`${id} must not auto-select unrelated ${other} slot`);
  assert.deepEqual(resources.state.tanks,before.tanks,`${id} discovery must not fill actual tanks`);assert.deepEqual(resources.state.elements,before.elements,`${id} discovery must not consume BASE STOCK`);
 }
}

{
 const {resources}=setup();resources.discover('methanol');assert.ok(resources.setLoadoutTank('fuel','methanol'));const selected={...resources.selectedLoadout()},tanks=structuredClone(resources.state.tanks),elements={...resources.state.elements};
 const result=resources.discoverWithLoadout('methane','fuel');assert.deepEqual(result,{learned:true,assignedUse:null});assert.deepEqual(resources.selectedLoadout(),selected,'First methane CRAFT must preserve an existing fuel choice');assert.deepEqual(resources.state.tanks,tanks);assert.deepEqual(resources.state.elements,elements);
}

{
 const {resources}=setup();assert.deepEqual(resources.discoverWithLoadout('hydrogen','propellant'),{learned:true,assignedUse:'propellant'});assert.ok(resources.setLoadoutTank('propellant',null));const before=resources.snapshot();assert.equal(resources.discoverWithLoadout('hydrogen','propellant'),false);assert.deepEqual(resources.snapshot(),before,'Repeat CRAFT must not restore or alter the first-use assignment');
}

{
 const {resources}=setup(),before=resources.snapshot(),result=resources.discoverWithLoadout('methanol',null);assert.deepEqual(result,{learned:true,assignedUse:null});assert.deepEqual(resources.selectedLoadout(),before.loadout.tanks,'Non-critical discovery must not auto-select any tank');assert.deepEqual(resources.state.tanks,before.tanks);assert.deepEqual(resources.state.elements,before.elements);
}

{
 const {storage,resources}=setup(),before=resources.snapshot();storage.reject();assert.equal(resources.discoverWithLoadout('hydrogen','propellant'),false);assert.deepEqual(resources.snapshot(),before,'Discovery and auto-assignment roll back together when persistence fails');
}

{
 const {resources}=setup();for(const id of ['hydrogen','methane','oxygen','water','carbon-dioxide'])resources.discover(id);Object.assign(resources.state.elements,{H:1000,C:100,O:1000});resources.save();
 const before=resources.snapshot();assert.ok(resources.setLoadoutTank('propellant','hydrogen'));assert.ok(resources.setLoadoutTank('fuel','methane'));assert.ok(resources.setLoadoutTank('oxidizer','oxygen'));assert.ok(resources.setLoadoutTank('coolant','water'));assert.deepEqual(resources.state.elements,before.elements);assert.deepEqual(resources.state.tanks,before.tanks);
 const plan=resources.launchFillPlan();assert.equal(plan.status,'FULL');const expected={};for(const entry of plan.full.entries)for(const [el,n]of Object.entries(entry.cost))expected[el]=(expected[el]??0)+n;const stockBefore={...resources.state.elements};const committed=resources.commitLaunchFill();assert.ok(committed);for(const [el,n]of Object.entries(expected))assert.equal(resources.state.elements[el],stockBefore[el]-n);for(const entry of committed.plan.entries)assert.deepEqual(resources.state.tanks[entry.use],entry.molecule?{molecule:entry.molecule,amount:entry.target}:{molecule:null,amount:0});
}

{
 const {resources}=setup();resources.discover('methane');resources.setLoadoutTank('fuel','methane');Object.assign(resources.state.elements,{H:400,C:100});resources.save();assert.ok(resources.commitLaunchFill());const cap=resources.state.tanks.fuel.amount;resources.consumeTank('fuel','methane',Math.floor(cap/2));const remaining=resources.state.tanks.fuel.amount,atoms={...resources.state.elements};const plan=resources.launchFillPlan();const entry=plan.full.entries.find(x=>x.use==='fuel');assert.equal(entry.current,remaining);assert.equal(entry.add,entry.capacity-remaining);assert.ok(resources.commitLaunchFill());assert.equal(resources.state.tanks.fuel.amount,entry.capacity);assert.equal(resources.state.elements.C,atoms.C-entry.add);assert.equal(resources.state.elements.H,atoms.H-entry.add*4);
}

{
 const {resources}=setup();for(const id of ['methane','hydrogen'])resources.discover(id);Object.assign(resources.state.elements,{H:400,C:100});resources.setLoadoutTank('fuel','methane');resources.save();assert.ok(resources.commitLaunchFill());resources.consumeTank('fuel','methane',Math.max(1,Math.floor(resources.state.tanks.fuel.amount/2)));const old=resources.state.tanks.fuel.amount,stock={...resources.state.elements};assert.ok(resources.setLoadoutTank('fuel','hydrogen'));assert.equal(resources.state.tanks.fuel.amount,old);assert.deepEqual(resources.state.elements,stock);const result=resources.commitLaunchFill();assert.ok(result);assert.equal(resources.state.tanks.fuel.molecule,'hydrogen');assert.notEqual(resources.state.tanks.fuel.amount,old);assert.equal(resources.state.elements.C,stock.C);
}

{
 const {resources}=setup();resources.discover('hydrogen');Object.assign(resources.state.elements,{H:240});resources.setLoadoutTank('propellant','hydrogen');resources.save();assert.ok(resources.commitLaunchFill());resources.consumeTank('propellant','hydrogen',40);const remaining=resources.state.tanks.propellant.amount,stock=resources.state.elements.H;assert.ok(resources.setLoadoutTank('propellant',null));assert.equal(resources.state.tanks.propellant.amount,remaining);assert.equal(resources.state.elements.H,stock);assert.ok(resources.commitLaunchFill());assert.deepEqual(resources.state.tanks.propellant,{molecule:null,amount:0});assert.equal(resources.state.elements.H,stock);
}

{
 const {resources}=setup();for(const id of ['methane','water'])resources.discover(id);resources.setLoadoutTank('fuel','methane');resources.setLoadoutTank('coolant','water');Object.assign(resources.state.elements,{H:24,C:20,O:20});resources.save();const plan=resources.launchFillPlan();assert.equal(plan.status,'PARTIAL');assert.equal(resources.commitLaunchFill(),false);const fuel=plan.partial.entries.find(x=>x.use==='fuel'),coolant=plan.partial.entries.find(x=>x.use==='coolant');assert.ok(fuel.target>0&&coolant.target>0);assert.ok(Math.abs(fuel.target/fuel.capacity-coolant.target/coolant.capacity)<=Math.max(1/fuel.capacity,1/coolant.capacity)+1e-9);const result=resources.commitLaunchFill({partial:true});assert.ok(result);assert.equal(resources.state.tanks.fuel.amount,fuel.target);assert.equal(resources.state.tanks.coolant.amount,coolant.target);
}

{
 const {resources}=setup();resources.discover('methane');resources.setLoadoutTank('fuel','methane');resources.state.elements.C=0;resources.state.elements.H=0;resources.save();const plan=resources.launchFillPlan();assert.equal(plan.status,'IMPOSSIBLE');const before=resources.snapshot();assert.equal(resources.commitLaunchFill({partial:true}),false);assert.deepEqual(resources.snapshot(),before);
}

{
 const {resources}=setup();assert.equal(resources.launchFillPlan().status,'FULL');assert.ok(resources.commitLaunchFill());
}

{
 const {storage,resources}=setup();resources.discover('hydrogen');resources.state.elements.H=240;resources.setLoadoutTank('propellant','hydrogen');resources.save();const before=resources.snapshot();storage.reject();assert.equal(resources.commitLaunchFill(),false);assert.deepEqual(resources.snapshot(),before);
}

{
 const legacy=memory(),base={schemaVersion:7,upgrades:{oxygenTank:0},elements:{H:10,C:0,N:0,O:0,F:0,P:0,S:0,Cl:0},tanks:{propellant:{molecule:'hydrogen',amount:4},fuel:{molecule:null,amount:0},oxidizer:{molecule:null,amount:0},coolant:{molecule:null,amount:0}},recipes:['hydrogen'],hints:[],dust:{H:0,C:0,O:0},loadout:{drive:'hydrogen',cooling:true},progress:{bestChain:0,runs:0,cleared:false,craftPrompt:false,sound:true,foundElements:['H'],regions:['veil'],checkpoint:'veil',frontier:false,choCompleted:false,totalCollected:0,signalMisses:0,signalLast:{}},workspace:null};legacy.setItem(RESOURCE_KEY,JSON.stringify(base));const migrated=createResources({storage:legacy});assert.equal(migrated.selectedLoadout().propellant,'hydrogen');assert.deepEqual(migrated.state.tanks.propellant,{molecule:'hydrogen',amount:4});assert.equal(migrated.state.elements.H,10);
}
{
 const {resources}=setup();resources.discover('hydrogen');resources.state.loadout.tanks.propellant='not-discovered';const before=resources.snapshot();const plan=resources.launchFillPlan();assert.equal(plan.status,'IMPOSSIBLE');assert.equal(plan.invalid.length,1);assert.equal(resources.commitLaunchFill({partial:true}),false);assert.deepEqual(resources.snapshot(),before);
}

console.log('Loadout auto-synthesis supply passed: atomic capability assignment, overwrite protection, tank/content separation, rollback, free selection, residual reuse, replacement discard, empty tanks, proportional partial fill, impossible guard, and legacy initialization.');
