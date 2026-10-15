import {attributeSlowIntervals,mapNodeClockToBrowserViaCdpMarkers} from './stage-b-trace-attribution.mjs';
import {resolveRendererThreadIdentity,summarizeSchedulerSamples} from './stage-b-runner-telemetry.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';

function traceMarkerName(event){
  const data=event?.args?.data??event?.args?.beginData??event?.args??{};
  // Chromium can emit a performance.mark() as the trace event name itself;
  // other versions expose it in args.data.name/message.
  return data.name??data.message??event?.name??null;
}

export function resolvePageRendererTraceIdentity(trace,{markerSuffixes=[]}={}){
  const events=Array.isArray(trace?.traceEvents)?trace.traceEvents:[],metadata=Array.isArray(trace?.threadMetadata)?trace.threadMetadata:[],browserMarkers=Array.isArray(trace?.clock?.browserMarkers)?trace.clock.browserMarkers:[];
  const markerIds=browserMarkers.filter(marker=>markerSuffixes.some(suffix=>marker.id?.endsWith(`-${suffix}`))).map(marker=>marker.id);
  if(!markerIds.length)return{available:false,reason:'browser-performance-markers-missing',identity:null,markerIds:[]};
  const markedEvents=events.filter(event=>markerIds.includes(traceMarkerName(event))&&Number.isSafeInteger(event.pid)&&Number.isSafeInteger(event.tid));
  const keys=[...new Set(markedEvents.map(event=>`${event.pid}:${event.tid}`))];
  if(keys.length!==1)return{available:false,reason:keys.length?'multiple-page-renderer-identities':'trace-marker-events-missing',identity:null,markerIds,observedIdentities:keys};
  const [pid,tid]=keys[0].split(':').map(Number),threadMetadata=metadata.find(row=>row.name==='thread_name'&&row.pid===pid&&row.tid===tid);
  if(threadMetadata?.label!=='CrRendererMain')return{available:false,reason:'trace-thread-name-mismatch',identity:{pid,tid,threadName:threadMetadata?.label??null},markerIds};
  const processMetadata=metadata.find(row=>row.name==='process_name'&&row.pid===pid);
  const browserProcessMetadata=metadata.find(row=>row.name==='process_name'&&row.label==='Browser');
  return{available:true,reason:null,identity:{pid,tid,threadName:threadMetadata.label,processName:processMetadata?.label??null,browserPid:Number.isSafeInteger(browserProcessMetadata?.pid)?browserProcessMetadata.pid:null,source:'browser-performance-marker-trace-pid-tid'},markerIds};
}

export function finalizeStageBTrialAttribution({trial,trace,sourceSha=null,budgetMs=8.333333333333334}={}){
  const label=trial?.label??'stage-b-diagnostic',traceEvents=Array.isArray(trace?.traceEvents)?trace.traceEvents:[],traceClockMapping=trace?.clock?.traceToBrowserPerformance??{available:false,reason:'trace-clock-mapping-missing'},markerSuffixes=[`${label}-start`,`${label}-end`];
  const pageRenderer=resolvePageRendererTraceIdentity(trace,{markerSuffixes}),discovery=trial?.rendererDiscovery??{},linuxCandidates=Array.isArray(discovery.targets)?discovery.targets:[];
  const rendererResolution=pageRenderer.available?resolveRendererThreadIdentity({traceIdentity:pageRenderer.identity,linuxCandidates,linuxProcesses:discovery.rendererProcesses??linuxCandidates,rootPidNamespace:discovery.rootPidNamespace??null,rootPidNamespaceIds:discovery.rootPidNamespaceIds??null}):{status:'RENDERER_THREAD_UNAVAILABLE',reason:pageRenderer.reason,traceIdentity:pageRenderer.identity??null,linuxCandidateCount:linuxCandidates.length};
  const schedulerClockMapping=mapNodeClockToBrowserViaCdpMarkers({traceEvents,cdpMarkers:trace?.clock?.cdpMarkers??[],traceClockMapping,markerSuffixes});
  const schedulerAttribution=summarizeSchedulerSamples(trial?.schedulerSamples??[],schedulerClockMapping,trial?.stepWindowsMs??[],{targetIdentity:rendererResolution.status==='RENDERER_THREAD_RESOLVED'?pageRenderer.identity:null,requireTargetIdentity:true});
  const slowStepAttributions=attributeSlowIntervals({label,sourceSha,trialNumber:trial?.trialNumber??null,durationsMs:trial?.durationsMs??[],stepWindowsMs:trial?.stepWindowsMs??[],traceEvents,traceClockMapping,schedulerPerStep:schedulerAttribution.perStep,rendererMainThreads:pageRenderer.available?[pageRenderer.identity]:[],budgetMs});
  return{label,trialNumber:trial?.trialNumber??null,pageRenderer,rendererResolution,schedulerClockMapping,schedulerAttribution,slowStepAttributions};
}

export async function finalizeStageBDiagnosticArtifacts({traceRecorder,trace=null,trials=[],controls=[],sourceSha=null,browser=null,outputPath=null,tracePath=null,assertionFailure=null}={}){
  const errors=[];let finalTrace=trace;
  if(!finalTrace&&traceRecorder){
    try{finalTrace=traceRecorder.finalized?traceRecorder.finalTrace:await traceRecorder.stop();}
    catch(error){errors.push(`trace-stop:${error.message}`);}
  }
  let rawTracePath=null;
  if(finalTrace?.capabilities?.usableTrace===true&&traceRecorder&&tracePath){
    try{await traceRecorder.writeRaw(tracePath);rawTracePath=tracePath;}
    catch(error){errors.push(`trace-write:${error.message}`);}
  }
  const trialFinalizations=(trials??[]).map(trial=>finalizeStageBTrialAttribution({trial,trace:finalTrace,sourceSha}));
  const controlFinalizations=(controls??[]).map(control=>finalizeStageBTrialAttribution({trial:control,trace:finalTrace,sourceSha,budgetMs:8.333333333333334}));
  const report={schemaVersion:1,mode:'diagnostic-only',acceptanceResult:false,status:assertionFailure?'PARTIAL_FINALIZATION':'FINALIZED',sourceSha,browser,traceCapability:finalTrace?.capabilities??traceRecorder?.capabilitySnapshot?.()??null,traceArtifact:rawTracePath,traceRawArtifactAvailable:!!rawTracePath,traceEventCount:finalTrace?.eventCount??finalTrace?.traceEvents?.length??0,traceClock:finalTrace?.clock??null,trials:trials??[],controls:controls??[],trialFinalizations,controlFinalizations,assertionFailure:assertionFailure?{name:assertionFailure.name??'Error',message:assertionFailure.message??String(assertionFailure),stack:assertionFailure.stack??null}:null,finalizationErrors:errors,capturedAt:new Date().toISOString()};
  if(outputPath){await mkdir(dirname(outputPath),{recursive:true});await writeFile(outputPath,JSON.stringify(report,null,2));}
  return{...report,finalizationArtifact:outputPath};
}
