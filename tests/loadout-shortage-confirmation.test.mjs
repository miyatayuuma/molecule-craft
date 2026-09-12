import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installEmptyDeparturePolicy} from '../src/craft-connections.js?v=3';
import {createResources} from '../src/veil/resources.js';
import {launchConfirmationState} from '../src/veil/supply.js';

const database=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
const USES=['propellant','fuel','oxidizer','coolant'];
const LOADOUT={propellant:'hydrogen',fuel:'methane',oxidizer:'oxygen',coolant:'water'};
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};

function setup(stock){
  const resources=createResources({storage:memory()});resources.setCatalog(database);
  for(const id of Object.values(LOADOUT))resources.discover(id);
  for(const use of USES)assert.equal(resources.setLoadoutTank(use,LOADOUT[use]),true);
  Object.assign(resources.state.elements,{H:0,C:0,O:0,...stock});assert.equal(resources.save(),true);installEmptyDeparturePolicy(resources);return resources;
}

const row=(state,use)=>state.rows.find(item=>item.use===use);
const shortage=(state,element)=>state.shortages.find(item=>item.element===element);

{
  const resources=setup({H:1000,C:100,O:1000}),plan=resources.launchFillPlan(),state=launchConfirmationState(plan);
  assert.equal(plan.status,'FULL');
  assert.deepEqual(state.shortages,[],'FULL must not produce a shortage message');
  assert.equal(state.zeroFill,false);
  for(const item of state.rows)assert.equal(item.actual,item.requested,'FULL actual/requested load must match');
}

{
  const resources=setup({H:20,C:100,O:1000}),plan=resources.launchFillPlan(),state=launchConfirmationState(plan);
  assert.equal(plan.status,'PARTIAL');
  assert.equal(state.zeroFill,false);
  for(const item of state.rows){const actual=plan.partial.entries.find(entry=>entry.use===item.use),requested=plan.full.entries.find(entry=>entry.use===item.use);assert.equal(item.actual,actual.target);assert.equal(item.requested,requested.target);}
  assert.equal(shortage(state,'H').count,plan.missing.H.need-plan.missing.H.have,'shortage count must come from canonical plan.missing');
  const preview=state.rows.map(item=>({use:item.use,molecule:item.molecule,amount:item.actual}));
  const result=resources.commitLaunchFill({partial:true});assert.ok(result?.committed);
  for(const item of preview)assert.deepEqual(resources.state.tanks[item.use],{molecule:item.molecule,amount:item.amount},'committed tank amount must match confirmation preview');
}

{
  const resources=setup({H:0,C:0,O:0}),plan=resources.launchFillPlan(),state=launchConfirmationState(plan);
  assert.equal(plan.status,'PARTIAL');assert.equal(plan.emptyDeparture,true);assert.equal(state.zeroFill,true,'zero-fill must be explicit when no selected molecule can be loaded');
  assert.ok(state.rows.length>0);assert.ok(state.rows.every(item=>item.actual===0&&item.requested>0));
  assert.ok(state.shortages.length>=2);
}

{
  const resources=setup({H:20,C:0,O:10}),plan=resources.launchFillPlan(),state=launchConfirmationState(plan);
  assert.equal(plan.status,'PARTIAL');
  for(const element of ['H','C','O'])assert.equal(shortage(state,element).count,plan.missing[element].need-plan.missing[element].have);
}

{
  const source=await readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/loadout-stock-preview/,'confirmation must not depend on the legacy DOM stock preview');
  assert.doesNotMatch(source,/噴射材|収集殻|BASE STOCK不足/,'legacy terminology must not return to the confirmation');
  assert.match(source,/搭載できません/);assert.match(source,/data\.launchShortage/);assert.match(source,/item\.actual} \/ \$\{item\.requested/,'quantity is presented as actual / requested rather than percentage-only');
}

console.log('LOADOUT shortage confirmation passed: FULL silence, canonical PARTIAL quantities/shortages, zero-fill, multi-element shortage, preview/commit parity and legacy terminology guard.');
