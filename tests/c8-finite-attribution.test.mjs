import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {ChromiumTraceRecorder} from '../scripts/chromium-trace-recorder.mjs';
import {analyzeFiniteEvidence,recoverFiniteClock} from '../scripts/analyze-c7-finite-evidence.mjs';
import {summarizeSchedulerSamples} from '../scripts/stage-b-runner-telemetry.mjs';
import {installFiniteResizeProbes} from '../scripts/finite-polymer-diagnostic.mjs';

const marker=(id,at,delay=.1)=>({id,syncId:`clock-${id}`,success:true,nodeStartHrtimeMs:at-delay/2,nodeEndHrtimeMs:at+delay/2});
const event=(id,at)=>({name:'clock_sync',ts:at*1000,args:{sync_id:`clock-${id}`}});
const mapping={available:true,slope:1,offset:0,uncertaintyMs:.01};
test('C8 clock pairs require separate, observed markers and bounded total uncertainty',()=>{
  const markers=[marker('a',0),marker('b',500)],events=[event('a',0),event('b',500)];
  const ok=recoverFiniteClock(events,{cdpMarkers:markers},mapping);
  assert.equal(ok.available,true);assert.equal(ok.pairCount,2);assert.equal(ok.sourceSpanMs,500);assert.ok(ok.uncertaintyMs<.1);
  assert.equal(recoverFiniteClock(events,{cdpMarkers:markers.slice(0,1)},mapping).reason,'fewer-than-two-clock-pairs');
  assert.equal(recoverFiniteClock([event('a',0),event('b',1)],{cdpMarkers:[marker('a',0),marker('b',1)]},mapping).reason,'clock-pairs-too-close');
  assert.equal(recoverFiniteClock(events,{cdpMarkers:markers},{...mapping,uncertaintyMs:2}).reason,'mapping-uncertainty-exceeds-1ms');
  assert.equal(recoverFiniteClock(events.slice(0,1),{cdpMarkers:markers},mapping).available,false,'successful protocol return without trace event is insufficient');
  const late=recoverFiniteClock(events,{cdpMarkers:[markers[0],marker('b',500,400)]},mapping);assert.equal(late.available,false);assert.equal(late.missingPairs[0].reason,'host-marker-roundtrip-exceeds-1.5ms');
});

test('Browser marker is saved before a delayed or failed page Runtime.evaluate',async()=>{
  let resolvePage,pageEntered=false;const calls=[];
  const recorder=new ChromiumTraceRecorder({socket:new EventTarget(),send:async()=>{throw Error('page CDP must not carry host marker');},browserSend:async(method)=>{calls.push(method);return{};},evaluate:()=>{pageEntered=true;return new Promise(resolve=>{resolvePage=resolve;});}});
  recorder.available=true;
  const marking=recorder.mark('before-stall');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(pageEntered,true);assert.equal(recorder.cdpMarkers.length,1);assert.equal(recorder.cdpMarkers[0].transport,'browser-target');assert.equal(recorder.nodeClockPairs.length,0);
  await recorder.markHost('during-page-stall');assert.equal(recorder.cdpMarkers.length,2);assert.equal(calls.length,2);
  resolvePage({id:'page',browserLowMs:1,browserHighMs:1.01});await marking;
  recorder.evaluate=async()=>{throw Error('page timed out');};const failed=await recorder.mark('after-failure');assert.equal(failed.browserError,'page timed out');assert.equal(recorder.cdpMarkers.at(-1).success,true);
  recorder.browserSend=async()=>{throw Error('unsupported');};assert.equal((await recorder.markHost('unavailable')).success,false);
});

const identity={pid:91,tid:92,threadName:'CrRendererMain',browserPid:10};
const candidate={...identity,processType:'renderer',processStartTimeTicks:100,expectedProcessStartTimeTicks:100,threadStartTimeTicks:101,expectedThreadStartTimeTicks:101,available:true};
const sample=(at,runtime=at*.1,wait=at*.05)=>({readStartHrtimeNs:String(at*1e6),readEndHrtimeNs:String(at*1e6+1000),readDurationMs:.001,threads:[{...candidate,startTimeTicks:101,runTimeNs:runtime*1e6,runQueueWaitNs:wait*1e6,timeslices:at,voluntaryContextSwitches:at,involuntaryContextSwitches:at*2}]});

test('interior CPU/wait counters and nearest outer bracket are separate; missing coverage and reuse fail closed',()=>{
  const rows=[-100,0,11,20,30,39,50,200].map(at=>sample(at));
  const result=summarizeSchedulerSamples(rows,mapping,[[10,40]],{targetIdentity:identity,requireTargetIdentity:true}).perStep[0];
  assert.equal(result.available,true);assert.ok(Math.abs(result.runtimeMs-2.8)<1e-9);assert.ok(Math.abs(result.runQueueWaitMs-1.4)<1e-9);assert.equal(result.timeslices,28);assert.deepEqual(result.contextSwitches,{voluntary:28,involuntary:56});
  assert.equal(result.workloadBracket.runtimeMs,5);assert.equal(result.workloadBracket.runQueueWaitMs,2.5);assert.ok(result.workloadBracket.intervalMs<51,'capture-wide endpoints must not stand for nearest bracket');
  assert.equal(summarizeSchedulerSamples([sample(0),sample(50)],mapping,[[10,40]],{targetIdentity:identity,requireTargetIdentity:true}).perStep[0].available,false);
  rows[4].threads[0].startTimeTicks=999;const reused=summarizeSchedulerSamples(rows,mapping,[[10,40]],{targetIdentity:identity,requireTargetIdentity:true}).perStep[0];assert.equal(reused.available,false);
});

