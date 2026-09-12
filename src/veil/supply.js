import { MOLECULE_USES,REGIONS,TANK_USES } from './growth.js';
import { ACTIVE_TANK_ROLES,performanceFor } from './molecule-roles.js';
import { drawCollectorShell,drawCollectorShellPreview,TANK_PRESENTATION } from './collector-shell.js';
import { OXYGEN_ROUTES,OXYGEN_REWARD,OXYGEN_JUNCTION } from './oxygen-routes.js';
import { renderLoadoutPreview } from './loadout-preview.js';
import { syncElementStocks } from '../element-progression.js?v=36';

const USE_ORDER=[...ACTIVE_TANK_ROLES];
const REGION_CUES=Object.freeze({veil:{glyph:'H',color:'#bfefff'},carbon:{glyph:'C',color:'#aeb8c4'},oxygen:{glyph:'O',color:'#8dbcf4'},frontier:{glyph:'◎',color:'#f5d584'}});

export function launchDestinationLayout(ids,radius=66){
  const visible=ids.filter(id=>REGIONS[id]).slice(0,5),count=visible.length;
  return visible.map((id,index)=>{const angle=-Math.PI/2+(count===1?0:index*Math.PI*2/count);return {id,x:Math.cos(angle)*radius,y:Math.sin(angle)*radius};});
}

export function tankMeterSegments(use,moleculeId){
  if(use!=='propellant')return 0;const performance=performanceFor(moleculeId,'propellant');return performance?.moleculesPerBurst?Math.floor(performance.capacity/performance.moleculesPerBurst):0;
}

export function loadoutCandidateCards(list,{loadoutId=null,loadedId=null}={}){
  return list.map(record=>({record,selected:record.id===loadoutId,loaded:record.id===loadedId}));
}

export function launchShortageItems(plan){
  return Object.entries(plan?.missing??{}).map(([element,row])=>({element,count:Math.max(0,(row?.need??0)-(row?.have??0))})).filter(item=>item.count>0);
}

export function launchFillRows(plan){
  const actualByUse=new Map((plan?.partial?.entries??[]).map(entry=>[entry.use,entry]));
  return (plan?.full?.entries??[]).filter(entry=>entry.molecule).map(requested=>{const actual=actualByUse.get(requested.use);return {use:requested.use,molecule:requested.molecule,actual:actual?.target??0,requested:requested.target??requested.capacity??0};});
}

export function launchConfirmationState(plan){
  const rows=launchFillRows(plan),shortages=launchShortageItems(plan);
  return {rows,shortages,zeroFill:rows.length>0&&rows.every(row=>row.actual===0)};
}

