import test from 'node:test';
import assert from 'node:assert/strict';
import {createUniverse,environmentAt} from '../src/veil/universe.js';
import {createRun,beginShock,stepRun} from '../src/veil/expedition-run.js';
import {flightConfig} from '../src/veil/growth.js';
import {createInitialResourcesState,migrateResourcesSave,serializeResourcesState} from '../src/veil/resources-persistence.js';
import {CARBON_CHARGED_ANCHOR} from '../src/veil/shock-structures.js';
import {ELECTRICAL_FIELD,electricalEffectiveAt} from '../src/veil/electrical-field.js';
import {shockProfileFor} from '../src/veil/shock.js';

const zeroStock=()=>({H:0,C:0,N:0,O:0,P:0,S:0,F:0,Cl:0});
const awakenedCapabilities=Object.freeze({combustionDrive:true,nitrogenField:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true});
const baseCapabilities=Object.freeze({combustionDrive:true,nitrogenField:true,coreFractured:false,worldAwakened:false,rareEcologyEligible:false});

function stateFor(awakened=true){
  const state=createInitialResourcesState();
  Object.assign(state.progress,{choCompleted:true,coreFractured:awakened,worldAwakened:awakened,rareEcologyEligible:awakened});
  return state;
}

function productionRun({awakened=false,distance=180,material='nitromethane',amount=3}={}){
  const state=stateFor(awakened),capabilities=awakened?awakenedCapabilities:baseCapabilities,map=createUniverse(17,zeroStock(),{capabilities}),config=flightConfig(state),run=createRun(map,config,{predators:true,fuel:{shock:{molecule:material,amount,capacity:shockProfileFor(material).capacity}}});
  Object.assign(run.player,{x:0,y:0,vx:0,vy:0,speed:0,angle:0});
  run.nextEaterSpawn=Infinity;
  const targetSpeed=168*(awakened?1.10:1);
  run.eaters=[{id:0,x:distance,y:0,angle:Math.PI,speed:targetSpeed,targetSpeed,vx:-targetSpeed,vy:0,phase:0,flank:0,lead:0,trail:[]}];
  return run;
}

function productionRecontact({awakened,distance,material='nitromethane'}={}){
  const run=productionRun({awakened,distance,material}),event=beginShock(run,()=>true);let recontact=null;
  for(let frame=0;frame<600;frame++){
    stepRun(run,{x:0,y:0},1/60,{});
    if(run.captured){recontact=run.time;break;}
  }
  return {run,event,recontact};
}

test('Nitromethane keeps its radius/capacity identity while providing the calibrated reset',()=>{
  const nitro=shockProfileFor('nitromethane'),tnt=shockProfileFor('2-4-6-trinitrotoluene');
  assert.deepEqual({capacity:nitro.capacity,radius:nitro.radius,knockback:nitro.knockback,interrupt:+nitro.interruptSeconds.toFixed(2)},{capacity:3,radius:260,knockback:383.4,interrupt:.9});
  assert.equal(nitro.radius,tnt.radius/1.45);assert.equal(nitro.capacity,3);assert.equal(tnt.capacity,2);
});

test('SHOCK cancels only inward radial Eater velocity and preserves tangent/outward motion',()=>{
  const run=productionRun({distance:120});
  run.eaters[0].vx=-90;run.eaters[0].vy=37;
  const beforePosition={x:run.eaters[0].x,y:run.eaters[0].y},event=beginShock(run,()=>true),eater=run.eaters[0];
  assert.equal(event.affected,1);assert.equal(run.eaters.length,1);assert.ok(eater.x>beforePosition.x,'SHOCK must create immediate outward separation');
  const radial=eater.vx, tangent=eater.vy;
  assert.ok(radial>0,'the inward radial component must be removed before the outward impulse');
  assert.equal(tangent,37,'tangential velocity must be preserved');
  assert.ok(eater.interrupt>0);assert.equal(run.captured,false);

  const outward=productionRun({distance:120});outward.eaters[0].vx=90;outward.eaters[0].vy=37;beginShock(outward,()=>true);
  assert.ok(outward.eaters[0].vx>90,'an existing outward radial velocity must not be cancelled');assert.equal(outward.eaters[0].vy,37);
});

