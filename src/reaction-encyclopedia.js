import {createReactionGroupPreview,createReactionThumbnailFromEntry,reactionThumbnailModel} from './reaction-book-visual.js';
// The registry owns reaction definitions; this module only groups and presents them.
const LABELS={oxidation:'酸化',combustion:'燃焼',esterification:'エステル化',halogenation:'ハロゲン化',condensation:'縮合',polymerization:'重合',hydrolysis:'加水分解',addition:'付加',hydration:'水和',substitution:'置換','ring-opening':'開環',cycloaddition:'環化',dehydration:'脱水',other:'その他'};
const CONDITION={acidic:'酸性',basic:'塩基性',heat:'加熱',light:'光'};
// These labels describe the LAB control state, not a universal chemical prohibition.
const LAB_FORBIDDEN_LABELS=Object.freeze({acidic:'酸性にしない',basic:'塩基性にしない',heat:'加熱OFF',light:'光OFF'});

const CONDITION_ROLES=Object.freeze({
 acidic:'酸性：酸塩基状態の変化が反応を助ける場合があります。',
 basic:'塩基性：酸塩基状態の変化が反応を助ける場合があります。',
 heat:'加熱：反応に必要なエネルギーを供給します。',
 light:'光：光エネルギーで反応の開始を助けます。'
});
const PROCESS_ROLES=Object.freeze({
 'coordination-catalyst':'配位触媒：モノマーの連続した結合を助けます。',
 'diene-coordination-catalyst':'ジエン用配位触媒：結合位置を制御するための設定です。',
 'radical-initiation':'ラジカル開始：連鎖反応の出発点をつくります。',
 'cationic-initiation':'カチオン開始：正電荷をもつ末端から成長を始めます。',
 'lewis-acid-catalysis':'ルイス酸触媒：反応部位を活性化します。',
 'active-cooling':'冷却：反応中の温度上昇を抑えます。',
 'alkoxide-type-initiation':'アルコキシド型開始：開環して鎖が成長する反応を始めます。',
 'dry-controlled-medium':'乾燥条件：水による副反応を抑えます。',
 'esterification-polycondensation':'エステル化縮合：エステル結合をつなぎます。',
 'amidation-polycondensation':'アミド化縮合：アミド結合をつなぎます。',
 'water-removal':'水の除去：縮合で生じた水を取り除き、反応を進めます。',
 'resole-base-catalysis':'塩基触媒：フェノール樹脂の縮合を進めるための設定です。',
 'pressure-controlled-process':'圧力制御：水などの揮発成分の除去を調整します。'
});
// Only a catalog with explicit, complete molecule formulas and conserved atoms
// can be presented as a chemical equation. An arrow alone is not evidence.
function atomTotals(formulas){
 if(!Array.isArray(formulas)||!formulas.length)return null;
 const totals=new Map();
 for(const formula of formulas){
   if(typeof formula!=='string'||!/^(?:[A-Z][a-z]?(?:[1-9]\d*)?)+$/.test(formula))return null;
   for(const [,element,count] of formula.matchAll(/([A-Z][a-z]?)(\d*)/g))totals.set(element,(totals.get(element)??0)+Number(count||1));
 }
 return totals;
}
export function isBalancedReaction(reactants,products){
 const before=atomTotals(reactants),after=atomTotals(products);
 return !!before&&!!after&&before.size===after.size&&[...before].every(([element,count])=>after.get(element)===count);
}
function coefficientFormula(ids,molecules){
 const counts=new Map();for(const id of ids)counts.set(id,(counts.get(id)??0)+1);
 return [...counts].map(([id,count])=>`${count>1?count+' ':''}${molecules.get(id)?.formula}`).join(' ＋ ');
}
export function reactionDetailInfo(entry,{records=[],polymerRecords=[]}={}){
 if(!entry?.definition)return null;
 const d=entry.definition,isPolymer=entry.kind==='polymer',molecules=new Map(records.map(r=>[r.id,r]));
 const feeds=isPolymer?d.feedSpecies:d.reactants.map(x=>x.species);
 const product=polymerRecords.find(x=>x.id===d.polymerId),repeat=isPolymer?(product?.repeatUnit??null):null;
 const products=isPolymer?[]:d.products;
 const balanced=!isPolymer&&isBalancedReaction(feeds.map(id=>molecules.get(id)?.formula),products.map(id=>molecules.get(id)?.formula));
 const water=isPolymer&&(d.transformFamilies??[]).some(x=>['ester-condensation','amide-condensation','phenol-methylene-bridge'].includes(x));
 const requires=isPolymer?(d.environment?.requires??[]):(d.requires??[]);
 const forbids=isPolymer?(d.environment?.forbids??[]):(d.forbids??[]);
 const conditions=[
   ...requires.map(x=>CONDITION_ROLES[x]??(CONDITION[x]??x)+'：この経路で必要な条件です。'),
   ...(d.processSetupTokens??[]).map(x=>PROCESS_ROLES[x]??'工程設定：'+x),
   ...forbids.map(x=>(CONDITION[x]??x)+'：このLAB経路では避ける条件です。')
 ];
 return {
   kind:balanced?'equation':'mapping',
   before:balanced?coefficientFormula(feeds,molecules):feeds.map(id=>molecules.get(id)?.nameJa??id).join(' ＋ '),
   after:balanced?coefficientFormula(products,molecules):(isPolymer?(repeat?'［'+repeat+'］ₙ':'構成単位が連なる高分子（模型で確認）'):products.map(id=>molecules.get(id)?.nameJa??id).join(' ＋ ')),
   byproductNote:water?'縮合で水などの小分子が生じる経路です。式の係数や生成量はこの模型からは決まりません。':null,
   bondChange:reactionThumbnailModel(entry,{records,polymerRecords})?.feature??'反応前後の結合を比べましょう。',
   conditionSummary:[...requires.map(x=>CONDITION[x]??x),...forbids.map(x=>LAB_FORBIDDEN_LABELS[x]??`${CONDITION[x]??x}を避ける`),...(d.processSetupTokens??[]).map(x=>PROCESS_ROLES[x]?.split('：')[0]??'工程設定')].join('、')||'指定なし',
   conditions:conditions.length?conditions:['このLAB経路に指定された追加条件はありません。']
 };
}

