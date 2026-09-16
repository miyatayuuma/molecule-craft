import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {insightRecipeElementEligible,progressionElementAccessible} from '../src/veil/resources.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const byId=id=>records.find(record=>record.id===id);
const eligible=(record,progress)=>insightRecipeElementEligible(record,{canUseElement:element=>progressionElementAccessible(progress,element)});

const cho={foundElements:['H','C','O'],choCompleted:false};
assert.equal(eligible(byId('ozone'),cho),true,'Ozone may become an ordinary O-only frontier once oxygen is accessible');
for(const id of ['nitromethane','nitrobenzene','2-nitrotoluene','2-4-dinitrotoluene','2-4-6-trinitrotoluene'])assert.equal(eligible(byId(id),cho),false,`${id} must not leak through Graph adjacency before nitrogen access`);

const foundNButLocked={foundElements:['H','C','O','N'],choCompleted:false};
assert.equal(progressionElementAccessible(foundNButLocked,'N'),false,'Merely finding N cannot bypass Nitrogen chapter eligibility');
assert.equal(eligible(byId('nitromethane'),foundNButLocked),false,'Nitromethane stays FIELD-ineligible until the Nitrogen chapter owns N access');

const nitrogenAccessible={foundElements:['H','C','O','N'],choCompleted:true};
assert.equal(progressionElementAccessible(nitrogenAccessible,'N'),true,'Nitrogen chapter + collected N unlocks N chemistry eligibility');
assert.equal(eligible(byId('nitromethane'),nitrogenAccessible),true,'Nitromethane may enter ordinary frontier only after N is actually accessible');
assert.equal(eligible(byId('nitrobenzene'),nitrogenAccessible),true,'Nitrobenzene follows the same N element gate');

console.log('Resonance frontier eligibility passed: ozone is O-gated and nitro branches remain N-gated before Nitrogen access.');
