import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

export function validateFiniteSampleRegistration(event,{expectedSampleId=null,expectedDurationMs=null,requireTimer=false}={}){
  const failures=[],detail=event?.detail??{},sampleId=expectedSampleId??detail.sampleId,timer=event?.completionTimer??null;
  if(!sampleId||detail.sampleId!==sampleId)failures.push('sample-identity-mismatch');
  if(!Number.isSafeInteger(detail.batchGeneration)||detail.batchGeneration<0)failures.push('sample-generation-invalid');
  if(!Number.isFinite(event?.receivedAt))failures.push('registration-time-unavailable');
  if(event?.readyEventsObserved!==0)failures.push('ready-event-precedes-registration');
  if(timer?.ready===true)failures.push('completion-timer-already-ready-at-registration');
  if(requireTimer){
    if(timer?.sampleId!==sampleId)failures.push('completion-timer-identity-mismatch');
    if(timer?.durationMs!==expectedDurationMs)failures.push('completion-timer-duration-mismatch');
    if(!Number.isFinite(timer?.timerStartedAtMs)||timer.timerStartedAtMs>event.receivedAt)failures.push('completion-timer-start-unavailable-or-after-registration');
  }
  return{valid:failures.length===0,failures,sampleId,batchGeneration:Number.isSafeInteger(detail.batchGeneration)?detail.batchGeneration:null,registrationAtMs:Number.isFinite(event?.receivedAt)?event.receivedAt:null,timerStartedAtMs:Number.isFinite(timer?.timerStartedAtMs)?timer.timerStartedAtMs:null,timerDurationMs:Number.isFinite(timer?.durationMs)?timer.durationMs:null,completionUiHiddenAtRegistration:typeof event?.completionUi?.hidden==='boolean'?event.completionUi.hidden:null,completionUiUsedAsReadinessEvidence:false};
}

export function validateFiniteSampleReadyLifecycle(registrationEvent,presentEvents,frameProfile){
  const failures=[],registration=registrationEvent?.detail??{},matches=(presentEvents??[]).filter(event=>event?.detail?.sampleId===registration.sampleId);
  if(!registration.sampleId||!Number.isSafeInteger(registration.batchGeneration))failures.push('registration-identity-invalid');
  if(matches.length!==1)failures.push(matches.length?'duplicate-sample-present':'sample-present-missing');
  const present=matches[0];
  if(present){
    if(present.detail.batchGeneration!==registration.batchGeneration)failures.push('sample-present-generation-mismatch');
    if(!(present.receivedAt>registrationEvent.receivedAt))failures.push('sample-present-does-not-follow-registration');
  }
  const lifecycle=frameProfile?.lifecycle??{},firstPostReadyFrameAtMs=lifecycle.firstPostReadyFrameAtMs;
  if(!Number.isFinite(lifecycle.sampleEventReceivedAtMs)||lifecycle.sampleEventReceivedAtMs!==lifecycle.samplerStartedAtMs)failures.push('sampler-registration-time-mismatch');
  if(!Number.isFinite(lifecycle.readyEventReceivedAtMs)||lifecycle.readyEventReceivedAtMs<lifecycle.samplerStartedAtMs)failures.push('ready-time-before-sampler');
  if(lifecycle.samplerKind!=='dedicated-requestAnimationFrame')failures.push('real-raf-sampler-unavailable');
  if(!Number.isSafeInteger(lifecycle.frameCallbackCount)||lifecycle.frameCallbackCount<1)failures.push('real-raf-callback-missing');
  if(!Number.isFinite(firstPostReadyFrameAtMs)||firstPostReadyFrameAtMs<lifecycle.readyEventReceivedAtMs)failures.push('post-ready-frame-missing');
  if(lifecycle.samplerStopReason!=='post-ready-frame'||!Number.isFinite(lifecycle.samplerStoppedAtMs)||lifecycle.samplerStoppedAtMs<firstPostReadyFrameAtMs)failures.push('sampler-stop-order-invalid');
  const frameCount=frameProfile?.frameIntervalsMs?.frameCount,intervalCount=frameProfile?.frameIntervalsMs?.count;
  if(!Number.isSafeInteger(frameCount)||frameCount<1||!Number.isSafeInteger(intervalCount)||intervalCount!==Math.max(0,frameCount-1))failures.push('real-frame-interval-count-inconsistent');
  return{valid:failures.length===0,failures,sampleId:registration.sampleId,batchGeneration:registration.batchGeneration,registrationAtMs:registrationEvent?.receivedAt??null,readyAtMs:present?.receivedAt??null,firstPostReadyFrameAtMs:Number.isFinite(firstPostReadyFrameAtMs)?firstPostReadyFrameAtMs:null,samplerStopReason:lifecycle.samplerStopReason??null,frameCount:Number.isSafeInteger(frameCount)?frameCount:null,intervalCount:Number.isSafeInteger(intervalCount)?intervalCount:null,longTasks:lifecycle.eventLoopProbe?.longTasks??[],completionUiUsedAsReadinessEvidence:false};
}


