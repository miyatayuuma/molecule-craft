import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {THERMAL} from '../src/veil/config.js';
import {createFlight,moveFlight} from '../src/veil/engine.js';
import {DRIVES,driveAvailable,flightConfig} from '../src/veil/growth.js';
import {HYDROGEN_REVISIT_POCKET,HYDROGEN_REVISIT_ROUTE,createMap} from '../src/veil/map.js';
import {
  CARBON_DEEP_Y,CARBON_REVISIT_POCKET,CARBON_REVISIT_ROUTE,ENVIRONMENT_RECOVERY_CONTRACT,FIELD_SIGNALS,createUniverse,environmentAt,
} from '../src/veil/universe.js';
import {EXPEDITION_CHALLENGES} from '../src/veil/expedition-challenges.js';
import {DEEP_OXYGEN_FRONTIER_RECOVERY,OXYGEN_ROUTES,OXYGEN_THERMAL} from '../src/veil/oxygen-routes.js';
import {buildFieldMapSvg} from '../scripts/export-field-map.mjs';

const TASK6_BASELINE=Object.freeze({hydrogenRegionValue:1153,carbonRegionValue:938});
const CARBON_REGION=Object.freeze({top:-7830,bottom:-4390});
const lengthOf=points=>points.slice(1).reduce((sum,point,index)=>sum+Math.hypot(point.x-points[index].x,point.y-points[index].y),0);
const routeBy=(map,id)=>map.routes.find(route=>route.id===id);
const routeValue=(map,id,element=null,predicate=()=>true)=>map.dust.filter(dust=>dust.route===id&&(!element||dust.element===element)&&predicate(dust)).reduce((sum,dust)=>sum+dust.value,0);
const normalized=(value,length)=>value/length*1000;
const distance=(point,[x,y])=>Math.hypot(point.x-x,point.y-y);
const nearest=(route,knot)=>Math.min(...route.points.map(point=>distance(point,knot)));

function traverse(knots,{burst=false,drive=false,maxSeconds=20}={}){
  const config=flightConfig(),player=createFlight(config),dt=1/60;
  Object.assign(player,{x:knots[0][0],y:knots[0][1],angle:Math.atan2(knots[1][1]-knots[0][1],knots[1][0]-knots[0][0]),vx:0,vy:0,speed:config.driftSpeed});
  if(burst){player.drive=DRIVES.hydrogen;player.boost=DRIVES.hydrogen.boostSeconds;}
  let index=1;
  for(let frame=0;frame<maxSeconds/dt;frame++){
    const [tx,ty]=knots[index],dx=tx-player.x,dy=ty-player.y,d=Math.hypot(dx,dy);
    if(d<24){if(index===knots.length-1)return frame*dt;index++;continue;}
    if(drive){player.drive=DRIVES.combustion;player.combustion=true;}
    moveFlight(player,{x:dx/d,y:dy/d},dt,{config,environment:environmentAt(player,frame*dt)});
  }
  return Infinity;
}

test('H/C revisit geometry is derived from persistent COMBUSTION DRIVE availability',()=>{
  assert.deepEqual(HYDROGEN_REVISIT_ROUTE.knots,[[-520,-2200],[-930,-2450],[-850,-2950],[-800,-3090]]);
  assert.deepEqual(CARBON_REVISIT_ROUTE.knots,[[840,-5540],[1080,-6000],[980,-6500],[650,-6900],[170,-7190]]);
  const preH=createMap(1,{H:0,C:0,O:0}),pre=createUniverse(1,{H:0,C:0,O:0});
  for(const map of [preH,pre]){
    assert.equal(routeBy(map,'hydrogen-revisit'),undefined);
    assert.equal(routeBy(map,'carbon-revisit'),undefined);
    assert.equal(map.dust.some(dust=>dust.route?.includes('revisit')),false);
    assert.equal((map.currents??[]).some(current=>current.id.includes('revisit')),false);
    assert.equal(map.labels.some(label=>label.text.includes('revisit')),false);
  }
  const state={recipes:['hydrogen','methane','oxygen']};
  assert.equal(driveAvailable({recipes:['hydrogen','methane']},'combustion'),false);
  assert.equal(driveAvailable(state,'combustion'),true);
  const reloaded=JSON.parse(JSON.stringify(state));
  assert.equal(driveAvailable(reloaded,'combustion'),true,'reload-equivalent persistent recipe state derives the same unlock');
  const capabilities={combustionDrive:driveAvailable(reloaded,'combustion')};
  const hMap=createMap(1,{H:0,C:0,O:0},{capabilities}),universe=createUniverse(1,{H:0,C:0,O:0},{capabilities});
  const h=routeBy(hMap,'hydrogen-revisit'),c=routeBy(universe,'carbon-revisit');
  assert.ok(h&&c,'both revisit loops appear after COMBUSTION DRIVE is available');
  assert.ok(distance(h.points[0],HYDROGEN_REVISIT_ROUTE.knots[0])<=1&&distance(h.points.at(-1),HYDROGEN_REVISIT_ROUTE.knots.at(-1))<=1);
  assert.ok(distance(c.points[0],CARBON_REVISIT_ROUTE.knots[0])<=1&&distance(c.points.at(-1),CARBON_REVISIT_ROUTE.knots.at(-1))<=1);
  assert.ok(nearest(routeBy(hMap,'safe'),HYDROGEN_REVISIT_ROUTE.knots[0])<=31);
  assert.ok(nearest(routeBy(hMap,'detour'),HYDROGEN_REVISIT_ROUTE.knots.at(-1))<=31);
  assert.ok(nearest(routeBy(universe,'carbon-sweep'),CARBON_REVISIT_ROUTE.knots[0])<=31);
  assert.ok(nearest(routeBy(universe,'carbon-main'),CARBON_REVISIT_ROUTE.knots.at(-1))<=31);
  assert.equal(hMap.currents.find(current=>current.id==='hydrogen-revisit-current')?.force,90);
  assert.equal(universe.currents.find(current=>current.id==='carbon-revisit-current')?.force,90);
  assert.ok(environmentAt(h.points[Math.floor(h.points.length/2)],0,hMap).currentIntensity>0);
  assert.ok(environmentAt(c.points[Math.floor(c.points.length/2)],0,universe).currentIntensity>0);
  assert.equal(driveAvailable({...state,loadout:{}},'combustion'),true,'removing the current LOADOUT cannot relock geometry');
});

