import {GRAPH_NODE_STATE,adjacentGraphSectorAnchor,buildVisibleGraphProjection,canonicalGraphPositions,graphNodePresentation,graphNodeState,layoutFocusNeighborhood,searchKnownGraphNodes} from './encyclopedia-graph.js?v=2';

export const ENCYCLOPEDIA_MOTION=Object.freeze({
  graphNavigationDuration:560,
  detailZoomDuration:760,
  edgeChevronDuration:760,
  easing:'cubic-bezier(.4,0,.2,1)',
});

const STYLE_ID='molecule-craft-encyclopedia-graph-style';
const STYLE=`
.encyclopedia-graph-host{display:block;min-height:0}.encyclopedia-graph{display:grid;gap:10px;margin-top:10px}.graph-toolbar{display:flex;align-items:center;gap:8px}.graph-search{width:100%;min-height:44px;padding:9px 12px;border:1px solid #2b4658;border-radius:12px;background:#0e1e2c;color:inherit}.graph-search::placeholder{color:#6f8797}.graph-stage{position:relative;height:clamp(390px,58dvh,560px);min-height:390px;overflow:hidden;touch-action:pan-y;border:1px solid #203b4b;border-radius:22px;background:radial-gradient(circle at 50% 45%,#173246 0,#0e2030 48%,#0a1724 100%);isolation:isolate}.graph-stage svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}.graph-edge{stroke:#6b94a4;stroke-width:1.25;opacity:.22}.graph-edge.direct{stroke:var(--graph-edge-relation,#8fe2d5);stroke-width:1.8;opacity:.76}.graph-edge-chevron{fill:none;stroke:var(--graph-edge-relation,#8fe2d5);stroke-width:.9;stroke-linecap:round;stroke-linejoin:round;opacity:.72}.graph-edge.direct.relation-chain-extension,.graph-edge-chevron.relation-chain-extension{--graph-edge-relation:#59b9ad}.graph-edge.direct.relation-bond-order,.graph-edge-chevron.relation-bond-order{--graph-edge-relation:#d2a24f}.graph-edge.direct.relation-ring-formation,.graph-edge-chevron.relation-ring-formation{--graph-edge-relation:#5ca8c5}.graph-edge.direct.relation-aromatization,.graph-edge-chevron.relation-aromatization{--graph-edge-relation:#9b84cb}.graph-edge.direct.relation-oxygenation,.graph-edge-chevron.relation-oxygenation{--graph-edge-relation:#73b783}.graph-edge.direct.relation-functional-group,.graph-edge-chevron.relation-functional-group{--graph-edge-relation:#b7b55f}.graph-edge.direct.relation-substitution,.graph-edge-chevron.relation-substitution{--graph-edge-relation:#b97ca6}.graph-edge.direct.relation-isomer,.graph-edge-chevron.relation-isomer{--graph-edge-relation:#a6b0b7}.graph-edge.direct.relation-bridge,.graph-edge-chevron.relation-bridge{--graph-edge-relation:#788b95}.graph-edge.direct.relation-isomer{stroke-dasharray:5 4}.graph-edge.direct.relation-bridge{stroke-dasharray:2 5}.graph-edge.cross{stroke:#7db8be;opacity:.38}.graph-edge.teaser{stroke-dasharray:3 5;opacity:.18}.graph-context-node{fill:#385568;opacity:.16}.graph-context-node.known{fill:#5b9f9a;opacity:.22}.graph-teaser-node{fill:#5d8696;opacity:.2}.graph-continuation{fill:#7dc5bd;opacity:.28}.graph-node{position:absolute;z-index:3;width:66px;height:66px;min-height:66px;padding:5px;border-radius:50%;transform:translate(-50%,-50%);display:grid;place-items:center;align-content:center;gap:1px;text-align:center;border:1px solid #476b7e;background:#142b3a;box-shadow:0 4px 16px #0005;color:#e7f4f8;overflow:hidden;will-change:transform}.graph-node strong{display:-webkit-box;max-width:54px;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:9px;line-height:1.15;font-weight:750}.graph-node small{max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;color:#a5c9c6}.graph-node.registered{border:2px solid #6fd4c4;background:radial-gradient(circle at 35% 28%,#315b59,#173d41 72%);box-shadow:0 0 0 1px #83e0d233,0 4px 18px #0006}.graph-node.known{border:2px solid #86d1c8;background:linear-gradient(180deg,#183a43 0 50%,#102734 50%);box-shadow:0 0 0 4px #6bd4c315,0 4px 18px #0006}.graph-node.known:after{content:'';position:absolute;inset:5px;border:1px dashed #8ddbd0;border-radius:50%;opacity:.5;animation:graph-known-pulse 2.6s ease-in-out infinite}.graph-node.unknown{border:1px dashed #55778a;background:#102330cc;box-shadow:none;color:transparent}.graph-node.unknown:before{content:'';width:19px;height:19px;border:1px solid #6f91a2;border-radius:50%;opacity:.52}.graph-node.focus{width:124px;height:124px;min-height:124px;padding:12px;z-index:5;border-width:2px;box-shadow:0 0 0 6px #63ded018,0 10px 30px #0009}.graph-node.focus.registered{background:radial-gradient(circle at 38% 30%,#386663,#173d41 70%)}.graph-node.focus.known{background:radial-gradient(circle at 38% 30%,#234c50,#102734 72%)}.graph-node.focus.unknown:before{width:32px;height:32px;border-width:2px}.graph-node.focus strong{max-width:96px;font-size:11px}.graph-focus-thumbnail{display:block;width:96px;height:78px;object-fit:contain;pointer-events:none;position:relative;z-index:1;filter:drop-shadow(0 5px 7px #0008)}.graph-focus-label{position:absolute;z-index:2;left:8px;right:8px;bottom:7px;padding:13px 5px 3px;border-radius:0 0 28px 28px;background:linear-gradient(180deg,transparent,#08141de8 48%,#08141df5);pointer-events:none;text-align:center;text-shadow:0 1px 4px #000}.graph-focus-label strong{display:block;max-width:none!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px!important;line-height:1.15}.graph-focus-label small{display:block;max-width:none;margin-top:2px;font-size:9px;color:#b5d7d3}.graph-focus-card:empty{display:none}.graph-node.focus.known .graph-focus-thumbnail{opacity:.76;filter:saturate(.78) drop-shadow(0 5px 7px #0008)}.graph-sector-jump{position:absolute;z-index:7;bottom:8px;width:34px;height:34px;min-height:0;padding:0;border:0;background:#0a172499;color:#9fc7d2;font-size:25px;line-height:1;border-radius:17px;opacity:.62;backdrop-filter:blur(3px)}.graph-sector-jump:hover,.graph-sector-jump:focus-visible{opacity:1;background:#173246dd}.graph-sector-jump.previous{left:8px}.graph-sector-jump.next{right:8px}.graph-node.highlight{outline:2px solid #9ec7d5;outline-offset:5px}.graph-node.reveal{animation:graph-reveal .42s cubic-bezier(.2,.75,.2,1)}.graph-focus-card{display:flex;min-height:48px;align-items:center;justify-content:center;gap:10px;padding:2px 4px}.graph-focus-identity{min-width:0;text-align:center}.graph-focus-identity strong{display:block;font-size:14px;line-height:1.25;overflow-wrap:anywhere}.graph-focus-identity small{display:block;margin-top:3px;color:#9ec7c4;font-size:11px}.graph-focus-card button{flex:none;min-height:40px;padding:7px 11px;font-size:11px}.graph-empty-focus{height:44px}.graph-stage[data-empty=true]:after{content:'◇';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:34px;color:#527386;opacity:.5}.graph-live{position:absolute}.graph-stage button:focus-visible{outline:3px solid #8be6d8;outline-offset:4px}.graph-search-hint{font-size:10px;color:#7894a5;white-space:nowrap}.molecule-continuity-surface{position:fixed!important;z-index:10010!important;margin:0!important;pointer-events:none!important;will-change:transform,opacity,filter}.molecule-continuity-bridge{position:fixed;z-index:10020;display:block;object-fit:contain;pointer-events:none;transform-origin:top left;filter:drop-shadow(0 10px 18px #0009);will-change:transform}.molecule-continuity-active .molecule-shared-transition{visibility:hidden!important}.molecule-continuity-active .molecule-detail-return{visibility:hidden!important}.molecule-continuity-active #collection-detail,.molecule-continuity-active .graph-stage{pointer-events:none}@keyframes graph-known-pulse{0%,100%{opacity:.28}50%{opacity:.72}}@keyframes graph-reveal{0%{opacity:0;transform:translate(-50%,-50%) scale(.72)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@media(max-width:650px){.encyclopedia-graph{margin-top:8px}.graph-stage{height:min(58dvh,520px);min-height:390px}.graph-toolbar{padding:0 1px}.graph-focus-card{padding-bottom:4px}}
@media(max-width:360px){.graph-stage{min-height:370px}.graph-node{width:62px;height:62px;min-height:62px}.graph-node.focus{width:116px;height:116px;min-height:116px;padding:11px}.graph-focus-thumbnail{width:88px;height:70px}}
@media(prefers-reduced-motion:reduce){.graph-node.known:after{animation:none}.graph-node.reveal{animation:none}}
`;

