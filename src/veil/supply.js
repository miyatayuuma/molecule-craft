import { DRIVES, MOLECULE_USES, REGIONS, driveAvailable, growthGoal, propulsionGauge } from './growth.js';

const DRIVE_SECONDS=DRIVES.combustion.packetSeconds;
const ANIMATION_MS=620;

export function compressedAtoms(cost={},limit=12){
  const entries=Object.entries(cost).filter(([,amount])=>Number.isSafeInteger(amount)&&amount>0);
  const total=entries.reduce((sum,[,amount])=>sum+amount,0);
  if(!total)return [];
  if(total<=limit)return entries.flatMap(([element,amount])=>Array(amount).fill(element));
  const count=Math.max(entries.length,limit),remaining=count-entries.length,weighted=entries.map(([element,amount],index)=>{
    const exact=amount/total*remaining;
    return {element,index,amount:1+Math.floor(exact),fraction:exact-Math.floor(exact)};
  });
  let assigned=weighted.reduce((sum,item)=>sum+item.amount,0);
  for(const item of [...weighted].sort((a,b)=>b.fraction-a.fraction||a.index-b.index)){if(assigned>=count)break;item.amount++;assigned++;}
  return weighted.flatMap(item=>Array(item.amount).fill(item.element)).slice(0,count);
}

