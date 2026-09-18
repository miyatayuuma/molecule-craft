import { EXPEDITION } from './config.js';
import { GROWTH,DRIVES,REGIONS,EXPEDITION_DESTINATION_REGION_IDS,TANK_USES,tankCapacity } from './growth.js';
import { validatePersistedWorkspace } from '../workspace-migrations.js?v=1';
import { WORKSPACE_STORAGE_KEY } from '../workspace-persistence.js?v=1';
import {normalizeWorldAwakeningProgress} from './world-awakening.js';

export const RESOURCE_KEY='molecule-craft.resources.v1';
export const SCHEMA_VERSION=8;
const COLLECTION_KEY='molecule-craft.collection.v1',HELP_KEY='molecule-craft.help.v1';
export const MANAGED_ELEMENTS=['H','C','N','O','P','S','F','Cl'];
export const DUST_ELEMENTS=['H','C','O'];
export const STOCKED_ELEMENTS=['H','C','N','O','F','P','S','Cl'];
export const MAX_RESOURCE_VALUE=1e9;

const emptyCollection=()=>({schemaVersion:3,discoveredMolecules:[],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]});
export const createInitialProgress=()=>({bestChain:0,runs:0,cleared:false,craftPrompt:false,sound:true,foundElements:['H'],regions:['veil'],checkpoint:'veil',frontier:false,choCompleted:false,totalCollected:0,signalMisses:0,signalLast:{},thermalStrainExperienced:false,driveThermalInterruptions:0,coolantNeedExperienced:false,coreFractured:false,worldAwakeningPending:false,worldAwakened:false,rareEcologyEligible:false});
export const createInitialTanks=()=>Object.fromEntries(Object.keys(TANK_USES).map(use=>[use,{molecule:null,amount:0}]));
export const createInitialSelectedLoadout=()=>Object.fromEntries(Object.keys(TANK_USES).map(use=>[use,null]));
const emptyElementStock=()=>Object.fromEntries(STOCKED_ELEMENTS.map(element=>[element,0]));
export const createInitialResourcesState=()=>({schemaVersion:SCHEMA_VERSION,upgrades:{oxygenTank:0},elements:emptyElementStock(),tanks:createInitialTanks(),recipes:[],hints:[],dust:{H:0,C:0,O:0},loadout:{drive:'hydrogen',cooling:true,tanks:createInitialSelectedLoadout()},progress:createInitialProgress(),workspace:null});
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
export function normalizeCurrentElementStocks(state){if(!state?.elements||typeof state.elements!=='object')return false;let changed=false;for(const element of STOCKED_ELEMENTS)if(!Object.hasOwn(state.elements,element)){state.elements[element]=0;changed=true;}return changed;}
function normalizeCurrentResourcesState(state){return !!(normalizeCurrentTankRoles(state)|normalizeCurrentWorldProgress(state)|normalizeCurrentElementStocks(state));}

export function finishPendingResourcesReset(storage,state){const p=state.pendingReset;if(!p)return;if(p.collection)storage.setItem(COLLECTION_KEY,JSON.stringify(emptyCollection()));if(p.legacy)storage.removeItem(WORKSPACE_STORAGE_KEY);if(p.help)storage.removeItem(HELP_KEY);const done={...state};delete done.pendingReset;storage.setItem(RESOURCE_KEY,JSON.stringify(done));delete state.pendingReset;}

