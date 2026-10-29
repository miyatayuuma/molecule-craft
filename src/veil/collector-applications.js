import {ENGINEERING_APPLICATIONS} from '../engineering-fabrication.js';

export const APPLICATION_IDS=Object.freeze(ENGINEERING_APPLICATIONS.map(({id})=>id));
// Half the existing penalty remains: .34 drag -> .17; capped electrical
// loss .40/.24 -> .20/.12; thermal exposure ceiling 150 -> 75.
export const MATERIAL_EFFECT_FACTOR=.5;
export const createCollectorShellState=()=>({activeApplications:Object.fromEntries(APPLICATION_IDS.map(id=>[id,false]))});
export function normalizeCollectorShellState(value,engineering){
  return {activeApplications:Object.fromEntries(APPLICATION_IDS.map(id=>[id,engineering?.fabricated?.[id]===true&&value?.activeApplications?.[id]===true]))};
}
export function collectorMaterialState(value,engineering){
  const {activeApplications}=normalizeCollectorShellState(value,engineering);
  return Object.freeze({activeApplications:Object.freeze(activeApplications),abrasion:activeApplications.WEAR_SKIN?MATERIAL_EFFECT_FACTOR:1,thermal:activeApplications.THERMAL_SHELL?MATERIAL_EFFECT_FACTOR:1,electrical:activeApplications.CONTROL_INSULATION?MATERIAL_EFFECT_FACTOR:1});
}
export function materialElectricalResponse(response,factor){
  return factor===1?response:{controlAuthority:1-(1-response.controlAuthority)*factor,propulsionAuthority:1-(1-response.propulsionAuthority)*factor};
}
export function collectorApplicationAuthorityReport(){
  const targets={WEAR_SKIN:'abrasion',THERMAL_SHELL:'thermal coupling',CONTROL_INSULATION:'electrical control'};
  return {applicationCount:APPLICATION_IDS.length,applications:APPLICATION_IDS.map(id=>({id,fabricatedGate:true,persistent:true,fieldTarget:targets[id],consumptionOnToggle:false})),simultaneousActivation:true,durability:false,charge:false,maintenance:false,recipePerformanceTier:false,fabricatedOnlyEffect:false};
}
