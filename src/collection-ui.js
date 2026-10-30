import {unfinishedCraftIds,pendingReactionRecipeIds,reactionRecipeRowModel} from './pending-craft.js';
import {reactionGroups,renderReactionBook} from './reaction-encyclopedia.js?v=1';
import { validateFunctionalGroups } from './functional-groups.js?v=22';
import { validateCraftStructures } from './craft-structures.js?v=33';
import { createCollectionState, MILESTONES } from './collection-state.js?v=38';
import { createElementPalette } from './element-progression.js?v=38';
import { COLLECTION_CATEGORIES, collectionCategory, moleculeDisplayName } from './collection-catalog.js';
import {loadMoleculeGraph} from './molecule-graph.js?v=2';
import {GRAPH_NODE_STATE,graphNodeState,selectInitialGraphFocus,transitionGraphFocus} from './encyclopedia-graph.js?v=2';
import {ENCYCLOPEDIA_MOTION,renderEncyclopediaGraph} from './encyclopedia-graph-view.js?v=4';
import {createMoleculeTransitionController,encyclopediaDetailVisualRect,encyclopediaVisualRect} from './encyclopedia-molecule-transition.js?v=2';
import {renderChemistryVisuals,validateChemistryVisualSpecs} from './encyclopedia-chemistry-visuals.js?v=5';
import {hamajimaTermSegments} from './hamajima-term-reference.js?v=1';
import {createPolymerCollectionState} from './polymer-collection-state.js?v=1';
import {createPolymerEncyclopediaModel} from './polymer-encyclopedia.js?v=1';

export async function loadCollectionData(){
  const load=async path=>{const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw new Error(`Collection data HTTP ${response.status}`);return response.json();};
  const [groups,templates,encyclopedia,graph]=await Promise.all([
    load('../data/functional-groups.json?v=26'),
    load('../data/craft-structures.json?v=25'),
    load('../data/encyclopedia.json?v=34').catch(()=>({molecules:{},parts:{},noteDefinitions:{}})),
    loadMoleculeGraph({url:new URL('../data/molecule-graph.json',import.meta.url).href}),
  ]);
  validateFunctionalGroups(groups);validateCraftStructures(templates,groups);return {groups,templates,encyclopedia,graph};
}

