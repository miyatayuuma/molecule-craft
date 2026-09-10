import {ELEMENTS,UNKNOWN_NAME,countElements} from './chemistry.js?v=20';
import {preferredValence} from './bonding-model.js?v=31';
import {createPubchemIntroState,pubchemReferenceFor} from './pubchem-reference.js';

export function craftTargetSlots(record,placedAtoms=[]){
  if(!record?.atoms)return[];
  const needed=countElements(record.atoms),placed=countElements(placedAtoms),slots=[];
  for(const [symbol,total]of Object.entries(needed).sort(([a],[b])=>a.localeCompare(b)))for(let index=0;index<total;index++)slots.push({symbol,index,filled:index<(placed[symbol]??0)});
  return slots;
}

function targetLabelColor(color){
  const value=String(color??'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(value))return'#f8fafc';
  const r=parseInt(value.slice(0,2),16),g=parseInt(value.slice(2,4),16),b=parseInt(value.slice(4,6),16);return .299*r+.587*g+.114*b>168?'#07131f':'#f8fafc';
}

function styleTargetAtom(node,symbol,filled,size=31){
  const color=ELEMENTS[symbol]?.color??'#94a3b8',base=filled?color:`color-mix(in srgb,${color} 26%,#344451)`,highlight=filled?`color-mix(in srgb,#fff 48%,${color})`:`color-mix(in srgb,#fff 18%,${color})`,edge=filled?`color-mix(in srgb,${color} 72%,#d8f3f5)`:`color-mix(in srgb,${color} 28%,#60717d)`,text=filled?targetLabelColor(color):'#eef5f8';
  node.style.cssText=`display:inline-grid;place-items:center;flex:0 0 ${size}px;width:${size}px;height:${size}px;border:1px solid ${edge};border-radius:50%;background:radial-gradient(circle at 34% 28%,${highlight} 0 10%,${base} 48%,color-mix(in srgb,${base} 66%,#07131f) 100%);box-shadow:${filled?'inset -3px -4px 7px #07131f55,0 2px 7px #0005':'inset -2px -3px 6px #07131f66,0 1px 4px #0003'};color:${text};font-size:${size<=27?10:12}px;font-weight:800;line-height:1;text-shadow:${text==='#07131f'?'0 1px 1px #fff6':'0 1px 2px #000'};user-select:none;transition:transform .18s ease,filter .18s ease,opacity .18s ease;${filled?'':'filter:saturate(.46) brightness(.86);'}`;
}

function partCompositionFormula(template){
  const atoms=template?.atoms??[],counts=countElements(atoms),order=[];for(const symbol of atoms)if(!order.includes(symbol))order.push(symbol);
  return order.map(symbol=>`${symbol}${counts[symbol]>1?counts[symbol]:''}`).join('');
}
export function compactPartNotation(template){
  const raw=String(template?.notation??template?.label??template?.id??'').trim();if([...raw].length<=10)return raw;
  const leading=raw.match(/^[–—-]/)?.[0]??(template?.attachments?.length?'–':''),trailing=raw.match(/[–—-]$/)?.[0]??(template?.attachments?.length>1?'–':'');
  const formula=partCompositionFormula(template);return formula?`${leading}${formula}${trailing}`:raw;
}

export function renderCraftTargetAtoms(container,record,placedAtoms=[],{size=31}={}){
  if(!container)return[];container.replaceChildren();const rendered=[];
  for(const slot of craftTargetSlots(record,placedAtoms)){const chip=container.ownerDocument.createElement('span');chip.className='craft-target-atom';chip.dataset.element=slot.symbol;chip.dataset.filled=String(slot.filled);chip.textContent=slot.symbol;chip.setAttribute('aria-label',`${ELEMENTS[slot.symbol]?.name??slot.symbol} ${slot.filled?'配置済み':'未配置'}`);styleTargetAtom(chip,slot.symbol,slot.filled,size);container.appendChild(chip);rendered.push({slot,node:chip});}
  return rendered;
}

export function renderCraftTargetParts(container,parts=[],placedAtoms=[],{size=31,onPlace=()=>{}}={}){
  if(!container)return[];container.replaceChildren();const rendered=[],used={};
  for(const item of parts){
    if(item.partId){
      const template=item.template,chip=container.ownerDocument.createElement('button'),model=container.ownerDocument.createElement('img'),formula=container.ownerDocument.createElement('strong');
      chip.type='button';chip.className='craft-target-part';chip.dataset.partId=item.partId;
      model.className='craft-target-part-model';model.alt='';model.src=new URL(`../assets/models/part-${item.partId}.svg`,import.meta.url).href;model.addEventListener('error',()=>{model.hidden=true;},{once:true});
      const notation=compactPartNotation(template)||item.partId;formula.className='craft-target-part-formula';formula.textContent=notation;formula.dataset.long=String([...notation].length>8);
      chip.setAttribute('aria-label',`${template?.nameJa??notation}をクラフト台へ出す`);chip.append(model,formula);chip.addEventListener('click',()=>onPlace(item));container.appendChild(chip);rendered.push({item,node:chip,slot:null});continue;
    }
    const symbol=item.element,index=used[symbol]??0;used[symbol]=index+1;const slot={symbol,index,filled:false},chip=container.ownerDocument.createElement('button');chip.type='button';chip.className='craft-target-atom';chip.dataset.element=symbol;chip.dataset.filled=String(slot.filled);chip.textContent=symbol;chip.setAttribute('aria-label',`${ELEMENTS[symbol]?.name??symbol}をクラフト台へ出す`);styleTargetAtom(chip,symbol,slot.filled,size);chip.style.minHeight=`${size}px`;chip.style.padding='0';chip.addEventListener('click',()=>onPlace(item));container.appendChild(chip);rendered.push({item,node:chip,slot});
  }
  return rendered;
}

export function createCraftPanel(document){

  const nodes={
    status:document.querySelector('#status'),formula:document.querySelector('#formula'),name:document.querySelector('#molecule-name'),iupac:document.querySelector('#molecule-iupac'),counts:document.querySelector('#atom-counts'),
    selectedElement:document.querySelector('#selected-element'),selectedValence:document.querySelector('#selected-valence'),selectedLimit:document.querySelector('#selected-limit'),selectionChip:document.querySelector('#selection-chip'),
    discovery:document.querySelector('#discovery'),discoveryFormula:document.querySelector('#discovery-formula'),discoveryName:document.querySelector('#discovery-name'),
    structureList:document.querySelector('#structure-list'),structureCount:document.querySelector('#structure-count'),structureFocus:document.querySelector('#structure-focus'),
    tankActions:document.querySelector('#craft-tank-actions'),chargeStage:document.querySelector('#tank-charge-stage'),target:document.querySelector('#craft-target'),targetName:document.querySelector('#craft-target-name'),targetFormula:document.querySelector('#craft-target-formula'),targetAtoms:document.querySelector('#craft-target-atoms'),
  };
  const pubchemLink=document.createElement('a');pubchemLink.className='pubchem-link';pubchemLink.textContent='↗';pubchemLink.target='_blank';pubchemLink.rel='noopener noreferrer external';pubchemLink.hidden=true;pubchemLink.setAttribute('aria-label','PubChemでこの分子を調べる');nodes.pubchem=pubchemLink;
  let pubchemStorage=null;try{pubchemStorage=document.defaultView?.localStorage??null;}catch{}const pubchemIntro=createPubchemIntroState(pubchemStorage);
  let tankActionKey='',tankControls=[],clearTarget=()=>{},lastTargetKey='',lastTargetFilled={};
  document.querySelector('#clear-craft-target')?.addEventListener('click',()=>clearTarget());

  function identity(structure){
    if(!structure)return{record:null,primary:'自由制作',iupac:'',formula:'—'};
    const record=structure.record;
    return record?{record,primary:record.commonNameJa??record.nameJa,iupac:record.iupacNameEn??record.nameEn,formula:record.formula??structure.formula}:{record:null,primary:UNKNOWN_NAME,iupac:'',formula:structure.formula};
  }

  function renderStructureList({structures,focused,disabled,onSelect}){
    const focusLabel=document.querySelector('#structure-focus-label');if(focusLabel)focusLabel.hidden=structures.length<2;
    nodes.structureFocus.disabled=disabled;nodes.structureFocus.replaceChildren();
    nodes.structureCount.textContent=`完成 ${structures.filter(item=>item.complete).length} / 構造 ${structures.length}`;nodes.structureList.replaceChildren();
    for(const [index,item] of structures.entries()){
      const itemIdentity=identity(item),button=document.createElement('button');button.type='button';button.className='structure-item';button.setAttribute('aria-pressed',String(item===focused));
      button.textContent=`${item===focused?'編集中 · ':''}${index+1}. ${item.complete?'完成':'制作中'} · ${itemIdentity.formula}${item.record?` · ${itemIdentity.primary}`:''}`;button.addEventListener('click',()=>onSelect(item));nodes.structureList.appendChild(button);
      const option=document.createElement('option');option.value=item.key;option.textContent=`${index+1}. ${item.record?itemIdentity.primary+' · ':''}${itemIdentity.formula}`;option.selected=item===focused;nodes.structureFocus.appendChild(option);
    }
  }

  function renderTankActions(){
    if(tankActionKey){tankActionKey='';for(const control of tankControls)control.cancel?.();tankControls=[];}nodes.tankActions.replaceChildren();nodes.tankActions.hidden=true;
  }


function renderTarget(record,placedAtoms,onClearTarget,{discovered=false,targetParts=null,onPlaceTargetPart=()=>{}}={}){
  clearTarget=onClearTarget??(()=>{});nodes.target.hidden=!record;if(!record){nodes.targetName.hidden=true;lastTargetKey='';lastTargetFilled={};return;}
  const displayName=record.commonNameJa??record.nameJa??record.name??'',idea=!discovered;nodes.targetName.textContent=discovered?displayName:'';nodes.targetName.hidden=!discovered;nodes.targetFormula.textContent=`${idea?'💡 ':''}${record.formula??''}`;nodes.target.setAttribute('aria-label',`${idea?'ひらめいた ':''}${record.formula??'分子'}${discovered&&displayName?` ${displayName}`:''} 制作目標`);
  const rendered=targetParts!==null?renderCraftTargetParts(nodes.targetAtoms,targetParts,placedAtoms,{size:31,onPlace:onPlaceTargetPart}):renderCraftTargetAtoms(nodes.targetAtoms,record,placedAtoms,{size:31}),key=record.id??record.formula??record.name??'target',sameTarget=key===lastTargetKey,filledNow={};
  for(const {slot,node:chip}of rendered){if(!slot)continue;if(slot.filled)filledNow[slot.symbol]=(filledNow[slot.symbol]??0)+1;if(sameTarget&&slot.filled&&slot.index>=(lastTargetFilled[slot.symbol]??0)&&typeof chip.animate==='function')chip.animate([{transform:'scale(.82)'},{transform:'scale(1.09)'},{transform:'scale(1)'}],{duration:220,easing:'ease-out'});}
  lastTargetKey=key;lastTargetFilled=filledNow;
}

function renderInfo({keep,veilUI,focus,structures,selected,molecule,target,targetParts=null,onPlaceTargetPart,targetDiscovered=false,onClearTarget,unresolvedAtoms,stateFor,structureListDisabled,onSelectStructure}){
    veilUI?.updateCraft();const itemIdentity=identity(focus),idea=!!target&&!targetDiscovered;nodes.formula.textContent=itemIdentity.formula;nodes.formula.append(nodes.pubchem);nodes.name.textContent=`${idea?'💡 ':''}${itemIdentity.primary}`;nodes.iupac.textContent=itemIdentity.iupac?`IUPAC: ${itemIdentity.iupac}`:'';const reference=focus?.complete&&!focus.record?pubchemReferenceFor(focus):null;nodes.pubchem.hidden=!reference;nodes.pubchem.textContent=pubchemIntro.label(reference?focus.signature:null);if(reference){nodes.pubchem.href=reference.url;nodes.pubchem.dataset.searchMode=reference.mode;}else{nodes.pubchem.removeAttribute('href');delete nodes.pubchem.dataset.searchMode;}
    renderTarget(target,molecule.atoms,onClearTarget,{discovered:targetDiscovered,targetParts,onPlaceTargetPart});
    renderTankActions(focus,veilUI);
    const validation=focus?.validation??molecule.validation();nodes.status.className=`status ${validation.level}`;nodes.status.textContent=focus&&[...focus.ids].some(id=>unresolvedAtoms.has(id))?'配置未解決 · 結合は保持しています':focus?.complete?(focus.record?'結合がそろいました':'未登録 · 結合ルールOK'):validation.message;
    nodes.counts.replaceChildren();const atoms=focus?.graph.atoms??[],counts=countElements(atoms);if(!atoms.length)nodes.counts.textContent='—';else for(const symbol of Object.keys(counts).sort()){const chip=document.createElement('span');chip.className='atom-count';chip.textContent=`${symbol} × ${counts[symbol]}`;nodes.counts.appendChild(chip);}
    renderStructureList({structures,focused:focus,disabled:structureListDisabled,onSelect:onSelectStructure});
    document.querySelector('#selection-actions').hidden=!selected;if(!selected){nodes.selectedElement.textContent=nodes.selectedValence.textContent=nodes.selectedLimit.textContent='—';if(!keep)nodes.selectionChip.textContent='';return;}
    const used=molecule.bondOrderForAtom(selected.id),state=stateFor(selected.id);nodes.selectedElement.textContent=`${selected.element} / ${ELEMENTS[selected.element].name}`;nodes.selectedValence.textContent=`${used} / ${state.charge?used:preferredValence(selected.element,used)}`;nodes.selectedLimit.textContent=`不対電子 ${state.singles} · 非共有電子対 ${state.pairs}${state.charge?` · ${state.charge>0?'+':'−'}1`:''}`;
    if(!keep)nodes.selectionChip.textContent=selected.element;
  }

  function showDiscovery({isNew,itemIdentity}){
    document.querySelector('#discovery-kicker').textContent=isNew?'新発見！':'完成';
    nodes.discoveryFormula.textContent=itemIdentity.formula;nodes.discoveryName.textContent=itemIdentity.primary;nodes.discovery.classList.toggle('new-discovery',isNew);nodes.discovery.classList.toggle('repeat',!isNew);nodes.discovery.classList.remove('show');void nodes.discovery.offsetWidth;nodes.discovery.classList.add('show');
  }

  return{nodes,identity,renderInfo,renderStructureList,showDiscovery};
}
