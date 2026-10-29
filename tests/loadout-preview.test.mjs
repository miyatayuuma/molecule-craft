import assert from 'node:assert/strict';
import {propellantPreviewValues,fuelPreviewValues,coolantPreviewValues,loadoutPreviewValues,renderLoadoutPreview} from '../src/veil/loadout-preview.js';
import {combustionBurnPlanFor,performanceFor} from '../src/veil/molecule-roles.js';

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

function assertFuelPreviewMatchesRuntime(id,fuelAmount,oxygenAmount){
  const burnPlan=combustionBurnPlanFor(id,{fuelAmount,oxygenAmount}),preview=fuelPreviewValues(id,{fuelAmount,oxygenAmount,coolantId:'water'});
  assert.equal(preview.limitingSeconds,burnPlan.seconds,`${id} LOADOUT endurance uses the production combustion burn plan`);
  return burnPlan;
}
const propaneAudit=assertFuelPreviewMatchesRuntime('propane',5,18);
assert.equal(propaneAudit.fuelUsed,3);
assert.equal(propaneAudit.oxygenUsed,15);
assert.ok(Math.abs(propaneAudit.seconds-15.3)<1e-9);
const hexaneAudit=assertFuelPreviewMatchesRuntime('n-hexane',6,36);
assert.equal(hexaneAudit.fuelUsed,3);
assert.equal(hexaneAudit.oxygenUsed,29);
assert.ok(Math.abs(hexaneAudit.seconds-31.14)<1e-9);
assert.equal(fuelPreviewValues('propane',{fuelAmount:0,oxygenAmount:18}).limitingSeconds,0,'Explicit zero fuel does not fall back to capacity');
assert.equal(fuelPreviewValues('propane',{fuelAmount:5,oxygenAmount:0}).limitingSeconds,0,'Explicit zero O₂ does not fall back to 36');
const belowCapacityOxygen=assertFuelPreviewMatchesRuntime('methane',5,4);
assert.equal(belowCapacityOxygen.seconds,4,'Actual partial O₂ below 36 limits the runtime plan');
const methaneCapacity=performanceFor('methane','fuel').capacity;
assert.equal(assertFuelPreviewMatchesRuntime('methane',methaneCapacity,36).seconds,36,'FULL fuel amount uses runtime packets with the fixed planned O₂ capacity');
for(const id of ['methane','propane','n-hexane'])assertFuelPreviewMatchesRuntime(id,performanceFor(id,'fuel').capacity,36);


const nitrogen=coolantPreviewValues('nitrogen');
const water=coolantPreviewValues('water');
const glycol=coolantPreviewValues('ethylene-glycol');
assert.ok(nitrogen.cooling>glycol.cooling,'N2 keeps the stronger initial cooling');
assert.ok(glycol.endurance>water.endurance,'Glycol exposes its longer coolant endurance');
assert.ok(glycol.thermalMargin>nitrogen.thermalMargin,'Glycol keeps the larger high-temperature margin');

assert.equal(loadoutPreviewValues('oxidizer','oxygen'),null,'LOADOUT exposes O₂ stock without an upgrade preview');
assert.equal(loadoutPreviewValues('fuel','oxygen'),null);

class FakeNode{
  constructor(tag='div'){this.tag=tag;this.children=[];this.style={};this.dataset={};this.attributes={};this.hidden=false;this.className='';this.textContent='';}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=[...items];}
  closest(){return null;}
  setAttribute(name,value){this.attributes[name]=String(value);}
}
const originalDocument=globalThis.document;
try{
  globalThis.document={createElement:tag=>new FakeNode(tag)};
  const empty=new FakeNode();
  assert.equal(renderLoadoutPreview(empty,{use:'propellant',candidateId:null}),null);
  assert.equal(empty.hidden,true,'No selected PULSE molecule leaves a natural empty preview');
  assert.equal(empty.children.length,0,'No placeholder or ghost dots are emitted without a selection');

  const host=new FakeNode();
  const rendered=renderLoadoutPreview(host,{use:'propellant',candidateId:'hydrogen',currentId:'hydrogen',currentAmount:0});
  assert.equal(host.hidden,false);
  assert.equal(host.dataset.previewKind,'propellant');
  assert.equal(rendered.candidate.fullShots,3);
  assert.equal(rendered.current.shots,0,'Current fill may be empty without changing capability');
  assert.equal(host.children.length,2,'PULSE preview renders stats and capability dots');
  const charges=host.children[1];
  assert.equal(charges.children.length,1,'PULSE has no ghost comparison row');
  const chargeRow=charges.children[0];
  assert.equal(chargeRow.dataset.ghost,undefined,'No ghost-dot state is emitted');
  assert.equal(chargeRow.children[0].textContent,'PULSE');
  assert.equal(chargeRow.children[1].children.length,3,'H2 shows only its canonical maximum PULSE count');

  const changed=new FakeNode();
  renderLoadoutPreview(changed,{use:'propellant',candidateId:'carbon-dioxide',currentId:'hydrogen',currentAmount:0});
  assert.equal(changed.children[1].children.length,1);
  assert.equal(changed.children[1].children[0].children[1].children.length,9,'Molecule changes follow canonical propellant performance');

  const fuelHost=new FakeNode();
  const fuelRendered=renderLoadoutPreview(fuelHost,{use:'fuel',candidateId:'propane',currentId:'propane',candidateAmount:5,currentAmount:2,oxygenAmount:18,currentOxygenAmount:36,coolantId:'water'});
  assert.ok(Math.abs(fuelRendered.candidate.limitingSeconds-15.3)<1e-9,'Candidate uses launch-planned fuel and O₂');
  assert.ok(Math.abs(fuelRendered.current.limitingSeconds-10.2)<1e-9,'Current marker uses current fuel and current O₂');
  const zeroFuelHost=new FakeNode();
  const zeroFuel=renderLoadoutPreview(zeroFuelHost,{use:'fuel',candidateId:'propane',candidateAmount:0,oxygenAmount:36});
  assert.equal(zeroFuel.candidate.limitingSeconds,0,'Rendered candidate preserves explicit zero fuel');
  const zeroOxygenHost=new FakeNode();
  const zeroOxygen=renderLoadoutPreview(zeroOxygenHost,{use:'fuel',candidateId:'propane',candidateAmount:5,oxygenAmount:0});
  assert.equal(zeroOxygen.candidate.limitingSeconds,0,'Rendered candidate preserves explicit zero O₂');
  const fullFuelHost=new FakeNode();
  const fullFuel=renderLoadoutPreview(fullFuelHost,{use:'fuel',candidateId:'methane',candidateAmount:methaneCapacity,oxygenAmount:36});
  assert.equal(fullFuel.candidate.limitingSeconds,36,'Rendered FULL load uses tank capacity and planned O₂');


}finally{
  if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
}

console.log('Loadout preview passed: runtime combustion endurance, planned/current amounts, explicit zero, and role-specific DRIVE metrics; O₂ has no upgrade panel.');