export function createSupplyUI({resources,canOpen,canMake,onCommit,onPrepareLaunch=()=>true,onLaunchReady=()=>false,onAnchor}){
  const q=id=>document.getElementById(id),dialog=q('supply-dialog'),shellCanvas=q('collector-shell-preview'),shellMap=shellCanvas.parentElement,access=q('open-supply');
  const upgrades=document.createElement('div');upgrades.id='oxygen-upgrades';upgrades.className='oxygen-upgrades';q('tank-detail').append(upgrades);
  const partialPanel=document.createElement('div'),partialRows=document.createElement('div'),partialActions=document.createElement('div'),partialGo=document.createElement('button'),partialBack=document.createElement('button');partialPanel.id='partial-fill-confirm';partialPanel.hidden=true;Object.assign(partialPanel.style,{position:'absolute',inset:'auto 10px 10px 10px',zIndex:'9',padding:'12px',maxHeight:'calc(100% - 20px)',overflow:'auto',border:'1px solid #678494',borderRadius:'14px',background:'#071925f2',boxShadow:'0 10px 30px #0008'});Object.assign(partialRows.style,{display:'grid',gap:'8px',marginBottom:'10px'});Object.assign(partialActions.style,{display:'flex',gap:'8px',flexWrap:'wrap',justifyContent:'flex-end'});partialGo.type='button';partialGo.className='primary';partialGo.textContent='この量で出る';partialBack.type='button';partialBack.textContent='戻る';partialActions.append(partialBack,partialGo);partialPanel.append(partialRows,partialActions);q('supply-dialog').querySelector('.sheet-body').append(partialPanel);
  const synthesisLayer=document.createElement('div');synthesisLayer.setAttribute('aria-hidden','true');Object.assign(synthesisLayer.style,{position:'absolute',inset:'0',zIndex:'8',pointerEvents:'none',overflow:'hidden'});shellMap.append(synthesisLayer);
  let selectedUse='propellant',selectedId=null,anchorsKey='',announcement='',viewer=null,viewerKey='',viewerGeneration=0,launchPointer=null,launchStart=null,launchDragged=0,launchActive=null,launchOpen=false,launchItems=[],launchBusy=false;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
  const formula=record=>MOLECULE_USES[record?.id]?.formula??record?.formula??'';
  const name=record=>record?.commonNameJa??record?.nameJa??record?.name??MOLECULE_USES[record?.id]?.name??'';
  const formulaId=id=>id?(formula(resources.record(id)??{id})||id):'∅';
  const candidates=use=>resources.tankCatalog(use);
  const tankRecord=use=>{const id=resources.state.tanks[use]?.molecule;return id?resources.record(id):null;};
  function styleTankMeter(track,use,moleculeId){
    const fill=track?.firstElementChild;if(!track||!fill)return;const segments=tankMeterSegments(use,moleculeId);
    track.dataset.segments=String(segments);track.style.backgroundRepeat='repeat-x';fill.style.webkitMaskRepeat='repeat-x';fill.style.maskRepeat='repeat-x';
    if(segments>1){const cell=`calc(100% / ${segments}) 100%`,gap=segments>=9?'1px':'2px',pattern=`linear-gradient(90deg,#304553 0 calc(100% - ${gap}),#152734 calc(100% - ${gap}) 100%)`,mask=`linear-gradient(90deg,#000 0 calc(100% - ${gap}),transparent calc(100% - ${gap}) 100%)`;track.style.background=pattern;track.style.backgroundSize=cell;fill.style.webkitMaskImage=mask;fill.style.webkitMaskSize=cell;fill.style.maskImage=mask;fill.style.maskSize=cell;return;}
    track.style.background='#304553';track.style.backgroundSize='auto';fill.style.webkitMaskImage='none';fill.style.webkitMaskSize='auto';fill.style.maskImage='none';fill.style.maskSize='auto';
  }
  function setTankMeterLevel(track,ratio){
    const fill=track?.firstElementChild;if(!track||!fill)return;const value=Math.max(0,Math.min(1,ratio||0)),segments=Number(track.dataset.segments)||0;
    if(segments>1){fill.style.transform='none';fill.style.clipPath=`inset(0 ${(1-value)*100}% 0 0)`;fill.style.transition='clip-path .2s linear';return;}
    fill.style.clipPath='none';fill.style.transition='transform .2s linear';fill.style.transform=`scaleX(${value})`;
  }
  const combustionLink=document.querySelector('#veil-combustion .combustion-link');if(combustionLink)combustionLink.textContent='🔥';
  styleTankMeter(q('veil-coolant-level'),'coolant',null);

  const accessCanvas=document.createElement('canvas');accessCanvas.id='collector-access-preview';accessCanvas.setAttribute('aria-hidden','true');Object.assign(accessCanvas.style,{display:'block',width:'42px',height:'34px',pointerEvents:'none'});access.append(accessCanvas);access.setAttribute('aria-label','探索機を開く');Object.assign(access.style,{minWidth:'50px',padding:'3px 5px',justifyContent:'center'});
  function drawAccessIcon(){
    const rect=accessCanvas.getBoundingClientRect(),ratio=Math.min(globalThis.devicePixelRatio??1,2),width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));if(accessCanvas.width!==width||accessCanvas.height!==height){accessCanvas.width=width;accessCanvas.height=height;}const ctx=accessCanvas.getContext('2d');if(!ctx)return;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,rect.width,rect.height);drawCollectorShell(ctx,{x:rect.width/2,y:rect.height/2,angle:-Math.PI/2,scale:Math.min(rect.width/42,rect.height/34)});
  }

  const legacyFooter=q('expedition-anchor')?.closest('.supply-footer');if(legacyFooter)legacyFooter.hidden=true;
  const launchLayer=document.createElement('div');launchLayer.id='expedition-destinations';launchLayer.setAttribute('aria-hidden','true');Object.assign(launchLayer.style,{position:'absolute',inset:'0',zIndex:'3',pointerEvents:'none'});shellMap.append(launchLayer);
  const launchHandle=document.createElement('button');launchHandle.type='button';launchHandle.id='collector-launch-handle';launchHandle.setAttribute('aria-label','探索機をドラッグして出発地点を選ぶ');Object.assign(launchHandle.style,{position:'absolute',left:'calc(50% + 10px)',top:'50%',width:'80px',height:'80px',transform:'translate(-50%,-50%)',zIndex:'4',padding:'0',border:'0',borderRadius:'50%',background:'transparent',boxShadow:'none',touchAction:'none',cursor:'grab'});shellMap.append(launchHandle);
  Object.assign(shellCanvas.style,{zIndex:'1',pointerEvents:'none',transformOrigin:'center',transition:'transform .16s ease, opacity .16s ease'});
  function decorateDestination(button,cue){
    const glyph=document.createElement('span');glyph.textContent=cue.glyph;Object.assign(glyph.style,{position:'relative',zIndex:'2',fontSize:'13px',fontWeight:'750',color:cue.color,textShadow:`0 0 8px ${cue.color}`});button.append(glyph);
    for(const [left,top,size,alpha] of [[7,10,4,.85],[31,8,3,.65],[34,29,4,.75],[9,31,3,.55]]){const dot=document.createElement('b');Object.assign(dot.style,{position:'absolute',left:`${left}px`,top:`${top}px`,width:`${size}px`,height:`${size}px`,borderRadius:'50%',background:cue.color,opacity:String(alpha),boxShadow:`0 0 7px ${cue.color}`});button.append(dot);}
  }
  function destinationTransform(item,scale=1){return `translate(-50%,-50%) translate(${item.x}px,${item.y}px) scale(${scale})`;}
  function showLaunchDestinations(show){
    launchOpen=show;shellMap.classList.toggle('launch-selecting',show);launchLayer.setAttribute('aria-hidden',String(!show));for(const item of launchItems){item.node.style.opacity=show?'1':'0';item.node.style.pointerEvents=show?'auto':'none';item.node.tabIndex=show?0:-1;item.node.style.transform=destinationTransform(item,show?(item===launchActive?1.16:1):.55);item.node.style.boxShadow=item===launchActive?`0 0 25px ${item.color},inset 0 0 12px ${item.color}55`:item.checkpoint?`0 0 14px ${item.color}77`:`0 0 10px ${item.color}44`;}
    for(const use of USE_ORDER)q(`shell-${use}`).style.opacity=show?'.34':'1';for(const path of shellMap.querySelectorAll('.loadout-slot-path'))path.style.pointerEvents=show?'none':'visibleFill';if(!show)launchActive=null;
  }
  function resetLaunchPosition(){shellCanvas.style.transition=reduced?'none':'transform .16s ease, opacity .16s ease';shellCanvas.style.transform='translate(0px,0px)';shellCanvas.style.opacity='1';launchHandle.style.cursor='grab';}
  function resetLaunchGesture({keepDestinations=false}={}){
    const pointer=launchPointer;launchPointer=null;launchStart=null;launchDragged=0;
    try{if(pointer!==null)launchHandle.releasePointerCapture(pointer);}catch{}
    if(!keepDestinations)showLaunchDestinations(false);resetLaunchPosition();
  }
  function renderLaunchDestinations(){
    const checkpoint=resources.state.progress.checkpoint;launchItems=launchDestinationLayout(resources.state.progress.regions).map(point=>{const region=REGIONS[point.id],cue=REGION_CUES[point.id]??{glyph:region.element??'·',color:'#9ad8e5'},button=document.createElement('button'),item={...point,node:button,color:cue.color,checkpoint:point.id===checkpoint};button.type='button';button.dataset.region=point.id;button.dataset.checkpoint=String(item.checkpoint);button.setAttribute('aria-label',`${region.name}へ出発`);Object.assign(button.style,{position:'absolute',left:'calc(50% + 10px)',top:'50%',width:'46px',height:'46px',minWidth:'46px',minHeight:'46px',padding:'0',overflow:'hidden',borderRadius:'50%',border:`1px solid ${cue.color}99`,background:`radial-gradient(circle at 50% 50%,${cue.color}22 0 30%,#0b2231ee 31% 64%,#07141f 65%)`,opacity:'0',pointerEvents:'none',transform:destinationTransform(item,.55),transition:reduced?'none':'opacity .14s ease, transform .14s ease, box-shadow .14s ease',touchAction:'none'});decorateDestination(button,cue);button.addEventListener('click',event=>{event.stopPropagation();launchDestination(point.id);});launchLayer.append(button);return item;});
    if(launchOpen)showLaunchDestinations(true);
  }
  function setLaunchActive(next){if(launchActive===next)return;launchActive=next;if(launchOpen)showLaunchDestinations(true);}
  function launchDestination(id){
    resetLaunchGesture();if(!canOpen()||resources.blocked)return false;const select=q('expedition-anchor'),option=[...select.options].find(item=>item.value===id);if(!option)return false;select.value=id;select.dispatchEvent(new window.Event('change',{bubbles:true}));q('launch-veil').click();return true;
  }
  function moveLaunch(event){
    if(event.pointerId!==launchPointer||!launchStart)return;const rawX=event.clientX-launchStart.x,rawY=event.clientY-launchStart.y,len=Math.hypot(rawX,rawY),limit=84,factor=len>limit?limit/len:1,dx=rawX*factor,dy=rawY*factor;launchDragged=Math.max(launchDragged,len);let nearest=null,best=Infinity;for(const item of launchItems){const distance=Math.hypot(rawX-item.x,rawY-item.y);if(distance<best){best=distance;nearest=item;}}if(best>44)nearest=null;setLaunchActive(nearest);const x=nearest?.x??dx,y=nearest?.y??dy;shellCanvas.style.transform=`translate(${x}px,${y}px)`;
  }
  function beginLaunch(event){
    if(launchPointer!==null||resources.blocked||!canOpen()||event.button!==undefined&&event.button!==0)return;event.preventDefault();launchPointer=event.pointerId;launchStart={x:event.clientX,y:event.clientY};launchDragged=0;showLaunchDestinations(true);shellCanvas.style.transition='none';launchHandle.style.cursor='grabbing';try{launchHandle.setPointerCapture(launchPointer);}catch{}moveLaunch(event);
  }
  function endLaunch(event,cancel=false){
    if(event.pointerId!==launchPointer)return;const id=launchActive?.id??null,wasTap=launchDragged<8;resetLaunchGesture({keepDestinations:!cancel&&!id&&wasTap});if(cancel)return;if(id)launchDestination(id);
  }
  launchHandle.addEventListener('pointerdown',beginLaunch);launchHandle.addEventListener('pointermove',moveLaunch);launchHandle.addEventListener('pointerup',event=>endLaunch(event));launchHandle.addEventListener('pointercancel',event=>endLaunch(event,true));launchHandle.addEventListener('lostpointercapture',event=>{if(event.pointerId===launchPointer)endLaunch(event,true);});launchHandle.addEventListener('keydown',event=>{if(event.key==='Escape'){resetLaunchGesture();return;}if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();showLaunchDestinations(!launchOpen);if(launchOpen)(launchItems.find(item=>item.checkpoint)??launchItems[0])?.node.focus();});

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
  function renderComparison(record){
    const host=q('tank-comparison');if(!record){host.replaceChildren();host.hidden=true;return;}
    const tank=resources.state.tanks[selectedUse],plan=resources.launchFillPlan(),preview=plan.status==='FULL'?plan.full:plan.partial,entry=preview.entries.find(item=>item.use===selectedUse&&item.molecule===record.id),loadout=resources.selectedLoadout(),oxygenEntry=preview.entries.find(item=>item.use==='oxidizer'),candidateAmount=entry?.target??resources.tankFillPlan(selectedUse,record.id)?.target??null,oxygenAmount=oxygenEntry?.target??resources.state.tanks.oxidizer.amount??0,coolantId=selectedUse==='coolant'?record.id:(loadout.coolant??resources.state.tanks.coolant.molecule);
    renderLoadoutPreview(host,{use:selectedUse,candidateId:record.id,currentId:tank.molecule,currentAmount:tank.amount,candidateAmount,oxygenAmount,coolantId,reduced});
  }
  function thumbnail(button,record){
    const img=document.createElement('img');img.src=new URL(`../../assets/models/molecule-${record.id}.svg`,import.meta.url).href;img.alt='';img.width=76;img.height=56;img.loading='lazy';img.decoding='async';img.addEventListener('error',()=>img.remove(),{once:true});button.append(img);
  }
  function renderCandidates(list,loadedId){
    const tabs=q('tank-molecules'),left=tabs.scrollLeft,loadoutId=resources.selectedLoadout()[selectedUse];tabs.replaceChildren();
    const emptyButton=document.createElement('button'),emptyLabels=document.createElement('span'),emptyState=document.createElement('small');emptyButton.type='button';emptyButton.dataset.moleculeId='';emptyButton.dataset.loaded=String(!loadedId);emptyButton.setAttribute('aria-pressed',String(loadoutId===null));Object.assign(emptyLabels,{textContent:'∅'});emptyState.textContent=loadoutId===null?'選択中':'';emptyButton.append(emptyLabels,emptyState);emptyButton.addEventListener('click',()=>{if(resources.setLoadoutTank(selectedUse,null)){selectedId=null;update();}});tabs.append(emptyButton);
    for(const {record,selected,loaded} of loadoutCandidateCards(list,{loadoutId,loadedId})){const button=document.createElement('button'),labels=document.createElement('span'),state=document.createElement('small');button.type='button';button.dataset.moleculeId=record.id;button.dataset.loaded=String(loaded);button.setAttribute('aria-pressed',String(selected));thumbnail(button,record);labels.append(Object.assign(document.createElement('strong'),{textContent:formula(record)}),Object.assign(document.createElement('small'),{textContent:name(record)}));state.textContent=selected?'選択中':loaded?'残量あり':'';button.append(labels,state);button.addEventListener('click',()=>{if(resources.setLoadoutTank(selectedUse,record.id)){selectedId=record.id;update();}});tabs.append(button);}
    tabs.scrollLeft=left;
  }
  function renderTankDetail(){
    const loadedId=resources.state.tanks[selectedUse]?.molecule,loadoutId=resources.selectedLoadout()[selectedUse],list=candidates(selectedUse);if(selectedId!==null&&!list.some(record=>record.id===selectedId))selectedId=null;if(selectedId===null&&loadoutId&&list.some(record=>record.id===loadoutId))selectedId=loadoutId;
    q('tank-detail').hidden=false;q('tank-detail-title').textContent=TANK_USES[selectedUse].label;renderCandidates(list,loadedId);
    const empty=q('tank-empty'),model=q('tank-model'),decision=q('tank-craft-molecule');empty.hidden=!!list.length;model.hidden=!selectedId;decision.hidden=true;
    if(!list.length){empty.textContent='発見済み分子なし';q('tank-comparison').hidden=true;releaseViewer();}
    const record=resources.record(selectedId);if(record){q('tank-model-name').textContent=`${formula(record)} · ${name(record)}`;mountViewer(record);renderComparison(record);}else{releaseViewer();q('tank-comparison').replaceChildren();q('tank-comparison').hidden=true;}
    const loaded=tankRecord(selectedUse),tank=resources.state.tanks[selectedUse],loadedStatus=resources.tankStatus(selectedUse),loadTrack=q('tank-load-meter').parentElement;q('tank-load').textContent=loaded?`${formula(loaded)} ${tank.amount}`:'∅';styleTankMeter(loadTrack,selectedUse,tank.molecule);loadTrack.setAttribute('role','meter');loadTrack.setAttribute('aria-label',`${TANK_USES[selectedUse].label}の現在残量`);loadTrack.setAttribute('aria-valuemin','0');loadTrack.setAttribute('aria-valuemax',String(loadedStatus.loadedCapacity||1));loadTrack.setAttribute('aria-valuenow',String(tank.amount));setTankMeterLevel(loadTrack,loadedStatus.loadedCapacity?tank.amount/loadedStatus.loadedCapacity:0);

  }
  function renderLaunchPlan(){return resources.launchFillPlan();}
  function renderShell(){
    const plan=resources.launchFillPlan(),preview=plan.status==='FULL'?plan.full:plan.partial,selected=resources.selectedLoadout();for(const use of USE_ORDER){const button=q(`shell-${use}`),id=selected[use],record=id?resources.record(id):null,entry=preview.entries.find(item=>item.use===use),presentation=TANK_PRESENTATION[use],capacity=entry?.capacity??0,amount=entry?.target??0;button.style.setProperty('--tank-color',presentation.color);button.querySelector('i').textContent=presentation.icon;button.dataset.active=String(use===selectedUse);button.setAttribute('aria-pressed',String(use===selectedUse));button.querySelector('small').textContent=record?formula(record):'∅';let track=button.querySelector('.tank-scale');if(!track){track=document.createElement('span');track.className='tank-scale';track.append(document.createElement('b'));button.append(track);}styleTankMeter(track,use,id);track.setAttribute('role','meter');track.setAttribute('aria-label',`${TANK_USES[use].label}の出発時プレビュー`);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(capacity||1));track.setAttribute('aria-valuenow',String(amount));setTankMeterLevel(track,capacity?amount/capacity:0);}
    drawCollectorShellPreview(shellCanvas);drawAccessIcon();
  }
  function renderUpgrades(){
    upgrades.hidden=selectedUse!=='oxidizer';upgrades.replaceChildren();if(upgrades.hidden)return;
    const plan=resources.oxygenUpgradePlan(),level=resources.state.upgrades.oxygenTank;
    const action=document.createElement('button');action.type='button';action.dataset.upgrade=plan?.id??'complete';action.textContent=plan?`${plan.icon} O₂ → ${plan.capacity}`:'▧ O₂ 72 ✓';action.setAttribute('aria-label',plan?`${plan.name}。恒久加工。${Object.entries(plan.cost).map(([el,n])=>`${el} ${n}`).join('、')}`:'Composite Overwrap 完了');action.disabled=!plan?.available||!plan?.affordable||resources.blocked;upgrades.append(action);upgrades.dataset.level=String(level);
    if(!plan)return;
    for(const id of plan.requires){const button=document.createElement('button'),record=resources.record(id);button.type='button';button.dataset.material=id;button.disabled=!resources.state.hints.includes(id)&&!resources.state.recipes.includes(id);thumbnail(button,record??{id});button.setAttribute('aria-label',name(record)||id);button.append(Object.assign(document.createElement('span'),{textContent:`${formula(record)||id}${resources.state.recipes.includes(id)?' ✓':''}`}));button.addEventListener('click',()=>{dialog.close();window.dispatchEvent(new window.CustomEvent('molecule-craft:craft-molecule',{detail:{id}}));});upgrades.append(button);}
    const cost=document.createElement('small');cost.textContent=Object.entries(plan.cost).map(([el,n])=>`${el} ×${n}`).join(' · ');upgrades.append(cost);
    action.addEventListener('click',()=>{if(!canMake()||onCommit()===false)return;if(resources.upgradeOxygenTank())update();});
  }
  function update(){
    const state=resources.state;syncElementStocks(document,state.elements);
    renderShell();renderTankDetail();renderUpgrades();q('supply-announcement').textContent=announcement;q('supply-announcement').hidden=!announcement;
    q('oxygen-route-guide').hidden=!state.progress.foundElements.includes('O');

    const anchors=`${state.progress.regions.join('|')}|${state.progress.checkpoint}`;if(anchors!==anchorsKey){anchorsKey=anchors;const list=q('expedition-anchor'),selected=list.value;list.replaceChildren();for(const [id,text]of [['continue','探索の続き'],...state.progress.regions.map(id=>[id,REGIONS[id].name])]){const option=document.createElement('option');option.value=id;option.textContent=text;list.append(option);}list.value=selected&&[...list.options].some(option=>option.value===selected)?selected:'continue';renderLaunchDestinations();}
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
  function commitFill(){return false;}
  function showPartialConfirm(plan){
    const confirmation=launchConfirmationState(plan);partialRows.replaceChildren();partialPanel.dataset.fillState=confirmation.zeroFill?'ZERO':'PARTIAL';partialGo.textContent=confirmation.zeroFill?'この状態で出る':'この量で出る';
    if(confirmation.zeroFill){const blocked=document.createElement('strong');blocked.textContent='搭載できません';blocked.dataset.fillUnavailable='true';Object.assign(blocked.style,{fontSize:'15px',lineHeight:'1.4',color:'#f1f7f9'});partialRows.append(blocked);}
    for(const item of confirmation.rows){const row=document.createElement('div'),head=document.createElement('div'),identity=document.createElement('strong'),amount=document.createElement('span'),track=document.createElement('i'),fill=document.createElement('b'),record=resources.record(item.molecule);row.dataset.molecule=item.molecule;row.dataset.actual=String(item.actual);row.dataset.requested=String(item.requested);Object.assign(row.style,{display:'grid',gap:'5px',minWidth:'0'});Object.assign(head.style,{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',alignItems:'baseline',gap:'10px'});identity.textContent=[formulaId(item.molecule),name(record)].filter(Boolean).join(' · ');Object.assign(identity.style,{minWidth:'0',overflowWrap:'anywhere'});amount.textContent=`${item.actual} / ${item.requested}`;amount.setAttribute('aria-label',`搭載可能量 ${item.actual} / 希望量 ${item.requested}`);Object.assign(amount.style,{fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap',fontWeight:'800'});head.append(identity,amount);Object.assign(track.style,{display:'block',height:'5px',borderRadius:'4px',background:'#304553',overflow:'hidden'});Object.assign(fill.style,{display:'block',height:'100%',transformOrigin:'left',transform:`scaleX(${item.requested?item.actual/item.requested:0})`,background:'#9ad8e5'});track.append(fill);row.append(head,track);partialRows.append(row);}
    if(confirmation.shortages.length){const shortage=document.createElement('p');shortage.dataset.launchShortage='true';shortage.textContent=`${confirmation.shortages.map(item=>`${item.element} が${item.count}個`).join('、')}足りません`;Object.assign(shortage.style,{margin:'2px 0 0',fontSize:'13px',fontWeight:'800',lineHeight:'1.45',color:'#ffd0a3',overflowWrap:'anywhere'});partialRows.append(shortage);}
    partialPanel.hidden=false;queueMicrotask(()=>{partialPanel.scrollIntoView?.({block:'nearest',behavior:reduced?'auto':'smooth'});partialGo.focus?.({preventScroll:true});});
  }
  async function playSynthesis(plan){
    if(reduced||!plan||typeof Element==='undefined'){return;}synthesisLayer.replaceChildren();const atoms=[];for(const [el,n]of Object.entries(plan.cost))for(let i=0;i<Math.min(4,n);i++)atoms.push(el);if(!atoms.length)return;const rect=shellMap.getBoundingClientRect();for(const [index,el]of atoms.entries()){const dot=document.createElement('span');dot.textContent=el;Object.assign(dot.style,{position:'absolute',left:`${24+(index%4)*18}%`,bottom:'4px',width:'22px',height:'22px',display:'grid',placeItems:'center',borderRadius:'50%',border:'1px solid #bfefff',background:'#123142ee',fontSize:'10px',fontWeight:'800'});synthesisLayer.append(dot);dot.animate?.([{transform:'translate(0,0) scale(.7)',opacity:.2},{transform:`translate(${rect.width*(.5-(.24+(index%4)*.18))}px,${-rect.height*.32}px) scale(1)`,opacity:1,offset:.58},{transform:`translate(${rect.width*(.52-(.24+(index%4)*.18))}px,${-rect.height*.48}px) scale(.35)`,opacity:0}],{duration:460,index,easing:'ease-in-out',fill:'forwards'});}await new Promise(resolve=>setTimeout(resolve,480));synthesisLayer.replaceChildren();
  }
  async function commitAndContinue(partial){
    if(launchBusy||resources.blocked||!canOpen())return false;
    launchBusy=true;
    try{
      if(onPrepareLaunch()===false){update();return false;}
      const result=resources.commitLaunchFill({partial});
      if(!result){update();return false;}
      update();
      if(Object.keys(result.plan.cost).length)await playSynthesis(result.plan);
      if(dialog.open)dialog.close();
      let started=false;
      try{started=onLaunchReady()!==false;}catch(error){console.error('Expedition launch failed after loadout commit.',error);}
      if(started)return true;
      if(!resources.blocked&&canOpen()&&!dialog.open)dialog.showModal();
      update();
      return false;
    }finally{
      launchBusy=false;
    }
  }

  q('open-supply').addEventListener('click',()=>{if(!canOpen())return;announcement='';partialPanel.hidden=true;dialog.showModal();update();resetLaunchGesture();});
  for(const use of USE_ORDER)q(`shell-${use}`).addEventListener('click',()=>{resetLaunchGesture();selectedUse=use;selectedId=null;update();});
  q('expedition-anchor').addEventListener('change',()=>onAnchor(q('expedition-anchor').value));q('launch-veil').addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();if(launchBusy||resources.blocked||!canOpen())return;const plan=renderLaunchPlan();if(plan.status==='IMPOSSIBLE'){partialPanel.hidden=true;return;}if(plan.status==='PARTIAL'){showPartialConfirm(plan);return;}commitAndContinue(false);});partialGo.addEventListener('click',()=>{partialPanel.hidden=true;commitAndContinue(true);});partialBack.addEventListener('click',()=>{partialPanel.hidden=true;});dialog.addEventListener('close',()=>{partialPanel.hidden=true;releaseViewer();resetLaunchGesture();q('tank-comparison')._loadoutPreviewToken?.cancel?.();});
  q('tank-open-collection').addEventListener('click',openCollection);q('tank-craft-molecule').addEventListener('click',startCraft);
  q('oxygen-co2-hint').addEventListener('click',()=>{dialog.close();window.dispatchEvent(new window.CustomEvent('molecule-craft:open-molecule',{detail:{id:'carbon-dioxide'}}));});
  if(globalThis.ResizeObserver){new ResizeObserver(()=>{drawAccessIcon();if(dialog.open)drawCollectorShellPreview(shellCanvas);}).observe(accessCanvas);new ResizeObserver(()=>{if(dialog.open)drawCollectorShellPreview(shellCanvas);}).observe(shellCanvas);}
  drawAccessIcon();renderRouteGuide();update();
  return {update,openMolecule,discovered(id){const uses=resources.tankUses(id);if(uses.length){selectedUse=uses[0];selectedId=id;}},clearAnnouncement(){announcement='';},usesFor:id=>resources.tankUses(id),tankStatus:(use,id)=>resources.tankStatus(use,id),fillPlan:(use,id)=>resources.tankFillPlan(use,id),commitFill,get open(){return dialog.open;}};
}
