import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {createInitialResourcesState} from '../src/veil/resources-persistence.js';
import {defineHazard,hazardSample,HAZARD_TYPES} from '../src/veil/hazards.js';
import {
  HAZARD_TREATMENT_ENDURANCE_INTENSITY_SECONDS,HAZARD_TREATMENT_EFFECT_MULTIPLIER,HAZARD_TREATMENT_IDS,HAZARD_TREATMENTS,
  createHazardTreatmentExposureState,hazardTreatmentMultiplier,updateHazardTreatmentExposure,
} from '../src/veil/hazard-treatments.js';
import {rareEcologyInventoryMultiplier,rareEcologyTreatmentReserve} from '../src/veil/rare-ecology.js';
import {createRun,stepRun} from '../src/veil/engine.js';
import {VEIL} from '../src/veil/config.js';

const catalog=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const records=new Map(catalog.map(record=>[record.id,record]));
const memory=(raw=null)=>{let value=raw;return{getItem:key=>key===RESOURCE_KEY?value:null,setItem:(key,next)=>{if(key===RESOURCE_KEY)value=String(next);},removeItem:key=>{if(key===RESOURCE_KEY)value=null;},raw:()=>value};};
const awakened=resources=>{Object.assign(resources.state.progress,{choCompleted:true,coreFractured:true,worldAwakeningPending:false,worldAwakened:true,rareEcologyEligible:true});};
const seedTreatment=(resources,id,stock)=>{resources.setCatalog(catalog);awakened(resources);resources.discover(HAZARD_TREATMENTS[id].recipeId);Object.assign(resources.state.elements,stock);};

test('treatment authority registers four isolated Utility treatments while CTFE keeps its abstract Cl-only DOCK cost',()=>{
  assert.deepEqual(HAZARD_TREATMENT_IDS,['mechanical','abrasive','thermal','electrical']);
  assert.equal(HAZARD_TREATMENTS.mechanical.recipeId,'phosphoric-acid');assert.deepEqual(HAZARD_TREATMENTS.mechanical.cost,{H:6,P:2,O:8});
  assert.equal(HAZARD_TREATMENTS.abrasive.recipeId,'sulfuric-acid');assert.deepEqual(HAZARD_TREATMENTS.abrasive.cost,{H:4,S:2,O:8});
  assert.equal(HAZARD_TREATMENTS.thermal.recipeId,'difluoromethane');assert.deepEqual(HAZARD_TREATMENTS.thermal.cost,{C:2,H:4,F:4});
  assert.equal(HAZARD_TREATMENTS.electrical.recipeId,'chlorotrifluoroethylene');assert.deepEqual(HAZARD_TREATMENTS.electrical.cost,{Cl:2});assert.equal(HAZARD_TREATMENTS.electrical.rareElement,'Cl');
  for(const id of ['mechanical','abrasive','thermal']){const treatment=HAZARD_TREATMENTS[id],atoms=records.get(treatment.recipeId)?.atoms??[],derived={};for(const atom of atoms)derived[atom]=(derived[atom]??0)+2;assert.deepEqual(derived,treatment.cost);}
  const ctfe=records.get('chlorotrifluoroethylene');assert.equal(ctfe.formula,'C2ClF3');assert.deepEqual(ctfe.atoms.reduce((out,atom)=>(out[atom]=(out[atom]??0)+1,out),{}),{C:2,F:3,Cl:1});
  assert.equal(JSON.stringify(HAZARD_TREATMENTS).includes('PCTFE'),false,'PCTFE is not a player-facing game object');
  assert.equal(HAZARD_TREATMENT_EFFECT_MULTIPLIER,.55);assert.equal(HAZARD_TREATMENT_ENDURANCE_INTENSITY_SECONDS,100);
  assert.equal(HAZARD_TREATMENTS.abrasive.productionHazard,true);assert.equal(HAZARD_TREATMENTS.electrical.productionHazard,true);
});
test('DOCK treatment requires Awakening, recipe knowledge and complete BASE stock, then spends atomically',()=>{
  const store=memory(),r=createResources({storage:store});r.setCatalog(catalog);r.discover('phosphoric-acid');Object.assign(r.state.elements,{H:6,P:2,O:8});
  assert.equal(r.treatmentPlan('mechanical').worldAwakened,false);assert.equal(r.applyHazardTreatment('mechanical'),false);assert.deepEqual({H:r.state.elements.H,P:r.state.elements.P,O:r.state.elements.O},{H:6,P:2,O:8});
  awakened(r);const applied=r.applyHazardTreatment('mechanical');assert.equal(applied.committed,true);assert.equal(r.state.treatments.mechanical,1);assert.deepEqual({H:r.state.elements.H,P:r.state.elements.P,O:r.state.elements.O},{H:0,P:0,O:0});
  const after=r.snapshot();assert.equal(r.applyHazardTreatment('mechanical'),false,'active treatment cannot be topped up or double-spent');assert.deepEqual(r.state.elements,after.elements);
  r.state.treatments.mechanical=0;Object.assign(r.state.elements,{H:6,P:2,O:8});assert.equal(r.applyHazardTreatment('mechanical').committed,true,'expired treatment is re-applicable');assert.equal(r.state.treatments.mechanical,1);
});

