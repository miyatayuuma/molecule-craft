import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLE_BALANCE_VERSION,performanceFor} from '../src/veil/molecule-roles.js';
import {burstDriveFor,flightConfig} from '../src/veil/growth.js';
import {createRun,beginBurst,setCombustionHeld,stepRun} from '../src/veil/expedition-run.js';
import {createUniverse} from '../src/veil/universe.js';
import {
  NITROGEN_CORE,NITROGEN_PULSE_FIELD,NITROGEN_RECOVERY_AREAS,NITROGEN_ROUTE,NITROGEN_SIDE_ROUTE,
} from '../src/veil/nitrogen-routes.js';

assert.equal(ROLE_BALANCE_VERSION,4);
assert.ok(burstDriveFor('hydrogen').boostSpeed>burstDriveFor('ammonia').boostSpeed&&burstDriveFor('ammonia').boostSpeed>burstDriveFor('nitrogen').boostSpeed);

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function traverse({fuelId='methane',propellant='hydrogen',oxygen=36,coolant='water',fps=30,burst=true,drive=true,noPulseOffset=0,driveFlank=0,side=false,maxTime=70}={}){
  const config=flightConfig({progress:{choCompleted:true},elements:{N:0}}),fuel={
    fuel:{molecule:fuelId,amount:performanceFor(fuelId,'fuel').capacity},
    propellant:{molecule:propellant,amount:performanceFor(propellant,'propellant').capacity},
    oxidizer:{molecule:'oxygen',amount:oxygen},
    ...(coolant?{coolant:{molecule:coolant,amount:performanceFor(coolant,'coolant').capacity}}:{}),
  };
  const map=createUniverse(41,{H:0,C:0,N:0,O:0},{capabilities:{combustionDrive:true,nitrogenField:true}}),run=createRun(map,config,{fuel,predators:false});let points=NITROGEN_ROUTE.points;
  if(side){const junction=points.findIndex(point=>point.waypointIndex===4),rejoin=points.findIndex(point=>point.waypointIndex===5);points=[...points.slice(0,junction+1),...NITROGEN_SIDE_ROUTE.points.slice(1),...points.slice(rejoin+1)];}
  Object.assign(run.player,{x:points[0].x,y:points[0].y,vx:0,vy:0,speed:config.driftSpeed});run.region='nitrogen';
  let targetIndex=2,driveSeconds=0,pulseUses=0,overheatEvents=0,pressureExposure=0,channelSeconds=0,sideVisited=false,regroupVisited=false,recoveryCoast=0;
  const systems={consumeCombustion:()=>true,consumeCoolant:()=>true};
  while(run.time<maxTime){
    let target=points[Math.min(targetIndex,points.length-1)];
    if(driveFlank&&target.y< -13500&&target.y> -15100){const t=Math.max(0,Math.min(1,(-target.y-13500)/1600));target={...target,x:target.x-driveFlank*t};}
    if(noPulseOffset&&target.y< -15850&&target.y> -16600){const t=Math.max(0,Math.min(1,(-target.y-15850)/750)),smooth=t*t*(3-2*t);target={...target,x:target.x-noPulseOffset*smooth};}
    const dx=target.x-run.player.x,dy=target.y-run.player.y,remaining=Math.hypot(dx,dy)||1;
    if(remaining<85&&targetIndex<points.length-1)targetIndex=Math.min(points.length-1,targetIndex+2);
    if(burst&&pulseUses===0&&distance(run.player,NITROGEN_PULSE_FIELD)<360&&run.player.boost<=0&&run.player.cooldown<=0&&beginBurst(run,()=>true))pulseUses++;
    const atRecovery=distance(run.player,NITROGEN_RECOVERY_AREAS[0])<NITROGEN_RECOVERY_AREAS[0].radius;
    const atRegroup=distance(run.player,NITROGEN_RECOVERY_AREAS[1])<NITROGEN_RECOVERY_AREAS[1].radius;
    if(atRecovery)sideVisited=true;if(atRegroup)regroupVisited=true;
    const shouldDrive=drive&&((run.player.y< -13400&&run.player.y> -15100)||run.player.y< -17100);
    setCombustionHeld(run,shouldDrive&&!(atRecovery||atRegroup));
    const oldTime=run.time,events=stepRun(run,{x:dx/remaining,y:dy/remaining},1/fps,systems),dt=run.time-oldTime;
    if(run.player.combustion)driveSeconds+=dt;
    if((atRecovery||atRegroup)&&!run.player.combustion)recoveryCoast+=dt;
    if(events.some(event=>event.type==='overheat'))overheatEvents++;
    if(run.player.y< -13400&&run.player.y> -15100){channelSeconds+=dt;pressureExposure+=dt*Math.max(0,...run.currentHazards.filter(item=>item.id?.startsWith('nitrogen-drive-pressure-')).map(item=>Number(item.effectiveIntensity??item.intensity)||0));}
    if(distance(run.player,NITROGEN_CORE)<=NITROGEN_CORE.fractureRadius)break;
  }
  return {reached:distance(run.player,NITROGEN_CORE)<=NITROGEN_CORE.fractureRadius,time:run.time,finalY:run.player.y,driveSeconds,fuelUsed:fuel.fuel.amount-run.fuel.fuel.amount,oxidizerUsed:oxygen-run.fuel.oxidizer.amount,fuelRemaining:run.fuel.fuel.amount,oxygenRemaining:run.fuel.oxidizer.amount,waterUsed:coolant?fuel.coolant.amount-run.fuel.coolant.amount:0,waterRemaining:run.fuel.coolant?.amount??0,propellantUsed:fuel.propellant.amount-run.fuel.propellant.amount,propellantRemaining:run.fuel.propellant.amount,driveBuffer:run.driveBuffer,pulseUses,overheatEvents,pressureExposure,channelSeconds,sideVisited,regroupVisited,recoveryCoast};
}

