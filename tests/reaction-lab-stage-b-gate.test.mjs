import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const audit=JSON.parse(await readFile(new URL('../generated/reaction-lab-stage-b-audit.json',import.meta.url),'utf8'));

test('committed Stage B evidence has consistent fixed-parameter PASS/FAIL decision',()=>{
  const result=spawnSync(process.execPath,['scripts/audit-reaction-lab-stage-b-gate.mjs','--check'],{encoding:'utf8'});
  assert.equal(result.status,0,`${result.stdout}${result.stderr}`);
  assert.equal(audit.qA,.15);
  assert.equal(audit.virtualSiteDistanceAngstrom,.47);
  assert.equal(audit.productionCutover,audit.globalResult==='PASS');
  assert.equal(audit.fixtures['water-acetone'].pass,true);
  assert.equal(audit.fixtures['water-water'].pass,true);
  assert.deepEqual(audit.failureClassification,audit.globalResult==='PASS'?[]:assertAllowedFailure(audit.failureClassification));
  assert.equal(audit.acceptanceGates.waterAcetoneRadialPreservation,true);
  assert.equal(audit.acceptanceGates.continuity,true);
  assert.equal(audit.performance.optimization.beforeOptimization.stageA.p95StepMs,28.019801);
  assert.equal(audit.performance.optimization.beforeOptimization.stageB.p95StepMs,30.438217);
  assert.ok(audit.performance.optimization.speedup.stageAP95>10);
  assert.ok(audit.performance.optimization.speedup.stageBP95>10);
  assert.ok(audit.performance.stageB.p95StepMs<=audit.performance.budgetPerPhysicsStepMs);
  assert.equal(audit.performance.optimization.hotPathProfile.stageBAugmentedBodyCopies,0);
  assert.equal(audit.performance.optimization.allocationCounters.temporaryVectorArraysPerPair,0);
});

test('Stage B evidence contains complete gates and no null or non-finite measurement',()=>{
  const expected=['water-water','water-acetone','water-pyridine','water-methane','water-carbon-dioxide','water-oxygen','water-nitrogen','carbonic-acid-carbon-dioxide'];
  for(const id of expected)assert.equal(typeof audit.fixtures[id]?.pass,'boolean',id);
  for(const id of ['formaldehyde','acetone','acetic-acid','ethyl-acetate','acetamide','benzaldehyde'])assert.equal(typeof audit.carbonylFamily.fixtures[id]?.pass,'boolean',id);
  const check=value=>{if(value===null)assert.fail('audit contains null');if(typeof value==='number')assert.ok(Number.isFinite(value));else if(Array.isArray(value))value.forEach(check);else if(value&&typeof value==='object')Object.values(value).forEach(check);};
  check(audit);
  assert.equal(audit.multipoleInvariants.allFiniteAndZeroMoments,true);
  assert.equal(audit.multipoleInvariants.qAUniform,true);
  assert.ok(audit.multipoleInvariants.rotationCovarianceMaxAbsDeltaAngstrom<=1e-8);
  assert.ok(audit.multipoleInvariants.atomOrderMaxAbsDeltaAngstrom<=1e-8);
  assert.equal(audit.partnerExchange.historyIndependent,true);
  assert.equal(audit.continuity.finite,true);
});

function assertAllowedFailure(items){
  assert.equal(items.length,1);
  assert.ok(['anisotropy-model-insufficient','anisotropy-overbinding','carbonyl-generalization-failure','nonbonded-regression','implementation-bug'].includes(items[0]));
  return items;
}
