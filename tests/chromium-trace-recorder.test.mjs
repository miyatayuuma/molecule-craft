import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ChromiumTraceRecorder} from '../scripts/chromium-trace-recorder.mjs';

class MockSocket extends EventTarget{}
const emit=(socket,message)=>{const event=new Event('message');Object.defineProperty(event,'data',{value:JSON.stringify(message)});socket.dispatchEvent(event);};

test('trace recorder requests explicit categories, reads a trace stream, and maps browser marks',async()=>{
  const socket=new MockSocket(),browserMarkers=[],seenMethods=[],rawEvents=[];let clock=100;
  const send=async(method,params={})=>{
    seenMethods.push({method,params});
    if(method==='Tracing.getCategories')return{categories:['devtools.timeline','blink.user_timing']};
    if(method==='Tracing.start'){emit(socket,{method:'Tracing.bufferUsage',params:{percentFull:.01,eventCount:4}});return{};}
    if(method==='Tracing.recordClockSyncMarker')return{};
    if(method==='Tracing.end'){emit(socket,{method:'Tracing.tracingComplete',params:{stream:'trace-stream',traceFormat:'json',dataLossOccurred:false}});return{};}
    if(method==='IO.read')return{data:JSON.stringify({traceEvents:rawEvents}),eof:true};
    if(method==='IO.close')return{};
    throw Error(`unexpected method: ${method}`);
  };
  const evaluate=async expression=>{
    const match=expression.match(/performance\.mark\((".*?")\)/);assert.ok(match,'mark expression includes an explicit browser mark name');
    const id=JSON.parse(match[1]),value={id,browserLowMs:clock,browserHighMs:clock+.01,timeOriginMs:123456,dateNowMs:123579};clock+=100;browserMarkers.push(value);rawEvents.push({name:'blink.user_timing',cat:'blink.user_timing',ph:'R',ts:(clock-100)*1000,args:{data:{name:id}}});return value;
  };
  const recorder=new ChromiumTraceRecorder({socket,send,evaluate,label:'unit'}),capability=await recorder.start();
  assert.equal(capability.categoriesAvailable,true);assert.equal(capability.available,true);assert.equal(capability.startProtocol,'traceConfig+ReturnAsStream');
  const start=await recorder.mark('start'),end=await recorder.mark('end'),trace=await recorder.stop();
  assert.equal(start.cdpClockSyncMarker.success,true);assert.equal(end.cdpClockSyncMarker.success,true);
  assert.ok(seenMethods.some(item=>item.method==='Tracing.getCategories'));
  const startCall=seenMethods.find(item=>item.method==='Tracing.start');
  assert.deepEqual(startCall.params.traceConfig.includedCategories,['devtools.timeline','disabled-by-default-devtools.timeline','v8','disabled-by-default-v8.gc','disabled-by-default-v8.compile','blink.user_timing','toplevel']);
  assert.equal(startCall.params.transferMode,'ReturnAsStream');
  assert.equal(startCall.params.bufferUsageReportingInterval,1000);
  assert.ok(seenMethods.some(item=>item.method==='Tracing.recordClockSyncMarker'));
  assert.ok(seenMethods.some(item=>item.method==='IO.read'));
  assert.equal(trace.capabilities.usableTrace,true);assert.equal(trace.eventCount,2);assert.equal(trace.clock.traceToBrowserPerformance.available,true);assert.equal(trace.clock.traceToBrowserPerformance.matchedMarkerIds.length,2);assert.equal(trace.bufferUsageSamples[0].percentFull,.01);assert.ok(browserMarkers.length===2);
  const directory=await mkdtemp(join(tmpdir(),'molecule-craft-trace-test-'));
  try{const output=join(directory,'trace.json');await recorder.writeRaw(output);assert.equal(JSON.parse(await readFile(output,'utf8')).traceEvents.length,2);}finally{await rm(directory,{recursive:true,force:true});}
});

test('trace recorder falls back to ReportEvents and retains capability failures',async()=>{
  const socket=new MockSocket(),seen=[];
  const send=async(method,params={})=>{
    seen.push({method,params});
    if(method==='Tracing.getCategories')throw Error('method not found');
    if(method==='Tracing.start'&&params.traceConfig)throw Error('traceConfig unsupported');
    if(method==='Tracing.start')return{};
    if(method==='Tracing.recordClockSyncMarker')throw Error('unsupported');
    if(method==='Tracing.end'){emit(socket,{method:'Tracing.tracingComplete',params:{dataLossOccurred:false}});return{};}
    throw Error(`unexpected method: ${method}`);
  };
  const recorder=new ChromiumTraceRecorder({socket,send,evaluate:async()=>({browserLowMs:10,browserHighMs:10.01,timeOriginMs:20,dateNowMs:30}),label:'fallback'});
  const start=await recorder.start();assert.equal(start.available,true);assert.equal(start.categoriesAvailable,false);assert.equal(start.startProtocol,'categories+ReportEvents');
  const mark=await recorder.mark('one');assert.equal(mark.cdpClockSyncMarker.success,false);
  const trace=await recorder.stop();assert.equal(trace.capabilities.categoryDiscovery,'UNAVAILABLE');assert.equal(trace.capabilities.clockSyncMarker,'UNAVAILABLE');assert.equal(trace.capabilities.traceCompletion,'AVAILABLE');assert.equal(trace.capabilities.traceStreamRead,'NOT_USED');assert.equal(trace.capabilities.usableTrace,false);assert.ok(trace.startErrors.length>=2);
  assert.ok(seen.some(item=>item.method==='Tracing.start'&&item.params.transferMode==='ReportEvents'));
});

test('trace recorder retries with browser-reported categories after explicit categories fail',async()=>{
  const socket=new MockSocket(),seen=[];
  const send=async(method,params={})=>{
    seen.push({method,params});
    if(method==='Tracing.getCategories')return{categories:['blink.user_timing','devtools.timeline']};
    if(method==='Tracing.start'&&params.traceConfig)throw Error('traceConfig unsupported');
    if(method==='Tracing.start'&&params.categories.includes('disabled-by-default-v8.gc'))throw Error('unsupported category');
    if(method==='Tracing.start')return{};
    if(method==='Tracing.end'){emit(socket,{method:'Tracing.tracingComplete',params:{dataLossOccurred:false}});return{};}
    throw Error(`unexpected method: ${method}`);
  };
  const recorder=new ChromiumTraceRecorder({socket,send,evaluate:async()=>({browserLowMs:10,browserHighMs:10.01,timeOriginMs:20,dateNowMs:30}),label:'reported-fallback'}),capability=await recorder.start();
  assert.equal(capability.available,true);assert.equal(capability.startProtocol,'reported+ReportEvents');assert.deepEqual(capability.actualStartCategories,['blink.user_timing','devtools.timeline','toplevel']);
  const trace=await recorder.stop();assert.deepEqual(trace.startCategories,['blink.user_timing','devtools.timeline','toplevel']);assert.equal(trace.capabilities.usableTrace,false);assert.equal(seen.filter(item=>item.method==='Tracing.start').length,3);
});
