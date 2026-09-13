from pathlib import Path

# Graph rendering: selected identity lives on the thumbnail and the thumbnail itself opens Detail.
graph=Path('src/encyclopedia-graph-view.js')
s=graph.read_text()
css_anchor=".graph-node.focus strong{max-width:96px;font-size:11px}.graph-focus-thumbnail{display:block;width:96px;height:78px;object-fit:contain;pointer-events:none;position:relative;z-index:1;filter:drop-shadow(0 5px 7px #0008)}"
css_new=".graph-node.focus strong{max-width:96px;font-size:11px}.graph-focus-thumbnail{display:block;width:96px;height:78px;object-fit:contain;pointer-events:none;position:relative;z-index:1;filter:drop-shadow(0 5px 7px #0008)}.graph-focus-label{position:absolute;z-index:2;left:8px;right:8px;bottom:7px;padding:13px 5px 3px;border-radius:0 0 28px 28px;background:linear-gradient(180deg,transparent,#08141de8 48%,#08141df5);pointer-events:none;text-align:center;text-shadow:0 1px 4px #000}.graph-focus-label strong{display:block;max-width:none!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px!important;line-height:1.15}.graph-focus-label small{display:block;max-width:none;margin-top:2px;font-size:9px;color:#b5d7d3}.graph-focus-card:empty{display:none}"
if css_anchor not in s: raise SystemExit('graph css anchor missing')
s=s.replace(css_anchor,css_new,1)
old="""    if(state!==GRAPH_NODE_STATE.UNKNOWN){
      const appendLabels=()=>{const name=document.createElement('strong');name.textContent=presentation.name;const formula=document.createElement('small');formula.textContent=presentation.formula;node.append(name,formula);};
      if(presentation.showThumbnail&&record){const img=document.createElement('img');img.className='graph-focus-thumbnail';img.src=new URL(`../assets/models/molecule-${record.id}.svg`,import.meta.url).href;img.alt='';img.width=96;img.height=78;img.decoding='async';img.addEventListener('error',()=>{img.remove();appendLabels();},{once:true});node.append(img);}else appendLabels();
    }
    node.addEventListener('click',()=>{if(id===focusId&&presentation.canOpenDetail)onDetail(id);else onFocus(id);});stage.append(node);
"""
new="""    if(state!==GRAPH_NODE_STATE.UNKNOWN){
      const appendLabels=()=>{const name=document.createElement('strong');name.textContent=presentation.name;const formula=document.createElement('small');formula.textContent=presentation.formula;node.append(name,formula);};
      if(presentation.showThumbnail&&record){
        const img=document.createElement('img');img.className='graph-focus-thumbnail';img.src=new URL(`../assets/models/molecule-${record.id}.svg`,import.meta.url).href;img.alt='';img.width=96;img.height=78;img.decoding='async';img.addEventListener('error',()=>{img.remove();node.classList.add('thumbnail-unavailable');},{once:true});
        const label=document.createElement('span');label.className='graph-focus-label';const name=document.createElement('strong');name.textContent=presentation.name;const formula=document.createElement('small');formula.textContent=presentation.formula;label.append(name,formula);node.append(img,label);
      }else appendLabels();
    }
    node.dataset.graphId=id;node.addEventListener('click',()=>{if(id===focusId&&presentation.canOpenDetail)onDetail(id,node);else onFocus(id);});stage.append(node);
"""
if old not in s: raise SystemExit('graph node anchor missing')
s=s.replace(old,new,1)
old="""  const focusedState=projection.stateFor(focusId),focusedPresentation=graphNodePresentation(recordById.get(focusId),focusedState,{selected:true}),card=document.createElement('div');card.className='graph-focus-card';
  if(focusedState!==GRAPH_NODE_STATE.UNKNOWN){const identity=document.createElement('div');identity.className='graph-focus-identity';const strong=document.createElement('strong');strong.textContent=focusedPresentation.name;const small=document.createElement('small');small.textContent=focusedPresentation.formula;identity.append(strong,small);card.append(identity);if(focusedPresentation.canOpenDetail){const action=document.createElement('button');action.type='button';action.textContent='詳細を見る';action.addEventListener('click',()=>onDetail(focusId));card.append(action);}else if(focusedPresentation.canCraft){const action=document.createElement('button');action.type='button';action.textContent='クラフト';action.addEventListener('click',()=>onCraft(focusId));card.append(action);}}
  else card.classList.add('graph-empty-focus');wrapper.append(card);host.append(wrapper);
"""
new="""  const focusedState=projection.stateFor(focusId),focusedPresentation=graphNodePresentation(recordById.get(focusId),focusedState,{selected:true}),card=document.createElement('div');card.className='graph-focus-card';
  if(focusedState!==GRAPH_NODE_STATE.UNKNOWN&&focusedPresentation.canCraft){const action=document.createElement('button');action.type='button';action.textContent='クラフト';action.addEventListener('click',()=>onCraft(focusId));card.append(action);}
  if(card.childElementCount)wrapper.append(card);host.append(wrapper);
"""
if old not in s: raise SystemExit('graph focus card anchor missing')
s=s.replace(old,new,1)
graph.write_text(s)

