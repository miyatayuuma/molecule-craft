import { validateFunctionalGroups } from './functional-groups.js?v=21';
import { validateCraftStructures } from './craft-structures.js?v=31';
import { createCollectionState, MILESTONES } from './collection-state.js?v=36';
import { createElementPalette, ELEMENT_UNLOCKS } from './element-progression.js?v=36';
import { COLLECTION_CATEGORIES, collectionCategory, moleculeDisplayName } from './collection-catalog.js';

export async function loadCollectionData(){
  const load=async path=>{const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw new Error(`Collection data HTTP ${response.status}`);return response.json();};
  const [groups,templates,encyclopedia]=await Promise.all([load('../data/functional-groups.json?v=25'),load('../data/craft-structures.json?v=25'),load('../data/encyclopedia.json?v=29').catch(()=>({molecules:{},parts:{}}))]);
  validateFunctionalGroups(groups);validateCraftStructures(templates,groups);return {groups,templates,encyclopedia};
}

export async function createCollectionUI({records,onPlace,canOpen=()=>true,onOpenChange=()=>{},storage,root=document,elementPalette=createElementPalette(root),elementAccess=()=>true}){
  const data=await loadCollectionData();
  if(storage===undefined){try{storage=window.localStorage;}catch{storage=null;}}
  const state=createCollectionState({records,...data,storage,elementAccess});
  const q=id=>root.querySelector(`#${id}`),dialog=q('collection-dialog'),list=q('collection-list'),detail=q('collection-detail');
  let tab='molecules',category='all',filter='available',currentDetail=null,detailViewer=null,detailGeneration=0,listScroll=0;
  const collectibleGroups=data.groups.filter(group=>group.collectible!==false);
  const groupById=id=>data.groups.find(group=>group.id===id),recordById=id=>records.find(record=>record.id===id);
  const collectibleMatches=record=>state.detectedFor(record).filter(match=>groupById(match.id).collectible!==false);
  const entry=(kind,id)=>(kind==='molecules'?data.encyclopedia.molecules:data.encyclopedia.parts)?.[id];
  const number=(kind,id)=>entry(kind,id)?.number??((kind==='molecules'?records:collectibleGroups).findIndex(item=>item.id===id)+1);
  const numberLabel=(kind,id)=>`No. ${String(number(kind,id)).padStart(3,'0')}`;
  const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
  const button=(text,handler,className)=>{const node=el('button',text,className);node.type='button';node.addEventListener('click',handler);return node;};
  const section=(title)=>{const node=el('details',null,'detail-extras');node.append(el('summary',title));detail.append(node);return node;};
  function releaseViewer(){detailGeneration++;detailViewer?.dispose();detailViewer=null;}
  function preview(record,name){
    const host=el('div',null,'collection-model');detail.appendChild(host);host.appendChild(el('p','模型を準備しています…','model-status'));
    const generation=detailGeneration;
    import('./collection-viewer.js?v=31').then(({createCollectionViewer})=>{
      if(generation!==detailGeneration||!dialog.open||!host.isConnected)return;
      host.replaceChildren();detailViewer=createCollectionViewer({host,record,name});
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
  q('open-collection').addEventListener('click',()=>{if(!canOpen())return;renderBook();dialog.showModal();document.body.classList.add('collection-open');onOpenChange(true);});
  q('close-collection').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{releaseViewer();document.body.classList.remove('collection-open');onOpenChange(false);});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  for(const node of root.querySelectorAll('[data-book-tab]'))node.addEventListener('click',()=>{tab=node.dataset.bookTab;currentDetail=null;listScroll=0;renderBook();});
  q('collection-category').addEventListener('change',event=>{category=event.target.value;currentDetail=null;listScroll=0;renderBook();});
  q('collection-filter').addEventListener('change',event=>{filter=event.target.value;currentDetail=null;listScroll=0;renderBook();});
  function showDetail(kind,id){if(!currentDetail)listScroll=dialog.scrollTop;tab=kind;currentDetail={kind,id};renderBook();dialog.scrollTop=0;q('detail-back')?.focus({preventScroll:true});}
  function openMolecule(id){
    if(!state.hasMolecule(id)||!recordById(id)||!canOpen())return false;
    tab='molecules';category='all';filter='found';currentDetail={kind:'molecules',id};listScroll=0;renderBook();if(!dialog.open){dialog.showModal();document.body.classList.add('collection-open');onOpenChange(true);}dialog.scrollTop=0;return true;
  }
  window.addEventListener('molecule-craft:open-molecule',event=>openMolecule(event.detail?.id));
  function renderPalette(){
    elementPalette.update(state);const container=q('craft-palette');container.replaceChildren();
    for(const template of [...data.templates].sort((a,b)=>a.tier-b.tier)){
      if(!state.isUnlocked(template.id)&&!state.hasGroup(template.unlock.groupId))continue;
      const unlocked=state.isUnlocked(template.id),count=state.groupSources(template.unlock.groupId).length;
      const node=button('',()=>{
        if(unlocked)onPlace(template);else if(canOpen()){showDetail('groups',template.unlock.groupId);if(!dialog.open){dialog.showModal();document.body.classList.add('collection-open');onOpenChange(true);}}
      },`craft-part ${unlocked?'unlocked':'locked'}`);
      node.append(el('strong',template.nameJa),el('span',template.notation,'craft-notation'));
      if(!unlocked)node.append(el('small',`解放まで ${count}/${template.unlock.distinctMolecules}`));
      node.title=`${template.nameJa} ${template.notation}`;container.appendChild(node);
    }
    q('craft-empty').hidden=container.childElementCount>0;q('craft-count').textContent=String(state.unlockedCount);
  }
  function renderSummary(){
    const open=q('open-collection');open.replaceChildren(document.createTextNode('図鑑 '),el('small',`${state.discoveredCount}/${records.length}`));
    q('collection-progress').textContent=tab==='molecules'?`${state.discoveredCount} / ${records.length} 発見`:`${state.unlockedCount} / ${data.templates.length} 解放`;
    const storage=q('collection-storage');storage.textContent=state.storageMessage;storage.hidden=!state.storageMessage;
    const save=q('game-save-status');save.textContent=state.storageMessage?'図鑑を保存できません。図鑑で確認してください。':'';save.hidden=!state.storageMessage;
    q('game-loop-hint').textContent=`発見 ${state.discoveredCount} · 原子 ${state.unlockedElements().length}/8 · 部品 ${state.unlockedCount}/${data.templates.length}`;
    const milestoneList=q('collection-milestones');milestoneList.replaceChildren();for(const id of state.milestoneIds())milestoneList.appendChild(el('span',MILESTONES[id],'collection-tag'));
  }
  function visibleItems(kind=tab){
    const visible=(known,available)=>filter==='all'||(filter==='available'?available:filter==='found'?known:!known);
    return (kind==='molecules'?records:collectibleGroups).filter(item=>kind==='molecules'?
      visible(state.hasMolecule(item.id),state.canBuild(item))&&(category==='all'||collectionCategory(item)===category):
      visible(state.hasGroup(item.id),item.pattern.atoms.every(atom=>state.canUseElement(atom.element)))).sort((a,b)=>number(kind,a.id)-number(kind,b.id));
  }
  function renderBook(){
    releaseViewer();renderSummary();
    for(const node of root.querySelectorAll('[data-book-tab]')){const active=node.dataset.bookTab===tab;node.setAttribute('aria-selected',String(active));node.tabIndex=active?0:-1;}
    q('collection-controls').hidden=!!currentDetail;q('collection-category-label').hidden=tab!=='molecules';
    const footer=dialog.querySelector('.book-footer');if(footer)footer.hidden=!!currentDetail;
    list.hidden=!!currentDetail;detail.hidden=!currentDetail;
    if(currentDetail){renderDetail();return;}
    const select=q('collection-category');select.replaceChildren(new Option('すべて','all'));
    for(const [key,label]of Object.entries(COLLECTION_CATEGORIES))if(records.some(record=>collectionCategory(record)===key))select.appendChild(new Option(label,key));
    select.value=category;q('collection-filter').value=filter;
    if(q('filter-summary'))q('filter-summary').textContent=`${category!=='all'&&tab==='molecules'?`${COLLECTION_CATEGORIES[category]} · `:''}${q('collection-filter').selectedOptions[0]?.textContent??''}`;
    list.replaceChildren();
    for(const item of visibleItems()){
      const known=tab==='molecules'?state.hasMolecule(item.id):state.hasGroup(item.id),kind=tab;
      const card=button('',()=>showDetail(kind,item.id),`collection-card ${known?'found':'unknown'}`);card.dataset.entryId=item.id;
      card.append(el('small',numberLabel(tab,item.id),'dex-number'));
      if(known){thumbnail(card,tab,item.id);card.append(el('span',tab==='groups'&&data.templates.some(t=>t.unlock.groupId===item.id&&state.isUnlocked(t.id))?'✓':'●','dex-state'));}
      else card.append(el('span','','unknown-model'));
      card.append(el('strong',known?(tab==='molecules'?moleculeDisplayName(item):item.nameJa):'???'));list.appendChild(card);
    }
    if(!list.childElementCount)list.appendChild(el('p','この条件の項目はありません。','collection-note'));
  }
  function renderDetail(){
    detail.replaceChildren();const {kind,id}=currentDetail,nav=el('div',null,'detail-navigation');
    const back=button('‹ 一覧',()=>{const previous=currentDetail.id;currentDetail=null;renderBook();dialog.scrollTop=listScroll;[...list.querySelectorAll('button')].find(node=>node.dataset.entryId===previous)?.focus({preventScroll:true});},'book-back');back.id='detail-back';nav.append(back);
    const items=visibleItems(kind),index=items.findIndex(item=>item.id===id);
    for(const [label,delta]of [['‹',-1],['›',1]]){const next=items[index+delta],node=button(label,()=>{if(next)showDetail(kind,next.id);});node.setAttribute('aria-label',delta<0?'前の項目':'次の項目');node.disabled=index<0||!next;nav.append(node);}detail.append(nav);
    if(kind==='groups'){renderGroup(id);return;}
    const record=recordById(id),known=state.hasMolecule(id),matches=collectibleMatches(record);
    heading(kind,id,known?moleculeDisplayName(record):'???',known?record.formula:'');
    if(!known){
      const box=el('div',null,'unknown-detail');box.append(el('div','','unknown-model'),el('p','まだ見つかっていない分子'));
      const hint=button('ヒントを見る',()=>{
        hint.hidden=true;const hints=el('div',null,'hint-content');hints.append(el('p',record.formula,'detail-formula'),el('p',COLLECTION_CATEGORIES[collectionCategory(record)]));
        if(!state.canBuild(record))hints.append(el('p',`必要な原子：${ELEMENT_UNLOCKS.filter(item=>record.atoms.includes(item.symbol)&&!state.canUseElement(item.symbol)).map(item=>item.symbol==='C'?'C（H Veilの奥で発見）':item.symbol==='O'?'O（炭素の群れの奥で発見）':`${item.symbol}（発見${item.discoveries}種類で解放）`).join('・')}`));
        const more=button('もう一つヒント',()=>{more.hidden=true;hints.append(el('p',`含まれる部品：${matches.map(match=>groupById(match.id).nameJa).join('、')||'この図鑑の部品は含まれません'}`));});hints.append(more);box.append(hints);
      },'collection-primary');box.append(hint);detail.append(box);return;
    }
    preview(record,moleculeDisplayName(record));
    detail.append(el('p',entry(kind,id)?.description??record.learningNote??'この分子を図鑑に登録しました。','dex-description'));
    const extra=section('くわしく');extra.append(el('p',`${record.nameEn} · ${COLLECTION_CATEGORIES[collectionCategory(record)]}`),el('p',`IUPAC: ${record.iupacNameEn}`));
    if(record.aliases?.length)extra.append(el('p',`別名：${record.aliases.join('、')}`));
    if(record.learningNote)extra.append(el('p',record.learningNote));
    const discovered=state.moleculeEntry(id);extra.append(el('p',`発見 ${discovered.order}番目${discovered.at?` · ${new Date(discovered.at).toLocaleDateString('ja-JP')}`:''}`));
    const tags=el('div',null,'collection-tags');for(const match of matches)tags.append(button(groupById(match.id).nameJa,()=>showDetail('groups',match.id),'collection-tag'));if(matches.length){extra.append(el('h4','見つかる部品'),tags);}
    const relatives=state.isomersOf(record);if(relatives.length){extra.append(el('h4','同じ分子式の仲間'));for(const item of relatives)extra.append(button(state.hasMolecule(item.id)?moleculeDisplayName(item):'???',()=>showDetail('molecules',item.id),'collection-tag'));}
    extra.append(el('p','模型は結合情報からつくった教材用の配置です。実測構造ではありません。水色の内円は芳香環に広がるπ電子を表す記号です。cis/transや鏡像異性体は分けて収集していません。'));
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
      if(event.unlockedElements?.length)messages.push(`${event.unlockedElements.map(symbol=>`${ELEMENT_UNLOCKS.find(item=>item.symbol===symbol).name}（${symbol}）`).join('・')}を解放`);
      if(event.unlockedParts.length)messages.push(`${event.unlockedParts.map(id=>data.templates.find(template=>template.id===id).nameJa).join('・')}を獲得`);
      return messages.join(' ／ ')||'図鑑に登録しました';
    },
  };
}
