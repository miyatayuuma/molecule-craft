import test from 'node:test';
import assert from 'node:assert/strict';
import {attributeSlowIntervals,classifyTraceCapabilities,fitClockMapping,mapTraceClock,STAGE_B_TRACE_CATEGORIES} from '../scripts/stage-b-trace-attribution.mjs';
import {parseProcSchedstat,parseProcStatus,summarizeSchedulerSamples,summarizeSlowIntervals} from '../scripts/stage-b-runner-telemetry.mjs';

const rendererStep={stepIndex:0,available:true,adequate:true,pid:91,tid:92,threadName:'CrRendererMain',state:'R',runtimeMs:7,runQueueWaitMs:.2,sampleCoverageMs:8,samplePairCount:4};
const oneSlow=(options={})=>attributeSlowIntervals({label:'candidate',sourceSha:'candidate-sha',trialNumber:4,durationsMs:[10],stepWindowsMs:[[0,10]],budgetMs:8.333333333333334,...options});

test('explicit Chromium trace category set contains timing, V8, GC/JIT, task and user marks',()=>{
  assert.deepEqual(STAGE_B_TRACE_CATEGORIES,['devtools.timeline','disabled-by-default-devtools.timeline','v8','disabled-by-default-v8.gc','disabled-by-default-v8.compile','blink.user_timing','toplevel']);
});

test('clock mapping succeeds only with separated paired observations and returns uncertainty',()=>{
  const mapping=fitClockMapping([
    {sourceMs:100,targetLowMs:210.001,targetHighMs:210.009,sourceUncertaintyMs:.001},
    {sourceMs:200,targetLowMs:310.001,targetHighMs:310.009,sourceUncertaintyMs:.001},
  ]);
  assert.equal(mapping.available,true);assert.ok(Math.abs(mapping.slope-1)<1e-8);assert.ok(Math.abs(mapping.offset-110.005)<.001);assert.ok(mapping.uncertaintyMs<.02);
  assert.equal(fitClockMapping([{sourceMs:10,targetLowMs:10,targetHighMs:10}]).reason,'fewer-than-two-clock-pairs');
  assert.equal(fitClockMapping([{sourceMs:10,targetLowMs:10,targetHighMs:10},{sourceMs:11,targetLowMs:11,targetHighMs:11}]).reason,'clock-pairs-too-close');
});

test('browser performance marks map trace timestamps without assuming clock origins match',()=>{
  const events=[
    {name:'blink.user_timing',cat:'blink.user_timing',ph:'R',ts:100000,args:{data:{name:'sync-start'}}},
    {name:'blink.user_timing',cat:'blink.user_timing',ph:'R',ts:1100000,args:{data:{name:'sync-end'}}},
  ];
  const mapping=mapTraceClock(events,[{id:'sync-start',browserLowMs:40,browserHighMs:40.01},{id:'sync-end',browserLowMs:1040,browserHighMs:1040.01}]);
  assert.equal(mapping.available,true);assert.equal(mapping.matchedMarkerIds.length,2);assert.ok(Math.abs(mapping.offset+60)<.02);
  assert.equal(mapTraceClock([], [{id:'sync-start',browserLowMs:0,browserHighMs:0},{id:'sync-end',browserLowMs:10,browserHighMs:10}]).reason,'fewer-than-two-clock-pairs');
});

test('Linux schedstat and context-switch parsing reject absent or malformed counters',()=>{
  assert.deepEqual(parseProcSchedstat('123456 7890 42\n'),{runTimeNs:123456,runQueueWaitNs:7890,timeslices:42});
  assert.equal(parseProcSchedstat('123 456'),null);
  assert.deepEqual(parseProcStatus('Name:\tchrome\nvoluntary_ctxt_switches:\t17\nnonvoluntary_ctxt_switches:\t5\n'),{voluntaryContextSwitches:17,involuntaryContextSwitches:5});
  assert.equal(parseProcStatus('Name:\tchrome\n'),null);
});

test('scheduler samples map to browser steps and report only observed in-window deltas',()=>{
  const make=(atMs,runNs,waitNs)=>({readStartHrtimeNs:String((atMs-.01)*1e6),readEndHrtimeNs:String((atMs+.01)*1e6),threads:[{pid:91,tid:92,threadName:'CrRendererMain',state:'R',runTimeNs:runNs,runQueueWaitNs:waitNs,timeslices:1,cpuMs:runNs/1e6,voluntaryContextSwitches:1,involuntaryContextSwitches:0}]});
  const summary=summarizeSchedulerSamples([make(1,1e6,.1e6),make(2,1.9e6,.2e6),make(3,2.8e6,2.2e6),make(4,3.7e6,7.2e6),make(9,9e6,9e6)],{available:true,slope:1,offset:0},[[0,5]]);
  assert.equal(summary.available,true);assert.equal(summary.perStep[0].pid,91);assert.equal(summary.perStep[0].tid,92);assert.equal(summary.perStep[0].samplePairCount,3);assert.equal(summary.perStep[0].adequate,true);assert.ok(summary.perStep[0].runtimeMs>2.6&&summary.perStep[0].runtimeMs<2.8);assert.ok(summary.perStep[0].runQueueWaitMs>6.9&&summary.perStep[0].runQueueWaitMs<7.2);
});

