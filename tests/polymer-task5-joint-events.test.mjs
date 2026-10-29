// Retained ownership regrading only. No solver, new native evaluation or GPU.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {snapshot,frozen} from '../scripts/analyze-polymer-task5-orientation-feasibility.mjs';
import {png,grade} from '../scripts/analyze-polymer-task5-exact-mesh.mjs';
import {maskColor} from './helpers/polymer-task5-visual.mjs';
const directory='docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-joint-events-bc184092/';
const read=p=>JSON.parse(fs.readFileSync(p));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const protocol=read(directory+'protocol.json'),summary=read(directory+'summary.json');
const results=JSON.parse(gunzipSync(fs.readFileSync(directory+'results.json.gz')));
test('joint protocol, production identity, budgets and candidates remain verifiable',()=>{
 assert.equal(sha(directory+'protocol.json'),fs.readFileSync(directory+'protocol.sha256','utf8').trim());
 for(const f of [...protocol.sources,...protocol.inputs])assert.equal(sha(f.path),f.sha256,f.path);
 const c=read(directory+'candidates.json');assert.equal(c.length,12);assert.equal(results.rows.length,12);
 assert.equal(new Set(c.map(r=>JSON.stringify(r.pose))).size,c.length);
 assert.equal(summary.constructions,12);assert.equal(summary.CPURasters,0);assert.equal(summary.GPUCalls,0);
 for(const r of results.rows)assert.deepEqual(r.pose,c.find(c=>c.id===r.id).pose);
 for(const f of read(directory+'production-after.json'))assert.equal(sha(f.path),f.sha256);
});
test('all twelve stored native masks agree with the independent formal grader',()=>{
  for(const row of results.rows){
    const s=snapshot(row.pose),W=s.visual.canvas.bufferWidth,H=s.visual.canvas.bufferHeight;
    // Reassemble *retained* raw target ownership, never re-render a candidate.
    // All other IDs may be background because only these 21 IDs are graded.
    const pixels=Buffer.alloc(W*H*3),occupied=new Set();
    for(const o of row.objects)for(const [x,y] of o.rawPixels){
      const n=y*W+x;assert.ok(!occupied.has(n));occupied.add(n);
      const c=maskColor(o.id);pixels[3*n]=c>>16;pixels[3*n+1]=c>>8;pixels[3*n+2]=c;
    }
    const g=grade(png({pixels,width:W,height:H}),{anchor:30,snapshot:s,domOcclusions:frozen.views[0].domOcclusions});
    assert.equal(g.jointPartialPixelPass,row.objects.every(o=>o.pass));
    for(const a of g.atoms){const o=row.objects.find(o=>o.kind==='atom'&&o.index===a.index);
      assert.equal(a.pass,o.pass);assert.ok(Math.abs(a.visibleFraction-.6*o.visiblePixels.length/o.required)<1e-12);}
    for(const b of g.bonds){const o=row.objects.find(o=>o.kind==='bond'&&o.index===b.index);
      assert.equal(b.visiblePixels,o.visiblePixels.length);assert.equal(b.pass,o.pass);
      assert.equal(b.continuous,o.branch.continuous);assert.equal(b.requiredPixels,o.required);}
  }
});

test('paired coverage changes do not imply aggregate feasibility; four B runs actually pass',()=>{
 let passes=0;
 for(let i=0;i<results.rows.length;i+=2){const a=results.rows[i],b=results.rows[i+1];
  assert.notEqual(a.H5Covered,b.H5Covered);assert.equal(a.construction,b.construction);
  assert.equal(a.ownership[2].owner.id,6);assert.equal(b.ownership[2].owner.id,1057);
  for(const r of [a,b]){const o=r.objects.find(o=>o.index===34&&o.kind==='bond');if(o.pass){passes++;assert.equal(o.branch.steps,27);assert.equal(o.branch.bestEnd-o.branch.bestStart,16);assert.ok(o.branch.continuous>=7.75);}
   assert.equal(r.jointPass,false);assert.equal(r.objects.find(o=>o.id===1056).pass,false);assert.equal(r.objects.find(o=>o.id===1057).pass,false);
  }
 }
 assert.equal(passes,4);assert.equal(summary.status,'UNRESOLVED');
});
