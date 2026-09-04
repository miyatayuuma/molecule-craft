import assert from 'node:assert/strict';
import {THERMAL,VEIL} from '../src/veil/config.js';
import {beginBurst,createRun,setCombustionHeld,stepRun} from '../src/veil/engine.js';
import {moleculesForRole,performanceFor} from '../src/veil/molecule-roles.js';
import {completeExpeditionTelemetry} from '../src/veil/telemetry.js';

const emptyMap=()=>({seed:1,dust:[],fields:[],labels:[],routes:[]});
const advance=(run,seconds,systems={})=>{const events=[];for(let i=0;i<Math.round(seconds*60);i++)events.push(...stepRun(run,{x:1,y:0},1/60,systems));return events;};
const combustion=()=>true;

// Short burns are unrestricted. Without coolant, methane reaches the hard
// limit at roughly ten seconds and naturally recovers while the paid packet is
// retained for automatic re-ignition.
const short=createRun(emptyMap(),VEIL,{fuel:{fuel:{molecule:'methane',amount:20},oxidizer:{molecule:'oxygen',amount:40}},predators:false});setCombustionHeld(short,true);advance(short,3,{consumeCombustion:combustion});assert.ok(short.player.combustion);assert.ok(short.heat>29&&short.heat<31);assert.equal(short.overheated,false);

const hot=createRun(emptyMap(),VEIL,{fuel:{fuel:{molecule:'n-hexane',amount:6},oxidizer:{molecule:'oxygen',amount:36}},predators:false});setCombustionHeld(hot,true);const hotEvents=advance(hot,8.2,{consumeCombustion:combustion});assert.ok(hotEvents.some(event=>event.type==='overheat'));assert.equal(hot.overheated,true);assert.equal(hot.player.combustion,false);const paidAtCutoff=hot.driveBuffer;assert.ok(paidAtCutoff>0,'Overheat preserves already purchased combustion time');
const recoveryEvents=advance(hot,4,{consumeCombustion:combustion});assert.ok(recoveryEvents.some(event=>event.type==='heatRecovered'));assert.equal(hot.overheated,false);assert.equal(hot.player.combustion,true,'A held control automatically re-ignites after cooling');assert.ok(hot.driveBuffer<paidAtCutoff);

// The thermostat starts at 35, consumes whole coolant molecules only after a
// durable callback succeeds, and keeps sustained methane below overheat.
const cooled=createRun(emptyMap(),VEIL,{fuel:{fuel:{molecule:'methane',amount:20},oxidizer:{molecule:'oxygen',amount:40},coolant:{molecule:'water',amount:20}},predators:false});let coolantSpent=0;setCombustionHeld(cooled,true);const cooledEvents=advance(cooled,20,{consumeCombustion:combustion,consumeCoolant:(amount,molecule)=>{assert.equal(amount,1);assert.equal(molecule,'water');coolantSpent+=amount;return true;}});assert.ok(cooledEvents.some(event=>event.type==='coolantStart'));assert.equal(cooled.overheated,false);assert.ok(cooled.heat>=THERMAL.coolantStart-3&&cooled.heat<THERMAL.hotThreshold);assert.equal(cooled.fuel.coolant.amount,20-coolantSpent);assert.ok(coolantSpent>0);

const rejected=createRun(emptyMap(),VEIL,{fuel:{fuel:{molecule:'methane',amount:2},oxidizer:{molecule:'oxygen',amount:4},coolant:{molecule:'water',amount:1}},predators:false});rejected.heat=THERMAL.coolantStart;setCombustionHeld(rejected,true);advance(rejected,1/60,{consumeCombustion:combustion,consumeCoolant:()=>false});assert.equal(rejected.fuel.coolant.amount,1);assert.equal(rejected.coolantBuffer,0);assert.equal(rejected.coolantActive,false);

for(const molecule of moleculesForRole('coolant')){
  const profile=performanceFor(molecule,'coolant'),run=createRun(emptyMap(),VEIL,{fuel:{fuel:{molecule:'methane',amount:2},oxidizer:{molecule:'oxygen',amount:4},coolant:{molecule,amount:1}},predators:false});run.heat=THERMAL.coolantStart;setCombustionHeld(run,true);advance(run,1,{consumeCombustion:combustion,consumeCoolant:()=>true});
  const expected=THERMAL.coolantStart+THERMAL.heatPerSecond-THERMAL.coolantCoolingPerSecond*profile.coolingPower;assert.ok(Math.abs(run.heat-expected)<1e-8,`${molecule} coolingPower drives real heat removal`);assert.equal(run.fuel.coolant.amount,0);
}

const burst=createRun(emptyMap(),VEIL,{fuel:{propellant:{molecule:'hydrogen',amount:40}},predators:false});assert.ok(beginBurst(burst,()=>true));advance(burst,1);assert.equal(burst.heat,0,'BURST is thermally independent in v1');

const depleted=createRun(emptyMap(),VEIL,{fuel:{fuel:{molecule:'methane',amount:20},oxidizer:{molecule:'oxygen',amount:40},coolant:{molecule:'water',amount:1}},predators:false});setCombustionHeld(depleted,true);const depletedEvents=advance(depleted,14,{consumeCombustion:combustion,consumeCoolant:()=>true});assert.equal(depletedEvents.filter(event=>event.type==='coolantEmpty').length,1);assert.equal(depleted.fuel.coolant.amount,0);assert.equal(depleted.overheated,true);

const report=completeExpeditionTelemetry(cooled,{result:{lost:{H:0,C:0,O:0}}});assert.equal(report.loadout.coolant.molecule,'water');assert.equal(report.loadout.coolant.used,coolantSpent);assert.equal(report.fuelUsed.water,coolantSpent);assert.equal(report.overheatEvents,0);assert.ok(report.maxHeat>=cooled.heat);

console.log('Thermal coolant passed: short-burn freedom, hard cutoff, automatic cooling/recovery, atomic consumption, depletion, and telemetry.');
