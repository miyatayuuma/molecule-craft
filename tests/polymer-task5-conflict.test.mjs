import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {pngPixels,maskColor} from './helpers/polymer-task5-visual.mjs';

const dir='docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-conflict-c3d297fa';
const root=new URL('../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(dir+'/'+p,root)));
const compressed=p=>JSON.parse(gunzipSync(fs.readFileSync(new URL(p,root))));

test('retained conflict systems have complete provenance and byte-exact constructor replay without solves',()=>{
  const r=spawnSync('python',['-c',`import importlib.util,json\ns=importlib.util.spec_from_file_location('diagnosis','scripts/diagnose-polymer-task5-conflict.py')\nm=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nprint(json.dumps([dict(branch=n,rows=len(m.replay(n)[0]['rows'])) for n in [26,27]]))`],{cwd:root,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  assert.deepEqual(JSON.parse(r.stdout),[{branch:26,rows:60189},{branch:27,rows:60313}]);
  for(const n of [26,27]){
    const p=compressed(`${dir}/n${n}-provenance.json.gz`);
    assert.equal(p.rows.length,n===26?60189:60313);
    for(const category of ['rotationBounds','area','pixelCoverage','depthOrdering','depthOR','floorCell','ceilBranch','continuousLength','binaryImplication'])assert.ok(p.rows.some(r=>r.category===category),category);
    assert.deepEqual(p.rows.filter(r=>r.category==='area').map(r=>r.objectId),[31,1056,1057,1058,1059]);
  }
});

test('both approximate cores are group-minimal against fixed background, with independently checked deletion primals',()=>{
  const r=spawnSync('python',['scripts/verify-polymer-task5-conflict.py',dir],{cwd:root,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const cert=JSON.parse(r.stdout);
  assert.deepEqual(cert,read('certificates.json'));
  assert.equal(cert.executedDiagnosticSolverCalls,32);
  assert.equal(cert.solverCalls,0);
  assert.deepEqual(cert.originalTimeoutSerials,[16]);
  assert.deepEqual(cert.conflictingGroups,{'26':['area:1056','continuity:34'],'27':['continuity:32','continuity:34']});
  assert.equal(cert.groupMinimalCertificates.length,4);
  for(const p of cert.groupMinimalCertificates)assert.ok(Math.max(p.maxViolation,p.maxIntegralityViolation)<=1e-6);
  const history=read('history.json');
  assert.equal(history[15].classification,'UNKNOWN');
  assert.equal(cert.certifiedExcludedRegions,0);
  assert.equal(cert.trueGeometryFeasibility,'UNRESOLVED');
});

test('a retained native bond pixel contradicts the affine depth rejection while original visibility gates stay intact',()=>{
  const audit=compressed(dir+'/native-audit.json.gz');
  const o=audit.actualMask.objects.find(o=>o.id===1056),p=o.probes.find(p=>p.pixel==='157,262');
  const depth=p.rejectedOR.flat().find(f=>f.key==='depth:31:1056:157:262');
  assert.ok(depth.affineValue<0);
  assert.ok(depth.target.depth<depth.other.depth);
  assert.equal(depth.frontFacetChanged,false);
  const bytes=fs.readFileSync(new URL('docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-exact-mesh-519a686c/boundary-30-0-id.png',root));
  const mask=pngPixels(bytes),i=(262*mask.width+157)*mask.channels;
  assert.equal((mask.pixels[i]<<16)|(mask.pixels[i+1]<<8)|mask.pixels[i+2],maskColor(1056));
  assert.ok(audit.aggregate.every(r=>r.objects.find(o=>o.id===1057).areaError<0));
  assert.equal(audit.newCPURasters,0);assert.equal(audit.newGPUCalls,0);assert.equal(audit.newCandidatePoses,0);
});

test('fixed diagnosis budgets do not become new candidate, GPU or release acceptance',()=>{
  const p=read('protocol.json'),s=read('summary.json'),h=read('history.json');
  assert.equal(p.maxSolverCalls,32);assert.equal(p.secondsPerCall,20);assert.equal(p.nodesPerCall,2000);
  assert.equal(h.length,32);
  assert.equal(s.candidateSolverCalls,0);assert.equal(s.newCPURasters,0);assert.equal(s.newGPUCalls,0);
  assert.equal(s.trueGeometryFeasibility,'UNRESOLVED');
  assert.equal(read('authority.json').draft,true);
});
