export const UI_MODE=Object.freeze({CRAFT:'CRAFT',LOADOUT:'LOADOUT',EXPLORE:'EXPLORE',COLLECTION:'COLLECTION',MENU:'MENU'});

const DIALOG_BY_MODE=Object.freeze({
  [UI_MODE.LOADOUT]:'supply-dialog',
  [UI_MODE.COLLECTION]:'collection-dialog',
  [UI_MODE.MENU]:'menu-dialog',
});
const PRIMARY_DIALOG_MODES=[UI_MODE.LOADOUT,UI_MODE.COLLECTION,UI_MODE.MENU];
const coordinators=new WeakMap();

export function createUIStateCoordinator(root=document){
  const q=id=>root.getElementById?.(id)??root.querySelector?.(`#${id}`)??null;
  const veil=q('veil-view'),appShell=root.querySelector?.('.app-shell')??null,body=root.body??null;
  const dialogs=Object.fromEntries(PRIMARY_DIALOG_MODES.map(mode=>[mode,q(DIALOG_BY_MODE[mode])]));
  let mode=UI_MODE.CRAFT,syncing=false,queued=false;

  function deriveMode(){
    if(veil&&!veil.hidden||body?.dataset?.mode==='veil')return UI_MODE.EXPLORE;
    for(const candidate of PRIMARY_DIALOG_MODES)if(dialogs[candidate]?.open)return candidate;
    return UI_MODE.CRAFT;
  }
  function diagnostics(next=mode){
    const open=PRIMARY_DIALOG_MODES.filter(candidate=>dialogs[candidate]?.open),issues=[];
    if(next===UI_MODE.CRAFT){if(appShell?.inert)issues.push('CRAFT with inert app shell');if(veil&&!veil.hidden)issues.push('CRAFT with visible veil');}
    if(next===UI_MODE.EXPLORE){if(veil?.hidden)issues.push('EXPLORE with hidden veil');if(appShell&&!appShell.inert)issues.push('EXPLORE with interactive app shell');if(open.length)issues.push(`EXPLORE with open primary dialog: ${open.join(', ')}`);}
    if(open.length>1)issues.push(`Multiple primary dialogs open: ${open.join(', ')}`);
    if(next===UI_MODE.LOADOUT&&dialogs[UI_MODE.COLLECTION]?.open)issues.push('LOADOUT with COLLECTION open');
    if(next===UI_MODE.LOADOUT&&dialogs[UI_MODE.MENU]?.open)issues.push('LOADOUT with MENU open');
    if(next===UI_MODE.COLLECTION&&dialogs[UI_MODE.MENU]?.open)issues.push('COLLECTION with MENU open');
    for(const issue of issues)console.error(`[UI state] ${issue}`);
    return issues;
  }
  function transition(next,{openTarget=true}={}){
    if(!Object.values(UI_MODE).includes(next))throw new Error(`Unknown UI mode: ${next}`);
    syncing=true;
    try{
      mode=next;const explore=next===UI_MODE.EXPLORE;
      if(veil)veil.hidden=!explore;
      if(body?.dataset)body.dataset.mode=explore?'veil':'craft';
      if(appShell)appShell.inert=explore;
      for(const candidate of PRIMARY_DIALOG_MODES){
        const dialog=dialogs[candidate];if(!dialog)continue;
        const target=candidate===next;
        if(!target&&dialog.open)dialog.close();
        else if(target&&openTarget&&!dialog.open)dialog.showModal();
      }
    }finally{syncing=false;}
    diagnostics(next);return mode;
  }
  function syncFromDom(){
    if(syncing)return mode;
    return transition(deriveMode(),{openTarget:false});
  }
  function queueSync(){
    if(syncing||queued)return;queued=true;queueMicrotask(()=>{queued=false;syncFromDom();});
  }

  if(typeof MutationObserver!=='undefined'){
    const observer=new MutationObserver(queueSync);
    if(veil)observer.observe(veil,{attributes:true,attributeFilter:['hidden']});
    if(body)observer.observe(body,{attributes:true,attributeFilter:['data-mode']});
    for(const dialog of Object.values(dialogs))if(dialog)observer.observe(dialog,{attributes:true,attributeFilter:['open']});
  }
  for(const dialog of Object.values(dialogs))dialog?.addEventListener?.('close',queueSync);

  return{get mode(){return mode;},transition,syncFromDom,diagnostics};
}

export function getUIStateCoordinator(root=document){
  let coordinator=coordinators.get(root);if(!coordinator){coordinator=createUIStateCoordinator(root);coordinators.set(root,coordinator);}return coordinator;
}
