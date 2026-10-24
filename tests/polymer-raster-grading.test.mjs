import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pngPixels,contourGrade,rasterLayers,maskColor} from './helpers/polymer-task5-visual.mjs';
const base=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/',import.meta.url),fixture=JSON.parse(await readFile(new URL('photometry-fixture.json',base),'utf8'));
async function raster(file){const bytes=await readFile(new URL(file.file,base));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);return pngPixels(bytes);}
test('A06: a real selection outline cannot certify the underlying carbon silhouette',async()=>{
  const mask=await raster(fixture.files.mask),view={canvas:fixture.canvas};
  const annotated=contourGrade(fixture.atom,view,mask,await raster(fixture.files.annotated)),neutral=contourGrade(fixture.atom,view,mask,await raster(fixture.files.photometry));
  assert.equal(annotated.pass,true);assert.equal(neutral.pass,false);
  assert.equal(annotated.exposed,45);assert.equal(neutral.exposed,45);
  assert.equal(annotated.contrast,44);assert.equal(neutral.contrast,25);
});
test('A06: another real view recovers the same carbon with no annotation or material change',async()=>{
  const p=fixture.positive,grade=contourGrade(p.atom,{canvas:fixture.canvas},await raster(p.files.mask),await raster(p.files.photometry));
  assert.equal(grade.pass,true);assert.ok(grade.contrastRatio>=.75);assert.ok(grade.whiteClipRatio<=.30);
});
test('A03 excludes a real selection circle crossing another atom; A06 keeps the unannotated disk',async()=>{
  const f=JSON.parse(await readFile(new URL('occlusion-fixture.json',base),'utf8')),bytes=await readFile(new URL(f.files.mask.file,base));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),f.files.mask.sha256);await raster(f.files.actual);
  const layers=rasterLayers(bytes,f.view),color=maskColor(f.occludedAtomIndex+1),count=r=>{let n=0;for(let i=0;i<r.pixels.length;i+=r.channels)if(((r.pixels[i]<<16)|(r.pixels[i+1]<<8)|r.pixels[i+2])===color)n++;return n;};
  assert.equal(count(layers.photometryMask),f.beforeCount);assert.equal(layers.counts.get(color),f.afterCount);assert.ok(f.afterCount<f.beforeCount);
});