test('failed or incomplete treatment transaction never partially consumes BASE stock and states stay independent',()=>{
  const r=createResources({storage:null});r.setCatalog(catalog);awakened(r);for(const id of ['phosphoric-acid','sulfuric-acid','difluoromethane','chlorotrifluoroethylene'])r.discover(id);
  Object.assign(r.state.elements,{H:50,C:20,O:50,P:8,S:8,F:3,Cl:4});const before={...r.state.elements};
  assert.equal(r.applyHazardTreatment('thermal'),false);assert.deepEqual(r.state.elements,before,'F shortage cannot consume C or H');
  assert.equal(r.applyHazardTreatment('mechanical').committed,true);assert.equal(r.state.treatments.mechanical,1);assert.equal(r.state.treatments.abrasive,0);assert.equal(r.state.treatments.thermal,0);
  assert.equal(r.applyHazardTreatment('abrasive').committed,true);assert.equal(r.applyHazardTreatment('electrical').committed,true);assert.equal(r.state.elements.Cl,2);assert.deepEqual(r.state.treatments,{mechanical:1,abrasive:1,thermal:0,electrical:1});
});

test('Electrical Treatment requires Awakening plus CTFE knowledge and consumes exactly Cl ×2 transactionally',()=>{
  const store=memory(),r=createResources({storage:store});r.setCatalog(catalog);Object.assign(r.state.elements,{Cl:3,F:99,C:99});
  assert.equal(r.applyHazardTreatment('electrical'),false);assert.equal(r.state.elements.Cl,3);
  awakened(r);assert.equal(r.applyHazardTreatment('electrical'),false,'Awakening alone cannot replace CTFE recipe knowledge');assert.equal(r.state.elements.Cl,3);
  r.discover('chlorotrifluoroethylene');r.state.elements.Cl=1;assert.equal(r.applyHazardTreatment('electrical'),false);assert.equal(r.state.elements.Cl,1);
  r.state.elements.Cl=3;const applied=r.applyHazardTreatment('electrical');assert.equal(applied.committed,true);assert.deepEqual(applied.cost,{Cl:2});assert.equal(r.state.elements.Cl,1);assert.equal(r.state.treatments.electrical,1);
  const after=r.snapshot();assert.equal(r.applyHazardTreatment('electrical'),false,'nonzero charge rejects reapplication');assert.deepEqual(r.state.elements,after.elements);
  r.state.treatments.electrical=0;r.state.elements.Cl=2;assert.equal(r.applyHazardTreatment('electrical').committed,true,'zero charge can be reapplied');assert.equal(r.state.elements.Cl,0);
});

test('depletion uses resolved pre-mitigation effective intensity, max-overlap by type, and ignores wrong hazards',()=>{
  const mechanical=defineHazard('test-mech',HAZARD_TYPES.MECHANICAL,'pressure'),thermal=defineHazard('test-thermal',HAZARD_TYPES.THERMAL,'hot-zone'),electrical=defineHazard('test-electrical',HAZARD_TYPES.ELECTRICAL,'charged-region');
  const treatments={mechanical:1,abrasive:1,thermal:1,electrical:1},resolved=createHazardTreatmentExposureState(),hazards=[
    hazardSample(mechanical,1,{effectiveIntensity:1.25}),hazardSample(mechanical,.8,{effectiveIntensity:.8}),hazardSample(thermal,.5,{effectiveIntensity:.5}),hazardSample(electrical,.9,{effectiveIntensity:.9}),
  ];
  updateHazardTreatmentExposure(treatments,hazards,10,resolved);assert.equal(resolved.mechanical,1.25);assert.equal(resolved.thermal,.5);assert.ok(Math.abs(treatments.mechanical-.875)<1e-10);assert.ok(Math.abs(treatments.thermal-.95)<1e-10);assert.ok(Math.abs(treatments.electrical-.91)<1e-10);assert.equal(treatments.abrasive,1);
  assert.equal(hazardTreatmentMultiplier(treatments,HAZARD_TYPES.MECHANICAL),.55);assert.equal(hazardTreatmentMultiplier({mechanical:0},HAZARD_TYPES.MECHANICAL),1);
  updateHazardTreatmentExposure(treatments,[hazardSample(mechanical,1,{effectiveIntensity:1.25})],70,resolved);assert.equal(treatments.mechanical,0,'1.25 effective intensity consumes a full charge in about 80 total seconds');assert.equal(hazardTreatmentMultiplier(treatments,HAZARD_TYPES.MECHANICAL),1);
});

