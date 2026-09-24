import {createVeilUI} from './veil/ui.js?v=5';
import {createProgressResetUI} from './veil/reset-ui.js';
import {createCompletionSideEffectGate} from './completion-side-effects.js?v=1';
import {installPendingCraftAccess} from './pending-craft.js?v=1';
import {loadMoleculeDatabase,moleculeCatalog} from './chemistry.js?v=20';
import {loadMoleculeGraph} from './molecule-graph.js';
import {CRITICAL_INSIGHT_IDS} from './veil/insights.js';
import {primaryRoleFor} from './veil/molecule-roles.js';
import {installTankCapabilityPresentation} from './veil/capability-unlock.js?v=1';
import {presentFirstRegistration,REGISTRATION_REVEAL_HOLD_MS} from './collection-registration-reveal.js?v=1';
import {loadPolymerCatalog,polymerCatalog} from './polymer-catalog.js?v=1';
import {createPolymerEncyclopediaModel} from './polymer-encyclopedia.js?v=1';

function normalizeExplorationMode(){
  const veil=document.querySelector('#veil-view'),appShell=document.querySelector('.app-shell');
  if(veil)veil.hidden=true;
  if(appShell)appShell.inert=false;
  if(document.body?.dataset)document.body.dataset.mode='craft';
}

const addCost=(target,cost)=>{for(const [el,n] of Object.entries(cost??{}))target[el]=(target[el]??0)+n;return target;};
const canAppendCost=(current,extra,available)=>Object.entries(extra??{}).every(([el,n])=>(current[el]??0)+n<=(available[el]??0));
const CRITICAL_DISCOVERY_IDS=new Set(CRITICAL_INSIGHT_IDS);
let connectedResources=null;
export function criticalPrimaryLoadoutUse(id){return CRITICAL_DISCOVERY_IDS.has(id)?primaryRoleFor(id):null;}
function launchAvailableElements(resources,{includeWorkspace=true}={}){
  const available={...resources.state.elements};
  if(includeWorkspace)for(const atom of resources.state.workspace?.atoms??[])if(Object.hasOwn(available,atom.element))available[atom.element]=(available[atom.element]??0)+1;
  return available;
}

export function rebalanceLaunchFillPlan(resources,plan,{includeWorkspace=true}={}){
  if(!plan||plan.status==='FULL'||plan.invalid?.length||!plan.partial?.entries)return plan;
  const available=launchAvailableElements(resources,{includeWorkspace}),entries=plan.partial.entries.map(entry=>({...entry,cost:{...(entry.cost??{})}})),cost={...(plan.partial.cost??{})};
  while(true){
    let best=null;
    for(let index=0;index<entries.length;index++){
      const entry=entries[index];if(!entry.molecule||entry.invalid||entry.target>=entry.capacity)continue;
      const unit=resources.costFor(entry.molecule,1);if(!unit||!canAppendCost(cost,unit,available))continue;
      const ratio=entry.capacity?entry.target/entry.capacity:1;if(!best||ratio<best.ratio-1e-12)best={index,unit,ratio};
    }
    if(!best)break;
    const entry=entries[best.index];entry.target++;entry.add++;addCost(entry.cost,best.unit);addCost(cost,best.unit);
  }
  const partial={...plan.partial,entries,cost},selectedCount=entries.filter(entry=>entry.molecule).length,usable=selectedCount===0||entries.some(entry=>entry.molecule&&entry.target>0);
  return {...plan,status:usable?'PARTIAL':'IMPOSSIBLE',partial};
}

export function normalizeLaunchFillPlan(plan){
  if(plan?.status==='IMPOSSIBLE'&&!(plan.invalid?.length))return {...plan,status:'PARTIAL',emptyDeparture:true};
  return plan;
}

export function installEmptyDeparturePolicy(resources){
  const basePlan=resources.launchFillPlan.bind(resources);
  resources.launchFillPlan=options=>normalizeLaunchFillPlan(rebalanceLaunchFillPlan(resources,basePlan(options),options));
}

