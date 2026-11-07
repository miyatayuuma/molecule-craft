import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {ComparisonRopeScene,ComparisonRopeCanvas} from '../src/compare-rope-scene.js';

test('preferred pedestal has a dedicated emissive texture for heater highlights',async()=>{
  const bytes=await readFile(new URL('../assets/compare/scifi-pedestal.glb',import.meta.url));
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  const emission=gltf.materials.find(material=>material.emissiveTexture)?.emissiveTexture;
  assert.ok(emission,'heater overlay must use an authored emission mask');
  const source=gltf.textures[emission.index]?.source;
  assert.equal(gltf.images[source]?.name,'EMIT');
});

test('the emissive pedestal lamps shift from white to orange without tinting body materials',()=>{
  const white=new THREE.Color('#b3b3b3');
  const glowing={emissive:white.clone(),emissiveIntensity:1};
  const body={color:new THREE.Color('#253a42')};
  const overlay={material:{opacity:0}};
  const heaterLight={intensity:0};
  const mock={platformHeat:0,hotEmissive:new THREE.Color('#ff672d'),
    platformEmissive:[{material:glowing,neutral:white,intensity:1}],
    platformHeatOverlays:[overlay],heaterLight,
    applyPlatformHeat:ComparisonRopeScene.prototype.applyPlatformHeat};
  for(let i=0;i<100;i++)ComparisonRopeScene.prototype.setBoilingHeat.call(mock,1,1/60);
  assert.ok(glowing.emissive.r>glowing.emissive.g*1.5);
  assert.ok(glowing.emissiveIntensity<.3,'white light no longer washes out the heater');
  assert.ok(overlay.material.opacity>.9,'separate saturated lamp overlay is visible');
  assert.ok(heaterLight.intensity>5);
  assert.equal(body.color.getHexString(),'253a42');
  for(let i=0;i<260;i++)ComparisonRopeScene.prototype.setBoilingHeat.call(mock,0,1/60);
  assert.ok(Math.abs(glowing.emissive.g-white.g)<.01);
  assert.ok(Math.abs(glowing.emissiveIntensity-1)<.01);
  assert.ok(overlay.material.opacity<.01);
  assert.ok(heaterLight.intensity<.06);
});

test('the fallback pedestal also warms and cools without requiring WebGL',()=>{
  const mock={platformHeat:0,platform:{style:{}},platformHeatImage:{style:{}}};
  ComparisonRopeCanvas.prototype.setBoilingHeat.call(mock,1,.05);
  assert.ok(mock.platformHeat>0);
  assert.ok(Number(mock.platformHeatImage.style.opacity)>0);
  for(let i=0;i<240;i++)ComparisonRopeCanvas.prototype.setBoilingHeat.call(mock,0,1/60);
  assert.ok(mock.platformHeat<.01);
  assert.ok(Number(mock.platformHeatImage.style.opacity)<.01);
});
