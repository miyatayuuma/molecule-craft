import test from 'node:test';
import assert from 'node:assert/strict';
import {createMoleculeTransitionController} from '../src/encyclopedia-molecule-transition.js';

class FakeClassList{constructor(){this.values=new Set();}add(...items){for(const item of items)this.values.add(item);}remove(...items){for(const item of items)this.values.delete(item);}contains(item){return this.values.has(item);}}
class FakeStyle{setProperty(name,value){this[name]=value;}}
class FakeElement{
  constructor(tag='div',rect={left:0,top:0,width:100,height:80}){this.tagName=tag.toUpperCase();this.rect={...rect};this.style=new FakeStyle();this.classList=new FakeClassList();this.children=[];this.dataset={};this.attributes=new Map();this.parentNode=null;this.src='';this.currentSrc='';this.isConnected=true;this.complete=true;this.naturalWidth=96;}
  append(...nodes){for(const node of nodes){node.parentNode=this;this.children.push(node);}}
  remove(){this.isConnected=false;if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(item=>item!==this);}
  cloneNode(){return new FakeElement(this.tagName.toLowerCase(),this.rect);}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  removeAttribute(name){this.attributes.delete(name);}
  querySelector(){return null;}querySelectorAll(){return [];}getBoundingClientRect(){return {...this.rect,x:this.rect.left,y:this.rect.top};}
  animate(keyframes=[],options={}){this.lastAnimation={keyframes,options};let cancelled=false;return{cancel(){cancelled=true;},get cancelled(){return cancelled;},finished:Promise.resolve()};}
  decode(){return Promise.resolve();}
}
function fakeDocument(){const body=new FakeElement('body',{left:0,top:0,width:800,height:600}),head=new FakeElement('head');return{body,head,hidden:false,createElement:tag=>new FakeElement(tag),getElementById:()=>null,querySelector:()=>null,addEventListener(){}};}
function fakeWindow({reduce=false}={}){return{matchMedia:()=>({matches:reduce}),addEventListener(){},requestAnimationFrame:fn=>{fn();return 1;}};}
const visual=(src,rect)=>{const node=new FakeElement('img',rect);node.src=src;node.currentSrc=src;return node;};

test('Graph -> Detail paints the proxy in the transition portal before source handoff',async()=>{
  const document=fakeDocument(),portal=new FakeElement('dialog',{left:0,top:0,width:760,height:900}),controller=createMoleculeTransitionController({document,win:fakeWindow(),portalRoot:portal,assetFor:id=>`${id}.svg`,duration:520});
  controller.markStable('graph','a');const source=visual('a.svg',{left:40,top:60,width:96,height:78}),target=new FakeElement('div',{left:260,top:120,width:320,height:280});
  const handle=controller.begin({id:'a',direction:'to-detail',sourceVisual:source,sourceFit:'cover',sourceRadius:'50%'});assert.ok(handle);assert.equal(handle.proxy.parentNode,portal,'proxy must live in the same top-layer portal as the modal Encyclopedia');assert.deepEqual(controller.snapshot(),{phase:'preparing',moleculeId:'a',direction:'to-detail',owner:'transition',active:true});assert.equal(source.style.visibility,undefined,'source stays visible until proxy readiness is established');
  assert.equal(await handle.ready,true);assert.equal(handle.proxy.dataset.paintReady,'true');assert.equal(source.style.visibility,'hidden');
  const pending=controller.attach(handle,{targetVisual:target,targetRect:{left:330,top:170,width:220,height:179},targetFit:'contain',targetRadius:'0px'});assert.equal(controller.snapshot().phase,'opening');assert.equal(controller.snapshot().owner,'transition');await pending;assert.equal(handle.source.style.objectFit,'cover');assert.equal(handle.destination.style.objectFit,'contain');assert.deepEqual(handle.proxy.lastAnimation.keyframes.map(frame=>frame.transform),[undefined,undefined],'proxy geometry must not use non-uniform transform scaling');assert.equal(handle.proxy.lastAnimation.keyframes[0].borderRadius,'50%');assert.equal(handle.proxy.lastAnimation.keyframes[1].borderRadius,'0px');
  assert.deepEqual(controller.snapshot(),{phase:'idle',moleculeId:'a',direction:null,owner:'detail',active:false});assert.equal(target.style.visibility,'');
});

test('Detail -> Graph uses current molecule identity and target handoff',async()=>{
  const document=fakeDocument(),controller=createMoleculeTransitionController({document,win:fakeWindow(),assetFor:id=>`${id}.svg`,duration:520});controller.markStable('detail','b');const source=visual('detail-b.png',{left:300,top:140,width:220,height:179}),target=visual('b.svg',{left:90,top:90,width:96,height:78});
  const handle=controller.begin({id:'b',direction:'to-graph',sourceVisual:source,sourceImage:'detail-b.png',sourceFit:'contain',sourceRadius:'0px'});assert.equal(controller.snapshot().moleculeId,'b');controller.updateDestinationImage(handle,'b.svg');await controller.attach(handle,{targetVisual:target,targetFit:'cover',targetRadius:'50%'});assert.equal(handle.source.style.objectFit,'contain');assert.equal(handle.destination.style.objectFit,'cover');assert.deepEqual(handle.proxy.lastAnimation.keyframes.map(frame=>frame.transform),[undefined,undefined]);assert.equal(handle.proxy.lastAnimation.keyframes[1].borderRadius,'50%');assert.equal(controller.snapshot().owner,'graph');assert.equal(controller.snapshot().moleculeId,'b');
});

