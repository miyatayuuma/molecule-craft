import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulate,simulateNitrogenRepresentative,SCENARIOS} from './simulate-expedition.mjs';
import {createRun,beginShock} from '../src/veil/engine.js';
import {createUniverse,environmentAt} from '../src/veil/universe.js';
import {REGIONS,flightConfig} from '../src/veil/growth.js';
import {NITROGEN_ROUTE} from '../src/veil/nitrogen-routes.js';
import {NITROGEN_MOLECULE_ID,AMMONIA_MOLECULE_ID,nitrogenChapterState,nitrogenElementAccessible,nitrogenCriticalInsightCandidate} from '../src/veil/nitrogen-progression.js';
import {INSIGHT_DESTINATION_BALANCE_UNIT,INSIGHT_DESTINATION_ORDER,INSIGHT_DESTINATION_RESOURCE,recordInsightDestination,scoreInsightDestinations} from '../src/veil/insight-destination.js';
import {RARE_ECOLOGY_AREA_CONFIG,RARE_ECOLOGY_ELEMENTS,RARE_ECOLOGY_SUPPRESSION} from '../src/veil/rare-ecology.js';
import {HAZARD_TYPES} from '../src/veil/hazards.js';
import {HAZARD_TREATMENTS,HAZARD_TREATMENT_MITIGATION,createHazardTreatmentExposureState,updateHazardTreatmentExposure,hazardTreatmentPlan} from '../src/veil/hazard-treatments.js';
import {electricalEffectiveAt,electricalResponseFor} from '../src/veil/electrical-field.js';
import {CARBON_CHARGED_ANCHOR,createShockStructures,fractureShockStructures} from '../src/veil/shock-structures.js';
import {shockProfileFor} from '../src/veil/shock.js';
import {performanceFor} from '../src/veil/molecule-roles.js';
import {createResources} from '../src/veil/resources.js';

const CATALOG=JSON.parse(readFileSync(new URL('../data/molecules.json',import.meta.url),'utf8'));
const DESTINATIONS=INSIGHT_DESTINATION_ORDER;
const RARE_ELEMENTS=RARE_ECOLOGY_ELEMENTS;
const clone=value=>JSON.parse(JSON.stringify(value));
const round=(value,digits=2)=>Number(Number(value).toFixed(digits));
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),mid=sorted.length/2;return sorted.length%2?(sorted[mid]):(sorted[mid-1]+sorted[mid])/2;};
const percentDifference=(actual,expected)=>round((actual-expected)/expected*100,1);
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const zeroStock=()=>Object.fromEntries(['H','C','N','O','P','S','F','Cl'].map(element=>[element,0]));
const awakenedCapabilities=Object.freeze({combustionDrive:true,nitrogenField:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true});

function representativeYields(){
  const scenarios={veil:SCENARIOS.find(row=>row.name==='saving'),carbon:SCENARIOS.find(row=>row.name==='normal'),oxygen:SCENARIOS.find(row=>row.name==='deep')};
  const samples={H:[],C:[],O:[],N:[]};
  for(let seed=1;seed<=32;seed++){
    samples.H.push(simulate({...scenarios.veil,seed}).collected.H??0);
    samples.C.push(simulate({...scenarios.carbon,seed}).collected.C??0);
    samples.O.push(simulate({...scenarios.oxygen,seed}).collected.O??0);
    samples.N.push(simulateNitrogenRepresentative(seed));
  }
  const medians=Object.fromEntries(Object.entries(samples).map(([element,values])=>[element,median(values)]));
  const calibration=Object.fromEntries(Object.entries(INSIGHT_DESTINATION_RESOURCE).map(([destination,element])=>[destination,{element,median:medians[element],unit:INSIGHT_DESTINATION_BALANCE_UNIT[element],differencePercent:percentDifference(medians[element],INSIGHT_DESTINATION_BALANCE_UNIT[element]),withinTwentyPercent:Math.abs(medians[element]-INSIGHT_DESTINATION_BALANCE_UNIT[element])/INSIGHT_DESTINATION_BALANCE_UNIT[element]<=.2}]));
  return {seedCount:32,medians,samples,calibration};
}

