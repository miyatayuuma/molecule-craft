import { RESOURCE_KEY } from './resources.js';

const STYLE_ID='molecule-craft-loadout-workstation-style';
const PULSE_UNIT_URL=new URL('../../assets/loadout-pulse-unit.png',import.meta.url).href;
const DRIVE_UNIT_URL=new URL('../../assets/loadout-drive-unit.png',import.meta.url).href;
const MODEL_URL=id=>new URL(`../../assets/models/molecule-${id}.svg`,import.meta.url).href;
const SLOT_USES=['propellant','fuel','oxidizer','coolant'];
const PULSE_SLOT_FRAME=Object.freeze({width:10.9,top:38.5,height:27.0});
const DRIVE_SLOT_FRAME=Object.freeze({width:10.0,top:38.0,height:27.0});

const slotGeometry=(centerX,frame)=>Object.freeze({
  centerX,
  left:Number((centerX-frame.width/2).toFixed(2)),
  width:frame.width,
  top:frame.top,
  height:frame.height,
  labelX:centerX,
});

export const LOADOUT_LABELS=Object.freeze({propellant:'PULSE',fuel:'FUEL',oxidizer:'O₂',coolant:'COOLANT'});
export const LOADOUT_SLOT_GEOMETRY=Object.freeze({
  propellant:slotGeometry(16.05,PULSE_SLOT_FRAME),
  fuel:slotGeometry(65.10,DRIVE_SLOT_FRAME),
  oxidizer:slotGeometry(77.20,DRIVE_SLOT_FRAME),
  coolant:slotGeometry(88.80,DRIVE_SLOT_FRAME),
});

const centerX=use=>LOADOUT_SLOT_GEOMETRY[use].centerX;
const pct=value=>`${value}%`;
const svgRectGeometry=geometry=>({
  x:Math.round(geometry.left*10),
  y:Math.round(geometry.top*2),
  width:Math.round(geometry.width*10),
  height:Math.round(geometry.height*2),
  rx:9,
  ry:7,
});

function addUnitImages(map){
  if(!map)return;
  for(const [kind,url] of [['pulse',PULSE_UNIT_URL],['drive',DRIVE_UNIT_URL]]){
    if(map.querySelector(`.loadout-${kind}-image`))continue;
    const img=document.createElement('img');
    img.className=`loadout-unit-image loadout-${kind}-image`;
    img.src=url;
    img.alt='';
    img.draggable=false;
    img.setAttribute('aria-hidden','true');
    map.append(img);
  }
}

function svgElement(name,attributes={}){
  const node=document.createElementNS('http://www.w3.org/2000/svg',name);
  for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
  return node;
}

function addSchematic(map){
  if(!map||map.querySelector('.loadout-schematic-lines'))return;
  const fuelX=Math.round(centerX('fuel')*10),oxidizerX=Math.round(centerX('oxidizer')*10),coolantX=Math.round(centerX('coolant')*10),pulseX=Math.round(centerX('propellant')*10);
  const svg=svgElement('svg',{class:'loadout-schematic-lines',viewBox:'0 0 1000 200',preserveAspectRatio:'none','aria-hidden':'true'});
  const pulse=svgElement('path',{class:'loadout-schematic-path',d:`M325 104 H286 V54 H${pulseX} V73`});
  const drive=svgElement('path',{class:'loadout-schematic-path',d:`M455 104 H493 V54 H${coolantX}`});
  const branches=svgElement('path',{class:'loadout-schematic-path',d:`M${fuelX} 54 V73 M${oxidizerX} 54 V73 M${coolantX} 54 V73`});
  svg.append(pulse,drive,branches);
  for(const [cx,cy] of [[325,104],[pulseX,73],[455,104],[493,54],[fuelX,73],[oxidizerX,73],[coolantX,73]]){
    svg.append(svgElement('circle',{class:'loadout-schematic-node',cx,cy,r:cx===493?4.2:3.1}));
  }
  map.append(svg);

  const hitSvg=svgElement('svg',{class:'loadout-slot-overlay',viewBox:'0 0 1000 200',preserveAspectRatio:'none','aria-hidden':'true'});
  for(const use of SLOT_USES){
    const rect=svgElement('rect',{class:'loadout-slot-path','data-use':use,...svgRectGeometry(LOADOUT_SLOT_GEOMETRY[use])});
    rect.addEventListener('click',event=>{event.stopPropagation();document.getElementById(`shell-${use}`)?.click();});
    hitSvg.append(rect);
  }
  map.append(hitSvg);

  for(const [className,text] of [
    ['loadout-callout-label loadout-pulse-label','PULSE'],
    ['loadout-callout-label loadout-drive-label','DRIVE'],
    ['loadout-callout-label loadout-fuel-label','FUEL'],
    ['loadout-callout-label loadout-oxidizer-label','O₂'],
    ['loadout-callout-label loadout-coolant-label','COOLANT'],
  ]){
    const label=document.createElement('span');
    label.className=className;
    label.textContent=text;
    label.setAttribute('aria-hidden','true');
    map.append(label);
  }
}

