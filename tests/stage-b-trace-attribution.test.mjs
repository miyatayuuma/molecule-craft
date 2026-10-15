import test from 'node:test';
import assert from 'node:assert/strict';
import {attributeSlowIntervals,classifyTraceCapabilities,fitClockMapping,mapNodeClockPairsToBrowserPerformance,mapNodeClockToBrowserViaCdpMarkers,mapTraceClock,STAGE_B_TRACE_CATEGORIES} from '../scripts/stage-b-trace-attribution.mjs';
import {PROC_CPU_COUNTER_RESOLUTION_MS,parseProcSchedstat,parseProcStatus,resolveRendererThreadIdentity,summarizeSchedulerSamples,summarizeSlowIntervals} from '../scripts/stage-b-runner-telemetry.mjs';

const rendererStep={clockMappingUncertaintyMs:.01,stepIndex:0,available:true,adequate:true,pid:91,tid:92,threadName:'CrRendererMain',state:'R',runtimeMs:7,runQueueWaitMs:.2,sampleCoverageMs:8,samplePairCount:4};
const oneSlow=(options={})=>attributeSlowIntervals({label:'candidate',sourceSha:'candidate-sha',trialNumber:4,durationsMs:[10],stepWindowsMs:[[0,10]],budgetMs:8.333333333333334,...options});

