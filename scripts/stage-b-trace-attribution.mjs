export const STAGE_B_TRACE_CATEGORIES=Object.freeze([
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.stack',
  'disabled-by-default-v8.cpu_profiler',
  'v8',
  'disabled-by-default-v8.gc',
  'disabled-by-default-v8.compile',
  'blink.user_timing',
  'toplevel',
]);

const median=values=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};

export function fitClockMapping(pairs,{minimumSpanMs=10}={}){
  const points=(pairs??[]).filter(point=>Number.isFinite(point.sourceMs)&&Number.isFinite(point.targetLowMs)&&Number.isFinite(point.targetHighMs)&&point.targetHighMs>=point.targetLowMs).map(point=>({sourceMs:point.sourceMs,targetMs:(point.targetLowMs+point.targetHighMs)/2,sourceUncertaintyMs:Math.max(0,point.sourceUncertaintyMs??0),targetUncertaintyMs:(point.targetHighMs-point.targetLowMs)/2}));
  if(points.length<2)return{available:false,reason:'fewer-than-two-clock-pairs',pairCount:points.length};
  const minSource=Math.min(...points.map(point=>point.sourceMs)),maxSource=Math.max(...points.map(point=>point.sourceMs));
  if(maxSource-minSource<minimumSpanMs)return{available:false,reason:'clock-pairs-too-close',pairCount:points.length,sourceSpanMs:maxSource-minSource};
  const meanX=points.reduce((sum,point)=>sum+point.sourceMs,0)/points.length,meanY=points.reduce((sum,point)=>sum+point.targetMs,0)/points.length;
  const variance=points.reduce((sum,point)=>sum+(point.sourceMs-meanX)**2,0),covariance=points.reduce((sum,point)=>sum+(point.sourceMs-meanX)*(point.targetMs-meanY),0);
  if(!(variance>0))return{available:false,reason:'clock-source-has-no-span',pairCount:points.length};
  const slope=covariance/variance,offset=meanY-slope*meanX;
  if(!Number.isFinite(slope)||slope<.95||slope>1.05)return{available:false,reason:'clock-rate-inconsistent',pairCount:points.length,slope};
  const residuals=points.map(point=>Math.abs(point.targetMs-(slope*point.sourceMs+offset))),residualMs=Math.max(...residuals);
  const uncertaintyMs=Math.max(...points.map(point=>point.targetUncertaintyMs+slope*point.sourceUncertaintyMs))+residualMs+.005;
  return{available:true,slope,offset,uncertaintyMs,pairCount:points.length,sourceSpanMs:maxSource-minSource,maxResidualMs:residualMs,clockMap:'targetMs = slope * sourceMs + offset'};
}

export function mapNodeClockPairsToBrowserPerformance(nodeClockPairs,{minimumSpanMs=10}={}){
  const pairs=(nodeClockPairs??[]).filter(pair=>pair?.browserClock&&Number.isFinite(pair.nodeStartHrtimeMs)&&Number.isFinite(pair.nodeEndHrtimeMs)&&Number.isFinite(pair.browserClock.browserLowMs)&&Number.isFinite(pair.browserClock.browserHighMs)).map(pair=>({id:pair.id,sourceMs:(pair.nodeStartHrtimeMs+pair.nodeEndHrtimeMs)/2,sourceUncertaintyMs:(pair.nodeEndHrtimeMs-pair.nodeStartHrtimeMs)/2,targetLowMs:pair.browserClock.browserLowMs,targetHighMs:pair.browserClock.browserHighMs}));
  return{...fitClockMapping(pairs,{minimumSpanMs}),clockMap:'Node hrtime → bracketed Browser performance.now',pairs};
}

function tracePayloadContains(event,needle){
  if(!event||typeof event!=='object')return false;
  try{return JSON.stringify(event.args??{}).includes(needle)||event.name===needle;}catch{return event.name===needle;}
}

