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
const makeRun=(position=center,treatments={mechanical:0,abrasive:0,thermal:0,electrical:0})=>{const state=awakenedState(),config=flightConfig(state),map=createUniverse(73,state.elements,{capabilities}),run=createRun(map,config,{predators:false,treatments});Object.assign(run.player,{x:position.x,y:position.y,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});return run;};
const step=(run,input={x:1,y:0},seconds=.4)=>{for(let i=0;i<Math.round(seconds*60);i++)stepRun(run,input,1/60,{});return run;};
const electricalIntensity=run=>(run.currentHazards??[]).reduce((max,hazard)=>hazard.type==='electrical'?Math.max(max,Number(hazard.effectiveIntensity??hazard.intensity)||0):max,0);
function productionElectricalPass(treatments,x=650){
  const start={x,y:ELECTRICAL_FIELD.bounds.top+80},exitY=ELECTRICAL_FIELD.bounds.bottom-80,run=makeRun(start,treatments),chargeBefore=treatments.electrical??0;
  let integratedExposure=0,frames=0,sawElectrical=false;
  while(run.player.y>exitY&&frames<360){
    stepRun(run,{x:0,y:-1},1/60,{});
    const intensity=electricalIntensity(run);integratedExposure+=intensity/60;if(intensity>1e-6)sawElectrical=true;frames++;
  }
  assert.ok(run.player.y<=exitY,'representative flight must exit below the production charged region');
  return {run,integratedExposure,chargeBefore,chargeAfter:treatments.electrical??0,chargeSpent:chargeBefore-(treatments.electrical??0),sawElectrical,frames};
}

