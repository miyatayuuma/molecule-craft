import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {pngPixels,maskColor} from './helpers/polymer-task5-visual.mjs';

const root=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-pixel-exchange-a664c1da/',import.meta.url);
const read=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL(name+'.json.gz',root))));
const model=read('model'),results=read('results');
const previous=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-boundary-92da7771/',import.meta.url);

test('area witnesses can exchange seed pixels; independent saved-mask counts expose the affine approximation error',()=>{
  const mask=pngPixels(fs.readFileSync(new URL('baseline-CPU-id.png',previous))),counts=new Map();
  for(let i=0;i<mask.pixels.length;i+=mask.channels){const key=(mask.pixels[i]<<16)|(mask.pixels[i+1]<<8)|mask.pixels[i+2];counts.set(key,(counts.get(key)??0)+1);}
  assert.equal(model.objects.length,21);
  for(const o of model.objects)assert.equal(o.seedCount,counts.get(maskColor(o.id))??0);
  const area33=model.objects.find(o=>o.id===1057),area32=model.objects.find(o=>o.id===1056);
  assert.equal(area33.seedCount,92);assert.ok(area33.required.value>94);
  for(const o of [area32,area33]){
    assert.ok(o.cells.some(c=>c.seedOwner!==o.id),'new screen cells can become witnesses');
    assert.ok(o.cells.some(c=>c.seedOwner===o.id&&c.conditions.some(f=>f.value-2*f.gradient.reduce((s,v)=>s+Math.abs(v),0)<.005)),'old cells may lose eligibility');
    assert.ok(o.cells.every(c=>!Object.hasOwn(c,'guard')));
  }
  const carbon=model.objects.find(o=>o.kind==='atom'&&o.index===30);
  const prediction=carbon.cells.filter(c=>!c.annotationBoundary&&c.conditions.every(f=>f.value>=.005)).length;
  assert.equal(carbon.seedCount,827);assert.equal(prediction,823,'model has false negatives even at the seed; it is not an exclusion certificate');
});

test('the unchanged continuity threshold requires more samples and accounts for the ceil discontinuity',()=>{
  const requiredSamples=L=>Math.ceil(7.75*Math.ceil(2*L)/L)+1;
  const L=12.956049664164484,steps=Math.ceil(2*L);
  assert.equal(steps,26);assert.equal(requiredSamples(L),17);
  assert.ok(15*L/steps<7.75);assert.ok(16*L/steps>=7.75);
  assert.equal(requiredSamples(13),17);
  assert.equal(requiredSamples(13.0001),18,'a length increase across a ceil boundary can require another hit');
  assert.equal(requiredSamples(13.08),17);
  const c=model.continuity.find(c=>c.index===34);
  assert.deepEqual(c.branches.map(b=>b.n),[26,27]);
  for(const b of c.branches)assert.equal(b.samples.length,3*(b.n+1));
});

test('every fixed solver slot and any CPU observation are retained without treating infeasibility or timeout as a proof',()=>{
  assert.equal(results.rows.length,12);assert.equal(results.certifiedExcludedRegions,0);
  assert.ok(results.CPURasters<=36);
  assert.equal(results.CPURasters,3*results.rows.filter(r=>r.hasIncumbent).length);
  for(const r of results.rows){
    assert.equal(r.observations.length,r.hasIncumbent?3:0);
    if(!r.hasIncumbent)assert.ok([1,2].includes(r.solver.status));
    for(const o of r.observations){
      assert.equal(o.grade.atoms.length,11);assert.equal(o.grade.bonds.length,10);
      assert.equal(o.minimumMargin,Object.values(o.guards).every(Boolean)?Math.min(...o.margins.map(m=>m.value)):0);
    }
  }
  assert.equal(results.CPUJointWitness,results.rows.some(r=>r.observations.length===3&&r.observations.every(o=>o.minimumMargin>=1)));
  const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
  for(const item of manifest.files){const bytes=fs.readFileSync(new URL(item.path,root));assert.equal(bytes.length,item.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);}
  assert.equal(manifest.disposition,'UNRESOLVED');assert.equal(manifest.formalGPU,'original0/3; newGPU0');
});