export async function prepareExplorationCatalog(resources){
  const [result,frontierGraph]=await Promise.all([loadMoleculeDatabase(),loadMoleculeGraph().catch(()=>null)]);
  if(!result.ok)return result;
  resources.setCatalog(moleculeCatalog());
  resources.setFrontierGraph(frontierGraph);
  return result;
}

function createReadyExploration({resources,canLeave,canSupply,onBeforeLaunch,onCraft,onCommit,reset}){
  installEmptyDeparturePolicy(resources);
  const pendingCraft=installPendingCraftAccess({resources});
  const veilUI=createVeilUI({resources,canLeave,canSupply,onBeforeLaunch,onCraft:(...args)=>{pendingCraft.refresh();return onCraft(...args);},onCommit});
  const capabilityPresentation=installTankCapabilityPresentation({resources}),forwardDiscovery=veilUI.discovered?.bind(veilUI);
  veilUI.discovered=(id,outcome)=>{forwardDiscovery?.(id);capabilityPresentation.discovered(id,outcome);};
  createProgressResetUI({resources,...reset});
  return veilUI;
}

// Exploration initialization stays behind the molecule DB-ready boundary. The
// deferred facade exposes the production application APIs without compatibility
// launch aliases, so callers cannot bypass requestExpeditionLaunch(destinationId).
export function createDeferredExplorationFacade(getCurrent,ready){
  const current=()=>getCurrent?.()??null;
  return{
    get active(){return current()?.active??false;},
    get run(){return current()?.run??null;},
    get returnPhase(){return current()?.returnPhase??null;},
    get returning(){return current()?.returning??null;},
    get lastTelemetry(){return current()?.lastTelemetry??null;},
    get ready(){return ready;},
    updateCraft(...args){return current()?.updateCraft?.(...args);},
    requestExpeditionLaunch(...args){return current()?.requestExpeditionLaunch?.(...args)??false;},
    pause(...args){return current()?.pause?.(...args)??false;},
    openSupply(...args){return current()?.openSupply?.(...args)??false;},
    discovered(...args){return current()?.discovered?.(...args);},
    usesFor(...args){return current()?.usesFor?.(...args)??[];},
    tankStatus(...args){return current()?.tankStatus?.(...args)??null;},
    fillPlan(...args){return current()?.fillPlan?.(...args)??null;},
    commitFill(...args){return current()?.commitFill?.(...args)??false;},
  };
}

export function connectExploration(options){
  normalizeExplorationMode();connectedResources=options.resources;
  let veilUI=null;
  const ready=prepareExplorationCatalog(options.resources).then(result=>{
    if(!result.ok)return null;
    veilUI=createReadyExploration(options);
    return veilUI;
  }).catch(error=>{console.warn('Exploration unavailable until molecule DB is ready.',error);return null;});
  return createDeferredExplorationFacade(()=>veilUI,ready);
}

export async function connectCollection({records,elementPalette,elementAccess,onPlace,canOpen,onOpenChange}){
  const {createCollectionUI}=await import('./collection-ui.js?v=41');
  return createCollectionUI({records,elementPalette,elementAccess,onPlace,canOpen,onOpenChange,recipeState:()=>connectedResources?.state??{recipes:[],hints:[]}});
}

export async function preparePolymerEncyclopedia({records=moleculeCatalog(),knownIds=[]}={}){
  const moleculeIds=new Set(records.map(record=>record.id));
  const result=await loadPolymerCatalog({moleculeIds});
  if(!result.ok)return {result,model:null};
  try{
    const response=await fetch(new URL('../data/polymer-encyclopedia.json',import.meta.url),{cache:'no-store'});
    if(!response?.ok)throw new Error(`HTTP ${response?.status??'unknown'}`);
    return {result,model:createPolymerEncyclopediaModel(polymerCatalog(),await response.json(),{knownIds})};
  }catch(error){return {result:{ok:false,count:0,error:String(error?.message??error)},model:null};}
}

