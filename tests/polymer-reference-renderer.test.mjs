import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {ELEMENTS,modelAtomRadius} from '../src/chemistry.js';
import {createPolymerReferenceModel} from '../src/polymer-reference-model.js';
import {initializeReferenceAtoms,syncReferenceBondBatch,setReferenceGrowth,advanceReferenceGrowth} from '../src/polymer-reference-renderer.js';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const originKey=o=>`${o.instanceId}:${o.sourceAtomIndex}`;
test('growth waits for a rendered frame and never catches up after a stall',()=>{
 const growth={units:4,lastRenderedAt:null};
 assert.equal(advanceReferenceGrowth(growth,100000,100),false);
 growth.lastRenderedAt=100000;
 assert.equal(advanceReferenceGrowth(growth,100149,100),false);
 assert.equal(advanceReferenceGrowth(growth,110000,100),true);assert.equal(growth.units,5);
 assert.equal(advanceReferenceGrowth(growth,120000,100),false);
 growth.lastRenderedAt=120000;
 assert.equal(advanceReferenceGrowth(growth,120150,100),true);assert.equal(growth.units,6);
});
test('batched spheres retain every atom, tessellation, material and local transform',()=>{
 const plan=createPolymerReferenceModel(THREE,'nylon-6-6',100),graph={...plan,atomOrigins:plan.atoms.map(a=>({instanceId:`r-${a.unit}`,sourceAtomIndex:a.id}))},before=JSON.stringify(graph);
 const visual={group:new THREE.Group(),graph,atomByGraphIndex:new Map(),atomMeshesByOrigin:new Map()};initializeReferenceAtoms(THREE,visual,{elements:ELEMENTS,atomRadius:modelAtomRadius,originKey});
 const batches=visual.group.children.filter(o=>o.isInstancedMesh);assert.equal(batches.length,4);assert.equal(batches.reduce((n,b)=>n+b.count,0),3803);assert.equal(visual.atomByGraphIndex.size,3803);assert.equal(JSON.stringify(graph),before);
 for(const batch of batches){assert.equal(batch.geometry.parameters.widthSegments,24);assert.equal(batch.geometry.parameters.heightSegments,16);assert.equal(batch.material.roughness,.42);assert.equal(batch.material.metalness,0);
   // Resolve by handle material identity, avoiding assumptions about color format.
   const handles=[...visual.atomByGraphIndex.values()].filter(h=>h.material===batch.material);assert.equal(handles.length,batch.count);
   for(let i=0;i<handles.length;i++){const m=new THREE.Matrix4();batch.getMatrixAt(i,m);const p=new THREE.Vector3().setFromMatrixPosition(m);assert.ok(p.distanceTo(handles[i].position)<1e-5);assert.equal(handles[i].isMesh,undefined);}
 }
});
test('bond batch preserves visible lane matrices and reuses the same GPU owner on orbit',()=>{
 const handles=[new THREE.Object3D(),new THREE.Object3D(),new THREE.Object3D()];handles[0].position.set(1,2,3);handles[0].scale.set(.05,1.2,.05);handles[1].visible=false;handles[2].quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),.6);
 const visual={group:new THREE.Group(),graph:{bonds:[{order:3}]},bondMeshes:handles};syncReferenceBondBatch(THREE,visual);const batch=visual.referenceBondBatch;assert.equal(batch.count,2);assert.equal(batch.geometry.parameters.radialSegments,16);assert.equal(batch.material.roughness,.5);
 for(const [index,handle]of [handles[0],handles[2]].entries()){const matrix=new THREE.Matrix4();batch.getMatrixAt(index,matrix);assert.ok(matrix.elements.every((x,i)=>Math.abs(x-handle.matrix.elements[i])<1e-6));}
 handles[0].position.x=4;syncReferenceBondBatch(THREE,visual);assert.equal(visual.referenceBondBatch,batch);assert.equal(visual.group.children.length,1);
});
test('growth reveals only existing atoms and bonds whose two units are present',()=>{
 const atoms=[{id:0,element:'C',unit:0,x:0,y:0,z:0},{id:1,element:'C',unit:1,x:1,y:0,z:0},{id:2,element:'H',unit:0,x:0,y:1,z:0}],graph={atoms,bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1}],atomOrigins:atoms.map(a=>({instanceId:`r-${a.unit}`,sourceAtomIndex:a.id}))};
 const before=JSON.stringify(graph),visual={group:new THREE.Group(),graph,layoutPlan:{unitCount:2},atomByGraphIndex:new Map(),atomMeshesByOrigin:new Map(),bondMeshes:graph.bonds.map(b=>{const h=new THREE.Object3D();h.userData.polymerAtomIndices=[b.a,b.b];return h;})};
 initializeReferenceAtoms(THREE,visual,{elements:ELEMENTS,atomRadius:modelAtomRadius,originKey,growth:true});
 setReferenceGrowth(THREE,visual,1);assert.equal(visual.group.children.filter(x=>x.userData.referenceBatch==='atoms').reduce((n,x)=>n+x.count,0),2);assert.equal(visual.referenceBondBatch.count,1);
 setReferenceGrowth(THREE,visual,2);assert.equal(visual.group.children.filter(x=>x.userData.referenceBatch==='atoms').reduce((n,x)=>n+x.count,0),3);assert.equal(visual.referenceBondBatch.count,2);assert.equal(JSON.stringify(graph),before);
});
test('representative linear, copolymer and network growth preserves the 100-unit graph',()=>{
 for(const id of ['polyethylene','ethylene-propylene-copolymer','phenol-formaldehyde-resin']){
  const plan=createPolymerReferenceModel(THREE,id,100),graph={...plan,atomOrigins:plan.atoms.map(a=>({instanceId:`r-${a.unit}`,sourceAtomIndex:a.id}))},before=JSON.stringify(graph);
  const visual={group:new THREE.Group(),graph,layoutPlan:plan,atomByGraphIndex:new Map(),atomMeshesByOrigin:new Map(),bondMeshes:plan.bonds.map(b=>{const h=new THREE.Object3D();h.userData.polymerAtomIndices=[b.a,b.b];return h;})};
  initializeReferenceAtoms(THREE,visual,{elements:ELEMENTS,atomRadius:modelAtomRadius,originKey,growth:true});
  for(const n of [1,10,30,50,75,100]){setReferenceGrowth(THREE,visual,n);const expectedAtoms=plan.atoms.filter(a=>a.unit<n).length,expectedBonds=plan.bonds.filter(b=>plan.atoms[b.a].unit<n&&plan.atoms[b.b].unit<n).length;assert.equal(visual.group.children.filter(x=>x.userData.referenceBatch==='atoms').reduce((sum,x)=>sum+x.count,0),expectedAtoms,`${id} atoms ${n}`);assert.equal(visual.referenceBondBatch.count,expectedBonds,`${id} bonds ${n}`);}
  assert.equal(JSON.stringify(graph),before);
 }
});
test('viewer disposal releases instanced buffers and shared material exactly once',async()=>{
 const source=await readFile(new URL('../src/reaction-lab-viewer.js',import.meta.url),'utf8'),start=source.indexOf('  function disposeObject('),brace=source.indexOf('{',start);let end=brace+1,depth=1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}const dispose=runInNewContext(`${source.slice(start,end)};disposeObject`);
 const g=new THREE.SphereGeometry(1),m=new THREE.MeshStandardMaterial(),batch=new THREE.InstancedMesh(g,m,2),group=new THREE.Group();group.add(batch);const handle=new THREE.Object3D();handle.material=m;group.add(handle);const counts={batch:0,geometry:0,material:0};batch.addEventListener('dispose',()=>counts.batch++);g.addEventListener('dispose',()=>counts.geometry++);m.addEventListener('dispose',()=>counts.material++);dispose(group);assert.deepEqual(counts,{batch:1,geometry:1,material:1});
});
