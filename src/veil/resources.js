import { nextOxygenUpgrade } from './tank-upgrades.js';
import { EXPEDITION } from './config.js';
import { CHALLENGE_INSIGHT_IDS } from './expedition-challenges.js';
import { CRITICAL_INSIGHT_IDS } from './insights.js';
import { GROWTH,MOLECULE_USES,DRIVES,REGIONS,REGION_ORDER,TANK_USES,tankCapacity,tankUsesFor } from './growth.js';
import { combustionPacketFor,performanceFor } from './molecule-roles.js';
import { validateWorkspace } from '../workspace-save.js?v=31';
import { WORKSPACE_STORAGE_KEY,parseWorkspaceSave } from '../workspace-persistence.js?v=1';
import { RESOURCE_KEY,MAX_RESOURCE_VALUE,MANAGED_ELEMENTS,STOCKED_ELEMENTS,createInitialProgress,createInitialTanks,createInitialSelectedLoadout,createInitialResourcesState,isResourceInteger,isValidResourceId,loadPersistedResources,serializeResourcesState,finishPendingResourcesReset } from './resources-persistence.js';
export { RESOURCE_KEY };
const COLLECTION_KEY='molecule-craft.collection.v1',MANAGED=MANAGED_ELEMENTS,STOCKED=STOCKED_ELEMENTS,MAX=MAX_RESOURCE_VALUE;
export const RESET_CATEGORIES=Object.freeze(['collection','recipes','elements','tanks','exploration','records','workspace']);
export const CRITICAL_INSIGHT_STARTER_COUNTS=Object.freeze({hydrogen:80,methane:4,oxygen:8,water:8});
export const criticalInsightStarterCount=id=>CRITICAL_INSIGHT_STARTER_COUNTS[id]??0;
const initialProgress=createInitialProgress,initialTanks=createInitialTanks,initialSelectedLoadout=createInitialSelectedLoadout,initialState=createInitialResourcesState;
const copy=x=>JSON.parse(JSON.stringify(x)),integer=isResourceInteger,validId=isValidResourceId;
const SIGNAL_ELEMENTS=Object.freeze(['H','C','O']),CRITICAL_SIGNAL_IDS=new Set(CRITICAL_INSIGHT_IDS),CHALLENGE_SIGNAL_IDS=new Set(CHALLENGE_INSIGHT_IDS);
export const regionRank=region=>REGION_ORDER.indexOf(region);
export function minimumSignalRegionFor(record){
  if(!record||!validId(record.id)||!Array.isArray(record.atoms)||!record.atoms.length||record.atoms.some(el=>!SIGNAL_ELEMENTS.includes(el)))return null;
  if(record.atoms.includes('O'))return 'oxygen';
  if(record.atoms.includes('C'))return 'carbon';
  return record.atoms.every(el=>el==='H')?'veil':null;
}
export function signalCandidateEligible(record,{region,recipes=[],hints=[],excludeIds=new Set(),canUseElement=()=>false}={}){
  const minimum=minimumSignalRegionFor(record),currentRank=regionRank(region),minimumRank=regionRank(minimum);
  return minimum!==null&&currentRank>=minimumRank&&!CRITICAL_SIGNAL_IDS.has(record.id)&&!CHALLENGE_SIGNAL_IDS.has(record.id)&&!recipes.includes(record.id)&&!hints.includes(record.id)&&!excludeIds.has(record.id)&&record.atoms.length<=12&&record.atoms.every(canUseElement);
}
function expeditionLoss(units,rate){
  const exact=MANAGED.map((el,index)=>({el,index,value:(units[el]??0)*rate})),lost=Object.fromEntries(exact.map(({el,value})=>[el,Math.floor(value)]));
  let remaining=Math.floor(MANAGED.reduce((sum,el)=>sum+(units[el]??0),0)*rate)-MANAGED.reduce((sum,el)=>sum+lost[el],0);
  for(const item of exact.sort((a,b)=>(b.value-Math.floor(b.value))-(a.value-Math.floor(a.value))||a.index-b.index)){if(remaining<=0)break;if(lost[item.el]<(units[item.el]??0)){lost[item.el]++;remaining--;}}
  return lost;
}
export function createResources({storage,onStatus=()=>{}}={}){
  if(storage===undefined)try{storage=window.localStorage;}catch{storage=null;}
  let state=initialState(),previous=null,blocked=false,message='';const records=new Map(Object.entries(MOLECULE_USES).map(([id,d])=>[id,{id,...d}])),report=x=>{message=x;onStatus(x);};
  const usesFor=id=>tankUsesFor(id),fitsTank=(id,use)=>usesFor(id).includes(use)&&Object.hasOwn(TANK_USES,use);
  try{const loaded=loadPersistedResources(storage);previous=loaded.previous;if(loaded.state)state=loaded.state;else{const legacy=storage?.getItem(WORKSPACE_STORAGE_KEY);if(legacy)state.workspace=parseWorkspaceSave(legacy);if(legacy||storage?.getItem(COLLECTION_KEY))state.migrateDiscoveries=true;for(const a of state.workspace?.atoms??[])if(MANAGED.includes(a.element)&&!state.progress.foundElements.includes(a.element))state.progress.foundElements.push(a.element);}}catch{blocked=true;report('資源または制作の保存を復元できません。元の保存を保護しています。');}
  if(state.migrateDiscoveries&&!blocked)try{const b=JSON.parse(storage?.getItem(COLLECTION_KEY)||'null'),e=b?.discoveredMolecules??b?.discoveredMoleculeIds??[];if(e.some(x=>(typeof x==='string'?x:x.id)==='hydrogen')&&!state.recipes.includes('hydrogen'))state.recipes.push('hydrogen');}catch{}
  function save(){if(blocked)return false;if(!storage){report('端末保存を利用できません。この画面の間だけ資源を保持します。');return true;}try{if(storage.getItem(RESOURCE_KEY)!==previous){blocked=true;report('別の画面で資源が更新されました。上書きを止めています。再読み込みしてください。');return false;}const raw=serializeResourcesState(state);if(raw!==previous){storage.setItem(RESOURCE_KEY,raw);previous=raw;}report('');return true;}catch{report('資源を保存できません。この画面を閉じる前に保存設定を確認してください。');return false;}}
  const canAfford=cost=>!!cost&&Object.entries(cost).every(([s,n])=>STOCKED.includes(s)&&integer(n)&&(state.elements[s]??0)>=n);
  function spend(cost){if(blocked||!canAfford(cost))return false;for(const [s,n]of Object.entries(cost))state.elements[s]-=n;return true;}
  function refund(cost){if(blocked)return;for(const [s,n]of Object.entries(cost))if(STOCKED.includes(s)&&integer(n))state.elements[s]=Math.min(MAX,(state.elements[s]??0)+n);}
  const reveal=el=>{if(MANAGED.includes(el)&&!state.progress.foundElements.includes(el))state.progress.foundElements.push(el);};
  function hint(id){if(blocked||!records.has(id)||state.hints.includes(id))return false;state.hints.push(id);return true;}
  function legacyGuaranteed(){if(state.elements.H>=2||state.recipes.includes('hydrogen'))hint('hydrogen');if(state.progress.foundElements.includes('C'))hint('methane');if(state.progress.foundElements.includes('O')){hint('oxygen');hint('water');hint('carbon-dioxide');}}
  function costFor(id,count=1){const record=records.get(id);if(!record||!integer(count)||count<1)return null;const cost={};for(const el of record.atoms)cost[el]=(cost[el]??0)+count;return cost;}
  function maxCraftable(id){
    const record=records.get(id);if(!record||!state.recipes.includes(id))return 0;
    const per=costFor(id),limits=Object.entries(per??{}).filter(([el,n])=>STOCKED.includes(el)&&n>0).map(([el,n])=>Math.floor((state.elements[el]??0)/n));
    return Math.max(0,Math.min(MAX,...(limits.length?limits:[MAX])));
  }
  function tankStatus(use,id=null){
    const definition=TANK_USES[use],tank=state.tanks[use];if(!definition||!tank)return null;
    const selected=id??tank.molecule,current=selected&&tank.molecule===selected?tank.amount:0,capacity=selected?tankCapacity(use,selected,state.upgrades):0,loadedCapacity=tank.molecule?tankCapacity(use,tank.molecule,state.upgrades):0,cost=selected?costFor(selected):null;
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
  function selectedLoadout(){return {...initialSelectedLoadout(),...(state.loadout?.tanks??{})};}
  function setLoadoutTank(use,id){
    if(blocked||!Object.hasOwn(TANK_USES,use)||id!==null&&(!validId(id)||!state.recipes.includes(id)||!fitsTank(id,use)))return false;
    const before=copy(state);state.loadout={drive:state.loadout?.drive??'hydrogen',cooling:state.loadout?.cooling??true,tanks:selectedLoadout()};state.loadout.tanks[use]=id;
    if(save()||!storage)return true;state=before;return false;
  }
  const addCost=(target,cost)=>{for(const [el,n]of Object.entries(cost??{}))target[el]=(target[el]??0)+n;return target;};
  function launchAvailableElements(includeWorkspace=true){const available={...state.elements};if(includeWorkspace)for(const atom of state.workspace?.atoms??[])if(STOCKED.includes(atom.element))available[atom.element]=(available[atom.element]??0)+1;return available;}
  const affordableCost=(cost,available=state.elements)=>Object.entries(cost).every(([el,n])=>(available[el]??0)>=n);
  function progressionAvailableElements(cargo={}){const available=launchAvailableElements(true);for(const [el,n]of Object.entries(cargo))if(STOCKED.includes(el)&&integer(n))available[el]=Math.min(MAX,(available[el]??0)+n);return available;}
  const criticalStarterReady=(id,available)=>{const count=criticalInsightStarterCount(id),cost=count?costFor(id,count):null;return !!cost&&affordableCost(cost,available);};
  function fillEntriesAt(rate){
    const selected=selectedLoadout(),entries=[];
    for(const use of Object.keys(TANK_USES)){
      const molecule=selected[use],tank=state.tanks[use],valid=!molecule||state.recipes.includes(molecule)&&fitsTank(molecule,use)&&records.has(molecule),same=valid&&!!molecule&&tank.molecule===molecule,current=same?tank.amount:0,capacity=valid&&molecule?tankCapacity(use,molecule,state.upgrades)??0:0;
      const scaled=valid&&molecule?Math.floor(capacity*Math.max(0,Math.min(1,rate))):0,target=valid&&molecule?Math.max(current,scaled):0,add=Math.max(0,target-current),cost=valid&&add?costFor(molecule,add):{};
      entries.push({use,molecule,currentMolecule:tank.molecule,currentAmount:tank.amount,current,capacity,target,add,cost,invalid:!valid,discard:valid&&tank.amount>0&&tank.molecule!==molecule?tank.amount:0,replacing:valid&&tank.amount>0&&tank.molecule!==molecule});
    }
    const cost={};for(const entry of entries)addCost(cost,entry.cost);return {rate,entries,cost};
  }
  function launchFillPlan({includeWorkspace=true}={}){
    const available=launchAvailableElements(includeWorkspace),full=fillEntriesAt(1),required={...full.cost},invalid=full.entries.filter(entry=>entry.invalid).map(entry=>({use:entry.use,molecule:entry.molecule})),missing=Object.fromEntries(Object.entries(required).filter(([el,n])=>(available[el]??0)<n).map(([el,n])=>[el,{have:available[el]??0,need:n}]));
    if(invalid.length)return {status:'IMPOSSIBLE',full,partial:fillEntriesAt(0),required,missing,invalid};
    if(affordableCost(full.cost,available))return {status:'FULL',full,partial:full,required,missing,invalid};
    let low=0,high=1;for(let i=0;i<32;i++){const mid=(low+high)/2,attempt=fillEntriesAt(mid);if(affordableCost(attempt.cost,available))low=mid;else high=mid;}
    const partial=fillEntriesAt(low),selectedCount=partial.entries.filter(entry=>entry.molecule).length,usable=selectedCount===0||partial.entries.some(entry=>entry.molecule&&entry.target>0);
    return {status:usable?'PARTIAL':'IMPOSSIBLE',full,partial,required,missing,invalid};
  }
  function commitLaunchFill({partial=false}={}){
    if(blocked)return false;const preview=launchFillPlan({includeWorkspace:false});if(preview.status==='IMPOSSIBLE'||preview.status==='PARTIAL'&&!partial)return false;
    const plan=preview.status==='FULL'?preview.full:preview.partial,before=copy(state);if(!spend(plan.cost)){state=before;return false;}
    for(const entry of plan.entries){const tank=state.tanks[entry.use];if(!entry.molecule){tank.molecule=null;tank.amount=0;}else{tank.molecule=entry.molecule;tank.amount=entry.target;}}
    if(save()||!storage)return {committed:true,status:preview.status,plan:copy(plan),required:copy(preview.required),missing:copy(preview.missing)};state=before;return false;
  }
  function oxygenUpgradePlan(){const upgrade=nextOxygenUpgrade(state);return upgrade?{...upgrade,available:upgrade.requires.every(id=>state.recipes.includes(id)),affordable:canAfford(upgrade.cost)}:null;}
  function upgradeOxygenTank(){
    const plan=oxygenUpgradePlan();if(blocked||!plan?.available||!plan.affordable)return false;
    const before=copy(state);if(!spend(plan.cost))return false;state.upgrades.oxygenTank++;
    if(save())return true;state=before;return false;
  }
  function discover(id){if(blocked||!records.has(id)||state.recipes.includes(id))return false;state.recipes.push(id);hint(id);return true;}
  function recordThermalStrain(){if(blocked||state.progress.thermalStrainExperienced)return false;state.progress.thermalStrainExperienced=true;if(save()||!storage)return true;state.progress.thermalStrainExperienced=false;return false;}
  const api={
    get state(){return state;},get blocked(){return blocked;},get message(){return message;},save,snapshot:()=>copy(state),spend,refund,canAfford,costFor,maxCraftable,tankStatus,tankFillPlan,fillTankFromElements,selectedLoadout,setLoadoutTank,launchFillPlan,commitLaunchFill,oxygenUpgradePlan,upgradeOxygenTank,recordThermalStrain,
    canUseElement:el=>!MANAGED.includes(el)||state.progress.foundElements.includes(el),record:id=>records.get(id),catalog:()=>[...records.values()],tankCatalog:use=>[...records.values()].filter(record=>state.recipes.includes(record.id)&&fitsTank(record.id,use)),tankUses:id=>usesFor(id),
    setCatalog(catalog){for(const rec of catalog)if(validId(rec.id)&&Array.isArray(rec.atoms))records.set(rec.id,rec);if(state.migrateDiscoveries&&!blocked){try{const b=JSON.parse(storage?.getItem(COLLECTION_KEY)||'null');for(const x of b?.discoveredMolecules??b?.discoveredMoleculeIds??[]){const id=typeof x==='string'?x:x.id,rec=records.get(id);if(!rec)continue;discover(id);for(const el of rec.atoms)reveal(el);}}catch{}delete state.migrateDiscoveries;legacyGuaranteed();save();}},
    reset(categories){
      const selected=new Set(categories),full=RESET_CATEGORIES.every(k=>selected.has(k));if(!selected.size||[...selected].some(k=>!RESET_CATEGORIES.includes(k))||blocked&&!full)return {committed:false};let next;
      try{if(!storage||storage.getItem(RESOURCE_KEY)!==previous)throw Error();next=full?initialState():copy(state);next.progress.sound=state.progress.sound;const clear=full||['workspace','elements','collection','recipes'].some(k=>selected.has(k));if(clear){if(!full&&!selected.has('elements'))for(const a of next.workspace?.atoms??[])if(STOCKED.includes(a.element))next.elements[a.element]=Math.min(MAX,(next.elements[a.element]??0)+1);next.workspace=null;}if(selected.has('recipes')){next.recipes=[];next.hints=[];next.loadout={drive:'hydrogen',cooling:true,tanks:initialSelectedLoadout()};delete next.migrateDiscoveries;}if(full||selected.has('tanks')){next.tanks=initialTanks();next.upgrades={oxygenTank:0};}if(selected.has('elements')){for(const symbol of Object.keys(next.elements))next.elements[symbol]=0;next.dust={H:0,C:0,O:0};}if(selected.has('exploration')){const {bestChain,sound}=next.progress;next.progress={...initialProgress(),bestChain,sound};for(const el of MANAGED)if(next.elements[el]>0||next.workspace?.atoms.some(a=>a.element===el))next.progress.foundElements.push(el);next.progress.foundElements=[...new Set(next.progress.foundElements)];}if(selected.has('records'))next.progress.bestChain=0;next.resetEpoch=(state.resetEpoch??0)+1;next.pendingReset={collection:selected.has('collection'),legacy:clear,help:full};const raw=serializeResourcesState(next);storage.setItem(RESOURCE_KEY,raw);previous=raw;state=next;}catch{report('初期化できませんでした。保存は変更していません。再読み込みして確認してください。');return {committed:false};}blocked=true;try{finishPendingResourcesReset(storage,state);previous=storage.getItem(RESOURCE_KEY);report('初期化しました。再読み込みします。');return {committed:true,complete:true};}catch{report('初期化を記録しました。再読み込み時に残りを安全に完了します。');return {committed:true,complete:false};}
    },
    hint,learn:discover,discover,
    consumeTank(use,id,amount){const tank=state.tanks[use];if(blocked||!state.recipes.includes(id)||!fitsTank(id,use)||!integer(amount)||amount<1||tank?.molecule!==id||tank.amount<amount)return false;const snapshot=copy(state);tank.amount-=amount;if(save()||!storage)return true;state=snapshot;return false;},
    consumeBoost:()=>{const tank=state.tanks.propellant,performance=performanceFor(tank.molecule,'propellant');return !!performance&&api.consumeTank('propellant',tank.molecule,performance.moleculesPerBurst);},
    consumeCombustion(){const fuel=state.tanks.fuel,oxidizer=state.tanks.oxidizer,p=combustionPacketFor(fuel.molecule,{baseSeconds:DRIVES.combustion.packetSeconds});if(blocked||!state.recipes.includes(fuel.molecule)||!state.recipes.includes(oxidizer.molecule)||!p||fuel.molecule!==p.fuel||oxidizer.molecule!==p.oxidizer||fuel.amount<p.fuelAmount||oxidizer.amount<p.oxygenAmount)return false;const snapshot=copy(state);fuel.amount-=p.fuelAmount;oxidizer.amount-=p.oxygenAmount;if(save()||!storage)return true;state=snapshot;return false;},
    consumeDrive:id=>id==='hydrogen'?api.consumeBoost():id==='combustion'?api.consumeCombustion():false,
    prepareExpedition(){const entry=use=>{const tank=state.tanks[use],supported=tank?.molecule&&state.recipes.includes(tank.molecule)&&fitsTank(tank.molecule,use);return {molecule:supported?tank.molecule:null,amount:supported?tank.amount:0,...(supported&&use==='oxidizer'&&state.upgrades.oxygenTank>0?{capacity:tankCapacity(use,tank.molecule,state.upgrades)}:{})};};return {propellant:entry('propellant'),fuel:entry('fuel'),oxidizer:entry('oxidizer'),coolant:entry('coolant')};},
    progressionInsightCandidates({cargo={},foundElements=[]}={}){if(blocked)return [];const found=new Set([...state.progress.foundElements,...foundElements]),available=progressionAvailableElements(cargo),eligible=[];if(criticalStarterReady('hydrogen',available))eligible.push('hydrogen');if(state.recipes.includes('hydrogen')&&found.has('C')&&criticalStarterReady('methane',available))eligible.push('methane');if(state.recipes.includes('methane')&&found.has('O')&&criticalStarterReady('oxygen',available))eligible.push('oxygen');if(state.recipes.includes('methane')&&state.recipes.includes('oxygen')&&state.progress.thermalStrainExperienced&&criticalStarterReady('water',available))eligible.push('water');return eligible.filter(id=>records.has(id)&&!state.recipes.includes(id)&&!state.hints.includes(id));},
    findElementForExpedition(el){if(blocked||!MANAGED.includes(el))return false;const first=!state.progress.foundElements.includes(el);reveal(el);return first;},
    findElement(el){if(blocked||!MANAGED.includes(el))return false;const first=!state.progress.foundElements.includes(el);reveal(el);return first;},
    collect(amount,best=0){if(blocked)return [];const amounts=typeof amount==='number'?{H:amount}:amount;if(!amounts||!Object.entries(amounts).every(([el,n])=>MANAGED.includes(el)&&integer(n)))return [];const before=new Set(state.progress.foundElements);refund(amounts);for(const [el,n]of Object.entries(amounts))if(n>0){reveal(el);state.progress.totalCollected=Math.min(MAX,state.progress.totalCollected+n);}if(integer(best))state.progress.bestChain=Math.max(state.progress.bestChain,best);return state.progress.foundElements.filter(el=>!before.has(el));},
    collectDust(units,best){if(blocked||!Object.entries(units).every(([el,n])=>MANAGED.includes(el)&&integer(n)))return [];const amounts={};for(const [el,n]of Object.entries(units)){const total=state.dust[el]+n;amounts[el]=Math.floor(total/GROWTH.dustPerAtom[el]);state.dust[el]=total%GROWTH.dustPerAtom[el];}return api.collect(amounts,best);},
    settleExpedition(units,best=0,captured=false,{destinationReached=false,insights=[]}={}){
      if(blocked||typeof destinationReached!=='boolean'||typeof captured!=='boolean'||!integer(best)||!units||!Object.entries(units).every(([el,n])=>MANAGED.includes(el)&&integer(n))||!Array.isArray(insights)||insights.some(id=>!validId(id)))return null;
      const snapshot=copy(state),kept={},before={...state.elements},rate=captured?EXPEDITION.captureLoss:0,lost=expeditionLoss(units,rate);
      for(const el of MANAGED)kept[el]=(units[el]??0)-lost[el];
      const completedNow=destinationReached&&!captured&&!state.progress.choCompleted;
      if(completedNow)state.progress.choCompleted=true;
      const persistentHints=[...state.hints],found=api.collectDust(kept,best);state.hints.length=0;state.hints.push(...persistentHints);
      const committedInsights=[];if(!captured)for(const id of insights)if(!state.recipes.includes(id)&&hint(id))committedInsights.push(id);
      if(!save()){state=snapshot;return null;}
      const atoms={};for(const el of MANAGED)atoms[el]=state.elements[el]-before[el];return {captured,rate,kept,lost,atoms,found,completedNow,committedInsights};
    },
    visit(region){if(blocked||!Object.hasOwn(REGIONS,region))return false;const first=!state.progress.regions.includes(region);if(first)state.progress.regions.push(region);state.progress.checkpoint=region;if(region==='frontier')state.progress.frontier=true;if(region!=='veil')state.progress.cleared=true;return first;},
    signal(region,roll,choice,{excludeIds=[]}={}){if(blocked||!Object.hasOwn(REGIONS,region)||![roll,choice].every(n=>Number.isFinite(n)&&n>=0&&n<1))return null;const p=state.progress,last=p.signalLast[region];if(last!==undefined&&p.totalCollected-last<45)return {repeat:true};const excluded=excludeIds instanceof Set?excludeIds:new Set(Array.isArray(excludeIds)?excludeIds:[]),candidates=[...records.values()].filter(rec=>signalCandidateEligible(rec,{region,recipes:state.recipes,hints:state.hints,excludeIds:excluded,canUseElement:el=>MANAGED.includes(el)&&api.canUseElement(el)}));if(candidates.length&&(roll<GROWTH.signalChance||p.signalMisses+1>=GROWTH.signalPity)){const rec=candidates[Math.floor(choice*candidates.length)];p.signalMisses=0;p.signalLast[region]=p.totalCollected;save();return {recipe:rec.id};}if(candidates.length)p.signalMisses++;const bonus=region==='veil'?{H:10}:region==='carbon'?{H:8,C:4}:{H:8,O:4},persistentHints=[...state.hints];api.collect(bonus,0);state.hints.length=0;state.hints.push(...persistentHints);p.signalLast[region]=p.totalCollected;save();return {bonus};},
    workspaceAdapter:{getItem(key){if(key!==WORKSPACE_STORAGE_KEY)return storage?.getItem(key)??null;return state.workspace?JSON.stringify(state.workspace):null;},setItem(key,raw){if(key!==WORKSPACE_STORAGE_KEY)throw Error();if(blocked)throw Error();state.workspace=validateWorkspace(JSON.parse(raw));if(!save())throw Error();}},
  };if(!storage)report('端末保存を利用できません。この画面の間だけ資源を保持します。');return api;
}
