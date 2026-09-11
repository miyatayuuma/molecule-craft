import { ELEMENT_UNLOCKS } from './element-progression.js?v=36';

export const CURRENT_COLLECTION_SCHEMA_VERSION=2;
const validElementSymbols=new Set(ELEMENT_UNLOCKS.map(item=>item.symbol));

const recordMap=records=>new Map((records??[]).map(record=>[record.id,record]));
const milestoneSet=milestoneIds=>new Set(milestoneIds??[]);

export function isFutureCollectionSave(saved){
  return !!saved&&typeof saved==='object'&&Number(saved.schemaVersion)>CURRENT_COLLECTION_SCHEMA_VERSION;
}

export function validateCanonicalCollectionState(state,{records=[],milestoneIds=[]}={}){
  if(!state||state.schemaVersion!==CURRENT_COLLECTION_SCHEMA_VERSION||!Array.isArray(state.discoveredMolecules)||!Array.isArray(state.legacyElements)||!Array.isArray(state.milestones))throw Error('Invalid canonical collection state');
  const byId=recordMap(records),validMilestones=milestoneSet(milestoneIds),seen=new Set();
  for(const [index,entry] of state.discoveredMolecules.entries()){
    if(!entry||typeof entry.id!=='string'||!byId.has(entry.id)||seen.has(entry.id)||entry.order!==index+1||entry.at!==null&&(!Number.isFinite(entry.at)||entry.at<0))throw Error('Invalid canonical collection discovery');
    seen.add(entry.id);
  }
  if(new Set(state.legacyElements).size!==state.legacyElements.length||state.legacyElements.some(symbol=>!validElementSymbols.has(symbol)))throw Error('Invalid canonical collection elements');
  if(new Set(state.milestones).size!==state.milestones.length||state.milestones.some(id=>!validMilestones.has(id)))throw Error('Invalid canonical collection milestones');
  return state;
}

export function migrateCollectionSave(saved,{records=[],milestoneIds=[]}={}){
  if(!saved||typeof saved!=='object')return null;
  if(isFutureCollectionSave(saved))return null;
  const byId=recordMap(records),validMilestones=milestoneSet(milestoneIds),legacyElements=new Set(),discoveredMolecules=[],seen=new Set(),milestones=[];
  if(saved.schemaVersion===CURRENT_COLLECTION_SCHEMA_VERSION&&Array.isArray(saved.legacyElements))for(const symbol of saved.legacyElements)if(validElementSymbols.has(symbol))legacyElements.add(symbol);
  const entries=saved.discoveredMolecules??saved.discoveredMoleculeIds??[];
  if(Array.isArray(entries))for(const entry of entries){
    const id=typeof entry==='string'?entry:entry?.id,record=byId.get(id);
    if(!record||seen.has(id))continue;
    const at=Number.isFinite(entry?.at)&&entry.at>=0?entry.at:null;
    if(saved.schemaVersion!==CURRENT_COLLECTION_SCHEMA_VERSION)for(const symbol of record.atoms??[])legacyElements.add(symbol);
    seen.add(id);discoveredMolecules.push({id,at,order:discoveredMolecules.length+1});
  }
  if(Array.isArray(saved.milestones))for(const id of saved.milestones)if(validMilestones.has(id)&&!milestones.includes(id))milestones.push(id);
  return validateCanonicalCollectionState({schemaVersion:CURRENT_COLLECTION_SCHEMA_VERSION,discoveredMolecules,legacyElements:[...legacyElements],milestones},{records,milestoneIds});
}
