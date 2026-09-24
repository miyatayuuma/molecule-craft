import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validatePolymerCatalog,setPolymerCatalog,polymerCatalog,polymerRecord} from '../src/polymer-catalog.js';
import {createPolymerEncyclopediaModel} from '../src/polymer-encyclopedia.js';
import {hamajimaTermSegments} from '../src/hamajima-term-reference.js';
const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url)));
const molecules=await json('../data/molecules.json'),polymers=await json('../data/polymers.json'),content=await json('../data/polymer-encyclopedia.json'),moleculeIds=new Set(molecules.map(m=>m.id));
const records=validatePolymerCatalog(polymers,{moleculeIds});
assert.equal(molecules.length,142);assert.equal(records.length,25);assert.equal(content.length,25);
assert.deepEqual(records.map(r=>r.id),content.map(e=>e.id));assert.deepEqual(content.map(e=>e.number),Array.from({length:25},(_,i)=>i+1));
for(const record of records){
 for(const reactant of record.reactants)assert(moleculeIds.has(reactant.moleculeId),`missing reactant ${record.id}/${reactant.moleculeId}`);
 for(const key of ['summaryJa','description','details','seal','sealQualification','oxygenCapacity','utility','score','qualification'])assert.equal(Object.hasOwn(record,key),false,`${key} must not belong in chemistry record: ${record.id}`);
 assert(record.reactants.length>0);assert(['addition','copolymerization','ring-opening','polycondensation','condensation-network'].includes(record.formation));assert(['linear','copolymer','network'].includes(record.topology));
}
for(const id of ['polybutadiene','styrene-butadiene-copolymer','nitrile-butadiene-rubber','polyisoprene','butyl-rubber','vinylidene-fluoride-hexafluoropropylene-copolymer'])assert.equal(records.find(r=>r.id===id)?.repeatUnit,null,`${id} must not imply one microstructure`);
assert.equal(records.find(r=>r.id==='polyvinylidene-fluoride')?.repeatUnit,'–CH₂–CF₂–');assert.equal(records.find(r=>r.id==='polytetrafluoroethylene')?.repeatUnit,'–CF₂–CF₂–');
const allowed=new Set(['addition-polymerization','copolymerization','ring-opening-polymerization','polycondensation','network-polymerization','repeat-unit']);
for(const entry of content){assert.ok(entry.description?.trim());assert.ok(entry.details?.length);assert.ok(entry.concepts.length);for(const c of entry.concepts)assert(allowed.has(c),`unknown polymer concept ${c}`);for(const text of [entry.description,...entry.details.flatMap(d=>[d.title,d.body])]){const segments=hamajimaTermSegments(text);assert.equal(segments.map(s=>s.text).join(''),text,`${entry.id} linking must be lossless`);}}
setPolymerCatalog(polymers,{moleculeIds});assert.equal(polymerCatalog().length,25);assert.equal(polymerRecord('polyethylene')?.repeatUnit,'–CH₂–CH₂–');
const model=createPolymerEncyclopediaModel(records,content,{knownIds:['polyethylene','nylon-6-6','missing-id']});assert.equal(model.total,25);assert.equal(model.discoveredCount,2);assert.equal(model.entry('nylon-6-6').description,content.find(e=>e.id==='nylon-6-6').description);assert.deepEqual(model.entry('polypropylene'),{id:'polypropylene',known:false,nameJa:'???',nameEn:'???',details:null,description:null,concepts:null});assert.equal(model.entry('missing-id'),null);assert.equal(model.withKnownIds(['polypropylene']).entry('polypropylene').description,content.find(e=>e.id==='polypropylene').description);
assert.throws(()=>validatePolymerCatalog([{...polymers[0],sealQualification:'72'}],{moleculeIds}),/does not belong/);assert.throws(()=>validatePolymerCatalog([{...polymers[0],summaryJa:'leak'}],{moleculeIds}),/prose/);assert.throws(()=>validatePolymerCatalog([{...polymers[0],reactants:[{moleculeId:'not-in-molecule-db',role:'monomer'}]}],{moleculeIds}),/Unknown molecule/);assert.throws(()=>createPolymerEncyclopediaModel(records,content.slice(1)),/1:1/);
console.log('Polymer chemistry catalog and independent encyclopedia passed: 25 routes.');
