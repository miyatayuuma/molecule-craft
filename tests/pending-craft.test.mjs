import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pendingCraftRowModel,unfinishedCraftIds} from '../src/pending-craft.js?v=1';

assert.deepEqual(unfinishedCraftIds({hints:[],recipes:[]}),[],'undiscovered molecules are not pending');
assert.deepEqual(unfinishedCraftIds({hints:['oxygen'],recipes:[]}),['oxygen'],'discovered unfinished molecules are pending');
assert.deepEqual(unfinishedCraftIds({hints:['oxygen'],recipes:['oxygen']}),[],'completed molecules are not pending');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','oxygen','water'],recipes:['oxygen']}),['hydrogen','water'],'multiple pending molecules preserve discovery order and ignore completed entries');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','hydrogen','water'],recipes:[]}),['hydrogen','water'],'duplicate hints do not duplicate the route');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','water'],recipes:['hydrogen']}),['water'],'completion removes only the completed candidate');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','water'],recipes:['hydrogen','water']}),[],'notification clears after all candidates are completed');

const records={methane:{formula:'CH₄',commonNameJa:'メタン'},ethene:{formula:'C₂H₄',commonNameJa:'エチレン'},benzene:{formula:'C₆H₆',commonNameJa:'ベンゼン'}},resources={record:id=>records[id]};
assert.deepEqual(pendingCraftRowModel(resources,'methane'),{id:'methane',formula:'CH₄',name:'メタン',category:'fuel',categoryLabel:'FUEL'});
assert.deepEqual(pendingCraftRowModel(resources,'ethene'),{id:'ethene',formula:'C₂H₄',name:'エチレン',category:'utility',categoryLabel:'UTILITY'});
assert.deepEqual(pendingCraftRowModel(resources,'benzene'),{id:'benzene',formula:'C₆H₆',name:'ベンゼン',category:'general',categoryLabel:'GENERAL'});

const pendingSource=await readFile(new URL('../src/pending-craft.js',import.meta.url),'utf8');
const supplySource=await readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8');
assert.doesNotMatch(pendingSource,/selectedUse|TANK_USES|ACTIVE_TANK_ROLES/,'pending-craft access must not depend on LOADOUT slot selection');
assert.match(pendingSource,/molecule-craft:craft-molecule/,'candidate selection must route through the existing craft-target event');
assert.match(pendingSource,/button\.dataset\.insightCategory=model\.category/,'each pending row carries the canonical semantic category');
assert.match(pendingSource,/bulb\.className='insight-bulb'/,'pending identities use the shared monochrome bulb primitive');
assert.match(pendingSource,/role\.textContent=model\.categoryLabel/,'pending rows expose a visible non-color category label');
assert.match(pendingSource,/button\.setAttribute\('aria-label',`\$\{model\.formula\} \$\{model\.name\}。用途 \$\{model\.categoryLabel\}。クラフト`\)/,'pending rows expose category semantics to assistive technology');
assert.match(pendingSource,/access\.innerHTML='<span aria-hidden="true">💡<\/span><small><\/small>'/,'topbar access keeps its neutral navigation bulb');
assert.doesNotMatch(pendingSource,/access\.dataset\.insightCategory|access\.setAttribute\(['"]data-insight-category/,'topbar navigation bulb must not inherit a molecule category');
assert.match(pendingSource,/insight-category\.css/,'pending rows load the shared category palette');
assert.doesNotMatch(supplySource,/const hintIds=\{propellant:/,'LOADOUT must not own hardcoded unfinished-molecule candidates');
assert.doesNotMatch(supplySource,/tank-next-hint'\)\.addEventListener/,'LOADOUT must not own the unfinished-molecule craft route');

console.log('Pending craft passed: derived ordering, colored bulb row identity, visible/ARIA category semantics, neutral topbar access and craft-target routing.');
