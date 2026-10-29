import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createResources,RESOURCE_KEY,RESET_CATEGORIES} from '../src/veil/resources.js';
import {createInitialResourcesState,loadPersistedResources} from '../src/veil/resources-persistence.js';
import {APPLICATION_IDS,createCollectorShellState,collectorMaterialState,MATERIAL_EFFECT_FACTOR,materialElectricalResponse} from '../src/veil/collector-applications.js';
import {createRun,stepRun} from '../src/veil/engine.js';
import {createUniverse} from '../src/veil/universe.js';
import {flightConfig} from '../src/veil/growth.js';
import {ABRASIVE_PLUME} from '../src/veil/abrasive-field.js';
import {ELECTRICAL_FIELD} from '../src/veil/electrical-field.js';
const memory=()=>{const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const seed=(fabricated={})=>{const storage=memory(),state=createInitialResourcesState();Object.assign(state.engineering.fabricated,fabricated);state.elements.H=123;storage.setItem(RESOURCE_KEY,JSON.stringify(state));return{storage,resources:createResources({storage})};};
const all=Object.fromEntries(APPLICATION_IDS.map(id=>[id,true]));
test('three independent slots, fabricated gate, no toggle consumption, persistence and rollback',()=>{
  const {storage,resources:r}=seed();for(const id of [...APPLICATION_IDS,'UNKNOWN'])assert.equal(r.activateApplication(id),false);
  r.state.collectorShell.activeApplications.WEAR_SKIN=true;assert.equal(r.collectorShellState().activeApplications.WEAR_SKIN,false);assert.equal(r.save(),true);assert.equal(r.state.collectorShell.activeApplications.WEAR_SKIN,false);
  const read=name=>JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url)));
  Object.assign(r.state.progress,{coreFractured:true,worldAwakened:true,rareEcologyEligible:true});r.configureEngineering({polymers:read('polymers'),routes:read('polymerization-routes').routes,molecules:read('molecules'),polymerState:{hasPolymer:()=>true},collectionState:{hasMolecule:()=>true}});
  Object.assign(r.state.elements,{S:1,H:123,P:1,O:4});
  for(const route of ['br-sulfur-wear','pan-phenolic-thermal','pvc-insulation'])assert.equal(r.fabricateEngineering(route).committed,true);
  const before=r.snapshot();for(const id of APPLICATION_IDS){assert.equal(r.activateApplication(id),true);assert.equal(r.deactivateApplication(id),true);assert.equal(r.toggleApplication(id),true);}
  assert.deepEqual(r.snapshot().elements,before.elements);assert.deepEqual(r.snapshot().tanks,before.tanks);assert.deepEqual(r.snapshot().engineering,before.engineering);
  assert.deepEqual(createResources({storage}).collectorShellState().activeApplications,all);
  const previous=r.collectorShellState(),write=storage.setItem;storage.setItem=()=>{throw Error('quota');};assert.equal(r.deactivateApplication('WEAR_SKIN'),false);assert.deepEqual(r.collectorShellState(),previous);storage.setItem=write;
  assert.equal(r.reset(RESET_CATEGORIES).committed,true);assert.deepEqual(createResources({storage}).collectorShellState(),createCollectorShellState());
});
test('old, malformed, unknown and unfabricated active saves sanitize without losing resources',()=>{
  for(const shell of [undefined,null,{}, {activeApplications:all},{activeApplications:{WEAR_SKIN:true,THERMAL_SHELL:'true',UNKNOWN:true}}]){
    const {storage}=seed({WEAR_SKIN:true});const s=JSON.parse(storage.getItem(RESOURCE_KEY));if(shell===undefined)delete s.collectorShell;else s.collectorShell=shell;storage.setItem(RESOURCE_KEY,JSON.stringify(s));const loaded=loadPersistedResources(storage).state;assert.equal(loaded.elements.H,123);assert.deepEqual(loaded.collectorShell.activeApplications,{WEAR_SKIN:shell?.activeApplications?.WEAR_SKIN===true,THERMAL_SHELL:false,CONTROL_INSULATION:false});
  }
  assert.deepEqual(collectorMaterialState({activeApplications:all},{fabricated:{}}).activeApplications,createCollectorShellState().activeApplications);
});
const capabilities={combustionDrive:true,nitrogenField:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true};
const positions=[ABRASIVE_PLUME.lobes[1],{x:760,y:-11300},ELECTRICAL_FIELD.lobes[1]];
function sample(activeApplications,point,fabricated=all){
  const state=createInitialResourcesState();Object.assign(state.progress,capabilities,{choCompleted:true});const config=flightConfig(state),run=createRun(createUniverse(73,state.elements,{capabilities}),config,{predators:false,collectorShell:{activeApplications},engineering:{fabricated}});
  Object.assign(run.player,{x:point.x,y:point.y,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});stepRun(run,{x:1,y:0},1/60,{});
  return {player:run.player,heat:run.ambientHeat,heatFactor:run.combustionHeatFactor,control:run.electricalControlAuthority,propulsion:run.electricalPropulsionAuthority,hazards:run.currentHazards};
}
test('production FIELD response, orthogonality, simultaneous use and no passive fabricated effect',()=>{
  for(const [i,id] of APPLICATION_IDS.entries())for(const point of positions){
    const base=sample({},point),single=sample({[id]:true},point),combined=sample(all,point);
    assert.deepEqual(single.hazards,base.hazards,'world exposure is unchanged');
    const target=['abrasive','thermal','electrical'][i];if(!base.hazards.some(h=>h.type===target))assert.deepEqual(single,base,'unrelated environment stays identical');
    if(id!=='THERMAL_SHELL'){assert.equal(single.heat,base.heat);assert.equal(single.heatFactor,base.heatFactor);}else {assert.equal(single.heat,base.heat*.5);assert.equal(combined.heat,single.heat);if(base.heat>0)assert.ok(single.heat>0&&single.heat<base.heat);}
    if(id!=='CONTROL_INSULATION'){assert.equal(single.control,base.control);assert.equal(single.propulsion,base.propulsion);}else {assert.equal(single.control,1-(1-base.control)*.5);assert.equal(combined.control,single.control);if(base.control<1)assert.ok(single.control>base.control&&single.control<1);}
    if(i===0&&point===positions[0]){assert.ok(single.player.speed>base.player.speed);assert.ok(single.player.speed<sample({}, {x:0,y:0}).player.speed);assert.deepEqual(combined.player,single.player);}
    if(id==='THERMAL_SHELL'&&point===positions[1])assert.ok(base.heat>0,'authored thermal environment exercised');
    assert.deepEqual(sample({},point,{}),base,'fabricated-only state has no effect');
  }
  assert.equal(MATERIAL_EFFECT_FACTOR,.5);assert.deepEqual(materialElectricalResponse({controlAuthority:.6,propulsionAuthority:.76},.5),{controlAuthority:.8,propulsionAuthority:.88});
});

