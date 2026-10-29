import { validateWorkspace } from './workspace-save.js?v=31';
import { isFutureWorkspaceSave,migrateWorkspaceSave } from './workspace-migrations.js?v=1';

// Keep the shared resources guard in this existing module so it adds no new
// production module request and introduces no persistence import cycle.
export const RESOURCE_STORAGE_KEY='molecule-craft.resources.v1';
export const RESOURCE_SCHEMA_VERSION=9;
export const FUTURE_RESOURCES_MESSAGE='新しい版の保存データを保護しています。現在のアプリでは変更できません。アプリを更新してください。';
export function isFutureResourcesSchemaVersion(version){return Number.isInteger(version)&&version>RESOURCE_SCHEMA_VERSION;}
export function futureResourcesSchemaVersion(rawOrValue){
  let value=rawOrValue;
  if(typeof value==='string'){try{value=JSON.parse(value);}catch{return null;}}
  if(!value||typeof value!=='object'||Array.isArray(value)||!isFutureResourcesSchemaVersion(value.schemaVersion))return null;
  return value.schemaVersion;
}
export const isFutureResourcesSave=rawOrValue=>futureResourcesSchemaVersion(rawOrValue)!==null;
export class UnsupportedFutureResourcesSchemaError extends Error{
  constructor(schemaVersion){super(`Unsupported future resources schema ${schemaVersion}`);this.name='UnsupportedFutureResourcesSchemaError';this.schemaVersion=schemaVersion;}
}
export function assertSupportedResourcesSchema(value){
  if(isFutureResourcesSchemaVersion(value?.schemaVersion))throw new UnsupportedFutureResourcesSchemaError(value.schemaVersion);
  return value;
}

// The historical key is intentionally stable. Internal workspace schema is v2.
export const WORKSPACE_STORAGE_KEY='molecule-craft.workspace.v1';

export function parseWorkspaceSave(raw){
  if(typeof raw!=='string')throw new Error('Invalid workspace save');
  const value=JSON.parse(raw);
  if(isFutureWorkspaceSave(value))throw new Error('Unsupported future workspace');
  return migrateWorkspaceSave(value);
}

export function createWorkspaceStorage({storage,onStatus=()=>{}}={}){
  if(storage===undefined){try{storage=window.localStorage;}catch{storage=null;}}
  let previous=null,blocked='',snapshot=null,message='';
  const status=text=>{if(text===message)return;message=text;onStatus(text);};
  function protectFutureResources(){
    if(blocked==='future-resources')return true;
    try{if(isFutureResourcesSave(storage?.getItem(RESOURCE_STORAGE_KEY))){blocked='future-resources';status(FUTURE_RESOURCES_MESSAGE);return true;}}
    catch{blocked='resource-check';status('資源の保存状態を確認できないため、制作データの保存を停止しています。再読み込みしてください。');return true;}
    return false;
  }
  function read(){
    if(protectFutureResources())return null;
    try{
      previous=storage?.getItem(WORKSPACE_STORAGE_KEY)??null;if(!storage){status('制作途中の保存を利用できません。');return null;}
      if(previous===null)return null;
      if(previous.length>2000000)throw new Error('Save too large');
      const value=JSON.parse(previous);
      if(isFutureWorkspaceSave(value)){blocked='future';status('新しい版の制作データを保護しています。アプリを更新してください。');return null;}
      snapshot=migrateWorkspaceSave(value);return snapshot;
    }catch{blocked='invalid';status('制作データを復元できませんでした。保存を保護しています。新しく始める場合は画面上部の「片付ける」を長押ししてください。');return null;}
  }
  function write(value){
    if(blocked||protectFutureResources())return false;
    try{
      validateWorkspace(value);const raw=JSON.stringify(value);snapshot=value;
      if(!storage){status('制作途中の保存を利用できません。');return false;}
      const current=storage.getItem(WORKSPACE_STORAGE_KEY);
      if(current!==previous){blocked='conflict';status('別の画面で制作データが更新されました。この画面では上書きせず、保存を停止しています。');return false;}
      if(raw===previous){status('');return true;}
      storage.setItem(WORKSPACE_STORAGE_KEY,raw);previous=raw;status('');return true;
    }catch{status('制作途中を保存できません。端末の空き容量やブラウザの設定を確認してください。');return false;}
  }
  return {read,write,reportFailure:()=>status('制作途中を保存できません。原子の数や位置を確認してください。'),get protected(){return !!blocked;},get message(){return message;},get snapshot(){return snapshot;},allowReset(){if(blocked==='invalid'){blocked='';status('');return true;}return !blocked;}};
}
