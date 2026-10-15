import test from 'node:test';
import assert from 'node:assert/strict';
import {assessDiagnosticPreflight} from '../scripts/diagnostic-preflight-contract.mjs';

const ready={browserStarted:true,pageInitialized:true,traceCapability:{traceCompletion:'AVAILABLE',usableTrace:true},pageRenderer:{available:true,identity:{pid:31,tid:31}},rendererResolution:{status:'RENDERER_THREAD_RESOLVED'},schedulerClockMapping:{available:true,uncertaintyMs:.2},schedulerAttribution:{perStep:[{available:true,adequate:true,samplePairCount:12,runtimeMs:74,runQueueWaitMs:1,sampleCoverageMs:76,coverageRatio:.95}]},busyResult:{durationMs:80,iterations:10000},rawTraceArtifact:'/tmp/preflight.trace.json'};

test('diagnostic preflight accepts resolved renderer runtime and scheduler wait with trace coverage',()=>{
  const report=assessDiagnosticPreflight(ready);
  assert.equal(report.preflightAccepted,true);assert.deepEqual(report.failedChecks,[]);assert.equal(report.preflightChecks.threadRuntimeCounter,true);assert.equal(report.preflightChecks.schedulerWaitCounter,true);assert.equal(report.preflightChecks.counterCoverageAdequate,true);
});

test('diagnostic preflight blocks full campaign when identity, counters or clock coverage is missing',()=>{
  const report=assessDiagnosticPreflight({...ready,rendererResolution:{status:'RENDERER_THREAD_UNAVAILABLE',reason:'thread-not-visible'},schedulerClockMapping:{available:false,reason:'fewer-than-two-clock-pairs'},schedulerAttribution:{perStep:[{available:false,adequate:false,samplePairCount:0,runtimeMs:null,runQueueWaitMs:null}]},rawTraceArtifact:null});
  assert.equal(report.preflightAccepted,false);assert.ok(report.failedChecks.includes('linuxPidTidResolved'));assert.ok(report.failedChecks.includes('threadRuntimeCounter'));assert.ok(report.failedChecks.includes('schedulerWaitCounter'));assert.ok(report.failedChecks.includes('clockMappingAvailable'));assert.ok(report.failedChecks.includes('counterCoverageAdequate'));assert.ok(report.failedChecks.includes('traceArtifactSaved'));
});

test('preflight accepts an available zero scheduler-wait delta without converting missing counters to zero',()=>{
  const report=assessDiagnosticPreflight({...ready,schedulerAttribution:{perStep:[{available:true,adequate:true,samplePairCount:12,runtimeMs:80,runQueueWaitMs:0}]}});
  assert.equal(report.preflightAccepted,true);assert.equal(report.schedulerStep.runQueueWaitMs,0);
  const missing=assessDiagnosticPreflight({...ready,schedulerAttribution:{perStep:[{available:false,adequate:false,samplePairCount:0,runtimeMs:null,runQueueWaitMs:null}]}});
  assert.equal(missing.preflightAccepted,false);assert.equal(missing.schedulerStep.runQueueWaitMs,null);
});
