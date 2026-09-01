import assert from 'node:assert/strict';
import {createRun,stepRun,beginBurst,createFlight,moveFlight,angleDelta} from '../src/veil/engine.js';
import {createMap} from '../src/veil/map.js';
import {VEIL} from '../src/veil/config.js';
// Deterministic steering scenarios, not a substitute for human playtest ratings.
function follow(run,id,{novice=false,boost=false,onLap=()=>{}}={}){
 const route=run.map.routes.find(r=>r.id===id);let index=0,frames=0,fuel=0;
 while(frames++<60*110){
  const p=run.player,look=novice?130:75;
  while(index<route.points.length-1&&Math.hypot(route.points[index].x-p.x,route.points[index].y-p.y)<look)index++;
  const t=route.points[index],dx=t.x-p.x,dy=t.y-p.y,d=Math.hypot(dx,dy);if(index===route.points.length-1&&d<70)break;
  if(boost&&id==='risk'&&p.y<-1440&&p.y>-1950&&fuel<1){if(beginBurst(run,()=>true))fuel++;}
  let angle=Math.atan2(dy,dx)+(novice?Math.sin(run.time*2.1)*.24:0);
  for(const e of stepRun(run,{x:Math.cos(angle),y:Math.sin(angle)},1/60))if(e.type==='lap')onLap();
 }
 assert.ok(frames<60*110,`${id}: no trapping / endless correction`);return fuel;
}
function laps({novice=false,boost=false,seed=42}={}){
 const run=createRun(createMap(seed),VEIL,{fuel:{hydrogen:4},predators:false}),rows=[];let fuel=0;
 for(let lap=0;lap<3;lap++){
  const startH=run.collected,startTime=run.time,startFuel=fuel;
  for(const id of ['entry',boost?'risk':'safe','detour','return'])fuel+=follow(run,id,{novice,boost});
  rows.push({lap:lap+1,seconds:Math.round(run.time-startTime),H:run.collected-startH,bursts:fuel-startFuel});
 }
 assert.equal(run.laps,3);for(const row of rows){assert.ok(row.seconds>=50&&row.seconds<140);assert.ok(row.H>80&&row.H<420);}
 assert.ok(rows[2].H>rows[0].H*.8,'The third continuous lap must not run through unrespawned empty lines');
 return {novice,boost,rows,best:run.best};
}
const reports=[laps({novice:true}),laps(),laps({boost:true})];
for(const boosted of [false,true]){
 const turnRun=createRun({seed:1,dust:[],fields:[],labels:[],routes:[]},VEIL,{fuel:{hydrogen:1},predators:false}),p=turnRun.player;p.speed=VEIL.speed;p.vx=0;p.vy=-p.speed;if(boosted)assert.ok(beginBurst(turnRun,()=>true));let time=0;
 while(time<2&&Math.abs(angleDelta(p.angle,Math.PI/2))>.18){moveFlight(p,{x:0,y:1},1/60);time+=1/60;}
 assert.ok(time<.75,'Reverse must respond without a long U-turn');if(boosted)assert.ok(Math.hypot(p.x,p.y-VEIL.spawn.y)<170,'Boost countersteering must not throw player far from a line');
}
const drift=createFlight();for(let i=0;i<180;i++)moveFlight(drift,{x:0,y:0},1/60);assert.ok(drift.y<VEIL.spawn.y-60);assert.ok(drift.speed<=VEIL.driftSpeed+1);
// Strong hostile flow cannot reverse thrust. Cross the actual field at several phases.
for(const phase of [0,2,4,6]){const run=createRun(createMap(42),VEIL,{predators:false}),f=run.map.fields[0];Object.assign(run.player,{x:f.x+80,y:f.y,angle:Math.PI,speed:VEIL.speed});run.time=phase;for(let i=0;i<180;i++)stepRun(run,{x:-1,y:0},1/60);assert.ok(run.player.x<f.x-140,'A normal ship can cross against the current');}
console.log('Three continuous laps (simulated):',JSON.stringify(reports));console.log('Normal steering remains responsive; H₂ is exercised as a capped route action, not valued as a collection multiplier.');
