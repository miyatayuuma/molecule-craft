from pathlib import Path

app = Path('src/app.js')
text = app.read_text()
old = "import { createCraftPanel } from './craft-panel.js?v=3';"
new = old + "\nimport { decomposeTargetIntoAvailableParts } from './craft-decomposition.js?v=1';"
if old not in text or "craft-decomposition.js?v=1" in text:
    raise SystemExit('app import anchor missing or already patched')
text = text.replace(old, new, 1)

old = '''function refreshInfo(keep=false){
  const targetAvailable={...resources.state.elements};for(const atom of molecule.atoms)targetAvailable[atom.element]=(targetAvailable[atom.element]??0)+1;
  craftPanel.renderInfo({keep,veilUI,focus:focusedStructure(),structures,selected:atomById(selectedAtomId),molecule,target:resources.record(craftTargetId),targetDiscovered:resources.state.recipes.includes(craftTargetId),targetAvailable,onClearTarget:clearCraftTarget,unresolvedAtoms,stateFor,structureListDisabled:interactionLocked()||!!dragState||activePointers.size>0,cleanupAvailable:cleanupUndo.length>0,onSelectStructure:item=>{if(relaxation||bondTransition||frameTransition||dragState||activePointers.size)return;selectAtom(item.graph.atoms[0].id);lastBackgroundTap=null;gameShell.close();refresh();repairSavedGeometry();}});
}'''
new = '''function targetPartsFor(record){
  if(!record)return[];
  const state=collectionGame?.state,unlocked=state?.templates?.filter(template=>state.isUnlocked(template.id))??[];
  return decomposeTargetIntoAvailableParts(record,unlocked).map(item=>item.partId?{...item,template:collectionGame?.templateFor(item.partId)}:item);
}
function placeTargetPart(item){
  if(!item)return false;
  if(item.partId)return addCraftPart(item.partId);
  addElement(item.element);return true;
}
function refreshInfo(keep=false){
  const targetAvailable={...resources.state.elements};for(const atom of molecule.atoms)targetAvailable[atom.element]=(targetAvailable[atom.element]??0)+1;
  const target=resources.record(craftTargetId);
  craftPanel.renderInfo({keep,veilUI,focus:focusedStructure(),structures,selected:atomById(selectedAtomId),molecule,target,targetParts:targetPartsFor(target),onPlaceTargetPart:placeTargetPart,targetDiscovered:resources.state.recipes.includes(craftTargetId),targetAvailable,onClearTarget:clearCraftTarget,unresolvedAtoms,stateFor,structureListDisabled:interactionLocked()||!!dragState||activePointers.size>0,cleanupAvailable:cleanupUndo.length>0,onSelectStructure:item=>{if(relaxation||bondTransition||frameTransition||dragState||activePointers.size)return;selectAtom(item.graph.atoms[0].id);lastBackgroundTap=null;gameShell.close();refresh();repairSavedGeometry();}});
}'''
if old not in text:
    raise SystemExit('refreshInfo anchor missing')
text = text.replace(old, new, 1)
app.write_text(text)

panel = Path('src/craft-panel.js')
text = panel.read_text()
anchor = '''export function renderCraftTargetAtoms(container,record,placedAtoms=[],{size=31}={}){
  if(!container)return[];container.replaceChildren();const rendered=[];
  for(const slot of craftTargetSlots(record,placedAtoms)){const chip=container.ownerDocument.createElement('span');chip.className='craft-target-atom';chip.dataset.element=slot.symbol;chip.dataset.filled=String(slot.filled);chip.textContent=slot.symbol;chip.setAttribute('aria-label',`${ELEMENTS[slot.symbol]?.name??slot.symbol} ${slot.filled?'配置済み':'未配置'}`);styleTargetAtom(chip,slot.symbol,slot.filled,size);container.appendChild(chip);rendered.push({slot,node:chip});}
  return rendered;
}
'''
addition = anchor + '''\nexport function renderCraftTargetParts(container,parts=[],placedAtoms=[],{size=31,onPlace=()=>{}}={}){
  if(!container)return[];container.replaceChildren();const rendered=[],placed=countElements(placedAtoms),used={};
  for(const item of parts){
    if(item.partId){
      const template=item.template,chip=container.ownerDocument.createElement('button');chip.type='button';chip.className='craft-target-part';chip.dataset.partId=item.partId;chip.textContent=template?.notation??template?.label??item.partId;chip.setAttribute('aria-label',`${template?.nameJa??chip.textContent}をクラフト台へ出す`);chip.style.cssText='display:inline-grid;place-items:center;flex:0 0 auto;min-height:31px;padding:0 9px;border:1px solid #4b7a76;border-radius:10px;background:#173b40;color:#bdf2e8;font-size:11px;font-weight:800;line-height:1;white-space:nowrap;';chip.addEventListener('click',()=>onPlace(item));container.appendChild(chip);rendered.push({item,node:chip,slot:null});continue;
    }
    const symbol=item.element,index=used[symbol]??0;used[symbol]=index+1;const slot={symbol,index,filled:index<(placed[symbol]??0)},chip=container.ownerDocument.createElement('button');chip.type='button';chip.className='craft-target-atom';chip.dataset.element=symbol;chip.dataset.filled=String(slot.filled);chip.textContent=symbol;chip.setAttribute('aria-label',`${ELEMENTS[symbol]?.name??symbol}をクラフト台へ出す`);styleTargetAtom(chip,symbol,slot.filled,size);chip.style.minHeight=`${size}px`;chip.style.padding='0';chip.addEventListener('click',()=>onPlace(item));container.appendChild(chip);rendered.push({item,node:chip,slot});
  }
  return rendered;
}
'''
if anchor not in text or 'renderCraftTargetParts' in text:
    raise SystemExit('panel render anchor missing or already patched')