function applySlotGeometry(){
  for(const use of SLOT_USES){
    const button=document.getElementById(`shell-${use}`),geometry=LOADOUT_SLOT_GEOMETRY[use];
    if(!button||!geometry)continue;
    button.style.setProperty('--slot-left',pct(geometry.left));
    button.style.setProperty('--slot-width',pct(geometry.width));
    button.style.setProperty('--slot-top',pct(geometry.top));
    button.style.setProperty('--slot-height',pct(geometry.height));
  }
  for(const [use,className] of [['propellant','loadout-pulse-label'],['fuel','loadout-fuel-label'],['oxidizer','loadout-oxidizer-label'],['coolant','loadout-coolant-label']]){
    document.querySelector(`.${className}`)?.style.setProperty('--slot-label-x',pct(LOADOUT_SLOT_GEOMETRY[use].labelX));
  }
}

function readSavedLoadout(){
  try{
    const raw=globalThis.localStorage?.getItem(RESOURCE_KEY);
    if(!raw)return {};
    const state=JSON.parse(raw);
    if(state?.loadout?.tanks)return state.loadout.tanks;
    return Object.fromEntries(SLOT_USES.map(use=>[use,state?.tanks?.[use]?.molecule??null]));
  }catch{
    return {};
  }
}

function syncMoleculeSlot(button,id){
  if(!button)return;
  const formula=button.querySelector(':scope>small')?.textContent?.trim()??'';
  let pod=button.querySelector('.loadout-molecule-pod');
  if(!pod){
    pod=document.createElement('span');
    pod.className='loadout-molecule-pod';
    pod.setAttribute('aria-hidden','true');
    button.append(pod);
  }
  if(id){
    let image=pod.querySelector('.loadout-molecule-thumb');
    if(!image){
      image=document.createElement('img');
      image.className='loadout-molecule-thumb';
      image.alt='';
      image.draggable=false;
      image.decoding='async';
      image.addEventListener('error',()=>image.remove());
      pod.append(image);
    }
    if(image.dataset.moleculeId!==id){
      image.dataset.moleculeId=id;
      image.src=MODEL_URL(id);
    }
    let auxiliary=pod.querySelector('.loadout-pod-formula');
    if(!auxiliary){
      auxiliary=document.createElement('small');
      auxiliary.className='loadout-pod-formula';
      pod.append(auxiliary);
    }
    auxiliary.textContent=formula;
    pod.querySelector('.loadout-pod-empty')?.remove();
  }else{
    pod.replaceChildren();
    const empty=document.createElement('span');
    empty.className='loadout-pod-empty';
    empty.textContent='∅';
    pod.append(empty);
  }
  button.classList.toggle('loadout-slot-empty',!id);
  button.dataset.loadoutFormula=formula;
}

function syncMoleculeSlots(map){
  if(!map)return;
  const selected=readSavedLoadout();
  for(const use of SLOT_USES)syncMoleculeSlot(document.getElementById(`shell-${use}`),selected[use]??null);
}

