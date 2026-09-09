import assert from 'node:assert/strict';
import {propellantPreviewValues,fuelPreviewValues,coolantPreviewValues,oxidizerPreviewValues,loadoutPreviewValues} from '../src/veil/loadout-preview.js';

const h2=propellantPreviewValues('hydrogen');
const co2=propellantPreviewValues('carbon-dioxide');
assert.ok(h2.burstVisual>co2.burstVisual,'H2 keeps the stronger single BURST');
assert.equal(h2.fullShots,3);
assert.equal(co2.fullShots,9);
assert.equal(propellantPreviewValues('hydrogen',{amount:80}).shots,2);
assert.ok(co2.shots>h2.shots,'CO2 keeps the higher BURST count');

const methane=fuelPreviewValues('methane',{oxygenAmount:36,coolantId:'water'});
const hydrogen=fuelPreviewValues('hydrogen',{oxygenAmount:36,coolantId:'water'});
const methaneStrongCooling=fuelPreviewValues('methane',{oxygenAmount:36,coolantId:'nitrogen'});
assert.ok(hydrogen.responseVisual>methane.responseVisual,'Fast-response fuels rank higher on acceleration');
assert.ok(methane.endurance>hydrogen.endurance,'Longer-running fuel loadouts rank higher on endurance');
assert.ok(methaneStrongCooling.thermalMargin>methane.thermalMargin,'Stronger coolant increases thermal margin');
assert.ok(methane.thermalMargin>=0&&methane.thermalMargin<=1);

const nitrogen=coolantPreviewValues('nitrogen');
const water=coolantPreviewValues('water');
const glycol=coolantPreviewValues('ethylene-glycol');
assert.ok(nitrogen.cooling>glycol.cooling,'N2 keeps the stronger initial cooling');
assert.ok(glycol.endurance>water.endurance,'Glycol exposes its longer coolant endurance');
assert.ok(glycol.thermalMargin>nitrogen.thermalMargin,'Glycol keeps the larger high-temperature margin');

const oxygen=oxidizerPreviewValues('oxygen');
assert.equal(oxygen.burnSupply,1);
assert.equal(oxygen.oxidizingPower,1);
assert.deepEqual(loadoutPreviewValues('oxidizer','oxygen'),oxygen);
assert.equal(loadoutPreviewValues('fuel','oxygen'),null);

console.log('Loadout preview bars passed: PULSE tradeoff and role-specific DRIVE metrics.');
