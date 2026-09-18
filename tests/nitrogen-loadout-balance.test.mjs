import assert from 'node:assert/strict';
import {ROLE_BALANCE_VERSION,performanceFor} from '../src/veil/molecule-roles.js';
import {burstDriveFor,flightConfig} from '../src/veil/growth.js';
import {createRun,setCombustionHeld,stepRun} from '../src/veil/engine.js';
import {createUniverse} from '../src/veil/universe.js';
import {NITROGEN_CORE,NITROGEN_ROUTE} from '../src/veil/nitrogen-routes.js';

assert.equal(ROLE_BALANCE_VERSION,4);
assert.ok(burstDriveFor('hydrogen').boostSpeed>burstDriveFor('ammonia').boostSpeed&&burstDriveFor('ammonia').boostSpeed>burstDriveFor('nitrogen').boostSpeed);

const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function deepRoundTrip(fuelId,oxygenAmount,{limit=110}={}){
  const config=flightConfig({progress:{choCompleted:true},elements:{N:0}}),profile=performanceFor(fuelId,'fuel'),fuel={fuel:{molecule:fuelId,amount:profile.capacity,capacity:profile.capacity},oxidizer:{molecule:'oxygen',amount:oxygenAmount,capacity:oxygenAmount},coolant:{molecule:'water',amount:80,capacity:80}},map=createUniverse(41,{H:0,C:0,N:0,O:0},{capabilities:{combustionDrive:true,nitrogenField:true}}),run=createRun(map,config,{fuel,predators:false}),points=NITROGEN_ROUTE.points,systems={consumeCombustion:()=>true,consumeCoolant:()=>true};
  const entry=points[0],coreIndex=points.reduce((best,point,index)=>dist(point,NITROGEN_CORE)<best.distance?{index,distance:dist(point,NITROGEN_CORE)}:best,{index:0,distance:Infinity}).index;
  Object.assign(run.player,{x:entry.x,y:entry.y,angle:entry.angle,vx:0,vy:0,speed:config.driftSpeed});run.region='nitrogen';setCombustionHeld(run,true);
  let targetIndex=2,coreReached=false,returning=false,returned=false,driveSeconds=0,driveDepletedBeforeReturn=false;
  while(run.time<limit){
    const target=points[Math.max(0,Math.min(coreIndex,targetIndex))],dx=target.x-run.player.x,dy=target.y-run.player.y,distance=Math.hypot(dx,dy)||1;
    if(distance<90){
      if(returning)targetIndex=Math.max(0,targetIndex-2);
      else targetIndex=Math.min(coreIndex,targetIndex+2);
    }
    const before=run.time;stepRun(run,{x:dx/distance,y:dy/distance},1/30,systems);if(run.player.combustion)driveSeconds+=run.time-before;
    if(!coreReached&&dist(run.player,NITROGEN_CORE)<NITROGEN_CORE.fractureRadius){coreReached=true;returning=true;targetIndex=Math.max(0,coreIndex-2);}
    if(returning&&(run.fuel.fuel.amount<1||run.fuel.oxidizer.amount<profile.oxygenPerFuel))driveDepletedBeforeReturn=true;
    if(returning&&targetIndex===0&&dist(run.player,entry)<155){returned=true;break;}
  }
  return {coreReached,returned,time:+run.time.toFixed(2),fuelRemaining:+run.fuel.fuel.amount.toFixed(2),oxygenRemaining:+run.fuel.oxidizer.amount.toFixed(2),driveSeconds:+driveSeconds.toFixed(2),driveDepletedBeforeReturn};
}

const comfortable=deepRoundTrip('ethane',72),hard=deepRoundTrip('ethane',48),baseline=deepRoundTrip('methane',36);
console.log('Deep Nitrogen LOADOUT balance',JSON.stringify({comfortable,hard,baseline}));
assert.equal(comfortable.coreReached,true);assert.equal(comfortable.returned,true,'advanced fuel + O2 72 must make the Core round trip comfortably');
assert.equal(hard.coreReached,true);assert.equal(hard.returned,true,'advanced fuel + O2 48 must remain a hard but viable round trip');
assert.ok(comfortable.oxygenRemaining>hard.oxygenRemaining&&comfortable.oxygenRemaining>=12,'72 O2 must retain material return margin instead of being a stage tax');
assert.ok(hard.oxygenRemaining>0,'48 O2 must retain a small skillful margin rather than become a hard gate');
assert.equal(baseline.coreReached,true,'methane + O2 36 remains theoretically able to reach Core');
assert.equal(baseline.driveDepletedBeforeReturn,true,'methane + O2 36 must exhaust sustained DRIVE before the round trip is complete');
assert.ok(!baseline.returned||baseline.time>hard.time,'baseline methane must be materially worse than the advanced 48-O2 solution without becoming a geometry hard lock');
