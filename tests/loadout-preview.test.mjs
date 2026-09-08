import assert from 'node:assert/strict';
import {
  propellantPreviewValues,
  fuelPreviewValues,
  coolantPreviewValues,
  loadoutPreviewValues,
} from '../src/veil/loadout-preview.js';

const h2Burst=propellantPreviewValues('hydrogen');
const co2Burst=propellantPreviewValues('carbon-dioxide');
assert.ok(h2Burst.burstDistance>co2Burst.burstDistance,'H2 burst should visibly travel farther than CO2');
assert.equal(h2Burst.fullShots,3);
assert.equal(co2Burst.fullShots,9);
assert.equal(propellantPreviewValues('hydrogen',{amount:80}).shots,2);

const h2Fuel=fuelPreviewValues('hydrogen',{oxygenAmount:36,coolantId:'water'});
const dmeFuel=fuelPreviewValues('dimethyl-ether',{oxygenAmount:36,coolantId:'water'});
const hexaneFuel=fuelPreviewValues('n-hexane',{oxygenAmount:36,coolantId:'water'});
assert.ok(h2Fuel.responseVisual>dmeFuel.responseVisual);
assert.ok(dmeFuel.responseVisual>hexaneFuel.responseVisual);
assert.notEqual(h2Fuel.fuelDrainRate,hexaneFuel.fuelDrainRate);
assert.notEqual(h2Fuel.oxygenDrainRate,hexaneFuel.oxygenDrainRate);
assert.notEqual(h2Fuel.heatRise,hexaneFuel.heatRise);
assert.ok(fuelPreviewValues('methane',{coolantId:'nitrogen'}).heatRise<fuelPreviewValues('methane',{coolantId:'water'}).heatRise,'strong coolant should suppress the fuel preview heat rise');

const nitrogen=coolantPreviewValues('nitrogen');
const glycol=coolantPreviewValues('ethylene-glycol');
assert.ok(nitrogen.initialCooling>glycol.initialCooling,'N2 should cool faster initially');
assert.ok(nitrogen.endurance<glycol.endurance,'glycol should persist longer');
assert.ok(nitrogen.highHeatTolerance<glycol.highHeatTolerance,'glycol should retain more high-temperature effectiveness');
assert.ok(nitrogen.depletionRate>glycol.depletionRate,'N2 should deplete faster in the preview');

assert.deepEqual(loadoutPreviewValues('oxidizer','oxygen'),{minimal:true});
assert.equal(loadoutPreviewValues('fuel','oxygen'),null);

console.log('Loadout preview values passed: propellant burst/shot tradeoff, fuel response/consumption/heat, coolant rate/endurance/tolerance.');
