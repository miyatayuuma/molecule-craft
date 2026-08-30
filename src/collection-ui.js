import { validateFunctionalGroups } from './functional-groups.js?v=21';
import { validateCraftStructures } from './craft-structures.js?v=21';
import { createCollectionState, MILESTONES } from './collection-state.js?v=21';
import { COLLECTION_CATEGORIES, collectionCategory, moleculeDisplayName } from './collection-catalog.js';

export async function loadCollectionData(){
  const load=async path=>{const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw new Error(`Collection data HTTP ${response.status}`);return response.json();};
  const [groups,templates]=await Promise.all([load('../data/functional-groups.json?v=21'),load('../data/craft-structures.json?v=21')]);
  validateFunctionalGroups(groups);validateCraftStructures(templates,groups);return {groups,templates};
}

export async function createCollectionUI({records,onPlace,canOpen=()=>true,onOpenChange=()=>{},storage,root=document}){
  const data=await loadCollectionData();
  if(storage===undefined){try{storage=window.localStorage;}catch{storage=null;}}
  const state=createCollectionState({records,...data,storage});
  const q=id=>root.querySelector(`#${id}`),dialog=q('collection-dialog'),list=q('collection-list'),detail=q('collection-detail');
  let tab='molecules',category='all',filter='all',currentDetail=null,detailViewer=null,detailGeneration=0;
  const collectibleGroups=data.groups.filter(group=>group.collectible!==false),thumbnails=new Map();
  const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
  const button=(text,handler,className)=>{const node=el('button',text,className);node.type='button';node.addEventListener('click',handler);return node;};
  const groupById=id=>data.groups.find(group=>group.id===id);
  const recordById=id=>records.find(record=>record.id===id);
  const collectibleMatches=record=>state.detectedFor(record).filter(match=>groupById(match.id).collectible!==false);
  function releaseViewer(){detailGeneration++;detailViewer?.dispose();detailViewer=null;}
  function preview(record,name,key){
    const host=el('div',null,'collection-model');detail.appendChild(host);
    host.appendChild(el('p','立体模型を読み込んでいます…','collection-note'));
    const generation=detailGeneration;
    import('./collection-viewer.js?v=21').then(({createCollectionViewer})=>{
      if(generation!==detailGeneration||!dialog.open||!host.isConnected)return;
      host.replaceChildren();
      detailViewer=createCollectionViewer({host,record,name,onThumbnail:url=>{
        thumbnails.set(key,url);while(thumbnails.size>24)thumbnails.delete(thumbnails.keys().next().value);
      }});
    }).catch(error=>{if(generation===detailGeneration){host.replaceChildren(el('p','立体模型を読み込めませんでした。説明と図鑑進行は利用できます。','collection-note'));console.warn('Collection viewer unavailable',error);}});
  }
  function thumbnail(card,key){
    if(!thumbnails.has(key))return;
    const img=el('img',null,'collection-thumbnail');img.src=thumbnails.get(key);img.alt='';img.width=80;img.height=80;card.appendChild(img);
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
  keyboardTabs('[data-palette-tab]');
  q('open-collection').addEventListener('click',()=>{
    if(!canOpen())return;
    renderBook();dialog.showModal();document.body.classList.add('collection-open');onOpenChange(true);
  });
  q('close-collection').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{releaseViewer();document.body.classList.remove('collection-open');onOpenChange(false);});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  for(const node of root.querySelectorAll('[data-book-tab]'))node.addEventListener('click',()=>{tab=node.dataset.bookTab;currentDetail=null;renderBook();});
  keyboardTabs('[data-book-tab]');
  q('collection-category').addEventListener('change',event=>{category=event.target.value;currentDetail=null;renderBook();});
  q('collection-filter').addEventListener('change',event=>{filter=event.target.value;currentDetail=null;renderBook();});
  function showDetail(kind,id){tab=kind;currentDetail={kind,id};renderBook();q('detail-back')?.focus();}
  function renderPalette(){
    const container=q('craft-palette');container.replaceChildren();
    for(const template of data.templates){
      if(!state.isUnlocked(template.id)&&!state.hasGroup(template.unlock.groupId))continue;
      const unlocked=state.isUnlocked(template.id),count=state.groupSources(template.unlock.groupId).length;
      const node=button('',()=>{
        if(unlocked)onPlace(template);else{showDetail('groups',template.unlock.groupId);if(canOpen()&&!dialog.open){dialog.showModal();document.body.classList.add('collection-open');onOpenChange(true);}}
      },`craft-part ${unlocked?'unlocked':'locked'}`);
      node.append(el('strong',template.nameJa),el('span',template.notation,'craft-notation'),el('small',unlocked?'配置':`${count}/${template.unlock.distinctMolecules}種類で解禁`));
      node.title=`${template.nameJa} ${template.notation} · ${unlocked?'通常の原子として配置し、電子ドラッグで接続':`異なる${template.unlock.distinctMolecules}種類の分子で解禁`}`;container.appendChild(node);
    }
    q('craft-empty').hidden=container.childElementCount>0;
    q('craft-count').textContent=`解禁 ${state.unlockedCount}/${data.templates.length}`;
  }
  function renderSummary(){
    q('open-collection').textContent=`図鑑 ${state.discoveredCount}/${records.length}`;
    q('collection-progress').textContent=`分子 ${state.discoveredCount}/${records.length} · 構造 ${collectibleGroups.filter(group=>state.hasGroup(group.id)).length}/${collectibleGroups.length} · 部品 ${state.unlockedCount}/${data.templates.length}`;
    const storage=q('collection-storage');storage.textContent=state.storageMessage;storage.hidden=!state.storageMessage;
    q('game-save-status').textContent=state.storageMessage?'進行は未保存 · 図鑑で確認':'';
    q('game-loop-hint').textContent=state.discoveredCount?`発見 ${state.discoveredCount} · 部品 ${state.unlockedCount}解禁 · 図鑑で共通構造を比べよう`:'原子から分子を発見すると図鑑に登録。共通構造を知るほど、使える部品が増えます。';
    const milestoneList=q('collection-milestones');milestoneList.replaceChildren();
    for(const id of state.milestoneIds())milestoneList.appendChild(el('span',MILESTONES[id],'collection-tag'));
  }
  function renderBook(){
    releaseViewer();
    renderSummary();
    for(const node of root.querySelectorAll('[data-book-tab]')){const active=node.dataset.bookTab===tab;node.setAttribute('aria-selected',String(active));node.tabIndex=active?0:-1;}
    q('collection-controls').hidden=!!currentDetail;q('collection-category-label').hidden=tab!=='molecules';
    list.hidden=!!currentDetail;detail.hidden=!currentDetail;
    if(currentDetail){renderDetail();return;}
    const select=q('collection-category');select.replaceChildren();
    select.appendChild(new Option(`すべて · ${state.discoveredCount}/${records.length}`,'all'));
    for(const [key,label] of Object.entries(COLLECTION_CATEGORIES)){
      const items=records.filter(record=>collectionCategory(record)===key);
      if(items.length)select.appendChild(new Option(`${label} · ${items.filter(item=>state.hasMolecule(item.id)).length}/${items.length}`,key));
    }
    select.value=category;q('collection-filter').value=filter;list.replaceChildren();
    const visible=known=>filter==='all'||(filter==='found'?known:!known);
    if(tab==='molecules'){
      const ordered=[...records].sort((a,b)=>a.atoms.length-b.atoms.length||a.id.localeCompare(b.id));
      for(const record of ordered){
        const known=state.hasMolecule(record.id);if(!visible(known)||(category!=='all'&&collectionCategory(record)!==category))continue;
        const card=button('',()=>showDetail('molecules',record.id),`collection-card ${known?'found':'unknown'}`);
        if(known)thumbnail(card,`molecules:${record.id}`);
        card.append(el('small',COLLECTION_CATEGORIES[collectionCategory(record)]),el('strong',known?moleculeDisplayName(record):'???'),el('span',record.formula,'collection-formula'),el('small',known?`発見 #${state.moleculeEntry(record.id).order}`:'未発見 · タップでヒント'));
        list.appendChild(card);
      }
    }else{
      for(const group of collectibleGroups){
        const known=state.hasGroup(group.id);if(!visible(known))continue;
        const templates=data.templates.filter(template=>template.unlock.groupId===group.id),isUnlocked=templates.some(template=>state.isUnlocked(template.id));
        const card=button('',()=>showDetail('groups',group.id),`collection-card ${known?'found':'unknown'}`);
        if(known)thumbnail(card,`groups:${group.id}`);
        card.append(el('small',group.family==='skeleton'?'骨格':'官能基・部分構造'),el('strong',known?group.nameJa:'???'),el('span',known?group.notation:'未発見'),el('small',isUnlocked?'部品を解禁済み':known?`${state.groupSources(group.id).length}種類の分子で発見`:'分子の中から見つけよう'));
        list.appendChild(card);
      }
    }
    if(!list.childElementCount)list.appendChild(el('p','この条件の項目はありません。','collection-note'));
  }
  function renderDetail(){
    detail.replaceChildren();
    const back=button('一覧へ戻る',()=>{currentDetail=null;renderBook();},'book-back');back.id='detail-back';detail.appendChild(back);
    if(currentDetail.kind==='groups'){
      const group=groupById(currentDetail.id),known=state.hasGroup(group.id),sourceIds=state.groupSources(group.id);
      detail.append(el('h3',known?group.nameJa:'未発見の構造'),el('p',known?`${group.nameEn} · ${group.notation}`:'分子を完成させて共通構造を見つけよう。'));
      if(!known)return;
      const part=data.templates.find(item=>item.unlock.groupId===group.id);
      if(part)preview(part,group.nameJa,`groups:${group.id}`);
      if(group.aliases?.length)detail.appendChild(el('p',`別名：${group.aliases.join('、')}`,'collection-note'));
      detail.appendChild(el('p',group.description));
      for(const template of data.templates.filter(item=>item.unlock.groupId===group.id)){
        const unlocked=state.isUnlocked(template.id);
        detail.appendChild(el('p',`${template.nameJa} — ${unlocked?'部品解禁済み':`異なる分子 ${sourceIds.length}/${template.unlock.distinctMolecules}種類で解禁`}`,'unlock-condition'));
        detail.appendChild(el('p',`接続点：${template.attachments.map(port=>`${template.atoms[port.atom]}${port.atom+1}に単結合${port.slots}本分`).join('、')}。配置後は電子をドラッグして接続します。`,'collection-note'));
        if(unlocked)detail.appendChild(button('構造パレットで使う',()=>{paletteTab('structures');dialog.close();},'collection-primary'));
      }
      detail.appendChild(el('h4','見つかった分子'));
      for(const id of sourceIds)detail.appendChild(button(moleculeDisplayName(recordById(id)),()=>showDetail('molecules',id),'collection-tag'));
      return;
    }
    const record=recordById(currentDetail.id),known=state.hasMolecule(record.id),matches=collectibleMatches(record);
    detail.append(el('h3',known?moleculeDisplayName(record):'???'),el('p',record.formula,'detail-formula'),el('p',COLLECTION_CATEGORIES[collectionCategory(record)]));
    if(!known){
      detail.appendChild(el('p','分子式は原子の個数の手掛かりです。同じ分子式でも、つなぎ方が違えば別の分子になります。'));
      const hint=button('もう一段ヒントを見る',()=>{
        hint.disabled=true;
        detail.append(el('p',`含まれる構造：${matches.map(match=>groupById(match.id).nameJa).join('、')||'この図鑑の代表的な官能基はありません'}`),el('p',`炭素 ${record.atoms.filter(atom=>atom==='C').length}個 · 原子 ${record.atoms.length}個 · 結合 ${record.bonds.length}か所`));
      },'collection-primary');detail.appendChild(hint);return;
    }
    preview(record,moleculeDisplayName(record),`molecules:${record.id}`);
    detail.appendChild(el('p',record.nameEn));
    detail.appendChild(el('p',`IUPAC: ${record.iupacNameEn}`,'collection-note'));
    if(record.aliases?.length)detail.appendChild(el('p',`別名：${record.aliases.join('、')}`,'collection-note'));
    const entry=state.moleculeEntry(record.id);detail.appendChild(el('p',`発見 #${entry.order}${entry.at?` · ${new Date(entry.at).toLocaleDateString('ja-JP')}`:''}`,'collection-note'));
    detail.appendChild(el('p','模型は結合情報から生成した教材用の立体配置です。発見時の姿勢や実測構造を保存したものではありません。','collection-note'));
    const tags=el('div',null,'collection-tags');
    for(const match of matches)tags.appendChild(button(groupById(match.id).nameJa,()=>showDetail('groups',match.id),'collection-tag'));
    if(!matches.length)tags.appendChild(el('p','代表的な官能基はありません。'));detail.appendChild(tags);
    const relatives=state.isomersOf(record);
    if(relatives.length){
      const found=relatives.filter(item=>state.hasMolecule(item.id));
      detail.appendChild(el('h4',`同じ分子式の構造 ${found.length+1}/${relatives.length+1}（登録DB内）`));
      for(const item of relatives)detail.appendChild(button(state.hasMolecule(item.id)?moleculeDisplayName(item):`??? · ${item.formula}`,()=>showDetail('molecules',item.id),'collection-tag'));
      detail.appendChild(el('p','構造異性体を区別します。cis/transや鏡像異性体の収集は未対応です。','collection-note'));
    }
  }
  renderPalette();renderSummary();
  return {
    state,
    templateFor:id=>state.isUnlocked(id)?data.templates.find(template=>template.id===id):null,
    observeStructures(structures){const result=state.observeStructures(structures);if(result.changed){renderPalette();renderSummary();if(dialog.open)renderBook();}return result;},
    describeEvent(event){
      if(!event?.isNew)return '';
      const messages=[];
      if(event.isomerOf.length)messages.push('同じ分子式で、別の構造を発見');
      const names=event.groupDiscoveries.map(groupById).filter(group=>group.collectible!==false).map(group=>group.nameJa);
      if(names.length)messages.push(`${names.join('・')}を発見`);
      if(event.unlockedParts.length)messages.push(`${event.unlockedParts.map(id=>data.templates.find(template=>template.id===id).nameJa).join('・')}部品を解禁`);
      return messages.join(' ／ ')||'分子図鑑に登録しました';
    },
  };
}
