import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {finalizeStageBDiagnosticArtifacts,finalizeStageBTrialAttribution,resolvePageRendererTraceIdentity} from '../scripts/stage-b-diagnostic-finalization.mjs';

const identity={pid:31,tid:31,threadName:'CrRendererMain'};
const trace={
  capabilities:{usableTrace:true,traceCompletion:'AVAILABLE'},
  eventCount:4,
  traceEvents:[
    {name:'blink.user_timing',cat:'blink.user_timing',ph:'R',pid:31,tid:31,ts:100000,args:{data:{name:'trace-browser-clock-candidate-measured-1-start'}}},
    {name:'blink.user_timing',cat:'blink.user_timing',ph:'R',pid:31,tid:31,ts:120000,args:{data:{name:'trace-browser-clock-candidate-measured-1-end'}}},
    {name:'clock_sync',cat:'__metadata',ph:'c',ts:100000,args:{sync_id:'trace-cdp-clock-candidate-measured-1-start'}},
    {name:'clock_sync',cat:'__metadata',ph:'c',ts:120000,args:{sync_id:'trace-cdp-clock-candidate-measured-1-end'}},
  ],
  threadMetadata:[{name:'thread_name',pid:31,tid:31,label:'CrRendererMain'}],
  clock:{
    browserMarkers:[{id:'trace-browser-clock-candidate-measured-1-start'},{id:'trace-browser-clock-candidate-measured-1-end'}],
    cdpMarkers:[
      {syncId:'trace-cdp-clock-candidate-measured-1-start',success:true,nodeStartHrtimeMs:99.99,nodeEndHrtimeMs:100.01},
      {syncId:'trace-cdp-clock-candidate-measured-1-end',success:true,nodeStartHrtimeMs:119.99,nodeEndHrtimeMs:120.01},
    ],
    traceToBrowserPerformance:{available:true,slope:1,offset:0,uncertaintyMs:.01},
  },
};
const sample=(atMs,runtimeNs,waitNs)=>({readStartHrtimeNs:String((atMs-.01)*1e6),readEndHrtimeNs:String((atMs+.01)*1e6),readDurationMs:.02,threads:[{pid:31,tid:31,threadName:'CrRendererMain',processType:'renderer',processStartTimeTicks:100,liveProcessStartTimeTicks:100,expectedProcessStartTimeTicks:100,startTimeTicks:101,expectedThreadStartTimeTicks:101,available:true,state:'R',runTimeNs:runtimeNs,runQueueWaitNs:waitNs,timeslices:1,userTicks:1,systemTicks:0,voluntaryContextSwitches:0,involuntaryContextSwitches:0}]});
const trial={label:'candidate-measured-1',trialNumber:1,durationsMs:[10],stepWindowsMs:[[104.9,115.1]],rendererDiscovery:{targets:[{pid:31,tid:31,threadName:'CrRendererMain',processType:'renderer',processStartTimeTicks:100,threadStartTimeTicks:101,available:true}],rendererProcesses:[{pid:31,processType:'renderer',namespaceIds:[31]}]},schedulerSamples:[sample(105,1e6,1e6),sample(110,4e6,2e6),sample(115,7e6,3e6)]};

