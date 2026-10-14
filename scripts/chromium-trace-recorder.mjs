import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {classifyTraceCapabilities,mapTraceClock,mapTraceClockViaCdpMarkers,STAGE_B_TRACE_CATEGORIES} from './stage-b-trace-attribution.mjs';

const hrMs=value=>Number(value)/1e6;
const getArgsName=event=>event?.args?.name??event?.args?.data?.name??event?.args?.data?.message??null;

export class ChromiumTraceRecorder{
  constructor({socket,send,evaluate,label='chromium-diagnostic'}){
    this.socket=socket;this.send=send;this.evaluate=evaluate;this.label=label;
    this.available=false;this.started=false;this.completed=false;this.startErrors=[];this.endError=null;
    this.categories=[];this.categoriesAvailable=false;this.events=[];this.browserMarkers=[];this.nodeClockPairs=[];this.cdpMarkers=[];this.startCategories=[...STAGE_B_TRACE_CATEGORIES];this.bufferUsageSamples=[];
    this.completeEvent=null;this.completeResolve=null;this.completePromise=null;this.streamReadError=null;this.rawStream='';this.traceJson=null;
    this.listener=event=>{
      let message;try{message=JSON.parse(event.data);}catch{return;}
      if(message.method==='Tracing.dataCollected')this.events.push(...(message.params?.value??[]));
      if(message.method==='Tracing.bufferUsage')this.bufferUsageSamples.push(message.params??{});
      if(message.method==='Tracing.tracingComplete'){
        this.completed=true;this.completeEvent=message.params??{};this.completeResolve?.(this.completeEvent);
      }
    };
    socket.addEventListener('message',this.listener);
  }

  async start(){
    try{const result=await this.send('Tracing.getCategories');this.categories=result.categories??[];this.categoriesAvailable=Array.isArray(result.categories);}catch(error){this.startErrors.push(`Tracing.getCategories: ${error.message}`);}
    this.completePromise=new Promise(resolve=>{this.completeResolve=resolve;});
    const traceConfig={includedCategories:STAGE_B_TRACE_CATEGORIES,recordMode:'recordUntilFull',traceBufferSizeInKb:32768,enableSampling:true};
    try{
      await this.send('Tracing.start',{traceConfig,transferMode:'ReturnAsStream',streamFormat:'json',bufferUsageReportingInterval:1000});
      this.available=true;this.started=true;
      this.startProtocol='traceConfig+ReturnAsStream';
    }catch(firstError){
      this.startErrors.push(`Tracing.start(traceConfig/ReturnAsStream): ${firstError.message}`);
      try{
        await this.send('Tracing.start',{categories:STAGE_B_TRACE_CATEGORIES.join(','),transferMode:'ReportEvents',bufferUsageReportingInterval:1000});
        this.available=true;this.started=true;this.startProtocol='categories+ReportEvents';
      }catch(secondError){
        this.startErrors.push(`Tracing.start(categories/ReportEvents): ${secondError.message}`);
        const fallbackCategories=[...new Set([...this.categories.filter(category=>STAGE_B_TRACE_CATEGORIES.includes(category)),'devtools.timeline','toplevel','blink.user_timing'])];
        try{
          await this.send('Tracing.start',{categories:fallbackCategories.join(','),transferMode:'ReportEvents',bufferUsageReportingInterval:1000});
          this.available=true;this.started=true;this.startProtocol='reported+ReportEvents';this.startCategories=fallbackCategories;
        }catch(thirdError){this.startErrors.push(`Tracing.start(reported categories/ReportEvents): ${thirdError.message}`);this.startProtocol=null;}
      }
    }
    return this.capabilitySnapshot();
  }