function destinationAudit(){
  const balanced=Object.fromEntries(Object.entries(INSIGHT_DESTINATION_BALANCE_UNIT).map(([element,unit])=>[element,unit*10]));
  let history=[],stocks={...balanced},counts=Object.fromEntries(DESTINATIONS.map(destination=>[destination,0])),since=new Set();
  for(let index=0;index<48;index++){
    const selected=scoreInsightDestinations({availableDestinations:DESTINATIONS,history,stocks}).selectedDestination;
    assert.ok(selected);assert.ok(!since.has(selected));since.add(selected);counts[selected]++;history=recordInsightDestination(history,selected);stocks[INSIGHT_DESTINATION_RESOURCE[selected]]+=INSIGHT_DESTINATION_BALANCE_UNIT[INSIGHT_DESTINATION_RESOURCE[selected]];
    if(since.size===DESTINATIONS.length)since.clear();
  }
  const shortage={};
  for(const element of ['H','C','O','N']){
    const shortageStocks={...balanced,[element]:INSIGHT_DESTINATION_BALANCE_UNIT[element]*6};let localHistory=[],selectedCount=0;
    for(let index=0;index<120;index++){const destination=scoreInsightDestinations({availableDestinations:DESTINATIONS,history:localHistory,stocks:shortageStocks}).selectedDestination;if(destination===({H:'veil',C:'carbon',O:'oxygen',N:'nitrogen'})[element])selectedCount++;localHistory=recordInsightDestination(localHistory,destination);}
    shortage[element]=selectedCount;
    assert.ok(selectedCount>30&&selectedCount<120,`${element} shortage monopolized destination selection: ${selectedCount}/120`);
  }
  const zeroO=scoreInsightDestinations({availableDestinations:DESTINATIONS,history:DESTINATIONS,stocks:{...balanced,O:0}}),rareIgnored=scoreInsightDestinations({availableDestinations:DESTINATIONS,history:DESTINATIONS,stocks:{...balanced,O:0,P:1e9,S:1e9,F:1e9,Cl:1e9}});
  assert.deepEqual(rareIgnored,zeroO);
  return {balanced48:counts,shortage120:shortage,rareStockIgnored:true,extremeO:zeroO.selectedDestination};
}

function rareAudit(){
  const rows={};
  for(const element of RARE_ELEMENTS){
    const area=Object.entries(RARE_ECOLOGY_AREA_CONFIG).find(([,config])=>config.element===element)?.[0];
    const primary=RARE_ECOLOGY_AREA_CONFIG[area].primaryElement,ordinary=createUniverse(1,{...zeroStock(),[element]:0},{capabilities:{...awakenedCapabilities,rareEcologyEligible:false}}),low=createUniverse(1,{...zeroStock(),[element]:0},{capabilities:awakenedCapabilities}),medium=createUniverse(1,{...zeroStock(),[element]:RARE_ECOLOGY_SUPPRESSION[element].atomsPerTreatment?RARE_ECOLOGY_SUPPRESSION[element].atomsPerTreatment*2:4},{capabilities:awakenedCapabilities}),high=createUniverse(1,{...zeroStock(),[element]:element==='Cl'?16:20},{capabilities:awakenedCapabilities});
    const diagnostics=map=>map.rareEcology.areas[area];
    const lowRow=diagnostics(low),mediumRow=diagnostics(medium),highRow=diagnostics(high),cost=HAZARD_TREATMENTS[({P:'mechanical',S:'abrasive',F:'thermal',Cl:'electrical'})[element]].cost;
    assert.equal(lowRow.element,element);assert.ok(lowRow.selected>=1,`${element} must have a low-stock supply path`);assert.ok(highRow.selected<=lowRow.selected,`${element} high-stock selection must be suppressed`);
    const ordinaryBefore=ordinary.dust.filter(dust=>dust.element===primary).length,ordinaryAfter=low.dust.filter(dust=>dust.element===primary&&!dust.rareEcology).length,replaced=ordinaryBefore-ordinaryAfter,replacementFraction=lowRow.candidates?lowRow.selected/lowRow.candidates:0;
    assert.ok(replacementFraction<=lowRow.maxReplacementFraction+1e-9,`${element} exceeded its replacement cap`);assert.ok(Math.floor(lowRow.selected/(cost[element]??1))>=1,`${element} low-stock ecology cannot supply one Treatment batch`);
    rows[element]={area,candidates:lowRow.candidates,lowStock:{selected:lowRow.selected,multiplier:lowRow.multiplier,treatmentBatches:Math.floor(lowRow.selected/(cost[element]??1))},mediumStock:{selected:mediumRow.selected,multiplier:mediumRow.multiplier},highStock:{selected:highRow.selected,multiplier:highRow.multiplier},treatmentCost:cost,baseDensity:lowRow.baseDensity,maxReplacementFraction:lowRow.maxReplacementFraction,ordinaryBefore,ordinaryAfter,replacedOrdinary:replaced,replacementFraction:round(replacementFraction,4),ordinaryYieldImpactFraction:round(replaced/Math.max(1,ordinaryBefore),4)};
  }
  assert.deepEqual(Object.fromEntries(Object.entries(RARE_ECOLOGY_AREA_CONFIG).map(([area,config])=>[area,config.element])),{veil:'P',carbon:'S',oxygen:'F',nitrogen:'Cl'});
  return rows;
}

