import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {captureRunnerSnapshot,compareRunnerSnapshots,parseChromiumCommandLine,parseProcStat,parseProcStatus,resolveRendererThreadIdentity,summarizeSchedulerSamples,summarizeSlowIntervals} from '../scripts/stage-b-runner-telemetry.mjs';

const visibleProcSelfPid=process.platform==='linux'?Number(readFileSync('/proc/self/stat','utf8').split(' ')[0]):null;

test('Linux proc stat parsing preserves process names containing closing parentheses',()=>{
  const fields=['R','7','0','0','0','0','0','0','0','0','0','120','30',...Array(6).fill('0'),'9876'];
  const result=parseProcStat(`123 (chrome ) renderer) ${fields.join(' ')}`,123,100);
  assert.deepEqual(result,{pid:123,state:'R',parentPid:7,userTicks:120,systemTicks:30,startTimeTicks:9876,cpuMs:1500});
});

test('Linux proc status keeps PID namespace identifiers separate from context switches',()=>{
  const parsed=parseProcStatus('Name:\tCrRendererMain\nNSpid:\t194 31\nvoluntary_ctxt_switches:\t17\nnonvoluntary_ctxt_switches:\t5\n');
  assert.deepEqual(parsed,{voluntaryContextSwitches:17,involuntaryContextSwitches:5,namespaceIds:[194,31]});
});

test('Chromium process-type parsing supports both argv forms and keeps diagnostics bounded',()=>{
  const equals=parseChromiumCommandLine('/usr/lib/chromium/chromium\0--type=renderer\0--auth-token=do-not-store\0','chromium');
  const separate=parseChromiumCommandLine('/opt/google/chrome/chrome\0--type\0renderer\0--user-data-dir=/tmp/private-profile\0','chrome');
  assert.equal(equals.processType,'renderer');assert.equal(equals.processTypeReason,null);assert.equal(equals.isChromiumProcess,true);assert.equal(equals.executableName,'chromium');
  assert.equal(separate.processType,'renderer');assert.equal(separate.processTypeReason,null);assert.equal(separate.isChromiumProcess,true);assert.equal(separate.processTypeArgument,'--type renderer');
  assert.equal(JSON.stringify(equals).includes('do-not-store'),false);assert.equal(JSON.stringify(separate).includes('/tmp/private-profile'),false);
  const browser=parseChromiumCommandLine('/usr/bin/chrome\0--no-sandbox\0','chrome');
  assert.equal(browser.processType,'browser');assert.equal(browser.processTypeReason,'process-type-flag-absent');
  const gpu=parseChromiumCommandLine('/usr/bin/chrome\0--type=gpu-process\0','chrome');
  assert.equal(gpu.processType,'gpu-process');assert.equal(gpu.processTypeReason,'process-type-not-renderer');
  const empty=parseChromiumCommandLine('','Renderer');assert.equal(empty.processType,null);assert.equal(empty.processTypeReason,'cmdline-empty');
  const malformed=parseChromiumCommandLine('/usr/bin/chrome\0--type=renderer\0--type\0','chrome');assert.equal(malformed.processType,null);assert.equal(malformed.processTypeReason,'process-type-flag-missing-value');
  const opaque=parseChromiumCommandLine('/tmp/diagnostic-profile --type=renderer --renderer-client-id=6 --auth-token=do-not-store','chrome');assert.equal(opaque.processType,null);assert.equal(opaque.processTypeReason,'cmdline-not-argv-delimited');assert.equal(opaque.commandLine.format,'opaque-single-string');assert.equal(opaque.commandLine.executable,null);assert.equal(opaque.commandLine.processTypeFlagMarkerSeen,true);assert.equal(opaque.commandLine.rendererClientIdMarkerSeen,true);assert.equal(JSON.stringify(opaque).includes('do-not-store'),false);assert.equal(JSON.stringify(opaque).includes('/tmp/diagnostic-profile'),false);
});

test('C4 mismatch fixture separates expected trace identity from uncollected proc identity',async()=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/renderer-identity/c4-preflight-process-type-mismatch.json',import.meta.url),'utf8'));
  assert.equal(fixture.rawProcMetadataCaptured,false);assert.equal(fixture.expectedIdentity.tracePid,2721);assert.equal(fixture.expectedIdentity.traceTid,2721);assert.equal(fixture.observedIdentity.procPathPid,2721);assert.equal(fixture.observedIdentity.rejectionReason,'renderer-process-type-mismatch');assert.equal(fixture.observedIdentity.processComm,null);
  const result=resolveRendererThreadIdentity({traceIdentity:{pid:fixture.expectedIdentity.tracePid,tid:fixture.expectedIdentity.traceTid,threadName:fixture.expectedIdentity.traceThreadName,browserPid:fixture.expectedIdentity.browserPid},linuxCandidates:[],linuxProcesses:[]});
  assert.equal(result.status,'RENDERER_THREAD_UNAVAILABLE');
});

