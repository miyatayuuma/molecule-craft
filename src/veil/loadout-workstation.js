import { RESOURCE_KEY } from './resources.js';
import { ELEMENT_PRESENTATION } from '../element-progression.js?v=39';
import { LOADOUT_DESIGN, LOADOUT_HARDWARE_LAYOUT, LOADOUT_LABELS, LOADOUT_SLOT_GEOMETRY, LOADOUT_SLOT_USES, designPointToMap, designRectToMap } from './loadout-hardware-layout.js';

const STYLE_ID='molecule-craft-loadout-workstation-style';
const ASSET_URL=name=>new URL(`../../assets/loadout-v2/${name}`,import.meta.url).href;
const MODEL_URL=id=>new URL(`../../assets/models/molecule-${id}.svg`,import.meta.url).href;
const SLOT_USES=LOADOUT_SLOT_USES;
const MODULE_USES=Object.freeze(['pulse','craft','shock','drive']);

export { LOADOUT_HARDWARE_LAYOUT, LOADOUT_LABELS, LOADOUT_SLOT_GEOMETRY };

function designScaleFor(map){
  if(!map)return 1;
  const width=map.clientWidth||map.getBoundingClientRect?.().width||0;
  const height=map.clientHeight||map.getBoundingClientRect?.().height||0;
  return Math.max(.01,Math.min(width/LOADOUT_DESIGN.width,height/LOADOUT_DESIGN.height));
}

function layoutStage(map){
  if(!map)return null;
  const scale=designScaleFor(map),width=LOADOUT_DESIGN.width*scale,height=LOADOUT_DESIGN.height*scale,offsetX=Math.max(0,(map.clientWidth-width)/2),offsetY=Math.max(0,(map.clientHeight-height)/2);
  map._loadoutDesignScale=scale;map._loadoutDesignOffset={x:offsetX,y:offsetY};
  let design=map.querySelector('.loadout-design-layer');
  if(!design){design=document.createElement('div');design.className='loadout-design-layer';design.setAttribute('aria-hidden','true');map.append(design);}
  design.style.width=`${LOADOUT_DESIGN.width}px`;design.style.height=`${LOADOUT_DESIGN.height}px`;design.style.left=`${offsetX}px`;design.style.top=`${offsetY}px`;design.style.transform=`scale(${scale})`;
  return {scale,offsetX,offsetY,design};
}

function applyRectStyle(node,prefix,rectangle,layout){
  const mapped=designRectToMap(rectangle,layout.scale,layout.offsetX,layout.offsetY);
  node.style.setProperty(`--${prefix}-left`,`${mapped.left}px`);node.style.setProperty(`--${prefix}-top`,`${mapped.top}px`);node.style.setProperty(`--${prefix}-width`,`${mapped.width}px`);node.style.setProperty(`--${prefix}-height`,`${mapped.height}px`);
}

function applyDesignRectStyle(node,prefix,rectangle){
  node.style.setProperty(`--${prefix}-left`,`${rectangle.x}px`);node.style.setProperty(`--${prefix}-top`,`${rectangle.y}px`);node.style.setProperty(`--${prefix}-width`,`${rectangle.width}px`);node.style.setProperty(`--${prefix}-height`,`${rectangle.height}px`);
}

