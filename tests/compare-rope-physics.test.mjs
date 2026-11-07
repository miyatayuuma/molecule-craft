import assert from 'node:assert/strict';
import test from 'node:test';
import {ComparisonRopePhysics,ROPE_SUBDIVISIONS} from '../src/compare-rope-physics.js';

test('only the focused bead remains on the support as the strand floats',()=>{
  const arc=[0,78,156,237,320],physics=new ComparisonRopePhysics(arc,{width:390,height:400,center:156});
  assert.equal(physics.count,(arc.length-1)*ROPE_SUBDIVISIONS+1);
  assert.equal(physics.lengths[0],(arc[1]-arc[0])*2/ROPE_SUBDIVISIONS,'the strand has twice the available rope per bead interval');
  for(let i=0;i<220;i++)physics.advance(1/60);
  const selected=physics.beadPosition(2);
  assert(Math.abs(selected.x-195)<1&&Math.abs(selected.y-172)<1,'central bead stays on the support');
  assert(physics.beadPosition(1).x<selected.x-60,'left strand fans out across the stage');
  assert(physics.beadPosition(3).x>selected.x+60,'right strand fans out across the stage');
  assert(physics.beadPosition(1).y<physics.height+20&&physics.beadPosition(3).y<physics.height+20,'nearby beads remain inside the drifting stage band');
  physics.grab(3,275,92);
  for(let i=0;i<30;i++)physics.advance(1/60);
  assert(Math.hypot(physics.beadPosition(3).x-275,physics.beadPosition(3).y-92)<20,'a free bead follows the hand without breaking its tether to the anchored bead');
  const grabbed={...physics.beadPosition(3)};
  physics.release();for(let i=0;i<60;i++)physics.advance(1/60);
  assert(Math.hypot(physics.beadPosition(3).x-grabbed.x,physics.beadPosition(3).y-grabbed.y)>15,'released rope is no longer locked to the pointer');
  const before=physics.beadPosition(3).y;
  physics.setCenter(183);for(let i=0;i<220;i++)physics.advance(1/60);
  assert(Math.abs(physics.beadPosition(3).y-before)>4,'pulling changes the suspended geometry');
  assert(physics.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)));
});

test('floating beads have irregular separations and independent motion without positional slots',()=>{
  const arc=Array.from({length:24},(_,index)=>index*80);
  const rope=new ComparisonRopePhysics(arc,{width:390,height:400,center:arc[10]});
  const near=Array.from({length:11},(_,index)=>index+5);
  const snapshot=()=>near.map(index=>({...rope.beadPosition(index)}));
  const before=snapshot();
  for(let frame=0;frame<160;frame++)rope.advance(1/60);
  const after=snapshot();
  const gaps=after.slice(1).map((p,i)=>Math.hypot(p.x-after[i].x,p.y-after[i].y));
  assert(Math.max(...gaps)-Math.min(...gaps)>45,'beads do not arrange into equal-distance slots');
  const centre=rope.beadPosition(10);
  assert.equal(centre.x,rope.x);assert.equal(centre.y,rope.y,'the focused bead alone is fixed exactly to the pedestal');
  const moved=[9,11].map(index=>Math.hypot(after[index-5].x-before[index-5].x,after[index-5].y-before[index-5].y));
  assert(moved.every(distance=>distance>5),'both free sides continue drifting even without pointer input');
  const relative=after.map((point,i)=>[point.x-before[i].x,point.y-before[i].y]);
  assert(Math.hypot(relative[4][0]-relative[6][0],relative[4][1]-relative[6][1])>5,'neighbouring beads are not moved by a shared translation');
});

