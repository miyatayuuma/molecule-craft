import { validateWorkspace } from './workspace-save.js?v=31';
import { isFutureWorkspaceSave,migrateWorkspaceSave } from './workspace-migrations.js?v=1';

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
  function read(){
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
    if(blocked)return false;
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
