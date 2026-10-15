import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {finalizeFinitePauseDiagnostic,validateFiniteSampleReadyLifecycle,validateFiniteSampleRegistration} from '../scripts/finite-polymer-diagnostic.mjs';

const registration=(completionHidden)=>({detail:{sampleId:'sample-1',batchGeneration:7},receivedAt:100,readyEventsObserved:0,completionTimer:{sampleId:'sample-1',durationMs:250,timerStartedAtMs:50,ready:false},completionUi:{hidden:completionHidden}});
const frameProfile=(frameCount=1,intervalCount=Math.max(0,frameCount-1))=>({frameIntervalsMs:{frameCount,count:intervalCount},lifecycle:{sampleEventReceivedAtMs:100,samplerStartedAtMs:100,readyEventReceivedAtMs:350,firstPostReadyFrameAtMs:366,samplerStoppedAtMs:366,samplerStopReason:'post-ready-frame',samplerKind:'dedicated-requestAnimationFrame',frameCallbackCount:9,eventLoopProbe:{longTasks:[{startOffsetMs:220,durationMs:343,name:'self',attribution:[{name:'script'}]}]}}});

test('registration validates both completion UI states without using visibility as readiness evidence',()=>{
  for(const hidden of [true,false]){
    const result=validateFiniteSampleRegistration(registration(hidden),{expectedSampleId:'sample-1',expectedDurationMs:250,requireTimer:true});
    assert.equal(result.valid,true);assert.equal(result.completionUiHiddenAtRegistration,hidden);assert.equal(result.completionUiUsedAsReadinessEvidence,false);
  }
  assert.equal(validateFiniteSampleRegistration({...registration(false),readyEventsObserved:1},{expectedSampleId:'sample-1',expectedDurationMs:250,requireTimer:true}).failures.includes('ready-event-precedes-registration'),true);
  assert.equal(validateFiniteSampleRegistration({...registration(true),completionTimer:{...registration(true).completionTimer,sampleId:'other'}},{expectedSampleId:'sample-1',expectedDurationMs:250,requireTimer:true}).valid,false);
});

test('ready event identity, order and real post-ready RAF are required; one frame and zero intervals are valid',()=>{
  const registered=registration(false),present=[{detail:{sampleId:'sample-1',batchGeneration:7},receivedAt:350}];
  const result=validateFiniteSampleReadyLifecycle(registered,present,frameProfile(1,0));
  assert.equal(result.valid,true);assert.equal(result.frameCount,1);assert.equal(result.intervalCount,0);assert.equal(result.longTasks[0].durationMs,343);
  assert.equal(validateFiniteSampleReadyLifecycle(registered,[...present,...present],frameProfile()).failures.includes('duplicate-sample-present'),true);
  assert.equal(validateFiniteSampleReadyLifecycle(registered,[{...present[0],detail:{...present[0].detail,batchGeneration:8}}],frameProfile()).failures.includes('sample-present-generation-mismatch'),true);
  assert.equal(validateFiniteSampleReadyLifecycle(registered,present,{...frameProfile(),lifecycle:{...frameProfile().lifecycle,samplerKind:'synthetic-frame'}}).failures.includes('real-raf-sampler-unavailable'),true);
  assert.equal(validateFiniteSampleReadyLifecycle(registered,present,{...frameProfile(),frameIntervalsMs:{frameCount:0,count:0}}).failures.includes('real-frame-interval-count-inconsistent'),true);
  assert.equal(validateFiniteSampleReadyLifecycle(registered,present,{...frameProfile(),lifecycle:{...frameProfile().lifecycle,samplerStoppedAtMs:null}}).failures.includes('sampler-stop-order-invalid'),true);
});

