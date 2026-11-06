import assert from 'node:assert/strict';
import test from 'node:test';
import {ComparisonRopePhysics,ROPE_SUBDIVISIONS} from '../src/compare-rope-physics.js';

test('the flexible rope spreads sideways, swings freely and returns to the analyser',()=>{
  const arc=[0,78,156,237,320],physics=new ComparisonRopePhysics(arc,{width:390,height:400,center:156});
  assert.equal(physics.count,(arc.length-1)*ROPE_SUBDIVISIONS+1);
  for(let i=0;i<220;i++)physics.advance(1/60);
  const selected=physics.beadPosition(2);
  assert(Math.abs(selected.x-195)<1&&Math.abs(selected.y-172)<1,'central bead stays on the support');
  assert(physics.beadPosition(1).x<selected.x-60,'left strand fans out across the stage');
  assert(physics.beadPosition(3).x>selected.x+60,'right strand fans out across the stage');
  assert(physics.beadPosition(1).y<selected.y+40&&physics.beadPosition(3).y<selected.y+40,'tails do not hang vertically');
  physics.grab(3,275,92);
  for(let i=0;i<30;i++)physics.advance(1/60);
  assert(Math.abs(physics.beadPosition(3).x-275)<1&&Math.abs(physics.beadPosition(3).y-92)<1,'bead can be displaced freely in two dimensions');
  physics.release();for(let i=0;i<60;i++)physics.advance(1/60);
  assert(physics.beadPosition(3).y>145,'released rope is no longer locked to the pointer');
  const before=physics.beadPosition(3).y;
  physics.setCenter(183);for(let i=0;i<220;i++)physics.advance(1/60);
  assert(Math.abs(physics.beadPosition(3).y-before)>4,'pulling changes the suspended geometry');
  assert(physics.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)));
});
