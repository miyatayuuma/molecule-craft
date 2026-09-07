import { MOLECULE_USES,REGIONS,TANK_USES } from './growth.js';
import { ACTIVE_TANK_ROLES,moleculesForRole,performanceFor } from './molecule-roles.js';
import { drawCollectorShellPreview,TANK_PRESENTATION } from './collector-shell.js';
import { OXYGEN_ROUTES,OXYGEN_REWARD,OXYGEN_JUNCTION } from './oxygen-routes.js';
import { expeditionUseFor,loadedCombustionSummary } from './propulsion-guide.js';

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
      host.replaceChildren();viewer=createCollectionViewer({host,record,name:name(record),showGestureHint:false});
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
      const tank=resources.state.tanks.propellant,amount=tank.molecule===record.id?tank.amount:resources.tankFillPlan('propellant',record.id)?.target??0,remaining=Math.floor(amount/selected.moleculesPerBurst);
      host.append(metric('噴射の強さ',selected.burstPower,loaded?.burstPower??0,`${Math.round(selected.burstPower*100)}%`),metric(tank.molecule===record.id?'残り噴射':'充填可能',ratio(remaining,burstValues),ratio(loaded?Math.floor(tank.amount/loaded.moleculesPerBurst):0,burstValues),`${remaining}回（満載${bursts(selected)}）`));
    }else if(selectedUse==='fuel'){
      const tank=resources.state.tanks.fuel,amount=tank.molecule===record.id?tank.amount:resources.tankFillPlan('fuel',record.id)?.target??0,current=loadedCombustionSummary(resources.state.tanks),preview=loadedCombustionSummary({...resources.state.tanks,fuel:{molecule:record.id,amount}});
      host.append(metric(tank.molecule===record.id?'燃焼可能':'充填後の燃焼',Math.min(1,preview.seconds/60),Math.min(1,current.seconds/60),`${Math.floor(preview.seconds)}秒 · 現在のO₂で`));
      const cooling=document.createElement('p');cooling.textContent=preview.cooling;host.append(cooling);
    }else if(selectedUse==='oxidizer'){
      const powers=all.map(p=>p.oxidizingPower),capacities=all.map(p=>p.capacity);
      host.append(metric('酸化性能',ratio(selected.oxidizingPower,powers),ratio(loaded?.oxidizingPower??0,powers),`${Math.round(selected.oxidizingPower*100)}%`),metric('搭載容量',ratio(selected.capacity,capacities),ratio(loaded?.capacity??0,capacities),String(selected.capacity)));
    }else if(selectedUse==='coolant'){
      const powers=all.map(p=>p.coolingPower),capacities=all.map(p=>p.capacity);
      host.append(metric('冷却出力',ratio(selected.coolingPower,powers),ratio(loaded?.coolingPower??0,powers),`${Math.round(selected.coolingPower*100)}%`),metric('搭載容量',ratio(selected.capacity,capacities),ratio(loaded?.capacity??0,capacities),String(selected.capacity)));
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
    const hintIds={propellant:['hydrogen','carbon-dioxide'],fuel:['methane'],oxidizer:['oxygen'],coolant:['water']},hintId=hintIds[selectedUse].find(id=>resources.state.hints.includes(id)&&!resources.state.recipes.includes(id));
    q('tank-next-hint').hidden=!hintId;q('tank-next-hint').dataset.moleculeId=hintId??'';
    q('tank-next-hint').textContent=hintId?`${formula(resources.record(hintId))||hintId}の作り方を見る`:'';
    if(!list.length){empty.textContent='発見済み分子なし';q('tank-comparison').hidden=true;q('tank-affordability').textContent='';releaseViewer();}
    const record=resources.record(selectedId),plan=selectedId?resources.tankFillPlan(selectedUse,selectedId):null;
    const guide=expeditionUseFor(selectedId,selectedUse);q('tank-use-guide').textContent=guide?`${guide.good} ${guide.weakness}`:'';
    if(record){q('tank-model-name').textContent=`${formula(record)} · ${name(record)}`;mountViewer(record);renderMetrics(record);}
    const loaded=tankRecord(selectedUse),tank=resources.state.tanks[selectedUse],loadedStatus=resources.tankStatus(selectedUse);q('tank-load').textContent=loaded?formula(loaded):'EMPTY';q('tank-load-meter').parentElement.setAttribute('role','meter');q('tank-load-meter').parentElement.setAttribute('aria-label',TANK_USES[selectedUse].label);q('tank-load-meter').parentElement.setAttribute('aria-valuemin','0');q('tank-load-meter').parentElement.setAttribute('aria-valuemax',String(loadedStatus.loadedCapacity||1));q('tank-load-meter').parentElement.setAttribute('aria-valuenow',String(tank.amount));q('tank-load-meter').style.transform=`scaleX(${loadedStatus.loadedCapacity?tank.amount/loadedStatus.loadedCapacity:0})`;
    q('tank-replacement').setAttribute('aria-label',plan?.replacing?`${formula(loaded)}を廃棄して${formula(record)}へ入替`:'');q('tank-replacement').hidden=!plan?.replacing;q('tank-replacement').textContent=plan?.replacing?`${formula(loaded)} ✕ → ${formula(record)}`:'';
    const missing=record?Object.entries(resources.costFor(record.id)??{}).filter(([el,n])=>(resources.state.elements[el]??0)<n).map(([el,n])=>`${el} ×${n-(resources.state.elements[el]??0)}`):[];
    q('tank-affordability').textContent=plan?.full?'満タン':missing.length?`＋ ${missing.join(' · ')}`:plan?.maxAdd?'● → ◉':'充填できません';
  }
  function renderShell(){
    for(const use of USE_ORDER){const button=q(`shell-${use}`),tank=resources.state.tanks[use],record=tankRecord(use),status=resources.tankStatus(use),presentation=TANK_PRESENTATION[use];button.style.setProperty('--tank-color',presentation.color);button.querySelector('i').textContent=presentation.icon;button.dataset.active=String(use===selectedUse);button.setAttribute('aria-pressed',String(use===selectedUse));button.querySelector('small').textContent=record?formula(record):'—';let track=button.querySelector('.tank-scale');if(!track){track=document.createElement('span');track.className='tank-scale';track.append(document.createElement('b'));button.append(track);}track.setAttribute('role','meter');track.setAttribute('aria-label',TANK_USES[use].label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(status.loadedCapacity||1));track.setAttribute('aria-valuenow',String(tank.amount));track.firstElementChild.style.transform=`scaleX(${status.loadedCapacity?tank.amount/status.loadedCapacity:0})`;}
    drawCollectorShellPreview(shellCanvas);
  }
  function update(){
    const state=resources.state;for(const element of ['H','C','O']){q(`resource-${element.toLowerCase()}`).textContent=state.elements[element];if(element!=='H')q(`stock-${element.toLowerCase()}`).hidden=!resources.canUseElement(element);}
    renderShell();renderTankDetail();q('supply-announcement').textContent=announcement;q('supply-announcement').hidden=!announcement;
    q('oxygen-route-guide').hidden=!state.progress.foundElements.includes('O');
    const burn=loadedCombustionSummary(state.tanks);q('loaded-combustion-summary').textContent=`現在の搭載分：燃焼 ${Math.floor(burn.seconds)}秒 · ${burn.cooling}`;
    const anchors=state.progress.regions.join('|');if(anchors!==anchorsKey){anchorsKey=anchors;const list=q('expedition-anchor'),selected=list.value;list.replaceChildren();for(const [id,text]of [['continue','探索の続き'],...state.progress.regions.map(id=>[id,REGIONS[id].name])]){const option=document.createElement('option');option.value=id;option.textContent=text;list.append(option);}list.value=selected||'continue';}
  }
  function openMolecule(id,use=null){
    const roles=resources.tankUses(id);if(!canOpen()||!resources.state.recipes.includes(id)||!roles.length)return false;
    selectedUse=roles.includes(use)?use:roles[0];selectedId=id;announcement='';dialog.showModal();update();return true;
  }
  function renderRouteGuide(){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 320 175');svg.setAttribute('role','img');svg.setAttribute('aria-label','出発点から強流の近道、連続する支流、持続流の本道が分岐し、Oの集積へ合流');
    const point=([x,y])=>[30+(x+450)/1300*260,18+(-y-8700)/2020*140];
    for(const route of OXYGEN_ROUTES){const line=document.createElementNS(ns,'polyline');line.setAttribute('points',route.knots.map(k=>point(k).join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke',route.color);line.setAttribute('stroke-width','3');svg.append(line);
      const note=document.createElement('p');note.textContent=`${route.label}：${route.summary}`;note.style.borderColor=route.color;q('oxygen-route-notes').append(note);
      for(const gate of route.gates){const [x,y]=point([route.x,gate.y]),mark=document.createElementNS(ns,'path');mark.setAttribute('d',`M${x-8} ${y-3}l8 6 8-6`);mark.setAttribute('fill','none');mark.setAttribute('stroke',route.color);mark.setAttribute('stroke-width','3');svg.append(mark);}
      for(const stop of route.restStops??[]){const [x,y]=point([route.x,stop.y]),mark=document.createElementNS(ns,'circle');mark.setAttribute('cx',String(x));mark.setAttribute('cy',String(y));mark.setAttribute('r','6');mark.setAttribute('fill','#6ab2cb');svg.append(mark);}
      const [x]=point([route.x,-9000]),label=document.createElementNS(ns,'text');label.setAttribute('x',String(x));label.setAttribute('y','12');label.setAttribute('text-anchor',route.id==='oxygen-side'?'end':'middle');label.setAttribute('fill',route.color);label.textContent=route.label;svg.append(label);
    }
    for(const p of [OXYGEN_JUNCTION,OXYGEN_REWARD]){const [x,y]=point([p.x,p.y]),circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',String(x));circle.setAttribute('cy',String(y));circle.setAttribute('r','5');circle.setAttribute('fill','#e4f5e9');svg.append(circle);}
    const destination=document.createElementNS(ns,'text');destination.setAttribute('x',String(point([OXYGEN_REWARD.x,OXYGEN_REWARD.y])[0]));destination.setAttribute('y','173');destination.setAttribute('text-anchor','middle');destination.setAttribute('fill','#e4f5e9');destination.textContent='Oの集積';svg.append(destination);
    q('oxygen-route-chart').append(svg);
  }
  function commitFill(use,id,count){
    if(resources.blocked||!canMake()||onCommit()===false)return false;const result=resources.fillTankFromElements(use,id,count);if(result){const record=resources.record(id);announcement=result.current>=result.capacity?`${formula(record)} · 満タン`:`${formula(record)}を充填`;update();}return result;
  }

  q('open-supply').addEventListener('click',()=>{if(!canOpen())return;announcement='';dialog.showModal();update();});
  for(const use of USE_ORDER)q(`shell-${use}`).addEventListener('click',()=>{selectedUse=use;selectedId=null;update();});
  q('expedition-anchor').addEventListener('change',()=>onAnchor(q('expedition-anchor').value));q('launch-veil').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',releaseViewer);
  q('tank-next-hint').addEventListener('click',()=>{const id=q('tank-next-hint').dataset.moleculeId;if(id){dialog.close();window.dispatchEvent(new window.CustomEvent('molecule-craft:craft-molecule',{detail:{id}}));}});
  q('tank-open-collection').addEventListener('click',openCollection);q('tank-craft-molecule').addEventListener('click',startCraft);
  q('oxygen-co2-hint').addEventListener('click',()=>{dialog.close();window.dispatchEvent(new window.CustomEvent('molecule-craft:open-molecule',{detail:{id:'carbon-dioxide'}}));});
  if(globalThis.ResizeObserver)new ResizeObserver(()=>{if(dialog.open)drawCollectorShellPreview(shellCanvas);}).observe(shellCanvas);
  renderRouteGuide();update();
  return {update,openMolecule,discovered(id){const uses=resources.tankUses(id);if(uses.length){selectedUse=uses[0];selectedId=id;}},clearAnnouncement(){announcement='';},usesFor:id=>resources.tankUses(id),tankStatus:(use,id)=>resources.tankStatus(use,id),fillPlan:(use,id)=>resources.tankFillPlan(use,id),commitFill,get open(){return dialog.open;}};
}
