// Offline-only. C9 deliberately wraps ResizeObserver, so its native FunctionCall
// has no functionName. Attribute the recorded production resize window directly;
// never relabel unrelated RAF/render waits as resize waits or replay the campaign.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyzeFiniteEvidence} from './analyze-c7-finite-evidence.mjs';
import {projectFiniteClockBounds} from './finite-clock-bounds.mjs';
import {summarizeSchedulerSamples} from './stage-b-runner-telemetry.mjs';

export function attributeRecordedResize(window,events,{identity,traceClock,gpuAuthority=false}={}){
  const available=traceClock?.available===true&&Number.isFinite(traceClock.uncertaintyMs)&&traceClock.uncertaintyMs<=1&&Number.isInteger(identity?.pid)&&Number.isInteger(identity?.tid);
  if(!available)return{available:false,classification:'UNATTRIBUTED',reason:'trace-clock-or-renderer-unavailable'};
  const main=events.filter(e=>e.pid===identity.pid&&e.tid===identity.tid&&e.ph==='X'&&Number.isFinite(e.ts)&&Number.isFinite(e.dur)),uncertainty=traceClock.uncertaintyMs,toMs=ts=>traceClock.slope*ts/1000+traceClock.offset;
  const proxies=main.filter(e=>e.name==='CommandBufferProxyImpl::WaitForGetOffset'),waits=main.filter(e=>e.name==='GpuChannel::WaitForGetOffsetInRange');
  const rows=waits.map(e=>({traceTimestampUs:e.ts,durationMs:e.dur/1000,startMs:toMs(e.ts),endMs:toMs(e.ts+e.dur),nestedInProxy:proxies.some(p=>p.ts<=e.ts&&p.ts+p.dur>=e.ts+e.dur)})).filter(e=>e.startMs-uncertainty<window.endMs&&e.endMs+uncertainty>window.startMs).map(e=>({...e,definitelyContained:e.startMs-uncertainty>=window.startMs&&e.endMs+uncertainty<=window.endMs}));
  const proven=rows.filter(e=>e.definitelyContained&&e.nestedInProxy),intervals=proven.map(e=>[e.startMs,e.endMs]).sort((a,b)=>a[0]-b[0]);
  let unionMs=0,end=-Infinity;for(const [a,b] of intervals){unionMs+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}
  const wallMs=window.endMs-window.startMs,confirmed=gpuAuthority&&wallMs>=50&&unionMs>=wallMs*.8;
  return{available:true,classification:confirmed?'GPU_OR_WEBGL_SYNCHRONIZATION':'UNATTRIBUTED',reason:confirmed?'Recorded production resize contains explicit same-renderer wait nested in command-buffer proxy; conservative union covers >=80% of resize wall':'No dominant conservatively contained synchronous dependency',browserWindowMs:[window.startMs,window.endMs],wallMs,traceClockUncertaintyMs:uncertainty,definiteSyncWaitMs:unionMs,waits:rows,ambiguousBoundaryWaitCount:rows.filter(e=>!e.definitelyContained).length};
}
export function analyzeC9ResizeEvidence(performance,report,raw){
  assert.equal(performance.sourceSha,report.sourceSha);assert.equal(raw.diagnosticAuthority.sourceSha,report.sourceSha);
  const base=analyzeFiniteEvidence(report,raw),identity=report.rendererIdentityBootstrap?.identity,traceClock=base.traceClockMappingFromStoredPageMarks;
  const authority=identity?.processAuthority,gpuAuthority=base.rendererResolution.status==='RENDERER_THREAD_RESOLVED'&&authority?.available===true&&authority.processes.some(p=>p.type.toLowerCase().includes('gpu'))&&report.traceDataLoss!==true;
  const work=performance.c9.resizeWork,probes=performance.c9.nativeProbes,events=raw.traceEvents??raw.trace?.traceEvents??[],scheduler=report.scheduler,discovery=scheduler.discovery;
  const counterWindow=(start,end)=>{
    const clock=projectFiniteClockBounds(base.nodeClockMapping.boundedAllPairMapping,start,end),result=summarizeSchedulerSamples(scheduler.rawSamples,clock,[[start,end]],{targetIdentity:gpuAuthority?identity:null,requireTargetIdentity:true,rootPidNamespace:discovery.rootPidNamespace,rootPidNamespaceIds:discovery.rootPidNamespaceIds}).perStep[0];
    return{clock,interior:result,attributionAvailable:!!result?.available&&result.coverageRatio>=.9&&clock.available&&clock.uncertaintyMs<=1};
  };
  const trials=performance.measurements.map(m=>{
    const finish=work.find(w=>w.kind==='finishPolymerSample'&&w.sampleId===m.sampleId);assert.ok(finish);
    const low=finish.startMs,high=m.completionLifecycle.samplerStoppedAtMs,during=work.filter(w=>w.startMs>=low&&w.endMs<=high),assignments=probes.filter(p=>/^canvas\.(width|height)=$/.test(p.label)&&p.startMs>=low&&p.endMs<=high);
    const resize=during.filter(w=>w.kind==='resize').map(w=>({...w,trace:attributeRecordedResize(w,events,{identity,traceClock,gpuAuthority}),counters:counterWindow(w.startMs,w.endMs)}));
    return{trialIndex:m.trialIndex,warmup:m.warmup,sampleId:m.sampleId,completionElapsedMs:m.completionElapsedMs,frameIntervals:m.frameIntervalsMs,firstPostReadyFrameAtMs:m.completionLifecycle.firstPostReadyFrameAtMs,windowIncludingFinishAndTail:[low,high],completionCounters:counterWindow(m.sampleRegistrationAtMs,m.sampleReadyAtMs),resize,assignments,rendererUpdates:during.filter(w=>['setSize','setDrawingBufferSize'].includes(w.kind)),noDrawingBufferUpdate:assignments.length===0&&resize.every(w=>w.before.width===w.after.width&&w.before.height===w.after.height),completionResizeWaitMs:resize.reduce((sum,w)=>sum+(w.trace.definiteSyncWaitMs??0),0)};
  });
  return{classification:'OFFLINE_C9_RESIZE_ATTRIBUTION',acceptanceResult:false,sourceSha:performance.sourceSha,harnessSha:performance.c9.harnessSha,browser:performance.browser,instrumentation:performance.c9.instrumentation,gpuAuthority,rendererResolution:base.rendererResolution,traceClock,nodeClock:base.clockEvidence,trials,method:'All recorded production resize calls from finish entry through first post-ready RAF, exact PID/TID, conservative trace-clock containment, nested explicit native waits, all-pair bounded Linux mapping. CPU/wait deltas are covered interior only. Unrelated render/RAF waits are excluded; absence of resize does not prove absence of other GPU stalls.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [performancePath,reportPath,tracePath,out]=process.argv.slice(2);assert.ok(out,'performance.json diagnostic.json trace.json output.json');
  const [p,r,t]=await Promise.all([performancePath,reportPath,tracePath].map(async f=>JSON.parse(await readFile(f,'utf8'))));await writeFile(out,JSON.stringify(analyzeC9ResizeEvidence(p,r,t),null,2));
}
