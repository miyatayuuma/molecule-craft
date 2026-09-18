import test from 'node:test';
import assert from 'node:assert/strict';
import {createUniverse} from '../src/veil/universe.js';
import {createRun,stepRun} from '../src/veil/expedition-run.js';
import {createResources,progressionElementAccessible} from '../src/veil/resources.js';
import {createInitialResourcesState,MANAGED_ELEMENTS} from '../src/veil/resources-persistence.js';
import {flightConfig} from '../src/veil/growth.js';
import {
  RARE_ECOLOGY_AREA_CONFIG,RARE_ECOLOGY_ELEMENTS,RARE_ECOLOGY_SUPPRESSION,
  rareEcologyInventoryMultiplier,rareEcologySocketState,rareEcologyTreatmentReserve,
} from '../src/veil/rare-ecology.js';

const awakenedCapabilities=Object.freeze({combustionDrive:true,nitrogenField:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true});
const zeroStock=()=>Object.fromEntries(MANAGED_ELEMENTS.map(element=>[element,0]));
const rareParticles=map=>map.dust.filter(item=>item.rareEcology===true);
const signature=map=>rareParticles(map).map(item=>[item.rareEcologyKey,item.rareEcologyArea,item.element,item.x,item.y]).sort((a,b)=>a[0].localeCompare(b[0]));

test('Rare ecology authority maps one trace element to each FIELD area and uses soft independent suppression',()=>{
  assert.deepEqual(RARE_ECOLOGY_ELEMENTS,['P','S','F','Cl']);
  assert.deepEqual(Object.fromEntries(Object.entries(RARE_ECOLOGY_AREA_CONFIG).map(([area,config])=>[area,config.element])),{veil:'P',carbon:'S',oxygen:'F',nitrogen:'Cl'});
  for(const [element,atomsPerTreatment] of [['P',2],['S',2],['F',4]]){
    const config=RARE_ECOLOGY_SUPPRESSION[element];assert.equal(config.atomsPerTreatment,atomsPerTreatment);assert.equal(config.densityFloor,.05);
    assert.equal(rareEcologyTreatmentReserve(element,atomsPerTreatment*3),3);
    assert.deepEqual([0,atomsPerTreatment,atomsPerTreatment*2,atomsPerTreatment*3,atomsPerTreatment*4].map(held=>rareEcologyInventoryMultiplier(element,held)),[1,.85,.55,.20,.05]);
  }
  const cl=RARE_ECOLOGY_SUPPRESSION.Cl;assert.equal(rareEcologyTreatmentReserve('Cl',20),null);assert.equal(rareEcologyInventoryMultiplier('Cl',0),1);assert.ok(rareEcologyInventoryMultiplier('Cl',cl.reserveTarget)<1);assert.ok(rareEcologyInventoryMultiplier('Cl',cl.reserveTarget*20)>=cl.densityFloor);
});

test('Rare ecology is absent before committed Awakening and activates only on a later awakened expedition',()=>{
  const stock=zeroStock(),pre=createUniverse(7,stock,{capabilities:{combustionDrive:true,nitrogenField:true}}),fractureRun=createUniverse(7,stock,{capabilities:{combustionDrive:true,nitrogenField:true,coreFractured:true}}),pending=createUniverse(7,stock,{capabilities:{combustionDrive:true,nitrogenField:true,coreFractured:true,rareEcologyEligible:true,worldAwakened:false}}),awakened=createUniverse(7,stock,{capabilities:awakenedCapabilities});
  for(const map of [pre,fractureRun,pending])assert.deepEqual(rareParticles(map),[]);
  assert.deepEqual(new Set(rareParticles(awakened).map(item=>item.element)),new Set(RARE_ECOLOGY_ELEMENTS));
  assert.ok(rareParticles(awakened).every(item=>item.kind==='rare-element'&&!item.rareAnomaly));
});

test('Rare ecology selection and positions are world-deterministic instead of launch-seed rerolls',()=>{
  const stock=zeroStock(),a=createUniverse(11,stock,{capabilities:awakenedCapabilities}),b=createUniverse(987654,stock,{capabilities:awakenedCapabilities});
  assert.deepEqual(signature(a),signature(b));
  for(const item of rareParticles(a))assert.equal(RARE_ECOLOGY_AREA_CONFIG[item.rareEcologyArea].element,item.element);
});

