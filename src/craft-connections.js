import {createVeilUI} from './veil/ui.js';
import {createProgressResetUI} from './veil/reset-ui.js';
import {createCompletionTracker} from './workspace-model.js?v=20';
import {MOLECULE_USES} from './veil/growth.js';

export function connectExploration({resources,canLeave,canSupply,onCraft,onCommit,reset}){
  const veilUI=createVeilUI({resources,canLeave,canSupply,onCraft,onCommit});
  createProgressResetUI({resources,...reset});
  return veilUI;
}

export async function connectCollection({records,elementPalette,elementAccess,onPlace,canOpen,onOpenChange}){
  const {createCollectionUI}=await import('./collection-ui.js?v=36');
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
    const isNew=!!event.gameEvent?.isNew;active=item.signature;until=now+(isNew?2800:1300);onPresent({item,isNew,learning:MOLECULE_USES[item.record?.id]?.discovery??collection?.describeEvent(event.gameEvent)??''});if(isNew)onVibrate();
  }
  return{sync,check,clear,discardQueued,collectionReady};
}
