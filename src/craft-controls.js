import {bindHoldAction} from './hold-action.js?v=30';

// DOM event ownership for the craft screen. Callbacks keep Three.js and
// interaction state in the application integration layer.
export function bindCraftControls({document,palette,elements,structureFocus,viewer,canvas,resizeObserver,
  canChangeStructure,refreshStructureList,findStructure,onStructureChange,onFrame,onUndo,onDelete,onClear,
  onVisibilityChange,onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onWheel,onResize}){
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
