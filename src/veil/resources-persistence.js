import { GROWTH,DRIVES,REGIONS,EXPEDITION_DESTINATION_REGION_IDS,TANK_USES,tankCapacity } from './growth.js';
import { validatePersistedWorkspace } from '../workspace-migrations.js?v=1';
import { WORKSPACE_STORAGE_KEY } from '../workspace-persistence.js?v=1';
import {normalizeWorldAwakeningProgress} from './world-awakening.js';
import {INSIGHT_DESTINATION_HISTORY_LIMIT,INSIGHT_DESTINATION_ORDER,normalizeInsightDestinationHistory} from './insight-destination.js';

export const RESOURCE_KEY='molecule-craft.resources.v1';
export const SCHEMA_VERSION=9;
const COLLECTION_KEY='molecule-craft.collection.v1',HELP_KEY='molecule-craft.help.v1';
export const MANAGED_ELEMENTS=['H','C','N','O','P','S','F','Cl'];
export const DUST_ELEMENTS=['H','C','O'];
export const STOCKED_ELEMENTS=['H','C','N','O','F','P','S','Cl'];
export const MAX_RESOURCE_VALUE=1e9;

const emptyCollection=()=>({schemaVersion:3,discoveredMolecules:[],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]});
export const createInitialProgress=()=>({bestChain:0,runs:0,cleared:false,craftPrompt:false,sound:true,foundElements:['H'],regions:['veil'],checkpoint:'veil',frontier:false,choCompleted:false,totalCollected:0,signalMisses:0,signalLast:{},insightDestinationHistory:[],thermalStrainExperienced:false,driveThermalInterruptions:0,coolantNeedExperienced:false,coreFractured:false,worldAwakeningPending:false,worldAwakened:false,rareEcologyEligible:false});
export const createInitialTanks=()=>Object.fromEntries(Object.keys(TANK_USES).map(use=>[use,{molecule:null,amount:0}]));
export const createInitialSelectedLoadout=()=>Object.fromEntries(Object.keys(TANK_USES).map(use=>[use,null]));
const emptyElementStock=()=>Object.fromEntries(STOCKED_ELEMENTS.map(element=>[element,0]));
export const createInitialResourcesState=()=>({schemaVersion:SCHEMA_VERSION,elements:emptyElementStock(),tanks:createInitialTanks(),recipes:[],hints:[],dust:{H:0,C:0,O:0},loadout:{drive:'hydrogen',cooling:true,tanks:createInitialSelectedLoadout()},progress:createInitialProgress(),workspace:null});
export const isResourceInteger=x=>Number.isSafeInteger(x)&&x>=0&&x<=MAX_RESOURCE_VALUE;
export const isValidResourceId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(x)&&!['constructor','prototype','__proto__'].includes(x);

const MANAGED=MANAGED_ELEMENTS,DUST=DUST_ELEMENTS,integer=isResourceInteger,validId=isValidResourceId;
const ids=x=>Array.isArray(x)&&x.every(validId)&&new Set(x).size===x.length;
const validSelectedLoadout=x=>x&&Object.keys(TANK_USES).every(use=>Object.hasOwn(x,use)&&(x[use]===null||validId(x[use])));
export function normalizeCurrentTankRoles(state){
  if(!state||state.schemaVersion!==SCHEMA_VERSION||!state.tanks||typeof state.tanks!=='object')return false;let changed=false;
  for(const [use,tank] of Object.entries(createInitialTanks()))if(!Object.hasOwn(state.tanks,use)){state.tanks[use]=tank;changed=true;}
  if(state.loadout?.tanks&&typeof state.loadout.tanks==='object')for(const use of Object.keys(TANK_USES))if(!Object.hasOwn(state.loadout.tanks,use)){state.loadout.tanks[use]=null;changed=true;}
  return changed;
}
export function normalizeCurrentWorldProgress(state){return !!state?.progress&&normalizeWorldAwakeningProgress(state.progress);}
export function normalizeCurrentInsightDestinationHistory(state){const progress=state?.progress;if(!progress)return false;const normalized=normalizeInsightDestinationHistory(progress.insightDestinationHistory);if(Array.isArray(progress.insightDestinationHistory)&&JSON.stringify(progress.insightDestinationHistory)===JSON.stringify(normalized))return false;progress.insightDestinationHistory=normalized;return true;}
export function normalizeCurrentElementStocks(state){if(!state?.elements||typeof state.elements!=='object')return false;let changed=false;for(const element of STOCKED_ELEMENTS)if(!Object.hasOwn(state.elements,element)){state.elements[element]=0;changed=true;}return changed;}
function normalizeCurrentResourcesState(state){return !!(normalizeCurrentTankRoles(state)|normalizeCurrentWorldProgress(state)|normalizeCurrentInsightDestinationHistory(state)|normalizeCurrentElementStocks(state));}

