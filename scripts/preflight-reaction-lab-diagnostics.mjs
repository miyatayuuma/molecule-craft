import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {release,tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {ChromiumTraceRecorder} from './chromium-trace-recorder.mjs';
import {capturePageRendererIdentity} from './chromium-renderer-identity.mjs';
import {resolvePageRendererTraceIdentity} from './stage-b-diagnostic-finalization.mjs';
import {resolveRendererThreadIdentity,startRendererSchedulerSampler,summarizeSchedulerSamples} from './stage-b-runner-telemetry.mjs';
import {mapNodeClockToBrowserViaCdpMarkers} from './stage-b-trace-attribution.mjs';
import {assessDiagnosticPreflight} from './diagnostic-preflight-contract.mjs';

const output=resolve(process.env.DIAGNOSTIC_PREFLIGHT_OUTPUT??join(process.cwd(),'test-results/diagnostic-preflight.json'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),resolveExecutable=()=>{
  if(process.env.CHROMIUM_PATH)return process.env.CHROMIUM_PATH;
  for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim())return found.stdout.trim();}
  return null;
};

let child=null,socket=null,traceRecorder=null,sampler=null,profile=null,browserVersion=null,rendererDiscovery=null,rendererIdentityBootstrap=null,clockMarkers={},busyResult=null,scheduler=null,trace=null,rawTraceArtifact=null,failure=null,report=null,initialized=null,traceCapability=null,pageRenderer=null,rendererResolution=null,schedulerClockMapping=null,schedulerAttribution=null,assessment=null;
const startedAt=new Date().toISOString(),chrome=resolveExecutable();
try{
  assert.ok(chrome,'Chromium executable unavailable');
  profile=await mkdtemp(join(tmpdir(),'molecule-craft-diagnostic-preflight-'));
  const debugPort=Number(process.env.DIAGNOSTIC_PREFLIGHT_DEBUG_PORT??9291);
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:'ignore'});
  let launchError=null;child.once('error',error=>{launchError=error;});
  let tabs=null;for(let attempt=0;attempt<180&&!launchError;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.some(tab=>tab.type==='page'))break;}}catch{}await pause(100);}
  assert.ok(!launchError,`Chromium launch failed: ${launchError?.message}`);
  assert.ok(tabs?.some(tab=>tab.type==='page'),'Chromium DevTools page did not become ready');
  socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}});
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  await send('Runtime.enable');await send('Page.enable');
  browserVersion=await send('Browser.getVersion');
  initialized=await evaluate('(()=>({url:location.href,readyState:document.readyState,timeOrigin:performance.timeOrigin,performanceNowMs:performance.now()}))()');
  assert.equal(initialized.readyState,'complete','Chromium page must initialize before tracing');
  const bootstrapTracePath=output.replace(/\.json$/i,'.renderer-identity.trace.json');
  rendererIdentityBootstrap=await capturePageRendererIdentity({socket,send,evaluate,label:'diagnostic-preflight-bootstrap',tracePath:bootstrapTracePath});
  traceRecorder=new ChromiumTraceRecorder({socket,send,evaluate,label:'diagnostic-preflight'});
  traceCapability=await traceRecorder.start();
  sampler=await startRendererSchedulerSampler(child.pid,{intervalMs:2,processIntervalMs:20,traceIdentity:rendererIdentityBootstrap.identity});
  rendererDiscovery=sampler.discovery??null;
  const cpuStart=await traceRecorder.mark('known-short-cpu-start');
  busyResult=await evaluate('(()=>{const start=performance.now();let iterations=0;while(performance.now()-start<80)iterations++;return{windowStartMs:start,windowEndMs:performance.now(),iterations,durationMs:performance.now()-start}})()');
  const cpuEnd=await traceRecorder.mark('known-short-cpu-end');clockMarkers={cpuStart,cpuEnd};
  scheduler=await sampler.stop();sampler=null;
  trace=await traceRecorder.stop();
  const markerSuffixes=['known-short-cpu-start','known-short-cpu-end'];pageRenderer=resolvePageRendererTraceIdentity(trace,{markerSuffixes});rendererResolution=pageRenderer.available?resolveRendererThreadIdentity({traceIdentity:pageRenderer.identity,linuxCandidates:rendererDiscovery?.targets??[],linuxProcesses:rendererDiscovery?.rendererProcesses??[],rootPidNamespace:rendererDiscovery?.rootPidNamespace??null}):{status:'RENDERER_THREAD_UNAVAILABLE',reason:pageRenderer.reason};
  schedulerClockMapping=mapNodeClockToBrowserViaCdpMarkers({traceEvents:trace.traceEvents??[],cdpMarkers:trace.clock?.cdpMarkers??[],traceClockMapping:trace.clock?.traceToBrowserPerformance,markerSuffixes});
  const stepStart=(busyResult.windowStartMs+busyResult.windowEndMs)/2-(busyResult.durationMs/2),stepEnd=stepStart+busyResult.durationMs;
  schedulerAttribution=summarizeSchedulerSamples(scheduler?.samples??[],schedulerClockMapping,[[stepStart,stepEnd]],{targetIdentity:rendererResolution.status==='RENDERER_THREAD_RESOLVED'?pageRenderer.identity:null,requireTargetIdentity:true});
  if(trace.capabilities?.usableTrace===true){const artifactPath=output.replace(/\.json$/i,'.trace.json');await traceRecorder.writeRaw(artifactPath);rawTraceArtifact=artifactPath;}
  assessment=assessDiagnosticPreflight({browserStarted:!!browserVersion,pageInitialized:initialized.readyState==='complete',traceCapability:trace.capabilities,pageRenderer,rendererResolution,schedulerClockMapping,schedulerAttribution,busyResult,rawTraceArtifact});
  const step=assessment.schedulerStep,clockUncertaintyMs=assessment.clockUncertaintyMs;
  report={schemaVersion:1,classification:'DIAGNOSTIC_PREFLIGHT_ONLY',acceptanceResult:false,fullStageBWorkloadExecuted:false,finiteCampaignExecuted:false,sourceSha:process.env.GITHUB_SHA??null,nodeVersion:process.version,chromium:{product:browserVersion.product,revision:browserVersion.revision,protocolVersion:browserVersion.protocolVersion},runner:{platform:process.platform,release:release()},startedAt,completedAt:null,page:initialized,rendererIdentityBootstrap:{resolution:rendererIdentityBootstrap.resolution,identity:rendererIdentityBootstrap.identity,traceCapabilityAtStart:rendererIdentityBootstrap.traceCapabilityAtStart,traceCapability:rendererIdentityBootstrap.traceCapability,traceArtifact:rendererIdentityBootstrap.traceArtifact,traceEventCount:rendererIdentityBootstrap.traceEventCount,traceClock:rendererIdentityBootstrap.traceClock,failure:rendererIdentityBootstrap.failure},traceCapabilityAtStart:traceCapability,traceCapability:trace.capabilities,traceArtifact:rawTraceArtifact,traceEventCount:trace.eventCount,traceClock:trace.clock,tracePidTid:pageRenderer,linuxRendererResolution:rendererResolution,rendererDiscovery,schedulerCapability:{status:scheduler?.status??'RENDERER_THREAD_UNAVAILABLE',reason:scheduler?.reason??rendererDiscovery?.reason??null,requestedIntervalMs:scheduler?.requestedSampleIntervalMs??null,actualIntervalsMs:scheduler?.actualSampleIntervalsMs??[],medianObservedIntervalMs:scheduler?.medianObservedSampleIntervalMs??null,maxReadCostMs:scheduler?.maxReadCostMs??null,sampleCount:scheduler?.sampleCount??0,samplePairCount:step.samplePairCount??0,coverageMs:step.sampleCoverageMs??null,coverageRatio:step.coverageRatio??null,clockUncertaintyMs},knownCpuLoad:busyResult,clockMarkers,schedulerClockMapping,schedulerAttribution,preflightChecks:assessment.preflightChecks,failedChecks:assessment.failedChecks,preflightAccepted:false};
}catch(error){failure={name:error.name??'Error',message:error.message??String(error),stack:error.stack??null};}
finally{
  if(sampler){try{scheduler=await sampler.stop();}catch(error){failure??={name:error.name??'Error',message:error.message??String(error),stack:error.stack??null};}}
  if(traceRecorder&&!trace){try{trace=traceRecorder.finalized?traceRecorder.finalTrace:await traceRecorder.stop();if(trace.capabilities?.usableTrace===true){const artifactPath=output.replace(/\.json$/i,'.trace.json');await traceRecorder.writeRaw(artifactPath);rawTraceArtifact=artifactPath;}}catch(error){failure??={name:error.name??'Error',message:error.message??String(error),stack:error.stack??null};}}
  try{socket?.close();}catch{}
  if(child){try{child.kill('SIGKILL');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(2000)]);}catch(error){failure??={name:error.name??'Error',message:error.message??String(error),stack:error.stack??null};}}
  let profileRemoved=!profile;try{if(profile)await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100});profileRemoved=true;}catch(error){failure??={name:error.name??'Error',message:error.message??String(error),stack:error.stack??null};}
  const browserReleased=!child||!child.pid||child.exitCode!==null||child.signalCode!==null;
  if(report){report.resourceCleanup={browserReleased,profileRemoved};if(!browserReleased)report.failedChecks.push('browser-release');if(!profileRemoved)report.failedChecks.push('profile-removal');report.preflightAccepted=report.failedChecks.length===0;report.completedAt=new Date().toISOString();}
  if(failure){
    report??={schemaVersion:1,classification:'DIAGNOSTIC_PREFLIGHT_ONLY',acceptanceResult:false,fullStageBWorkloadExecuted:false,finiteCampaignExecuted:false,sourceSha:process.env.GITHUB_SHA??null,nodeVersion:process.version,chromium:browserVersion,startedAt,completedAt:null,rendererIdentityBootstrap:rendererIdentityBootstrap?{resolution:rendererIdentityBootstrap.resolution,identity:rendererIdentityBootstrap.identity,traceCapabilityAtStart:rendererIdentityBootstrap.traceCapabilityAtStart,traceCapability:rendererIdentityBootstrap.traceCapability,traceArtifact:rendererIdentityBootstrap.traceArtifact,traceEventCount:rendererIdentityBootstrap.traceEventCount,traceClock:rendererIdentityBootstrap.traceClock,failure:rendererIdentityBootstrap.failure}:null,traceCapability:trace?.capabilities??traceRecorder?.capabilitySnapshot?.()??null,traceArtifact:rawTraceArtifact,traceEventCount:trace?.eventCount??0,traceClock:trace?.clock??null,tracePidTid:pageRenderer,linuxRendererResolution:rendererResolution,rendererDiscovery,schedulerCapability:scheduler?{status:scheduler.status,reason:scheduler.reason,sampleCount:scheduler.sampleCount,samples:scheduler.samples}:null,knownCpuLoad:busyResult,clockMarkers,schedulerClockMapping,schedulerAttribution,preflightChecks:assessment?.preflightChecks??{failed:failure.message},failedChecks:assessment?.failedChecks??['preflight-execution'],preflightAccepted:false};
    report.failure=failure;report.preflightAccepted=false;if(!report.failedChecks.includes('preflight-execution')&&!assessment)report.failedChecks.push('preflight-execution');report.completedAt=new Date().toISOString();
  }
  try{await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2));}catch(writeError){console.error('DIAGNOSTIC_PREFLIGHT_ARTIFACT_WRITE_ERROR',writeError.message);failure??={name:writeError.name??'Error',message:writeError.message??String(writeError)};report.preflightAccepted=false;report.failedChecks=[...new Set([...report.failedChecks,'artifact-serialization'])];process.exitCode=1;}
  if(report?.preflightAccepted)console.log('REACTION_LAB_DIAGNOSTIC_PREFLIGHT',JSON.stringify(report));else{console.error('REACTION_LAB_DIAGNOSTIC_PREFLIGHT_FAILED',JSON.stringify(report));process.exitCode=1;}
}
