import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assessDiagnosticPreflight,assessDiagnosticSourceAuthority} from '../scripts/diagnostic-preflight-contract.mjs';

const sourceAuthority=assessDiagnosticSourceAuthority({checkedOutHeadSha:'1b4274ea8197ce94c21925ddb177cc2f07b5e30d',explicitSourceSha:'1b4274ea8197ce94c21925ddb177cc2f07b5e30d',expectedPrHeadSha:'1b4274ea8197ce94c21925ddb177cc2f07b5e30d',githubEventSha:'f8c8facd88c31a0a813703628d98d45a732b7094',baselineSha:'4bc202c0eb1f51de0350c3a0b4be36c7178cba53',isPullRequest:true});
const identityEvidence={expectedIdentity:{pid:31,tid:31,processAuthority:{available:true}},rawObservedIdentity:{processComm:'chrome',threadComm:'CrRendererMain'},parsedIdentity:{processType:'renderer'},procReadStatus:{process:{stat:{available:true}}},rejectionReason:null};
const ready={browserStarted:true,pageInitialized:true,traceCapability:{traceCompletion:'AVAILABLE',usableTrace:true},pageRenderer:{available:true,identity:{pid:31,tid:31}},rendererResolution:{status:'RENDERER_THREAD_RESOLVED'},rendererIdentityEvidence:identityEvidence,sourceAuthority,schedulerClockMapping:{available:true,uncertaintyMs:.2},schedulerAttribution:{perStep:[{available:true,adequate:true,identityStable:true,samplePairCount:12,runtimeMs:74,runQueueWaitMs:1,sampleCoverageMs:76,coverageRatio:.95}]},busyResult:{durationMs:80,iterations:10000},rawTraceArtifact:'/tmp/preflight.trace.json'};

test('source SHA authority uses checked out PR HEAD and preserves event merge SHA separately',()=>{
  assert.equal(sourceAuthority.accepted,true);assert.equal(sourceAuthority.sourceSha,'1b4274ea8197ce94c21925ddb177cc2f07b5e30d');assert.equal(sourceAuthority.githubEventSha,'f8c8facd88c31a0a813703628d98d45a732b7094');assert.notEqual(sourceAuthority.sourceSha,sourceAuthority.githubEventSha);
});

test('source SHA authority rejects merge-ref substitution, mismatches and missing values',()=>{
  const wrongExplicit=assessDiagnosticSourceAuthority({checkedOutHeadSha:'1b4274ea8197ce94c21925ddb177cc2f07b5e30d',explicitSourceSha:'f8c8facd88c31a0a813703628d98d45a732b7094',expectedPrHeadSha:'1b4274ea8197ce94c21925ddb177cc2f07b5e30d',isPullRequest:true});
  assert.equal(wrongExplicit.accepted,false);assert.ok(wrongExplicit.failedChecks.includes('sourceShaMatchesCheckout'));
  const wrongHead=assessDiagnosticSourceAuthority({checkedOutHeadSha:'1b4274ea8197ce94c21925ddb177cc2f07b5e30d',explicitSourceSha:'1b4274ea8197ce94c21925ddb177cc2f07b5e30d',expectedPrHeadSha:'c2b106ee97a4148084507fc1d3e3eaab61759062',isPullRequest:true});
  assert.equal(wrongHead.accepted,false);assert.ok(wrongHead.failedChecks.includes('sourceShaMatchesExpectedPrHead'));
  const missing=assessDiagnosticSourceAuthority({checkedOutHeadSha:'1b4274ea8197ce94c21925ddb177cc2f07b5e30d',isPullRequest:true});
  assert.equal(missing.accepted,false);assert.ok(missing.failedChecks.includes('explicitSourceShaAvailable'));assert.ok(missing.failedChecks.includes('expectedPrHeadShaAvailable'));
});

