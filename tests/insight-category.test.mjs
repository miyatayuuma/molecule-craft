import assert from 'node:assert/strict';
import {INSIGHT_CATEGORIES,insightCategoryFor,insightCategoryLabel,utilityInsightIds} from '../src/insight-category.js';
import {OXYGEN_UPGRADES} from '../src/veil/tank-upgrades.js';
import {activeTankRolesFor,performanceFor,primaryRoleFor,rolesFor} from '../src/veil/molecule-roles.js';

assert.deepEqual(INSIGHT_CATEGORIES,['propellant','fuel','oxidizer','coolant','utility','general']);
assert.equal(insightCategoryFor('hydrogen'),'propellant');
assert.equal(insightCategoryFor('methane'),'fuel');
assert.equal(insightCategoryFor('oxygen'),'oxidizer');
assert.equal(insightCategoryFor('water'),'coolant');
assert.equal(insightCategoryLabel('propellant'),'PULSE');

const multiRoleExpectations={
  hydrogen:{primary:'propellant',roles:['propellant','fuel']},
  ammonia:{primary:'propellant',roles:['propellant','fuel','coolant']},
  nitrogen:{primary:'propellant',roles:['propellant','coolant']},
  'carbon-dioxide':{primary:'propellant',roles:['propellant','coolant']},
  'n-butane':{primary:'propellant',roles:['propellant','fuel']},
  methanol:{primary:'fuel',roles:['fuel','coolant']},
  ethanol:{primary:'fuel',roles:['fuel','coolant']},
};
for(const [id,expected] of Object.entries(multiRoleExpectations)){
  assert.equal(primaryRoleFor(id),expected.primary,`${id} primary role must be explicit and stable`);
  assert.deepEqual(rolesFor(id),expected.roles,`${id} secondary gameplay roles must be preserved`);
  assert.equal(insightCategoryFor(id),expected.primary,`${id} insight category follows canonical primary role`);
  for(const role of expected.roles)assert.ok(performanceFor(id,role),`${id}/${role} performance remains available`);
}

const upgradeUtilityIds=OXYGEN_UPGRADES.flatMap(upgrade=>upgrade.requires);
assert.deepEqual(utilityInsightIds(),upgradeUtilityIds,'utility insight IDs derive from upgrade requirements');
for(const id of upgradeUtilityIds)assert.equal(insightCategoryFor(id),'utility',`${id} is an upgrade utility molecule`);
assert.deepEqual(upgradeUtilityIds,['ethene','propene','phenol','formaldehyde']);
assert.equal(insightCategoryFor('benzene'),'general','molecules without tank or utility use remain general');

assert.deepEqual(activeTankRolesFor('hydrogen'),['propellant','fuel']);
assert.deepEqual(activeTankRolesFor('ammonia'),['propellant','fuel','coolant']);
assert.deepEqual(activeTankRolesFor('methanol'),['fuel','coolant']);
assert.deepEqual(performanceFor('hydrogen','propellant'),{capacity:120,moleculesPerBurst:40,burstPower:1});
assert.deepEqual(performanceFor('methane','fuel'),{capacity:18,oxygenPerFuel:2,energy:1,heatFactor:1,response:1});

console.log('Insight taxonomy passed: six categories, explicit multi-role primaries, upgrade-derived utility, general fallback and unchanged gameplay roles.');
