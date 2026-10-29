import assert from 'node:assert/strict';
import {drawChallengeCurrents} from '../src/veil/expedition-challenges.js';

function renderAt(time){
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

  assert.doesNotThrow(()=>drawChallengeCurrents(ctx,time),`Route field rendering must be safe at time=${time}`);
  assert.ok(calls.stroke>=53,'Existing challenge strands plus five vortex field lines render');
  assert.equal(calls.fill,12,'Twelve directional grains render on the vortex route');
  assert.equal(calls.ellipse,12);
  assert.ok(calls.lineTo>500,'Field lines use the generated route geometry rather than a few authored knots');
}

renderAt(0); // Initial expedition frame renders before simulation time advances.
renderAt(1.25);
console.log('Vortex field-line rendering is safe on the initial frame and uses Route Kit geometry with moving directional grains.');
