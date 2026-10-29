import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRun,setCombustionHeld,stepRun} from '../src/veil/engine.js';
import {THERMAL} from '../src/veil/config.js';
import {flightConfig} from '../src/veil/growth.js';
import {combustionBurnPlanFor,combustionChargeFor,combustionPacketFor,moleculesForRole,performanceFor} from '../src/veil/molecule-roles.js';
import {createResources} from '../src/veil/resources.js';

const database=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
const emptyMap=()=>({seed:1,dust:[],fields:[],labels:[],routes:[]});
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const expectedWholeFuel=(fuel,oxygen)=>Math.min(fuel.capacity,Math.floor(oxygen/fuel.oxygenPerFuel+1e-10));
const expectedWholeOxygen=(fuel,count)=>Math.ceil(count*fuel.oxygenPerFuel-1e-10);

function resourcesFor(id,fuelAmount,oxygenAmount){
  const resources=createResources({storage:memory()});resources.setCatalog(database);resources.discover(id);resources.discover('oxygen');
  resources.state.tanks.fuel={molecule:id,amount:fuelAmount};resources.state.tanks.oxidizer={molecule:'oxygen',amount:oxygenAmount};assert.ok(resources.save(),`${id} initial resource state must persist: ${resources.message}`);return resources;
}

function exhaust(id,fuelAmount,oxygenAmount){
  const resources=resourcesFor(id,fuelAmount,oxygenAmount),run=createRun(emptyMap(),flightConfig(),{fuel:{fuel:{molecule:id,amount:fuelAmount},oxidizer:{molecule:'oxygen',amount:oxygenAmount}},predators:false});
  run.combustionHeatFactor=0;setCombustionHeld(run,true);let frames=0;
  while(!run.driveEmpty&&frames++<12000)stepRun(run,{x:0,y:0},.15,{consumeCombustion:charge=>resources.consumeCombustion(charge)});
  assert.ok(run.driveEmpty,`${id} must reach a real resource limit`);assert.ok(frames<12000,`${id} exhaustion must terminate`);return {run,resources};
}

test('partial packet tails use every whole fuel molecule supported by integer O2 inventory',()=>{
  for(const id of moleculesForRole('fuel')){
    const fuel=performanceFor(id,'fuel'),plan=combustionBurnPlanFor(id,{fuelAmount:fuel.capacity,oxygenAmount:36});
    const expectedFuel=expectedWholeFuel(fuel,36),expectedOxygen=expectedWholeOxygen(fuel,expectedFuel);
    assert.equal(plan.fuelUsed,expectedFuel,`${id} usable fuel count`);assert.equal(plan.oxygenUsed,expectedOxygen,`${id} cumulative O2`);
    assert.ok(Number.isInteger(plan.fuelUsed)&&Number.isInteger(plan.oxygenUsed),`${id} keeps integer inventory`);
    assert.equal(combustionChargeFor(id,{fuelAmount:plan.fuelRemaining,oxygenAmount:plan.oxygenRemaining}),null,`${id} stops only when another whole fuel unit is not supportable`);
  }
});

test('n-hexane keeps exact packets but can burn the old 4 fuel / 17 O2 dead state',()=>{
  assert.deepEqual(combustionPacketFor('n-hexane'),{fuel:'n-hexane',fuelAmount:2,oxidizer:'oxygen',oxygenAmount:19,seconds:20.76});
  assert.deepEqual(combustionChargeFor('n-hexane',{fuelAmount:6,oxygenAmount:36}),combustionPacketFor('n-hexane'));
  assert.deepEqual(combustionChargeFor('n-hexane',{fuelAmount:4,oxygenAmount:17}),{fuel:'n-hexane',fuelAmount:1,oxidizer:'oxygen',oxygenAmount:10,seconds:10.38});
  assert.equal(combustionChargeFor('n-hexane',{fuelAmount:3,oxygenAmount:7}),null);
  assert.deepEqual(combustionBurnPlanFor('n-hexane',{fuelAmount:6,oxygenAmount:36}),{fuel:'n-hexane',oxidizer:'oxygen',fuelUsed:3,oxygenUsed:29,fuelRemaining:3,oxygenRemaining:7,seconds:31.14,charges:2});
});

test('resource transaction accepts the exact tail charge and rejects stale or impossible charges',()=>{
  const resources=resourcesFor('n-hexane',4,17),tail=combustionChargeFor('n-hexane',{fuelAmount:4,oxygenAmount:17});
  assert.ok(resources.consumeCombustion(tail));assert.deepEqual(resources.state.tanks.fuel,{molecule:'n-hexane',amount:3});assert.deepEqual(resources.state.tanks.oxidizer,{molecule:'oxygen',amount:7});
  assert.equal(resources.consumeCombustion(tail),false,'a stale 1 + 10 tail cannot overspend the tank');
});

test('engine ignites from residual n-hexane, then distinguishes resource exhaustion from thermal cutoff and re-input',()=>{
  const resources=resourcesFor('n-hexane',4,17),run=createRun(emptyMap(),flightConfig(),{fuel:{fuel:{molecule:'n-hexane',amount:4},oxidizer:{molecule:'oxygen',amount:17}},predators:false});run.combustionHeatFactor=0;setCombustionHeld(run,true);
  const ignition=stepRun(run,{x:0,y:0},1/60,{consumeCombustion:charge=>resources.consumeCombustion(charge)});
  assert.ok(ignition.some(event=>event.type==='driveIgnition'));assert.equal(run.player.combustion,true);assert.equal(run.overheated,false);assert.deepEqual([run.fuel.fuel.amount,run.fuel.oxidizer.amount],[3,7]);
  let calls=1;while(!run.driveEmpty&&calls<2000){stepRun(run,{x:0,y:0},.15,{consumeCombustion:charge=>(calls++,resources.consumeCombustion(charge))});}assert.ok(run.driveEmpty);assert.equal(run.overheated,false);
  const before=calls;setCombustionHeld(run,false);setCombustionHeld(run,true);const retry=stepRun(run,{x:0,y:0},.15,{consumeCombustion:()=>{calls++;return true;}});assert.equal(calls,before);assert.ok(retry.some(event=>event.type==='driveEmpty')===false,'re-input does not fabricate another charge or duplicate the empty event');

  const thermal=createRun(emptyMap(),flightConfig(),{fuel:{fuel:{molecule:'methane',amount:3},oxidizer:{molecule:'oxygen',amount:6}},predators:false});thermal.heat=THERMAL.overheatThreshold-.01;setCombustionHeld(thermal,true);const thermalEvents=stepRun(thermal,{x:0,y:0},.15,{consumeCombustion:()=>true});assert.equal(thermal.overheated,true);assert.ok(thermalEvents.some(event=>event.type==='overheat'));assert.ok(!thermalEvents.some(event=>event.type==='driveEmpty'),'thermal cutoff is not resource exhaustion');
});

test('full launch-to-exhaustion consumption matches the integer stoichiometric maximum for every fuel',()=>{
  for(const id of moleculesForRole('fuel')){
    const fuel=performanceFor(id,'fuel'),plan=combustionBurnPlanFor(id,{fuelAmount:fuel.capacity,oxygenAmount:36}),{run,resources}=exhaust(id,fuel.capacity,36);
    assert.deepEqual([run.fuel.fuel.amount,run.fuel.oxidizer.amount],[plan.fuelRemaining,plan.oxygenRemaining],`${id} runtime totals`);
    assert.deepEqual([resources.state.tanks.fuel.amount,resources.state.tanks.oxidizer.amount],[plan.fuelRemaining,plan.oxygenRemaining],`${id} persistent totals`);
  }
});
