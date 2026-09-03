import { MOLECULE_USES,REGIONS,TANK_USES } from './growth.js';
import { performanceFor } from './molecule-roles.js';

const USE_ORDER=['propellant','fuel','oxidizer','coolant'];

export function createSupplyUI({resources,canOpen,canMake,onCommit,onAnchor}){
  const q=id=>document.getElementById(id),dialog=q('supply-dialog');
  let selectedUse='propellant',selectedId=null,anchorsKey='',announcement='',viewer=null,viewerKey='',viewerGeneration=0,modelTap=null;
  const formula=record=>MOLECULE_USES[record?.id]?.formula??record?.formula??'';
  const name=record=>record?.commonNameJa??record?.nameJa??record?.name??MOLECULE_USES[record?.id]?.name??'';
  const candidates=use=>resources.tankCatalog(use);
  const tankRecord=use=>{const id=resources.state.tanks[use]?.molecule;return id?resources.record(id):null;};

  function releaseViewer(){viewerGeneration++;viewer?.dispose();viewer=null;viewerKey='';q('tank-model-host')?.replaceChildren();}
  function openCollection(){if(!selectedId)return;dialog.close();window.dispatchEvent(new window.CustomEvent('molecule-craft:open-molecule',{detail:{id:selectedId}}));}
  function mountViewer(record){
    const host=q('tank-model-host'),key=record?.id??'';if(!dialog.open||!record||viewerKey===key)return;
    releaseViewer();viewerKey=key;const generation=viewerGeneration;const status=document.createElement('p');status.className='model-status';status.textContent='模型を準備しています…';host.append(status);
    import('../collection-viewer.js?v=31').then(({createCollectionViewer})=>{
      if(generation!==viewerGeneration||!dialog.open||viewerKey!==key||!host.isConnected)return;
      host.replaceChildren();viewer=createCollectionViewer({host,record,name:name(record)});
    }).catch(()=>{if(generation===viewerGeneration){host.replaceChildren();const failed=document.createElement('p');failed.className='model-status';failed.textContent='模型を表示できません';host.append(failed);}});
  }
  function metric(label,value){const row=document.createElement('div'),text=document.createElement('span'),track=document.createElement('i'),fill=document.createElement('b');text.textContent=label;fill.style.transform=`scaleX(${Math.max(0,Math.min(1,value??0))})`;track.append(fill);row.append(text,track);return row;}
  function renderMetrics(record){
    const host=q('tank-comparison');host.replaceChildren();const performance=performanceFor(record?.id,selectedUse);
    if(selectedUse==='fuel'&&performance){const oxygen=performance.capacity*performance.oxygenPerFuel;host.append(metric(`持続性能 ${Math.round(performance.energy*100)}%`,performance.energy/5.2),metric(`満載時O₂ ${oxygen}`,oxygen/60));}
    if(selectedUse==='propellant'&&performance){const bursts=Math.floor(performance.capacity/performance.moleculesPerBurst);host.append(metric(`瞬発力 ${Math.round(performance.burstPower*100)}%`,performance.burstPower),metric(`BURST ${bursts}回`,bursts/10));}
    host.hidden=!host.childElementCount;
  }
  function renderTankDetail(){
    const list=candidates(selectedUse),loadedId=resources.state.tanks[selectedUse]?.molecule;if(!list.some(record=>record.id===selectedId))selectedId=list.some(record=>record.id===loadedId)?loadedId:list[0]?.id??null;
    q('tank-detail').hidden=false;q('tank-detail-title').textContent=TANK_USES[selectedUse].label;
    const tabs=q('tank-molecules');tabs.replaceChildren();
    for(const record of list){const button=document.createElement('button');button.type='button';button.dataset.moleculeId=record.id;button.setAttribute('aria-pressed',String(record.id===selectedId));button.textContent=`${formula(record)} · ${name(record)}`;button.addEventListener('click',()=>{selectedId=record.id;update();});tabs.append(button);}
    const empty=q('tank-empty'),model=q('tank-model');empty.hidden=!!list.length;model.hidden=!list.length;
    if(!list.length){empty.textContent='発見済み分子なし';q('tank-comparison').hidden=true;releaseViewer();}
    const record=resources.record(selectedId),status=selectedId?resources.tankStatus(selectedUse,selectedId):resources.tankStatus(selectedUse);
    if(record){q('tank-model-name').textContent=`${formula(record)} · ${name(record)}`;mountViewer(record);renderMetrics(record);}
    const loaded=tankRecord(selectedUse),tank=resources.state.tanks[selectedUse],loadedStatus=resources.tankStatus(selectedUse);q('tank-load').textContent=loaded?`${formula(loaded)} ${tank.amount} / ${loadedStatus.loadedCapacity}`:'EMPTY';
    q('tank-load-meter').style.transform=`scaleX(${loadedStatus.loadedCapacity?tank.amount/loadedStatus.loadedCapacity:0})`;
    q('tank-replacement').hidden=!status?.replacing;q('tank-replacement').textContent=status?.replacing?`${formula(loaded)}を排出して${formula(record)}へ入替`:'';
  }
  function renderShell(){
    for(const use of USE_ORDER){const button=q(`shell-${use}`),tank=resources.state.tanks[use],record=tankRecord(use),status=resources.tankStatus(use);button.dataset.active=String(use===selectedUse);button.setAttribute('aria-pressed',String(use===selectedUse));button.querySelector('small').textContent=record?`${formula(record)} ${tank.amount}/${status.loadedCapacity}`:'—';}
  }
  function update(){
    const state=resources.state;
    for(const element of ['H','C','O']){q(`resource-${element.toLowerCase()}`).textContent=state.elements[element];if(element!=='H')q(`stock-${element.toLowerCase()}`).hidden=!resources.canUseElement(element);}
    renderShell();renderTankDetail();q('supply-announcement').textContent=announcement;q('supply-announcement').hidden=!announcement;
    const anchors=state.progress.regions.join('|');if(anchors!==anchorsKey){anchorsKey=anchors;const list=q('expedition-anchor'),selected=list.value;list.replaceChildren();for(const [id,text]of [['continue','探索の続き'],...state.progress.regions.map(id=>[id,REGIONS[id].name])]){const option=document.createElement('option');option.value=id;option.textContent=text;list.append(option);}list.value=selected||'continue';}
  }
  function directFill(use,id){
    if(resources.blocked||!canMake()||onCommit()===false)return false;
    const filled=resources.transferMoleculesToTank(use,id,1)||resources.fillTankFromElements(use,id);if(filled){const record=resources.record(id),tank=resources.tankStatus(use,id);announcement=`${formula(record)} ${tank.current}/${tank.capacity}`;update();}return filled;
  }

  q('open-supply').addEventListener('click',()=>{if(!canOpen())return;announcement='';dialog.showModal();update();});
  for(const use of USE_ORDER)q(`shell-${use}`).addEventListener('click',()=>{selectedUse=use;selectedId=null;update();});
  q('expedition-anchor').addEventListener('change',()=>onAnchor(q('expedition-anchor').value));
  q('launch-veil').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',releaseViewer);
  const model=q('tank-model');model.addEventListener('pointerdown',event=>{if(event.target.closest?.('button')){modelTap=null;return;}modelTap={id:event.pointerId,x:event.clientX,y:event.clientY};});model.addEventListener('pointermove',event=>{if(modelTap?.id===event.pointerId&&Math.hypot(event.clientX-modelTap.x,event.clientY-modelTap.y)>8)modelTap=null;});for(const type of ['pointerup','pointercancel'])model.addEventListener(type,event=>{const tapped=type==='pointerup'&&modelTap?.id===event.pointerId;modelTap=null;if(tapped)openCollection();});model.addEventListener('keydown',event=>{if(event.target.closest?.('button'))return;if(['Enter',' '].includes(event.key)){event.preventDefault();openCollection();}});
  window.addEventListener('molecule-craft:craft-molecule',event=>{const record=resources.record(event.detail?.id);if(!record)return;announcement=`${formula(record)}をクラフト`;q('craft-resource-hint').textContent=announcement;});
  update();
  return {update,discovered(id){const uses=resources.tankUses(id);if(uses.length){selectedUse=uses[0];selectedId=id;}},clearAnnouncement(){announcement='';},usesFor:id=>resources.tankUses(id),tankStatus:(use,id)=>resources.tankStatus(use,id),directFill,get open(){return dialog.open;}};
}
