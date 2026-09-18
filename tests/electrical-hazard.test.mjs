import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ABRASIVE_PLUME,abrasiveSpatialAt} from '../src/veil/abrasive-field.js';
import {ELECTRICAL_FIELD,electricalEffectiveAt,electricalResponseFor,electricalSpatialAt} from '../src/veil/electrical-field.js';
import {createUniverse,environmentAt,BURST_ADVANTAGE_FIELDS} from '../src/veil/universe.js';
import {createFlight,createRun,moveFlight,stepRun} from '../src/veil/engine.js';
import {createInitialResourcesState} from '../src/veil/resources-persistence.js';
import {flightConfig} from '../src/veil/growth.js';
import {HAZARD_TREATMENT_IDS} from '../src/veil/hazard-treatments.js';
import {buildFieldMapSvg} from '../scripts/export-field-map.mjs';

const capabilities=Object.freeze({combustionDrive:true,nitrogenField:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true});
const center={x:ELECTRICAL_FIELD.lobes[1].x,y:ELECTRICAL_FIELD.lobes[1].y};
const safe={x:250,y:center.y};
const awakenedState=()=>{const state=createInitialResourcesState();Object.assign(state.progress,{choCompleted:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true});return state;};
const makeRun=(position=center,treatments={mechanical:0,abrasive:0,thermal:0})=>{const state=awakenedState(),config=flightConfig(state),map=createUniverse(73,state.elements,{capabilities}),run=createRun(map,config,{predators:false,treatments});Object.assign(run.player,{x:position.x,y:position.y,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});return run;};
const step=(run,input={x:1,y:0},seconds=.4)=>{for(let i=0;i<Math.round(seconds*60);i++)stepRun(run,input,1/60,{});return run;};

test('Electrical production field is post-Awakening only, deterministic and organic',()=>{
  const base=createUniverse(73,{H:0,C:0,O:0,N:0},{capabilities:{combustionDrive:true,nitrogenField:true}});
  const awakened=createUniverse(73,{H:0,C:0,O:0,N:0,P:0,S:0,F:0,Cl:0},{capabilities});
  assert.equal(environmentAt(center,0,base).hazards.some(item=>item.type==='electrical'),false);
  const centerHazard=environmentAt(center,0,awakened).hazards.find(item=>item.type==='electrical');assert.ok(centerHazard&&centerHazard.subtype==='charged-region');
  const edge={x:center.x+ELECTRICAL_FIELD.lobes[1].rx*.72,y:center.y},outside={x:ELECTRICAL_FIELD.bounds.left-80,y:center.y};
  assert.ok(electricalSpatialAt(center)>electricalSpatialAt(edge)&&electricalSpatialAt(edge)>electricalSpatialAt(outside));assert.equal(electricalSpatialAt(outside),0);
  assert.ok(electricalEffectiveAt(center,'awakened')>electricalEffectiveAt(edge,'awakened'));assert.equal(electricalEffectiveAt(center,'base'),0);
  const otherSeed=createUniverse(991,{H:0,C:0,O:0,N:0,P:0,S:0,F:0,Cl:0},{capabilities}),otherHazard=environmentAt(center,0,otherSeed).hazards.find(item=>item.type==='electrical');
  assert.equal(otherHazard.effectiveIntensity,centerHazard.effectiveIntensity,'Electrical geometry does not reroll with launch seed');
  assert.deepEqual(ELECTRICAL_FIELD.lobes.map(lobe=>lobe.id),['entry','core','branch','tail']);
});

test('Electrical placement preserves a safe main-route choice and avoids existing Abrasive / BURST shear cores',()=>{
  assert.equal(electricalSpatialAt({x:-380,y:-5340}),0,'carbon-main remains outside the Electrical field');
  const carbonShear=BURST_ADVANTAGE_FIELDS.find(field=>field.id==='carbon-sweep-shear');assert.ok(carbonShear);
  assert.equal(electricalSpatialAt(carbonShear),0,'Electrical field does not stack on the Carbon BURST shear core');
  assert.equal(abrasiveSpatialAt(center),0,'Electrical core stays separate from the lower Carbon Abrasive plume');
  assert.ok(Math.hypot(center.x-ABRASIVE_PLUME.lobes[0].x,center.y-ABRASIVE_PLUME.lobes[0].y)>700);
});

