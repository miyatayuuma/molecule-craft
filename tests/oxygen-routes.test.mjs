import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateOxygenRoute} from '../scripts/simulate-oxygen-routes.mjs';
import {createRun,stepRun} from '../src/veil/engine.js';
import {DRIVES,flightConfig} from '../src/veil/growth.js';
import {createUniverse} from '../src/veil/universe.js';
import {BURST_ADVANTAGE_FIELDS} from '../src/veil/universe.js';
import {EXPEDITION_CHALLENGES} from '../src/veil/expedition-challenges.js';
import {OXYGEN_ROUTES,oxygenPressureAt} from '../src/veil/oxygen-routes.js';

const routes=Object.fromEntries(OXYGEN_ROUTES.map(route=>[route.id,route]));
const shortcut=routes['oxygen-shortcut'];
const noPredators={predators:false,start:'junction',maxSeconds:45};

test('shortcut is a two-stage localized 600-pressure corridor around the existing pulse/shear field',()=>{
  assert.deepEqual(shortcut.knots,[[120,-8700],[-320,-9000],[-320,-10350],[120,-10670]]);
  assert.equal(shortcut.width,230);
  assert.deepEqual(shortcut.gates,[{y:-9480,depth:72,pressure:600},{y:-9950,depth:72,pressure:600}]);
  assert.equal(shortcut.pressure,0);
  assert.equal(oxygenPressureAt({x:-320,y:-9480}),600);
  assert.equal(oxygenPressureAt({x:-320,y:-9950}),600);
  assert.equal(oxygenPressureAt({x:-320,y:-9700}),0,'route pressure clears around the existing pulse/shear center');
  assert.equal(oxygenPressureAt({x:-320,y:-9360}),0);
  assert.equal(oxygenPressureAt({x:-320,y:-10070}),0);
  const shear=BURST_ADVANTAGE_FIELDS.find(field=>field.id==='oxygen-shortcut-shear');
  const pulse=EXPEDITION_CHALLENGES.find(challenge=>challenge.id==='pulse');
  assert.deepEqual({x:shear.x,y:shear.y,radius:shear.radius},{x:-320,y:-9700,radius:105});
  assert.deepEqual({top:pulse.top,bottom:pulse.bottom,centerY:pulse.centerY},{top:-9850,bottom:-9450,centerY:-9650});
  for(const gate of shortcut.gates)assert.ok(Math.abs(gate.y-shear.y)>gate.depth/2+shear.radius,'pressure band must not stack on the compact shear field');
  assert.ok(shortcut.gates[0].y<=pulse.bottom&&shortcut.gates[0].y>=pulse.top,'gate 1 sits only at the pulse entry edge');
  assert.ok(shortcut.gates[1].y<pulse.top,'gate 2 sits beyond the pulse field');
});

test('normal bypass and DRIVE direct traversal stay open while the direct H2 line uses exactly two BURSTs',()=>{
  const normal=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:null,drive:false,detour:true,...noPredators});
  const drive=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:null,drive:true,...noPredators});
  const burst=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:'hydrogen',drive:false,...noPredators});
  console.log('Task3 shortcut modes',JSON.stringify({normal:{arrivalSeconds:normal.arrivalSeconds,reached:normal.reached},drive:{arrivalSeconds:drive.arrivalSeconds,reached:drive.reached},burst:{arrivalSeconds:burst.arrivalSeconds,reached:burst.reached,burstUses:burst.burstUses,actualBurstTimes:burst.actualBurstTimes}},null,2));
  assert.equal(normal.reached,true,'normal propulsion keeps a skill bypass around both pressure bands');
  assert.equal(drive.reached,true,'DRIVE-only direct traversal remains possible without becoming a capability requirement');
  assert.equal(burst.reached,true,'H2 direct shortcut traversal succeeds');
  assert.equal(burst.burstUses,2,'the direct corridor consumes one H2 BURST per localized gate');
  assert.deepEqual(burst.currentCrossings,['oxygen-shortcut:0','oxygen-shortcut:1']);
  assert.ok(burst.arrivalSeconds<normal.arrivalSeconds*.8,'direct BURST remains materially quicker than the normal skill bypass');
  assert.equal(shortcut.requiredCapability,undefined);
  assert.equal(shortcut.requires,undefined);
});

