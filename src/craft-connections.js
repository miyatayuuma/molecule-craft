import {createVeilUI} from './veil/ui.js?v=3';
import {createProgressResetUI} from './veil/reset-ui.js';
import {createCompletionSideEffectGate} from './completion-side-effects.js?v=1';
import {installPendingCraftAccess} from './pending-craft.js?v=1';
import {loadMoleculeDatabase,moleculeCatalog} from './chemistry.js?v=20';

function normalizeExplorationMode(){
  const veil=document.querySelector('#veil-view'),appShell=document.querySelector('.app-shell');
  if(veil)veil.hidden=true;
  if(appShell)appShell.inert=false;
  if(document.body?.dataset)document.body.dataset.mode='craft';
}

const copy=x=>JSON.parse(JSON.stringify(x));
const addCost=(target,cost)=>{for(const [el,n] of Object.entries(cost??{}))target[el]=(target[el]??0)+n;return target;};
const canAppendCost=(current,extra,available)=>Object.entries(extra??{}).every(([el,n])=>(current[el]??0)+n<=(available[el]??0));
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

export function commitEmptyLaunchFill(resources,preview){
  if(resources.blocked||preview?.status!=='IMPOSSIBLE'||preview.invalid?.length)return false;
  const before=Object.fromEntries(Object.entries(resources.state.tanks).map(([use,tank])=>[use,{...tank}]));
  for(const entry of preview.partial.entries){
    const tank=resources.state.tanks[entry.use];if(!tank)continue;
    tank.molecule=entry.molecule??null;tank.amount=entry.target??0;
  }
  if(resources.save())return {committed:true,status:'PARTIAL',plan:preview.partial,required:preview.required,missing:preview.missing,emptyDeparture:true};
  for(const [use,tank]of Object.entries(before))Object.assign(resources.state.tanks[use],tank);
  return false;
}

export function commitRebalancedLaunchFill(resources,preview){
  if(resources.blocked||preview?.status!=='PARTIAL'||preview.emptyDeparture)return false;
  const plan=preview.partial,beforeElements={...resources.state.elements},beforeTanks=Object.fromEntries(Object.entries(resources.state.tanks).map(([use,tank])=>[use,{...tank}]));
  if(!resources.spend(plan.cost))return false;
  for(const entry of plan.entries){const tank=resources.state.tanks[entry.use];if(!tank)continue;if(!entry.molecule){tank.molecule=null;tank.amount=0;}else{tank.molecule=entry.molecule;tank.amount=entry.target;}}
  if(resources.save())return {committed:true,status:'PARTIAL',plan:copy(plan),required:copy(preview.required),missing:copy(preview.missing)};
  Object.assign(resources.state.elements,beforeElements);for(const [use,tank]of Object.entries(beforeTanks))Object.assign(resources.state.tanks[use],tank);return false;
}

export function installEmptyDeparturePolicy(resources){
  const basePlan=resources.launchFillPlan.bind(resources),baseCommit=resources.commitLaunchFill.bind(resources);
  const policyPlan=options=>normalizeLaunchFillPlan(rebalanceLaunchFillPlan(resources,basePlan(options),options));
  resources.launchFillPlan=policyPlan;
  resources.commitLaunchFill=({partial=false}={})=>{
    const raw=basePlan({includeWorkspace:false}),preview=normalizeLaunchFillPlan(rebalanceLaunchFillPlan(resources,raw,{includeWorkspace:false}));
    if(preview.status==='FULL')return baseCommit({partial:false});
    if(preview.status==='IMPOSSIBLE'||!partial)return false;
    if(preview.emptyDeparture)return commitEmptyLaunchFill(resources,raw);
    return commitRebalancedLaunchFill(resources,preview);
  };
}

export function preserveSupplyDuringPrepare(onBeforeLaunch,root=document){
  return ()=>{
    const dialog=root.getElementById?.('supply-dialog')??root.querySelector?.('#supply-dialog'),wasOpen=!!dialog?.open;
    try{return onBeforeLaunch();}
    finally{if(wasOpen&&dialog&&!dialog.open)try{dialog.showModal();}catch{}}
  };
}

function shortageText(plan){
  const parts=Object.entries(plan?.missing??{}).map(([el,row])=>`${el} −${Math.max(0,(row.need??0)-(row.have??0))}`).filter(text=>!text.endsWith('−0'));
  return parts.length?`BASE STOCK不足 · ${parts.join(' · ')}`:'';
}