export function reactionGroups(authority,progress){
  const entries=authority.entries().filter(x=>x.encyclopediaIncluded), groups=new Map();
  for(const entry of entries){
    const tags=[...new Set(entry.categoryTags.filter(tag=>LABELS[tag]))];
    for(const tag of tags.length?tags:['other']){
      if(!groups.has(tag))groups.set(tag,[]);
      groups.get(tag).push({...entry,state:progress.getState(entry.reactionId),unavailable:false});
    }
  }
  return {entries,groups:[...groups].map(([id,items])=>({id,label:LABELS[id],items})),verified:new Set(entries.filter(e=>progress.getState(e.reactionId)==='verified').map(e=>e.reactionId)).size};
}

const STAR_POINTS='12,1 15.3,8.2 23.2,9.2 17.5,14.8 18.9,22.8 12,19 5.1,22.8 6.5,14.8 .8,9.2 8.7,8.2';
function starIcon(filled,justEarned=false){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('reaction-progress-star');
  if(filled)svg.classList.add('is-filled');
  if(justEarned)svg.classList.add('is-new');
  const shape=document.createElementNS('http://www.w3.org/2000/svg','polygon');
  shape.setAttribute('points',STAR_POINTS);svg.append(shape);return svg;
}
export function updateReactionStars(host,done,total,{award=false}={}){
  const count=Math.max(0,Math.min(total,done));
  host.className='reaction-book-group-count';
  host.setAttribute('aria-label',`実証済み ${count} / ${total} 経路`);
  host.dataset.done=String(count);host.dataset.total=String(total);
  host.replaceChildren();
  if(total<=7){
    for(let n=0;n<total;n++)host.append(starIcon(n<count,award&&n===count-1));
  }else{
    const mark=starIcon(true,award),numbers=document.createElement('span'),meter=document.createElement('span'),fill=document.createElement('span');
    numbers.textContent=`${count}/${total}`;meter.className='reaction-progress-meter';fill.className='reaction-progress-meter-fill';
    fill.style.width=`${total?100*count/total:0}%`;meter.append(fill);host.append(mark,numbers,meter);
  }
}
export function playReactionStarCeremony({host,tags=[],onSettled=()=>{},reducedMotion=false}={}){
  const entries=[...new Set(tags)].map(tag=>{
    const card=[...host.querySelectorAll('[data-reaction-group]')].find(node=>node.dataset.reactionGroup===tag);
    const stars=card?.querySelector('.reaction-book-group-count'),done=Number(stars?.dataset.done),total=Number(stars?.dataset.total);
    return card&&stars&&done>0?{card,stars,done,total}:null;
  }).filter(Boolean);
  for(const entry of entries)updateReactionStars(entry.stars,entry.done-1,entry.total);
  let cancelled=false,timer=null,index=0,ready=false;
  const resetCards=()=>{for(const entry of entries){updateReactionStars(entry.stars,entry.done,entry.total);entry.card.classList.remove('reaction-award-focus','reaction-award-earned');}};
  const finish=(status='presented')=>{
    if(cancelled)return;cancelled=true;if(timer!==null)clearTimeout(timer);
    resetCards();onSettled({status});
  };
  const show=()=>{
    if(cancelled||index>=entries.length)return;
    ready=false;
    for(const entry of entries)entry.card.classList.remove('reaction-award-focus','reaction-award-earned');
    const item=entries[index];
    item.card.scrollIntoView?.({block:'center',behavior:reducedMotion?'auto':'smooth'});
    item.card.classList.add('reaction-award-focus');
    timer=setTimeout(()=>{
      if(cancelled)return;
      updateReactionStars(item.stars,item.done,item.total,{award:true});
      const star=item.stars.querySelector('.reaction-progress-star.is-new');
      const burst=document.createElement('span');burst.className='reaction-award-burst';burst.setAttribute('aria-hidden','true');
      if(star){
        const a=star.getBoundingClientRect(),b=item.stars.getBoundingClientRect();
        burst.style.left=`${a.left-b.left+a.width/2}px`;burst.style.top=`${a.top-b.top+a.height/2}px`;
        item.stars.append(burst);
      }
      item.card.classList.add('reaction-award-earned');
      timer=setTimeout(()=>{
        if(cancelled)return;
        burst.remove();item.card.classList.remove('reaction-award-earned');
        ready=true;
      },reducedMotion?80:1350);
    },reducedMotion?60:700);
  };
  const advance=()=>{
    if(cancelled||!ready)return false;
    ready=false;index++;
    if(index>=entries.length)finish();
    else show();
    return true;
  };
  if(entries.length)show();else queueMicrotask(()=>finish());
  return {advance,cancel:()=>{cancelled=true;if(timer!==null)clearTimeout(timer);resetCards();}};
}

