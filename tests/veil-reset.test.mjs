import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createResources,RESOURCE_KEY,RESET_CATEGORIES} from '../src/veil/resources.js';
import {createCollectionState,COLLECTION_STORAGE_KEY} from '../src/collection-state.js';
import {WORKSPACE_STORAGE_KEY} from '../src/workspace-save.js?v=30';
import {Molecule,setMoleculeDatabase} from '../src/chemistry.js?v=20';
import {connectedStructures} from '../src/workspace-model.js';
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));setMoleculeDatabase(records);
function fixture(){
 const data=new Map();let operation=0,failAt=0;
 const write=fn=>{if(++operation===failAt)throw Error('Interrupted storage');fn();};
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>write(()=>data.set(k,v)),removeItem:k=>write(()=>data.delete(k))};
 const resources=createResources({storage});resources.collect(30,95);resources.learn('hydrogen');resources.fillTankFromElements('propellant','hydrogen',3);resources.state.progress.cleared=true;resources.state.progress.runs=7;resources.state.progress.special='pure-h';
 const workspace={schemaVersion:1,atoms:[{element:'H',position:[0,0,0]},{element:'H',position:[1,0,0]}],bonds:[[0,1,1]],camera:{position:[5,4,7],target:[0,0,0],up:[0,1,0]},selected:0,focus:0,pivot:null};
 resources.spend({H:2});resources.workspaceAdapter.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify(workspace));storage.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify(workspace));
 storage.setItem(COLLECTION_STORAGE_KEY,JSON.stringify({schemaVersion:2,discoveredMolecules:[{id:'hydrogen',at:1}],legacyElements:['N'],milestones:['double-bond']}));storage.setItem('molecule-craft.help.v1','seen');storage.setItem('unrelated-application','keep');
 return {storage,resources,data,fail(n){operation=0;failAt=n;}};
}
for(let fail=0;fail<=5;fail++){
 const f=fixture(),before=new Map(f.data);f.fail(fail);const result=f.resources.reset(RESET_CATEGORIES);
 if(fail===1){assert.equal(result.committed,false);assert.deepEqual(f.data,before);continue;}
 assert.equal(result.committed,true);assert.equal(f.resources.save(),false,'Old graph frozen after commit');f.fail(0);
 const reloaded=createResources({storage:f.storage});assert.equal(reloaded.blocked,false);assert.equal(reloaded.state.elements.H,0);assert.deepEqual(reloaded.state.tanks.propellant,{molecule:null,amount:0});assert.deepEqual(reloaded.state.recipes,[]);assert.equal(reloaded.state.workspace,null);assert.equal(reloaded.state.progress.cleared,false);assert.equal(reloaded.state.progress.runs,0);assert.equal(reloaded.state.progress.bestChain,0);assert.equal(reloaded.state.pendingReset,undefined);
 assert.equal(f.storage.getItem(WORKSPACE_STORAGE_KEY),null);assert.equal(f.storage.getItem('molecule-craft.help.v1'),null);assert.equal(f.storage.getItem('unrelated-application'),'keep');
 const book=createCollectionState({records,groups:[],templates:[],storage:f.storage});assert.equal(book.discoveredCount,0);assert.deepEqual(book.unlockedElements(),['H','C','O']);
 reloaded.save();assert.deepEqual(createResources({storage:f.storage}).state.recipes,[],'Legacy collection cannot re-unlock H₂');
}
for(const category of RESET_CATEGORIES){
 const f=fixture(),before=f.resources.snapshot();assert.ok(f.resources.reset([category]).committed);const r=createResources({storage:f.storage});
 if(['collection','recipes','workspace'].includes(category)){assert.equal(r.state.workspace,null);assert.equal(r.state.elements.H,before.elements.H+2);}
 if(category==='elements'){assert.equal(r.state.elements.H,0);assert.equal(r.state.workspace,null);}
 if(category==='tanks'){assert.deepEqual(r.state.tanks.propellant,{molecule:null,amount:0});assert.deepEqual(r.state.workspace,before.workspace);}
 if(category!=='recipes')assert.deepEqual(r.state.recipes,before.recipes);else assert.deepEqual(r.state.recipes,[]);
 if(category!=='records')assert.equal(r.state.progress.bestChain,95);else assert.equal(r.state.progress.bestChain,0);
 if(category!=='exploration')assert.equal(r.state.progress.cleared,true);else {assert.equal(r.state.progress.cleared,false);assert.equal(r.state.progress.runs,0);assert.equal(r.state.progress.special,undefined);}
 if(category!=='collection')assert.ok(f.storage.getItem(COLLECTION_STORAGE_KEY).includes('hydrogen'));
}
// A different open tab cannot put old discoveries back after a reset.
const f=fixture(),oldBook=createCollectionState({records,groups:[],templates:[],storage:f.storage}),stale=createResources({storage:f.storage});
f.resources.reset(RESET_CATEGORIES);const resetRaw=f.storage.getItem(RESOURCE_KEY);assert.equal(stale.reset(RESET_CATEGORIES).committed,false);assert.equal(f.storage.getItem(RESOURCE_KEY),resetRaw);
const water=records.find(r=>r.id==='water'),m=new Molecule(),ids=water.atoms.map(el=>m.addAtom(el).id);for(const [a,b,order]of water.bonds)m.setBond(ids[a],ids[b],order);
oldBook.observeStructures(connectedStructures(m));assert.match(oldBook.storageMessage,/初期化/);assert.equal(JSON.parse(f.storage.getItem(COLLECTION_STORAGE_KEY)).discoveredMolecules.length,0);
console.log('Reset: all interruption points, each category, refund balance, no legacy resurrection, unrelated storage and stale-tab protection passed.');
