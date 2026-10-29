import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ENGINEERING_APPLICATIONS,ENGINEERING_RECIPES,compileEngineeringAuthority,engineeringAuthorityReport,createEngineeringState} from '../src/engineering-fabrication.js';
import {createResources,RESOURCE_KEY,RESET_CATEGORIES} from '../src/veil/resources.js';
import {createInitialResourcesState,loadPersistedResources} from '../src/veil/resources-persistence.js';
import {createPolymerCollectionState} from '../src/polymer-collection-state.js';
const read=name=>JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url)));
const catalog={polymers:read('polymers'),routes:read('polymerization-routes').routes,molecules:read('molecules'),elements:['H','C','N','O','P','S','F','Cl']};
const memory=()=>{const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
assert.equal(ENGINEERING_APPLICATIONS.length,3);assert.equal(new Set(ENGINEERING_APPLICATIONS.map(x=>x.id)).size,3);
assert.equal(ENGINEERING_RECIPES.length,7);assert.equal(new Set(ENGINEERING_RECIPES.map(x=>x.id)).size,7);
const compiled=compileEngineeringAuthority(catalog);
assert.deepEqual(compiled.find(x=>x.id==='pan-phenolic-thermal').cost,{P:1,O:4,H:3});
for(const recipe of compiled){assert.ok(ENGINEERING_APPLICATIONS.some(x=>x.id===recipe.applicationId));assert.deepEqual(recipe.result,{type:'persistent-unlock',applicationId:recipe.applicationId});assert.deepEqual(recipe.prerequisites,['worldAwakened']);}
assert.throws(()=>compileEngineeringAuthority({...catalog,polymers:[]}),/Invalid engineering polymer/);
assert.throws(()=>compileEngineeringAuthority({...catalog,routes:catalog.routes.slice(0,-1)}),/Invalid engineering polymer/);
assert.throws(()=>compileEngineeringAuthority({...catalog,molecules:catalog.molecules.filter(x=>x.id!=='phosphoric-acid')}),/Invalid engineering molecule/);
assert.throws(()=>compileEngineeringAuthority({...catalog,elements:['H','C','N','O']}),/Invalid engineering element/);
function setup({awakened=true,polymerIds=[],moleculeIds=[],stock={}}={}){
  const storage=memory(),initial=createInitialResourcesState();initial.progress.worldAwakened=awakened;Object.assign(initial.elements,stock);storage.setItem(RESOURCE_KEY,JSON.stringify(initial));
  const resources=createResources({storage}),polymerState=createPolymerCollectionState({records:catalog.polymers,storage}),molecules=new Set(moleculeIds);
  for(const id of polymerIds)polymerState.registerDiscoveredPolymer(id,{at:1});
  resources.configureEngineering({...catalog,polymerState,collectionState:{hasMolecule:id=>molecules.has(id)}});
  return{resources,storage,polymerState,molecules};
}
const locked=setup({awakened:false,polymerIds:['polybutadiene'],stock:{S:8}});
for(const pending of [false,true]){locked.resources.state.progress.worldAwakeningPending=pending;assert.equal(locked.resources.engineeringEligibility('br-sulfur-wear').status,'LOCKED_BY_PROGRESSION');assert.equal(locked.resources.fabricateEngineering('br-sulfur-wear').committed,false);assert.equal(locked.resources.state.elements.S,8);}
const rubber=setup({stock:{S:2}});
assert.equal(rubber.resources.engineeringEligibility('br-sulfur-wear').status,'MISSING_INPUT');
const beforeMissing=rubber.resources.snapshot();assert.equal(rubber.resources.fabricateEngineering('br-sulfur-wear').committed,false);assert.deepEqual(rubber.resources.snapshot(),beforeMissing);
rubber.polymerState.registerDiscoveredPolymer('polybutadiene',{at:2});
const polymerBefore=rubber.polymerState.snapshot();assert.equal(rubber.resources.engineeringEligibility('br-sulfur-wear').status,'AVAILABLE');
assert.deepEqual(rubber.resources.fabricateEngineering('br-sulfur-wear'),{committed:true,status:'FABRICATED',applicationId:'WEAR_SKIN',consumed:{S:1}});
assert.equal(rubber.resources.state.elements.S,1);assert.deepEqual(rubber.polymerState.snapshot(),polymerBefore);
for(const id of ['br-sulfur-wear','sbr-sulfur-wear','nylon-wear']){assert.equal(rubber.resources.engineeringEligibility(id).status,'ALREADY_FABRICATED');assert.equal(rubber.resources.fabricateEngineering(id).committed,false);assert.equal(rubber.resources.state.elements.S,1);}
const restored=createResources({storage:rubber.storage});assert.equal(restored.engineeringState().fabricated.WEAR_SKIN,true);assert.equal(restored.state.elements.S,1);
const copy=restored.engineeringState();copy.fabricated.WEAR_SKIN=false;assert.equal(restored.engineeringState().fabricated.WEAR_SKIN,true);
for(const [id,polymer] of [['nylon-wear','nylon-6-6'],['sbr-sulfur-wear','styrene-butadiene-copolymer'],['pvc-insulation','polyvinyl-chloride'],['pvdf-insulation','polyvinylidene-fluoride'],['ptfe-insulation','polytetrafluoroethylene']]){
  const {resources,storage}=setup({polymerIds:[polymer],stock:{S:1}});const recipe=compiled.find(x=>x.id===id);
  assert.equal(resources.engineeringEligibility(id).status,'AVAILABLE');assert.equal(resources.fabricateEngineering(id).applicationId,recipe.applicationId);
  assert.equal(createResources({storage}).engineeringState().fabricated[recipe.applicationId],true);
  if(recipe.applicationId==='CONTROL_INSULATION')for(const sibling of ['pvc-insulation','pvdf-insulation','ptfe-insulation'])assert.equal(resources.engineeringEligibility(sibling).status,'ALREADY_FABRICATED');
}
const thermal=setup({polymerIds:['polyacrylonitrile'],moleculeIds:['phosphoric-acid'],stock:{H:3,P:1,O:4}});
assert.equal(thermal.resources.engineeringEligibility('pan-phenolic-thermal').status,'MISSING_INPUT');
thermal.polymerState.registerDiscoveredPolymer('phenol-formaldehyde-resin',{at:2});thermal.molecules.clear();assert.equal(thermal.resources.engineeringEligibility('pan-phenolic-thermal').status,'MISSING_INPUT');
thermal.molecules.add('phosphoric-acid');thermal.resources.state.elements.P=0;assert.equal(thermal.resources.engineeringEligibility('pan-phenolic-thermal').status,'MISSING_INPUT');
thermal.resources.state.elements.P=1;assert.equal(thermal.resources.fabricateEngineering('pan-phenolic-thermal').committed,true);assert.equal(thermal.resources.state.elements.P,0);assert.equal(thermal.resources.state.elements.H,0);assert.equal(thermal.resources.state.elements.O,0);
const failed=setup({polymerIds:['polybutadiene'],stock:{S:2}}),before=failed.resources.snapshot(),raw=failed.storage.getItem(RESOURCE_KEY),original=failed.storage.setItem;
failed.storage.setItem=()=>{throw Error('quota');};assert.equal(failed.resources.fabricateEngineering('br-sulfur-wear').status,'SAVE_FAILED');assert.deepEqual(failed.resources.snapshot(),before);assert.equal(failed.storage.getItem(RESOURCE_KEY),raw);
failed.storage.setItem=original;assert.equal(failed.resources.fabricateEngineering('br-sulfur-wear').committed,true);
const conflict=setup({polymerIds:['polybutadiene'],stock:{S:2}}),conflictBefore=conflict.resources.snapshot();conflict.storage.setItem(RESOURCE_KEY,'another tab');assert.equal(conflict.resources.fabricateEngineering('br-sulfur-wear').committed,false);assert.deepEqual(conflict.resources.snapshot(),conflictBefore);assert.equal(conflict.storage.getItem(RESOURCE_KEY),'another tab');
for(const engineering of [undefined,null,{}, {fabricated:{WEAR_SKIN:true,THERMAL_SHELL:'true',CONTROL_INSULATION:1,unknown:true}}, {fabricated:[]}]){
  const storage=memory(),legacy=createInitialResourcesState();legacy.elements.H=123;if(engineering===undefined)delete legacy.engineering;else legacy.engineering=engineering;storage.setItem(RESOURCE_KEY,JSON.stringify(legacy));
  const loaded=loadPersistedResources(storage).state;assert.equal(loaded.elements.H,123);assert.deepEqual(loaded.engineering,{fabricated:{WEAR_SKIN:engineering?.fabricated?.WEAR_SKIN===true,THERMAL_SHELL:false,CONTROL_INSULATION:false}});
}
assert.deepEqual(createEngineeringState(),{fabricated:{WEAR_SKIN:false,THERMAL_SHELL:false,CONTROL_INSULATION:false}});
const reset=setup({polymerIds:['polybutadiene'],stock:{S:1}});reset.resources.fabricateEngineering('br-sulfur-wear');assert.equal(reset.resources.reset(RESET_CATEGORIES).committed,true);assert.deepEqual(createResources({storage:reset.storage}).engineeringState(),createEngineeringState());
for(const recipe of compiled){assert.deepEqual(Object.keys(recipe.result).sort(),['applicationId','type']);for(const field of ['tier','level','rarity','durability','charge','maintenance','equipped','modifier']){assert.equal(Object.hasOwn(recipe,field),false);assert.equal(Object.hasOwn(recipe.application,field),false);}}
assert.deepEqual(Object.keys(restored.state.engineering),['fabricated']);assert.deepEqual(Object.keys(restored.state.engineering.fabricated),ENGINEERING_APPLICATIONS.map(x=>x.id));
const report=engineeringAuthorityReport();assert.equal(report.applicationCount,3);assert.deepEqual(report.applications.map(application=>[application.id,application.acceptedRoutes.map(route=>route.id)]),[['WEAR_SKIN',['nylon-wear','br-sulfur-wear','sbr-sulfur-wear']],['THERMAL_SHELL',['pan-phenolic-thermal']],['CONTROL_INSULATION',['pvc-insulation','pvdf-insulation','ptfe-insulation']]]);for(const flag of ['durability','charge','maintenance','performanceTierByRecipe'])assert.equal(report[flag],false);assert.equal(report.persistentFabricationUnlock,true);
console.log(JSON.stringify(report,null,2));
console.log('Engineering fabrication: catalog, seven routes, gates, atomic failure, consumption, persistence and migration PASS');
