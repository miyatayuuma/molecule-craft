import {bindHoldAction} from './hold-action.js?v=30';

function installCraftActionBar(document){
  const actions=document.querySelector('.viewer-actions'),undo=document.querySelector('#undo-cleanup'),clear=document.querySelector('#clear-all');
  if(undo){
    undo.className='icon-button';undo.hidden=false;undo.disabled=true;undo.textContent='↶';undo.setAttribute('aria-label','元に戻す');undo.setAttribute('title','元に戻す');
    if(actions&&clear)actions.insertBefore(undo,clear);
  }
  if(clear){
    clear.className='hold-clear icon-button';clear.setAttribute('aria-label','1秒長押しで全片付け。クラフト中の全要素をBASE STOCKへ戻して片付ける');clear.setAttribute('title','全片付け');
    clear.innerHTML='<svg class="cleanup-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 8h8l-.7 11H8.7L8 8z"/><path d="M6.5 7h11M10 7l1-2h2l1 2M10.5 10.5v5M13.5 10.5v5"/></svg>';
  }
}

// DOM event ownership for the craft screen. Callbacks keep Three.js and
// interaction state in the application integration layer.
export function bindCraftControls({document,palette,elements,structureFocus,viewer,canvas,resizeObserver,
  canChangeStructure,refreshStructureList,findStructure,onStructureChange,onFrame,onUndo,onDelete,onClear,
  onVisibilityChange,onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onWheel,onResize}){
  installCraftActionBar(document);
  if(palette)for(const button of palette.querySelectorAll('[data-element]')){
    const symbol=button.dataset.element;if(elements[symbol])button.style.setProperty('--element-color',elements[symbol].color);
    button.addEventListener('click',()=>onStructureChange.addElement(symbol));
  }
  structureFocus.addEventListener('change',()=>{
    if(!canChangeStructure()){refreshStructureList();return;}
    const item=findStructure(structureFocus.value);if(item)onStructureChange.focus(item);
  });
  document.querySelector('#frame-structure')?.addEventListener('click',onFrame);
  document.querySelector('#undo-cleanup')?.addEventListener('click',onUndo);
  document.addEventListener('visibilitychange',onVisibilityChange);
  document.querySelector('#delete-selected')?.addEventListener('click',onDelete);
  bindHoldAction(document.querySelector('#clear-all'),onClear);
  canvas.addEventListener('pointerdown',onPointerDown);canvas.addEventListener('pointermove',onPointerMove);canvas.addEventListener('pointerup',onPointerUp);canvas.addEventListener('pointercancel',onPointerCancel);
  canvas.addEventListener('wheel',onWheel,{passive:false});
  new resizeObserver(onResize).observe(viewer);
}