test('preflight early failure still writes checked-out and event SHA evidence',async()=>{
  const testDir=await mkdtemp(join(tmpdir(),'molecule-craft-preflight-finalization-')),output=join(testDir,'preflight.json'),repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),head=spawnSync('git',['rev-parse','HEAD'],{cwd:repoRoot,encoding:'utf8'}).stdout.trim(),eventSha='f8c8facd88c31a0a813703628d98d45a732b7094';
  try{
    const result=spawnSync(process.execPath,[join(repoRoot,'scripts/preflight-reaction-lab-diagnostics.mjs')],{cwd:repoRoot,encoding:'utf8',env:{...process.env,DIAGNOSTIC_PREFLIGHT_OUTPUT:output,DIAGNOSTIC_SOURCE_SHA:'0'.repeat(40),DIAGNOSTIC_EXPECTED_PR_HEAD_SHA:'0'.repeat(40),DIAGNOSTIC_GITHUB_EVENT_SHA:eventSha,DIAGNOSTIC_BASELINE_SHA:'4bc202c0eb1f51de0350c3a0b4be36c7178cba53',GITHUB_EVENT_NAME:'pull_request'}});
    const report=JSON.parse(await readFile(output,'utf8'));
    assert.equal(result.status,1);assert.equal(report.sourceSha,head);assert.equal(report.checkedOutSourceSha,head);assert.equal(report.githubEventSha,eventSha);assert.notEqual(report.sourceSha,eventSha);assert.ok(report.failedChecks.includes('sourceShaMatchesCheckout'));assert.ok(report.failedChecks.includes('sourceShaMatchesExpectedPrHead'));assert.equal(report.preflightAccepted,false);assert.ok(report.failure);
  }finally{await rm(testDir,{recursive:true,force:true});}
});

test('diagnostic preflight accepts resolved renderer runtime and scheduler wait with trace coverage',()=>{
  const report=assessDiagnosticPreflight(ready);
  assert.equal(report.preflightAccepted,true);assert.deepEqual(report.failedChecks,[]);assert.equal(report.preflightChecks.threadRuntimeCounter,true);assert.equal(report.preflightChecks.schedulerWaitCounter,true);assert.equal(report.preflightChecks.counterCoverageAdequate,true);assert.equal(report.preflightChecks.procIdentityEvidenceSaved,true);assert.equal(report.preflightChecks.sourceShaAuthority,true);
});

test('diagnostic preflight blocks full campaign when identity, counters or clock coverage is missing',()=>{
  const report=assessDiagnosticPreflight({...ready,rendererResolution:{status:'RENDERER_THREAD_UNAVAILABLE',reason:'thread-not-visible'},schedulerClockMapping:{available:false,reason:'fewer-than-two-clock-pairs'},schedulerAttribution:{perStep:[{available:false,adequate:false,samplePairCount:0,runtimeMs:null,runQueueWaitMs:null}]},rawTraceArtifact:null});
  assert.equal(report.preflightAccepted,false);assert.ok(report.failedChecks.includes('linuxPidTidResolved'));assert.ok(report.failedChecks.includes('threadRuntimeCounter'));assert.ok(report.failedChecks.includes('schedulerWaitCounter'));assert.ok(report.failedChecks.includes('clockMappingAvailable'));assert.ok(report.failedChecks.includes('counterCoverageAdequate'));assert.ok(report.failedChecks.includes('traceArtifactSaved'));
});

test('preflight blocks a report that omits rejected proc identity evidence or source authority',()=>{
  const report=assessDiagnosticPreflight({...ready,rendererIdentityEvidence:{expectedIdentity:{pid:31,tid:31,processAuthority:{available:true}},rejectionReason:'process-type-flag-absent'},sourceAuthority:{accepted:false,failedChecks:['sourceShaMatchesCheckout']}});
  assert.equal(report.preflightAccepted,false);assert.ok(report.failedChecks.includes('procIdentityEvidenceSaved'));assert.ok(report.failedChecks.includes('sourceShaAuthority'));
});

test('preflight accepts an available zero scheduler-wait delta without converting missing counters to zero',()=>{
  const report=assessDiagnosticPreflight({...ready,schedulerAttribution:{perStep:[{available:true,adequate:true,identityStable:true,samplePairCount:12,runtimeMs:80,runQueueWaitMs:0}]}});
  assert.equal(report.preflightAccepted,true);assert.equal(report.schedulerStep.runQueueWaitMs,0);
  const missing=assessDiagnosticPreflight({...ready,schedulerAttribution:{perStep:[{available:false,adequate:false,samplePairCount:0,runtimeMs:null,runQueueWaitMs:null}]}});
  assert.equal(missing.preflightAccepted,false);assert.equal(missing.schedulerStep.runQueueWaitMs,null);
});
