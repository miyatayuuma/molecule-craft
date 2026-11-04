import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGamepadSampler} from '../src/gamepad-input.js';
const pad=(index,buttons=[],axes=[0,0,0,0])=>({index,connected:true,mapping:'standard',buttons:Array.from({length:16},(_,i)=>({pressed:buttons.includes(i)})),axes});
test('suppresses held inputs at connection and context changes until neutral',()=>{
 const s=createGamepadSampler();assert.deepEqual(s.sample([pad(0,[0])],0,'craft').pressed,[]);
 s.sample([pad(0)],1,'craft');assert.deepEqual(s.sample([pad(0,[0])],2,'craft').pressed,[0]);
 assert.deepEqual(s.sample([pad(0,[0])],3,'dialog').pressed,[]);s.sample([pad(0)],4,'dialog');assert.deepEqual(s.sample([pad(0,[0])],5,'dialog').pressed,[0]);
});
test('repeat, release, deadzone and device isolation',()=>{
 const s=createGamepadSampler();s.sample([pad(1),pad(2)],0,'ui');
 assert.deepEqual(s.sample([pad(1,[12]),pad(2,[0])],1,'ui').pressed,[12]);
 assert.deepEqual(s.sample([pad(1,[12])],400,'ui').repeat,[12]);
 const release=s.sample([pad(1,[],[.1,.5,0,0])],401,'ui');assert.deepEqual(release.released,[12]);assert.deepEqual(release.axes,[0,.5,0,0]);
 assert.deepEqual(s.sample([pad(2,[0])],402,'ui').pressed,[]);
});
test('reset requires neutral input again',()=>{const s=createGamepadSampler();s.sample([pad(0)],0,'ui');s.sample([pad(0,[0])],1,'ui');s.reset();assert.deepEqual(s.sample([pad(0,[0])],2,'ui').pressed,[]);});
test('FIELD receives sampled movement and is cleared on blur', async()=>{
 const {startGamepadUi}=await import('../src/gamepad-input.js');let frame,blur,p=pad(0),received=[];
 const document={hidden:false,body:{dataset:{mode:'veil'},classList:{add(){},remove(){}}},querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}};
 const window={navigator:{getGamepads:()=>[p]},requestAnimationFrame:f=>{frame=f;},addEventListener:(name,f)=>{if(name==='blur')blur=f;},removeEventListener(){}};
 const stop=startGamepadUi({window,document,onFieldSample:s=>received.push(s)});frame(0);p=pad(0,[],[.7,0,0,0]);frame(20);assert.equal(received.at(-1).axes[0],.7);blur();assert.equal(received.at(-1),null);stop();
});

test('pH direction and cleanup hold use direct gamepad adapters',async()=>{
  const {startGamepadUi}=await import('../src/gamepad-input.js');
  let nextFrame,active,p=pad(0),adjustments=[],holds=[];
  const el=()=>({
    tagName:'BUTTON',tabIndex:0,id:'',dataset:{},hasAttribute:()=>false,getAttribute:()=>null,
    closest:()=>null,getClientRects:()=>[{}],getBoundingClientRect:()=>({left:0,right:80,top:0,bottom:40}),
    focus(){active=this;},matches:()=>false
  });
  const medium=el(),cleanup=el();
  medium.gamepadAdjust=direction=>adjustments.push(direction);
  cleanup.gamepadHold=pressed=>holds.push(pressed);
  active=medium;
  const items=[medium,cleanup],body={dataset:{mode:'craft'},classList:{add(){},remove(){}},querySelectorAll:()=>items};
  const document={
    hidden:false,body,get activeElement(){return active;},querySelectorAll:()=>[],
    addEventListener(){},removeEventListener(){},getElementById:()=>null
  };
  const window={
    navigator:{getGamepads:()=>[p]},requestAnimationFrame:fn=>{nextFrame=fn;},
    addEventListener(){},removeEventListener(){},getComputedStyle:()=>({visibility:'visible'})
  };
  const stop=startGamepadUi({window,document});
  nextFrame(0);
  p=pad(0,[],[0,-.8,0,0]);nextFrame(16);
  assert.deepEqual(adjustments,['up']);
  p=pad(0);nextFrame(32);
  active=cleanup;p=pad(0,[0]);nextFrame(48);
  p=pad(0);nextFrame(64);
  assert.deepEqual(holds,[true,false]);
  stop();
});

test('controller deadzone preset can be calibrated without changing mappings',()=>{
  const sampler=createGamepadSampler();
  sampler.sample([pad(0)],0,'field');
  assert.deepEqual(sampler.sample([pad(0,[],[.24,0,0,0])],1,'field').axes,[.24,0,0,0]);
  sampler.setDeadzone(.3);
  sampler.sample([pad(0)],2,'field');
  assert.deepEqual(sampler.sample([pad(0,[],[.24,0,0,0])],3,'field').axes,[0,0,0,0]);
});
