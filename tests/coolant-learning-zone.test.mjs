import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,setCombustionHeld,stepRun} from '../src/veil/expedition-run.js';
import {flightConfig} from '../src/veil/growth.js';
import {OXYGEN_ROUTES,OXYGEN_THERMAL,oxygenRouteCenterAtY} from '../src/veil/oxygen-routes.js';
import {createUniverse,environmentAt} from '../src/veil/universe.js';

const DT=1/120;
const route=id=>OXYGEN_ROUTES.find(candidate=>candidate.id===id);
function runPinned({x,y,seconds,combustion=true,coolant=null}){
  const fuel={fuel:{molecule:'methane',amount:18},oxidizer:{molecule:'oxygen',amount:36}};
  if(coolant)fuel.coolant={molecule:coolant,amount:8};
  const run=createRun(createUniverse(19,{H:0,C:0,O:0}),flightConfig(),{fuel,predators:false});
  Object.assign(run.player,{x,y,angle:-Math.PI/2,vx:0,vy:0});
  setCombustionHeld(run,combustion);
  const events=[];
  for(let elapsed=0;elapsed<seconds;elapsed+=DT){
    run.player.x=x;run.player.y=y;
    events.push(...stepRun(run,{x:0,y:0},DT,{consumeCombustion:()=>true,consumeCoolant:()=>true}));
  }
  return {run,events};
}

test('Route C high-thermal core is the authored coolant-learning area',()=>{
  const side=route('oxygen-side'),main=route('oxygen-main'),y=-10050;
  const sideX=oxygenRouteCenterAtY(side,y),mainX=oxygenRouteCenterAtY(main,y);
  const sideEnv=environmentAt({x:sideX,y}),mainEnv=environmentAt({x:mainX,y});
  assert.ok(sideEnv.coolantLearning,'Route C core must expose coolant-learning semantics');
  assert.ok(sideEnv.heat>=OXYGEN_THERMAL.learningHeat);
  assert.equal(mainEnv.coolantLearning,false,'Route B must not teach coolant need');
  assert.ok(mainEnv.heat<5);
});

test('coolant need requires sustained active COMBUSTION inside the authored high-thermal core',()=>{
  const y=-10050,x=oxygenRouteCenterAtY(route('oxygen-side'),y),threshold=OXYGEN_THERMAL.learningExposureSeconds;
  const short=runPinned({x,y,seconds:threshold-.12});
  assert.equal(short.events.filter(event=>event.type==='coolantNeed').length,0,'brief contact must not reveal the solution');
  const learned=runPinned({x,y,seconds:threshold+.35});
  const events=learned.events.filter(event=>event.type==='coolantNeed');
  assert.equal(events.length,1,'sustained Route C combustion emits one coolant-need event');
  assert.ok(events[0].exposure>=threshold);
  assert.equal(learned.run.coolantNeedEmitted,true);
  const coast=runPinned({x,y,seconds:threshold+.5,combustion:false});
  assert.equal(coast.events.some(event=>event.type==='coolantNeed'),false,'ambient heat without COMBUSTION must not teach coolant need');
});

test('generic overheat and non-thermal DRIVE routes cannot unlock coolant-learning semantics',()=>{
  const threshold=OXYGEN_THERMAL.learningExposureSeconds;
  const generic=runPinned({x:0,y:-6000,seconds:22});
  assert.ok(generic.events.some(event=>event.type==='overheat'),'generic sustained DRIVE can still overheat');
  assert.equal(generic.events.some(event=>event.type==='coolantNeed'),false,'generic overheat is no longer a coolant-insight shortcut');
  const y=-10050,x=oxygenRouteCenterAtY(route('oxygen-main'),y),main=runPinned({x,y,seconds:threshold+2});
  assert.equal(main.events.some(event=>event.type==='coolantNeed'),false,'Route B sustained DRIVE keeps its non-thermal role');
});