test('renderer identity requires one matching renderer thread and stable process/thread starts',()=>{
  const traceIdentity={pid:91,tid:92,threadName:'CrRendererMain',browserPid:10};
  const candidate={pid:91,tid:92,threadName:'CrRendererMain',processType:'renderer',processStartTimeTicks:100,expectedProcessStartTimeTicks:100,threadStartTimeTicks:101,expectedThreadStartTimeTicks:101,pidNamespace:'pid:[1]',available:true};
  const resolved=resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[candidate],linuxProcesses:[candidate]});
  assert.equal(resolved.status,'RENDERER_THREAD_RESOLVED');assert.equal(resolved.matchMethod,'trace-pid-tid-exact');
  assert.equal(resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[{...candidate,processStartTimeTicks:999}],linuxProcesses:[candidate]}).reason,'process-or-thread-identity-changed');
  assert.equal(resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[{...candidate,threadStartTimeTicks:999}],linuxProcesses:[candidate]}).reason,'process-or-thread-identity-changed');
  assert.equal(resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[{...candidate,threadName:'CrBrowserMain'}],linuxProcesses:[candidate]}).reason,'thread-name-mismatch');
  assert.equal(resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[candidate,{...candidate}],linuxProcesses:[candidate]}).reason,'multiple-unresolved-candidates');
});

test('renderer resolver rejects Browser-only and GPU identities and reports missing proc evidence precisely',()=>{
  const traceIdentity={pid:91,tid:92,threadName:'CrRendererMain',browserPid:10};
  const browser={pid:10,processType:'browser',isChromiumProcess:true,processTypeReason:'process-type-flag-absent'};
  assert.equal(resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[],linuxProcesses:[browser]}).status,'RENDERER_THREAD_UNAVAILABLE');
  const gpu={pid:91,tid:92,processType:'gpu-process',processTypeReason:'process-type-not-renderer',isChromiumProcess:true,threadName:'CrRendererMain',processStartTimeTicks:100,threadStartTimeTicks:101};
  assert.equal(resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[gpu],linuxProcesses:[gpu]}).reason,'process-type-not-renderer');
  const denied={...gpu,processType:'renderer',reason:'permission-denied',readStatus:{stat:{reason:'permission-denied'}}};
  assert.equal(resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[denied],linuxProcesses:[denied]}).reason,'permission-denied');
  const exited={...gpu,processType:'renderer',reason:'process-exited'};
  assert.equal(resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[exited],linuxProcesses:[exited]}).reason,'process-exited');
  const emptyCmdline={pid:91,processType:null,processTypeReason:'cmdline-empty',isChromiumProcess:false};
  assert.equal(resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[],linuxProcesses:[emptyCmdline]}).reason,'cmdline-empty');
});

test('renderer resolver verifies same-namespace NSpid pairs and refuses ambiguity',()=>{
  const traceIdentity={pid:91,tid:92,threadName:'CrRendererMain',browserPid:10};
  const candidate={pid:191,tid:192,threadName:'CrRendererMain',processType:'renderer',processStartTimeTicks:100,expectedProcessStartTimeTicks:100,threadStartTimeTicks:101,expectedThreadStartTimeTicks:101,processNamespaceIds:[191,91],threadNamespaceIds:[192,92],pidNamespace:'pid:[1]',available:true};
  const mapped=resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[candidate],linuxProcesses:[{pid:191,processType:'renderer',namespaceIds:[191,91],pidNamespace:'pid:[1]'}],rootPidNamespace:'pid:[1]',rootPidNamespaceIds:[100,10]});
  assert.equal(mapped.status,'RENDERER_THREAD_RESOLVED');assert.equal(mapped.matchMethod,'trace-pid-tid-namespace-map');assert.equal(mapped.linuxIdentity.namespaceIndex,1);
  const wrongIndex={...candidate,processNamespaceIds:[91,191],threadNamespaceIds:[92,192]};
  const wrongIndexResult=resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[wrongIndex],linuxProcesses:[{pid:191,processType:'renderer',namespaceIds:[91,191],pidNamespace:'pid:[1]'}],rootPidNamespace:'pid:[1]',rootPidNamespaceIds:[100,10]});
  assert.equal(wrongIndexResult.status,'RENDERER_THREAD_UNAVAILABLE');assert.equal(wrongIndexResult.reason,'pid-namespace-mismatch');
  assert.equal(resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[],linuxProcesses:[{pid:191,processType:'renderer',namespaceIds:[191,91],pidNamespace:'pid:[2]'}],rootPidNamespace:'pid:[1]'}).reason,'pid-namespace-mismatch');
});