export function mapNodeClockToBrowserViaCdpMarkers({traceEvents=[],cdpMarkers=[],traceClockMapping,markerSuffixes=[],minimumSpanMs=10}={}){
  if(!traceClockMapping?.available)return{available:false,reason:'trace-to-browser-clock-unavailable',pairCount:0};
  const pairs=[];
  for(const suffix of markerSuffixes){
    const marker=(cdpMarkers??[]).find(row=>row.success&&row.syncId?.endsWith(`-${suffix}`));
    if(!marker)continue;
    const event=(traceEvents??[]).find(row=>tracePayloadContains(row,marker.syncId));
    const nodeStartMs=Number(marker.nodeStartHrtimeMs),nodeEndMs=Number(marker.nodeEndHrtimeMs);
    if(!event||!Number.isFinite(event.ts)||!Number.isFinite(nodeStartMs)||!Number.isFinite(nodeEndMs)||nodeEndMs<nodeStartMs)continue;
    const browserAtMarker=traceClockMapping.slope*(event.ts/1000)+traceClockMapping.offset,traceUncertaintyMs=Number(traceClockMapping.uncertaintyMs??0)+.001;
    pairs.push({id:marker.syncId,sourceMs:(nodeStartMs+nodeEndMs)/2,sourceUncertaintyMs:(nodeEndMs-nodeStartMs)/2,targetLowMs:browserAtMarker-traceUncertaintyMs,targetHighMs:browserAtMarker+traceUncertaintyMs,traceTimestampUs:event.ts});
  }
  const mapping=fitClockMapping(pairs,{minimumSpanMs});
  return{...mapping,markerSuffixes:[...markerSuffixes],pairs,clockMap:'Node hrtime → CDP trace clock-sync marker → Browser performance.now'};
}

export function mapTraceClock(events,browserMarkers,{minimumSpanMs=10}={}){
  const pairs=[];
  for(const marker of browserMarkers??[]){
    const event=(events??[]).find(row=>tracePayloadContains(row,marker.id));
    if(!event||!Number.isFinite(event.ts)||!Number.isFinite(marker.browserLowMs)||!Number.isFinite(marker.browserHighMs))continue;
    pairs.push({id:marker.id,sourceMs:event.ts/1000,sourceUncertaintyMs:.001,targetLowMs:marker.browserLowMs,targetHighMs:marker.browserHighMs,traceTimestampUs:event.ts});
  }
  const mapping=fitClockMapping(pairs,{minimumSpanMs});
  return{...mapping,matchedMarkerIds:pairs.map(pair=>pair.id),pairs};
}

export function mapTraceClockViaCdpMarkers(events,cdpMarkers,nodeClockPairs,{minimumSpanMs=10}={}){
  const traceToNodePairs=[];
  for(const marker of cdpMarkers??[]){
    if(!marker.success)continue;
    const event=(events??[]).find(row=>tracePayloadContains(row,marker.syncId));
    if(!event||!Number.isFinite(event.ts))continue;
    traceToNodePairs.push({id:marker.syncId,sourceMs:event.ts/1000,sourceUncertaintyMs:.001,targetLowMs:Number(marker.nodeStartHrtimeNs)/1e6,targetHighMs:Number(marker.nodeEndHrtimeNs)/1e6,traceTimestampUs:event.ts});
  }
  const traceToNode=fitClockMapping(traceToNodePairs,{minimumSpanMs});
  const nodeToBrowserPairs=(nodeClockPairs??[]).filter(pair=>pair.browserClock&&Number.isFinite(pair.browserClock.browserLowMs)&&Number.isFinite(pair.browserClock.browserHighMs)).map(pair=>({id:pair.id,sourceMs:(pair.nodeStartHrtimeMs+pair.nodeEndHrtimeMs)/2,sourceUncertaintyMs:(pair.nodeEndHrtimeMs-pair.nodeStartHrtimeMs)/2,targetLowMs:pair.browserClock.browserLowMs,targetHighMs:pair.browserClock.browserHighMs}));
  const nodeToBrowser=fitClockMapping(nodeToBrowserPairs,{minimumSpanMs});
  if(!traceToNode.available)return{available:false,reason:`trace-to-node ${traceToNode.reason}`,traceToNode,nodeToBrowser};
  if(!nodeToBrowser.available)return{available:false,reason:`node-to-browser ${nodeToBrowser.reason}`,traceToNode,nodeToBrowser};
  return{available:true,slope:nodeToBrowser.slope*traceToNode.slope,offset:nodeToBrowser.slope*traceToNode.offset+nodeToBrowser.offset,uncertaintyMs:nodeToBrowser.uncertaintyMs+nodeToBrowser.slope*traceToNode.uncertaintyMs,pairCount:Math.min(traceToNode.pairCount,nodeToBrowser.pairCount),clockMap:'Trace → Node monotonic → Browser performance.now',sourceSpanMs:traceToNode.sourceSpanMs,traceToNode,nodeToBrowser};
}

