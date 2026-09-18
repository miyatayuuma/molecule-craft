import {HAZARD_TYPES,PRODUCTION_HAZARD_FAMILIES} from './hazards.js';

const freeze=value=>Object.freeze(value);
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));

export const HAZARD_TREATMENT_VERSION=1;
export const HAZARD_TREATMENT_MITIGATION=.45;
export const HAZARD_TREATMENT_EFFECT_MULTIPLIER=1-HAZARD_TREATMENT_MITIGATION;
export const HAZARD_TREATMENT_ENDURANCE_INTENSITY_SECONDS=100;

const productionType=type=>PRODUCTION_HAZARD_FAMILIES.some(item=>item.type===type);
export const HAZARD_TREATMENTS=Object.freeze({
  mechanical:freeze({
    id:'mechanical',hazardType:HAZARD_TYPES.MECHANICAL,recipeId:'phosphoric-acid',formula:'H₃PO₄',rareElement:'P',moleculesPerBatch:2,
    cost:freeze({H:6,P:2,O:8}),chemistry:'Phosphoric Acid',process:'Surface Pretreatment',component:'Bonded Reinforcement',property:'Mechanical Load Resistance',
    label:'MECHANICAL',icon:'M',productionHazard:productionType(HAZARD_TYPES.MECHANICAL),
  }),
  abrasive:freeze({
    id:'abrasive',hazardType:HAZARD_TYPES.ABRASIVE,recipeId:'sulfuric-acid',formula:'H₂SO₄',rareElement:'S',moleculesPerBatch:2,
    cost:freeze({H:4,S:2,O:8}),chemistry:'Sulfuric Acid',process:'Hard Anodize',component:'Hardened Surface',property:'Particle Erosion Resistance',
    label:'ABRASIVE',icon:'A',productionHazard:productionType(HAZARD_TYPES.ABRASIVE),
  }),
  thermal:freeze({
    id:'thermal',hazardType:HAZARD_TYPES.THERMAL,recipeId:'difluoromethane',formula:'CH₂F₂',rareElement:'F',moleculesPerBatch:2,
    cost:freeze({C:2,H:4,F:4}),chemistry:'Difluoromethane',process:'Thermal Loop Charge',component:'Heat Transport',property:'Thermal Load Resistance',
    label:'THERMAL',icon:'T',productionHazard:productionType(HAZARD_TYPES.THERMAL),
  }),
});
export const HAZARD_TREATMENT_IDS=Object.freeze(Object.keys(HAZARD_TREATMENTS));
export const HAZARD_TREATMENT_BY_TYPE=Object.freeze(Object.fromEntries(Object.values(HAZARD_TREATMENTS).map(item=>[item.hazardType,item])));

export const createInitialHazardTreatments=()=>Object.fromEntries(HAZARD_TREATMENT_IDS.map(id=>[id,0]));
export function normalizeHazardTreatments(value){
  const next=value&&typeof value==='object'?value:createInitialHazardTreatments();let changed=!value||typeof value!=='object';
  for(const id of HAZARD_TREATMENT_IDS){const raw=Number(next[id]);const charge=Number.isFinite(raw)?clamp01(raw):0;if(next[id]!==charge){next[id]=charge;changed=true;}}
  for(const key of Object.keys(next))if(!HAZARD_TREATMENTS[key]){delete next[key];changed=true;}
  return {value:next,changed};
}
export function validHazardTreatments(value){
  return !!value&&typeof value==='object'&&HAZARD_TREATMENT_IDS.every(id=>Object.hasOwn(value,id)&&Number.isFinite(value[id])&&value[id]>=0&&value[id]<=1)&&Object.keys(value).every(id=>HAZARD_TREATMENTS[id]);
}
export function hazardTreatmentPlan(state,id){
  const treatment=HAZARD_TREATMENTS[id];if(!treatment)return null;
  const charge=clamp01(state?.treatments?.[id]),worldAwakened=state?.progress?.worldAwakened===true,discovered=state?.recipes?.includes(treatment.recipeId)===true;
  const affordable=Object.entries(treatment.cost).every(([element,amount])=>(state?.elements?.[element]??0)>=amount);
  const ready=worldAwakened&&discovered&&charge<=0&&affordable;
  const status=charge>0?'ACTIVE':!worldAwakened?'WORLD LOCKED':!discovered?'CHEMISTRY LOCKED':!affordable?'MATERIALS':'READY';
  return {...treatment,charge,worldAwakened,discovered,affordable,ready,status};
}
export function hazardTreatmentMultiplier(treatments,hazardType){
  const treatment=HAZARD_TREATMENT_BY_TYPE[hazardType];return treatment&&clamp01(treatments?.[treatment.id])>0?HAZARD_TREATMENT_EFFECT_MULTIPLIER:1;
}
export function createHazardTreatmentExposureState(){
  return {mechanical:0,abrasive:0,thermal:0,changedMask:0,expiredMask:0};
}
export function updateHazardTreatmentExposure(treatments,hazards,dt,resolved=createHazardTreatmentExposureState()){
  for(const id of HAZARD_TREATMENT_IDS)resolved[id]=0;resolved.changedMask=0;resolved.expiredMask=0;
  for(const hazard of hazards??[]){const treatment=HAZARD_TREATMENT_BY_TYPE[hazard?.type];if(!treatment)continue;const intensity=Math.max(0,Number(hazard.effectiveIntensity??hazard.intensity)||0);if(intensity>resolved[treatment.id])resolved[treatment.id]=intensity;}
  const elapsed=Math.max(0,Number(dt)||0);if(elapsed<=0)return resolved;
  for(let index=0;index<HAZARD_TREATMENT_IDS.length;index++){
    const id=HAZARD_TREATMENT_IDS[index],charge=clamp01(treatments?.[id]),intensity=resolved[id];if(charge<=0||intensity<=0)continue;
    const next=Math.max(0,charge-intensity*elapsed/HAZARD_TREATMENT_ENDURANCE_INTENSITY_SECONDS);if(next===charge)continue;
    treatments[id]=next;resolved.changedMask|=1<<index;if(next<=0)resolved.expiredMask|=1<<index;
  }
  return resolved;
}
export function expiredHazardTreatmentIds(mask){const ids=[];for(let index=0;index<HAZARD_TREATMENT_IDS.length;index++)if(mask&(1<<index))ids.push(HAZARD_TREATMENT_IDS[index]);return ids;}