function ensureStyles(root){
  const document=root?.nodeType===9?root:root?.ownerDocument??globalThis.document;if(!document?.head||document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=STYLE;document.head.append(style);
}
const svgEl=(document,tag,attrs={})=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const easeInOutCubic=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const continuityStates=new WeakMap(),graphMotionStates=new WeakMap();
const rectOf=node=>{const rect=node?.getBoundingClientRect?.();return rect&&Number.isFinite(rect.width)&&Number.isFinite(rect.height)&&rect.width>0&&rect.height>0?{left:rect.left??rect.x??0,top:rect.top??rect.y??0,width:rect.width,height:rect.height}:null;};
const detailVisualRect=host=>{const rect=rectOf(host);if(!rect)return null;const width=Math.min(240,Math.max(140,rect.width*.58)),height=width*78/96;return {left:rect.left+(rect.width-width)/2,top:rect.top+(rect.height-height)/2,width,height};};
const detailMoleculeId=(host,fallback)=>host?.dataset?.moleculeId||fallback;
const graphNodeForId=(document,id)=>document.querySelector(`[data-graph-id="${id}"]`);
const graphVisualForId=(document,id)=>{const node=graphNodeForId(document,id);return node?.querySelector?.('.graph-focus-thumbnail')??node;};
const detailHostForId=(document,id)=>document.querySelector(`.molecule-detail-return[data-molecule-id="${id}"]`);

export function graphNodeMotionStart(previous,next,{nodeDiameter=66,focusDiameter=124}={}){
  if(!previous||!next)return null;
  const previousDiameter=previous.kind==='focus'?focusDiameter:nodeDiameter,currentDiameter=next.kind==='focus'?focusDiameter:nodeDiameter;
  return {dx:previous.x-next.x,dy:previous.y-next.y,scale:previousDiameter/currentDiameter};
}

const DIRECTIONAL_GRAPH_EDGE_RELATIONS=new Set(['chain-extension','bond-order','ring-formation','aromatization','oxygenation']);
const graphRelationClass=relation=>`relation-${String(relation??'bridge').toLowerCase().replace(/[^a-z0-9-]+/g,'-')}`;

export function graphEdgeVisualState(graph,edge,{direct=false}={}){
  const relation=graph?.relationCodes?.[edge?.relationCode]??'bridge',directional=!!direct&&DIRECTIONAL_GRAPH_EDGE_RELATIONS.has(relation);
  return {relation,relationClass:direct?graphRelationClass(relation):'',directional,from:directional?edge.from:null,to:directional?edge.to:null};
}

export function graphEdgeChevronGeometry(edge,positions,{focusId,nodeDiameter=66,focusDiameter=124,padding=5}={}){
  const from=positions?.get?.(edge?.from),to=positions?.get?.(edge?.to);if(!from||!to)return null;
  const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);if(!Number.isFinite(length)||length<1)return null;
  const fromRadius=(edge.from===focusId?focusDiameter:nodeDiameter)/2,toRadius=(edge.to===focusId?focusDiameter:nodeDiameter)/2;
  const minT=clamp((fromRadius+padding)/length,0,1),maxT=clamp(1-(toRadius+padding)/length,0,1);if(maxT-minT<.025)return null;
  const span=maxT-minT,startT=minT+span*.1,endT=minT+span*.78,pointAt=t=>({x:from.x+dx*t,y:from.y+dy*t});
  const start=pointAt(startT),end=pointAt(endT),ux=dx/length,uy=dy/length,px=-uy,py=ux,back={x:end.x-ux*1.25,y:end.y-uy*1.25},tip={x:end.x+ux*.7,y:end.y+uy*.7};
  const armA={x:back.x+px*1.25,y:back.y+py*1.25},armB={x:back.x-px*1.25,y:back.y-py*1.25},points=[armA,tip,armB].map(point=>`${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  return {start,end,delta:{x:start.x-end.x,y:start.y-end.y},points,fromRadius,toRadius};
}

function graphMotionState(host,win){
  let state=graphMotionStates.get(host);if(!state){state={token:0,rafId:null,animations:new Set(),win};graphMotionStates.set(host,state);}
  if(state.rafId!=null)(state.win?.cancelAnimationFrame?.bind(state.win)??clearTimeout)(state.rafId);
  for(const animation of state.animations)animation.cancel?.();state.animations.clear();state.rafId=null;state.win=win;state.token+=1;return state;
}
function runGraphGeometryMotion(state,tweens,{duration=ENCYCLOPEDIA_MOTION.graphNavigationDuration,win=globalThis.window}={}){
  if(!tweens.length)return;
  const token=state.token,now=()=>win?.performance?.now?.()??Date.now(),started=now(),raf=win?.requestAnimationFrame?.bind(win)??(fn=>setTimeout(()=>fn(now()),16));
  const step=()=>{
    if(state.token!==token)return;const progress=Math.min(1,(now()-started)/duration),eased=easeInOutCubic(progress);
    for(const {element,attrs} of tweens)for(const [name,from,to] of attrs)element.setAttribute(name,String(from+(to-from)*eased));
    if(progress<1)state.rafId=raf(step);else state.rafId=null;
  };
  state.rafId=raf(step);
}
function geometryTween(element,from,to,names){
  if(!from||!to)return null;const attrs=[];
  for(const [name,fromKey,toKey=fromKey] of names){const a=from[fromKey],b=to[toKey];if(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)>.01){element.setAttribute(name,String(a));attrs.push([name,a,b]);}}
  return attrs.length?{element,attrs}:null;
}

function restoreInlineVisibility(entry){if(!entry?.node?.style)return;entry.node.style.visibility=entry.visibility;}
function cleanupContinuity(document,state){
  state.animation?.cancel?.();state.surfaceAnimation?.cancel?.();state.animation=null;state.surfaceAnimation=null;
  state.ghost?.remove?.();state.surface?.remove?.();state.ghost=null;state.surface=null;
  restoreInlineVisibility(state.hiddenSource);restoreInlineVisibility(state.hiddenSurface);state.hiddenSource=null;state.hiddenSurface=null;
  document.body?.classList.remove('molecule-continuity-active','molecule-continuity-to-detail','molecule-continuity-to-graph');
}
function hideInline(state,key,node){if(!node?.style)return;state[key]={node,visibility:node.style.visibility};node.style.visibility='hidden';}
function createContinuitySurface(document,state,surface,id,{direction,duration,anchorRect}={}){
  const surfaceRect=rectOf(surface);if(!surfaceRect||!surface?.cloneNode)return null;
  const clone=surface.cloneNode(true);clone.classList.add('molecule-continuity-surface');clone.removeAttribute?.('id');clone.setAttribute?.('aria-hidden','true');
  clone.querySelector?.(`[data-graph-id="${id}"]`)?.style?.setProperty?.('visibility','hidden','important');
  for(const control of clone.querySelectorAll?.('button,input,select,textarea,[tabindex]')??[])control.setAttribute?.('tabindex','-1');
  Object.assign(clone.style,{left:`${surfaceRect.left}px`,top:`${surfaceRect.top}px`,width:`${surfaceRect.width}px`,height:`${surfaceRect.height}px`});
  const anchorX=anchorRect?anchorRect.left+anchorRect.width/2:surfaceRect.left+surfaceRect.width/2,anchorY=anchorRect?anchorRect.top+anchorRect.height/2:surfaceRect.top+surfaceRect.height/2;
  clone.style.transformOrigin=`${clamp((anchorX-surfaceRect.left)/surfaceRect.width*100,0,100)}% ${clamp((anchorY-surfaceRect.top)/surfaceRect.height*100,0,100)}%`;
  document.body?.append(clone);state.surface=clone;
  if(direction==='to-graph')hideInline(state,'hiddenSurface',surface);
  const keyframes=direction==='to-graph'
    ?[{transform:'scale(1.1)',opacity:.06,filter:'blur(2px)'},{transform:'scale(1)',opacity:1,filter:'blur(0px)'}]
    :[{transform:'scale(1)',opacity:1,filter:'blur(0px)'},{transform:'scale(1.1)',opacity:.06,filter:'blur(2px)'}];
  state.surfaceAnimation=clone.animate?.(keyframes,{duration,easing:ENCYCLOPEDIA_MOTION.easing,fill:'forwards'})??null;
  state.surfaceAnimation?.finished?.catch(()=>{});return clone;
}
function animateContinuity(document,state,id,from,targetRect,{duration=ENCYCLOPEDIA_MOTION.detailZoomDuration,waitMs=1300,win=globalThis.window,direction='to-detail',sourceVisual=null,sourceSurface=null}={}){
  cleanupContinuity(document,state);
  if(!from||win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return false;
  const ghost=document.createElement('img');ghost.className='molecule-continuity-bridge';ghost.src=new URL(`../assets/models/molecule-${id}.svg`,import.meta.url).href;ghost.alt='';ghost.width=96;ghost.height=78;Object.assign(ghost.style,{left:`${from.left}px`,top:`${from.top}px`,width:`${from.width}px`,height:`${from.height}px`});document.body?.append(ghost);
  document.body?.classList.add('molecule-continuity-active',`molecule-continuity-${direction}`);state.ghost=ghost;
  if(sourceVisual)hideInline(state,'hiddenSource',sourceVisual);
  if(direction==='to-detail'&&sourceSurface)createContinuitySurface(document,state,sourceSurface,id,{direction,duration,anchorRect:from});
  const now=()=>win?.performance?.now?.()??Date.now(),started=now(),raf=win?.requestAnimationFrame?.bind(win)??(fn=>setTimeout(fn,16));
  const seek=()=>{
    if(state.ghost!==ghost)return;const to=targetRect();
    if(!to){if(now()-started<waitMs)raf(seek);else cleanupContinuity(document,state);return;}
    if(direction==='to-graph'&&!state.surface){const targetNode=graphNodeForId(document,id),targetSurface=targetNode?.closest?.('.graph-stage');if(targetSurface)createContinuitySurface(document,state,targetSurface,id,{direction,duration,anchorRect:to});}
    const dx=to.left-from.left,dy=to.top-from.top,sx=to.width/from.width,sy=to.height/from.height;
    const animation=ghost.animate?.([{transform:'translate(0,0) scale(1,1)',opacity:1},{transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`,opacity:1}],{duration,easing:ENCYCLOPEDIA_MOTION.easing,fill:'forwards'});state.animation=animation??null;
    if(animation)animation.finished.catch(()=>{}).then(()=>{if(state.ghost===ghost)cleanupContinuity(document,state);});else cleanupContinuity(document,state);
  };
  raf(seek);return true;
}
function continuityState(document,win){
  let state=continuityStates.get(document);if(state)return state;
  state={focusId:null,ghost:null,surface:null,animation:null,surfaceAnimation:null,hiddenSource:null,hiddenSurface:null,press:null};continuityStates.set(document,state);
  document.addEventListener('pointerdown',event=>{const host=event.target?.closest?.('.molecule-detail-return');if(!host||event.button!==undefined&&event.button!==0)return;state.press={pointerId:event.pointerId,x:event.clientX,y:event.clientY,at:Date.now(),host};},true);
  document.addEventListener('pointerup',event=>{const press=state.press;state.press=null;if(!press||press.pointerId!==event.pointerId||Date.now()-press.at>650||Math.hypot(event.clientX-press.x,event.clientY-press.y)>8)return;const id=detailMoleculeId(press.host,state.focusId);if(!id)return;const from=detailVisualRect(press.host);animateContinuity(document,state,id,from,()=>rectOf(graphVisualForId(document,id)),{direction:'to-graph',duration:ENCYCLOPEDIA_MOTION.detailZoomDuration,waitMs:1500,win});},true);
  document.addEventListener('pointercancel',()=>{state.press=null;},true);
  document.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const host=event.target?.closest?.('.molecule-detail-return');if(!host)return;const id=detailMoleculeId(host,state.focusId);if(!id)return;animateContinuity(document,state,id,detailVisualRect(host),()=>rectOf(graphVisualForId(document,id)),{direction:'to-graph',duration:ENCYCLOPEDIA_MOTION.detailZoomDuration,waitMs:1500,win});},true);
  return state;
}

