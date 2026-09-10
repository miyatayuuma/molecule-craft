import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCraftControls} from '../src/craft-controls.js';

function node(id=''){
  return{id,hidden:id==='undo-cleanup',disabled:false,className:'',textContent:id==='undo-cleanup'?'整理を戻す':'',attributes:new Map(),listeners:new Map(),style:{setProperty(){}},classList:{add(){},remove(){}},setAttribute(k,v){this.attributes.set(k,String(v));},getAttribute(k){return this.attributes.get(k)??null;},addEventListener(k,fn){this.listeners.set(k,fn);},querySelectorAll(){return[];},getBoundingClientRect(){return{left:0,right:44,top:0,bottom:44};},setPointerCapture(){},releasePointerCapture(){}};
}

test('bindCraftControls exposes Undo beside a trash-can full-cleanup control without changing hold safety',()=>{
  const undo=node('undo-cleanup'),clear=node('clear-all'),frame=node('frame-structure'),del=node('delete-selected'),actions=node('actions'),palette=node('palette'),focus=node('structure-focus'),viewer=node('viewer'),canvas=node('canvas');
  actions.insertBefore=(child,before)=>{actions.inserted=[child,before];};
  const document={hidden:false,defaultView:{addEventListener(){}},querySelector(selector){if(selector==='.viewer-actions')return actions;if(selector==='#undo-cleanup')return undo;if(selector==='#clear-all')return clear;if(selector==='#frame-structure')return frame;if(selector==='#delete-selected')return del;return null;},addEventListener(){}};
  for(const item of [undo,clear,frame,del,actions,palette,focus,viewer,canvas])item.ownerDocument=document;
  class ResizeObserver{constructor(fn){this.fn=fn;}observe(target){this.target=target;}}
  bindCraftControls({document,palette,elements:{},structureFocus:focus,viewer,canvas,resizeObserver:ResizeObserver,canChangeStructure:()=>true,refreshStructureList(){},findStructure(){},onStructureChange:{addElement(){},focus(){}},onFrame(){},onUndo(){},onDelete(){},onClear(){},onVisibilityChange(){},onPointerDown(){},onPointerMove(){},onPointerUp(){},onPointerCancel(){},onWheel(){},onResize(){}});
  assert.deepEqual(actions.inserted,[undo,clear]);
  assert.equal(undo.hidden,false);assert.equal(undo.disabled,true);assert.equal(undo.className,'icon-button');assert.equal(undo.textContent,'↶');assert.equal(undo.getAttribute('aria-label'),'元に戻す');
  assert.equal(clear.className,'hold-clear icon-button');assert.equal(clear.getAttribute('title'),'全片付け');assert.match(clear.getAttribute('aria-label'),/全片付け/);assert.match(clear.innerHTML,/M8 8h8/);
  assert.ok(clear.listeners.has('pointerdown'));assert.ok(clear.listeners.has('click'),'Full cleanup remains bound through the existing hold action');
});
