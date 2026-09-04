import { EXPEDITION } from './config.js';
import { GROWTH,MOLECULE_USES,DRIVES,REGIONS,TANK_USES,tankCapacity,tankUsesFor } from './growth.js';
import { combustionPacketFor,performanceFor } from './molecule-roles.js';
import { WORKSPACE_STORAGE_KEY,validateWorkspace } from '../workspace-save.js?v=30';
export const RESOURCE_KEY='molecule-craft.resources.v1';
const COLLECTION_KEY='molecule-craft.collection.v1',HELP_KEY='molecule-craft.help.v1',MANAGED=['H','C','O'],STOCKED=['H','C','N','O','F','P','S','Cl'],MAX=1e9;
export const RESET_CATEGORIES=Object.freeze(['collection','recipes','elements','tanks','exploration','records','workspace']);
const emptyCollection=()=>({schemaVersion:2,discoveredMolecules:[],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]});
const initialProgress=()=>({bestChain:0,runs:0,cleared:false,craftPrompt:false,sound:true,foundElements:['H'],regions:['veil'],checkpoint:'veil',frontier:false,totalCollected:0,signalMisses:0,signalLast:{}});
const initialTanks=()=>Object.fromEntries(Object.keys(TANK_USES).map(use=>[use,{molecule:null,amount:0}]));
const emptyElementStock=()=>Object.fromEntries(STOCKED.map(element=>[element,0]));
const initialState=()=>({schemaVersion:6,elements:emptyElementStock(),tanks:initialTanks(),recipes:[],hints:[],dust:{H:0,C:0,O:0},loadout:{drive:'hydrogen',cooling:true},progress:initialProgress(),workspace:null});
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
  if(!s||![1,2,3,4,5,6].includes(s.schemaVersion)||!s.elements||!ids(s.recipes)||!s.progress)throw Error('Invalid resources');
  for(const [key,n]of Object.entries(s.elements))if(!validId(key)||!integer(n))throw Error('Invalid inventory');
  if(s.schemaVersion<=5){if(!s.molecules)throw Error('Invalid inventory');for(const [key,n]of Object.entries(s.molecules))if(!validId(key)||!integer(n))throw Error('Invalid inventory');if(!integer(s.molecules.hydrogen))throw Error('Invalid inventory');}
  if(!integer(s.elements.H)||typeof s.progress.cleared!=='boolean'||!integer(s.progress.bestChain)||!integer(s.progress.runs))throw Error('Invalid progress');
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
    for(const [id,capacity]of Object.entries({hydrogen:EXPEDITION.hydrogenCapacity,methane:EXPEDITION.methaneCapacity,oxygen:EXPEDITION.oxygenCapacity}))if(!integer(s.tanks[id])||s.tanks[id]>capacity)throw Error('Invalid propulsion tank');
    for(const el of MANAGED)if(!integer(s.elements[el])||!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  if(s.schemaVersion===4){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean'||!s.tanks)throw Error('Invalid systems');
    for(const [use,capacity]of Object.entries({propellant:3,fuel:18,oxidizer:36,coolant:12})){const tank=s.tanks[use];if(!tank||tank.molecule!==null&&!validId(tank.molecule)||!integer(tank.amount)||tank.amount>capacity||tank.amount>0&&!tank.molecule)throw Error('Invalid tank');}
    for(const el of MANAGED)if(!integer(s.elements[el])||!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  if(s.schemaVersion===5){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean'||!s.tanks)throw Error('Invalid systems');
    for(const use of Object.keys(TANK_USES)){const tank=s.tanks[use];if(!tank||tank.molecule!==null&&!validId(tank.molecule)||!integer(tank.amount)||tank.amount>0&&!tank.molecule)throw Error('Invalid tank');const capacity=tank.molecule?tankCapacity(use,tank.molecule):0;if(tank.molecule&&capacity===null||tank.amount>(capacity??0))throw Error('Invalid tank capacity');}
    for(const el of MANAGED)if(!integer(s.elements[el])||!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  if(s.schemaVersion===6){
    if(!ids(s.hints)||!s.dust||!s.loadout||!Object.hasOwn(DRIVES,s.loadout.drive)||typeof s.loadout.cooling!=='boolean'||!s.tanks||Object.hasOwn(s,'molecules'))throw Error('Invalid systems');
    for(const use of Object.keys(TANK_USES)){const tank=s.tanks[use];if(!tank||tank.molecule!==null&&!validId(tank.molecule)||!integer(tank.amount)||tank.amount>0&&!tank.molecule)throw Error('Invalid tank');const capacity=tank.molecule?tankCapacity(use,tank.molecule):0;if(tank.molecule&&capacity===null||tank.amount>(capacity??0))throw Error('Invalid tank capacity');}
    for(const el of MANAGED)if(!integer(s.elements[el])||!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');
    const p=s.progress;if(!Array.isArray(p.foundElements)||!p.foundElements.includes('H')||!p.foundElements.every(e=>MANAGED.includes(e))||!Array.isArray(p.regions)||!p.regions.includes('veil')||!p.regions.every(id=>Object.hasOwn(REGIONS,id))||!p.regions.includes(p.checkpoint)||typeof p.frontier!=='boolean'||!integer(p.totalCollected)||!integer(p.signalMisses)||!p.signalLast||Object.entries(p.signalLast).some(([id,n])=>!Object.hasOwn(REGIONS,id)||!integer(n)))throw Error('Invalid expedition');
  }
  return s;
}
function migrate(old){
  if(old.schemaVersion===6)return {...old,elements:{...emptyElementStock(),...old.elements},tanks:{...initialTanks(),...old.tanks}};
  const {molecules:discardedMoleculeInventory,...oldWithoutMolecules}=old;
  const next={...initialState(),...oldWithoutMolecules,schemaVersion:6};next.elements={...emptyElementStock(),...old.elements};next.tanks=initialTanks();next.progress={...initialProgress(),...old.progress};
  const load=(use,id,amount,{legacyBurstUnits=false}={})=>{const capacity=tankCapacity(use,id)??0,value=Math.min(capacity,(amount??0)*(legacyBurstUnits?performanceFor(id,'propellant')?.moleculesPerBurst??1:1));if(value>0)next.tanks[use]={molecule:id,amount:value};};
  if(old.schemaVersion===5){for(const use of Object.keys(TANK_USES)){const tank=old.tanks?.[use];if(tank?.molecule)load(use,tank.molecule,tank.amount);}}
  else if(old.schemaVersion===4){for(const use of Object.keys(TANK_USES)){const tank=old.tanks?.[use];if(tank?.molecule)load(use,tank.molecule,tank.amount,{legacyBurstUnits:use==='propellant'&&tank.molecule==='hydrogen'});}}
  else if(old.schemaVersion===3){load('propellant','hydrogen',old.tanks.hydrogen,{legacyBurstUnits:true});load('fuel','methane',old.tanks.methane);load('oxidizer','oxygen',old.tanks.oxygen);}
  if(old.schemaVersion===1)next.migrateDiscoveries=true;for(const a of next.workspace?.atoms??[])if(MANAGED.includes(a.element)&&!next.progress.foundElements.includes(a.element))next.progress.foundElements.push(a.element);return next;
}
export function createResources({storage,onStatus=()=>{}}={}){
  if(storage===undefined)try{storage=window.localStorage;}catch{storage=null;}
  let state=initialState(),previous=null,blocked=false,message='';const records=new Map(Object.entries(MOLECULE_USES).map(([id,d])=>[id,{id,...d}])),report=x=>{message=x;onStatus(x);};
  const usesFor=id=>tankUsesFor(id),fitsTank=(id,use)=>usesFor(id).includes(use)&&Object.hasOwn(TANK_USES,use);
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
    const record=records.get(id);if(!record||!state.recipes.includes(id))return 0;
    const per=costFor(id),limits=Object.entries(per??{}).filter(([el,n])=>STOCKED.includes(el)&&n>0).map(([el,n])=>Math.floor((state.elements[el]??0)/n));
    return Math.max(0,Math.min(MAX,...(limits.length?limits:[MAX])));
  }
  function tankStatus(use,id=null){
    const definition=TANK_USES[use],tank=state.tanks[use];if(!definition||!tank)return null;
    const selected=id??tank.molecule,current=selected&&tank.molecule===selected?tank.amount:0,capacity=selected?tankCapacity(use,selected):0,loadedCapacity=tank.molecule?tankCapacity(use,tank.molecule):0,cost=selected?costFor(selected):null;
    return {use,label:definition.label,capacity,loadedCapacity,molecule:tank.molecule,amount:tank.amount,selected,current,replacing:!!selected&&tank.amount>0&&tank.molecule!==selected,full:!!selected&&tank.molecule===selected&&tank.amount>=capacity,discovered:!!selected&&state.recipes.includes(selected),affordable:!!selected&&fitsTank(selected,use)&&canAfford(cost),cost};
  }
  function tankFillPlan(use,id){
    const status=tankStatus(use,id);if(!status||!status.discovered||!fitsTank(id,use))return null;
    const space=Math.max(0,status.capacity-status.current),maxAdd=Math.min(space,maxCraftable(id));
    return {...status,space,maxAdd,discarded:status.replacing?status.amount:0,target:status.current+maxAdd};
  }
  function fillTankFromElements(use,id,count=1){
    const plan=tankFillPlan(use,id);if(blocked||!plan||!integer(count)||count<1||count>plan.maxAdd)return false;
    const snapshot=copy(state),tank=state.tanks[use];if(tank.molecule!==id){tank.molecule=id;tank.amount=0;}
    if(!spend(costFor(id,count))){state=snapshot;return false;}tank.amount+=count;
    const result={committed:true,added:count,discarded:plan.discarded,current:tank.amount,capacity:plan.capacity};
    if(save()||!storage)return result;state=snapshot;return false;
  }
  function discover(id){if(blocked||!records.has(id)||state.recipes.includes(id))return false;state.recipes.push(id);hint(id);return true;}
  const api={
    get state(){return state;},get blocked(){return blocked;},get message(){return message;},save,snapshot:()=>copy(state),spend,refund,canAfford,costFor,maxCraftable,tankStatus,tankFillPlan,fillTankFromElements,
    canUseElement:el=>!MANAGED.includes(el)||state.progress.foundElements.includes(el),record:id=>records.get(id),catalog:()=>[...records.values()],tankCatalog:use=>[...records.values()].filter(record=>state.recipes.includes(record.id)&&fitsTank(record.id,use)),tankUses:id=>usesFor(id),
    setCatalog(catalog){for(const rec of catalog)if(validId(rec.id)&&Array.isArray(rec.atoms))records.set(rec.id,rec);if(state.migrateDiscoveries&&!blocked){try{const b=JSON.parse(storage?.getItem(COLLECTION_KEY)||'null');for(const x of b?.discoveredMolecules??b?.discoveredMoleculeIds??[]){const id=typeof x==='string'?x:x.id,rec=records.get(id);if(!rec)continue;discover(id);for(const el of rec.atoms)reveal(el);}}catch{}delete state.migrateDiscoveries;guaranteed();save();}},
    reset(categories){
      const selected=new Set(categories),full=RESET_CATEGORIES.every(k=>selected.has(k));if(!selected.size||[...selected].some(k=>!RESET_CATEGORIES.includes(k))||blocked&&!full)return {committed:false};let next;
      try{if(!storage||storage.getItem(RESOURCE_KEY)!==previous)throw Error();next=full?initialState():copy(state);next.progress.sound=state.progress.sound;const clear=full||['workspace','elements','collection','recipes'].some(k=>selected.has(k));if(clear){if(!full&&!selected.has('elements'))for(const a of next.workspace?.atoms??[])if(STOCKED.includes(a.element))next.elements[a.element]=Math.min(MAX,(next.elements[a.element]??0)+1);next.workspace=null;}if(selected.has('recipes')){next.recipes=[];next.hints=[];next.loadout={drive:'hydrogen',cooling:true};delete next.migrateDiscoveries;}if(full||selected.has('tanks'))next.tanks=initialTanks();if(selected.has('elements')){for(const symbol of Object.keys(next.elements))next.elements[symbol]=0;next.dust={H:0,C:0,O:0};}if(selected.has('exploration')){const {bestChain,sound}=next.progress;next.progress={...initialProgress(),bestChain,sound};for(const el of MANAGED)if(next.elements[el]>0||next.workspace?.atoms.some(a=>a.element===el))next.progress.foundElements.push(el);next.progress.foundElements=[...new Set(next.progress.foundElements)];}if(selected.has('records'))next.progress.bestChain=0;next.resetEpoch=(state.resetEpoch??0)+1;next.pendingReset={collection:selected.has('collection'),legacy:clear,help:full};const raw=JSON.stringify(validate(next));storage.setItem(RESOURCE_KEY,raw);previous=raw;state=next;}catch{report('初期化できませんでした。保存は変更していません。再読み込みして確認してください。');return {committed:false};}blocked=true;try{finishReset(storage,state);previous=storage.getItem(RESOURCE_KEY);report('初期化しました。再読み込みします。');return {committed:true,complete:true};}catch{report('初期化を記録しました。再読み込み時に残りを安全に完了します。');return {committed:true,complete:false};}
    },
    hint,learn:discover,discover,
    consumeTank(use,id,amount){const tank=state.tanks[use];if(blocked||!state.recipes.includes(id)||!fitsTank(id,use)||!integer(amount)||amount<1||tank?.molecule!==id||tank.amount<amount)return false;const snapshot=copy(state);tank.amount-=amount;if(save()||!storage)return true;state=snapshot;return false;},
    consumeBoost:()=>{const tank=state.tanks.propellant,performance=performanceFor(tank.molecule,'propellant');return !!performance&&api.consumeTank('propellant',tank.molecule,performance.moleculesPerBurst);},
    consumeCombustion(){const fuel=state.tanks.fuel,oxidizer=state.tanks.oxidizer,p=combustionPacketFor(fuel.molecule,{baseSeconds:DRIVES.combustion.packetSeconds});if(blocked||!state.recipes.includes(fuel.molecule)||!state.recipes.includes(oxidizer.molecule)||!p||fuel.molecule!==p.fuel||oxidizer.molecule!==p.oxidizer||fuel.amount<p.fuelAmount||oxidizer.amount<p.oxygenAmount)return false;const snapshot=copy(state);fuel.amount-=p.fuelAmount;oxidizer.amount-=p.oxygenAmount;if(save()||!storage)return true;state=snapshot;return false;},
    consumeDrive:id=>id==='hydrogen'?api.consumeBoost():id==='combustion'?api.consumeCombustion():false,
    prepareExpedition(){const entry=use=>{const tank=state.tanks[use],supported=tank?.molecule&&state.recipes.includes(tank.molecule)&&fitsTank(tank.molecule,use);return {molecule:supported?tank.molecule:null,amount:supported?tank.amount:0};};return {propellant:entry('propellant'),fuel:entry('fuel'),oxidizer:entry('oxidizer')};},
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
