import assert from 'node:assert/strict';
import {drawChallengeCurrents} from '../src/veil/expedition-challenges.js';

const calls={stroke:0,fill:0,ellipse:0,lineTo:0};
const ctx=new Proxy({}, {
  get(target,key){
    if(key in target)return target[key];
    if(['save','restore','beginPath','moveTo','quadraticCurveTo','translate','rotate'].includes(key))return()=>{};
    if(key==='lineTo')return()=>calls.lineTo++;
    if(key==='stroke')return()=>calls.stroke++;
    if(key==='ellipse')return()=>calls.ellipse++;
    if(key==='fill')return()=>calls.fill++;
    return target[key];
  },
  set(target,key,value){target[key]=value;return true;},
});

drawChallengeCurrents(ctx,1.25);
assert.ok(calls.stroke>=53,'Existing challenge strands plus five vortex field lines render');
assert.equal(calls.fill,12,'Twelve directional grains render on the vortex route');
assert.equal(calls.ellipse,12);
assert.ok(calls.lineTo>500,'Field lines use the generated route geometry rather than a few authored knots');
console.log('Vortex field-line rendering uses Route Kit geometry and moving directional grains.');