test('Detail -> Graph reveals the focus frame as its own centered, synchronized layer',async()=>{
  class Thumbnail extends FakeElement{constructor(){super('img');}cloneNode(){return new Thumbnail();}}
  class FocusNode extends FakeElement{constructor(){super('button',{left:280,top:210,width:124,height:124});this.thumbnail=new Thumbnail();this.labels=[new FakeElement('strong'),new FakeElement('small')];}querySelector(selector){return selector==='.graph-focus-thumbnail'?this.thumbnail:null;}querySelectorAll(selector){return selector==='strong,small'?this.labels:[];}cloneNode(){return new FocusNode();}}
  const clones=[];class GraphStage extends FakeElement{constructor(){super('div',{left:100,top:100,width:500,height:480});this.focus=new FocusNode();this.classList.add('graph-stage');}querySelector(selector){return selector==='[data-graph-id="b"]'?this.focus:null;}querySelectorAll(selector){if(selector==='.graph-node')return[this.focus];if(selector==='svg,.graph-neighbor-label,.graph-sector-jump')return[];if(selector==='button,input,select,textarea,[tabindex]')return[this.focus];return[];}cloneNode(){const clone=new GraphStage();clones.push(clone);return clone;}}
  const document=fakeDocument(),portal=new FakeElement('dialog',{left:0,top:0,width:760,height:900}),controller=createMoleculeTransitionController({document,win:fakeWindow(),portalRoot:portal,assetFor:id=>`${id}.svg`,duration:760,easing:'cubic-bezier(.4,0,.2,1)'});controller.markStable('detail','b');const source=visual('detail-b.png',{left:300,top:140,width:220,height:179}),stage=new GraphStage(),target=visual('b.svg',{left:282,top:212,width:120,height:120}),handle=controller.begin({id:'b',direction:'to-graph',sourceVisual:source,sourceImage:'detail-b.png'});await handle.ready;await controller.attach(handle,{targetVisual:target,targetSurface:stage,targetImage:'b.svg',targetRect:{left:282,top:212,width:120,height:120},targetFit:'cover',targetRadius:'50%'});
  const clone=clones[0],focus=clone?.focus;
  assert.ok(focus?.lastAnimation,'focus frame owns a separate animation');assert.equal(clone.lastAnimation,undefined,'the Graph stage itself must not fade or scale');assert.deepEqual(focus.lastAnimation.keyframes,[{transform:'translate(-50%,-50%) scale(.14)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:1}]);assert.equal(focus.lastAnimation.options.duration,760);assert.equal(focus.lastAnimation.options.easing,'cubic-bezier(.4,0,.2,1)');assert.equal(target.style.visibility,'');assert.equal(stage.style.visibility,'');
});

test('rapid replacement leaves the newest transition authoritative',async()=>{
  const document=fakeDocument(),controller=createMoleculeTransitionController({document,win:fakeWindow(),assetFor:id=>`${id}.svg`});controller.markStable('graph','a');const first=controller.begin({id:'a',direction:'to-detail',sourceVisual:visual('a.svg',{left:0,top:0,width:96,height:78})}),second=controller.begin({id:'b',direction:'to-detail',sourceVisual:visual('b.svg',{left:20,top:20,width:96,height:78})});
  assert.equal(await controller.attach(first,{targetVisual:new FakeElement()}),false,'stale handle cannot cancel the replacement transition');assert.equal(controller.snapshot().moleculeId,'b');assert.equal(controller.snapshot().owner,'transition');await controller.attach(second,{targetVisual:new FakeElement('div',{left:200,top:120,width:220,height:179})});assert.equal(controller.snapshot().owner,'detail');assert.equal(controller.snapshot().moleculeId,'b');
});

test('cancel during paint preparation returns ownership to the still-visible source',()=>{
  const document=fakeDocument(),controller=createMoleculeTransitionController({document,win:{...fakeWindow(),requestAnimationFrame:()=>1},assetFor:id=>`${id}.svg`});controller.markStable('graph','a');controller.begin({id:'a',direction:'to-detail',sourceVisual:visual('a.svg',{left:5,top:5,width:96,height:78})});controller.cancel();assert.equal(controller.snapshot().owner,'graph');assert.equal(controller.snapshot().phase,'idle');
});

test('reduced motion uses the same owner lifecycle and current molecule contract',async()=>{
  const document=fakeDocument(),controller=createMoleculeTransitionController({document,win:fakeWindow({reduce:true}),assetFor:id=>`${id}.svg`});controller.markStable('graph','a');const handle=controller.begin({id:'a',direction:'to-detail',sourceVisual:visual('a.svg',{left:5,top:5,width:96,height:78})});assert.equal(controller.snapshot().owner,'transition');await controller.attach(handle,{targetVisual:new FakeElement('div',{left:100,top:100,width:220,height:179})});assert.equal(controller.snapshot().owner,'detail');assert.equal(controller.snapshot().moleculeId,'a');
});

console.log('Encyclopedia molecule transition passed: top-layer portal, first-paint handoff, current ID, rapid replacement and reduced motion.');
