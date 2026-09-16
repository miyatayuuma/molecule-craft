import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const readJson=async path=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
const moleculesDb=await readJson('data/molecules.json');
const encyclopedia=await readJson('data/encyclopedia.json');
const source=await readFile(new URL('../src/collection-ui.js',import.meta.url),'utf8');
const records=Array.isArray(moleculesDb)?moleculesDb:(moleculesDb.molecules??[]);
const entries=encyclopedia.molecules??{};
const controlledConcepts=new Set(['aromaticity','resonance','formal-charge','polarity','hydrogen-bond','hybridization','geometry','bond-order','ring-strain','structural-isomerism','positional-isomerism','cis-trans','chirality','acid-base','redox','functional-group','polymerization']);
const controlledNotes=new Set(['aromatic','resonance','stereochemistry']);
const recordIds=new Set(records.map(record=>record.id)),entryIds=new Set(Object.keys(entries));

assert.equal(records.length,135,'production molecule count must remain 135');
assert.equal(entryIds.size,135,'Encyclopedia must review all 135 production molecules');
assert.deepEqual([...entryIds].sort(),[...recordIds].sort(),'Encyclopedia IDs must exactly match the production molecule catalog');
assert.equal(encyclopedia.schemaVersion,2,'content architecture schema must be v2');
assert.deepEqual(Object.keys(encyclopedia.noteDefinitions??{}).sort(),['aromatic','model','resonance','stereochemistry']);
const numbers=Object.values(entries).map(entry=>entry.number).sort((a,b)=>a-b);
assert.deepEqual(numbers,Array.from({length:135},(_,index)=>index+1),'Encyclopedia numbering must stay 1..135');

const placeholder=/TODO|TBD|placeholder|未記入|準備中|この分子を図鑑に登録しました/i;
const developerVoice=/比較教材|教材に向く|この分子で学|反応点が変わる|末端水素を手がかり|BRIDGE/i;
for(const [id,entry] of Object.entries(entries)){
  assert.equal(typeof entry.description,'string',`${id}: Summary must be text`);
  assert(entry.description.trim().length>=12,`${id}: Summary is too short`);
  assert(entry.description.length<=90,`${id}: Summary should remain concise`);
  assert(!placeholder.test(entry.description),`${id}: Summary contains placeholder copy`);
  assert(!developerVoice.test(entry.description),`${id}: Summary leaks developer/lesson-author voice`);
  assert(Array.isArray(entry.details)&&entry.details.length>=1,`${id}: molecule-specific Chemistry Detail is required`);
  for(const [index,section] of entry.details.entries()){
    assert.equal(typeof section.title,'string',`${id} detail ${index}: title required`);
    assert(section.title.trim(),`${id} detail ${index}: empty title`);
    assert.equal(typeof section.body,'string',`${id} detail ${index}: body required`);
    assert(section.body.trim().length>=24,`${id} detail ${index}: body is too thin`);
    assert(!placeholder.test(section.body),`${id} detail ${index}: placeholder content`);
  }
  assert(Array.isArray(entry.concepts),`${id}: concepts must be an array`);
  assert(entry.concepts.length>=1,`${id}: at least one educational concept is required`);
  assert.equal(new Set(entry.concepts).size,entry.concepts.length,`${id}: duplicate concepts`);
  for(const concept of entry.concepts)assert(controlledConcepts.has(concept),`${id}: uncontrolled concept ${concept}`);
  const notes=entry.notes??[];
  assert(Array.isArray(notes),`${id}: notes must be an array when present`);
  assert.equal(new Set(notes).size,notes.length,`${id}: duplicate conditional notes`);
  for(const note of notes)assert(controlledNotes.has(note),`${id}: uncontrolled note ${note}`);
  if(notes.includes('aromatic'))assert(entry.concepts.includes('aromaticity'),`${id}: aromatic note requires aromaticity concept`);
  if(notes.includes('resonance'))assert(entry.concepts.includes('resonance'),`${id}: resonance note requires resonance concept`);
  if(notes.includes('stereochemistry'))assert(entry.concepts.some(concept=>concept==='cis-trans'||concept==='chirality'),`${id}: stereochemistry note requires cis-trans/chirality concept`);
}

const resonanceVisualIds=Object.entries(entries).filter(([,entry])=>entry.notes?.includes('resonance')).map(([id])=>id).sort();
assert.deepEqual(resonanceVisualIds,['2-4-6-trinitrotoluene','2-4-dinitrotoluene','2-nitrotoluene','nitrobenzene','nitromethane','ozone'],'resonance model note must be limited to the supported Nitro/Ozone visual family');
assert.deepEqual(entries.benzene.notes,['aromatic']);
assert.equal(entries.water.notes,undefined);
assert(entries['2-butene'].notes?.includes('stereochemistry'));
assert(entries['n-butane'].concepts.includes('structural-isomerism'));
assert(entries.isobutane.concepts.includes('structural-isomerism'));

for(const id of resonanceVisualIds){
  const text=entries[id].details.map(section=>section.body).join(' ');
  assert.match(text,/共鳴|Lewis/,`${id}: resonance explanation must identify the representation`);
  assert.match(text,/非局在化/,`${id}: actual electronic structure must be described as delocalized`);
  assert.doesNotMatch(text,/高速.{0,8}(移動|往復)|二重結合.{0,12}(移動して|動いて)/,`${id}: must not imply a rapidly switching double bond`);
}
const coText=entries['carbon-monoxide'].details.map(section=>section.body).join(' ');
assert.match(coText,/C⁻≡O⁺/,'CO should include the representative formal-charge Lewis structure');
assert(entries['carbon-monoxide'].concepts.includes('formal-charge'));
assert.match(entries.water.details.map(section=>section.body).join(' '),/部分的に負.*部分的に正|極性/);
assert.match(entries.cyclopropane.details.map(section=>section.body).join(' '),/60°.*109\.5°|109\.5°.*60°/);
assert.match(entries.benzene.details.map(section=>section.body).join(' '),/6(?:個の)?π電子.*非局在化|非局在化.*6(?:個の)?π電子/);
assert.match(entries['sulfuric-acid'].details.map(section=>section.body).join(' '),/2段目|二価/);

assert.match(source,/encyclopedia\.json\?v=31/,'Collection UI must load the v2 catalog with the current cache key');
assert.doesNotMatch(source,/record\.learningNote/,'legacy learningNote must not remain a rendered content authority');
assert.match(source,/chemistry-detail/);
assert.doesNotMatch(source,/model-collection-notes|模型・収録について/,'Repeated model/collection notes must not remain in the player-facing detail renderer');
assert.match(source,/noteDefinitions/,'Internal note metadata may remain loaded for data compatibility');
assert.doesNotMatch(source,/水色の内円は芳香環に広がるπ電子を表す記号です。cis\/transや鏡像異性体は分けて収集していません。/,'legacy monolithic note must be removed');

console.log('Encyclopedia content architecture passed: 135/135 reviewed summaries/details, controlled concepts, player-facing repeated-note removal, Nitro/Ozone resonance semantics and CO formal-charge coverage.');