test('explicit Chromium trace category set contains timing, V8, GC/JIT, task and user marks',()=>{
  assert.deepEqual(STAGE_B_TRACE_CATEGORIES,['devtools.timeline','disabled-by-default-devtools.timeline','disabled-by-default-devtools.timeline.stack','disabled-by-default-v8.cpu_profiler','v8','disabled-by-default-v8.gc','disabled-by-default-v8.compile','blink.user_timing','toplevel']);
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

test('Node hrtime maps only through bracketed Browser performance markers',()=>{
  const mapping=mapNodeClockPairsToBrowserPerformance([
    {id:'a',nodeStartHrtimeMs:100,nodeEndHrtimeMs:100.02,browserClock:{browserLowMs:210,browserHighMs:210.01}},
    {id:'b',nodeStartHrtimeMs:120,nodeEndHrtimeMs:120.02,browserClock:{browserLowMs:230,browserHighMs:230.01}},
  ]);
  assert.equal(mapping.available,true);assert.ok(Math.abs(mapping.slope-1)<1e-8);assert.ok(mapping.uncertaintyMs<.03);
  assert.equal(mapNodeClockPairsToBrowserPerformance([{nodeStartHrtimeMs:100,nodeEndHrtimeMs:100.02,browserClock:{browserLowMs:210,browserHighMs:210.01}}]).reason,'fewer-than-two-clock-pairs');
  assert.equal(mapNodeClockPairsToBrowserPerformance([{nodeStartHrtimeMs:100,nodeEndHrtimeMs:100.02},{nodeStartHrtimeMs:120,nodeEndHrtimeMs:120.02}]).reason,'fewer-than-two-clock-pairs');
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

test('local CDP clock-sync pairs map Node scheduler samples with bounded uncertainty',()=>{
  const traceEvents=[
    {name:'clock_sync',cat:'__metadata',ph:'c',ts:500000,args:{sync_id:'trace-cdp-clock-candidate-measured-4-start'}},
    {name:'clock_sync',cat:'__metadata',ph:'c',ts:1500000,args:{sync_id:'trace-cdp-clock-candidate-measured-4-end'}},
  ];
  const cdpMarkers=[
    {syncId:'trace-cdp-clock-candidate-measured-4-start',success:true,nodeStartHrtimeMs:999.8,nodeEndHrtimeMs:1000.2},
    {syncId:'trace-cdp-clock-candidate-measured-4-end',success:true,nodeStartHrtimeMs:1999.8,nodeEndHrtimeMs:2000.2},
  ];
  const mapping=mapNodeClockToBrowserViaCdpMarkers({traceEvents,cdpMarkers,traceClockMapping:{available:true,slope:1,offset:-100,uncertaintyMs:.02},markerSuffixes:['measured-4-start','measured-4-end']});
  assert.equal(mapping.available,true);assert.ok(Math.abs(mapping.slope-1)<1e-8);assert.ok(Math.abs(mapping.offset+600)<.01);assert.equal(mapping.pairs.length,2);assert.ok(mapping.uncertaintyMs<.3);
  const failed=mapNodeClockToBrowserViaCdpMarkers({traceEvents:[],cdpMarkers,traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.02},markerSuffixes:['measured-4-start','measured-4-end']});
  assert.equal(failed.available,false);assert.equal(failed.reason,'fewer-than-two-clock-pairs');
  const noClock=mapNodeClockToBrowserViaCdpMarkers({traceEvents,cdpMarkers,traceClockMapping:{available:false},markerSuffixes:['measured-4-start','measured-4-end']});
  assert.equal(noClock.available,false);assert.equal(noClock.reason,'trace-to-browser-clock-unavailable');
});

test('Linux schedstat and context-switch parsing reject absent or malformed counters',()=>{
  assert.deepEqual(parseProcSchedstat('123456 7890 42\n'),{runTimeNs:123456,runQueueWaitNs:7890,timeslices:42});
  assert.equal(parseProcSchedstat('123 456'),null);
  assert.deepEqual(parseProcStatus('Name:\tchrome\nvoluntary_ctxt_switches:\t17\nnonvoluntary_ctxt_switches:\t5\n'),{voluntaryContextSwitches:17,involuntaryContextSwitches:5,namespaceIds:null});
  assert.equal(parseProcStatus('Name:\tchrome\n'),null);
});

const makeThreadSample=(atMs,runNs,waitNs,{pid=91,tid=92,threadName='CrRendererMain',processStartTimeTicks=100,threadStartTimeTicks=101,...overrides}={})=>({readStartHrtimeNs:String((atMs-.01)*1e6),readEndHrtimeNs:String((atMs+.01)*1e6),threads:[{pid,tid,threadName,processType:'renderer',processStartTimeTicks,liveProcessStartTimeTicks:processStartTimeTicks,expectedProcessStartTimeTicks:processStartTimeTicks,startTimeTicks:threadStartTimeTicks,expectedThreadStartTimeTicks:threadStartTimeTicks,state:'R',available:true,runTimeNs:runNs,runQueueWaitNs:waitNs,timeslices:Math.round(runNs/1e6),cpuMs:runNs/1e6,userTicks:Math.floor(runNs/1e6),systemTicks:0,voluntaryContextSwitches:1,involuntaryContextSwitches:0,...overrides}]});

test('scheduler samples map to browser steps and report only observed in-window deltas',()=>{
  const make=(atMs,runNs,waitNs)=>makeThreadSample(atMs,runNs,waitNs);
  const summary=summarizeSchedulerSamples([make(1,1e6,.1e6),make(2,1.9e6,.2e6),make(3,2.8e6,2.2e6),make(4,3.7e6,7.2e6),make(9,9e6,9e6)],{available:true,slope:1,offset:0,uncertaintyMs:0},[[0,5]]);
  assert.equal(summary.available,true);assert.equal(summary.perStep[0].pid,91);assert.equal(summary.perStep[0].tid,92);assert.equal(summary.perStep[0].samplePairCount,3);assert.equal(summary.perStep[0].adequate,true);assert.ok(summary.perStep[0].runtimeMs>2.6&&summary.perStep[0].runtimeMs<2.8);assert.ok(summary.perStep[0].runQueueWaitMs>6.9&&summary.perStep[0].runQueueWaitMs<7.2);
  assert.equal(summary.clockMappingUncertaintyMs,0);
});

test('scheduler samples report clock uncertainty and exclude ambiguous boundary observations',()=>{
  const make=(atMs,runNs)=>makeThreadSample(atMs,runNs,0);
  const summary=summarizeSchedulerSamples([make(.5,.5e6),make(1,1e6),make(2,2e6),make(3,3e6),make(4.5,4.5e6)],{available:true,slope:1,offset:0,uncertaintyMs:.6},[[0,5]]);
  assert.equal(summary.perStep[0].clockMappingUncertaintyMs,.6);assert.equal(summary.perStep[0].samplePairCount,2);assert.equal(summary.perStep[0].sampleCoverageMs,2);
  const tooUncertain=summarizeSchedulerSamples([make(1,1e6),make(2,2e6)],{available:true,slope:1,offset:0,uncertaintyMs:3},[[0,5]]);
  assert.equal(tooUncertain.perStep[0].available,false);
});

test('renderer process CPU ticks retain their resolution limit for short steps',()=>{
  const make=(atMs,cpuMs)=>({...makeThreadSample(atMs,atMs*1e6,0),processes:[{pid:91,state:'R',cpuMs,threadCount:1,threadIds:[91]}]});
  const mapping={available:true,slope:1,offset:0,uncertaintyMs:0};
  const short=summarizeSchedulerSamples([make(1,100),make(5,110),make(9,110)],mapping,[[0,10]]).perStep[0];
  assert.equal(short.rendererProcessCpuMs,null);assert.equal(short.rendererProcessCpuObservedDeltaMs,10);assert.equal(short.rendererProcessCpuCounterResolutionMs,PROC_CPU_COUNTER_RESOLUTION_MS);assert.equal(short.rendererProcessCpuCounterAdequate,false);
  const long=summarizeSchedulerSamples([make(1,100),make(11,110),make(21,120),make(31,130),make(41,140),make(49,150)],mapping,[[0,50]]).perStep[0];
  assert.equal(long.rendererProcessCpuMs,50);assert.equal(long.rendererProcessCpuCounterAdequate,true);
});

test('renderer identity resolution requires matching PID/TID, process type, thread name and start identity',()=>{
  const identity={pid:91,tid:92,threadName:'CrRendererMain'},candidate={pid:91,tid:92,threadName:'CrRendererMain',processType:'renderer',processStartTimeTicks:100,expectedProcessStartTimeTicks:100,threadStartTimeTicks:101,expectedThreadStartTimeTicks:101,available:true};
  assert.equal(resolveRendererThreadIdentity({traceIdentity:identity,linuxCandidates:[candidate]}).status,'RENDERER_THREAD_RESOLVED');
  assert.equal(resolveRendererThreadIdentity({traceIdentity:{...identity,tid:93},linuxCandidates:[candidate],linuxProcesses:[candidate]}).reason,'thread-not-visible');
  assert.equal(resolveRendererThreadIdentity({traceIdentity:identity,linuxCandidates:[{...candidate,pid:191}],linuxProcesses:[{...candidate,pid:191}]}).reason,'process-not-visible');
  assert.equal(resolveRendererThreadIdentity({traceIdentity:identity,linuxCandidates:[{...candidate,expectedProcessStartTimeTicks:999}]}).reason,'process-or-thread-identity-changed');
  assert.equal(resolveRendererThreadIdentity({traceIdentity:identity,linuxCandidates:[{...candidate,threadName:'CrBrowserMain'}]}).reason,'thread-name-mismatch');
});

test('renderer discovery reports a visible process from another PID namespace explicitly',()=>{
  const result=resolveRendererThreadIdentity({traceIdentity:{pid:91,tid:92,threadName:'CrRendererMain'},linuxCandidates:[],linuxProcesses:[{pid:191,processType:'renderer',pidNamespace:'pid:[2]',namespaceIds:[191]}],rootPidNamespace:'pid:[1]'});
  assert.equal(result.status,'RENDERER_THREAD_UNAVAILABLE');assert.equal(result.reason,'pid-namespace-mismatch');
});

test('renderer PID/TID can resolve through matching NSpid namespace pairs',()=>{
  const candidate={pid:191,tid:192,threadName:'CrRendererMain',processType:'renderer',processStartTimeTicks:100,expectedProcessStartTimeTicks:100,threadStartTimeTicks:101,expectedThreadStartTimeTicks:101,processNamespaceIds:[191,91],threadNamespaceIds:[192,92],available:true};
  const result=resolveRendererThreadIdentity({traceIdentity:{pid:91,tid:92,threadName:'CrRendererMain'},linuxCandidates:[candidate],linuxProcesses:[{pid:191,processType:'renderer',namespaceIds:[191,91]}]});
  assert.equal(result.status,'RENDERER_THREAD_RESOLVED');assert.equal(result.matchMethod,'trace-pid-tid-namespace-map');assert.equal(result.linuxIdentity.namespaceIndex,1);
  assert.equal(resolveRendererThreadIdentity({traceIdentity:{pid:91,tid:92,threadName:'CrRendererMain'},linuxCandidates:[{...candidate,threadNamespaceIds:[192,93]}],linuxProcesses:[{pid:191,processType:'renderer',namespaceIds:[191,91]}]}).reason,'thread-not-visible');
});

test('scheduler wait and CPU runtime are both reported when counters are available',()=>{
  const samples=[makeThreadSample(1,1e6,2e6),makeThreadSample(2,4e6,8e6)];
  const summary=summarizeSchedulerSamples(samples,{available:true,slope:1,offset:0,uncertaintyMs:0},[[.5,2.5]],{targetIdentity:{pid:91,tid:92,threadName:'CrRendererMain'},requireTargetIdentity:true});
  assert.equal(summary.status,'RENDERER_THREAD_RESOLVED');assert.equal(summary.perStep[0].runtimeMs,3);assert.equal(summary.perStep[0].runQueueWaitMs,6);assert.deepEqual(summary.perStep[0].contextSwitches,{voluntary:0,involuntary:0});assert.equal(summary.perStep[0].adequate,true);
});

test('scheduler samples report unavailable counters and inadequate coverage instead of zero deltas',()=>{
  const missing=[makeThreadSample(1,1e6,2e6,{available:false,reason:'schedstat-unavailable',runTimeNs:undefined,runQueueWaitNs:undefined}),makeThreadSample(2,1e6,2e6,{available:false,reason:'schedstat-unavailable',runTimeNs:undefined,runQueueWaitNs:undefined})];
  const clock={available:true,slope:1,offset:0,uncertaintyMs:0};
  const unavailable=summarizeSchedulerSamples(missing,clock,[[0,3]]);
  assert.equal(unavailable.identityResolved,true);assert.equal(unavailable.available,false);assert.equal(unavailable.perStep[0].available,false);assert.equal(unavailable.perStep[0].reason,'schedstat-unavailable');assert.equal(unavailable.perStep[0].runtimeMs,null);assert.equal(unavailable.perStep[0].runQueueWaitMs,null);assert.equal(unavailable.perStep[0].contextSwitches,null);assert.equal(unavailable.perStep[0].samplePairCount,0);assert.equal(unavailable.perStep[0].adequate,false);
  const sparse=summarizeSchedulerSamples([makeThreadSample(.5,1e6,0),makeThreadSample(1,2e6,0)],clock,[[0,10]]);
  assert.equal(sparse.perStep[0].sampleCoverageMs,.5);assert.equal(sparse.perStep[0].adequate,false);
});

test('a matched GC interval is attributed to V8_GC with exact profile identity',()=>{
  const rows=oneSlow({traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},traceEvents:[{name:'V8.GC_SCAVENGER',cat:'disabled-by-default-v8.gc',ph:'X',pid:91,tid:92,ts:3000,dur:7000}],schedulerPerStep:[rendererStep]});
  assert.equal(rows.length,1);assert.equal(rows[0].attributionClassification,'V8_GC');assert.equal(rows[0].label,'candidate');assert.equal(rows[0].sourceSha,'candidate-sha');assert.equal(rows[0].trialNumber,4);assert.equal(rows[0].stepIndex,0);assert.equal(rows[0].matchedTraceEvents.length,1);
});

test('a GC trace without adequate renderer CPU counters remains unattributed',()=>{
  const rows=oneSlow({traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},traceEvents:[{name:'V8.GC_SCAVENGER',cat:'disabled-by-default-v8.gc',ph:'X',pid:91,tid:92,ts:1000,dur:8000}],rendererMainThreads:[{pid:91,tid:92,threadName:'CrRendererMain'}]});
  assert.equal(rows[0].attributionClassification,'UNATTRIBUTED');assert.equal(rows[0].rendererPid,91);assert.equal(rows[0].evidence.gcCoverageMs,8);assert.equal(rows[0].matchedTraceEvents.length,1);
});

test('dominant scheduler wait takes precedence over a coincident GC trace',()=>{
  const rows=oneSlow({traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},traceEvents:[{name:'V8.GC_SCAVENGER',cat:'disabled-by-default-v8.gc',ph:'X',pid:91,tid:92,ts:1000,dur:8000}],schedulerPerStep:[{...rendererStep,runtimeMs:1,runQueueWaitMs:8,sampleCoverageMs:9}]});
  assert.equal(rows[0].attributionClassification,'OS_SCHEDULER_WAIT');assert.equal(rows[0].evidence.gcCoverageMs,8);
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
  const rows=oneSlow({traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},schedulerPerStep:[{...rendererStep,runtimeMs:1,runQueueWaitMs:8,sampleCoverageMs:9}]});
  assert.equal(rows[0].attributionClassification,'OS_SCHEDULER_WAIT');
});

