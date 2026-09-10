import {createVeilUI} from './veil/ui.js?v=3';
import {createProgressResetUI} from './veil/reset-ui.js';
import {createCompletionTracker} from './workspace-model.js?v=20';

function normalizeExplorationMode(){
  const veil=document.querySelector('#veil-view'),appShell=document.querySelector('.app-shell');
  if(veil)veil.hidden=true;
  if(appShell)appShell.inert=false;
  if(document.body?.dataset)document.body.dataset.mode='craft';
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

function installEmptyDeparturePolicy(resources){
  const basePlan=resources.launchFillPlan.bind(resources),baseCommit=resources.commitLaunchFill.bind(resources);
  resources.launchFillPlan=options=>normalizeLaunchFillPlan(basePlan(options));
  resources.commitLaunchFill=({partial=false}={})=>{
    const result=baseCommit({partial});if(result||!partial)return result;
    return commitEmptyLaunchFill(resources,basePlan({includeWorkspace:false}));
  };
}

export function preserveSupplyDuringPrepare(onBeforeLaunch,root=document){
  return ()=>{
    const dialog=root.getElementById?.('supply-dialog')??root.querySelector?.('#supply-dialog'),wasOpen=!!dialog?.open;
    const result=onBeforeLaunch();
    if(wasOpen&&dialog&&!dialog.open)try{dialog.showModal();}catch{}
    return result;
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

export function connectExploration({resources,canLeave,canSupply,onBeforeLaunch,onCraft,onCommit,reset}){
  normalizeExplorationMode();installEmptyDeparturePolicy(resources);
  const veilUI=createVeilUI({resources,canLeave,canSupply,onBeforeLaunch:preserveSupplyDuringPrepare(onBeforeLaunch),onCraft,onCommit});
  installLoadoutShortageUI(resources);
  createProgressResetUI({resources,...reset});
  return veilUI;
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
  const completionTracker=createCompletionTracker();let queue=[],until=0,active=null,revision=0,checkedRevision=-1;
  function sync(structures){
    revision++;const current=new Set(structures.filter(item=>item.complete).map(item=>item.signature));queue=queue.filter(item=>current.has(item.signature));
    if(active&&!current.has(active)){active=null;until=0;onDismiss();}
    queue.push(...completionTracker.update(structures).map(item=>({key:item.key,signature:item.signature})));
  }
  function discardQueued(){queue=[];active=null;until=0;onDismiss();}
  function clear(){completionTracker.clear();discardQueued();}
  function collectionReady(){checkedRevision=-1;}
  function check(structures,{blocked=false,now=performance.now()}={}){
    if(blocked)return;
    const veilUI=getVeilUI(),collection=getCollection();
    for(const item of structures)if(item.complete&&item.record){const learned=resources.discover(item.record.id);if(learned){veilUI?.discovered(item.record.id);collection?.refreshProgress();resources.save();}}
    if(collection&&checkedRevision!==revision){
      checkedRevision=revision;const result=collection.observeStructures(structures);
      for(const gameEvent of result.events){const queued=queue.find(item=>item.signature===gameEvent.signature);if(queued){if(!queued.gameEvent)queued.gameEvent=gameEvent;}else if(gameEvent.isNew)queue.push({signature:gameEvent.signature,gameEvent});}
    }
    if(now<until)return;const event=queue.shift();if(!event)return;
    const item=structures.find(candidate=>candidate.signature===event.signature&&candidate.complete);if(!item)return;
    const isNew=!!event.gameEvent?.isNew;active=item.signature;until=now+(isNew?2800:1300);onPresent({item,isNew});if(isNew)onVibrate();
  }
  return{sync,check,clear,discardQueued,collectionReady};
}
