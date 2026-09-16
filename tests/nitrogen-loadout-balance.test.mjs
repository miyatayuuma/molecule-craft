import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ROLE_BALANCE_VERSION,performanceFor} from '../src/veil/molecule-roles.js';
import {burstDriveFor,flightConfig} from '../src/veil/growth.js';
import {beginBurst,createRun,setCombustionHeld,stepRun} from '../src/veil/engine.js';
import {BURST_ADVANTAGE_FIELDS,createUniverse} from '../src/veil/universe.js';
import {NITROGEN_PULSES,NITROGEN_ROUTE} from '../src/veil/nitrogen-routes.js';
import {evaluateProfile} from '../scripts/evaluate-propulsion-profiles.mjs';

const catalog=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const records=new Map(catalog.map(record=>[record.id,record]));
const atomCost=(id,count)=>{const cost={};for(const element of records.get(id)?.atoms??[])cost[element]=(cost[element]??0)+count;return cost;};
const shots=id=>{const profile=performanceFor(id,'propellant');return Math.floor(profile.capacity/profile.moleculesPerBurst);};

assert.equal(ROLE_BALANCE_VERSION,3);
assert.deepEqual(['hydrogen','ammonia','nitrogen'].map(id=>({id,shots:shots(id),power:performanceFor(id,'propellant').burstPower})),[
  {id:'hydrogen',shots:3,power:1},
  {id:'ammonia',shots:6,power:.82},
  {id:'nitrogen',shots:8,power:.72},
]);
assert.deepEqual(atomCost('hydrogen',performanceFor('hydrogen','propellant').capacity),{H:240});
assert.deepEqual(atomCost('ammonia',performanceFor('ammonia','propellant').capacity),{N:96,H:288});
assert.deepEqual(atomCost('nitrogen',performanceFor('nitrogen','propellant').capacity),{N:160});
assert.ok(burstDriveFor('hydrogen').boostSpeed>burstDriveFor('ammonia').boostSpeed&&burstDriveFor('ammonia').boostSpeed>burstDriveFor('nitrogen').boostSpeed);

const shortcutField=BURST_ADVANTAGE_FIELDS.find(field=>field.id==='oxygen-shortcut-shear');
assert.ok(shortcutField,'Oxygen shortcut shear must remain authored');
function oneBurstCrossing(id){
  const profile=performanceFor(id,'propellant'),config=flightConfig(),run=createRun(createUniverse(1,{H:0,C:0,N:0,O:0}),config,{predators:false,fuel:{propellant:{molecule:id,amount:profile.capacity,capacity:profile.capacity}}}),dt=1/120,margin=20,startY=shortcutField.y+shortcutField.radius+margin,targetY=shortcutField.y-shortcutField.radius-margin;
  Object.assign(run.player,{x:shortcutField.x,y:startY,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});assert.equal(beginBurst(run,()=>true),true);
  for(let frame=0;frame<8/dt;frame++){
    const dx=shortcutField.x-run.player.x,dy=targetY-160-run.player.y,distance=Math.hypot(dx,dy)||1;stepRun(run,{x:dx/distance,y:dy/distance},dt,{});if(run.player.y<=targetY)return {success:true,time:run.time};
  }
  return {success:false,time:run.time};
}
const strong={hydrogen:oneBurstCrossing('hydrogen'),ammonia:oneBurstCrossing('ammonia'),nitrogen:oneBurstCrossing('nitrogen')};
assert.equal(strong.hydrogen.success,true,'H2 must retain the clean one-shot high-force shortcut');
assert.equal(strong.ammonia.success,false,'NH3 must not obsolete H2 on the strongest one-shot shear');
assert.equal(strong.nitrogen.success,false,'N2 trades peak force for repeated pulse capacity');

