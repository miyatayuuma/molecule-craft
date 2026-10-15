import assert from 'node:assert/strict';
import {fitFiniteClockBounds,projectFiniteClockBounds} from './finite-clock-bounds.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mapTraceClock,mapNodeClockToBrowserViaCdpMarkers} from './stage-b-trace-attribution.mjs';
import {resolveRendererThreadIdentity,summarizeSchedulerSamples} from './stage-b-runner-telemetry.mjs';

export function recoverFiniteClock(events,clock,traceClock,{maxUncertaintyMs=1}={}){
  // Fixed latency gate, independent of workload result. Preserve every rejected pair.
  const markers=clock.cdpMarkers??[],accepted=markers.filter(row=>row.success&&row.nodeEndHrtimeMs-row.nodeStartHrtimeMs<=1.5);
  const mapping=mapNodeClockToBrowserViaCdpMarkers({traceEvents:events,cdpMarkers:accepted,traceClockMapping:traceClock,markerSuffixes:accepted.map(row=>row.id)});
  const allPairMapping=mapNodeClockToBrowserViaCdpMarkers({traceEvents:events,cdpMarkers:markers,traceClockMapping:traceClock,markerSuffixes:markers.map(row=>row.id)}),boundedAllPairMapping=fitFiniteClockBounds(allPairMapping.pairs??[]);
  const missingPairs=markers.filter(row=>!accepted.includes(row)).map(row=>({id:row.id,reason:row.error??(!row.success?'marker-request-failed':'host-marker-roundtrip-exceeds-1.5ms')}));
  for(const row of accepted)if(!mapping.pairs?.some(pair=>pair.id===row.syncId))missingPairs.push({id:row.id,reason:'trace-clock-sync-event-missing-or-invalid'});
  if(mapping.available&&mapping.uncertaintyMs>maxUncertaintyMs)return{...mapping,available:false,reason:'mapping-uncertainty-exceeds-1ms',missingPairs,allPairMapping,boundedAllPairMapping,recordedPairCount:markers.length};
  return{...mapping,missingPairs,allPairMapping,boundedAllPairMapping,recordedPairCount:markers.length};
}
const unionDurationUs=events=>{const spans=events.map(event=>[event.ts,event.ts+event.dur]).sort((a,b)=>a[0]-b[0]);let total=0,end=-Infinity;for(const [start,stop]of spans){total+=Math.max(0,stop-Math.max(start,end));end=Math.max(end,stop);}return total;};
const gpuPattern=/gpu|webgl|viz|compositor|glcontext|commandbuffer|waitforsync|waitfor|gettoken|flush|swapbuffer|ipc|mojom/i;
const overlap=(event,start,end)=>Number.isFinite(event.ts)&&event.ts<end&&event.ts+(event.dur??0)>=start;
const describe=event=>event?{name:event.name,function:event.args?.data??null,traceTimestampUs:event.ts,wallMs:(event.dur??0)/1000,chromiumThreadCpuMs:Number.isFinite(event.tdur)?event.tdur/1000:null,pid:event.pid,tid:event.tid}:null;

