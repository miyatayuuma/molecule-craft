import assert from 'node:assert/strict';
import {bindHoldAction,bindRepeatHoldAction} from '../src/hold-action.js?v=31';
class Target {
  listeners=new Map();
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
  send(type,values={}){for(const fn of this.listeners.get(type)??[])fn({preventDefault(){},...values});}
}
const button=new Target(),owner=new Target();owner.defaultView=new Target();
let progress='0%',now=0,frame=null,clears=0;
Object.assign(button,{ownerDocument:owner,style:{setProperty:(_,v)=>progress=v},classList:{add(){},remove(){}},getBoundingClientRect:()=>({left:0,right:60,top:0,bottom:44}),setPointerCapture(){},releasePointerCapture(){}});
bindHoldAction(button,()=>clears++,{clock:()=>now,raf:fn=>{frame=fn;return 1;},cancelRaf:()=>frame=null});
const advance=time=>{now=time;const fn=frame;frame=null;fn?.();};
const down=()=>button.send('pointerdown',{button:0,pointerId:1});
button.send('click');assert.equal(clears,0);
down();advance(700);assert.equal(progress,'70%');button.send('pointerup',{pointerId:1});advance(1200);assert.equal(clears,0);assert.equal(progress,'0%');
down();advance(1700);button.send('pointermove',{pointerId:1,clientX:80,clientY:20});advance(2400);assert.equal(clears,0);
down();advance(2800);button.send('pointercancel',{pointerId:1});advance(3500);assert.equal(clears,0);
down();advance(3900);owner.hidden=true;owner.send('visibilitychange');advance(4700);assert.equal(clears,0);owner.hidden=false;
down();advance(5700);assert.equal(clears,1);button.send('pointerup',{pointerId:1});button.send('click');assert.equal(clears,1);
button.send('keydown',{key:'Enter'});advance(6300);button.send('keyup',{key:'Enter'});advance(7000);assert.equal(clears,1);
button.send('keydown',{key:'Enter'});advance(8000);assert.equal(clears,2);button.send('keydown',{key:'Enter',repeat:true});advance(9000);assert.equal(clears,2);
const repeatButton=new Target(),repeatOwner=new Target();repeatOwner.defaultView=new Target();let repeatFrame=null,repeats=0;Object.assign(repeatButton,{ownerDocument:repeatOwner,style:{setProperty(){}},classList:{add(){},remove(){}},getBoundingClientRect:()=>({left:0,right:60,top:0,bottom:44}),setPointerCapture(){},releasePointerCapture(){}});
bindRepeatHoldAction(repeatButton,()=>++repeats<3,{delay:500,interval:100,clock:()=>now,raf:fn=>{repeatFrame=fn;return 2;},cancelRaf:()=>repeatFrame=null});
const repeatAdvance=time=>{now=time;const fn=repeatFrame;repeatFrame=null;fn?.();};repeatButton.send('pointerdown',{button:0,pointerId:9});repeatAdvance(9300);repeatButton.send('pointerup',{pointerId:9});assert.equal(repeats,0,'A short press never produces');repeatButton.send('pointerdown',{button:0,pointerId:9});repeatAdvance(9900);repeatAdvance(10020);repeatAdvance(10140);repeatAdvance(10300);assert.equal(repeats,3,'A completed hold repeats until production reports a stop');
console.log('Hold actions passed: confirmation cancellation and continuous long-press repetition.');
