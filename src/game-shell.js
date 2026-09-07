// Dialog orchestration and the deliberately minimal gameplay chrome live outside the 3D renderer.
function pruneInstructionalChrome(document){
  const q=id=>document.getElementById(id);
  const clear=q('clear-all');clear?.removeAttribute('title');clear?.querySelector('small')?.remove();

  for(const selector of [
    '#open-help','#help-dialog','#craft-last-run','#element-unlock-hint','#game-loop-hint','#craft-empty','.reset-tools',
    '#molecule-iupac','#tank-next-hint','.tank-explanation','#tank-affordability','#tank-charge-result','#oxygen-route-guide',
    '.veil-stock > span','#veil-gained','#veil-chain-block','.veil-title > small','#veil-region-subtitle',
    '#veil-threat','#veil-goal','#veil-message','#veil-pad-label','#veil-thermal-state','#veil-coolant',
    '#veil-combustion-remaining','#veil-boost > small',
  ])for(const node of document.querySelectorAll(selector))node.style.display='none';

  // Directly tapping atoms already switches the edited structure. Keep the
  // craft surface focused on direct manipulation by removing redundant chrome.
  for(const selector of ['#structure-focus-label','#frame-structure','#open-info'])document.querySelector(selector)?.remove();

  const deleteButton=q('delete-selected');
  if(deleteButton){
    deleteButton.textContent='';deleteButton.classList.add('icon-button');
    deleteButton.insertAdjacentHTML('beforeend','<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></svg>');
  }

  // The spawn planner uses this chip's screen rectangle as the lower safe-area
  // boundary. Keep its geometry while removing it visually.
  const selectionChip=q('selection-chip');if(selectionChip)selectionChip.style.visibility='hidden';
  const autoSave=q('reset-status')?.nextElementSibling;if(autoSave?.matches('p.muted'))autoSave.remove();
  q('show-extra-elements')?.closest('details')?.querySelector('p.muted')?.remove();
}

export function createGameShell({canOpen=()=>true}={}){
  pruneInstructionalChrome(document);
  const q=id=>document.getElementById(id),dialogs=[...document.querySelectorAll('dialog.sheet')];
  function open(id){if(!canOpen())return;for(const dialog of dialogs)if(dialog.open)dialog.close();q(id)?.showModal();}
  for(const [button,id]of [['open-menu','menu-dialog'],['open-help','help-dialog'],['open-info','info-dialog'],['menu-info','info-dialog']])q(button)?.addEventListener('click',()=>open(id));
  for(const dialog of dialogs){
    dialog.querySelector('[data-close-dialog]')?.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  }
  q('help-done')?.addEventListener('click',()=>q('help-dialog')?.close());
  return {close:()=>dialogs.forEach(dialog=>{if(dialog.open)dialog.close();}),isOpen:()=>dialogs.some(dialog=>dialog.open),closeMenu:()=>q('menu-dialog')?.close()};
}
