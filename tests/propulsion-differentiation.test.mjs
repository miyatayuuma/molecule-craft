import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPEDITION,THERMAL,VEIL} from '../src/veil/config.js';
import {createRun,stepRun} from '../src/veil/engine.js';
import {DRIVES,flightConfig} from '../src/veil/growth.js';
import {performanceFor} from '../src/veil/molecule-roles.js';
import {BURST_ADVANTAGE_FIELDS,OXYGEN_ENTRY_KNOTS,createUniverse} from '../src/veil/universe.js';
import {DEEP_OXYGEN_ROUTES,OXYGEN_ROUTES,oxygenRouteCenterAtY} from '../src/veil/oxygen-routes.js';

const EPSILON=1e-9;
const fuelFor=mode=>mode==='drive'?{
  fuel:{molecule:'methane',amount:18,capacity:18},
  oxidizer:{molecule:'oxygen',amount:36,capacity:36},
}:{};
const systemsFor=mode=>mode==='drive'?{consumeCombustion:()=>true}:{};
const BYPASS_X=Object.freeze({'h-boundary-shear':250,'oxygen-shortcut-shear':-530,'deep-skill-shear':-720});

function prepareRun({x,y,mode}){
  const config=flightConfig(),run=createRun(createUniverse(1,{H:0,C:0,O:0}),config,{fuel:fuelFor(mode),predators:false});
  Object.assign(run.player,{x,y,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});
  if(mode==='burst'){
    run.player.drive=DRIVES.hydrogen;
    run.player.boost=DRIVES.hydrogen.boostSeconds;
  }else if(mode==='drive')run.driveHeld=true;
  return {config,run,systems:systemsFor(mode)};
}

function traverseBand({field,mode,x=field.x}){
  const startY=field.y+field.radius+75,targetY=field.y-field.radius-75;
  const {run,systems}=prepareRun({x,y:startY,mode});
  const dt=1/120,limit=8;
  let bandTime=0,maxDeviation=0;
  for(let frame=0;frame<limit/dt;frame++){
    const target={x,y:targetY-220},dx=target.x-run.player.x,dy=target.y-run.player.y,distance=Math.hypot(dx,dy)||1;
    stepRun(run,{x:dx/distance,y:dy/distance},dt,systems);
    if(Math.abs(run.player.y-field.y)<=field.radius){
      bandTime+=dt;
      maxDeviation=Math.max(maxDeviation,Math.abs(run.player.x-field.x));
    }
    if(run.player.y<=targetY)return {success:true,time:run.time,bandTime,maxDeviation,x:run.player.x,y:run.player.y};
  }
  return {success:false,time:Infinity,bandTime,maxDeviation,x:run.player.x,y:run.player.y};
}

function traverseOxygenEntry(mode){
  const {run,systems}=prepareRun({x:OXYGEN_ENTRY_KNOTS[0][0],y:OXYGEN_ENTRY_KNOTS[0][1],mode});
  const waypoints=OXYGEN_ENTRY_KNOTS.slice(1).map(([x,y])=>({x,y})),dt=1/120,limit=14;
  let index=0;
  for(let frame=0;frame<limit/dt;frame++){
    const target=waypoints[index],dx=target.x-run.player.x,dy=target.y-run.player.y,distance=Math.hypot(dx,dy)||1;
    if(distance<24){
      if(index===waypoints.length-1)return {success:true,time:run.time};
      index++;
      continue;
    }
    stepRun(run,{x:dx/distance,y:dy/distance},dt,systems);
  }
  return {success:false,time:Infinity};
}

test('propulsion and economy parameters remain unchanged while FIELD differentiates their jobs',()=>{
  assert.deepEqual(DRIVES.hydrogen,{type:'burst',label:'H₂',name:'H₂ BURST',cost:{hydrogen:40},boostSpeed:760,boostSeconds:.65,boostRadius:8,boostCooldown:.55,boostAcceleration:28,boostGrip:20});
  assert.deepEqual(DRIVES.combustion,{type:'continuous',label:'FUEL + O₂',name:'COMBUSTION DRIVE',cost:{methane:1,oxygen:2},boostSpeed:470,packetSeconds:2,boostRadius:40,boostAcceleration:5.2,boostGrip:14});
  assert.equal(EXPEDITION.hydrogenCapacity,3);
  assert.deepEqual(performanceFor('hydrogen','propellant'),{capacity:120,moleculesPerBurst:40,burstPower:1});
  assert.deepEqual(performanceFor('methane','fuel'),{capacity:18,oxygenPerFuel:2,energy:1,heatFactor:1,response:1});
  assert.deepEqual(performanceFor('oxygen','oxidizer'),{capacity:36,oxidizingPower:1});
  assert.equal(VEIL.boostFieldResistance,.10);
  assert.equal(VEIL.maxOpposingFlow,.22);
  assert.deepEqual(THERMAL,{heatPerSecond:10,naturalCoolingPerSecond:14,coolantCoolingPerSecond:12,coolantSecondsPerMolecule:1,coolantStart:35,hotThreshold:70,overheatThreshold:100,recoveryThreshold:55});
});

