import { MOLECULE_USES,TANK_USES } from './growth.js';
import { ACTIVE_TANK_ROLES,primaryRoleFor } from './molecule-roles.js';

const STYLE_ID='tank-capability-presentation-style';
const ROLE_SET=new Set(ACTIVE_TANK_ROLES);

export function tankCapabilityIntroduced(resources,use){
  if(!ROLE_SET.has(use))return false;
  if(resources.selectedLoadout?.()[use])return true;
  return (resources.state?.recipes??[]).some(id=>primaryRoleFor(id)===use);
}

export function createCapabilityPresentationState(){
  let pending=[],attention=false,tankSelectionHintShown=false;
  return {
    queue(event){
      if(!event?.id||!ROLE_SET.has(event.use))return false;
      if(!pending.some(item=>item.id===event.id&&item.use===event.use))pending.push({id:event.id,use:event.use});
      attention=true;
      return true;
    },
    open(){
      const unlocks=pending;pending=[];attention=false;
      const showHint=unlocks.length>0&&!tankSelectionHintShown;
      if(showHint)tankSelectionHintShown=true;
      return {unlocks,showHint};
    },
    get attention(){return attention;},
    get pendingCount(){return pending.length;},
    get tankSelectionHintShown(){return tankSelectionHintShown;},
  };
}

