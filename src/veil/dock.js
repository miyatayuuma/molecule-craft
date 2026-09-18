import {RESOURCE_KEY} from './resources-persistence.js';
import {oxygenCapacity,oxygenUpgradeProcesses} from './tank-upgrades.js';
import {HAZARD_TREATMENT_IDS,HAZARD_TREATMENTS,HAZARD_TREATMENT_MITIGATION,hazardTreatmentPlan} from './hazard-treatments.js';

const CHEMISTRY_LABELS=Object.freeze({
  ethene:{formula:'C₂H₄',name:'Ethene'},propene:{formula:'C₃H₆',name:'Propene'},
  phenol:{formula:'C₆H₆O',name:'Phenol'},formaldehyde:{formula:'CH₂O',name:'Formaldehyde'},
  'phosphoric-acid':{formula:'H₃PO₄',name:'Phosphoric Acid'},'sulfuric-acid':{formula:'H₂SO₄',name:'Sulfuric Acid'},difluoromethane:{formula:'CH₂F₂',name:'Difluoromethane'},
});
const q=id=>document.getElementById(id),pause=()=>new Promise(resolve=>(globalThis.requestAnimationFrame??(fn=>setTimeout(fn,0)))(resolve));
let selectedId='seal',busy=false,statusText='';

function readState(){
  try{return JSON.parse(localStorage.getItem(RESOURCE_KEY)||'null')??{upgrades:{oxygenTank:0},treatments:{},recipes:[],elements:{},progress:{}};}catch{return {upgrades:{oxygenTank:0},treatments:{},recipes:[],elements:{},progress:{}};}
}
const canAfford=(state,cost)=>Object.entries(cost??{}).every(([element,count])=>(state.elements?.[element]??0)>=count);
const processStatus=(state,process)=>process.completed?'COMPLETE':!process.sequenceReady?'LOCKED':!process.chemistryReady?'CHEMISTRY':canAfford(state,process.cost)?'READY':'MATERIALS';
const treatmentKey=id=>`treatment-${id}`;
const treatmentIdFromKey=key=>key?.startsWith('treatment-')?key.slice('treatment-'.length):null;