test('three compact BURST-advantage fields are fixed on existing optional/skill lines',()=>{
  assert.deepEqual(BURST_ADVANTAGE_FIELDS.map(({id,x,y,radius,angle,force,cleanHalfWidth,route})=>({id,x,y,radius,angle,force,cleanHalfWidth,route})),[
    {id:'h-boundary-shear',x:530,y:-3800,radius:110,angle:0,force:2600,cleanHalfWidth:50,route:'h-boundary'},
    {id:'oxygen-shortcut-shear',x:-320,y:-9700,radius:105,angle:0,force:2600,cleanHalfWidth:50,route:'oxygen-shortcut'},
    {id:'deep-skill-shear',x:100,y:-11450,radius:105,angle:Math.PI,force:2600,cleanHalfWidth:50,route:'oxygen-deep-skill'},
  ]);
  assert.equal(BURST_ADVANTAGE_FIELDS[0].x,VEIL.gate.x);
  assert.equal(BURST_ADVANTAGE_FIELDS[0].y,VEIL.gate.y);
  const shortcut=OXYGEN_ROUTES.find(route=>route.id==='oxygen-shortcut');
  const deepSkill=DEEP_OXYGEN_ROUTES.find(route=>route.id==='oxygen-deep-skill');
  assert.ok(Math.abs(oxygenRouteCenterAtY(shortcut,-9700)+320)<EPSILON);
  assert.ok(Math.abs(oxygenRouteCenterAtY(deepSkill,-11450)-100)<EPSILON);
  assert.ok(OXYGEN_ROUTES.some(route=>route.id==='oxygen-main')&&OXYGEN_ROUTES.some(route=>route.id==='oxygen-side'),'Oxygen Network retains bypass routes');
  assert.ok(DEEP_OXYGEN_ROUTES.some(route=>route.id==='oxygen-deep-safe')&&DEEP_OXYGEN_ROUTES.some(route=>route.id==='oxygen-deep-thermal'),'Deep Skill retains longer alternatives');
  for(const route of [...OXYGEN_ROUTES,...DEEP_OXYGEN_ROUTES]){
    assert.equal(route.requiredCapability,undefined,`${route.id} must not become a hard capability gate`);
    assert.equal(route.requires,undefined,`${route.id} must remain physically open`);
  }
});

test('compact shear fields reward BURST with a clean one-shot line while normal thrust keeps a safe bypass',()=>{
  const reports=[];
  for(const field of BURST_ADVANTAGE_FIELDS){
    const normalDirect=traverseBand({field,mode:'normal'}),normalBypass=traverseBand({field,mode:'normal',x:BYPASS_X[field.id]}),burst=traverseBand({field,mode:'burst'}),drive=traverseBand({field,mode:'drive'});
    const report={id:field.id,normalDirect,normalBypass,burst,drive};reports.push(report);console.log('BURST field metric',JSON.stringify(report));
    assert.ok(normalBypass.success,`${field.id}: normal thrust must retain a skill/safe bypass`);
    assert.ok(burst.success,`${field.id}: BURST traversal must succeed`);
    assert.ok(drive.success,`${field.id}: DRIVE traversal must succeed`);
    assert.ok(burst.maxDeviation<=field.cleanHalfWidth+12,`${field.id}: BURST should hold the compact line (${burst.maxDeviation.toFixed(1)} <= ${field.cleanHalfWidth+12})`);
    assert.ok(drive.maxDeviation>field.cleanHalfWidth,`${field.id}: DRIVE should require visible line correction (${drive.maxDeviation.toFixed(1)} > ${field.cleanHalfWidth})`);
    assert.ok(drive.maxDeviation>burst.maxDeviation*1.18,`${field.id}: DRIVE deviation must materially exceed BURST (${drive.maxDeviation.toFixed(1)} vs ${burst.maxDeviation.toFixed(1)})`);
    assert.ok(burst.bandTime<drive.bandTime*.86,`${field.id}: BURST should spend less time exposed to the short shear (${burst.bandTime.toFixed(2)}s vs ${drive.bandTime.toFixed(2)}s)`);
    assert.ok(burst.time<drive.time*.9,`${field.id}: the one-shot BURST line should clear faster (${burst.time.toFixed(2)}s vs ${drive.time.toFixed(2)}s)`);
  }
  console.log('BURST advantage metrics',JSON.stringify(reports));
});

test('COMBUSTION DRIVE keeps the clear advantage on sustained Oxygen Entry travel',()=>{
  const normal=traverseOxygenEntry('normal'),burst=traverseOxygenEntry('burst'),drive=traverseOxygenEntry('drive');
  assert.ok(normal.success&&burst.success&&drive.success,'all propulsion modes must leave Oxygen Entry traversable');
  assert.ok(drive.time<normal.time*.72,`DRIVE must retain a strong long-travel advantage (${drive.time.toFixed(2)}s vs ${normal.time.toFixed(2)}s)`);
  assert.ok(drive.time<burst.time*.82,`one BURST must not substitute for sustained DRIVE (${drive.time.toFixed(2)}s vs ${burst.time.toFixed(2)}s)`);
  console.log('Oxygen Entry propulsion metrics',JSON.stringify({normal,burst,drive}));
});
