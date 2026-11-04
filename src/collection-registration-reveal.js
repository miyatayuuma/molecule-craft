export const REGISTRATION_REVEAL_HOLD_MS=4000;

const SILHOUETTE_FILTER='grayscale(1) brightness(.2) contrast(1.35)';
const STATUS_FAILURE=/表示できません|読み込めません|利用できません/;

function applyStyles(node,styles){if(node)Object.assign(node.style,styles);}
function animate(node,keyframes,options,animations){
  if(!node?.animate)return null;
  try{const animation=node.animate(keyframes,options);animations.add(animation);return animation;}catch{return null;}
}

export function presentFirstRegistration({
  collection,kind='molecules',id,root=document,win=globalThis.window,
  observerFactory=callback=>new MutationObserver(callback),
  setTimer=setTimeout,clearTimer=clearTimeout,onSettled=()=>{},
}={}){
  const dialog=root?.querySelector?.('#collection-dialog');
  const notifySettled=result=>{try{onSettled(result);}catch{}};
  dialog?.__moleculeCraftRegistrationRevealCleanup?.();
  const opened=collection?.openEntry?.(kind,id)??(kind==='molecules'?collection?.openMolecule?.(id):false);
  if(!id||!opened){notifySettled({status:'failed',reason:'collection-unavailable'});return false;}
  const detail=root.querySelector('#collection-detail'),modelHost=detail?.querySelector?.('[data-registration-visual],.collection-model');
  if(!dialog||!detail||!modelHost){notifySettled({status:'failed',reason:'collection-view-unavailable'});return false;}

  const reduceMotion=!!win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const timers=new Set(),animations=new Set(),identity=[...detail.querySelectorAll('.detail-heading h3,.detail-heading .detail-formula,.dex-description,.detail-extras')];
  const originals=new Map(),ariaOriginal=new Map();let observer=null,scan=null,cancelled=false,started=false,announced=false,settled=false,ready=false;
  const remember=(node,props)=>{if(!node||originals.has(node))return;const saved={};for(const prop of props)saved[prop]=node.style[prop]??'';originals.set(node,saved);};
  remember(modelHost,['filter','opacity','pointerEvents']);for(const node of identity){remember(node,['opacity','transform']);ariaOriginal.set(node,node.getAttribute('aria-hidden'));}

  const markerAnchor=detail.querySelector('.detail-heading > div');
  if(!markerAnchor){notifySettled({status:'failed',reason:'registration-heading-unavailable'});return false;}
  const numberNode=detail.querySelector('.detail-heading .dex-number');
  remember(numberNode,['visibility']);if(numberNode)numberNode.style.visibility='hidden';
  const marker=root.createElement('div');marker.dataset.registrationMarker='true';marker.className='collection-registration-marker';
  const ruby=(base,reading)=>{const node=root.createElement('ruby');node.append(root.createTextNode(base));const rt=root.createElement('rt');rt.textContent=reading;node.append(rt);return node;};
  const species=kind==='polymers'?['高分子','こうぶんし']:['分子','ぶんし'];
  const PHRASES={
    'NEW ENTRY · REGISTERING':[['新','あたら'],'しい ',species,'！'],
    'NEW ENTRY · SCANNING':[species,'を ',['調','しら'],'べています…'],
    'REGISTERED':[['図鑑','ずかん'],'に ',['登録','とうろく'],'！'],
  };
  const setMarker=phase=>{
    const nodes=[];
    for(const part of PHRASES[phase]??[phase])nodes.push(Array.isArray(part)?ruby(part[0],part[1]):root.createTextNode(part));
    marker.replaceChildren(...nodes);
  };setMarker('NEW ENTRY · REGISTERING');
  // The number and name retain their layout; the badge paints over only the
  // number's reserved space, outside the filtered 3D viewer stacking context.
  markerAnchor.prepend(marker);

  const live=root.createElement('p');live.className='sr-only';live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');detail.append(live);
  const name=detail.querySelector('.detail-heading h3')?.textContent?.trim()||'',formula=kind==='molecules'?(detail.querySelector('.detail-heading .detail-formula')?.textContent?.trim()||''):'';
  for(const node of identity){node.setAttribute('aria-hidden','true');applyStyles(node,{opacity:'0',transform:reduceMotion?'none':'translateY(3px)'});}
  applyStyles(modelHost,{filter:SILHOUETTE_FILTER,opacity:'.84',pointerEvents:'none'});

  const schedule=(fn,delay)=>{const token=setTimer(()=>{timers.delete(token);if(!cancelled)fn();},delay);timers.add(token);return token;};
  const restore=()=>{
    for(const [node,styles]of originals)applyStyles(node,styles);
    for(const [node,value]of ariaOriginal){if(value==null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',value);}
  };
  let closeHandler=null;
  const onTap=event=>{
    if(event.target?.closest?.('#close-collection'))return;
    event.preventDefault();event.stopImmediatePropagation();if(ready)confirmPresented();
  };
  const onKey=event=>{
    if(!['Enter',' ','Spacebar'].includes(event.key))return;
    event.preventDefault();event.stopImmediatePropagation();if(ready)confirmPresented();
  };
  const confirmPresented=()=>{
    if(!ready||settled)return;
    settled=true;
    delete dialog.dataset.registrationAwaitingConfirmation;
    dialog.removeEventListener('click',onTap,true);dialog.removeEventListener('keydown',onKey,true);
    if(dialog.gamepadAdvance===gamepadAdvance)delete dialog.gamepadAdvance;
    // The coordinator may immediately open the next discovery. On the final
    // detail it instead leaves this badge visible until navigation or close.
    notifySettled({status:'presented'});
  };
  const cleanup=(outcome='dismissed')=>{
    if(cancelled)return;cancelled=true;observer?.disconnect?.();observer=null;
    delete dialog.dataset.registrationAwaitingConfirmation;
    for(const timer of timers)clearTimer(timer);timers.clear();for(const animation of animations)try{animation.cancel();}catch{}animations.clear();
    scan?.remove();marker.remove();live.remove();restore();if(closeHandler)dialog.removeEventListener('close',closeHandler);
    dialog.removeEventListener('click',onTap,true);dialog.removeEventListener('keydown',onKey,true);
    if(dialog.__moleculeCraftRegistrationRevealCleanup===cleanup)delete dialog.__moleculeCraftRegistrationRevealCleanup;
    if(dialog.gamepadAdvance===gamepadAdvance)delete dialog.gamepadAdvance;
    if(!settled){settled=true;notifySettled({status:outcome});}
  };
  const gamepadAdvance=()=>{if(ready)confirmPresented();};
  closeHandler=()=>cleanup('dismissed');dialog.__moleculeCraftRegistrationRevealCleanup=cleanup;dialog.gamepadAdvance=gamepadAdvance;dialog.dataset.registrationAwaitingConfirmation='true';dialog.addEventListener('close',closeHandler,{once:true});
  dialog.addEventListener('click',onTap,true);dialog.addEventListener('keydown',onKey,true);

  const revealIdentity=()=>{
    if(announced)return;announced=true;
    for(const node of identity){node.removeAttribute('aria-hidden');applyStyles(node,{opacity:'1',transform:'none'});animate(node,reduceMotion?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'none'}],{duration:reduceMotion?120:540,easing:'ease-out'},animations);}
    live.textContent=`図鑑に ${[formula,name].filter(Boolean).join(' ')}を登録しました`;
  };
  const settle=stage=>{
    revealIdentity();setMarker('REGISTERED');
    const saved=originals.get(modelHost)??{};applyStyles(modelHost,{filter:saved.filter??'',opacity:saved.opacity??'',pointerEvents:saved.pointerEvents??''});
    if(!reduceMotion)animate(stage,[{boxShadow:'inset 0 0 0 1px #7ce8d633'},{boxShadow:'inset 0 0 28px 3px #7ce8d655'},{boxShadow:'inset 0 0 0 1px #7ce8d600'}],{duration:1050,easing:'ease-out'},animations);
    // Tapping confirms the discovery, but does not remove its badge.
    schedule(()=>{ready=true;},reduceMotion?90:1100);
  };
  const startReveal=()=>{
    if(cancelled||started)return;
    const stage=modelHost.querySelector('.model-stage');if(!stage){fallback();return;}
    started=true;observer?.disconnect?.();observer=null;
    schedule(()=>{
      if(reduceMotion){setMarker('NEW ENTRY · REGISTERING');applyStyles(modelHost,{filter:'none',opacity:'1'});animate(modelHost,[{opacity:.84},{opacity:1}],{duration:180,easing:'ease-out'},animations);revealIdentity();schedule(()=>settle(stage),200);return;}
      setMarker('NEW ENTRY · SCANNING');
      scan=root.createElement('div');scan.dataset.registrationScan='true';applyStyles(scan,{position:'absolute',left:'0',right:'0',top:'-22%',height:'26%',pointerEvents:'none',background:'linear-gradient(180deg,transparent,#8ff7e955,transparent)',filter:'blur(1px)',mixBlendMode:'screen',opacity:'0'});stage.append(scan);
      animate(scan,[{transform:'translateY(0)',opacity:0},{opacity:.9,offset:.42},{transform:'translateY(470%)',opacity:0}],{duration:1550,easing:'cubic-bezier(.2,.7,.2,1)'},animations);
      // Only the inner stage moves; the outer frame never breathes or shifts.
      animate(stage,[{transform:'scale(.965)'},{transform:'scale(1.025)',offset:.68},{transform:'scale(1)'}],{duration:1850,easing:'cubic-bezier(.2,.7,.2,1)'},animations);
      for(let n=0;n<9;n++){
        const particle=root.createElement('span'),angle=n*Math.PI*2/9,radius=36+n%3*10;
        applyStyles(particle,{position:'absolute',left:'50%',top:'50%',width:'4px',height:'4px',borderRadius:'50%',background:'#9dfff1',boxShadow:'0 0 8px #8cf8e6',pointerEvents:'none',zIndex:'3'});
        stage.append(particle);
        animate(particle,[{transform:'translate(-50%,-50%) scale(.3)',opacity:0},{opacity:1,offset:.24},{transform:`translate(calc(-50% + ${Math.round(Math.cos(angle)*radius)}px),calc(-50% + ${Math.round(Math.sin(angle)*radius)}px)) scale(.1)`,opacity:0}],{duration:1650,easing:'ease-out'},animations);
        schedule(()=>particle.remove(),1700);
      }
      applyStyles(modelHost,{filter:'none',opacity:'1'});animate(modelHost,[{filter:SILHOUETTE_FILTER,opacity:.84},{filter:'grayscale(0) brightness(1) contrast(1)',opacity:1}],{duration:1500,easing:'cubic-bezier(.2,.7,.2,1)'},animations);
      schedule(revealIdentity,750);schedule(()=>{scan?.remove();scan=null;settle(stage);},1900);
    },reduceMotion?70:650);
  };
  const fallback=()=>{
    if(cancelled||started)return;started=true;observer?.disconnect?.();observer=null;revealIdentity();setMarker('REGISTERED');
    const saved=originals.get(modelHost)??{};applyStyles(modelHost,{filter:saved.filter??'',opacity:saved.opacity??'',pointerEvents:saved.pointerEvents??''});
    schedule(()=>{ready=true;},reduceMotion?120:600);
  };
  const inspect=()=>{
    if(cancelled||started)return;
    const image=modelHost.querySelector('img');
    if(modelHost.querySelector('.model-canvas')||image?.complete&&image.naturalWidth>0){startReveal();return;}
    if(STATUS_FAILURE.test(modelHost.textContent??''))fallback();
  };
  observer=observerFactory(inspect);observer.observe(modelHost,{childList:true,subtree:true,characterData:true});inspect();
  for(const image of modelHost.querySelectorAll('img'))image.addEventListener('load',inspect,{once:true});
  for(const image of modelHost.querySelectorAll('img'))image.addEventListener('error',fallback,{once:true});
  return true;
}
