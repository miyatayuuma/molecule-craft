import test from 'node:test';
import assert from 'node:assert/strict';
import {ABRASIVE_PLUME,abrasiveEffectiveAt,abrasiveSpatialAt} from '../src/veil/abrasive-field.js';
import {createUniverse,environmentAt} from '../src/veil/universe.js';
import {createRun,stepRun} from '../src/veil/engine.js';
import {createInitialResourcesState} from '../src/veil/resources-persistence.js';
import {flightConfig} from '../src/veil/growth.js';

const capabilities=Object.freeze({combustionDrive:true,nitrogenField:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true});
const center={x:ABRASIVE_PLUME.lobes[1].x,y:ABRASIVE_PLUME.lobes[1].y};
const awakenedState=()=>{const state=createInitialResourcesState();Object.assign(state.progress,{choCompleted:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true});return state;};
const makeRun=()=>{const state=awakenedState(),config=flightConfig(state),map=createUniverse(73,state.elements,{capabilities}),run=createRun(map,config,{predators:false});Object.assign(run.player,{x:center.x,y:center.y,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});return run;};

test('Abrasive production field is post-Awakening only and uses continuous organic falloff',()=>{
  const base=createUniverse(73,{H:0,C:0,O:0,N:0},{capabilities:{combustionDrive:true,nitrogenField:true}});
  const awakened=createUniverse(73,{H:0,C:0,O:0,N:0,P:0,S:0,F:0,Cl:0},{capabilities});
  assert.equal(environmentAt(center,0,base).hazards.some(item=>item.type==='abrasive'),false);
  const centerHazard=environmentAt(center,0,awakened).hazards.find(item=>item.type==='abrasive');assert.ok(centerHazard&&centerHazard.subtype==='particle-stream');
  const edge={x:center.x+ABRASIVE_PLUME.lobes[1].rx*.72,y:center.y},outside={x:ABRASIVE_PLUME.bounds.right+120,y:center.y};
  assert.ok(abrasiveSpatialAt(center)>abrasiveSpatialAt(edge)&&abrasiveSpatialAt(edge)>abrasiveSpatialAt(outside));assert.equal(abrasiveSpatialAt(outside),0);
  assert.ok(abrasiveEffectiveAt(center,'awakened')>abrasiveEffectiveAt(edge,'awakened'));assert.equal(abrasiveEffectiveAt(center,'base'),0);
  assert.deepEqual(ABRASIVE_PLUME.lobes.map(lobe=>lobe.id),['upper','middle','lower','tail']);
});

test('Abrasive FIELD applies raw exposure directly, without persistent mitigation state',()=>{
  const run=makeRun(),before={x:run.player.x,y:run.player.y};stepRun(run,{x:0,y:-1},1/60,{});
  const raw=run.currentHazards.find(item=>item.type==='abrasive')?.effectiveIntensity;assert.ok(raw>0);
  assert.equal(run.treatments,undefined);assert.equal(run.hazardEffectMultipliers,undefined);
  assert.ok(run.player.x!==before.x||run.player.y!==before.y,'raw abrasive exposure enters FIELD movement');
});
