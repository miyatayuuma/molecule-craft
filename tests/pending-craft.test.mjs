import assert from 'node:assert/strict';
import {unfinishedCraftIds} from '../src/pending-craft.js?v=1';

assert.deepEqual(unfinishedCraftIds({hints:[],recipes:[]}),[],'undiscovered molecules are not pending');
assert.deepEqual(unfinishedCraftIds({hints:['oxygen'],recipes:[]}),['oxygen'],'discovered unfinished molecules are pending');
assert.deepEqual(unfinishedCraftIds({hints:['oxygen'],recipes:['oxygen']}),[],'completed molecules are not pending');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','oxygen','water'],recipes:['oxygen']}),['hydrogen','water'],'multiple pending molecules preserve discovery order and ignore completed entries');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','hydrogen','water'],recipes:[]}),['hydrogen','water'],'duplicate hints do not duplicate the route');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','water'],recipes:['hydrogen']}),['water'],'completion removes only the completed candidate');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','water'],recipes:['hydrogen','water']}),[],'notification clears after all candidates are completed');

console.log('Pending craft passed: discovered/unfinished derivation, completion removal, deduplication and multi-candidate ordering.');
