from pathlib import Path
import re

def replace(path, old, new, count=1):
    p=Path(path); text=p.read_text(); actual=text.count(old)
    if actual!=count: raise SystemExit(f'{path}: expected {count} matches, found {actual}: {old[:100]!r}')
    p.write_text(text.replace(old,new,count))

def replace_between(path, start, end, body):
    p=Path(path); text=p.read_text(); a=text.find(start); b=text.find(end,a)
    if a<0 or b<0: raise SystemExit(f'{path}: markers not found: {start!r} -> {end!r}')
    p.write_text(text[:a]+body+text[b:])

# collection-viewer: expose the actual rendered molecule snapshot and ready handoff.
replace('src/collection-viewer.js',
"export function createCollectionViewer({host,record,name,onThumbnail=()=>{},showGestureHint=true}) {",
"export function createCollectionViewer({host,record,name,onThumbnail=()=>{},onReady=()=>{},showGestureHint=true}) {")
replace('src/collection-viewer.js',
"  let canvas=null,context=null,steps=0,stable=0,thumbnailSent=false;",
"  let canvas=null,context=null,steps=0,stable=0,thumbnailSent=false,readyNotified=false;")
replace('src/collection-viewer.js',
"    draw();\n    if(!thumbnailSent){",
"    draw();\n    if(!readyNotified){readyNotified=true;try{onReady({snapshot:snapshotImage(),view:{...viewState}});}catch{}}\n    if(!thumbnailSent){")
replace('src/collection-viewer.js',
"  function resize(){",
"  function snapshotImage(){\n    if(!canvas)return null;try{const image=make('canvas'),sourceWidth=Math.max(1,canvas.width||width),sourceHeight=Math.max(1,canvas.height||height);image.width=sourceWidth;image.height=sourceHeight;const target=image.getContext('2d');if(!target)return null;target.drawImage(canvas,0,0,sourceWidth,sourceHeight);return image.toDataURL('image/png');}catch{return null;}\n  }\n  function resize(){")
replace('src/collection-viewer.js',
"  return {dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);frame=0;releaseGraphics();model=null;host.replaceChildren();}};",
"  return {snapshot(){if(disposed||!ready)return null;try{draw();}catch{}return snapshotImage();},view(){return {...viewState};},dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);frame=0;releaseGraphics();model=null;host.replaceChildren();}};")

# Graph view only owns graph motion. Collection UI now owns the full Graph <-> Detail visual handoff.
replace('src/encyclopedia-graph-view.js',
"  const document=host.ownerDocument??globalThis.document;ensureStyles(document);const continuity=continuityState(document,win);continuity.focusId=focusId;const reduceMotion=!!win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,graphMotion=graphMotionState(host,win);host.className='encyclopedia-graph-host';host.replaceChildren();",
"  const document=host.ownerDocument??globalThis.document;ensureStyles(document);const reduceMotion=!!win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,graphMotion=graphMotionState(host,win);host.className='encyclopedia-graph-host';host.replaceChildren();")
old_click="node.dataset.graphId=id;node.addEventListener('click',()=>{if(id===focusId&&presentation.canOpenDetail){const visual=node.querySelector('.graph-focus-thumbnail')??node;animateContinuity(document,continuity,id,rectOf(visual),()=>detailVisualRect(detailHostForId(document,id)),{direction:'to-detail',duration:ENCYCLOPEDIA_MOTION.detailZoomDuration,waitMs:1200,win,sourceVisual:visual,sourceSurface:stage});onDetail(id,node);}else onFocus(id);});stage.append(node);"
new_click="node.dataset.graphId=id;node.addEventListener('click',()=>{if(id===focusId&&presentation.canOpenDetail)onDetail(id,node);else onFocus(id);});stage.append(node);"
replace('src/encyclopedia-graph-view.js',old_click,new_click)