test('production Dust Eater reset meets the awakened 2.25 second representative window',()=>{
  for(const awakened of [false,true])for(const distance of [80,120,180,240]){
    const {run,event,recontact}=productionRecontact({awakened,distance});
    assert.equal(event.affected,1,`${awakened?'awakened':'base'} ${distance}: Eater must be hit`);
    assert.equal(run.eaters.length,1,`${awakened?'awakened':'base'} ${distance}: Eater remains alive`);
    assert.ok(recontact!==null,`${awakened?'awakened':'base'} ${distance}: fixture must eventually recontact`);
    if(awakened)assert.ok(recontact>=2.25-1e-9,`awakened ${distance}: recontact ${recontact.toFixed(3)}s`);
  }
  const close=productionRecontact({awakened:true,distance:48});assert.equal(close.event.affected,1);assert.equal(close.run.eaters.length,1);assert.ok(close.event.interruptSeconds>.8);
});

test('TNT retains wider/stronger cluster control without a target-count cap',()=>{
  const nitro=productionRun({material:'nitromethane',distance:300}),tnt=productionRun({material:'2-4-6-trinitrotoluene',distance:300});
  assert.equal(beginShock(nitro,()=>true).affected,0);assert.equal(beginShock(tnt,()=>true).affected,1);
  const cluster=productionRun({material:'2-4-6-trinitrotoluene',distance:180,amount:2});cluster.eaters.push({...cluster.eaters[0],id:1,x:360});
  const clusterEvent=beginShock(cluster,()=>true);assert.equal(clusterEvent.affected,2);assert.equal(cluster.eaters.length,2);assert.equal(cluster.fuel.shock.amount,1);
});

test('Carbon Charged Anchor is exactly one awakened, optional, run-local structure',()=>{
  const pre=createUniverse(17,zeroStock(),{capabilities:baseCapabilities}),awakened=createUniverse(17,zeroStock(),{capabilities:awakenedCapabilities});
  assert.equal(pre.shockStructures.length,0);assert.equal(awakened.shockStructures.length,1);
  const anchor=awakened.shockStructures[0];assert.deepEqual({...anchor},{...CARBON_CHARGED_ANCHOR,active:true,fractured:false,fracturedAt:null});
  assert.equal(anchor.route,'carbon-sweep');assert.ok(Math.hypot(anchor.x-660,anchor.y+5370)<=40);assert.equal(anchor.targetHazard,ELECTRICAL_FIELD.id);
  assert.equal(environmentAt(anchor,0,pre).hazards.some(hazard=>hazard.id===ELECTRICAL_FIELD.id),false);
  assert.ok(environmentAt(anchor,0,awakened).hazards.some(hazard=>hazard.id===ELECTRICAL_FIELD.id));
});

test('Nitro/TNT each fracture the Anchor once, out-of-range and empty waves do not',()=>{
  for(const material of ['nitromethane','2-4-6-trinitrotoluene']){
    const run=productionRun({awakened:true,distance:1,material,amount:1});Object.assign(run.player,{x:CARBON_CHARGED_ANCHOR.x,y:CARBON_CHARGED_ANCHOR.y});run.eaters[0].x=run.player.x+1000;
    const event=beginShock(run,()=>true);assert.equal(event.anchorFractured,true);assert.deepEqual(event.structuresFractured,['carbon-charged-anchor']);assert.equal(run.fuel.shock.amount,0);assert.equal(run.map.shockStructures[0].fractured,true);const at=run.map.shockStructures[0].fracturedAt;
    assert.equal(beginShock(run,()=>true),false);assert.equal(run.map.shockStructures[0].fracturedAt,at);
  }
  const out=productionRun({awakened:true,distance:1,amount:1});Object.assign(out.player,{x:CARBON_CHARGED_ANCHOR.x+500,y:CARBON_CHARGED_ANCHOR.y});out.eaters[0].x=out.player.x+1000;assert.equal(beginShock(out,()=>true).anchorFractured,false);assert.equal(out.map.shockStructures[0].fractured,false);
  const empty=productionRun({awakened:true,distance:1,amount:0});Object.assign(empty.player,{x:CARBON_CHARGED_ANCHOR.x,y:CARBON_CHARGED_ANCHOR.y});empty.eaters[0].x=empty.player.x+1000;assert.equal(beginShock(empty,()=>true),false);assert.equal(empty.map.shockStructures[0].fractured,false);
});