test('Electrical stress scales control response without copying Abrasive speed drag',()=>{
  const weak=electricalResponseFor(.3),strong=electricalResponseFor(.9);
  assert.ok(strong.controlAuthority<weak.controlAuthority&&strong.propulsionAuthority<weak.propulsionAuthority);
  const run=makeRun();stepRun(run,{x:1,y:0},1/60,{});
  assert.ok(run.currentHazards.some(item=>item.type==='electrical'&&item.effectiveIntensity>0));assert.ok(run.electricalControlAuthority<1&&run.electricalPropulsionAuthority<1);assert.equal(run.hazardEffectMultipliers.electrical,1,'Task 5E has no Electrical treatment');
  const config=run.config,normal=createFlight(config),stressed=createFlight(config),response=electricalResponseFor(electricalEffectiveAt(center,'awakened'));
  for(const player of [normal,stressed])Object.assign(player,{x:0,y:0,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});
  moveFlight(normal,{x:1,y:0},.2,{config,environment:{controlAuthority:1,propulsionAuthority:1}});moveFlight(stressed,{x:1,y:0},.2,{config,environment:response});
  const normalTurn=Math.abs(normal.angle+Math.PI/2),stressedTurn=Math.abs(stressed.angle+Math.PI/2);assert.ok(stressedTurn<normalTurn,'Electrical control authority directly softens steering response');
  for(const player of [normal,stressed])Object.assign(player,{angle:-Math.PI/2,vx:0,vy:0,speed:config.driftSpeed});
  moveFlight(normal,{x:0,y:-1},.2,{config,environment:{controlAuthority:1,propulsionAuthority:1}});moveFlight(stressed,{x:0,y:-1},.2,{config,environment:response});assert.ok(stressed.speed<normal.speed,'Electrical propulsion authority slows response without reducing the target speed itself');
});

test('Electrical penalty clears on exit and P/S/F treatments remain isolated',()=>{
  const treatments={mechanical:1,abrasive:1,thermal:1},run=makeRun(center,treatments);stepRun(run,{x:1,y:0},1/60,{});
  assert.ok(run.electricalControlAuthority<1);assert.deepEqual(treatments,{mechanical:1,abrasive:1,thermal:1},'existing treatment charges cannot be consumed by Electrical exposure');
  assert.equal(run.hazardEffectMultipliers.electrical,1);assert.deepEqual(HAZARD_TREATMENT_IDS,['mechanical','abrasive','thermal']);
  Object.assign(run.player,{x:safe.x,y:safe.y,vx:0,vy:-run.config.speed,speed:run.config.speed});stepRun(run,{x:0,y:-1},1/60,{});
  assert.equal(run.currentHazards.some(item=>item.type==='electrical'),false);assert.equal(run.electricalControlAuthority,1);assert.equal(run.electricalPropulsionAuthority,1);
});

test('Electrical visuals and developer map derive from the same effective-intensity authority',async()=>{
  const rendererSource=await readFile(new URL('../src/veil/renderer.js',import.meta.url),'utf8');
  assert.match(rendererSource,/electricalEffectiveAt\(sample,run\.map\.worldState\)/,'renderer samples production Electrical effective intensity directly');
  assert.match(rendererSource,/run\.time.*sample\.phase/s,'arc timing is presentation-only and deterministic from run time / fixed phase');
  const svg=buildFieldMapSvg(),lobeCount=(svg.match(/data-electrical-lobe=/g)??[]).length;
  assert.equal(lobeCount,ELECTRICAL_FIELD.lobes.length);assert.match(svg,/data-hazard-type="electrical"/);assert.match(svg,/data-hazard-subtype="charged-region"/);
});
