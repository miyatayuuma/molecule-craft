import assert from 'node:assert/strict';
import {createRun,stepRun,beginBoost,createFlight,moveFlight,angleDelta} from '../src/veil/engine.js';
import {createMap} from '../src/veil/map.js';
import {VEIL} from '../src/veil/config.js';
// Deterministic steering scenarios, not a substitute for human playtest ratings.
function follow(run,id,{novice=false,boost=false,onLap=()=>{}}={}){
 const route=run.map.routes.find(r=>r.id===id);let index=0,frames=0,fuel=0;
 while(frames++<60*110){
  const p=run.player,look=novice?130:75;
  while(index<route.points.length-1&&Math.hypot(route.points[index].x-p.x,route.points[index].y-p.y)<look)index++;
  const t=route.points[index],dx=t.x-p.x,dy=t.y-p.y,d=Math.hypot(dx,dy);if(index===route.points.length-1&&d<70)break;
  if(boost&&id==='risk'&&p.y<-1440&&p.y>-1950&&fuel<1){if(beginBoost(p,()=>true))fuel++;}
  let angle=Math.atan2(dy,dx)+(novice?Math.sin(run.time*2.1)*.24:0);
  for(const e of stepRun(run,{x:Math.cos(angle),y:Math.sin(angle)},1/60))if(e.type==='lap')onLap();
 }
 assert.ok(frames<60*110,`${id}: no trapping / endless correction`);return fuel;
}
function laps({novice=false,boost=false,seed=42}={}){
 const run=createRun(createMap(seed)),rows=[];let fuel=0;
 for(let lap=0;lap<3;lap++){
  const startH=run.collected,startTime=run.time,startFuel=fuel;
  for(const id of ['entry',boost?'risk':'safe','detour','return'])fuel+=follow(run,id,{novice,boost});
  rows.push({lap:lap+1,seconds:Math.round(run.time-startTime),H:run.collected-startH,netH:run.collected-startH-(fuel-startFuel)*2});
 }
 assert.equal(run.laps,3);for(const row of rows){assert.ok(row.seconds>=50&&row.seconds<140);assert.ok(row.H>80&&row.H<420);}
 assert.ok(rows[2].H>rows[0].H*.8,'The third continuous lap must not run through unrespawned empty lines');
 return {novice,boost,rows,best:run.best};
}
const reports=[laps({novice:true}),laps(),laps({boost:true})];
// Same location, same six-second budget; fuel is deducted from the resulting H.
function sweep(boost){const run=createRun(createMap(42)),route=run.map.routes.find(r=>r.id==='risk');Object.assign(run.player,route.points[15],{speed:VEIL.speed});let index=15,fuel=0;
 for(let f=0;f<360;f++){const p=run.player;while(index<route.points.length-1&&Math.hypot(p.x-route.points[index].x,p.y-route.points[index].y)<75)index++;const t=route.points[index],a=Math.atan2(t.y-p.y,t.x-p.x);if(boost&&f===80){beginBoost(p,()=>true);fuel++;}stepRun(run,{x:Math.cos(a),y:Math.sin(a)},1/60);}
 return {H:run.collected,netH:run.collected-fuel*2,best:run.best};}
const normal=sweep(false),boosted=sweep(true);assert.ok(boosted.netH>normal.netH*1.3,'Boost must improve gathering after paying for H₂');
for(const boosted of [false,true]){
 const p=createFlight();p.speed=boosted?VEIL.boostSpeed:VEIL.speed;p.vx=0;p.vy=-p.speed;if(boosted)p.boost=2;let time=0;
 while(time<2&&Math.abs(angleDelta(p.angle,Math.PI/2))>.18){moveFlight(p,{x:0,y:1},1/60);time+=1/60;}
 assert.ok(time<.75,'Reverse must respond without a long U-turn');if(boosted)assert.ok(Math.hypot(p.x,p.y-VEIL.spawn.y)<170,'Boost countersteering must not throw player far from a line');
}
const drift=createFlight();for(let i=0;i<180;i++)moveFlight(drift,{x:0,y:0},1/60);assert.ok(drift.y<VEIL.spawn.y-60);assert.ok(drift.speed<=VEIL.driftSpeed+1);
// Strong hostile flow cannot reverse thrust. Cross the actual field at several phases.
for(const phase of [0,2,4,6]){const run=createRun(createMap(42)),f=run.map.fields[0];Object.assign(run.player,{x:f.x+80,y:f.y,angle:Math.PI,speed:VEIL.speed});run.time=phase;for(let i=0;i<180;i++)stepRun(run,{x:-1,y:0},1/60);assert.ok(run.player.x<f.x-140,'A normal ship can cross against the current');}
console.log('Three continuous laps (simulated):',JSON.stringify(reports));console.log('Same six-second density sweep:',JSON.stringify({normal,boosted}));
