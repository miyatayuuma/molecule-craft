import { MOLECULE_USES,REGIONS,TANK_USES } from './growth.js';
import { ACTIVE_TANK_ROLES,moleculesForRole,performanceFor } from './molecule-roles.js';
import { drawCollectorShellPreview,TANK_PRESENTATION } from './collector-shell.js';

const USE_ORDER=[...ACTIVE_TANK_ROLES];

export function createSupplyUI({resources,canOpen,canMake,onCommit,onAnchor}){
  const q=id=>document.getElementById(id),dialog=q('supply-dialog'),shellCanvas=q('collector-shell-preview');
  let selectedUse='propellant',selectedId=null,anchorsKey='',announcement='',viewer=null,viewerKey='',viewerGeneration=0;
  const formula=record=>MOLECULE_USES[record?.id]?.formula??record?.formula??'';
  const name=record=>record?.commonNameJa??record?.nameJa??record?.name??MOLECULE_USES[record?.id]?.name??'';
  const candidates=use=>resources.tankCatalog(use);
  const tankRecord=use=>{const id=resources.state.tanks[use]?.molecule;return id?resources.record(id):null;};
  const ratio=(value,values)=>{const finite=values.filter(Number.isFinite),max=Math.max(...finite,1);return Math.max(0,Math.min(1,value/max));};

  function releaseViewer(){viewerGeneration++;viewer?.dispose();viewer=null;viewerKey='';q('tank-model-host')?.replaceChildren();}
  function openCollection(){if(!selectedId)return;dialog.close();window.dispatchEvent(new window.CustomEvent('molecule-craft:open-molecule',{detail:{id:selectedId}}));}
  function startCraft(){if(!selectedId)return;dialog.close();window.dispatchEvent(new window.CustomEvent('molecule-craft:craft-molecule',{detail:{id:selectedId}}));}
  function mountViewer(record){
    const host=q('tank-model-host'),key=record?.id??'';if(!dialog.open||!record||viewerKey===key)return;
    releaseViewer();viewerKey=key;const generation=viewerGeneration,status=document.createElement('p');status.className='model-status';status.textContent='模型を準備しています…';host.append(status);
    import('../collection-viewer.js?v=31').then(({createCollectionViewer})=>{
      if(generation!==viewerGeneration||!dialog.open||viewerKey!==key||!host.isConnected)return;
      host.replaceChildren();viewer=createCollectionViewer({host,record,name:name(record)});
    }).catch(()=>{if(generation===viewerGeneration){host.replaceChildren();const failed=document.createElement('p');failed.className='model-status';failed.textContent='模型を表示できません';host.append(failed);}});
  }
  function metric(label,value,baseline,text){
    const row=document.createElement('div'),caption=document.createElement('span'),track=document.createElement('i'),fill=document.createElement('b'),marker=document.createElement('em');caption.textContent=`${label} ${text}`;fill.style.transform=`scaleX(${value})`;marker.style.left=`${baseline*100}%`;track.append(fill,marker);row.append(caption,track);return row;
  }
  function renderMetrics(record){
    const host=q('tank-comparison');host.replaceChildren();const selected=performanceFor(record?.id,selectedUse),loaded=performanceFor(resources.state.tanks[selectedUse]?.molecule,selectedUse);if(!selected){host.hidden=true;return;}
    const all=moleculesForRole(selectedUse).map(id=>performanceFor(id,selectedUse));
    if(selectedUse==='propellant'){
      const bursts=p=>Math.floor(p.capacity/p.moleculesPerBurst),burstValues=all.map(bursts);
      host.append(metric('瞬発力',selected.burstPower,loaded?.burstPower??0,`${Math.round(selected.burstPower*100)}%`),metric('満載BURST',ratio(bursts(selected),burstValues),ratio(loaded?bursts(loaded):0,burstValues),`${bursts(selected)}回`));
    }else if(selectedUse==='fuel'){
      const range=p=>p.capacity*p.energy,efficiency=p=>1/p.oxygenPerFuel,rangeValues=all.map(range),efficiencyValues=all.map(efficiency);
      host.append(metric('航続性能',ratio(range(selected),rangeValues),ratio(loaded?range(loaded):0,rangeValues),`${Math.round(range(selected)*10)/10}`),metric('酸素効率',ratio(efficiency(selected),efficiencyValues),ratio(loaded?efficiency(loaded):0,efficiencyValues),`${selected.oxygenPerFuel} O₂`));
    }else if(selectedUse==='oxidizer'){
      const powers=all.map(p=>p.oxidizingPower),capacities=all.map(p=>p.capacity);
      host.append(metric('酸化性能',ratio(selected.oxidizingPower,powers),ratio(loaded?.oxidizingPower??0,powers),`${Math.round(selected.oxidizingPower*100)}%`),metric('搭載容量',ratio(selected.capacity,capacities),ratio(loaded?.capacity??0,capacities),String(selected.capacity)));
    }
    host.hidden=!host.childElementCount;
  }
  function thumbnail(button,record){
    const img=document.createElement('img');img.src=new URL(`../../assets/models/molecule-${record.id}.svg`,import.meta.url).href;img.alt='';img.width=76;img.height=56;img.loading='lazy';img.decoding='async';img.addEventListener('error',()=>img.remove(),{once:true});button.append(img);
  }
  function renderCandidates(list,loadedId){
    const tabs=q('tank-molecules'),left=tabs.scrollLeft;tabs.replaceChildren();list=[...list].sort((a,b)=>(a.id===loadedId?-1:0)-(b.id===loadedId?-1:0));
    for(const record of list){const button=document.createElement('button'),labels=document.createElement('span'),state=document.createElement('small');button.type='button';button.dataset.moleculeId=record.id;button.dataset.loaded=String(record.id===loadedId);button.setAttribute('aria-pressed',String(record.id===selectedId));thumbnail(button,record);labels.append(Object.assign(document.createElement('strong'),{textContent:formula(record)}),Object.assign(document.createElement('small'),{textContent:name(record)}));state.textContent=record.id===loadedId?'搭載中':'';button.append(labels,state);button.addEventListener('click',()=>{selectedId=record.id;update();});tabs.append(button);}
    tabs.scrollLeft=left;
  }
  function renderTankDetail(){
    const loadedId=resources.state.tanks[selectedUse]?.molecule,list=candidates(selectedUse);if(!list.some(record=>record.id===selectedId))selectedId=list.some(record=>record.id===loadedId)?loadedId:list[0]?.id??null;
    q('tank-detail').hidden=false;q('tank-detail-title').textContent=TANK_USES[selectedUse].label;renderCandidates(list,loadedId);
    const empty=q('tank-empty'),model=q('tank-model'),decision=q('tank-craft-molecule');empty.hidden=!!list.length;model.hidden=!list.length;decision.hidden=!list.length;
    if(!list.length){empty.textContent='発見済み分子なし';q('tank-comparison').hidden=true;q('tank-affordability').textContent='';releaseViewer();}
    const record=resources.record(selectedId),plan=selectedId?resources.tankFillPlan(selectedUse,selectedId):null;
    if(record){q('tank-model-name').textContent=`${formula(record)} · ${name(record)}`;mountViewer(record);renderMetrics(record);}
    const loaded=tankRecord(selectedUse),tank=resources.state.tanks[selectedUse],loadedStatus=resources.tankStatus(selectedUse);q('tank-load').textContent=loaded?`${formula(loaded)} ${tank.amount} / ${loadedStatus.loadedCapacity}`:'EMPTY';q('tank-load-meter').style.transform=`scaleX(${loadedStatus.loadedCapacity?tank.amount/loadedStatus.loadedCapacity:0})`;
    q('tank-replacement').hidden=!plan?.replacing;q('tank-replacement').textContent=plan?.replacing?`${formula(loaded)}を廃棄して${formula(record)}へ入替`:'';
    const missing=record?Object.entries(resources.costFor(record.id)??{}).filter(([el,n])=>(resources.state.elements[el]??0)<n).map(([el,n])=>`${el} ×${n-(resources.state.elements[el]??0)}`):[];
    q('tank-affordability').textContent=plan?.full?'満タン':missing.length?`原子不足 · ${missing.join(' · ')}`:plan?.maxAdd?'充填可能 · BASE STOCKから直接生成':'充填できません';
  }
  function renderShell(){
    for(const use of USE_ORDER){const button=q(`shell-${use}`),tank=resources.state.tanks[use],record=tankRecord(use),status=resources.tankStatus(use),presentation=TANK_PRESENTATION[use];button.style.setProperty('--tank-color',presentation.color);button.querySelector('i').textContent=presentation.icon;button.dataset.active=String(use===selectedUse);button.setAttribute('aria-pressed',String(use===selectedUse));button.querySelector('small').textContent=record?`${formula(record)} ${tank.amount}/${status.loadedCapacity}`:'—';}
    drawCollectorShellPreview(shellCanvas);
  }
  function update(){
    const state=resources.state;for(const element of ['H','C','O']){q(`resource-${element.toLowerCase()}`).textContent=state.elements[element];if(element!=='H')q(`stock-${element.toLowerCase()}`).hidden=!resources.canUseElement(element);}
    renderShell();renderTankDetail();q('supply-announcement').textContent=announcement;q('supply-announcement').hidden=!announcement;
    const anchors=state.progress.regions.join('|');if(anchors!==anchorsKey){anchorsKey=anchors;const list=q('expedition-anchor'),selected=list.value;list.replaceChildren();for(const [id,text]of [['continue','探索の続き'],...state.progress.regions.map(id=>[id,REGIONS[id].name])]){const option=document.createElement('option');option.value=id;option.textContent=text;list.append(option);}list.value=selected||'continue';}
  }
  function commitFill(use,id,count){
    if(resources.blocked||!canMake()||onCommit()===false)return false;const result=resources.fillTankFromElements(use,id,count);if(result){const record=resources.record(id);announcement=result.current>=result.capacity?`${formula(record)} · 満タン`:`${formula(record)}を充填`;update();}return result;
  }

  q('open-supply').addEventListener('click',()=>{if(!canOpen())return;announcement='';dialog.showModal();update();});
  for(const use of USE_ORDER)q(`shell-${use}`).addEventListener('click',()=>{selectedUse=use;selectedId=null;update();});
  q('expedition-anchor').addEventListener('change',()=>onAnchor(q('expedition-anchor').value));q('launch-veil').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',releaseViewer);
  q('tank-open-collection').addEventListener('click',openCollection);q('tank-craft-molecule').addEventListener('click',startCraft);
  if(globalThis.ResizeObserver)new ResizeObserver(()=>{if(dialog.open)drawCollectorShellPreview(shellCanvas);}).observe(shellCanvas);
  update();
  return {update,discovered(id){const uses=resources.tankUses(id);if(uses.length){selectedUse=uses[0];selectedId=id;}},clearAnnouncement(){announcement='';},usesFor:id=>resources.tankUses(id),tankStatus:(use,id)=>resources.tankStatus(use,id),fillPlan:(use,id)=>resources.tankFillPlan(use,id),commitFill,get open(){return dialog.open;}};
}
