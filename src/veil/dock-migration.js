import {createInitialResourcesState,SCHEMA_VERSION} from './resources-persistence.js';

export const DOCK_RESOURCE_KEY='molecule-craft.resources.v1';
export const DOCK_SCHEMA_VERSION=SCHEMA_VERSION;
const COLLECTION_KEY='molecule-craft.collection.v1',WORKSPACE_STORAGE_KEY='molecule-craft.workspace.v1';
const validUpgradeLevel=value=>[0,1,2].includes(value);
const finiteCapacity=value=>Number.isFinite(Number(value))?Number(value):0;

export function inferLegacyOxygenUpgradeLevel(state){
  const upgrades=state?.upgrades;
  if(upgrades&&Object.hasOwn(upgrades,'oxygenTank'))return validUpgradeLevel(upgrades.oxygenTank)?upgrades.oxygenTank:null;
  const oxidizer=state?.tanks?.oxidizer,capacity=Math.max(finiteCapacity(oxidizer?.capacity),finiteCapacity(state?.oxygenTankCapacity),finiteCapacity(upgrades?.oxygenCapacity));
  if(capacity>=72)return 2;if(capacity>=48)return 1;
  if(oxidizer?.molecule==='oxygen'){const amount=finiteCapacity(oxidizer.amount);if(amount>48)return 2;if(amount>36)return 1;}
  return 0;
}

export function normalizeDockResourceEnvelope(source){
  if(!source||typeof source!=='object'||source.schemaVersion!==7)return {changed:false,state:source};
  const level=inferLegacyOxygenUpgradeLevel(source);if(level===null)return {changed:false,state:source};
  const next=createInitialResourcesState();next.upgrades.oxygenTank=level;
  return {changed:true,state:next,serialized:JSON.stringify(next)};
}

export function migrateDockStorage(storage=globalThis.localStorage){
  let raw=null;try{raw=storage?.getItem(DOCK_RESOURCE_KEY)??null;}catch{return {changed:false};}if(!raw)return {changed:false};
  let source;try{source=JSON.parse(raw);}catch{return {changed:false};}
  const normalized=normalizeDockResourceEnvelope(source);if(!normalized.changed)return normalized;
  try{storage.setItem(DOCK_RESOURCE_KEY,normalized.serialized);}catch{return {changed:false,state:source};}
  try{storage.removeItem?.(COLLECTION_KEY);storage.removeItem?.(WORKSPACE_STORAGE_KEY);}catch{}
  return normalized;
}
