export const REGISTRATION_REVEAL_HOLD_MS=2400;

const SILHOUETTE_FILTER='grayscale(1) brightness(.2) contrast(1.35)';
const STATUS_FAILURE=/表示できません|読み込めません|利用できません/;

function applyStyles(node,styles){if(node)Object.assign(node.style,styles);}
function animate(node,keyframes,options,animations){
  if(!node?.animate)return null;
  try{const animation=node.animate(keyframes,options);animations.add(animation);return animation;}catch{return null;}
}

export function presentFirstRegistration({
  collection,id,root=document,win=globalThis.window,
  observerFactory=callback=>new MutationObserver(callback),
  setTimer=setTimeout,clearTimer=clearTimeout,
}={}){
  const dialog=root?.querySelector?.('#collection-dialog');
  dialog?.__moleculeCraftRegistrationRevealCleanup?.();
  if(!id||!collection?.openMolecule?.(id))return false;
  const detail=root.querySelector('#collection-detail'),modelHost=detail?.querySelector?.('.collection-model');
  if(!dialog||!detail||!modelHost)return true;

  const reduceMotion=!!win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const timers=new Set(),animations=new Set(),identity=[...detail.querySelectorAll('.detail-heading h3,.detail-heading .detail-formula,.dex-description,.detail-extras')];
  const originals=new Map(),ariaOriginal=new Map();let observer=null,scan=null,cancelled=false,started=false,announced=false;
  const remember=(node,props)=>{if(!node||originals.has(node))return;const saved={};for(const prop of props)saved[prop]=node.style[prop]??'';originals.set(node,saved);};
  remember(modelHost,['filter','opacity','pointerEvents']);for(const node of identity){remember(node,['opacity','transform']);ariaOriginal.set(node,node.getAttribute('aria-hidden'));}

  const marker=root.createElement('div');marker.dataset.registrationMarker='true';
  applyStyles(marker,{display:'inline-flex',alignItems:'center',gap:'7px',margin:'0 0 10px',padding:'6px 9px',border:'1px solid #5ec9b8',borderRadius:'999px',background:'#123b3a',color:'#b9f4e9',fontSize:'11px',fontWeight:'800',letterSpacing:'.08em'});
  const number=detail.querySelector('.detail-heading .dex-number')?.textContent?.trim()||'';
  const setMarker=text=>{marker.textContent=[number,text].filter(Boolean).join(' · ');};setMarker('NEW ENTRY · REGISTERING');
  const nav=detail.querySelector('.detail-navigation');if(nav?.after)nav.after(marker);else detail.prepend(marker);

  const live=root.createElement('p');live.className='sr-only';live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');detail.append(live);
  const name=detail.querySelector('.detail-heading h3')?.textContent?.trim()||'',formula=detail.querySelector('.detail-heading .detail-formula')?.textContent?.trim()||'';
  for(const node of identity){node.setAttribute('aria-hidden','true');applyStyles(node,{opacity:'0',transform:reduceMotion?'none':'translateY(3px)'});}
  applyStyles(modelHost,{filter:SILHOUETTE_FILTER,opacity:'.84',pointerEvents:'none'});

  const schedule=(fn,delay)=>{const token=setTimer(()=>{timers.delete(token);if(!cancelled)fn();},delay);timers.add(token);return token;};
  const restore=()=>{
    for(const [node,styles]of originals)applyStyles(node,styles);
    for(const [node,value]of ariaOriginal){if(value==null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',value);}
  };
  const cleanup=()=>{
    if(cancelled)return;cancelled=true;observer?.disconnect?.();observer=null;
    for(const timer of timers)clearTimer(timer);timers.clear();for(const animation of animations)try{animation.cancel();}catch{}animations.clear();
    scan?.remove();marker.remove();live.remove();restore();dialog.removeEventListener('close',cleanup);
    if(dialog.__moleculeCraftRegistrationRevealCleanup===cleanup)delete dialog.__moleculeCraftRegistrationRevealCleanup;
  };
  dialog.__moleculeCraftRegistrationRevealCleanup=cleanup;dialog.addEventListener('close',cleanup,{once:true});

  const revealIdentity=()=>{
    if(announced)return;announced=true;
    for(const node of identity){node.removeAttribute('aria-hidden');applyStyles(node,{opacity:'1',transform:'none'});animate(node,reduceMotion?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'none'}],{duration:reduceMotion?120:220,easing:'ease-out'},animations);}
    live.textContent=`図鑑に ${[formula,name].filter(Boolean).join(' ')}を登録しました`;
  };
  const settle=stage=>{
    revealIdentity();setMarker('REGISTERED');
    const saved=originals.get(modelHost)??{};applyStyles(modelHost,{filter:saved.filter??'',opacity:saved.opacity??'',pointerEvents:saved.pointerEvents??''});
    if(!reduceMotion)animate(stage,[{boxShadow:'inset 0 0 0 1px #7ce8d633'},{boxShadow:'inset 0 0 28px 3px #7ce8d655'},{boxShadow:'inset 0 0 0 1px #7ce8d600'}],{duration:280,easing:'ease-out'},animations);
    schedule(()=>{animate(marker,[{opacity:1},{opacity:0}],{duration:180,easing:'ease-out'},animations);schedule(()=>marker.remove(),180);},360);
    schedule(()=>{observer?.disconnect?.();observer=null;live.remove();restore();if(dialog.__moleculeCraftRegistrationRevealCleanup===cleanup)delete dialog.__moleculeCraftRegistrationRevealCleanup;dialog.removeEventListener('close',cleanup);},620);
  };
  const startReveal=()=>{
    if(cancelled||started)return;
    const stage=modelHost.querySelector('.model-stage');if(!stage){fallback();return;}
    started=true;observer?.disconnect?.();observer=null;
    schedule(()=>{
      if(reduceMotion){setMarker('NEW ENTRY · REGISTERING');applyStyles(modelHost,{filter:'none',opacity:'1'});animate(modelHost,[{opacity:.84},{opacity:1}],{duration:180,easing:'ease-out'},animations);revealIdentity();schedule(()=>settle(stage),180);return;}
      setMarker('NEW ENTRY · SCANNING');
      scan=root.createElement('div');scan.dataset.registrationScan='true';applyStyles(scan,{position:'absolute',left:'0',right:'0',top:'-22%',height:'26%',pointerEvents:'none',background:'linear-gradient(180deg,transparent,#8ff7e955,transparent)',filter:'blur(1px)',mixBlendMode:'screen',opacity:'0'});stage.append(scan);
      animate(scan,[{transform:'translateY(0)',opacity:0},{opacity:.9,offset:.42},{transform:'translateY(470%)',opacity:0}],{duration:560,easing:'cubic-bezier(.2,.7,.2,1)'},animations);
      applyStyles(modelHost,{filter:'none',opacity:'1'});animate(modelHost,[{filter:SILHOUETTE_FILTER,opacity:.84},{filter:'grayscale(0) brightness(1) contrast(1)',opacity:1}],{duration:600,easing:'cubic-bezier(.2,.7,.2,1)'},animations);
      schedule(revealIdentity,320);schedule(()=>{scan?.remove();scan=null;settle(stage);},620);
    },reduceMotion?70:300);
  };
  const fallback=()=>{
    if(cancelled||started)return;started=true;observer?.disconnect?.();observer=null;revealIdentity();setMarker('REGISTERED');
    const saved=originals.get(modelHost)??{};applyStyles(modelHost,{filter:saved.filter??'',opacity:saved.opacity??'',pointerEvents:saved.pointerEvents??''});
    schedule(()=>marker.remove(),320);schedule(()=>{live.remove();restore();if(dialog.__moleculeCraftRegistrationRevealCleanup===cleanup)delete dialog.__moleculeCraftRegistrationRevealCleanup;dialog.removeEventListener('close',cleanup);},360);
  };
  const inspect=()=>{
    if(cancelled||started)return;
    if(modelHost.querySelector('.model-canvas')){startReveal();return;}
    if(STATUS_FAILURE.test(modelHost.textContent??''))fallback();
  };
  observer=observerFactory(inspect);observer.observe(modelHost,{childList:true,subtree:true,characterData:true});inspect();
  return true;
}
