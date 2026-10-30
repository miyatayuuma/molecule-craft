import {RESOURCE_STORAGE_KEY,isFutureResourcesSave} from './workspace-persistence.js?v=1';
export const REACTION_PROGRESS_KEY='molecule-craft.reaction-progress.v1';
const VERSION=1;
const ids=value=>Array.isArray(value)?[...new Set(value.filter(id=>typeof id==='string'&&id.length>0))]:[];
export function clearReactionProgress(storage){
  try{const raw=storage?.getItem(REACTION_PROGRESS_KEY);if(!raw)return true;const value=JSON.parse(raw);if(Number(value?.schemaVersion)>VERSION)return false;storage.removeItem(REACTION_PROGRESS_KEY);return true;}catch{return false;}
}
export function createReactionProgress({storage=null,authority,legacyPolymerEntries=[],onStatus=()=>{},onChange=()=>{}}={}){
  let previous=null,epoch=0,blocked=false,message='',hinted=new Set(),verified=new Set(),fieldBudget=null;
  const warn=text=>{message=text;onStatus(text);};
  try{
    const resourceRaw=storage?.getItem(RESOURCE_STORAGE_KEY);if(isFutureResourcesSave(resourceRaw))throw Error('future-resources');
    const resource=JSON.parse(resourceRaw||'null');epoch=resource?.resetEpoch??0;if(resource?.pendingReset)throw Error('pending-reset');
    previous=storage?.getItem(REACTION_PROGRESS_KEY)??null;
    if(previous!==null){const saved=JSON.parse(previous);if(!saved||saved.schemaVersion!==VERSION||!Array.isArray(saved.hintedReactionIds)||!Array.isArray(saved.verifiedReactionIds))throw Error('unsupported-reaction-save');hinted=new Set(ids(saved.hintedReactionIds));verified=new Set(ids(saved.verifiedReactionIds));if(saved.fieldBudget!==undefined){const b=saved.fieldBudget;if(!b||typeof b.runId!=='string'||!b.sources||typeof b.sources!=='object'||Object.values(b.sources).some(n=>!Number.isSafeInteger(n)||n<0))throw Error('invalid-field-budget');fieldBudget={runId:b.runId,sources:{...b.sources}};}}
    else {
      const byPolymer=new Map();for(const entry of authority.entries().filter(item=>item.kind==='polymer')){const id=entry.definition.polymerId;byPolymer.set(id,[...(byPolymer.get(id)??[]),entry.reactionId]);}
      for(const entry of legacyPolymerEntries){const matches=byPolymer.get(entry.id)??[];if(matches.length===1)verified.add(matches[0]);}
    }
  }catch{blocked=true;warn('反応の保存データを保護しています。この画面では保存できません。');}
  function persist(){
    if(!storage||blocked){if(!storage)warn('反応の進行はこの画面の間だけ保持されます。');return false;}
    try{const resourceRaw=storage.getItem(RESOURCE_STORAGE_KEY),resource=JSON.parse(resourceRaw||'null');if(isFutureResourcesSave(resourceRaw)||resource?.pendingReset||(resource?.resetEpoch??0)!==epoch||storage.getItem(REACTION_PROGRESS_KEY)!==previous)throw Error('save-conflict');
      const raw=JSON.stringify({schemaVersion:VERSION,hintedReactionIds:[...hinted],verifiedReactionIds:[...verified],...(fieldBudget?{fieldBudget}: {})});storage.setItem(REACTION_PROGRESS_KEY,raw);previous=raw;message='';onStatus('');try{onChange();}catch{}return true;
    }catch{warn('反応の進行を保存できません。再読み込み前に保存設定を確認してください。');return false;}
  }
  if(previous===null&&verified.size&&!blocked)persist();
  function record(id,set){if(!authority.get(id))return {changed:false,saved:false,reason:'unknown-id'};if(set.has(id))return {changed:false,saved:true};set.add(id);if(!persist()){set.delete(id);return {changed:false,saved:false,reason:'save-failed'};}return {changed:true,saved:true};}
  function fieldRecipeCount(runId,source='field'){return fieldBudget?.runId===runId?(fieldBudget.sources[source]??0):0;}
  function claimFieldRecipe(id,runId,source='field',cap=1){
    if(blocked||typeof runId!=='string'||!runId||!['field','tnt'].includes(source)||!Number.isSafeInteger(cap)||cap<1||!authority.get(id))return {changed:false,saved:false,reason:'invalid'};
    if(verified.has(id)||hinted.has(id))return {changed:false,saved:false,reason:'already-known'};
    if(fieldRecipeCount(runId,'field')+fieldRecipeCount(runId,'tnt')>=1)return {changed:false,saved:false,reason:'cap'};
    const old=fieldBudget;fieldBudget={runId,sources:{...(old?.runId===runId?old.sources:{}),[source]:fieldRecipeCount(runId,source)+1}};hinted.add(id);
    if(!persist()){hinted.delete(id);fieldBudget=old;return {changed:false,saved:false,reason:'save-failed'};}
    return {changed:true,saved:true};
  }
  return {fieldRecipeCount,claimFieldRecipe,getState:id=>verified.has(id)?'verified':hinted.has(id)?'hinted':'notFound',hint:id=>verified.has(id)?{changed:false,saved:true}:record(id,hinted),verify:id=>record(id,verified),snapshot:()=>({schemaVersion:VERSION,hintedReactionIds:[...hinted],verifiedReactionIds:[...verified]}),get storageMessage(){return message;},get blocked(){return blocked;},persist};
}