  async mark(id){
    const browserMarkId=`trace-browser-clock-${this.label}-${id}`,nodeStart=process.hrtime.bigint();let browserClock=null,browserError=null,linuxUptime=null,linuxUptimeError=null;
    try{browserClock=await this.evaluate(`(()=>{const low=performance.now();performance.mark(${JSON.stringify(browserMarkId)});const high=performance.now();return{id:${JSON.stringify(browserMarkId)},browserLowMs:low,browserHighMs:high,timeOriginMs:performance.timeOrigin,dateNowMs:Date.now()}})()`);}catch(error){browserError=error.message;}
    const uptimeReadStart=process.hrtime.bigint();try{const uptimeText=await readFile('/proc/uptime','utf8');linuxUptime={uptimeSeconds:Number(uptimeText.trim().split(/\s+/)[0]),idleSeconds:Number(uptimeText.trim().split(/\s+/)[1]),nodeReadStartHrtimeNs:uptimeReadStart.toString(),nodeReadEndHrtimeNs:process.hrtime.bigint().toString()};}catch(error){linuxUptimeError=error.message;}
    const nodeAfter=process.hrtime.bigint(),nodePair={id,browserMarkId,nodeStartHrtimeNs:nodeStart.toString(),nodeEndHrtimeNs:nodeAfter.toString(),nodeStartHrtimeMs:hrMs(nodeStart),nodeEndHrtimeMs:hrMs(nodeAfter),browserClock,browserError,linuxUptime,linuxUptimeError};
    this.nodeClockPairs.push(nodePair);
    let cdpMarker=null,cdpMarkerError=null;
    if(this.available){
      const syncId=`trace-cdp-clock-${this.label}-${id}`,before=process.hrtime.bigint();
      try{await this.send('Tracing.recordClockSyncMarker',{syncId});cdpMarker=true;}catch(error){cdpMarker=false;cdpMarkerError=error.message;}
      const after=process.hrtime.bigint();this.cdpMarkers.push({id,syncId,success:cdpMarker,error:cdpMarkerError,nodeStartHrtimeNs:before.toString(),nodeEndHrtimeNs:after.toString(),nodeStartHrtimeMs:hrMs(before),nodeEndHrtimeMs:hrMs(after)});
    }
    if(browserClock&&browserMarkId)this.browserMarkers.push(browserClock);
    return{...nodePair,cdpClockSyncMarker:{attempted:this.available,success:cdpMarker,error:cdpMarkerError}};
  }

