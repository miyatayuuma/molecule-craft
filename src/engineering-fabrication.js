// Fabrication is a permanent capability, independent of FIELD equipment/effects.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const ENGINEERING_APPLICATIONS=freeze([
  {id:'WEAR_SKIN',nameJa:'耐摩耗スキン',concept:'abrasion / surface protection'},
  {id:'THERMAL_SHELL',nameJa:'耐熱シェル',concept:'thermal protection'},
  {id:'CONTROL_INSULATION',nameJa:'制御絶縁',concept:'electrical/control insulation'},
]);
const polymer=(id,routeId)=>({type:'polymer-discovery',id,routeId,consumed:false});
const recipe=(id,applicationId,label,inputs,processes=[])=>({id,applicationId,label,inputs,processes,prerequisites:['worldAwakened'],result:{type:'persistent-unlock',applicationId}});
export const ENGINEERING_RECIPES=freeze([
  recipe('nylon-wear','WEAR_SKIN','Nylon-6,6成形',[polymer('nylon-6-6','nylon-6-6-direct-polycondensation')],['forming']),
  recipe('br-sulfur-wear','WEAR_SKIN','BR硫黄加硫',[polymer('polybutadiene','polybutadiene-coordination-1-4'),{type:'element',id:'S',amount:1,consumed:true}],['sulfur-cure']),
  recipe('sbr-sulfur-wear','WEAR_SKIN','SBR硫黄加硫',[polymer('styrene-butadiene-copolymer','styrene-butadiene-radical'),{type:'element',id:'S',amount:1,consumed:true}],['sulfur-cure']),
  recipe('pan-phenolic-thermal','THERMAL_SHELL','PAN由来炭素繊維・フェノール樹脂・リン酸処理',[
    polymer('polyacrylonitrile','polyacrylonitrile-radical'),polymer('phenol-formaldehyde-resin','phenol-formaldehyde-resole'),
    {type:'molecule-discovery',id:'phosphoric-acid',consumed:false},
    {type:'reagent-from-elements',id:'phosphoric-acid',amount:1,consumed:true},
  ],['PAN-stabilization-carbonization','phenolic-composite-forming','phosphoric-acid-conditioning']),
  recipe('pvc-insulation','CONTROL_INSULATION','PVC成形',[polymer('polyvinyl-chloride','polyvinyl-chloride-radical')],['forming']),
  recipe('pvdf-insulation','CONTROL_INSULATION','PVDF成形',[polymer('polyvinylidene-fluoride','polyvinylidene-fluoride-radical')],['forming']),
  recipe('ptfe-insulation','CONTROL_INSULATION','PTFE成形',[polymer('polytetrafluoroethylene','polytetrafluoroethylene-radical')],['forming']),
]);
export const createEngineeringState=()=>({fabricated:Object.fromEntries(ENGINEERING_APPLICATIONS.map(({id})=>[id,false]))});
export function normalizeEngineeringState(value){return{fabricated:Object.fromEntries(ENGINEERING_APPLICATIONS.map(({id})=>[id,value?.fabricated?.[id]===true]))};}

// Compile only against actual production IDs and atom stocks, never a UI recipe.
export function compileEngineeringAuthority({polymers,routes,molecules,elements}){
  const polymerIds=new Set(polymers.map(record=>record.id)),routeById=new Map(routes.map(route=>[route.routeId,route])),moleculeById=new Map(molecules.map(record=>[record.id,record]));
  const compiled=ENGINEERING_RECIPES.map(recipe=>{
    const cost={};
    for(const input of recipe.inputs){
      if(input.type==='polymer-discovery'){
        if(!polymerIds.has(input.id)||routeById.get(input.routeId)?.polymerId!==input.id)throw new Error(`Invalid engineering polymer route: ${input.id}`);
      }else if(input.type==='element'){
        if(!elements.includes(input.id))throw new Error(`Invalid engineering element: ${input.id}`);
        cost[input.id]=(cost[input.id]??0)+input.amount;
      }else{
        const molecule=moleculeById.get(input.id);if(!molecule)throw new Error(`Invalid engineering molecule: ${input.id}`);
        if(input.type==='reagent-from-elements')for(const atom of molecule.atoms){
          if(!elements.includes(atom))throw new Error(`Invalid engineering reagent element: ${atom}`);
          cost[atom]=(cost[atom]??0)+input.amount;
        }
      }
    }
    return{...recipe,application:ENGINEERING_APPLICATIONS.find(application=>application.id===recipe.applicationId),cost};
  });
  return freeze(compiled);
}
export function fabricationEligibility({state,recipe,hasPolymer=()=>false,hasMolecule=()=>false}){
  if(state?.progress?.worldAwakened!==true)return{status:'LOCKED_BY_PROGRESSION'};
  if(!recipe)return{status:'AUTHORITY_NOT_READY'};
  if(state.engineering?.fabricated?.[recipe.applicationId]===true)return{status:'ALREADY_FABRICATED',applicationId:recipe.applicationId};
  const missing=recipe.inputs.filter(input=>input.type==='polymer-discovery'&&!hasPolymer(input.id)||input.type==='molecule-discovery'&&!hasMolecule(input.id)).map(input=>({type:input.type,id:input.id}));
  for(const [id,amount] of Object.entries(recipe.cost))if((state.elements?.[id]??0)<amount)missing.push({type:'element',id,amount,held:state.elements?.[id]??0});
  return{status:missing.length?'MISSING_INPUT':'AVAILABLE',applicationId:recipe.applicationId,missing,cost:{...recipe.cost}};
}
export function engineeringAuthorityReport(){return{
  applicationCount:ENGINEERING_APPLICATIONS.length,
  applications:ENGINEERING_APPLICATIONS.map(({id})=>({id,acceptedRoutes:ENGINEERING_RECIPES.filter(recipe=>recipe.applicationId===id).map(recipe=>({id:recipe.id,inputs:recipe.inputs,processes:recipe.processes}))})),
  durability:false,charge:false,maintenance:false,performanceTierByRecipe:false,persistentFabricationUnlock:true,
};}
