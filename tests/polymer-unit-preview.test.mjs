import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPolymerUnitLayout,hasPolymerUnitPreview} from '../src/polymer-unit-preview.js';
import {createPreviewModel} from '../src/preview-model.js';

const records=JSON.parse(await readFile(new URL('../data/polymers.json',import.meta.url),'utf8'));

test('all 25 polymer entries use actual 3D atom, bond and continuation data',()=>{
  assert.equal(records.length,25);
  for(const record of records){
    const {id}=record;
    assert.equal(hasPolymerUnitPreview(id),true,id);
    const layout=createPolymerUnitLayout(THREE,id);
    assert.ok(layout.atoms.length>=6,id);
    assert.ok(layout.bonds.length>0,id);
    assert.equal(layout.ports.length,record.topology==='network'?3:2,id);
    for(const atom of layout.atoms){
      assert.ok(['C','H','O','N','F','Cl'].includes(atom.element),id);
      assert.ok(atom.point.toArray().every(Number.isFinite),id);
    }
    for(const bond of layout.bonds){
      assert.ok(bond.a>=0&&bond.a<layout.atoms.length,id);
      assert.ok(bond.b>=0&&bond.b<layout.atoms.length,id);
      assert.ok([1,2,3].includes(bond.order),id);
    }
    for(const port of layout.ports){
      assert.ok(port.atom>=0&&port.atom<layout.atoms.length,id);
      assert.ok(port.start.distanceTo(layout.atoms[port.atom].point)<1e-8,id);
      assert.ok(port.point.distanceTo(port.start)>.1,id);
    }
    assert.ok(layout.aromaticCycles.every(cycle=>cycle.every(n=>n>=0&&n<layout.atoms.length)),id);
    if(record.topology==='copolymer'){
      assert.equal(layout.sourceUnits.length,2,id);
      assert.equal(layout.componentSequence.length,2,id);
      assert.notEqual(layout.componentSequence[0],layout.componentSequence[1],id);
    }
  }
  assert.ok(createPolymerUnitLayout(THREE,'polystyrene').aromaticCycles.length>=1);
  assert.ok(createPolymerUnitLayout(THREE,'phenol-formaldehyde-resin').aromaticCycles.length>=1);
  assert.deepEqual(createPolymerUnitLayout(THREE,'butyl-rubber').componentSequence.sort(),['polyisobutylene','polyisoprene']);
  assert.equal(hasPolymerUnitPreview('not-a-polymer'),false);
  assert.throws(()=>createPolymerUnitLayout(THREE,'not-a-polymer'),/Unsupported/);
});

test('Collection keeps list snapshots fixed and moves interactive viewer to detail',async()=>{
  const ui=await readFile(new URL('../src/collection-ui.js',import.meta.url),'utf8');
  assert.match(ui,/polymerThumbnailCache/);
  assert.match(ui,/onThumbnail:data=>finish\(data\)/);
  assert.match(ui,/module\.mountPolymerUnitPreview/);
  assert.doesNotMatch(ui,/assets\/models\/polymer-\$\{id\}\.svg/);
  assert.doesNotMatch(ui,/polymer-detail-visual/);
});

test('PET terminal continuation points out from the phenyl ring without changing its atom graph',()=>{
  const layout=createPolymerUnitLayout(THREE,'polyethylene-terephthalate');
  const ring=layout.aromaticCycles[0];
  assert.equal(layout.ports.length,2);
  for(const port of layout.ports){
    const minimum=Math.min(...ring.map(id=>port.point.distanceTo(layout.atoms[id].point)));
    assert.ok(minimum>1.5,`PET continuation crosses aromatic ring: ${minimum}`);
  }
  const left=layout.ports.find(port=>layout.atoms[port.atom].element==='O');
  assert.ok(left);
  const bond=layout.bonds.find(item=>item.a===left.atom||item.b===left.atom);
  const inside=layout.atoms[bond.a===left.atom?bond.b:bond.a].point.clone().sub(left.start).normalize();
  const continuation=left.point.clone().sub(left.start).normalize();
  const angle=inside.angleTo(continuation)*180/Math.PI;
  assert.ok(Math.abs(angle-116)<.01,`PET ester oxygen angle: ${angle}`);
  assert.ok(layout.ports[0].point.distanceTo(layout.ports[1].point)>3.7,'PET local chain must open outward');
});

test('carbonyl part has two planar attachment markers at trigonal 120-degree angles',()=>{
  const carbonyl={id:'carbonyl',atoms:['C','O'],bonds:[[0,1,2]],attachments:[{atom:0,order:1,slots:2}]};
  const model=createPreviewModel(THREE,carbonyl);
  for(let i=0;i<220;i++)model.step();
  const layout=model.snapshot();
  assert.equal(layout.ports.length,2);
  const origin=layout.atoms[0].point;
  const oxygen=layout.atoms[1].point.clone().sub(origin).normalize();
  const directions=layout.ports.map(port=>port.point.clone().sub(origin).normalize());
  for(const direction of directions)assert.ok(Math.abs(oxygen.dot(direction)+.5)<.001);
  assert.ok(Math.abs(directions[0].dot(directions[1])+.5)<.001);
});