function mappedEvent(event,mapping){
  if(!mapping?.available||!Number.isFinite(event?.ts))return null;
  const startMs=mapping.slope*(event.ts/1000)+mapping.offset,durationMs=Number.isFinite(event.dur)?mapping.slope*(event.dur/1000):0;
  return{pid:Number.isFinite(event.pid)?event.pid:null,tid:Number.isFinite(event.tid)?event.tid:null,name:String(event.name??''),category:String(event.cat??''),phase:event.ph??null,startMs,endMs:startMs+durationMs,durationMs,rawTimestampUs:event.ts,rawDurationUs:Number.isFinite(event.dur)?event.dur:null,args:event.args?.data??event.args?.beginData??null};
}

const looksLikeGc=event=>/\bgc\b|garbage|scavenge|mark.?compact|incremental.?mark|sweeping/i.test(`${event.name} ${event.category}`);
const looksLikeCompile=event=>/compile|optim|deopt|tiering|baseline.?compile|code.?gen/i.test(`${event.name} ${event.category}`);
const looksLikeJs=event=>/functioncall|evaluatescript|runmicrotasks|v8\.run|v8\.execute|scriptentry|javascript/i.test(`${event.name} ${event.category}`);
const looksLikeTask=event=>/layout|paint|composit|style.?recalc|prepaint|raster|parsehtml|update.?layout/i.test(`${event.name} ${event.category}`);
const looksLikeTaskEnvelope=event=>/runtask|threadcontroller|message.?loop|taskqueue/i.test(`${event.name} ${event.category}`);
function eventCoverage(events,startMs,endMs){
  const spans=(events??[]).map(event=>[Math.max(startMs,event.startMs),Math.min(endMs,event.endMs)]).filter(([start,end])=>end>start).sort((a,b)=>a[0]-b[0]);let total=0,current=null;
  for(const span of spans){if(!current)current=[...span];else if(span[0]<=current[1])current[1]=Math.max(current[1],span[1]);else{total+=current[1]-current[0];current=[...span];}}
  return total+(current?current[1]-current[0]:0);
}

