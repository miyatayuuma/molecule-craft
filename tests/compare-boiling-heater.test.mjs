import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {ComparisonRopeScene,ComparisonRopeCanvas} from '../src/compare-rope-scene.js';
import {temperatureIndicatorColor,temperatureIndicatorWeights} from '../src/compare-temperature-color.js';

const boilingAt = temperature => ({temperature,phase:'boiling',progress:1});
const stopped = {temperature:null,phase:null,progress:0};

test('pedestal color follows Celsius temperature, not percentage toward boiling point',()=>{
  assert.equal(temperatureIndicatorColor(-20),'#56b9ee');
  assert.equal(temperatureIndicatorColor(25),'#e8f0ee');
  assert.equal(temperatureIndicatorColor(100),'#ff5829');
  assert.notEqual(temperatureIndicatorColor(-5),temperatureIndicatorColor(100));
  assert.notEqual(temperatureIndicatorColor(78.4),temperatureIndicatorColor(100));
  assert.equal(temperatureIndicatorColor(-1e6),temperatureIndicatorColor(-60));
  assert.equal(temperatureIndicatorColor(1e6),temperatureIndicatorColor(140));
  assert.deepEqual(temperatureIndicatorWeights(null),{cold:0,warm:0});
  assert.ok(temperatureIndicatorWeights(-5).cold>0.6);
  assert.equal(temperatureIndicatorWeights(-5).warm,0);
  assert.ok(temperatureIndicatorWeights(100).warm>.99);
  assert.equal(temperatureIndicatorWeights(100).cold,0);
});

test('preferred pedestal has a dedicated emissive texture for heater highlights',async()=>{
  const bytes=await readFile(new URL('../assets/compare/scifi-pedestal.glb',import.meta.url));
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  const emission=gltf.materials.find(material=>material.emissiveTexture)?.emissiveTexture;
  assert.ok(emission,'heater overlay must use an authored emission mask');
  const source=gltf.textures[emission.index]?.source;
  assert.equal(gltf.images[source]?.name,'EMIT');
});

test('the emissive pedestal lamps shift from cold blue to hot orange without tinting body materials',()=>{
  const white=new THREE.Color('#b3b3b3');
  const glowing={emissive:white.clone(),emissiveIntensity:1};
  const body={color:new THREE.Color('#253a42')};
  const overlay={material:{opacity:0,color:new THREE.Color('#e8f0ee')}};
  const heaterLight={intensity:0,color:new THREE.Color('#e8f0ee')};
  const mock={platformHeat:0,platformHeatColor:new THREE.Color('#e8f0ee'),
    platformEmissive:[{material:glowing,neutral:white,intensity:1}],
    platformHeatOverlays:[overlay],heaterLight,
    applyPlatformHeat:ComparisonRopeScene.prototype.applyPlatformHeat};
  for(let i=0;i<100;i++)ComparisonRopeScene.prototype.setBoilingHeat.call(mock,boilingAt(-5),1/60);
  assert.ok(overlay.material.color.b>overlay.material.color.r*1.4,'subzero sample must be blue');
  assert.ok(heaterLight.color.b>heaterLight.color.r*1.4);
  assert.ok(overlay.material.opacity>.9,'cold color must be visible at a low boiling point');
  for(let i=0;i<100;i++)ComparisonRopeScene.prototype.setBoilingHeat.call(mock,boilingAt(100),1/60);
  assert.ok(glowing.emissive.r>glowing.emissive.g*1.5);
  assert.ok(overlay.material.color.r>overlay.material.color.b*2,'100 °C must be orange');
  assert.ok(glowing.emissiveIntensity<.3,'white light no longer washes out the heater');
  assert.ok(overlay.material.opacity>.9,'separate saturated lamp overlay is visible');
  assert.ok(heaterLight.intensity>5);
  assert.equal(body.color.getHexString(),'253a42');
  for(let i=0;i<260;i++)ComparisonRopeScene.prototype.setBoilingHeat.call(mock,stopped,1/60);
  assert.ok(Math.abs(glowing.emissive.g-white.g)<.01);
  assert.ok(Math.abs(glowing.emissiveIntensity-1)<.01);
  assert.ok(overlay.material.opacity<.01);
  assert.ok(heaterLight.intensity<.06);
});

test('the Canvas fallback uses visibly distinct blue and orange overlays',()=>{
  const mock={platformHeat:0,platformTemperature:25,platform:{style:{}},
    platformColdImage:{style:{}},platformHeatImage:{style:{}}};
  for(let i=0;i<100;i++)ComparisonRopeCanvas.prototype.setBoilingHeat.call(mock,boilingAt(-5),1/60);
  assert.ok(mock.platformHeat>0);
  assert.ok(Number(mock.platformColdImage.style.opacity)>.5);
  assert.equal(Number(mock.platformHeatImage.style.opacity),0);
  for(let i=0;i<100;i++)ComparisonRopeCanvas.prototype.setBoilingHeat.call(mock,boilingAt(100),1/60);
  assert.equal(Number(mock.platformColdImage.style.opacity),0);
  assert.ok(Number(mock.platformHeatImage.style.opacity)>0);
  for(let i=0;i<240;i++)ComparisonRopeCanvas.prototype.setBoilingHeat.call(mock,stopped,1/60);
  assert.ok(mock.platformHeat<.01);
  assert.ok(Number(mock.platformColdImage.style.opacity)<.01);
  assert.ok(Number(mock.platformHeatImage.style.opacity)<.01);
});
