import { OXYGEN_UPGRADES,nextOxygenUpgrade } from './tank-upgrades.js';
import { EXPEDITION } from './config.js';
import { expeditionElements,expeditionLoss } from './expedition-loss.js';
export { expeditionLoss } from './expedition-loss.js';
import { CHALLENGE_INSIGHT_IDS } from './expedition-challenges.js';
import { CRITICAL_INSIGHT_IDS,fieldInsightOpportunityEligibility } from './insights.js';
import { NITROGEN_MOLECULE_ID,NITROGEN_REGION_AVAILABLE,nitrogenChapterState,nitrogenCriticalInsightCandidate,nitrogenElementAccessible,nitrogenFrontierObjective } from './nitrogen-progression.js';
import { NITROGEN_REGION_ID } from './nitrogen-config.js';
import { GROWTH,MOLECULE_USES,DRIVES,REGIONS,REGION_ORDER,TANK_USES,isExpeditionRegionDestination,tankCapacity,tankUsesFor } from './growth.js';
import { combustionChargeFor,performanceFor } from './molecule-roles.js';
import { createSeededFrontierRng,getFrontierCandidates,loadMoleculeGraph,scoreFrontierCandidates,selectFrontierCandidate } from '../molecule-graph.js';
import { availableElements } from '../element-progression.js?v=37';
import { validateWorkspace } from '../workspace-save.js?v=31';
import { WORKSPACE_STORAGE_KEY,parseWorkspaceSave } from '../workspace-persistence.js?v=1';
import { hasInsightSitePool } from './signal-claimability.js';
import {INSIGHT_DESTINATION_BALANCE_UNIT,recordInsightDestination,scoreInsightDestinations} from './insight-destination.js';
import {commitWorldAwakening,markCoreFractured,worldAwakeningState} from './world-awakening.js';
import {HAZARD_TREATMENTS,hazardTreatmentPlan} from './hazard-treatments.js';
import { RESOURCE_KEY,MAX_RESOURCE_VALUE,MANAGED_ELEMENTS,DUST_ELEMENTS,STOCKED_ELEMENTS,createInitialProgress,createInitialTanks,createInitialSelectedLoadout,createInitialResourcesState,isResourceInteger,isValidResourceId,loadPersistedResources,serializeResourcesState,finishPendingResourcesReset } from './resources-persistence.js';
export { RESOURCE_KEY };
const COLLECTION_KEY='molecule-craft.collection.v1',MANAGED=MANAGED_ELEMENTS,DUST=DUST_ELEMENTS,STOCKED=STOCKED_ELEMENTS,MAX=MAX_RESOURCE_VALUE;
const PROGRESSION_ELEMENTS=Object.freeze(['H','C','N','O']),PROGRESSION_ELEMENT_SET=new Set(PROGRESSION_ELEMENTS),PLAYER_ACCESS_ELEMENTS=Object.freeze(['H','C','O']),PLAYER_ACCESS=new Set(PLAYER_ACCESS_ELEMENTS),RARE_STOCK_ACCESS=new Set(['P','S','F','Cl']);
export function progressionElementAccessible(progress,element){
  if(!STOCKED.includes(element)||!Array.isArray(progress?.foundElements)||!progress.foundElements.includes(element))return false;
  return PLAYER_ACCESS.has(element)||element==='N'&&nitrogenElementAccessible(progress);
}
export function playerElementAccessible(state,element){
  return progressionElementAccessible(state?.progress,element)||RARE_STOCK_ACCESS.has(element)&&(state?.elements?.[element]??0)>0;
}
export const RESET_CATEGORIES=Object.freeze(['collection','recipes','elements','tanks','exploration','records','workspace']);
export const CRITICAL_INSIGHT_STARTER_COUNTS=Object.freeze({hydrogen:80,methane:4,oxygen:8,water:8});
export const WATER_THERMAL_INTERRUPTION_REQUIREMENT=2;
export const criticalInsightStarterCount=id=>CRITICAL_INSIGHT_STARTER_COUNTS[id]??0;
const initialProgress=createInitialProgress,initialTanks=createInitialTanks,initialSelectedLoadout=createInitialSelectedLoadout,initialState=createInitialResourcesState;
const copy=x=>JSON.parse(JSON.stringify(x)),integer=isResourceInteger,validId=isValidResourceId;
const SIGNAL_ELEMENTS=Object.freeze(['H','C','O']),CRITICAL_SIGNAL_IDS=new Set(CRITICAL_INSIGHT_IDS),CHALLENGE_SIGNAL_IDS=new Set(CHALLENGE_INSIGHT_IDS),FRONTIER_RESERVED_IDS=Object.freeze([...new Set([...CRITICAL_INSIGHT_IDS,...CHALLENGE_INSIGHT_IDS])]),UPGRADE_UTILITY_IDS=new Set(OXYGEN_UPGRADES.flatMap(upgrade=>upgrade.requires));
export const regionRank=region=>REGION_ORDER.indexOf(region);
export function minimumSignalRegionFor(record){
  if(!record||!validId(record.id)||!Array.isArray(record.atoms)||!record.atoms.length||record.atoms.some(el=>!SIGNAL_ELEMENTS.includes(el)))return null;
  if(record.atoms.includes('O'))return 'oxygen';
  if(record.atoms.includes('C'))return 'carbon';
  return record.atoms.every(el=>el==='H')?'veil':null;
}
export function insightRecipeElementEligible(record,{canUseElement=()=>false}={}){
  return !!record&&Array.isArray(record.atoms)&&record.atoms.length>0&&record.atoms.every(canUseElement);
}
export function signalCandidateEligible(record,{region,recipes=[],hints=[],excludeIds=new Set(),canUseElement=()=>false}={}){
  const minimum=minimumSignalRegionFor(record),currentRank=regionRank(region),minimumRank=regionRank(minimum);
  return minimum!==null&&currentRank>=minimumRank&&!CRITICAL_SIGNAL_IDS.has(record.id)&&!CHALLENGE_SIGNAL_IDS.has(record.id)&&!recipes.includes(record.id)&&!hints.includes(record.id)&&!excludeIds.has(record.id)&&record.atoms.length<=12&&insightRecipeElementEligible(record,{canUseElement});
}
export function createResources({storage,onStatus=()=>{}}={}){
  if(storage===undefined)try{storage=window.localStorage;}catch{storage=null;}
  let state=initialState(),previous=null,blocked=false,message='',frontierGraph=null,frontierRun=null,lastFrontierRun=null,lastSeedSelection=null;const records=new Map(Object.entries(MOLECULE_USES).map(([id,d])=>[id,{id,...d}])),report=x=>{message=x;onStatus(x);};
  let api=null;
  const usesFor=id=>tankUsesFor(id),fitsTank=(id,use)=>usesFor(id).includes(use)&&Object.hasOwn(TANK_USES,use);
  try{const loaded=loadPersistedResources(storage);previous=loaded.previous;if(loaded.state)state=loaded.state;else{const legacy=storage?.getItem(WORKSPACE_STORAGE_KEY);if(legacy)state.workspace=parseWorkspaceSave(legacy);if(legacy||storage?.getItem(COLLECTION_KEY))state.migrateDiscoveries=true;for(const a of state.workspace?.atoms??[])if(MANAGED.includes(a.element)&&!state.progress.foundElements.includes(a.element))state.progress.foundElements.push(a.element);}}catch{blocked=true;report('資源または制作の保存を復元できません。元の保存を保護しています。');}
  if(state.migrateDiscoveries&&!blocked)try{const b=JSON.parse(storage?.getItem(COLLECTION_KEY)||'null'),e=b?.discoveredMolecules??b?.discoveredMoleculeIds??[];if(e.some(x=>(typeof x==='string'?x:x.id)==='hydrogen')&&!state.recipes.includes('hydrogen'))state.recipes.push('hydrogen');}catch{}
  function save(){if(blocked)return false;if(!storage){report('端末保存を利用できません。この画面の間だけ資源を保持します。');return true;}try{if(storage.getItem(RESOURCE_KEY)!==previous){blocked=true;report('別の画面で資源が更新されました。上書きを止めています。再読み込みしてください。');return false;}const raw=serializeResourcesState(state);if(raw!==previous){storage.setItem(RESOURCE_KEY,raw);previous=raw;}report('');return true;}catch{report('資源を保存できません。この画面を閉じる前に保存設定を確認してください。');return false;}}
  const canAfford=cost=>!!cost&&Object.entries(cost).every(([s,n])=>STOCKED.includes(s)&&integer(n)&&(state.elements[s]??0)>=n);
  function spend(cost){if(blocked||!canAfford(cost))return false;for(const [s,n]of Object.entries(cost))state.elements[s]-=n;return true;}
  function refund(cost){if(blocked)return;for(const [s,n]of Object.entries(cost))if(STOCKED.includes(s)&&integer(n))state.elements[s]=Math.min(MAX,(state.elements[s]??0)+n);}
  const reveal=el=>{if(MANAGED.includes(el)&&!state.progress.foundElements.includes(el))state.progress.foundElements.push(el);};
  const recipeElementEligible=id=>insightRecipeElementEligible(records.get(id),{canUseElement:el=>progressionElementAccessible(state.progress,el)});
  function hint(id){if(blocked||!records.has(id)||state.hints.includes(id)||!recipeElementEligible(id))return false;state.hints.push(id);return true;}
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
  function selectLoadoutState(use,id){state.loadout={drive:state.loadout?.drive??'hydrogen',cooling:state.loadout?.cooling??true,tanks:selectedLoadout()};state.loadout.tanks[use]=id;}
  function setLoadoutTank(use,id){
    if(blocked||!Object.hasOwn(TANK_USES,use)||id!==null&&(!validId(id)||!state.recipes.includes(id)||!fitsTank(id,use)))return false;
    const before=copy(state);selectLoadoutState(use,id);
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
  function treatmentPlan(id){return hazardTreatmentPlan(state,id);}
  function applyHazardTreatment(id){
    const plan=treatmentPlan(id);if(blocked||!plan?.ready)return false;
    const before=copy(state);if(!spend(plan.cost)){state=before;return false;}state.treatments[id]=1;
    const result={committed:true,id,charge:1,cost:copy(plan.cost),recipeId:plan.recipeId,hazardType:plan.hazardType};
    if(save()||!storage)return result;state=before;return false;
  }
  function discover(id){if(blocked||!records.has(id)||state.recipes.includes(id))return false;state.recipes.push(id);hint(id);return true;}
  function discoverWithLoadout(id,use=null){
    if(use!==null&&(!Object.hasOwn(TANK_USES,use)||!fitsTank(id,use)))return false;
    const before=copy(state);if(!discover(id))return false;let assignedUse=null;
    if(use!==null&&selectedLoadout()[use]===null){selectLoadoutState(use,id);assignedUse=use;}
    const seedChanged=ensureInsightSeed().changed;
    if(save()||!storage){if(seedChanged)notifyInsightSeed();return {learned:true,assignedUse};}state=before;return false;
  }
  function recordThermalStrain(){if(blocked||state.progress.thermalStrainExperienced)return false;state.progress.thermalStrainExperienced=true;if(save()||!storage)return true;state.progress.thermalStrainExperienced=false;return false;}
  function recordDriveThermalInterruption(){
    if(blocked||state.recipes.includes('water'))return false;const before=state.progress.driveThermalInterruptions??0,after=Math.min(WATER_THERMAL_INTERRUPTION_REQUIREMENT,before+1);if(after===before)return false;state.progress.driveThermalInterruptions=after;if(save()||!storage)return true;state.progress.driveThermalInterruptions=before;return false;
  }
  function recordCoolantNeedExperience(){if(blocked||state.recipes.includes('water')||state.progress.coolantNeedExperienced)return false;state.progress.coolantNeedExperienced=true;if(save()||!storage)return true;state.progress.coolantNeedExperienced=false;return false;}

  function insightDestinationIds(){
    const ids=[...(state.progress.regions??[])].filter(id=>isExpeditionRegionDestination(id)&&hasInsightSitePool(id)&&(id!==NITROGEN_REGION_ID||state.progress.choCompleted===true));
    if(state.progress.choCompleted===true&&hasInsightSitePool(NITROGEN_REGION_ID)&&!ids.includes(NITROGEN_REGION_ID))ids.push(NITROGEN_REGION_ID);
    return [...new Set(ids)];
  }
  function seedSignature(){return `${state.recipes.slice().sort().join(',')}|${state.hints.slice().sort().join(',')}|${state.progress.runs??0}`;}
  function seedRng(){let h=2166136261;for(const char of seedSignature()){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return createSeededFrontierRng(h>>>0);}
  function currentInsightSeed(){
    const seed=state.progress.insightSeed,nitrogenLegacyDestination=seed?.hotDestination===NITROGEN_REGION_ID&&state.progress.choCompleted===true;if(!seed||!validId(seed.id)||typeof seed.hotDestination!=='string'||!hasInsightSitePool(seed.hotDestination)&&!nitrogenLegacyDestination)return null;
    if(state.recipes.includes(seed.id)||state.hints.includes(seed.id)||FRONTIER_RESERVED_IDS.includes(seed.id)||!records.has(seed.id))return null;
    return seed;
  }
  function clearInsightSeed(){const had=!!state.progress.insightSeed||state.progress.insightSeedBlocked===true;delete state.progress.insightSeed;delete state.progress.insightSeedBlocked;lastSeedSelection=null;return had;}
  function notifyInsightSeed(){if(typeof window==='undefined'||typeof window.dispatchEvent!=='function')return;try{window.dispatchEvent(new CustomEvent('molecule-craft:insight-seed',{detail:insightSeedDiagnostics()}));}catch{}}
  function setSeedBlocked(value){const next=value===true;if(state.progress.insightSeedBlocked===next)return false;state.progress.insightSeedBlocked=next;return true;}
  function candidateFeatures(candidate){
    const record=records.get(candidate.id),atomCount=record?.atoms?.length??0,parentCounts=(candidate.directDiscoveredNeighbors??[]).map(id=>records.get(id)?.atoms?.length).filter(Number.isFinite),delta=parentCounts.length?Math.min(...parentCounts.map(count=>Math.abs(atomCount-count))):atomCount;
    const atomScore=1/(1+Math.max(0,atomCount-2)*.12),deltaScore=1/(1+delta*.4),branchScore=1/(1+Math.max(0,(candidate.branchKeys?.length??0)-1)*.35),structuralSimplicity=.35*atomScore+.45*deltaScore+.2*branchScore;
    const gameplayUtility=usesFor(candidate.id).length?1:UPGRADE_UTILITY_IDS.has(candidate.id) ? .85 : 0,cost=costFor(candidate.id),craftableNow=!!cost&&affordableCost(cost,state.elements);
    return {...candidate,gameplayUtility,structuralSimplicity,craftableNow};
  }
  function seedCandidates(){
    if(!frontierGraph)return {graphCandidates:[],candidates:[],scored:[]};
    const discoveredIds=[...state.recipes],knownRecipeIds=[...new Set([...state.hints,...FRONTIER_RESERVED_IDS])],graphCandidates=getFrontierCandidates(frontierGraph,{discoveredIds,knownRecipeIds}),nitrogenPriorityId=nitrogenFrontierObjective(frontierGraph,state)?.id??null,candidates=graphCandidates.filter(candidate=>recipeElementEligible(candidate.id)).map(candidate=>candidateFeatures(candidate)),scored=scoreFrontierCandidates(frontierGraph,candidates,{discoveredIds});
    return {discoveredIds,graphCandidates,candidates,scored,nitrogenPriorityId};
  }
  function destinationScoring(){
    return scoreInsightDestinations({availableDestinations:insightDestinationIds(),history:state.progress.insightDestinationHistory,stocks:state.elements});
  }
  function ensureInsightSeed({rng=null}={}){
    const existing=currentInsightSeed();if(existing){const changed=setSeedBlocked(false);lastSeedSelection={reason:'maintained',seed:copy(existing)};return {seed:existing,changed,reason:'maintained'};}
    let changed=false;if(state.progress.insightSeed)changed=clearInsightSeed()||changed;
    if(!frontierGraph){lastSeedSelection={reason:'graph-unavailable',seed:null};return {seed:null,changed,reason:'graph-unavailable'};}
    if(api?.progressionInsightCandidates().length){changed=setSeedBlocked(true)||changed;lastSeedSelection={reason:'critical-pending',seed:null};return {seed:null,changed,reason:'critical-pending'};}
    const {graphCandidates,candidates,scored,nitrogenPriorityId}=seedCandidates();
    if(!candidates.length){changed=setSeedBlocked(false)||changed;const reason=graphCandidates.length?'element-locked':'no-candidate';lastSeedSelection={reason,seed:null};return {seed:null,changed,reason};}
    const selected=scored.find(candidate=>candidate.id===nitrogenPriorityId)??selectFrontierCandidate(scored,{rng:typeof rng==='function'?rng:seedRng()});if(!selected){lastSeedSelection={reason:'no-selection',seed:null};return {seed:null,changed,reason:'no-selection'};}
    const destination=destinationScoring(),hotDestination=destination.selectedDestination;if(!hotDestination){changed=setSeedBlocked(false)||changed;lastSeedSelection={reason:'no-destination',seed:null};return {seed:null,changed,reason:'no-destination'};}
    const seed={id:selected.id,hotDestination};state.progress.insightSeed=seed;state.progress.insightDestinationHistory=recordInsightDestination(state.progress.insightDestinationHistory,hotDestination);changed=true;changed=setSeedBlocked(false)||changed;lastSeedSelection={reason:'selected',seed:copy(seed),weight:selected.weight,weighting:copy(selected.weighting),destination:copy(destination)};return {seed,changed,reason:'selected'};
  }
  function insightSeedDiagnostics(){
    const seed=currentInsightSeed()??null,rows=seed?seedCandidates().scored:[],row=seed?rows.find(candidate=>candidate.id===seed.id):null;
    const destination=lastSeedSelection?.reason==='selected'&&lastSeedSelection.seed?.id===seed?.id?copy(lastSeedSelection.destination):destinationScoring();
    return {seedId:seed?.id??null,hotDestination:seed?.hotDestination??null,blocked:state.progress.insightSeedBlocked===true,selection:lastSeedSelection?copy(lastSeedSelection):null,weight:row?.weight??lastSeedSelection?.weight??null,weighting:row?.weighting?copy(row.weighting):lastSeedSelection?.weighting?copy(lastSeedSelection.weighting):null,destinationHistory:[...(state.progress.insightDestinationHistory??[])],availableDestinations:destination.availableDestinations,rawStock:{...destination.rawStock},balanceUnits:{...INSIGHT_DESTINATION_BALANCE_UNIT},normalizedStock:{...destination.normalizedStock},medianCoverage:destination.medianCoverage,destinationScores:destination.destinations.map(item=>({...item,selected:item.destination===seed?.hotDestination})),selectedDestination:seed?.hotDestination??null};
  }
  function beginFrontierRun(region=state.progress.checkpoint,rng=Math.random){
    const launchRegion=Object.hasOwn(REGIONS,region)?region:'veil',base={selectedCandidateId:null,seedId:null,hotDestination:null,activeForRun:false,launchRegion,weightingRegion:null,signalObserved:false,opportunityCreated:false,acquired:false,acquiredTime:null,carried:false,committed:false,lost:false,seedMaintained:false,seedAdvanced:false,reason:null};frontierRun=base;lastFrontierRun=null;
    if(launchRegion===NITROGEN_REGION_ID&&nitrogenChapterState(state).stage==='nitrogen-critical'){base.reason='critical-pending';return;}
    if(api.progressionInsightCandidates().length){setSeedBlocked(true);base.reason='critical-pending';return;}
    const ensured=ensureInsightSeed({rng}),seed=ensured.seed;
    if(!seed){base.reason=ensured.reason;return;}
    base.selectedCandidateId=seed.id;base.seedId=seed.id;base.hotDestination=seed.hotDestination;base.activeForRun=launchRegion===seed.hotDestination;base.weightingRegion=null;
  }
  function suppressFrontierInsightForCritical(){
    if(!frontierRun||frontierRun.reason||frontierRun.opportunityCreated)return false;
    frontierRun.reason='critical-pending';setSeedBlocked(true);return true;
  }
  function frontierInsightEligibility(runContext={}){
    if(!frontierRun)return {managed:false,pending:false,ready:true,signalObserved:false};
    const id=frontierRun.selectedCandidateId,pending=!!id&&!frontierRun.reason&&!frontierRun.opportunityCreated;
    if(!pending)return {managed:true,pending:false,ready:true,signalObserved:!!frontierRun.signalObserved};
    if(runContext?.frontierInsightSiteManaged===true)return {managed:true,pending:true,signalObserved:!!frontierRun.signalObserved,ready:frontierRun.activeForRun&&runContext.frontierInsightSiteReady===true,siteManaged:true};
    return {managed:true,pending:true,signalObserved:!!frontierRun.signalObserved,...fieldInsightOpportunityEligibility(runContext,records.get(id))};
  }
  function createFrontierOpportunity(runContext={}){
    if(!frontierRun?.selectedCandidateId||frontierRun.reason||frontierRun.opportunityCreated)return null;
    frontierRun.opportunityCreated=true;frontierRun.acquired=true;frontierRun.acquiredTime=Number.isFinite(runContext?.time)?runContext.time:null;return {managed:true,recipe:frontierRun.selectedCandidateId,frontier:true};
  }
  function frontierSignal(region,roll,choice,runContext={}){
    if(!frontierRun)return null;
    if(frontierRun.reason||frontierRun.opportunityCreated)return {managed:true};
    const siteManaged=runContext?.frontierInsightSiteManaged===true;
    if(!frontierRun.activeForRun||siteManaged&&(roll!==runContext.frontierInsightActiveRoll||choice!==runContext.frontierInsightActiveChoice)||!siteManaged&&region!==frontierRun.launchRegion)return {managed:true};
    frontierRun.signalObserved=true;const gate=frontierInsightEligibility(runContext);
    if(!gate.ready)return {managed:true,deferred:true,frontier:true};
    return createFrontierOpportunity(runContext);
  }
  function pollFrontierInsight(runContext={}){
    if(runContext?.frontierInsightSiteManaged===true)return null;
    if(!frontierRun?.signalObserved||frontierRun.reason||frontierRun.opportunityCreated)return null;
    if(!frontierInsightEligibility(runContext).ready)return null;
    const opportunity=createFrontierOpportunity(runContext);
    if(opportunity){const p=state.progress;p.signalMisses=0;p.signalLast[frontierRun.launchRegion]=p.totalCollected;save();}
    return opportunity;
  }
  function normalizedExcludeIds(excludeIds){return excludeIds instanceof Set?excludeIds:new Set(Array.isArray(excludeIds)?excludeIds:[]);}
  function runInsightOccupied(runContext={}){return !!runContext?.analysis||Array.isArray(runContext?.carriedInsights)&&runContext.carriedInsights.length>0;}
  function fallbackSignalCandidates(region,excludeIds){return [...records.values()].filter(rec=>signalCandidateEligible(rec,{region,recipes:state.recipes,hints:state.hints,excludeIds,canUseElement:el=>PROGRESSION_ELEMENT_SET.has(el)&&api.canUseElement(el)}));}
  function frontierSignalClaimability(region,roll,choice,runContext={}){
    if(!frontierRun)return null;
    const id=frontierRun.selectedCandidateId,meta={managed:true,claimable:false,recipe:null,frontier:true,seedId:frontierRun.seedId,hotDestination:frontierRun.hotDestination,activeForRun:frontierRun.activeForRun};
    if(frontierRun.reason||frontierRun.opportunityCreated||!id||!frontierRun.activeForRun)return meta;
    if(!recipeElementEligible(id))return {...meta,reason:'element-locked'};
    if(runContext?.frontierInsightSiteManaged===true){const active=runContext.frontierInsightSiteReady===true&&roll===runContext.frontierInsightActiveRoll&&choice===runContext.frontierInsightActiveChoice;return {...meta,claimable:active,recipe:active?id:null,siteManaged:true};}
    if(region!==frontierRun.launchRegion)return meta;
    const gate=frontierInsightEligibility(runContext);return {...meta,claimable:gate.ready===true,recipe:gate.ready?id:null};
  }
  function signalClaimability(region,roll,choice,{excludeIds=[],runContext={}}={}){
    if(blocked||!Object.hasOwn(REGIONS,region)||![roll,choice].every(n=>Number.isFinite(n)&&n>=0&&n<1)||runInsightOccupied(runContext))return {claimable:false,recipe:null};
    const gate=fieldInsightOpportunityEligibility(runContext),nitrogen=nitrogenCriticalInsightCandidate(state,{fieldContext:region===NITROGEN_REGION_ID,nitrogenEngaged:gate.ready,collectedElements:runContext?.collectedElements??{}});
    if(nitrogen)return {claimable:true,recipe:nitrogen,critical:true};
    if(region===NITROGEN_REGION_ID&&nitrogenChapterState(state).stage==='nitrogen-critical')return {claimable:false,recipe:null,critical:true};
    const frontier=frontierSignalClaimability(region,roll,choice,runContext);if(frontier?.managed)return frontier;
    const p=state.progress,last=p.signalLast[region];if(last!==undefined&&p.totalCollected-last<45)return {claimable:false,recipe:null,repeat:true};
    if(!gate.ready)return {claimable:false,recipe:null};
    const excluded=normalizedExcludeIds(excludeIds),candidates=fallbackSignalCandidates(region,excluded),hit=candidates.length&&(roll<GROWTH.signalChance||p.signalMisses+1>=GROWTH.signalPity),record=hit?candidates[Math.floor(choice*candidates.length)]:null;
    return record?{claimable:true,recipe:record.id}:{claimable:false,recipe:null};
  }
  function insightRecipeEligible(id,{runContext={}}={}){
    if(id===NITROGEN_MOLECULE_ID){const gate=fieldInsightOpportunityEligibility(runContext);return nitrogenCriticalInsightCandidate(state,{fieldContext:runContext?.region===NITROGEN_REGION_ID,nitrogenEngaged:gate.ready,collectedElements:runContext?.collectedElements??{}})===id;}
    return recipeElementEligible(id);
  }
  function finalizeFrontierRun(captured,insights,committedInsights,{seedBefore=null,seedAfter=null}={}){
    if(!frontierRun)return null;const id=frontierRun.selectedCandidateId;frontierRun.carried=!!id&&insights.includes(id);frontierRun.committed=!!id&&committedInsights.includes(id);frontierRun.lost=!!captured&&frontierRun.acquired;
    frontierRun.seedMaintained=!!seedBefore&&seedBefore===seedAfter&&!frontierRun.committed;frontierRun.seedAdvanced=!!frontierRun.committed&&seedBefore!==seedAfter;
    if(frontierRun.committed)frontierRun.reason='committed';else if(frontierRun.lost)frontierRun.reason='lost';else if(frontierRun.acquired&&!frontierRun.carried)frontierRun.reason='analysis-incomplete';else if(frontierRun.carried)frontierRun.reason='not-committed';else if(!frontierRun.reason)frontierRun.reason='not-acquired';
    lastFrontierRun=copy(frontierRun);frontierRun=null;return copy(lastFrontierRun);
  }
  function signalBonus(region,p){const bonus=region==='veil'?{H:10}:region==='carbon'?{H:8,C:4}:region===NITROGEN_REGION_ID?{H:2,N:4}:{H:8,O:4},persistentHints=[...state.hints];api.collect(bonus,0);state.hints.length=0;state.hints.push(...persistentHints);p.signalLast[region]=p.totalCollected;save();return {bonus};}
  api={
    get state(){return state;},get blocked(){return blocked;},get message(){return message;},save,snapshot:()=>copy(state),spend,refund,canAfford,costFor,maxCraftable,tankStatus,tankFillPlan,fillTankFromElements,selectedLoadout,setLoadoutTank,launchFillPlan,commitLaunchFill,oxygenUpgradePlan,upgradeOxygenTank,treatmentPlan,applyHazardTreatment,recordThermalStrain,recordDriveThermalInterruption,recordCoolantNeedExperience,worldAwakeningState:()=>worldAwakeningState(state.progress),recordCoreFracture(){if(blocked)return null;const snapshot=copy(state);markCoreFractured(state.progress);if(save()||!storage)return worldAwakeningState(state.progress);state=snapshot;return null;},
    canUseElement:el=>playerElementAccessible(state,el),insightRecipeEligible,signalClaimability,record:id=>records.get(id),catalog:()=>[...records.values()],tankCatalog:use=>[...records.values()].filter(record=>state.recipes.includes(record.id)&&fitsTank(record.id,use)),tankUses:id=>usesFor(id),
    setCatalog(catalog){
      for(const rec of catalog)if(validId(rec.id)&&Array.isArray(rec.atoms))records.set(rec.id,rec);
      const accessibleHints=state.hints.filter(id=>state.recipes.includes(id)||recipeElementEligible(id));let dirty=accessibleHints.length!==state.hints.length;if(dirty)state.hints=accessibleHints;
      if(state.migrateDiscoveries&&!blocked){try{const b=JSON.parse(storage?.getItem(COLLECTION_KEY)||'null');for(const x of b?.discoveredMolecules??b?.discoveredMoleculeIds??[]){const id=typeof x==='string'?x:x.id,rec=records.get(id);if(!rec)continue;discover(id);for(const el of rec.atoms)reveal(el);}}catch{}delete state.migrateDiscoveries;legacyGuaranteed();dirty=true;}
      if(frontierGraph){const seeded=ensureInsightSeed();dirty=seeded.changed||dirty;}if(dirty&&save())notifyInsightSeed();
    },
    setFrontierGraph(graph){frontierGraph=graph??null;if(!frontierGraph)return false;const seeded=ensureInsightSeed();if(seeded.changed&&save())notifyInsightSeed();return true;},
    captureExpeditionRunState:()=>({frontierRun:copy(frontierRun),lastFrontierRun:copy(lastFrontierRun),lastSeedSelection:copy(lastSeedSelection)}),
    restoreExpeditionRunState(snapshot){if(!snapshot||typeof snapshot!=='object')return false;frontierRun=copy(snapshot.frontierRun??null);lastFrontierRun=copy(snapshot.lastFrontierRun??null);lastSeedSelection=copy(snapshot.lastSeedSelection??null);return true;},
    suppressFrontierInsightForCritical,frontierInsightEligibility,pollFrontierInsight,insightSeedDiagnostics,frontierInsightDiagnostics:()=>copy(frontierRun??lastFrontierRun??{selectedCandidateId:null,seedId:currentInsightSeed()?.id??null,hotDestination:currentInsightSeed()?.hotDestination??null,launchRegion:null,weightingRegion:null,signalObserved:false,opportunityCreated:false,acquired:false,carried:false,committed:false,lost:false,seedMaintained:false,seedAdvanced:false,reason:'no-run'}),
    reset(categories){
      const selected=new Set(categories),full=RESET_CATEGORIES.every(k=>selected.has(k));if(!selected.size||[...selected].some(k=>!RESET_CATEGORIES.includes(k))||blocked&&!full)return {committed:false};let next;
      try{if(!storage||storage.getItem(RESOURCE_KEY)!==previous)throw Error();next=full?initialState():copy(state);next.progress.sound=state.progress.sound;const clear=full||['workspace','elements','collection','recipes'].some(k=>selected.has(k));if(clear){if(!full&&!selected.has('elements'))for(const a of next.workspace?.atoms??[])if(STOCKED.includes(a.element))next.elements[a.element]=Math.min(MAX,(next.elements[a.element]??0)+1);next.workspace=null;}if(selected.has('recipes')){next.recipes=[];next.hints=[];next.loadout={drive:'hydrogen',cooling:true,tanks:initialSelectedLoadout()};delete next.migrateDiscoveries;delete next.progress.insightSeed;delete next.progress.insightSeedBlocked;next.progress.insightDestinationHistory=[];}if(full||selected.has('tanks')){next.tanks=initialTanks();next.upgrades={oxygenTank:0};}if(selected.has('elements')){for(const symbol of Object.keys(next.elements))next.elements[symbol]=0;next.dust={H:0,C:0,O:0};delete next.progress.insightSeed;delete next.progress.insightSeedBlocked;next.progress.insightDestinationHistory=[];}if(selected.has('exploration')){const {bestChain,sound}=next.progress;next.progress={...initialProgress(),bestChain,sound};for(const el of MANAGED)if(next.elements[el]>0||next.workspace?.atoms.some(a=>a.element===el))next.progress.foundElements.push(el);next.progress.foundElements=[...new Set(next.progress.foundElements)];}if(selected.has('records'))next.progress.bestChain=0;next.resetEpoch=(state.resetEpoch??0)+1;next.pendingReset={collection:selected.has('collection'),legacy:clear,help:full};const raw=serializeResourcesState(next);storage.setItem(RESOURCE_KEY,raw);previous=raw;state=next;}catch{report('初期化できませんでした。保存は変更していません。再読み込みして確認してください。');return {committed:false};}blocked=true;try{finishPendingResourcesReset(storage,state);previous=storage.getItem(RESOURCE_KEY);report('初期化しました。再読み込みします。');return {committed:true,complete:true};}catch{report('初期化を記録しました。再読み込み時に残りを安全に完了します。');return {committed:true,complete:false};}
    },
    hint,learn:discover,discover,discoverWithLoadout,
    consumeTank(use,id,amount){const tank=state.tanks[use];if(blocked||!state.recipes.includes(id)||!fitsTank(id,use)||!integer(amount)||amount<1||tank?.molecule!==id||tank.amount<amount)return false;const snapshot=copy(state);tank.amount-=amount;if(save()||!storage)return true;state=snapshot;return false;},
    consumeBoost:()=>{const tank=state.tanks.propellant,performance=performanceFor(tank.molecule,'propellant');return !!performance&&api.consumeTank('propellant',tank.molecule,performance.moleculesPerBurst);},
    consumeCombustion(requested=null){const fuel=state.tanks.fuel,oxidizer=state.tanks.oxidizer,charge=oxidizer.molecule==='oxygen'?combustionChargeFor(fuel.molecule,{fuelAmount:fuel.amount,oxygenAmount:oxidizer.amount,baseSeconds:DRIVES.combustion.packetSeconds}):null,matches=!requested||!!charge&&requested.fuel===charge.fuel&&requested.fuelAmount===charge.fuelAmount&&requested.oxidizer===charge.oxidizer&&requested.oxygenAmount===charge.oxygenAmount;if(blocked||!state.recipes.includes(fuel.molecule)||!state.recipes.includes(oxidizer.molecule)||!charge||!matches)return false;const snapshot=copy(state);fuel.amount-=charge.fuelAmount;oxidizer.amount-=charge.oxygenAmount;if(save()||!storage)return true;state=snapshot;return false;},
    consumeDrive:id=>id==='hydrogen'?api.consumeBoost():id==='combustion'?api.consumeCombustion():false,
    prepareExpedition({region=state.progress.checkpoint,rng=Math.random}={}){beginFrontierRun(region,rng);const entry=use=>{const tank=state.tanks[use],supported=tank?.molecule&&state.recipes.includes(tank.molecule)&&fitsTank(tank.molecule,use);return {molecule:supported?tank.molecule:null,amount:supported?tank.amount:0,...(supported&&use==='oxidizer'&&state.upgrades.oxygenTank>0?{capacity:tankCapacity(use,tank.molecule,state.upgrades)}:{})};};return {propellant:entry('propellant'),fuel:entry('fuel'),oxidizer:entry('oxidizer'),coolant:entry('coolant'),shock:entry('shock')};},
    progressionInsightCandidates({cargo={},foundElements=[],nitrogenRegionAvailable=NITROGEN_REGION_AVAILABLE,nitrogenFieldContext=false,nitrogenEngaged=false}={}){if(blocked)return [];const found=new Set([...state.progress.foundElements,...foundElements]),available=progressionAvailableElements(cargo),eligible=[];if(criticalStarterReady('hydrogen',available))eligible.push('hydrogen');if(state.recipes.includes('hydrogen')&&found.has('C')&&criticalStarterReady('methane',available))eligible.push('methane');if(state.recipes.includes('methane')&&found.has('O')&&criticalStarterReady('oxygen',available))eligible.push('oxygen');if(state.recipes.includes('methane')&&state.recipes.includes('oxygen')&&state.progress.coolantNeedExperienced===true&&criticalStarterReady('water',available))eligible.push('water');const nitrogen=nitrogenCriticalInsightCandidate(state,{regionAvailable:nitrogenRegionAvailable,fieldContext:nitrogenFieldContext,nitrogenEngaged,collectedElements:cargo});if(nitrogen)eligible.push(nitrogen);return eligible.filter(id=>records.has(id)&&!state.recipes.includes(id)&&!state.hints.includes(id));},
    findElementForExpedition(el){if(blocked||!MANAGED.includes(el))return false;const first=!state.progress.foundElements.includes(el);reveal(el);return first;},
    findElement(el){if(blocked||!MANAGED.includes(el))return false;const first=!state.progress.foundElements.includes(el);reveal(el);return first;},
    collect(amount,best=0){if(blocked)return [];const amounts=typeof amount==='number'?{H:amount}:amount;if(!amounts||!Object.entries(amounts).every(([el,n])=>MANAGED.includes(el)&&integer(n)))return [];const before=new Set(state.progress.foundElements);refund(amounts);for(const [el,n]of Object.entries(amounts))if(n>0){reveal(el);state.progress.totalCollected=Math.min(MAX,state.progress.totalCollected+n);}if(integer(best))state.progress.bestChain=Math.max(state.progress.bestChain,best);return state.progress.foundElements.filter(el=>!before.has(el));},
    collectDust(units,best){if(blocked||!Object.entries(units).every(([el,n])=>DUST.includes(el)&&integer(n)))return [];const amounts={};for(const [el,n]of Object.entries(units)){const total=state.dust[el]+n;amounts[el]=Math.floor(total/GROWTH.dustPerAtom[el]);state.dust[el]=total%GROWTH.dustPerAtom[el];}return api.collect(amounts,best);},
    settleExpedition(units,best=0,captured=false,{destinationReached=false,insights=[]}={}){
      if(blocked||typeof destinationReached!=='boolean'||typeof captured!=='boolean'||!integer(best)||!units||!Object.entries(units).every(([el,n])=>MANAGED.includes(el)&&integer(n))||!Array.isArray(insights)||insights.some(id=>!validId(id)))return null;
      const snapshot=copy(state),kept={},before={...state.elements},rate=captured?EXPEDITION.captureLoss:0,lost=expeditionLoss(units,rate),elements=expeditionElements(units),seedBefore=currentInsightSeed()?.id??null;
      for(const el of elements)kept[el]=(units[el]??0)-lost[el];
      const completedNow=destinationReached&&!captured&&!state.progress.choCompleted;
      if(completedNow)state.progress.choCompleted=true;
      const worldAwakenedNow=commitWorldAwakening(state.progress,{captured});
      const persistentHints=[...state.hints],dustKept=Object.fromEntries(Object.entries(kept).filter(([el])=>DUST.includes(el))),directKept=Object.fromEntries(Object.entries(kept).filter(([el])=>!DUST.includes(el))),found=api.collectDust(dustKept,best);for(const el of api.collect(directKept,0))if(!found.includes(el))found.push(el);state.hints.length=0;state.hints.push(...persistentHints);
      const committedInsights=[];if(!captured)for(const id of insights)if(!state.recipes.includes(id)&&hint(id))committedInsights.push(id);
      let seedChanged=false;if(seedBefore&&committedInsights.includes(seedBefore)){seedChanged=clearInsightSeed()||seedChanged;seedChanged=ensureInsightSeed().changed||seedChanged;}else if(seedBefore)seedChanged=setSeedBlocked(api.progressionInsightCandidates().length>0)||seedChanged;
      const seedAfter=currentInsightSeed()?.id??null;
      if(!save()){state=snapshot;return null;}if(seedChanged)notifyInsightSeed();
      const frontierInsight=finalizeFrontierRun(captured,insights,committedInsights,{seedBefore,seedAfter}),atoms={};for(const el of elements)atoms[el]=state.elements[el]-before[el];return {captured,rate,kept,lost,atoms,found,completedNow,worldAwakenedNow,world:worldAwakeningState(state.progress),committedInsights,frontierInsight};
    },
    visit(region){if(blocked||!Object.hasOwn(REGIONS,region))return false;const first=!state.progress.regions.includes(region);if(first)state.progress.regions.push(region);if(isExpeditionRegionDestination(region))state.progress.checkpoint=region;if(region==='frontier')state.progress.frontier=true;if(region!=='veil')state.progress.cleared=true;return first;},
    signal(region,roll,choice,{excludeIds=[],runContext={},claimableOnly=false}={}){if(blocked||!Object.hasOwn(REGIONS,region)||![roll,choice].every(n=>Number.isFinite(n)&&n>=0&&n<1))return null;if(claimableOnly&&!signalClaimability(region,roll,choice,{excludeIds,runContext}).claimable)return {deferred:true,claimable:false};const gate=fieldInsightOpportunityEligibility(runContext),nitrogen=nitrogenCriticalInsightCandidate(state,{fieldContext:region===NITROGEN_REGION_ID,nitrogenEngaged:gate.ready,collectedElements:runContext?.collectedElements??{}});if(nitrogen)return {recipe:nitrogen,critical:true};if(region===NITROGEN_REGION_ID&&nitrogenChapterState(state).stage==='nitrogen-critical')return {deferred:true,critical:true};const frontier=frontierSignal(region,roll,choice,runContext);if(frontier?.managed){if(frontier.recipe){const p=state.progress;p.signalMisses=0;p.signalLast[region]=p.totalCollected;save();return {recipe:frontier.recipe,frontier:true};}if(frontier.deferred)return {deferred:true,frontier:true};if(runContext?.frontierInsightSiteManaged===true)return {deferred:true,frontier:true};const p=state.progress;return signalBonus(region,p);}const p=state.progress,last=p.signalLast[region];if(last!==undefined&&p.totalCollected-last<45)return {repeat:true};const excluded=normalizedExcludeIds(excludeIds),candidates=fallbackSignalCandidates(region,excluded);if(candidates.length&&(roll<GROWTH.signalChance||p.signalMisses+1>=GROWTH.signalPity)){const rec=candidates[Math.floor(choice*candidates.length)];p.signalMisses=0;p.signalLast[region]=p.totalCollected;save();return {recipe:rec.id};}if(candidates.length)p.signalMisses++;return signalBonus(region,p);},
    workspaceAdapter:{getItem(key){if(key!==WORKSPACE_STORAGE_KEY)return storage?.getItem(key)??null;return state.workspace?JSON.stringify(state.workspace):null;},setItem(key,raw){if(key!==WORKSPACE_STORAGE_KEY)throw Error();if(blocked)throw Error();state.workspace=validateWorkspace(JSON.parse(raw));if(!save())throw Error();}},
  };
  if(typeof window!=='undefined')void loadMoleculeGraph().then(graph=>{frontierGraph=graph;const seeded=ensureInsightSeed();if(seeded.changed&&save())notifyInsightSeed();}).catch(()=>{});
  if(!storage)report('端末保存を利用できません。この画面の間だけ資源を保持します。');return api;
}