function nitrogenRun(mode){
  const config=flightConfig({progress:{choCompleted:true},elements:{N:0}}),fuel=mode==='drive'?{fuel:{molecule:'methane',amount:18,capacity:18},oxidizer:{molecule:'oxygen',amount:36,capacity:36}}:(()=>{const p=performanceFor(mode,'propellant');return {propellant:{molecule:mode,amount:p.capacity,capacity:p.capacity}};})(),run=createRun(createUniverse(41,{H:0,C:0,N:0,O:0},{capabilities:{combustionDrive:true,nitrogenField:true}}),config,{fuel,predators:false}),points=NITROGEN_ROUTE.points,last=points.at(-1),schedule=mode==='hydrogen'?[.18,.50,.81]:mode==='drive'?[]:NITROGEN_PULSES.map(pulse=>pulse.progress),systems={consumeCombustion:()=>true};
  const start=points[0];Object.assign(run.player,{x:start.x,y:start.y,angle:start.angle,vx:0,vy:0,speed:config.driftSpeed});run.region='nitrogen';if(mode==='drive')setCombustionHeld(run,true);
  let targetIndex=2,nextBurst=0;
  while(run.time<70){
    const target=points[Math.min(points.length-1,targetIndex)],dx=target.x-run.player.x,dy=target.y-run.player.y,distance=Math.hypot(dx,dy)||1,progress=targetIndex/(points.length-1);
    if(distance<85&&targetIndex<points.length-1)targetIndex=Math.min(points.length-1,targetIndex+2);
    if(nextBurst<schedule.length&&progress>=schedule[nextBurst]&&run.player.boost<=0&&run.player.cooldown<=0){if(beginBurst(run,()=>true))nextBurst++;}
    stepRun(run,{x:dx/distance,y:dy/distance},1/30,systems);
    if(Math.hypot(run.player.x-last.x,run.player.y-last.y)<115&&targetIndex>=points.length-3)break;
  }
  const propellant=run.fuel.propellant,profile=propellant?.molecule?performanceFor(propellant.molecule,'propellant'):null;
  return {success:Math.hypot(run.player.x-last.x,run.player.y-last.y)<150,time:+run.time.toFixed(2),bursts:run.telemetry.burstUses,nAtoms:run.collectedElements.N,remainingShots:profile?Math.floor(propellant.amount/profile.moleculesPerBurst):0};
}
const corridor={hydrogen:nitrogenRun('hydrogen'),ammonia:nitrogenRun('ammonia'),nitrogen:nitrogenRun('nitrogen'),drive:nitrogenRun('drive')};
for(const [name,row] of Object.entries(corridor))assert.equal(row.success,true,`${name} must remain viable in the Nitrogen corridor`);
assert.equal(corridor.ammonia.bursts,6,'NH3 can answer the six authored pulses but spends its full PULSE load');
assert.equal(corridor.ammonia.remainingShots,0);
assert.equal(corridor.nitrogen.bursts,6);
assert.equal(corridor.nitrogen.remainingShots,2,'N2 keeps two recovery pulses after the six-pulse corridor');
assert.ok(corridor.nitrogen.nAtoms>corridor.hydrogen.nAtoms,'repeatable N2 pulses support collection better than three H2 emergency bursts');
assert.ok(corridor.drive.time<corridor.nitrogen.time,'COMBUSTION DRIVE keeps the sustained-travel advantage');

const n2Thermal=evaluateProfile({fuel:'methane',coolant:'nitrogen',capacity:36,early:true,goalY:-11640}),waterThermal=evaluateProfile({fuel:'methane',coolant:'water',capacity:36,early:true,goalY:-11640}),glycolThermal=evaluateProfile({fuel:'methane',coolant:'ethylene-glycol',capacity:36,early:true,goalY:-11640});
for(const row of [n2Thermal,waterThermal,glycolThermal])assert.equal(row.returned,true);
const n2Used=performanceFor('nitrogen','coolant').capacity-n2Thermal.remaining.coolant.amount,waterUsed=performanceFor('water','coolant').capacity-waterThermal.remaining.coolant.amount,glycolUsed=performanceFor('ethylene-glycol','coolant').capacity-glycolThermal.remaining.coolant.amount;
assert.ok(n2Thermal.time<waterThermal.time,'N2 supports aggressive short thermal runs');
assert.ok(n2Used>waterUsed&&n2Used>glycolUsed,'cryogenic N2 pays for stronger immediate cooling with much higher coolant consumption');
assert.ok(performanceFor('ethylene-glycol','coolant').environmentTolerance>performanceFor('nitrogen','coolant').environmentTolerance,'glycol remains the high-temperature endurance option');

console.log('Nitrogen LOADOUT balance',JSON.stringify({strong,corridor,thermal:{nitrogen:{time:n2Thermal.time,used:n2Used},water:{time:waterThermal.time,used:waterUsed},glycol:{time:glycolThermal.time,used:glycolUsed}}}));