  async stop({timeoutMs=15000}={}){
    if(this.started){
      try{await this.send('Tracing.end');}catch(error){this.endError=`Tracing.end: ${error.message}`;}
      if(!this.completed){
        let timeout;
        try{await Promise.race([this.completePromise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error(`Tracing.tracingComplete timeout after ${timeoutMs}ms`)),timeoutMs);})]);}catch(error){this.endError??=error.message;}finally{clearTimeout(timeout);}
      }
      if(this.completed&&this.completeEvent?.stream)await this.readStream(this.completeEvent.stream);
    }
    const categoriesObserved=[...new Set(this.events.flatMap(event=>typeof event.cat==='string'?event.cat.split(','):[]))].sort();
    const threadMetadata=this.events.filter(event=>event.ph==='M'&&['process_name','thread_name','process_sort_index','thread_sort_index'].includes(event.name)).map(event=>({name:event.name,pid:event.pid,tid:event.tid,label:getArgsName(event),args:event.args}));
    const directTraceClockMapping=mapTraceClock(this.events,this.browserMarkers);
    const traceClockMapping=directTraceClockMapping.available?directTraceClockMapping:mapTraceClockViaCdpMarkers(this.events,this.cdpMarkers,this.nodeClockPairs);
    const streamExpected=this.startProtocol==='traceConfig+ReturnAsStream',capabilities=classifyTraceCapabilities({categoriesAvailable:this.categoriesAvailable,requestedCategories:STAGE_B_TRACE_CATEGORIES,startSucceeded:this.available,clockSyncSucceeded:this.cdpMarkers.some(marker=>marker.success),traceEndSucceeded:this.completed,streamExpected,streamReadSucceeded:streamExpected&&!!this.completeEvent?.stream&&this.streamReadError===null,eventCount:this.events.length,threadMetadataCount:threadMetadata.length});
    const trace={schemaVersion:1,label:this.label,startProtocol:this.startProtocol,startCategories:this.startCategories,capabilities,categoryProbe:{available:this.categoriesAvailable,reported:this.categories,requested:STAGE_B_TRACE_CATEGORIES,requestedAndReported:STAGE_B_TRACE_CATEGORIES.filter(category=>this.categories.includes(category)),observed:categoriesObserved},startErrors:this.startErrors,endError:this.endError,dataLossOccurred:this.completeEvent?.dataLossOccurred??null,streamFormat:this.completeEvent?.traceFormat??null,streamCompression:this.completeEvent?.streamCompression??null,streamReadError:this.streamReadError,eventCount:this.events.length,bufferUsageSamples:this.bufferUsageSamples,threadMetadata,clock:{domains:{browserPerformanceNow:'milliseconds relative to performance.timeOrigin; bracketed by each Runtime.evaluate mark',browserTimeOrigin:'performance.timeOrigin in epoch milliseconds, recorded as metadata only',traceTimestamp:'Chromium trace event ts/dur in microseconds, mapped from browser marks or CDP clock-sync markers',nodeHrtime:'process.hrtime.bigint() nanoseconds; paired with browser Runtime.evaluate and Tracing.recordClockSyncMarker',linuxUptime:'seconds from /proc/uptime; retained as a distinct Linux clock observation, not assumed equal to Node hrtime',threadCpuAndScheduler:'cumulative /proc thread CPU ticks and schedstat nanosecond counters; compared only as in-window deltas'},browserMarkers:this.browserMarkers,nodeClockPairs:this.nodeClockPairs,cdpMarkers:this.cdpMarkers,directTraceToBrowserPerformance:directTraceClockMapping,traceToBrowserPerformance:traceClockMapping},gcEventCount:this.events.filter(event=>/gc|garbage|scavenge|mark.?compact/i.test(`${event.name??''} ${event.cat??''}`)).length,compileEventCount:this.events.filter(event=>/compile|optim|deopt|tiering|baseline/i.test(`${event.name??''} ${event.cat??''}`)).length,traceEvents:this.events};
    this.socket.removeEventListener('message',this.listener);
    return trace;
  }

  async readStream(handle){
    const chunks=[];
    try{
      for(let count=0;count<10000;count++){
        const chunk=await this.send('IO.read',{handle});
        if(chunk.base64Encoded)chunks.push(Buffer.from(chunk.data,'base64'));
        else chunks.push(Buffer.from(chunk.data??'','utf8'));
        if(chunk.eof)break;
        if(count===9999)throw Error('Trace stream exceeded 10000 chunks');
      }
      await this.send('IO.close',{handle});
      this.rawStream=Buffer.concat(chunks).toString('utf8');
      try{this.traceJson=JSON.parse(this.rawStream);this.events=Array.isArray(this.traceJson.traceEvents)?this.traceJson.traceEvents:this.events;}catch(error){this.streamReadError=`trace JSON parse: ${error.message}`;}
    }catch(error){this.streamReadError=error.message;try{await this.send('IO.close',{handle});}catch{}}
  }

  capabilitySnapshot(){
    return{categoriesAvailable:this.categoriesAvailable,available:this.available,startProtocol:this.startProtocol??null,requestedCategories:STAGE_B_TRACE_CATEGORIES,actualStartCategories:this.startCategories,requestedAndReported:STAGE_B_TRACE_CATEGORIES.filter(category=>this.categories.includes(category)),startErrors:[...this.startErrors]};
  }

  async writeRaw(filePath){
    await mkdir(dirname(filePath),{recursive:true});
    const content=this.rawStream||JSON.stringify(this.traceJson??{traceEvents:this.events},null,2);
    await writeFile(filePath,content);
  }
}