test('One SHOCK wave can reset an Eater and fracture the Anchor for one charge',()=>{
  const run=productionRun({awakened:true,distance:100,amount:1});Object.assign(run.player,{x:CARBON_CHARGED_ANCHOR.x,y:CARBON_CHARGED_ANCHOR.y});run.eaters[0].x=run.player.x+100;run.eaters[0].y=run.player.y;
  const event=beginShock(run,()=>true);assert.equal(event.affected,1);assert.equal(event.anchorFractured,true);assert.equal(run.fuel.shock.amount,0);assert.equal(run.map.shockStructures[0].fractured,true);
});

test('Anchor changes only world Electrical intensity and stacks before ship Treatment',()=>{
  const center={x:ELECTRICAL_FIELD.lobes[1].x,y:ELECTRICAL_FIELD.lobes[1].y},intactMap=createUniverse(17,zeroStock(),{capabilities:awakenedCapabilities}),anchor=intactMap.shockStructures[0],intact=electricalEffectiveAt(center,'awakened',{shockStructures:intactMap.shockStructures});anchor.fractured=true;anchor.fracturedAt=0;const fractured=electricalEffectiveAt(center,'awakened',{shockStructures:intactMap.shockStructures});assert.ok(Math.abs(fractured-intact*.6)<1e-12);assert.equal(intactMap.shockStructures.length,1);
  const makeTreatmentRun=(electrical,fracture)=>{const state=stateFor(true),map=createUniverse(17,zeroStock(),{capabilities:awakenedCapabilities}),run=createRun(map,flightConfig(state),{predators:false,treatments:{mechanical:0,abrasive:0,thermal:0,electrical},fuel:{shock:{molecule:'nitromethane',amount:0}}});if(fracture){map.shockStructures[0].fractured=true;map.shockStructures[0].fracturedAt=0;}Object.assign(run.player,{x:center.x,y:center.y,vx:0,vy:0,speed:0});return run;};
  const treatmentOnly=makeTreatmentRun(1,false),anchorOnly=makeTreatmentRun(0,false),both=makeTreatmentRun(1,true);stepRun(treatmentOnly,{x:0,y:0},1/60,{});stepRun(anchorOnly,{x:0,y:0},1/60,{});stepRun(both,{x:0,y:0},1/60,{});
  const raw=run=>run.currentHazards.find(hazard=>hazard.id===ELECTRICAL_FIELD.id)?.effectiveIntensity??0;assert.ok(raw(anchorOnly)>raw(both));assert.ok(Math.abs(raw(both)/raw(anchorOnly)-.6)<.02);assert.equal(raw(treatmentOnly),raw(anchorOnly));assert.ok(treatmentOnly.treatments.electrical<1);assert.ok(both.treatments.electrical>treatmentOnly.treatments.electrical,'post-Anchor intensity must reduce Treatment consumption');
});

test('A new awakened expedition starts with an intact Anchor after either return path',()=>{
  for(const returnType of ['normal','forced']){
    const next=createUniverse(returnType==='normal'?91:92,zeroStock(),{capabilities:awakenedCapabilities});assert.equal(next.shockStructures.length,1);assert.equal(next.shockStructures[0].fractured,false);
  }
  const persisted=createInitialResourcesState();Object.assign(persisted.progress,{choCompleted:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true});
  const reloaded=migrateResourcesSave(serializeResourcesState(persisted)),next=createUniverse(93,zeroStock(),{capabilities:{...awakenedCapabilities,worldAwakened:reloaded.progress.worldAwakened}});
  assert.equal(next.shockStructures.length,1);assert.equal(next.shockStructures[0].fractured,false,'reload must not carry run-local fracture state');
});
