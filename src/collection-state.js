import { detectFunctionalGroups, structuralMilestones } from './functional-groups.js?v=21';
import { availableElements, ELEMENT_UNLOCKS } from './element-progression.js?v=36';

export const COLLECTION_STORAGE_KEY = 'molecule-craft.collection.v1';
export const MILESTONES = Object.freeze({
  'double-bond':'初めての二重結合', 'triple-bond':'初めての三重結合', ring:'初めての環',
  'aromatic-ring':'芳香環を完成', isomer:'同じ分子式・異なる構造', 'multiple-groups':'複数の官能基を組み合わせた',
});

export function createCollectionState({records,groups,templates,storage=null,now=Date.now,elementAccess=()=>true}) {
  const byId=new Map(records.map(record=>[record.id,record])),byGroup=new Map(groups.map(group=>[group.id,group]));
  const molecules=new Map(),sources=new Map(),unlocked=new Set(),milestones=new Set(),detections=new Map(),legacyElements=new Set();
  let elements=new Set(availableElements(0));
  let storageMessage='',readOnly=false,resetEpoch=0;
  try{const resource=JSON.parse(storage?.getItem('molecule-craft.resources.v1')||'null');resetEpoch=resource?.resetEpoch??0;if(resource?.pendingReset)readOnly=true;}catch{}

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
    let raw;
    try{raw=storage?.getItem(COLLECTION_STORAGE_KEY);if(!storage)storageMessage='保存を利用できません。このタブの間だけ進行を保持します。';}
    catch{storageMessage='保存データを読めません。このタブの間だけ進行を保持します。';}
    if(!raw)return;
    let saved;try{saved=JSON.parse(raw);}catch{storageMessage='保存データを読み取れなかったため、新しい進行で開始しました。';return;}
    if(!saved||typeof saved!=='object')return;
    if(Number(saved.schemaVersion)>2){readOnly=true;storageMessage='新しい版の保存データを保護しています。この版の進行は保存しません。';return;}
    if(saved.schemaVersion===2&&Array.isArray(saved.legacyElements))for(const symbol of saved.legacyElements)if(ELEMENT_UNLOCKS.some(item=>item.symbol===symbol))legacyElements.add(symbol);
    const entries=saved.discoveredMolecules??saved.discoveredMoleculeIds??[];
    if(Array.isArray(entries))for(const entry of entries){
      const id=typeof entry==='string'?entry:entry?.id;if(!byId.has(id)||molecules.has(id))continue;
      const at=Number.isFinite(entry?.at)&&entry.at>=0?entry.at:null;
      // Before atom progression existed, these elements were already used.
      // Do not take them away from returning players with a small collection.
      if(saved.schemaVersion!==2)for(const symbol of byId.get(id).atoms)legacyElements.add(symbol);
      molecules.set(id,{id,at,order:molecules.size+1});learn(id);
    }
    if(Array.isArray(saved.milestones))for(const id of saved.milestones)if(Object.hasOwn(MILESTONES,id))milestones.add(id);
    // Recompute derived unlocks from valid discovered ids, ignoring removed ids,
    // obsolete groups and forged/stale unlock lists after a DB/schema change.
  }
  function snapshot(){
    return {schemaVersion:2,discoveredMolecules:[...molecules.values()],discoveredGroups:[...sources].map(([id,ids])=>({id,sources:[...ids]})),unlockedStructures:[...unlocked],legacyElements:[...legacyElements],milestones:[...milestones]};
  }
  function persist(){
    if(!storage||readOnly)return;
    try{
      const resource=JSON.parse(storage.getItem('molecule-craft.resources.v1')||'null');
      if(resource?.pendingReset||(resource?.resetEpoch??0)!==resetEpoch){readOnly=true;storageMessage='進行が初期化されました。再読み込みしてください。';return;}
      storage.setItem(COLLECTION_STORAGE_KEY,JSON.stringify(snapshot()));storageMessage='';
    }
    catch{storageMessage='進行を保存できません。空き容量やブラウザの保存設定を確認してください。';}
  }
  restore();
  updateUnlocks();
  return {
    records,groups,templates,detectedFor,snapshot,
    get storageMessage(){return storageMessage;},
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
