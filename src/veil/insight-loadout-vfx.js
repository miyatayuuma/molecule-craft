import {RESOURCE_KEY} from './resources-persistence.js';

const STYLE_ID='molecule-craft-insight-destination-vfx';
function readHotDestination(){
  try{
    const raw=globalThis.localStorage?.getItem(RESOURCE_KEY);if(!raw)return null;const state=JSON.parse(raw),seed=state?.progress?.insightSeed;
    return state?.progress?.insightSeedBlocked===true||typeof seed?.id!=='string'||typeof seed?.hotDestination!=='string'?null:seed.hotDestination;
  }catch{return null;}
}
function installStyle(){
  if(typeof document==='undefined'||document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#expedition-destinations button.loadout-insight-hot{filter:drop-shadow(0 0 7px #b9f7ff77) drop-shadow(0 0 15px #78d9e840)}
#expedition-destinations button.loadout-insight-hot::after{content:'';position:absolute;inset:3px;border:1px solid transparent;border-top-color:#d8fbffcc;border-right-color:#8ee8f2aa;border-radius:50%;pointer-events:none;animation:insight-destination-orbit 5.2s linear infinite}
#expedition-destinations button.loadout-insight-hot::before{content:'';position:absolute;inset:7px;border-radius:50%;background:radial-gradient(circle,#d9fbff1f 0 34%,transparent 70%);box-shadow:0 0 12px #92e8f24d;pointer-events:none;animation:insight-destination-breathe 3.8s ease-in-out infinite}
#expedition-destinations button.loadout-insight-hot:is(:hover,:focus-visible){filter:drop-shadow(0 0 9px #d7fbff99) drop-shadow(0 0 19px #87e8f566)}
@keyframes insight-destination-orbit{to{transform:rotate(360deg)}}
@keyframes insight-destination-breathe{0%,100%{opacity:.38;transform:scale(.93)}50%{opacity:.78;transform:scale(1.08)}}
@media(prefers-reduced-motion:reduce){#expedition-destinations button.loadout-insight-hot::after,#expedition-destinations button.loadout-insight-hot::before{animation:none}#expedition-destinations button.loadout-insight-hot::after{border-color:#9cebf277}}
`;
  document.head.append(style);
}
export function syncInsightDestinationVfx(){
  if(typeof document==='undefined')return null;installStyle();const hot=readHotDestination();let count=0;
  for(const button of document.querySelectorAll('#expedition-destinations button[data-region]')){const active=!!hot&&button.dataset.region===hot;button.classList.toggle('loadout-insight-hot',active);button.toggleAttribute('data-insight-hot',active);if(active)count++;}
  return {hotDestination:hot,count};
}
export function installInsightDestinationVfx(){
  if(typeof document==='undefined')return false;installStyle();const sync=()=>queueMicrotask(syncInsightDestinationVfx);sync();
  const root=document.getElementById('supply-dialog')??document.body;if(root&&!root._insightDestinationObserver){const observer=new MutationObserver(sync);observer.observe(root,{childList:true,subtree:true});root._insightDestinationObserver=observer;}
  globalThis.addEventListener?.('storage',event=>{if(event.key===RESOURCE_KEY)sync();});globalThis.addEventListener?.('molecule-craft:insight-seed',sync);return true;
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installInsightDestinationVfx,{once:true});else installInsightDestinationVfx();}