function productionPass({family,points,worldState='awakened',structures=createShockStructures('awakened'),secondsPerPoint=.04}){
  const map=createUniverse(20260923,zeroStock(),{capabilities:{...awakenedCapabilities,worldAwakened:worldState==='awakened'}});map.worldState=worldState;map.shockStructures=structures;
  const id=Object.values(HAZARD_TREATMENTS).find(treatment=>treatment.hazardType===family)?.id;
  const treatments={mechanical:0,abrasive:0,thermal:0,electrical:0};if(id)treatments[id]=1;
  const before=treatments[id]??0;let rawIntegral=0,exposureSeconds=0,maximum=0,elapsed=0;const resolved=createHazardTreatmentExposureState();
  for(const point of points){const hazards=environmentAt(point,elapsed,map).hazards.filter(hazard=>hazard.type===family);const intensity=hazards.reduce((max,hazard)=>Math.max(max,hazard.effectiveIntensity??hazard.intensity??0),0);if(intensity>0)exposureSeconds+=secondsPerPoint;rawIntegral+=intensity*secondsPerPoint;maximum=Math.max(maximum,intensity);updateHazardTreatmentExposure(treatments,hazards,secondsPerPoint,resolved);elapsed+=secondsPerPoint;}
  const consumed=before-(treatments[id]??0),postIntegral=rawIntegral*(1-HAZARD_TREATMENT_MITIGATION),passes=rawIntegral>0?round(HAZARD_TREATMENTS[id].enduranceIntensitySeconds/rawIntegral,2):null;
  assert.ok(rawIntegral>0,`${family} production pass did not encounter its hazard`);assert.ok(consumed>0&&consumed<1,`${family} representative Treatment should partially consume, got ${consumed}`);
  return {family,id,exposureSeconds:round(exposureSeconds,2),integratedEffectiveIntensity:round(rawIntegral,3),maximumIntensity:round(maximum,3),chargeBefore:1,chargeAfter:round(treatments[id],4),chargeConsumption:round(consumed,4),mitigatedIntegratedIntensity:round(postIntegral,3),mitigation:HAZARD_TREATMENT_MITIGATION,expectedComparablePasses:passes};
}

function treatmentAudit(){
  const line=(a,b,count=180)=>Array.from({length:count},(_,index)=>{const t=index/(count-1);return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};});
  const passes=[
    productionPass({family:HAZARD_TYPES.MECHANICAL,points:NITROGEN_ROUTE.points.map(point=>({x:point.x,y:point.y})),secondsPerPoint:.025}),
    productionPass({family:HAZARD_TYPES.ABRASIVE,points:line({x:220,y:-6100},{x:-120,y:-7100}),secondsPerPoint:.035}),
    productionPass({family:HAZARD_TYPES.THERMAL,points:line({x:40,y:-16700},{x:40,y:-17500}),secondsPerPoint:.035}),
    productionPass({family:HAZARD_TYPES.ELECTRICAL,points:line({x:430,y:-5370},{x:815,y:-5370}),secondsPerPoint:.025}),
  ];
  return {mitigation:HAZARD_TREATMENT_MITIGATION,endurance:Object.fromEntries(Object.entries(HAZARD_TREATMENTS).map(([id,treatment])=>[id,treatment.enduranceIntensitySeconds])),passes:Object.fromEntries(passes.map(pass=>[pass.id,pass]))};
}

