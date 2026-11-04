import {createReactionGroupPreview,createReactionThumbnailFromEntry,reactionThumbnailModel,REACTION_THUMBNAIL_SPECS} from './reaction-book-visual.js';
// The registry owns reaction definitions; this module only groups and presents them.
const LABELS={oxidation:'酸化',combustion:'燃焼',esterification:'エステル化',halogenation:'ハロゲン化',condensation:'縮合',polymerization:'重合',hydrolysis:'加水分解',addition:'付加',hydration:'水和',substitution:'置換','ring-opening':'開環',cycloaddition:'環化',dehydration:'脱水',other:'その他'};
const CONDITION={acidic:'酸性',basic:'塩基性',heat:'加熱',light:'光'};

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
export function reactionDetailInfo(entry,{records=[],polymerRecords=[]}={}){
 if(!entry?.definition)return null;
 const d=entry.definition,isPolymer=entry.kind==='polymer',molecules=new Map(records.map(r=>[r.id,r]));
 const formulas=ids=>{
   const counts=new Map();
   for(const id of ids)counts.set(id,(counts.get(id)??0)+1);
   return [...counts].map(([id,n])=>(n>1?n+' ':'')+(molecules.get(id)?.formula??molecules.get(id)?.nameJa??id)).join(' ＋ ');
 };
 const feeds=isPolymer?d.feedSpecies:d.reactants.map(x=>x.species);
 const product=polymerRecords.find(x=>x.id===d.polymerId),repeat=isPolymer?(product?.repeatUnit??null):null;
 const water=isPolymer&&(d.transformFamilies??[]).some(x=>['ester-condensation','amide-condensation','phenol-methylene-bridge'].includes(x));
 const requires=isPolymer?(d.environment?.requires??[]):(d.requires??[]);
 const forbids=isPolymer?(d.environment?.forbids??[]):(d.forbids??[]);
 const conditions=[
   ...requires.map(x=>CONDITION_ROLES[x]??(CONDITION[x]??x)+'：この経路で必要な条件です。'),
   ...(d.processSetupTokens??[]).map(x=>PROCESS_ROLES[x]??'工程設定：'+x),
   ...forbids.map(x=>(CONDITION[x]??x)+'：このLAB経路では避ける条件です。')
 ];
 return {
   before:formulas(feeds),
   after:(isPolymer?(repeat?'［'+repeat+'］ₙ':'構成単位が連なる高分子（模型で確認）'):formulas(d.products))+(water?' ＋ H₂O（縮合時の副生成物）':''),
   bondChange:reactionThumbnailModel(entry,{records,polymerRecords})?.feature??'反応前後の結合を比べましょう。',
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

export function renderReactionBook({host,authority,progress,records,polymerRecords,onTry=()=>{}}){
  const make=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
  const button=(text,fn)=>{const el=make('button',text);el.type='button';el.addEventListener('click',fn);return el;};
  const name=id=>{const r=records.find(x=>x.id===id);return r?.commonNameJa??r?.nameJa??id;};
  const model=reactionGroups(authority,progress);
  const visualContext={records,polymerRecords};
  const title=make('h3',`${model.verified} / ${model.entries.length} 経路`);
  const note=make('p','件数はこの図鑑に収録された経路です。実験での到達方法が未確認のものも含みます。');
  function showList(){
    host.classList.remove('reaction-book-categories');
    const grid=make('div','');
    grid.className='reaction-book-category-grid';
    // Keep the core two-column layout even if an older PWA stylesheet is still in memory.
    grid.style.display='grid';
    // CSS owns responsive category widths; never force two columns inline.
    grid.style.gap='8px';
    grid.style.width='100%';
    host.replaceChildren(title,note,grid);
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
  function showGroup(group){
    host.replaceChildren(button('‹ カテゴリ一覧',showList),make('h3',group.label));
    for(const item of group.items.filter(x=>x.state!=='notFound')){
      const d=item.definition,inputs=item.kind==='normal'?d.reactants.map(x=>name(x.species)):d.feedSpecies.map(name),outputs=item.kind==='normal'?d.products.map(name):[polymerRecords.find(x=>x.id===d.polymerId)?.nameJa??d.polymerId];
      const equation=`${inputs.join(' + ')} → ${outputs.join(' + ')}`;
      const conditions=item.kind==='normal'?d.requires:(d.environment?.requires??[]),forbidden=item.kind==='normal'?d.forbids:(d.environment?.forbids??[]);
      const conditionText=[...(conditions??[]).map(x=>CONDITION[x]??x),...(forbidden??[]).map(x=>`${CONDITION[x]??x}は不可`)].join('、')||'特別な条件なし';
      function showDetail(){
        host.replaceChildren(button('‹ '+group.label+'に戻る',()=>showGroup(group)),make('h3',outputs.join(' + ')),make('p',equation));
        const detail=reactionDetailInfo(item,visualContext), formula=REACTION_THUMBNAIL_SPECS[item.reactionId];
        if(detail){
          const chemistry=make('section','');chemistry.className='rb-detail-chemistry';
          chemistry.append(make('h4','分子式・構成単位'));
          const expression=make('p',`${detail.before} → ${detail.after}`);expression.className='rb-detail-formula';chemistry.append(expression);
          if(formula){
            chemistry.append(make('h4','結合の表し方'));
            chemistry.append(make('p',`${formula.before} → ${formula.after}`));
          }
          chemistry.append(make('h4','結合の変化'),make('p',detail.bondChange));
          chemistry.append(make('h4','LABの条件と役割'));
          for(const condition of detail.conditions)chemistry.append(make('p',condition));
          host.append(chemistry);
        }
        if(item.state==='hinted')host.append(make('p','手掛かりを獲得しました。まだLABで実証していません。反応を確かめるにはLABで実験してください。'));
        else host.append(make('p','LABで実証した反応です。模型は生成物の構造を示し、反応の途中を再現した映像ではありません。'));
        host.append(button(item.state==='hinted'?'LABでためす':'LABでもう一度ためす',()=>onTry(item.reactionId)));
      }
      if(item.state==='hinted'){
        const hint=button(`✦ ひらめいたレシピ · 未実証：${outputs.join(' + ')}`,showDetail);
        hint.className='reaction-book-hint';
        const thumb=createReactionThumbnailFromEntry(item,visualContext);
        if(thumb)hint.append(thumb);
        host.append(hint);continue;
      }
      const block=make('section','');block.className='reaction-book-entry';
      block.append(make('strong',equation),make('p',`LABの条件：${conditionText}`));
      const thumb=createReactionThumbnailFromEntry(item,visualContext);
      if(thumb){
        block.prepend(thumb);
        const inspect=button('反応のしくみ',showDetail);
        inspect.className='reaction-book-inspect';
        block.append(inspect);
      }
      host.append(block);
    }
    const missing=group.items.filter(x=>x.state==='notFound'&&!x.unavailable).length, unavailable=group.items.filter(x=>x.state==='notFound'&&x.unavailable).length;
    host.append(make('p',`未発見 ${missing} 件${unavailable?` · 到達経路未整備 ${unavailable} 件`:''}`));
  }
  showList();
}
