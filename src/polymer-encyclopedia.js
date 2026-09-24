const UNKNOWN_ENTRY=Object.freeze({known:false,nameJa:'???',nameEn:'???'});

export function createPolymerEncyclopediaModel(records,{knownIds=[]}={}){
  if(!Array.isArray(records))throw new Error('Polymer encyclopedia requires catalog records.');
  const byId=new Map(records.map(record=>[record.id,record])),known=new Set(knownIds);
  const publicEntry=record=>known.has(record.id)?Object.freeze({...record,known:true}):Object.freeze({id:record.id,...UNKNOWN_ENTRY});
  return Object.freeze({
    total:records.length,
    discoveredCount:[...known].filter(id=>byId.has(id)).length,
    entries(){return records.map(publicEntry);},
    entry(id){const record=byId.get(id);return record?publicEntry(record):null;},
    isKnown(id){return byId.has(id)&&known.has(id);},
    withKnownIds(next){return createPolymerEncyclopediaModel(records,{knownIds:next});},
  });
}