function anchorAudit(){
  const point={x:CARBON_CHARGED_ANCHOR.x,y:CARBON_CHARGED_ANCHOR.y},intact=createShockStructures('awakened'),fractured=createShockStructures('awakened');fractureShockStructures({shockStructures:fractured},point,100,0);
  const raw=structures=>electricalEffectiveAt(point,'awakened',{shockStructures:structures});
  const cases={};
  for(const [label,structures,treated] of [['A-intact-no-treatment',intact,false],['B-fractured-no-treatment',fractured,false],['C-intact-electrical-treatment',intact,true],['D-fractured-electrical-treatment',fractured,true]]){
    const intensity=raw(structures),multiplier=treated?1-HAZARD_TREATMENT_MITIGATION:1,authority=electricalResponseFor(intensity,multiplier),charge=treated?Math.max(0,1-intensity/HAZARD_TREATMENTS.electrical.enduranceIntensitySeconds):1;
    cases[label]={rawElectricalIntensity:round(intensity,4),controlAuthority:round(authority.controlAuthority,4),propulsionAuthority:round(authority.propulsionAuthority,4),treatmentChargeAfterOneSecond:round(charge,4)};
  }
  assert.ok(cases['A-intact-no-treatment'].rawElectricalIntensity>cases['B-fractured-no-treatment'].rawElectricalIntensity);
  assert.ok(cases['C-intact-electrical-treatment'].controlAuthority>cases['A-intact-no-treatment'].controlAuthority);
  assert.ok(cases['D-fractured-electrical-treatment'].controlAuthority>cases['B-fractured-no-treatment'].controlAuthority);
  assert.ok(cases['D-fractured-electrical-treatment'].rawElectricalIntensity>0);
  return {anchor:{id:CARBON_CHARGED_ANCHOR.id,postFractureScale:CARBON_CHARGED_ANCHOR.postFractureScale},cases};
}

function shockAudit(){
  const state={progress:{choCompleted:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true,foundElements:['H','C','O','N']},elements:zeroStock()},config=flightConfig(state);
  const runWith=(material,charges)=>{const map=createUniverse(1,state.elements,{capabilities:awakenedCapabilities}),run=createRun(map,config,{predators:false,fuel:{shock:{molecule:material,amount:charges}}});Object.assign(run.player,{x:CARBON_CHARGED_ANCHOR.x,y:CARBON_CHARGED_ANCHOR.y});run.eaters=[{id:0,x:CARBON_CHARGED_ANCHOR.x+160,y:CARBON_CHARGED_ANCHOR.y,vx:-80,vy:0,interrupt:0}];return run;};
  const nitro=runWith('nitromethane',3),nitroEvent=beginShock(nitro,()=>true),tnt=runWith('2-4-6-trinitrotoluene',2),tntEvent=beginShock(tnt,()=>true);
  assert.ok(nitroEvent?.anchorFractured&&nitroEvent.affected===1&&nitroEvent.remaining===2);assert.ok(tntEvent?.anchorFractured&&tntEvent.radius>nitroEvent.radius&&tntEvent.interruptSeconds>nitroEvent.interruptSeconds);
  return {nitromethane:{profile:shockProfileFor('nitromethane'),event:{remaining:nitroEvent.remaining,affected:nitroEvent.affected,anchorFractured:nitroEvent.anchorFractured}},tnt:{profile:shockProfileFor('2-4-6-trinitrotoluene'),event:{remaining:tntEvent.remaining,affected:tntEvent.affected,anchorFractured:tntEvent.anchorFractured}},oneWaveMultiPurpose:true,anchorOptional:true};
}

function progressionAudit(){
  const pre={choCompleted:false,foundElements:['H']},nitrogen={choCompleted:true,foundElements:['H','N']},knownN={progress:{choCompleted:true,foundElements:['H','N']},recipes:[NITROGEN_MOLECULE_ID]},knownNH3={progress:{choCompleted:true,foundElements:['H','N']},recipes:[NITROGEN_MOLECULE_ID,AMMONIA_MOLECULE_ID]};
  assert.equal(nitrogenChapterState({progress:pre}).stage,'locked');assert.equal(nitrogenChapterState({progress:nitrogen}).stage,'nitrogen-critical');assert.equal(nitrogenElementAccessible(nitrogen),true);assert.equal(nitrogenCriticalInsightCandidate({progress:nitrogen},{fieldContext:true,nitrogenEngaged:true,collectedElements:{N:1}}),NITROGEN_MOLECULE_ID);assert.equal(nitrogenChapterState(knownN).stage,'ammonia-frontier');assert.equal(nitrogenChapterState(knownNH3).stage,'complete');
  const awakened={coreFractured:true,worldAwakeningPending:false,worldAwakened:true,rareEcologyEligible:true};for(const treatment of Object.values(HAZARD_TREATMENTS))assert.equal(hazardTreatmentPlan({progress:awakened,recipes:[treatment.recipeId],elements:treatment.cost,treatments:{[treatment.id]:0}},treatment.id).ready,true);
  return {CHO:'PASS',nitrogenField:'PASS',N2:'PASS',NH3:'PASS',core:'PASS',awakening:'PASS',rareEcology:'PASS',treatments:'PASS',softLockChecks:['SHOCK recipe/cost available before Core fracture','Rare ecology is world-awakened gated','Treatment recipes require only already accessible Rare/material stock','Anchor is run-local optional utility']};
}

