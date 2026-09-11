import { detectFunctionalGroups, structuralMilestones } from './functional-groups.js?v=21';
import { availableElements } from './element-progression.js?v=36';
import { CURRENT_COLLECTION_SCHEMA_VERSION } from './collection-migrations.js?v=1';
import { COLLECTION_STORAGE_KEY,createCollectionPersistence } from './collection-persistence.js?v=1';

export { COLLECTION_STORAGE_KEY };
export const MILESTONES = Object.freeze({
  'double-bond':'初めての二重結合', 'triple-bond':'初めての三重結合', ring:'初めての環',
  'aromatic-ring':'芳香環を完成', isomer:'同じ分子式・異なる構造', 'multiple-groups':'複数の官能基を組み合わせた',
});

export function createCollectionState({records,groups,templates,storage=null,now=Date.now,elementAccess=()=>true}) {
  const byId=new Map(records.map(record=>[record.id,record])),byGroup=new Map(groups.map(group=>[group.id,group]));
  const molecules=new Map(),sources=new Map(),unlocked=new Set(),milestones=new Set(),detections=new Map(),legacyElements=new Set();
  const persistence=createCollectionPersistence({storage,records,milestoneIds:Object.keys(MILESTONES)});
  let elements=new Set(availableElements(0));

  const detectedFor = record => {
    if(!detections.has(record.id))detections.set(record.id,detectFunctionalGroups(record,groups));
    return detections.get(record.id);
  };
  function learn(id){
    for(const match of detectedFor(byId.get(id))){if(!sources.has(match.id))sources.set(match.id,new Set());sources.get(match.id).add(id);}
    updateUnlocks();
  }
  function updateUnlocks(){
    elements=new Set(availableElements(molecules.size,legacyElements));
    for(const template of templates)if(template.atoms.every(element=>elements.has(element)&&elementAccess(element))&&(sources.get(template.unlock.groupId)?.size??0)>=template.unlock.distinctMolecules)unlocked.add(template.id);
  }
  function restore(){
    const saved=persistence.load();
    if(!saved)return;
    for(const symbol of saved.legacyElements)legacyElements.add(symbol);
    for(const entry of saved.discoveredMolecules){molecules.set(entry.id,{...entry});learn(entry.id);}
    for(const id of saved.milestones)milestones.add(id);
  }
  function snapshot(){
    return {schemaVersion:CURRENT_COLLECTION_SCHEMA_VERSION,discoveredMolecules:[...molecules.values()],discoveredGroups:[...sources].map(([id,ids])=>({id,sources:[...ids]})),unlockedStructures:[...unlocked],legacyElements:[...legacyElements],milestones:[...milestones]};
  }
  function persist(){persistence.save(snapshot());}
  restore();
  updateUnlocks();
  return {
    records,groups,templates,detectedFor,snapshot,
    get storageMessage(){return persistence.storageMessage;},
    get discoveredCount(){return molecules.size;},
    get unlockedCount(){return templates.filter(template=>unlocked.has(template.id)&&template.atoms.every(elementAccess)).length;},
    unlockedElements:()=>[...elements].filter(elementAccess), canUseElement:symbol=>elements.has(symbol)&&elementAccess(symbol),
    canBuild:record=>record.atoms.every(element=>elements.has(element)&&elementAccess(element)),
    hasMolecule:id=>molecules.has(id), moleculeEntry:id=>molecules.get(id),
    groupSources:id=>[...(sources.get(id)??[])], hasGroup:id=>sources.has(id),
    isUnlocked:id=>{const template=templates.find(item=>item.id===id);return unlocked.has(id)&&!!template&&template.atoms.every(elementAccess);}, refreshAccess:updateUnlocks, milestoneIds:()=>[...milestones],
    isomersOf:record=>records.filter(candidate=>candidate.formula===record.formula&&candidate.id!==record.id),
    observeStructures(structures){
      let changed=false;const events=[];
      for(const item of structures){
        const record=item.complete&&item.record?byId.get(item.record.id):null;
        const detected=record?detectedFor(record):detectFunctionalGroups(item.graph,groups);
        for(const id of structuralMilestones(item.graph,detected,groups)){
          if(!item.complete&&['aromatic-ring','multiple-groups'].includes(id))continue;
          if(!milestones.has(id)){milestones.add(id);changed=true;}
        }
        if(!record)continue;
        const event={signature:item.signature,record,isNew:!molecules.has(record.id),groupDiscoveries:[],unlockedParts:[],unlockedElements:[],isomerOf:[]};
        if(event.isNew){
          event.isomerOf=records.filter(other=>other.id!==record.id&&other.formula===record.formula&&molecules.has(other.id)).map(other=>other.id);
          if(event.isomerOf.length)milestones.add('isomer');
          const previousGroups=new Set(sources.keys()),previousUnlocks=new Set(unlocked),previousElements=new Set(elements);
          molecules.set(record.id,{id:record.id,at:now(),order:molecules.size+1});learn(record.id);changed=true;
          event.groupDiscoveries=[...sources.keys()].filter(id=>!previousGroups.has(id));
          event.unlockedParts=[...unlocked].filter(id=>!previousUnlocks.has(id));
          event.unlockedElements=[...elements].filter(id=>!previousElements.has(id));
        }
        events.push(event);
      }
      if(changed)persist();
      return {changed,events};
    },
  };
}