# Collection UI: shared-element animation and Detail model tap return.
ui=Path('src/collection-ui.js')
s=ui.read_text()
s=s.replace("import {renderEncyclopediaGraph} from './encyclopedia-graph-view.js?v=2';","import {renderEncyclopediaGraph} from './encyclopedia-graph-view.js?v=3';",1)
s=s.replace("  let tab='molecules',category='all',filter='available',scope='cho',currentDetail=null,detailViewer=null,detailGeneration=0,listScroll=0;","  let tab='molecules',category='all',filter='available',scope='cho',currentDetail=null,detailViewer=null,detailGeneration=0,listScroll=0,moleculeTransitioning=false;",1)
old="""  function releaseViewer(){detailGeneration++;detailViewer?.dispose();detailViewer=null;}
  function preview(record,name){
    const host=el('div',null,'collection-model');detail.appendChild(host);host.appendChild(el('p','模型を準備しています…','model-status'));
    const generation=detailGeneration;
    import('./collection-viewer.js?v=31').then(({createCollectionViewer})=>{
      if(generation!==detailGeneration||!dialog.open||!host.isConnected)return;
      host.replaceChildren();detailViewer=createCollectionViewer({host,record,name});
    }).catch(error=>{if(generation===detailGeneration){host.replaceChildren(el('p','模型を読み込めませんでした。','model-status'));console.warn('Collection viewer unavailable',error);}});
  }
"""
new="""  function releaseViewer(){detailGeneration++;detailViewer?.dispose();detailViewer=null;}
  const prefersReducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
  const moleculeAsset=id=>new URL(`../assets/models/molecule-${id}.svg`,import.meta.url).href;
  const snapshotRect=rect=>rect&&Number.isFinite(rect.width)&&Number.isFinite(rect.height)&&rect.width>0&&rect.height>0?{left:rect.left??rect.x??0,top:rect.top??rect.y??0,width:rect.width,height:rect.height}:null;
  function detailMoleculeRect(host){
    const rect=snapshotRect(host?.getBoundingClientRect?.());if(!rect)return null;const width=Math.min(240,Math.max(140,rect.width*.58)),height=width*78/96;return {left:rect.left+(rect.width-width)/2,top:rect.top+(rect.height-height)/2,width,height};
  }
  async function animateMoleculeSharedElement(record,from,to,{duration=400}={}){
    if(!record||!from||!to||prefersReducedMotion())return;
    const ghost=el('img',null,'molecule-shared-transition');ghost.src=moleculeAsset(record.id);ghost.alt='';ghost.width=96;ghost.height=78;Object.assign(ghost.style,{left:`${from.left}px`,top:`${from.top}px`,width:`${from.width}px`,height:`${from.height}px`});document.body.append(ghost);
    const dx=to.left-from.left,dy=to.top-from.top,sx=to.width/from.width,sy=to.height/from.height,animation=ghost.animate?.([{transform:'translate(0,0) scale(1,1)',opacity:1},{transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`,opacity:1}],{duration,easing:'cubic-bezier(.2,.72,.2,1)',fill:'forwards'});
    if(animation)try{await animation.finished;}catch{}ghost.remove();
  }
  async function fadeDetailChrome(modelHost){
    if(prefersReducedMotion())return;const nodes=[...detail.children].filter(node=>node!==modelHost),animations=nodes.map(node=>node.animate?.([{opacity:1},{opacity:0}],{duration:130,easing:'ease-out',fill:'forwards'})).filter(Boolean);await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
  }
  async function showMoleculeDetailFromGraph(id,sourceNode){
    const record=recordById(id);if(!record||!state.hasMolecule(id)||moleculeTransitioning)return false;
    const source=sourceNode?.querySelector?.('.graph-focus-thumbnail')??sourceNode,from=snapshotRect(source?.getBoundingClientRect?.());if(!from)return showDetail('molecules',id);
    moleculeTransitioning=true;if(!currentDetail)listScroll=dialog.scrollTop;tab='molecules';currentDetail={kind:'molecules',id};renderBook();dialog.scrollTop=0;
    const host=detail.querySelector('.molecule-detail-return'),to=detailMoleculeRect(host);if(host)host.style.opacity='0';const chrome=[...detail.children].filter(node=>node!==host);for(const node of chrome)node.animate?.([{opacity:0},{opacity:1}],{duration:180,delay:150,easing:'ease-out'});
    await animateMoleculeSharedElement(record,from,to,{duration:420});if(host){host.style.opacity='';host.animate?.([{opacity:0},{opacity:1}],{duration:120,easing:'ease-out'});}moleculeTransitioning=false;host?.focus?.({preventScroll:true});return true;
  }
  async function returnMoleculeDetailToGraph(id,modelHost){
    const record=recordById(id);if(!record||moleculeTransitioning)return false;const from=detailMoleculeRect(modelHost);if(!from)return false;moleculeTransitioning=true;await fadeDetailChrome(modelHost);if(modelHost)modelHost.style.opacity='0';
    currentDetail=null;graphFocusId=id;graphHighlightId=null;renderBook();dialog.scrollTop=listScroll;
    const targetNode=list.querySelector(`[data-graph-id=\"${id}\"]`),target=targetNode?.querySelector?.('.graph-focus-thumbnail')??targetNode,to=snapshotRect(target?.getBoundingClientRect?.());if(target)target.style.opacity='0';await animateMoleculeSharedElement(record,from,to,{duration:360});if(target){target.style.opacity='';target.animate?.([{opacity:0},{opacity:1}],{duration:100});}moleculeTransitioning=false;targetNode?.focus?.({preventScroll:true});return true;
  }
  function installDetailGraphReturn(host,record,name){
    host.classList.add('molecule-detail-return');host.tabIndex=0;host.setAttribute('role','button');host.setAttribute('aria-label',`${name}からグラフへ戻る`);let press=null;
    host.addEventListener('pointerdown',event=>{if(event.button!==undefined&&event.button!==0)return;press={id:event.pointerId,x:event.clientX,y:event.clientY,at:Date.now()};},true);
    host.addEventListener('pointerup',event=>{if(!press||press.id!==event.pointerId)return;const start=press;press=null;if(Date.now()-start.at>650||Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)return;void returnMoleculeDetailToGraph(record.id,host);},true);
    host.addEventListener('pointercancel',()=>{press=null;},true);host.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();void returnMoleculeDetailToGraph(record.id,host);});
  }
  function preview(record,name){
    const host=el('div',null,'collection-model');installDetailGraphReturn(host,record,name);detail.appendChild(host);host.appendChild(el('p','模型を準備しています…','model-status'));
    const generation=detailGeneration;
    import('./collection-viewer.js?v=31').then(({createCollectionViewer})=>{
      if(generation!==detailGeneration||!dialog.open||!host.isConnected)return;
      host.replaceChildren();detailViewer=createCollectionViewer({host,record,name});
    }).catch(error=>{if(generation===detailGeneration){host.replaceChildren(el('p','模型を読み込めませんでした。','model-status'));console.warn('Collection viewer unavailable',error);}});
  }
"""
if old not in s: raise SystemExit('collection preview anchor missing')
s=s.replace(old,new,1)
old="""  function showDetail(kind,id){
    if(kind==='molecules'&&!state.hasMolecule(id))return false;
    if(!currentDetail)listScroll=dialog.scrollTop;tab=kind;currentDetail={kind,id};renderBook();dialog.scrollTop=0;q('detail-back')?.focus({preventScroll:true});return true;
  }
"""
new="""  function showDetail(kind,id){
    if(kind==='molecules'&&!state.hasMolecule(id))return false;
    if(!currentDetail)listScroll=dialog.scrollTop;tab=kind;currentDetail={kind,id};renderBook();dialog.scrollTop=0;(kind==='molecules'?detail.querySelector('.molecule-detail-return'):q('detail-back'))?.focus?.({preventScroll:true});return true;
  }
"""
if old not in s: raise SystemExit('showDetail anchor missing')
s=s.replace(old,new,1)
s=s.replace("      onFocus:id=>focusGraph(id),onDetail:id=>showDetail('molecules',id),","      onFocus:id=>focusGraph(id),onDetail:(id,node)=>showMoleculeDetailFromGraph(id,node),",1)
old="""    detail.replaceChildren();const {kind,id}=currentDetail,nav=el('div',null,'detail-navigation');
    const back=button(kind==='molecules'?'‹ グラフ':'‹ 一覧',()=>{const previous=currentDetail.id;currentDetail=null;if(kind==='molecules')graphFocusId=previous;renderBook();dialog.scrollTop=listScroll;kind==='groups'&&[...list.querySelectorAll('button')].find(node=>node.dataset.entryId===previous)?.focus({preventScroll:true});},'book-back');back.id='detail-back';nav.append(back);
    const items=visibleItems(kind),index=items.findIndex(item=>item.id===id);
"""
new="""    detail.replaceChildren();const {kind,id}=currentDetail,nav=el('div',null,`detail-navigation${kind==='molecules'?' molecule-detail-navigation':''}`);
    if(kind==='groups'){const back=button('‹ 一覧',()=>{const previous=currentDetail.id;currentDetail=null;renderBook();dialog.scrollTop=listScroll;[...list.querySelectorAll('button')].find(node=>node.dataset.entryId===previous)?.focus({preventScroll:true});},'book-back');back.id='detail-back';nav.append(back);}
    const items=visibleItems(kind),index=items.findIndex(item=>item.id===id);
"""
if old not in s: raise SystemExit('detail navigation anchor missing')
s=s.replace(old,new,1)
ui.write_text(s)