text = text.replace(anchor, addition, 1)

old = '''function renderTarget(record,placedAtoms,onClearTarget,{discovered=false}={}){
  clearTarget=onClearTarget??(()=>{});nodes.target.hidden=!record;if(!record){nodes.targetName.hidden=true;lastTargetKey='';lastTargetFilled={};return;}
  const displayName=record.commonNameJa??record.nameJa??record.name??'',idea=!discovered;nodes.targetName.textContent=discovered?displayName:'';nodes.targetName.hidden=!discovered;nodes.targetFormula.textContent=`${idea?'💡 ':''}${record.formula??''}`;nodes.target.setAttribute('aria-label',`${idea?'ひらめいた ':''}${record.formula??'分子'}${discovered&&displayName?` ${displayName}`:''} 制作目標`);
  const rendered=renderCraftTargetAtoms(nodes.targetAtoms,record,placedAtoms),key=record.id??record.formula??record.name??'target',sameTarget=key===lastTargetKey,filledNow={};
  for(const {slot,node:chip}of rendered){if(slot.filled)filledNow[slot.symbol]=(filledNow[slot.symbol]??0)+1;if(sameTarget&&slot.filled&&slot.index>=(lastTargetFilled[slot.symbol]??0)&&typeof chip.animate==='function')chip.animate([{transform:'scale(.82)'},{transform:'scale(1.09)'},{transform:'scale(1)'}],{duration:220,easing:'ease-out'});}
  lastTargetKey=key;lastTargetFilled=filledNow;
}

function renderInfo({keep,veilUI,focus,structures,selected,molecule,target,targetDiscovered=false,onClearTarget,unresolvedAtoms,stateFor,structureListDisabled,onSelectStructure,cleanupAvailable}){
    veilUI?.updateCraft();const itemIdentity=identity(focus),idea=!!target&&!targetDiscovered;nodes.formula.textContent=itemIdentity.formula;nodes.name.textContent=`${idea?'💡 ':''}${itemIdentity.primary}`;nodes.iupac.textContent=itemIdentity.iupac?`IUPAC: ${itemIdentity.iupac}`:'';
    renderTarget(target,molecule.atoms,onClearTarget,{discovered:targetDiscovered});'''
new = '''function renderTarget(record,placedAtoms,onClearTarget,{discovered=false,targetParts=[],onPlaceTargetPart=()=>{}}={}){
  clearTarget=onClearTarget??(()=>{});nodes.target.hidden=!record;if(!record){nodes.targetName.hidden=true;lastTargetKey='';lastTargetFilled={};return;}
  const displayName=record.commonNameJa??record.nameJa??record.name??'',idea=!discovered;nodes.targetName.textContent=discovered?displayName:'';nodes.targetName.hidden=!discovered;nodes.targetFormula.textContent=`${idea?'💡 ':''}${record.formula??''}`;nodes.target.setAttribute('aria-label',`${idea?'ひらめいた ':''}${record.formula??'分子'}${discovered&&displayName?` ${displayName}`:''} 制作目標`);
  const rendered=targetParts.length?renderCraftTargetParts(nodes.targetAtoms,targetParts,placedAtoms,{onPlace:onPlaceTargetPart}):renderCraftTargetAtoms(nodes.targetAtoms,record,placedAtoms),key=record.id??record.formula??record.name??'target',sameTarget=key===lastTargetKey,filledNow={};
  for(const {slot,node:chip}of rendered){if(!slot)continue;if(slot.filled)filledNow[slot.symbol]=(filledNow[slot.symbol]??0)+1;if(sameTarget&&slot.filled&&slot.index>=(lastTargetFilled[slot.symbol]??0)&&typeof chip.animate==='function')chip.animate([{transform:'scale(.82)'},{transform:'scale(1.09)'},{transform:'scale(1)'}],{duration:220,easing:'ease-out'});}
  lastTargetKey=key;lastTargetFilled=filledNow;
}

function renderInfo({keep,veilUI,focus,structures,selected,molecule,target,targetParts=[],onPlaceTargetPart,targetDiscovered=false,onClearTarget,unresolvedAtoms,stateFor,structureListDisabled,onSelectStructure,cleanupAvailable}){
    veilUI?.updateCraft();const itemIdentity=identity(focus),idea=!!target&&!targetDiscovered;nodes.formula.textContent=itemIdentity.formula;nodes.name.textContent=`${idea?'💡 ':''}${itemIdentity.primary}`;nodes.iupac.textContent=itemIdentity.iupac?`IUPAC: ${itemIdentity.iupac}`:'';
    renderTarget(target,molecule.atoms,onClearTarget,{discovered:targetDiscovered,targetParts,onPlaceTargetPart});'''
if old not in text:
    raise SystemExit('panel target anchor missing')
text = text.replace(old, new, 1)
panel.write_text(text)

contracts = Path('tests/source-contracts.test.mjs')
text = contracts.read_text()
anchor = "assert.match(app, /craftPanel\\.renderInfo\\(/);"
addition = anchor + "\nassert.match(app, /decomposeTargetIntoAvailableParts\\(record,unlocked\\)/);\nassert.match(app, /targetParts:targetPartsFor\\(target\\)/);\nassert.match(craftPanel, /renderCraftTargetParts/);\nassert.match(craftPanel, /onPlaceTargetPart/);"
if anchor not in text:
    raise SystemExit('source contract anchor missing')
contracts.write_text(text.replace(anchor, addition, 1))
