import assert from 'node:assert/strict';
import test from 'node:test';
import {behaviorProfile,bottleneckFor,rolePreviewModel} from '../src/veil/equipment-ux.js';

test('fuel profiles preserve distinct operational character without exposing raw stats',()=>{
  const hydrogen=behaviorProfile('hydrogen','fuel');
  const hexane=behaviorProfile('n-hexane','fuel');
  const ethyne=behaviorProfile('ethyne','fuel');
  assert.ok(hydrogen.response>hexane.response);
  assert.ok(ethyne.heat>hydrogen.heat);
  assert.ok(hexane.oxygen>hydrogen.oxygen);
});

test('coolants separate burst cooling from endurance and hot-environment tolerance',()=>{
  const nitrogen=behaviorProfile('nitrogen','coolant');
  const glycol=behaviorProfile('ethylene-glycol','coolant');
  assert.ok(nitrogen.drive>glycol.drive);
  assert.ok(glycol.endurance>nitrogen.endurance);
  assert.ok(glycol.tolerance>nitrogen.tolerance);
});

test('fuel bottleneck reacts to expedition support state',()=>{
  const unsupported=bottleneckFor('ethyne','fuel',{oxidizerRatio:1,coolantRatio:0});
  const cooled=bottleneckFor('ethyne','fuel',{oxidizerRatio:1,coolantRatio:1});
  assert.equal(unsupported.part,'heat');
  assert.ok(['heat','oxygen','fuel'].includes(cooled.part));
});

test('propellant preview makes H2 a stronger but scarcer burst than CO2',()=>{
  const hydrogen=rolePreviewModel('hydrogen','propellant');
  const carbonDioxide=rolePreviewModel('carbon-dioxide','propellant');
  assert.equal(hydrogen.kind,'burst');
  assert.equal(carbonDioxide.kind,'burst');
  assert.ok(hydrogen.kick>carbonDioxide.kick);
  assert.ok(hydrogen.shots<carbonDioxide.shots);
});

test('fuel and coolant use different preview phenomena',()=>{
  const fuel=rolePreviewModel('methane','fuel');
  const coolant=rolePreviewModel('water','coolant');
  assert.equal(fuel.kind,'fuel');
  assert.equal(coolant.kind,'coolant');
  assert.ok('response' in fuel);
  assert.ok('cooling' in coolant);
});