# Detail/model visual affordance and fixed shared-element ghost.
styles=Path('styles.css')
s=styles.read_text()
anchor=".collection-model{margin:16px 0;border-radius:20px;overflow:hidden;background:radial-gradient(ellipse at 50% 44%,#2a4658,#0f2333 75%)}.model-stage{height:clamp(220px,34dvh,330px);width:100%;position:relative}"
replacement=".collection-model{margin:16px 0;border-radius:20px;overflow:hidden;background:radial-gradient(ellipse at 50% 44%,#2a4658,#0f2333 75%)}.collection-model.molecule-detail-return{position:relative;min-height:clamp(220px,34dvh,330px);cursor:pointer;outline:none}.collection-model.molecule-detail-return:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.detail-navigation.molecule-detail-navigation{justify-content:flex-end}.molecule-shared-transition{position:fixed;z-index:10000;display:block;object-fit:contain;pointer-events:none;transform-origin:top left;filter:drop-shadow(0 10px 18px #0009);will-change:transform}.model-stage{height:clamp(220px,34dvh,330px);width:100%;position:relative}"
if anchor not in s: raise SystemExit('styles model anchor missing')
s=s.replace(anchor,replacement,1)
styles.write_text(s)

# Focused regression/source contract for the requested navigation model.
test=Path('tests/encyclopedia-graph-ui.test.mjs')
s=test.read_text()
marker="console.log(`Encyclopedia graph UI passed: state/privacy, cross-links, teaser expansion, deterministic sector layout, degree-${maxDegreeNode.degree} mobile geometry.`);"
block="""const [graphViewSource,collectionUISource,stylesSource]=await Promise.all([
  readFile(new URL('../src/encyclopedia-graph-view.js',import.meta.url),'utf8'),
  readFile(new URL('../src/collection-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../styles.css',import.meta.url),'utf8'),
]);
assert.doesNotMatch(graphViewSource,/詳細を見る/,'Graph footer detail button must not return');
assert.doesNotMatch(collectionUISource,/‹ グラフ/,'Detail Graph back button must not return');
assert.match(graphViewSource,/graph-focus-label/,'focused identity belongs inside the selected thumbnail');
assert.match(graphViewSource,/onDetail\(id,node\)/,'focused thumbnail itself must own Graph -> Detail');
assert.match(collectionUISource,/showMoleculeDetailFromGraph/);
assert.match(collectionUISource,/returnMoleculeDetailToGraph/);
assert.match(collectionUISource,/Math\.hypot\(event\.clientX-start\.x,event\.clientY-start\.y\)>8/,'Detail tap return must distinguish tap from model drag');
assert.match(stylesSource,/molecule-shared-transition/,'shared-element ghost must render above both Graph and Detail');

"""
if marker not in s: raise SystemExit('graph ui test marker missing')
s=s.replace(marker,block+marker,1)
test.write_text(s)