function observeMoleculeSlots(map){
  if(!map||map._loadoutMoleculeObserver)return;
  let scheduled=false;
  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{scheduled=false;syncMoleculeSlots(map);});
  };
  const observer=new MutationObserver(schedule);
  for(const use of SLOT_USES){
    const formula=document.querySelector(`#shell-${use}>small`);
    if(formula)observer.observe(formula,{childList:true,characterData:true,subtree:true});
  }
  map._loadoutMoleculeObserver=observer;
  document.getElementById('tank-molecules')?.addEventListener('click',schedule);
  globalThis.addEventListener?.('storage',event=>{if(event.key===RESOURCE_KEY)schedule();});
  syncMoleculeSlots(map);
}

function shortageRatio(chips){
  let ratio=1;
  for(const chip of chips){
    const match=chip.textContent?.match(/(\d+)\s*\/\s*(\d+)/);
    if(!match)continue;
    const have=Number(match[1]),need=Number(match[2]);
    if(need>0)ratio=Math.min(ratio,have/need);
  }
  return Math.max(0,Math.min(1,ratio));
}

function syncStockPreview(preview){
  if(!preview)return;
  const chips=[...preview.children].filter(node=>node.dataset?.sufficient!==undefined);
  if(!chips.length){preview.hidden=true;return;}
  const insufficient=chips.some(chip=>chip.dataset.sufficient==='false');
  if(!insufficient){preview.hidden=true;return;}
  preview.hidden=false;
  for(const chip of chips)chip.hidden=true;
  const ratio=shortageRatio(chips);
  let status=preview.querySelector('.loadout-shortage-status');
  if(!status){
    status=document.createElement('div');
    status.className='loadout-shortage-status';
    const label=document.createElement('span'),track=document.createElement('i'),fill=document.createElement('b');
    label.textContent='材料不足';
    track.append(fill);
    status.append(label,track);
    preview.append(status);
  }
  if(status.dataset.ratio!==String(ratio)){
    status.dataset.ratio=String(ratio);
    status.querySelector('b').style.transform=`scaleX(${ratio})`;
  }
  preview.setAttribute('aria-label',`材料不足 ${Math.round(ratio*100)}%`);
}

function observeStockPreview(){
  const attach=()=>{
    const preview=document.getElementById('loadout-stock-preview');
    if(!preview||preview._loadoutShortageObserver)return false;
    const observer=new MutationObserver(()=>queueMicrotask(()=>syncStockPreview(preview)));
    observer.observe(preview,{childList:true});
    preview._loadoutShortageObserver=observer;
    syncStockPreview(preview);
    return true;
  };
  if(attach())return;
  const root=document.getElementById('supply-dialog');
  if(!root||root._loadoutShortageWaiter)return;
  const waiter=new MutationObserver(()=>{if(attach()){waiter.disconnect();root._loadoutShortageWaiter=null;}});
  waiter.observe(root,{childList:true,subtree:true});
  root._loadoutShortageWaiter=waiter;
}

