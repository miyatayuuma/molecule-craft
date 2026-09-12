import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pendingAttentionTransition,pendingCraftRowModel,unfinishedCraftIds} from '../src/pending-craft.js?v=1';

assert.deepEqual(unfinishedCraftIds({hints:[],recipes:[]}),[],'undiscovered molecules are not pending');
assert.deepEqual(unfinishedCraftIds({hints:['oxygen'],recipes:[]}),['oxygen'],'discovered unfinished molecules are pending');
assert.deepEqual(unfinishedCraftIds({hints:['oxygen'],recipes:['oxygen']}),[],'completed molecules are not pending');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','oxygen','water'],recipes:['oxygen']}),['hydrogen','water'],'multiple pending molecules preserve discovery order and ignore completed entries');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','hydrogen','water'],recipes:[]}),['hydrogen','water'],'duplicate hints do not duplicate the route');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','water'],recipes:['hydrogen']}),['water'],'completion removes only the completed candidate');
assert.deepEqual(unfinishedCraftIds({hints:['hydrogen','water'],recipes:['hydrogen','water']}),[],'notification clears after all candidates are completed');

assert.deepEqual(pendingAttentionTransition({currentIds:[]}),{attention:'none',addedIds:[],acknowledgedIds:[],acknowledgedKey:''},'no pending candidates have no attention');
assert.deepEqual(pendingAttentionTransition({currentIds:['hydrogen','water']}),{attention:'unseen',addedIds:['hydrogen','water'],acknowledgedIds:[],acknowledgedKey:''},'session startup with pending candidates is unseen and starts as new attention');
assert.deepEqual(pendingAttentionTransition({previousIds:['hydrogen','water'],currentIds:['hydrogen','water'],acknowledgedIds:['hydrogen','water']}),{attention:'acknowledged',addedIds:[],acknowledgedIds:['hydrogen','water'],acknowledgedKey:'hydrogen|water'},'the currently viewed pending set remains acknowledged');
assert.deepEqual(pendingAttentionTransition({previousIds:['hydrogen','water'],currentIds:['hydrogen','water','methane'],acknowledgedIds:['hydrogen','water']}),{attention:'unseen',addedIds:['methane'],acknowledgedIds:['hydrogen','water'],acknowledgedKey:'hydrogen|water'},'a newly added pending id re-arms unseen attention');
assert.deepEqual(pendingAttentionTransition({previousIds:['hydrogen','water','methane'],currentIds:['water','methane'],acknowledgedIds:['hydrogen','water','methane']}),{attention:'acknowledged',addedIds:[],acknowledgedIds:['water','methane'],acknowledgedKey:'water|methane'},'completion-only decrease does not re-arm attention');
assert.deepEqual(pendingAttentionTransition({previousIds:['water'],currentIds:[],acknowledgedIds:['water']}),{attention:'none',addedIds:[],acknowledgedIds:[],acknowledgedKey:''},'completing all pending recipes clears session attention bookkeeping');
assert.equal(pendingAttentionTransition({currentIds:['water']}).attention,'unseen','a fresh app session treats persisted pending recipes as unseen again');

const records={methane:{formula:'CH₄',commonNameJa:'メタン'},ethene:{formula:'C₂H₄',commonNameJa:'エチレン'},benzene:{formula:'C₆H₆',commonNameJa:'ベンゼン'}},resources={record:id=>records[id]};
assert.deepEqual(pendingCraftRowModel(resources,'methane'),{id:'methane',formula:'CH₄',name:'メタン',category:'fuel',categoryLabel:'FUEL'});
assert.deepEqual(pendingCraftRowModel(resources,'ethene'),{id:'ethene',formula:'C₂H₄',name:'エチレン',category:'utility',categoryLabel:'UTILITY'});
assert.deepEqual(pendingCraftRowModel(resources,'benzene'),{id:'benzene',formula:'C₆H₆',name:'ベンゼン',category:'general',categoryLabel:'GENERAL'});