function installStyle(){
  if(q('dock-foundation-style'))return;const style=document.createElement('style');style.id='dock-foundation-style';style.textContent=`
#oxygen-upgrades{display:none!important}
#open-dock{min-width:58px;letter-spacing:.08em}
.dock-sheet{width:min(720px,calc(100vw - 18px));max-height:min(790px,calc(100dvh - 18px));padding:0;border:1px solid #385061;border-radius:18px;background:#07131d;color:#d7e8f1;overflow:hidden}
.dock-sheet::backdrop{background:#02070cb8}
.dock-body{display:grid;grid-template-columns:minmax(170px,220px) minmax(0,1fr);gap:14px;padding:14px;overflow:auto;max-height:calc(100dvh - 82px)}
.dock-process-list{display:grid;align-content:start;gap:8px}.dock-section-label{margin:8px 2px 1px;color:#688b9b;font-size:9px;letter-spacing:.14em}.dock-section-label:first-child{margin-top:0}
.dock-process-card{display:grid;gap:3px;text-align:left;min-height:72px;padding:10px;border:1px solid #304958;border-radius:12px;background:#0c1c28;color:#d7e8f1}.dock-process-card[aria-pressed=true]{border-color:#79bed0;box-shadow:0 0 0 1px #79bed044 inset}.dock-process-card small{color:#7998a9}.dock-process-card b{font-size:11px;letter-spacing:.08em;color:#91c9d7}.dock-process-card[data-status=COMPLETE] b,.dock-process-card[data-status=ACTIVE] b{color:#8dd5ad}.dock-process-card[data-status=LOCKED],.dock-process-card[data-status=CHEMISTRY],.dock-process-card[data-status='WORLD LOCKED'],.dock-process-card[data-status='CHEMISTRY LOCKED']{opacity:.72}.dock-process-card[data-context=false]{opacity:.58;border-style:dashed}
.dock-detail{display:grid;align-content:start;gap:12px;min-width:0}.dock-detail>header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.dock-detail h3{margin:0;font-size:18px}.dock-capacity{font-variant-numeric:tabular-nums;color:#9edbe6;white-space:nowrap}.dock-requirements{display:flex;flex-wrap:wrap;gap:7px}.dock-molecule{display:grid;grid-template-columns:auto auto;gap:1px 7px;align-items:center;padding:7px 9px;border:1px solid #314856;border-radius:10px;background:#0a1924}.dock-molecule strong{font-size:13px}.dock-molecule small{grid-column:1/-1;color:#86a2b2;font-size:10px}.dock-molecule[data-found=true]{border-color:#427063}.dock-molecule[data-found=false]{opacity:.55}
.dock-flow{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.dock-flow div{padding:8px;border-left:2px solid #467487;background:#0a1924;border-radius:0 8px 8px 0;min-width:0}.dock-flow span{display:block;color:#6f91a3;font-size:9px;letter-spacing:.08em;text-transform:uppercase}.dock-flow strong{display:block;margin-top:2px;font-size:11px;line-height:1.35;overflow-wrap:anywhere}.dock-cost{margin:0;color:#8eacba;font-size:11px}.dock-actions{display:flex;align-items:center;justify-content:space-between;gap:10px}.dock-actions button{min-height:44px;padding:9px 16px}.dock-status{min-height:1.2em;margin:0;color:#91b5c4;font-size:11px;line-height:1.45}.dock-kind{margin:0;color:#648392;font-size:9px;letter-spacing:.12em}.dock-charge{display:grid;gap:4px}.dock-charge>span{display:flex;justify-content:space-between;font-size:10px;color:#87a8b8}.dock-charge>i{display:block;height:5px;overflow:hidden;border-radius:3px;background:#243b48}.dock-charge>i b{display:block;width:100%;height:100%;transform-origin:left;background:#7bc8d5}
@media(max-width:560px){.dock-sheet{width:calc(100vw - 12px);max-height:calc(100dvh - 12px)}.dock-body{grid-template-columns:1fr;max-height:calc(100dvh - 72px);padding:10px}.dock-process-list{grid-template-columns:1fr 1fr}.dock-section-label{grid-column:1/-1}.dock-process-card{min-height:64px;padding:8px}.dock-flow{grid-template-columns:1fr 1fr}.dock-detail>header{align-items:center}.dock-actions{position:sticky;bottom:-10px;padding:8px 0 2px;background:linear-gradient(transparent,#07131d 30%)}}
@media(max-width:360px){.dock-flow{grid-template-columns:1fr}.dock-process-list{grid-template-columns:1fr 1fr}.dock-process-card span{font-size:11px}}
`;document.head.append(style);
}

function ensureShell(){
  installStyle();let open=q('open-dock');if(!open){open=document.createElement('button');open.id='open-dock';open.type='button';open.textContent='DOCK';open.setAttribute('aria-label','DOCKを開く');q('open-supply')?.after(open);open.addEventListener('click',()=>{statusText='';render();const current=q('dock-dialog');if(current&&!current.open)current.showModal();});}
  let dialog=q('dock-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='dock-dialog';dialog.className='sheet dock-sheet';dialog.setAttribute('aria-labelledby','dock-title');dialog.innerHTML=`<header class="sheet-header"><div><h2 id="dock-title">DOCK</h2><p class="dock-kind">PERMANENT + CONSUMABLE TREATMENTS</p></div><button type="button" data-dock-close aria-label="DOCKを閉じる">×</button></header><div class="dock-body"><nav id="dock-process-list" class="dock-process-list" aria-label="加工プロセス"></nav><section id="dock-process-detail" class="dock-detail"></section></div>`;document.body.append(dialog);dialog.querySelector('[data-dock-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});}
  return dialog;
}

function requirementNode(id,found){const info=CHEMISTRY_LABELS[id]??{formula:id,name:id},node=document.createElement('span');node.className='dock-molecule';node.dataset.found=String(found);node.innerHTML=`<strong>${info.formula}</strong><b>${found?'✓':'—'}</b><small>${info.name}</small>`;return node;}
function statusLabel(status){return {COMPLETE:'施工済み',LOCKED:'前工程が必要',CHEMISTRY:'化学知識が必要',MATERIALS:'BASE STOCK不足',READY:'施工可能',ACTIVE:'処理有効','WORLD LOCKED':'WORLD AWAKENING後','CHEMISTRY LOCKED':'化学知識が必要'}[status]??status;}
function sectionLabel(text){const node=document.createElement('p');node.className='dock-section-label';node.textContent=text;return node;}