test('a pulled bead transmits flexible motion through the strand instead of moving every bead rigidly',()=>{
  const arc=Array.from({length:24},(_,i)=>i*80);
  const physics=new ComparisonRopePhysics(arc,{width:390,height:400,center:arc[10]});
  const maxStretch=()=>Math.max(...physics.lengths.map((length,i)=>{
    const a=physics.points[i],b=physics.points[i+1];
    return Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-length)/length;
  }));
  for(let i=0;i<120;i++)physics.advance(1/60);
  const before=physics.beadPosition(13).x,nearBefore=physics.beadPosition(12).x;
  const bead=physics.beadPosition(11);
  const heldBefore=bead.x;
  const targetX=bead.x-100,targetY=bead.y-80;
  physics.grab(11,targetX,targetY);
  assert(Math.abs(physics.beadPosition(13).x-before)<1e-8,'the far rope is never teleported during pointer input');
  for(let i=0;i<6;i++)physics.advance(1/60);
  const heldTravel=physics.beadPosition(11).x-heldBefore;
  const nearTravel=physics.beadPosition(12).x-nearBefore;
  const farTravel=physics.beadPosition(13).x-before;
  assert(heldTravel< -65&&nearTravel< -15&&Math.abs(farTravel)<Math.abs(nearTravel),'motion propagates from the held bead to neighbours with spatial lag');
  assert.equal(physics.beadPosition(10).x,physics.x);assert.equal(physics.beadPosition(10).y,physics.y,'the focused pedestal bead stays fixed while another bead is pulled');
  assert(maxStretch()<0.02,'rope length remains constrained during a moving wave');
  for(let i=0;i<20;i++)physics.advance(1/60);
  assert(maxStretch()<0.02,'held rope keeps its segment lengths while settling');
  assert(Math.hypot(physics.beadPosition(11).x-targetX,physics.beadPosition(11).y-targetY)<5,'the held bead catches up to the reachable pointer without dragging the chain rigidly');
  const heldX=physics.beadPosition(11).x;
  physics.release({vx:-350,vy:200});
  for(let i=0;i<65;i++)physics.advance(1/60);
  assert(maxStretch()<0.02,'after release the strand keeps its rest lengths');
  assert(Math.abs(physics.beadPosition(11).x-heldX)>10,'the strand continues moving under its own inertia after release');
});

test('a released bead eases into the socket while neighbouring beads stay apart',()=>{
  const arc=Array.from({length:18},(_,i)=>i*80);
  const rope=new ComparisonRopePhysics(arc,{width:390,height:400,center:arc[5]});
  for(let i=0;i<160;i++)rope.advance(1/60);
  rope.grab(6,330,110);for(let i=0;i<8;i++)rope.advance(1/60);rope.release();rope.dock(6);
  const separation=()=>Math.hypot(rope.beadPosition(6).x-rope.x,rope.beadPosition(6).y-rope.y);
  const firstDistance=separation();
  assert(firstDistance>90,'the selected bead starts away from the socket');
  assert.equal(rope.completedDock,null,'the reading does not change immediately at release');
  let maxStretch=0,completedAt=-1;
  for(let frame=0;frame<250;frame++){
    rope.advance(1/90);
    for(let i=0;i<rope.lengths.length;i++){
      const a=rope.points[i],b=rope.points[i+1];
      maxStretch=Math.max(maxStretch,Math.abs(Math.hypot(a.x-b.x,a.y-b.y)/rope.lengths[i]-1));
    }
    if(frame===4)assert(separation()<firstDistance-8&&separation()>15,'the bead approaches over multiple frames without teleporting');
    if(rope.completedDock!==null){completedAt=frame;break;}
  }
  assert(completedAt>=15&&completedAt<240,'the dock completes after visible settling');
  assert(separation()<11,'the nominated bead is at the socket before the reading changes');
  assert(maxStretch<0.03,`the moving rope maintains a near-fixed rest length (max relative error ${maxStretch})`);
  const neighbours=[5,7].map(index=>Math.hypot(rope.beadPosition(index).x-rope.x,rope.beadPosition(index).y-rope.y));
  assert(neighbours.every(distance=>distance>45),'non-selected beads do not stack on the socket');
  rope.grab(7,260,155);
  assert.equal(rope.completedDock,null,'new manipulation clears the previous docking result');
});