function validatePersistedState(s){
  if(!s||s.schemaVersion!==SCHEMA_VERSION||!s.elements||!ids(s.recipes)||!s.progress)throw Error('Invalid resources');
  for(const [key,n]of Object.entries(s.elements))if(!validId(key)||!integer(n))throw Error('Invalid inventory');
  if(s.schemaVersion<=5){if(!s.molecules)throw Error('Invalid inventory');for(const [key,n]of Object.entries(s.molecules))if(!validId(key)||!integer(n))throw Error('Invalid inventory');if(!integer(s.molecules.hydrogen))throw Error('Invalid inventory');}
  if(!integer(s.elements.H)||typeof s.progress.cleared!=='boolean'||!integer(s.progress.bestChain)||!integer(s.progress.runs))throw Error('Invalid progress');
  if(s.progress.choCompleted!==undefined&&typeof s.progress.choCompleted!=='boolean')throw Error('Invalid CHO completion');
  if(s.progress.thermalStrainExperienced!==undefined&&typeof s.progress.thermalStrainExperienced!=='boolean')throw Error('Invalid thermal progression');
  if(s.progress.driveThermalInterruptions!==undefined&&!integer(s.progress.driveThermalInterruptions))throw Error('Invalid thermal progression');
  if(s.progress.coolantNeedExperienced!==undefined&&typeof s.progress.coolantNeedExperienced!=='boolean')throw Error('Invalid thermal progression');
  if(['coreFractured','worldAwakeningPending','worldAwakened','rareEcologyEligible'].some(key=>typeof s.progress[key]!=='boolean'))throw Error('Invalid world awakening progression');
  if(s.resetEpoch!==undefined&&!integer(s.resetEpoch))throw Error('Invalid reset epoch');
  if(s.pendingReset!==undefined&&(!s.pendingReset||['collection','legacy','help'].some(k=>typeof s.pendingReset[k]!=='boolean')))throw Error('Invalid reset journal');
  if(s.workspace!==null)validatePersistedWorkspace(s.workspace);
  if(s.schemaVersion===2){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean')throw Error('Invalid systems');
    for(const el of MANAGED)if(!integer(s.elements[el]))throw Error('Invalid atom balance');for(const el of DUST)if(!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  if(s.schemaVersion===3){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean'||!s.tanks)throw Error('Invalid systems');
    for(const [id,capacity]of Object.entries({hydrogen:EXPEDITION.hydrogenCapacity,methane:EXPEDITION.methaneCapacity,oxygen:EXPEDITION.oxygenCapacity}))if(!integer(s.tanks[id])||s.tanks[id]>capacity)throw Error('Invalid propulsion tank');
    for(const el of MANAGED)if(!integer(s.elements[el]))throw Error('Invalid atom balance');for(const el of DUST)if(!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  if(s.schemaVersion===4){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean'||!s.tanks)throw Error('Invalid systems');
    for(const [use,capacity]of Object.entries({propellant:3,fuel:18,oxidizer:36,coolant:12})){const tank=s.tanks[use];if(!tank||tank.molecule!==null&&!validId(tank.molecule)||!integer(tank.amount)||tank.amount>capacity||tank.amount>0&&!tank.molecule)throw Error('Invalid tank');}
    for(const el of MANAGED)if(!integer(s.elements[el]))throw Error('Invalid atom balance');for(const el of DUST)if(!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  if(s.schemaVersion===5){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean'||!s.tanks)throw Error('Invalid systems');
    for(const use of Object.keys(TANK_USES)){const tank=s.tanks[use];if(!tank||tank.molecule!==null&&!validId(tank.molecule)||!integer(tank.amount)||tank.amount>0&&!tank.molecule)throw Error('Invalid tank');const capacity=tank.molecule?tankCapacity(use,tank.molecule):0;if(tank.molecule&&capacity===null||tank.amount>(capacity??0))throw Error('Invalid tank capacity');}
    for(const el of MANAGED)if(!integer(s.elements[el]))throw Error('Invalid atom balance');for(const el of DUST)if(!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  if(s.schemaVersion>=7&&(!s.upgrades||![0,1,2].includes(s.upgrades.oxygenTank)))throw Error('Invalid tank upgrades');
  if(s.schemaVersion>=6){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean'||s.loadout.tanks!==undefined&&!validSelectedLoadout(s.loadout.tanks)||!s.tanks||Object.hasOwn(s,'molecules'))throw Error('Invalid systems');
    for(const use of Object.keys(TANK_USES)){const tank=s.tanks[use];if(!tank||tank.molecule!==null&&!validId(tank.molecule)||!integer(tank.amount)||tank.amount>0&&!tank.molecule)throw Error('Invalid tank');const capacity=tank.molecule?tankCapacity(use,tank.molecule,s.schemaVersion>=7?s.upgrades:{}):0;if(tank.molecule&&capacity===null||tank.amount>(capacity??0))throw Error('Invalid tank capacity');}
    for(const el of MANAGED)if(!integer(s.elements[el]))throw Error('Invalid atom balance');for(const el of DUST)if(!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  return s;
}

function parseResourceEnvelope(raw){if(typeof raw!=='string'||raw.length>3e6)throw Error('Invalid resources');const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object')throw Error('Invalid resources');return parsed;}
function parsePersistedResources(raw){const state=parseResourceEnvelope(raw);normalizeCurrentResourcesState(state);return validatePersistedState(state);}
export function normalizeLegacyExpeditionDestination(state){
  const progress=state?.progress;if(!progress||progress.checkpoint!=='frontier')return false;const visited=Array.isArray(progress.regions)?progress.regions:[],eligible=EXPEDITION_DESTINATION_REGION_IDS.filter(id=>id!=='nitrogen'||progress.choCompleted===true),fallback=eligible.filter(id=>visited.includes(id)).at(-1)??'veil';progress.checkpoint=fallback;return true;
}
export function migrateResourcesSave(raw){try{const persisted=parseResourceEnvelope(raw);if(persisted.schemaVersion!==SCHEMA_VERSION)return createInitialResourcesState();normalizeCurrentResourcesState(persisted);const state=validatePersistedState(persisted);normalizeLegacyExpeditionDestination(state);return state;}catch{return createInitialResourcesState();}}
export function loadPersistedResources(storage){let previous=storage?.getItem(RESOURCE_KEY)??null;if(!previous)return {state:null,previous:null};let envelope;try{envelope=parseResourceEnvelope(previous);}catch{const state=createInitialResourcesState();try{storage?.setItem(RESOURCE_KEY,serializeResourcesState(state));storage?.removeItem(COLLECTION_KEY);storage?.removeItem(WORKSPACE_STORAGE_KEY);previous=storage?.getItem(RESOURCE_KEY)??previous;}catch{}return {state,previous};}if(envelope.schemaVersion!==SCHEMA_VERSION){const state=createInitialResourcesState();try{storage?.setItem(RESOURCE_KEY,serializeResourcesState(state));storage?.removeItem(COLLECTION_KEY);storage?.removeItem(WORKSPACE_STORAGE_KEY);previous=storage?.getItem(RESOURCE_KEY)??previous;}catch{}return {state,previous};}const normalizedCurrent=normalizeCurrentResourcesState(envelope);let persisted=validatePersistedState(envelope);if(persisted.pendingReset){finishPendingResourcesReset(storage,persisted);previous=storage.getItem(RESOURCE_KEY);persisted=parsePersistedResources(previous);}if(normalizedCurrent||normalizeLegacyExpeditionDestination(persisted)){const normalized=serializeResourcesState(persisted);try{storage?.setItem(RESOURCE_KEY,normalized);previous=storage?.getItem(RESOURCE_KEY)??normalized;}catch{}}return {state:persisted,previous};}
export function serializeResourcesState(state){if(state?.schemaVersion!==SCHEMA_VERSION)throw Error('Invalid resources schema');return JSON.stringify(validatePersistedState(state));}
