import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPolymerReferenceModel} from '../src/polymer-reference-model.js';
import {createPolymerLongChainLayout} from '../src/polymer-long-chain-preview.js';

test('30-unit Collection models retain reference topology and fit around the origin',()=>{
  const cases=[
    ['polyethylene',null],
    ['polyethylene-terephthalate',30],
    ['phenol-formaldehyde-resin',30],
  ];
  for(const [id,aromaticCount] of cases){
    const plan=createPolymerReferenceModel(THREE,id,30);
    const original=JSON.stringify(plan);
    const layout=createPolymerLongChainLayout(THREE,plan);
    assert.equal(plan.unitCount,30,id);
    assert.equal(new Set(plan.atoms.map(atom=>atom.unit)).size,30,id);
    assert.equal(layout.unitCount,30,id);
    assert.equal(layout.atoms.length,plan.atoms.length,id);
    assert.equal(layout.bonds.length,plan.bonds.length,id);
    assert.equal(layout.ports.length,0,id);
    assert.equal(JSON.stringify(plan),original,id+': must not mutate the reference plan');
    if(aromaticCount!==null)assert.equal(layout.aromaticCycles.length,aromaticCount,id);
    const min=new THREE.Vector3(Infinity,Infinity,Infinity),max=new THREE.Vector3(-Infinity,-Infinity,-Infinity);
    for(const atom of layout.atoms){assert.ok(atom.point.toArray().every(Number.isFinite),id);min.min(atom.point);max.max(atom.point);}
    assert.ok(min.add(max).length()<1e-6,id+': centered display');
    for(let i=0;i<layout.bonds.length;i++)assert.deepEqual(layout.bonds[i],{a:plan.bonds[i].a,b:plan.bonds[i].b,order:plan.bonds[i].order},id);
  }
});

test('30-unit view is lazy, cancellable and uses a single batched viewer',async()=>{
  const load=async path=>readFile(new URL(path,import.meta.url),'utf8');
  const ui=await load('../src/collection-ui.js');
  const long=await load('../src/polymer-long-chain-preview.js');
  const worker=await load('../src/polymer-collection-worker.js');
  const viewer=await load('../src/collection-viewer.js');
  const css=await load('../styles.css');
  assert.match(ui,/polymer-model-toggle/);
  assert.match(ui,/dataset\.polymerViewMode=mode/);
  assert.match(ui,/switchModel\('unit'\)/);
  assert.match(ui,/polymer-long-chain-preview\.js/);
  assert.match(ui,/detailViewer\?\.dispose\(\);detailViewer=null/);
  assert.match(long,/worker\?\.terminate\(\)/);
  assert.match(long,/createCollectionViewer\(/);
  assert.match(long,/compact:true,showGestureHint:true/);
  assert.match(worker,/createPolymerReferenceModel\(THREE,polymerId,units\)/);
  assert.match(viewer,/new THREE\.InstancedMesh\(sphere/);
  assert.match(viewer,/new THREE\.InstancedMesh\(cylinder/);
  assert.match(css,/\.polymer-thumbnail-staging\{width:160px;height:128px\}/);
});
