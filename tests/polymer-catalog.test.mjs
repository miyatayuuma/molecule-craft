import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validatePolymerCatalog,setPolymerCatalog,polymerCatalog,polymerRecord} from '../src/polymer-catalog.js';
import {createPolymerEncyclopediaModel} from '../src/polymer-encyclopedia.js';

const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url)));
const molecules=await json('../data/molecules.json');
const polymers=await json('../data/polymers.json');
const moleculeIds=new Set(molecules.map(record=>record.id));
const records=validatePolymerCatalog(polymers,{moleculeIds});

assert.ok(records.length>=15,'Initial polymer catalog should cover multiple reaction families.');
for(const record of records){
  for(const reactant of record.reactants)assert.ok(moleculeIds.has(reactant.moleculeId),`Unknown molecule route: ${record.id} -> ${reactant.moleculeId}`);
  for(const forbidden of ['seal','sealQualification','oxygenCapacity','utility','score'])assert.equal(Object.hasOwn(record,forbidden),false,`Gameplay qualification must stay outside chemistry DB: ${record.id}`);
}
assert.deepEqual(new Set(records.map(record=>record.formation)),new Set(['addition','copolymerization','ring-opening','polycondensation','condensation-network']));
assert.equal(records.find(record=>record.id==='phenol-formaldehyde-resin')?.topology,'network');
assert.deepEqual(records.find(record=>record.id==='ethylene-propylene-copolymer')?.reactants.map(item=>item.moleculeId),['ethene','propene']);

setPolymerCatalog(polymers,{moleculeIds});
assert.equal(polymerCatalog().length,records.length);
assert.equal(polymerRecord('polyethylene')?.repeatUnit,'–CH₂–CH₂–');

const encyclopedia=createPolymerEncyclopediaModel(records,{knownIds:['polyethylene','phenol-formaldehyde-resin','missing-id']});
assert.equal(encyclopedia.total,records.length);
assert.equal(encyclopedia.discoveredCount,2);
assert.equal(encyclopedia.entry('polyethylene').known,true);
assert.equal(encyclopedia.entry('polyethylene').nameJa,'ポリエチレン');
assert.deepEqual(encyclopedia.entry('polypropylene'),{id:'polypropylene',known:false,nameJa:'???',nameEn:'???'});
assert.equal(encyclopedia.entry('missing-id'),null);
assert.equal(encyclopedia.withKnownIds(['polypropylene']).entry('polypropylene').known,true);

assert.throws(()=>validatePolymerCatalog([{...polymers[0],sealQualification:'72'}],{moleculeIds}),/does not belong/);
assert.throws(()=>validatePolymerCatalog([{...polymers[0],reactants:[{moleculeId:'not-in-molecule-db',role:'monomer'}]}],{moleculeIds}),/Unknown molecule/);

console.log(`Polymer catalog validated: ${records.length} entries`);