test('a matched GC interval is attributed to V8_GC with exact profile identity',()=>{
  const rows=oneSlow({traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},traceEvents:[{name:'V8.GC_SCAVENGER',cat:'disabled-by-default-v8.gc',ph:'X',pid:91,tid:92,ts:3000,dur:7000}],schedulerPerStep:[rendererStep]});
  assert.equal(rows.length,1);assert.equal(rows[0].attributionClassification,'V8_GC');assert.equal(rows[0].label,'candidate');assert.equal(rows[0].sourceSha,'candidate-sha');assert.equal(rows[0].trialNumber,4);assert.equal(rows[0].stepIndex,0);assert.equal(rows[0].matchedTraceEvents.length,1);
});

test('thread CPU plus a matched FunctionCall distinguishes JavaScript execution',()=>{
  const rows=oneSlow({traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},traceEvents:[{name:'FunctionCall',cat:'devtools.timeline',ph:'X',pid:91,tid:92,ts:2000,dur:6000}],schedulerPerStep:[rendererStep]});
  assert.equal(rows[0].attributionClassification,'JS_EXECUTION');
});

test('a short GC marker is retained but cannot explain most of a slow step',()=>{
  const rows=oneSlow({traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},traceEvents:[{name:'V8.GC_SCAVENGER',cat:'disabled-by-default-v8.gc',ph:'X',pid:91,tid:92,ts:3000,dur:1000}],schedulerPerStep:[rendererStep]});
  assert.equal(rows[0].attributionClassification,'UNATTRIBUTED');assert.equal(rows[0].matchedTraceEvents.length,1);assert.equal(rows[0].evidence.gcCoverageMs,1);
});

test('renderer CPU plus explicit layout trace identifies another Chromium task',()=>{
  const rows=oneSlow({traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},traceEvents:[{name:'Layout',cat:'devtools.timeline',ph:'X',pid:91,tid:92,ts:1000,dur:7000}],schedulerPerStep:[rendererStep]});
  assert.equal(rows[0].attributionClassification,'CHROMIUM_OTHER_TASK');
});

test('V8 compile and JIT trace categories classify a dominant compile interval',()=>{
  const rows=oneSlow({traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},traceEvents:[{name:'V8.CompileOptimized',cat:'disabled-by-default-v8.compile',ph:'X',pid:91,tid:92,ts:1000,dur:7000}],schedulerPerStep:[rendererStep]});
  assert.equal(rows[0].attributionClassification,'V8_COMPILE_JIT');
});

test('high run-queue wait with low renderer runtime identifies scheduler wait',()=>{
  const rows=oneSlow({schedulerPerStep:[{...rendererStep,runtimeMs:1,runQueueWaitMs:8,sampleCoverageMs:9}]});
  assert.equal(rows[0].attributionClassification,'OS_SCHEDULER_WAIT');
});

test('sleeping renderer main thread with little runtime identifies blocked waiting',()=>{
  const rows=oneSlow({schedulerPerStep:[{...rendererStep,state:'S',runtimeMs:1,runQueueWaitMs:.1,sampleCoverageMs:9}]});
  assert.equal(rows[0].attributionClassification,'BLOCKED_OR_WAITING');
});

test('no trace, unknown TID or inadequate counters remain unattributed',()=>{
  assert.equal(oneSlow({schedulerPerStep:[rendererStep]})[0].attributionClassification,'UNATTRIBUTED');
  assert.equal(oneSlow({traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},traceEvents:[{name:'FunctionCall',cat:'devtools.timeline',ph:'X',pid:91,tid:92,ts:2000,dur:6000}],schedulerPerStep:[{...rendererStep,pid:null,tid:null}]})[0].attributionClassification,'UNATTRIBUTED');
  assert.equal(oneSlow({schedulerPerStep:[{...rendererStep,adequate:false}]})[0].attributionClassification,'UNATTRIBUTED');
});

test('slow-step clustering retains separate stops and baseline/candidate identities',()=>{
  const summary=summarizeSlowIntervals([5,9,10,7,11,12],[[100,105],[105,114],[114,124],[124,131],[131,142],[142,154]],8.333333333333334,100);
  assert.deepEqual(summary.consecutiveSlowRuns.map(run=>[run.firstStepIndex,run.lastStepIndex]),[[1,2],[4,5]]);
  const baseline=attributeSlowIntervals({label:'baseline',sourceSha:'base-sha',trialNumber:4,durationsMs:[10],stepWindowsMs:[[0,10]],schedulerPerStep:[rendererStep]});
  const candidate=oneSlow({schedulerPerStep:[rendererStep]});
  assert.equal(baseline[0].label,'baseline');assert.equal(baseline[0].sourceSha,'base-sha');assert.equal(candidate[0].label,'candidate');assert.equal(candidate[0].sourceSha,'candidate-sha');
});

test('trace capability report separates exposed methods from usable captured events',()=>{
  const report=classifyTraceCapabilities({categoriesAvailable:true,requestedCategories:['v8','disabled-by-default-v8.gc'],startSucceeded:true,clockSyncSucceeded:true,traceEndSucceeded:true,streamReadSucceeded:true,eventCount:100,threadMetadataCount:4});
  assert.equal(report.usableTrace,true);assert.equal(report.clockSyncMarker,'AVAILABLE');
  const missing=classifyTraceCapabilities({startSucceeded:true,traceEndSucceeded:false,streamReadSucceeded:false});assert.equal(missing.usableTrace,false);assert.equal(missing.traceStreamRead,'UNAVAILABLE');
});
