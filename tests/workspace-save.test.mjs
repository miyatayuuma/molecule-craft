import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {Molecule} from '../src/chemistry.js';
import {captureWorkspace,restoreWorkspace,validateWorkspace,createWorkspaceStorage,WORKSPACE_STORAGE_KEY} from '../src/workspace-save.js?v=30';
function field(){const molecule=new Molecule(),placements=new Map(),camera=new THREE.PerspectiveCamera(44,390/650,.1,100),cameraTarget=new THREE.Vector3(4,-1,2);camera.position.set(7,5,11);camera.lookAt(cameraTarget);return {THREE,molecule,placements,camera,cameraTarget};}
const original=field(),ids=['C','O','H','N'].map(element=>original.molecule.addAtom(element).id);
original.molecule.setBond(ids[0],ids[1],2);original.molecule.setBond(ids[0],ids[2],1);
ids.forEach((id,i)=>original.placements.set(id,{position:new THREE.Vector3(i*.78-2,i*.17,-i*.19)}));
const saved=captureWorkspace({...original,positionFor:id=>original.placements.get(id).position,selectedAtomId:ids[2],focusId:ids[0],pivot:new THREE.Vector3(-.8,.2,-.5)});
const restored=field(),selection=restoreWorkspace(structuredClone(saved),restored);
assert.deepEqual(captureWorkspace({...restored,positionFor:id=>restored.placements.get(id).position,selectedAtomId:selection.selected,focusId:selection.focus,pivot:selection.pivot}),saved,'Graph, loose atoms, exact positions, camera and focus must survive a round trip');
assert.equal(restored.molecule.addAtom('H').id>Math.max(...restored.molecule.atoms.slice(0,-1).map(a=>a.id)),true,'Restored atoms must not collide with subsequently generated ids');
for(const mutate of [s=>s.atoms[0].position[0]=NaN,s=>s.atoms[0].position[2]=Infinity,s=>s.atoms[0].element='U',s=>s.bonds.push([0,0,1]),s=>s.bonds.push([0,3,4]),s=>s.bonds.push([0,88,1]),s=>s.bonds.push([1,0,2]),s=>s.camera.position=[...s.camera.target],s=>s.camera.up=[0,0,0],s=>s.focus=99,s=>s.pivot=[1,2],s=>s.atoms=Array.from({length:1001},()=>s.atoms[0])]){const invalid=structuredClone(saved);mutate(invalid);assert.throws(()=>validateWorkspace(invalid));}
const data=new Map([['molecule-craft.collection.v1','KEEP']]);let writes=0;
const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{writes++;data.set(key,value);}};
const save=createWorkspaceStorage({storage});assert.equal(save.read(),null);assert.ok(save.write(saved));assert.ok(save.write(saved));assert.equal(writes,1,'Unchanged frames do not write storage');assert.equal(data.get('molecule-craft.collection.v1'),'KEEP');
const reload=createWorkspaceStorage({storage});assert.deepEqual(reload.read(),saved);
const empty=field(),emptySave=captureWorkspace({...empty,positionFor:()=>null,selectedAtomId:null,focusId:null});assert.ok(reload.write(emptySave));assert.equal(JSON.parse(data.get(WORKSPACE_STORAGE_KEY)).atoms.length,0,'Explicit clear stays cleared after restart');
assert.equal(save.write(saved),false,'A stale tab is notified even before its next edit');const changed=structuredClone(saved);changed.selected=0;assert.equal(save.write(changed),false);assert.match(save.message,/別の画面/);assert.equal(data.get(WORKSPACE_STORAGE_KEY),JSON.stringify(emptySave),'Stale tab cannot overwrite a new save');
for(const raw of ['broken JSON',JSON.stringify({...saved,bonds:[[0,999,1]]}),JSON.stringify({...saved,schemaVersion:2})]){
  data.set(WORKSPACE_STORAGE_KEY,raw);const store=createWorkspaceStorage({storage});assert.equal(store.read(),null);assert.ok(store.protected);assert.equal(store.write(emptySave),false);assert.equal(data.get(WORKSPACE_STORAGE_KEY),raw);
  if(raw.includes('"schemaVersion":2')){assert.equal(store.allowReset(),false);}else{assert.ok(store.allowReset());assert.ok(store.write(emptySave));}
}
const denied=createWorkspaceStorage({storage:{getItem:()=>null,setItem:()=>{throw new Error('QuotaExceededError');}}});denied.read();assert.equal(denied.write(saved),false);assert.match(denied.message,/保存できません/);
const unavailable=createWorkspaceStorage({storage:null});assert.equal(unavailable.read(),null);assert.equal(unavailable.write(saved),false);
console.log('Workspace saves passed: exact graph/view round trip, loose atoms, id safety, empty reset, malformed/future protection, quota, deduplication and cross-tab conflict.');
