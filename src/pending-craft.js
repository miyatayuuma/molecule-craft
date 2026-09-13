import {insightCategoryFor,insightCategoryLabel} from './insight-category.js';

export function unfinishedCraftIds(state={}){
  const finished=new Set(Array.isArray(state.recipes)?state.recipes:[]),seen=new Set(),result=[];
  for(const id of Array.isArray(state.hints)?state.hints:[]){
    if(typeof id!=='string'||!id||finished.has(id)||seen.has(id))continue;
    seen.add(id);result.push(id);
  }
  return result;
}

const uniqueIds=ids=>[...new Set((Array.isArray(ids)?ids:[]).filter(id=>typeof id==='string'&&id))];
export function pendingAttentionTransition({previousIds=[],currentIds=[],acknowledgedIds=[]}={}){
  const previous=new Set(uniqueIds(previousIds)),current=uniqueIds(currentIds),acknowledged=new Set(uniqueIds(acknowledgedIds));
  if(!current.length)return {attention:'none',addedIds:[],acknowledgedIds:[],acknowledgedKey:''};
  const addedIds=current.filter(id=>!previous.has(id)),retainedAcknowledged=current.filter(id=>acknowledged.has(id));
  return {
    attention:retainedAcknowledged.length===current.length?'acknowledged':'unseen',
    addedIds,
    acknowledgedIds:retainedAcknowledged,
    acknowledgedKey:retainedAcknowledged.join('|'),
  };
}

function recordName(record,id){return record?.commonNameJa??record?.nameJa??record?.name??id;}
function recordFormula(record,id){return record?.formula??id;}
export function pendingCraftRowModel(resources,id){
  const record=resources?.record?.(id),category=insightCategoryFor(id);
  return {id,formula:recordFormula(record,id),name:recordName(record,id),category,categoryLabel:insightCategoryLabel(category)};
}
function ensureInsightCategoryStyles(root){
  if(root.getElementById?.('insight-category-styles'))return;
  const link=root.createElement('link');link.id='insight-category-styles';link.rel='stylesheet';link.href=new URL('./insight-category.css',import.meta.url).href;root.head?.append(link);
}

