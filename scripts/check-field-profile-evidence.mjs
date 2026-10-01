// Retained five-run authority is checked offline; timings never become CI budgets.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {EXPECTED,verifyProfile,summarizeProfile,classifyProfile} from './summarize-field-profile.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=join(root,'tests/fixtures/field-particle-p5');
const manifest=JSON.parse(await readFile(join(dir,'evidence.json')));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const phases={};
for(const [phase,entry]of Object.entries(manifest.primary)){
  const bytes=await readFile(join(dir,entry.file));assert.equal(sha(bytes),entry.sha256,phase+' raw bytes');
  phases[phase]=JSON.parse(gunzipSync(bytes));
}
const variants={coarse:['baseline','complete'],components:['complete','noGlow','noCenter','noFlow','noCarbon','cullOnly'],history:['p1','p2','p3','p4']};
const stages={p1:'da356db2d1f86f1d6b2e0533e07a4af7cad36030',p2:'a331c09c52a9579a8f4d7016402aa57028af9b42',p3:'53ddf5c0fa766fd0cdf35375a2f7e0679612753f',p4:'eda186afb36a485f9f4becf472c4faa9a95ede9c'};
const stats=values=>{const a=[...values].sort((a,b)=>a-b);return {median:a[Math.floor(a.length*.5)],p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1),mean:a.reduce((s,x)=>s+x,0)/a.length};};
const checkStats=(values,recorded)=>{assert.ok(values.length);assert.ok(values.every(x=>Number.isFinite(x)&&x>=0));const actual=stats(values);for(const key of Object.keys(actual)){assert.ok(Number.isFinite(recorded?.[key]),'Missing timing statistic');assert.ok(Math.abs(actual[key]-recorded[key])<=1e-8,'Statistic differs from retained raw samples');}};
for(const [phase,required]of Object.entries(variants)){
  const report=phases[phase];assert.ok(report,phase+' missing');assert.equal(report.mode,phase);assert.equal(report.smoke,false);assert.equal(report.runs,5);
  assert.equal(report.browser.revision,'@86cee6df69e0463a839c0cc8435c9d4c259434d3');
  assert.deepEqual(report.viewport,[390,844]);assert.equal(report.deviceScaleFactor,2);
  verifyProfile(report);
  assert.deepEqual(report.runtimeSourceSha256,manifest.runtimeSourceSha256);
  if(phase==='history')for(const [stage,basis]of Object.entries(stages))assert.equal(report.stageSources[stage].basis,basis,'Historical revision differs');
  for(const row of report.results){
    assert.deepEqual(row.canvas,[683,1477],'Production DPR/backing dimensions differ');
    for(const [raw,recorded]of [['cpu','frameCpuMs'],['simulation','simulationMs'],['render','renderMs'],['raf','rafIntervalMs']])checkStats(row.raw[raw],row[recorded]);
    assert.equal(row.raw.raf.length,(row.frames??row.samples)-1);
    if(row.sections){
      for(const [name,recorded]of Object.entries(row.sections)){assert.equal(row.raw.sections[name].length,row.frames);checkStats(row.raw.sections[name],recorded);}
      for(const [raw,recorded]of [['query','queryMs'],['sort','stableOrderMs'],['candidates','candidateSummary'],['rendered','renderedSummary']])checkStats(row.raw[raw],row[recorded]);
      assert.ok(row.raw.candidates.every(x=>Number.isInteger(x)&&x>=0));assert.ok(row.raw.rendered.every(x=>Number.isInteger(x)&&x>=0));
      for(let i=0;i<row.frames;i++){assert.ok(row.raw.query[i]<=row.raw.sections.dust[i]+1e-6);const sections=Object.values(row.raw.sections).reduce((sum,values)=>sum+values[i],0);assert.ok(sections<=row.raw.render[i]+1e-6,'Section accounting exceeds renderer total');}
    }
  }
  assert.equal(report.results.length,4*2*required.length*5,phase+' condition coverage');
  for(const name of Object.keys(EXPECTED))for(const reduced of [false,true])for(const variant of required){
    const rows=report.results.filter(r=>r.name===name&&r.reduced===reduced&&(phase==='history'?r.stage:r.variant)===variant);
    assert.equal(rows.length,5,'Missing declared condition');assert.ok(rows.every(r=>(r.frames??r.samples)===(phase==='components'?60:180)));
    assert.ok(rows.every(r=>JSON.stringify(r.dimensions??[390,844])==='[390,844]'));
  }
}
assert.deepEqual(classifyProfile(summarizeProfile(phases.coarse)),manifest.decision);
const browser=phases.browser;assert.ok(browser,'Browser counter/visual evidence missing');
assert.equal(browser.browser.revision,'@86cee6df69e0463a839c0cc8435c9d4c259434d3');assert.deepEqual(browser.runtimeSourceSha256,manifest.runtimeSourceSha256);
assert.equal(browser.results.length,8);
for(const name of Object.keys(EXPECTED))for(const reduced of [false,true]){
  const r=browser.results.find(r=>r.name===name&&r.reduced===reduced);assert.ok(r);
  const c=r.counters,e=EXPECTED[name];assert.equal(c.assistScanned+c.pickupScanned,e.assist);
  assert.equal(c.dynamicScanned,e.dynamic);assert.equal(c.dynamicUpdated,e.dynamic);assert.equal(c.dynamicStaticVisited,0);
  assert.equal(c.renderScanned,e.render);assert.equal(c.rendered,e.draw);
}
const p1=JSON.parse(await readFile(join(root,'tests/fixtures/field-particle-p1/manifest.json')));assert.equal(manifest.visuals.length,18);
for(const original of p1.visuals){
  const check=manifest.visuals.find(r=>r.file===original.file);assert.ok(check);assert.equal(check.baseline,original.sha256);assert.equal(check.actual,original.sha256);assert.equal(check.equal,true);
  assert.equal(sha(await readFile(join(root,'tests/fixtures/field-particle-p1',original.file))),original.sha256);
}
assert.equal(sha(await readFile(join(root,'tests/fixtures/field-particle-p1/gameplay.json'))),'3938a1d9cca2578f6e21ef65cfa4ca7bc4504e603d98b91fef0b013ddb8c50bb');
if(process.argv.includes('--current'))for(const [path,expected]of Object.entries(manifest.runtimeSourceSha256))assert.equal(sha(await readFile(join(root,path))),expected,'Final runtime differs from captured authority: '+path);
console.log('P5 retained authority PASS: all conditions/five runs/raw hashes, P2/P3/P4 counters, frozen gameplay/18 visual hashes; no timing gate.');
