import { EXPEDITION } from './config.js';
import { GROWTH,MOLECULE_USES,DRIVES,REGIONS,driveAvailable } from './growth.js';
import { WORKSPACE_STORAGE_KEY,validateWorkspace } from '../workspace-save.js?v=30';
export const RESOURCE_KEY='molecule-craft.resources.v1';
const COLLECTION_KEY='molecule-craft.collection.v1',HELP_KEY='molecule-craft.help.v1',MANAGED=['H','C','O'],STOCKED=['H','C','N','O','F','P','S','Cl'],MAX=1e9;
const TANK_CAPACITY=Object.freeze({hydrogen:EXPEDITION.hydrogenCapacity,methane:EXPEDITION.methaneCapacity,oxygen:EXPEDITION.oxygenCapacity});
const TANK_GROUPS=Object.freeze({hydrogen:['hydrogen'],combustion:['methane','oxygen']});
export const RESET_CATEGORIES=Object.freeze(['collection','recipes','elements','molecules','exploration','records','workspace']);
const emptyCollection=()=>({schemaVersion:2,discoveredMolecules:[],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]});
const initialProgress=()=>({bestChain:0,runs:0,cleared:false,craftPrompt:false,sound:true,foundElements:['H'],regions:['veil'],checkpoint:'veil',frontier:false,totalCollected:0,signalMisses:0,signalLast:{}});
const initialTanks=()=>({hydrogen:0,methane:0,oxygen:0});
const emptyElementStock=()=>Object.fromEntries(STOCKED.map(element=>[element,0]));
const initialState=()=>({schemaVersion:3,elements:emptyElementStock(),molecules:{hydrogen:0,methane:0,oxygen:0,water:0},tanks:initialTanks(),recipes:[],hints:[],dust:{H:0,C:0,O:0},loadout:{drive:'hydrogen',cooling:true},progress:initialProgress(),workspace:null});
const copy=x=>JSON.parse(JSON.stringify(x)),integer=x=>Number.isSafeInteger(x)&&x>=0&&x<=MAX;
function expeditionLoss(units,rate){
  const exact=MANAGED.map((el,index)=>({el,index,value:(units[el]??0)*rate})),lost=Object.fromEntries(exact.map(({el,value})=>[el,Math.floor(value)]));
  let remaining=Math.floor(MANAGED.reduce((sum,el)=>sum+(units[el]??0),0)*rate)-MANAGED.reduce((sum,el)=>sum+lost[el],0);
  for(const item of exact.sort((a,b)=>(b.value-Math.floor(b.value))-(a.value-Math.floor(a.value))||a.index-b.index)){if(remaining<=0)break;if(lost[item.el]<(units[item.el]??0)){lost[item.el]++;remaining--;}}
  return lost;
}
const validId=x=>typeof x==='string'&&/^[A-Za-z][A-Za-z0-9-]*$/.test(x)&&!['constructor','prototype','__proto__'].includes(x);
const ids=x=>Array.isArray(x)&&x.every(validId)&&new Set(x).size===x.length;
function finishReset(storage,state){const p=state.pendingReset;if(!p)return;if(p.collection)storage.setItem(COLLECTION_KEY,JSON.stringify(emptyCollection()));if(p.legacy)storage.removeItem(WORKSPACE_STORAGE_KEY);if(p.help)storage.removeItem(HELP_KEY);const done={...state};delete done.pendingReset;storage.setItem(RESOURCE_KEY,JSON.stringify(done));delete state.pendingReset;}
function validate(s){
  if(!s||![1,2,3].includes(s.schemaVersion)||!s.elements||!s.molecules||!ids(s.recipes)||!s.progress)throw Error('Invalid resources');
  for(const values of [s.elements,s.molecules])for(const [key,n]of Object.entries(values))if(!validId(key)||!integer(n))throw Error('Invalid inventory');
  if(!integer(s.elements.H)||!integer(s.molecules.hydrogen)||typeof s.progress.cleared!=='boolean'||!integer(s.progress.bestChain)||!integer(s.progress.runs))throw Error('Invalid progress');
  if(s.resetEpoch!==undefined&&!integer(s.resetEpoch))throw Error('Invalid reset epoch');
  if(s.pendingReset!==undefined&&(!s.pendingReset||['collection','legacy','help'].some(k=>typeof s.pendingReset[k]!=='boolean')))throw Error('Invalid reset journal');
  if(s.workspace!==null)validateWorkspace(s.workspace);
  if(s.schemaVersion===2){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean')throw Error('Invalid systems');
    for(const el of MANAGED)if(!integer(s.elements[el])||!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  if(s.schemaVersion===3){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean'||!s.tanks)throw Error('Invalid systems');
    for(const [id,capacity]of Object.entries(TANK_CAPACITY))if(!integer(s.tanks[id])||s.tanks[id]>capacity)throw Error('Invalid propulsion tank');
    for(const el of MANAGED)if(!integer(s.elements[el])||!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }return s;
}
function migrate(old){
  if(old.schemaVersion===3)return {...old,elements:{...emptyElementStock(),...old.elements}};
  const next={...initialState(),...old,schemaVersion:3};next.elements={...emptyElementStock(),...old.elements};next.molecules={hydrogen:0,methane:0,oxygen:0,water:0,...old.molecules};next.tanks=initialTanks();next.progress={...initialProgress(),...old.progress};
  const transfer=(id,allowed=true)=>{if(!allowed)return;const amount=Math.min(TANK_CAPACITY[id],next.molecules[id]??0);next.molecules[id]-=amount;next.tanks[id]=amount;};
  transfer('hydrogen',next.recipes.includes('hydrogen'));const combustion=driveAvailable(next,'combustion');transfer('methane',combustion);transfer('oxygen',combustion);
  if(old.schemaVersion===1)next.migrateDiscoveries=true;for(const a of next.workspace?.atoms??[])if(MANAGED.includes(a.element)&&!next.progress.foundElements.includes(a.element))next.progress.foundElements.push(a.element);return next;
}
export function createResources({storage,onStatus=()=>{}}={}){
  if(storage===undefined)try{storage=window.localStorage;}catch{storage=null;}
  let state=initialState(),previous=null,blocked=false,message='';const records=new Map(Object.entries(MOLECULE_USES).map(([id,d])=>[id,{id,...d}])),report=x=>{message=x;onStatus(x);};
  try{previous=storage?.getItem(RESOURCE_KEY)??null;if(previous){if(previous.length>3e6)throw Error();state=validate(JSON.parse(previous));if(state.pendingReset){finishReset(storage,state);previous=storage.getItem(RESOURCE_KEY);}state=migrate(state);}else{const legacy=storage?.getItem(WORKSPACE_STORAGE_KEY);if(legacy)state.workspace=validateWorkspace(JSON.parse(legacy));if(legacy||storage?.getItem(COLLECTION_KEY))state.migrateDiscoveries=true;for(const a of state.workspace?.atoms??[])if(MANAGED.includes(a.element)&&!state.progress.foundElements.includes(a.element))state.progress.foundElements.push(a.element);}}catch{blocked=true;report('資源または制作の保存を復元できません。元の保存を保護しています。');}
  if(state.migrateDiscoveries&&!blocked)try{const b=JSON.parse(storage?.getItem(COLLECTION_KEY)||'null'),e=b?.discoveredMolecules??b?.discoveredMoleculeIds??[];if(e.some(x=>(typeof x==='string'?x:x.id)==='hydrogen')&&!state.recipes.includes('hydrogen'))state.recipes.push('hydrogen');}catch{}
  function save(){if(blocked)return false;if(!storage){report('端末保存を利用できません。この画面の間だけ資源を保持します。');return true;}try{if(storage.getItem(RESOURCE_KEY)!==previous){blocked=true;report('別の画面で資源が更新されました。上書きを止めています。再読み込みしてください。');return false;}const raw=JSON.stringify(validate(state));if(raw!==previous){storage.setItem(RESOURCE_KEY,raw);previous=raw;}report('');return true;}catch{report('資源を保存できません。この画面を閉じる前に保存設定を確認してください。');return false;}}
  const canAfford=cost=>!!cost&&Object.entries(cost).every(([s,n])=>STOCKED.includes(s)&&integer(n)&&(state.elements[s]??0)>=n);
  function spend(cost){if(blocked||!canAfford(cost))return false;for(const [s,n]of Object.entries(cost))state.elements[s]-=n;return true;}
  function refund(cost){if(blocked)return;for(const [s,n]of Object.entries(cost))if(STOCKED.includes(s)&&integer(n))state.elements[s]=Math.min(MAX,(state.elements[s]??0)+n);}
  const reveal=el=>{if(MANAGED.includes(el)&&!state.progress.foundElements.includes(el))state.progress.foundElements.push(el);};
  function hint(id){if(blocked||!records.has(id)||state.hints.includes(id))return false;state.hints.push(id);return true;}
  function guaranteed(){if(state.elements.H>=2||state.recipes.includes('hydrogen'))hint('hydrogen');if(state.progress.foundElements.includes('C'))hint('methane');if(state.progress.foundElements.includes('O')){hint('oxygen');hint('water');}}
  function costFor(id,count=1){const record=records.get(id);if(!record||!integer(count)||count<1)return null;const cost={};for(const el of record.atoms)cost[el]=(cost[el]??0)+count;return cost;}
  function maxCraftable(id){
    const record=records.get(id),current=state.molecules[id]??0;if(!record||!state.recipes.includes(id)||!integer(current))return 0;
    const per=costFor(id),limits=Object.entries(per??{}).filter(([el,n])=>STOCKED.includes(el)&&n>0).map(([el,n])=>Math.floor((state.elements[el]??0)/n));
    return Math.max(0,Math.min(MAX-current,...(limits.length?limits:[MAX-current])));
  }
  function tankPlan(id){
    const fuels=TANK_GROUPS[id];if(!fuels)return null;
    const items=fuels.map(fuel=>{const current=state.tanks[fuel]??0,capacity=TANK_CAPACITY[fuel],need=Math.max(0,capacity-current),stock=state.molecules[fuel]??0,transferable=Math.min(need,stock);return {id:fuel,current,capacity,need,stock,transferable,shortage:need-transferable};});
    const full=items.every(item=>item.need===0),shortage=Object.fromEntries(items.filter(item=>item.shortage>0).map(item=>[item.id,item.shortage]));
    return {id,items,full,canFill:!full&&items.every(item=>item.shortage===0),shortage};
  }
  function discover(id){if(blocked||!records.has(id)||state.recipes.includes(id))return false;state.recipes.push(id);hint(id);state.molecules[id]??=0;return true;}
  const api={
    get state(){return state;},get blocked(){return blocked;},get message(){return message;},save,snapshot:()=>copy(state),spend,refund,canAfford,costFor,maxCraftable,tankPlan,
    canUseElement:el=>!MANAGED.includes(el)||state.progress.foundElements.includes(el),record:id=>records.get(id),catalog:()=>[...records.values()],
    setCatalog(catalog){for(const rec of catalog)if(validId(rec.id)&&Array.isArray(rec.atoms))records.set(rec.id,rec);if(state.migrateDiscoveries&&!blocked){try{const b=JSON.parse(storage?.getItem(COLLECTION_KEY)||'null');for(const x of b?.discoveredMolecules??b?.discoveredMoleculeIds??[]){const id=typeof x==='string'?x:x.id,rec=records.get(id);if(!rec)continue;discover(id);for(const el of rec.atoms)reveal(el);}}catch{}delete state.migrateDiscoveries;guaranteed();save();}},
    reset(categories){
      const selected=new Set(categories),full=RESET_CATEGORIES.every(k=>selected.has(k));if(!selected.size||[...selected].some(k=>!RESET_CATEGORIES.includes(k))||blocked&&!full)return {committed:false};let next;
      try{if(!storage||storage.getItem(RESOURCE_KEY)!==previous)throw Error();next=full?initialState():copy(state);next.progress.sound=state.progress.sound;const clear=full||['workspace','elements','collection','recipes'].some(k=>selected.has(k));if(clear){if(!full&&!selected.has('elements'))for(const a of next.workspace?.atoms??[])if(STOCKED.includes(a.element))next.elements[a.element]=Math.min(MAX,(next.elements[a.element]??0)+1);next.workspace=null;}if(selected.has('recipes')){next.recipes=[];next.hints=[];next.loadout={drive:'hydrogen',cooling:true};delete next.migrateDiscoveries;}for(const key of ['elements','molecules'])if(selected.has(key))for(const symbol of Object.keys(next[key]))next[key][symbol]=0;if(full||selected.has('molecules'))next.tanks=initialTanks();if(selected.has('elements'))next.dust={H:0,C:0,O:0};if(selected.has('exploration')){const {bestChain,sound}=next.progress;next.progress={...initialProgress(),bestChain,sound};for(const el of MANAGED)if(next.elements[el]>0||next.workspace?.atoms.some(a=>a.element===el))next.progress.foundElements.push(el);next.progress.foundElements=[...new Set(next.progress.foundElements)];}if(selected.has('records'))next.progress.bestChain=0;next.resetEpoch=(state.resetEpoch??0)+1;next.pendingReset={collection:selected.has('collection'),legacy:clear,help:full};const raw=JSON.stringify(validate(next));storage.setItem(RESOURCE_KEY,raw);previous=raw;state=next;}catch{report('初期化できませんでした。保存は変更していません。再読み込みして確認してください。');return {committed:false};}blocked=true;try{finishReset(storage,state);previous=storage.getItem(RESOURCE_KEY);report('初期化しました。再読み込みします。');return {committed:true,complete:true};}catch{report('初期化を記録しました。再読み込み時に残りを安全に完了します。');return {committed:true,complete:false};}
    },
    hint,learn:discover,discover,
    makeMolecule(id,count=1){const cost=costFor(id,count),current=state.molecules[id]??0;if(!cost||!state.recipes.includes(id)||current+count>MAX||!spend(cost))return false;state.molecules[id]=current+count;return true;},
    produceMolecule(id,count=1){const snapshot=copy(state);if(!api.makeMolecule(id,count))return false;if(save()||!storage)return true;state=snapshot;return false;},
    makeHydrogen:n=>api.makeMolecule('hydrogen',n),
    consumeMolecules(cost){if(blocked||!Object.entries(cost).every(([id,n])=>validId(id)&&integer(n)&&(state.molecules[id]??0)>=n))return false;for(const [id,n]of Object.entries(cost))state.molecules[id]-=n;if(save()||!storage)return true;for(const [id,n]of Object.entries(cost))state.molecules[id]+=n;return false;},
    fillTank(id){const plan=tankPlan(id);if(blocked||!plan?.canFill)return false;const snapshot=copy(state);for(const item of plan.items){state.molecules[item.id]-=item.need;state.tanks[item.id]+=item.need;}if(save()||!storage)return true;state=snapshot;return false;},
    consumeTank(cost){if(blocked||!Object.entries(cost).every(([id,n])=>Object.hasOwn(TANK_CAPACITY,id)&&integer(n)&&(state.tanks[id]??0)>=n))return false;const snapshot=copy(state);for(const [id,n]of Object.entries(cost))state.tanks[id]-=n;if(save()||!storage)return true;state=snapshot;return false;},
    consumeBoost:()=>api.consumeTank(DRIVES.hydrogen.cost),consumeDrive:id=>driveAvailable(state,id)&&api.consumeTank(DRIVES[id].cost),
    prepareExpedition(){const combustion=driveAvailable(state,'combustion');return {hydrogen:driveAvailable(state,'hydrogen')?state.tanks.hydrogen:0,methane:combustion?state.tanks.methane:0,oxygen:combustion?state.tanks.oxygen:0};},
    findElement(el){if(blocked||!MANAGED.includes(el))return false;const first=!state.progress.foundElements.includes(el);reveal(el);guaranteed();return first;},
    collect(amount,best=0){if(blocked)return [];const amounts=typeof amount==='number'?{H:amount}:amount;if(!amounts||!Object.entries(amounts).every(([el,n])=>MANAGED.includes(el)&&integer(n)))return [];const before=new Set(state.progress.foundElements);refund(amounts);for(const [el,n]of Object.entries(amounts))if(n>0){reveal(el);state.progress.totalCollected=Math.min(MAX,state.progress.totalCollected+n);}if(integer(best))state.progress.bestChain=Math.max(state.progress.bestChain,best);guaranteed();return state.progress.foundElements.filter(el=>!before.has(el));},
    collectDust(units,best){if(blocked||!Object.entries(units).every(([el,n])=>MANAGED.includes(el)&&integer(n)))return [];const amounts={};for(const [el,n]of Object.entries(units)){const total=state.dust[el]+n;amounts[el]=Math.floor(total/GROWTH.dustPerAtom[el]);state.dust[el]=total%GROWTH.dustPerAtom[el];}return api.collect(amounts,best);},
    settleExpedition(units,best=0,captured=false){
      if(blocked||typeof captured!=='boolean'||!integer(best)||!units||!Object.entries(units).every(([el,n])=>MANAGED.includes(el)&&integer(n)))return null;
      const snapshot=copy(state),kept={},before={...state.elements},rate=captured?EXPEDITION.captureLoss:0,lost=expeditionLoss(units,rate);
      for(const el of MANAGED)kept[el]=(units[el]??0)-lost[el];
      const found=api.collectDust(kept,best);if(!save()){state=snapshot;return null;}
      const atoms={};for(const el of MANAGED)atoms[el]=state.elements[el]-before[el];return {captured,rate,kept,lost,atoms,found};
    },
    visit(region){if(blocked||!Object.hasOwn(REGIONS,region))return false;const first=!state.progress.regions.includes(region);if(first)state.progress.regions.push(region);state.progress.checkpoint=region;if(region==='frontier')state.progress.frontier=true;if(region!=='veil')state.progress.cleared=true;return first;},
    signal(region,roll,choice){if(blocked||!Object.hasOwn(REGIONS,region)||![roll,choice].every(n=>Number.isFinite(n)&&n>=0&&n<1))return null;const p=state.progress,last=p.signalLast[region];if(last!==undefined&&p.totalCollected-last<45)return {repeat:true};const candidates=[...records.values()].filter(rec=>!MOLECULE_USES[rec.id]&&!state.recipes.includes(rec.id)&&!state.hints.includes(rec.id)&&rec.atoms.length<=12&&rec.atoms.every(el=>MANAGED.includes(el)&&api.canUseElement(el)));if(candidates.length&&(roll<GROWTH.signalChance||p.signalMisses+1>=GROWTH.signalPity)){const rec=candidates[Math.floor(choice*candidates.length)];hint(rec.id);p.signalMisses=0;p.signalLast[region]=p.totalCollected;save();return {recipe:rec.id};}if(candidates.length)p.signalMisses++;const bonus=region==='veil'?{H:10}:region==='carbon'?{H:8,C:4}:{H:8,O:4};api.collect(bonus,0);p.signalLast[region]=p.totalCollected;save();return {bonus};},
    workspaceAdapter:{getItem(key){if(key!==WORKSPACE_STORAGE_KEY)return storage?.getItem(key)??null;return state.workspace?JSON.stringify(state.workspace):null;},setItem(key,raw){if(key!==WORKSPACE_STORAGE_KEY)throw Error();if(blocked)throw Error();state.workspace=validateWorkspace(JSON.parse(raw));if(!save())throw Error();}},
  };if(!storage)report('端末保存を利用できません。この画面の間だけ資源を保持します。');return api;
}
