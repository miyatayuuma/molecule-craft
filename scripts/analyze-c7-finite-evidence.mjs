import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mapTraceClock,mapNodeClockToBrowserViaCdpMarkers} from './stage-b-trace-attribution.mjs';
import {resolveRendererThreadIdentity,summarizeSchedulerSamples} from './stage-b-runner-telemetry.mjs';

/** Offline only: recover trace localization from stored page marks; never invent a missing Node clock pair. */
export function analyzeFiniteEvidence(report,raw){
  const events=raw.traceEvents??[],identity=report.rendererIdentityBootstrap?.identity,sourceSha=report.sourceSha;
  assert.ok(sourceSha,'source authority required');assert.equal(raw.diagnosticAuthority?.sourceSha,sourceSha,'raw/source authority mismatch');
  const marks=(report.pageEvidence?.performanceMarks??[]).filter(mark=>events.some(event=>event.name===mark.name&&event.pid===identity?.pid&&event.tid===identity?.tid));
  const traceClock=mapTraceClock(events,marks.map(mark=>({id:mark.name,browserLowMs:mark.startTime-.005,browserHighMs:mark.startTime+.005})));
  const clock=report.traceClock??{},nodeClock=mapNodeClockToBrowserViaCdpMarkers({traceEvents:events,cdpMarkers:clock.cdpMarkers??[],traceClockMapping:traceClock,markerSuffixes:(clock.cdpMarkers??[]).map(mark=>mark.id)});
  const discovery=report.scheduler?.discovery??{},rendererResolution=resolveRendererThreadIdentity({traceIdentity:identity,linuxCandidates:discovery.targets??[],linuxProcesses:discovery.rendererProcesses??[],rootPidNamespace:discovery.rootPidNamespace,rootPidNamespaceIds:discovery.rootPidNamespaceIds});
  const frame=report.pageEvidence?.frameProfile,lifecycle=frame?.lifecycle??{},registration=lifecycle.samplerStartedAtMs,longTasks=report.pageEvidence?.longTasks??[];
  const tasks=longTasks.map(observed=>{
    const startMs=registration+observed.startOffsetMs,endMs=startMs+observed.durationMs;
    const main=traceClock.available?events.filter(event=>event.pid===identity?.pid&&event.tid===identity?.tid&&event.ts*traceClock.slope/1000+traceClock.offset<endMs&&((event.ts+(event.dur??0))*traceClock.slope/1000+traceClock.offset)>=startMs):[];
    const task=main.filter(event=>event.name==='RunTask').sort((a,b)=>b.dur-a.dur)[0],functions=main.filter(event=>event.name==='FunctionCall').sort((a,b)=>b.dur-a.dur),owner=functions[0];
    const scheduler=summarizeSchedulerSamples(report.schedulerRawSamples??[],nodeClock,[[startMs,endMs]],{targetIdentity:rendererResolution.status==='RENDERER_THREAD_RESOLVED'?identity:null,requireTargetIdentity:true,rootPidNamespace:discovery.rootPidNamespace,rootPidNamespaceIds:discovery.rootPidNamespaceIds}).perStep[0];
    const functionEvent=owner?{name:owner.name,function:owner.args?.data??null,traceTimestampUs:owner.ts,wallMs:owner.dur/1000,chromiumThreadCpuMs:Number.isFinite(owner.tdur)?owner.tdur/1000:null}:null;
    const stackEvents=main.filter(event=>event.args?.data?.stackTrace||event.args?.beginData?.stackTrace).map(event=>({name:event.name,timestampUs:event.ts,stack:event.args?.data?.stackTrace??event.args?.beginData?.stackTrace}));
    return{classification:'UNATTRIBUTED',reason:!nodeClock.available?'Node-to-Browser clock cannot map Linux counters to this long task; trace localization is separate from wait-cause proof':'No automatic production/browser wait-cause inference from function wall time',sourceSha,tracePid:identity?.pid,traceTid:identity?.tid,browserWindowMs:[startMs,endMs],observedLongTaskMs:observed.durationMs,runTask:task?{traceTimestampUs:task.ts,wallMs:task.dur/1000,chromiumThreadCpuMs:Number.isFinite(task.tdur)?task.tdur/1000:null}:null,functionEvent,scheduler,stackEvents,gcEvents:main.filter(event=>/gc|scavenge|mark.?compact/i.test(event.name)).map(event=>({name:event.name,wallMs:(event.dur??0)/1000})),compileEvents:main.filter(event=>/compile|optimiz|deopt/i.test(event.name)).map(event=>({name:event.name,wallMs:(event.dur??0)/1000}))};
  });
  return{mode:'offline-diagnostic-analysis',acceptanceResult:false,sourceSha,browser:report.browser,status:report.status,assertionFailure:report.assertionFailure,rendererResolution,traceClockMappingFromStoredPageMarks:traceClock,nodeClockMapping:nodeClock,realFrameCount:frame?.frameIntervalsMs?.frameCount??null,validIntervalCount:frame?.frameIntervalsMs?.count??null,timer:report.pageEvidence?.completionTimer,completionElapsedMs:frame?.completionElapsedMs,rafLifecycle:lifecycle,longTaskAttributions:tasks,schedulerSampling:{sampleCount:report.scheduler?.sampleCount,medianIntervalMs:report.scheduler?.medianObservedSampleIntervalMs,maxIntervalMs:report.scheduler?.maxObservedSampleIntervalMs,meanReadCostMs:report.scheduler?.meanReadCostMs,maxReadCostMs:report.scheduler?.maxReadCostMs}};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [reportPath,rawPath,outputPath]=process.argv.slice(2);assert.ok(reportPath&&rawPath&&outputPath,'Usage: node scripts/analyze-c7-finite-evidence.mjs partial.json raw-trace.json output.json');
  const result=analyzeFiniteEvidence(JSON.parse(await readFile(reportPath,'utf8')),JSON.parse(await readFile(rawPath,'utf8')));
  await writeFile(outputPath,JSON.stringify(result,null,2));console.log('Offline diagnostic evidence saved:',outputPath);
}