/** Offline analysis never converts unexplained wall-minus-CPU time into GPU time. */
export function analyzeFiniteEvidence(report,raw){
  const events=raw.traceEvents??[],identity=report.rendererIdentityBootstrap?.identity,sourceSha=report.sourceSha;
  assert.ok(sourceSha,'source authority required');assert.equal(raw.diagnosticAuthority?.sourceSha,sourceSha,'raw/source authority mismatch');
  const clock=report.traceClock??{},storedMarks=report.pageEvidence?.performanceMarks??report.performanceMarks??[];
  const marks=storedMarks.filter(mark=>events.some(event=>event.name===mark.name&&event.pid===identity?.pid&&event.tid===identity?.tid));
  const traceClock=mapTraceClock(events,[...(clock.browserMarkers??[]),...marks.filter(mark=>!(clock.browserMarkers??[]).some(row=>row.id===mark.name)).map(mark=>({id:mark.name,browserLowMs:mark.startTime-.005,browserHighMs:mark.startTime+.005}))]);
  const nodeClock=recoverFiniteClock(events,clock,traceClock),discovery=report.scheduler?.discovery??{};
  const rendererResolution=resolveRendererThreadIdentity({traceIdentity:identity,linuxCandidates:discovery.targets??[],linuxProcesses:discovery.rendererProcesses??[],rootPidNamespace:discovery.rootPidNamespace,rootPidNamespaceIds:discovery.rootPidNamespaceIds});
  const samples=report.schedulerRawSamples??report.scheduler?.rawSamples??[],target=rendererResolution.status==='RENDERER_THREAD_RESOLVED'?identity:null;
  const counterWindow=(scope,start,end)=>{
    const windowClock=projectFiniteClockBounds(nodeClock.boundedAllPairMapping,start,end),scheduler=summarizeSchedulerSamples(samples,windowClock,[[start,end]],{targetIdentity:target,requireTargetIdentity:true,rootPidNamespace:discovery.rootPidNamespace,rootPidNamespaceIds:discovery.rootPidNamespaceIds}).perStep[0];
    // Require 90% coverage for C8 causal classification; existing helper retains raw observations.
    const pairTargets=nodeClock.allPairMapping?.pairs?.map(pair=>(pair.targetLowMs+pair.targetHighMs)/2)??[],bracketed=pairTargets.length>=2&&start>=Math.min(...pairTargets)&&end<=Math.max(...pairTargets);
    const adequate=!!scheduler?.available&&scheduler.coverageRatio>=.9&&windowClock.available&&windowClock.uncertaintyMs<=1&&bracketed&&report.traceDataLoss!==true;
    return{scope,clockMapping:windowClock,browserWindowMs:[start,end],wallMs:end-start,attributionAvailable:adequate,reason:adequate?null:scheduler?.reason??'clock-uncertainty-or-interior-coverage-insufficient',scheduler,widerBracket:scheduler?.workloadBracket??null};
  };
  const frame=report.pageEvidence?.frameProfile,lifecycle=frame?.lifecycle??{};
  const completionEvidence=report.completionEvidence??(frame?[{...frame,completionLifecycle:lifecycle}]:[]);
  const completions=completionEvidence.map(item=>{
    const life=item.completionLifecycle??item.lifecycle??{},start=item.completionTimerStartedAtMs??report.pageEvidence?.completionTimer?.timerStartedAtMs??life.samplerStartedAtMs,end=item.sampleReadyAtMs??life.readyEventReceivedAtMs;
    return{sampleId:item.sampleId??null,realFrameIntervals:item.frameIntervalsMs??null,lifecycle:life,...counterWindow('A-completion-lifecycle',start,end)};
  });
  const main=events.filter(event=>event.pid===identity?.pid&&event.tid===identity?.tid);
  const toBrowser=ts=>traceClock.slope*ts/1000+traceClock.offset;
  const tasks=main.filter(event=>event.name==='RunTask'&&event.dur>=50000).map(task=>{
    const nested=main.filter(event=>overlap(event,task.ts,task.ts+task.dur));
    const owner=nested.filter(event=>event.name==='FunctionCall'&&event.args?.data?.functionName==='resize').sort((a,b)=>b.dur-a.dur)[0]??nested.filter(event=>event.name==='FunctionCall').sort((a,b)=>b.dur-a.dur)[0];
    const start=toBrowser(task.ts),end=toBrowser(task.ts+task.dur),window=counterWindow('B-RunTask',start,end),resize=owner?counterWindow('C-function',toBrowser(owner.ts),toBrowser(owner.ts+owner.dur)):null;
    const relevant=events.filter(event=>overlap(event,owner?.ts??task.ts,(owner?.ts??task.ts)+(owner?.dur??task.dur))&&gpuPattern.test(`${event.name} ${event.cat}`));
    const scheduler=resize?.attributionAvailable?resize.scheduler:window.attributionAvailable?window.scheduler:null,wall=resize?.attributionAvailable?resize.wallMs:window.wallMs;
    // CPU runtime alone cannot separate production JS from synchronous native CPU work.
    const belongsToCompletion=completions.some(row=>row.browserWindowMs[0]<end&&row.browserWindowMs[1]>start);
    const gpuAuthority=identity?.processAuthority?.processes?.some(process=>process.type.toLowerCase().includes('gpu')),syncWaits=nested.filter(event=>event.name==='GpuChannel::WaitForGetOffsetInRange'&&event.ph==='X'&&owner&&event.ts>=owner.ts&&event.ts+event.dur<=owner.ts+owner.dur),proxyWaits=nested.filter(event=>event.name==='CommandBufferProxyImpl::WaitForGetOffset'),syncWaitMs=unionDurationUs(syncWaits)/1000,gpuSyncConfirmed=!!(belongsToCompletion&&gpuAuthority&&owner?.args?.data?.functionName==='resize'&&owner.dur>=50000&&syncWaitMs>=owner.dur/1000*.8&&syncWaits.every(wait=>proxyWaits.some(proxy=>proxy.ts<=wait.ts&&proxy.ts+proxy.dur>=wait.ts+wait.dur)));
    const schedulerDominates=belongsToCompletion&&owner?.args?.data?.functionName==='resize'&&resize?.wallMs>=50&&resize.attributionAvailable&&scheduler?.runQueueWaitMs>=wall*.5&&scheduler.runtimeMs<wall*.5;
    return{classification:gpuSyncConfirmed?'GPU_OR_WEBGL_SYNCHRONIZATION':schedulerDominates?'OS_SCHEDULER_WAIT':'UNATTRIBUTED',reason:gpuSyncConfirmed?'Renderer main thread explicitly waits for GPU command-buffer get offsets inside resize; nested proxy waits cover >=80% of function wall':schedulerDominates?'adequately covered Linux runqueue wait dominates wall time':!nodeClock.available?'Node-to-Browser clock unavailable; no Linux attribution':'No proven wait dependency; CPU and wall differences do not identify GPU synchronization',sourceSha,tracePid:identity?.pid,traceTid:identity?.tid,browserWindowMs:[start,end],observedLongTaskMs:task.dur/1000,runTask:describe(task),functionEvent:describe(owner),scheduler:window.scheduler,windows:{longTask:window,resize},stackEvents:nested.filter(event=>event.args?.data?.stackTrace||event.args?.beginData?.stackTrace).slice(0,100).map(event=>({name:event.name,timestampUs:event.ts,stack:event.args?.data?.stackTrace??event.args?.beginData?.stackTrace})),gcEvents:nested.filter(event=>/gc|scavenge|mark.?compact/i.test(event.name)).map(describe),compileEvents:nested.filter(event=>/compile|optimiz|deopt/i.test(event.name)).map(describe),gpuBrowserEvidence:{available:relevant.length>0,synchronousDependencyProven:gpuSyncConfirmed,explicitRendererSyncWaits:syncWaits.map(describe),syncWaitMs,eventCount:relevant.length,events:relevant.slice(0,300).map(event=>({...describe(event),category:event.cat,phase:event.ph,args:event.args,id:event.id,bindId:event.bind_id})),interpretation:'Temporal overlap alone is not evidence of renderer-to-GPU or browser dependency'},resizeProbes:(report.resizeProbes??report.pageEvidence?.resizeProbes??[]).filter(probe=>probe.startMs<end&&probe.endMs>start)};
  });
  return{mode:'offline-diagnostic-analysis',acceptanceResult:false,sourceSha,browser:report.browser,status:report.status,assertionFailure:report.assertionFailure,rendererResolution,traceClockMappingFromStoredPageMarks:traceClock,nodeClockMapping:nodeClock,clockEvidence:{nodeBrowserPairCount:clock.nodeClockPairs?.length??0,browserTracePairCount:traceClock.pairCount??0,hostTraceMarkerCount:clock.cdpMarkers?.length??0,acceptedHostTracePairCount:nodeClock.pairCount??0,allPairBoundedCount:nodeClock.boundedAllPairMapping?.pairCount??0,windowUncertaintyMs:tasks.filter(task=>task.windows?.resize?.attributionAvailable).map(task=>task.windows.resize.clockMapping.uncertaintyMs),spanMs:nodeClock.sourceSpanMs??null,uncertaintyMs:nodeClock.uncertaintyMs??null},realFrameCount:frame?.frameIntervalsMs?.frameCount??null,validIntervalCount:frame?.frameIntervalsMs?.count??null,timer:report.pageEvidence?.completionTimer,completionElapsedMs:frame?.completionElapsedMs,rafLifecycle:lifecycle,completionWindows:completions,longTaskAttributions:tasks,schedulerSampling:{sampleCount:report.scheduler?.sampleCount,medianIntervalMs:report.scheduler?.medianObservedSampleIntervalMs,maxIntervalMs:report.scheduler?.maxObservedSampleIntervalMs,meanReadCostMs:report.scheduler?.meanReadCostMs,maxReadCostMs:report.scheduler?.maxReadCostMs},rootCauseClassification:tasks.some(row=>row.classification==='GPU_OR_WEBGL_SYNCHRONIZATION')?'GPU_OR_WEBGL_SYNCHRONIZATION':tasks.some(row=>row.classification==='OS_SCHEDULER_WAIT')?'OS_SCHEDULER_WAIT':'UNATTRIBUTED'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [reportPath,rawPath,outputPath]=process.argv.slice(2);assert.ok(reportPath&&rawPath&&outputPath,'Usage: node scripts/analyze-c7-finite-evidence.mjs partial.json raw-trace.json output.json');
  await writeFile(outputPath,JSON.stringify(analyzeFiniteEvidence(JSON.parse(await readFile(reportPath,'utf8')),JSON.parse(await readFile(rawPath,'utf8'))),null,2));console.log('Offline diagnostic evidence saved:',outputPath);
}
