import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {ComparisonRopeScene,ComparisonRopeCanvas} from '../src/compare-rope-scene.js';

test('the emissive pedestal lamps shift from white to orange without tinting body materials',()=>{
  const white=new THREE.Color('#b3b3b3');
  const glowing={emissive:white.clone(),emissiveIntensity:1};
  const body={color:new THREE.Color('#253a42')};
  const mock={platformHeat:0,hotEmissive:new THREE.Color('#ff672d'),
    platformEmissive:[{material:glowing,neutral:white,intensity:1}],
    applyPlatformHeat:ComparisonRopeScene.prototype.applyPlatformHeat};
  for(let i=0;i<100;i++)ComparisonRopeScene.prototype.setBoilingHeat.call(mock,1,1/60);
  assert.ok(glowing.emissive.r>glowing.emissive.g*1.5);
  assert.ok(glowing.emissiveIntensity>1.5);
  assert.equal(body.color.getHexString(),'253a42');
  for(let i=0;i<260;i++)ComparisonRopeScene.prototype.setBoilingHeat.call(mock,0,1/60);
  assert.ok(Math.abs(glowing.emissive.g-white.g)<.01);
  assert.ok(Math.abs(glowing.emissiveIntensity-1)<.01);
});

test('the fallback pedestal also warms and cools without requiring WebGL',()=>{
  const mock={platformHeat:0,platform:{style:{}}};
  ComparisonRopeCanvas.prototype.setBoilingHeat.call(mock,1,.05);
  assert.ok(mock.platformHeat>0);
  assert.match(mock.platform.style.filter,/sepia\(/);
  for(let i=0;i<240;i++)ComparisonRopeCanvas.prototype.setBoilingHeat.call(mock,0,1/60);
  assert.ok(mock.platformHeat<.01);
});
