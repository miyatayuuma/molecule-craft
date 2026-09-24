const UNKNOWN_ENTRY=Object.freeze({known:false,nameJa:'???',nameEn:'???',details:null,description:null,concepts:null});
const CONCEPTS=new Set(['addition-polymerization','copolymerization','ring-opening-polymerization','polycondensation','network-polymerization','repeat-unit']);

export function createPolymerEncyclopediaModel(records,content,{knownIds=[]}={}){
  if(!Array.isArray(records)||!Array.isArray(content))throw new Error('Polymer encyclopedia requires catalog and content records.');
  const byId=new Map(records.map(record=>[record.id,record])),contentById=new Map(content.map(entry=>[entry.id,entry]));
  if(content.length!==records.length||contentById.size!==records.length||records.some(record=>!contentById.has(record.id)))throw new Error('Polymer catalog and encyclopedia content must match 1:1.');
  for(const [index,entry] of content.entries()){
    if(entry.number!==index+1||typeof entry.description!=='string'||!entry.description.trim()||!Array.isArray(entry.details)||!entry.details.length||!Array.isArray(entry.concepts)||entry.concepts.some(concept=>!CONCEPTS.has(concept)))throw new Error(`Invalid polymer encyclopedia content: ${entry.id}`);
    if(entry.details.some(detail=>typeof detail.title!=='string'||!detail.title.trim()||typeof detail.body!=='string'||!detail.body.trim()))throw new Error(`Invalid polymer encyclopedia detail: ${entry.id}`);
  }
  const known=new Set(knownIds);
  const publicEntry=record=>known.has(record.id)?Object.freeze({...record,...contentById.get(record.id),known:true}):Object.freeze({id:record.id,...UNKNOWN_ENTRY});
  return Object.freeze({
    total:records.length,
    discoveredCount:[...known].filter(id=>byId.has(id)).length,
    entries(){return records.map(publicEntry);},
    entry(id){const record=byId.get(id);return record?publicEntry(record):null;},
    isKnown(id){return byId.has(id)&&known.has(id);},
    withKnownIds(next){return createPolymerEncyclopediaModel(records,content,{knownIds:next});},
  });
}