function installStyle(doc){
  if(doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=`
#open-supply[data-capability-attention="true"]{position:relative;outline:1px solid #79dbe8;outline-offset:2px}
#open-supply .capability-access-new{position:absolute;right:-5px;top:-6px;z-index:4;padding:1px 4px;border:1px solid #8ce4ef;border-radius:8px;background:#102e3b;color:#d9fbff;font:800 8px/1.4 system-ui;letter-spacing:.5px;pointer-events:none}
#supply-dialog .shell-port[data-capability-introduced="false"]{opacity:.46!important;filter:saturate(.3) brightness(.82);border-style:dashed;box-shadow:none!important;background:#0b1b27d9}
#supply-dialog .shell-port[data-capability-introduced="false"]>i,#supply-dialog .shell-port[data-capability-introduced="false"]>small{opacity:.55}
#supply-dialog .shell-port[data-capability-new="true"]{outline:1px solid color-mix(in srgb,var(--tank-color) 80%,#dffcff);outline-offset:3px}
#supply-dialog .tank-capability-scan{position:absolute;z-index:5;left:7px;right:7px;top:8px;height:1px;background:linear-gradient(90deg,transparent,#dffcff,transparent);box-shadow:0 0 8px #9cecf7;pointer-events:none}
#supply-dialog .tank-selection-hint{position:absolute;z-index:7;left:50%;top:calc(100% + 7px);width:max-content;max-width:145px;transform:translateX(-50%);padding:4px 7px;border:1px solid #5d8798;border-radius:8px;background:#081925f2;color:#cdeef4;font:700 9px/1.35 system-ui;white-space:nowrap;box-shadow:0 5px 16px #0007;pointer-events:none}
#supply-dialog .port-oxidizer .tank-selection-hint,#supply-dialog .port-coolant .tank-selection-hint{top:auto;bottom:calc(100% + 7px)}
@media(prefers-reduced-motion:reduce){#open-supply[data-capability-attention="true"],#supply-dialog .shell-port[data-capability-new="true"]{transition:none!important}}
`;(doc.head??doc.documentElement).append(style);
}

function makeLiveRegion(doc){
  const live=doc.createElement('span');live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');
  Object.assign(live.style,{position:'fixed',width:'1px',height:'1px',padding:'0',margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:'0'});
  doc.body?.append(live);return live;
}

export function installTankCapabilityPresentation({resources,root=document,view=window}={}){
  const access=root.getElementById('open-supply'),dialog=root.getElementById('supply-dialog');
  const state=createCapabilityPresentationState();
  if(!access||!dialog)return {discovered(){return false;},sync(){},dispose(){},state};
  installStyle(root);
  const reduced=view.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false,live=makeLiveRegion(root);
  let observer=null,hintTimer=0;
  const formulaId=id=>{const record=resources.record?.(id);return MOLECULE_USES[id]?.formula??record?.formula??id;};
  const roleLabel=use=>TANK_USES[use]?.label??use;
  function sync(){
    for(const use of ACTIVE_TANK_ROLES){const button=root.getElementById(`shell-${use}`);if(button)button.dataset.capabilityIntroduced=String(tankCapabilityIntroduced(resources,use));}
  }
  function setAccessAttention(active){
    access.dataset.capabilityAttention=String(active);
    let badge=access.querySelector('.capability-access-new');
    if(active&&!badge){badge=root.createElement('span');badge.className='capability-access-new';badge.setAttribute('aria-hidden','true');badge.textContent='NEW';access.append(badge);}
    if(!active)badge?.remove();
  }
  function announce(event){
    const text=`${roleLabel(event.use)}タンクに${formulaId(event.id)}を設定しました`;
    live.textContent='';queueMicrotask(()=>{live.textContent=text;});
  }
  function showTapHint(button){
    if(!button?.isConnected)return;
    root.querySelector('.tank-selection-hint')?.remove();
    const hint=root.createElement('span');hint.className='tank-selection-hint';hint.setAttribute('aria-hidden','true');hint.textContent='タップして分子を変更';button.append(hint);
    clearTimeout(hintTimer);hintTimer=view.setTimeout(()=>hint.remove(),3000);
  }
  function animateTank(event,showHint=false,index=0){
    const button=root.getElementById(`shell-${event.use}`);if(!button)return;
    button.dataset.capabilityNew='true';
    const finish=()=>{view.setTimeout(()=>{delete button.dataset.capabilityNew;},reduced?1100:900);if(showHint)view.setTimeout(()=>showTapHint(button),reduced?120:650);};
    if(reduced||typeof button.animate!=='function'){finish();return;}
    const delay=Math.min(index*90,270);
    button.animate([{boxShadow:'0 0 0 rgba(145,235,247,0)',filter:'brightness(1)'},{boxShadow:'0 0 24px rgba(145,235,247,.62)',filter:'brightness(1.18)'},{boxShadow:'0 0 8px rgba(145,235,247,.18)',filter:'brightness(1)'}],{duration:760,delay,easing:'ease-out'});
    const scan=root.createElement('span');scan.className='tank-capability-scan';scan.setAttribute('aria-hidden','true');button.append(scan);
    scan.animate([{transform:'translateY(0)',opacity:0},{opacity:1,offset:.18},{transform:'translateY(38px)',opacity:.9,offset:.78},{transform:'translateY(42px)',opacity:0}],{duration:620,delay,easing:'ease-out'}).finished.finally(()=>scan.remove());
    for(const node of [button.querySelector('i'),button.querySelector('small')])node?.animate([{opacity:.25,transform:'scale(.92)'},{opacity:1,transform:'scale(1)'}],{duration:420,delay:delay+280,easing:'ease-out'});
    finish();
  }
  function consumeOpen(){
    if(!dialog.open||!state.attention)return;
    const presentation=state.open();setAccessAttention(false);sync();
    presentation.unlocks.forEach((event,index)=>animateTank(event,presentation.showHint&&index===0,index));
  }
  function discovered(id,{autoAssignedUse=null}={}){
    sync();
    if(!autoAssignedUse)return false;
    const event={id,use:autoAssignedUse};if(!state.queue(event))return false;
    setAccessAttention(true);announce(event);
    if(!reduced&&typeof access.animate==='function')access.animate([{boxShadow:'0 0 0 rgba(120,225,239,0)'},{boxShadow:'0 0 18px rgba(120,225,239,.55)'},{boxShadow:'0 0 0 rgba(120,225,239,0)'}],{duration:720,easing:'ease-out'});
    if(dialog.open)queueMicrotask(consumeOpen);
    return true;
  }
  access.addEventListener('click',()=>queueMicrotask(consumeOpen));
  dialog.addEventListener('click',()=>queueMicrotask(sync));
  if(typeof MutationObserver!=='undefined'){observer=new MutationObserver(()=>{if(dialog.open)consumeOpen();});observer.observe(dialog,{attributes:true,attributeFilter:['open']});}
  sync();setAccessAttention(false);
  return {discovered,sync,state,dispose(){observer?.disconnect();clearTimeout(hintTimer);live.remove();}};
}
