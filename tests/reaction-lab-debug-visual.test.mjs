import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {capturePolymerIdMask,measurePolymerDisplayBounds} from '../src/reaction-lab-debug-visual.js?v=1';

test('debug bounds measure the visible finite sample without altering its pose',()=>{
  const camera=new THREE.PerspectiveCamera(42,1,.1,30);
  camera.position.set(0,0,8);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const group=new THREE.Group(),atom=new THREE.Object3D();group.add(atom);group.updateMatrixWorld(true);
  const visual={group,layoutPlan:{atoms:[{element:'C'}]},atomByGraphIndex:new Map([[0,atom]])};
  const before=group.position.toArray(),rect={left:0,top:0,width:300,height:200};
  const bounds=measurePolymerDisplayBounds({
    THREE,visual,camera,canvas:{getBoundingClientRect:()=>rect},
    fit:{safeRegion:{left:0,right:300,top:0,bottom:200}},modelAtomRadius:()=>.5,
  });
  assert.equal(bounds.atomCount,1);
  assert.equal(bounds.depthVisible,true);
  assert.equal(bounds.insideSafeRegion,true);
  assert.deepEqual(group.position.toArray(),before);
});

test('debug geometry helpers retain absent-sample guards',()=>{
  assert.equal(measurePolymerDisplayBounds({visual:null}),null);
  assert.throws(()=>capturePolymerIdMask({visual:null}),/No visible sample/);
});
