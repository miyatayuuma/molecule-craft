import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Molecule,setMoleculeDatabase,countElements} from '../src/chemistry.js?v=20';
import {connectedStructures} from '../src/workspace-model.js?v=20';
import {detectFunctionalGroups} from '../src/functional-groups.js';
import {expandCraftStructure} from '../src/craft-structures.js?v=31';
import {createCollectionState} from '../src/collection-state.js';
import {ELEMENT_UNLOCKS,availableElements,nextElementUnlock,createElementPalette} from '../src/element-progression.js';

const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const records=await json('../data/molecules.json'),groups=await json('../data/functional-groups.json'),templates=await json('../data/craft-structures.json');
setMoleculeDatabase(records);
const record=id=>records.find(item=>item.id===id),part=id=>templates.find(item=>item.id===id);
const insert=(model,entry)=>{const ids=entry.atoms.map(element=>model.addAtom(element).id);for(const [a,b,order] of entry.bonds)model.setBond(ids[a],ids[b],order);return ids;};
const fixture=id=>{const model=new Molecule();insert(model,record(id));return connectedStructures(model)[0];};
const detect=(id,group)=>detectFunctionalGroups(record(id),groups).some(item=>item.id===group);
const newGame=storage=>createCollectionState({records,groups,templates,storage});

// Independent upstream connectivity, not self-recognition of the builder's own
// data. These 20 reference SMILES use only neutral atoms, branches and digits.
function parseReference(smiles){
  const model=new Molecule(),stack=[],rings=new Map();let current=null,order=1;
  for(let i=0;i<smiles.length;i++){
    const token=smiles[i];
    if(token==='('){stack.push(current);continue;}
    if(token===')'){assert.ok(stack.length);current=stack.pop();continue;}
    if(token==='='){order=2;continue;}
    if(/[0-9]/.test(token)){
      if(rings.has(token)){model.setBond(current,rings.get(token).id,Math.max(order,rings.get(token).order));rings.delete(token);}
      else rings.set(token,{id:current,order});
      order=1;continue;
    }
    assert.ok(['C','N','O','S'].includes(token),`Unsupported reference SMILES token: ${token}`);
    const id=model.addAtom(token).id;if(current!=null)model.setBond(current,id,order);current=id;order=1;
  }
  assert.equal(stack.length,0);assert.equal(rings.size,0);
  for(const atom of [...model.atoms])for(let n=({C:4,N:3,O:2,S:2}[atom.element]-model.bondOrderForAtom(atom.id));n>0;n--)model.setBond(atom.id,model.addAtom('H').id,1);
  return model;
}
const references=await json('./fixtures/collection-expansion-reference.json');
assert.equal(references.records.length,20);
for(const ref of references.records){
  const model=parseReference(ref.connectivitySMILES),entry=record(ref.id);
  assert.ok(entry?.learningNote&&entry.iupacNameEn&&entry.commonNameJa,ref.id);
  assert.equal(entry.formula,ref.formula,`${ref.id}: upstream formula`);
  assert.equal(model.recognizedMolecule()?.id,ref.id,`${ref.id}: upstream topology`);
  assert.deepEqual(countElements(model.atoms),countElements(entry.atoms),ref.id);
  assert.equal(model.validation().level,'ok');
}
for(const id of ['malic-acid','serine','cysteine','methionine'])assert.equal(record(id).stereochemistry,'unspecified');

assert.deepEqual(availableElements(0),['H','C','O']);
const game=newGame(null);
for(const item of ELEMENT_UNLOCKS)assert.equal(game.canUseElement(item.symbol),item.discoveries===0);
assert.equal(nextElementUnlock(0,game.unlockedElements()).remaining,3);
// The entire gate ladder is achievable using initially available elements.
const initial=records.filter(entry=>game.canBuild(entry));assert.ok(initial.length>=15);
for(let i=0;i<15;i++){
  const result=game.observeStructures([fixture(initial[i].id)]);
  for(const item of ELEMENT_UNLOCKS)assert.equal(game.canUseElement(item.symbol),item.discoveries<=i+1,`${i+1}: ${item.symbol}`);
  assert.deepEqual(result.events[0].unlockedElements,ELEMENT_UNLOCKS.filter(item=>item.discoveries===i+1).map(item=>item.symbol));
  assert.deepEqual(game.observeStructures([fixture(initial[i].id)]).events[0].unlockedElements,[],'Repeats must not reaward gates');
}
assert.equal(nextElementUnlock(15,game.unlockedElements()),null);

