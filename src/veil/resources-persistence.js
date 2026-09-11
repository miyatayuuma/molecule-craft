import { EXPEDITION } from './config.js';
import { GROWTH,DRIVES,REGIONS,TANK_USES,tankCapacity } from './growth.js';
import { performanceFor } from './molecule-roles.js';
import { validatePersistedWorkspace,migrateWorkspaceSave } from '../workspace-migrations.js?v=1';
import { WORKSPACE_STORAGE_KEY } from '../workspace-persistence.js?v=1';

export const RESOURCE_KEY='molecule-craft.resources.v1';
export const SCHEMA_VERSION=7;
const COLLECTION_KEY='molecule-craft.collection.v1',HELP_KEY='molecule-craft.help.v1';
export const MANAGED_ELEMENTS=['H','C','O'];
export const STOCKED_ELEMENTS=['H','C','N','O','F','P','S','Cl'];
export const MAX_RESOURCE_VALUE=1e9;

const emptyCollection=()=>({schemaVersion:2,discoveredMolecules:[],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]});
export const createInitialProgress=()=>({bestChain:0,runs:0,cleared:false,craftPrompt:false,sound:true,foundElements:['H'],regions:['veil'],checkpoint:'veil',frontier:false,choCompleted:false,totalCollected:0,signalMisses:0,signalLast:{}});
export const createInitialTanks=()=>Object.fromEntries(Object.keys(TANK_USES).map(use=>[use,{molecule:null,amount:0}]));
export const createInitialSelectedLoadout=()=>Object.fromEntries(Object.keys(TANK_USES).map(use=>[use,null]));
const emptyElementStock=()=>Object.fromEntries(STOCKED_ELEMENTS.map(element=>[element,0]));
export const createInitialResourcesState=()=>({schemaVersion:SCHEMA_VERSION,upgrades:{oxygenTank:0},elements:emptyElementStock(),tanks:createInitialTanks(),recipes:[],hints:[],dust:{H:0,C:0,O:0},loadout:{drive:'hydrogen',cooling:true,tanks:createInitialSelectedLoadout()},progress:createInitialProgress(),workspace:null});
export const isResourceInteger=x=>Number.isSafeInteger(x)&&x>=0&&x<=MAX_RESOURCE_VALUE;
export const isValidResourceId=x=>typeof x==='string'&&/^[A-Za-z][A-Za-z0-9-]*$/.test(x)&&!['constructor','prototype','__proto__'].includes(x);

const MANAGED=MANAGED_ELEMENTS,integer=isResourceInteger,validId=isValidResourceId;
const ids=x=>Array.isArray(x)&&x.every(validId)&&new Set(x).size===x.length;
const validSelectedLoadout=x=>x&&Object.keys(TANK_USES).every(use=>Object.hasOwn(x,use)&&(x[use]===null||validId(x[use])));

export function finishPendingResourcesReset(storage,state){const p=state.pendingReset;if(!p)return;if(p.collection)storage.setItem(COLLECTION_KEY,JSON.stringify(emptyCollection()));if(p.legacy)storage.removeItem(WORKSPACE_STORAGE_KEY);if(p.help)storage.removeItem(HELP_KEY);const done={...state};delete done.pendingReset;storage.setItem(RESOURCE_KEY,JSON.stringify(done));delete state.pendingReset;}