export async function createCollectionUI({records,onPlace,canOpen=()=>true,onOpenChange=()=>{},storage,root=document,elementPalette=createElementPalette(root),elementAccess=()=>true,recipeState=()=>({recipes:[],hints:[]}),polymerRecords=[],polymerContent=[],polymerRoutes=[],engineeringResources=null}){
  const data=await loadCollectionData();
  validateChemistryVisualSpecs(data.encyclopedia,records);
  if(storage===undefined){try{storage=window.localStorage;}catch{storage=null;}}
  const state=createCollectionState({records,...data,storage,elementAccess});
  const polymerState=createPolymerCollectionState({records:polymerRecords,storage});
  const engineeringRecipes=engineeringResources?.configureEngineering({polymers:polymerRecords,routes:polymerRoutes,molecules:records,polymerState,collectionState:state})??[];
  const polymerContentById=new Map(polymerContent.map(item=>[item.id,item])),polymerRouteById=new Map(polymerRoutes.map(item=>[item.polymerId,item]));
  const q=id=>root.querySelector(`#${id}`),dialog=q('collection-dialog'),list=q('collection-list'),detail=q('collection-detail');
  let reactionAuthority=null,reactionProgress=null,onTryReaction=()=>{};
  let tab='molecules',currentDetail=null,detailViewer=null,detailGeneration=0,listScroll=0,detailTransitionHandle=null,motifReturnMoleculeId=null,discoverySession=null,collectionDialogOpen=false;
  const polymerThumbnailCache=new Map();
  let polymerPreviewGeneration=0,polymerPreviewObserver=null,thumbnailQueue=[],activeThumbnailJob=null;
  const closeWaiters=new Set();
  let graphFocusId=null,graphHighlightId=null,lastGraphPositions=new Map(),lastGraphVisibleIds=new Set(),suppressNextGraphMotion=false;
  const partGroups=data.groups.filter(group=>group.learningRole==='part'),motifGroups=data.groups.filter(group=>group.learningRole==='motif');
  const groupById=id=>data.groups.find(group=>group.id===id),recordById=id=>records.find(record=>record.id===id);
  const partMatches=record=>state.detectedFor(record).filter(match=>groupById(match.id)?.learningRole==='part');
  const motifMatches=record=>state.detectedFor(record).filter(match=>groupById(match.id)?.learningRole==='motif');
  const entry=(kind,id)=>(kind==='molecules'?data.encyclopedia.molecules:data.encyclopedia.parts)?.[id];
  const polymerEntry=id=>createPolymerEncyclopediaModel(polymerRecords,polymerContent,{knownIds:polymerState.entries().map(item=>item.id)}).entry(id);
  const number=(kind,id)=>kind==='molecules'?entry(kind,id)?.number??(records.findIndex(item=>item.id===id)+1):kind==='polymers'?polymerContentById.get(id)?.number??(polymerRecords.findIndex(item=>item.id===id)+1):groupById(id)?.learningRole==='part'?(entry('groups',id)?.number??(partGroups.findIndex(item=>item.id===id)+1)):null;
  const numberLabel=(kind,id)=>{const value=number(kind,id);return Number.isInteger(value)?`No. ${String(value).padStart(3,'0')}`:'';};
  const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
  const appendChemistryText=(host,text)=>{
    const fragment=document.createDocumentFragment();
    for(const segment of hamajimaTermSegments(text)){
      if(segment.kind==='term'){
        const link=document.createElement('a');link.href=segment.reference.url;link.target='_blank';link.rel='noopener noreferrer external';link.textContent=segment.text;fragment.append(link);
      }else fragment.append(document.createTextNode(segment.text));
    }
    host.append(fragment);return host;
  };
  const chemistryParagraph=(text,className)=>appendChemistryText(el('p',null,className),text);
  const chemistryHeading=(text)=>appendChemistryText(el('h5'),text);
  const button=(text,handler,className)=>{const node=el('button',text,className);node.type='button';node.addEventListener('click',handler);return node;};
  const section=(title)=>{const node=el('details',null,'detail-extras');node.append(el('summary',title));detail.append(node);return node;};
  const registeredIds=()=>new Set(records.filter(record=>state.hasMolecule(record.id)).map(record=>record.id));
  function graphStateOptions(){const resources=recipeState?.()??{},registered=registeredIds();return {registeredIds:registered,recipes:new Set(resources.recipes??[]),hints:new Set(resources.hints??[])};}
  function ensureGraphFocus(){
    const options=graphStateOptions(),entriesById=new Map([...options.registeredIds].map(id=>[id,state.moleculeEntry(id)]));
    graphFocusId=selectInitialGraphFocus(data.graph,{...options,previousId:graphFocusId,entriesById});return graphFocusId;
  }
  function releaseViewer(){
    detailGeneration++;detailViewer?.dispose();detailViewer=null;
    polymerPreviewGeneration++;polymerPreviewObserver?.disconnect();polymerPreviewObserver=null;
    thumbnailQueue=[];
    if(activeThumbnailJob){
      activeThumbnailJob.done=true;
      clearTimeout(activeThumbnailJob.timeout);
      activeThumbnailJob.viewer?.dispose();
      activeThumbnailJob.stage.remove();
      activeThumbnailJob=null;
    }
  }
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
  function preview(record,name,{graphReturn=false,presentation=null}={}){
    const host=el('div',null,'collection-model');if(graphReturn)installDetailGraphReturn(host,record,name);detail.appendChild(host);
    const generation=detailGeneration;let mountGeneration=0;
    const continuity=graphReturn?el('img',null,'molecule-detail-continuity-placeholder'):null;
    if(continuity){continuity.src=moleculeAsset(record.id);continuity.alt='';}
    const fadeOut=node=>{if(!node)return;if(prefersReducedMotion()){node.remove();return;}const animation=node.animate?.([{opacity:1},{opacity:0}],{duration:150,easing:'ease-out',fill:'forwards'});animation?.finished?.catch(()=>{}).then(()=>node.remove());};
    const mount=(nextPresentation,{crossfade=false}={})=>{
      const request=++mountGeneration,previousView=record.attachments?.length?null:detailViewer?.view?.()??null,previousSnapshot=crossfade?detailViewer?.snapshot?.():null;
      detailViewer?.dispose();detailViewer=null;host.replaceChildren();host.dataset.viewerReady='false';host.dataset.stereoRelation='';
      let overlay=null;if(previousSnapshot){overlay=el('img',null,'stereo-configuration-transition');overlay.src=previousSnapshot;overlay.alt='';host.append(overlay);}else if(request===1&&continuity)host.append(continuity);
      host.append(el('p','模型を準備しています…','model-status'));
      return import('./collection-viewer.js?v=42').then(({createCollectionViewer})=>new Promise(resolve=>{
        if(request!==mountGeneration||generation!==detailGeneration||!dialog.open||!host.isConnected){resolve(null);return;}
        host.querySelector(':scope > .model-status')?.remove();
        detailViewer=createCollectionViewer({host,record,name,presentation:nextPresentation,initialView:previousView,
          onViewChange:view=>{if(request===mountGeneration&&host.isConnected)host.dataset.viewerView=JSON.stringify(view);},
          onReady:({snapshot,view,stereoDescriptor})=>{
            if(request!==mountGeneration||generation!==detailGeneration||!host.isConnected){resolve(null);return;}
            host.dataset.viewerReady='true';host.dataset.viewerView=JSON.stringify(view);host.dataset.stereoRelation=stereoDescriptor?.relation??'';
            if(detailTransitionHandle?.id===record.id&&snapshot)moleculeTransition.updateDestinationImage(detailTransitionHandle,snapshot);
            if(overlay)fadeOut(overlay);else if(request===1)fadeOut(continuity);
            resolve({relation:stereoDescriptor?.relation??null,view});
          }});
      })).catch(error=>{if(request===mountGeneration&&generation===detailGeneration&&host.isConnected){host.replaceChildren(el('p','模型を読み込めませんでした。','model-status'));console.warn('Collection viewer unavailable',error);}return null;});
    };
    const ready=mount(presentation);
    return{host,ready,setPresentation:(relation,kind='alkene-relative-side')=>mount({kind,relation},{crossfade:true}),view:()=>detailViewer?.view?.()??null};
  }
  function stereoComparisonControl(spec,previewHandle){
    if(!spec||spec.kind!=='alkene-relative-side'||!Array.isArray(spec.states)||spec.states.length!==2)return;
    const relations=new Set(spec.states.map(state=>state.relation));if(!relations.has('same-side')||!relations.has('opposite-side'))return;
    const defaultRelation=relations.has(spec.defaultRelation)?spec.defaultRelation:spec.states[0].relation;
    const host=el('section',null,'stereo-comparison'),toggle=el('div',null,'stereo-state-toggle');toggle.setAttribute('role','group');toggle.setAttribute('aria-label',spec.ariaLabel??'立体配置の比較');
    if(spec.message)host.append(el('p',spec.message,'stereo-comparison-note'));host.append(toggle);
    const buttons=new Map(),sync=relation=>{for(const [key,node]of buttons){const active=key===relation;node.setAttribute('aria-pressed',String(active));node.classList.toggle('selected',active);}host.dataset.relation=relation;};
    let request=0;
    for(const state of spec.states){const node=button(state.label,async()=>{if(node.getAttribute('aria-pressed')==='true')return;const token=++request;host.setAttribute('aria-busy','true');const result=await previewHandle.setPresentation(state.relation,spec.kind);if(token!==request)return;host.removeAttribute('aria-busy');if(result?.relation===state.relation)sync(result.relation);},'stereo-state-button');node.dataset.relation=state.relation;node.setAttribute('aria-pressed','false');buttons.set(state.relation,node);toggle.append(node);}
    sync(defaultRelation);previewHandle.ready.then(result=>{if(result?.relation)sync(result.relation);});detail.append(host);
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
  const notifyOpen=()=>{collectionDialogOpen=true;onOpenChange(true);};
  q('open-collection').addEventListener('click',()=>{if(!canOpen())return;ensureGraphFocus();renderBook();dialog.showModal();document.body.classList.add('collection-open');notifyOpen();});
  q('close-collection').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{moleculeTransition.cancel({owner:currentDetail?'detail':'graph'});detailTransitionHandle=null;releaseViewer();document.body.classList.remove('collection-open');collectionDialogOpen=false;onOpenChange(false);for(const resolve of closeWaiters)resolve();closeWaiters.clear();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  for(const node of root.querySelectorAll('[data-book-tab]'))node.addEventListener('click',()=>{if(discoverySession||moleculeTransition.busy)return;tab=node.dataset.bookTab;currentDetail=null;listScroll=0;if(tab==='molecules')ensureGraphFocus();renderBook();});
  function showDetail(kind,id){
    if(discoverySession||moleculeTransition.busy)return false;if(kind==='molecules'&&!state.hasMolecule(id))return false;if(kind==='motifs'&&!state.hasGroup(id))return false;if(kind==='polymers'&&!polymerState.hasPolymer(id))return false;
    if(!currentDetail)listScroll=dialog.scrollTop;
    if(kind==='motifs'){if(currentDetail?.kind==='molecules')motifReturnMoleculeId=currentDetail.id;tab='molecules';}else tab=kind;
    currentDetail={kind,id};renderBook();dialog.scrollTop=0;(kind==='molecules'?detail.querySelector('.molecule-detail-return'):kind==='motifs'?q('motif-detail-back'):q('detail-back'))?.focus?.({preventScroll:true});return true;
  }
  function focusGraph(id){
    const options=graphStateOptions(),next=transitionGraphFocus(data.graph,ensureGraphFocus(),id,options);graphFocusId=next.focusId;graphHighlightId=next.highlightId;renderBook();return next.changed;
  }
  function openMolecule(id){
    const record=recordById(id);if(!record||!canOpen()||moleculeTransition.busy)return false;
    tab='molecules';currentDetail=null;listScroll=0;
    const nodeState=graphNodeState(id,graphStateOptions());
    if(nodeState===GRAPH_NODE_STATE.REGISTERED){graphFocusId=id;graphHighlightId=null;currentDetail={kind:'molecules',id};}
    else if(nodeState===GRAPH_NODE_STATE.KNOWN){graphFocusId=id;graphHighlightId=null;}
    else ensureGraphFocus();
    renderBook();if(!dialog.open){dialog.showModal();document.body.classList.add('collection-open');notifyOpen();}dialog.scrollTop=0;return nodeState!==GRAPH_NODE_STATE.UNKNOWN;
  }
  function openRegisteredMoleculeEntry(id){
    const record=recordById(id);if(!record||!state.hasMolecule(id))return false;
    if(dialog.open&&currentDetail?.kind==='molecules'&&currentDetail.id===id)return true;
    if(!canOpen())return false;
    if(moleculeTransition.busy)moleculeTransition.cancel();
    tab='molecules';currentDetail={kind:'molecules',id};listScroll=0;
    if(data.graph.nodeById(id)){graphFocusId=id;graphHighlightId=null;}
    renderBook();if(!dialog.open){dialog.showModal();document.body.classList.add('collection-open');notifyOpen();}dialog.scrollTop=0;return true;
  }
  function openPolymer(id){
    const record=polymerRecords.find(item=>item.id===id);if(!record||!polymerState.hasPolymer(id)||!canOpen()||moleculeTransition.busy)return false;
    tab='polymers';currentDetail={kind:'polymers',id};listScroll=0;renderBook();if(!dialog.open){dialog.showModal();document.body.classList.add('collection-open');notifyOpen();}dialog.scrollTop=0;return true;
  }
  function openEntry(kind,id){return kind==='molecules'?openRegisteredMoleculeEntry(id):kind==='polymers'?openPolymer(id):false;}
  window.addEventListener('molecule-craft:open-molecule',event=>openMolecule(event.detail?.id));
  function renderPalette(){
    elementPalette.update(state);const container=q('craft-palette');container.replaceChildren();
    for(const template of [...data.templates].sort((a,b)=>a.tier-b.tier)){
      if(!state.isUnlocked(template.id)&&!state.hasGroup(template.unlock.groupId))continue;
      const unlocked=state.isUnlocked(template.id),count=state.groupSources(template.unlock.groupId).length;
      const node=button('',()=>{
        if(unlocked)onPlace(template);else if(canOpen()){showDetail('groups',template.unlock.groupId);if(!dialog.open){dialog.showModal();document.body.classList.add('collection-open');notifyOpen();}}
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
    const open=q('open-collection');open.textContent='図鑑';
    const knownParts=partGroups.filter(group=>state.hasGroup(group.id)).length;
    const reactionModel=reactionAuthority&&reactionProgress?reactionGroups(reactionAuthority,reactionProgress):null;
    const progress={molecules:[state.discoveredCount,records.length],groups:[knownParts,partGroups.length],reactions:reactionModel?[reactionModel.verified,reactionModel.entries.length]:null,polymers:[polymerState.discoveredCount,polymerRecords.length]};
    for(const node of root.querySelectorAll('[data-book-tab]')){
      const kind=node.dataset.bookTab,counts=progress[kind];
      node.querySelector('[data-book-count]').textContent=counts?`${counts[0]} / ${counts[1]}`:'— / —';
      node.setAttribute('aria-label',`${node.querySelector('.book-tab-label').textContent} ${kind==='reactions'?'実証済み':'発見済み'} ${counts?`${counts[0]} / ${counts[1]}`:'未読み込み'}`);
    }
    const storage=q('collection-storage'),message=[state.storageMessage,polymerState.storageMessage].filter(Boolean).join('　');storage.textContent=message;storage.hidden=!message;
    const save=q('game-save-status');save.dataset.collectionStatus=message?'図鑑を保存できません。図鑑で確認してください。':'';const warnings=[save.dataset.collectionStatus,save.dataset.reactionStatus].filter(Boolean);save.textContent=warnings.join('　');save.hidden=!warnings.length;const labWarning=root.querySelector('#lab-save-warning');if(labWarning){labWarning.textContent=save.textContent;labWarning.hidden=save.hidden;}
    const milestoneList=q('collection-milestones');milestoneList.replaceChildren();for(const id of state.milestoneIds())milestoneList.appendChild(el('span',MILESTONES[id],'collection-tag'));
  }
  function visibleItems(kind=tab){
    if(kind==='molecules')return records.filter(item=>state.hasMolecule(item.id)).sort((a,b)=>number(kind,a.id)-number(kind,b.id));
    if(kind==='polymers')return [...polymerRecords].sort((a,b)=>number(kind,a.id)-number(kind,b.id));
    const source=kind==='motifs'?motifGroups:partGroups;
    const items=source.filter(item=>kind!=='motifs'||state.hasGroup(item.id));
  return items.sort((a,b)=>kind==='motifs'?a.id.localeCompare(b.id):number(kind,a.id)-number(kind,b.id));
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
    const normal=unfinishedCraftIds(recipeState?.()).filter(id=>recordById(id));
    const special=pendingReactionRecipeIds({authority:reactionAuthority,progress:reactionProgress}).map(id=>reactionAuthority.get(id));
    if(normal.length||special.length){
      const panel=el('details',null,'collection-recipe-list'),summary=el('summary',`💡 ひらめいたレシピ（${normal.length+special.length}）`);panel.open=true;panel.append(summary);
      for(const id of normal){const record=recordById(id),item=button(`💡 ${moleculeDisplayName(record)}`,()=>{window.dispatchEvent(new CustomEvent('molecule-craft:craft-molecule',{detail:{id}}));dialog.close();});panel.append(item);}
      for(const entry of special){const model=reactionRecipeRowModel(entry,{records,polymerNameFor:id=>polymerRecords.find(row=>row.id===id)?.nameJa});const item=button(`💡 ${model.name}（${model.detail}）`,()=>onTryReaction(entry.reactionId));item.dataset.reactionRecipe=entry.reactionId;item.className='collection-special-recipe';panel.append(item);}
      list.prepend(panel);
    }
  }
  function renderGroupList(){
    list.className='collection-grid';
    list.replaceChildren();
    for(const item of visibleItems('groups')){
      const known=state.hasGroup(item.id),card=button('',()=>showDetail('groups',item.id),`collection-card ${known?'found':'unknown'}`);card.dataset.entryId=item.id;
      card.append(el('small',numberLabel('groups',item.id),'dex-number'));
      if(known){thumbnail(card,'groups',item.id);card.append(el('span',data.templates.some(t=>t.unlock.groupId===item.id&&state.isUnlocked(t.id))?'✓':'●','dex-state'));}
      // Unknown polymers deliberately reveal only their stable number and ???.
      card.append(el('strong',known?item.nameJa:'???'));list.appendChild(card);
    }
    if(!list.childElementCount)list.appendChild(el('p','項目はありません。','collection-note'));
  }
  // Generate still thumbnails from the same live 3D viewer, one at a time.
  // Cache their rendered frames; no live canvas/context remains in the list.
  function pumpPolymerThumbnails(){
    if(activeThumbnailJob||!thumbnailQueue.length)return;
    const item=thumbnailQueue.shift();
    if(item.generation!==polymerPreviewGeneration||!item.host.isConnected){pumpPolymerThumbnails();return;}
    const stage=el('div',null,'polymer-thumbnail-staging');
    document.body.append(stage);
    const job={stage,viewer:null,timeout:null,done:false};activeThumbnailJob=job;
    const finish=imageData=>{
      if(job.done)return;job.done=true;
      if(item.generation===polymerPreviewGeneration&&item.host.isConnected){
        if(imageData){
          polymerThumbnailCache.set(item.record.id,imageData);
          const image=el('img',null,'polymer-thumbnail');
          image.src=imageData;image.alt=`${item.record.nameJa}の3D構成単位（静止サムネイル）`;
          item.host.replaceWith(image);
        }else item.host.textContent='3D模型を読み込めませんでした';
      }
      queueMicrotask(()=>{
        clearTimeout(job.timeout);
        job.viewer?.dispose();stage.remove();
        if(activeThumbnailJob===job)activeThumbnailJob=null;
        pumpPolymerThumbnails();
      });
    };
    job.timeout=setTimeout(()=>finish(null),5000);
    import('./polymer-unit-preview.js?v=4').then(({mountPolymerUnitPreview})=>{
      if(job.done||activeThumbnailJob!==job)return;
      job.viewer=mountPolymerUnitPreview({
        host:stage,polymerId:item.record.id,name:item.record.nameJa,
        onReady:({snapshot})=>{if(snapshot)finish(snapshot);},
        onThumbnail:data=>finish(data),
      });
    }).catch(error=>{
      console.warn('Polymer 3D thumbnail unavailable',item.record.id,error);
      finish(null);
    });
  }
  function renderPolymerList(){
    list.className='collection-grid';
    list.replaceChildren();
    const previews=[];
    for(const record of visibleItems('polymers')){
      const known=polymerState.hasPolymer(record.id),content=polymerContentById.get(record.id);
      const card=button('',()=>showDetail('polymers',record.id),`collection-card ${known?'found':'unknown'}`);
      card.dataset.entryId=record.id;
      card.append(el('small',`No. ${String(content?.number??number('polymers',record.id)).padStart(3,'0')}`,'dex-number'));
      if(known){
        const cached=polymerThumbnailCache.get(record.id);
        if(cached){
          const image=el('img',null,'polymer-thumbnail');
          image.src=cached;image.alt=`${record.nameJa}の3D構成単位（静止サムネイル）`;
          card.append(image);
        }else{
          const host=el('span','3D準備中…','polymer-thumb-wait');
          card.append(host);previews.push({host,record});
        }
      }
      card.append(el('strong',known?record.nameJa:'???'));
      list.appendChild(card);
    }
    if(!list.childElementCount)list.appendChild(el('p','項目はありません。','collection-note'));
    const generation=polymerPreviewGeneration;
    const enqueue=item=>{
      if(item.host.dataset.previewQueued)return;
      item.host.dataset.previewQueued='true';
      thumbnailQueue.push({...item,generation});pumpPolymerThumbnails();
    };
    if(typeof IntersectionObserver==='function'){
      polymerPreviewObserver=new IntersectionObserver(entries=>{
        for(const entry of entries)if(entry.isIntersecting){
          const item=previews.find(item=>item.host===entry.target);
          if(item){polymerPreviewObserver?.unobserve(item.host);enqueue(item);}
        }
      },{root:dialog,rootMargin:'100px',threshold:0});
      for(const item of previews)polymerPreviewObserver.observe(item.host);
    }else for(const item of previews)enqueue(item);
  }
  function renderBook(){
    releaseViewer();renderSummary();
    for(const node of root.querySelectorAll('[data-book-tab]')){const active=node.dataset.bookTab===tab;node.setAttribute('aria-selected',String(active));node.tabIndex=active?0:-1;}
    for(const node of root.querySelectorAll('[data-book-tab]'))node.disabled=!!discoverySession;
    const footer=dialog.querySelector('.book-footer');if(footer)footer.hidden=!!currentDetail;
    list.hidden=!!currentDetail;detail.hidden=!currentDetail;
    if(currentDetail){renderDetail();if(currentDetail.kind==='molecules')moleculeTransition.markStable('detail',currentDetail.id);return;}
    if(tab==='reactions'){list.replaceChildren();list.classList.add('reaction-book');if(reactionAuthority&&reactionProgress)renderReactionBook({host:list,authority:reactionAuthority,progress:reactionProgress,records,polymerRecords,onTry:onTryReaction});else list.textContent='反応図鑑を準備中です。';return;}
    list.classList.remove('reaction-book');
    if(tab==='molecules'){renderGraph();moleculeTransition.markStable('graph',graphFocusId);return;}
    if(tab==='polymers')renderPolymerList();else renderGroupList();
  }
  function renderDetail(){
    detail.replaceChildren();const {kind,id}=currentDetail;detail.dataset.detailKind=kind;detail.dataset.detailId=id;const nav=el('div',null,`detail-navigation${kind==='molecules'?' molecule-detail-navigation':''}`);
    if(kind==='groups'){const back=button('‹ 一覧',()=>{const previous=currentDetail.id;currentDetail=null;renderBook();dialog.scrollTop=listScroll;[...list.querySelectorAll('button')].find(node=>node.dataset.entryId===previous)?.focus({preventScroll:true});},'book-back');back.id='detail-back';nav.append(back);}
    if(kind==='motifs'){const back=button('‹ 分子',()=>{if(motifReturnMoleculeId)showDetail('molecules',motifReturnMoleculeId);},'book-back');back.id='motif-detail-back';back.disabled=!motifReturnMoleculeId;nav.append(back);}
    const items=kind==='polymers'?polymerRecords.filter(item=>polymerState.hasPolymer(item.id)).sort((a,b)=>number(kind,a.id)-number(kind,b.id)):visibleItems(kind),index=items.findIndex(item=>item.id===id);
    for(const [label,delta]of [['‹',-1],['›',1]]){const next=items[index+delta],node=button(label,()=>{if(next)showDetail(kind,next.id);});node.setAttribute('aria-label',delta<0?'前の項目':'次の項目');node.disabled=!!discoverySession||index<0||!next;nav.append(node);}
    if(discoverySession){const action=button('',()=>{const current=discoverySession;if(!current?.ready)return;if(current.hasNext)current.onNext?.();else current.onReturn?.();},'book-discovery-action');action.dataset.discoverySessionAction='true';nav.append(action);updateDiscoveryAction(action);}
    detail.append(nav);
    if(kind==='groups'||kind==='motifs'){renderGroup(id);return;}
    if(kind==='polymers'){renderPolymerDetail(id);return;}
    const record=recordById(id);if(!record||!state.hasMolecule(id)){currentDetail=null;renderBook();return;}
    const matches=partMatches(record),motifs=motifMatches(record),catalogEntry=entry(kind,id)??{},stereoSpec=catalogEntry.stereoComparison??null;heading(kind,id,moleculeDisplayName(record),record.formula);
    const defaultStereo=stereoSpec?{kind:stereoSpec.kind,relation:stereoSpec.defaultRelation??stereoSpec.states?.[0]?.relation}:null;
    const previewHandle=preview(record,moleculeDisplayName(record),{graphReturn:true,presentation:defaultStereo});
    if(stereoSpec)stereoComparisonControl(stereoSpec,previewHandle);
    detail.append(chemistryParagraph(catalogEntry.description??'この分子を図鑑に登録しました。','dex-description'));
    const extra=section('くわしく');extra.append(el('p',`${record.nameEn} · ${COLLECTION_CATEGORIES[collectionCategory(record)]}`),el('p',`IUPAC: ${record.iupacNameEn}`));
    if(record.aliases?.length)extra.append(el('p',`別名：${record.aliases.join('、')}`));
    const detailSections=Array.isArray(catalogEntry.details)?catalogEntry.details:[];
    if(detailSections.length){const chemistry=el('div',null,'chemistry-detail');for(const item of detailSections){const sectionNode=el('section',null,'chemistry-detail-section');sectionNode.append(chemistryHeading(item.title),chemistryParagraph(item.body));chemistry.append(sectionNode);}for(const visual of renderChemistryVisuals(document,catalogEntry,record))chemistry.append(visual);extra.append(chemistry);}
    const playerNoteKeys=(Array.isArray(catalogEntry.notes)?catalogEntry.notes:[]).filter(key=>key==='stereochemistry');
    for(const key of playerNoteKeys){const text=data.encyclopedia.noteDefinitions?.[key];if(!text)continue;const note=el('p',text,'collection-note');note.dataset.encyclopediaNote=key;extra.append(note);}
    const discovered=state.moleculeEntry(id);extra.append(el('h4','発見'),el('p',`発見 ${discovered.order}番目${discovered.at?` · ${new Date(discovered.at).toLocaleDateString('ja-JP')}`:''}`));
    const tags=el('div',null,'collection-tags');for(const match of matches)tags.append(button(groupById(match.id).nameJa,()=>showDetail('groups',match.id),'collection-tag'));if(matches.length)extra.append(el('h4','見つかる部品'),tags);
    if(motifs.length){const motifTags=el('div',null,'collection-tags');for(const match of motifs){const tag=button(groupById(match.id).nameJa,()=>showDetail('motifs',match.id),'collection-tag structure-motif-tag');tag.dataset.motifId=match.id;motifTags.append(tag);}extra.append(el('h4','構造モチーフ'),motifTags);}
    const relatives=state.isomersOf(record);if(relatives.length){extra.append(el('h4','同じ分子式の仲間'));for(const item of relatives)extra.append(button(state.hasMolecule(item.id)?moleculeDisplayName(item):'???',()=>state.hasMolecule(item.id)&&showDetail('molecules',item.id),'collection-tag'));}
    if(discoverySession)for(const node of detail.querySelectorAll('button:not([data-discovery-session-action])'))node.disabled=true;
  }
  function updateDiscoveryAction(node=detail.querySelector('[data-discovery-session-action]')){
    if(!node||!discoverySession)return;
    const current=discoverySession;node.textContent=current.ready?(current.hasNext?'次の登録':'REACTION LABへ戻る'):'登録表示中…';
    node.disabled=!current.ready;node.setAttribute('aria-label',current.ready?`発見 ${current.index} / ${current.total} · ${current.hasNext?'次の登録':'REACTION LABへ戻る'}`:`発見 ${current.index} / ${current.total} · 登録表示中`);
  }
  function heading(kind,id,name,formula=''){
    const host=el('div',null,'detail-heading'),left=el('div'),numberText=numberLabel(kind,id);if(numberText)left.append(el('span',numberText,'dex-number'));left.append(el('h3',name));host.append(left);if(formula)host.append(el('p',formula,'detail-formula'));detail.append(host);
  }
  function renderGroup(id){
    const group=groupById(id),known=state.hasGroup(id),sources=state.groupSources(id),part=group?.learningRole==='part'?data.templates.find(item=>item.unlock.groupId===id):null;
    heading(currentDetail.kind,id,known?group.nameJa:'???');
    if(!known){const box=el('div',null,'unknown-detail');box.append(el('div','','unknown-model'),el('p','分子を完成させると、その中の部品も見つかります。'));detail.append(box);return;}
    if(part)preview(part,group.nameJa);
    detail.append(chemistryParagraph(entry('groups',id)?.description??group.description,'dex-description'));
    for(const template of part?data.templates.filter(item=>item.unlock.groupId===id):[]){
      const unlocked=state.isUnlocked(template.id);detail.append(el('p',unlocked?'✓ この部品は使えます':`解放まで：異なる分子 ${sources.length}/${template.unlock.distinctMolecules}種類で発見`,'unlock-condition'));
      if(unlocked)detail.append(button('部品トレーへ',()=>{paletteTab('structures');dialog.close();},'collection-primary'));
    }
    const extra=section('くわしく');extra.append(el('p',`${group.nameEn} · ${group.notation}`),chemistryParagraph(group.description));
    if(group.aliases?.length)extra.append(el('p',`別名：${group.aliases.join('、')}`));
    if(part)extra.append(el('p',`接続点：${part.attachments.map(port=>`${part.atoms[port.atom]}に単結合${port.slots}本分`).join('、')}`));
    extra.append(el('h4','見つかった分子'));for(const sourceId of sources)extra.append(button(moleculeDisplayName(recordById(sourceId)),()=>showDetail('molecules',sourceId),'collection-tag'));
  }
  function renderEngineering(polymerId){
    const recipes=engineeringRecipes.filter(recipe=>recipe.inputs.some(input=>input.type==='polymer-discovery'&&input.id===polymerId));
    if(!recipes.length)return;
    const surface=section('Engineering fabrication');surface.open=true;surface.dataset.engineeringFabrication='true';
    const statusLabels={LOCKED_BY_PROGRESSION:'World Awakening後に製作できます',MISSING_INPUT:'材料不足',AVAILABLE:'製作可能',ALREADY_FABRICATED:'製作済み',STORAGE_BLOCKED:'保存を復元するため再読み込みしてください',AUTHORITY_NOT_READY:'製作情報を準備しています'};
    for(const recipe of recipes){
      const eligibility=engineeringResources.engineeringEligibility(recipe.id),row=el('div',null,'engineering-recipe');row.dataset.engineeringRecipe=recipe.id;
      row.append(el('h4',`${recipe.application.nameJa} · ${recipe.label}`));
      const inputs=recipe.inputs.filter(input=>input.type!=='reagent-from-elements').map(input=>input.type==='polymer-discovery'?`${polymerRecords.find(record=>record.id===input.id)?.nameJa}の発見`:input.type==='molecule-discovery'?`${moleculeDisplayName(recordById(input.id))}の発見`:`${input.id} × ${input.amount}`);
      if(recipe.inputs.some(input=>input.type==='reagent-from-elements'))inputs.push(`BASE STOCK: ${Object.entries(recipe.cost).map(([id,amount])=>`${id} × ${amount}`).join(' / ')}`);
      row.append(el('p',inputs.join(' ＋ ')),el('p',statusLabels[eligibility.status]??eligibility.status));
      const action=button(eligibility.status==='ALREADY_FABRICATED'?'製作済み':'製作する',()=>{
        const result=engineeringResources.fabricateEngineering(recipe.id);
        renderDetail();
        if(!result.committed&&result.status==='SAVE_FAILED')detail.append(el('p','製作を保存できません。材料と製作状態は変更していません。','storage-message'));
      },'collection-primary');action.dataset.fabricateRecipe=recipe.id;action.disabled=eligibility.status!=='AVAILABLE';row.append(action);surface.append(row);
    }
    surface.append(el('p','一度製作すると恒久的に解放されます。高分子の発見と代表Sampleは消費しません。'));
  }
  function renderPolymerDetail(id){
    const record=polymerRecords.find(item=>item.id===id),content=polymerContentById.get(id),route=polymerRouteById.get(id),model=polymerEntry(id);
    if(!record||!polymerState.hasPolymer(id)||!content||!route||!model?.known){currentDetail=null;renderBook();return;}
    heading('polymers',id,record.nameJa);
    const generation=detailGeneration,visual=el('div',null,'collection-model');
    visual.dataset.registrationVisual='true';
    const toggle=el('div',null,'polymer-model-toggle');
    toggle.setAttribute('role','group');toggle.setAttribute('aria-label','3D模型の表示範囲');
    const polymerReferenceLabel=id==='phenol-formaldehyde-resin'?'30環':record.topology==='copolymer'?'30構成単位':'30反復単位';
    const options=[['unit','構成単位'],['chain',polymerReferenceLabel]],buttons=new Map();
    let request=0;
    const switchModel=mode=>{
      if(generation!==detailGeneration||!visual.isConnected)return;
      const token=++request;
      for(const [key,node] of buttons){const selected=key===mode;node.setAttribute('aria-pressed',String(selected));node.classList.toggle('selected',selected);}
      detailViewer?.dispose();detailViewer=null;
      const status=el('p',mode==='chain'?`${polymerReferenceLabel}の模型を準備しています…`:'構成単位を準備しています…','model-status');
      status.setAttribute('role','status');visual.replaceChildren(status);
      const modulePromise=mode==='chain'?import('./polymer-long-chain-preview.js?v=2'):import('./polymer-unit-preview.js?v=4');
      modulePromise.then(module=>{
        if(token!==request||generation!==detailGeneration||currentDetail?.kind!=='polymers'||currentDetail.id!==id||!visual.isConnected)return;
        visual.replaceChildren();
        detailViewer=mode==='chain'
          ?module.mountPolymerLongChainPreview({host:visual,polymerId:id,name:record.nameJa})
          :module.mountPolymerUnitPreview({host:visual,polymerId:id,name:record.nameJa});
      }).catch(error=>{
        if(token===request&&generation===detailGeneration&&visual.isConnected)visual.replaceChildren(el('p','3D模型を読み込めませんでした。','model-status'));
        console.warn('Polymer Collection viewer unavailable',id,mode,error);
      });
    };
    for(const [mode,label] of options){
      const action=button(label,()=>switchModel(mode),'polymer-model-mode');
      action.dataset.polymerViewMode=mode;action.setAttribute('aria-pressed',String(mode==='unit'));
      buttons.set(mode,action);toggle.append(action);
    }
    detail.append(toggle,visual);
    switchModel('unit');
    detail.append(chemistryParagraph(content.description,'dex-description'));
    if(content.education?.observe)detail.append(chemistryParagraph('観察してみよう：'+content.education.observe,'polymer-observation-prompt'));
    const learning=section('構造・物性・用途');learning.classList.add('polymer-education');learning.open=true;
    for(const [title,field] of [['分子のしくみ','structure'],['なぜこの性質になる？','property'],['何に使われる？','applications'],['模型だけでは分からないこと','limits']])learning.append(chemistryHeading(title),chemistryParagraph(content.education[field]));
    renderEngineering(id);
    const formationName=({addition:'付加重合',copolymerization:'共重合', 'ring-opening':'開環重合',polycondensation:'縮合重合','condensation-network':'縮合による網目形成'})[record.formation]??record.formation;
    const topologyName=({linear:'線状',copolymer:'共重合体',network:'網目状'})[record.topology]??record.topology;
    const sourceRecords=[...new Set(record.reactants.map(item=>item.moleculeId))].map(recordById).filter(Boolean);
    const process=section('Reaction Labで観察した代表工程');process.append(el('p',route.processLabel,'polymer-process-label'));
    const detailSections=Array.isArray(content.details)?content.details:[];
    const chemistry=el('div',null,'chemistry-detail');
    for(const item of detailSections){const sectionNode=el('section',null,'chemistry-detail-section');sectionNode.append(chemistryHeading(item.title),chemistryParagraph(item.body));chemistry.append(sectionNode);}
    if(chemistry.childElementCount)process.append(chemistry);
    const extra=section('くわしく');extra.append(el('p',`${record.nameEn} · ${record.family}`),el('p',`生成法：${formationName}`),el('p',`トポロジー：${topologyName}`));
    extra.append(el('h4','原料分子'));for(const source of sourceRecords)extra.append(el('span',moleculeDisplayName(source),'collection-tag'));
    if(record.repeatUnit)extra.append(el('h4','代表的な繰り返し単位'),el('p',record.repeatUnit,'polymer-repeat-unit'));
    else if(route.presentation.kind==='network')extra.append(el('h4','代表構造'),el('p','フェノール環がメチレン橋でつながる有限の分岐例です。硬化後の架橋網目全体を再現した模型ではありません。','polymer-repeat-unit'));
    else extra.append(el('h4','代表構造'),el('p','二種類の単量体由来部分を含む代表的な配列です。実際の組成比や並び方を示すものではありません。','polymer-repeat-unit'));
    const waters=route.completionEvidence.byproducts.water;if(waters)extra.append(el('h4','観察された副生成物'),el('p',`水 H₂O × ${waters}`));
    if(route.presentation.qualifiers.length){
      const qualifierLabels={
        'STEREOCHEMISTRY NOT SPECIFIED':'立体配置は指定していません。',
        'REPRESENTATIVE LOCAL SEGMENT':'表示は有限の代表構造です。',
        'BULK COMPOSITION NOT IMPLIED':'実際の全体組成比を示すものではありません。',
        'NETWORK CONTINUES':'樹脂全体の架橋網目は再現していません。',
        'MICROSTRUCTURE VARIES':'付加位置や二重結合の微細構造は製法で変わります。',
        'REGIOCHEMISTRY VARIES':'結合の位置規則性は条件により変わります。',
      };
      extra.append(el('h4','構造上の注意'));
      for(const qualifier of route.presentation.qualifiers)extra.append(el('p',qualifierLabels[qualifier]??qualifier,'polymer-qualifier'));
    }
    const discovered=polymerState.polymerEntry(id);extra.append(el('h4','発見'),el('p',`発見 ${discovered.order}番目${Number.isFinite(discovered.at)?` · ${new Date(discovered.at).toLocaleDateString('ja-JP')}`:''}`));
  }
  renderPalette();renderSummary();
  return {setReactionGuideHandler(handler){onTryReaction=handler;},setReactionProgress(authority,progress){reactionAuthority=authority;reactionProgress=progress;renderSummary();if(dialog.open&&tab==='reactions')renderBook();},state,polymerState,polymerNameFor:id=>polymerRecords.find(record=>record.id===id)?.nameJa??null,templateFor:id=>state.isUnlocked(id)?data.templates.find(template=>template.id===id):null,
    refreshReactionProgress(){renderSummary();if(dialog.open&&tab==='reactions'&&!currentDetail)renderBook();},
    openEntry,openMolecule,openPolymer,
    isOpen:()=>dialog.open,
    closeAndWait(){if(!collectionDialogOpen&&!dialog.open)return Promise.resolve();return new Promise(resolve=>{closeWaiters.add(resolve);if(dialog.open)dialog.close();});},
    setDiscoverySession(value){discoverySession=value?{...value}:null;if(dialog.open){for(const node of root.querySelectorAll('[data-book-tab]'))node.disabled=!!discoverySession;if(discoverySession)updateDiscoveryAction();}},
    registerDiscoveredMolecule(recordId,options={}){const result=state.registerDiscoveredMolecule(recordId,options);if(result.changed){renderPalette();renderSummary();if(dialog.open)renderBook();}return result;},
    registerDiscoveredPolymer(polymerId,options={}){const result=polymerState.registerDiscoveredPolymer(polymerId,options);if(result.changed){renderSummary();if(dialog.open)renderBook();}return result;},
    refreshProgress(){state.refreshAccess();renderPalette();renderSummary();if(dialog.open)renderBook();},
    observeStructures(structures){const result=state.observeStructures(structures);if(result.changed){renderPalette();renderSummary();if(dialog.open)renderBook();}return result;},
    describeEvent(event){
      if(!event?.isNew)return '';if(event.saved===false)return 'この画面の間だけ図鑑に登録しました。保存できていません。';const messages=[];
      if(event.unlockedParts.length)messages.push(`${event.unlockedParts.map(id=>data.templates.find(template=>template.id===id).nameJa).join('・')}を獲得`);
      return messages.join(' ／ ')||'図鑑に登録しました';
    },
  };
}