test('revisit resource reward is local, composition-specific, and stock-depleted independently of geometry',()=>{
  const capabilities={combustionDrive:true};
  const hMap=createMap(1,{H:0,C:0,O:0},{capabilities}),universe=createUniverse(1,{H:0,C:0,O:0},{capabilities});
  const hPocket=hMap.dust.filter(dust=>dust.route===HYDROGEN_REVISIT_POCKET.id),cPocket=universe.dust.filter(dust=>dust.route===CARBON_REVISIT_POCKET.id);
  const sum=(dust,element)=>dust.filter(item=>item.element===element).reduce((total,item)=>total+item.value,0);
  assert.ok(sum(hPocket,'H')>sum(hPocket,'C')*3,'H revisit pocket is H-dominant');
  assert.ok(sum(cPocket,'C')>sum(cPocket,'H')*3,'C revisit pocket is C-dominant');
  assert.ok(hPocket.every(dust=>Math.hypot(dust.x-HYDROGEN_REVISIT_POCKET.x,dust.y-HYDROGEN_REVISIT_POCKET.y)<=HYDROGEN_REVISIT_POCKET.radius+1));
  assert.ok(cPocket.every(dust=>Math.hypot(dust.x-CARBON_REVISIT_POCKET.x,dust.y-CARBON_REVISIT_POCKET.y)<=CARBON_REVISIT_POCKET.radius+1));
  const highH=createMap(1,{H:800,C:400,O:0},{capabilities}),highC=createUniverse(1,{H:800,C:400,O:0},{capabilities});
  assert.ok(routeBy(highH,'hydrogen-revisit')&&routeBy(highC,'carbon-revisit'),'stock depletion never removes unlocked geometry');
  assert.ok(highH.currents.some(current=>current.id==='hydrogen-revisit-current')&&highC.currents.some(current=>current.id==='carbon-revisit-current'),'stock depletion never removes unlocked current');
  assert.ok(highH.dust.filter(dust=>dust.route===HYDROGEN_REVISIT_POCKET.id).length<hPocket.length);
  assert.ok(highC.dust.filter(dust=>dust.route===CARBON_REVISIT_POCKET.id).length<cPocket.length);
});

function traverseRoute(map,route,{drive=false,maxSeconds=45}={}){
  const config=flightConfig(),player=createFlight(config),dt=1/60,points=route.points;
  Object.assign(player,{x:points[0].x,y:points[0].y,angle:points[0].angle,vx:0,vy:0,speed:config.driftSpeed});
  let index=1;
  for(let frame=0;frame<maxSeconds/dt;frame++){
    const target=points[Math.min(index,points.length-1)],dx=target.x-player.x,dy=target.y-player.y,d=Math.hypot(dx,dy);
    if(d<24){if(index===points.length-1)return frame*dt;index=Math.min(points.length-1,index+3);continue;}
    player.drive=drive?DRIVES.combustion:null;player.combustion=drive;
    moveFlight(player,{x:dx/d,y:dy/d},dt,{config,environment:environmentAt(player,frame*dt,map)});
  }
  return Infinity;
}