test('partial assertion failure finalizes trace, event timeline, RAF, long task and scheduler evidence',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'finite-diagnostic-partial-')),trace={capabilities:{usableTrace:true},categoryProbe:{available:true},clock:{traceToBrowserPerformance:{available:true}},eventCount:1,threadMetadata:[{name:'thread_name',pid:11,tid:11,label:'CrRendererMain'}],traceEvents:[{name:'RunTask',cat:'devtools.timeline',ph:'X',pid:11,tid:11,ts:120000,dur:343000}]};
  let rawWrites=0;const recorder={started:true,finalized:false,stop:async()=>{recorder.started=false;recorder.finalized=true;recorder.finalTrace=trace;return trace;},writeRaw:async path=>{rawWrites++;await writeFile(path,JSON.stringify({traceEvents:trace.traceEvents}));}};
  const evidence={url:'http://localhost/',visibilityState:'visible',completionTimer:{sampleId:'sample-1',durationMs:250,timerStartedAtMs:50},registrationEvents:[registration(false)],presentEvents:[{detail:{sampleId:'sample-1',batchGeneration:7},receivedAt:350}],dismissEvents:[],frameProfile:frameProfile(1,0),performanceMarks:[{name:'raf',startTime:366}],longTasks:[{startOffsetMs:220,durationMs:343}],};
  const scheduler={available:true,samples:[{readStartHrtimeNs:'1',readEndHrtimeNs:'2',threads:[{pid:11,tid:11,runTimeNs:1,runQueueWaitNs:0}]}],stop:async()=>scheduler};
  try{
    const report=await finalizeFinitePauseDiagnostic({traceRecorder:recorder,schedulerSampler:scheduler,evaluate:async()=>evidence,artifactDir:directory,sourceSha:'source-sha',browser:{product:'Chromium'},viewport:{width:1280,height:900},assertionFailure:Error('assertion failed')});
    assert.equal(report.status,'PARTIAL_FINALIZATION');assert.equal(report.assertionFailure.message,'assertion failed');assert.equal(report.traceRawArtifactAvailable,true);assert.equal(rawWrites,1);
    assert.equal(report.pageEvidence.frameProfile.frameIntervalsMs.count,0);assert.equal(report.pageEvidence.longTasks[0].durationMs,343);assert.equal(report.traceEventTimeline[0].durationUs,343000);assert.equal(report.schedulerRawSamples.length,1);
    const saved=JSON.parse(await readFile(report.diagnosticArtifact,'utf8'));assert.equal(saved.viewport.width,1280);assert.equal(saved.assertionFailure.message,'assertion failed');
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('normal Finite finalization saves a complete report and does not fabricate an unavailable raw trace',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'finite-diagnostic-final-')),trace={capabilities:{usableTrace:false},eventCount:0,traceEvents:[]},recorder={started:false,finalized:true,finalTrace:trace,writeRaw:async()=>{throw Error('unusable trace must not be written');}};
  try{
    const report=await finalizeFinitePauseDiagnostic({traceRecorder:recorder,evaluate:async()=>({registrationEvents:[],presentEvents:[],frameProfile:null,longTasks:[]}),artifactDir:directory});
    assert.equal(report.status,'FINALIZED');assert.equal(report.traceRawArtifactAvailable,false);assert.equal(report.traceArtifact,null);assert.deepEqual(await readdir(directory),['finite-pause-diagnostic.json']);
    assert.equal(JSON.parse(await readFile(report.diagnosticArtifact,'utf8')).classification,'DIAGNOSTIC_ONLY');
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('partial failure records a second clock marker before finalizing trace and scheduler',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'finite-partial-clock-')),calls=[];
  const trace={capabilities:{usableTrace:false},traceEvents:[]},recorder={started:true,mark:async id=>calls.push(id),stop:async()=>{calls.push('stop');return trace;}};
  try{await finalizeFinitePauseDiagnostic({traceRecorder:recorder,evaluate:async()=>{calls.push('page');return{};},artifactDir:directory,assertionFailure:Error('fail')});assert.deepEqual(calls,['partial-finalization','page','before-trace-end','stop']);}finally{await rm(directory,{recursive:true,force:true});}
});

test('deferred graph validates the restored open Lab without relabeling it as a registration snapshot',async()=>{
  const {validateDeferredFiniteGraph}=await import('../scripts/finite-polymer-diagnostic.mjs');
  const graph={sampleId:'sample-1',sampleReady:true,graphAtomCount:24,visibleAtomCount:24,atomOriginCount:24,graphBondCount:23,visibleBondMeshCount:23,everyBondHasVisibleMesh:true,bondsResolveToRenderedAtoms:true,activeGroupCount:1,geometryCount:47,materialCount:47};
  const good=validateDeferredFiniteGraph(graph,{sampleId:'sample-1',dialogOpen:true});assert.equal(good.valid,true);assert.equal(good.registrationGraphObserved,false);assert.equal(good.scope,'post-ready-open-lab');
  const disposed={...graph,visibleAtomCount:0,activeGroupCount:0,geometryCount:0,materialCount:0};assert.equal(validateDeferredFiniteGraph(disposed,{sampleId:'sample-1',dialogOpen:false}).valid,false);
  assert.equal(validateDeferredFiniteGraph(graph,{sampleId:'other',dialogOpen:true}).valid,false);
});