# Collection UI becomes the sole owner of the shared molecule transition.
replace('src/collection-ui.js',
"import {renderEncyclopediaGraph} from './encyclopedia-graph-view.js?v=3';\n",
"import {ENCYCLOPEDIA_MOTION,renderEncyclopediaGraph} from './encyclopedia-graph-view.js?v=3';\nimport {createMoleculeTransitionController,encyclopediaDetailVisualRect,encyclopediaVisualRect} from './encyclopedia-molecule-transition.js?v=1';\n")
replace('src/collection-ui.js',
"  let tab='molecules',category='all',filter='available',scope='cho',currentDetail=null,detailViewer=null,detailGeneration=0,listScroll=0,moleculeTransitioning=false;",
"  let tab='molecules',category='all',filter='available',scope='cho',currentDetail=null,detailViewer=null,detailGeneration=0,listScroll=0,detailTransitionHandle=null;")
start="  const prefersReducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;\n"
end="  function installDetailGraphReturn"
body="""  const prefersReducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
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
    const handle=moleculeTransition.begin({id,direction:'to-detail',sourceVisual:source,sourceRect:from,sourceImage:moleculeAsset(id),sourceSurface:sourceNode?.closest?.('.graph-stage')});if(!handle)return showDetail('molecules',id);detailTransitionHandle=handle;
    if(!currentDetail)listScroll=dialog.scrollTop;tab='molecules';currentDetail={kind:'molecules',id};renderBook();dialog.scrollTop=0;
    const host=detail.querySelector(`.molecule-detail-return[data-molecule-id="${id}"]`),to=encyclopediaDetailVisualRect(host);if(!host||!to){detailTransitionHandle=null;moleculeTransition.cancel({owner:'detail'});return true;}hideDetailChrome(host);
    const completed=await moleculeTransition.attach(handle,{targetVisual:host,targetRect:to,targetImage:detailViewer?.snapshot?.()??null});if(detailTransitionHandle===handle)detailTransitionHandle=null;if(completed)revealDetailChrome(host);host?.focus?.({preventScroll:true});return completed;
  }
  async function returnMoleculeDetailToGraph(id,modelHost){
    const currentId=currentMoleculeId()??id,record=recordById(currentId);if(!record||moleculeTransition.busy)return false;const from=encyclopediaDetailVisualRect(modelHost);if(!from)return false;
    const handle=moleculeTransition.begin({id:currentId,direction:'to-graph',sourceVisual:modelHost,sourceRect:from,sourceImage:detailViewer?.snapshot?.()??moleculeAsset(currentId)});if(!handle)return false;detailTransitionHandle=handle;await fadeDetailChrome(modelHost);
    currentDetail=null;graphFocusId=currentId;graphHighlightId=null;renderBook();dialog.scrollTop=listScroll;
    const targetNode=list.querySelector(`[data-graph-id="${currentId}"]`),target=targetNode?.querySelector?.('.graph-focus-thumbnail')??targetNode,to=encyclopediaVisualRect(target),targetSurface=targetNode?.closest?.('.graph-stage');if(!target||!to){detailTransitionHandle=null;moleculeTransition.cancel({owner:'graph'});return false;}
    const completed=await moleculeTransition.attach(handle,{targetVisual:target,targetRect:to,targetImage:moleculeAsset(currentId),targetSurface});if(detailTransitionHandle===handle)detailTransitionHandle=null;if(completed)targetNode?.focus?.({preventScroll:true});return completed;
  }
"""
replace_between('src/collection-ui.js',start,end,body+end)

# Current Detail ID is authoritative after prev/next/isomer navigation.
replace('src/collection-ui.js',
"void returnMoleculeDetailToGraph(record.id,host);",
"void returnMoleculeDetailToGraph(currentMoleculeId()??record.id,host);",2)

