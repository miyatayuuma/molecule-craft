import assert from 'node:assert/strict';
import {bindTankChargeAction,moleculeChargeLayout,TANK_CHARGE_TIMING} from '../src/tank-charge.js';

class Tokens{constructor(){this.values=new Set();}add(...items){for(const item of items)this.values.add(item);}remove(...items){for(const item of items)this.values.delete(item);}}
class Node extends EventTarget{
  constructor(ownerDocument=null){super();this.ownerDocument=ownerDocument;this.children=[];this.dataset={};this.style={values:new Map(),setProperty:(key,value)=>this.style.values.set(key,value)};this.classList=new Tokens();this.hidden=true;this.disabled=false;this.attributes=new Map();this.textContent='';}
  replaceChildren(...children){this.children=children;}
  setAttribute(key,value){this.attributes.set(key,value);}
  getBoundingClientRect(){return {left:0,top:0,right:220,bottom:90,width:220,height:90};}
  setPointerCapture(){}releasePointerCapture(){}
}
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{}});
function harness(plan,{reduced=false}={}){
  let now=0,nextFrame=1,commits=[],finishResults=[],queued=new Map();const view=new EventTarget(),document=new EventTarget();document.defaultView=view;document.hidden=false;document.createElement=()=>new Node(document);
  const result=new Node(document),icon=new Node(document),label=new Node(document),canvas=new Node(document);canvas.getContext=()=>context;const stage=new Node(document),stageNodes=new Map([['#tank-charge-result',result],['#tank-charge-icon',icon],['#tank-charge-label',label],['canvas',canvas]]);stage.querySelector=selector=>stageNodes.get(selector)??null;stage.children=[canvas,icon,label,result];
  const button=new Node(document),control=bindTankChargeAction(button,{stage,use:'propellant',record:{atoms:['H','H']},planFor:()=>plan,commit:count=>(commits.push(count),{current:(plan.current??0)+count,capacity:plan.capacity}),onFinish:value=>finishResults.push(value),clock:()=>now,raf:callback=>{const id=nextFrame++;queued.set(id,callback);return id;},cancelRaf:id=>queued.delete(id),reduced});control.refresh();
  const pointer=(type,id=1)=>{const event=new Event(type,{cancelable:true});Object.defineProperties(event,{button:{value:0},isPrimary:{value:true},pointerId:{value:id},clientX:{value:10},clientY:{value:10}});button.dispatchEvent(event);};
  const advance=milliseconds=>{now+=milliseconds;const callbacks=[...queued.values()];queued.clear();for(const callback of callbacks)callback(now);};
  return {button,stage,result,control,commits,finishResults,pointer,advance,view,document};
}

const methaneLayout=moleculeChargeLayout({atoms:['C','H','H','H','H'],bonds:[[0,1,1],[0,2,1],[0,3,1],[0,4,1]]});
assert.equal(methaneLayout.length,5,'Charge layout contains every atom without creating 3D models');
assert.deepEqual(methaneLayout[0],{x:0,y:0},'The highest-degree atom becomes the visual molecule center');
assert.ok(methaneLayout.slice(1).every(point=>Math.hypot(point.x,point.y)>0),'Substituent atoms form a lightweight radial shell');
assert.equal(TANK_CHARGE_TIMING.fullMs,3200,'A full charge leaves enough time to read the atom-to-molecule sequence');
assert.equal(TANK_CHARGE_TIMING.minMs,1400,'Small top-ups still show a complete representative charge cycle');

const base={label:'噴射剤',capacity:10,loadedCapacity:0,amount:0,current:0,maxAdd:10,replacing:false};
const partial=harness(base);partial.pointer('pointerdown');assert.equal(partial.stage.hidden,false);partial.advance(1850);partial.pointer('pointerup');assert.deepEqual(partial.commits,[5],'Early release commits the proportional whole-molecule amount');

const full=harness(base);full.pointer('pointerdown');full.advance(TANK_CHARGE_TIMING.fullMs);assert.deepEqual(full.commits,[10],'An empty tank reaches full after the readable charge sequence');assert.equal(full.result.textContent,'満タン');

const cancelled=harness(base);cancelled.pointer('pointerdown');cancelled.advance(1850);cancelled.pointer('pointercancel');assert.deepEqual(cancelled.commits,[],'Pointer cancellation never mutates resources');assert.equal(cancelled.stage.hidden,false,'Cancellation keeps particles visible during fade');cancelled.advance(TANK_CHARGE_TIMING.fadeMs/2);assert.equal(cancelled.stage.hidden,false);cancelled.advance(TANK_CHARGE_TIMING.fadeMs/2);assert.equal(cancelled.stage.hidden,true);assert.deepEqual(cancelled.commits,[]);

const blurred=harness(base);blurred.pointer('pointerdown');blurred.advance(1850);blurred.view.dispatchEvent(new Event('blur'));assert.deepEqual(blurred.commits,[],'Window blur cancels without committing');

const topUp=harness({...base,capacity:120,loadedCapacity:120,amount:118,current:118,maxAdd:2});topUp.pointer('pointerdown');topUp.advance(TANK_CHARGE_TIMING.minMs);assert.deepEqual(topUp.commits,[2],'A small top-up keeps a readable minimum duration');

const replacement=harness({...base,loadedCapacity:10,amount:8,maxAdd:10,replacing:true});replacement.pointer('pointerdown');replacement.advance(900);replacement.pointer('pointerup');assert.deepEqual(replacement.commits,[],'The opening replacement phase only depicts discarding the old contents');replacement.pointer('pointerdown');replacement.advance(TANK_CHARGE_TIMING.replaceFullMs);assert.deepEqual(replacement.commits,[10],'A full replacement includes a readable discard and refill sequence');

console.log('Tank charge passed: readable full/minimum durations, proportional release, replacement phase, and cancellation safety.');

const resumed=harness(base);resumed.pointer('pointerdown');resumed.advance(1850);resumed.pointer('pointerup');resumed.pointer('pointerdown');resumed.advance(TANK_CHARGE_TIMING.fadeMs);assert.equal(resumed.stage.hidden,false,'Starting a new fill cancels the previous fade');resumed.advance(TANK_CHARGE_TIMING.fullMs-TANK_CHARGE_TIMING.fadeMs);assert.deepEqual(resumed.commits,[5,10]);resumed.advance(TANK_CHARGE_TIMING.fadeMs);assert.equal(resumed.stage.hidden,true);assert.deepEqual(resumed.commits,[5,10],'The fade never repeats payment');

const shared=harness(base);shared.pointer('pointerdown');shared.advance(1850);shared.pointer('pointerup');
const second=new Node(shared.document);bindTankChargeAction(second,{stage:shared.stage,use:'coolant',record:{atoms:['H','H','O']},planFor:()=>base,commit:()=>false,clock:()=>0,raf:()=>0,cancelRaf:()=>{},reduced:false});
const press=new Event('pointerdown',{cancelable:true});Object.defineProperties(press,{button:{value:0},pointerId:{value:2}});second.dispatchEvent(press);shared.advance(TANK_CHARGE_TIMING.fadeMs);assert.equal(shared.stage.hidden,false,'A previous control cannot hide the next control’s animation');assert.equal(shared.stage.dataset.tankUse,'coolant');
const reducedMotion=harness(base,{reduced:true});reducedMotion.pointer('pointerdown');reducedMotion.advance(1850);reducedMotion.pointer('pointerup');assert.deepEqual(reducedMotion.commits,[5]);assert.equal(reducedMotion.stage.hidden,true,'Reduced motion avoids the particle drain animation');
