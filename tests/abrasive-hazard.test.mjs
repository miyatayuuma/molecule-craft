import test from 'node:test';
import assert from 'node:assert/strict';
import {ABRASIVE_PLUME,abrasiveEffectiveAt,abrasiveSpatialAt} from '../src/veil/abrasive-field.js';
import {createUniverse,environmentAt} from '../src/veil/universe.js';
import {createRun,stepRun} from '../src/veil/engine.js';
import {createInitialResourcesState} from '../src/veil/resources-persistence.js';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {flightConfig} from '../src/veil/growth.js';
import {HAZARD_TREATMENT_EFFECT_MULTIPLIER} from '../src/veil/hazard-treatments.js';

const capabilities=Object.freeze({combustionDrive:true,nitrogenField:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true});
const center={x:ABRASIVE_PLUME.lobes[1].x,y:ABRASIVE_PLUME.lobes[1].y};
const awakenedState=()=>{const state=createInitialResourcesState();Object.assign(state.progress,{choCompleted:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true});return state;};
const makeRun=treatments=>{const state=awakenedState(),config=flightConfig(state),map=createUniverse(73,state.elements,{capabilities}),run=createRun(map,config,{predators:false,treatments});Object.assign(run.player,{x:center.x,y:center.y,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});return run;};
const fly=(run,seconds=2)=>{for(let i=0;i<seconds*60;i++)stepRun(run,{x:0,y:-1},1/60,{});return Math.hypot(run.player.x-center.x,run.player.y-center.y);};

test('Abrasive production field is post-Awakening only and uses continuous organic falloff',()=>{
  const base=createUniverse(73,{H:0,C:0,O:0,N:0},{capabilities:{combustionDrive:true,nitrogenField:true}});
  const awakened=createUniverse(73,{H:0,C:0,O:0,N:0,P:0,S:0,F:0,Cl:0},{capabilities});
  assert.equal(environmentAt(center,0,base).hazards.some(item=>item.type==='abrasive'),false);
  const centerHazard=environmentAt(center,0,awakened).hazards.find(item=>item.type==='abrasive');assert.ok(centerHazard&&centerHazard.subtype==='particle-stream');
  const edge={x:center.x+ABRASIVE_PLUME.lobes[1].rx*.72,y:center.y},outside={x:ABRASIVE_PLUME.bounds.right+120,y:center.y};
  assert.ok(abrasiveSpatialAt(center)>abrasiveSpatialAt(edge)&&abrasiveSpatialAt(edge)>abrasiveSpatialAt(outside));
  assert.equal(abrasiveSpatialAt(outside),0);
  assert.ok(abrasiveEffectiveAt(center,'awakened')>abrasiveEffectiveAt(edge,'awakened'));
  assert.equal(abrasiveEffectiveAt(center,'base'),0);
  assert.deepEqual(ABRASIVE_PLUME.lobes.map(lobe=>lobe.id),['upper','middle','lower','tail']);
});

test('S treatment mitigates the same production Abrasive exposure while P/F remain isolated',()=>{
  const untreated=makeRun({mechanical:0,abrasive:0,thermal:0}),treatedState={mechanical:0,abrasive:1,thermal:0},treated=makeRun(treatedState),wrongState={mechanical:1,abrasive:0,thermal:1},wrong=makeRun(wrongState);
  const untreatedDistance=fly(untreated),treatedDistance=fly(treated),wrongDistance=fly(wrong);
  assert.ok(untreated.currentHazards.some(item=>item.type==='abrasive'&&item.effectiveIntensity>0));
  assert.equal(treated.hazardEffectMultipliers.abrasive,HAZARD_TREATMENT_EFFECT_MULTIPLIER);
  assert.equal(untreated.hazardEffectMultipliers.abrasive,1);assert.equal(wrong.hazardEffectMultipliers.abrasive,1);
  assert.ok(treatedDistance>untreatedDistance*1.06,'S treatment should make the same plume trajectory measurably easier');
  assert.ok(Math.abs(wrongDistance-untreatedDistance)<1,'P/F treatments must not reduce Abrasive drag');
  assert.ok(treatedState.abrasive<1,'Abrasive exposure consumes S treatment charge');
  assert.equal(wrongState.mechanical,1);assert.equal(wrongState.thermal,1);
});

test('Abrasive charge consumption uses pre-mitigation effective intensity and persists through settlement/reload',()=>{
  let raw=null;const storage={getItem:key=>key===RESOURCE_KEY?raw:null,setItem:(key,value)=>{if(key===RESOURCE_KEY)raw=String(value);},removeItem:()=>{}},resources=createResources({storage});
  Object.assign(resources.state.progress,{choCompleted:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true});resources.state.treatments.abrasive=1;resources.save();
  const config=flightConfig(resources.state),map=createUniverse(73,resources.state.elements,{capabilities}),run=createRun(map,config,{predators:false,treatments:resources.state.treatments});Object.assign(run.player,{x:center.x,y:center.y,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});
  const first=environmentAt(center,0,map).hazards.find(item=>item.type==='abrasive').effectiveIntensity,dt=1/60;stepRun(run,{x:0,y:-1},dt,{});
  const expected=1-first*dt/100;assert.ok(Math.abs(resources.state.treatments.abrasive-expected)<.0002,'charge follows pre-mitigation effective intensity');
  const residual=resources.state.treatments.abrasive;resources.settleExpedition({H:0,C:0,N:0,O:0,P:0,S:0,F:0,Cl:0},0,true);
  assert.ok(Math.abs(resources.state.treatments.abrasive-residual)<1e-10);
  const reloaded=createResources({storage});assert.ok(Math.abs(reloaded.state.treatments.abrasive-residual)<1e-10);
});
