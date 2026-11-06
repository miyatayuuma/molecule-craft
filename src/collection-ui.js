import {reactionGroups,renderReactionBook,playReactionStarCeremony} from './reaction-encyclopedia.js?v=7';
import { validateFunctionalGroups } from './functional-groups.js?v=22';
import { validateCraftStructures } from './craft-structures.js?v=34';
import { createCollectionState, MILESTONES } from './collection-state.js?v=38';
import { createElementPalette } from './element-progression.js?v=38';
import { COLLECTION_CATEGORIES, collectionCategory, moleculeDisplayName } from './collection-catalog.js';
import {appendMoleculeNameFurigana} from './molecule-name-furigana.js?v=2';
import {appendPartNameFurigana} from './part-name-furigana.js';
import {loadMoleculeGraph} from './molecule-graph.js?v=2';
import {GRAPH_NODE_STATE,graphNodeState,selectInitialGraphFocus,transitionGraphFocus,directionalGraphNeighbor} from './encyclopedia-graph.js?v=3';
import {ENCYCLOPEDIA_MOTION,renderEncyclopediaGraph} from './encyclopedia-graph-view.js?v=6';
import {createMoleculeTransitionController,encyclopediaDetailVisualRect,encyclopediaVisualRect} from './encyclopedia-molecule-transition.js?v=2';
import {renderChemistryVisuals,validateChemistryVisualSpecs} from './encyclopedia-chemistry-visuals.js?v=5';
import {encyclopediaTermSegments} from './encyclopedia-terms.js';
import {furiganaSegmentsForRange,coalesceSegmentsAtRubyBoundaries,completeFuriganaSegments,createCompleteFuriganaIndex,appendCompleteFuriganaText} from './encyclopedia-furigana.js?v=4';
import {createPolymerCollectionState} from './polymer-collection-state.js?v=1';
import {createPolymerEncyclopediaModel} from './polymer-encyclopedia.js?v=1';
import {moleculeBasicProperties} from './molecule-basic-properties.js?v=1';
import {renderEncyclopediaComparison,COMPARISON_MODE_LABELS,COMPARISON_MODE_ACCESSIBLE_LABEL,appendComparisonModeLabel} from './encyclopedia-compare-view.js';

export async function loadCollectionData(){
  const load=async path=>{const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw new Error(`Collection data HTTP ${response.status}`);return response.json();};
  const [groups,templates,encyclopedia,graph,furigana,extraFurigana]=await Promise.all([
    load('../data/functional-groups.json?v=26'),
    load('../data/craft-structures.json?v=25'),
    load('../data/encyclopedia.json?v=34').catch(()=>({molecules:{},parts:{},noteDefinitions:{}})),
    loadMoleculeGraph({url:new URL('../data/molecule-graph.json',import.meta.url).href}),
    load('../data/encyclopedia-furigana.json?v=3').catch(()=>({molecules:{},parts:{}})),
    load('../data/encyclopedia-extra-furigana.json?v=1'),
  ]);
  validateFunctionalGroups(groups);validateCraftStructures(templates,groups);return {groups,templates,encyclopedia,graph,furigana,extraFurigana};
}

