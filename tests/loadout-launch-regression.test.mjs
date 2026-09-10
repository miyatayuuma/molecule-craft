import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {commitRebalancedLaunchFill,installEmptyDeparturePolicy,preserveSupplyDuringPrepare} from '../src/craft-connections.js?v=1';
import {createResources} from '../src/veil/resources.js';

const database=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
const USES=['propellant','fuel','oxidizer','coolant'];
const DEFAULT_LOADOUT={propellant:'hydrogen',fuel:'methane',oxidizer:'oxygen',coolant:'water'};
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
function setup({loadout=DEFAULT_LOADOUT,stock={H:1000,C:100,O:1000}}={}){
  const resources=createResources({storage:memory()});resources.setCatalog(database);
  for(const id of new Set(Object.values(loadout).filter(Boolean)))resources.discover(id);
  for(const use of USES)assert.equal(resources.setLoadoutTank(use,loadout[use]??null),true);
  Object.assign(resources.state.elements,{H:0,C:0,O:0,...stock});assert.equal(resources.save(),true);installEmptyDeparturePolicy(resources);return resources;
}
const entry=(plan,use)=>plan.partial.entries.find(item=>item.use===use);
const assertMissingOnly=(plan,...symbols)=>{
  assert.deepEqual(Object.keys(plan.missing).sort(),[...symbols].sort());
  for(const symbol of symbols){assert.equal(plan.missing[symbol].need,plan.required[symbol]);assert.ok(plan.missing[symbol].need>plan.missing[symbol].have);}
};
function assertPlanCommitted(resources,result,before){
  assert.ok(result?.committed);
  for(const row of result.plan.entries)assert.deepEqual(resources.state.tanks[row.use],row.molecule?{molecule:row.molecule,amount:row.target}:{molecule:null,amount:0});
  for(const [symbol,spent] of Object.entries(result.plan.cost))assert.equal(resources.state.elements[symbol],before[symbol]-spent);
}

{
  const resources=setup({loadout:{...DEFAULT_LOADOUT,propellant:null}}),plan=resources.launchFillPlan();
  assert.equal(plan.status,'FULL');const empty=plan.full.entries.find(item=>item.use==='propellant');assert.equal(empty.molecule,null);assert.equal(empty.target,0);assert.deepEqual(empty.cost,{});
  const before={...resources.state.elements},result=resources.commitLaunchFill();assertPlanCommitted(resources,result,before);
}

{
  const resources=setup({loadout:{...DEFAULT_LOADOUT,propellant:null},stock:{H:0,C:0,O:0}}),selection=resources.selectedLoadout(),plan=resources.launchFillPlan();
  assert.equal(plan.status,'PARTIAL');assert.equal(plan.emptyDeparture,true);assert.equal(entry(plan,'propellant').molecule,null);assert.equal(entry(plan,'propellant').target,0);
  const before=resources.snapshot();assert.equal(resources.commitLaunchFill(),false);assert.deepEqual(resources.snapshot(),before);assert.deepEqual(resources.selectedLoadout(),selection);
  const result=resources.commitLaunchFill({partial:true});assert.ok(result?.emptyDeparture);assert.deepEqual(resources.selectedLoadout(),selection);assert.deepEqual(resources.state.tanks.propellant,{molecule:null,amount:0});
  for(const use of ['fuel','oxidizer','coolant'])assert.deepEqual(resources.state.tanks[use],{molecule:selection[use],amount:0});
}

{
  const resources=setup({stock:{H:0,C:100,O:1000}}),plan=resources.launchFillPlan();assert.equal(plan.status,'PARTIAL');assert.notEqual(plan.emptyDeparture,true);assertMissingOnly(plan,'H');
  assert.equal(entry(plan,'propellant').target,0);assert.equal(entry(plan,'fuel').target,0);assert.equal(entry(plan,'coolant').target,0);assert.ok(entry(plan,'oxidizer').target>0,'H shortage must not zero-fill an O-only tank');
  const selection=resources.selectedLoadout(),beforeState=resources.snapshot();assert.equal(resources.commitLaunchFill(),false);assert.deepEqual(resources.snapshot(),beforeState);assert.deepEqual(resources.selectedLoadout(),selection);
  const before={...resources.state.elements},result=resources.commitLaunchFill({partial:true});assertPlanCommitted(resources,result,before);assert.deepEqual(resources.selectedLoadout(),selection);
}

