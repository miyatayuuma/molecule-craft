import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unfinishedCraftIds} from '../src/pending-craft.js?v=1';

assert.deepEqual(unfinishedCraftIds({hints:[],recipes:[]}),[],'undiscovered molecules are not pending');
assert.deepEqual(unfinishedCraftIds({hints:['oxygen'],recipes:[]}),['oxygen'],'discovered unfinished molecules are pending');
assert.deepEqual(unfinishedCraftIds({hints:['oxygen'],recipes:['oxygen']}),[],'completed molecules are not pending');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','oxygen','water'],recipes:['oxygen']}),['hydrogen','water'],'multiple pending molecules preserve discovery order and ignore completed entries');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','hydrogen','water'],recipes:[]}),['hydrogen','water'],'duplicate hints do not duplicate the route');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','water'],recipes:['hydrogen']}),['water'],'completion removes only the completed candidate');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','water'],recipes:['hydrogen','water']}),[],'notification clears after all candidates are completed');

const pendingSource=await readFile(new URL('../src/pending-craft.js',import.meta.url),'utf8');
const supplySource=await readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8');
assert.doesNotMatch(pendingSource,/selectedUse|TANK_USES|ACTIVE_TANK_ROLES/,'pending-craft access must not depend on LOADOUT slot selection');
assert.match(pendingSource,/molecule-craft:craft-molecule/,'candidate selection must route through the existing craft-target event');
assert.doesNotMatch(supplySource,/const hintIds=\{propellant:/,'LOADOUT must not own hardcoded unfinished-molecule candidates');
assert.doesNotMatch(supplySource,/tank-next-hint'\)\.addEventListener/,'LOADOUT must not own the unfinished-molecule craft route');

console.log('Pending craft passed: derived state, completion removal, multi-candidate ordering, LOADOUT independence and craft-target routing.');