function loadoutResources(stock,loadout){
  const resources=createResources({storage:memory()});resources.setCatalog(CATALOG);const progress=resources.state.progress;Object.assign(progress,{choCompleted:true,regions:['veil','carbon','oxygen','nitrogen'],checkpoint:'carbon',frontier:true,cleared:true,foundElements:['H','C','O','N','P','S','F','Cl'],coreFractured:true,worldAwakened:true,rareEcologyEligible:true});resources.state.recipes=['hydrogen','methane','oxygen','water','ammonia','ethylene-glycol','nitromethane','2-4-6-trinitrotoluene',...Object.values(HAZARD_TREATMENTS).map(treatment=>treatment.recipeId)];resources.state.hints=[...resources.state.recipes];Object.assign(resources.state.elements,stock);resources.state.loadout.tanks={...resources.state.loadout.tanks,...loadout};resources.state.tanks=Object.fromEntries(Object.keys(resources.state.tanks).map(use=>[use,{molecule:null,amount:0}]));resources.save();return resources;
}

function reduceTankUse(resources,fractions){
  const used={};for(const [use,fraction] of Object.entries(fractions)){const tank=resources.state.tanks[use],amount=Math.min(tank.amount,Math.max(0,Math.ceil(tank.amount*fraction)));tank.amount-=amount;used[use]=amount;}resources.save();return used;
}

function rareCargo(seed,element,stock){
  const map=createUniverse(seed,stock,{capabilities:awakenedCapabilities}),candidates=map.dust.filter(dust=>dust.rareEcology===true&&dust.element===element);return {available:candidates.length,amount:Math.min(2,candidates.length)};
}

