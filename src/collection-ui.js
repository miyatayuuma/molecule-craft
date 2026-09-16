import {isCHO} from './veil/cho-campaign.js';
import { validateFunctionalGroups } from './functional-groups.js?v=21';
import { validateCraftStructures } from './craft-structures.js?v=31';
import { createCollectionState, MILESTONES } from './collection-state.js?v=37';
import { createElementPalette, ELEMENT_UNLOCKS } from './element-progression.js?v=38';
import { COLLECTION_CATEGORIES, collectionCategory, moleculeDisplayName } from './collection-catalog.js';
import {loadMoleculeGraph} from './molecule-graph.js?v=2';
import {GRAPH_NODE_STATE,graphNodeState,selectInitialGraphFocus,transitionGraphFocus} from './encyclopedia-graph.js?v=2';
import {ENCYCLOPEDIA_MOTION,renderEncyclopediaGraph} from './encyclopedia-graph-view.js?v=4';
import {createMoleculeTransitionController,encyclopediaDetailVisualRect,encyclopediaVisualRect} from './encyclopedia-molecule-transition.js?v=2';
import {renderChemistryVisuals,validateChemistryVisualSpecs} from './encyclopedia-chemistry-visuals.js?v=3';

export async function loadCollectionData(){
  const load=async path=>{const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw new Error(`Collection data HTTP ${response.status}`);return response.json();};
  const [groups,templates,encyclopedia,graph]=await Promise.all([
    load('../data/functional-groups.json?v=25'),
    load('../data/craft-structures.json?v=25'),
    load('../data/encyclopedia.json?v=31').catch(()=>({molecules:{},parts:{},noteDefinitions:{}})),
    loadMoleculeGraph({url:new URL('../data/molecule-graph.json',import.meta.url).href}),
  ]);
  validateFunctionalGroups(groups);validateCraftStructures(templates,groups);return {groups,templates,encyclopedia,graph};
}

