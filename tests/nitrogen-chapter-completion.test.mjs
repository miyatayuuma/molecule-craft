import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPEDITION} from '../src/veil/config.js';
import {createRun,stepRun} from '../src/veil/expedition-run.js';
import {flightConfig} from '../src/veil/growth.js';
import {createUniverse} from '../src/veil/universe.js';
import {NITROGEN_ENTRY,NITROGEN_REGION_BOUNDS} from '../src/veil/nitrogen-config.js';
import {
  NITROGEN_CORE,NITROGEN_HAZARDS,NITROGEN_HIGH_DENSITY_POCKET,NITROGEN_INSIGHT_ANCHORS,
  NITROGEN_PULSE_FIELD,NITROGEN_RECOVERY_AREAS,NITROGEN_ROUTE,NITROGEN_SIDE_ROUTE,NITROGEN_ZONES,
  nitrogenHazardEffectiveAt,
} from '../src/veil/nitrogen-routes.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const routeLength=route=>route.points.slice(1).reduce((sum,point,index)=>sum+distance(point,route.points[index]),0);
const postCho={progress:{choCompleted:true},elements:{H:0,C:0,N:0,O:0},recipes:['hydrogen','methane','oxygen','water']};

test('Nitrogen v3 uses the authored compact mainline, six sections and connected optional side pocket',()=>{
  assert.deepEqual(NITROGEN_ENTRY,{x:280,y:-12920,angle:-Math.PI/2});
  assert.deepEqual(NITROGEN_REGION_BOUNDS,{left:-1250,right:1350,top:-18150,bottom:500});
  assert.ok(Math.abs(routeLength(NITROGEN_ROUTE)-5347)<100,`main route is ${routeLength(NITROGEN_ROUTE).toFixed(1)}`);
  assert.ok(Math.abs(routeLength(NITROGEN_SIDE_ROUTE)-1760)<40,`side route is ${routeLength(NITROGEN_SIDE_ROUTE).toFixed(1)}`);
  assert.deepEqual(NITROGEN_ZONES.map(({id,width})=>[id,width]),[
    ['entry-pocket',720],['drive-channel',760],['choice-shelf',700],['pulse-lip',520],['insight-basin',680],['core-approach',720],
  ]);
  for(const route of [NITROGEN_ROUTE,NITROGEN_SIDE_ROUTE])for(const point of route.points){
    assert.ok(point.x>=NITROGEN_REGION_BOUNDS.left&&point.x<=NITROGEN_REGION_BOUNDS.right,`${route.id} x bound`);
    assert.ok(point.y>=NITROGEN_REGION_BOUNDS.top&&point.y<=NITROGEN_REGION_BOUNDS.bottom,`${route.id} y bound`);
  }
  assert.deepEqual([NITROGEN_ROUTE.waypoints[4].x,NITROGEN_ROUTE.waypoints[4].y],[NITROGEN_SIDE_ROUTE.waypoints[0].x,NITROGEN_SIDE_ROUTE.waypoints[0].y]);
  assert.deepEqual([NITROGEN_ROUTE.waypoints[5].x,NITROGEN_ROUTE.waypoints[5].y],[NITROGEN_SIDE_ROUTE.waypoints.at(-1).x,NITROGEN_SIDE_ROUTE.waypoints.at(-1).y]);
  const map=createUniverse(41,postCho.elements,{capabilities:{combustionDrive:true,nitrogenField:true}});
  assert.ok(map.routes.some(route=>route.id===NITROGEN_ROUTE.id));assert.ok(map.routes.some(route=>route.id===NITROGEN_SIDE_ROUTE.id&&route.optional));
  assert.equal(map.nitrogenZones.length,6);assert.equal(map.nitrogenSideRoute,NITROGEN_SIDE_ROUTE);
});

test('Nitrogen v3 authors local N groups, recovery, PULSE lip and the three resonance anchors',()=>{
  assert.deepEqual(NITROGEN_RECOVERY_AREAS.map(({id,x,y,radius,safeExtraction})=>[id,x,y,radius,safeExtraction]),[
    ['nitrogen-side-recovery',-500,-15380,220,true],['nitrogen-regroup-basin',-180,-16680,210,false],
  ]);
  assert.deepEqual(NITROGEN_HIGH_DENSITY_POCKET,{id:'nitrogen-high-density-pocket',x:-760,y:-15700,angle:-Math.PI/2,radius:170,particles:36,value:2});
  assert.deepEqual(NITROGEN_INSIGHT_ANCHORS.map(({x,y})=>[x,y]),[[-180,-16680],[80,-16980],[0,-17520]]);
  assert.deepEqual([NITROGEN_CORE.x,NITROGEN_CORE.y,NITROGEN_CORE.radius,NITROGEN_CORE.fractureRadius],[0,-17700,210,260]);
  const map=createUniverse(41,postCho.elements,{capabilities:{combustionDrive:true,nitrogenField:true}});
  assert.deepEqual(map.nitrogenCore,{...NITROGEN_CORE,fractured:false});
  assert.deepEqual(map.nitrogenPulseField,{...NITROGEN_PULSE_FIELD});assert.ok(map.fields.includes(map.nitrogenPulseField));
  assert.equal(map.nitrogenPulseField.kind,'burst-advantage');assert.deepEqual(map.signals.filter(signal=>signal.nitrogenCritical).map(({x,y,captureRadius})=>[x,y,captureRadius]),[[-180,-16680,160],[80,-16980,160],[0,-17520,160]]);
  assert.equal(NITROGEN_HAZARDS.length,6);
  for(const hazard of NITROGEN_HAZARDS){const center=nitrogenHazardEffectiveAt(hazard,{x:hazard.x,y:hazard.y},0,41),edge=nitrogenHazardEffectiveAt(hazard,{x:hazard.x+hazard.radius*.9,y:hazard.y},0,41);assert.ok(center.scale>edge.scale&&edge.scale>=0,'hazard strength fades spatially');}
  for(const hazard of NITROGEN_HAZARDS){
    const base=nitrogenHazardEffectiveAt(hazard,{x:hazard.x,y:hazard.y},0,41,{worldState:'base'}),awake=nitrogenHazardEffectiveAt(hazard,{x:hazard.x,y:hazard.y},0,41,{worldState:'awakened'});
    assert.equal(base.spatial,awake.spatial,'Awakening cannot move or reshape hazard fields');assert.ok(awake.scale>base.scale,'existing multiplier increases post-Awakening effective intensity');
  }
});

test('Dust Eater keeps its global lifecycle and stays bounded in compact Nitrogen FIELD',()=>{
  const config=flightConfig(postCho),map=createUniverse(41,postCho.elements,{capabilities:{combustionDrive:true,nitrogenField:true}}),run=createRun(map,config,{predators:true}),start=NITROGEN_ROUTE.points[0];Object.assign(run.player,{x:start.x,y:start.y,vx:0,vy:0,angle:start.angle});
  run.time=EXPEDITION.safeSeconds+.2;run.elementDust.N=1000;stepRun(run,{x:0,y:-1},.15,{});
  assert.ok(run.eaters.length>0,'Nitrogen continues using the global DUST EATER lifecycle');
  const margin=EXPEDITION.eaterSpawnDistance+100;for(const eater of run.eaters){assert.ok(Number.isFinite(eater.x)&&Number.isFinite(eater.y));assert.ok(eater.x>=run.config.bounds.left-margin&&eater.x<=run.config.bounds.right+margin);assert.ok(eater.y>=run.config.bounds.top-margin&&eater.y<=run.config.bounds.bottom+margin);}
});
