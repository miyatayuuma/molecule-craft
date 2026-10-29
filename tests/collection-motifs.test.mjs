import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCollectionState,COLLECTION_STORAGE_KEY} from '../src/collection-state.js?v=38';
import {detectFunctionalGroups,validateFunctionalGroups} from '../src/functional-groups.js?v=22';
import {validateCraftStructures} from '../src/craft-structures.js?v=33';

const read=async path=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
const records=await read('data/molecules.json'),groups=validateFunctionalGroups(await read('data/functional-groups.json'));
const templates=validateCraftStructures(await read('data/craft-structures.json'),groups),byId=new Map(records.map(record=>[record.id,record]));
const detected=id=>new Set(detectFunctionalGroups(byId.get(id),groups).map(match=>match.id));

assert.equal(groups.length,32,'The 24 existing patterns plus eight contextual motifs remain available to the detector.');
const invalidPattern={id:'invalid-elements',nameJa:'invalid',nameEn:'invalid',notation:'?',family:'test',learningRole:'motif',pattern:{atoms:[{elementsAny:[]}],bonds:[]}};
assert.throws(()=>validateFunctionalGroups([invalidPattern]),/Invalid pattern atom/,'Element disjunctions must be non-empty and well-formed.');
assert.throws(()=>validateFunctionalGroups([{...invalidPattern,pattern:{atoms:[{element:'C',elementsAny:['C']}],bonds:[]}}]),/Invalid pattern atom/,'An atom spec cannot combine element and elementsAny.');
assert.deepEqual(Object.fromEntries(['part','motif','internal'].map(role=>[role,groups.filter(group=>group.learningRole===role).length])),{part:17,motif:14,internal:1});
assert(groups.every(group=>!Object.hasOwn(group,'collectible')),'The old detect/learning/placement coupling flag is retired.');
assert.deepEqual(groups.filter(group=>group.learningRole==='internal').map(group=>group.id),['carbon-chain']);
assert.deepEqual(templates.map(template=>template.unlock.groupId).sort(),groups.filter(group=>group.learningRole==='part').map(group=>group.id).sort());
assert.equal(templates.length,17,'Parts catalog and CRAFT template total remain 17.');
for(const id of ['alkene','alkyne','ether','ketone','amide','aromatic-ring'])assert.equal(groups.find(group=>group.id===id).learningRole,'motif');

const fixtures={
  nitro:['nitromethane','nitrobenzene','2-nitrotoluene','2-4-dinitrotoluene','2-4-6-trinitrotoluene'],
  thioether:['dimethyl-sulfide','methionine'],
  sulfoxide:['dimethyl-sulfoxide'],
  'acid-anhydride':['acetic-anhydride'],
  'secondary-amine':['dimethylamine'],
  'tertiary-amine':['trimethylamine'],
  peroxide:['hydrogen-peroxide'],
};
for(const [group,ids] of Object.entries(fixtures)){
  assert.equal(groups.find(item=>item.id===group)?.learningRole,'motif');
  for(const id of ids)assert(detected(id).has(group),`${id}: ${group} fixture must match`);
  assert(!templates.some(template=>template.unlock.groupId===group),`${group}: motif cannot unlock/place a CRAFT template`);
}
assert(!detected('ozone').has('peroxide'),'Ozone is not a peroxide despite an O–O single bond in its canonical graph.');
assert(!detected('dimethyl-sulfoxide').has('thioether'),'S=O environment must not also match the thioether motif.');
assert(!detected('dimethyl-sulfide').has('sulfoxide'),'Thioether must not match a sulfoxide.');
assert(!detected('dimethylamine').has('amino')&&!detected('trimethylamine').has('amino'),'Primary amino pattern excludes secondary and tertiary amines.');
assert(!detected('acetamide').has('secondary-amine')&&!detected('acetamide').has('tertiary-amine'),'Amide nitrogens are excluded from amine motifs.');

const halogenFixtures=['chloromethane','dichloromethane','chloroform','carbon-tetrachloride','fluoromethane','difluoromethane','vinyl-chloride','vinylidene-fluoride','1-2-dichloroethane','chlorobenzene','chlorotrifluoroethylene','hexafluoropropylene','tetrafluoroethylene'];
const halogenHits=records.filter(record=>detected(record.id).has('carbon-halogen')).map(record=>record.id).sort();
assert.deepEqual(halogenHits,[...halogenFixtures].sort(),'Generic C–X pattern detects the 13 current F/Cl fixtures, including alkyl, vinyl and aryl carbon.');

const expectedPartIds=['methyl','isopropyl','n-butyl','hydroxyl','amino','carbonyl','vinyl','ethynyl','aldehyde','carboxyl','methoxy','ester','carbamoyl','nitrile','thiol','ethyl','phenyl'];
assert.deepEqual(Object.entries((await read('data/encyclopedia.json')).parts).sort((a,b)=>a[1].number-b[1].number).map(([id,item])=>[id,item.number]),expectedPartIds.map((id,index)=>[id,index+1]));

const memory=new Map();let writes=0;const storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>{writes++;memory.set(key,value);}};
const collection=createCollectionState({records,groups,templates,storage,now:()=>321});
const registration=collection.registerDiscoveredMolecule('dimethyl-sulfide',{at:123});
assert.equal(registration.changed,true);assert.equal(registration.event.isNew,true);assert(registration.event.groupDiscoveries.includes('thioether'));
assert.deepEqual(collection.groupSources('thioether'),['dimethyl-sulfide']);
const writesAfterFirst=writes,snapshot=collection.snapshot();
assert(!snapshot.unlockedStructures.some(id=>['nitro','thioether','sulfoxide','acid-anhydride','secondary-amine','tertiary-amine','carbon-halogen','peroxide'].includes(id)));
assert.equal(collection.registerDiscoveredMolecule('dimethyl-sulfide',{at:999}).changed,false);
assert.equal(writes,writesAfterFirst,'Repeated known-molecule registration is idempotent and does not persist.');
assert.throws(()=>collection.registerDiscoveredMolecule('not-a-known-record'),/Unknown molecule record/);
assert.throws(()=>collection.registerDiscoveredMolecule('water',{at:-1}),/Discovery time/);

const legacySnapshot={schemaVersion:3,discoveredMolecules:[{id:'dimethyl-sulfide',at:10,order:1},{id:'dimethyl-sulfoxide',at:20,order:2},{id:'acetic-anhydride',at:30,order:3}],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]};
const restored=createCollectionState({records,groups,templates,storage:{getItem:key=>key===COLLECTION_STORAGE_KEY?JSON.stringify(legacySnapshot):null,setItem(){}}});
for(const id of ['thioether','sulfoxide','acid-anhydride'])assert(restored.hasGroup(id),`${id}: saved molecule history is reclassified with the current detector on restore.`);
assert.deepEqual(restored.groupSources('sulfoxide'),['dimethyl-sulfoxide']);
assert.deepEqual(restored.snapshot().discoveredMolecules,legacySnapshot.discoveredMolecules);
console.log('Collection motif tests passed: 32 detector patterns, learning/part role separation, 13 C–X fixtures, chemistry exclusions, source-independent registration, retroactive restore and 17 stable Part numbers.');