test('revisit currents stay skill-traversable while COMBUSTION DRIVE is materially faster',()=>{
  const capabilities={combustionDrive:true},hMap=createMap(1,{H:0,C:0,O:0},{capabilities}),universe=createUniverse(1,{H:0,C:0,O:0},{capabilities});
  for(const [map,id] of [[hMap,'hydrogen-revisit'],[universe,'carbon-revisit']]){
    const route=routeBy(map,id),normal=traverseRoute(map,route),drive=traverseRoute(map,route,{drive:true});
    assert.ok(Number.isFinite(normal),`${id} normal propulsion must complete`);
    assert.ok(drive<normal*.7,`${id} DRIVE should be at least 30% faster (${drive.toFixed(2)}s vs ${normal.toFixed(2)}s)`);
    assert.equal(route.requiredCapability,undefined);assert.equal(route.requires,undefined);
  }
});

test('recovery is environmental only and DUST EATER remains global pursuit',async()=>{
  assert.deepEqual(ENVIRONMENT_RECOVERY_CONTRACT.excludes,[
    'dust-eater-suppression','dust-eater-despawn','threat-decay-bonus','capture-immunity','forced-enemy-distance','instant-heat-reset','instant-fuel-recovery',
  ]);
  const main=OXYGEN_ROUTES.find(route=>route.id==='oxygen-main').restStops[0],recoveryPoints=[
    {x:main.x,y:main.y,label:'Route B'},
    {x:OXYGEN_THERMAL.mergeRecovery.x,y:OXYGEN_THERMAL.mergeRecovery.y,label:'network merge'},
    {x:DEEP_OXYGEN_FRONTIER_RECOVERY.x,y:DEEP_OXYGEN_FRONTIER_RECOVERY.y,label:'Frontier'},
  ];
  for(const point of recoveryPoints){const env=environmentAt(point,0);assert.ok(Math.abs(env.pressure)<1,`${point.label} recovery pressure`);assert.ok(env.heat<5,`${point.label} recovery heat`);}
  const engine=await readFile(new URL('../src/veil/engine.js',import.meta.url),'utf8');
  assert.doesNotMatch(engine,/ENVIRONMENT_RECOVERY_CONTRACT|oxygenRestStopAt|deepOxygenFrontierRecoveryAt|environment-recovery/,'predator engine must not become recovery-aware');
  assert.match(engine,/safeSeconds=EXPEDITION\.safeSeconds\*tuning\.safeSecondsMultiplier/,'global pursuit may use centralized world tuning but not recovery-local state');
  assert.match(engine,/run\.threat=Math\.max\(0,run\.time-safeSeconds\)\*EXPEDITION\.threatPerSecond\*tuning\.threatPerSecondMultiplier\+dust\*EXPEDITION\.threatPerDustUnit\*tuning\.threatPerDustMultiplier/,'global threat calculation remains present through centralized tuning');
  assert.match(engine,/if\(run\.nearestEater<=EXPEDITION\.eaterContactRadius&&\!run\.forcedReturn\)\{\s*run\.captured=true/,'global capture remains present with a single-entry forced-return guard');
});

test('Task 6 signals/challenges stay unchanged and developer map exposes revisit/recovery semantics',()=>{
  assert.deepEqual(FIELD_SIGNALS.map(({id,region,complexity,x,y})=>({id,region,complexity,x,y})),[
    {id:'veil',region:'veil',complexity:undefined,x:390,y:-650},
    {id:'carbon',region:'carbon',complexity:undefined,x:840,y:-5660},
    {id:'oxygen-network',region:'oxygen',complexity:'route-choice',x:520,y:-9250},
    {id:'oxygen-deep',region:'oxygen',complexity:'deep',x:-280,y:-11100},
    {id:'oxygen-frontier',region:'frontier',complexity:'frontier',x:100,y:-11620},
  ]);
  assert.deepEqual(EXPEDITION_CHALLENGES.map(({id,rewards})=>({id,rewards})),[
    {id:'pulse',rewards:['dimethyl-ether','ethene','propene']},
    {id:'curve',rewards:['propane','phenol','formaldehyde']},
    {id:'thermal',rewards:['ethylene-glycol','n-hexane']},
  ]);
  const svg=buildFieldMapSvg();
  assert.doesNotMatch(svg,/id="route-hydrogen-revisit"/,'pre-DRIVE baseline must not contain H revisit');
  assert.doesNotMatch(svg,/id="route-carbon-revisit"/,'pre-DRIVE baseline must not contain C revisit');
  assert.match(svg,/id="post-drive-route-hydrogen-revisit"/);
  assert.match(svg,/id="post-drive-route-carbon-revisit"/);
  assert.match(svg,/data-revisit-current="hydrogen-revisit-current" data-force="90" data-width="180"/);
  assert.match(svg,/data-revisit-current="carbon-revisit-current" data-force="90" data-width="180"/);
  assert.match(svg,/data-revisit-pocket="hydrogen-revisit-pocket"/);
  assert.match(svg,/data-revisit-pocket="carbon-revisit-pocket"/);
  assert.match(svg,/environment recovery · Oを集めながら休む/);
  assert.match(svg,/environment recovery · network merge/);
  assert.match(svg,/environment recovery · Frontier approach/);
  assert.doesNotMatch(svg,/DUST EATER (?:SAFE ZONE|safe-zone|safe zone)|enemy safe/i);
});
