import {captureChromiumProcessAuthority} from './chromium-process-authority.mjs';
export {captureChromiumProcessAuthority,connectBrowserProcessMetadata} from './chromium-process-authority.mjs';
import {ChromiumTraceRecorder} from './chromium-trace-recorder.mjs';
import {resolvePageRendererTraceIdentity} from './stage-b-diagnostic-finalization.mjs';

/** Capture a tiny trace mark so later samples can target this page's renderer. */
export async function capturePageRendererIdentity({socket,send,evaluate,label='renderer-identity',tracePath=null,browserSend=null}={}){
  const recorder=new ChromiumTraceRecorder({socket,send,evaluate,label});
  let trace=null,traceCapabilityAtStart=null,failure=null,traceArtifact=null;
  try{
    traceCapabilityAtStart=await recorder.start();
    const marker=await recorder.mark('renderer-identity');
    trace=await recorder.stop();
    const resolution=resolvePageRendererTraceIdentity(trace,{markerSuffixes:['renderer-identity']});
    const processAuthority=await captureChromiumProcessAuthority(browserSend,resolution);
    if(resolution.identity)resolution.identity.processAuthority=processAuthority;
    if(trace.capabilities?.usableTrace===true&&tracePath){
      try{await recorder.writeRaw(tracePath);traceArtifact=tracePath;}catch(error){failure={name:error.name??'Error',message:error.message??String(error)};}
    }
    return{resolution,processAuthority,identity:resolution.identity??null,traceCapabilityAtStart,traceCapability:trace.capabilities,traceArtifact,traceEventCount:trace.eventCount,traceClock:trace.clock,marker:{id:marker.id,browserClock:marker.browserClock,cdpClockSyncMarker:marker.cdpClockSyncMarker},failure};
  }catch(error){
    failure={name:error.name??'Error',message:error.message??String(error),stack:error.stack??null};
    if(recorder.started){try{trace=await recorder.stop();}catch(stopError){failure.finalizeError=stopError.message;}}
    return{resolution:{available:false,reason:'renderer-identity-trace-failed',identity:null,markerIds:[]},identity:null,traceCapabilityAtStart,traceCapability:trace?.capabilities??recorder.capabilitySnapshot(),traceArtifact:null,traceEventCount:trace?.eventCount??0,traceClock:trace?.clock??null,marker:null,failure};
  }
}