function applyLoadoutHardwareLayout(map){
  const layout=layoutStage(map);if(!layout)return false;
  for(const kind of MODULE_USES){const image=map.querySelector(`.loadout-${kind}-image`),module=LOADOUT_HARDWARE_LAYOUT.modules[kind];if(image&&module)applyDesignRectStyle(image,'module',module.rect);}
  for(const use of SLOT_USES){const button=map.querySelector(`#shell-${use}`),slot=LOADOUT_HARDWARE_LAYOUT.slots[use];if(!button||!slot)continue;const hitLocal=designRectToMap(slot.hitRect,layout.scale);applyRectStyle(button,'slot-hit',slot.hitRect,layout);applyRectStyle(button,'slot-visual',slot.visualRect,layout);const thumbnail=designRectToMap(slot.thumbnailRect,layout.scale),meter=designRectToMap(slot.meterRect,layout.scale);button.style.setProperty('--thumb-left',`${thumbnail.left-hitLocal.left}px`);button.style.setProperty('--thumb-top',`${thumbnail.top-hitLocal.top}px`);button.style.setProperty('--thumb-width',`${thumbnail.width}px`);button.style.setProperty('--thumb-height',`${thumbnail.height}px`);button.style.setProperty('--meter-left',`${meter.left-hitLocal.left}px`);button.style.setProperty('--meter-top',`${meter.top-hitLocal.top}px`);button.style.setProperty('--meter-width',`${meter.width}px`);button.style.setProperty('--meter-height',`${meter.height}px`);const label=document.querySelector(`[data-loadout-label="${use}"]`);if(label){const point=designPointToMap(slot.labelAnchor,layout.scale,layout.offsetX,layout.offsetY);label.style.left=`${point.x}px`;label.style.top=`${point.y}px`;}}
  const intake=designPointToMap(LOADOUT_HARDWARE_LAYOUT.modules.craft.intakeAnchor,layout.scale,layout.offsetX,layout.offsetY);map.style.setProperty('--loadout-craft-anchor-left',`${intake.x}px`);map.style.setProperty('--loadout-craft-anchor-top',`${intake.y}px`);map.style.setProperty('--loadout-craft-translation-scale',String(1/layout.scale));
  const moduleLabels=map.querySelectorAll('[data-loadout-module-label]');for(const label of moduleLabels){const point=LOADOUT_HARDWARE_LAYOUT.modules[label.dataset.loadoutModuleLabel]?.labelAnchor;if(point){const mapped=designPointToMap(point,layout.scale,layout.offsetX,layout.offsetY);label.style.left=`${mapped.x}px`;label.style.top=`${mapped.y}px`;}}
  const craft=map._loadoutCraftTranslation??{x:0,y:0};setLoadoutCraftTranslation(map,craft.x,craft.y);return true;
}

export function syncLoadoutHardwareLayout(map=document.querySelector?.('#supply-dialog .collector-shell-map')){return applyLoadoutHardwareLayout(map);}

export function setLoadoutCraftTranslation(map,dx=0,dy=0){
  if(!map)return false;const x=Number(dx)||0,y=Number(dy)||0;map._loadoutCraftTranslation={x,y};const image=map.querySelector('.loadout-craft-image'),scale=map._loadoutDesignScale||1;if(image)image.style.transform=`translate(${x/scale}px,${y/scale}px)`;return true;
}

function addUnitImages(map){
  if(!map)return;
  const layout=layoutStage(map);
  for(const kind of MODULE_USES){
    const url=ASSET_URL(LOADOUT_HARDWARE_LAYOUT.modules[kind].asset);
    if(map.querySelector(`.loadout-${kind}-image`))continue;
    const img=document.createElement('img');
    img.className=`loadout-unit-image loadout-${kind}-image`;
    img.src=url;
    img.alt='';
    img.draggable=false;
    img.setAttribute('aria-hidden','true');
    layout.design.append(img);
  }
  applyLoadoutHardwareLayout(map);
}