test('inactive FIELD physics matches independently captured pre-10B main digest',async()=>{
  const {createHash}=await import('node:crypto'),{trace}=await import('./helpers/field-particle-fixtures.mjs'),baseline=JSON.parse(readFileSync(new URL('./fixtures/collector-inactive-baseline.json',import.meta.url)));
  for(const [scenario,expected] of Object.entries(baseline.cases)){const {run,signature}=trace(scenario,{frames:baseline.frames});const actual=createHash('sha256').update(JSON.stringify({signature,heat:run.heat,ambientHeat:run.ambientHeat,player:run.player,hazards:run.currentHazards})).digest('hex');assert.equal(actual,expected,scenario);}
});

test('Collector Shell authority report fixes the three application contract',async()=>{
  const {collectorApplicationAuthorityReport}=await import('../src/veil/collector-applications.js'),r=collectorApplicationAuthorityReport();assert.equal(r.applicationCount,3);assert.deepEqual(r.applications.map(a=>a.fieldTarget),['abrasion','thermal coupling','electrical control']);for(const a of r.applications){assert.equal(a.fabricatedGate,true);assert.equal(a.persistent,true);assert.equal(a.consumptionOnToggle,false);}assert.equal(r.simultaneousActivation,true);for(const flag of ['durability','charge','maintenance','recipePerformanceTier','fabricatedOnlyEffect'])assert.equal(r[flag],false);console.log(JSON.stringify(r));
});
