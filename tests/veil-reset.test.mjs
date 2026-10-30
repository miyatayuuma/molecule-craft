import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createResources,RESOURCE_KEY,RESET_CATEGORIES} from '../src/veil/resources.js';
import {createInitialResourcesState} from '../src/veil/resources-persistence.js';
import {createProgressResetUI} from '../src/veil/reset-ui.js';
import {createCollectionState,COLLECTION_STORAGE_KEY} from '../src/collection-state.js';
import {WORKSPACE_STORAGE_KEY} from '../src/workspace-persistence.js?v=1';
import {Molecule,setMoleculeDatabase} from '../src/chemistry.js?v=20';
import {connectedStructures} from '../src/workspace-model.js';
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));setMoleculeDatabase(records);
function fixture(){
 const data=new Map();let operation=0,failAt=0;
 const write=fn=>{if(++operation===failAt)throw Error('Interrupted storage');fn();};
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>write(()=>data.set(k,v)),removeItem:k=>write(()=>data.delete(k))};
 const resources=createResources({storage});resources.collect(30,95);resources.learn('hydrogen');resources.fillTankFromElements('propellant','hydrogen',3);resources.state.progress.cleared=true;resources.state.progress.runs=7;resources.state.progress.special='pure-h';
 const legacyWorkspace={schemaVersion:1,atoms:[{element:'H',position:[0,0,0]},{element:'H',position:[1,0,0]}],bonds:[[0,1,1]],camera:{position:[5,4,7],target:[0,0,0],up:[0,1,0]},selected:0,focus:0,pivot:null};
 const workspace={...legacyWorkspace,schemaVersion:2,targetMoleculeId:null};
 resources.spend({H:2});resources.workspaceAdapter.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify(workspace));storage.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify(legacyWorkspace));
 storage.setItem(COLLECTION_STORAGE_KEY,JSON.stringify({schemaVersion:2,discoveredMolecules:[{id:'hydrogen',at:1}],legacyElements:['N'],milestones:['double-bond']}));storage.setItem('molecule-craft.help.v1','seen');storage.setItem('unrelated-application','keep');
 return {storage,resources,data,fail(n){operation=0;failAt=n;}};
}
for(let fail=0;fail<=5;fail++){
 const f=fixture(),before=new Map(f.data);f.fail(fail);const result=f.resources.reset(RESET_CATEGORIES);
 if(fail===1){assert.equal(result.committed,false);assert.deepEqual(f.data,before);continue;}
 assert.equal(result.committed,true);assert.equal(f.resources.save(),false,'Old graph frozen after commit');f.fail(0);
 const reloaded=createResources({storage:f.storage});assert.equal(reloaded.blocked,false);assert.equal(reloaded.state.elements.H,0);assert.deepEqual(reloaded.state.tanks.propellant,{molecule:null,amount:0});assert.deepEqual(reloaded.state.recipes,[]);assert.equal(reloaded.state.workspace,null);assert.equal(reloaded.state.progress.cleared,false);assert.equal(reloaded.state.progress.runs,0);assert.equal(reloaded.state.progress.bestChain,0);assert.equal(reloaded.state.pendingReset,undefined);
 assert.equal(f.storage.getItem(WORKSPACE_STORAGE_KEY),null);assert.equal(f.storage.getItem('molecule-craft.help.v1'),null);assert.equal(f.storage.getItem('unrelated-application'),'keep');
 const book=createCollectionState({records,groups:[],templates:[],storage:f.storage,elementAccess:element=>reloaded.canUseElement(element)});assert.equal(book.discoveredCount,0);assert.deepEqual(book.unlockedElements(),['H'],'full reset leaves only the canonical H progression element available');
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

const futureState=createInitialResourcesState();futureState.schemaVersion=10;futureState.elements.H=17;futureState.futureField={keep:'raw'};
const futureRaw=JSON.stringify(futureState),futureData=new Map([[RESOURCE_KEY,futureRaw],[COLLECTION_STORAGE_KEY,'collection bytes'],[WORKSPACE_STORAGE_KEY,'workspace bytes'],['molecule-craft.help.v1','help bytes']]);
const futureStorage={getItem:key=>futureData.get(key)??null,setItem:(key,value)=>futureData.set(key,String(value)),removeItem:key=>futureData.delete(key)},futureResources=createResources({storage:futureStorage});
const priorDocument=globalThis.document,priorWindow=globalThis.window,handlers={},nodes=new Map();let reloads=0;
for(const id of ['reset-status','reset-all','reset-selected'])nodes.set(id,{textContent:'',disabled:false,addEventListener:(type,handler)=>{handlers[id]=handler;}});
globalThis.document={getElementById:id=>nodes.get(id)??null,querySelectorAll:()=>[]};globalThis.window={confirm:()=>true};
try{
 createProgressResetUI({resources:futureResources,reload:()=>reloads++});handlers['reset-all']();
 assert.equal(reloads,0,'a blocked future-schema reset never enters the success/reload path');
 assert.match(nodes.get('reset-status').textContent,/新しい版.*保護.*変更できません.*更新/,'reset UI reports the unsupported save protection state');
 assert.equal(nodes.get('reset-all').disabled,false,'failed reset does not disable controls as if it had succeeded');
 assert.equal(futureData.get(RESOURCE_KEY),futureRaw);assert.equal(futureData.get(COLLECTION_STORAGE_KEY),'collection bytes');assert.equal(futureData.get(WORKSPACE_STORAGE_KEY),'workspace bytes');assert.equal(futureData.get('molecule-craft.help.v1'),'help bytes');
}finally{if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;}
console.log('Reset: all interruption points, each category, refund balance, no legacy resurrection, unrelated storage and stale-tab protection passed.');
