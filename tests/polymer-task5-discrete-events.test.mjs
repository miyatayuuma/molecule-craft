// Retained evidence tests only: no new candidate, raster query, solver or GPU.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {bracketBoolean,laneSample,directory,prior} from '../scripts/recover-polymer-task5-discrete-events.mjs';
import {snapshot,frozen} from '../scripts/analyze-polymer-task5-orientation-feasibility.mjs';
import {png,grade} from '../scripts/analyze-polymer-task5-exact-mesh.mjs';
import {maskColor} from './helpers/polymer-task5-visual.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const protocol=read(directory+'protocol.json'),summary=read(directory+'summary.json');
const results=JSON.parse(gunzipSync(fs.readFileSync(directory+'results.json.gz')));

test('campaign hashes and caps bind every retained candidate without regeneration',()=>{
  assert.equal(sha(fs.readFileSync(directory+'protocol.json')),fs.readFileSync(directory+'protocol.sha256','utf8').trim());
  for(const f of [...protocol.sources,...protocol.inputs])assert.equal(sha(fs.readFileSync(f.path)),f.sha256,f.path);
  const candidates=read(directory+'candidates.json');
  assert.equal(summary.evaluations,results.rows.length);
  assert.ok(candidates.length<=24&&results.rows.length<=24);
  assert.equal(new Set(candidates.map(c=>JSON.stringify(c.pose))).size,candidates.length);
  for(const r of results.rows)assert.deepEqual(r.pose,candidates.find(c=>c.id===r.id).pose);
  assert.equal(summary.fullFrameRasters,0);assert.equal(summary.GPUCalls,0);
  assert.equal(summary.status,'UNRESOLVED');assert.equal(summary.certifiedExcludedRegions,0);
  for(const f of read(directory+'production-after.json'))assert.equal(sha(fs.readFileSync(f.path)),f.sha256);
});

test('all six stored native masks agree with the independent formal grader',()=>{
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

test('observed boundary pairs have real ownership or ceil changes; aggregate losses remain failures',()=>{
  for(const [a,b] of [[results.rows[0],results.rows[1]],[results.rows[4],results.rows[5]]]){
    assert.equal(a.areaEvents[2].owner,6);assert.equal(b.areaEvents[2].owner,1057);
    assert.equal(a.areaEvents[2].occluderCovered,true);assert.equal(b.areaEvents[2].occluderCovered,false);
    const A=new Set(a.objects.find(o=>o.id===1057).visiblePixels.map(p=>p.join(',')));
    const B=new Set(b.objects.find(o=>o.id===1057).visiblePixels.map(p=>p.join(',')));
    assert.ok(!A.has('185,235')&&B.has('185,235'));
    assert.equal(a.jointPass,false);assert.equal(b.jointPass,false);
  }
  const [a,b]=[results.rows[2],results.rows[3]];
  assert.equal(a.eventActual.steps,26);assert.equal(b.eventActual.steps,27);
  const B=b.objects.find(o=>o.id===1058);assert.equal(B.branch.bestEnd-B.branch.bestStart,16);
  assert.ok(B.branch.continuous<7.75);assert.equal(B.pass,false);
});

test('equal endpoint predicates are unresolved, not a claim that no interior event exists',()=>{
  const e=bracketBoolean(t=>t>.2&&t<.8);assert.equal(e.bracketed,false);
  assert.match(e.reason,/no monotonicity or absence/);
  const r=bracketBoolean(t=>t>=.3);assert.ok(r.lo<.3&&r.hi>=.3);
  // Use the formal multiplication order, including at integer cell boundaries.
  assert.deepEqual(laneSample({a:{x:1,y:2},b:{x:1,y:15}},10,-.5,26),{x:1.5,y:7,length:13});
});