export function finishPendingResourcesReset(storage,state){const p=state.pendingReset;if(!p)return;if(p.collection)storage.setItem(COLLECTION_KEY,JSON.stringify(emptyCollection()));if(p.legacy)storage.removeItem(WORKSPACE_STORAGE_KEY);if(p.help)storage.removeItem(HELP_KEY);const done={...state};delete done.pendingReset;storage.setItem(RESOURCE_KEY,JSON.stringify(done));delete state.pendingReset;}

function validatePersistedState(s){
  if(!s||s.schemaVersion!==SCHEMA_VERSION||!s.elements||!ids(s.recipes)||!ids(s.hints)||!s.progress||!s.tanks||!s.dust||!s.loadout)throw Error('Invalid resources');
  if(Object.hasOwn(s,'upgrades')||Object.hasOwn(s,'treatments'))throw Error('Legacy resource fields are not valid in the current schema');
  for(const [key,n]of Object.entries(s.elements))if(!validId(key)||!integer(n))throw Error('Invalid inventory');
  for(const el of MANAGED)if(!integer(s.elements[el]))throw Error('Invalid atom balance');
  for(const el of DUST)if(!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
  if(typeof s.progress.cleared!=='boolean'||!integer(s.progress.bestChain)||!integer(s.progress.runs))throw Error('Invalid progression');
  for(const key of ['choCompleted','thermalStrainExperienced','coolantNeedExperienced'])if(s.progress[key]!==undefined&&typeof s.progress[key]!=='boolean')throw Error('Invalid progression');
  for(const key of ['driveThermalInterruptions','totalCollected','signalMisses'])if(s.progress[key]!==undefined&&!integer(s.progress[key]))throw Error('Invalid progression');
  for(const key of ['coreFractured','worldAwakeningPending','worldAwakened','rareEcologyEligible'])if(typeof s.progress[key]!=='boolean')throw Error('Invalid progression');
  if(!Array.isArray(s.progress.foundElements)||!s.progress.foundElements.includes('H')||!s.progress.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(s.progress.regions)||!s.progress.regions.includes('veil')||!s.progress.regions.every(id=>Object.hasOwn(REGIONS,id))||!s.progress.regions.includes(s.progress.checkpoint)||typeof s.progress.frontier!=='boolean'||!s.progress.signalLast||Object.entries(s.progress.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid progression');
  if(!Array.isArray(s.progress.insightDestinationHistory)||s.progress.insightDestinationHistory.length>INSIGHT_DESTINATION_HISTORY_LIMIT||s.progress.insightDestinationHistory.some(destination=>!INSIGHT_DESTINATION_ORDER.includes(destination)))throw Error('Invalid Insight destination history');
  if(!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean'||!validSelectedLoadout(s.loadout.tanks))throw Error('Invalid loadout');
  for(const use of Object.keys(TANK_USES)){const tank=s.tanks[use];if(!tank||tank.molecule!==null&&!validId(tank.molecule)||!integer(tank.amount)||tank.amount>0&&!tank.molecule)throw Error('Invalid tank');const capacity=tank.molecule?tankCapacity(use,tank.molecule):0;if(tank.molecule&&capacity===null||tank.amount>(capacity??0))throw Error('Invalid tank capacity');}
  if(s.resetEpoch!==undefined&&!integer(s.resetEpoch))throw Error('Invalid reset epoch');
  if(s.pendingReset!==undefined&&(!s.pendingReset||['collection','legacy','help'].some(k=>typeof s.pendingReset[k]!=='boolean')))throw Error('Invalid reset journal');
  if(s.workspace!==null)validatePersistedWorkspace(s.workspace);
  return s;
}

function parseResourceEnvelope(raw){if(typeof raw!=='string'||raw.length>3e6)throw Error('Invalid resources');const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object')throw Error('Invalid resources');return parsed;}
function migrateV8ResourceState(state){
  const next={...state,schemaVersion:SCHEMA_VERSION,tanks:state.tanks&&typeof state.tanks==='object'?{...state.tanks}:state.tanks};
  delete next['upgrades'];delete next['treatments'];
  const oxidizer=next.tanks?.oxidizer;if(oxidizer?.molecule==='oxygen'&&Number.isSafeInteger(oxidizer.amount))oxidizer.amount=Math.min(36,oxidizer.amount);
  return next;
}
function toCurrentSchema(state){return state?.schemaVersion===8?migrateV8ResourceState(state):state;}
function parsePersistedResources(raw){const state=toCurrentSchema(parseResourceEnvelope(raw));normalizeCurrentResourcesState(state);return validatePersistedState(state);}
export function normalizeLegacyExpeditionDestination(state){
  const progress=state?.progress;if(!progress||progress.checkpoint!=='frontier')return false;const visited=Array.isArray(progress.regions)?progress.regions:[],eligible=EXPEDITION_DESTINATION_REGION_IDS.filter(id=>id!=='nitrogen'||progress.choCompleted===true),fallback=eligible.filter(id=>visited.includes(id)).at(-1)??'veil';progress.checkpoint=fallback;return true;
}
export function migrateResourcesSave(raw){try{const persisted=toCurrentSchema(parseResourceEnvelope(raw));if(persisted.schemaVersion!==SCHEMA_VERSION)return createInitialResourcesState();normalizeCurrentResourcesState(persisted);const state=validatePersistedState(persisted);normalizeLegacyExpeditionDestination(state);return state;}catch{return createInitialResourcesState();}}
export function loadPersistedResources(storage){let previous=storage?.getItem(RESOURCE_KEY)??null;if(!previous)return {state:null,previous:null};let envelope;try{envelope=parseResourceEnvelope(previous);}catch{const state=createInitialResourcesState();try{storage?.setItem(RESOURCE_KEY,serializeResourcesState(state));storage?.removeItem(COLLECTION_KEY);storage?.removeItem(WORKSPACE_STORAGE_KEY);previous=storage?.getItem(RESOURCE_KEY)??previous;}catch{}return {state,previous};}const migrated=envelope.schemaVersion===8;envelope=toCurrentSchema(envelope);if(envelope.schemaVersion!==SCHEMA_VERSION){const state=createInitialResourcesState();try{storage?.setItem(RESOURCE_KEY,serializeResourcesState(state));storage?.removeItem(COLLECTION_KEY);storage?.removeItem(WORKSPACE_STORAGE_KEY);previous=storage?.getItem(RESOURCE_KEY)??previous;}catch{}return {state,previous};}const normalizedCurrent=normalizeCurrentResourcesState(envelope);let persisted=validatePersistedState(envelope);if(persisted.pendingReset){finishPendingResourcesReset(storage,persisted);previous=storage.getItem(RESOURCE_KEY);persisted=parsePersistedResources(previous);}if(migrated||normalizedCurrent||normalizeLegacyExpeditionDestination(persisted)){const normalized=serializeResourcesState(persisted);try{storage?.setItem(RESOURCE_KEY,normalized);previous=storage?.getItem(RESOURCE_KEY)??normalized;}catch{}}return {state:persisted,previous};}
export function serializeResourcesState(state){if(state?.schemaVersion!==SCHEMA_VERSION)throw Error('Invalid resources schema');return JSON.stringify(validatePersistedState(state));}
