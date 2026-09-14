import test from 'node:test';
import assert from 'node:assert/strict';
import {createMoleculeTransitionController} from '../src/encyclopedia-molecule-transition.js';

class FakeClassList{
  constructor(){this.values=new Set();}add(...items){for(const item of items)this.values.add(item);}remove(...items){for(const item of items)this.values.delete(item);}contains(item){return this.values.has(item);}
}
class FakeStyle{
  setProperty(name,value){this[name]=value;}
}
class FakeElement{
  constructor(tag='div',rect={left:0,top:0,width:100,height:80}){this.tagName=tag.toUpperCase();this.rect={...rect};this.style=new FakeStyle();this.classList=new FakeClassList();this.children=[];this.dataset={};this.attributes=new Map();this.parentNode=null;this.src='';this.currentSrc='';this.isConnected=true;}
  append(...nodes){for(const node of nodes){node.parentNode=this;this.children.push(node);}}
  remove(){this.isConnected=false;if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(item=>item!==this);}
  cloneNode(){return new FakeElement(this.tagName.toLowerCase(),this.rect);}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  removeAttribute(name){this.attributes.delete(name);}
  querySelector(){return null;}
  querySelectorAll(){return [];}
  getBoundingClientRect(){return {...this.rect,x:this.rect.left,y:this.rect.top};}
  animate(){let cancelled=false;return{cancel(){cancelled=true;},get cancelled(){return cancelled;},finished:Promise.resolve()};}
}
function fakeDocument(){
  const body=new FakeElement('body',{left:0,top:0,width:800,height:600}),head=new FakeElement('head');
  return {body,head,hidden:false,createElement:tag=>new FakeElement(tag),getElementById:()=>null,addEventListener(){}};
}
function fakeWindow({reduce=false}={}){return{matchMedia:()=>({matches:reduce}),addEventListener(){},requestAnimationFrame:fn=>{fn();return 1;}};}
const visual=(src,rect)=>{const node=new FakeElement('img',rect);node.src=src;node.currentSrc=src;return node;};

test('Graph -> Detail keeps visual ownership on transition until Detail handoff',async()=>{
  const document=fakeDocument(),controller=createMoleculeTransitionController({document,win:fakeWindow(),assetFor:id=>`${id}.svg`,duration:760});
  controller.markStable('graph','a');const source=visual('a.svg',{left:40,top:60,width:96,height:78}),target=new FakeElement('div',{left:260,top:120,width:320,height:280});
  const handle=controller.begin({id:'a',direction:'to-detail',sourceVisual:source});assert.ok(handle);assert.deepEqual(controller.snapshot(),{phase:'opening',moleculeId:'a',direction:'to-detail',owner:'transition',active:true});assert.equal(source.style.visibility,'hidden');
  const pending=controller.attach(handle,{targetVisual:target,targetRect:{left:330,top:170,width:220,height:179}});assert.equal(controller.snapshot().owner,'transition','there is no owner=none gap while the zoom is active');await pending;
  assert.deepEqual(controller.snapshot(),{phase:'idle',moleculeId:'a',direction:null,owner:'detail',active:false});assert.equal(target.style.visibility,'');
});

test('Detail -> Graph uses current molecule identity and target handoff',async()=>{
  const document=fakeDocument(),controller=createMoleculeTransitionController({document,win:fakeWindow(),assetFor:id=>`${id}.svg`,duration:760});
  controller.markStable('detail','b');const source=visual('detail-b.png',{left:300,top:140,width:220,height:179}),target=visual('b.svg',{left:90,top:90,width:96,height:78});
  const handle=controller.begin({id:'b',direction:'to-graph',sourceVisual:source,sourceImage:'detail-b.png'});assert.equal(controller.snapshot().moleculeId,'b');controller.updateDestinationImage(handle,'b.svg');await controller.attach(handle,{targetVisual:target});assert.equal(controller.snapshot().owner,'graph');assert.equal(controller.snapshot().moleculeId,'b');
});

test('rapid replacement cancels stale transition without duplicate ownership',async()=>{
  const document=fakeDocument(),controller=createMoleculeTransitionController({document,win:fakeWindow(),assetFor:id=>`${id}.svg`});
  controller.markStable('graph','a');const first=controller.begin({id:'a',direction:'to-detail',sourceVisual:visual('a.svg',{left:0,top:0,width:96,height:78})});const second=controller.begin({id:'b',direction:'to-detail',sourceVisual:visual('b.svg',{left:20,top:20,width:96,height:78})});
  assert.equal(controller.snapshot().moleculeId,'b');assert.equal(controller.snapshot().owner,'transition');assert.equal(await controller.attach(first,{targetVisual:new FakeElement()}),false,'stale handle cannot complete after replacement');await controller.attach(second,{targetVisual:new FakeElement('div',{left:200,top:120,width:220,height:179})});assert.equal(controller.snapshot().owner,'detail');assert.equal(controller.snapshot().moleculeId,'b');
});

test('reduced motion uses the same owner lifecycle and current molecule contract',async()=>{
  const document=fakeDocument(),controller=createMoleculeTransitionController({document,win:fakeWindow({reduce:true}),assetFor:id=>`${id}.svg`});controller.markStable('graph','a');const handle=controller.begin({id:'a',direction:'to-detail',sourceVisual:visual('a.svg',{left:5,top:5,width:96,height:78})});assert.equal(controller.snapshot().owner,'transition');await controller.attach(handle,{targetVisual:new FakeElement('div',{left:100,top:100,width:220,height:179})});assert.equal(controller.snapshot().owner,'detail');assert.equal(controller.snapshot().moleculeId,'a');
});

console.log('Encyclopedia molecule transition passed: continuous ownership, current ID, rapid replacement and reduced motion.');
