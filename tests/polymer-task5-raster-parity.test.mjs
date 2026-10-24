import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {render,png,compare,grade} from '../scripts/analyze-polymer-task5-exact-mesh.mjs';
import {pngPixels} from './helpers/polymer-task5-visual.mjs';

const base=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-exact-mesh-519a686c/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base)));
const read=name=>{
  const bytes=fs.readFileSync(new URL(name,base)),expected=manifest.files.find(f=>f.path===name);
  assert.ok(expected);assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256);
  return name.endsWith('.gz')?JSON.parse(gunzipSync(bytes)):bytes;
};
test('independent triangle edges recover native shared-edge coverage without changing legacy replay',()=>{
  const original=read('analysis.json.gz');
  for(const name of ['control-0-y0-p0','control-17-y45-p30']){
    const row=read(name+'.json.gz'),actual=pngPixels(read(name+'-id.png')),legacy=render(row.snapshot,'legacy4'),corrected=render(row.snapshot,'legacy4',{exactEdges:true});
    assert.equal(compare(actual,legacy).mismatch,original.rows.find(r=>r.name===name).measurements.legacy4.parity.mismatch);
    assert.equal(compare(actual,corrected).mismatch,0,'saved native raster is the independent oracle');
    assert.equal(grade(png(corrected),row).jointPartialPixelPass,false,'raster repair does not rescue existing occlusion');
  }
});
test('a native one-ULP ownership difference remains explicit and cannot rescue the retained boundary pose',()=>{
  const row=read('boundary-30-2.json.gz'),actualBytes=read('boundary-30-2-id.png'),actual=pngPixels(actualBytes),cpu=render(row.snapshot,'legacy4',{exactEdges:true}),nativeGrade=grade(actualBytes,row),cpuGrade=grade(png(cpu),row);
  assert.equal(compare(actual,cpu).mismatch,2);
  assert.equal(nativeGrade.bonds.find(b=>b.index===33).visiblePixels,83);assert.equal(cpuGrade.bonds.find(b=>b.index===33).visiblePixels,84);
  assert.deepEqual(cpuGrade.bonds.map(b=>b.continuous),nativeGrade.bonds.map(b=>b.continuous));
  assert.equal(nativeGrade.jointPartialPixelPass,false);assert.equal(cpuGrade.jointPartialPixelPass,false);
  assert.ok(nativeGrade.bonds.find(b=>b.index===34).continuous<7.75);
});
