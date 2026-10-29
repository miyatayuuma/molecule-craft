const ID=/^[a-z0-9][a-z0-9-]*$/;
const FORMATIONS=new Set(['addition','copolymerization','ring-opening','polycondensation','condensation-network']);
const TOPOLOGIES=new Set(['linear','copolymer','network']);
const ROLES=new Set(['monomer','comonomer','crosslinker']);
let records=[],byId=new Map(),state={status:'idle',loaded:false,count:0,error:null,source:null},loadPromise=null;

function requireText(record,key){
  if(typeof record?.[key]!=='string'||!record[key].trim())throw new Error(`Invalid ${key} in polymer record.`);
}
function normalizeReactant(item,recordId,moleculeIds){
  if(!item||typeof item!=='object'||typeof item.moleculeId!=='string'||!ID.test(item.moleculeId))throw new Error(`Invalid reactant in ${recordId}.`);
  if(!ROLES.has(item.role))throw new Error(`Invalid reactant role in ${recordId}.`);
  if(moleculeIds&&!moleculeIds.has(item.moleculeId))throw new Error(`Unknown molecule ${item.moleculeId} in ${recordId}.`);
  return Object.freeze({moleculeId:item.moleculeId,role:item.role});
}
export function validatePolymerCatalog(input,{moleculeIds=null}={}){
  if(!Array.isArray(input))throw new Error('Polymer database must be an array.');
  const seen=new Set();
  return input.map(record=>{
    if(!record||typeof record!=='object'||typeof record.id!=='string'||!ID.test(record.id))throw new Error('Invalid polymer id.');
    if(seen.has(record.id))throw new Error(`Duplicate polymer id: ${record.id}`);
    seen.add(record.id);
    for(const key of ['nameJa','nameEn','family','formation','topology'])requireText(record,key);
    if(Object.hasOwn(record,'summaryJa')||Object.hasOwn(record,'description')||Object.hasOwn(record,'details'))throw new Error(`Player-facing prose does not belong in polymer chemistry data: ${record.id}`);
    if(!FORMATIONS.has(record.formation))throw new Error(`Invalid formation in ${record.id}.`);
    if(!TOPOLOGIES.has(record.topology))throw new Error(`Invalid topology in ${record.id}.`);
    if(!Array.isArray(record.reactants)||!record.reactants.length)throw new Error(`Missing reactants in ${record.id}.`);
    if(record.repeatUnit!==null&&(typeof record.repeatUnit!=='string'||!record.repeatUnit.trim()))throw new Error(`Invalid repeatUnit in ${record.id}.`);
    for(const field of Object.keys(record))if(/seal|oxygen|utility|score|unlock|qualification|capacity|gameplay|ranking/i.test(field))throw new Error(`Gameplay field ${field} does not belong in polymer chemistry data.`);
    return Object.freeze({...record,reactants:Object.freeze(record.reactants.map(item=>normalizeReactant(item,record.id,moleculeIds)))});
  });
}
function publish(input,source,options){
  records=validatePolymerCatalog(input,options);
  byId=new Map(records.map(record=>[record.id,record]));
  state={status:'ready',loaded:true,count:records.length,error:null,source};
  return {ok:true,count:records.length,source};
}
export function setPolymerCatalog(input,options={}){return publish(input,'direct',options);}
export function polymerCatalogStatus(){return {...state};}
export function polymerCatalog(){
  if(state.status!=='ready')throw new Error(`Polymer database is not ready (${state.status}).`);
  return records.slice();
}
export function polymerRecord(id){
  if(state.status!=='ready')throw new Error(`Polymer database is not ready (${state.status}).`);
  return byId.get(id)??null;
}
export async function loadPolymerCatalog({url=new URL('../data/polymers.json',import.meta.url),moleculeIds=null}={}){
  if(loadPromise)return loadPromise;
  state={status:'loading',loaded:false,count:0,error:null,source:null};
  const promise=(async()=>{
    try{
      const response=await fetch(url,{cache:'no-store'});
      if(!response?.ok)throw new Error(`HTTP ${response?.status??'unknown'}`);
      return publish(await response.json(),'network',{moleculeIds});
    }catch(error){
      records=[];byId=new Map();state={status:'error',loaded:false,count:0,error:String(error?.message??error),source:null};
      return {ok:false,count:0,error:state.error};
    }
  })().finally(()=>{if(loadPromise===promise)loadPromise=null;});
  loadPromise=promise;
  return promise;
}
