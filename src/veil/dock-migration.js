import {RESOURCE_KEY,SCHEMA_VERSION,createInitialResourcesState,serializeResourcesState} from './resources-persistence.js';

const validUpgradeLevel=value=>[0,1,2].includes(value);
const finiteCapacity=value=>Number.isFinite(Number(value))?Number(value):0;

export function inferLegacyOxygenUpgradeLevel(state){
  const upgrades=state?.upgrades;
  if(upgrades&&Object.hasOwn(upgrades,'oxygenTank'))return validUpgradeLevel(upgrades.oxygenTank)?upgrades.oxygenTank:null;
  const oxidizer=state?.tanks?.oxidizer,capacity=Math.max(
    finiteCapacity(oxidizer?.capacity),
    finiteCapacity(state?.oxygenTankCapacity),
    finiteCapacity(upgrades?.oxygenCapacity),
  );
  if(capacity>=72)return 2;
  if(capacity>=48)return 1;
  if(oxidizer?.molecule==='oxygen'){
    const amount=finiteCapacity(oxidizer.amount);
    if(amount>48)return 2;
    if(amount>36)return 1;
  }
  return 0;
}

export function normalizeDockResourceEnvelope(source){
  if(!source||typeof source!=='object'||![7,SCHEMA_VERSION].includes(source.schemaVersion))return {changed:false,state:source};
  const level=inferLegacyOxygenUpgradeLevel(source);
  if(level===null)return {changed:false,state:source};
  if(source.schemaVersion===SCHEMA_VERSION&&validUpgradeLevel(source.upgrades?.oxygenTank))return {changed:false,state:source};
  const defaults=createInitialResourcesState(),next={
    ...defaults,...source,schemaVersion:SCHEMA_VERSION,
    upgrades:{...defaults.upgrades,...source.upgrades,oxygenTank:level},
    elements:{...defaults.elements,...source.elements},
    tanks:{...defaults.tanks,...source.tanks},
    dust:{...defaults.dust,...source.dust},
    loadout:{...defaults.loadout,...source.loadout,tanks:{...defaults.loadout.tanks,...source.loadout?.tanks}},
    progress:{...defaults.progress,...source.progress,signalLast:{...defaults.progress.signalLast,...source.progress?.signalLast}},
  };
  try{return {changed:true,state:next,serialized:serializeResourcesState(next)};}catch{return {changed:false,state:source};}
}

export function migrateDockStorage(storage=globalThis.localStorage){
  let raw=null;try{raw=storage?.getItem(RESOURCE_KEY)??null;}catch{return {changed:false};}
  if(!raw)return {changed:false};
  let source;try{source=JSON.parse(raw);}catch{return {changed:false};}
  const normalized=normalizeDockResourceEnvelope(source);if(!normalized.changed)return normalized;
  try{storage.setItem(RESOURCE_KEY,normalized.serialized);return normalized;}catch{return {changed:false,state:source};}
}