function validatePersistedState(s){
  if(!s||![1,2,3,4,5,6,7].includes(s.schemaVersion)||!s.elements||!ids(s.recipes)||!s.progress)throw Error('Invalid resources');
  for(const [key,n]of Object.entries(s.elements))if(!validId(key)||!integer(n))throw Error('Invalid inventory');
  if(s.schemaVersion<=5){if(!s.molecules)throw Error('Invalid inventory');for(const [key,n]of Object.entries(s.molecules))if(!validId(key)||!integer(n))throw Error('Invalid inventory');if(!integer(s.molecules.hydrogen))throw Error('Invalid inventory');}
  if(!integer(s.elements.H)||typeof s.progress.cleared!=='boolean'||!integer(s.progress.bestChain)||!integer(s.progress.runs))throw Error('Invalid progress');
  if(s.progress.choCompleted!==undefined&&typeof s.progress.choCompleted!=='boolean')throw Error('Invalid CHO completion');
  if(s.resetEpoch!==undefined&&!integer(s.resetEpoch))throw Error('Invalid reset epoch');
  if(s.pendingReset!==undefined&&(!s.pendingReset||['collection','legacy','help'].some(k=>typeof s.pendingReset[k]!=='boolean')))throw Error('Invalid reset journal');
  if(s.workspace!==null)validatePersistedWorkspace(s.workspace);
  if(s.schemaVersion===2){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean')throw Error('Invalid systems');
    for(const el of MANAGED)if(!integer(s.elements[el])||!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  if(s.schemaVersion===3){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean'||!s.tanks)throw Error('Invalid systems');
    for(const [id,capacity]of Object.entries({hydrogen:EXPEDITION.hydrogenCapacity,methane:EXPEDITION.methaneCapacity,oxygen:EXPEDITION.oxygenCapacity}))if(!integer(s.tanks[id])||s.tanks[id]>capacity)throw Error('Invalid propulsion tank');
    for(const el of MANAGED)if(!integer(s.elements[el])||!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  if(s.schemaVersion===4){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean'||!s.tanks)throw Error('Invalid systems');
    for(const [use,capacity]of Object.entries({propellant:3,fuel:18,oxidizer:36,coolant:12})){const tank=s.tanks[use];if(!tank||tank.molecule!==null&&!validId(tank.molecule)||!integer(tank.amount)||tank.amount>capacity||tank.amount>0&&!tank.molecule)throw Error('Invalid tank');}
    for(const el of MANAGED)if(!integer(s.elements[el])||!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  if(s.schemaVersion===5){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean'||!s.tanks)throw Error('Invalid systems');
    for(const use of Object.keys(TANK_USES)){const tank=s.tanks[use];if(!tank||tank.molecule!==null&&!validId(tank.molecule)||!integer(tank.amount)||tank.amount>0&&!tank.molecule)throw Error('Invalid tank');const capacity=tank.molecule?tankCapacity(use,tank.molecule):0;if(tank.molecule&&capacity===null||tank.amount>(capacity??0))throw Error('Invalid tank capacity');}
    for(const el of MANAGED)if(!integer(s.elements[el])||!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  if(s.schemaVersion===7&&(!s.upgrades||![0,1,2].includes(s.upgrades.oxygenTank)))throw Error('Invalid tank upgrades');
  if(s.schemaVersion>=6){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean'||s.loadout.tanks!==undefined&&!validSelectedLoadout(s.loadout.tanks)||!s.tanks||Object.hasOwn(s,'molecules'))throw Error('Invalid systems');
    for(const use of Object.keys(TANK_USES)){const tank=s.tanks[use];if(!tank||tank.molecule!==null&&!validId(tank.molecule)||!integer(tank.amount)||tank.amount>0&&!tank.molecule)throw Error('Invalid tank');const capacity=tank.molecule?tankCapacity(use,tank.molecule,s.schemaVersion===7?s.upgrades:{}):0;if(tank.molecule&&capacity===null||tank.amount>(capacity??0))throw Error('Invalid tank capacity');}
    for(const el of MANAGED)if(!integer(s.elements[el])||!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  return s;
}

function migrate(old){
  const workspace=old.workspace===null?null:migrateWorkspaceSave(old.workspace);
  if(old.schemaVersion>=6){const tanks={...createInitialTanks(),...old.tanks},fallback=Object.fromEntries(Object.keys(TANK_USES).map(use=>[use,tanks[use]?.molecule??null])),selected=validSelectedLoadout(old.loadout?.tanks)?{...fallback,...old.loadout.tanks}:fallback;return {...old,schemaVersion:SCHEMA_VERSION,workspace,upgrades:old.schemaVersion===SCHEMA_VERSION?old.upgrades:{oxygenTank:0},progress:{...createInitialProgress(),...old.progress},elements:{...emptyElementStock(),...old.elements},tanks,loadout:{drive:old.loadout?.drive??'hydrogen',cooling:old.loadout?.cooling??true,tanks:selected}};}
  const {molecules:discardedMoleculeInventory,...oldWithoutMolecules}=old;
  const next={...createInitialResourcesState(),...oldWithoutMolecules,schemaVersion:SCHEMA_VERSION,workspace,upgrades:{oxygenTank:0}};next.elements={...emptyElementStock(),...old.elements};next.tanks=createInitialTanks();next.progress={...createInitialProgress(),...old.progress};
  const load=(use,id,amount,{legacyBurstUnits=false}={})=>{const capacity=tankCapacity(use,id)??0,value=Math.min(capacity,(amount??0)*(legacyBurstUnits?performanceFor(id,'propellant')?.moleculesPerBurst??1:1));if(value>0)next.tanks[use]={molecule:id,amount:value};};
  if(old.schemaVersion===5){for(const use of Object.keys(TANK_USES)){const tank=old.tanks?.[use];if(tank?.molecule)load(use,tank.molecule,tank.amount);}}
  else if(old.schemaVersion===4){for(const use of Object.keys(TANK_USES)){const tank=old.tanks?.[use];if(tank?.molecule)load(use,tank.molecule,tank.amount,{legacyBurstUnits:use==='propellant'&&tank.molecule==='hydrogen'});}}
  else if(old.schemaVersion===3){load('propellant','hydrogen',old.tanks.hydrogen,{legacyBurstUnits:true});load('fuel','methane',old.tanks.methane);load('oxidizer','oxygen',old.tanks.oxygen);}
  next.loadout={drive:next.loadout?.drive??'hydrogen',cooling:next.loadout?.cooling??true,tanks:Object.fromEntries(Object.keys(TANK_USES).map(use=>[use,next.tanks[use]?.molecule??null]))};
  if(old.schemaVersion===1)next.migrateDiscoveries=true;for(const a of next.workspace?.atoms??[])if(MANAGED.includes(a.element)&&!next.progress.foundElements.includes(a.element))next.progress.foundElements.push(a.element);return next;
}

function parsePersistedResources(raw){if(typeof raw!=='string'||raw.length>3e6)throw Error('Invalid resources');return validatePersistedState(JSON.parse(raw));}
export function migrateResourcesSave(raw){return validatePersistedState(migrate(parsePersistedResources(raw)));}
export function loadPersistedResources(storage){let previous=storage?.getItem(RESOURCE_KEY)??null;if(!previous)return {state:null,previous:null};let persisted=parsePersistedResources(previous);if(persisted.pendingReset){finishPendingResourcesReset(storage,persisted);previous=storage.getItem(RESOURCE_KEY);}return {state:validatePersistedState(migrate(persisted)),previous};}
export function serializeResourcesState(state){if(state?.schemaVersion!==SCHEMA_VERSION)throw Error('Invalid resources schema');return JSON.stringify(validatePersistedState(state));}
