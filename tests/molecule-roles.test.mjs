import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  ROLE_BALANCE_VERSION,
  activeTankRolesFor,
  combustionPacketFor,
  MOLECULE_ROLE_PROFILES,
  moleculesForRole,
  performanceFor,
  rolesFor,
  tankCapacityFor,
} from '../src/veil/molecule-roles.js';
import {MOLECULE_USES} from '../src/veil/growth.js';

const database=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
const records=new Map(database.map(record=>[record.id,record]));
const countAtoms=record=>record.atoms.reduce((counts,element)=>(counts[element]=(counts[element]??0)+1,counts),{});

assert.equal(ROLE_BALANCE_VERSION,1);
assert.equal(moleculesForRole('propellant').length,5);
assert.equal(moleculesForRole('fuel').length,15);
assert.equal(moleculesForRole('coolant').length,8);
assert.deepEqual(moleculesForRole('oxidizer'),['oxygen']);

for(const [id,profile] of Object.entries(MOLECULE_ROLE_PROFILES)){
  assert.ok(records.has(id),`${id} must exist in the chemistry database`);
  assert.ok(profile.roles.length>0,`${id} must declare at least one role`);
  assert.deepEqual(rolesFor(id),profile.roles);
  for(const role of profile.roles)assert.ok(performanceFor(id,role),`${id}/${role} must have performance data`);
}

// Fuel O2 ratios follow complete-combustion stoichiometry. Energy, capacity and
// heatFactor are intentionally compressed game-balance values.
for(const id of moleculesForRole('fuel')){
  const atoms=countAtoms(records.get(id));
  const expected=(atoms.C??0)+(atoms.H??0)/4-(atoms.O??0)/2;
  const fuel=performanceFor(id,'fuel');
  assert.equal(fuel.oxygenPerFuel,expected,`${id} O2/fuel must match its formula`);
  assert.ok(fuel.capacity>0&&fuel.energy>0&&fuel.heatFactor>0);
}
assert.deepEqual(performanceFor('methane','fuel'),{capacity:18,oxygenPerFuel:2,energy:1,heatFactor:1});
assert.deepEqual(performanceFor('hydrogen','fuel'),{capacity:28,oxygenPerFuel:.5,energy:.3,heatFactor:.75});
assert.equal(performanceFor('n-hexane','fuel').energy,5.19);

const burstTargets={hydrogen:3,ammonia:8,nitrogen:8,'carbon-dioxide':9,'n-butane':10};
for(const [id,bursts] of Object.entries(burstTargets)){
  const propellant=performanceFor(id,'propellant');
  assert.equal(Math.floor(propellant.capacity/propellant.moleculesPerBurst),bursts,`${id} full tank burst count`);
  assert.ok(propellant.burstPower>0&&propellant.burstPower<=1);
}
assert.deepEqual(performanceFor('hydrogen','propellant'),{capacity:120,moleculesPerBurst:40,burstPower:1});
assert.equal(tankCapacityFor('propellant','hydrogen'),120);
assert.deepEqual(activeTankRolesFor('ammonia'),['propellant','fuel']);
assert.deepEqual(activeTankRolesFor('water'),[],'Coolant remains data-only until thermal runtime exists');
assert.deepEqual(combustionPacketFor('methane'),{fuel:'methane',fuelAmount:1,oxidizer:'oxygen',oxygenAmount:2,seconds:2});
assert.deepEqual(combustionPacketFor('hydrogen'),{fuel:'hydrogen',fuelAmount:2,oxidizer:'oxygen',oxygenAmount:1,seconds:1.2});
assert.deepEqual(combustionPacketFor('ammonia'),{fuel:'ammonia',fuelAmount:4,oxidizer:'oxygen',oxygenAmount:3,seconds:3.2});

// Coolant keeps total capacity and harsh-environment tolerance separate so a
// later thermal system can make high-performance fluids situationally valuable.
for(const id of moleculesForRole('coolant')){
  const coolant=performanceFor(id,'coolant');
  assert.ok(coolant.capacity>0&&coolant.coolingPower>0&&coolant.environmentTolerance>=1);
}
assert.ok(performanceFor('ethylene-glycol','coolant').environmentTolerance>performanceFor('water','coolant').environmentTolerance);
assert.ok(performanceFor('nitrogen','coolant').environmentTolerance>performanceFor('water','coolant').environmentTolerance);

// Progression-specific records remain separate: runtime roles must not alter
// unknown-signal eligibility by being copied into MOLECULE_USES.
assert.equal(MOLECULE_USES['carbon-dioxide'],undefined);
assert.deepEqual(MOLECULE_USES.hydrogen.tankUses,['propellant']);
assert.deepEqual(MOLECULE_USES.methane.tankUses,['fuel']);
assert.deepEqual(MOLECULE_USES.oxygen.tankUses,['oxidizer']);

console.log('Molecule role balance passed: DB coverage, fuel stoichiometry, burst economics, coolant profiles, and staged runtime activation.');