# Detail viewer retains a matching placeholder until the real 3D frame is ready, then feeds its snapshot into the in-flight proxy.
old_preview="""  function preview(record,name,{graphReturn=false}={}){
    const host=el('div',null,'collection-model');if(graphReturn)installDetailGraphReturn(host,record,name);detail.appendChild(host);host.appendChild(el('p','模型を準備しています…','model-status'));
    const generation=detailGeneration;
    import('./collection-viewer.js?v=31').then(({createCollectionViewer})=>{
      if(generation!==detailGeneration||!dialog.open||!host.isConnected)return;
      host.replaceChildren();detailViewer=createCollectionViewer({host,record,name});
    }).catch(error=>{if(generation===detailGeneration){host.replaceChildren(el('p','模型を読み込めませんでした。','model-status'));console.warn('Collection viewer unavailable',error);}});
  }
"""
new_preview="""  function preview(record,name,{graphReturn=false}={}){
    const host=el('div',null,'collection-model');if(graphReturn)installDetailGraphReturn(host,record,name);detail.appendChild(host);let placeholder=null;if(graphReturn){placeholder=el('img',null,'molecule-detail-continuity-placeholder');placeholder.src=moleculeAsset(record.id);placeholder.alt='';host.appendChild(placeholder);}host.appendChild(el('p','模型を準備しています…','model-status'));
    const generation=detailGeneration;
    import('./collection-viewer.js?v=31').then(({createCollectionViewer})=>{
      if(generation!==detailGeneration||!dialog.open||!host.isConnected)return;
      host.querySelector(':scope > .model-status')?.remove();detailViewer=createCollectionViewer({host,record,name,onReady:({snapshot})=>{
        if(generation!==detailGeneration||!host.isConnected)return;host.dataset.viewerReady='true';if(detailTransitionHandle?.id===record.id&&snapshot)moleculeTransition.updateDestinationImage(detailTransitionHandle,snapshot);const finish=()=>placeholder?.remove?.();if(!placeholder)return;if(prefersReducedMotion()){finish();return;}const animation=placeholder.animate?.([{opacity:1},{opacity:0}],{duration:150,easing:'ease-out',fill:'forwards'});animation?.finished?.catch(()=>{}).then(finish);
      }});
    }).catch(error=>{if(generation===detailGeneration){host.replaceChildren(el('p','模型を読み込めませんでした。','model-status'));console.warn('Collection viewer unavailable',error);}});
  }
"""
replace('src/collection-ui.js',old_preview,new_preview)

# Navigation and lifecycle guards: no competing transition can survive close, external open, or mode controls.
replace('src/collection-ui.js',
"  q('collection-scope')?.addEventListener('change',()=>{scope=q('collection-scope').value;currentDetail=null;renderBook();});",
"  q('collection-scope')?.addEventListener('change',()=>{if(moleculeTransition?.busy)return;scope=q('collection-scope').value;currentDetail=null;renderBook();});")
replace('src/collection-ui.js',
"  dialog.addEventListener('close',()=>{releaseViewer();document.body.classList.remove('collection-open');onOpenChange(false);});",
"  dialog.addEventListener('close',()=>{moleculeTransition.cancel({owner:currentDetail?'detail':'graph'});detailTransitionHandle=null;releaseViewer();document.body.classList.remove('collection-open');onOpenChange(false);});")
replace('src/collection-ui.js',
"  for(const node of root.querySelectorAll('[data-book-tab]'))node.addEventListener('click',()=>{tab=node.dataset.bookTab;currentDetail=null;listScroll=0;if(tab==='molecules')ensureGraphFocus();renderBook();});",
"  for(const node of root.querySelectorAll('[data-book-tab]'))node.addEventListener('click',()=>{if(moleculeTransition.busy)return;tab=node.dataset.bookTab;currentDetail=null;listScroll=0;if(tab==='molecules')ensureGraphFocus();renderBook();});")
replace('src/collection-ui.js',
"  q('collection-category').addEventListener('change',event=>{category=event.target.value;currentDetail=null;listScroll=0;renderBook();});",
"  q('collection-category').addEventListener('change',event=>{if(moleculeTransition.busy)return;category=event.target.value;currentDetail=null;listScroll=0;renderBook();});")
replace('src/collection-ui.js',
"  q('collection-filter').addEventListener('change',event=>{filter=event.target.value;currentDetail=null;listScroll=0;renderBook();});",
"  q('collection-filter').addEventListener('change',event=>{if(moleculeTransition.busy)return;filter=event.target.value;currentDetail=null;listScroll=0;renderBook();});")
replace('src/collection-ui.js',
"  function showDetail(kind,id){\n    if(kind==='molecules'&&!state.hasMolecule(id))return false;",
"  function showDetail(kind,id){\n    if(moleculeTransition.busy)return false;if(kind==='molecules'&&!state.hasMolecule(id))return false;")
replace('src/collection-ui.js',
"  function openMolecule(id){\n    const record=recordById(id);if(!record||!canOpen())return false;",
"  function openMolecule(id){\n    const record=recordById(id);if(!record||!canOpen()||moleculeTransition.busy)return false;")