function renderPermanentDetail(state,process,detail,dialog){
  const status=processStatus(state,process),affordable=canAfford(state,process.cost),current=oxygenCapacity(state.upgrades?.oxygenTank??0);detail.replaceChildren();
  const header=document.createElement('header');header.innerHTML=`<div><h3>${process.icon} ${process.name}</h3><p class="dock-status">${statusLabel(status)}</p></div><strong class="dock-capacity">O₂ ${current} → ${process.completed?current:process.capacity}</strong>`;detail.append(header);
  const requirements=document.createElement('div');requirements.className='dock-requirements';requirements.setAttribute('aria-label','Required chemistry');for(const id of process.requires)requirements.append(requirementNode(id,state.recipes?.includes(id)));detail.append(requirements);
  const flow=document.createElement('div');flow.className='dock-flow';for(const [label,value] of [['PROCESS',process.process],['MATERIAL',process.material],['COMPONENT',process.component],['PROPERTY',process.property],['PERFORMANCE',process.effect]]){const cell=document.createElement('div');cell.innerHTML=`<span>${label}</span><strong>${value}</strong>`;flow.append(cell);}detail.append(flow);
  const cost=document.createElement('p');cost.className='dock-cost';cost.textContent=`加工素材 · ${Object.entries(process.cost).map(([element,count])=>`${element} ×${count}`).join(' · ')}`;detail.append(cost);
  const actions=document.createElement('div');actions.className='dock-actions';const note=document.createElement('p');note.className='dock-status';note.textContent=statusText||(!process.sequenceReady&&!process.completed?'Seal Repair施工後に解放':!process.chemistryReady?'必要分子をCRAFT / discoverすると解放':!affordable&&!process.completed?'BASE STOCKを探索で補給':process.completed?'Permanent modification committed':'化学 → 加工 → 部品 → 性能');const action=document.createElement('button');action.type='button';action.className='primary';action.dataset.dockExecute=process.id;action.textContent=process.completed?'施工済み':'機体へ施工';action.disabled=busy||status!=='READY';action.addEventListener('click',()=>executePermanent(process.id));actions.append(note,action);detail.append(actions);dialog.dataset.level=String(state.upgrades?.oxygenTank??0);
}

function renderTreatmentDetail(state,id,detail){
  const plan=hazardTreatmentPlan(state,id);if(!plan)return;detail.replaceChildren();const percent=Math.round(plan.charge*100),mitigation=Math.round(HAZARD_TREATMENT_MITIGATION*100);
  const header=document.createElement('header');header.innerHTML=`<div><h3>${plan.formula} · ${plan.label}</h3><p class="dock-status">${statusLabel(plan.status)}</p></div><strong class="dock-capacity">${plan.label} −${mitigation}%</strong>`;detail.append(header);
  const requirements=document.createElement('div');requirements.className='dock-requirements';requirements.setAttribute('aria-label','Required chemistry');requirements.append(requirementNode(plan.recipeId,plan.discovered));detail.append(requirements);
  const flow=document.createElement('div');flow.className='dock-flow';for(const [label,value] of [['CHEMISTRY',plan.chemistry],['PROCESS',plan.process],['COMPONENT',plan.component],['PROPERTY',plan.property],['HAZARD',`${plan.label} −${mitigation}%`]]){const cell=document.createElement('div');cell.innerHTML=`<span>${label}</span><strong>${value}</strong>`;flow.append(cell);}detail.append(flow);
  const charge=document.createElement('div');charge.className='dock-charge';charge.innerHTML=`<span><b>TREATMENT CHARGE</b><strong>${percent}%</strong></span><i><b style="transform:scaleX(${plan.charge})"></b></i>`;detail.append(charge);
  const cost=document.createElement('p');cost.className='dock-cost';cost.textContent=`2 molecules相当 · ${Object.entries(plan.cost).map(([element,count])=>`${element} ×${count}`).join(' · ')}`;detail.append(cost);
  const actions=document.createElement('div');actions.className='dock-actions';const note=document.createElement('p');note.className='dock-status';note.textContent=statusText||(!plan.productionHazard?'現在のFIELDにABRASIVE sourceは未観測。処理authorityのみ準備されます。':plan.charge>0?'chargeが0%になるまで再施工できません':!plan.worldAwakened?'World Awakening後に施工可能':!plan.discovered?'Utility moleculeをdiscoverすると解放':!plan.affordable?'BASE STOCKを補給':'Rare chemistry → 機体処理 → hazard mitigation');const action=document.createElement('button');action.type='button';action.className='primary';action.dataset.dockTreatmentExecute=id;action.textContent=plan.charge>0?`ACTIVE ${percent}%`:'処理を施工';action.disabled=busy||!plan.ready;action.addEventListener('click',()=>executeTreatment(id));actions.append(note,action);detail.append(actions);
}

