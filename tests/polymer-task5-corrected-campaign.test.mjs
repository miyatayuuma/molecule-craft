import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const root=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-corrected-6f85d3a4/',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const preflight=read('preflight.json'),protocol=read('protocol.json');

test('corrected preflight retains every area cell and validates nonzero OR branches and extracted poses',()=>{
  assert.equal(preflight.passAll,true);
  assert.equal(preflight.logic.implicationTruthCases,972);
  assert.equal(preflight.logic.oldSeedWitness.maxViolation,0);
  assert.equal(preflight.logic.activeSeedWitness.maxViolation,0);
  assert.equal(preflight.moleculeCandidateSolverCalls,0);
  assert.equal(preflight.newCPURasters,0);
  assert.deepEqual(preflight.fullActiveAreaAccounting.map(r=>r.id),[31,1056,1057,1058,1059]);
  assert.deepEqual(preflight.fullActiveAreaAccounting.map(r=>r.selectedCellVariables),[614,162,136,76,52]);
  for(const r of preflight.nonzeroSynthetic){
    assert.equal(r.status,0);
    assert.deepEqual(r.proposal.deltaDegrees,[r.sign*.25,0,0]);
    assert.deepEqual(r.proposal.rotationDegrees,[10+r.sign*.25,20,30]);
    assert.equal(r.proposal.maxConstraintViolation,0);
    for(const t of r.truth){
      const count=Number(Math.abs(t.deltaX)>=.2)+1+Number(r.sign*t.deltaX>=.25);
      assert.equal(t.visibleCells,count);
      assert.equal(t.feasible,count>=3);
    }
  }
});

test('fresh protocol binds source and inputs before exactly two corrected slots; old invalid slots stay separate',()=>{
  assert.equal(protocol.startHead,'6f85d3a4635c55fcde647207d94f469aeb1122f6');
  assert.deepEqual(protocol.trustBoxesDegrees,[1]);
  assert.deepEqual(protocol.bond34StepBranches,[26,27]);
  assert.deepEqual(protocol.areaSurplusPixels,[0]);
  assert.equal(protocol.candidateSlots,2);
  assert.equal(protocol.MILPTimeLimitSecondsPerSlot,30);
  assert.equal(protocol.MILPNodeLimitPerSlot,5000);
  assert.equal(protocol.CPUCap,6);assert.equal(protocol.GPUCap,1);
  assert.equal(read('campaign-started.json').protocolSHA256,hash(new URL('protocol.json',root)));
  for(const item of protocol.frozenFiles){
    const bytes=fs.readFileSync(new URL('../'+item.path,import.meta.url));
    assert.equal(bytes.length,item.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,item.path);
  }
  const candidates=read('candidates.json');
  const history=fs.readFileSync(new URL('candidate-history.jsonl',root),'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(candidates.rows.length,2);assert.deepEqual(history,candidates.rows);
  assert.deepEqual(candidates.rows.map(r=>r.steps34),[26,27]);
  for(const r of candidates.rows){
    assert.equal(r.radius,1);assert.equal(r.surplus,0);
    assert.equal(r.areaConstraints.length,5);
    assert.deepEqual(r.continuityBranches.map(c=>c.index),[32,34]);
    assert.deepEqual(r.boxInconsistentRows,[]);
    if(!r.hasIncumbent){assert.ok([1,2].includes(r.solver.status));assert.equal(r.primalActiveSet,null);assert.equal(r.rotationDegrees,undefined);}
  }
});

test('native evidence and disposition count only actual candidate rasters and preserve production bytes',()=>{
  const result=JSON.parse(gunzipSync(fs.readFileSync(new URL('results.json.gz',root))));
  assert.equal(result.rows.length,2);assert.equal(result.certifiedExcludedRegions,0);
  assert.equal(result.CPURasters,3*result.rows.filter(r=>r.hasIncumbent).length);
  assert.ok(result.CPURasters<=6);
  for(const r of result.rows){
    assert.equal(r.observations.length,r.hasIncumbent?3:0);
    for(const o of r.observations){assert.equal(o.grade.atoms.length,11);assert.equal(o.grade.bonds.length,10);}
  }
  assert.equal(result.CPUJointWitness,result.rows.some(r=>r.observations.length===3&&r.observations.every(o=>o.minimumMargin>=1)));
  for(const item of read('production-before.json'))assert.equal(hash(new URL('../'+item.path,import.meta.url)),item.sha256,item.path);
  const manifest=read('manifest.json');
  assert.equal(manifest.disposition,'UNRESOLVED');
  assert.equal(manifest.task5,'BLOCKED');
  assert.equal(manifest.newGPU,0);
  for(const item of manifest.files){
    const file=new URL('../'+item.path,import.meta.url);
    assert.equal(fs.statSync(file).size,item.bytes);
    assert.equal(hash(file),item.sha256,item.path);
  }
});