function addSchematic(map){
  if(!map||map.querySelector('[data-loadout-label="propellant"]'))return;
  for(const [use,slot] of Object.entries(LOADOUT_HARDWARE_LAYOUT.slots)){
    const label=document.createElement('span');label.className='loadout-callout-label';label.dataset.loadoutLabel=use;label.textContent=slot.label;label.setAttribute('aria-hidden','true');map.append(label);
  }
  for(const kind of ['pulse','shock','drive']){
    const label=document.createElement('span');label.className='loadout-module-label';label.dataset.loadoutModuleLabel=kind;label.textContent=kind.toUpperCase();label.setAttribute('aria-hidden','true');map.append(label);
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
      image.addEventListener('error',()=>{image.remove();const failure=document.createElement('span');failure.className='loadout-thumb-error';failure.textContent='?';pod.append(failure);},{once:true});
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

function observeHardwareLayout(map){
  if(!map||map._loadoutLayoutObserver)return;
  const refresh=()=>syncLoadoutHardwareLayout(map);
  if(globalThis.ResizeObserver){const observer=new ResizeObserver(refresh);observer.observe(map);map._loadoutLayoutObserver=observer;}
  refresh();
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
  syncLoadoutHardwareLayout(map);
  observeHardwareLayout(map);
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
#supply-dialog .collector-shell-map{height:clamp(205px,60vw,240px)!important;border-color:#294656;background:#071520;overflow:hidden}
#supply-dialog .collector-shell-map:before,#supply-dialog .collector-shell-map:after,#supply-dialog .collector-core{display:none!important}
#supply-dialog .loadout-design-layer{position:absolute;z-index:2;transform-origin:top left;pointer-events:none}
#supply-dialog .loadout-unit-image{position:absolute;left:var(--module-left);top:var(--module-top);width:var(--module-width);height:var(--module-height);display:block;object-fit:fill;pointer-events:none;user-select:none;transition:filter .14s ease,opacity .14s ease}
#supply-dialog .loadout-craft-image{z-index:4;transform-origin:center;transition:transform .16s ease,filter .14s ease,opacity .14s ease}
#supply-dialog .loadout-pulse-image,#supply-dialog .loadout-shock-image,#supply-dialog .loadout-drive-image{z-index:2}
#supply-dialog #collector-shell-preview{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;z-index:1!important;opacity:0!important;pointer-events:none!important}
#supply-dialog #collector-launch-handle{left:var(--loadout-craft-anchor-left)!important;top:var(--loadout-craft-anchor-top)!important;width:76px!important;height:76px!important}
#supply-dialog #expedition-destinations button{left:var(--loadout-craft-anchor-left)!important;top:var(--loadout-craft-anchor-top)!important}
#supply-dialog .shell-port{position:absolute!important;z-index:6!important;min-width:0!important;min-height:0!important;margin:0!important;box-sizing:border-box;left:var(--slot-hit-left)!important;right:auto!important;top:var(--slot-hit-top)!important;bottom:auto!important;width:var(--slot-hit-width)!important;height:var(--slot-hit-height)!important;transform:none!important;padding:0!important;border:0!important;border-radius:12px!important;background:transparent!important;box-shadow:none!important;color:#d9e8ed;overflow:visible;pointer-events:auto;cursor:pointer;touch-action:manipulation;transition:opacity .14s ease,filter .12s ease}
#supply-dialog .shell-port:before{content:'';position:absolute;z-index:-1;left:calc(var(--slot-visual-left) - var(--slot-hit-left));top:calc(var(--slot-visual-top) - var(--slot-hit-top));width:var(--slot-visual-width);height:var(--slot-visual-height);border:1px solid transparent;border-radius:10px;pointer-events:none;transition:border-color .12s ease,box-shadow .12s ease,background .12s ease}
#supply-dialog .shell-port[data-active=true]:before{border-color:#a8edf5d6;background:#a9f1f51c;box-shadow:0 0 12px #74d6e177,inset 0 0 10px #74d6e133}
#supply-dialog .shell-port>i,#supply-dialog .shell-port>span:not(.loadout-molecule-pod):not(.tank-scale),#supply-dialog .shell-port>small{display:none!important}
#supply-dialog .shell-port .tank-scale{position:absolute;left:var(--meter-left);top:var(--meter-top);width:var(--meter-width);height:var(--meter-height);display:block!important;margin:0;z-index:4}
#supply-dialog #shell-shock:before{border-radius:50%}
#supply-dialog .loadout-molecule-pod{position:absolute;z-index:3;left:var(--thumb-left);top:var(--thumb-top);width:var(--thumb-width);height:var(--thumb-height);display:grid;place-items:center;padding:0;box-sizing:border-box;border:0;border-radius:0;background:none;box-shadow:none;pointer-events:none;user-select:none}
#supply-dialog .loadout-molecule-thumb{width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;filter:drop-shadow(0 1px 3px #000b) drop-shadow(0 0 5px #9ce9f044)}
#supply-dialog .loadout-pod-formula{display:none!important}
#supply-dialog .loadout-pod-empty,#supply-dialog .loadout-thumb-error{align-self:center;color:#c7e7ed;font-size:18px;font-weight:700;opacity:.62}
#supply-dialog .loadout-callout-label,#supply-dialog .loadout-module-label{position:absolute;z-index:7;transform:translate(-50%,-50%);color:#d8e8ed;font-size:10px;font-weight:800;line-height:1;letter-spacing:.09em;pointer-events:none;user-select:none;text-shadow:0 1px 4px #000,0 0 7px #6dc8d044;transition:opacity .14s ease,color .12s ease}
#supply-dialog .loadout-module-label{font-size:11px;letter-spacing:.13em;color:#9fbac5}
#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-unit-image,#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-callout-label,#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-module-label{opacity:.28}
#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .shell-port{pointer-events:none}
#supply-dialog .loadout-synthesis-intake{position:absolute;z-index:7;left:var(--loadout-craft-anchor-left);top:var(--loadout-craft-anchor-top);width:10px;height:10px;border-radius:50%;opacity:0;pointer-events:none;box-shadow:0 0 0 0 #bff7ff00;transition:opacity .12s ease,box-shadow .12s ease}
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
@media(max-width:520px) and (orientation:portrait){#supply-dialog .sheet-header{padding:11px 16px}#supply-dialog .sheet-body{padding:12px 14px 14px;gap:8px}#supply-dialog .loadout-element-stock{grid-template-columns:54px minmax(0,1fr);align-items:center;gap:6px;margin:2px 0 0;padding:5px 7px;border-radius:11px}#supply-dialog .loadout-element-stock-title{font-size:8px;line-height:1.05;letter-spacing:.08em;white-space:nowrap}#supply-dialog .loadout-stock-elements{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}#supply-dialog .loadout-element-token{min-height:42px;column-gap:4px;padding:3px 4px;border-radius:9px}#supply-dialog .loadout-element-token>.atom-preview{width:20px;height:20px}#supply-dialog .loadout-element-token[data-loadout-stock-element='H']>.atom-preview{width:17px;height:17px}#supply-dialog .loadout-element-token>strong{font-size:12px}#supply-dialog .loadout-element-token>small{font-size:9px}#supply-dialog .tank-detail{gap:7px;padding:9px 10px}#supply-dialog .tank-molecules{gap:6px;padding-bottom:3px}#supply-dialog .tank-molecules button{grid-template-rows:46px auto 10px;min-height:96px;padding:4px 5px}#supply-dialog .tank-molecules button img{width:68px;height:46px}#supply-dialog .tank-inspector{gap:7px;min-height:142px}#supply-dialog .tank-model #tank-model-host .model-stage{height:108px}}
@media(max-width:370px){#supply-dialog #collector-launch-handle{width:70px!important;height:70px!important}#supply-dialog .loadout-callout-label{font-size:9px}#supply-dialog .loadout-module-label{font-size:10px}#supply-dialog .tank-comparison .loadout-stat,#supply-dialog .loadout-charges{grid-template-columns:55px 1fr}#supply-dialog .loadout-stock-elements{grid-template-columns:repeat(4,minmax(0,1fr))!important}#supply-dialog .sheet-body{padding:9px 10px 10px;gap:6px}#supply-dialog .loadout-element-stock{grid-template-columns:50px minmax(0,1fr);padding:4px 6px;gap:5px}#supply-dialog .tank-molecules button{grid-template-rows:42px auto 10px;min-height:90px}#supply-dialog .tank-molecules button img{width:68px;height:42px}#supply-dialog .tank-inspector{min-height:132px}#supply-dialog .tank-model #tank-model-host .model-stage{height:96px}}
@media(max-width:340px) and (max-height:680px){#supply-dialog .collector-shell-map{height:164px!important}#supply-dialog .sheet-header{padding:8px 10px}#supply-dialog .sheet-body{padding:7px 8px 8px;gap:5px}#supply-dialog .loadout-element-stock{grid-template-columns:48px minmax(0,1fr);padding:4px 5px;gap:4px}#supply-dialog .loadout-element-token{min-height:38px;padding:2px 3px}#supply-dialog .loadout-element-token>.atom-preview{width:18px;height:18px}#supply-dialog .loadout-element-token[data-loadout-stock-element='H']>.atom-preview{width:16px;height:16px}#supply-dialog .tank-detail{gap:5px;padding:7px 8px}#supply-dialog .tank-molecules button{grid-template-rows:40px auto 9px;min-height:86px}#supply-dialog .tank-molecules button img{height:40px}#supply-dialog .tank-inspector{min-height:120px;gap:5px}#supply-dialog .tank-model #tank-model-host .model-stage{height:88px}}
@media(max-width:370px){#supply-dialog .loadout-oxygen-capacity{gap:5px;padding:6px 7px}#supply-dialog .loadout-oxygen-capacity>header>span{font-size:8px}#supply-dialog .loadout-oxygen-capacity>header>strong{font-size:22px}#supply-dialog .loadout-oxygen-stages{gap:3px}#supply-dialog .loadout-oxygen-stages>li{min-height:35px;padding:3px 1px}#supply-dialog .loadout-oxygen-stages>li>strong{font-size:12px}#supply-dialog .loadout-oxygen-next{font-size:8px}}
@media(prefers-reduced-motion:reduce){#supply-dialog .shell-port,#supply-dialog .loadout-unit-image,#supply-dialog .loadout-callout-label,#supply-dialog .loadout-module-label,#supply-dialog .loadout-synthesis-intake{transition:none}}
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