test('Baseline, mid and late LOADOUTs reach the Core within the compact FIELD run budget',()=>{
  const baseline30=traverse({fps:30}),baseline60=traverse({fps:60}),mid=traverse({fuelId:'ethane',oxygen:48,fps:30}),late=traverse({fuelId:'n-hexane',oxygen:72,coolant:'ethylene-glycol',propellant:'ammonia',fps:30});
  for(const [name,result]of Object.entries({baseline30,baseline60,mid,late})){assert.equal(result.reached,true,`${name} must reach Nitrogen Core`);assert.ok(result.time>=27&&result.time<=34,`${name} took ${result.time.toFixed(2)} s`);}
  assert.ok(Math.abs(baseline30.time-baseline60.time)<.3,'30fps and 60fps movement agree within one simulation frame');
  assert.ok(baseline30.driveSeconds>=12&&baseline30.driveSeconds<=16);assert.ok(baseline30.fuelUsed>=6&&baseline30.fuelUsed<=8);assert.equal(baseline30.oxidizerUsed,14);assert.ok(baseline30.waterUsed>=6&&baseline30.waterUsed<=10);assert.equal(baseline30.pulseUses,1);assert.ok(baseline30.oxygenRemaining>=20);assert.ok(baseline30.propellantRemaining>=80,'the baseline retains two H₂ BURST uses after one pulse crossing');
  assert.ok(mid.fuelUsed===4&&mid.oxidizerUsed===14&&mid.oxygenRemaining>=32,'ethane/O₂ 48 keeps a larger reserve');
  assert.ok(late.fuelUsed===2&&late.oxidizerUsed===19&&late.oxygenRemaining>=50,'n-hexane/O₂ 72 is optional reserve and error margin');
  console.log('Compact Nitrogen LOADOUT simulations',JSON.stringify({baseline30:{time:+baseline30.time.toFixed(2),drive:+baseline30.driveSeconds.toFixed(2),fuel:baseline30.fuelUsed,O2:baseline30.oxidizerUsed,water:baseline30.waterUsed,reserveO2:baseline30.oxygenRemaining,H2:baseline30.propellantRemaining},baseline60:{time:+baseline60.time.toFixed(2),drive:+baseline60.driveSeconds.toFixed(2)},mid:{time:+mid.time.toFixed(2),fuel:mid.fuelUsed,O2:mid.oxidizerUsed,reserveO2:mid.oxygenRemaining},late:{time:+late.time.toFixed(2),fuel:late.fuelUsed,O2:late.oxidizerUsed,reserveO2:late.oxygenRemaining}}));
});

test('The deliberate H₂ PULSE is faster than a deterministic zero-PULSE flank fallback',()=>{
  const pulse=traverse({fps:30}),fallback30=traverse({fps:30,burst:false,noPulseOffset:620}),fallback60=traverse({fps:60,burst:false,noPulseOffset:620});
  assert.equal(pulse.reached,true);assert.equal(fallback30.reached,true);assert.equal(fallback60.reached,true);assert.equal(fallback30.pulseUses,0);assert.equal(fallback60.pulseUses,0);
  assert.ok(fallback30.time-pulse.time>=3.5,`PULSE advantage ${fallback30.time-pulse.time}s must be at least 3.5s`);assert.ok(Math.abs(fallback30.time-fallback60.time)<.35,'fallback policy stays stable across frame rates');
});

test('The side pocket adds a useful extraction/recovery detour and coolant-free fallback reaches Core',()=>{
  const direct=traverse({fps:30}),side=traverse({fps:30,side:true}),noCoolant=traverse({fps:30,coolant:null,side:true,driveFlank:750});
  assert.equal(side.reached,true);assert.ok(side.time-direct.time>=6&&side.time-direct.time<=9,`side-pocket detour adds ${(side.time-direct.time).toFixed(2)} s`);
  assert.equal(noCoolant.reached,true,'no-coolant H₂/methane/O₂ 36 remains viable through outer flank and coast');assert.ok(noCoolant.sideVisited&&noCoolant.regroupVisited,'coolant-free route passes the extraction site and regroup basin');assert.ok(noCoolant.recoveryCoast>0,'DRIVE release allows natural cooling inside the recovery pockets');assert.equal(noCoolant.waterUsed,0);assert.ok(noCoolant.time>direct.time+5,'the no-coolant fallback carries a time and exposure penalty');assert.ok(noCoolant.pulseUses<=1);
});

test('The sustained DRIVE crossing beats centerline cruise while a non-advanced flank stays traversable',()=>{
  const driven=traverse({fps:30,maxTime:36}),cruise=traverse({fps:30,burst:false,drive:false,maxTime:36}),flank=traverse({fps:30,burst:false,noPulseOffset:620});
  assert.equal(driven.reached,true);assert.equal(cruise.reached,false);assert.ok(cruise.time-driven.time>=7,`powered Core run is materially faster than centerline cruise (${driven.time.toFixed(1)}s vs ${cruise.time.toFixed(1)}s without reaching Core)`);assert.ok(cruise.channelSeconds>=10,`cruise spends time in opposing flow (${cruise.channelSeconds.toFixed(1)}s)`);assert.ok(cruise.pressureExposure>0&&cruise.finalY> -15000&&driven.finalY< -17000,'cruise remains in the authored pressure challenge while DRIVE crosses into the final approach');
  assert.equal(flank.reached,true,'ordinary methane/O₂/H₂ baseline can skirt the PULSE shear field without advanced equipment');
});