export function bindSaveLifecycle({window,document,onPageHide,onHidden,onPrepareUpdate}){
  window.addEventListener('pagehide',onPageHide);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)onHidden();});
  window.addEventListener('molecule-craft:prepare-update',onPrepareUpdate);
}

export function createDiscoveryConnection({resources,getVeilUI,getCollection,onPresent,onDismiss,onVibrate,presentRegistration=presentFirstRegistration}){
  const completionGate=createCompletionSideEffectGate();let queue=[],pendingStructures=new Map(),until=0,active=null;
  function sync(structures){
    const currentByKey=new Map(structures.map(item=>[item.key,item])),currentSignatures=new Set(structures.filter(item=>item.complete).map(item=>item.signature));
    queue=queue.flatMap(event=>{const item=currentByKey.get(event.key);return item?.complete?[{...event,signature:item.signature}]:[];});
    for(const [key,event]of pendingStructures){const item=currentByKey.get(key);if(!item||item.signature!==event.signature)pendingStructures.delete(key);}
    if(active&&!currentSignatures.has(active)){active=null;until=0;onDismiss();}
    const {changed,completions}=completionGate.sync(structures),completionKeys=new Set(completions.map(item=>item.key)),queuedKeys=new Set(queue.map(item=>item.key));
    for(const item of changed)if(!completionKeys.has(item.key))pendingStructures.set(item.key,{key:item.key,signature:item.signature});
    for(const item of completions)if(!queuedKeys.has(item.key)){queue.push({key:item.key,signature:item.signature,effectsDone:false,gameEvent:null});queuedKeys.add(item.key);}
  }
  function discardQueued(){queue=[];pendingStructures.clear();active=null;until=0;onDismiss();}
  function clear(){completionGate.suppressNextSync();discardQueued();}
  function collectionReady(){}
  function check(structures,{blocked=false,now=performance.now()}={}){
    if(blocked)return;
    const collection=getCollection();if(!collection)return;
    if(pendingStructures.size){
      const passive=[...pendingStructures.values()].map(event=>structures.find(item=>item.key===event.key&&item.signature===event.signature)).filter(Boolean).map(item=>({...item,record:null}));
      pendingStructures.clear();if(passive.length)collection.observeStructures(passive);
    }
    const veilUI=getVeilUI();
    for(const event of queue){
      if(event.effectsDone)continue;
      const item=structures.find(candidate=>candidate.key===event.key&&candidate.signature===event.signature&&candidate.complete);if(!item)continue;
      if(item.record){
        const discovery=resources.discoverWithLoadout(item.record.id,criticalPrimaryLoadoutUse(item.record.id));
        if(discovery?.learned){veilUI?.discovered(item.record.id,{autoAssignedUse:discovery.assignedUse??null});collection.refreshProgress();}
      }
      const result=collection.observeStructures([item]);event.gameEvent=result.events.find(candidate=>candidate.signature===item.signature)??null;event.effectsDone=true;
    }
    if(now<until)return;
    while(queue.length){
      const event=queue[0],item=structures.find(candidate=>candidate.key===event.key&&candidate.signature===event.signature&&candidate.complete);
      if(!item){queue.shift();continue;}if(!event.effectsDone)return;
      const isNew=!!event.gameEvent?.isNew,recordId=event.gameEvent?.record?.id??item.record?.id;
      if(isNew&&recordId){
        onDismiss();
        if(!presentRegistration({collection,id:recordId}))return;
        queue.shift();active=null;until=now+REGISTRATION_REVEAL_HOLD_MS;onVibrate();return;
      }
      queue.shift();active=item.signature;until=now+1300;onPresent({item,isNew});if(isNew)onVibrate();return;
    }
  }
  return{sync,check,clear,discardQueued,collectionReady};
}
