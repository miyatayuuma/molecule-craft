import test from 'node:test';
import assert from 'node:assert/strict';
import {createResources} from '../src/veil/resources.js';
import {createDiscoveryConnection} from '../src/craft-connections.js?v=3';
import {WORKSPACE_SCHEMA,validateWorkspace} from '../src/workspace-save.js?v=31';
import {migrateWorkspaceSave,validatePersistedWorkspace} from '../src/workspace-migrations.js?v=1';
import {WORKSPACE_STORAGE_KEY,createWorkspaceStorage,parseWorkspaceSave} from '../src/workspace-persistence.js?v=1';

const common=()=>({
  atoms:[{element:'H',position:[-.36,0,0]},{element:'H',position:[.36,0,0]}],
  bonds:[[0,1,1]],selected:0,focus:0,pivot:null,
  camera:{position:[4,3,8],target:[0,0,0],up:[0,1,0]},
});
const v1=()=>({schemaVersion:1,...common()});
const current=targetMoleculeId=>({schemaVersion:WORKSPACE_SCHEMA,...common(),targetMoleculeId});
const emptyV1=()=>({schemaVersion:1,atoms:[],bonds:[],selected:null,focus:null,pivot:null,camera:{position:[4,3,8],target:[0,0,0],up:[0,1,0]}});
const memory=entries=>{const data=new Map(entries??[]);let writes=0;return {data,get writes(){return writes;},getItem:key=>data.get(key)??null,setItem:(key,value)=>{writes++;data.set(key,value);},removeItem:key=>data.delete(key)};};

test('v1 -> current preserves graph/view and gives the historically absent target a null meaning',()=>{
  const raw=v1(),before=structuredClone(raw),migrated=migrateWorkspaceSave(raw);
  assert.deepEqual(raw,before,'migration must not mutate the persisted object');
  assert.deepEqual(migrated,{...before,schemaVersion:WORKSPACE_SCHEMA,targetMoleculeId:null});
  assert.equal(validatePersistedWorkspace(raw),raw);
  assert.equal(validateWorkspace(migrated),migrated);
});

test('v2 -> current is unchanged when canonical and only normalizes an omitted target',()=>{
  const canonical=current('hydrogen');
  assert.deepEqual(migrateWorkspaceSave(canonical),canonical);
  const missing={schemaVersion:WORKSPACE_SCHEMA,...common()};
  assert.deepEqual(migrateWorkspaceSave(missing),{...missing,targetMoleculeId:null});
});

test('empty legacy workspace migrates without inventing atoms, selection, focus, pivot or target',()=>{
  assert.deepEqual(migrateWorkspaceSave(emptyV1()),{...emptyV1(),schemaVersion:WORKSPACE_SCHEMA,targetMoleculeId:null});
});

test('malformed JSON, unsupported/future schema and structurally invalid saves fail at ingress',()=>{
  assert.throws(()=>parseWorkspaceSave('{broken'));
  assert.throws(()=>migrateWorkspaceSave({...v1(),schemaVersion:0}));
  assert.throws(()=>parseWorkspaceSave(JSON.stringify({...v1(),schemaVersion:3})));
  assert.throws(()=>migrateWorkspaceSave({...v1(),bonds:[[0,9,1]]}));
  assert.throws(()=>migrateWorkspaceSave({...v1(),camera:{...v1().camera,up:[0,0,0]}}));
});

test('legacy read returns canonical state without eager writeback; the next normal write uses current schema only',()=>{
  const legacyRaw=JSON.stringify(v1()),storage=memory([[WORKSPACE_STORAGE_KEY,legacyRaw]]),store=createWorkspaceStorage({storage});
  const loaded=store.read();
  assert.deepEqual(loaded,current(null));
  assert.equal(storage.writes,0,'read/migration alone must not change writeback timing');
  assert.equal(storage.getItem(WORKSPACE_STORAGE_KEY),legacyRaw);
  assert.equal(store.write(loaded),true);
  assert.equal(storage.writes,1);
  assert.deepEqual(JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY)),current(null));

  const fresh=memory(),egress=createWorkspaceStorage({storage:fresh});egress.read();
  assert.equal(egress.write(v1()),false,'persistence egress must reject legacy runtime values');
  assert.equal(fresh.getItem(WORKSPACE_STORAGE_KEY),null);
});

test('invalid and future raw saves remain byte-for-byte protected with the existing reset distinction',()=>{
  const valid=current(null);
  for(const {raw,future} of [
    {raw:'broken JSON',future:false},
    {raw:JSON.stringify({...v1(),bonds:[[0,99,1]]}),future:false},
    {raw:JSON.stringify({...v1(),schemaVersion:3}),future:true},
  ]){
    const storage=memory([[WORKSPACE_STORAGE_KEY,raw]]),store=createWorkspaceStorage({storage});
    assert.equal(store.read(),null);assert.equal(store.protected,true);assert.equal(store.write(valid),false);assert.equal(storage.getItem(WORKSPACE_STORAGE_KEY),raw);
    if(future)assert.equal(store.allowReset(),false,'future saves stay read-only protected');
    else{assert.equal(store.allowReset(),true);assert.equal(store.write(valid),true,'explicit cleanup may replace an invalid non-future save');}
  }
});

test('resources legacy workspace bridge canonicalizes v1 in memory without touching the standalone raw key',()=>{
  const raw=JSON.stringify(v1()),storage=memory([[WORKSPACE_STORAGE_KEY,raw]]),resources=createResources({storage});
  assert.equal(resources.blocked,false);
  assert.deepEqual(resources.state.workspace,current(null));
  assert.equal(storage.getItem(WORKSPACE_STORAGE_KEY),raw,'legacy bridge hydration must not eagerly rewrite the old key');
  assert.deepEqual(JSON.parse(resources.workspaceAdapter.getItem(WORKSPACE_STORAGE_KEY)),current(null));
});

test('a completed restored structure is baselined without completion progression, while a later forward rebuild still fires',()=>{
  const restored=parseWorkspaceSave(JSON.stringify(v1()));
  assert.equal(restored.bonds.length,1,'golden save represents a completed H2 structure');
  let discoveries=0,saves=0,presents=0;
  const collection={observeStructures:()=>({events:[]}),refreshProgress(){}};
  const connection=createDiscoveryConnection({
    resources:{discover(){discoveries++;return true;},save(){saves++;return true;}},
    getVeilUI:()=>null,getCollection:()=>collection,onPresent:()=>{presents++;},onDismiss:()=>{},onVibrate:()=>{},
  });
  const complete={key:'0,1',signature:'hydrogen',complete:true,record:{id:'hydrogen'}};
  connection.sync([complete]);connection.discardQueued();connection.check([complete],{now:1});
  assert.equal(discoveries,0);assert.equal(saves,0);assert.equal(presents,0,'startup hydrate queue is discarded before completion side effects');
  connection.sync([{...complete,signature:'broken',complete:false}]);
  connection.sync([{...complete,signature:'rebuilt',complete:true}]);connection.check([{...complete,signature:'rebuilt',complete:true}],{now:2});
  assert.equal(discoveries,1);assert.equal(saves,1,'later forward incomplete -> complete still emits progression');
});
