import {createVeilUI} from './veil/ui.js?v=3';
import {createProgressResetUI} from './veil/reset-ui.js';
import {createCompletionTracker} from './workspace-model.js?v=20';

function normalizeExplorationMode(){
  const veil=document.querySelector('#veil-view'),appShell=document.querySelector('.app-shell');
  if(veil)veil.hidden=true;
  if(appShell)appShell.inert=false;
  if(document.body?.dataset)document.body.dataset.mode='craft';
}

function describeError(error){
  if(error instanceof Error)return `${error.name}: ${error.message}`;
  if(error&&typeof error==='object'&&'message'in error)return String(error.message);
  return String(error??'unknown error');
}

function showLaunchDiagnostic(text){
  const status=document.getElementById('craft-resource-hint');
  if(status)status.textContent=text;
}

function installExplorationDiagnostics(){
  if(window.__moleculeCraftExplorationDiagnostics)return;
  window.__moleculeCraftExplorationDiagnostics=true;
  const originalError=console.error.bind(console);
  console.error=(...args)=>{
    originalError(...args);
    if(args[0]==='Expedition launch initialization failed.')showLaunchDiagnostic(`LAUNCH FAIL · ${describeError(args[1])}`);
  };
  window.addEventListener('error',event=>{
    const message=event.error?describeError(event.error):event.message;
    showLaunchDiagnostic(`RUNTIME ERROR · ${message}`);
  });
  window.addEventListener('unhandledrejection',event=>showLaunchDiagnostic(`PROMISE ERROR · ${describeError(event.reason)}`));
}

export function connectExploration({resources,canLeave,canSupply,onBeforeLaunch,onCraft,onCommit,reset}){
  normalizeExplorationMode();installExplorationDiagnostics();
  const checkedCanLeave=()=>{const ok=canLeave();if(!ok)showLaunchDiagnostic('LAUNCH BLOCK · canLeave=false');return ok;};
  const checkedCanSupply=()=>{const ok=canSupply();if(!ok)showLaunchDiagnostic('LAUNCH BLOCK · canSupply=false');return ok;};
  const checkedBeforeLaunch=()=>{const ok=onBeforeLaunch();if(ok===false)showLaunchDiagnostic('LAUNCH BLOCK · onBeforeLaunch=false');return ok;};
  const veilUI=createVeilUI({resources,canLeave:checkedCanLeave,canSupply:checkedCanSupply,onBeforeLaunch:checkedBeforeLaunch,onCraft,onCommit});
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