test('renderer identity can resolve while missing schedstat keeps counters unavailable',()=>{
  const candidate={pid:91,tid:92,threadName:'CrRendererMain',processType:'renderer',processStartTimeTicks:100,threadStartTimeTicks:101,available:false,reason:'schedstat-unavailable'};
  const result=resolveRendererThreadIdentity({traceIdentity:{pid:91,tid:92,threadName:'CrRendererMain'},linuxCandidates:[candidate]});
  assert.equal(result.status,'RENDERER_THREAD_RESOLVED');assert.equal(result.counterAvailable,false);assert.equal(result.counterUnavailableReason,'schedstat-unavailable');
});

test('counter samples become unavailable when process or thread start ticks change',()=>{
  const make=(atMs,processStartTimeTicks,threadStartTimeTicks)=>({readStartHrtimeNs:String(atMs*1e6),readEndHrtimeNs:String(atMs*1e6+1000),threads:[{pid:91,tid:92,threadName:'CrRendererMain',processType:'renderer',expectedProcessStartTimeTicks:100,expectedThreadStartTimeTicks:101,processStartTimeTicks:100,liveProcessStartTimeTicks:processStartTimeTicks,startTimeTicks:threadStartTimeTicks,available:true,runTimeNs:atMs*1e6,runQueueWaitNs:0}]});
  const clock={available:true,slope:1,offset:0,uncertaintyMs:0};
  const processReused=summarizeSchedulerSamples([make(1,100,101),make(2,999,101)],clock,[[0,3]]).perStep[0];
  const threadReused=summarizeSchedulerSamples([make(1,100,101),make(2,100,999)],clock,[[0,3]]).perStep[0];
  assert.equal(processReused.available,false);assert.equal(processReused.runtimeMs,null);assert.equal(processReused.reason,'process-or-thread-identity-changed');
  assert.equal(threadReused.available,false);assert.equal(threadReused.runQueueWaitMs,null);assert.equal(threadReused.reason,'process-or-thread-identity-changed');
});

test('runner snapshot comparison distinguishes browser CPU time, host pressure, and cgroup throttling',()=>{
  const snapshot=(cpuMs,totalTicks,idleTicks,usage,throttled,load)=>({
    browserProcesses:{available:true,processes:[{pid:10,state:'R',cpuMs}]},
    systemCpu:{totalTicks,idleTicks},cgroupCpu:{usage_usec:usage,throttled_usec:throttled},
    loadAverage:[load,load,load],cpuPressure:`some avg10=${load} avg60=0 avg300=0 total=1`,cgroupCpuMax:'100000 100000'
  });
  const result=compareRunnerSnapshots(snapshot(100,1000,600,100000,10000,1),snapshot(145,1200,700,135000,17000,2),100);
  assert.equal(result.browserCpuMs,45);
  assert.equal(result.browserCpuToWallRatio,.45);
  assert.equal(result.hostCpuBusyPercent,50);
  assert.equal(result.cgroupCpuUsageDeltaMs,35);
  assert.equal(result.cgroupThrottledDeltaMs,7);
  assert.equal(result.processTreeAvailable,true);
});

test('process-tree CPU is unavailable when a process thread set changes between snapshots',()=>{
  const snapshot=(cpuMs,threadIds)=>({browserProcesses:{available:true,processes:[{pid:10,state:'R',cpuMs,cpuCounterAvailable:true,cpuCounterThreadCount:threadIds.length,cpuCounterThreadIds:threadIds}]}});
  const result=compareRunnerSnapshots(snapshot(50,[10,11]),snapshot(70,[10,12]),100);
  assert.equal(result.processTreeAvailable,true);assert.equal(result.processCpuCounterAvailable,false);assert.equal(result.browserCpuMs,null);assert.equal(result.processCpuCounterProcessCount,0);
});

test('diagnostic slow-interval analysis keeps sample positions and contiguous runs aligned with timestamp windows',()=>{
  const result=summarizeSlowIntervals([5,9,10,7,11,12],[[100,105],[105,114],[114,124],[124,131],[131,142],[142,154]],8.333333333333334,100);
  assert.equal(result.measuredSampleCount,6);
  assert.deepEqual(result.slowSamples.map(sample=>sample.stepIndex),[1,2,4,5]);
  assert.deepEqual(result.slowSamples.map(sample=>sample.elapsedFromTrialStartMs),[5,14,31,42]);
  assert.deepEqual(result.consecutiveSlowRuns.map(run=>({first:run.firstStepIndex,last:run.lastStepIndex,count:run.count})),[{first:1,last:2,count:2},{first:4,last:5,count:2}]);
  assert.equal(result.maximumConsecutiveSlowCount,2);
});

test('runner snapshot records available Linux host and process-tree context',{skip:process.platform!=='linux'||visibleProcSelfPid!==process.pid},async()=>{
  const result=await captureRunnerSnapshot(process.pid);
  assert.equal(result.browserProcesses.rootPid,process.pid);
  assert.equal(result.browserProcesses.available,true);
  assert.ok(result.logicalCpuCount>0);
  assert.ok(Array.isArray(result.loadAverage));
});
