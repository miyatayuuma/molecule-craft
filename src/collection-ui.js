import { validateFunctionalGroups } from './functional-groups.js';
import { validateCraftStructures } from './craft-structures.js';
import { createCollectionState, MILESTONES } from './collection-state.js';
import { COLLECTION_CATEGORIES, collectionCategory, moleculeDisplayName, graphSummary } from './collection-catalog.js';

export async function loadCollectionData(){
  const load=async path=>{const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw new Error(`Collection data HTTP ${response.status}`);return response.json();};
  const [groups,templates]=await Promise.all([load('../data/functional-groups.json'),load('../data/craft-structures.json')]);
  validateFunctionalGroups(groups);validateCraftStructures(templates,groups);return {groups,templates};
}

export async function createCollectionUI({records,onPlace,canOpen=()=>true,onOpenChange=()=>{},storage,root=document}){
  const data=await loadCollectionData();
  if(storage===undefined){try{storage=window.localStorage;}catch{storage=null;}}
  const state=createCollectionState({records,...data,storage});
  const q=id=>root.querySelector(`#${id}`),dialog=q('collection-dialog'),list=q('collection-list'),detail=q('collection-detail');
  let tab='molecules',category='all',filter='all',currentDetail=null;
  const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
  const button=(text,handler,className)=>{const node=el('button',text,className);node.type='button';node.addEventListener('click',handler);return node;};
  const groupById=id=>data.groups.find(group=>group.id===id);
  const recordById=id=>records.find(record=>record.id===id);
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
  dialog.addEventListener('close',()=>{document.body.classList.remove('collection-open');onOpenChange(false);});
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
      const node=button(`${template.nameJa} · ${unlocked?'配置':`${count}/${template.unlock.distinctMolecules}種類`}`,()=>{
        if(unlocked)onPlace(template);else{showDetail('groups',template.unlock.groupId);if(canOpen()&&!dialog.open){dialog.showModal();document.body.classList.add('collection-open');onOpenChange(true);}}
      },`craft-part ${unlocked?'unlocked':'locked'}`);
      node.title=`${template.label} · ${unlocked?'通常の原子として配置し、電子ドラッグで接続':`異なる${template.unlock.distinctMolecules}種類の分子で解禁`}`;container.appendChild(node);
    }
    q('craft-empty').hidden=container.childElementCount>0;
    q('craft-count').textContent=`解禁 ${state.unlockedCount}/${data.templates.length}`;
  }
  function renderSummary(){
    q('open-collection').textContent=`図鑑 ${state.discoveredCount}/${records.length}`;
    q('collection-progress').textContent=`分子 ${state.discoveredCount}/${records.length} · 構造 ${data.groups.filter(group=>state.hasGroup(group.id)).length}/${data.groups.length} · 部品 ${state.unlockedCount}/${data.templates.length}`;
    const storage=q('collection-storage');storage.textContent=state.storageMessage;storage.hidden=!state.storageMessage;
    q('game-save-status').textContent=state.storageMessage?'進行は未保存 · 図鑑で確認':'';
    q('game-loop-hint').textContent=state.discoveredCount?`発見 ${state.discoveredCount} · 部品 ${state.unlockedCount}解禁 · 図鑑で共通構造を比べよう`:'原子から分子を発見すると図鑑に登録。共通構造を知るほど、使える部品が増えます。';
    const milestoneList=q('collection-milestones');milestoneList.replaceChildren();
    for(const id of state.milestoneIds())milestoneList.appendChild(el('span',MILESTONES[id],'collection-tag'));
  }
  function renderBook(){
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
        card.append(el('small',COLLECTION_CATEGORIES[collectionCategory(record)]),el('strong',known?moleculeDisplayName(record):'???'),el('span',record.formula,'collection-formula'),el('small',known?`発見 #${state.moleculeEntry(record.id).order}`:'未発見 · タップでヒント'));
        list.appendChild(card);
      }
    }else{
      for(const group of data.groups){
        const known=state.hasGroup(group.id);if(!visible(known))continue;
        const templates=data.templates.filter(template=>template.unlock.groupId===group.id),isUnlocked=templates.some(template=>state.isUnlocked(template.id));
        const card=button('',()=>showDetail('groups',group.id),`collection-card ${known?'found':'unknown'}`);
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
      detail.appendChild(el('p',group.description));
      for(const template of data.templates.filter(item=>item.unlock.groupId===group.id)){
        const unlocked=state.isUnlocked(template.id);
        detail.appendChild(el('p',`${template.nameJa} — ${unlocked?'部品解禁済み':`異なる分子 ${sourceIds.length}/${template.unlock.distinctMolecules}種類で解禁`}`,'unlock-condition'));
        detail.appendChild(el('p',`接続点：${template.attachments.map(port=>`${template.atoms[port.atom]}${port.atom+1}に単結合${port.slots}本分`).join('、')}。配置後は電子をドラッグして接続します。`,'collection-note'));
        if(unlocked)detail.appendChild(button('構造パレットで使う',()=>{paletteTab('structures');dialog.close();},'collection-primary'));
      }
      if(group.id==='ketone')detail.appendChild(el('p','カルボニル骨格部品を使い、その両側に炭素を接続できます。','collection-note'));
      detail.appendChild(el('h4','見つかった分子'));
      for(const id of sourceIds)detail.appendChild(button(moleculeDisplayName(recordById(id)),()=>showDetail('molecules',id),'collection-tag'));
      return;
    }
    const record=recordById(currentDetail.id),known=state.hasMolecule(record.id),matches=state.detectedFor(record);
    detail.append(el('h3',known?moleculeDisplayName(record):'???'),el('p',record.formula,'detail-formula'),el('p',COLLECTION_CATEGORIES[collectionCategory(record)]));
    if(!known){
      detail.appendChild(el('p','分子式は原子の個数の手掛かりです。同じ分子式でも、つなぎ方が違えば別の分子になります。'));
      const hint=button('もう一段ヒントを見る',()=>{
        hint.disabled=true;
        detail.append(el('p',`含まれる構造：${matches.map(match=>groupById(match.id).nameJa).join('、')||'この図鑑の代表的な官能基はありません'}`),el('p',`炭素 ${record.atoms.filter(atom=>atom==='C').length}個 · 原子 ${record.atoms.length}個 · 結合 ${record.bonds.length}か所`));
      },'collection-primary');detail.appendChild(hint);return;
    }
    detail.appendChild(el('p',record.nameEn));
    detail.appendChild(el('p',`IUPAC: ${record.iupacNameEn}`,'collection-note'));
    if(record.aliases?.length)detail.appendChild(el('p',`別名：${record.aliases.join('、')}`,'collection-note'));
    const entry=state.moleculeEntry(record.id);detail.appendChild(el('p',`発見 #${entry.order}${entry.at?` · ${new Date(entry.at).toLocaleDateString('ja-JP')}`:''}`,'collection-note'));
    detail.appendChild(connectionDiagram(record));
    detail.appendChild(el('p','接続図：Hは結合先の原子にまとめて表記。立体配置・結合角を表す図ではありません。','collection-note'));
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
  function connectionDiagram(record){
    const {nodes,bonds}=graphSummary(record),ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 360 260');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${moleculeDisplayName(record)}の原子接続図`);svg.classList.add('connection-diagram');
    const positions=new Map(nodes.map((node,i)=>[node.index,nodes.length===1?{x:180,y:130}:{x:180+125*Math.cos(i*2*Math.PI/nodes.length-Math.PI/2),y:130+92*Math.sin(i*2*Math.PI/nodes.length-Math.PI/2)}]));
    const add=(tag,attrs)=>{const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));svg.appendChild(node);return node;};
    for(const [a,b,order]of bonds){const p=positions.get(a),q=positions.get(b),length=Math.hypot(q.x-p.x,q.y-p.y),dx=-(q.y-p.y)/length,dy=(q.x-p.x)/length;
      for(let i=0;i<order;i++){const offset=(i-(order-1)/2)*4;add('line',{x1:p.x+dx*offset,y1:p.y+dy*offset,x2:q.x+dx*offset,y2:q.y+dy*offset,stroke:'#94a3b8','stroke-width':2});}}
    for(const node of nodes){const p=positions.get(node.index);add('rect',{x:p.x-27,y:p.y-14,width:54,height:28,rx:8,fill:'#0f172a',stroke:'#38bdf8'});const text=add('text',{x:p.x,y:p.y+4,'text-anchor':'middle',fill:'#f8fafc','font-size':11});text.textContent=`${node.element}${node.index+1}${node.hydrogens?` H${node.hydrogens}`:''}`;}
    return svg;
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
      if(event.groupDiscoveries.length)messages.push(`${event.groupDiscoveries.map(id=>groupById(id).nameJa).join('・')}を発見`);
      if(event.unlockedParts.length)messages.push(`${event.unlockedParts.map(id=>data.templates.find(template=>template.id===id).nameJa).join('・')}部品を解禁`);
      return messages.join(' ／ ')||'分子図鑑に登録しました';
    },
  };
}