export function attributeSlowIntervals({label,sourceSha,trialNumber,durationsMs,stepWindowsMs,traceEvents=[],traceClockMapping,schedulerPerStep=[],rendererMainThreads=[],budgetMs=8.333333333333334}){
  const mapped=(traceEvents??[]).map(event=>mappedEvent(event,traceClockMapping)).filter(Boolean),records=[];
  for(let stepIndex=0;stepIndex<(durationsMs??[]).length;stepIndex++){
    const durationMs=durationsMs[stepIndex];if(!(durationMs>budgetMs))continue;
    const [startMs,endMs]=stepWindowsMs?.[stepIndex]??[];
    const scheduler=schedulerPerStep?.[stepIndex]??null;
    const overlapping=Number.isFinite(startMs)&&Number.isFinite(endMs)?mapped.filter(event=>event.startMs<endMs+ (traceClockMapping?.uncertaintyMs??0)&&event.endMs>startMs-(traceClockMapping?.uncertaintyMs??0)):[];
    const schedulerThread=Number.isInteger(scheduler?.pid)&&Number.isInteger(scheduler?.tid)?{pid:scheduler.pid,tid:scheduler.tid,source:'proc-schedstat'}:null;
    const traceThreads=(rendererMainThreads??[]).filter(thread=>Number.isInteger(thread.pid)&&Number.isInteger(thread.tid));
    const threadCandidates=schedulerThread?[schedulerThread]:traceThreads;
    const threadScores=threadCandidates.map(thread=>({...thread,score:overlapping.filter(event=>event.pid===thread.pid&&event.tid===thread.tid).length})).sort((a,b)=>b.score-a.score);
    const chosenThread=threadScores.length===1?threadScores[0]:threadScores.length>1&&threadScores[0].score>threadScores[1].score?threadScores[0]:null;
    const threadIdKnown=!!chosenThread;
    const mainThreadEvents=chosenThread?overlapping.filter(event=>event.pid===chosenThread.pid&&event.tid===chosenThread.tid):[];
    const gc=mainThreadEvents.filter(looksLikeGc),compile=mainThreadEvents.filter(looksLikeCompile),js=mainThreadEvents.filter(looksLikeJs),tasks=mainThreadEvents.filter(looksLikeTask);
    const gcCoverageMs=Number.isFinite(startMs)&&Number.isFinite(endMs)?eventCoverage(gc,startMs,endMs):0,compileCoverageMs=Number.isFinite(startMs)&&Number.isFinite(endMs)?eventCoverage(compile,startMs,endMs):0,jsCoverageMs=Number.isFinite(startMs)&&Number.isFinite(endMs)?eventCoverage(js,startMs,endMs):0,taskCoverageMs=Number.isFinite(startMs)&&Number.isFinite(endMs)?eventCoverage(tasks,startMs,endMs):0;
    let classification='UNATTRIBUTED',reason='insufficient-clock-thread-or-counter-evidence';
    if(scheduler?.available&&scheduler.adequate&&scheduler.runQueueWaitMs>=durationMs*.5&&scheduler.runtimeMs<=durationMs*.5){classification='OS_SCHEDULER_WAIT';reason='renderer main thread schedstat run-queue wait dominates its measured runtime';}
    else if(scheduler?.available&&scheduler.adequate&&scheduler.state==='D'){classification='BLOCKED_OR_WAITING';reason='renderer main thread was observed in uninterruptible sleep during adequate scheduler samples';}
    else if(gcCoverageMs>=durationMs*.5&&scheduler?.available&&scheduler.adequate&&scheduler.runtimeMs>=durationMs*.5){classification='V8_GC';reason='V8/GC trace events cover at least half of the slow interval while renderer main-thread CPU runtime is also observed';}
    else if(compileCoverageMs>=durationMs*.5&&scheduler?.available&&scheduler.adequate&&scheduler.runtimeMs>=durationMs*.5){classification='V8_COMPILE_JIT';reason='V8 compile/optimization trace events cover at least half of the slow interval while renderer main-thread CPU runtime is also observed';}
    else if(scheduler?.available&&scheduler.adequate&&scheduler.runtimeMs>=durationMs*.5&&scheduler.runQueueWaitMs<=durationMs*.25&&jsCoverageMs>=durationMs*.25){classification='JS_EXECUTION';reason='renderer main thread accumulated CPU runtime while JavaScript trace events covered at least a quarter of the slow interval';}
    else if(scheduler?.available&&scheduler.adequate&&scheduler.runtimeMs>=durationMs*.5&&scheduler.runQueueWaitMs<=durationMs*.25&&taskCoverageMs>=durationMs*.25){classification='CHROMIUM_OTHER_TASK';reason='renderer main thread accumulated CPU runtime while explicit layout/paint/compositor task events covered at least a quarter of the slow interval';}
    else if(scheduler?.available&&scheduler.adequate&&scheduler.state==='S'&&scheduler.runtimeMs<=durationMs*.25){classification='BLOCKED_OR_WAITING';reason='renderer main thread samples were sleeping with little CPU runtime and no dominant run-queue wait';}
    const matched=mainThreadEvents.filter(event=>looksLikeGc(event)||looksLikeCompile(event)||looksLikeJs(event)||looksLikeTask(event)||looksLikeTaskEnvelope(event)).map(event=>({name:event.name,category:event.category,pid:event.pid,tid:event.tid,phase:event.phase,startMs:event.startMs,endMs:event.endMs,durationMs:event.durationMs,args:event.args}));
    const schedulerClockUncertainty=scheduler?.clockMappingUncertaintyMs,combinedClockUncertainty=Math.max(traceClockMapping?.available?traceClockMapping.uncertaintyMs:Infinity,Number.isFinite(schedulerClockUncertainty)?schedulerClockUncertainty:Infinity),attributionConfidence=threadIdKnown&&scheduler?.available&&scheduler?.adequate&&Number.isFinite(combinedClockUncertainty)&&combinedClockUncertainty<=Math.min(.5,durationMs*.1)?'HIGH':scheduler?.counterAvailable||scheduler?.available?'LIMITED':'UNAVAILABLE';
    if(attributionConfidence!=='HIGH'||!traceClockMapping?.available){classification='UNATTRIBUTED';reason='clock-uncertainty-thread-or-counter-coverage-insufficient';}
    records.push({label,sourceSha,trialNumber,stepIndex,browserStartTimestampMs:Number.isFinite(startMs)?startMs:null,browserEndTimestampMs:Number.isFinite(endMs)?endMs:null,wallDurationMs:durationMs,matchedTraceEvents:matched,rendererPid:chosenThread?.pid??null,rendererMainThreadTid:chosenThread?.tid??null,rendererProcessCpuMs:scheduler?.rendererProcessCpuMs??null,rendererProcessCpuObservedDeltaMs:scheduler?.rendererProcessCpuObservedDeltaMs??null,rendererProcessCpuCounterResolutionMs:scheduler?.rendererProcessCpuCounterResolutionMs??null,rendererProcessCpuCounterAdequate:!!scheduler?.rendererProcessCpuCounterAdequate,rendererProcessCpuSamplePairCount:scheduler?.rendererProcessCpuSamplePairCount??null,rendererProcessCpuSampleCoverageMs:scheduler?.rendererProcessCpuSampleCoverageMs??null,rendererMainThreadCpuMs:scheduler?.runtimeMs??null,schedulerWaitMs:scheduler?.runQueueWaitMs??null,cpuToWallRatio:scheduler?.cpuToWallRatio??(Number.isFinite(scheduler?.runtimeMs)?scheduler.runtimeMs/durationMs:null),schedulerCoverageMs:scheduler?.sampleCoverageMs??null,contextSwitches:scheduler?.contextSwitches??null,clockMappingUncertaintyMs:traceClockMapping?.available?traceClockMapping.uncertaintyMs:null,schedulerClockMappingUncertaintyMs:Number.isFinite(schedulerClockUncertainty)?schedulerClockUncertainty:null,attributionConfidence,attributionClassification:classification,attributionReason:reason,evidence:{traceClockMapped:!!traceClockMapping?.available,traceEventsOverlapping:overlapping.length,identifiedThread:threadIdKnown,threadIdSource:chosenThread?.source??(chosenThread?'chromium-trace-metadata':null),schedulerCounterAvailable:!!scheduler?.available,schedulerCounterAdequate:!!scheduler?.adequate,gcCoverageMs,compileCoverageMs,jsCoverageMs,chromiumTaskCoverageMs:taskCoverageMs}});
  }
  return records;
}

export function classifyTraceCapabilities({categoriesAvailable=false,requestedCategories=[],startSucceeded=false,clockSyncSucceeded=false,traceEndSucceeded=false,streamExpected=true,streamReadSucceeded=false,eventCount=0,threadMetadataCount=0}){
  return{
    categoryDiscovery:categoriesAvailable?'AVAILABLE':'UNAVAILABLE',
    requestedCategories:[...requestedCategories],
    tracingStart:startSucceeded?'AVAILABLE':'UNAVAILABLE',
    clockSyncMarker:clockSyncSucceeded?'AVAILABLE':'UNAVAILABLE',
    traceCompletion:traceEndSucceeded?'AVAILABLE':'UNAVAILABLE',
    traceStreamRead:streamExpected?(streamReadSucceeded?'AVAILABLE':'UNAVAILABLE'):'NOT_USED',
    eventCount,threadMetadataCount,
    usableTrace:eventCount>0&&traceEndSucceeded&&(!streamExpected||streamReadSucceeded),
  };
}