test('engine applies mechanical mitigation without changing raw local hazard authority',()=>{
  const def=defineHazard('test-field',HAZARD_TYPES.MECHANICAL,'pressure'),field={x:0,y:0,radius:400,strength:90,phase:0,hazard:def},map={seed:1,dust:[],fields:[field],currents:[],labels:[],routes:[],worldState:'base'};
  const untreated=createRun(map,VEIL,{predators:false}),treatedState={mechanical:1,abrasive:0,thermal:0},treated=createRun(map,VEIL,{predators:false,treatments:treatedState});for(const run of [untreated,treated])Object.assign(run.player,{x:120,y:0,vx:0,vy:0,speed:0});
  stepRun(untreated,{x:0,y:0},1/60,{});stepRun(treated,{x:0,y:0},1/60,{});
  assert.equal(treated.hazardEffectMultipliers.mechanical,.55);assert.equal(untreated.hazardEffectMultipliers.mechanical,1);assert.ok(treated.currentHazards.some(item=>item.type==='mechanical'&&item.effectiveIntensity>0));
  assert.ok(Math.abs(treated.player.x-120)<Math.abs(untreated.player.x-120),'treatment reduces player-facing mechanical displacement while preserving hazard samples');
  assert.ok(treatedState.mechanical<1,'matching exposure consumes persistent treatment state');
});

test('treatment charge persists across settlement/reload including forced return and legacy v8 saves normalize safely',()=>{
  const store=memory(),r=createResources({storage:store});seedTreatment(r,'mechanical',{H:20,P:6,O:20});assert.ok(r.applyHazardTreatment('mechanical'));const def=defineHazard('persist-mech',HAZARD_TYPES.MECHANICAL,'pressure'),sample=hazardSample(def,1,{effectiveIntensity:1});
  updateHazardTreatmentExposure(r.state.treatments,[sample],28,createHazardTreatmentExposureState());const residual=r.state.treatments.mechanical;assert.ok(Math.abs(residual-.72)<1e-10);assert.ok(r.settleExpedition({H:0,C:0,N:0,O:0},0,true));assert.ok(Math.abs(r.state.treatments.mechanical-residual)<1e-10);
  const reloaded=createResources({storage:store});assert.ok(Math.abs(reloaded.state.treatments.mechanical-residual)<1e-10);
  const legacy=createInitialResourcesState();delete legacy.treatments;let raw=JSON.stringify(legacy);const legacyStore={getItem:()=>raw,setItem:(_k,v)=>{raw=String(v);},removeItem:()=>{}};const normalized=createResources({storage:legacyStore});assert.deepEqual(normalized.state.treatments,{mechanical:0,abrasive:0,thermal:0,electrical:0});
});

test('Rare ecology suppression follows treatment-equivalent reserve and recovers after DOCK spend while Cl remains independent',()=>{
  assert.deepEqual([0,2,4,6,8].map(n=>rareEcologyInventoryMultiplier('P',n)),[1,.85,.55,.20,.05]);assert.deepEqual([0,4,8,12,16].map(n=>rareEcologyInventoryMultiplier('F',n)),[1,.85,.55,.20,.05]);
  assert.equal(rareEcologyTreatmentReserve('P',6),3);assert.equal(rareEcologyTreatmentReserve('S',6),3);assert.equal(rareEcologyTreatmentReserve('F',12),3);assert.equal(rareEcologyTreatmentReserve('Cl',12),6);
  const r=createResources({storage:null});seedTreatment(r,'mechanical',{H:20,P:8,O:20});const before=rareEcologyInventoryMultiplier('P',r.state.elements.P);assert.equal(before,.05);r.applyHazardTreatment('mechanical');assert.equal(r.state.elements.P,6);assert.equal(rareEcologyInventoryMultiplier('P',r.state.elements.P),.20);
});

console.log('Advanced hazard treatments passed: transactional Rare chemistry, persistent charges, pre-mitigation exposure, 45% mitigation, expiry/reapply and treatment-equivalent ecology.');