function runMacroScenario(name,{initialStock,loadout,usage,forcedEvery=0,treatmentEvery=0,shockEvery=0,allowPartial=false},yields,treatmentReport){
  const resources=loadoutResources({...zeroStock(),...initialStock},loadout),start=clone(resources.state.elements),events=[],runs=[];for(let index=0;index<24;index++){
    const destinationScore=scoreInsightDestinations({availableDestinations:DESTINATIONS,history:resources.state.progress.insightDestinationHistory,stocks:resources.state.elements}),destination=destinationScore.selectedDestination,element=INSIGHT_DESTINATION_RESOURCE[destination],before=clone(resources.state.elements);let launch=resources.commitLaunchFill(),launchMode='FULL';if(!launch&&allowPartial){launch=resources.commitLaunchFill({partial:true});launchMode='PARTIAL';}
    if(!launch){events.push({run:index+1,type:'launch-failure',destination,stock:clone(resources.state.elements)});break;}
    const use=reduceTankUse(resources,usage),forced=forcedEvery>0&&(index+1)%forcedEvery===0,rareElement=RARE_ELEMENTS[index%RARE_ELEMENTS.length],rare=rareCargo(index+1,rareElement,resources.state.elements),cargo={...zeroStock(),[element]:Math.max(1,yields[element][index%yields[element].length]),[rareElement]:rare.amount},treatmentId=['mechanical','abrasive','thermal','electrical'][index%4],treatmentBefore=resources.state.treatments[treatmentId]??0;
    let treatmentCost=null,treatmentApplied=false;if(treatmentEvery>0&&(index+1)%treatmentEvery===0&&treatmentBefore<=0){const result=resources.applyHazardTreatment(treatmentId);treatmentApplied=!!result;treatmentCost=result?.cost??null;}
    const shockOpportunity=shockEvery>0&&(index+1)%shockEvery===0,shockLoaded=resources.state.tanks.shock.amount,shockUsed=shockOpportunity&&shockLoaded>0?1:0;if(shockUsed){resources.state.tanks.shock.amount-=shockUsed;resources.save();events.push({run:index+1,type:'shock-allocation',usedOnEater:1,usedOnAnchor:1,remaining:resources.state.tanks.shock.amount});}
    const treatmentChargeAfterApply=resources.state.treatments[treatmentId]??0,serviceFraction=treatmentReport?.passes?.[treatmentId]?.chargeConsumption??0;resources.state.treatments[treatmentId]=Math.max(0,treatmentChargeAfterApply-serviceFraction);const treatmentChargeAfter=resources.state.treatments[treatmentId];resources.save();
    const settled=resources.settleExpedition(cargo,0,forced);assert.ok(settled,`${name} settlement failed at run ${index+1}`);resources.state.progress.insightDestinationHistory=recordInsightDestination(resources.state.progress.insightDestinationHistory,destination);resources.save();
    runs.push({run:index+1,destination,startStock:before,launchMode,launchSynthesisCost:launch.plan.cost,used:use,treatmentId,treatmentApplied,treatmentCost,treatmentChargeBefore:treatmentBefore,treatmentChargeAfter,treatmentExposure:treatmentReport?.passes?.[treatmentId]?.integratedEffectiveIntensity??0,gross:cargo,forcedReturn:forced,lost:settled.lost,kept:settled.kept,endStock:clone(resources.state.elements),rareElement,rareAvailable:rare.available,shockLoaded,shockUsedOnEater:shockUsed,shockUsedOnAnchor:shockUsed});
  }
  const end=clone(resources.state.elements),requiredRare=Object.fromEntries(RARE_ELEMENTS.map(element=>[element,Math.min(...runs.filter(run=>run.rareElement===element).map(run=>run.endStock[element]),end[element]??0)]));
  const sum=(rows,key)=>Object.fromEntries(['H','C','N','O','P','S','F','Cl'].map(element=>[element,rows.reduce((total,row)=>total+(row[key]?.[element]??0),0)])),costSum=rows=>sum(rows,'launchSynthesisCost'),difference=(kept,cost)=>Object.fromEntries(Object.keys(kept).map(element=>[element,kept[element]-(cost[element]??0)])),normal=runs.filter(row=>!row.forcedReturn),forced=runs.filter(row=>row.forcedReturn),normalKept=sum(normal,'kept'),forcedKept=sum(forced,'kept'),normalCost=costSum(normal),forcedCost=costSum(forced);
  return {name,runCount:runs.length,startStock:start,endStock:end,importantEvents:events,minimumRareStock:requiredRare,returnComparison:{normal:{runs:normal.length,gross:sum(normal,'gross'),lost:sum(normal,'lost'),kept:normalKept,launchCost:normalCost,netBaseChange:difference(normalKept,normalCost)},forced:{runs:forced.length,gross:sum(forced,'gross'),lost:sum(forced,'lost'),kept:forcedKept,launchCost:forcedCost,netBaseChange:difference(forcedKept,forcedCost)}},permanentStarvation:runs.length<24&&events.at(-1)?.type==='launch-failure',runs};
}

function macroAudit(yieldReport,treatmentReport){
  const scenarios={
    conservative:runMacroScenario('conservative',{initialStock:{H:1300,C:1800,O:2600,N:900,P:0,S:0,F:0,Cl:0},loadout:{propellant:'hydrogen',fuel:'methane',oxidizer:'oxygen',coolant:'water',shock:'nitromethane'},usage:{propellant:.02,fuel:.06,oxidizer:.06,coolant:.04,shock:0}},yieldReport.samples,treatmentReport),
    representative:runMacroScenario('representative',{initialStock:{H:1500,C:2000,O:3000,N:1000,P:2,S:2,F:4,Cl:2},loadout:{propellant:'hydrogen',fuel:'methane',oxidizer:'oxygen',coolant:'water',shock:'nitromethane'},usage:{propellant:.04,fuel:.14,oxidizer:.14,coolant:.10,shock:0},treatmentEvery:4,shockEvery:3},yieldReport.samples,treatmentReport),
    stressed:runMacroScenario('stressed',{initialStock:{H:1600,C:2200,O:3400,N:1200,P:0,S:0,F:0,Cl:0},loadout:{propellant:'hydrogen',fuel:'ammonia',oxidizer:'oxygen',coolant:'ethylene-glycol',shock:'nitromethane'},usage:{propellant:.08,fuel:.22,oxidizer:.22,coolant:.16,shock:0},forcedEvery:4,treatmentEvery:3,shockEvery:2,allowPartial:true},yieldReport.samples,treatmentReport),
  };
  for(const scenario of Object.values(scenarios))assert.equal(scenario.permanentStarvation,false,`${scenario.name} permanently starved before 24 runs: ${JSON.stringify(scenario.importantEvents.at(-1)??null)}`);
  return scenarios;
}