function installLoadoutShortageUI(resources){
  const launch=document.getElementById('launch-veil'),preview=document.getElementById('loadout-stock-preview'),dialog=document.getElementById('supply-dialog');
  if(!launch||!preview||!dialog)return;
  const paintPreview=()=>{
    const plan=resources.launchFillPlan(),text=shortageText(plan),existing=preview.querySelector('[data-launch-shortage-summary]');
    if(!text){existing?.remove();return;}
    const summary=existing??document.createElement('strong');summary.dataset.launchShortageSummary='true';summary.textContent=text;
    Object.assign(summary.style,{flexBasis:'100%',textAlign:'center',fontSize:'12px',fontWeight:'800',color:'#ffd0a3'});
    if(!existing)preview.prepend(summary);
  };
  const showConfirmDetails=()=>{
    const plan=resources.launchFillPlan(),panel=document.getElementById('partial-fill-confirm');if(!panel||panel.hidden)return;
    const text=shortageText(plan),existing=panel.querySelector('[data-launch-shortage-detail]');
    if(text){const detail=existing??document.createElement('div');detail.dataset.launchShortageDetail='true';detail.textContent=text;Object.assign(detail.style,{marginBottom:'9px',fontSize:'13px',fontWeight:'800',color:'#ffd0a3'});if(!existing)panel.prepend(detail);}else existing?.remove();
    const go=panel.querySelector('button.primary'),hasUsable=plan.partial.entries.some(entry=>entry.molecule&&entry.target>0);if(go)go.textContent=hasUsable?'この搭載量で出る':'空タンクで出る';
  };
  launch.addEventListener('click',()=>queueMicrotask(()=>{paintPreview();showConfirmDetails();}),true);
  dialog.addEventListener('click',()=>queueMicrotask(paintPreview));
  document.getElementById('open-supply')?.addEventListener('click',()=>queueMicrotask(paintPreview));
  paintPreview();
}

export async function prepareExplorationCatalog(resources){
  const result=await loadMoleculeDatabase();
  if(!result.ok)return result;
  resources.setCatalog(moleculeCatalog());
  return result;
}

function createReadyExploration({resources,canLeave,canSupply,onBeforeLaunch,onCraft,onCommit,reset}){
  installEmptyDeparturePolicy(resources);
  const pendingCraft=installPendingCraftAccess({resources});
  const veilUI=createVeilUI({resources,canLeave,canSupply,onBeforeLaunch:preserveSupplyDuringPrepare(onBeforeLaunch),onCraft:(...args)=>{pendingCraft.refresh();return onCraft(...args);},onCommit});
  installLoadoutShortageUI(resources);
  createProgressResetUI({resources,...reset});
  return veilUI;
}

export function connectExploration(options){
  normalizeExplorationMode();
  let veilUI=null;
  const ready=prepareExplorationCatalog(options.resources).then(result=>{
    if(!result.ok)return null;
    veilUI=createReadyExploration(options);
    return veilUI;
  }).catch(error=>{console.warn('Exploration unavailable until molecule DB is ready.',error);return null;});
  return{
    get active(){return veilUI?.active??false;},
    get ready(){return ready;},
    updateCraft(){return veilUI?.updateCraft?.();},
    openSupply(...args){return veilUI?.openSupply?.(...args)??false;},
    discovered(...args){return veilUI?.discovered?.(...args);},
  };
}

export async function connectCollection({records,elementPalette,elementAccess,onPlace,canOpen,onOpenChange}){
  const {createCollectionUI}=await import('./collection-ui.js?v=37');
  return createCollectionUI({records,elementPalette,elementAccess,onPlace,canOpen,onOpenChange});
}

export function bindSaveLifecycle({window,document,onPageHide,onHidden,onPrepareUpdate}){
  window.addEventListener('pagehide',onPageHide);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)onHidden();});
  window.addEventListener('molecule-craft:prepare-update',onPrepareUpdate);
}

export function createDiscoveryConnection({resources,getVeilUI,getCollection,onPresent,onDismiss,onVibrate}){
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
        const learned=resources.discover(item.record.id);
        if(learned){veilUI?.discovered(item.record.id);collection.refreshProgress();resources.save();}
      }
      const result=collection.observeStructures([item]);event.gameEvent=result.events.find(candidate=>candidate.signature===item.signature)??null;event.effectsDone=true;
    }
    if(now<until)return;
    while(queue.length){
      const event=queue[0],item=structures.find(candidate=>candidate.key===event.key&&candidate.signature===event.signature&&candidate.complete);
      if(!item){queue.shift();continue;}if(!event.effectsDone)return;
      queue.shift();const isNew=!!event.gameEvent?.isNew;active=item.signature;until=now+(isNew?2800:1300);onPresent({item,isNew});if(isNew)onVibrate();return;
    }
  }
  return{sync,check,clear,discardQueued,collectionReady};
}
