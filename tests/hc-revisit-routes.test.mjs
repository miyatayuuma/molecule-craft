import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {THERMAL} from '../src/veil/config.js';
import {createFlight,moveFlight} from '../src/veil/engine.js';
import {DRIVES,flightConfig} from '../src/veil/growth.js';
import {HYDROGEN_REVISIT_ROUTE,createMap} from '../src/veil/map.js';
import {
  CARBON_DEEP_Y,CARBON_REVISIT_ROUTE,ENVIRONMENT_RECOVERY_CONTRACT,FIELD_SIGNALS,createUniverse,environmentAt,
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

test('H/C revisit geometry is exact, connected, open and endpoint-complete',()=>{
  assert.deepEqual(HYDROGEN_REVISIT_ROUTE.knots,[[-520,-2200],[-930,-2450],[-850,-2950],[-800,-3090]]);
  assert.deepEqual(CARBON_REVISIT_ROUTE.knots,[[840,-5540],[1080,-6000],[980,-6500],[650,-6900],[170,-7190]]);
  assert.equal(HYDROGEN_REVISIT_ROUTE.id,'hydrogen-revisit');
  assert.equal(CARBON_REVISIT_ROUTE.id,'carbon-revisit');
  assert.equal(HYDROGEN_REVISIT_ROUTE.classification,'G0 / G1');
  assert.equal(CARBON_REVISIT_ROUTE.classification,'G0 / G1');

  const hMap=createMap(1,{H:0,C:0,O:0}),h=routeBy(hMap,HYDROGEN_REVISIT_ROUTE.id);
  assert.ok(h,'hydrogen revisit route exists');
  assert.ok(distance(h.points[0],HYDROGEN_REVISIT_ROUTE.knots[0])<=1);
  assert.ok(distance(h.points.at(-1),HYDROGEN_REVISIT_ROUTE.knots.at(-1))<=1,'H authored endpoint must survive sampling');
  assert.ok(nearest(routeBy(hMap,'safe'),HYDROGEN_REVISIT_ROUTE.knots[0])<=31,'H revisit begins on safe topology');
  assert.ok(nearest(routeBy(hMap,'detour'),HYDROGEN_REVISIT_ROUTE.knots.at(-1))<=31,'H revisit rejoins detour topology');

  const universe=createUniverse(1,{H:0,C:0,O:0}),c=routeBy(universe,CARBON_REVISIT_ROUTE.id);
  assert.ok(c,'carbon revisit route exists');
  assert.ok(distance(c.points[0],CARBON_REVISIT_ROUTE.knots[0])<=1);
  assert.ok(distance(c.points.at(-1),CARBON_REVISIT_ROUTE.knots.at(-1))<=1,'C authored endpoint must survive sampling');
  assert.ok(nearest(routeBy(universe,'carbon-sweep'),CARBON_REVISIT_ROUTE.knots[0])<=26,'C revisit begins on carbon-sweep topology');
  assert.ok(nearest(routeBy(universe,'carbon-main'),CARBON_REVISIT_ROUTE.knots.at(-1))<=26,'C revisit rejoins Carbon progression');
  for(const route of [h,c]){
    assert.equal(route.requiredCapability,undefined);
    assert.equal(route.requires,undefined);
    for(const point of route.points){const env=environmentAt(point,0);assert.ok(Math.abs(env.pressure)<25,`${route.id} must not contain a strong pressure gate`);assert.ok(env.heat<5,`${route.id} must stay non-thermal`);}
  }
});

test('revisit density hierarchy and Task 6 aggregate economy guardrails hold',()=>{
  const hMap=createMap(1,{H:0,C:0,O:0}),hRevisit=routeBy(hMap,'hydrogen-revisit');
  const hRevisitNorm=normalized(routeValue(hMap,'hydrogen-revisit'),lengthOf(hRevisit.points));
  const hOrdinary=Math.max(...['safe','detour'].map(id=>normalized(routeValue(hMap,id),lengthOf(routeBy(hMap,id).points))));
  const hAfter=hMap.dust.reduce((sum,dust)=>sum+dust.value,0);
  assert.ok(hRevisitNorm>=hOrdinary*1.5,`H revisit ${hRevisitNorm.toFixed(2)} must be >= 1.5x ordinary ${hOrdinary.toFixed(2)}`);
  assert.ok(hAfter/TASK6_BASELINE.hydrogenRegionValue<1.5,`H aggregate inflated ${hAfter/TASK6_BASELINE.hydrogenRegionValue}x`);

  const universe=createUniverse(1,{H:0,C:0,O:0}),ordinary=routeBy(universe,'carbon-sweep'),main=routeBy(universe,'carbon-main'),revisit=routeBy(universe,'carbon-revisit');
  const ordinaryNorm=normalized(routeValue(universe,'carbon-sweep','C'),lengthOf(ordinary.points));
  const deepPoints=main.points.filter(point=>point.y<=CARBON_DEEP_Y),deepNorm=normalized(routeValue(universe,'carbon-main','C',dust=>(dust.baseY??dust.y)<=CARBON_DEEP_Y),lengthOf(deepPoints));
  const revisitNorm=normalized(routeValue(universe,'carbon-revisit','C'),lengthOf(revisit.points));
  assert.ok(ordinaryNorm<deepNorm,`ordinary C ${ordinaryNorm.toFixed(2)} must stay below deep ${deepNorm.toFixed(2)}`);
  assert.ok(deepNorm<revisitNorm,`deep C ${deepNorm.toFixed(2)} must stay below revisit ${revisitNorm.toFixed(2)}`);
  assert.ok(revisitNorm>=ordinaryNorm*1.5&&revisitNorm<=ordinaryNorm*2.1,`C revisit ratio ${(revisitNorm/ordinaryNorm).toFixed(2)}x is outside intended range`);
  const carbonAfter=universe.dust.filter(dust=>dust.element==='C'&&(dust.baseY??dust.y)<=CARBON_REGION.bottom&&(dust.baseY??dust.y)>CARBON_REGION.top).reduce((sum,dust)=>sum+dust.value,0);
  assert.ok(carbonAfter/TASK6_BASELINE.carbonRegionValue<1.5,`C aggregate inflated ${carbonAfter/TASK6_BASELINE.carbonRegionValue}x`);
  console.log(`Task7 economy seed=1: H ${TASK6_BASELINE.hydrogenRegionValue} -> ${hAfter}; H revisit ${hRevisitNorm.toFixed(2)}/1000. C ${TASK6_BASELINE.carbonRegionValue} -> ${carbonAfter}; C ordinary ${ordinaryNorm.toFixed(2)}, deep ${deepNorm.toFixed(2)}, revisit ${revisitNorm.toFixed(2)}/1000.`);
});

test('normal propulsion passes revisit routes while BURST/DRIVE are materially faster',()=>{
  const hNormal=traverse(HYDROGEN_REVISIT_ROUTE.knots),hBurst=traverse(HYDROGEN_REVISIT_ROUTE.knots,{burst:true});
  assert.ok(Number.isFinite(hNormal),'normal propulsion must complete H revisit');
  assert.ok(hBurst<hNormal*.8,`BURST should materially shorten H revisit (${hBurst.toFixed(2)}s vs ${hNormal.toFixed(2)}s)`);
  const cNormal=traverse(CARBON_REVISIT_ROUTE.knots),cDrive=traverse(CARBON_REVISIT_ROUTE.knots,{drive:true});
  assert.ok(Number.isFinite(cNormal),'normal propulsion must complete C revisit');
  assert.ok(cDrive<cNormal*.75,`DRIVE should materially shorten C revisit (${cDrive.toFixed(2)}s vs ${cNormal.toFixed(2)}s)`);
  assert.ok(cDrive*THERMAL.heatPerSecond<THERMAL.hotThreshold,`C revisit continuous DRIVE should not itself cross thermal strain (${cDrive.toFixed(2)}s)`);
  console.log(`Task7 traversal: H normal ${hNormal.toFixed(2)}s / BURST ${hBurst.toFixed(2)}s; C normal ${cNormal.toFixed(2)}s / DRIVE ${cDrive.toFixed(2)}s.`);
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
  assert.match(engine,/run\.threat=Math\.max\(0,run\.time-EXPEDITION\.safeSeconds\)\*EXPEDITION\.threatPerSecond\+dust\*EXPEDITION\.threatPerDustUnit/,'global threat calculation remains present');
  assert.match(engine,/if\(run\.nearestEater<=EXPEDITION\.eaterContactRadius\)\{run\.captured=true/,'global capture remains present');
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
  assert.match(svg,/id="route-hydrogen-revisit"/);
  assert.match(svg,/id="route-carbon-revisit"/);
  assert.match(svg,/hydrogen-revisit · very-high H · spacing 20 \/ lanes 3 \/ value 1/);
  assert.match(svg,/carbon-revisit · very-high C · spacing 22 \/ lanes 3 \/ value 1/);
  assert.match(svg,/environment recovery · Oを集めながら休む/);
  assert.match(svg,/environment recovery · network merge/);
  assert.match(svg,/environment recovery · Frontier approach/);
  assert.doesNotMatch(svg,/DUST EATER (?:SAFE ZONE|safe-zone|safe zone)|enemy safe/i);
});