function render(){
  const dialog=ensureShell(),state=readState(),processes=oxygenUpgradeProcesses(state),list=q('dock-process-list'),detail=q('dock-process-detail');if(!list||!detail)return;
  const validPermanent=processes.some(process=>process.id===selectedId),treatmentId=treatmentIdFromKey(selectedId),validTreatment=!!treatmentId&&!!HAZARD_TREATMENTS[treatmentId];if(!validPermanent&&!validTreatment)selectedId=processes.find(process=>!process.completed)?.id??processes[0]?.id??treatmentKey('mechanical');
  list.replaceChildren();list.append(sectionLabel('PERMANENT'));
  for(const process of processes){const status=processStatus(state,process),button=document.createElement('button');button.type='button';button.className='dock-process-card';button.dataset.process=process.id;button.dataset.status=status;button.setAttribute('aria-pressed',String(process.id===selectedId));button.innerHTML=`<b>${statusLabel(status)}</b><span>${process.name}</span><small>${process.effect}</small>`;button.addEventListener('click',()=>{selectedId=process.id;statusText='';render();});list.append(button);}
  list.append(sectionLabel('TREATMENTS'));
  for(const id of HAZARD_TREATMENT_IDS){const plan=hazardTreatmentPlan(state,id),button=document.createElement('button');button.type='button';button.className='dock-process-card';button.dataset.treatmentProcess=id;button.dataset.status=plan.status;button.dataset.context=String(plan.productionHazard);button.setAttribute('aria-pressed',String(selectedId===treatmentKey(id)));button.innerHTML=`<b>${statusLabel(plan.status)}</b><span>${plan.formula} · ${plan.label}</span><small>${plan.productionHazard?`−${Math.round(HAZARD_TREATMENT_MITIGATION*100)}% · ${Math.round(plan.charge*100)}%`:'FIELD source未観測'}</small>`;button.addEventListener('click',()=>{selectedId=treatmentKey(id);statusText='';render();});list.append(button);}
  const selectedTreatment=treatmentIdFromKey(selectedId);if(selectedTreatment)renderTreatmentDetail(state,selectedTreatment,detail);else{const process=processes.find(item=>item.id===selectedId)??processes[0];if(process)renderPermanentDetail(state,process,detail,dialog);}dialog.dataset.level=String(state.upgrades?.oxygenTank??0);
}

async function executePermanent(id){
  if(busy)return;const before=readState(),process=oxygenUpgradeProcesses(before).find(item=>item.id===id);if(!process||processStatus(before,process)!=='READY')return;busy=true;statusText='施工中…';render();
  try{q('shell-oxidizer')?.click();await pause();const legacy=q('oxygen-upgrades')?.querySelector(`button[data-upgrade="${id}"]`);if(!legacy||legacy.disabled){statusText='施工条件を同期できませんでした';return;}legacy.click();await pause();await pause();const after=readState();statusText=(after.upgrades?.oxygenTank??0)===(before.upgrades?.oxygenTank??0)+1?'施工完了 · LOADOUTへ即時反映':'施工をcommitできませんでした';}
  finally{busy=false;render();}
}

async function executeTreatment(id){
  if(busy)return;const before=readState(),plan=hazardTreatmentPlan(before,id);if(!plan?.ready)return;busy=true;statusText='処理中…';render();
  try{const request={id,result:null};globalThis.dispatchEvent?.(new CustomEvent('molecule-craft:dock-treatment-request',{detail:request}));await pause();await pause();const after=readState(),afterPlan=hazardTreatmentPlan(after,id);statusText=request.result?.committed&&afterPlan?.charge===1?'Treatment 100% · BASE STOCK consumed':'処理をcommitできませんでした';}
  finally{busy=false;render();}
}

ensureShell();render();