const pendingSource=await readFile(new URL('../src/pending-craft.js',import.meta.url),'utf8');
const supplySource=await readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8');
const connectionsSource=await readFile(new URL('../src/craft-connections.js',import.meta.url),'utf8');
const veilSource=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');
assert.doesNotMatch(pendingSource,/selectedUse|TANK_USES|ACTIVE_TANK_ROLES/,'pending-craft access must not depend on LOADOUT slot selection');
assert.match(pendingSource,/molecule-craft:craft-molecule/,'candidate selection must route through the existing craft-target event');
assert.match(pendingSource,/button\.dataset\.insightCategory=model\.category/,'each pending row carries the canonical semantic category');
assert.match(pendingSource,/bulb\.className='insight-bulb'/,'pending identities use the shared monochrome bulb primitive');
assert.match(pendingSource,/role\.textContent=model\.categoryLabel/,'pending rows expose a visible non-color category label');
assert.match(pendingSource,/button\.setAttribute\('aria-label',`\$\{model\.formula\} \$\{model\.name\}。用途 \$\{model\.categoryLabel\}。クラフト`\)/,'pending rows expose category semantics to assistive technology');
assert.match(pendingSource,/access\.innerHTML='<span aria-hidden="true">💡<\/span><small><\/small>'/,'topbar access keeps its neutral navigation bulb');
assert.doesNotMatch(pendingSource,/access\.dataset\.insightCategory|access\.setAttribute\(['"]data-insight-category/,'topbar navigation bulb must not inherit a molecule category');
assert.match(pendingSource,/access\.dataset\.attention=attention/,'topbar attention is represented by an explicit semantic data attribute');
assert.match(pendingSource,/acknowledgedKey=current\.join\('\|'\)/,'acknowledgement keeps a session-local key for the exact set that was viewed');
assert.match(pendingSource,/transition\.addedIds\.length/,'animation re-arm is driven by newly added pending ids rather than any key change');
assert.match(pendingSource,/renderList\(ids\);acknowledge\(ids\);if\(!ids\.length\)dialog\.close\(\)/,'a dialog-open refresh acknowledges the currently visible candidate set');
assert.match(pendingSource,/renderList\(ids\);acknowledge\(ids\);dialog\.showModal/,'opening the pending list acknowledges the current set immediately');
assert.match(pendingSource,/pending-craft-new-bulb \.92s/,'new pending recipes receive a short one-shot bulb motion');
assert.match(pendingSource,/pending-craft-reminder-bulb 7\.2s/,'unseen recipes receive a sparse reminder cadence');
assert.match(pendingSource,/@media \(prefers-reduced-motion:reduce\)[\s\S]*animation:none[\s\S]*box-shadow/,'reduced motion disables movement while preserving static unseen emphasis');
assert.doesNotMatch(pendingSource,/style\.animation|setInterval|localStorage|sessionStorage|aria-live|navigator\.vibrate|\.play\(/,'attention stays attribute/CSS-driven, session-memory-only, quiet, and free of periodic ARIA announcements');
assert.match(pendingSource,/`未作成の設計図 \$\{ids\.length\}件`/,'accessible pending count remains on the navigation button');
assert.match(pendingSource,/insight-category\.css/,'pending rows load the shared category palette');
assert.match(connectionsSource,/onCraft:\(\.\.\.args\)=>\{pendingCraft\.refresh\(\);return onCraft\(\.\.\.args\);\}/,'normal return refreshes pending attention before handing control back to CRAFT');
assert.match(veilSource,/resources\.settleExpedition\([\s\S]*insights:captured\?\[\]:completed\.carriedInsights\}[\s\S]*onCraft\(\)/,'normal returns commit carried insight ids before the pending refresh while capture commits none');
assert.doesNotMatch(supplySource,/const hintIds=\{propellant:/,'LOADOUT must not own hardcoded unfinished-molecule candidates');
assert.doesNotMatch(supplySource,/tank-next-hint'\)\.addEventListener/,'LOADOUT must not own the unfinished-molecule craft route');

console.log('Pending craft passed: session-local unseen/acknowledged attention, add-only re-arm, sparse/reduced-motion affordance, return integration, category semantics and craft routing.');