export function renderReactionBook({host,authority,progress,records,polymerRecords,onTry=()=>{},appendText=(node,value)=>{node.textContent=value;return node;}}){
  const make=(tag,text)=>{const el=document.createElement(tag);if(text)appendText(el,text);return el;};
  const button=(text,fn)=>{const el=make('button',text);el.type='button';el.addEventListener('click',fn);return el;};
  const name=id=>{const r=records.find(x=>x.id===id);return r?.commonNameJa??r?.nameJa??id;};
  const model=reactionGroups(authority,progress);
  const visualContext={records,polymerRecords};
  const scrollSurface=host.closest?.('dialog')??null;
  const currentScroll=()=>({list:host.scrollTop,dialog:scrollSurface?.scrollTop??0});
  const resetScroll=()=>{host.scrollTop=0;if(scrollSurface)scrollSurface.scrollTop=0;};
  const restoreScroll=position=>{host.scrollTop=position.list;if(scrollSurface)scrollSurface.scrollTop=position.dialog;};
  const educational=(tag,value)=>appendText(document.createElement(tag),value);
  let page='categories',returnToGroup=null,detailIndex=-1,verifiedItems=[];
  function showList(){
    page='categories';returnToGroup=null;detailIndex=-1;
    host.classList.remove('reaction-book-categories');
    const grid=make('div','');
    grid.className='reaction-book-category-grid';
    // Keep the core two-column layout even if an older PWA stylesheet is still in memory.
    grid.style.display='grid';
    // CSS owns responsive category widths; never force two columns inline.
    grid.style.gap='8px';
    grid.style.width='100%';
    // Progress is already shown in the tab; do not spend a mobile row repeating it.
    host.replaceChildren(grid);
    resetScroll();
    for(const group of model.groups){
      const done=group.items.filter(x=>x.state==='verified').length;
      const control=button('',()=>showGroup(group));
      control.className='reaction-book-group';
      const label=make('span','');label.className='reaction-book-group-label';
      const name=make('span',group.label);name.className='reaction-book-group-name';
      const count=make('span','');updateReactionStars(count,done,group.items.length);
      control.dataset.reactionGroup=group.id;
      label.append(name,count);
      control.append(label);
      const preview=createReactionGroupPreview(group.id);
      if(preview)control.append(preview);
      grid.append(control);
    }
  }
  function showGroup(group,{returnPosition=null}={}){
    page='group';returnToGroup=group;detailIndex=-1;
    verifiedItems=group.items.filter(x=>x.state==='verified');
    host.replaceChildren(button('‹ カテゴリ一覧',showList),make('h3',group.label));
    resetScroll();
    // Pending recipe actions belong to the top-level lightbulb, never the atlas.
    for(const item of verifiedItems){
      const d=item.definition,inputs=item.kind==='normal'?d.reactants.map(x=>name(x.species)):d.feedSpecies.map(name),outputs=item.kind==='normal'?d.products.map(name):[polymerRecords.find(x=>x.id===d.polymerId)?.nameJa??d.polymerId];
      const equation=`${inputs.join(' + ')} → ${outputs.join(' + ')}`;
      const conditions=item.kind==='normal'?d.requires:(d.environment?.requires??[]),forbidden=item.kind==='normal'?d.forbids:(d.environment?.forbids??[]);
      const conditionText=[...(conditions??[]).map(x=>CONDITION[x]??x),...(forbidden??[]).map(x=>LAB_FORBIDDEN_LABELS[x]??`${CONDITION[x]??x}を避ける`)].join('、')||'特別な条件なし';
      const block=make('section','');block.className='reaction-book-entry';
      block.append(make('strong',equation),make('p',`LABの条件：${conditionText}`));
      const thumb=createReactionThumbnailFromEntry(item,visualContext);
      if(thumb){
        block.prepend(thumb);
        const inspect=button('反応のしくみ',()=>showDetail(verifiedItems.indexOf(item),currentScroll()));
        inspect.className='reaction-book-inspect';
        block.append(inspect);
      }
      host.append(block);
    }
    const missing=group.items.filter(x=>x.state!=='verified'&&!x.unavailable).length, unavailable=group.items.filter(x=>x.state!=='verified'&&x.unavailable).length;
    host.append(make('p',`未実証 ${missing} 件${unavailable?` · 到達経路未整備 ${unavailable} 件`:''}`));
    if(returnPosition)restoreScroll(returnPosition);
  }
  function showDetail(index,groupPosition){
    if(index<0||index>=verifiedItems.length||!returnToGroup)return;
    const item=verifiedItems[index],group=returnToGroup,detail=reactionDetailInfo(item,visualContext);
    page='detail';detailIndex=index;
    const back=button('‹ '+group.label+'に戻る',()=>showGroup(group,{returnPosition:groupPosition}));
    back.className='book-back';
    const nav=make('nav','');nav.className='rb-detail-navigation';
    nav.append(back);
    for(const [label,delta] of [['‹',-1],['›',1]]){
      const prevNext=button(label,()=>showDetail(index+delta,groupPosition));
      prevNext.setAttribute('aria-label',delta<0?'前の項目':'次の項目');
      prevNext.setAttribute('aria-disabled',String(index+delta<0||index+delta>=verifiedItems.length));
      prevNext.disabled=index+delta<0||index+delta>=verifiedItems.length;
      prevNext.dataset.detailStep=String(delta);nav.append(prevNext);
    }
    const d=item.definition,outputs=item.kind==='normal'?d.products.map(name):[polymerRecords.find(x=>x.id===d.polymerId)?.nameJa??d.polymerId];
    host.replaceChildren(nav,educational('h3',outputs.join(' ＋ ')));
    const preview=createReactionThumbnailFromEntry(item,visualContext);
    if(preview){preview.classList.add('rb-detail-preview');host.append(preview);}
    if(detail){
      const summary=make('section','');summary.className='rb-detail-chemistry';
      summary.append(educational('h4','結合の変化'),educational('p',detail.bondChange),educational('h4','LABの条件'),educational('p',detail.conditionSummary));
      host.append(summary);
      const advanced=make('details','');advanced.className='rb-detail-advanced';
      advanced.append(educational('summary','化学式と詳しい説明'));
      const body=make('div','');body.className='rb-detail-advanced-body';
      body.append(educational('h4',detail.kind==='equation'?'原子数の合う反応式':'材料と構成単位の対応'));
      const expression=educational('p',`${detail.before} → ${detail.after}`);expression.className='rb-detail-formula';body.append(expression);
      if(detail.kind==='mapping')body.append(educational('p','この矢印は材料と構造の対応です。化学反応式や量の比を表しません。'));
      if(detail.byproductNote)body.append(educational('p',detail.byproductNote));
      body.append(educational('h4','LABの条件と役割'));
      for(const condition of detail.conditions)body.append(educational('p',condition));
      advanced.append(body);host.append(advanced);
    }
    host.append(button('LABでもう一度ためす',()=>onTry(item.reactionId)));
    resetScroll();
  }
  showList();
  return {
    handleGamepad(sample){
      const pressed=sample.pressed??[],held=sample.held??[],repeating=sample.repeat??[];
      if(page==='detail'&&(held[14]||held[15])){
        if(pressed.includes(14)||pressed.includes(15)){
          const delta=pressed.includes(14)?-1:1;
          if(detailIndex+delta>=0&&detailIndex+delta<verifiedItems.length)host.querySelector(`.rb-detail-navigation [data-detail-step="${delta}"]`)?.click();
        }
        return true;
      }
      if(pressed.includes(1)){
        if(page==='detail')host.querySelector('.rb-detail-navigation .book-back')?.click();
        else if(page==='group')showList();
        else return false;
        return true;
      }
      if(page==='detail'&&(held[12]||held[13])){
        if(pressed.includes(12)||pressed.includes(13)||repeating.includes(12)||repeating.includes(13)){
          (host.scrollHeight>host.clientHeight+2?host:scrollSurface)?.scrollBy?.({top:held[13]?140:-140,behavior:'auto'});
        }
        return true;
      }
      return false;
    }
  };
}
