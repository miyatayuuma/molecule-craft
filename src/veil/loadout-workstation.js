import { RESOURCE_KEY } from './resources.js';

const STYLE_ID='molecule-craft-loadout-workstation-style';
const PULSE_UNIT_URL=new URL('../../assets/loadout-pulse-unit.png',import.meta.url).href;
const DRIVE_UNIT_URL=new URL('../../assets/loadout-drive-unit.png',import.meta.url).href;
const MODEL_URL=id=>new URL(`../../assets/models/molecule-${id}.svg`,import.meta.url).href;
const SLOT_USES=['propellant','fuel','oxidizer','coolant'];

export const LOADOUT_LABELS=Object.freeze({propellant:'PULSE',fuel:'FUEL',oxidizer:'O₂',coolant:'COOLANT'});

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
  const svg=svgElement('svg',{class:'loadout-schematic-lines',viewBox:'0 0 1000 200',preserveAspectRatio:'none','aria-hidden':'true'});
  const pulse=svgElement('path',{class:'loadout-schematic-path',d:'M325 104 H286 V54 H145 V73'});
  const drive=svgElement('path',{class:'loadout-schematic-path',d:'M455 104 H493 V54 H898'});
  const branches=svgElement('path',{class:'loadout-schematic-path',d:'M592 54 V73 M745 54 V73 M898 54 V73'});
  svg.append(pulse,drive,branches);
  for(const [cx,cy] of [[325,104],[145,73],[455,104],[493,54],[592,73],[745,73],[898,73]]){
    svg.append(svgElement('circle',{class:'loadout-schematic-node',cx,cy,r:cx===493?4.2:3.1}));
  }
  map.append(svg);

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
  const formula=button.querySelector('small')?.textContent?.trim()??'';
  let image=button.querySelector('.loadout-molecule-thumb');
  if(id){
    if(!image){
      image=document.createElement('img');
      image.className='loadout-molecule-thumb';
      image.alt='';
      image.draggable=false;
      image.decoding='async';
      image.setAttribute('aria-hidden','true');
      image.addEventListener('error',()=>image.remove());
      button.append(image);
    }
    if(image.dataset.moleculeId!==id){
      image.dataset.moleculeId=id;
      image.src=MODEL_URL(id);
    }
  }else{
    image?.remove();
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
  observeMoleculeSlots(map);
  const details=document.querySelector('#supply-dialog .tank-explanation');
  if(details)details.open=true;
}

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#supply-dialog .collector-shell-map{
  --loadout-pulse-left:2.5%;
  --loadout-pulse-width:24%;
  --loadout-ship-x:39%;
  --loadout-drive-left:51.5%;
  --loadout-drive-width:46%;
  --loadout-drive-cell:15.333333%;
  height:202px!important;
  border-color:#294656;
  background:radial-gradient(circle at var(--loadout-ship-x) 52%,#173c4d 0 17%,#0a1a27 37%,#071520 78%);
  overflow:hidden;
}
#supply-dialog .collector-shell-map:before,
#supply-dialog .collector-shell-map:after,
#supply-dialog .collector-core{display:none!important}
#supply-dialog .loadout-unit-image{
  position:absolute;
  z-index:1;
  display:block;
  object-fit:contain;
  pointer-events:none;
  user-select:none;
  transition:opacity .14s ease,filter .14s ease;
}
#supply-dialog .loadout-pulse-image{
  left:var(--loadout-pulse-left);
  top:52%;
  width:var(--loadout-pulse-width);
  height:64px;
  transform:translateY(-50%);
}
#supply-dialog .loadout-drive-image{
  left:var(--loadout-drive-left);
  top:52%;
  width:var(--loadout-drive-width);
  height:auto;
  aspect-ratio:320/113;
  transform:translateY(-50%);
}
#supply-dialog .loadout-schematic-lines{
  position:absolute;
  inset:0;
  z-index:3;
  width:100%;
  height:100%;
  pointer-events:none;
  overflow:visible;
  filter:drop-shadow(0 0 3px #76d8e445);
  transition:opacity .14s ease;
}
#supply-dialog .loadout-schematic-path{
  fill:none;
  stroke:#a9dce4;
  stroke-width:1.8;
  vector-effect:non-scaling-stroke;
  stroke-linecap:square;
  stroke-linejoin:miter;
  opacity:.72;
}
#supply-dialog .loadout-schematic-node{
  fill:#d9f5f8;
  stroke:#6dbbc7;
  stroke-width:1.2;
  vector-effect:non-scaling-stroke;
  opacity:.9;
}
#supply-dialog .loadout-callout-label{
  position:absolute;
  z-index:5;
  color:#d8e8ed;
  font-size:11px;
  font-weight:800;
  line-height:1;
  letter-spacing:.09em;
  pointer-events:none;
  user-select:none;
  text-shadow:0 1px 4px #000,0 0 7px #6dc8d044;
  transition:opacity .14s ease,color .12s ease;
}
#supply-dialog .loadout-pulse-label{left:14.5%;top:22px;transform:translateX(-50%)}
#supply-dialog .loadout-drive-label{left:69.5%;top:17px;transform:translateX(-50%);font-size:12px;letter-spacing:.14em}
#supply-dialog .loadout-fuel-label{left:59.17%;bottom:12px;transform:translateX(-50%)}
#supply-dialog .loadout-oxidizer-label{left:74.5%;bottom:12px;transform:translateX(-50%)}
#supply-dialog .loadout-coolant-label{left:89.83%;bottom:12px;transform:translateX(-50%)}
#supply-dialog #collector-shell-preview{
  position:absolute!important;
  inset:0!important;
  width:100%!important;
  height:100%!important;
  z-index:2!important;
}
#supply-dialog #collector-launch-handle{
  left:var(--loadout-ship-x)!important;
  top:52%!important;
  width:76px!important;
  height:76px!important;
}
#supply-dialog #expedition-destinations button{left:var(--loadout-ship-x)!important;top:52%!important}
#supply-dialog .shell-port{
  z-index:4!important;
  min-width:0!important;
  min-height:0!important;
  margin:0!important;
  box-sizing:border-box;
  border:0!important;
  border-radius:9px!important;
  background:transparent!important;
  box-shadow:none!important;
  color:#d9e8ed;
  overflow:visible;
  transition:background .12s ease,box-shadow .12s ease,opacity .14s ease,filter .12s ease;
}
#supply-dialog .shell-port>i,
#supply-dialog .shell-port>span:not(.tank-scale){display:none!important}
#supply-dialog .shell-port>small{
  position:absolute;
  z-index:5;
  left:50%;
  bottom:5px;
  transform:translateX(-50%);
  max-width:90%;
  overflow:hidden;
  color:#d9e9ed;
  font-size:8.5px;
  font-weight:800;
  line-height:1;
  white-space:nowrap;
  text-overflow:ellipsis;
  text-shadow:0 1px 3px #000,0 0 4px #061018;
  opacity:.78;
  pointer-events:none;
}
#supply-dialog .shell-port .tank-scale{display:none!important}
#supply-dialog .loadout-molecule-thumb{
  position:absolute;
  z-index:4;
  left:50%;
  top:46%;
  width:40px;
  height:36px;
  transform:translate(-50%,-50%);
  object-fit:contain;
  pointer-events:none;
  user-select:none;
  filter:drop-shadow(0 1px 3px #000b) drop-shadow(0 0 5px #9ce9f044);
}
#supply-dialog .port-propellant{
  left:var(--loadout-pulse-left)!important;
  right:auto!important;
  top:52%!important;
  bottom:auto!important;
  width:var(--loadout-pulse-width)!important;
  height:64px!important;
  transform:translateY(-50%);
  padding:0!important;
}
#supply-dialog .port-propellant>.loadout-molecule-thumb{width:52px;height:44px;top:45%}
#supply-dialog .port-fuel,
#supply-dialog .port-oxidizer,
#supply-dialog .port-coolant{
  top:52%!important;
  right:auto!important;
  bottom:auto!important;
  width:var(--loadout-drive-cell)!important;
  height:62px!important;
  transform:translateY(-50%);
  padding:0 2px!important;
}
#supply-dialog .port-fuel{left:var(--loadout-drive-left)!important}
#supply-dialog .port-oxidizer{left:calc(var(--loadout-drive-left) + var(--loadout-drive-cell))!important}
#supply-dialog .port-coolant{left:calc(var(--loadout-drive-left) + var(--loadout-drive-cell) + var(--loadout-drive-cell))!important}
#supply-dialog .shell-port.loadout-slot-empty>small{
  top:50%;
  bottom:auto;
  transform:translate(-50%,-50%);
  font-size:15px;
  opacity:.62;
}
#supply-dialog .shell-port[data-active=true]{
  background-color:#83dce516!important;
  box-shadow:inset 0 0 0 1px #9ce5edb8,0 0 13px #6ac9d833!important;
}
#supply-dialog .port-propellant[data-active=true]{background-color:transparent!important;box-shadow:none!important}
#supply-dialog .collector-shell-map:has(#shell-propellant[data-active=true]) .loadout-pulse-image{filter:drop-shadow(0 0 7px #81d8e866)}
#supply-dialog .collector-shell-map:has(#shell-propellant[data-active=true]) .loadout-pulse-label,
#supply-dialog .collector-shell-map:has(#shell-fuel[data-active=true]) .loadout-fuel-label,
#supply-dialog .collector-shell-map:has(#shell-oxidizer[data-active=true]) .loadout-oxidizer-label,
#supply-dialog .collector-shell-map:has(#shell-coolant[data-active=true]) .loadout-coolant-label{color:#f0fdff}
#supply-dialog .collector-shell-map:has(#shell-fuel[data-active=true]) .loadout-drive-label,
#supply-dialog .collector-shell-map:has(#shell-oxidizer[data-active=true]) .loadout-drive-label,
#supply-dialog .collector-shell-map:has(#shell-coolant[data-active=true]) .loadout-drive-label{color:#f0fdff}
#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-unit-image,
#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-schematic-lines,
#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-callout-label{opacity:.28}
#supply-dialog .tank-explanation{display:block!important}
#supply-dialog .tank-explanation>summary{display:none!important}
#supply-dialog .tank-explanation .tank-comparison{margin-top:0!important}
#supply-dialog .tank-decision{justify-content:center}
#supply-dialog .tank-comparison{gap:7px!important;padding:2px 0}
#supply-dialog .tank-comparison .loadout-stat{
  display:grid!important;
  grid-template-columns:62px 1fr!important;
  align-items:center;
  gap:8px!important;
  min-height:16px;
  color:#a9c0ca;
  font-size:9px!important;
}
#supply-dialog .tank-comparison .loadout-stat>span{overflow:visible!important;text-overflow:clip!important;white-space:nowrap!important}
#supply-dialog .tank-comparison .loadout-stat>i{position:relative;display:block;height:7px;overflow:visible!important;border-radius:5px;background:#233b48}
#supply-dialog .tank-comparison .loadout-stat>i>b{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;transform-origin:left;background:#a7e2eb}
#supply-dialog .tank-comparison .loadout-stat>i>em{position:absolute;z-index:2;top:-2px;width:2px;height:11px;background:#f3dc8d;box-shadow:0 0 4px #061018;transform:translateX(-1px)}
#supply-dialog .loadout-charges{display:grid;grid-template-columns:62px 1fr;align-items:center;gap:8px;padding:0;min-height:16px;color:#a9c0ca;font-size:9px}
#supply-dialog .loadout-charges>div{display:flex;align-items:center;gap:4px;min-height:11px;flex-wrap:wrap}
#supply-dialog .loadout-charges i{display:block;width:8px;height:8px;border-radius:50%;background:#a7e2eb;box-shadow:0 0 5px #71ccd933}
#supply-dialog .loadout-charges[data-ghost=true]{opacity:.38}
#supply-dialog #tank-detail-title{font-size:0}
#supply-dialog #tank-detail-title:after{font-size:14px;font-weight:700;letter-spacing:.04em}
#supply-dialog:has(#shell-propellant[data-active='true']) #tank-detail-title:after{content:'PULSE'}
#supply-dialog:has(#shell-fuel[data-active='true']) #tank-detail-title:after{content:'FUEL'}
#supply-dialog:has(#shell-oxidizer[data-active='true']) #tank-detail-title:after{content:'O₂'}
#supply-dialog:has(#shell-coolant[data-active='true']) #tank-detail-title:after{content:'COOLANT'}
@media(max-width:370px){
  #supply-dialog .collector-shell-map{height:190px!important}
  #supply-dialog #collector-launch-handle{width:70px!important;height:70px!important}
  #supply-dialog .loadout-pulse-image,#supply-dialog .port-propellant{height:58px!important}
  #supply-dialog .port-fuel,#supply-dialog .port-oxidizer,#supply-dialog .port-coolant{height:58px!important}
  #supply-dialog .loadout-molecule-thumb{width:36px;height:32px}
  #supply-dialog .port-propellant>.loadout-molecule-thumb{width:46px;height:39px}
  #supply-dialog .shell-port>small{font-size:8px;bottom:4px}
  #supply-dialog .loadout-callout-label{font-size:10px}
  #supply-dialog .loadout-drive-label{top:15px;font-size:11px}
  #supply-dialog .loadout-pulse-label{top:20px}
  #supply-dialog .loadout-fuel-label,#supply-dialog .loadout-oxidizer-label,#supply-dialog .loadout-coolant-label{bottom:9px}
  #supply-dialog .tank-comparison .loadout-stat,#supply-dialog .loadout-charges{grid-template-columns:55px 1fr}
}
@media(prefers-reduced-motion:reduce){
  #supply-dialog .shell-port,
  #supply-dialog .loadout-unit-image,
  #supply-dialog .loadout-schematic-lines,
  #supply-dialog .loadout-callout-label{transition:none}
}
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
