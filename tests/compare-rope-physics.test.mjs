import assert from 'node:assert/strict';
import test from 'node:test';
import {ComparisonRopePhysics,ROPE_SUBDIVISIONS} from '../src/compare-rope-physics.js';

test('beads are supported by a continuous gravity-constrained rope',()=>{
  const arc=[0,78,156,237,320],physics=new ComparisonRopePhysics(arc,{width:390,height:400,center:156});
  assert.equal(physics.count,(arc.length-1)*ROPE_SUBDIVISIONS+1);
  for(let i=0;i<220;i++)physics.advance(1/60);
  const selected=physics.beadPosition(2);
  assert(Math.abs(selected.x-195)<1&&Math.abs(selected.y-172)<1,'central bead stays on the support');
  assert(physics.beadPosition(1).y>selected.y+45,'left strand descends under gravity');
  assert(physics.beadPosition(3).y>selected.y+45,'right strand descends under gravity');
  const before=physics.beadPosition(3).y;
  physics.setCenter(183);for(let i=0;i<220;i++)physics.advance(1/60);
  assert(Math.abs(physics.beadPosition(3).y-before)>4,'pulling changes the suspended geometry');
  assert(physics.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)));
});