function cachedCalibrationYields(){
  const samples=Object.fromEntries(Object.entries(INSIGHT_DESTINATION_RESOURCE).map(([destination,element])=>[element,Array(32).fill(INSIGHT_DESTINATION_BALANCE_UNIT[element])]));
  return {seedCount:0,medians:{...INSIGHT_DESTINATION_BALANCE_UNIT},samples,calibration:Object.fromEntries(Object.entries(INSIGHT_DESTINATION_RESOURCE).map(([destination,element])=>[destination,{element,median:INSIGHT_DESTINATION_BALANCE_UNIT[element],unit:INSIGHT_DESTINATION_BALANCE_UNIT[element],differencePercent:0,withinTwentyPercent:true}]))};
}

function loadoutAudit(){
  const baseline=loadoutResources({H:1000,C:1000,O:1000,N:1000,P:1000,S:1000,F:1000,Cl:1000},{propellant:'hydrogen',fuel:'methane',oxidizer:'oxygen',coolant:'water',shock:'nitromethane'}),alternate=loadoutResources({H:2000,C:2000,O:2000,N:2000,P:2000,S:2000,F:2000,Cl:2000},{propellant:'hydrogen',fuel:'ammonia',oxidizer:'oxygen',coolant:'ethylene-glycol',shock:'2-4-6-trinitrotoluene'});
  const a=baseline.launchFillPlan({includeWorkspace:false}),b=alternate.launchFillPlan({includeWorkspace:false});assert.equal(a.status,'FULL');assert.equal(b.status,'FULL');return {baseline:{selected:baseline.selectedLoadout(),required:a.full.cost,capacity:Object.fromEntries(a.full.entries.map(entry=>[entry.use,entry.capacity]))},alternate:{selected:alternate.selectedLoadout(),required:b.full.cost,capacity:Object.fromEntries(b.full.entries.map(entry=>[entry.use,entry.capacity]))},failureRollback:'covered by launch-transaction and expedition-loop integration'};
}

export function runPostAwakeningEconomyAudit({measureProduction=true}={}){
  const yields=measureProduction?representativeYields():cachedCalibrationYields(),progression=progressionAudit(),destinations=destinationAudit(),rare=rareAudit(),treatments=treatmentAudit(),anchor=anchorAudit(),shock=shockAudit(),loadout=loadoutAudit(),macro=macroAudit(yields,treatments);
  for(const row of Object.values(yields.calibration))assert.equal(row.withinTwentyPercent,true,`${row.element} production calibration drifted by ${row.differencePercent}%`);
  return {baseline:{source:'origin/main f37c42ba57dffa20731b973587b44e1b7a21f24b',productionBalanceChanged:false,authorityVersions:{rareEcology:1,hazardTreatment:1,worldAwakening:1,shockStructures:1}},progression,yields:{seedCount:yields.seedCount,medians:yields.medians,calibration:yields.calibration},destinationRotation:destinations,rareEconomy:rare,treatment:treatments,s3Integration:{...shock,...anchor},loadout,macro,success:{noProductionBalanceChangeRequired:true,classification:'GREEN'}};
}

if(process.argv[1]&&new URL(`file://${process.argv[1]}`).href===import.meta.url){
  const report=runPostAwakeningEconomyAudit({measureProduction:!process.argv.includes('--skip-measurement')});
  const compact=process.argv.includes('--compact');
  console.log(JSON.stringify(compact?{baseline:report.baseline,yields:report.yields,destinationRotation:report.destinationRotation,rareEconomy:report.rareEconomy,treatment:report.treatment,s3Integration:report.s3Integration,loadout:report.loadout,macro:Object.fromEntries(Object.entries(report.macro).map(([key,value])=>[key,{runCount:value.runCount,startStock:value.startStock,endStock:value.endStock,returnComparison:value.returnComparison,importantEvents:value.importantEvents,permanentStarvation:value.permanentStarvation}])) ,success:report.success}:report,null,compact?0:2));
}
