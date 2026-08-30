import { detectFunctionalGroups, structuralMilestones } from './functional-groups.js';

export const COLLECTION_STORAGE_KEY = 'molecule-craft.collection.v1';
export const MILESTONES = Object.freeze({
  'double-bond':'初めての二重結合', 'triple-bond':'初めての三重結合', ring:'初めての環',
  'aromatic-ring':'芳香環を完成', isomer:'同じ分子式・異なる構造', 'multiple-groups':'複数の官能基を組み合わせた',
});

export function createCollectionState({records,groups,templates,storage=null,now=Date.now}) {
  const byId=new Map(records.map(record=>[record.id,record])),byGroup=new Map(groups.map(group=>[group.id,group]));
  const molecules=new Map(),sources=new Map(),unlocked=new Set(),milestones=new Set(),detections=new Map();
  let storageMessage='',readOnly=false;
  const detectedFor = record => {
    if(!detections.has(record.id))detections.set(record.id,detectFunctionalGroups(record,groups));
    return detections.get(record.id);
  };
  function learn(id){
    for(const match of detectedFor(byId.get(id))){if(!sources.has(match.id))sources.set(match.id,new Set());sources.get(match.id).add(id);}
    for(const template of templates)if((sources.get(template.unlock.groupId)?.size??0)>=template.unlock.distinctMolecules)unlocked.add(template.id);
  }
  function restore(){
    let raw;
    try{raw=storage?.getItem(COLLECTION_STORAGE_KEY);if(!storage)storageMessage='保存を利用できません。このタブの間だけ進行を保持します。';}
    catch{storageMessage='保存データを読めません。このタブの間だけ進行を保持します。';}
    if(!raw)return;
    let saved;try{saved=JSON.parse(raw);}catch{storageMessage='保存データを読み取れなかったため、新しい進行で開始しました。';return;}
    if(!saved||typeof saved!=='object')return;
    if(Number(saved.schemaVersion)>1){readOnly=true;storageMessage='新しい版の保存データを保護しています。この版の進行は保存しません。';return;}
    const entries=saved.discoveredMolecules??saved.discoveredMoleculeIds??[];
    if(Array.isArray(entries))for(const entry of entries){
      const id=typeof entry==='string'?entry:entry?.id;if(!byId.has(id)||molecules.has(id))continue;
      const at=Number.isFinite(entry?.at)&&entry.at>=0?entry.at:null;
      molecules.set(id,{id,at,order:molecules.size+1});learn(id);
    }
    if(Array.isArray(saved.milestones))for(const id of saved.milestones)if(Object.hasOwn(MILESTONES,id))milestones.add(id);
    // Recompute derived unlocks from valid discovered ids, ignoring removed ids,
    // obsolete groups and forged/stale unlock lists after a DB/schema change.
  }
  function snapshot(){
    return {schemaVersion:1,discoveredMolecules:[...molecules.values()],discoveredGroups:[...sources].map(([id,ids])=>({id,sources:[...ids]})),unlockedStructures:[...unlocked],milestones:[...milestones]};
  }
  function persist(){
    if(!storage||readOnly)return;
    try{storage.setItem(COLLECTION_STORAGE_KEY,JSON.stringify(snapshot()));storageMessage='';}
    catch{storageMessage='進行を保存できません。空き容量やブラウザの保存設定を確認してください。';}
  }
  restore();
  return {
    records,groups,templates,detectedFor,snapshot,
    get storageMessage(){return storageMessage;},
    get discoveredCount(){return molecules.size;},
    get unlockedCount(){return unlocked.size;},
    hasMolecule:id=>molecules.has(id), moleculeEntry:id=>molecules.get(id),
    groupSources:id=>[...(sources.get(id)??[])], hasGroup:id=>sources.has(id),
    isUnlocked:id=>unlocked.has(id), milestoneIds:()=>[...milestones],
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
        const event={signature:item.signature,record,isNew:!molecules.has(record.id),groupDiscoveries:[],unlockedParts:[],isomerOf:[]};
        if(event.isNew){
          event.isomerOf=records.filter(other=>other.id!==record.id&&other.formula===record.formula&&molecules.has(other.id)).map(other=>other.id);
          if(event.isomerOf.length)milestones.add('isomer');
          const previousGroups=new Set(sources.keys()),previousUnlocks=new Set(unlocked);
          molecules.set(record.id,{id:record.id,at:now(),order:molecules.size+1});learn(record.id);changed=true;
          event.groupDiscoveries=[...sources.keys()].filter(id=>!previousGroups.has(id));
          event.unlockedParts=[...unlocked].filter(id=>!previousUnlocks.has(id));
        }
        events.push(event);
      }
      if(changed)persist();
      return {changed,events};
    },
  };
}
