import { VEIL } from './config.js';
import { WORKSPACE_STORAGE_KEY, validateWorkspace } from '../workspace-save.js?v=30';
export const RESOURCE_KEY='molecule-craft.resources.v1';
const COLLECTION_KEY='molecule-craft.collection.v1',HELP_KEY='molecule-craft.help.v1';
export const RESET_CATEGORIES=Object.freeze(['collection','recipes','elements','molecules','exploration','records','workspace']);
const emptyCollection=()=>({schemaVersion:2,discoveredMolecules:[],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]});
const initialState=()=>({schemaVersion:1,elements:{H:0},molecules:{hydrogen:0},recipes:[],progress:{bestChain:0,runs:0,cleared:false,craftPrompt:false,sound:true},workspace:null});
// The authoritative inventory is also the durable reset journal. If interrupted,
// replay idempotent secondary-key writes before loading any workspace or collection.
function finishReset(storage,state){
  const pending=state.pendingReset;if(!pending)return;
  if(pending.collection)storage.setItem(COLLECTION_KEY,JSON.stringify(emptyCollection()));
  if(pending.legacy)storage.removeItem(WORKSPACE_STORAGE_KEY);
  if(pending.help)storage.removeItem(HELP_KEY);
  const finished={...state};delete finished.pendingReset;
  storage.setItem(RESOURCE_KEY,JSON.stringify(finished));delete state.pendingReset;
}

