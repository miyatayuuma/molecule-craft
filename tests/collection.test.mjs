import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Molecule, setMoleculeDatabase, moleculeCatalog } from '../src/chemistry.js?v=20';
import { connectedStructures } from '../src/workspace-model.js';
import { validateFunctionalGroups, detectFunctionalGroups } from '../src/functional-groups.js';
import { validateCraftStructures, expandCraftStructure, seedCraftCoordinates } from '../src/craft-structures.js?v=30';
import { createCollectionState, COLLECTION_STORAGE_KEY } from '../src/collection-state.js';
import { collectionCategory, COLLECTION_CATEGORIES, graphSummary } from '../src/collection-catalog.js';

const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url)));
const records=await json('../data/molecules.json'),groups=validateFunctionalGroups(await json('../data/functional-groups.json'));
const templates=validateCraftStructures(await json('../data/craft-structures.json'),groups);
setMoleculeDatabase(records);
const record=id=>records.find(item=>item.id===id),template=id=>templates.find(item=>item.id===id);
function insert(model,entry){const ids=entry.atoms.map(element=>model.addAtom(element).id);entry.bonds.forEach(([a,b,order])=>model.setBond(ids[a],ids[b],order));return ids;}
function fixture(id){const model=new Molecule();insert(model,record(id));return connectedStructures(model)[0];}
const detected=id=>detectFunctionalGroups(record(id),groups).map(match=>match.id);
for(const id of ['formic-acid','acetic-acid','propionic-acid']){
  assert.ok(detected(id).includes('carboxyl'));assert.ok(!detected(id).includes('aldehyde'));assert.ok(!detected(id).includes('hydroxyl'));
}
assert.ok(!detected('water').includes('hydroxyl'));
assert.ok(!detected('carbon-dioxide').includes('carbonyl'));
assert.ok(detected('methanol').includes('hydroxyl'));
assert.ok(detected('phenol').includes('hydroxyl'));
assert.ok(detected('anisole').includes('ether'));
assert.ok(detected('ethyl-acetate').includes('ester'));
assert.ok(!detected('ethyl-acetate').includes('ether'));
assert.ok(!detected('acetic-anhydride').includes('ester'));
assert.ok(!detected('acetic-anhydride').includes('ether'));
assert.ok(detected('formaldehyde').includes('aldehyde'));
assert.ok(detected('acetone').includes('ketone'));
assert.ok(detected('acetamide').includes('amide'));
assert.ok(!detected('acetamide').includes('amino'));
assert.ok(detected('aniline').includes('amino'));
assert.ok(!detected('dimethylamine').includes('amino'),'Primary amino is deliberately distinct from secondary amines.');
assert.ok(!detected('benzene').includes('alkene'));
assert.ok(detected('styrene').includes('alkene'));
assert.ok(detected('ethene').includes('vinyl'));
assert.ok(detected('propene').includes('vinyl'));
assert.ok(!detected('2-butene').includes('vinyl'),'A double bond alone is not a vinyl group.');
assert.ok(detected('ethyne').includes('ethynyl'));
assert.ok(!detected('2-butyne').includes('ethynyl'),'An internal triple bond is not an ethynyl group.');
assert.ok(detected('methanol').includes('methoxy'));
assert.ok(detected('acetamide').includes('carbamoyl'));
assert.ok(detected('toluene').includes('phenyl'));
assert.equal(detectFunctionalGroups(record('glycerol'),groups).find(match=>match.id==='hydroxyl').count,3);
assert.deepEqual(detectFunctionalGroups({...record('acetic-acid'),id:'renamed',nameJa:'not used'},groups),detectFunctionalGroups(record('acetic-acid'),groups),'Names do not drive functional group matching.');
for(const group of groups)assert.ok(records.filter(entry=>detectFunctionalGroups(entry,[...groups]).some(match=>match.id===group.id)).length>=2,`Unlock must be achievable without repeating a molecule: ${group.id}`);
for(const entry of records){assert.ok(COLLECTION_CATEGORIES[collectionCategory(entry)]);assert.ok(graphSummary(entry).nodes.length);}

let saved=null,writes=0;
const storage={getItem:key=>key===COLLECTION_STORAGE_KEY?saved:null,setItem:(key,value)=>{assert.equal(key,COLLECTION_STORAGE_KEY);saved=value;writes++;}};
const game=createCollectionState({records:moleculeCatalog(),groups,templates,storage,now:()=>1000});
assert.equal(game.discoveredCount,0);assert.equal(game.unlockedCount,0);
const methanol=fixture('methanol');
let result=game.observeStructures([methanol]);
assert.equal(result.events[0].isNew,true);assert.ok(game.isUnlocked('hydroxyl'));
assert.deepEqual(game.groupSources('hydroxyl'),['methanol']);
const writesAfterFirst=writes;
game.observeStructures([methanol]);assert.equal(writes,writesAfterFirst,'Repeated recognition must not write storage.');