export function createSupplyUI({resources,canOpen,canMake,onCommit,onAnchor}){
  const q=id=>document.getElementById(id),dialog=q('supply-dialog');
  let choice='hydrogen',quantity=1,optionsKey='',anchorsKey='',announcement='',productionBusy=false,animationTimer=null;
  const name=record=>record?.commonNameJa??record?.nameJa??record?.name??'';
  const formula=record=>MOLECULE_USES[record?.id]?.formula??record?.formula??'';

  function select(id){if(resources.record(id)){choice=id;quantity=1;q('molecule-select').value=id;}update();}
  function maximum(){return resources.maxCraftable(choice);}
  function setQuantity(next){quantity=Math.max(1,Math.min(Math.max(1,maximum()),Math.floor(Number(next)||1)));update();}
  function costText(cost){
    if(!cost)return '';
    return Object.entries(cost).map(([element,amount])=>{
      const before=resources.state.elements[element];
      return `${element} × ${amount}${Number.isSafeInteger(before)?` (${before} → ${Math.max(0,before-amount)})`:''}`;
    }).join(' · ');
  }
  function animateProduction(record,count,cost){
    const stage=q('synthesis-stage'),source=q('synthesis-atoms');source.replaceChildren();
    for(const [index,element] of compressedAtoms(cost).entries()){
      const atom=document.createElement('i');atom.textContent=element;atom.dataset.element=element;atom.style.setProperty('--atom-index',index);atom.style.setProperty('--atom-row',(index%5)-2);source.append(atom);
    }
    q('synthesis-formula').textContent=formula(record);q('synthesis-count').textContent=`× ${count}`;
    stage.hidden=false;stage.classList.remove('is-running');void stage.offsetWidth;stage.classList.add('is-running');
    if(animationTimer!==null)window.clearTimeout(animationTimer);
    animationTimer=window.setTimeout(()=>{stage.classList.remove('is-running');stage.hidden=true;productionBusy=false;animationTimer=null;update();},ANIMATION_MS);
  }
  function produce(){
    if(productionBusy||resources.blocked||!canMake()||!resources.state.recipes.includes(choice))return false;
    const max=maximum(),count=Math.min(quantity,max),record=resources.record(choice),cost=resources.costFor(choice,count);
    if(!record||count<1||!cost)return false;
    productionBusy=true;update();
    const committed=onCommit()!==false,made=committed&&resources.produceMolecule(choice,count);
    if(!made){productionBusy=false;update();return false;}
    announcement=`${formula(record)} ×${count} を分子ストックへ保管`;
    animateProduction(record,count,cost);update();return true;
  }
  function fillTank(id){
    if(productionBusy||resources.blocked||!canMake()||onCommit()===false)return false;
    const filled=resources.fillTank(id);if(filled)announcement=id==='hydrogen'?'H₂ BURSTタンクを満タンに補給':'COMBUSTIONタンクを満タンに補給';update();return filled;
  }
  function produceShortage(id,count){select(id);setQuantity(count);q('recipe-name').scrollIntoView?.({block:'nearest'});}
  function renderTanks(state){
    const unlocked=state.recipes.includes('hydrogen'),systems=q('supply-systems');systems.hidden=!unlocked;if(!unlocked)return;
    const hydrogen=resources.tankPlan('hydrogen'),hItem=hydrogen.items[0],hGauge=propulsionGauge('hydrogen',state.tanks);
    q('supply-h2-current').textContent=hItem.current;q('supply-h2-capacity').textContent=hItem.capacity;q('supply-h2-meter').style.transform=`scaleX(${hGauge.ratio})`;
    q('supply-h2-detail').textContent=hydrogen.full?`BASE STOCK H₂ ×${hItem.stock} · 満タン`:`BASE STOCK H₂ ×${hItem.stock} · 補給可能 ${hItem.transferable} / 必要 ${hItem.need}${hItem.shortage?` · 不足 H₂ ×${hItem.shortage}`:''}`;
    q('fill-hydrogen').disabled=productionBusy||!hydrogen.canFill;q('fill-hydrogen').textContent=hydrogen.full?'満タン':`満タンまで補給 · H₂ ×${hItem.need}`;
    const craftHydrogen=q('craft-hydrogen-shortage');craftHydrogen.hidden=!hItem.shortage;craftHydrogen.textContent=`不足分を作る · H₂ ×${hItem.shortage}`;

    const combustionUnlocked=driveAvailable(state,'combustion'),combustionNode=q('supply-systems').querySelector('[data-tank="combustion"]');combustionNode.hidden=!combustionUnlocked;
    if(combustionUnlocked){
      const plan=resources.tankPlan('combustion'),methane=plan.items.find(item=>item.id==='methane'),oxygen=plan.items.find(item=>item.id==='oxygen'),gauge=propulsionGauge('combustion',state.tanks);
      q('supply-combustion-packets').textContent=gauge.remaining;q('supply-combustion-capacity').textContent=gauge.capacity;q('supply-combustion-meter').style.transform=`scaleX(${gauge.ratio})`;
      const missing=[methane.shortage?`CH₄ ×${methane.shortage}`:'',oxygen.shortage?`O₂ ×${oxygen.shortage}`:''].filter(Boolean).join(' / ');
      q('supply-combustion-detail').textContent=`搭載 CH₄ ${methane.current}/${methane.capacity} · O₂ ${oxygen.current}/${oxygen.capacity} · ${Math.ceil(gauge.seconds)}秒分\nBASE STOCK CH₄ ×${methane.stock} · O₂ ×${oxygen.stock}${missing?` · 不足 ${missing}`:plan.full?' · 満タン':' · 満タン分を補給可能'}`;
      q('fill-combustion').disabled=productionBusy||!plan.canFill;q('fill-combustion').textContent=plan.full?'満タン':`満タンまで補給 · CH₄ ×${methane.need} / O₂ ×${oxygen.need}`;
      const craftMethane=q('craft-methane-shortage'),craftOxygen=q('craft-oxygen-shortage');craftMethane.hidden=!methane.shortage;craftOxygen.hidden=!oxygen.shortage;craftMethane.textContent=`不足分を作る · CH₄ ×${methane.shortage}`;craftOxygen.textContent=`不足分を作る · O₂ ×${oxygen.shortage}`;
    }
    q('supply-propulsion-note').textContent=`推進剤はBASE STOCKとは別に採集殻へ搭載します。COMBUSTIONは${DRIVE_SECONDS}秒ごとにCH₄ ×1とO₂ ×2を消費。通常航行はタンクが空でも使えます。`;
  }

  function update(){
    const state=resources.state;
    for(const element of ['H','C','O']){
      q(`resource-${element.toLowerCase()}`).textContent=state.elements[element];
      if(element!=='H')q(`stock-${element.toLowerCase()}`).hidden=!resources.canUseElement(element);
    }
    for(const [id,key] of [['hydrogen','h2'],['methane','ch4'],['oxygen','o2'],['water','water']])q(`resource-${key}`).textContent=state.molecules[id]??0;
    renderTanks(state);
    q('craft-resource-hint').textContent=announcement||growthGoal(state).text;q('supply-goal').textContent=growthGoal(state).text;

    const available=[...new Set([...state.hints,...state.recipes])].filter(id=>resources.record(id)),key=available.join('|')+';'+state.recipes.join('|');
    if(key!==optionsKey){
      optionsKey=key;const list=q('molecule-select');list.replaceChildren();
      if(!available.length){const option=document.createElement('option');option.value='';option.textContent='採集すると、構造のヒントが届く';list.append(option);}
      for(const id of available){const record=resources.record(id),option=document.createElement('option');option.value=id;option.textContent=`${formula(record)} · ${name(record)}${state.recipes.includes(id)?' — 量産可':' — 構造ヒント'}`;list.append(option);}
      if(!available.includes(choice)){choice=available[0]??'';quantity=1;}list.value=choice;
    }

    const record=resources.record(choice),complete=state.recipes.includes(choice),unitCost=resources.costFor(choice),max=complete?maximum():0;
    if(max>0)quantity=Math.min(quantity,max);else quantity=1;
    const cost=complete?resources.costFor(choice,quantity):unitCost,affordable=complete&&max>0&&resources.canAfford(cost);
    q('recipe-name').textContent=record?`${formula(record)} · ${name(record)}`:'まずHを集めよう';
    q('recipe-hint').textContent=record?(MOLECULE_USES[choice]?.hint??'模型と下の結合情報を手がかりに、自分で組み立てよう。'):'';
    q('recipe-model').hidden=!record?.bonds;
    if(record?.bonds){const path=`./assets/models/molecule-${choice}.svg`;if(q('recipe-model').getAttribute('src')!==path)q('recipe-model').src=path;q('recipe-bonds').textContent=record.bonds.map(([a,b,n])=>`${record.atoms[a]}${a+1} ${n===1?'—':n===2?'＝':'≡'} ${record.atoms[b]}${b+1}`).join(' / ');}
    q('recipe-connections').hidden=!record?.bonds;
    q('molecule-use').textContent=MOLECULE_USES[choice]?.use??(record?'図鑑に記録できる分子。今回の探索用の特殊作用はありません。':'');
    q('molecule-stock').textContent=complete?`分子ストック ${formula(record)} × ${state.molecules[choice]??0}`:'初めての1個は、自分で組み立てる';
    q('production-controls').hidden=!complete;q('production-shortcuts').hidden=!complete;q('production-quantity').value=quantity;q('production-max-value').textContent=`MAX ${max}`;
    q('production-minus').disabled=productionBusy||quantity<=1;q('production-plus').disabled=productionBusy||max<1||quantity>=max;
    for(const id of ['production-add-5','production-add-10','production-max'])q(id).disabled=productionBusy||max<1||quantity>=max;
    q('molecule-cost').textContent=complete?`消費 · ${costText(cost)}${affordable?'':' · 元素が不足'}`:'初回発見は制作フィールドで原子を組み立てます。';
    q('molecule-cost').dataset.affordable=String(affordable);q('make-h2').hidden=!complete;q('make-h2').disabled=productionBusy||resources.blocked||!affordable;q('make-h2').textContent=productionBusy?'合成中…':`${formula(record)} × ${quantity} を一括生成`;

    const anchors=state.progress.regions.join('|');
    if(anchors!==anchorsKey){anchorsKey=anchors;const list=q('expedition-anchor'),selected=list.value;list.replaceChildren();for(const [id,text] of [['continue','探索の続き'],...state.progress.regions.map(id=>[id,`${REGIONS[id].name}へ補給`])]){const option=document.createElement('option');option.value=id;option.textContent=text;list.append(option);}list.value=selected||'continue';}
  }

  q('open-supply').addEventListener('click',()=>{if(!canOpen())return;announcement='';update();dialog.showModal();});
  q('molecule-select').addEventListener('change',()=>{choice=q('molecule-select').value;quantity=1;update();});
  q('expedition-anchor').addEventListener('change',()=>onAnchor(q('expedition-anchor').value));
  q('production-minus').addEventListener('click',()=>setQuantity(quantity-1));q('production-plus').addEventListener('click',()=>setQuantity(quantity+1));
  q('production-add-5').addEventListener('click',()=>setQuantity(quantity+5));q('production-add-10').addEventListener('click',()=>setQuantity(quantity+10));q('production-max').addEventListener('click',()=>setQuantity(maximum()));
  q('make-h2').addEventListener('click',produce);
  q('fill-hydrogen').addEventListener('click',()=>fillTank('hydrogen'));q('fill-combustion').addEventListener('click',()=>fillTank('combustion'));
  q('craft-hydrogen-shortage').addEventListener('click',()=>produceShortage('hydrogen',resources.tankPlan('hydrogen').shortage.hydrogen));q('craft-methane-shortage').addEventListener('click',()=>produceShortage('methane',resources.tankPlan('combustion').shortage.methane));q('craft-oxygen-shortage').addEventListener('click',()=>produceShortage('oxygen',resources.tankPlan('combustion').shortage.oxygen));
  update();
  return {update,select,discovered(id){choice=id;quantity=1;announcement=MOLECULE_USES[id]?.discovery??'';update();},clearAnnouncement(){announcement='';},get open(){return dialog.open;},get producing(){return productionBusy;}};
}