test('Electrical production field is post-Awakening only, deterministic and organic',()=>{
  const base=createUniverse(73,{H:0,C:0,O:0,N:0},{capabilities:{combustionDrive:true,nitrogenField:true}});
  const awakened=createUniverse(73,{H:0,C:0,O:0,N:0,P:0,S:0,F:0,Cl:0},{capabilities});
  assert.equal(environmentAt(center,0,base).hazards.some(item=>item.type==='electrical'),false);
  const centerHazard=environmentAt(center,0,awakened).hazards.find(item=>item.type==='electrical');assert.ok(centerHazard&&centerHazard.subtype==='charged-region');assert.equal(centerHazard.id,'carbon-sweep-charged-region');assert.equal(centerHazard.id,ELECTRICAL_FIELD.id);
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

test('representative production Electrical pass spends 8–15% from actual charged-region exposure',()=>{
  const treatments={mechanical:0,abrasive:0,thermal:0,electrical:1},pass=productionElectricalPass(treatments);
  assert.equal(pass.sawElectrical,true,'representative pass must enter the production Electrical field');
  assert.ok(pass.integratedExposure>=.8&&pass.integratedExposure<=1.5,`production pass exposure ${pass.integratedExposure.toFixed(3)} must remain within the F1 calibration band`);
  assert.ok(pass.chargeSpent>=.08&&pass.chargeSpent<=.15,`Electrical Treatment spent ${(pass.chargeSpent*100).toFixed(1)}% on one representative pass`);
  assert.ok(Math.abs(pass.chargeSpent-pass.integratedExposure/10)<1e-9,'Electrical durability must integrate raw production exposure against endurance 10');
});

test('repeated representative production passes deplete Electrical Treatment in 7–12 passes',()=>{
  const treatments={mechanical:0,abrasive:0,thermal:0,electrical:1};let passes=0,first=null;
  while(treatments.electrical>0&&passes<20){const pass=productionElectricalPass(treatments);first??=pass;passes++;}
  assert.ok(first.integratedExposure>=.8&&first.integratedExposure<=1.5);
  assert.equal(treatments.electrical,0);assert.ok(passes>=7&&passes<=12,`full Electrical Treatment depleted after ${passes} representative passes`);
});

test('safe Carbon traversal consumes no Electrical charge while lingering near the core drains faster than a pass',()=>{
  const safeTreatments={mechanical:0,abrasive:0,thermal:0,electrical:1},safePass=productionElectricalPass(safeTreatments,-380);
  assert.equal(safePass.sawElectrical,false);assert.equal(safePass.integratedExposure,0);assert.equal(safeTreatments.electrical,1,'production safe route must not consume Electrical Treatment');
  const passTreatments={mechanical:0,abrasive:0,thermal:0,electrical:1},pass=productionElectricalPass(passTreatments);
  const lingerTreatments={mechanical:0,abrasive:0,thermal:0,electrical:1},linger=makeRun(center,lingerTreatments);Object.assign(linger.player,{vx:0,vy:0,speed:0});
  step(linger,{x:0,y:0},2);
  const lingerSpent=1-lingerTreatments.electrical;assert.ok(lingerSpent>pass.chargeSpent,`2s core linger ${(lingerSpent*100).toFixed(1)}% should exceed representative pass ${(pass.chargeSpent*100).toFixed(1)}%`);
});

test('Electrical stress scales control response without copying Abrasive speed drag',()=>{
  const weak=electricalResponseFor(.3),strong=electricalResponseFor(.9);
  assert.ok(strong.controlAuthority<weak.controlAuthority&&strong.propulsionAuthority<weak.propulsionAuthority);
  const run=makeRun();stepRun(run,{x:1,y:0},1/60,{});
  assert.ok(run.currentHazards.some(item=>item.type==='electrical'&&item.effectiveIntensity>0));assert.ok(run.electricalControlAuthority<1&&run.electricalPropulsionAuthority<1);assert.equal(run.hazardEffectMultipliers.electrical,1,'inactive Electrical treatment preserves Task 5E semantics');
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
  assert.equal(run.hazardEffectMultipliers.electrical,1);assert.deepEqual(HAZARD_TREATMENT_IDS,['mechanical','abrasive','thermal','electrical']);
  Object.assign(run.player,{x:safe.x,y:safe.y,vx:0,vy:-run.config.speed,speed:run.config.speed});stepRun(run,{x:0,y:-1},1/60,{});
  assert.equal(run.currentHazards.some(item=>item.type==='electrical'),false);assert.equal(run.electricalControlAuthority,1);assert.equal(run.electricalPropulsionAuthority,1);
});

test('Electrical Treatment mitigates steering and propulsion response by 45% without changing hazard intensity or other treatment families',()=>{
  const untreated=makeRun(center,{mechanical:0,abrasive:0,thermal:0,electrical:0}),treatedState={mechanical:1,abrasive:1,thermal:1,electrical:1},treated=makeRun(center,treatedState);
  stepRun(untreated,{x:1,y:0},1/60,{});stepRun(treated,{x:1,y:0},1/60,{});
  const rawUntreated=untreated.currentHazards.find(item=>item.type==='electrical')?.effectiveIntensity,rawTreated=treated.currentHazards.find(item=>item.type==='electrical')?.effectiveIntensity;
  assert.equal(rawTreated,rawUntreated,'ship protection does not alter world-side Electrical intensity');
  assert.equal(treated.hazardEffectMultipliers.electrical,.55);assert.ok(treated.electricalControlAuthority>untreated.electricalControlAuthority);assert.ok(treated.electricalPropulsionAuthority>untreated.electricalPropulsionAuthority);
  assert.ok(treatedState.electrical<1,'pre-mitigation effective intensity consumes Electrical charge');assert.equal(treatedState.mechanical,1);assert.equal(treatedState.abrasive,1);assert.equal(treatedState.thermal,1);
});

test('Electrical visuals and developer map derive from the same effective-intensity authority',async()=>{
  const rendererSource=await readFile(new URL('../src/veil/renderer.js',import.meta.url),'utf8');
  assert.match(rendererSource,/electricalEffectiveAt\(sample,run\.map\.worldState\)/,'renderer samples production Electrical effective intensity directly');
  assert.match(rendererSource,/run\.time.*sample\.phase/s,'arc timing is presentation-only and deterministic from run time / fixed phase');
  const svg=buildFieldMapSvg(),lobeCount=(svg.match(/data-electrical-lobe=/g)??[]).length;
  assert.equal(lobeCount,ELECTRICAL_FIELD.lobes.length);assert.match(svg,/data-hazard-type="electrical"/);assert.match(svg,/data-hazard-subtype="charged-region"/);
});
