import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chemistryVisualSpecs,validateChemistryVisualSpecs} from '../src/encyclopedia-chemistry-visuals.js';
import {AROMATIC_STYLE} from '../src/aromatic-rendering.js?v=27';

const root=new URL('../',import.meta.url);
const encyclopedia=JSON.parse(await readFile(new URL('data/encyclopedia.json',root),'utf8'));
const records=JSON.parse(await readFile(new URL('data/molecules.json',root),'utf8'));
const collectionUiSource=await readFile(new URL('src/collection-ui.js',root),'utf8'),pubchemSource=await readFile(new URL('src/pubchem-reference.js',root),'utf8'),visualSource=await readFile(new URL('src/encyclopedia-chemistry-visuals.js',root),'utf8');
assert.equal(records.length,136,'Chemistry visual grammar must not change the 136-molecule production catalog');
assert.equal(validateChemistryVisualSpecs(encyclopedia,records),true);
assert.doesNotMatch(collectionUiSource,/模型・収録について|model-collection-notes/,'Repeated model/collection note section must not be rendered');
assert(encyclopedia.noteDefinitions?.model,'Internal model-note metadata may remain available for non-player-facing uses');
assert.match(pubchemSource,/PubChem ↗/,'PubChem reference affordance remains intact');
assert.match(visualSource,/AROMATIC_STYLE\.cssColor/,'Chemistry detail visuals use the aromatic accent authority');
assert.doesNotMatch(visualSource,/薄い2本目線/,'Line-style prose must not compete with the resonance diagram');

const visuals=id=>chemistryVisualSpecs(encyclopedia.molecules[id]);
for(const [id,entry] of Object.entries(encyclopedia.molecules)){
  if(entry.concepts?.includes('aromaticity'))assert(visuals(id).some(spec=>spec.type==='aromaticity'),`${id}: aromaticity concept must receive the common aromatic diagram`);
}
const resonanceTargets=['ozone','nitromethane','nitrobenzene','2-nitrotoluene','2-4-dinitrotoluene','2-4-6-trinitrotoluene'];
for(const id of resonanceTargets){
  const spec=visuals(id).find(item=>item.type==='resonance');assert(spec,`${id}: curated non-ring resonance visual required`);
  assert.deepEqual(spec.formalCharges,{center:1,terminal:-1},`${id}: contributor charges`);
}
assert.equal(visuals('sulfur-dioxide').some(spec=>spec.type==='resonance'),false,'Sulfur oxo resonance stays outside this task visual grammar');
assert.deepEqual(visuals('carbon-monoxide').find(spec=>spec.type==='formal-charge')?.formalCharges,{left:-1,right:1},'CO uses C−≡O+ formal-charge grammar');
for(const [id,motif] of [['water','water'],['hydrogen-chloride','hydrogen-chloride'],['ethanol','alcohol'],['acetone','carbonyl']])assert.equal(visuals(id).find(spec=>spec.type==='polarity')?.motif,motif,`${id}: curated polarity motif`);
for(const id of ['benzene','toluene','nitrobenzene','carbon-dioxide','methanol','acetaldehyde'])if(!['nitrobenzene'].includes(id))assert.equal(visuals(id).some(spec=>spec.type==='polarity'),false,`${id}: polarity δ visual must not leak without an explicit curated spec`);
assert(encyclopedia.molecules['2-nitrotoluene'].concepts.includes('formal-charge'),'2-nitrotoluene nitro contributor must expose formal-charge as a controlled concept');

function mutated(id,visual){const copy=structuredClone(encyclopedia);copy.molecules[id].visuals=[visual];return copy;}
assert.throws(()=>validateChemistryVisualSpecs(mutated('water',{type:'orbital',target:'molecule'}),records),/unsupported visual type/);
assert.throws(()=>validateChemistryVisualSpecs(mutated('water',{type:'polarity',motif:'water',partialCharges:{oxygen:'δ−'}}),records),/missing target/);
assert.throws(()=>validateChemistryVisualSpecs(mutated('water',{type:'polarity',motif:'water',target:'molecule',partialCharges:{oxygen:'-'}}),records),/δ\+ or δ−/);
assert.throws(()=>validateChemistryVisualSpecs(mutated('carbon-monoxide',{type:'formal-charge',motif:'carbon-monoxide',target:'co-bond',formalCharges:{left:-1,right:1},partialCharges:{left:'δ−'}}),records),/cannot be mixed/);
assert.throws(()=>validateChemistryVisualSpecs(mutated('nitromethane',{type:'resonance',motif:'ozone',target:'nitro-group',formalCharges:{center:1,terminal:-1}}),records),/does not match molecule topology/);

for(const [id,entry] of Object.entries(encyclopedia.molecules)){
  assert.equal(typeof entry.description,'string',`${id}: Summary preserved`);assert(entry.description.length>=12,`${id}: Summary remains substantive`);
  assert(Array.isArray(entry.details)&&entry.details.length,`${id}: Chemistry Detail preserved`);
}
console.log('Encyclopedia chemistry visual grammar passed: aromaticity derives from concepts; resonance/formal-charge/polarity are curated and schema-validated across 136 molecules.');
