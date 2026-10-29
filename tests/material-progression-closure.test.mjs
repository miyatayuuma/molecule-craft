import test from 'node:test';
import assert from 'node:assert/strict';
import {preCoreCheckpoint,awaken,acquireRare,craftInputs,readCatalog,memoryStorage,launch,flyTo} from './helpers/material-progression-fixture.mjs';
import {createResources,RESOURCE_KEY,RESET_CATEGORIES} from '../src/veil/resources.js';
import {createInitialResourcesState,MANAGED_ELEMENTS} from '../src/veil/resources-persistence.js';
import {createPolymerCollectionState} from '../src/polymer-collection-state.js';
import {createReactionLabPolymerizationCore,POLYMER_COMMIT_DWELL_MS} from '../src/reaction-lab-polymerization.js';
import {createReactionLabDiscoveryCoordinator} from '../src/reaction-lab-discovery.js';
import {ENGINEERING_APPLICATIONS,compileEngineeringAuthority,engineeringAuthorityReport} from '../src/engineering-fabrication.js';
import {collectorApplicationAuthorityReport,collectorMaterialState,MATERIAL_EFFECT_FACTOR} from '../src/veil/collector-applications.js';
import {REACTION_CATALOG,compileReactionCatalog,reactionCandidates,resolveSupplementalParticipants,planReactionExecution} from '../src/reaction-lab-core.js';
const records=readCatalog('molecules'),polymers=readCatalog('polymers'),authority=readCatalog('polymerization-routes');
const representatives=['polybutadiene-coordination-1-4','polyacrylonitrile-radical','phenol-formaldehyde-resole','polyvinyl-chloride-radical'];
const factors=({abrasion,thermal,electrical})=>({abrasion,thermal,electrical});
const empty=()=>Object.fromEntries(ENGINEERING_APPLICATIONS.map(({id})=>[id,false])),all=()=>Object.fromEntries(ENGINEERING_APPLICATIONS.map(({id})=>[id,true]));
let generation=0;
function produceSample(route){
  const batchGeneration=++generation;
  const core=createReactionLabPolymerizationCore({records,routes:authority.routes,sitePatterns:authority.sitePatterns}),count=route.feedSpecies.length===1?4:2;
  const instances=route.feedSpecies.flatMap(species=>Array.from({length:count},(_,n)=>({id:`${species}-${n}`,species,batchGeneration})));
  assert.equal(core.beginBatch({activeSlots:route.feedSpecies,batchGeneration,instances,environment:new Set(route.environment.requires)}).owned,true);
  const used=new Set(core.snapshot().consumedInstanceIds);let result;
  for(let n=1;n<route.representativeSequence.length;n++){
    const incoming=instances.find(item=>item.species===route.representativeSequence[n]&&!used.has(item.id));used.add(incoming.id);
    const begun=n>route.interactionCadence.manualSteps?core.beginAutomaticStep(incoming.id):core.beginManualStep(incoming.id);assert.equal(begun.ok,true);
    result=core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS);assert.equal(result.committed,true);
  }
  assert.equal(result.finished,true);return{core,sample:result.sample};
}
test('single-source manifest: valid seven fabrication refs, three fixed independent FIELD applications',()=>{
  const recipes=compileEngineeringAuthority({polymers,routes:authority.routes,molecules:records,elements:MANAGED_ELEMENTS}),report=collectorApplicationAuthorityReport();
  assert.equal(recipes.length,7);assert.equal(ENGINEERING_APPLICATIONS.length,3);assert.equal(report.applicationCount,3);assert.equal(MATERIAL_EFFECT_FACTOR,.5);
  assert.deepEqual(report.applications.map(item=>item.id),ENGINEERING_APPLICATIONS.map(item=>item.id));assert.deepEqual(report.applications.map(item=>item.fieldTarget),['abrasion','thermal coupling','electrical control']);
  for(const recipe of recipes){assert.ok(report.applications.some(item=>item.id===recipe.applicationId));assert.deepEqual(recipe.result,{type:'persistent-unlock',applicationId:recipe.applicationId});}
  for(const [key,value] of Object.entries(engineeringAuthorityReport()))if(['durability','charge','maintenance','performanceTierByRecipe'].includes(key))assert.equal(value,false);
  assert.equal(report.fabricatedOnlyEffect,false);assert.equal(report.simultaneousActivation,true);
});
test('pre-Core → real flight/SHOCK/normal return → Rare pickup → CRAFT → samples → fabrication → shell → FIELD, checkpoints A–F',()=>{
  const fixture=preCoreCheckpoint(),{storage}=fixture;let r=fixture.resources;
  let polymerState=createPolymerCollectionState({records:polymers,storage});let molecules=craftInputs(r,storage,['water']);
  const configure=()=>r.configureEngineering({polymers,routes:authority.routes,molecules:records,polymerState,collectionState:molecules});configure();
  assert.deepEqual(r.engineeringState().fabricated,empty());assert.deepEqual(r.collectorShellState().activeApplications,empty());
  for(const {id} of ENGINEERING_APPLICATIONS)assert.equal(r.activateApplication(id),false);
  assert.equal(r.fabricateEngineering('br-sulfur-wear').committed,false);
  const flight=awaken(r);assert.equal(r.worldAwakeningState().stage,'awakened');
  const reload=()=>{assert.equal(r.save(),true);r=createResources({storage});r.setCatalog(records);polymerState=createPolymerCollectionState({records:polymers,storage});molecules=craftInputs(r,storage,[]);configure();};
  reload();assert.equal(r.worldAwakeningState().rareEcologyEligible,true);assert.equal(r.state.elements.P,0); // A
  const acquisition=[['P','veil'],['S','carbon'],['Cl','nitrogen']].map(([element,region])=>acquireRare(r,element,region));
  const inventory={...r.state.elements};reload();assert.deepEqual(r.state.elements,inventory); // B
  molecules=craftInputs(r,storage,['1-3-butadiene','acrylonitrile','phenol','formaldehyde','vinyl-chloride','phosphoric-acid']);configure();
  const collection={registerDiscoveredPolymer:(...args)=>polymerState.registerDiscoveredPolymer(...args),registerDiscoveredMolecule:(...args)=>molecules.registerDiscoveredMolecule(...args)};
  const coordinator=createReactionLabDiscoveryCoordinator({records,polymerRoutes:authority.routes,polymerIds:polymers.map(item=>item.id),collection,getBatchGeneration:()=>generation,isLabOpen:()=>false,root:null});
  const samples=[];
  for(const id of representatives){const route=authority.routes.find(item=>item.routeId===id),{core,sample}=produceSample(route);samples.push({core,sample});
    const result=coordinator.handlePolymerSampleEvent({routeId:id,polymerId:route.polymerId,sampleId:sample.sampleId,batchGeneration:sample.batchGeneration,sourceInstanceIds:core.snapshot().consumedInstanceIds,byproducts:sample.evidence.byproducts.map(({species,instanceId,formationIndex})=>({species,instanceId,formationIndex}))});assert.equal(result.accepted,true);
  }
  const discoveries=polymerState.snapshot();reload();assert.deepEqual(polymerState.snapshot(),discoveries); // C: persistent discovery, runtime Sample deliberately not restored
  const costs={};
  for(const recipe of ['br-sulfur-wear','pan-phenolic-thermal','pvc-insulation']){
    assert.equal(r.engineeringEligibility(recipe).status,'AVAILABLE');const before={...r.state.elements},result=r.fabricateEngineering(recipe);assert.equal(result.committed,true);costs[recipe]=result.consumed;
    for(const [element,count] of Object.entries(result.consumed))assert.equal(r.state.elements[element],before[element]-count);
    assert.deepEqual(polymerState.snapshot(),discoveries);assert.ok(samples.every(({core,sample})=>core.snapshot().sample.sampleId===sample.sampleId),'fabrication does not consume live samples');
    const after=r.snapshot();assert.equal(r.fabricateEngineering(recipe).committed,false);assert.deepEqual(r.snapshot(),after);
  }
  assert.deepEqual(costs,{'br-sulfur-wear':{S:1},'pan-phenolic-thermal':{P:1,O:4,H:3},'pvc-insulation':{}});
  reload();assert.deepEqual(r.engineeringState().fabricated,all());assert.deepEqual(r.collectorShellState().activeApplications,empty()); // D
  assert.deepEqual(factors(collectorMaterialState(r.collectorShellState(),r.engineeringState())),{abrasion:1,thermal:1,electrical:1});
  const stock={...r.state.elements};for(const [index,{id}] of ENGINEERING_APPLICATIONS.entries()){assert.equal(r.activateApplication(id),true);assert.equal(r.deactivateApplication(id),true);assert.equal(r.activateApplication(id),true);if(index===0){reload();assert.deepEqual(r.collectorShellState().activeApplications,{WEAR_SKIN:true,THERMAL_SHELL:false,CONTROL_INSULATION:false});}} // E
  assert.deepEqual(r.state.elements,stock);reload();assert.deepEqual(r.collectorShellState().activeApplications,all()); // F
  const run=launch(r,'veil');assert.deepEqual(run.collectorMaterial.activeApplications,all());assert.deepEqual(factors(run.collectorMaterial),{abrasion:.5,thermal:.5,electrical:.5});
  // An equipped, persisted shell is actually flown with the unchanged production engine.
  flyTo(run,r,{x:100,y:-6500},{limit:100});assert.equal(run.captured,false);
  assert.equal(r.reset(RESET_CATEGORIES).committed,true);assert.deepEqual(createResources({storage}).engineeringState().fabricated,empty());assert.equal(createPolymerCollectionState({records:polymers,storage}).discoveredCount,0);
  console.log('Material progression checkpoints A–F',JSON.stringify({flight,acquisition,costs,sampleCount:samples.length}));
});
test('existing chemistry result feeds an existing polymer route without inventing application monomer reactions',()=>{
  const compiled=compileReactionCatalog(records),reaction=REACTION_CATALOG.find(item=>item.id==='complete-09-ethylene-oxide-acid-cleavage');
  const participants=reaction.reactants.map(({role,species})=>({id:role,species,busy:false}));
  const candidate=reactionCandidates(participants,compiled).find(item=>item.reactionId===reaction.id),supplemental=resolveSupplementalParticipants(candidate.reaction,candidate,participants,()=>0),plan=planReactionExecution({...candidate,...supplemental},records);assert.equal(plan.ok,true);
  assert.ok(plan.products.some(item=>item.id==='ethylene-glycol'));
  const route=authority.routes.find(item=>item.routeId==='polyethylene-terephthalate-direct-polycondensation');assert.ok(route.feedSpecies.includes('ethylene-glycol'));assert.equal(produceSample(route).sample.polymerId,route.polymerId);
});
test('partial, missing, unknown and legacy saves preserve valid progress without creating unlocks',()=>{
  for(const mutation of [s=>{delete s.engineering;delete s.collectorShell;},s=>{delete s.collectorShell;},s=>{s.engineering={fabricated:{WEAR_SKIN:true}};s.collectorShell={activeApplications:{WEAR_SKIN:true,THERMAL_SHELL:true,UNKNOWN:true}};},s=>{s.collectorShell={activeApplications:all()};},s=>{s.schemaVersion=8;delete s.engineering;delete s.collectorShell;}]){
    const storage=memoryStorage(),state=createInitialResourcesState();state.progress.choCompleted=true;state.elements.H=123;mutation(state);storage.setItem(RESOURCE_KEY,JSON.stringify(state));const r=createResources({storage});assert.equal(r.state.elements.H,123);assert.equal(r.state.progress.choCompleted,true);
    assert.deepEqual(Object.keys(r.engineeringState().fabricated),ENGINEERING_APPLICATIONS.map(item=>item.id));for(const [id,active] of Object.entries(r.collectorShellState().activeApplications))if(active)assert.equal(r.engineeringState().fabricated[id],true);
    assert.equal(r.engineeringState().fabricated.THERMAL_SHELL,false);assert.equal(r.engineeringState().fabricated.CONTROL_INSULATION,false);assert.equal(r.activateApplication('UNKNOWN'),false);
  }
});
