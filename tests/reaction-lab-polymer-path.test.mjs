import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {planPolymerAutomaticPath} from '../src/reaction-lab-polymer-path.js?v=1';

function fixture(geometrySafe,gridFallback=false){
  const start=new THREE.Vector3(-2,0,0),end=new THREE.Vector3(2,0,0);
  return{
    THREE,start,end,
    normal:new THREE.Vector3(0,0,1),
    right:new THREE.Vector3(1,0,0),
    up:new THREE.Vector3(0,1,0),
    fragmentPoints:[new THREE.Vector3(0,0,0)],
    incomingRadius:.5,geometrySafe,gridFallback,
  };
}

test('polymer automatic route preserves direct movement when clear',()=>{
  const input=fixture(()=>true);
  const route=planPolymerAutomaticPath(input);
  assert.equal(route.length,2);
  assert.deepEqual(route.map(point=>point.toArray()),[[-2,0,0],[2,0,0]]);
  assert.deepEqual(input.start.toArray(),[-2,0,0]);
  assert.deepEqual(input.end.toArray(),[2,0,0]);
});

test('polymer automatic route detours around a blocked segment',()=>{
  const safe=position=>position.lengthSq()>.36;
  const route=planPolymerAutomaticPath(fixture(safe));
  assert.ok(route?.length>2);
  for(let index=1;index<route.length;index++){
    const from=route[index-1],to=route[index],steps=Math.ceil(from.distanceTo(to)/.16);
    for(let step=1;step<=steps;step++)assert.ok(safe(from.clone().lerp(to,step/steps)));
  }
});

test('polymer automatic route rejects unreachable movement without grid fallback',()=>{
  assert.equal(planPolymerAutomaticPath(fixture(()=>false)),null);
});
