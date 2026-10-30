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
