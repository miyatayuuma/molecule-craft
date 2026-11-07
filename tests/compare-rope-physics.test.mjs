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
  assert(physics.beadPosition(1).y<selected.y+55&&physics.beadPosition(3).y<selected.y+55,'tails remain a shallow arc rather than hanging vertically');
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

test('a sudden two-axis pull moves the entire strand without stretching an isolated bead',()=>{
  const arc=Array.from({length:24},(_,i)=>i*80);
  const physics=new ComparisonRopePhysics(arc,{width:390,height:400,center:arc[10]});
  const maxStretch=()=>Math.max(...physics.lengths.map((length,i)=>{
    const a=physics.points[i],b=physics.points[i+1];
    return Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-length)/length;
  }));
  for(let i=0;i<120;i++)physics.advance(1/60);
  const before=physics.beadPosition(9).x;
  const bead=physics.beadPosition(11);
  const targetX=bead.x+118,targetY=bead.y-95;
  physics.grab(11,targetX,targetY);
  assert(maxStretch()<0.025,`even an abrupt pull retains near-constant rope length (got ${maxStretch()})`);
  assert(physics.beadPosition(9).x>before+50,'neighbouring beads follow the hand instead of staying on a rigid rail');
  for(let i=0;i<25;i++)physics.advance(1/60);
  assert(maxStretch()<0.012,'settled held rope keeps its segment lengths');
  assert(Math.abs(physics.beadPosition(11).x-targetX)<1e-8&&Math.abs(physics.beadPosition(11).y-targetY)<1e-8,'the grabbed bead remains precisely under the hand');
  const heldX=physics.beadPosition(11).x;
  physics.release({vx:-350,vy:200});
  for(let i=0;i<65;i++)physics.advance(1/60);
  assert(maxStretch()<0.02,'after release the strand keeps its rest lengths');
  assert(Math.abs(physics.beadPosition(11).x-heldX)>20,'the strand continues gliding into its magnetic support after release');
});