export async function createCollectionUI({records,onPlace,canOpen=()=>true,onOpenChange=()=>{},storage,root=document,elementPalette=createElementPalette(root),elementAccess=()=>true,recipeState=()=>({recipes:[],hints:[]}),polymerRecords=[],polymerContent=[],polymerRoutes=[],engineeringResources=null}){
  // The physical instrument is the default. Explicit ?comparePhysics=0 retains a
  // reversible legacy view for targeted regressions without touching saved data.
  const physicalComparison=new URLSearchParams(root.defaultView?.location?.search??globalThis.location?.search??'').get('comparePhysics')!=='0'
    ?(await import('./encyclopedia-compare-physics-view.js')).renderEncyclopediaComparison
    :null;
  const data=await loadCollectionData();
  const completeFurigana=createCompleteFuriganaIndex(data.extraFurigana);
  validateChemistryVisualSpecs(data.encyclopedia,records);
  if(storage===undefined){try{storage=window.localStorage;}catch{storage=null;}}
  const state=createCollectionState({records,...data,storage,elementAccess});
  const polymerState=createPolymerCollectionState({records:polymerRecords,storage});
  const engineeringRecipes=engineeringResources?.configureEngineering({polymers:polymerRecords,routes:polymerRoutes,molecules:records,polymerState,collectionState:state})??[];
  const polymerContentById=new Map(polymerContent.map(item=>[item.id,item])),polymerRouteById=new Map(polymerRoutes.map(item=>[item.polymerId,item]));
  const q=id=>root.querySelector(`#${id}`),dialog=q('collection-dialog'),list=q('collection-list'),detail=q('collection-detail');
  let reactionAuthority=null,reactionProgress=null,onTryReaction=()=>{},reactionBookController=null;
  let tab='molecules',currentDetail=null,detailViewer=null,detailGeneration=0,listScroll=0,listInnerScroll=0,detailTransitionHandle=null,motifReturnMoleculeId=null,discoverySession=null,collectionDialogOpen=false;
  let discoveryAward=null;
  const polymerThumbnailCache=new Map();
  let polymerPreviewGeneration=0,polymerPreviewObserver=null,thumbnailQueue=[],activeThumbnailJob=null;
  const closeWaiters=new Set();
  let graphFocusId=null,graphHighlightId=null,lastGraphPositions=new Map(),lastGraphVisibleIds=new Set(),suppressNextGraphMotion=false;
  let comparisonMode='graph',comparisonAxis='molarMass',comparisonFocusId=null,comparisonController=null,comparisonTransitionRects=new Map(),keepUnknownGraphFocus=false;
  let gamepadStickLatched=false,gamepadGraphReadyAt=0,gamepadViewerAt=0;
  const partGroups=data.groups.filter(group=>group.learningRole==='part'),motifGroups=data.groups.filter(group=>group.learningRole==='motif');
  const groupById=id=>data.groups.find(group=>group.id===id),recordById=id=>records.find(record=>record.id===id);
  const partMatches=record=>state.detectedFor(record).filter(match=>groupById(match.id)?.learningRole==='part');
  const motifMatches=record=>state.detectedFor(record).filter(match=>groupById(match.id)?.learningRole==='motif');
  const entry=(kind,id)=>(kind==='molecules'?data.encyclopedia.molecules:data.encyclopedia.parts)?.[id];
  const polymerEntry=id=>createPolymerEncyclopediaModel(polymerRecords,polymerContent,{knownIds:polymerState.entries().map(item=>item.id)}).entry(id);
  const number=(kind,id)=>kind==='molecules'?entry(kind,id)?.number??(records.findIndex(item=>item.id===id)+1):kind==='polymers'?polymerContentById.get(id)?.number??(polymerRecords.findIndex(item=>item.id===id)+1):groupById(id)?.learningRole==='part'?(entry('groups',id)?.number??(partGroups.findIndex(item=>item.id===id)+1)):null;
  const numberLabel=(kind,id)=>{const value=number(kind,id);return Number.isInteger(value)?`No. ${String(value).padStart(3,'0')}`:'';};
  const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null){if(/[一-龯々]/u.test(String(text)))appendCompleteFuriganaText(node,text,completeFurigana);else node.textContent=text;}if(className)node.className=className;return node;};
  const setReadingText=(node,text)=>{node.replaceChildren();appendCompleteFuriganaText(node,text,completeFurigana);};
  const appendReadingText=(host,fullText,annotations,start,end)=>{
    for(const segment of furiganaSegmentsForRange(fullText,annotations,start,end)){
      if(segment.kind==='ruby'){
        const ruby=el('ruby');ruby.append(document.createTextNode(segment.text),el('rt',segment.reading));host.append(ruby);
      }else host.append(document.createTextNode(segment.text));
    }
    return host;
  };
  const appendChemistryText=(host,text,{fullText=text,annotations=[],startOffset=0,limit=4}={})=>{
    if(fullText===text&&startOffset===0&&!annotations.length){
      annotations=completeFurigana.texts[String(text??'')]??[];
      if(!annotations.length){let offset=0;annotations=[];for(const part of completeFuriganaSegments(text,completeFurigana)){if(part.kind==='ruby')annotations.push([offset,part.text,part.reading]);offset+=part.text.length;}}
    }
    const fragment=document.createDocumentFragment();
    let offset=startOffset;
    for(const segment of coalesceSegmentsAtRubyBoundaries(encyclopediaTermSegments(text,{limit}),annotations,startOffset)){
      if(segment.kind==='term'){
        const trigger=button(null,()=>toggleGlossary(trigger,segment.text,segment.meaning),'dex-glossary-term');
        appendReadingText(trigger,fullText,annotations,offset,offset+segment.text.length);
        trigger.setAttribute('aria-label',`${segment.text}の意味を見る`);
        trigger.setAttribute('aria-expanded','false');
        fragment.append(trigger);
      }else appendReadingText(fragment,fullText,annotations,offset,offset+segment.text.length);
      offset+=segment.text.length;
    }
    host.append(fragment);return host;
  };
  const chemistryParagraph=(text,className)=>appendChemistryText(el('p',null,className),text);
  const chemistryHeading=(text)=>appendChemistryText(el('h5'),text);
  function basicDataTable(record){
    const basic=moleculeBasicProperties(record),host=el('div',null,'molecule-basic-data'),table=el('table',null,'molecule-basic-table');
    host.append(el('h4','基本データ'));
    const row=(label,value)=>{
      const tr=el('tr'),name=el('th',label),cell=el('td');name.scope='row';
      if(typeof value==='string')cell.textContent=value;else cell.append(value);
      tr.append(name,cell);table.append(tr);
    };
    row('原子数',`${basic.atomCount}個`);
    row('元素の種類',`${basic.elementCount}種類`);
    const composition=el('div',null,'molecule-basic-composition');
    for(const item of basic.composition){
      const chip=el('span',`${item.symbol} × ${item.count}`);
      chip.setAttribute('aria-label',`${item.symbol}が${item.count}個`);
      composition.append(chip);
    }
    row('元素ごとの数',composition);
    row('モル質量',`${basic.molarMass.toFixed(2)} g/mol`);
    host.append(table,el('p','モル質量は、分子1モルあたりの質量です。原子量を使って計算したおよその値です。','molecule-basic-note'));
    return host;
  }
  const button=(text,handler,className)=>{const node=el('button',text,className);node.type='button';node.addEventListener('click',handler);return node;};
  let glossaryPopup=null,glossaryTrigger=null;
  function closeGlossary(){
    glossaryTrigger?.setAttribute('aria-expanded','false');
    glossaryTrigger?.removeAttribute('aria-describedby');
    glossaryPopup?.remove();glossaryPopup=null;glossaryTrigger=null;
  }
  function toggleGlossary(trigger,word,meaning){
    if(glossaryTrigger===trigger){closeGlossary();return;}
    closeGlossary();
    const popup=el('div',null,'dex-glossary-popup');popup.id='dex-molecule-glossary-popup';popup.setAttribute('role','tooltip');
    const heading=el('strong'),explanation=el('span');
    for(const child of trigger.childNodes)heading.append(child.cloneNode(true));
    appendReadingText(explanation,meaning,data.furigana?.glossary?.[word]??[],0,meaning.length);
    popup.append(heading,explanation);
    dialog.append(popup);
    glossaryPopup=popup;glossaryTrigger=trigger;
    trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-describedby',popup.id);
    const anchor=trigger.getBoundingClientRect(),width=Math.min(264,window.innerWidth-24);
    popup.style.width=`${width}px`;
    const height=popup.getBoundingClientRect().height;
    popup.style.left=`${Math.max(12,Math.min(anchor.left,window.innerWidth-width-12))}px`;
    const below=anchor.bottom+8;
    popup.style.top=`${below+height<=window.innerHeight-12?below:Math.max(12,anchor.top-height-8)}px`;
  }
  const encyclopediaSummaryParagraph=(text,kind,id)=>{
    const paragraph=el('p',null,'dex-description');
    const annotations=data.furigana?.[kind]?.[id]??[];
    return appendChemistryText(paragraph,text,{annotations,limit:3});
  };
  dialog.addEventListener('click',event=>{
    if(glossaryPopup&&!glossaryPopup.contains(event.target)&&!glossaryTrigger?.contains(event.target))closeGlossary();
  });
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&glossaryPopup){event.preventDefault();event.stopImmediatePropagation();const trigger=glossaryTrigger;closeGlossary();trigger?.focus();}
  },true);
  dialog.addEventListener('scroll',closeGlossary,true);
  window.addEventListener('resize',closeGlossary);
  const wideBook=()=>window.matchMedia?.('(min-width: 1050px) and (min-height: 600px)')?.matches??false;
  const rememberListScroll=()=>{listScroll=dialog.scrollTop;listInnerScroll=list.scrollTop;};
  const restoreListScroll=()=>{dialog.scrollTop=listScroll;list.scrollTop=listInnerScroll;};
  const resetDetailScroll=()=>{dialog.scrollTop=0;detail.scrollTop=0;};
  const section=(title)=>{const node=el('details',null,'detail-extras');node.open=wideBook()&&!discoverySession;node.append(el('summary',title));detail.append(node);return node;};
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
    if(wideBook()&&!discoverySession)return showDetail('molecules',id);
    const source=sourceNode?.querySelector?.('.graph-focus-thumbnail')??sourceNode,from=encyclopediaVisualRect(source);if(!from)return showDetail('molecules',id);
    const handle=moleculeTransition.begin({id,direction:'to-detail',sourceVisual:source,sourceRect:from,sourceImage:moleculeAsset(id),sourceSurface:sourceNode?.closest?.('.graph-stage'),sourceFit:'cover',sourceRadius:'50%'});if(!handle)return showDetail('molecules',id);detailTransitionHandle=handle;
    if(!currentDetail)rememberListScroll();tab='molecules';currentDetail={kind:'molecules',id};renderBook();resetDetailScroll();
    const host=detail.querySelector(`.molecule-detail-return[data-molecule-id="${id}"]`),to=encyclopediaDetailVisualRect(host);if(!host||!to){detailTransitionHandle=null;moleculeTransition.cancel({owner:'detail'});return true;}hideDetailChrome(host);
    const completed=await moleculeTransition.attach(handle,{targetVisual:host,targetRect:to,targetImage:detailViewer?.snapshot?.()??null,targetFit:'contain',targetRadius:'0px'});if(detailTransitionHandle===handle)detailTransitionHandle=null;if(completed)revealDetailChrome(host);host?.focus?.({preventScroll:true});return completed;
  }
  async function returnMoleculeDetailToGraph(id,modelHost){
    const currentId=currentMoleculeId()??id,record=recordById(currentId);if(!record||moleculeTransition.busy)return false;const from=encyclopediaDetailVisualRect(modelHost);if(!from)return false;
    const handle=moleculeTransition.begin({id:currentId,direction:'to-graph',sourceVisual:modelHost,sourceRect:from,sourceImage:detailViewer?.snapshot?.()??moleculeAsset(currentId),sourceFit:'contain',sourceRadius:'0px'});if(!handle)return false;detailTransitionHandle=handle;await fadeDetailChrome(modelHost);
    currentDetail=null;graphFocusId=currentId;graphHighlightId=null;suppressNextGraphMotion=true;renderBook();restoreListScroll();
    const targetNode=list.querySelector(`[data-graph-id="${currentId}"]`),target=targetNode?.querySelector?.('.graph-focus-thumbnail')??targetNode,to=encyclopediaVisualRect(target),targetSurface=targetNode?.closest?.('.graph-stage');if(!target||!to){detailTransitionHandle=null;moleculeTransition.cancel({owner:'graph'});return false;}
    const completed=await moleculeTransition.attach(handle,{targetVisual:target,targetRect:to,targetImage:moleculeAsset(currentId),targetSurface,targetFit:'cover',targetRadius:'50%'});if(detailTransitionHandle===handle)detailTransitionHandle=null;if(completed)targetNode?.focus?.({preventScroll:true});return completed;
  }
  function installDetailGraphReturn(host,record,name){
    if(wideBook()&&!discoverySession)return;
    host.classList.add('molecule-detail-return');host.dataset.moleculeId=record.id;host.tabIndex=0;host.setAttribute('role','button');host.setAttribute('aria-label',`${name}からグラフへ戻る`);let press=null;
    host.addEventListener('pointerdown',event=>{if(event.button!==undefined&&event.button!==0)return;press={id:event.pointerId,x:event.clientX,y:event.clientY,at:Date.now()};},true);
    host.addEventListener('pointerup',event=>{if(!press||press.id!==event.pointerId)return;const start=press;press=null;if(dialog.dataset.registrationAwaitingConfirmation==='true'||Date.now()-start.at>650||Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)return;void returnMoleculeDetailToGraph(currentMoleculeId()??record.id,host);},true);
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
      // Molecules already have a stable SVG continuity image; no second
      // visible loading paragraph should stretch the model frame.
      if(!continuity)host.append(el('p','模型を準備しています…','model-status'));
      return import('./collection-viewer.js?v=47').then(({createCollectionViewer})=>new Promise(resolve=>{
        if(request!==mountGeneration||generation!==detailGeneration||!dialog.open||!host.isConnected){resolve(null);return;}
        host.querySelector(':scope > .model-status')?.remove();
        detailViewer=createCollectionViewer({host,record,name,presentation:nextPresentation,initialView:previousView,showGestureHint:false,
          onViewChange:view=>{if(request===mountGeneration&&host.isConnected)host.dataset.viewerView=JSON.stringify(view);},
          onError:()=>{
            if(request!==mountGeneration||generation!==detailGeneration||!host.isConnected)return;
            if(overlay)fadeOut(overlay);else fadeOut(continuity);
            const status=host.querySelector('.model-status');if(status)status.hidden=false;
          },
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
  const originalCollectionCloseLabel=q('close-collection').getAttribute('aria-label');
  const setAwardExit=active=>{
    const control=q('close-collection');
    control.textContent=active?'→':'×';
    control.setAttribute('aria-label',active?'つぎへすすむ':originalCollectionCloseLabel);
  };
  // During an award the × exits only the ceremony, not the discovery queue.
  // Otherwise the queued molecule/polymer detail is lost and the player lands on the top screen.
  q('close-collection').addEventListener('click',()=>{if(discoveryAward?.finish)discoveryAward.finish();else dialog.close();});
  function backFromDetail(){
    (detail.querySelector('#detail-back, #motif-detail-back')??q('close-collection'))?.click();
  }
  // Native Escape follows the same hierarchy as controller B. Single-item
  // discovery sessions keep their existing close/resume-Lab contract.
  dialog.addEventListener('cancel',event=>{
    if(discoveryAward?.finish){event.preventDefault();discoveryAward.finish();return;}
    if(discoverySession)return;
    if(moleculeTransition.busy){event.preventDefault();return;}
    if(currentDetail){event.preventDefault();backFromDetail();}
  });
  dialog.addEventListener('close',()=>{closeGlossary();moleculeTransition.cancel({owner:currentDetail?'detail':'graph'});detailTransitionHandle=null;releaseViewer();comparisonController?.destroy();comparisonController=null;document.body.classList.remove('collection-open');collectionDialogOpen=false;onOpenChange(false);for(const resolve of closeWaiters)resolve();closeWaiters.clear();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  for(const node of root.querySelectorAll('[data-book-tab]'))node.addEventListener('click',()=>{if(discoverySession||moleculeTransition.busy)return;tab=node.dataset.bookTab;currentDetail=null;listScroll=0;listInnerScroll=0;if(tab==='molecules')ensureGraphFocus();renderBook();dialog.scrollTop=0;list.scrollTop=0;});
  function showDetail(kind,id,{pageStep=0}={}){
    if(discoverySession||moleculeTransition.busy)return false;if(kind==='molecules'&&!state.hasMolecule(id))return false;if(kind==='motifs'&&!state.hasGroup(id))return false;if(kind==='polymers'&&!polymerState.hasPolymer(id))return false;
    if(!currentDetail)rememberListScroll();
    if(kind==='motifs'){if(currentDetail?.kind==='molecules')motifReturnMoleculeId=currentDetail.id;tab='molecules';}else tab=kind;
    currentDetail={kind,id};renderBook();resetDetailScroll();
    const focusTarget=pageStep?detail.querySelector(`[data-detail-step="${pageStep}"]`):(kind==='motifs'?q('motif-detail-back'):q('detail-back'));
    focusTarget?.focus?.({preventScroll:true});
    if(pageStep&&!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){
      for(const node of detail.querySelectorAll('.detail-heading,.dex-description,.unknown-model'))node.animate?.([{opacity:.72},{opacity:1}],{duration:150,easing:'ease-out'});
    }
    return true;
  }
  function focusGraph(id){
    const options=graphStateOptions(),next=transitionGraphFocus(data.graph,ensureGraphFocus(),id,options);graphFocusId=next.focusId;graphHighlightId=next.highlightId;renderBook();return next.changed;
  }
  function openMolecule(id){
    const record=recordById(id);if(!record||!canOpen()||moleculeTransition.busy)return false;
    tab='molecules';currentDetail=null;listScroll=0;listInnerScroll=0;
    const nodeState=graphNodeState(id,graphStateOptions());
    if(nodeState===GRAPH_NODE_STATE.REGISTERED){graphFocusId=id;graphHighlightId=null;currentDetail={kind:'molecules',id};}
    else if(nodeState===GRAPH_NODE_STATE.KNOWN){graphFocusId=id;graphHighlightId=null;}
    else ensureGraphFocus();
    renderBook();if(!dialog.open){dialog.showModal();document.body.classList.add('collection-open');notifyOpen();}resetDetailScroll();list.scrollTop=0;return nodeState!==GRAPH_NODE_STATE.UNKNOWN;
  }
  function openRegisteredMoleculeEntry(id){
    const record=recordById(id);if(!record||!state.hasMolecule(id))return false;
    if(dialog.open&&currentDetail?.kind==='molecules'&&currentDetail.id===id)return true;
    if(!canOpen())return false;
    if(moleculeTransition.busy)moleculeTransition.cancel();
    tab='molecules';currentDetail={kind:'molecules',id};listScroll=0;listInnerScroll=0;
    if(data.graph.nodeById(id)){graphFocusId=id;graphHighlightId=null;}
    renderBook();if(!dialog.open){dialog.showModal();document.body.classList.add('collection-open');notifyOpen();}resetDetailScroll();return true;
  }
  function openPolymer(id){
    const record=polymerRecords.find(item=>item.id===id);if(!record||!polymerState.hasPolymer(id)||!canOpen()||moleculeTransition.busy)return false;
    tab='polymers';currentDetail={kind:'polymers',id};listScroll=0;listInnerScroll=0;renderBook();if(!dialog.open){dialog.showModal();document.body.classList.add('collection-open');notifyOpen();}resetDetailScroll();return true;
  }

  function showAwardNotice(kind){
    const notice=el('p',null,'discovery-award-notice');
    const parts=kind==='reactions'?[[ '反応','はんのう' ],'を ',[ '発見','はっけん' ],'！']:[[ '高分子','こうぶんし' ],'を ',[ '発見','はっけん' ],'！'];
    for(const part of parts){
      if(typeof part==='string'){notice.append(document.createTextNode(part));continue;}
      const ruby=el('ruby');ruby.append(document.createTextNode(part[0]),el('rt',part[1]));notice.append(ruby);
    }
    dialog.append(notice);return notice;
  }
  function beginAwardInteraction(advance){
    const click=event=>{
      if(event.target?.closest?.('#close-collection'))return;
      event.preventDefault();event.stopImmediatePropagation();advance();
    };
    const key=event=>{
      if(!['Enter',' ','Spacebar'].includes(event.key))return;
      event.preventDefault();event.stopImmediatePropagation();advance();
    };
    dialog.addEventListener('click',click,true);dialog.addEventListener('keydown',key,true);
    return()=>{dialog.removeEventListener('click',click,true);dialog.removeEventListener('keydown',key,true);};
  }
  function openReactionAward(id,{onSettled=()=>{}}={}){
    const tags=reactionAuthority?.tags?.(id)??[];
    if(!tags.length||!canOpen())return false;
    discoveryAward?.cancel?.();discoveryAward=null;
    tab='reactions';currentDetail=null;listScroll=0;listInnerScroll=0;renderBook();list.scrollTop=0;
    if(!dialog.open){dialog.showModal();document.body.classList.add('collection-open');notifyOpen();}
    dialog.scrollTop=0;
    const notice=showAwardNotice('reactions');
    let finished=false,removeInteraction=()=>{},cancelVisual=()=>{};
    const complete=result=>{
      if(finished)return;finished=true;removeInteraction();dialog.removeEventListener('close',dismiss);
      notice.remove();discoveryAward=null;delete dialog.gamepadAdvance;setAwardExit(false);onSettled(result);
    };
    const dismiss=()=>{cancelVisual();complete({status:'dismissed'});};
    const runner=playReactionStarCeremony({host:list,tags,reducedMotion:prefersReducedMotion(),onSettled:complete});
    cancelVisual=runner.cancel;
    removeInteraction=beginAwardInteraction(()=>runner.advance());
    dialog.gamepadAdvance=()=>runner.advance();
    dialog.addEventListener('close',dismiss,{once:true});
    discoveryAward={finish:()=>runner.finish(),cancel:()=>{runner.cancel();removeInteraction();dialog.removeEventListener('close',dismiss);notice.remove();delete dialog.gamepadAdvance;setAwardExit(false);finished=true;}};
    setAwardExit(true);
    return true;
  }
  function openPolymerAward(id,{onSettled=()=>{}}={}){
    if(!polymerState.hasPolymer(id)||!canOpen())return false;
    discoveryAward?.cancel?.();discoveryAward=null;
    tab='polymers';currentDetail=null;listScroll=0;listInnerScroll=0;renderBook();list.scrollTop=0;
    if(!dialog.open){dialog.showModal();document.body.classList.add('collection-open');notifyOpen();}
    const card=[...list.querySelectorAll('[data-entry-id]')].find(node=>node.dataset.entryId===id);
    if(!card)return false;
    const notice=showAwardNotice('polymers');
    card.classList.add('polymer-award-hidden');
    const name=card.querySelector('strong'),originalName=name?[...name.childNodes].map(child=>child.cloneNode(true)):[];
    const restoreName=()=>{if(name)name.replaceChildren(...originalName.map(child=>child.cloneNode(true)));};
    if(name)name.textContent='???';
    card.scrollIntoView?.({block:'center',behavior:prefersReducedMotion()?'auto':'smooth'});
    let timer=null,finished=false,ready=false,removeInteraction=()=>{};
    const settle=(status='presented',force=false)=>{
      if(finished||(status==='presented'&&!ready&&!force))return;
      finished=true;if(timer!==null)clearTimeout(timer);
      removeInteraction();dialog.removeEventListener('close',dismiss);
      card.classList.remove('polymer-award-hidden','polymer-award-target');
      restoreName();
      notice.remove();discoveryAward=null;delete dialog.gamepadAdvance;setAwardExit(false);
      if(status==='presented')openPolymer(id);
      onSettled({status});
    };
    const dismiss=()=>settle('dismissed');
    const reveal=()=>{
      card.classList.remove('polymer-award-hidden');card.classList.add('polymer-award-target');
      restoreName();
      timer=setTimeout(()=>{ready=true;},prefersReducedMotion()?80:1450);
    };
    removeInteraction=beginAwardInteraction(()=>settle());
    dialog.gamepadAdvance=()=>settle();
    dialog.addEventListener('close',dismiss,{once:true});
    discoveryAward={finish:()=>settle('presented',true),cancel:()=>{finished=true;if(timer!==null)clearTimeout(timer);removeInteraction();dialog.removeEventListener('close',dismiss);notice.remove();delete dialog.gamepadAdvance;setAwardExit(false);card.classList.remove('polymer-award-hidden','polymer-award-target');restoreName();}};
    setAwardExit(true);
    timer=setTimeout(reveal,prefersReducedMotion()?80:950);
    return true;
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
    q('craft-empty').hidden=container.childElementCount>0;
  }
  function renderSummary(){
    const knownParts=partGroups.filter(group=>state.hasGroup(group.id)).length;
    const reactionModel=reactionAuthority&&reactionProgress?reactionGroups(reactionAuthority,reactionProgress):null;
    const progress={molecules:[state.discoveredCount,records.length],groups:[knownParts,partGroups.length],reactions:reactionModel?[reactionModel.verified,reactionModel.entries.length]:null,polymers:[polymerState.discoveredCount,polymerRecords.length]};
    for(const node of root.querySelectorAll('[data-book-tab]')){
      const kind=node.dataset.bookTab,counts=progress[kind];
      node.querySelector('[data-book-count]').textContent=counts?`${counts[0]} / ${counts[1]}`:'— / —';
      const tabName={molecules:'分子',groups:'部品',reactions:'反応',polymers:'高分子'}[kind];
      node.setAttribute('aria-label',`${tabName} ${kind==='reactions'?'実証済み':'発見済み'} ${counts?`${counts[0]} / ${counts[1]}`:'未読み込み'}`);
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
    if(!keepUnknownGraphFocus)ensureGraphFocus();
    keepUnknownGraphFocus=false;
    const suppressMotion=suppressNextGraphMotion;suppressNextGraphMotion=false;
    const result=renderEncyclopediaGraph({
      host:list,graph:data.graph,records,stateOptions:graphStateOptions(),focusId:graphFocusId,highlightId:graphHighlightId,
      previousPositions:lastGraphPositions,previousVisibleIds:lastGraphVisibleIds,suppressMotion,
      onFocus:id=>focusGraph(id),onDetail:(id,node)=>showMoleculeDetailFromGraph(id,node),
    });
    lastGraphPositions=result.positions;lastGraphVisibleIds=result.visibleIds;
  }
  function comparisonRects(){
    if(comparisonController)return comparisonController.rectsForVisible();
    return new Map([...list.querySelectorAll('.graph-node[data-graph-id]')].map(node=>[node.dataset.graphId,node.getBoundingClientRect()]));
  }
  function switchComparisonMode(next){
    if(next===comparisonMode||!['graph','compare'].includes(next)||discoverySession||moleculeTransition.busy)return;
    if(next==='compare'){
      comparisonFocusId=graphFocusId??ensureGraphFocus();
      comparisonTransitionRects=comparisonRects();
    }else{
      const id=comparisonController?.focusId();
      if(id&&data.graph.nodeById(id)){graphFocusId=id;keepUnknownGraphFocus=true;}
      lastGraphPositions=comparisonController?.positionsForGraph()??new Map();
      lastGraphVisibleIds=new Set(lastGraphPositions.keys());
    }
    comparisonMode=next;renderBook();
  }
  function appendComparisonModeControls(){
    const wrapper=list.querySelector('.encyclopedia-graph');if(!wrapper)return;
    const switcher=el('div',null,'comparison-mode-switch');switcher.setAttribute('role','group');switcher.setAttribute('aria-label',COMPARISON_MODE_ACCESSIBLE_LABEL);
    for(const mode of Object.keys(COMPARISON_MODE_LABELS)){
      const node=button(null,()=>switchComparisonMode(mode));appendComparisonModeLabel(node,mode);node.setAttribute('aria-pressed',String(comparisonMode===mode));node.dataset.comparisonMode=mode;switcher.append(node);
    }
    wrapper.prepend(switcher);
  }
  function renderMoleculeOverview(){
    if(comparisonMode==='compare'){
      const id=comparisonFocusId??graphFocusId??ensureGraphFocus(),rects=comparisonTransitionRects;
      comparisonTransitionRects=new Map();
      comparisonController=(physicalComparison??renderEncyclopediaComparison)({host:list,records,discoveredIds:registeredIds(),axis:comparisonAxis,focusId:id,transitionRects:rects,
        onFocus:id=>{comparisonFocusId=id;},
        onDetail:(id,node)=>showMoleculeDetailFromGraph(id,node),
        onAxis:axis=>{comparisonTransitionRects=comparisonRects();comparisonAxis=axis;renderBook();},
      });
      comparisonFocusId=comparisonController.focusId();
    }else renderGraph();
    appendComparisonModeControls();
  }
  function renderGroupList(){
    list.className='collection-grid';
    list.replaceChildren();
    for(const item of visibleItems('groups')){
      const known=state.hasGroup(item.id),card=button('',()=>showDetail('groups',item.id),`collection-card ${known?'found':'unknown'}`);card.dataset.entryId=item.id;
      card.append(el('small',numberLabel('groups',item.id),'dex-number'));
      if(known){thumbnail(card,'groups',item.id);card.append(el('span',data.templates.some(t=>t.unlock.groupId===item.id&&state.isUnlocked(t.id))?'✓':'●','dex-state'));}
      // Unknown polymers deliberately reveal only their stable number and ???.
      const title=el('strong');if(known)appendPartNameFurigana(title,item.nameJa);else title.textContent='???';card.append(title);list.appendChild(card);
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
    import('./polymer-unit-preview.js?v=9').then(({mountPolymerUnitPreview})=>{
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
    comparisonController?.destroy();comparisonController=null;
    reactionBookController=null;
    closeGlossary();
    // Any new page/list rendering ends the prior detail's persistent badge.
    dialog.__moleculeCraftRegistrationRevealCleanup?.();
    releaseViewer();renderSummary();
    for(const node of root.querySelectorAll('[data-book-tab]')){const active=node.dataset.bookTab===tab;node.setAttribute('aria-selected',String(active));node.tabIndex=active?0:-1;}
    for(const node of root.querySelectorAll('[data-book-tab]'))node.disabled=!!discoverySession;
    const footer=dialog.querySelector('.book-footer');if(footer)footer.hidden=!!currentDetail;
    const split=false; // Single-page navigation on desktop and mobile.
    dialog.classList.toggle('book-split',split);list.hidden=!!currentDetail&&!split;detail.hidden=!currentDetail;
    if(currentDetail){
      if(split&&list.dataset.renderedTab!==tab){list.classList.remove('reaction-book');if(tab==='molecules')renderMoleculeOverview();else if(tab==='polymers')renderPolymerList();else renderGroupList();list.dataset.renderedTab=tab;}
      if(split)for(const card of list.querySelectorAll('[data-entry-id]'))card.setAttribute('aria-current',String(card.dataset.entryId===currentDetail.id));
      renderDetail();if(split)detail.scrollTop=0;if(currentDetail?.kind==='molecules')moleculeTransition.markStable('detail',currentDetail.id);return;
    }
    list.dataset.renderedTab=tab;
    if(tab==='reactions'){list.replaceChildren();list.classList.add('reaction-book');if(reactionAuthority&&reactionProgress)reactionBookController=renderReactionBook({host:list,authority:reactionAuthority,progress:reactionProgress,records,polymerRecords,onTry:onTryReaction,appendText:(host,text)=>host.tagName==='P'||host.tagName==='H4'?appendChemistryText(host,text):appendCompleteFuriganaText(host,text,completeFurigana)});else list.textContent='反応図鑑を準備中です。';return;}
    list.classList.remove('reaction-book');
    if(tab==='molecules'){renderMoleculeOverview();moleculeTransition.markStable('graph',comparisonMode==='compare'?comparisonFocusId:graphFocusId);return;}
    if(tab==='polymers')renderPolymerList();else renderGroupList();
  }
  window.matchMedia?.('(min-width: 1050px) and (min-height: 600px)')?.addEventListener?.('change',()=>{if(dialog.open&&currentDetail&&!moleculeTransition.busy)renderBook();});
  function renderDetail(){
    detail.replaceChildren();const {kind,id}=currentDetail;detail.dataset.detailKind=kind;detail.dataset.detailId=id;const nav=el('div',null,`detail-navigation${kind==='molecules'?' molecule-detail-navigation':''}`);
    if(kind==='groups'||kind==='molecules'||kind==='polymers'){
      const back=button('‹ 一覧',()=>{const previous=currentDetail.id;currentDetail=null;if(kind==='molecules'){graphFocusId=previous;graphHighlightId=null;}renderBook();restoreListScroll();[...list.querySelectorAll('button')].find(node=>node.dataset.entryId===previous||node.dataset.graphId===previous)?.focus({preventScroll:true});},'book-back');
      back.id='detail-back';nav.append(back);
    }
    if(kind==='motifs'){const back=button('‹ 分子',()=>{if(motifReturnMoleculeId)showDetail('molecules',motifReturnMoleculeId);},'book-back');back.id='motif-detail-back';back.disabled=!motifReturnMoleculeId;nav.append(back);}
    const items=kind==='polymers'?polymerRecords.filter(item=>polymerState.hasPolymer(item.id)).sort((a,b)=>number(kind,a.id)-number(kind,b.id)):visibleItems(kind),index=items.findIndex(item=>item.id===id);
    for(const [label,delta]of [['‹',-1],['›',1]]){
      const next=items[index+delta],unavailable=!!discoverySession||index<0||!next;
      const node=button(label,()=>{if(!unavailable)showDetail(kind,next.id,{pageStep:delta});});
      node.dataset.detailStep=String(delta);node.setAttribute('aria-label',delta<0?'前の項目':'次の項目');
      // Keep the paging target focusable at the boundary: repeated Enter stops
      // here instead of jumping to Back or silently reversing direction.
      node.setAttribute('aria-disabled',String(unavailable));node.disabled=!!discoverySession;nav.append(node);
    }
    detail.append(nav);
    if(kind==='groups'||kind==='motifs'){renderGroup(id);return;}
    if(kind==='polymers'){renderPolymerDetail(id);return;}
    const record=recordById(id);if(!record||!state.hasMolecule(id)){currentDetail=null;renderBook();return;}
    const matches=partMatches(record),motifs=motifMatches(record),catalogEntry=entry(kind,id)??{},stereoSpec=catalogEntry.stereoComparison??null;heading(kind,id,moleculeDisplayName(record),record.formula);
    const defaultStereo=stereoSpec?{kind:stereoSpec.kind,relation:stereoSpec.defaultRelation??stereoSpec.states?.[0]?.relation}:null;
    const previewHandle=preview(record,moleculeDisplayName(record),{graphReturn:true,presentation:defaultStereo});
    if(stereoSpec)stereoComparisonControl(stereoSpec,previewHandle);
    detail.append(encyclopediaSummaryParagraph(catalogEntry.description??'この分子を図鑑に登録しました。','molecules',record.id));
    const extra=section('くわしく');extra.append(el('p',`${record.nameEn} · ${COLLECTION_CATEGORIES[collectionCategory(record)]}`),el('p',`IUPAC: ${record.iupacNameEn}`));
    if(record.aliases?.length)extra.append(el('p',`別名：${record.aliases.join('、')}`));
    extra.append(basicDataTable(record));
    const detailSections=Array.isArray(catalogEntry.details)?catalogEntry.details:[];
    if(detailSections.length){const chemistry=el('div',null,'chemistry-detail');for(const item of detailSections){const sectionNode=el('section',null,'chemistry-detail-section');sectionNode.append(chemistryHeading(item.title),chemistryParagraph(item.body));chemistry.append(sectionNode);}for(const visual of renderChemistryVisuals(document,catalogEntry,record))chemistry.append(visual);extra.append(chemistry);}
    const playerNoteKeys=(Array.isArray(catalogEntry.notes)?catalogEntry.notes:[]).filter(key=>key==='stereochemistry');
    for(const key of playerNoteKeys){const text=data.encyclopedia.noteDefinitions?.[key];if(!text)continue;const note=el('p',text,'collection-note');note.dataset.encyclopediaNote=key;extra.append(note);}
    const discovered=state.moleculeEntry(id);extra.append(el('h4','発見'),el('p',`発見 ${discovered.order}番目${discovered.at?` · ${new Date(discovered.at).toLocaleDateString('ja-JP')}`:''}`));
    const tags=el('div',null,'collection-tags');for(const match of matches)tags.append(button(groupById(match.id).nameJa,()=>showDetail('groups',match.id),'collection-tag'));if(matches.length)extra.append(el('h4','見つかる部品'),tags);
    if(motifs.length){const motifTags=el('div',null,'collection-tags');for(const match of motifs){const tag=button(groupById(match.id).nameJa,()=>showDetail('motifs',match.id),'collection-tag structure-motif-tag');tag.dataset.motifId=match.id;motifTags.append(tag);}extra.append(el('h4','構造モチーフ'),motifTags);}
    const relatives=state.isomersOf(record);if(relatives.length){extra.append(el('h4','同じ分子式の仲間'));for(const item of relatives){const known=state.hasMolecule(item.id),tag=button(null,()=>known&&showDetail('molecules',item.id),'collection-tag');if(known)appendMoleculeNameFurigana(tag,moleculeDisplayName(item));else tag.textContent='???';extra.append(tag);}}
    if(discoverySession)for(const node of detail.querySelectorAll('button'))node.disabled=true;
  }
  function heading(kind,id,name,formula=''){
    const host=el('div',null,'detail-heading'),left=el('div'),numberText=numberLabel(kind,id);if(numberText)left.append(el('span',numberText,'dex-number'));const title=el('h3');if(kind==='molecules')appendMoleculeNameFurigana(title,name);else if(kind==='groups')appendPartNameFurigana(title,name);else appendCompleteFuriganaText(title,name,completeFurigana);left.append(title);host.append(left);if(formula)host.append(el('p',formula,'detail-formula'));detail.append(host);
  }
  function frameDetailModel(modelHost,{controls=null}={}){
    const frame=el('div',null,'detail-model-frame');
    modelHost.before(frame);
    frame.append(detail.querySelector(':scope > .detail-heading'),modelHost);
    const nav=detail.querySelector(':scope > .detail-navigation');
    if(controls){frame.classList.add('detail-model-frame--with-switch');frame.append(controls);}
    frame.append(nav);
    return frame;
  }
  function renderGroup(id){
    const group=groupById(id),known=state.hasGroup(id),sources=state.groupSources(id),part=group?.learningRole==='part'?data.templates.find(item=>item.unlock.groupId===id):null;
    heading(currentDetail.kind,id,known?group.nameJa:'???');
    if(!known){
      const box=el('div',null,'unknown-detail collection-model');
      box.append(el('div','','unknown-model'),el('p','分子を完成させると、その中の部品も見つかります。'));
      detail.append(box);frameDetailModel(box);return;
    }
    if(part)frameDetailModel(preview(part,group.nameJa).host);
    const description=entry('groups',id)?.description??group.description;
    detail.append(currentDetail.kind==='groups'?encyclopediaSummaryParagraph(description,'parts',id):chemistryParagraph(description,'dex-description'));
    for(const template of part?data.templates.filter(item=>item.unlock.groupId===id):[]){
      if(!state.isUnlocked(template.id))detail.append(el('p',`解放まで：異なる分子 ${sources.length}/${template.unlock.distinctMolecules}種類で発見`,'unlock-condition'));
    }
    const extra=section('くわしく');extra.append(el('p',`${group.nameEn} · ${group.notation}`),chemistryParagraph(group.description));
    if(group.aliases?.length)extra.append(el('p',`別名：${group.aliases.join('、')}`));
    if(part)extra.append(el('p',`接続点：${part.attachments.map(port=>`${part.atoms[port.atom]}に単結合${port.slots}本分`).join('、')}`));
    extra.append(el('h4','見つかった分子'));for(const sourceId of sources){const tag=button(null,()=>showDetail('molecules',sourceId),'collection-tag');appendMoleculeNameFurigana(tag,moleculeDisplayName(recordById(sourceId)));extra.append(tag);}
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
      const status=el('p',statusLabels[eligibility.status]??eligibility.status);
      row.append(el('p',inputs.join(' ＋ ')),status);
      const action=button(eligibility.status==='ALREADY_FABRICATED'?'製作済み':'製作する',()=>{
        const result=engineeringResources.fabricateEngineering(recipe.id);
        // Fabrication changes this row, not the 3D model or its scroll position.
        const next=engineeringResources.engineeringEligibility(recipe.id);
        setReadingText(status,statusLabels[next.status]??next.status);
        setReadingText(action,next.status==='ALREADY_FABRICATED'?'製作済み':'製作する');
        action.disabled=next.status!=='AVAILABLE';
        row.querySelector('.storage-message')?.remove();
        if(!result.committed&&result.status==='SAVE_FAILED')row.append(el('p','製作を保存できません。材料と製作状態は変更していません。','storage-message'));
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
    const options=[['unit','単位','構成単位'],['chain','30',polymerReferenceLabel]],buttons=new Map();
    let request=0,modelFrame=null;
    const switchModel=mode=>{
      if(generation!==detailGeneration||!visual.isConnected)return;
      const token=++request;
      for(const [key,node] of buttons){const selected=key===mode;node.setAttribute('aria-pressed',String(selected));node.classList.toggle('selected',selected);}
      const priorOverlay=modelFrame.querySelector('.polymer-model-continuity');
      const still=detailViewer?.snapshot?.()??priorOverlay?.src??null;
      detailViewer?.dispose();detailViewer=null;
      priorOverlay?.remove();
      const overlay=still?el('img',null,'polymer-model-continuity'):null;
      if(overlay){overlay.src=still;overlay.alt='';modelFrame.append(overlay);}
      const finish=()=>{
        if(token!==request||generation!==detailGeneration||!overlay?.isConnected)return;
        if(prefersReducedMotion()){overlay.remove();return;}
        const animation=overlay.animate?.([{opacity:1},{opacity:0}],{duration:150,easing:'ease-out',fill:'forwards'});
        if(animation)animation.finished.catch(()=>{}).then(()=>overlay.remove());else overlay.remove();
      };
      const status=el('p',mode==='chain'?`${polymerReferenceLabel}の模型を準備しています…`:'構成単位を準備しています…','model-status');
      status.setAttribute('role','status');visual.replaceChildren(status);
      const modulePromise=mode==='chain'?import('./polymer-long-chain-preview.js?v=7'):import('./polymer-unit-preview.js?v=9');
      modulePromise.then(module=>{
        if(token!==request||generation!==detailGeneration||currentDetail?.kind!=='polymers'||currentDetail.id!==id||!visual.isConnected)return;
        visual.replaceChildren();
        detailViewer=mode==='chain'
          ?module.mountPolymerLongChainPreview({host:visual,polymerId:id,name:record.nameJa,onReady:finish,onError:finish})
          :module.mountPolymerUnitPreview({host:visual,polymerId:id,name:record.nameJa,onReady:finish,onError:finish});
      }).catch(error=>{
        if(token===request&&generation===detailGeneration&&visual.isConnected){visual.replaceChildren(el('p','3D模型を読み込めませんでした。','model-status'));finish();}
        console.warn('Polymer Collection viewer unavailable',id,mode,error);
      });
    };
    for(const [mode,label,fullLabel] of options){
      const action=button(label,()=>switchModel(mode),'polymer-model-mode');
      action.dataset.polymerViewMode=mode;action.setAttribute('aria-pressed',String(mode==='unit'));action.setAttribute('aria-label',`${fullLabel}を表示`);action.title=fullLabel;
      buttons.set(mode,action);toggle.append(action);
    }
    detail.append(toggle,visual);
    modelFrame=frameDetailModel(visual,{controls:toggle});
    switchModel('unit');
    detail.append(chemistryParagraph(content.description,'dex-description',{reviewedScience:true}));
    if(content.education?.observe)detail.append(chemistryParagraph('観察してみよう：'+content.education.observe,'polymer-observation-prompt',{reviewedScience:true}));
    const learning=section('構造・物性・用途');learning.classList.add('polymer-education');
    for(const [title,field] of [['分子のしくみ','structure'],['なぜこの性質になる？','property'],['何に使われる？','applications'],['模型だけでは分からないこと','limits']])learning.append(chemistryHeading(title),chemistryParagraph(content.education[field],null,{reviewedScience:true}));
    renderEngineering(id);
    const formationName=({addition:'付加重合',copolymerization:'共重合', 'ring-opening':'開環重合',polycondensation:'縮合重合','condensation-network':'縮合による網目形成'})[record.formation]??record.formation;
    const topologyName=({linear:'線状',copolymer:'共重合体',network:'網目状'})[record.topology]??record.topology;
    const sourceRecords=[...new Set(record.reactants.map(item=>item.moleculeId))].map(recordById).filter(Boolean);
    const process=section('Reaction Labで観察した代表工程');process.append(el('p',route.processLabel,'polymer-process-label'));
    const detailSections=Array.isArray(content.details)?content.details:[];
    const chemistry=el('div',null,'chemistry-detail');
    for(const item of detailSections){const sectionNode=el('section',null,'chemistry-detail-section');sectionNode.append(chemistryHeading(item.title),chemistryParagraph(item.body,null,{reviewedScience:true}));chemistry.append(sectionNode);}
    if(chemistry.childElementCount)process.append(chemistry);
    const extra=section('くわしく');extra.append(el('p',`${record.nameEn} · ${record.family}`),el('p',`生成法：${formationName}`),el('p',`トポロジー：${topologyName}`));
    extra.append(el('h4','原料分子'));for(const source of sourceRecords)extra.append(appendMoleculeNameFurigana(el('span',null,'collection-tag'),moleculeDisplayName(source)));
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
  function handleGamepad(sample,now=0,{openKeyboard}={}){
    if(!sample||!dialog.open){gamepadStickLatched=false;gamepadGraphReadyAt=0;gamepadViewerAt=0;return false;}
    if(discoveryAward){
      if(sample.pressed?.includes(1))discoveryAward.finish();
      else if(sample.pressed?.includes(0))dialog.gamepadAdvance?.();
      return true;
    }
    if(moleculeTransition.busy||discoverySession)return true;
    const pressed=sample.pressed??[],repeating=sample.repeat??[],held=sample.held??[],axes=sample.axes??[0,0,0,0];
    const tabs=['molecules','groups','reactions','polymers'];
    if(pressed.includes(4)||pressed.includes(5)){
      const next=tabs[(tabs.indexOf(tab)+(pressed.includes(5)?1:-1)+tabs.length)%tabs.length];
      root.querySelector(`[data-book-tab="${next}"]`)?.click();
      gamepadStickLatched=false;gamepadGraphReadyAt=now+ENCYCLOPEDIA_MOTION.graphNavigationDuration;
      return true;
    }
    if(currentDetail){
      if(pressed.includes(1)){
        backFromDetail();return true;
      }
      if(held[14]||held[15]){
        // Consume the entire D-pad hold, not only its first pressed frame.
        // Otherwise the shared navigator moves DOM focus while paging.
        if(pressed.includes(14)||pressed.includes(15)){
          const label=pressed.includes(14)?'前の項目':'次の項目';
          const action=[...detail.querySelectorAll('.detail-navigation button')].find(node=>node.getAttribute('aria-label')===label);
          if(action&&!action.disabled&&action.getAttribute('aria-disabled')!=='true')action.click();
        }
        return true;
      }
      if(held[12]||held[13]){
        if(pressed.includes(12)||pressed.includes(13)||repeating.includes(12)||repeating.includes(13)){
          const target=detail.scrollHeight>detail.clientHeight+2?detail:dialog;
          target.scrollBy?.({top:held[13]?140:-140,behavior:'auto'});
        }
        return true;
      }
      const dt=Math.min(.05,Math.max(0,(now-gamepadViewerAt)/1000));gamepadViewerAt=now;
      if(Math.abs(axes[2])>.12||Math.abs(axes[3])>.12)detailViewer?.rotate?.(axes[2]*dt*2.6,axes[3]*dt*2.6);
      if(held[6]||held[7])detailViewer?.zoom?.(Math.exp(((held[6]?1:0)-(held[7]?1:0))*dt*1.6));
      // Keep the left stick available for auxiliary controls (polymer view,
      // explanatory glossary and fabrication) through spatial navigation.
      return !!(Math.abs(axes[2])>.12||Math.abs(axes[3])>.12||held[6]||held[7]);
    }
    if(tab==='reactions'&&reactionBookController?.handleGamepad(sample))return true;
    if(tab!=='molecules')return false;
    const stickX=axes[0]??0,stickY=axes[1]??0;
    if(pressed.includes(2)){switchComparisonMode(comparisonMode==='graph'?'compare':'graph');return true;}
    if(comparisonMode==='compare'){
      if(pressed.includes(1)){dialog.close();return true;}
      if(pressed.includes(12)||pressed.includes(13)){
        const axes=['molarMass','atomCount'],next=axes[(axes.indexOf(comparisonAxis)+(pressed.includes(13)?1:-1)+axes.length)%axes.length];
        list.querySelector(`[data-compare-axis="${next}"]`)?.click();return true;
      }
      if(pressed.includes(14)||repeating.includes(14))comparisonController?.move(-1);
      if(pressed.includes(15)||repeating.includes(15))comparisonController?.move(1);
      if(pressed.includes(0))comparisonController?.openFocused();
      comparisonController?.gamepadStick(stickX,now);
      return true;
    }
    if(Math.hypot(stickX,stickY)<.35)gamepadStickLatched=false;
    if(pressed.includes(1)){dialog.close();return true;}
    if(pressed.includes(3)){
      const search=list.querySelector('.graph-search');if(search)openKeyboard?.(search);return true;
    }
    if(now<gamepadGraphReadyAt)return true;
    if(pressed.includes(14)||pressed.includes(15)){
      const jump=list.querySelector(`.graph-sector-jump.${pressed.includes(14)?'previous':'next'}`);
      if(jump){jump.click();gamepadGraphReadyAt=now+ENCYCLOPEDIA_MOTION.graphNavigationDuration;}
      return true;
    }
    if(pressed.includes(0)){
      if(graphNodeState(graphFocusId,graphStateOptions())===GRAPH_NODE_STATE.REGISTERED){
        const focused=list.querySelector('.graph-node.focus');
        if(focused)void showMoleculeDetailFromGraph(graphFocusId,focused);
      }
      return true;
    }
    if(!gamepadStickLatched&&Math.hypot(stickX,stickY)>.65){
      gamepadStickLatched=true;
      const neighbors=[...list.querySelectorAll('.graph-node.neighbor')].map(node=>node.dataset.graphId).filter(Boolean);
      const id=directionalGraphNeighbor(lastGraphPositions,graphFocusId,neighbors,stickX,stickY);
      if(id){focusGraph(id);gamepadGraphReadyAt=now+ENCYCLOPEDIA_MOTION.graphNavigationDuration;}
    }
    return true;
  }
  renderPalette();renderSummary();
  return {setReactionGuideHandler(handler){onTryReaction=handler;},setReactionProgress(authority,progress){reactionAuthority=authority;reactionProgress=progress;renderSummary();if(dialog.open&&tab==='reactions')renderBook();},state,polymerState,polymerNameFor:id=>polymerRecords.find(record=>record.id===id)?.nameJa??null,templateFor:id=>state.isUnlocked(id)?data.templates.find(template=>template.id===id):null,
    handleGamepad,
    refreshReactionProgress(){renderSummary();if(dialog.open&&tab==='reactions'&&!currentDetail)renderBook();},
    openEntry,openMolecule,openPolymer,openReactionAward,openPolymerAward,
    isOpen:()=>dialog.open,
    closeAndWait(){if(!collectionDialogOpen&&!dialog.open)return Promise.resolve();return new Promise(resolve=>{closeWaiters.add(resolve);if(dialog.open)dialog.close();});},
    setDiscoverySession(value){discoverySession=value?{...value}:null;if(dialog.open)for(const node of root.querySelectorAll('[data-book-tab]'))node.disabled=!!discoverySession;},
    registerDiscoveredMolecule(recordId,options={}){if(dialog.open&&!currentDetail&&comparisonController)comparisonTransitionRects=comparisonRects();const result=state.registerDiscoveredMolecule(recordId,options);if(result.changed){renderPalette();renderSummary();if(dialog.open&&!currentDetail)renderBook();}return result;},
    registerDiscoveredPolymer(polymerId,options={}){const result=polymerState.registerDiscoveredPolymer(polymerId,options);if(result.changed){renderSummary();if(dialog.open&&!currentDetail)renderBook();}return result;},
    refreshProgress(){state.refreshAccess();renderPalette();renderSummary();if(dialog.open&&!currentDetail)renderBook();},
    observeStructures(structures){const result=state.observeStructures(structures);if(result.changed){renderPalette();renderSummary();if(dialog.open&&!currentDetail)renderBook();}return result;},
    describeEvent(event){
      if(!event?.isNew)return '';if(event.saved===false)return 'この画面の間だけ図鑑に登録しました。保存できていません。';const messages=[];
      if(event.unlockedParts.length)messages.push(`${event.unlockedParts.map(id=>data.templates.find(template=>template.id===id).nameJa).join('・')}を獲得`);
      return messages.join(' ／ ')||'図鑑に登録しました';
    },
  };
}