export function renderEncyclopediaGraph({
  host,graph,records,stateOptions,focusId,highlightId=null,onFocus=()=>{},onDetail=()=>{},onCraft=()=>{},previousPositions=new Map(),previousVisibleIds=new Set(),win=globalThis.window,
}={}){
  if(!host||!graph)throw Error('Graph host and graph are required');
  const document=host.ownerDocument??globalThis.document;ensureStyles(document);const reduceMotion=!!win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,graphMotion=graphMotionState(host,win);host.className='encyclopedia-graph-host';host.replaceChildren();
  const recordById=new Map(records.map(record=>[record.id,record])),projection=buildVisibleGraphProjection(graph,{focusId,...stateOptions});
  const wrapper=document.createElement('div');wrapper.className='encyclopedia-graph';
  const toolbar=document.createElement('div');toolbar.className='graph-toolbar';
  const search=document.createElement('input');search.type='search';search.className='graph-search';search.placeholder='登録済み・レシピ判明を検索';search.setAttribute('aria-label','分子を検索してグラフへ移動');
  const datalist=document.createElement('datalist'),listId='collection-graph-search-options';datalist.id=listId;search.setAttribute('list',listId);
  const refreshSearch=()=>{const matches=searchKnownGraphNodes(records,stateOptions,search.value);datalist.replaceChildren(...matches.map(({presentation})=>{const option=document.createElement('option');option.value=presentation.name;option.label=presentation.formula;return option;}));return matches;};
  search.addEventListener('input',refreshSearch);search.addEventListener('change',()=>{const match=refreshSearch()[0];if(match)onFocus(match.record.id);});search.addEventListener('keydown',event=>{if(event.key==='Enter'){const match=refreshSearch()[0];if(match){event.preventDefault();onFocus(match.record.id);}}});
  toolbar.append(search,datalist);wrapper.append(toolbar);
  const stage=document.createElement('div');stage.className='graph-stage';stage.setAttribute('role','group');stage.setAttribute('aria-label','分子関係グラフ');stage.dataset.empty=String(!projection.visibleIds.length);
  wrapper.append(stage);
  const previousSector=adjacentGraphSectorAnchor(graph,focusId,stateOptions,-1),nextSector=adjacentGraphSectorAnchor(graph,focusId,stateOptions,1);
  const addSectorJump=(row,direction)=>{if(!row)return;const button=document.createElement('button');button.type='button';button.className=`graph-sector-jump ${direction<0?'previous':'next'}`;button.textContent=direction<0?'‹':'›';const record=recordById.get(row.id),presentation=graphNodePresentation(record,graphNodeState(row.id,stateOptions));button.setAttribute('aria-label',`${presentation.name||'別系統'}へ移動`);button.addEventListener('click',event=>{event.stopPropagation();onFocus(row.id);});stage.append(button);};
  addSectorJump(previousSector,-1);addSectorJump(nextSector,1);
  let swipe=null;
  stage.addEventListener('pointerdown',event=>{if(event.target!==stage||event.button!==undefined&&event.button!==0)return;swipe={id:event.pointerId,x:event.clientX,y:event.clientY,at:Date.now()};try{stage.setPointerCapture?.(event.pointerId);}catch{}});
  stage.addEventListener('pointerup',event=>{if(!swipe||swipe.id!==event.pointerId)return;const start=swipe;swipe=null;const dx=event.clientX-start.x,dy=event.clientY-start.y,threshold=Math.max(44,Math.min(72,(stage.clientWidth||width)*.14));if(Date.now()-start.at>900||Math.abs(dx)<threshold||Math.abs(dx)<Math.abs(dy)*1.2)return;const target=dx<0?nextSector:previousSector;if(target)onFocus(target.id);});
  stage.addEventListener('pointercancel',()=>{swipe=null;});
  const rect=host.getBoundingClientRect?.()??{width:0},surfaceWidth=rect.width||host.clientWidth||360;const width=Math.max(240,surfaceWidth-2),height=Math.max(370,Math.min(560,win?.innerHeight?win.innerHeight*.58:480));
  const nodeDiameter=width<=360?62:66,focusDiameter=width<=360?116:124;
  const layout=layoutFocusNeighborhood(graph,focusId,{width,height,nodeDiameter,focusDiameter}),canonical=canonicalGraphPositions(graph),center=layout.center,focusGlobal=canonical.get(focusId)??{x:0,y:0};
  const positions=new Map(layout.positions),contextPosition=id=>{
    if(positions.has(id))return positions.get(id);
    const point=canonical.get(id)??focusGlobal,scale=.25,x=center.x+(point.x-focusGlobal.x)*scale,y=center.y+(point.y-focusGlobal.y)*scale;
    return {x:clamp(x,18,width-18),y:clamp(y,22,height-22),kind:projection.twoHop.includes(id)?'teaser':'distant'};
  };
  for(const id of [...projection.twoHop,...projection.distant])positions.set(id,contextPosition(id));
  const svg=svgEl(document,'svg',{viewBox:`0 0 ${width} ${height}`,'aria-hidden':'true'});stage.append(svg);const geometryTweens=[];
  const oneHopSet=new Set(projection.oneHop),twoHopSet=new Set(projection.twoHop),previousFocusId=[...previousPositions].find(([,point])=>point?.kind==='focus')?.[0]??null,focusChanged=previousFocusId!==focusId;
  const addLine=(edge,className)=>{const a=positions.get(edge.from)??contextPosition(edge.from),b=positions.get(edge.to)??contextPosition(edge.to);if(!a||!b)return null;const line=svgEl(document,'line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:className});svg.append(line);if(!reduceMotion){const pa=previousPositions.get(edge.from),pb=previousPositions.get(edge.to),tween=geometryTween(line,pa&&pb?{x1:pa.x,y1:pa.y,x2:pb.x,y2:pb.y}:null,{x1:a.x,y1:a.y,x2:b.x,y2:b.y},[['x1','x1'],['y1','y1'],['x2','x2'],['y2','y2']]);if(tween)geometryTweens.push(tween);}return line;};
  const addChevron=(edge,visual)=>{const geometry=graphEdgeChevronGeometry(edge,positions,{focusId,nodeDiameter,focusDiameter});if(!geometry)return;const chevron=svgEl(document,'polyline',{points:geometry.points,class:`graph-edge-chevron ${visual.relationClass}`});chevron.dataset.edgeSource=edge.from;chevron.dataset.edgeTarget=edge.to;chevron.dataset.relation=visual.relation;svg.append(chevron);if(focusChanged&&!reduceMotion&&chevron.animate){const animation=chevron.animate([{transform:`translate(${geometry.delta.x}px,${geometry.delta.y}px)`,opacity:0},{transform:`translate(${geometry.delta.x}px,${geometry.delta.y}px)`,opacity:.88,offset:.12},{transform:'translate(0px,0px)',opacity:.72}],{duration:ENCYCLOPEDIA_MOTION.edgeChevronDuration,delay:previousFocusId?ENCYCLOPEDIA_MOTION.graphNavigationDuration:80,easing:ENCYCLOPEDIA_MOTION.easing,fill:'both',iterations:1});if(animation){graphMotion.animations.add(animation);animation.finished.catch(()=>{}).then(()=>graphMotion.animations.delete(animation));}}};
  for(const edge of projection.visibleEdges){const direct=edge.from===focusId&&oneHopSet.has(edge.to)||edge.to===focusId&&oneHopSet.has(edge.from),cross=oneHopSet.has(edge.from)&&oneHopSet.has(edge.to),teaser=twoHopSet.has(edge.from)||twoHopSet.has(edge.to),visual=graphEdgeVisualState(graph,edge,{direct});addLine(edge,`graph-edge${direct?` direct ${visual.relationClass}`:cross?' cross':teaser?' teaser':''}`);if(visual.directional)addChevron(edge,visual);}
  for(const edge of projection.teaserEdges)addLine(edge,'graph-edge teaser');
  const addCircle=(id,point,r,className,previousPoint=previousPositions.get(id))=>{const circle=svgEl(document,'circle',{cx:point.x,cy:point.y,r,class:className});svg.append(circle);if(!reduceMotion){const tween=geometryTween(circle,previousPoint,point,[['cx','x'],['cy','y']]);if(tween)geometryTweens.push(tween);}};
  for(const id of projection.distant){const point=positions.get(id),state=projection.stateFor(id);addCircle(id,point,state===GRAPH_NODE_STATE.UNKNOWN?5:7,`graph-context-node${state!==GRAPH_NODE_STATE.UNKNOWN?' known':''}`);}
  for(const id of projection.twoHop){const point=positions.get(id);addCircle(id,point,4,'graph-teaser-node');}
  for(const row of projection.continuation)if(row.continues){const base=positions.get(row.id),angle=base?.angle??0;if(!base)continue;const point={x:base.x+Math.cos(angle)*43,y:base.y+Math.sin(angle)*43},previous=previousPositions.get(row.id),previousPoint=previous?{x:previous.x+Math.cos(previous.angle??0)*43,y:previous.y+Math.sin(previous.angle??0)*43}:null;addCircle(`${row.id}:continuation`,point,3,'graph-continuation',previousPoint);}
  const interactiveIds=[focusId,...projection.oneHop].filter((id,index,array)=>id&&array.indexOf(id)===index);
  for(const id of interactiveIds){
    const point=positions.get(id);if(!point)continue;const state=projection.stateFor(id),record=recordById.get(id),presentation=graphNodePresentation(record,state,{selected:id===focusId});
    const previous=previousPositions.get(id),canReveal=previousVisibleIds.size&&!previousVisibleIds.has(id)&&!previous;
    const node=document.createElement('button');node.type='button';node.className=`graph-node ${state}${id===focusId?' focus':''}${id===highlightId?' highlight':''}${canReveal?' reveal':''}`;node.style.left=`${point.x}px`;node.style.top=`${point.y}px`;node.setAttribute('aria-label',presentation.ariaLabel);node.setAttribute('aria-pressed',String(id===focusId));node.dataset.graphState=state;
    if(state!==GRAPH_NODE_STATE.UNKNOWN){
      const appendLabels=()=>{const name=document.createElement('strong');name.textContent=presentation.name;const formula=document.createElement('small');formula.textContent=presentation.formula;node.append(name,formula);};
      if(presentation.showThumbnail&&record){
        const img=document.createElement('img');img.className='graph-focus-thumbnail';img.src=new URL(`../assets/models/molecule-${record.id}.svg`,import.meta.url).href;img.alt='';img.width=96;img.height=78;img.decoding='async';img.addEventListener('error',()=>{img.remove();node.classList.add('thumbnail-unavailable');},{once:true});
        const label=document.createElement('span');label.className='graph-focus-label';const name=document.createElement('strong');name.textContent=presentation.name;const formula=document.createElement('small');formula.textContent=presentation.formula;label.append(name,formula);node.append(img,label);
      }else appendLabels();
    }
    node.dataset.graphId=id;node.addEventListener('click',()=>{if(id===focusId&&presentation.canOpenDetail)onDetail(id,node);else onFocus(id);});stage.append(node);
    if(previous&&!reduceMotion&&node.animate){const start=graphNodeMotionStart(previous,point,{nodeDiameter,focusDiameter});if(start&&(Math.hypot(start.dx,start.dy)>1||Math.abs(start.scale-1)>.01)){const animation=node.animate([{transform:`translate(calc(-50% + ${start.dx}px),calc(-50% + ${start.dy}px)) scale(${start.scale})`},{transform:'translate(-50%,-50%) scale(1)'}],{duration:ENCYCLOPEDIA_MOTION.graphNavigationDuration,easing:ENCYCLOPEDIA_MOTION.easing,fill:'both'});if(animation){graphMotion.animations.add(animation);animation.finished.catch(()=>{}).then(()=>graphMotion.animations.delete(animation));}}}
  }
  if(!reduceMotion)runGraphGeometryMotion(graphMotion,geometryTweens,{win});
  const focusedState=projection.stateFor(focusId),focusedPresentation=graphNodePresentation(recordById.get(focusId),focusedState,{selected:true}),card=document.createElement('div');card.className='graph-focus-card';
  if(focusedState!==GRAPH_NODE_STATE.UNKNOWN&&focusedPresentation.canCraft){const action=document.createElement('button');action.type='button';action.textContent='クラフト';action.addEventListener('click',()=>onCraft(focusId));card.append(action);}
  if(card.childElementCount)wrapper.append(card);host.append(wrapper);
  return {projection,positions,visibleIds:new Set(projection.visibleIds)};
}