test('diagnostic profiler source uses imported clock mapping and shared finalization',()=>{
  const source=readFileSync(new URL('../scripts/profile-reaction-lab-stage-b.mjs',import.meta.url),'utf8');
  assert.match(source,/mapNodeClockPairsToBrowserPerformance\(traceRecorder\.nodeClockPairs\)/);
  assert.doesNotMatch(source,/\bfitClockMapping\s*\(/);
  assert.match(source,/finalizeStageBDiagnosticArtifacts\(/);
});

test('Stage B, preflight and Finite diagnostics bootstrap trace PID/TID before scheduler sampling',()=>{
  const profiler=readFileSync(new URL('../scripts/profile-reaction-lab-stage-b.mjs',import.meta.url),'utf8'),preflight=readFileSync(new URL('../scripts/preflight-reaction-lab-diagnostics.mjs',import.meta.url),'utf8'),finite=readFileSync(new URL('../tests/reaction-lab-polymer-browser.test.mjs',import.meta.url),'utf8');
  for(const source of [profiler,preflight,finite]){assert.match(source,/capturePageRendererIdentity/);assert.match(source,/traceIdentity:[A-Za-z_$][\w$]*\??\.identity/);}
});

test('Stage B finalization resolves page trace PID/TID and attributes sampled renderer counters',()=>{
  const result=finalizeStageBTrialAttribution({trial,trace,sourceSha:'source-sha'});
  assert.equal(result.pageRenderer.available,true);assert.deepEqual({pid:result.pageRenderer.identity.pid,tid:result.pageRenderer.identity.tid},{pid:31,tid:31});
  assert.equal(result.rendererResolution.status,'RENDERER_THREAD_RESOLVED');assert.equal(result.schedulerClockMapping.available,true);
  assert.equal(result.schedulerAttribution.perStep[0].runtimeMs,6);assert.equal(result.schedulerAttribution.perStep[0].runQueueWaitMs,2);assert.equal(result.schedulerAttribution.perStep[0].adequate,true);
  assert.equal(result.slowStepAttributions.length,1);assert.equal(result.slowStepAttributions[0].rendererPid,31);
});

test('missing trace markers and events return explicit unavailable attribution without ReferenceError',()=>{
  const incomplete=finalizeStageBTrialAttribution({trial,trace:{...trace,traceEvents:[],threadMetadata:[],clock:{...trace.clock,browserMarkers:[],traceToBrowserPerformance:{available:false,reason:'fewer-than-two-clock-pairs'}}}});
  assert.equal(incomplete.pageRenderer.available,false);assert.equal(incomplete.pageRenderer.reason,'browser-performance-markers-missing');
  assert.equal(incomplete.schedulerClockMapping.available,false);assert.equal(incomplete.schedulerAttribution.status,'RENDERER_THREAD_UNAVAILABLE');
  assert.equal(incomplete.slowStepAttributions[0].attributionClassification,'UNATTRIBUTED');
});

test('renderer identity recognizes Chromium performance marks emitted as trace event names',()=>{
  const identity=resolvePageRendererTraceIdentity({...trace,traceEvents:[
    {name:'trace-browser-clock-candidate-measured-1-start',ph:'I',pid:31,tid:31},
    {name:'trace-browser-clock-candidate-measured-1-end',ph:'I',pid:31,tid:31},
  ],threadMetadata:[...trace.threadMetadata,{name:'process_name',pid:7,tid:0,label:'Browser'}]},{markerSuffixes:['measured-1-start','measured-1-end']});
  assert.equal(identity.available,true);assert.equal(identity.identity.pid,31);assert.equal(identity.identity.tid,31);assert.equal(identity.identity.browserPid,7);
});

test('partial Stage B finalization preserves failure and samples but writes raw trace only when usable',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stage-b-finalization-')),tracePath=join(directory,'trace.json'),reportPath=join(directory,'partial.json');
  const recorder={finalized:true,finalTrace:trace,writeRaw:async path=>writeFile(path,JSON.stringify({traceEvents:trace.traceEvents}))};
  try{
    const partial=await finalizeStageBDiagnosticArtifacts({traceRecorder:recorder,trace,trials:[trial],sourceSha:'source-sha',outputPath:reportPath,tracePath,assertionFailure:Error('deliberate regression failure')});
    assert.equal(partial.status,'PARTIAL_FINALIZATION');assert.equal(partial.acceptanceResult,false);assert.equal(partial.assertionFailure.message,'deliberate regression failure');
    assert.equal(partial.traceRawArtifactAvailable,true);assert.equal(JSON.parse(await readFile(tracePath,'utf8')).traceEvents.length,4);assert.equal(JSON.parse(await readFile(reportPath,'utf8')).trials[0].schedulerSamples.length,3);
    const unavailableRecorder={finalized:true,finalTrace:{capabilities:{usableTrace:false},traceEvents:[]},writeRaw:async()=>{throw Error('must not write')}};
    const unavailable=await finalizeStageBDiagnosticArtifacts({traceRecorder:unavailableRecorder,trace:unavailableRecorder.finalTrace,outputPath:join(directory,'unavailable.json'),tracePath:join(directory,'unavailable.trace.json')});
    assert.equal(unavailable.traceRawArtifactAvailable,false);assert.equal(await readdir(directory).then(files=>files.includes('unavailable.trace.json')),false);
  }finally{await rm(directory,{recursive:true,force:true});}
});