const copy=value=>JSON.parse(JSON.stringify(value));
const integer=v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000000;
function validate(s){
  if(!s||s.schemaVersion!==1||!s.elements||!s.molecules||!Array.isArray(s.recipes)||!s.progress)throw Error('Invalid resources');
  for(const values of [s.elements,s.molecules])for(const [key,n]of Object.entries(values))if(!/^[A-Za-z][A-Za-z0-9-]*$/.test(key)||!integer(n))throw Error('Invalid inventory');
  if(!integer(s.elements.H)||!integer(s.molecules.hydrogen)||typeof s.progress.cleared!=='boolean')throw Error('Missing inventory');
  if(!integer(s.progress.bestChain)||!integer(s.progress.runs)||!s.recipes.every(x=>typeof x==='string'))throw Error('Invalid progress');
  if(s.resetEpoch!==undefined&&!integer(s.resetEpoch))throw Error('Invalid reset epoch');
  if(s.pendingReset!==undefined&&(!s.pendingReset||['collection','legacy','help'].some(k=>typeof s.pendingReset[k]!=='boolean')))throw Error('Invalid reset journal');
  if(s.workspace!==null)validateWorkspace(s.workspace);
  return s;
}
export function createResources({storage,onStatus=()=>{}}={}){
  if(storage===undefined){try{storage=window.localStorage;}catch{storage=null;}}
  let state=initialState(),previous=null,blocked=false,message='';
  const report=text=>{message=text;onStatus(text);};
  try{previous=storage?.getItem(RESOURCE_KEY)??null;if(previous){if(previous.length>3000000)throw Error('Large save');state=validate(JSON.parse(previous));if(state.pendingReset){finishReset(storage,state);previous=storage.getItem(RESOURCE_KEY);}}else{const legacy=storage?.getItem(WORKSPACE_STORAGE_KEY);if(legacy)state.workspace=validateWorkspace(JSON.parse(legacy));}}catch{blocked=true;report('資源または制作の保存を復元できません。元の保存を保護しています。');}
  // Existing collection discoveries remain valid; no free fuel is awarded.
  if(!previous&&!blocked)try{const collection=JSON.parse(storage?.getItem('molecule-craft.collection.v1')||'null');const entries=collection?.discoveredMolecules??collection?.discoveredMoleculeIds??[];if(entries.some(e=>(typeof e==='string'?e:e.id)==='hydrogen'))state.recipes.push('hydrogen');}catch{}
  function save(){
    if(blocked)return false;
    try{if(!storage)throw Error('No storage');if(storage.getItem(RESOURCE_KEY)!==previous){blocked=true;report('別の画面で資源が更新されました。上書きを止めています。再読み込みしてください。');return false;}const raw=JSON.stringify(validate(state));if(raw!==previous){storage.setItem(RESOURCE_KEY,raw);previous=raw;}report('');return true;}catch{report('資源を保存できません。この画面を閉じる前に保存設定を確認してください。');return false;}
  }
  function spend(cost){if(blocked||!Object.entries(cost).every(([s,n])=>integer(n)&&(state.elements[s]??Infinity)>=n))return false;for(const [s,n]of Object.entries(cost))if(Object.hasOwn(state.elements,s))state.elements[s]-=n;return true;}
  function refund(cost){if(blocked)return;for(const [s,n]of Object.entries(cost))if(Object.hasOwn(state.elements,s)&&integer(n))state.elements[s]=Math.min(1000000000,state.elements[s]+n);}
  const api={
    get state(){return state;},get blocked(){return blocked;},get message(){return message;},save,
    snapshot:()=>copy(state),spend,refund,
    reset(categories){
      const selected=new Set(categories),full=RESET_CATEGORIES.every(key=>selected.has(key));
      if(!selected.size||[...selected].some(key=>!RESET_CATEGORIES.includes(key))||blocked&&!full)return {committed:false};
      let next;
      try{
        if(!storage||storage.getItem(RESOURCE_KEY)!==previous)throw Error('Stale reset');
        next=full?initialState():copy(state);next.progress.sound=state.progress.sound;
        const clearWorkspace=full||['workspace','elements','collection','recipes'].some(key=>selected.has(key));
        if(clearWorkspace){
          if(!full&&!selected.has('elements'))for(const atom of next.workspace?.atoms??[])if(Object.hasOwn(next.elements,atom.element))next.elements[atom.element]=Math.min(1000000000,next.elements[atom.element]+1);
          next.workspace=null;
        }
        if(selected.has('recipes'))next.recipes=[];
        for(const key of ['elements','molecules'])if(selected.has(key))for(const symbol of Object.keys(next[key]))next[key][symbol]=0;
        if(selected.has('exploration')){Object.assign(next.progress,{runs:0,cleared:false,craftPrompt:false});delete next.progress.special;}
        if(selected.has('records'))next.progress.bestChain=0;
        next.resetEpoch=(state.resetEpoch??0)+1;
        next.pendingReset={collection:selected.has('collection'),legacy:clearWorkspace,help:full};
        const raw=JSON.stringify(validate(next));storage.setItem(RESOURCE_KEY,raw);previous=raw;state=next;
      }catch{report('初期化できませんでした。保存は変更していません。再読み込みして確認してください。');return {committed:false};}
      // Prevent pagehide or an old in-memory graph from saving over the reset.
      blocked=true;
      try{finishReset(storage,state);previous=storage.getItem(RESOURCE_KEY);report('初期化しました。再読み込みします。');return {committed:true,complete:true};}
      catch{report('初期化を記録しました。再読み込み時に残りを安全に完了します。');return {committed:true,complete:false};}
    },
    learn(id){if(!blocked&&!state.recipes.includes(id))state.recipes.push(id);},
    makeHydrogen(count){if(!integer(count)||count<1||!state.recipes.includes('hydrogen')||!spend({H:count*2}))return false;state.molecules.hydrogen+=count;return true;},
    storeHydrogen(count){if(blocked||!integer(count)||count<1)return false;state.molecules.hydrogen+=count;api.learn('hydrogen');return true;},
    consumeBoost(){if(blocked||state.molecules.hydrogen<VEIL.boostCost)return false;state.molecules.hydrogen-=VEIL.boostCost;save();return true;},
    collect(amount,best){if(blocked||!integer(amount))return;refund({H:amount});state.progress.bestChain=Math.max(state.progress.bestChain,best);},
    workspaceAdapter:{
      getItem(key){if(key!==WORKSPACE_STORAGE_KEY)return storage?.getItem(key)??null;return state.workspace?JSON.stringify(state.workspace):null;},
      setItem(key,raw){if(key!==WORKSPACE_STORAGE_KEY)throw Error('Unexpected save key');if(blocked)throw Error('Protected save');state.workspace=validateWorkspace(JSON.parse(raw));if(!save())throw Error('Save failed');},
    },
  };
  if(!storage)report('端末保存を利用できません。この画面の間だけ資源を保持します。');
  return api;
}
