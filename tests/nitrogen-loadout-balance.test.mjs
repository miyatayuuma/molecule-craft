import assert from 'node:assert/strict';
import {ROLE_BALANCE_VERSION,performanceFor} from '../src/veil/molecule-roles.js';
import {burstDriveFor,flightConfig} from '../src/veil/growth.js';
import {createRun,setCombustionHeld,stepRun} from '../src/veil/engine.js';
import {createUniverse} from '../src/veil/universe.js';
import {NITROGEN_CORE,NITROGEN_ROUTE} from '../src/veil/nitrogen-routes.js';

assert.equal(ROLE_BALANCE_VERSION,4);assert.ok(burstDriveFor('hydrogen').boostSpeed>burstDriveFor('ammonia').boostSpeed&&burstDriveFor('ammonia').boostSpeed>burstDriveFor('nitrogen').boostSpeed);
function deepRun(fuelId,oxygenAmount,{limit=115}={}){
  const config=flightConfig({progress:{choCompleted:true},elements:{N:0}}),profile=performanceFor(fuelId,'fuel'),fuel={fuel:{molecule:fuelId,amount:profile.capacity,capacity:profile.capacity},oxidizer:{molecule:'oxygen',amount:oxygenAmount,capacity:oxygenAmount},coolant:{molecule:'water',amount:80,capacity:80}},map=createUniverse(41,{H:0,C:0,N:0,O:0},{capabilities:{combustionDrive:true,nitrogenField:true}}),run=createRun(map,config,{fuel,predators:false}),points=NITROGEN_ROUTE.points,systems={consumeCombustion:()=>true,consumeCoolant:()=>true};
  const start=points[0];Object.assign(run.player,{x:start.x,y:start.y,angle:start.angle,vx:0,vy:0,speed:config.driftSpeed});run.region='nitrogen';setCombustionHeld(run,true);let targetIndex=2,coreReached=false,driveSeconds=0;
  while(run.time<limit){const target=points[Math.min(points.length-1,targetIndex)],dx=target.x-run.player.x,dy=target.y-run.player.y,distance=Math.hypot(dx,dy)||1;if(distance<90&&targetIndex<points.length-1)targetIndex=Math.min(points.length-1,targetIndex+2);const before=run.time;stepRun(run,{x:dx/distance,y:dy/distance},1/30,systems);if(run.player.combustion)driveSeconds+=run.time-before;if(Math.hypot(run.player.x-NITROGEN_CORE.x,run.player.y-NITROGEN_CORE.y)<NITROGEN_CORE.fractureRadius){coreReached=true;break;}}
  return {coreReached,time:+run.time.toFixed(2),fuelRemaining:+run.fuel.fuel.amount.toFixed(2),oxygenRemaining:+run.fuel.oxidizer.amount.toFixed(2),driveSeconds:+driveSeconds.toFixed(2)};
}
const comfortable=deepRun('ethane',72),hard=deepRun('ethane',48),baseline=deepRun('methane',36);
assert.equal(comfortable.coreReached,true);assert.equal(hard.coreReached,true);assert.ok(comfortable.oxygenRemaining>hard.oxygenRemaining);assert.ok(comfortable.oxygenRemaining>0);assert.ok(baseline.time>=hard.time||baseline.oxygenRemaining<=hard.oxygenRemaining);assert.ok(!baseline.coreReached||baseline.oxygenRemaining<8);
console.log('Deep Nitrogen LOADOUT balance',JSON.stringify({comfortable,hard,baseline}));