// Gameplay loop: two-carbon raw skeleton + unlocked OH, then a normal bond.
const field=new Molecule(),carbonIds=['C','C','H','H','H','H','H'].map(element=>field.addAtom(element).id);
[[0,1],[0,2],[0,3],[0,4],[1,5],[1,6]].forEach(([a,b])=>field.setBond(carbonIds[a],carbonIds[b],1));
const oh=expandCraftStructure(field,template('hydroxyl'));
assert.equal(connectedStructures(field).length,2,'Placing a part cannot auto-connect or complete a molecule.');
assert.equal(connectedStructures(field).filter(item=>item.complete).length,0);
field.setBond(carbonIds[1],oh.attachments[0].atomId,1); // same model operation as electron pairing
const ethanol=connectedStructures(field)[0];assert.equal(ethanol.record?.id,'ethanol');
result=game.observeStructures([ethanol]);assert.equal(result.events[0].isNew,true);
assert.equal(game.discoveredCount,2);assert.equal(game.groupSources('hydroxyl').length,2);
result=game.observeStructures([fixture('dimethyl-ether')]);
assert.ok(result.events[0].isomerOf.includes('ethanol'));assert.ok(game.milestoneIds().includes('isomer'));
game.observeStructures([fixture('formic-acid')]);assert.equal(game.isUnlocked('carboxyl'),false);
game.observeStructures([fixture('formic-acid')]);assert.equal(game.isUnlocked('carboxyl'),false,'Repeats cannot unlock a two-example part.');
game.observeStructures([fixture('acetic-acid')]);assert.equal(game.isUnlocked('carboxyl'),true);
game.observeStructures([fixture('benzene')]);assert.equal(game.isUnlocked('phenyl'),false);
game.observeStructures([fixture('toluene')]);assert.equal(game.isUnlocked('phenyl'),true);

// Simultaneous components, duplicate stable ids, loose fragments, and reloading.
const multiple=new Molecule();insert(multiple,record('water'));insert(multiple,record('water'));insert(multiple,record('hydrogen'));multiple.addAtom('C');
result=game.observeStructures(connectedStructures(multiple));
assert.equal(result.events.filter(event=>event.isNew&&event.record.id==='water').length,1);
assert.equal(result.events.filter(event=>event.isNew&&event.record.id==='hydrogen').length,1);
const reloaded=createCollectionState({records,groups,templates,storage});
assert.equal(reloaded.discoveredCount,game.discoveredCount);assert.ok(reloaded.isUnlocked('hydroxyl'));assert.ok(reloaded.isUnlocked('phenyl'));
assert.equal(new Molecule().atoms.length,0,'Meta progression does not restore the field.');
assert.ok(!Object.keys(JSON.parse(saved)).some(key=>['atoms','bonds','placements','field'].includes(key)));
const beforeDuplicate=writes;reloaded.observeStructures([fixture('ethanol')]);assert.equal(writes,beforeDuplicate);

// Every template stays open at precisely its declared attachment points.
for(const part of templates){
  assert.ok(part.nameJa&&!/[=≡]/.test(part.nameJa),`${part.id}: palette needs a spoken structure name`);
  assert.ok(part.notation&&part.nameEn);
  const model=new Molecule(),expanded=expandCraftStructure(model,part),component=connectedStructures(model)[0];
  assert.equal(component.complete,false,part.id);assert.equal(model.atoms.length,part.atoms.length);
  assert.deepEqual(model.bonds.map(bond=>[expanded.ids.indexOf(bond.a),expanded.ids.indexOf(bond.b),bond.order]),part.bonds);
  const coordinates=seedCraftCoordinates(part);assert.equal(coordinates.length,part.atoms.length);
  for(let i=0;i<coordinates.length;i++)for(let j=i+1;j<coordinates.length;j++){
    const a=coordinates[i],b=coordinates[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>.02,`${part.id}: coincident seeds`);
  }
  for(const port of expanded.attachments)assert.ok(model.atoms.some(atom=>atom.id===port.atomId));
}
assert.throws(()=>validateCraftStructures([{...template('carboxyl'),bonds:[[0,1,1],[1,2,1],[2,3,1]]}],groups));

const loadRaw=raw=>createCollectionState({records,groups,templates,storage:{getItem:()=>raw,setItem:()=>{}}});
assert.equal(loadRaw('{broken').discoveredCount,0);
assert.equal(loadRaw(JSON.stringify({schemaVersion:1,discoveredMolecules:[{id:'removed'},{id:'methanol'},{id:'methanol'}],unlockedStructures:['phenyl']})).discoveredCount,1);
assert.equal(loadRaw(JSON.stringify({schemaVersion:1,discoveredMolecules:[{id:'methanol'}],unlockedStructures:['phenyl']})).isUnlocked('phenyl'),false);
assert.equal(loadRaw(JSON.stringify({schemaVersion:0,discoveredMoleculeIds:['methanol']})).isUnlocked('hydroxyl'),true);
let futureWrites=0;
const future=createCollectionState({records,groups,templates,storage:{getItem:()=>JSON.stringify({schemaVersion:99}),setItem:()=>futureWrites++}});
future.observeStructures([fixture('methanol')]);assert.equal(futureWrites,0,'Never overwrite a future-version save.');
const denied=createCollectionState({records,groups,templates,storage:{getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('quota');}}});
denied.observeStructures([fixture('methanol')]);assert.equal(denied.discoveredCount,1);assert.ok(denied.storageMessage);
console.log(`Collection loop tests passed: ${records.length} molecules, ${groups.length} patterns, ${templates.length} parts, progression/save/failure/isomer cases.`);