export function installPendingCraftAccess({resources,root=globalThis.document,windowRef=globalThis.window}={}){
  const noop={refresh:()=>unfinishedCraftIds(resources?.state)};
  if(!resources||!root?.createElement||!windowRef)return noop;
  const actions=root.querySelector?.('.topbar-actions'),collection=root.getElementById?.('open-collection');
  if(!actions||!collection)return noop;
  ensureInsightCategoryStyles(root);

  const legacy=root.getElementById?.('tank-next-hint');
  if(legacy){legacy.hidden=true;legacy.style.display='none';legacy.setAttribute('aria-hidden','true');legacy.tabIndex=-1;}

  let access=root.getElementById?.('open-pending-crafts'),dialog=root.getElementById?.('pending-crafts-dialog'),list=null,count=null,previousIds=[],acknowledgedIds=new Set(),acknowledgedKey='';
  if(!access){
    access=root.createElement('button');access.id='open-pending-crafts';access.type='button';access.className='icon-button pending-craft-access';access.innerHTML='<span aria-hidden="true">💡</span><small></small>';count=access.querySelector('small');
    actions.insertBefore(access,collection.nextSibling);
  }else count=access.querySelector('small');

  if(!dialog){
    dialog=root.createElement('dialog');dialog.id='pending-crafts-dialog';dialog.className='sheet';dialog.setAttribute('aria-label','設計図');
    const header=root.createElement('header');header.className='sheet-header';
    const close=root.createElement('button');
    close.type='button';close.setAttribute('aria-label','設計図を閉じる');close.textContent='×';header.append(close);
    const body=root.createElement('div');body.className='sheet-body';list=root.createElement('div');list.className='pending-craft-list';body.append(list);dialog.append(header,body);root.body?.append(dialog);
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  }else list=dialog.querySelector('.pending-craft-list');

  if(!root.getElementById?.('pending-craft-style')){
    const style=root.createElement('style');style.id='pending-craft-style';style.textContent=`
      .pending-craft-access{position:relative;min-width:40px;isolation:isolate}
      .pending-craft-access>span{display:inline-block;transform-origin:50% 72%}
      .pending-craft-access::before,.pending-craft-access::after{content:'';position:absolute;inset:3px;border-radius:13px;pointer-events:none;opacity:0}
      .pending-craft-access small{position:absolute;right:1px;top:0;min-width:15px;height:15px;padding:0 3px;border-radius:8px;display:grid;place-items:center;background:#f4d77d;color:#10202c;font-size:10px;font-weight:800;line-height:1}
      .pending-craft-access[data-attention="unseen"]>span{animation:pending-craft-reminder-bulb 7.2s ease-in-out infinite}
      .pending-craft-access[data-attention="unseen"]::after{box-shadow:0 0 0 3px rgba(244,215,125,.14),0 0 12px rgba(244,215,125,.16);animation:pending-craft-reminder-halo 7.2s ease-in-out infinite}
      .pending-craft-access[data-attention="unseen"][data-attention-new="true"]>span{animation:pending-craft-new-bulb .92s cubic-bezier(.22,.8,.28,1) 1,pending-craft-reminder-bulb 7.2s ease-in-out 1.25s infinite}
      .pending-craft-access[data-attention="unseen"][data-attention-new="true"]::before{border:1px solid rgba(244,215,125,.38);box-shadow:0 0 10px rgba(244,215,125,.22);animation:pending-craft-new-halo .92s ease-out 1}
      .pending-craft-access[data-attention="unseen"][data-attention-new="true"]::after{animation-delay:1.25s}
      .pending-craft-access[data-attention="unseen"][data-attention-new="true"] small{animation:pending-craft-badge-pop .62s cubic-bezier(.2,.9,.25,1.25) 1}
      @keyframes pending-craft-new-bulb{0%,100%{transform:translateY(0) rotate(0) scale(1)}20%{transform:translateY(1px) rotate(-7deg) scale(.94)}42%{transform:translateY(-3px) rotate(6deg) scale(1.12)}64%{transform:translateY(-1px) rotate(-3deg) scale(1.05)}82%{transform:translateY(0) rotate(2deg) scale(1.01)}}
      @keyframes pending-craft-new-halo{0%{opacity:0;transform:scale(.72)}28%{opacity:.72;transform:scale(.9)}100%{opacity:0;transform:scale(1.38)}}
      @keyframes pending-craft-badge-pop{0%,100%{transform:scale(1)}42%{transform:scale(1.24)}70%{transform:scale(.96)}}
      @keyframes pending-craft-reminder-bulb{0%,82%,94%,100%{transform:rotate(0) scale(1)}85%{transform:rotate(-4deg) scale(.97)}88%{transform:rotate(4deg) scale(1.035)}91%{transform:rotate(-2deg) scale(1.015)}}
      @keyframes pending-craft-reminder-halo{0%,82%,94%,100%{opacity:0;transform:scale(.9)}86%{opacity:.34;transform:scale(1)}89%{opacity:.55;transform:scale(1.1)}92%{opacity:.16;transform:scale(1.04)}}
      .pending-craft-list{display:grid;gap:8px}
      .pending-craft-list button{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;text-align:left}
      .pending-craft-copy{display:grid;min-width:0;gap:3px}
      .pending-craft-identity{display:flex;align-items:center;gap:7px;min-width:0}
      .pending-craft-identity .insight-bulb{width:16px;height:16px}
      .pending-craft-identity strong{font-size:16px;line-height:1.1}
      .pending-craft-meta{display:flex;align-items:baseline;gap:8px;min-width:0;flex-wrap:wrap}
      .pending-craft-name{opacity:.76}
      .pending-craft-role{font-size:9px;opacity:.9}
      @media (prefers-reduced-motion:reduce){
        .pending-craft-access[data-attention="unseen"],.pending-craft-access[data-attention="unseen"]>span,.pending-craft-access[data-attention="unseen"]::before,.pending-craft-access[data-attention="unseen"]::after,.pending-craft-access[data-attention="unseen"] small{animation:none}
        .pending-craft-access[data-attention="unseen"]{box-shadow:0 0 0 2px rgba(244,215,125,.2),0 0 10px rgba(244,215,125,.12)}
        .pending-craft-access[data-attention="unseen"]::after{opacity:.42;transform:none;border:1px solid rgba(244,215,125,.22);box-shadow:none}
        .pending-craft-access[data-attention="unseen"] small{box-shadow:0 0 0 2px rgba(244,215,125,.28)}
      }
    `;root.head?.append(style);
  }

  function candidates(){return unfinishedCraftIds(resources.state);}
  function renderList(ids){
    if(!list)return;list.replaceChildren();
    for(const id of ids){
      const model=pendingCraftRowModel(resources,id),button=root.createElement('button'),copy=root.createElement('span'),identity=root.createElement('span'),bulb=root.createElement('span'),formula=root.createElement('strong'),meta=root.createElement('span'),name=root.createElement('small'),role=root.createElement('small'),arrow=root.createElement('b');
      button.type='button';button.dataset.moleculeId=id;button.dataset.insightCategory=model.category;button.setAttribute('aria-label',`${model.formula} ${model.name}。用途 ${model.categoryLabel}。クラフト`);
      copy.className='pending-craft-copy';identity.className='pending-craft-identity';bulb.className='insight-bulb';bulb.setAttribute('aria-hidden','true');formula.textContent=model.formula;meta.className='pending-craft-meta';name.className='pending-craft-name';name.textContent=model.name;role.className='pending-craft-role insight-category-label';role.textContent=model.categoryLabel;arrow.textContent='CRAFT ›';
      identity.append(bulb,formula);meta.append(name,role);copy.append(identity,meta);button.append(copy,arrow);
      button.addEventListener('click',()=>{dialog.close();windowRef.dispatchEvent(new windowRef.CustomEvent('molecule-craft:craft-molecule',{detail:{id}}));});
      list.append(button);
    }
  }
  function setAttention(attention){
    access.dataset.attention=attention;
    if(attention!=='unseen')delete access.dataset.attentionNew;
  }
  function triggerNewAttention(){access.dataset.attentionNew='true';}
  function acknowledge(ids){
    const current=uniqueIds(ids);acknowledgedIds=new Set(current);acknowledgedKey=current.join('|');setAttention(current.length?'acknowledged':'none');
  }
  function refresh(){
    const ids=candidates(),transition=pendingAttentionTransition({previousIds,currentIds:ids,acknowledgedIds:[...acknowledgedIds]});
    access.hidden=!ids.length;access.dataset.pending=String(!!ids.length);access.setAttribute('aria-label',ids.length?`設計図 ${ids.length}件`:'設計図なし');if(count)count.textContent=ids.length?String(ids.length):'';
    acknowledgedIds=new Set(transition.acknowledgedIds);acknowledgedKey=transition.acknowledgedKey;
    if(dialog.open){renderList(ids);acknowledge(ids);if(!ids.length)dialog.close();}
    else{setAttention(transition.attention);if(transition.attention==='unseen'&&transition.addedIds.length)triggerNewAttention();}
    previousIds=ids;return ids;
  }
  access.addEventListener('animationend',event=>{if(event.animationName==='pending-craft-new-bulb')delete access.dataset.attentionNew;});
  access.addEventListener('click',()=>{const ids=refresh();if(!ids.length)return;renderList(ids);acknowledge(ids);dialog.showModal?.();});

  for(const method of ['setCatalog','hint','discover','learn','reset']){
    const original=resources[method];if(typeof original!=='function'||original.__pendingCraftObserved)continue;
    const wrapped=function(...args){const result=original.apply(this,args);refresh();return result;};wrapped.__pendingCraftObserved=true;resources[method]=wrapped;
  }
  refresh();
  return {refresh,get attention(){return access.dataset.attention??'none';},get acknowledgedKey(){return acknowledgedKey;}};
}
