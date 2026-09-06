import test from 'node:test';
import assert from 'node:assert/strict';
import { createUniverse } from '../src/veil/universe.js';
import { inventoryDepletion } from '../src/veil/map.js';

const count=(map,element)=>map.dust.filter(d=>d.element===element).length;

test('inventory depletion leaves early stock untouched and ramps smoothly',()=>{
  assert.equal(inventoryDepletion({H:0},'H'),0);
  assert.equal(inventoryDepletion({H:80},'H'),0);
  assert.equal(inventoryDepletion({C:40},'C'),0);
  assert.equal(inventoryDepletion({O:40},'O'),0);
  assert.ok(inventoryDepletion({H:440},'H')>0);
  assert.equal(inventoryDepletion({H:800},'H'),1);
  assert.equal(inventoryDepletion({C:400},'C'),1);
  assert.equal(inventoryDepletion({O:400},'O'),1);
});

test('high base stock reduces the matching exploration distribution',()=>{
  const seed=0x514e7,base=createUniverse(seed,{H:0,C:0,O:0});
  const hRich=createUniverse(seed,{H:800,C:0,O:0});
  const cRich=createUniverse(seed,{H:0,C:400,O:0});
  const oRich=createUniverse(seed,{H:0,C:0,O:400});
  assert.ok(count(hRich,'H')<count(base,'H'),'H-rich stock should thin H particles');
  assert.ok(count(cRich,'C')<count(base,'C'),'C-rich stock should thin C particles');
  assert.ok(count(oRich,'O')<count(base,'O'),'O-rich stock should thin O particles');
  assert.ok(count(hRich,'H')>0&&count(cRich,'C')>0&&count(oRich,'O')>0,'depletion must keep a harvestable floor');
});

test('depletion collapses lanes and optional branches without removing route geometry',()=>{
  const seed=0x21c0de,base=createUniverse(seed,{H:0,C:0,O:0}),rich=createUniverse(seed,{H:800,C:400,O:400});
  assert.deepEqual(rich.routes.map(r=>r.id),base.routes.map(r=>r.id),'navigation geometry stays stable');
  assert.ok(rich.dust.length<base.dust.length,'rich inventory should visibly reduce total dust');
  assert.equal(rich.dust.some(d=>d.route==='carbon-sweep'),false,'depleted optional carbon branch should lose its particles');
  assert.equal(rich.dust.some(d=>d.route==='oxygen-side'),false,'depleted optional oxygen branch should lose its particles');
  assert.equal(rich.dust.some(d=>d.route==='technical'&&d.kind!=='rare'),false,'depleted optional H branch should lose normal particles');
});

test('the same seed and stock produce the same depleted field',()=>{
  const stock={H:520,C:260,O:190},a=createUniverse(123456,stock),b=createUniverse(123456,stock);
  const signature=map=>map.dust.map(({route,element,x,y,kind})=>[route,element,x,y,kind]);
  assert.deepEqual(signature(a),signature(b));
});
