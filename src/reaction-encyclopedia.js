import {createReactionGroupPreview,createReactionThumbnail,REACTION_THUMBNAIL_SPECS} from './reaction-book-visual.js';
// The registry owns reaction definitions; this module only groups and presents them.
const LABELS={oxidation:'酸化',combustion:'燃焼',esterification:'エステル化',halogenation:'ハロゲン化',condensation:'縮合',polymerization:'重合',hydrolysis:'加水分解',addition:'付加',hydration:'水和',substitution:'置換','ring-opening':'開環',cycloaddition:'環化',dehydration:'脱水',other:'その他'};
const CONDITION={acidic:'酸性',basic:'塩基性',heat:'加熱',light:'光'};
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
export function renderReactionBook({host,authority,progress,records,polymerRecords,onTry=()=>{}}){
  const make=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
  const button=(text,fn)=>{const el=make('button',text);el.type='button';el.addEventListener('click',fn);return el;};
  const name=id=>{const r=records.find(x=>x.id===id);return r?.commonNameJa??r?.nameJa??id;};
  const model=reactionGroups(authority,progress);
  const title=make('h3',`実証 ${model.verified} / ${model.entries.length} 経路`);
  const note=make('p','件数はこの図鑑に収録された経路です。実験での到達方法が未確認のものも含みます。');
  function showList(){
    host.replaceChildren(title,note);
    for(const group of model.groups){
      const done=group.items.filter(x=>x.state==='verified').length;
      const control=button(`${group.label}　実証 ${done} / ${group.items.length}`,()=>showGroup(group));
      control.className='reaction-book-group';
      const preview=createReactionGroupPreview(group.id);
      if(preview)control.append(preview);
      host.append(control);
    }
  }
  function showGroup(group){
    host.replaceChildren(button('‹ カテゴリ一覧',showList),make('h3',group.label));
    for(const item of group.items.filter(x=>x.state!=='notFound')){
      const d=item.definition,inputs=item.kind==='normal'?d.reactants.map(x=>name(x.species)):d.feedSpecies.map(name),outputs=item.kind==='normal'?d.products.map(name):[polymerRecords.find(x=>x.id===d.polymerId)?.nameJa??d.polymerId];
      const equation=`${inputs.join(' + ')} → ${outputs.join(' + ')}`;
      if(item.state==='hinted'){
        const hint=button(`✦ ひらめいたレシピ · 未実証：${outputs.join(' + ')}`,()=>{
          host.replaceChildren(button('‹ 戻る',()=>showGroup(group)),make('h3','✦ ひらめいたレシピ'),make('p',equation));
          const detailPreview=createReactionThumbnail(item.reactionId);
          if(detailPreview)host.append(detailPreview);
          host.append(make('p','手掛かりを獲得しました。まだLABで実証していません。'),button('LABでためす',()=>onTry(item.reactionId)));
        });
        hint.className='reaction-book-hint';
        const thumb=createReactionThumbnail(item.reactionId);
        if(thumb)hint.append(thumb);
        host.append(hint);continue;
      }
      const conditions=item.kind==='normal'?d.requires:(d.environment?.requires??[]),forbidden=item.kind==='normal'?d.forbids:(d.environment?.forbids??[]);
      const conditionText=[...(conditions??[]).map(x=>CONDITION[x]??x),...(forbidden??[]).map(x=>`${CONDITION[x]??x}は不可`)].join('、')||'特別な条件なし';
      const block=make('section','');block.className='reaction-book-entry';
      block.append(make('strong',equation),make('p',`LABの条件：${conditionText}`));
      const thumb=createReactionThumbnail(item.reactionId);
      if(thumb){
        block.prepend(thumb);
        const inspect=button('結合の変化をみる',()=>{
          host.replaceChildren(button('‹ 戻る',()=>showGroup(group)),make('h3',outputs.join(' + ')),make('p',equation));
          host.append(createReactionThumbnail(item.reactionId),make('p',`LABの条件：${conditionText}`),make('p',REACTION_THUMBNAIL_SPECS[item.reactionId].feature));
        });
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
