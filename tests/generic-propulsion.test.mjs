import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRun,stepRun,beginBurst,setCombustionHeld} from '../src/veil/engine.js';
import {flightConfig,propulsionGauge} from '../src/veil/growth.js';
import {combustionPacketFor,moleculesForRole,performanceFor} from '../src/veil/molecule-roles.js';
import {createResources} from '../src/veil/resources.js';

const emptyMap=()=>({seed:1,dust:[],fields:[],labels:[],routes:[]});
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const database=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));

// Every registered propellant is a real runtime input. A full tank provides the
// declared BURST count, consumes molecule-count units, and changes movement.
let previousSpeed=Infinity;
for(const id of moleculesForRole('propellant')){
  const profile=performanceFor(id,'propellant'),run=createRun(emptyMap(),flightConfig(),{fuel:{propellant:{molecule:id,amount:profile.capacity}},predators:false});let spent=null;
  assert.ok(beginBurst(run,(amount,molecule)=>(spent={amount,molecule},true)),`${id} starts BURST`);
  assert.deepEqual(spent,{amount:profile.moleculesPerBurst,molecule:id});
  assert.equal(run.fuel.propellant.amount,profile.capacity-profile.moleculesPerBurst);
  assert.equal(Math.floor(profile.capacity/profile.moleculesPerBurst),Math.floor((run.fuel.propellant.amount+profile.moleculesPerBurst)/profile.moleculesPerBurst));
  stepRun(run,{x:1,y:0},.25);assert.ok(run.player.speed<previousSpeed,`${id} burstPower ordering affects real speed`);previousSpeed=run.player.speed;
}

// Every fuel pays the smallest whole-molecule packet. Energy controls paid burn
// time, O2 stoichiometry controls real oxidizer use, and surplus O2 survives.
for(const id of moleculesForRole('fuel')){
  const packet=combustionPacketFor(id),run=createRun(emptyMap(),flightConfig(),{fuel:{fuel:{molecule:id,amount:packet.fuelAmount},oxidizer:{molecule:'oxygen',amount:packet.oxygenAmount+2}},predators:false});let paid=null;
  setCombustionHeld(run,true);stepRun(run,{x:1,y:0},1/60,{consumeCombustion:value=>(paid=value,true)});
  assert.deepEqual(paid,packet,`${id} packet reaches the resource layer`);
  assert.equal(run.fuel.fuel.amount,0);assert.equal(run.fuel.oxidizer.amount,2,`${id} preserves non-limiting O2`);
  assert.ok(Math.abs(run.driveBuffer-(packet.seconds-1/60))<1e-8,`${id} energy controls paid drive time`);
  const preserved=run.driveBuffer;setCombustionHeld(run,false);stepRun(run,{x:1,y:0},1);assert.equal(run.driveBuffer,preserved,`${id} release preserves paid fuel`);
}
const butaneFull={fuel:{molecule:'n-butane',amount:9},oxidizer:{molecule:'oxygen',amount:36}};
assert.equal(propulsionGauge('combustion',butaneFull).ratio,1,'High-energy fuel gauge uses its own packet duration');
assert.equal(propulsionGauge('combustion',{fuel:{molecule:'n-butane',amount:2},oxidizer:{molecule:'oxygen',amount:13}}).ratio,.5);

const resources=createResources({storage:memory()});resources.setCatalog(database);
for(const id of ['hydrogen','ammonia','nitrogen','carbon-dioxide','n-butane','oxygen','water'])resources.discover(id);
assert.deepEqual(resources.tankCatalog('propellant').map(record=>record.id).sort(),['hydrogen','ammonia','nitrogen','carbon-dioxide','n-butane'].sort());
assert.deepEqual(resources.tankCatalog('oxidizer').map(record=>record.id),['oxygen']);
assert.deepEqual(resources.tankCatalog('coolant').map(record=>record.id).sort(),['water','nitrogen','carbon-dioxide','ammonia'].sort());
assert.equal(resources.maxCraftable('water'),0);resources.state.elements.H=4;resources.state.elements.O=2;assert.equal(resources.maxCraftable('water'),2);assert.equal(resources.tankFillPlan('coolant','water').maxAdd,2,'Active coolant roles receive physical inventory');

console.log('Generic propulsion passed: registered propellants, fuels and coolants are active, and integer packets preserve remainders.');
