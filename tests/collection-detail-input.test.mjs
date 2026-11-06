import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';

// Exercise the production navigation functions with a minimal DOM surface.
// No WebGL, data mutation or browser dependency is needed for focus ownership.
const source=await readFile(new URL('../src/collection-ui.js',import.meta.url),'utf8');
const show=source.slice(source.indexOf('  function showDetail('),source.indexOf('  function focusGraph('));
const renderStart=source.indexOf('  function renderDetail(');
const render=source.slice(renderStart,source.indexOf('    detail.append(nav);',renderStart))+'    detail.append(nav);\n  }';
const close=source.slice(source.indexOf("  q('close-collection').addEventListener"),source.indexOf('  function backFromDetail('));
const back=source.slice(source.indexOf('  function backFromDetail('),source.indexOf("  dialog.addEventListener('close'"));

function harness(){
 let active=null,cancel;
 class Node{
  constructor(){this.children=[];this.dataset={};this.attributes={};this.disabled=false;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(key,value){this.attributes[key]=value;}
  getAttribute(key){return this.attributes[key]??null;}
  focus(){active=this;}
  addEventListener(type,handler){if(type==='click')this.handler=handler;}
  click(){if(!this.disabled)this.handler?.();}
  all(){return this.children.flatMap(node=>[node,...node.all()]);}
  querySelector(selector){return this.all().find(node=>selector.split(',').some(part=>part.trim().startsWith('#')?node.id===part.trim().slice(1):part.includes('data-detail-step')&&node.dataset.detailStep===part.match(/"(-?\d+)"/)[1]))??null;}
  querySelectorAll(selector){return selector==='button'?this.all():[];}
 }
 const detail=new Node(),list=new Node(),closeButton=new Node();let closed=0;
 const context=createContext({detail,list,window:{matchMedia:()=>({matches:true})},dialog:{addEventListener:(name,handler)=>{if(name==='cancel')cancel=handler;},close:()=>closed++},
  el:()=>new Node(),button:(text,handler)=>{const node=new Node();node.handler=handler;return node;},
  q:id=>id==='close-collection'?closeButton:detail.querySelector('#'+id),
  visibleItems:()=>[{id:'a'},{id:'b'},{id:'c'}],rememberListScroll(){},resetDetailScroll(){},restoreListScroll(){},
  state:{hasMolecule:()=>true,hasGroup:()=>true},polymerState:{hasPolymer:()=>true},moleculeTransition:{busy:false},
 });
 runInContext(`let currentDetail=null,discoverySession=null,discoveryAward=null,tab='groups',motifReturnMoleculeId=null,graphFocusId=null,graphHighlightId=null;
 function renderBook(){detail.replaceChildren();if(currentDetail)renderDetail();}
 ${show}\n${render}\n${close}\n${back}
 globalThis.open=id=>showDetail('groups',id);globalThis.current=()=>currentDetail?.id??null;globalThis.session=value=>discoverySession=value;globalThis.award=value=>discoveryAward=value;`,context);
 return{context,detail,closeButton,active:()=>active,current:()=>context.current(),open:id=>context.open(id),award:value=>context.award(value),cancel:()=>{const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};cancel(event);if(!event.defaultPrevented)closed++;return event;},closed:()=>closed};
}

test('paging retains its activation target through repeated Enter and stops at boundaries',()=>{
 const h=harness();h.open('a');assert.equal(h.active().id,'detail-back');
 const forward=()=>h.detail.querySelector('[data-detail-step="1"]');
 forward().focus();h.active().click();assert.equal(h.current(),'b');assert.equal(h.active(),forward());
 h.active().click();assert.equal(h.current(),'c');assert.equal(h.active(),forward());
 assert.equal(h.active().getAttribute('aria-disabled'),'true');assert.equal(h.active().disabled,false);
 h.active().click();assert.equal(h.current(),'c','boundary activation must not reverse or return to list');
 h.detail.querySelector('[data-detail-step="-1"]').click();assert.equal(h.current(),'b');assert.equal(h.active().dataset.detailStep,'-1');
});

test('Escape returns detail to list, then closes; discovery sessions keep close/resume behavior',()=>{
 const h=harness();h.open('b');assert.equal(h.cancel().defaultPrevented,true);assert.equal(h.current(),null);assert.equal(h.closed(),0);
 assert.equal(h.cancel().defaultPrevented,false);assert.equal(h.closed(),1);
 h.open('a');h.context.session({single:true});assert.equal(h.cancel().defaultPrevented,false);assert.equal(h.closed(),2);
});

test('busy graph transition consumes Escape like controller B',()=>{
 const h=harness();h.open('b');h.context.moleculeTransition.busy=true;
 assert.equal(h.cancel().defaultPrevented,true);assert.equal(h.current(),'b');assert.equal(h.closed(),0);
});

test('award close and Escape complete the ceremony without closing Collection; detail close remains normal',()=>{
 const h=harness();let skipped=0;
 h.award({finish:()=>skipped++});
 h.closeButton.click();assert.equal(skipped,1);assert.equal(h.closed(),0);
 assert.equal(h.cancel().defaultPrevented,true);assert.equal(skipped,2);assert.equal(h.closed(),0);
 h.award(null);h.closeButton.click();assert.equal(h.closed(),1);
});