test('inventory suppression is per-element, soft, reversible and bounded by ordinary-resource preservation',()=>{
  const fresh=createUniverse(17,zeroStock(),{capabilities:awakenedCapabilities}),pRichStock={...zeroStock(),P:80},pRich=createUniverse(17,pRichStock,{capabilities:awakenedCapabilities}),pSpent=createUniverse(17,{...zeroStock(),P:1},{capabilities:awakenedCapabilities});
  const counts=map=>Object.fromEntries(RARE_ECOLOGY_ELEMENTS.map(element=>[element,rareParticles(map).filter(item=>item.element===element).length]));
  const a=counts(fresh),b=counts(pRich),c=counts(pSpent);
  assert.ok(a.P>b.P,'large P reserve suppresses P ecology');assert.ok(c.P>b.P,'consuming P stock restores availability');
  for(const element of ['S','F','Cl'])assert.equal(b[element],a[element],'P stock cannot suppress '+element);
  for(const [area,diagnostic] of Object.entries(fresh.rareEcology.areas)){
    assert.ok(diagnostic.selected>=1,area+' must expose a trace ecology at low stock');
    assert.ok(diagnostic.selected<=Math.max(1,Math.floor(diagnostic.candidates*RARE_ECOLOGY_AREA_CONFIG[area].maxReplacementFraction)));
    assert.ok(diagnostic.selected<diagnostic.candidates,'ordinary resource sockets remain dominant');
  }
});

test('BASE plus current-run Rare cargo feeds the same suppression authority without deleting materialized particles',()=>{
  const map=createUniverse(19,zeroStock(),{capabilities:awakenedCapabilities}),p=rareParticles(map).filter(item=>item.element==='P').sort((a,b)=>b.rareEcologyRank-a.rareEcologyRank)[0];
  assert.ok(p);const low=rareEcologySocketState(p,{P:0},45),high=rareEcologySocketState(p,{P:80},45);
  assert.equal(low.held,0);assert.equal(high.held,80);assert.ok(high.multiplier<low.multiplier);assert.ok(high.target<=low.target);assert.ok(high.respawnSeconds>low.respawnSeconds);
  assert.ok(map.dust.includes(p),'suppression recalculation does not remove an already materialized particle');
});

test('Rare trace pickup uses ordinary run cargo, normal settlement and forced-return loss',()=>{
  const resources=createResources({storage:null}),state=resources.state;state.progress.choCompleted=true;state.progress.coreFractured=true;state.progress.worldAwakened=true;state.progress.rareEcologyEligible=true;
  const config=flightConfig(state),map=createUniverse(23,state.elements,{capabilities:awakenedCapabilities}),run=createRun(map,config,{predators:false}),particle=rareParticles(map).find(item=>item.element==='P');
  assert.ok(particle);Object.assign(run.player,{x:particle.x,y:particle.y,vx:0,vy:0,speed:0});stepRun(run,{x:0,y:0},.05,{});
  assert.ok(run.elementDust.P>=1);assert.ok(run.collectedElements.P>=1);assert.ok(run.foundElements.includes('P'));
  const normal=resources.settleExpedition(run.elementDust,run.best,false);assert.ok(normal);assert.ok(normal.atoms.P>=1);assert.equal(resources.state.elements.P,normal.atoms.P);assert.equal(resources.canUseElement('P'),true);
  const forced=resources.settleExpedition({H:0,C:0,N:0,O:0,P:20,S:0,F:0,Cl:0},0,true);assert.equal(forced.lost.P,3);assert.equal(forced.kept.P,17);
});

test('schema-v8 saves from before managed Rare promotion normalize missing Rare stocks without losing progression',()=>{
  const legacy=createInitialResourcesState();legacy.progress.choCompleted=true;legacy.progress.worldAwakened=true;legacy.progress.rareEcologyEligible=true;for(const element of RARE_ECOLOGY_ELEMENTS)delete legacy.elements[element];
  let raw=JSON.stringify(legacy);const storage={getItem:()=>raw,setItem:(_key,value)=>{raw=String(value);},removeItem:()=>{}},resources=createResources({storage});
  assert.deepEqual(RARE_ECOLOGY_ELEMENTS.map(element=>resources.state.elements[element]),[0,0,0,0]);assert.equal(resources.state.progress.worldAwakened,true);assert.equal(resources.state.progress.rareEcologyEligible,true);
});

test('Rare element management does not unlock Rare-containing Graph progression by stock alone',()=>{
  const resources=createResources({storage:null});resources.collect({P:3,S:3,F:3,Cl:3});
  for(const element of RARE_ECOLOGY_ELEMENTS){assert.ok(resources.state.progress.foundElements.includes(element));assert.equal(resources.canUseElement(element),true);}
  for(const element of RARE_ECOLOGY_ELEMENTS)assert.equal(progressionElementAccessible(resources.state.progress,element),false,element+' resource discovery stays outside current Graph progression authority');
});