/** A deferred graph is a ready/open observation, never registration-time evidence. */
export function validateDeferredFiniteGraph(graph,{sampleId,dialogOpen}={}){
  const failures=[];
  if(!dialogOpen)failures.push('lab-not-open');
  if(!sampleId||graph?.sampleId!==sampleId)failures.push('sample-identity-mismatch');
  if(graph?.sampleReady!==true)failures.push('sample-not-ready');
  if(!(graph?.graphAtomCount>0)||graph?.visibleAtomCount!==graph.graphAtomCount||graph?.atomOriginCount!==graph.graphAtomCount)failures.push('rendered-atom-or-origin-mismatch');
  if(!(graph?.graphBondCount>0)||!graph?.everyBondHasVisibleMesh||!graph?.bondsResolveToRenderedAtoms)failures.push('rendered-bond-mismatch');
  if(graph?.activeGroupCount!==1||graph?.geometryCount!==graph?.visibleAtomCount+graph?.visibleBondMeshCount||graph?.materialCount!==graph?.geometryCount)failures.push('resource-mismatch');
  return{valid:failures.length===0,scope:'post-ready-open-lab',registrationGraphObserved:false,failures,sampleId,graph};
}

export async function finalizeFinitePauseDiagnostic({traceRecorder,schedulerSampler,schedulerResult=null,rendererIdentityBootstrap=null,evaluate,artifactDir,sourceSha=null,browser=null,viewport=null,assertionFailure=null,traceFileName='finite-pause-trace.json',diagnosticFileName='finite-pause-diagnostic.json'}={}){
  const errors=[];let pageEvidence=null,scheduler=schedulerResult,trace=null;
  if(traceRecorder?.started&&traceRecorder.mark)try{await traceRecorder.mark('partial-finalization');}catch(error){errors.push(`finalization-clock-marker:${error.message}`);}
  try{
    pageEvidence=await evaluate(`(()=>{
      const registrations=window.__polymerSampleEvents??[],presentEvents=window.__polymerPresentEvents??[],dismissEvents=window.__polymerDismissEvents??[],registration=registrations.at(-1)??null,sampleId=registration?.detail?.sampleId??null;
      let frameProfile=null;try{if(sampleId&&window.__polymerFrameProbe)frameProfile=window.__polymerFrameProbe.summary(sampleId,true,window.__reactionLabProbe?.polymerCompletionTiming?.().durationMs??null);}catch(error){frameProfile={available:false,error:String(error?.message??error)};}
      return{url:location.href,visibilityState:document.visibilityState,hidden:document.hidden,focused:document.hasFocus(),completionTimer:window.__reactionLabProbe?.polymerCompletionTiming?.()??null,registrationEvents:registrations,presentEvents,dismissEvents,frameProfile,performanceMarks:performance.getEntriesByType('mark').slice(-400).map(entry=>({name:entry.name,startTime:entry.startTime,duration:entry.duration})),longTasks:frameProfile?.lifecycle?.eventLoopProbe?.longTasks??[]};
    })()`);
  }catch(error){pageEvidence={available:false,error:error.message};errors.push(`page-evidence:${error.message}`);}
  if(!scheduler&&schedulerSampler){try{scheduler=await schedulerSampler.stop();}catch(error){errors.push(`scheduler-stop:${error.message}`);scheduler={available:false,error:error.message};}}
  if(traceRecorder?.started){try{trace=await traceRecorder.stop();}catch(error){errors.push(`trace-stop:${error.message}`);}}
  else if(traceRecorder?.finalized)trace=traceRecorder.finalTrace;
  let traceArtifact=null;
  if(trace?.capabilities?.usableTrace===true){
    try{traceArtifact=join(artifactDir,traceFileName);await traceRecorder.writeRaw(traceArtifact);}catch(error){errors.push(`trace-write:${error.message}`);traceArtifact=null;}
  }
  const events=Array.isArray(trace?.traceEvents)?trace.traceEvents:[],traceEventTimeline=events.filter(event=>/clock_sync|user_timing|run.?task|functioncall|evaluate.?script|gc|garbage|compile|task/i.test(`${event.name??''} ${event.cat??''}`)).slice(0,2000).map(event=>({name:event.name??null,category:event.cat??null,phase:event.ph??null,pid:Number.isSafeInteger(event.pid)?event.pid:null,tid:Number.isSafeInteger(event.tid)?event.tid:null,timestampUs:Number.isFinite(event.ts)?event.ts:null,durationUs:Number.isFinite(event.dur)?event.dur:null,args:event.args?.data??event.args?.beginData??null}));
  const report={schemaVersion:2,sourceSha,browser,viewport,classification:'DIAGNOSTIC_ONLY',status:assertionFailure||errors.length?'PARTIAL_FINALIZATION':'FINALIZED',assertionFailure:assertionFailure?{name:assertionFailure.name??'Error',message:assertionFailure.message??String(assertionFailure),stack:assertionFailure.stack??null}:null,finalizationErrors:errors,pageEvidence,rendererIdentityBootstrap,traceAttempted:!!(traceRecorder?.started||traceRecorder?.finalized),traceCapability:trace?.capabilities??traceRecorder?.capabilitySnapshot?.()??null,traceCategoryProbe:trace?.categoryProbe??null,traceClock:trace?.clock??null,traceArtifact,traceRawArtifactAvailable:!!traceArtifact,traceEventCount:trace?.eventCount??events.length,traceEventTimeline,rendererIdentityEvidence:trace?.threadMetadata??[],scheduler,schedulerRawSamples:scheduler?.samples??[],capturedAt:new Date().toISOString()};
  await mkdir(artifactDir,{recursive:true});const diagnosticArtifact=join(artifactDir,diagnosticFileName);await writeFile(diagnosticArtifact,JSON.stringify(report,null,2));
  return{...report,diagnosticArtifact};
}
