import {ELEMENTS,UNKNOWN_NAME,countElements} from './chemistry.js?v=20';
import {preferredValence,unpairedElectronCount} from './bonding-model.js?v=31';
import {bindRepeatHoldAction} from './hold-action.js?v=31';

export function createCraftPanel(document){
  const nodes={
    status:document.querySelector('#status'),formula:document.querySelector('#formula'),name:document.querySelector('#molecule-name'),iupac:document.querySelector('#molecule-iupac'),counts:document.querySelector('#atom-counts'),
    selectedElement:document.querySelector('#selected-element'),selectedValence:document.querySelector('#selected-valence'),selectedLimit:document.querySelector('#selected-limit'),selectionChip:document.querySelector('#selection-chip'),
    discovery:document.querySelector('#discovery'),discoveryFormula:document.querySelector('#discovery-formula'),discoveryName:document.querySelector('#discovery-name'),
    structureList:document.querySelector('#structure-list'),structureCount:document.querySelector('#structure-count'),structureFocus:document.querySelector('#structure-focus'),
    tankActions:document.querySelector('#craft-tank-actions'),
  };
  let tankActionKey='',tankControls=[];

  function identity(structure){
    if(!structure)return{record:null,primary:'自由制作',iupac:'',formula:'—'};
    const record=structure.record;
    return record?{record,primary:record.commonNameJa??record.nameJa,iupac:record.iupacNameEn??record.nameEn,formula:record.formula??structure.formula}:{record:null,primary:UNKNOWN_NAME,iupac:'',formula:structure.formula};
  }

  function renderStructureList({structures,focused,disabled,onSelect}){
    document.querySelector('#structure-focus-label').hidden=structures.length<2;
    nodes.structureFocus.disabled=disabled;nodes.structureFocus.replaceChildren();
    nodes.structureCount.textContent=`完成 ${structures.filter(item=>item.complete).length} / 構造 ${structures.length}`;nodes.structureList.replaceChildren();
    for(const [index,item] of structures.entries()){
      const itemIdentity=identity(item),button=document.createElement('button');button.type='button';button.className='structure-item';button.setAttribute('aria-pressed',String(item===focused));
      button.textContent=`${item===focused?'編集中 · ':''}${index+1}. ${item.complete?'完成':'制作中'} · ${itemIdentity.formula}${item.record?` · ${itemIdentity.primary}`:''}`;button.addEventListener('click',()=>onSelect(item));nodes.structureList.appendChild(button);
      const option=document.createElement('option');option.value=item.key;option.textContent=`${index+1}. ${item.record?itemIdentity.primary+' · ':''}${itemIdentity.formula}`;option.selected=item===focused;nodes.structureFocus.appendChild(option);
    }
  }

  function renderTankActions(focus,veilUI){
    const record=focus?.complete?focus.record:null,uses=(record&&veilUI?.usesFor(record.id))??[],key=record?`${record.id}:${uses.join('|')}`:'';
    if(key!==tankActionKey){tankActionKey=key;for(const control of tankControls)control.cancel();tankControls=[];nodes.tankActions.replaceChildren();
      for(const use of uses){const button=document.createElement('button');button.type='button';button.dataset.tankUse=use;button.dataset.moleculeId=record.id;nodes.tankActions.append(button);tankControls.push(bindRepeatHoldAction(button,()=>{const filled=veilUI.directFill(use,record.id);refreshTankButtons();return filled&&!button.disabled;}));}
    }
    function refreshTankButtons(){for(const button of nodes.tankActions.children){const status=veilUI?.tankStatus(button.dataset.tankUse,button.dataset.moleculeId);if(!status)continue;button.disabled=status.full||!status.affordable;button.dataset.replacing=String(status.replacing);button.textContent=`${status.label} ${status.current}/${status.capacity} · 長押し`;button.setAttribute('aria-label',`${status.label}タンクへ連続量産して充填。長押し`);}}
    refreshTankButtons();nodes.tankActions.hidden=!uses.length;
  }

  function renderInfo({keep,veilUI,focus,structures,selected,molecule,unresolvedAtoms,stateFor,structureListDisabled,onSelectStructure,cleanupAvailable}){
    veilUI?.updateCraft();const itemIdentity=identity(focus);nodes.formula.textContent=itemIdentity.formula;nodes.name.textContent=itemIdentity.primary;nodes.iupac.textContent=itemIdentity.iupac?`IUPAC: ${itemIdentity.iupac}`:'';
    renderTankActions(focus,veilUI);
    const validation=focus?.validation??molecule.validation();nodes.status.className=`status ${validation.level}`;nodes.status.textContent=focus&&[...focus.ids].some(id=>unresolvedAtoms.has(id))?'配置未解決 · 結合は保持しています':focus?.complete?(focus.record?'結合がそろいました':'未登録 · 結合ルールOK'):validation.message;
    nodes.counts.replaceChildren();const atoms=focus?.graph.atoms??[],counts=countElements(atoms);if(!atoms.length)nodes.counts.textContent='—';else for(const symbol of Object.keys(counts).sort()){const chip=document.createElement('span');chip.className='atom-count';chip.textContent=`${symbol} × ${counts[symbol]}`;nodes.counts.appendChild(chip);}
    renderStructureList({structures,focused:focus,disabled:structureListDisabled,onSelect:onSelectStructure});document.querySelector('#undo-cleanup').hidden=!cleanupAvailable;
    document.querySelector('#selection-actions').hidden=!selected;if(!selected){nodes.selectedElement.textContent=nodes.selectedValence.textContent=nodes.selectedLimit.textContent='—';if(!keep)nodes.selectionChip.textContent=molecule.atoms.length?'':'原子をえらんで、はじめよう';return;}
    const used=molecule.bondOrderForAtom(selected.id),state=stateFor(selected.id);nodes.selectedElement.textContent=`${selected.element} / ${ELEMENTS[selected.element].name}`;nodes.selectedValence.textContent=`${used} / 目標 ${state.charge?used:preferredValence(selected.element,used)}`;nodes.selectedLimit.textContent=`不対電子 ${state.singles} · 非共有電子対 ${state.pairs}${state.charge?` · 形式電荷 ${state.charge>0?'+':'−'}1`:''}${state.sites.includes('extension')?' · 薄紫の輪は追加接続点':''}${state.sites.includes('pair')?' · 2点入りの輪は共有できる電子対':''}`;
    if(!keep)nodes.selectionChip.textContent=state.sites.includes('extension')?'薄紫の輪から結合を追加できます':state.sites.includes('pair')?'2点入りの輪から電子対を共有できます':unpairedElectronCount(selected.element,used)>0?`${ELEMENTS[selected.element].name} · 光る点をつなごう`:`${ELEMENTS[selected.element].name}`;
  }

  function showDiscovery({isNew,learning,itemIdentity}){
    document.querySelector('#discovery-kicker').textContent=isNew?'新発見！':'完成';document.querySelector('#discovery-learning').textContent=learning;
    nodes.discoveryFormula.textContent=itemIdentity.formula;nodes.discoveryName.textContent=itemIdentity.primary;nodes.discovery.classList.toggle('new-discovery',isNew);nodes.discovery.classList.toggle('repeat',!isNew);nodes.discovery.classList.remove('show');void nodes.discovery.offsetWidth;nodes.discovery.classList.add('show');
  }

  return{nodes,identity,renderInfo,renderStructureList,showDiscovery};
}
