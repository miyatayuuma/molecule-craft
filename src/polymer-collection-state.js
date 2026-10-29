import {createPolymerCollectionPersistence,POLYMER_COLLECTION_SCHEMA_VERSION} from './polymer-collection-persistence.js?v=1';

export function createPolymerCollectionState({records=[],storage=null,now=Date.now}={}){
  const byId=new Map(records.map(record=>[record.id,record])),discovered=new Map();
  const persistence=createPolymerCollectionPersistence({storage,polymerIds:[...byId.keys()]});
  function snapshot(){return{schemaVersion:POLYMER_COLLECTION_SCHEMA_VERSION,discoveredPolymers:[...discovered.values()].map(entry=>({...entry}))};}
  function persist(){return persistence.save(snapshot());}
  const saved=persistence.load();
  for(const entry of saved?.discoveredPolymers??[])discovered.set(entry.id,{...entry});
  function registerDiscoveredPolymer(id,{at=now()}={}){
    const record=byId.get(id);if(!record)throw new RangeError(`Unknown polymer record: ${id}`);
    if(!Number.isFinite(at)||at<0)throw new TypeError('Discovery time must be a non-negative finite number');
    if(discovered.has(id))return{changed:false,event:{record,isNew:false}};
    const entry={id,at,order:discovered.size+1};discovered.set(id,entry);persist();
    return{changed:true,event:{record,isNew:true,entry:{...entry}}};
  }
  return{
    snapshot,hasPolymer:id=>discovered.has(id),polymerEntry:id=>discovered.get(id)??null,
    registerDiscoveredPolymer,get discoveredCount(){return discovered.size;},
    entries(){return [...discovered.values()].map(entry=>({...entry}));},
    get storageMessage(){return persistence.storageMessage;},get readOnly(){return persistence.readOnly;},
  };
}