// Low-progress legacy players retain elements used in real discoveries, not
// fabricated/removed ids; schema 2 preserves the grants across later reloads.
let saved=JSON.stringify({schemaVersion:1,discoveredMolecules:[{id:'sulfur-hexafluoride'},{id:'removed'},{id:'sulfur-hexafluoride'}]});
let writes=0;const storage={getItem:()=>saved,setItem:(_,value)=>{saved=value;writes++;}};
const legacy=newGame(storage);assert.equal(legacy.discoveredCount,1);assert.ok(legacy.canUseElement('S')&&legacy.canUseElement('F'));assert.equal(legacy.canUseElement('P'),false);
assert.equal(writes,0,'Loading should not write each frame or rewrite a valid save');
legacy.observeStructures([fixture('methane')]);assert.equal(JSON.parse(saved).schemaVersion,2);
const restored=newGame(storage);assert.ok(restored.canUseElement('F'));assert.ok(restored.canUseElement('S'));assert.equal(restored.canUseElement('N'),false);
assert.equal(new Molecule().atoms.length,0,'Do not restore the crafting field');
const removed=newGame({getItem:()=>JSON.stringify({schemaVersion:1,discoveredMoleculeIds:['removed'],unlockedElements:['P']})});
assert.deepEqual(removed.unlockedElements(),['H','C','O']);

// Ordinary named open parts, with exact branching and hydrogen requirements.
assert.ok(detect('methane','methyl'));assert.ok(detect('toluene','methyl'));assert.equal(detect('ethene','methyl'),false);
assert.ok(detect('2-propanol','isopropyl'));assert.ok(detect('cumene','isopropyl'));assert.equal(detect('1-propanol','isopropyl'),false);assert.equal(detect('tert-butanol','isopropyl'),false);
assert.ok(detect('1-butanol','n-butyl'));assert.ok(detect('n-butyl-acetate','n-butyl'));
for(const id of ['2-butanol','isobutanol','tert-butanol','cyclobutane'])assert.equal(detect(id,'n-butyl'),false,id);
assert.equal(templates.filter(entry=>entry.unlock.groupId==='ethyl').length,1,'Keep the existing ethyl part/id');
const progression=newGame(null);progression.observeStructures([fixture('methane')]);assert.ok(progression.isUnlocked('methyl'));
for(const [group,first,second] of [['isopropyl','2-propanol','cumene'],['n-butyl','1-butanol','n-butyl-acetate']]){
  progression.observeStructures([fixture(first)]);assert.equal(progression.isUnlocked(group),false);
  progression.observeStructures([fixture(first)]);assert.equal(progression.isUnlocked(group),false);
  progression.observeStructures([fixture(second)]);assert.ok(progression.isUnlocked(group));
}

// Play loop: methanol teaches OH + methyl; methyl caps an acid part to discover
// acetic acid; alkyl + ester pieces create new, separately recognized products.
const loop=newGame(null);loop.observeStructures([fixture('methanol')]);loop.observeStructures([fixture('formic-acid')]);loop.observeStructures([fixture('propionic-acid')]);
assert.ok(loop.isUnlocked('methyl')&&loop.isUnlocked('carboxyl')&&loop.canUseElement('N'));
const field=new Molecule(),methyl=expandCraftStructure(field,part('methyl')),carboxyl=expandCraftStructure(field,part('carboxyl'));
assert.equal(connectedStructures(field).filter(item=>item.complete).length,0);
field.setBond(methyl.attachments[0].atomId,carboxyl.attachments[0].atomId,1);
assert.equal(connectedStructures(field)[0].record?.id,'acetic-acid');
assert.equal(loop.observeStructures(connectedStructures(field)).events[0].isNew,true);

// All gates update the original buttons in place and can fail open. This small
// DOM double complements the public browser integration harness.
const buttons=ELEMENT_UNLOCKS.map(item=>({dataset:{element:item.symbol},style:{},hidden:false,disabled:false})),note={textContent:''};
const root={querySelectorAll:()=>buttons,querySelector:()=>note},palette=createElementPalette(root);
assert.deepEqual(buttons.filter(b=>!b.hidden).map(b=>b.dataset.element),['H','C','O']);assert.equal(palette.canUse('N'),false);
palette.update(loop);assert.ok(palette.canUse('N'));assert.match(note.textContent,/Cl/);
palette.fallback();assert.ok(buttons.every(button=>!button.hidden&&!button.disabled));assert.ok(palette.canUse('P'));
console.log(`Expansion passed: 20 PubChem topologies, atom gates/migration, 3 named parts, recipe loop and palette failure fallback.`);
