import {insightCategoryFor,insightCategoryLabel} from './insight-category.js';

export function unfinishedCraftIds(state={}){
  const finished=new Set(Array.isArray(state.recipes)?state.recipes:[]),seen=new Set(),result=[];
  for(const id of Array.isArray(state.hints)?state.hints:[]){
    if(typeof id!=='string'||!id||finished.has(id)||seen.has(id))continue;
    seen.add(id);result.push(id);
  }
  return result;
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

  let access=root.getElementById?.('open-pending-crafts'),dialog=root.getElementById?.('pending-crafts-dialog'),list=null,count=null,lastKey='';
  if(!access){
    access=root.createElement('button');access.id='open-pending-crafts';access.type='button';access.className='icon-button pending-craft-access';access.innerHTML='<span aria-hidden="true">💡</span><small></small>';count=access.querySelector('small');
    actions.insertBefore(access,collection.nextSibling);
  }else count=access.querySelector('small');

  if(!dialog){
    dialog=root.createElement('dialog');dialog.id='pending-crafts-dialog';dialog.className='sheet';dialog.setAttribute('aria-labelledby','pending-crafts-title');
    const header=root.createElement('header');header.className='sheet-header';
    const heading=root.createElement('div'),title=root.createElement('h2'),subtitle=root.createElement('p'),close=root.createElement('button');
    title.id='pending-crafts-title';title.textContent='未作成の設計図';subtitle.className='muted';subtitle.textContent='探索で見つけた、まだ作っていない分子';close.type='button';close.setAttribute('aria-label','未作成の設計図を閉じる');close.textContent='×';heading.append(title,subtitle);header.append(heading,close);
    const body=root.createElement('div');body.className='sheet-body';list=root.createElement('div');list.className='pending-craft-list';body.append(list);dialog.append(header,body);root.body?.append(dialog);
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  }else list=dialog.querySelector('.pending-craft-list');

  if(!root.getElementById?.('pending-craft-style')){
    const style=root.createElement('style');style.id='pending-craft-style';style.textContent=`
      .pending-craft-access{position:relative;min-width:40px}
      .pending-craft-access small{position:absolute;right:1px;top:0;min-width:15px;height:15px;padding:0 3px;border-radius:8px;display:grid;place-items:center;background:#f4d77d;color:#10202c;font-size:10px;font-weight:800;line-height:1}
      .pending-craft-access[data-pending="true"]{animation:pending-craft-pulse 3.2s ease-in-out 3}
      @keyframes pending-craft-pulse{0%,100%{box-shadow:0 0 0 rgba(244,215,125,0)}50%{box-shadow:0 0 0 4px rgba(244,215,125,.16),0 0 12px rgba(244,215,125,.18)}}
      .pending-craft-list{display:grid;gap:8px}
      .pending-craft-list button{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;text-align:left}
      .pending-craft-copy{display:grid;min-width:0;gap:3px}
      .pending-craft-identity{display:flex;align-items:center;gap:7px;min-width:0}
      .pending-craft-identity .insight-bulb{width:16px;height:16px}
      .pending-craft-identity strong{font-size:16px;line-height:1.1}
      .pending-craft-meta{display:flex;align-items:baseline;gap:8px;min-width:0;flex-wrap:wrap}
      .pending-craft-name{opacity:.76}
      .pending-craft-role{font-size:9px;opacity:.9}
      @media (prefers-reduced-motion:reduce){.pending-craft-access[data-pending="true"]{animation:none}}
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
  function refresh(){
    const ids=candidates(),key=ids.join('|');access.hidden=!ids.length;access.dataset.pending=String(!!ids.length);access.setAttribute('aria-label',ids.length?`未作成の設計図 ${ids.length}件`:'未作成の設計図なし');if(count)count.textContent=ids.length?String(ids.length):'';
    if(key!==lastKey){lastKey=key;if(ids.length){access.style.animation='none';queueMicrotask(()=>{access.style.animation='';});}}
    if(dialog.open)renderList(ids);if(dialog.open&&!ids.length)dialog.close();return ids;
  }
  access.addEventListener('click',()=>{const ids=refresh();if(!ids.length)return;renderList(ids);dialog.showModal?.();});

  for(const method of ['setCatalog','hint','discover','learn','reset']){
    const original=resources[method];if(typeof original!=='function'||original.__pendingCraftObserved)continue;
    const wrapped=function(...args){const result=original.apply(this,args);refresh();return result;};wrapped.__pendingCraftObserved=true;resources[method]=wrapped;
  }
  refresh();
  return {refresh};
}
