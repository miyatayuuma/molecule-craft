import assert from 'node:assert/strict';
import {CHO_DESTINATION} from '../src/veil/cho-campaign.js';
import {beginBurst,createRun,setCombustionHeld,stepRun} from '../src/veil/expedition-run.js';
import {flightConfig} from '../src/veil/growth.js';
import {OXYGEN_THERMAL} from '../src/veil/oxygen-routes.js';
import {createUniverse,environmentAt} from '../src/veil/universe.js';

const DT=1/60;
const normalized=(x,y)=>{const length=Math.hypot(x,y)||1;return {x:x/length,y:y/length};};

function deterministicMap(){
  const map=createUniverse(97,{H:0,C:0,O:0});
  map.dust=[];map.fields=[];map.clusters=[];map.signals=[];
  return map;
}

function simulateWall({coolant=0,skill=false,maxSeconds=18}={}){
  const fuel={
    fuel:{molecule:'methane',amount:18,capacity:18},
    oxidizer:{molecule:'oxygen',amount:36,capacity:36},
  };
  if(coolant)fuel.coolant={molecule:'water',amount:coolant,capacity:80};
  if(skill)fuel.propellant={molecule:'hydrogen',amount:120,capacity:120};
  const run=createRun(deterministicMap(),flightConfig(),{fuel,predators:false});
  Object.assign(run.player,{x:100,y:-11855,angle:-Math.PI/2,speed:29,vx:0,vy:0});
  setCombustionHeld(run,true);
  let frames=0,bursts=0,coolantSpent=0,driveSeconds=0,coastSeconds=0,maxHeat=0,minY=run.player.y;
  const overheats=[];
  while(frames++<maxSeconds/DT&&!run.destinationReached){
    if(skill){
      const wantDrive=run.heat<62&&!run.overheated&&run.player.boost<=0;
      setCombustionHeld(run,wantDrive);
      if((run.heat>=64||run.overheated||run.player.y>-12120)&&run.player.boost<=0&&run.player.cooldown<=0&&run.fuel.propellant.amount>=40){
        if(beginBurst(run,()=>true))bursts++;
      }
    }
    const input=normalized(CHO_DESTINATION.x-run.player.x,CHO_DESTINATION.y-run.player.y);
    const events=stepRun(run,input,DT,{
      consumeCombustion:()=>true,
      consumeCoolant:(amount,molecule)=>{assert.equal(amount,1);assert.equal(molecule,'water');coolantSpent+=amount;return true;},
    });
    maxHeat=Math.max(maxHeat,run.heat);minY=Math.min(minY,run.player.y);
    if(run.player.combustion)driveSeconds+=DT;else coastSeconds+=DT;
    for(const event of events)if(event.type==='overheat')overheats.push({time:run.time,y:run.player.y});
  }
  return {run,bursts,coolantSpent,driveSeconds,coastSeconds,maxHeat,minY,overheats,time:run.time};
}

const wall=OXYGEN_THERMAL.frontierWall;
assert.ok(wall,'Frontier thermal wall must be authored explicitly');
assert.equal(wall.routePressure,330);
assert.equal(wall.offRoutePressure,500);
assert.equal(wall.maxHeat,50);

const center=environmentAt({x:190,y:-12150});
const edge=environmentAt({x:900,y:-12150});
assert.equal(center.heat,50,'frontier wall should sustain high ambient heat on the intended line');
assert.equal(center.traversableRoutePressure,330,'best frontier line still carries strong reverse pressure');
assert.equal(edge.traversableRoutePressure,500,'leaving the intended line should be substantially worse');
assert.ok(center.pressure>flightConfig().speed,'ordinary propulsion cannot make steady progress through the wall');
assert.ok(center.combustionHeatFactor>=2.35,'continuous DRIVE should accumulate heat rapidly in the frontier wall');
assert.equal(center.coolantLearning,true,'the frontier wall remains a valid coolant-learning environment');

const dry=simulateWall();
assert.ok(dry.overheats.length>=1,'dry held DRIVE should thermally interrupt inside the wall');
assert.equal(dry.run.destinationReached,false,'dry held DRIVE must not brute-force the CHO destination');
assert.ok(dry.minY>-12430,'reverse pressure should erase enough overheated progress to keep the destination out of reach');

const wet=simulateWall({coolant:8,maxSeconds:12});
assert.equal(wet.run.destinationReached,true,'H2O starter load should enable continuous DRIVE through the wall');
assert.equal(wet.overheats.length,0,'cooled DRIVE should cross without thermal shutdown');
assert.ok(wet.coolantSpent>0&&wet.coolantSpent<=8,'the canonical H2O starter is meaningfully consumed but sufficient');
assert.ok(wet.time<9,'cooled traversal should feel decisively better than fighting the wall dry');

const skill=simulateWall({skill:true,maxSeconds:18});
assert.equal(skill.run.destinationReached,true,'expert PULSE plus short DRIVE windows may barely bypass the coolant wall');
assert.ok(skill.bursts>=2,'the no-coolant skill bypass must spend most of the canonical H2 PULSE reserve');
assert.ok(skill.driveSeconds>0&&skill.coastSeconds>0,'the bypass should require micro-DRIVE timing rather than pure PULSE or held DRIVE');
assert.ok(skill.time>wet.time,'the coolant route should remain clearly faster and easier');

console.log('Oxygen frontier wall passed',JSON.stringify({
  center:{heat:center.heat,pressure:center.pressure,factor:center.combustionHeatFactor},
  dry:{minY:+dry.minY.toFixed(1),heat:+dry.maxHeat.toFixed(1),overheats:dry.overheats.length,reached:dry.run.destinationReached,time:+dry.time.toFixed(2)},
  wet:{heat:+wet.maxHeat.toFixed(1),waterUsed:wet.coolantSpent,reached:wet.run.destinationReached,time:+wet.time.toFixed(2)},
  skill:{bursts:skill.bursts,drive:+skill.driveSeconds.toFixed(2),coast:+skill.coastSeconds.toFixed(2),reached:skill.run.destinationReached,time:+skill.time.toFixed(2)},
}));
