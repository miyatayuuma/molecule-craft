import assert from 'node:assert/strict';
import {bindTankChargeAction} from '../src/tank-charge.js';

class Tokens{constructor(){this.values=new Set();}add(...items){for(const item of items)this.values.add(item);}remove(...items){for(const item of items)this.values.delete(item);}}
class Node extends EventTarget{
  constructor(ownerDocument=null){super();this.ownerDocument=ownerDocument;this.children=[];this.dataset={};this.style={values:new Map(),setProperty:(key,value)=>this.style.values.set(key,value)};this.classList=new Tokens();this.hidden=true;this.disabled=false;this.attributes=new Map();this.textContent='';}
  replaceChildren(...children){this.children=children;}
  setAttribute(key,value){this.attributes.set(key,value);}
  getBoundingClientRect(){return {left:0,top:0,right:220,bottom:90,width:220,height:90};}
  setPointerCapture(){}releasePointerCapture(){}
}
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{}});
function harness(plan){
  let now=0,nextFrame=1,commits=[],finishResults=[],queued=new Map();const view=new EventTarget(),document=new EventTarget();document.defaultView=view;document.hidden=false;document.createElement=()=>new Node(document);
  const result=new Node(document),icon=new Node(document),label=new Node(document),canvas=new Node(document);canvas.getContext=()=>context;const stage=new Node(document),stageNodes=new Map([['#tank-charge-result',result],['#tank-charge-icon',icon],['#tank-charge-label',label],['canvas',canvas]]);stage.querySelector=selector=>stageNodes.get(selector)??null;stage.children=[canvas,icon,label,result];
  const button=new Node(document),control=bindTankChargeAction(button,{stage,use:'propellant',record:{atoms:['H','H']},planFor:()=>plan,commit:count=>(commits.push(count),{current:(plan.current??0)+count,capacity:plan.capacity}),onFinish:value=>finishResults.push(value),clock:()=>now,raf:callback=>{const id=nextFrame++;queued.set(id,callback);return id;},cancelRaf:id=>queued.delete(id),delay:()=>1,cancelDelay:()=>{},reduced:false});control.refresh();
  const pointer=(type,id=1)=>{const event=new Event(type,{cancelable:true});Object.defineProperties(event,{button:{value:0},isPrimary:{value:true},pointerId:{value:id},clientX:{value:10},clientY:{value:10}});button.dispatchEvent(event);};
  const advance=milliseconds=>{now+=milliseconds;const callbacks=[...queued.values()];queued.clear();for(const callback of callbacks)callback(now);};
  return {button,stage,result,control,commits,finishResults,pointer,advance,view,document};
}

const base={label:'噴射剤',capacity:10,loadedCapacity:0,amount:0,current:0,maxAdd:10,replacing:false};
const partial=harness(base);partial.pointer('pointerdown');assert.equal(partial.stage.hidden,false);partial.advance(900);partial.pointer('pointerup');assert.deepEqual(partial.commits,[5],'Early release commits the proportional whole-molecule amount');

const full=harness(base);full.pointer('pointerdown');full.advance(1500);assert.deepEqual(full.commits,[10],'An empty tank reaches full in 1.5 seconds');assert.equal(full.result.textContent,'満タン');

const cancelled=harness(base);cancelled.pointer('pointerdown');cancelled.advance(900);cancelled.pointer('pointercancel');assert.deepEqual(cancelled.commits,[],'Pointer cancellation never mutates resources');assert.equal(cancelled.stage.hidden,true);

const blurred=harness(base);blurred.pointer('pointerdown');blurred.advance(900);blurred.view.dispatchEvent(new Event('blur'));assert.deepEqual(blurred.commits,[],'Window blur cancels without committing');

const topUp=harness({...base,capacity:120,loadedCapacity:120,amount:118,current:118,maxAdd:2});topUp.pointer('pointerdown');topUp.advance(360);assert.deepEqual(topUp.commits,[2],'A small top-up uses the short proportional duration');

const replacement=harness({...base,loadedCapacity:10,amount:8,maxAdd:10,replacing:true});replacement.pointer('pointerdown');replacement.advance(600);replacement.pointer('pointerup');assert.deepEqual(replacement.commits,[],'The opening replacement phase only depicts discarding the old contents');replacement.pointer('pointerdown');replacement.advance(1500);assert.deepEqual(replacement.commits,[10],'A full replacement finishes discard and refill within 1.5 seconds');

console.log('Tank charge passed: fixed full duration, proportional top-up/release, replacement phase, and cancellation safety.');
