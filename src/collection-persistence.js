import { CURRENT_COLLECTION_SCHEMA_VERSION,isFutureCollectionSave,migrateCollectionSave,validateCanonicalCollectionState } from './collection-migrations.js?v=2';
import {FUTURE_RESOURCES_MESSAGE,isFutureResourcesSave} from './resource-schema-guard.js?v=1';

export const COLLECTION_STORAGE_KEY='molecule-craft.collection.v1';
const RESOURCE_STORAGE_KEY='molecule-craft.resources.v1';

export function createCollectionPersistence({storage=null,records=[],milestoneIds=[]}={}){
  let storageMessage='',readOnly=false,resetEpoch=0;
  try{
    const raw=storage?.getItem(RESOURCE_STORAGE_KEY);
    if(isFutureResourcesSave(raw)){readOnly=true;storageMessage=FUTURE_RESOURCES_MESSAGE;}
    else{const resource=JSON.parse(raw||'null');resetEpoch=resource?.resetEpoch??0;if(resource?.pendingReset)readOnly=true;}
  }catch{}

  function load(){
    try{if(isFutureResourcesSave(storage?.getItem(RESOURCE_STORAGE_KEY))){readOnly=true;storageMessage=FUTURE_RESOURCES_MESSAGE;return null;}}catch{}
    let raw;
    try{
      raw=storage?.getItem(COLLECTION_STORAGE_KEY);
      if(!storage)storageMessage='保存を利用できません。このタブの間だけ進行を保持します。';
    }catch{storageMessage='保存データを読めません。このタブの間だけ進行を保持します。';}
    if(!raw)return null;
    let saved;
    try{saved=JSON.parse(raw);}
    catch{storageMessage='保存データを読み取れなかったため、新しい進行で開始しました。';return null;}
    if(!saved||typeof saved!=='object')return null;
    if(isFutureCollectionSave(saved)){
      readOnly=true;
      storageMessage='新しい版の保存データを保護しています。この版の進行は保存しません。';
      return null;
    }
    return migrateCollectionSave(saved,{records,milestoneIds});
  }

  function save(snapshot){
    if(!storage)return false;
    try{
      const resourceRaw=storage.getItem(RESOURCE_STORAGE_KEY);
      if(isFutureResourcesSave(resourceRaw)){readOnly=true;storageMessage=FUTURE_RESOURCES_MESSAGE;return false;}
      if(readOnly)return false;
      const canonical=validateCanonicalCollectionState({
        schemaVersion:snapshot?.schemaVersion,
        discoveredMolecules:snapshot?.discoveredMolecules,
        legacyElements:snapshot?.legacyElements,
        milestones:snapshot?.milestones,
      },{records,milestoneIds});
      if(canonical.schemaVersion!==CURRENT_COLLECTION_SCHEMA_VERSION)throw Error('Invalid collection schema');
      const resource=JSON.parse(resourceRaw||'null');
      if(resource?.pendingReset||(resource?.resetEpoch??0)!==resetEpoch){
        readOnly=true;
        storageMessage='進行が初期化されました。再読み込みしてください。';
        return false;
      }
      storage.setItem(COLLECTION_STORAGE_KEY,JSON.stringify(snapshot));
      storageMessage='';
      return true;
    }catch{
      storageMessage='進行を保存できません。空き容量やブラウザの保存設定を確認してください。';
      return false;
    }
  }

  return {
    load,save,
    get storageMessage(){return storageMessage;},
    get readOnly(){return readOnly;},
  };
}