# Stable owner bookkeeping follows actual rendered mode without overriding an active transition.
replace('src/collection-ui.js',
"    if(currentDetail){renderDetail();return;}\n    if(tab==='molecules'){renderGraph();return;}",
"    if(currentDetail){renderDetail();moleculeTransition.markStable(currentDetail.kind==='molecules'?'detail':'graph',currentDetail.kind==='molecules'?currentDetail.id:graphFocusId);return;}\n    if(tab==='molecules'){renderGraph();moleculeTransition.markStable('graph',graphFocusId);return;}")

# Existing source-contract test now protects the single transition owner rather than the retired overlapping bridge.
p=Path('tests/encyclopedia-graph-ui.test.mjs'); text=p.read_text()
text=text.replace("assert.match(graphViewSource,/animateContinuity\\(document,continuity,id,rectOf\\(visual\\)[\\s\\S]*sourceSurface:stage[\\s\\S]*onDetail\\(id,node\\)/,'Graph must preserve both the molecule and surrounding graph surface before switching to Detail');", "assert.match(graphViewSource,/presentation\\.canOpenDetail\\)onDetail\\(id,node\\)/,'Graph view must delegate the measured selected node to the single collection transition owner');")
text=text.replace("assert.match(graphViewSource,/document\\.addEventListener\\('pointerup'[\\s\\S]*direction:'to-graph'/,'Detail return must use the inverse zoom language from the still-visible Detail molecule');", "assert.match(collectionUISource,/returnMoleculeDetailToGraph\\(currentMoleculeId\\(\\)\\?\\?record\\.id,host\\)/,'Detail return must use the current Detail molecule ID after navigation');")
text=text.replace("assert.match(graphViewSource,/molecule-continuity-active \\.molecule-shared-transition\\{visibility:hidden!important\\}/,'the legacy post-switch ghost must not overlap the pre-switch bridge');", "assert.match(collectionUISource,/createMoleculeTransitionController/,'Graph and Detail must share one explicit transition owner');")
text=text.replace("assert.match(graphViewSource,/cleanupContinuity\\(document,state\\);\\s*if\\(!from\\|\\|win\\?\\.matchMedia/,'reduced-motion must still clear any replaced transition lifecycle before returning immediately');", "assert.match(collectionUISource,/detailTransitionHandle/,'Detail renderer readiness must feed the active transition instead of spawning a second ghost');")
p.write_text(text)

# Architecture map records the transition owner and viewer snapshot handoff.
p=Path('docs/architecture.md'); text=p.read_text()
text=text.replace("`src/collection-ui.js`, `src/collection-state.js`, `src/element-progression.js`", "`src/collection-ui.js`, `src/collection-state.js`, `src/element-progression.js`, `src/encyclopedia-molecule-transition.js`")
text=text.replace("| 図鑑・発見・解放 | `src/collection-ui.js`, `src/collection-state.js`, `src/element-progression.js` |", "| 図鑑・発見・解放 | `src/collection-ui.js`, `src/collection-state.js`, `src/element-progression.js`, `src/encyclopedia-molecule-transition.js` |")
p.write_text(text)
