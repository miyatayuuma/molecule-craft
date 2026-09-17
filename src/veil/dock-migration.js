export const DOCK_RESOURCE_KEY='molecule-craft.resources.v1';
export const DOCK_SCHEMA_VERSION=8;
const TANK_USES=['propellant','fuel','oxidizer','coolant'];
const validUpgradeLevel=value=>[0,1,2].includes(value);
const finiteCapacity=value=>Number.isFinite(Number(value))?Number(value):0;
const blankTanks=()=>Object.fromEntries(TANK_USES.map(use=>[use,{molecule:null,amount:0}]));
const blankSelected=()=>Object.fromEntries(TANK_USES.map(use=>[use,null]));
const blankProgress=()=>({bestChain:0,runs:0,cleared:false,craftPrompt:false,sound:true,foundElements:['H'],regions:['veil'],checkpoint:'veil',frontier:false,choCompleted:false,totalCollected:0,signalMisses:0,signalLast:{},thermalStrainExperienced:false,driveThermalInterruptions:0,coolantNeedExperienced:false});

export function inferLegacyOxygenUpgradeLevel(state){
  const upgrades=state?.upgrades;
  if(upgrades&&Object.hasOwn(upgrades,'oxygenTank'))return validUpgradeLevel(upgrades.oxygenTank)?upgrades.oxygenTank:null;
  const oxidizer=state?.tanks?.oxidizer,capacity=Math.max(finiteCapacity(oxidizer?.capacity),finiteCapacity(state?.oxygenTankCapacity),finiteCapacity(upgrades?.oxygenCapacity));
  if(capacity>=72)return 2;if(capacity>=48)return 1;
  if(oxidizer?.molecule==='oxygen'){const amount=finiteCapacity(oxidizer.amount);if(amount>48)return 2;if(amount>36)return 1;}
  return 0;
}

export function normalizeDockResourceEnvelope(source){
  if(!source||typeof source!=='object'||![7,DOCK_SCHEMA_VERSION].includes(source.schemaVersion))return {changed:false,state:source};
  const level=inferLegacyOxygenUpgradeLevel(source);if(level===null)return {changed:false,state:source};
  if(source.schemaVersion===DOCK_SCHEMA_VERSION&&validUpgradeLevel(source.upgrades?.oxygenTank))return {changed:false,state:source};
  const progress={...blankProgress(),...source.progress,signalLast:{...(source.progress?.signalLast??{})}},loadout={drive:'hydrogen',cooling:true,tanks:blankSelected(),...source.loadout,tanks:{...blankSelected(),...source.loadout?.tanks}},next={
    ...source,schemaVersion:DOCK_SCHEMA_VERSION,
    upgrades:{...source.upgrades,oxygenTank:level},
    elements:{H:0,C:0,N:0,O:0,F:0,P:0,S:0,Cl:0,...source.elements},
    tanks:{...blankTanks(),...source.tanks},
    recipes:Array.isArray(source.recipes)?source.recipes:[],hints:Array.isArray(source.hints)?source.hints:[],
    dust:{H:0,C:0,O:0,...source.dust},loadout,progress,
    workspace:source.workspace??null,
  };
  return {changed:true,state:next,serialized:JSON.stringify(next)};
}

export function migrateDockStorage(storage=globalThis.localStorage){
  let raw=null;try{raw=storage?.getItem(DOCK_RESOURCE_KEY)??null;}catch{return {changed:false};}if(!raw)return {changed:false};
  let source;try{source=JSON.parse(raw);}catch{return {changed:false};}
  const normalized=normalizeDockResourceEnvelope(source);if(!normalized.changed)return normalized;
  try{storage.setItem(DOCK_RESOURCE_KEY,normalized.serialized);return normalized;}catch{return {changed:false,state:source};}
}