test('sleeping renderer main thread with little runtime identifies blocked waiting',()=>{
  const rows=oneSlow({traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},schedulerPerStep:[{...rendererStep,state:'S',runtimeMs:1,runQueueWaitMs:.1,sampleCoverageMs:9}]});
  assert.equal(rows[0].attributionClassification,'BLOCKED_OR_WAITING');
});

test('no trace, unknown TID or inadequate counters remain unattributed',()=>{
  assert.equal(oneSlow({schedulerPerStep:[rendererStep]})[0].attributionClassification,'UNATTRIBUTED');
  assert.equal(oneSlow({traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},traceEvents:[{name:'FunctionCall',cat:'devtools.timeline',ph:'X',pid:91,tid:92,ts:2000,dur:6000}],schedulerPerStep:[{...rendererStep,pid:null,tid:null}]})[0].attributionClassification,'UNATTRIBUTED');
  assert.equal(oneSlow({schedulerPerStep:[{...rendererStep,adequate:false}]})[0].attributionClassification,'UNATTRIBUTED');
});

test('Chromium trace thread metadata identifies the renderer main thread without inventing scheduler counters',()=>{
  const rows=oneSlow({traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},traceEvents:[{name:'FunctionCall',cat:'devtools.timeline',ph:'X',pid:91,tid:92,ts:1000,dur:7000}],rendererMainThreads:[{pid:91,tid:92,threadName:'CrRendererMain'}]});
  assert.equal(rows[0].rendererPid,91);assert.equal(rows[0].rendererMainThreadTid,92);assert.equal(rows[0].evidence.identifiedThread,true);assert.equal(rows[0].rendererMainThreadCpuMs,null);assert.equal(rows[0].schedulerWaitMs,null);assert.equal(rows[0].attributionClassification,'UNATTRIBUTED');assert.equal(rows[0].matchedTraceEvents[0].name,'FunctionCall');
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
