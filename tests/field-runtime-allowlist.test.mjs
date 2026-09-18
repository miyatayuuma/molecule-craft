import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FIELD_RUNTIME_ALLOWLIST,FIELD_RUNTIME_ALLOWLIST_VERSION,RETIRED_FIELD_RUNTIME} from '../src/veil/field-runtime-authority.js';
import {createResources} from '../src/veil/resources.js';
import {createInitialResourcesState,RESOURCE_KEY,serializeResourcesState} from '../src/veil/resources-persistence.js';
import {createUniverse} from '../src/veil/universe.js';
import {createRun,stepRun} from '../src/veil/expedition-run.js';
import {flightConfig} from '../src/veil/growth.js';

const RARE_ELEMENTS=Object.freeze(['P','S','F','Cl']);
const memory=raw=>{let value=raw??null;return{getItem:key=>key===RESOURCE_KEY?value:null,setItem:(key,next)=>{if(key===RESOURCE_KEY)value=next;},removeItem:key=>{if(key===RESOURCE_KEY)value=null;},raw:()=>value};};
const rareRuntimeDust=map=>(map?.dust??[]).filter(item=>item.rareAnomaly||RARE_ELEMENTS.includes(item.element));
const assertNoLegacyRare=(run,map=run?.map)=>{
  assert.equal(Object.hasOwn(run??{},'rareSurvey'),false);
  assert.equal(Object.hasOwn(run??{},'rareSpecimens'),false);
  assert.equal(Object.hasOwn(run??{},'rareCargo'),false);
  assert.deepEqual(rareRuntimeDust(map),[]);
};

test('FIELD runtime allowlist is explicit and Rare Survey is retired',()=>{
  assert.equal(FIELD_RUNTIME_ALLOWLIST_VERSION,1);
  assert.deepEqual(Object.keys(FIELD_RUNTIME_ALLOWLIST),[
    'environmentGeometry','managedResources','environmentalHazards','activeAgents','currentProgressionObjects','navigationRecoveryInfrastructure',
  ]);
  assert.deepEqual(FIELD_RUNTIME_ALLOWLIST.managedResources.elements,['H','C','N','O']);
  assert.deepEqual(FIELD_RUNTIME_ALLOWLIST.environmentalHazards.types,['mechanical','thermal','abrasive','electrical']);
  assert.ok(FIELD_RUNTIME_ALLOWLIST.activeAgents.examples.includes('Dust Eater'));
  assert.ok(FIELD_RUNTIME_ALLOWLIST.currentProgressionObjects.examples.includes('Core'));
  assert.deepEqual(RETIRED_FIELD_RUNTIME,['finite-rare-survey']);
});

test('fresh, pre-Core and awakened FIELD runtime never spawns finite Rare Survey objects or new Rare ecology',()=>{
  const freshState=createInitialResourcesState(),freshConfig=flightConfig(freshState),freshMap=createUniverse(11,{H:0,C:0,N:0,O:0}),freshRun=createRun(freshMap,freshConfig,{predators:false});
  assertNoLegacyRare(freshRun,freshMap);

  const preState=createInitialResourcesState();preState.progress.choCompleted=true;
  const preConfig=flightConfig(preState),preMap=createUniverse(12,preState.elements,{capabilities:{nitrogenField:true}}),preRun=createRun(preMap,preConfig,{predators:false});
  assert.ok(preMap.nitrogenCore&&!preMap.nitrogenCore.fractured);assert.ok(preMap.signals.some(signal=>signal.region==='nitrogen'));assertNoLegacyRare(preRun,preMap);

  const awakened=createInitialResourcesState();awakened.progress.choCompleted=true;awakened.progress.coreFractured=true;awakened.progress.worldAwakened=true;awakened.progress.rareEcologyEligible=true;
  const awakenedConfig=flightConfig(awakened),awakenedMap=createUniverse(13,awakened.elements,{capabilities:{nitrogenField:true,coreFractured:true,worldAwakened:true}}),awakenedRun=createRun(awakenedMap,awakenedConfig,{predators:true});
  assert.equal(awakenedConfig.rareEcologyEligible,true);assertNoLegacyRare(awakenedRun,awakenedMap);
  for(let frame=0;frame<8*60;frame++)stepRun(awakenedRun,{x:0,y:-1},1/60,{});
  assert.ok(awakenedRun.eaters.length>=1,'Dust Eater remains the active-agent authority after cleanup');
});

test('legacy Rare Survey save metadata is inert while acquired Rare stock and post-Core eligibility survive',()=>{
  const legacy=createInitialResourcesState();legacy.progress.choCompleted=true;legacy.progress.coreFractured=true;legacy.progress.worldAwakened=true;legacy.progress.rareEcologyEligible=true;
  Object.assign(legacy.elements,{P:2,S:3,F:4,Cl:5});
  legacy.rareSurvey={claimedIds:['rare-p-veil-bend','rare-s-carbon-revisit','rare-f-oxygen-thermal','rare-cl-nitrogen-pocket'],unlockState:'complete',metadata:{source:'legacy-survey'}};
  const storage=memory(serializeResourcesState(legacy)),resources=createResources({storage});
  assert.deepEqual(resources.state.rareSurvey,legacy.rareSurvey,'deprecated metadata may round-trip but owns no runtime');
  assert.equal(resources.state.progress.rareEcologyEligible,true);
  for(const element of RARE_ELEMENTS)assert.equal(resources.canUseElement(element),true,element+' stock remains usable after Survey retirement');
  const config=flightConfig(resources.state),map=createUniverse(14,resources.state.elements,{capabilities:{nitrogenField:true,coreFractured:true,worldAwakened:true}}),run=createRun(map,config,{fuel:resources.prepareExpedition({region:'nitrogen'}),predators:false});
  assertNoLegacyRare(run,map);
  const settled=resources.settleExpedition({H:0,C:0,N:0,O:0},0,false);assert.ok(settled);assert.equal(resources.state.progress.rareEcologyEligible,true);
  assert.deepEqual(RARE_ELEMENTS.map(element=>resources.state.elements[element]),[2,3,4,5],'normal return cannot erase previously acquired Rare stock');
});

test('production FIELD sources and generated map contain no retired Rare Survey hook, marker or interaction',async()=>{
  const sources=await Promise.all([
    '../src/craft-connections.js','../src/veil/expedition-run.js','../src/veil/renderer.js','../scripts/export-field-map.mjs',
  ].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  for(const source of sources)assert.doesNotMatch(source,/rare-survey|RARE_SURVEY|rareAnomaly|rareSpecimens|rareCargo|data-rare-anomaly/i);
  const svg=await readFile(new URL('../docs/maps/current-field.svg',import.meta.url),'utf8');assert.doesNotMatch(svg,/data-rare-anomaly|rare-cl-nitrogen-pocket|Rare Survey/i);
  await assert.rejects(readFile(new URL('../src/veil/rare-survey.js',import.meta.url),'utf8'),error=>error?.code==='ENOENT');
  await assert.rejects(readFile(new URL('../src/veil/rare-survey-presentation.js',import.meta.url),'utf8'),error=>error?.code==='ENOENT');
});
