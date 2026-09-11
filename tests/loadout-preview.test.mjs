import assert from 'node:assert/strict';
import {propellantPreviewValues,fuelPreviewValues,coolantPreviewValues,oxidizerPreviewValues,loadoutPreviewValues,renderLoadoutPreview} from '../src/veil/loadout-preview.js';

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
assert.equal(oxygen.oxidizingPower,1);
assert.deepEqual(loadoutPreviewValues('oxidizer','oxygen'),oxygen);
assert.equal(loadoutPreviewValues('fuel','oxygen'),null);

// Regression for #122: the PULSE comparison is rendered again during launch
// preparation. An undeclared `dots` binding here used to throw after the tank
// fill commit, before LOADOUT could close and onLaunchReady could run.
class FakeNode{
  constructor(tag='div'){this.tag=tag;this.children=[];this.style={};this.dataset={};this.hidden=false;this.className='';this.textContent='';}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=[...items];}
  closest(){return null;}
}
const originalDocument=globalThis.document;
try{
  globalThis.document={createElement:tag=>new FakeNode(tag)};
  const host=new FakeNode();
  const rendered=renderLoadoutPreview(host,{use:'propellant',candidateId:'hydrogen',currentId:'hydrogen',currentAmount:80});
  assert.equal(host.hidden,false);
  assert.equal(host.dataset.previewKind,'propellant');
  assert.equal(rendered.candidate.shots,3);
  assert.equal(rendered.current.shots,2);
  assert.equal(host.children.length,2,'PULSE preview renders stats and charge rows without throwing');
}finally{
  if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
}

console.log('Loadout preview bars passed: PULSE tradeoff, renderable charge rows and role-specific DRIVE metrics.');
