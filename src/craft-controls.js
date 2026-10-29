import {bindHoldAction} from './hold-action.js?v=30';

function installCraftActionBar(document){
  const actions=document.querySelector('.viewer-actions'),undo=document.querySelector('#undo-cleanup'),clear=document.querySelector('#clear-all');
  if(undo){
    undo.className='icon-button craft-history-undo';undo.hidden=false;undo.disabled=true;undo.setAttribute('aria-label','直前のCRAFT操作を元に戻す');undo.setAttribute('title','直前のCRAFT操作を元に戻す');
    undo.style.marginRight='12px';
    if(actions&&clear)actions.insertBefore(undo,clear);
  }
  if(clear){
    clear.className='hold-clear icon-button';clear.setAttribute('aria-label','1秒長押しで全片付け。クラフト中の全要素をBASE STOCKへ戻して片付ける');clear.setAttribute('title','全片付け');
  }
}

// DOM event ownership for the craft screen. Callbacks keep Three.js and
// interaction state in the application integration layer.
export function bindCraftControls({document,palette,elements,structureFocus,viewer,canvas,resizeObserver,
  canChangeStructure,refreshStructureList,findStructure,onStructureChange,onUndo,onClear,
  onVisibilityChange,onInteractionInterrupted=()=>{},onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onWheel,onResize}){
  installCraftActionBar(document);
  if(palette)for(const button of palette.querySelectorAll('[data-element]')){
    const symbol=button.dataset.element;if(elements[symbol])button.style.setProperty('--element-color',elements[symbol].color);
    button.addEventListener('click',()=>onStructureChange.addElement(symbol));
  }
  structureFocus.addEventListener('change',()=>{
    if(!canChangeStructure()){refreshStructureList();return;}
    const item=findStructure(structureFocus.value);if(item)onStructureChange.focus(item);
  });
  document.querySelector('#undo-cleanup')?.addEventListener('click',onUndo);
  document.addEventListener('visibilitychange',()=>{onVisibilityChange();if(document.hidden)onInteractionInterrupted();});
  document.defaultView?.addEventListener?.('blur',onInteractionInterrupted);
  bindHoldAction(document.querySelector('#clear-all'),onClear);
  canvas.addEventListener('pointerdown',onPointerDown);canvas.addEventListener('pointermove',onPointerMove);canvas.addEventListener('pointerup',onPointerUp);canvas.addEventListener('pointercancel',onPointerCancel);canvas.addEventListener('lostpointercapture',onPointerCancel);
  canvas.addEventListener('wheel',onWheel,{passive:false});
  new resizeObserver(onResize).observe(viewer);
}