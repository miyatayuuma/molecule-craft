import assert from 'node:assert/strict';
import { EXPEDITION } from '../src/veil/config.js';
import { createRun, setCombustionHeld, stepRun } from '../src/veil/engine.js';
import { flightConfig } from '../src/veil/growth.js';
import { runExpeditionSimulation } from '../scripts/simulate-expedition.mjs';
import { performanceFor } from '../src/veil/molecule-roles.js';

const report=runExpeditionSimulation(),byName=Object.fromEntries(report.scenarios.map(item=>[item.name,item]));
const saving=byName.saving,normal=byName.normal,deep=byName.deep,spam=byName['burst-spam'],always=byName['drive-always'],overstay=byName['fuel-saving-overstay'];
const hydrogen=performanceFor('hydrogen','propellant');

assert.equal(saving.returnType,'voluntary');assert.equal(saving.fuelAtomCost,0);assert.ok(saving.grossAtoms>40);assert.equal(saving.maxEaters,1);
assert.equal(normal.returnType,'voluntary');assert.ok(normal.maxEaters>=2);assert.ok(normal.burstUses>0&&normal.burstUses<=hydrogen.capacity/hydrogen.moleculesPerBurst);assert.ok(normal.netPerMinute>=saving.netPerMinute*.9,'the carbon progression run stays near the safe-route net rate after BURST costs');
assert.equal(deep.returnType,'voluntary');assert.ok(deep.maxEaters>=2);assert.equal(deep.fuelUsed.methane,EXPEDITION.methaneCapacity);assert.equal(deep.fuelUsed.oxygen,EXPEDITION.oxygenCapacity);assert.ok(deep.fuelUsed.water>0&&deep.fuelUsed.water<performanceFor('water','coolant').capacity);assert.equal(deep.overheatEvents,0);const deepNetO=deep.collected.O-(deep.fuelUsed.oxygen??0)*2-(deep.fuelUsed.water??0);assert.ok(deepNetO>EXPEDITION.oxygenCapacity*2,'one cooled deep sortie returns more than two baseline O₂ tank refills after oxidizer/coolant costs');assert.ok(deep.netAtoms>0&&deep.grossAtoms>deep.fuelAtomCost,'the successful deep sortie has positive net material return after its consumed loadout');
assert.equal(spam.fuelUsed.hydrogen,hydrogen.capacity);assert.equal(spam.fuelUsed.methane??0,0);assert.equal(spam.returnType,'forced','Spamming the finite emergency load cannot become perpetual cruise');
assert.equal(always.returnType,'forced');assert.ok(always.maxEaters>=3);assert.ok(always.overheatEvents>0,'Continuous combustion without coolant is thermally limited');assert.ok(always.burstUses<=hydrogen.capacity/hydrogen.moleculesPerBurst);
assert.equal(overstay.returnType,'forced');assert.equal(overstay.fuelAtomCost,0);assert.ok(overstay.duration>saving.duration);

const density=report.density,available=id=>density[id].routeUnits+density[id].clusterUnits;
assert.ok(available('carbon')>available('veil'));assert.ok(available('oxygen')>available('carbon'));

// A controlled sustained escape allows the time curve to reach its cap. The
// cap is fixed and never scales with recipes, progress or propulsion speed.
const config={...flightConfig(),bounds:{left:-1e6,right:1e6,top:-1e6,bottom:1e6},spawn:{x:0,y:0,angle:0},gate:{x:2e6,y:2e6,width:1,height:1}},map={seed:7,dust:[],fields:[],labels:[],routes:[]};
const capped=createRun(map,config,{fuel:{methane:100,oxygen:200}});setCombustionHeld(capped,true);
for(let frame=0;frame<130*60;frame++)stepRun(capped,{x:1,y:0},1/60,{consumeCombustion:()=>true});
assert.equal(capped.captured,false);assert.equal(capped.eaters.length,EXPEDITION.eaterThresholds.length);

console.log('Expedition balance passed: distinct saving/normal/deep returns, positive deep fuel ROI, finite BURST and DRIVE extremes, overstay capture, depth density growth and fixed eater cap.');