test('localized gate traversal favors BURST over DRIVE without making DRIVE a hard failure',()=>{
  const cross=(gate,mode)=>{
    const config=flightConfig(),dt=1/60,startY=gate.y+110,targetY=gate.y-110;
    const fuel=mode==='drive'?{fuel:{molecule:'methane',amount:18,capacity:18},oxidizer:{molecule:'oxygen',amount:36,capacity:36}}:{};
    const run=createRun(createUniverse(1,{H:0,C:0,O:0}),config,{fuel,predators:false});
    Object.assign(run.player,{x:-320,y:startY,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});run.region='oxygen';
    if(mode==='burst'){run.player.drive=DRIVES.hydrogen;run.player.boost=DRIVES.hydrogen.boostSeconds;}
    if(mode==='drive')run.driveHeld=true;
    const systems=mode==='drive'?{consumeCombustion:()=>true}:{};
    for(let frame=0;frame<8/dt;frame++){
      stepRun(run,{x:0,y:-1},dt,systems);
      if(run.player.y<=targetY)return run.time;
    }
    return Infinity;
  };
  for(const gate of shortcut.gates){
    const burst=cross(gate,'burst'),drive=cross(gate,'drive');
    assert.ok(Number.isFinite(drive),'DRIVE-only remains physically able to cross each localized gate');
    assert.ok(Number.isFinite(burst),'BURST crosses each localized gate');
    assert.ok(burst<drive*.8,`BURST must beat DRIVE across the localized band (${burst.toFixed(2)}s vs ${drive.toFixed(2)}s at y=${gate.y})`);
  }
});

test('one BURST does not trivialize both bands and the canonical shortcut never needs a third',()=>{
  const canonical=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:'hydrogen',...noPredators});
  assert.equal(canonical.burstUses,2);
  const oneBurst=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:'hydrogen',burstTimes:[canonical.actualBurstTimes[0]],...noPredators});
  assert.ok(!oneBurst.reached||oneBurst.arrivalSeconds>canonical.arrivalSeconds*1.2,'one BURST must not erase the two-stage terrain');
  assert.ok(canonical.burstUses<=2,'canonical shortcut must never require a third BURST');
});

test('two-BURST shortcut traversal is stable at 30/60fps and multiple seeds',()=>{
  for(const seed of [1,71,2026])for(const fps of [30,60]){
    const report=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:'hydrogen',seed,fps,...noPredators});
    assert.equal(report.reached,true,`seed ${seed} @ ${fps}fps reaches merge`);
    assert.equal(report.burstUses,2,`seed ${seed} @ ${fps}fps uses exactly two BURSTs`);
    assert.equal(report.currentCrossings.length,2,`seed ${seed} @ ${fps}fps crosses both pressure bands`);
    assert.equal(report.overheatEvents,0);
  }
});

test('main and side route identities are untouched by the shortcut gate split',()=>{
  assert.deepEqual(routes['oxygen-main'].knots,[[120,-8700],[300,-9100],[350,-9600],[260,-10150],[120,-10670]]);
  assert.deepEqual([routes['oxygen-main'].pressure,routes['oxygen-main'].lanes,routes['oxygen-main'].value],[370,2,2]);
  assert.deepEqual(routes['oxygen-main'].restStops,[{x:300,y:-9750,depth:180}]);
  assert.deepEqual(routes['oxygen-side'].knots,[[120,-8700],[780,-9000],[850,-10350],[120,-10670]]);
  assert.deepEqual([routes['oxygen-side'].pressure,routes['oxygen-side'].lanes,routes['oxygen-side'].value],[0,2,2]);
  assert.deepEqual(routes['oxygen-side'].gates,[]);
});