function installLabels(){
  const title=document.getElementById('supply-title');
  if(title)title.textContent='LOADOUT';
  const access=document.getElementById('open-supply');
  if(access)access.setAttribute('aria-label','LOADOUTを開く');
  for(const [use,label] of Object.entries(LOADOUT_LABELS)){
    const button=document.getElementById(`shell-${use}`);
    if(!button)continue;
    button.querySelector('span')?.replaceChildren(label);
    button.setAttribute('aria-label',`${label}を選ぶ`);
  }
  const map=document.querySelector('#supply-dialog .collector-shell-map');
  addUnitImages(map);
  addSchematic(map);
  applySlotGeometry();
  observeMoleculeSlots(map);
  observeStockPreview();
  const details=document.querySelector('#supply-dialog .tank-explanation');
  if(details)details.open=true;
}

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#supply-dialog .collector-shell-map{--loadout-pulse-left:2.5%;--loadout-pulse-width:24%;--loadout-ship-x:39%;--loadout-drive-left:51.5%;--loadout-drive-width:46%;height:202px!important;border-color:#294656;background:radial-gradient(circle at var(--loadout-ship-x) 52%,#173c4d 0 17%,#0a1a27 37%,#071520 78%);overflow:hidden}
#supply-dialog .collector-shell-map:before,#supply-dialog .collector-shell-map:after,#supply-dialog .collector-core{display:none!important}
#supply-dialog .loadout-unit-image{position:absolute;z-index:2;display:block;object-fit:contain;pointer-events:none;user-select:none;transition:opacity .14s ease,filter .14s ease}
#supply-dialog .loadout-pulse-image{left:var(--loadout-pulse-left);top:52%;width:var(--loadout-pulse-width);height:64px;transform:translateY(-50%)}
#supply-dialog .loadout-drive-image{left:var(--loadout-drive-left);top:52%;width:var(--loadout-drive-width);height:auto;aspect-ratio:320/113;transform:translateY(-50%)}
#supply-dialog .loadout-schematic-lines{position:absolute;inset:0;z-index:3;width:100%;height:100%;pointer-events:none;overflow:visible;filter:drop-shadow(0 0 3px #76d8e445);transition:opacity .14s ease}
#supply-dialog .loadout-schematic-path{fill:none;stroke:#a9dce4;stroke-width:1.8;vector-effect:non-scaling-stroke;stroke-linecap:square;stroke-linejoin:miter;opacity:.72}
#supply-dialog .loadout-schematic-node{fill:#d9f5f8;stroke:#6dbbc7;stroke-width:1.2;vector-effect:non-scaling-stroke;opacity:.9}
#supply-dialog .loadout-slot-overlay{position:absolute;inset:0;z-index:5;width:100%;height:100%;overflow:visible;pointer-events:none}
#supply-dialog .loadout-slot-path{fill:#a9f1f5;fill-opacity:.001;stroke:transparent;stroke-width:1.6;vector-effect:non-scaling-stroke;pointer-events:visibleFill;cursor:pointer;touch-action:manipulation;transition:fill-opacity .12s ease,stroke .12s ease,filter .12s ease}
#supply-dialog .collector-shell-map:has(#shell-propellant[data-active=true]) .loadout-slot-path[data-use='propellant'],#supply-dialog .collector-shell-map:has(#shell-fuel[data-active=true]) .loadout-slot-path[data-use='fuel'],#supply-dialog .collector-shell-map:has(#shell-oxidizer[data-active=true]) .loadout-slot-path[data-use='oxidizer'],#supply-dialog .collector-shell-map:has(#shell-coolant[data-active=true]) .loadout-slot-path[data-use='coolant']{fill-opacity:.12;stroke:#a8edf5d6;filter:drop-shadow(0 0 5px #74d6e177)}
#supply-dialog .loadout-callout-label{position:absolute;z-index:6;color:#d8e8ed;font-size:11px;font-weight:800;line-height:1;letter-spacing:.09em;pointer-events:none;user-select:none;text-shadow:0 1px 4px #000,0 0 7px #6dc8d044;transition:opacity .14s ease,color .12s ease}
#supply-dialog .loadout-pulse-label{left:var(--slot-label-x,15.05%);top:22px;transform:translateX(-50%)}
#supply-dialog .loadout-drive-label{left:75.50%;top:17px;transform:translateX(-50%);font-size:12px;letter-spacing:.14em}
#supply-dialog .loadout-fuel-label,#supply-dialog .loadout-oxidizer-label,#supply-dialog .loadout-coolant-label{left:var(--slot-label-x);top:69%;transform:translateX(-50%)}
#supply-dialog #collector-shell-preview{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;z-index:1!important}
#supply-dialog #collector-launch-handle{left:var(--loadout-ship-x)!important;top:52%!important;width:76px!important;height:76px!important}
#supply-dialog #expedition-destinations button{left:var(--loadout-ship-x)!important;top:52%!important}
#supply-dialog .shell-port{z-index:0!important;min-width:0!important;min-height:0!important;margin:0!important;box-sizing:border-box;left:var(--slot-left)!important;right:auto!important;top:var(--slot-top)!important;bottom:auto!important;width:var(--slot-width)!important;height:var(--slot-height)!important;transform:none!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:#d9e8ed;overflow:visible;pointer-events:none;transition:opacity .14s ease}
#supply-dialog .shell-port>i,#supply-dialog .shell-port>span:not(.loadout-molecule-pod):not(.tank-scale),#supply-dialog .shell-port>small{display:none!important}
#supply-dialog .shell-port .tank-scale{display:none!important}
#supply-dialog .loadout-molecule-pod{position:absolute;z-index:0;left:50%;top:100%;width:145%;height:54px;transform:translate(-50%,-58%);display:grid;place-items:center;padding:0;box-sizing:border-box;border:0;border-radius:0;background:none;box-shadow:none;pointer-events:none;user-select:none}
#supply-dialog .loadout-molecule-thumb{width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;filter:drop-shadow(0 1px 3px #000b) drop-shadow(0 0 5px #9ce9f044)}
#supply-dialog .loadout-pod-formula{display:none!important}
#supply-dialog .loadout-pod-empty{align-self:center;color:#c7e7ed;font-size:18px;font-weight:700;opacity:.62}
#supply-dialog #shell-fuel:not(.loadout-slot-empty)>.loadout-molecule-pod{left:18%}
#supply-dialog #shell-coolant:not(.loadout-slot-empty)>.loadout-molecule-pod{left:82%}
#supply-dialog .port-propellant>.loadout-molecule-pod{width:175%;height:62px;top:100%;transform:translate(-50%,-58%)}
#supply-dialog .loadout-slot-empty>.loadout-molecule-pod{left:50%;top:calc(100% + 16px);width:100%;height:24px;transform:translateX(-50%)}
#supply-dialog .collector-shell-map:has(#shell-propellant[data-active=true]) .loadout-pulse-label,#supply-dialog .collector-shell-map:has(#shell-fuel[data-active=true]) .loadout-fuel-label,#supply-dialog .collector-shell-map:has(#shell-oxidizer[data-active=true]) .loadout-oxidizer-label,#supply-dialog .collector-shell-map:has(#shell-coolant[data-active=true]) .loadout-coolant-label{color:#f0fdff;text-shadow:0 1px 4px #000,0 0 9px #83dbe477}
#supply-dialog .collector-shell-map:has(#shell-fuel[data-active=true]) .loadout-drive-label,#supply-dialog .collector-shell-map:has(#shell-oxidizer[data-active=true]) .loadout-drive-label,#supply-dialog .collector-shell-map:has(#shell-coolant[data-active=true]) .loadout-drive-label{color:#f0fdff}
#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-unit-image,#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-schematic-lines,#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-slot-overlay,#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-callout-label{opacity:.28}
#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-slot-path{pointer-events:none}
#supply-dialog #loadout-stock-preview{display:grid!important;grid-template-columns:1fr!important;width:min(330px,calc(100% - 44px));min-height:0!important;margin:8px auto 0;padding:0!important}
#supply-dialog #loadout-stock-preview[hidden]{display:none!important}
#supply-dialog .loadout-shortage-status{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:10px;width:100%;color:#bfd0d6;font-size:10px;font-weight:700;letter-spacing:.04em}
#supply-dialog .loadout-shortage-status>i{position:relative;display:block;height:6px;overflow:hidden;border-radius:8px;background:#203844;box-shadow:inset 0 1px 2px #0008}
#supply-dialog .loadout-shortage-status>i>b{position:absolute;inset:0;border-radius:inherit;transform-origin:left;background:linear-gradient(90deg,#6db8c6,#9edce5);box-shadow:0 0 8px #77d1dc44;transition:transform .18s ease}
#supply-dialog .tank-explanation{display:block!important}#supply-dialog .tank-explanation>summary{display:none!important}#supply-dialog .tank-explanation .tank-comparison{margin-top:0!important}#supply-dialog .tank-decision{justify-content:center}#supply-dialog .tank-comparison{gap:7px!important;padding:2px 0}
#supply-dialog .tank-comparison .loadout-stat{display:grid!important;grid-template-columns:62px 1fr!important;align-items:center;gap:8px!important;min-height:16px;color:#a9c0ca;font-size:9px!important}
#supply-dialog .tank-comparison .loadout-stat>span{overflow:visible!important;text-overflow:clip!important;white-space:nowrap!important}
#supply-dialog .tank-comparison .loadout-stat>i{position:relative;display:block;height:7px;overflow:visible!important;border-radius:5px;background:#233b48}
#supply-dialog .tank-comparison .loadout-stat>i>b{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;transform-origin:left;background:#a7e2eb}
#supply-dialog .tank-comparison .loadout-stat>i>em{position:absolute;z-index:2;top:-2px;width:2px;height:11px;background:#f3dc8d;box-shadow:0 0 4px #061018;transform:translateX(-1px)}
#supply-dialog .loadout-charges{display:grid;grid-template-columns:62px 1fr;align-items:center;gap:8px;padding:0;min-height:16px;color:#a9c0ca;font-size:9px}
#supply-dialog .loadout-charges>div{display:flex;align-items:center;gap:4px;min-height:11px;flex-wrap:wrap}#supply-dialog .loadout-charges i{display:block;width:8px;height:8px;border-radius:50%;background:#a7e2eb;box-shadow:0 0 5px #71ccd933}#supply-dialog .loadout-charges[data-ghost=true]{opacity:.38}
#supply-dialog #tank-detail-title{font-size:0}#supply-dialog #tank-detail-title:after{font-size:14px;font-weight:700;letter-spacing:.04em}
#supply-dialog:has(#shell-propellant[data-active='true']) #tank-detail-title:after{content:'PULSE'}#supply-dialog:has(#shell-fuel[data-active='true']) #tank-detail-title:after{content:'FUEL'}#supply-dialog:has(#shell-oxidizer[data-active='true']) #tank-detail-title:after{content:'O₂'}#supply-dialog:has(#shell-coolant[data-active='true']) #tank-detail-title:after{content:'COOLANT'}
@media(max-width:370px){#supply-dialog .collector-shell-map{height:194px!important}#supply-dialog #collector-launch-handle{width:70px!important;height:70px!important}#supply-dialog .loadout-molecule-pod{height:50px;transform:translate(-50%,-56%)}#supply-dialog .port-propellant>.loadout-molecule-pod{height:56px;transform:translate(-50%,-56%)}#supply-dialog .loadout-slot-empty>.loadout-molecule-pod{height:24px;transform:translateX(-50%)}#supply-dialog .loadout-callout-label{font-size:10px}#supply-dialog .loadout-drive-label{top:15px;font-size:11px}#supply-dialog .loadout-pulse-label{top:20px}#supply-dialog .loadout-fuel-label,#supply-dialog .loadout-oxidizer-label,#supply-dialog .loadout-coolant-label{top:68.5%}#supply-dialog .tank-comparison .loadout-stat,#supply-dialog .loadout-charges{grid-template-columns:55px 1fr}#supply-dialog .loadout-shortage-status{gap:8px;font-size:9.5px}}
@media(prefers-reduced-motion:reduce){#supply-dialog .shell-port,#supply-dialog .loadout-unit-image,#supply-dialog .loadout-schematic-lines,#supply-dialog .loadout-slot-path,#supply-dialog .loadout-callout-label,#supply-dialog .loadout-shortage-status>i>b{transition:none}}
`;
  document.head.append(style);
}

export function installLoadoutWorkstation(){
  if(typeof document==='undefined')return false;
  installStyles();
  installLabels();
  return true;
}

if(typeof document!=='undefined')installLoadoutWorkstation();