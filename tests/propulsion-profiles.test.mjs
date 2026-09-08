import assert from 'node:assert/strict';
import {VEIL,THERMAL} from '../src/veil/config.js';
import {createRun,setCombustionHeld,stepRun} from '../src/veil/engine.js';
import {combustionDriveFor,DRIVES} from '../src/veil/growth.js';
import {performanceFor} from '../src/veil/molecule-roles.js';

const emptyMap=()=>({seed:23,dust:[],fields:[],labels:[],routes:[]});
const fuelLoadout=id=>({
  propellant:{molecule:'hydrogen',amount:0},
  fuel:{molecule:id,amount:performanceFor(id,'fuel').capacity},
  oxidizer:{molecule:'oxygen',amount:36},
  coolant:{molecule:null,amount:0},
});

// Fuel changes acceleration response, never the COMBUSTION DRIVE top speed.
const h2Drive=combustionDriveFor('hydrogen'),methaneDrive=combustionDriveFor('methane'),hexaneDrive=combustionDriveFor('n-hexane');
assert.equal(h2Drive.boostSpeed,DRIVES.combustion.boostSpeed);
assert.equal(methaneDrive.boostSpeed,DRIVES.combustion.boostSpeed);
assert.equal(hexaneDrive.boostSpeed,DRIVES.combustion.boostSpeed);
assert.ok(h2Drive.boostAcceleration>methaneDrive.boostAcceleration);
assert.ok(methaneDrive.boostAcceleration>hexaneDrive.boostAcceleration);

const launch=id=>{
  const run=createRun(emptyMap(),VEIL,{fuel:fuelLoadout(id),predators:false});
  setCombustionHeld(run,true);
  for(let i=0;i<24;i++)stepRun(run,{x:0,y:-1},1/60,{consumeCombustion:()=>true});
  return run;
};
const responsive=launch('hydrogen'),balanced=launch('methane'),cruise=launch('n-hexane');
assert.ok(responsive.player.speed>balanced.player.speed,`H2 should build speed sooner: ${responsive.player.speed} <= ${balanced.player.speed}`);
assert.ok(balanced.player.speed>cruise.player.speed,`CH4 should build speed sooner than n-hexane: ${balanced.player.speed} <= ${cruise.player.speed}`);

// Coolant time profile is also mechanical: cryogenic N2 hits harder but expires
// sooner, while glycol applies a weaker cooling rate for much longer.
const coolantRun=id=>{
  const loadout=fuelLoadout('methane');loadout.coolant={molecule:id,amount:1};
  const run=createRun(emptyMap(),VEIL,{fuel:loadout,predators:false});run.heat=THERMAL.coolantStart;setCombustionHeld(run,true);
  stepRun(run,{x:0,y:-1},1/60,{consumeCombustion:()=>true,consumeCoolant:()=>true});
  return run;
};
const nitrogen=coolantRun('nitrogen'),glycol=coolantRun('ethylene-glycol');
assert.equal(nitrogen.fuel.coolant.amount,0);
assert.equal(glycol.fuel.coolant.amount,0);
assert.ok(nitrogen.coolantBuffer<glycol.coolantBuffer);
assert.ok(nitrogen.heat<glycol.heat);

console.log('Propulsion profiles passed: shared top speed, fuel response ordering, and short/strong vs long/weak coolant behavior.');