function fixture(waitRatio=.02){
  const marks=[{name:'start',startTime:0},{name:'end',startTime:500}];
  const trace=[{name:'start',pid:91,tid:92,ts:0},{name:'end',pid:91,tid:92,ts:500000},event('a',0),event('b',500),{name:'RunTask',pid:91,tid:92,ts:20000,dur:440000,tdur:30000},{name:'FunctionCall',pid:91,tid:92,ts:30000,dur:400000,tdur:14000,args:{data:{functionName:'resize',stackTrace:[{functionName:'setSize'}]}}}];
  const report={sourceSha:'sha',rendererIdentityBootstrap:{identity},traceClock:{cdpMarkers:[marker('a',0),marker('b',500)]},scheduler:{discovery:{targets:[candidate],rendererProcesses:[candidate]}},schedulerRawSamples:Array.from({length:101},(_,i)=>sample(i*5,i*.2,i*5*waitRatio)),pageEvidence:{performanceMarks:marks,completionTimer:{timerStartedAtMs:25},frameProfile:{frameIntervalsMs:{frameCount:1,count:0},lifecycle:{samplerStartedAtMs:25,readyEventReceivedAtMs:455}},longTasks:[{startOffsetMs:-5,durationMs:440}]}};
  return{report,raw:{diagnosticAuthority:{sourceSha:'sha'},traceEvents:trace}};
}
test('offline analyzer separates completion, RunTask, resize and bracket and refuses GPU inference',()=>{
  const {report,raw}=fixture(),analysis=analyzeFiniteEvidence(report,raw),task=analysis.longTaskAttributions[0];
  assert.equal(analysis.nodeClockMapping.available,true);assert.equal(analysis.completionWindows[0].scope,'A-completion-lifecycle');assert.equal(task.windows.resize.wallMs,400);
  assert.equal(task.windows.resize.attributionAvailable,true);assert.equal(task.functionEvent.chromiumThreadCpuMs,14);assert.equal(task.stackEvents[0].stack[0].functionName,'setSize');
  assert.equal(task.gpuBrowserEvidence.available,false);assert.equal(task.classification,'UNATTRIBUTED');
  raw.traceEvents.push({name:'GPUTask',cat:'gpu',pid:30,tid:30,ts:40000,dur:390000});
  const overlapOnly=analyzeFiniteEvidence(report,raw).longTaskAttributions[0];assert.equal(overlapOnly.gpuBrowserEvidence.available,true);assert.equal(overlapOnly.gpuBrowserEvidence.synchronousDependencyProven,false);assert.equal(overlapOnly.classification,'UNATTRIBUTED');
  const loss=fixture(.8);loss.report.traceDataLoss=true;assert.equal(analyzeFiniteEvidence(loss.report,loss.raw).longTaskAttributions[0].classification,'UNATTRIBUTED');
  const schedulerFixture=fixture(.8);assert.equal(analyzeFiniteEvidence(schedulerFixture.report,schedulerFixture.raw).longTaskAttributions[0].classification,'OS_SCHEDULER_WAIT');
});

test('diagnostic probes preserve native return, throw, argument and receiver behavior',()=>{
  class Element{getBoundingClientRect(){return{width:10,height:20};}}
  class Canvas extends Element{set width(value){this.w=value;}get width(){return this.w;}set height(value){this.h=value;}get height(){return this.h;}}
  class GL{viewport(...args){this.seen=args;if(args[0]<0)throw Error('native failure');return 42;}}
  let tick=0;const window={WebGLRenderingContext:GL};
  runInNewContext(`(${installFiniteResizeProbes.toString()})()`,{window,Element,HTMLCanvasElement:Canvas,performance:{now:()=>++tick}});
  const canvas=new Canvas();canvas.width=10;canvas.height=20;assert.deepEqual(canvas.getBoundingClientRect(),{width:10,height:20});const gl=new GL();assert.equal(gl.viewport(1,2,3,4),42);assert.deepEqual(gl.seen,[1,2,3,4]);assert.throws(()=>gl.viewport(-1,2,3,4),/native failure/);assert.equal(window.__finiteResizeProbes.length,5);window.__restoreFiniteResizeProbes();canvas.width=30;assert.equal(gl.viewport(1,2,3,4),42);assert.equal(window.__finiteResizeProbes.length,5,'untraced controls restore original native methods');
});

test('C8 exact-head campaign cannot dispatch Stage B or ordinary acceptance and has offline failure analysis',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/reaction-lab-finite-polymer-validation.yml',import.meta.url),'utf8');
  const c8=workflow.split('  c8-finite-diagnostic:\n')[1];assert.match(c8,/needs: c7-diagnostic-gates/);assert.match(c8,/\[TASK12C8-RUN\]/);assert.doesNotMatch(c8.split('    steps:')[0],/synchronize/);assert.match(c8,/if: always\(\)/);assert.match(c8,/c8-analysis.json/);
  assert.doesNotMatch(workflow.split('  c7-stage-b-diagnostic:\n')[1].split('    steps:')[0],/TASK12C8-RUN/);
});
