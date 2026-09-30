export const POLYMER_COLLECTION_STORAGE_KEY='molecule-craft.polymer-collection.v1';
export const POLYMER_COLLECTION_SCHEMA_VERSION=1;
const RESOURCE_STORAGE_KEY='molecule-craft.resources.v1';
const isId=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]*$/.test(value);

export function isFuturePolymerCollectionSave(saved){return !!saved&&typeof saved==='object'&&Number(saved.schemaVersion)>POLYMER_COLLECTION_SCHEMA_VERSION;}
export function validatePolymerCollectionSave(saved,{polymerIds=[]}={}){
  if(!saved||saved.schemaVersion!==POLYMER_COLLECTION_SCHEMA_VERSION||!Array.isArray(saved.discoveredPolymers))throw new Error('Invalid polymer collection save.');
  const valid=new Set(polymerIds),seen=new Set();
  for(const[index,entry]of saved.discoveredPolymers.entries())if(!entry||!valid.has(entry.id)||seen.has(entry.id)||entry.order!==index+1||entry.at!==null&&(!Number.isFinite(entry.at)||entry.at<0))throw new Error('Invalid polymer collection discovery.');else seen.add(entry.id);
  return saved;
}

export function clearPolymerCollectionSave(storage){
  try{
    const raw=storage?.getItem(POLYMER_COLLECTION_STORAGE_KEY);if(!raw)return true;
    let saved;try{saved=JSON.parse(raw);}catch{storage.removeItem(POLYMER_COLLECTION_STORAGE_KEY);return true;}
    if(isFuturePolymerCollectionSave(saved))return false;
    storage.removeItem(POLYMER_COLLECTION_STORAGE_KEY);return true;
  }catch{return false;}
}

export function createPolymerCollectionPersistence({storage=null,polymerIds=[]}={}){
  let storageMessage='',readOnly=false,resetEpoch=0;
  try{const resources=JSON.parse(storage?.getItem(RESOURCE_STORAGE_KEY)||'null');resetEpoch=resources?.resetEpoch??0;if(resources?.pendingReset)readOnly=true;}catch{}
  function load(){
    let raw;
    try{raw=storage?.getItem(POLYMER_COLLECTION_STORAGE_KEY);if(!storage)storageMessage='保存を利用できません。このタブの間だけ高分子の発見を保持します。';}
    catch{storageMessage='高分子の保存データを読めません。このタブの間だけ発見を保持します。';return null;}
    if(!raw)return null;
    let saved;try{saved=JSON.parse(raw);}catch{storageMessage='高分子の保存データを読み取れません。既存データを保護しています。';return null;}
    if(isFuturePolymerCollectionSave(saved)){readOnly=true;storageMessage='新しい版の高分子保存データを保護しています。この版では上書きしません。';return null;}
    try{return validatePolymerCollectionSave(saved,{polymerIds});}
    catch{storageMessage='高分子の保存データが不正なため、このタブの間だけ発見を保持します。';return null;}
  }
  function save(snapshot){
    if(!storage||readOnly)return false;
    try{
      const canonical=validatePolymerCollectionSave({schemaVersion:snapshot?.schemaVersion,discoveredPolymers:snapshot?.discoveredPolymers},{polymerIds});
      const resources=JSON.parse(storage.getItem(RESOURCE_STORAGE_KEY)||'null');
      if(resources?.pendingReset||(resources?.resetEpoch??0)!==resetEpoch){readOnly=true;storageMessage='進行が初期化されました。再読み込みしてください。';return false;}
      const existingRaw=storage.getItem(POLYMER_COLLECTION_STORAGE_KEY);
      if(existingRaw){const existing=JSON.parse(existingRaw);if(isFuturePolymerCollectionSave(existing)){readOnly=true;storageMessage='新しい版の高分子保存データを保護しています。この版では上書きしません。';return false;}}
      storage.setItem(POLYMER_COLLECTION_STORAGE_KEY,JSON.stringify(canonical));storageMessage='';return true;
    }catch{storageMessage='高分子の発見を保存できません。保存容量やブラウザ設定を確認してください。';return false;}
  }
  return{load,save,get storageMessage(){return storageMessage;},get readOnly(){return readOnly;}};
}
