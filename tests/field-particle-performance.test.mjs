import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fixture,SCENARIOS,trace,assertSignature,population} from './helpers/field-particle-fixtures.mjs';
import {stepRun} from '../src/veil/expedition-run.js';
const baseline=JSON.parse(await readFile(new URL('./fixtures/field-particle-p1/gameplay.json',import.meta.url)));
for(const name of SCENARIOS){
  const a=fixture(name),b=fixture(name,{instrument:false});assert.deepEqual(a.map,b.map);
  assert.equal(new Set(a.map.dust.map(d=>d.id)).size,a.map.dust.length,'unique particle IDs');
  const p=population(a);assert.equal(p.totalDust,name==='dense'?13590:4530);
  if(name==='awakened'){assert.equal(a.map.worldState,'awakened');assert.equal(p.rareEcologyDust,28);}
  for(const cluster of a.map.clusters)for(const d of cluster.particles)assert.ok(a.map.dust.includes(d),'cluster identity retained');
  const frames=60;for(let i=0;i<frames;i++)stepRun(a,{x:0,y:-1},1/60);
  const d=a.particleDiagnostics;assert.equal(d.simulationFrames,frames);assert.equal(d.assistScanned,p.totalDust*frames);assert.equal(d.pickupScanned,p.totalDust*frames);assert.equal(d.dynamicScanned,p.totalDust*frames);assert.equal(d.dynamicUpdated,p.dynamicDust*frames);assert.ok(d.assistNearby<d.assistScanned/10);assert.equal(d.pickupHits,d.pickups.length);
  for(const instrument of [false,true]){const {signature,run}=trace(name,{instrument,frames:baseline.frames});assertSignature(assert,signature,baseline.scenarios[name]);if(instrument)assert.deepEqual(run.particleDiagnostics.pickups.map(d=>d.id),signature.pickups.map(d=>d.id),'actual pickup order oracle');}
}
assert.ok(baseline.scenarios.awakened.pickups.some(d=>d.rare),'Rare pickup exercised');
assert.ok(baseline.scenarios['dynamic-heavy'].regions.length>0,'region transition exercised');
assert.ok(Object.values(baseline.scenarios).some(s=>s.captured),'hazard capture exercised');
console.log('FIELD P1: deterministic fixtures, work counts and original-main gameplay signatures PASS (instrumented + uninstrumented; tolerance 1e-8).');

const manifest=JSON.parse(await readFile(new URL('./fixtures/field-particle-p1/manifest.json',import.meta.url)));
assert.equal(createHash('sha256').update(await readFile(new URL('./fixtures/field-particle-p1/gameplay.json',import.meta.url))).digest('hex'),manifest.gameplaySha256);
assert.equal(manifest.visuals.length,18);
for(const visual of manifest.visuals){const bytes=await readFile(new URL(`./fixtures/field-particle-p1/${visual.file}`,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),visual.sha256);assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[390,844]);}