export async function createCollectionUI({records,onPlace,canOpen=()=>true,onOpenChange=()=>{},storage,root=document,elementPalette=createElementPalette(root),elementAccess=()=>true,recipeState=()=>({recipes:[],hints:[]})}){
  const data=await loadCollectionData();
  validateChemistryVisualSpecs(data.encyclopedia,records);
  if(storage===undefined){try{storage=window.localStorage;}catch{storage=null;}}
  const state=createCollectionState({records,...data,storage,elementAccess});
  const q=id=>root.querySelector(`#${id}`),dialog=q('collection-dialog'),list=q('collection-list'),detail=q('collection-detail');
  let tab='molecules',category='all',filter='available',scope='cho',currentDetail=null,detailViewer=null,detailGeneration=0,listScroll=0,detailTransitionHandle=null;
  let graphFocusId=null,graphHighlightId=null,lastGraphPositions=new Map(),lastGraphVisibleIds=new Set(),suppressNextGraphMotion=false;
  q('collection-scope')?.addEventListener('change',()=>{if(moleculeTransition?.busy)return;scope=q('collection-scope').value;currentDetail=null;renderBook();});
  const collectibleGroups=data.groups.filter(group=>group.collectible!==false);
  const groupById=id=>data.groups.find(group=>group.id===id),recordById=id=>records.find(record=>record.id===id);
  const collectibleMatches=record=>state.detectedFor(record).filter(match=>groupById(match.id).collectible!==false);
  const entry=(kind,id)=>(kind==='molecules'?data.encyclopedia.molecules:data.encyclopedia.parts)?.[id];
  const number=(kind,id)=>entry(kind,id)?.number??((kind==='molecules'?records:collectibleGroups).findIndex(item=>item.id===id)+1);
  const numberLabel=(kind,id)=>`No. ${String(number(kind,id)).padStart(3,'0')}`;
  const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
  const button=(text,handler,className)=>{const node=el('button',text,className);node.type='button';node.addEventListener('click',handler);return node;};
  const section=(title)=>{const node=el('details',null,'detail-extras');node.append(el('summary',title));detail.append(node);return node;};
  const registeredIds=()=>new Set(records.filter(record=>state.hasMolecule(record.id)).map(record=>record.id));
  function graphStateOptions(){const resources=recipeState?.()??{},registered=registeredIds();return {registeredIds:registered,recipes:new Set(resources.recipes??[]),hints:new Set(resources.hints??[])};}
  function ensureGraphFocus(){
    const options=graphStateOptions(),entriesById=new Map([...options.registeredIds].map(id=>[id,state.moleculeEntry(id)]));
    graphFocusId=selectInitialGraphFocus(data.graph,{...options,previousId:graphFocusId,entriesById});return graphFocusId;
  }
  function releaseViewer(){detailGeneration++;detailViewer?.dispose();detailViewer=null;}
  const prefersReducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
  const moleculeAsset=id=>new URL(`../assets/models/molecule-${id}.svg`,import.meta.url).href;
  const transitionDocument=root?.nodeType===9?root:root?.ownerDocument??document;
  const moleculeTransition=createMoleculeTransitionController({document:transitionDocument,win:window,assetFor:moleculeAsset,duration:ENCYCLOPEDIA_MOTION.detailZoomDuration,easing:ENCYCLOPEDIA_MOTION.easing});
  const currentMoleculeId=()=>currentDetail?.kind==='molecules'?currentDetail.id:null;
  const detailChrome=modelHost=>[...detail.children].filter(node=>node!==modelHost);
  function hideDetailChrome(modelHost){for(const node of detailChrome(modelHost))node.style.opacity='0';}
  function revealDetailChrome(modelHost){const nodes=detailChrome(modelHost);if(prefersReducedMotion()){for(const node of nodes)node.style.opacity='';return;}for(const node of nodes){const animation=node.animate?.([{opacity:0},{opacity:1}],{duration:190,easing:'ease-out',fill:'forwards'});animation?.finished?.catch(()=>{}).then(()=>{if(node.isConnected)node.style.opacity='';});}}
  async function fadeDetailChrome(modelHost){
    const nodes=detailChrome(modelHost);if(prefersReducedMotion()){for(const node of nodes)node.style.opacity='0';return;}const animations=nodes.map(node=>node.animate?.([{opacity:1},{opacity:0}],{duration:140,easing:'ease-out',fill:'forwards'})).filter(Boolean);await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));for(const node of nodes)node.style.opacity='0';
  }
  async function showMoleculeDetailFromGraph(id,sourceNode){
    const record=recordById(id);if(!record||!state.hasMolecule(id)||moleculeTransition.busy)return false;
    const source=sourceNode?.querySelector?.('.graph-focus-thumbnail')??sourceNode,from=encyclopediaVisualRect(source);if(!from)return showDetail('molecules',id);
    const handle=moleculeTransition.begin({id,direction:'to-detail',sourceVisual:source,sourceRect:from,sourceImage:moleculeAsset(id),sourceSurface:sourceNode?.closest?.('.graph-stage'),sourceFit:'cover',sourceRadius:'50%'});if(!handle)return showDetail('molecules',id);detailTransitionHandle=handle;
    if(!currentDetail)listScroll=dialog.scrollTop;tab='molecules';currentDetail={kind:'molecules',id};renderBook();dialog.scrollTop=0;
    const host=detail.querySelector(`.molecule-detail-return[data-molecule-id="${id}"]`),to=encyclopediaDetailVisualRect(host);if(!host||!to){detailTransitionHandle=null;moleculeTransition.cancel({owner:'detail'});return true;}hideDetailChrome(host);
    const completed=await moleculeTransition.attach(handle,{targetVisual:host,targetRect:to,targetImage:detailViewer?.snapshot?.()??null,targetFit:'contain',targetRadius:'0px'});if(detailTransitionHandle===handle)detailTransitionHandle=null;if(completed)revealDetailChrome(host);host?.focus?.({preventScroll:true});return completed;
  }
  async function returnMoleculeDetailToGraph(id,modelHost){
    const currentId=currentMoleculeId()??id,record=recordById(currentId);if(!record||moleculeTransition.busy)return false;const from=encyclopediaDetailVisualRect(modelHost);if(!from)return false;
    const handle=moleculeTransition.begin({id:currentId,direction:'to-graph',sourceVisual:modelHost,sourceRect:from,sourceImage:detailViewer?.snapshot?.()??moleculeAsset(currentId),sourceFit:'contain',sourceRadius:'0px'});if(!handle)return false;detailTransitionHandle=handle;await fadeDetailChrome(modelHost);
    currentDetail=null;graphFocusId=currentId;graphHighlightId=null;suppressNextGraphMotion=true;renderBook();dialog.scrollTop=listScroll;
    const targetNode=list.querySelector(`[data-graph-id="${currentId}"]`),target=targetNode?.querySelector?.('.graph-focus-thumbnail')??targetNode,to=encyclopediaVisualRect(target),targetSurface=targetNode?.closest?.('.graph-stage');if(!target||!to){detailTransitionHandle=null;moleculeTransition.cancel({owner:'graph'});return false;}
    const completed=await moleculeTransition.attach(handle,{targetVisual:target,targetRect:to,targetImage:moleculeAsset(currentId),targetSurface,targetFit:'cover',targetRadius:'50%'});if(detailTransitionHandle===handle)detailTransitionHandle=null;if(completed)targetNode?.focus?.({preventScroll:true});return completed;
  }
  function installDetailGraphReturn(host,record,name){
    host.classList.add('molecule-detail-return');host.dataset.moleculeId=record.id;host.tabIndex=0;host.setAttribute('role','button');host.setAttribute('aria-label',`${name}からグラフへ戻る`);let press=null;
    host.addEventListener('pointerdown',event=>{if(event.button!==undefined&&event.button!==0)return;press={id:event.pointerId,x:event.clientX,y:event.clientY,at:Date.now()};},true);
    host.addEventListener('pointerup',event=>{if(!press||press.id!==event.pointerId)return;const start=press;press=null;if(Date.now()-start.at>650||Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)return;void returnMoleculeDetailToGraph(currentMoleculeId()??record.id,host);},true);
    host.addEventListener('pointercancel',()=>{press=null;},true);host.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();void returnMoleculeDetailToGraph(currentMoleculeId()??record.id,host);});
  }
  function preview(record,name,{graphReturn=false}={}){
    const host=el('div',null,'collection-model');if(graphReturn)installDetailGraphReturn(host,record,name);detail.appendChild(host);let placeholder=null;if(graphReturn){placeholder=el('img',null,'molecule-detail-continuity-placeholder');placeholder.src=moleculeAsset(record.id);placeholder.alt='';host.appendChild(placeholder);}host.appendChild(el('p','模型を準備しています…','model-status'));
    const generation=detailGeneration;
    import('./collection-viewer.js?v=32').then(({createCollectionViewer})=>{
      if(generation!==detailGeneration||!dialog.open||!host.isConnected)return;
      host.querySelector(':scope > .model-status')?.remove();detailViewer=createCollectionViewer({host,record,name,onReady:({snapshot})=>{
        if(generation!==detailGeneration||!host.isConnected)return;host.dataset.viewerReady='true';if(detailTransitionHandle?.id===record.id&&snapshot)moleculeTransition.updateDestinationImage(detailTransitionHandle,snapshot);const finish=()=>placeholder?.remove?.();if(!placeholder)return;if(prefersReducedMotion()){finish();return;}const animation=placeholder.animate?.([{opacity:1},{opacity:0}],{duration:150,easing:'ease-out',fill:'forwards'});animation?.finished?.catch(()=>{}).then(finish);
      }});
    }).catch(error=>{if(generation===detailGeneration){host.replaceChildren(el('p','模型を読み込めませんでした。','model-status'));console.warn('Collection viewer unavailable',error);}});
  }
  function thumbnail(card,kind,id){
    const record=kind==='molecules'?recordById(id):data.templates.find(item=>item.unlock.groupId===id);
    if(!record){card.append(el('span','', 'unknown-model'));return;}
    const img=el('img',null,'collection-thumbnail');img.src=new URL(`../assets/models/${kind==='molecules'?'molecule':'part'}-${record.id}.svg`,import.meta.url).href;img.alt='';img.width=112;img.height=85;img.loading='lazy';img.decoding='async';
    img.addEventListener('error',()=>{img.replaceWith(el('span','', 'unknown-model'));},{once:true});card.appendChild(img);
  }
  function paletteTab(next){
    for(const node of root.querySelectorAll('[data-palette-tab]')){const active=node.dataset.paletteTab===next;node.setAttribute('aria-selected',String(active));node.tabIndex=active?0:-1;}
    q('element-panel').hidden=next!=='atoms';q('craft-panel').hidden=next!=='structures';
  }
  for(const node of root.querySelectorAll('[data-palette-tab]'))node.addEventListener('click',()=>paletteTab(node.dataset.paletteTab));
  const keyboardTabs=selector=>{
    const nodes=[...root.querySelectorAll(selector)];
    for(const [index,node] of nodes.entries())node.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?nodes.length-1:(index+(event.key==='ArrowRight'?1:-1)+nodes.length)%nodes.length;nodes[next].click();nodes[next].focus();});
  };
  keyboardTabs('[data-palette-tab]');keyboardTabs('[data-book-tab]');
  q('open-collection').addEventListener('click',()=>{if(!canOpen())return;ensureGraphFocus();renderBook();dialog.showModal();document.body.classList.add('collection-open');onOpenChange(true);});
  q('close-collection').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{moleculeTransition.cancel({owner:currentDetail?'detail':'graph'});detailTransitionHandle=null;releaseViewer();document.body.classList.remove('collection-open');onOpenChange(false);});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  for(const node of root.querySelectorAll('[data-book-tab]'))node.addEventListener('click',()=>{if(moleculeTransition.busy)return;tab=node.dataset.bookTab;currentDetail=null;listScroll=0;if(tab==='molecules')ensureGraphFocus();renderBook();});
  q('collection-category').addEventListener('change',event=>{if(moleculeTransition.busy)return;category=event.target.value;currentDetail=null;listScroll=0;renderBook();});
  q('collection-filter').addEventListener('change',event=>{if(moleculeTransition.busy)return;filter=event.target.value;currentDetail=null;listScroll=0;renderBook();});
  function showDetail(kind,id){
    if(moleculeTransition.busy)return false;if(kind==='molecules'&&!state.hasMolecule(id))return false;
    if(!currentDetail)listScroll=dialog.scrollTop;tab=kind;currentDetail={kind,id};renderBook();dialog.scrollTop=0;(kind==='molecules'?detail.querySelector('.molecule-detail-return'):q('detail-back'))?.focus?.({preventScroll:true});return true;
  }
  function focusGraph(id){
    const options=graphStateOptions(),next=transitionGraphFocus(data.graph,ensureGraphFocus(),id,options);graphFocusId=next.focusId;graphHighlightId=next.highlightId;renderBook();return next.changed;
  }
  function openMolecule(id){
    const record=recordById(id);if(!record||!canOpen()||moleculeTransition.busy)return false;
    tab='molecules';currentDetail=null;listScroll=0;scope=isCHO(record.atoms)?'cho':'all';
    const nodeState=graphNodeState(id,graphStateOptions());
    if(nodeState===GRAPH_NODE_STATE.REGISTERED){graphFocusId=id;graphHighlightId=null;currentDetail={kind:'molecules',id};}
    else if(nodeState===GRAPH_NODE_STATE.KNOWN){graphFocusId=id;graphHighlightId=null;}
    else ensureGraphFocus();
    renderBook();if(!dialog.open){dialog.showModal();document.body.classList.add('collection-open');onOpenChange(true);}dialog.scrollTop=0;return nodeState!==GRAPH_NODE_STATE.UNKNOWN;
  }
  window.addEventListener('molecule-craft:open-molecule',event=>openMolecule(event.detail?.id));
  root.querySelector('#show-extra-elements')?.addEventListener('change',()=>renderPalette());
  function renderPalette(){
    elementPalette.update(state);const container=q('craft-palette');container.replaceChildren();
    for(const template of [...data.templates].sort((a,b)=>a.tier-b.tier)){
      if(!root.querySelector('#show-extra-elements')?.checked&&!isCHO(template.atoms))continue;
      if(!state.isUnlocked(template.id)&&!state.hasGroup(template.unlock.groupId))continue;
      const unlocked=state.isUnlocked(template.id),count=state.groupSources(template.unlock.groupId).length;
      const node=button('',()=>{
        if(unlocked)onPlace(template);else if(canOpen()){showDetail('groups',template.unlock.groupId);if(!dialog.open){dialog.showModal();document.body.classList.add('collection-open');onOpenChange(true);}}
      },`craft-part ${unlocked?'unlocked':'locked'}`);
      node.dataset.partId=template.id;
      thumbnail(node,'groups',template.unlock.groupId);
      node.append(el('strong',template.nameJa),el('span',template.notation,'craft-notation'));
      if(!unlocked)node.append(el('small',`解放まで ${count}/${template.unlock.distinctMolecules}`));
      node.title=`${template.nameJa} ${template.notation}`;container.appendChild(node);
    }
    q('craft-empty').hidden=container.childElementCount>0;q('craft-count').textContent=String(state.unlockedCount);
  }
  function renderSummary(){
    const open=q('open-collection');open.replaceChildren(document.createTextNode('図鑑 '),el('small',`${state.discoveredCount}/${records.length}`));
    q('collection-progress').textContent=tab==='molecules'?`${state.discoveredCount} / ${records.length}`:`${state.unlockedCount} / ${data.templates.length} 解放`;
    const storage=q('collection-storage');storage.textContent=state.storageMessage;storage.hidden=!state.storageMessage;
    const save=q('game-save-status');save.textContent=state.storageMessage?'図鑑を保存できません。図鑑で確認してください。':'';save.hidden=!state.storageMessage;
    q('game-loop-hint').textContent=`発見 ${records.filter(r=>isCHO(r.atoms)&&state.hasMolecule(r.id)).length}（CHO） · 図鑑完成は任意のやり込み`;
    const milestoneList=q('collection-milestones');milestoneList.replaceChildren();for(const id of state.milestoneIds())milestoneList.appendChild(el('span',MILESTONES[id],'collection-tag'));
  }
  function visibleItems(kind=tab){
    if(kind==='molecules')return records.filter(item=>state.hasMolecule(item.id)).sort((a,b)=>number(kind,a.id)-number(kind,b.id));
    const visible=(known,available)=>filter==='all'||(filter==='available'?available:filter==='found'?known:!known);
    const items=collectibleGroups
    .filter(item=>scope==='all'||isCHO(item.pattern.atoms))
    .filter(item=>visible(state.hasGroup(item.id),item.pattern.atoms.every(atom=>state.canUseElement(atom.element))));
  return items.sort((a,b)=>number(kind,a.id)-number(kind,b.id));
  }
  function renderGraph(){
    ensureGraphFocus();
    const suppressMotion=suppressNextGraphMotion;suppressNextGraphMotion=false;
    const result=renderEncyclopediaGraph({
      host:list,graph:data.graph,records,stateOptions:graphStateOptions(),focusId:graphFocusId,highlightId:graphHighlightId,
      previousPositions:lastGraphPositions,previousVisibleIds:lastGraphVisibleIds,suppressMotion,
      onFocus:id=>focusGraph(id),onDetail:(id,node)=>showMoleculeDetailFromGraph(id,node),
      onCraft:id=>{window.dispatchEvent(new CustomEvent('molecule-craft:craft-molecule',{detail:{id}}));dialog.close();},
    });
    lastGraphPositions=result.positions;lastGraphVisibleIds=result.visibleIds;
  }
  function renderGroupList(){
    list.className='collection-grid';
    const select=q('collection-category');select.replaceChildren(new Option('すべて','all'));select.value='all';q('collection-filter').value=filter;
    if(q('filter-summary'))q('filter-summary').textContent=q('collection-filter').selectedOptions[0]?.textContent??'';
    list.replaceChildren();
    for(const item of visibleItems('groups')){
      const known=state.hasGroup(item.id),card=button('',()=>showDetail('groups',item.id),`collection-card ${known?'found':'unknown'}`);card.dataset.entryId=item.id;
      card.append(el('small',numberLabel('groups',item.id),'dex-number'));
      if(known){thumbnail(card,'groups',item.id);card.append(el('span',data.templates.some(t=>t.unlock.groupId===item.id&&state.isUnlocked(t.id))?'✓':'●','dex-state'));}
      else card.append(el('span','','unknown-model'));
      card.append(el('strong',known?item.nameJa:'???'));list.appendChild(card);
    }
    if(!list.childElementCount)list.appendChild(el('p','この条件の項目はありません。','collection-note'));
  }
  function renderBook(){
    releaseViewer();renderSummary();
    for(const node of root.querySelectorAll('[data-book-tab]')){const active=node.dataset.bookTab===tab;node.setAttribute('aria-selected',String(active));node.tabIndex=active?0:-1;}
    if(q('collection-scope'))q('collection-scope').value=scope;
    q('collection-controls').hidden=!!currentDetail||tab==='molecules';q('collection-category-label').hidden=true;
    const footer=dialog.querySelector('.book-footer');if(footer)footer.hidden=!!currentDetail;
    list.hidden=!!currentDetail;detail.hidden=!currentDetail;
    if(currentDetail){renderDetail();moleculeTransition.markStable(currentDetail.kind==='molecules'?'detail':'graph',currentDetail.kind==='molecules'?currentDetail.id:graphFocusId);return;}
    if(tab==='molecules'){renderGraph();moleculeTransition.markStable('graph',graphFocusId);return;}
    renderGroupList();
  }
  function renderDetail(){
    detail.replaceChildren();const {kind,id}=currentDetail,nav=el('div',null,`detail-navigation${kind==='molecules'?' molecule-detail-navigation':''}`);
    if(kind==='groups'){const back=button('‹ 一覧',()=>{const previous=currentDetail.id;currentDetail=null;renderBook();dialog.scrollTop=listScroll;[...list.querySelectorAll('button')].find(node=>node.dataset.entryId===previous)?.focus({preventScroll:true});},'book-back');back.id='detail-back';nav.append(back);}
    const items=visibleItems(kind),index=items.findIndex(item=>item.id===id);
    for(const [label,delta]of [['‹',-1],['›',1]]){const next=items[index+delta],node=button(label,()=>{if(next)showDetail(kind,next.id);});node.setAttribute('aria-label',delta<0?'前の項目':'次の項目');node.disabled=index<0||!next;nav.append(node);}detail.append(nav);
    if(kind==='groups'){renderGroup(id);return;}
    const record=recordById(id);if(!record||!state.hasMolecule(id)){currentDetail=null;renderBook();return;}
    const matches=collectibleMatches(record);heading(kind,id,moleculeDisplayName(record),record.formula);
    preview(record,moleculeDisplayName(record),{graphReturn:true});
    const catalogEntry=entry(kind,id)??{};
    detail.append(el('p',catalogEntry.description??'この分子を図鑑に登録しました。','dex-description'));
    const extra=section('くわしく');extra.append(el('p',`${record.nameEn} · ${COLLECTION_CATEGORIES[collectionCategory(record)]}`),el('p',`IUPAC: ${record.iupacNameEn}`));
    if(record.aliases?.length)extra.append(el('p',`別名：${record.aliases.join('、')}`));
    const detailSections=Array.isArray(catalogEntry.details)?catalogEntry.details:[];
    if(detailSections.length){const chemistry=el('div',null,'chemistry-detail');chemistry.append(el('h4','化学のポイント'));for(const item of detailSections){const sectionNode=el('section',null,'chemistry-detail-section');sectionNode.append(el('h5',item.title),el('p',item.body));chemistry.append(sectionNode);}for(const visual of renderChemistryVisuals(document,catalogEntry,record))chemistry.append(visual);extra.append(chemistry);}
    const discovered=state.moleculeEntry(id);extra.append(el('h4','発見'),el('p',`発見 ${discovered.order}番目${discovered.at?` · ${new Date(discovered.at).toLocaleDateString('ja-JP')}`:''}`));
    const tags=el('div',null,'collection-tags');for(const match of matches)tags.append(button(groupById(match.id).nameJa,()=>showDetail('groups',match.id),'collection-tag'));if(matches.length){extra.append(el('h4','見つかる部品'),tags);}
    const relatives=state.isomersOf(record);if(relatives.length){extra.append(el('h4','同じ分子式の仲間'));for(const item of relatives)extra.append(button(state.hasMolecule(item.id)?moleculeDisplayName(item):'???',()=>state.hasMolecule(item.id)&&showDetail('molecules',item.id),'collection-tag'));}
  }
  function heading(kind,id,name,formula=''){
    const host=el('div',null,'detail-heading'),left=el('div');left.append(el('span',numberLabel(kind,id),'dex-number'),el('h3',name));host.append(left);if(formula)host.append(el('p',formula,'detail-formula'));detail.append(host);
  }
  function renderGroup(id){
    const group=groupById(id),known=state.hasGroup(id),sources=state.groupSources(id),part=data.templates.find(item=>item.unlock.groupId===id);
    heading('groups',id,known?group.nameJa:'???');
    if(!known){const box=el('div',null,'unknown-detail');box.append(el('div','','unknown-model'),el('p','分子を完成させると、その中の部品も見つかります。'));detail.append(box);return;}
    if(part)preview(part,group.nameJa);
    detail.append(el('p',entry('groups',id)?.description??group.description,'dex-description'));
    for(const template of data.templates.filter(item=>item.unlock.groupId===id)){
      const unlocked=state.isUnlocked(template.id);detail.append(el('p',unlocked?'✓ この部品は使えます':`解放まで：異なる分子 ${sources.length}/${template.unlock.distinctMolecules}種類で発見`,'unlock-condition'));
      if(unlocked)detail.append(button('部品トレーへ',()=>{paletteTab('structures');dialog.close();},'collection-primary'));
    }
    const extra=section('くわしく');extra.append(el('p',`${group.nameEn} · ${group.notation}`),el('p',group.description));
    if(group.aliases?.length)extra.append(el('p',`別名：${group.aliases.join('、')}`));
    if(part)extra.append(el('p',`接続点：${part.attachments.map(port=>`${part.atoms[port.atom]}に単結合${port.slots}本分`).join('、')}`));
    extra.append(el('h4','見つかった分子'));for(const sourceId of sources)extra.append(button(moleculeDisplayName(recordById(sourceId)),()=>showDetail('molecules',sourceId),'collection-tag'));
  }
  renderPalette();renderSummary();
  return {state,templateFor:id=>state.isUnlocked(id)?data.templates.find(template=>template.id===id):null,
    openMolecule,
    refreshProgress(){state.refreshAccess();renderPalette();renderSummary();if(dialog.open)renderBook();},
    observeStructures(structures){const result=state.observeStructures(structures);if(result.changed){renderPalette();renderSummary();if(dialog.open)renderBook();}return result;},
    describeEvent(event){
      if(!event?.isNew)return '';const messages=[];
      if(root.querySelector('#show-extra-elements')?.checked&&event.unlockedElements?.length)messages.push(`${event.unlockedElements.map(symbol=>`${ELEMENT_UNLOCKS.find(item=>item.symbol===symbol).name}（${symbol}）`).join('・')}を解放`);
      if(event.unlockedParts.length)messages.push(`${event.unlockedParts.map(id=>data.templates.find(template=>template.id===id).nameJa).join('・')}を獲得`);
      return messages.join(' ／ ')||'図鑑に登録しました';
    },
  };
}