{
  const resources=setup({stock:{H:1000,C:0,O:1000}}),plan=resources.launchFillPlan();assert.equal(plan.status,'PARTIAL');assertMissingOnly(plan,'C');assert.equal(entry(plan,'fuel').target,0);
  assert.ok(entry(plan,'propellant').target>0);assert.ok(entry(plan,'oxidizer').target>0);assert.ok(entry(plan,'coolant').target>0);
}

{
  const resources=setup({stock:{H:1000,C:100,O:0}}),plan=resources.launchFillPlan();assert.equal(plan.status,'PARTIAL');assertMissingOnly(plan,'O');assert.equal(entry(plan,'oxidizer').target,0);assert.equal(entry(plan,'coolant').target,0);
  assert.ok(entry(plan,'propellant').target>0);assert.ok(entry(plan,'fuel').target>0);
}

{
  const resources=setup({stock:{H:20,C:0,O:10}}),plan=resources.launchFillPlan();assert.equal(plan.status,'PARTIAL');assertMissingOnly(plan,'H','C','O');assert.ok(plan.partial.entries.some(item=>item.molecule&&item.target>0));
  for(const [symbol,spent] of Object.entries(plan.partial.cost))assert.ok(spent<=resources.state.elements[symbol]);
}

{
  const resources=setup({loadout:{propellant:'hydrogen',fuel:'methane',oxidizer:null,coolant:'water'},stock:{H:24,C:100,O:100}}),plan=resources.launchFillPlan();assert.equal(plan.status,'PARTIAL');
  assert.ok(entry(plan,'propellant').target>0);assert.ok(entry(plan,'fuel').target>0);assert.ok(entry(plan,'coolant').target>0);assert.equal(plan.partial.cost.H,24,'shared H stock should be used without one slot starving the others');
  const before={...resources.state.elements},result=resources.commitLaunchFill({partial:true});assertPlanCommitted(resources,result,before);
}

{
  const resources=setup();resources.state.loadout.tanks.propellant='not-discovered';const before=resources.snapshot(),plan=resources.launchFillPlan();assert.equal(plan.status,'IMPOSSIBLE');assert.equal(plan.invalid.length,1);assert.equal(resources.commitLaunchFill({partial:true}),false);assert.deepEqual(resources.snapshot(),before);
}

{
  const state={elements:{H:4},tanks:{propellant:{molecule:null,amount:0}}},resources={blocked:false,state,spend(cost){if((state.elements.H??0)<(cost.H??0))return false;state.elements.H-=cost.H??0;return true;},save:()=>false};
  const preview={status:'PARTIAL',partial:{entries:[{use:'propellant',molecule:'hydrogen',target:2}],cost:{H:4}},required:{H:4},missing:{}};const before=JSON.parse(JSON.stringify(state));assert.equal(commitRebalancedLaunchFill(resources,preview),false);assert.deepEqual(state,before,'failed persistence must roll back BASE STOCK and tanks');
}

{
  const dialog={open:true,showModal(){this.open=true;}},root={getElementById:id=>id==='supply-dialog'?dialog:null},failure=new Error('prepare failed');
  const prepare=preserveSupplyDuringPrepare(()=>{dialog.open=false;throw failure;},root);assert.throws(prepare,failure);assert.equal(dialog.open,true,'LOADOUT must be restored even when launch preparation throws');
}

console.log('Issue #104 LOADOUT shortage/empty-slot matrix passed: FULL, PARTIAL, zero-fill, H/C/O and combined shortages, shared-stock competition, explicit commit, selection preservation, rollback, invalid-loadout guard, and prepare failure recovery.');
