import { RESOURCE_KEY } from './resources.js';
import { ELEMENT_PRESENTATION } from '../element-progression.js?v=39';

const STYLE_ID='molecule-craft-loadout-workstation-style';
const PULSE_UNIT_URL=new URL('../../assets/loadout-pulse-unit.png',import.meta.url).href;
const DRIVE_UNIT_URL=new URL('../../assets/loadout-drive-unit.png',import.meta.url).href;
const MODEL_URL=id=>new URL(`../../assets/models/molecule-${id}.svg`,import.meta.url).href;
const SLOT_USES=['propellant','shock','fuel','oxidizer','coolant'];
const PULSE_SLOT_FRAME=Object.freeze({width:10.9,top:38.5,height:27.0});
const SHOCK_SLOT_FRAME=Object.freeze({width:15.0,top:11.0,height:18.0});
const DRIVE_SLOT_FRAME=Object.freeze({width:10.0,top:38.0,height:27.0});

const slotGeometry=(centerX,frame)=>Object.freeze({
  centerX,
  left:Number((centerX-frame.width/2).toFixed(2)),
  width:frame.width,
  top:frame.top,
  height:frame.height,
  labelX:centerX,
});

export const LOADOUT_LABELS=Object.freeze({propellant:'PULSE',shock:'SHOCK',fuel:'FUEL',oxidizer:'O₂',coolant:'COOLANT'});
export const LOADOUT_SLOT_GEOMETRY=Object.freeze({
  propellant:slotGeometry(16.05,PULSE_SLOT_FRAME),
  shock:slotGeometry(39.00,SHOCK_SLOT_FRAME),
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
  const fuelX=Math.round(centerX('fuel')*10),oxidizerX=Math.round(centerX('oxidizer')*10),coolantX=Math.round(centerX('coolant')*10),pulseX=Math.round(centerX('propellant')*10),shockX=Math.round(centerX('shock')*10);
  const svg=svgElement('svg',{class:'loadout-schematic-lines',viewBox:'0 0 1000 200',preserveAspectRatio:'none','aria-hidden':'true'});
  const pulse=svgElement('path',{class:'loadout-schematic-path',d:`M325 104 H286 V54 H${pulseX} V73`});
  const drive=svgElement('path',{class:'loadout-schematic-path',d:`M455 104 H493 V54 H${coolantX}`});
  const shock=svgElement('path',{class:'loadout-schematic-path',d:`M390 74 V58`});
  const branches=svgElement('path',{class:'loadout-schematic-path',d:`M${fuelX} 54 V73 M${oxidizerX} 54 V73 M${coolantX} 54 V73`});
  svg.append(pulse,drive,shock,branches);
  for(const [cx,cy] of [[325,104],[pulseX,73],[390,74],[shockX,58],[455,104],[493,54],[fuelX,73],[oxidizerX,73],[coolantX,73]]){
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
    ['loadout-callout-label loadout-shock-label','SHOCK'],
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
  for(const [use,className] of [['propellant','loadout-pulse-label'],['shock','loadout-shock-label'],['fuel','loadout-fuel-label'],['oxidizer','loadout-oxidizer-label'],['coolant','loadout-coolant-label']]){
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

function installLoadoutElementStock(map){
  if(!map)return null;
  let stock=document.getElementById('loadout-element-stock');
  if(stock)return stock;
  stock=document.createElement('section');stock.id='loadout-element-stock';stock.className='loadout-element-stock';stock.setAttribute('aria-label','BASE STOCK');
  const heading=document.createElement('span');heading.className='loadout-element-stock-title';heading.textContent='BASE STOCK';
  const elements=document.createElement('div');elements.className='loadout-stock-elements';
  for(const item of ELEMENT_PRESENTATION){
    const token=document.createElement('div');token.className='loadout-element-token';token.dataset.loadoutStockElement=item.symbol;token.dataset.stockCount='0';token.hidden=true;token.style.setProperty('--element-color',item.color);token.setAttribute('role','img');
    const atom=document.createElement('span');atom.className='atom-preview';atom.setAttribute('aria-hidden','true');
    const symbol=document.createElement('strong');symbol.textContent=item.symbol;const count=document.createElement('small');count.dataset.loadoutElementStock=item.symbol;count.textContent='0';
    token.append(atom,symbol,count);elements.append(token);
  }
  stock.append(heading,elements);map.after(stock);return stock;
}

export function syncLoadoutElementStock(resources,root=document){
  const stock=root.querySelector?.('#loadout-element-stock');if(!stock||!resources?.state?.elements)return false;let visible=0;
  for(const token of stock.querySelectorAll('[data-loadout-stock-element]')){
    const symbol=token.dataset.loadoutStockElement,item=ELEMENT_PRESENTATION.find(candidate=>candidate.symbol===symbol),unlocked=resources.canUseElement?.(symbol)===true,count=Math.max(0,Number(resources.state.elements[symbol]??0));
    token.hidden=!unlocked;token.dataset.stockCount=String(count);token.querySelector('[data-loadout-element-stock]')?.replaceChildren(String(count));
    if(item)token.setAttribute('aria-label',`${item.name}（${symbol}） BASE STOCK ${count}`);if(unlocked)visible++;
  }
  stock.hidden=visible===0;return true;
}

function ensureLaunchIntakeAnchor(map){
  if(!map)return null;let anchor=map.querySelector('[data-launch-intake-anchor]');if(anchor)return anchor;
  anchor=document.createElement('span');anchor.className='loadout-synthesis-intake';anchor.dataset.launchIntakeAnchor='true';anchor.setAttribute('aria-hidden','true');map.append(anchor);return anchor;
}

export function syncLaunchIntakeAnchor(map=document.querySelector?.('#supply-dialog .collector-shell-map')){
  if(!map)return false;const anchor=ensureLaunchIntakeAnchor(map),canvas=map.querySelector('#collector-shell-preview'),movement=canvas?.style.transform?.trim()??'';
  anchor.style.transform=`translate(-50%,-50%)${movement?` ${movement}`:''}`;return true;
}

function observeLaunchIntakeAnchor(map){
  const canvas=map?.querySelector('#collector-shell-preview');if(!canvas||canvas._loadoutIntakeObserver)return;
  const observer=new MutationObserver(()=>syncLaunchIntakeAnchor(map));observer.observe(canvas,{attributes:true,attributeFilter:['style']});canvas._loadoutIntakeObserver=observer;syncLaunchIntakeAnchor(map);
}

export async function animateLoadoutElementTransfer({cost={},root=document,reduced=false}={}){
  const dialog=root.querySelector?.('#supply-dialog'),map=root.querySelector?.('#supply-dialog .collector-shell-map');if(!dialog||!map)return {animated:false,reason:'missing-loadout'};
  const entries=Object.entries(cost??{}).filter(([,amount])=>Number(amount)>0);if(!entries.length)return {animated:false,reason:'no-cost'};
  if(reduced)return {animated:false,reason:'reduced-motion'};
  const canvas=map.querySelector('#collector-shell-preview');for(const animation of canvas?.getAnimations?.()??[])try{await animation.finished;}catch{}
  syncLaunchIntakeAnchor(map);const intake=map.querySelector('[data-launch-intake-anchor]'),targetRect=intake?.getBoundingClientRect();
  if(!targetRect||targetRect.width<=0||targetRect.height<=0)return {animated:false,reason:'missing-intake'};
  const doc=root.ownerDocument??root,layer=doc.createElement('div');layer.className='loadout-transfer-layer';layer.setAttribute('aria-hidden','true');dialog.append(layer);map.dataset.synthesisActive='true';
  const targetX=targetRect.left+targetRect.width/2,targetY=targetRect.top+targetRect.height/2,finished=[];let sequence=0;
  try{
    for(const [element,amount] of entries){
      const token=map.parentElement?.querySelector(`[data-loadout-stock-element="${element}"]`)??root.querySelector?.(`[data-loadout-stock-element="${element}"]`),source=token?.querySelector('.atom-preview'),sourceRect=source?.getBoundingClientRect();if(token?.hidden||!sourceRect||sourceRect.width<=0||sourceRect.height<=0)continue;
      const startX=sourceRect.left+sourceRect.width/2,startY=sourceRect.top+sourceRect.height/2,copies=Math.min(4,Math.max(1,Math.floor(Number(amount))));
      for(let index=0;index<copies;index++){
        const dot=doc.createElement('span'),meta=ELEMENT_PRESENTATION.find(item=>item.symbol===element),size=22,dx=targetX-startX,dy=targetY-startY,bend=((sequence%3)-1)*14;
        dot.className='loadout-transfer-atom atom-preview';dot.dataset.element=element;dot.dataset.startX=String(startX);dot.dataset.startY=String(startY);dot.dataset.targetX=String(targetX);dot.dataset.targetY=String(targetY);dot.textContent=element;dot.style.setProperty('--element-color',meta?.color??'#bfefff');Object.assign(dot.style,{left:`${startX-size/2}px`,top:`${startY-size/2}px`});layer.append(dot);
        const animation=dot.animate?.([
          {transform:'translate(0px,0px) scale(.72)',opacity:.28},
          {transform:`translate(${dx*.54+bend}px,${dy*.42}px) scale(1)`,opacity:1,offset:.56},
          {transform:`translate(${dx}px,${dy}px) scale(.2)`,opacity:0},
        ],{duration:430,delay:sequence*26,easing:'cubic-bezier(.3,.75,.25,1)',fill:'forwards'});if(animation?.finished)finished.push(animation.finished.catch(()=>{}));sequence++;
      }
    }
    if(!sequence)return {animated:false,reason:'missing-source'};if(finished.length)await Promise.all(finished);return {animated:true,elements:entries.map(([element])=>element),target:{x:targetX,y:targetY}};
  }finally{delete map.dataset.synthesisActive;layer.remove();}
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
  installLoadoutElementStock(map);ensureLaunchIntakeAnchor(map);observeLaunchIntakeAnchor(map);
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
#supply-dialog .collector-shell-map:has(#shell-propellant[data-active=true]) .loadout-slot-path[data-use='propellant'],#supply-dialog .collector-shell-map:has(#shell-shock[data-active=true]) .loadout-slot-path[data-use='shock'],#supply-dialog .collector-shell-map:has(#shell-fuel[data-active=true]) .loadout-slot-path[data-use='fuel'],#supply-dialog .collector-shell-map:has(#shell-oxidizer[data-active=true]) .loadout-slot-path[data-use='oxidizer'],#supply-dialog .collector-shell-map:has(#shell-coolant[data-active=true]) .loadout-slot-path[data-use='coolant']{fill-opacity:.12;stroke:#a8edf5d6;filter:drop-shadow(0 0 5px #74d6e177)}
#supply-dialog .loadout-callout-label{position:absolute;z-index:6;color:#d8e8ed;font-size:11px;font-weight:800;line-height:1;letter-spacing:.09em;pointer-events:none;user-select:none;text-shadow:0 1px 4px #000,0 0 7px #6dc8d044;transition:opacity .14s ease,color .12s ease}
#supply-dialog .loadout-pulse-label{left:var(--slot-label-x,15.05%);top:22px;transform:translateX(-50%)}
#supply-dialog .loadout-shock-label{left:var(--slot-label-x,39%);top:3px;transform:translateX(-50%);font-size:10px;letter-spacing:.12em}
#supply-dialog .loadout-drive-label{left:75.50%;top:17px;transform:translateX(-50%);font-size:12px;letter-spacing:.14em}
#supply-dialog .loadout-fuel-label,#supply-dialog .loadout-oxidizer-label,#supply-dialog .loadout-coolant-label{left:var(--slot-label-x);top:69%;transform:translateX(-50%)}
#supply-dialog #collector-shell-preview{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;z-index:1!important}
#supply-dialog #collector-launch-handle{left:var(--loadout-ship-x)!important;top:52%!important;width:76px!important;height:76px!important}
#supply-dialog #expedition-destinations button{left:var(--loadout-ship-x)!important;top:52%!important}
#supply-dialog .shell-port{z-index:0!important;min-width:0!important;min-height:0!important;margin:0!important;box-sizing:border-box;left:var(--slot-left)!important;right:auto!important;top:var(--slot-top)!important;bottom:auto!important;width:var(--slot-width)!important;height:var(--slot-height)!important;transform:none!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:#d9e8ed;overflow:visible;pointer-events:none;transition:opacity .14s ease}
#supply-dialog .shell-port>i,#supply-dialog .shell-port>span:not(.loadout-molecule-pod):not(.tank-scale),#supply-dialog .shell-port>small{display:none!important}
#supply-dialog .shell-port .tank-scale{display:none!important}
#supply-dialog #shell-shock{border:1px solid #75cbd6a8!important;border-radius:50%!important;background:radial-gradient(circle,#28586655 0 28%,#112b3888 31% 55%,transparent 58%)!important;box-shadow:0 0 10px #66dce42c!important}
#supply-dialog #shell-shock:before,#supply-dialog #shell-shock:after{content:'';position:absolute;border:1px solid #8de5eb75;border-radius:50%;pointer-events:none}#supply-dialog #shell-shock:before{inset:16%}#supply-dialog #shell-shock:after{inset:31%;border-color:#c9f5f7aa}
#supply-dialog #shell-shock>.loadout-molecule-pod{top:50%;width:76%;height:34px;transform:translate(-50%,-50%)}
#supply-dialog .loadout-molecule-pod{position:absolute;z-index:0;left:50%;top:calc(100% + 28px);width:145%;height:54px;transform:translate(-50%,-50%);display:grid;place-items:center;padding:0;box-sizing:border-box;border:0;border-radius:0;background:none;box-shadow:none;pointer-events:none;user-select:none}
#supply-dialog .loadout-molecule-thumb{width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;filter:drop-shadow(0 1px 3px #000b) drop-shadow(0 0 5px #9ce9f044)}
#supply-dialog .loadout-pod-formula{display:none!important}
#supply-dialog .loadout-pod-empty{align-self:center;color:#c7e7ed;font-size:18px;font-weight:700;opacity:.62}
#supply-dialog #shell-fuel:not(.loadout-slot-empty)>.loadout-molecule-pod{left:18%}
#supply-dialog #shell-coolant:not(.loadout-slot-empty)>.loadout-molecule-pod{left:82%}
#supply-dialog .port-propellant>.loadout-molecule-pod{width:175%;height:62px;top:calc(100% + 28px);transform:translate(-50%,-50%)}
#supply-dialog .loadout-slot-empty>.loadout-molecule-pod{left:50%;top:calc(100% + 16px);width:100%;height:24px;transform:translateX(-50%)}
#supply-dialog .collector-shell-map:has(#shell-propellant[data-active=true]) .loadout-pulse-label,#supply-dialog .collector-shell-map:has(#shell-shock[data-active=true]) .loadout-shock-label,#supply-dialog .collector-shell-map:has(#shell-fuel[data-active=true]) .loadout-fuel-label,#supply-dialog .collector-shell-map:has(#shell-oxidizer[data-active=true]) .loadout-oxidizer-label,#supply-dialog .collector-shell-map:has(#shell-coolant[data-active=true]) .loadout-coolant-label{color:#f0fdff;text-shadow:0 1px 4px #000,0 0 9px #83dbe477}
#supply-dialog .collector-shell-map:has(#shell-fuel[data-active=true]) .loadout-drive-label,#supply-dialog .collector-shell-map:has(#shell-oxidizer[data-active=true]) .loadout-drive-label,#supply-dialog .collector-shell-map:has(#shell-coolant[data-active=true]) .loadout-drive-label{color:#f0fdff}
#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-unit-image,#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-schematic-lines,#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-slot-overlay,#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-callout-label{opacity:.28}
#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-slot-path{pointer-events:none}
#supply-dialog .loadout-synthesis-intake{position:absolute;z-index:7;left:var(--loadout-ship-x);top:52%;width:10px;height:10px;border-radius:50%;opacity:0;pointer-events:none;box-shadow:0 0 0 0 #bff7ff00;transition:opacity .12s ease,box-shadow .12s ease}
#supply-dialog .collector-shell-map[data-synthesis-active='true'] .loadout-synthesis-intake{opacity:.92;box-shadow:0 0 6px 2px #d9fbff,0 0 18px 8px #75dbe877}
#supply-dialog .loadout-element-stock{display:grid;gap:6px;margin:8px 0 0;padding:8px 10px;border:1px solid #294656;border-radius:13px;background:#091b27;pointer-events:none;user-select:none}
#supply-dialog .loadout-element-stock-title{color:#8ea9b5;font-size:9px;font-weight:800;letter-spacing:.16em}
#supply-dialog .loadout-stock-elements{display:grid;grid-template-columns:repeat(auto-fit,minmax(54px,1fr));gap:7px}
#supply-dialog .loadout-element-token{min-width:0;min-height:50px;display:grid;grid-template-columns:auto 1fr;grid-template-rows:1fr 1fr;align-items:center;column-gap:7px;padding:5px 7px;border:1px solid color-mix(in srgb,var(--element-color) 55%,#294656);border-radius:11px;background:color-mix(in srgb,var(--element-color) 10%,#0b202b);font-variant-numeric:tabular-nums;cursor:default}
#supply-dialog .loadout-element-token>.atom-preview{grid-row:1 / 3;width:24px;height:24px}
#supply-dialog .loadout-element-token[data-loadout-stock-element='H']>.atom-preview{width:20px;height:20px}
#supply-dialog .loadout-element-token>strong{align-self:end;font-size:13px;line-height:1}
#supply-dialog .loadout-element-token>small{align-self:start;color:#b6c9d8;font-size:10px;font-weight:700;line-height:1.2}
#supply-dialog .loadout-element-token[data-stock-count='0']>small{opacity:.52}
#supply-dialog .loadout-transfer-layer{position:fixed;inset:0;z-index:30;pointer-events:none;overflow:visible}
#supply-dialog .loadout-transfer-atom{position:absolute!important;width:22px!important;height:22px!important;display:grid!important;place-items:center!important;color:#07141f;font-size:8px;font-weight:900;line-height:1;will-change:transform,opacity;text-shadow:0 1px 1px #fff8}
#supply-dialog .tank-explanation{display:block!important}#supply-dialog .tank-explanation>summary{display:none!important}#supply-dialog .tank-explanation .tank-comparison{margin-top:0!important}#supply-dialog .tank-decision{justify-content:center}#supply-dialog .tank-comparison{gap:7px!important;padding:2px 0}
#supply-dialog .tank-comparison .loadout-stat{display:grid!important;grid-template-columns:62px 1fr!important;align-items:center;gap:8px!important;min-height:16px;color:#a9c0ca;font-size:9px!important}
#supply-dialog .tank-comparison .loadout-stat>span{overflow:visible!important;text-overflow:clip!important;white-space:nowrap!important}
#supply-dialog .tank-comparison .loadout-stat>i{position:relative;display:block;height:7px;overflow:visible!important;border-radius:5px;background:#233b48}
#supply-dialog .tank-comparison .loadout-stat>i>b{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;transform-origin:left;background:#a7e2eb}
#supply-dialog .tank-comparison .loadout-stat>i>em{position:absolute;z-index:2;top:-2px;width:2px;height:11px;background:#f3dc8d;box-shadow:0 0 4px #061018;transform:translateX(-1px)}
#supply-dialog .loadout-charges{display:grid;grid-template-columns:62px 1fr;align-items:center;gap:8px;padding:0;min-height:16px;color:#a9c0ca;font-size:9px}
#supply-dialog .loadout-charges>div{display:flex;align-items:center;gap:4px;min-height:11px;flex-wrap:wrap}#supply-dialog .tank-comparison .loadout-role-cue{margin:5px 0 0;color:#79aab8;font-size:9px;letter-spacing:.06em}
#supply-dialog .loadout-charges i{display:block;width:8px;height:8px;border-radius:50%;background:#a7e2eb;box-shadow:0 0 5px #71ccd933}#supply-dialog .loadout-charges[data-ghost=true]{opacity:.38}
#supply-dialog .loadout-oxygen-capacity{display:grid;gap:7px;padding:8px 9px;border:1px solid #365361;border-radius:10px;background:linear-gradient(135deg,#102833,#0b1c26);color:#c3d5dc;font-variant-numeric:tabular-nums}
#supply-dialog .loadout-oxygen-capacity>header{display:flex;align-items:center;justify-content:space-between;gap:8px}
#supply-dialog .loadout-oxygen-capacity>header>span{font-size:9px;font-weight:750;letter-spacing:.09em;color:#97b8c3}
#supply-dialog .loadout-oxygen-capacity>header>strong{font-size:25px;line-height:1;color:#f2fcff}
#supply-dialog .loadout-oxygen-stages{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin:0;padding:0;list-style:none}
#supply-dialog .loadout-oxygen-stages>li{display:grid;grid-template-rows:auto 10px;align-content:center;justify-items:center;min-width:0;min-height:39px;padding:4px 2px;border:1px solid #38505a;border-radius:7px;background:#0b1a22;color:#8ca4ad}
#supply-dialog .loadout-oxygen-stages>li>strong{font-size:13px;line-height:1.1}
#supply-dialog .loadout-oxygen-stages>li>small{font-size:7px;line-height:1.1;font-weight:800;letter-spacing:.06em;color:#718991}
#supply-dialog .loadout-oxygen-stages>li[data-state=complete]{border-color:#486571;color:#a8c1c9}
#supply-dialog .loadout-oxygen-stages>li[data-state=current]{border-color:#7fcbd6;background:#153743;color:#f0fdff;box-shadow:inset 0 0 0 1px #7fcbd633}
#supply-dialog .loadout-oxygen-stages>li[data-state=current]>small{color:#a4e7ef}
#supply-dialog .loadout-oxygen-stages>li[data-state=next]{border-style:dashed;color:#d6c990}
#supply-dialog .loadout-oxygen-next{margin:0;color:#b9cbd1;font-size:9px;font-weight:750;letter-spacing:.04em;text-align:right}
#supply-dialog #tank-detail-title{font-size:0}#supply-dialog #tank-detail-title:after{font-size:14px;font-weight:700;letter-spacing:.04em}
#supply-dialog:has(#shell-propellant[data-active='true']) #tank-detail-title:after{content:'PULSE'}#supply-dialog:has(#shell-shock[data-active='true']) #tank-detail-title:after{content:'SHOCK'}#supply-dialog:has(#shell-fuel[data-active='true']) #tank-detail-title:after{content:'FUEL'}#supply-dialog:has(#shell-oxidizer[data-active='true']) #tank-detail-title:after{content:'O₂'}#supply-dialog:has(#shell-coolant[data-active='true']) #tank-detail-title:after{content:'COOLANT'}
@media(max-width:520px) and (orientation:portrait){#supply-dialog .sheet-header{padding:11px 16px}#supply-dialog .sheet-body{padding:12px 14px 14px;gap:8px}#supply-dialog .collector-shell-map{height:184px!important}#supply-dialog .loadout-element-stock{grid-template-columns:54px minmax(0,1fr);align-items:center;gap:6px;margin:2px 0 0;padding:5px 7px;border-radius:11px}#supply-dialog .loadout-element-stock-title{font-size:8px;line-height:1.05;letter-spacing:.08em;white-space:nowrap}#supply-dialog .loadout-stock-elements{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}#supply-dialog .loadout-element-token{min-height:42px;column-gap:4px;padding:3px 4px;border-radius:9px}#supply-dialog .loadout-element-token>.atom-preview{width:20px;height:20px}#supply-dialog .loadout-element-token[data-loadout-stock-element='H']>.atom-preview{width:17px;height:17px}#supply-dialog .loadout-element-token>strong{font-size:12px}#supply-dialog .loadout-element-token>small{font-size:9px}#supply-dialog .tank-detail{gap:7px;padding:9px 10px}#supply-dialog .tank-molecules{gap:6px;padding-bottom:3px}#supply-dialog .tank-molecules button{grid-template-rows:46px auto 10px;min-height:96px;padding:4px 5px}#supply-dialog .tank-molecules button img{width:68px;height:46px}#supply-dialog .tank-inspector{gap:7px;min-height:142px}#supply-dialog .tank-model #tank-model-host .model-stage{height:108px}}
@media(max-width:370px){#supply-dialog .collector-shell-map{height:176px!important}#supply-dialog #collector-launch-handle{width:70px!important;height:70px!important}#supply-dialog .loadout-molecule-pod{height:50px;transform:translate(-50%,-50%)}#supply-dialog .port-propellant>.loadout-molecule-pod{height:56px;transform:translate(-50%,-50%)}#supply-dialog .loadout-slot-empty>.loadout-molecule-pod{height:24px;transform:translateX(-50%)}#supply-dialog .loadout-callout-label{font-size:10px}#supply-dialog .loadout-drive-label{top:15px;font-size:11px}#supply-dialog .loadout-pulse-label{top:20px}#supply-dialog .loadout-fuel-label,#supply-dialog .loadout-oxidizer-label,#supply-dialog .loadout-coolant-label{top:68.5%}#supply-dialog .tank-comparison .loadout-stat,#supply-dialog .loadout-charges{grid-template-columns:55px 1fr}#supply-dialog .loadout-stock-elements{grid-template-columns:repeat(4,minmax(0,1fr))!important}#supply-dialog .sheet-body{padding:9px 10px 10px;gap:6px}#supply-dialog .loadout-element-stock{grid-template-columns:50px minmax(0,1fr);padding:4px 6px;gap:5px}#supply-dialog .tank-molecules button{grid-template-rows:42px auto 10px;min-height:90px}#supply-dialog .tank-molecules button img{height:42px}#supply-dialog .tank-inspector{min-height:132px}#supply-dialog .tank-model #tank-model-host .model-stage{height:96px}}
@media(max-width:340px) and (max-height:680px){#supply-dialog .collector-shell-map{height:164px!important}#supply-dialog .sheet-header{padding:8px 10px}#supply-dialog .sheet-body{padding:7px 8px 8px;gap:5px}#supply-dialog .loadout-element-stock{grid-template-columns:48px minmax(0,1fr);padding:4px 5px;gap:4px}#supply-dialog .loadout-element-token{min-height:38px;padding:2px 3px}#supply-dialog .loadout-element-token>.atom-preview{width:18px;height:18px}#supply-dialog .loadout-element-token[data-loadout-stock-element='H']>.atom-preview{width:16px;height:16px}#supply-dialog .tank-detail{gap:5px;padding:7px 8px}#supply-dialog .tank-molecules button{grid-template-rows:40px auto 9px;min-height:86px}#supply-dialog .tank-molecules button img{height:40px}#supply-dialog .tank-inspector{min-height:120px;gap:5px}#supply-dialog .tank-model #tank-model-host .model-stage{height:88px}}
@media(max-width:370px){#supply-dialog .loadout-oxygen-capacity{gap:5px;padding:6px 7px}#supply-dialog .loadout-oxygen-capacity>header>span{font-size:8px}#supply-dialog .loadout-oxygen-capacity>header>strong{font-size:22px}#supply-dialog .loadout-oxygen-stages{gap:3px}#supply-dialog .loadout-oxygen-stages>li{min-height:35px;padding:3px 1px}#supply-dialog .loadout-oxygen-stages>li>strong{font-size:12px}#supply-dialog .loadout-oxygen-next{font-size:8px}}
@media(prefers-reduced-motion:reduce){#supply-dialog .shell-port,#supply-dialog .loadout-unit-image,#supply-dialog .loadout-schematic-lines,#supply-dialog .loadout-slot-path,#supply-dialog .loadout-callout-label,#supply-dialog .loadout-synthesis-intake{transition:none}}
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
