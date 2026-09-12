import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCraftControls} from '../src/craft-controls.js';

function node(id=''){
  return{id,hidden:id==='undo-cleanup',disabled:false,className:id==='undo-cleanup'?'icon-button craft-history-undo':'',textContent:'',attributes:new Map(),listeners:new Map(),style:{setProperty(){}},classList:{add(){},remove(){}},setAttribute(k,v){this.attributes.set(k,String(v));},getAttribute(k){return this.attributes.get(k)??null;},addEventListener(k,fn){this.listeners.set(k,fn);},querySelectorAll(){return[];},getBoundingClientRect(){return{left:0,right:44,top:0,bottom:44};},setPointerCapture(){},releasePointerCapture(){}};
}

test('bindCraftControls exposes icon-only Undo beside hold-safe full cleanup without selected-atom delete',()=>{
  globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
  const undo=node('undo-cleanup'),clear=node('clear-all'),actions=node('actions'),palette=node('palette'),focus=node('structure-focus'),viewer=node('viewer'),canvas=node('canvas');
  actions.insertBefore=(child,before)=>{actions.inserted=[child,before];};
  const document={hidden:false,defaultView:{addEventListener(){}},querySelector(selector){if(selector==='.viewer-actions')return actions;if(selector==='#undo-cleanup')return undo;if(selector==='#clear-all')return clear;return null;},querySelectorAll(){return[];},addEventListener(){}};
  for(const item of [undo,clear,actions,palette,focus,viewer,canvas])item.ownerDocument=document;
  class ResizeObserver{constructor(fn){this.fn=fn;}observe(target){this.target=target;}}
  bindCraftControls({document,palette,elements:{},structureFocus:focus,viewer,canvas,resizeObserver:ResizeObserver,canChangeStructure:()=>true,refreshStructureList(){},findStructure(){},onStructureChange:{addElement(){},focus(){}},onUndo(){},onClear(){},onVisibilityChange(){},onPointerDown(){},onPointerMove(){},onPointerUp(){},onPointerCancel(){},onWheel(){},onResize(){}});
  assert.deepEqual(actions.inserted,[undo,clear]);
  assert.equal(undo.hidden,false);assert.equal(undo.disabled,true);assert.equal(undo.className,'icon-button craft-history-undo');assert.equal(undo.textContent,'');assert.equal(undo.getAttribute('aria-label'),'直前のCRAFT操作を元に戻す');assert.equal(undo.style.marginRight,'12px');
  assert.equal(clear.className,'hold-clear icon-button');assert.equal(clear.getAttribute('title'),'全片付け');assert.match(clear.getAttribute('aria-label'),/全片付け/);
  assert.ok(undo.listeners.has('click'),'Undo remains bound');
  assert.ok(clear.listeners.has('pointerdown'));assert.ok(clear.listeners.has('click'),'Full cleanup remains bound through the existing hold action');
});
