import {readdir,readFile,readlink} from 'node:fs/promises';
import {basename} from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

const clockTicksPerSecond=Number(spawnSync('getconf',['CLK_TCK'],{encoding:'utf8'}).stdout?.trim())||100;
export const PROC_CPU_COUNTER_RESOLUTION_MS=1000/clockTicksPerSecond;
let perfCounterProbe=null;

export function parseProcStat(value,pid=null,ticksPerSecond=clockTicksPerSecond){
  const end=value.lastIndexOf(')');
  if(end<0)return null;
  const fields=value.slice(end+2).trim().split(/\s+/);
  if(fields.length<20)return null;
  const numbers=fields.slice(1).map(Number);
  if(!Number.isFinite(numbers[0])||!Number.isFinite(numbers[10])||!Number.isFinite(numbers[11])||!Number.isFinite(numbers[18]))return null;
  return{pid:Number(pid),state:fields[0],parentPid:numbers[0],userTicks:numbers[10],systemTicks:numbers[11],startTimeTicks:numbers[18],cpuMs:(numbers[10]+numbers[11])*1000/ticksPerSecond};
}

export function parseProcSchedstat(value){
  const numbers=value?.trim().split(/\s+/).slice(0,3).map(Number);
  if(!numbers||numbers.length<3||numbers.some(number=>!Number.isFinite(number)||number<0))return null;
  return{runTimeNs:numbers[0],runQueueWaitNs:numbers[1],timeslices:numbers[2]};
}

export function parseProcStatus(value){
  if(typeof value!=='string')return null;
  const voluntary=Number(value.match(/^voluntary_ctxt_switches:\s+(\d+)$/m)?.[1]);
  const involuntary=Number(value.match(/^nonvoluntary_ctxt_switches:\s+(\d+)$/m)?.[1]);
  const namespaceIds=value.match(/^NSpid:\s+([\d\s]+)$/m)?.[1]?.trim().split(/\s+/).map(Number).filter(Number.isSafeInteger)??null;
  return Number.isFinite(voluntary)&&Number.isFinite(involuntary)?{voluntaryContextSwitches:voluntary,involuntaryContextSwitches:involuntary,namespaceIds}:null;
}

function parseCmdline(value){return typeof value==='string'?value.split('\0').filter(Boolean):[];}
function getProcessType(args){const typeIndex=args.indexOf('--type');return typeIndex>=0?args[typeIndex+1]??null:args.find(value=>value.startsWith('--type='))?.slice(7)??'browser';}
function isChromiumProcess(args,comm){return/(?:chrome|chromium|headless_shell)/i.test(`${basename(args[0]??'')} ${comm??''}`);}
function nspidPairsMatch(processIds,threadIds,tracePid,traceTid){
  if(!Array.isArray(processIds)||!Array.isArray(threadIds))return false;
  for(let index=0;index<Math.min(processIds.length,threadIds.length);index++)if(processIds[index]===tracePid&&threadIds[index]===traceTid)return true;
  return false;
}

async function readProcessRecord(pid){
  const [statText,cmdlineText,commText,statusText,namespace]=await Promise.all([
    readFile(`/proc/${pid}/stat`,'utf8'),readFile(`/proc/${pid}/cmdline`,'utf8'),readFile(`/proc/${pid}/comm`,'utf8'),readFile(`/proc/${pid}/status`,'utf8').catch(()=>''),readlink(`/proc/${pid}/ns/pid`).catch(()=>null)
  ]);
  const stat=parseProcStat(statText,pid);if(!stat)return null;
  const cmdline=parseCmdline(cmdlineText),comm=commText.trim();
  return{...stat,comm,cmdline,processType:getProcessType(cmdline),namespaceIds:parseProcStatus(statusText)?.namespaceIds??null,pidNamespace:namespace};
}

async function readProcessCpuCounter(pid){
  let tids=[];try{tids=await readdir(`/proc/${pid}/task`);}catch{return{pid:Number(pid),available:false,cpuMs:null,threadCount:0};}
  if(!tids.length)return{pid:Number(pid),available:false,cpuMs:null,threadCount:0};
  const counters=await Promise.all(tids.map(async tid=>{try{return parseProcStat(await readFile(`/proc/${pid}/task/${tid}/stat`,'utf8'),tid);}catch{return null;}}));
  const available=counters.every(Boolean);
  return{pid:Number(pid),available,cpuMs:available?counters.reduce((sum,counter)=>sum+counter.cpuMs,0):null,threadCount:available?counters.length:null,threadIds:available?counters.map(counter=>counter.pid).sort((a,b)=>a-b):null};
}

async function readProcessTree(rootPid){
  const processes=[],seen=new Set();
  async function visit(pid){
    if(!Number.isInteger(pid)||pid<=0||seen.has(pid))return;
    seen.add(pid);
    let process;
    try{process=await readProcessRecord(pid);}catch{return;}
    if(!process)return;
    const processCounters=await readProcessCpuCounter(pid);
    processes.push({...process,cpuMs:processCounters.cpuMs,cpuCounterAvailable:processCounters.available,cpuCounterThreadCount:processCounters.threadCount,cpuCounterThreadIds:processCounters.threadIds});
    // Chromium can spawn renderers and GPU processes from worker threads. The
    // leader's `children` file then omits them, so walk every task's child list.
    let taskIds=[];try{taskIds=await readdir(`/proc/${pid}/task`);}catch{taskIds=[String(pid)];}
    const childLists=await Promise.all(taskIds.map(async tid=>{try{return await readFile(`/proc/${pid}/task/${tid}/children`,'utf8');}catch{return '';}}));
    const children=[...new Set(childLists.flatMap(raw=>raw.trim().split(/\s+/).filter(Boolean).map(Number)))];
    await Promise.all(children.map(visit));
  }
  await visit(Number(rootPid));
  return{rootPid:Number(rootPid),available:processes.length>0,processes};
}

async function readThreadCounter(pid,tid){
  const [statResult,schedstatResult,statusResult,commResult,processStatResult]=await Promise.all([
    readFile(`/proc/${pid}/task/${tid}/stat`,'utf8').then(value=>({value}),error=>({error})),
    readFile(`/proc/${pid}/task/${tid}/schedstat`,'utf8').then(value=>({value}),error=>({error})),
    readFile(`/proc/${pid}/task/${tid}/status`,'utf8').then(value=>({value}),error=>({error})),
    readFile(`/proc/${pid}/task/${tid}/comm`,'utf8').then(value=>({value}),error=>({error})),
    readFile(`/proc/${pid}/stat`,'utf8').then(value=>({value}),error=>({error})),
  ]);
  if(statResult.error){const error=statResult.error;let reason=error.code==='EACCES'||error.code==='EPERM'?'permission-denied':error.code==='ENOENT'?'thread-not-visible':'counter-read-failed';if(error.code==='ENOENT')try{await readFile(`/proc/${pid}/stat`,'utf8');}catch(processError){reason=processError.code==='EACCES'||processError.code==='EPERM'?'permission-denied':processError.code==='ENOENT'?'process-exited':reason;}return{pid:Number(pid),tid:Number(tid),available:false,reason,errorCode:error.code??null,error:error.message};}
  const stat=parseProcStat(statResult.value,tid),processStat=processStatResult.value?parseProcStat(processStatResult.value,pid):null,schedstat=schedstatResult.value?parseProcSchedstat(schedstatResult.value):null,status=statusResult.value?parseProcStatus(statusResult.value):null,threadName=commResult.value?.trim()??null;
  if(!stat)return{pid:Number(pid),tid:Number(tid),threadName,available:false,reason:'thread-stat-unavailable'};
  const schedstatError=schedstatResult.error,reason=schedstat?null:schedstatError?.code==='EACCES'||schedstatError?.code==='EPERM'?'permission-denied':schedstatError?.code==='ENOENT'?'schedstat-unavailable':schedstatError?'counter-read-failed':'schedstat-unavailable';
  return{pid:Number(pid),tid:Number(tid),threadName,available:!!schedstat,reason,state:stat.state,cpuMs:stat.cpuMs,userTicks:stat.userTicks,systemTicks:stat.systemTicks,startTimeTicks:stat.startTimeTicks,liveProcessStartTimeTicks:processStat?.startTimeTicks??null,schedstatAvailable:!!schedstat,contextSwitchCountersAvailable:Number.isFinite(status?.voluntaryContextSwitches)&&Number.isFinite(status?.involuntaryContextSwitches),...schedstat,...(status??{}),...(commResult.error?{threadNameReadError:commResult.error.code??commResult.error.message}:{}),...(processStatResult.error?{processStartReadError:processStatResult.error.code??processStatResult.error.message}:{})};
}

async function enumerateRendererProcesses(treeProcesses=[]){
  const known=new Map(treeProcesses.filter(process=>process.processType==='renderer'&&isChromiumProcess(process.cmdline,process.comm)).map(process=>[process.pid,process])),errors=[];
  let entries=[];try{entries=await readdir('/proc');}catch(error){return{processes:[...known.values()],error:error.code==='EACCES'?'permission-denied':'process-list-unavailable',errors:[{reason:error.code==='EACCES'?'permission-denied':'process-list-unavailable',errorCode:error.code??null}]};}
  await Promise.all(entries.filter(entry=>/^\d+$/.test(entry)&&!known.has(Number(entry))).map(async entry=>{
    const pid=Number(entry);let comm;
    try{comm=(await readFile(`/proc/${pid}/comm`,'utf8')).trim();}catch(error){if(error.code==='EACCES'||error.code==='EPERM')errors.push({pid,reason:'permission-denied',errorCode:error.code});return;}
    if(!/chrome|chromium|headless_shell/i.test(comm))return;
    try{const process=await readProcessRecord(pid);if(process?.processType==='renderer'&&isChromiumProcess(process.cmdline,process.comm))known.set(pid,process);}catch(error){if(error.code==='EACCES'||error.code==='EPERM')errors.push({pid,reason:'permission-denied',errorCode:error.code});}
  }));
  return{processes:[...known.values()],error:null,errors};
}

export function resolveRendererThreadIdentity({traceIdentity=null,linuxCandidates=[],linuxProcesses=[],rootPidNamespace=null}={}){
  const tracePid=Number(traceIdentity?.pid),traceTid=Number(traceIdentity?.tid),traceThreadName=traceIdentity?.threadName??null;
  const unavailable=reason=>({status:'RENDERER_THREAD_UNAVAILABLE',reason,traceIdentity:traceIdentity??null,linuxCandidateCount:linuxCandidates.length});
  if(!Number.isSafeInteger(tracePid)||!Number.isSafeInteger(traceTid)||tracePid<=0||traceTid<=0)return unavailable('trace-thread-identity-unavailable');
  if(traceThreadName&&traceThreadName!=='CrRendererMain')return unavailable('trace-thread-name-mismatch');
  const processes=linuxProcesses.length?linuxProcesses:linuxCandidates;
  const pidMatches=processes.filter(process=>process.processType==='renderer'&&(process.pid===tracePid||process.namespaceIds?.includes(tracePid)));
  const pairMatches=linuxCandidates.filter(candidate=>candidate.processType==='renderer'&&((candidate.pid===tracePid&&candidate.tid===traceTid)||nspidPairsMatch(candidate.processNamespaceIds??candidate.namespaceIds,candidate.threadNamespaceIds,tracePid,traceTid)));
  const stableProcessStart=candidate=>{const actual=candidate.processStartTimeTicks??candidate.startTimeTicks,expected=candidate.expectedProcessStartTimeTicks;return Number.isSafeInteger(actual)&&(expected==null||actual===expected);};
  const stableThreadStart=candidate=>{const actual=candidate.threadStartTimeTicks??candidate.startTimeTicks,expected=candidate.expectedThreadStartTimeTicks;return Number.isSafeInteger(actual)&&(expected==null||actual===expected);};
  const valid=pairMatches.filter(candidate=>candidate.threadName==='CrRendererMain'&&stableProcessStart(candidate)&&stableThreadStart(candidate));
  if(valid.length===1){
    const candidate=valid[0],namespaceIndex=candidate.pid===tracePid&&candidate.tid===traceTid?null:(candidate.processNamespaceIds??candidate.namespaceIds??[]).findIndex((pid,index)=>pid===tracePid&&candidate.threadNamespaceIds?.[index]===traceTid);
    return{status:'RENDERER_THREAD_RESOLVED',reason:null,matchMethod:namespaceIndex===null?'trace-pid-tid-exact':'trace-pid-tid-namespace-map',traceIdentity:{pid:tracePid,tid:traceTid,threadName:traceThreadName??'CrRendererMain'},linuxIdentity:{pid:candidate.pid,tid:candidate.tid,threadName:candidate.threadName,processType:candidate.processType,commandLine:candidate.commandLine??candidate.cmdline??[],processStartTimeTicks:candidate.processStartTimeTicks??candidate.startTimeTicks,threadStartTimeTicks:candidate.threadStartTimeTicks??candidate.startTimeTicks,pidNamespace:candidate.pidNamespace??null,namespaceIndex},counterAvailable:candidate.available===true,counterUnavailableReason:candidate.available===false?candidate.reason??'counter-unavailable':null};
  }
  if(valid.length>1)return unavailable('multiple-unresolved-candidates');
  if(pairMatches.length)return unavailable(pairMatches.some(candidate=>candidate.threadName!=='CrRendererMain')?'thread-name-mismatch':pairMatches.some(candidate=>!stableProcessStart(candidate)||!stableThreadStart(candidate))?'process-or-thread-identity-changed':'process-start-identity-unavailable');
  if(pidMatches.length)return unavailable('thread-not-visible');
  if(rootPidNamespace&&processes.some(process=>process.pidNamespace&&process.pidNamespace!==rootPidNamespace))return unavailable('pid-namespace-mismatch');
  return unavailable(processes.length?'process-not-visible':'renderer-process-not-visible');
}

export async function findRendererMainThreads(rootPid){
  const tree=await readProcessTree(Number(rootPid)),enumerated=await enumerateRendererProcesses(tree.processes),renderers=enumerated.processes,targets=[],readErrors=[];
  for(const renderer of renderers){
    let tids=[];try{tids=await readdir(`/proc/${renderer.pid}/task`);}catch(error){readErrors.push({pid:renderer.pid,reason:error.code==='EACCES'?'permission-denied':'process-not-visible',errorCode:error.code??null});continue;}
    await Promise.all(tids.map(async tidText=>{
      const tid=Number(tidText);if(!Number.isSafeInteger(tid))return;
      let threadName='';try{threadName=(await readFile(`/proc/${renderer.pid}/task/${tid}/comm`,'utf8')).trim();}catch(error){readErrors.push({pid:renderer.pid,tid,reason:error.code==='EACCES'?'permission-denied':'thread-not-visible',errorCode:error.code??null});return;}
      if(threadName!=='CrRendererMain')return;
      const counter=await readThreadCounter(renderer.pid,tid);
      targets.push({pid:renderer.pid,tid,processType:renderer.processType,processName:renderer.comm,commandLine:renderer.cmdline,processStartTimeTicks:renderer.startTimeTicks,processNamespaceIds:renderer.namespaceIds,threadNamespaceIds:counter.namespaceIds??null,pidNamespace:renderer.pidNamespace,threadName,candidateSource:threadName==='CrRendererMain'?'proc-thread-name':'renderer-process-leader',...counter});
    }));
  }
  const rendererMainCandidates=targets.filter(target=>target.threadName==='CrRendererMain');
  const rootProcess=tree.processes.find(process=>process.pid===Number(rootPid));
  const discoveryErrors=[...readErrors,...(enumerated.errors??[])],reason=targets.length?null:discoveryErrors.some(item=>item.reason==='permission-denied')||enumerated.error==='permission-denied'?'permission-denied':renderers.length?'thread-not-visible':tree.processes.length?'renderer-process-not-visible':enumerated.error??'process-not-visible';
  return{available:targets.length>0,status:targets.length?'RENDERER_THREAD_CANDIDATES_DISCOVERED':'RENDERER_THREAD_UNAVAILABLE',rootPid:Number(rootPid),rootPidNamespace:rootProcess?.pidNamespace??null,targets,rendererProcesses:renderers,rendererMainCandidateCount:rendererMainCandidates.length,reason,discoverySources:{processTreeCount:tree.processes.length,treeRendererCount:tree.processes.filter(process=>process.processType==='renderer').length,procRendererCount:renderers.length,treeFallbackUsed:renderers.some(process=>!tree.processes.some(row=>row.pid===process.pid))},processCount:tree.processes.length,readErrors:discoveryErrors};
}

export async function startRendererSchedulerSampler(rootPid,{intervalMs=2,processIntervalMs=20}={}){
  const discovery=await findRendererMainThreads(rootPid);
  if(!discovery.available)return{available:false,status:'RENDERER_THREAD_UNAVAILABLE',reason:discovery.reason,discovery,samples:[],stop:async()=>({available:false,status:'RENDERER_THREAD_UNAVAILABLE',reason:discovery.reason,discovery,samples:[],sampleIntervalMs:intervalMs})};
  const targets=discovery.targets.map(target=>({...target})),processTargets=[...new Set(targets.map(target=>target.pid))],samples=[];let inFlight=null,lastProcessSampleHrtimeNs=0n;
  const take=({forceProcesses=false}={})=>{
    if(inFlight)return inFlight;
    inFlight=(async()=>{
      const readStart=process.hrtime.bigint(),readStartHrtimeNs=readStart.toString(),processDue=forceProcesses||lastProcessSampleHrtimeNs===0n||readStart-lastProcessSampleHrtimeNs>=BigInt(Math.max(1,processIntervalMs)*1e6);
      const [rows,processes]=await Promise.all([Promise.all(targets.map(({pid,tid})=>readThreadCounter(pid,tid))),processDue?Promise.all(processTargets.map(readProcessCpuCounter)):Promise.resolve([])]);
      if(processDue)lastProcessSampleHrtimeNs=readStart;
      const readEndHrtimeNs=process.hrtime.bigint().toString();
      samples.push({readStartHrtimeNs,readEndHrtimeNs,readDurationMs:Number(readEndHrtimeNs-readStartHrtimeNs)/1e6,threads:rows.map((row,index)=>({...targets[index],...row,expectedThreadStartTimeTicks:targets[index].startTimeTicks,expectedProcessStartTimeTicks:targets[index].processStartTimeTicks})),processes:processes.filter(Boolean),processCpuSampleTaken:processDue});
    })().finally(()=>{inFlight=null;});
    return inFlight;
  };
  await take({forceProcesses:true});
  const timer=setInterval(()=>{void take();},Math.max(1,intervalMs));timer.unref?.();
  return{
    available:true,status:'RENDERER_THREAD_CANDIDATES_DISCOVERED',discovery,
    stop:async()=>{
      clearInterval(timer);await inFlight;await take({forceProcesses:true});
      const readCostsMs=samples.map(sample=>(Number(sample.readEndHrtimeNs)-Number(sample.readStartHrtimeNs))/1e6);
      const actualSampleIntervalsMs=samples.slice(1).map((sample,index)=>(Number(BigInt(sample.readStartHrtimeNs)-BigInt(samples[index].readStartHrtimeNs))/1e6)),sortedIntervals=[...actualSampleIntervalsMs].sort((a,b)=>a-b);
      return{available:true,status:'RENDERER_THREAD_CANDIDATES_DISCOVERED',discovery,requestedSampleIntervalMs:intervalMs,sampleIntervalMs:intervalMs,actualSampleIntervalsMs,medianObservedSampleIntervalMs:sortedIntervals.length?sortedIntervals[Math.floor(sortedIntervals.length/2)]:null,maxObservedSampleIntervalMs:actualSampleIntervalsMs.length?Math.max(...actualSampleIntervalsMs):null,processSampleIntervalMs:processIntervalMs,processSampleCount:samples.filter(sample=>sample.processCpuSampleTaken).length,sampleCount:samples.length,meanReadCostMs:readCostsMs.length?readCostsMs.reduce((sum,value)=>sum+value,0)/readCostsMs.length:null,maxReadCostMs:readCostsMs.length?Math.max(...readCostsMs):null,samples};
    }
  };
}

export function summarizeSchedulerSamples(samples,clockMapping,stepWindowsMs,{targetIdentity=null,requireTargetIdentity=false}={}){
  const map=clockMapping?.available?(value=>clockMapping.slope*value+clockMapping.offset):null,clockMappingUncertaintyMs=clockMapping?.available&&Number.isFinite(clockMapping.uncertaintyMs)?clockMapping.uncertaintyMs:null;
  const rows=(samples??[]).flatMap(sample=>{
    const start=Number(sample.readStartHrtimeNs)/1e6,end=Number(sample.readEndHrtimeNs)/1e6;
    if(!Number.isFinite(start)||!Number.isFinite(end))return[];
    const at=map?(map(start)+map(end))/2:null;
    return(sample.threads??[]).map(thread=>{
      const expectedProcessStartTimeTicks=thread.expectedProcessStartTimeTicks??thread.processStartTimeTicks??null,expectedThreadStartTimeTicks=thread.expectedThreadStartTimeTicks??null,processStartTimeTicks=thread.liveProcessStartTimeTicks??thread.processStartTimeTicks??thread.startTimeTicks,processIdentityStable=expectedProcessStartTimeTicks==null||processStartTimeTicks===expectedProcessStartTimeTicks,threadIdentityStable=expectedThreadStartTimeTicks==null||thread.startTimeTicks===expectedThreadStartTimeTicks;
      return{pid:thread.pid,tid:thread.tid,threadName:thread.threadName,processType:thread.processType,processStartTimeTicks,threadStartTimeTicks:thread.startTimeTicks,expectedProcessStartTimeTicks,expectedThreadStartTimeTicks,state:thread.state,available:thread.available===true&&processIdentityStable&&threadIdentityStable,unavailableReason:thread.reason??(!processIdentityStable||!threadIdentityStable?'process-or-thread-identity-changed':null),atBrowserPerformanceNowMs:at,readStartHrtimeMs:start,readEndHrtimeMs:end,readDurationMs:sample.readDurationMs??end-start,runTimeNs:thread.runTimeNs,runQueueWaitNs:thread.runQueueWaitNs,timeslices:thread.timeslices,cpuMs:thread.cpuMs,userTicks:thread.userTicks,systemTicks:thread.systemTicks,startTimeTicks:thread.startTimeTicks,voluntaryContextSwitches:thread.voluntaryContextSwitches,involuntaryContextSwitches:thread.involuntaryContextSwitches,namespaceIds:thread.namespaceIds,processNamespaceIds:thread.processNamespaceIds,threadNamespaceIds:thread.threadNamespaceIds,pidNamespace:thread.pidNamespace,commandLine:thread.commandLine};
    });
  }).sort((a,b)=>(a.atBrowserPerformanceNowMs??0)-(b.atBrowserPerformanceNowMs??0));
  const processRows=(samples??[]).flatMap(sample=>{
    const start=Number(sample.readStartHrtimeNs)/1e6,end=Number(sample.readEndHrtimeNs)/1e6;
    if(!Number.isFinite(start)||!Number.isFinite(end))return[];
    const at=map?(map(start)+map(end))/2:null;
    return(sample.processes??[]).map(process=>({pid:process.pid,state:process.state,cpuMs:process.cpuMs,threadCount:process.threadCount,threadIds:process.threadIds,available:process.available,atBrowserPerformanceNowMs:at}));
  }).filter(row=>Number.isFinite(row.atBrowserPerformanceNowMs)).sort((a,b)=>a.atBrowserPerformanceNowMs-b.atBrowserPerformanceNowMs);
  const candidateMap=new Map(rows.map(row=>[`${row.pid}:${row.tid}`,row])),candidates=[...candidateMap.values()].map(row=>({pid:row.pid,tid:row.tid,threadName:row.threadName,processType:row.processType,processStartTimeTicks:row.processStartTimeTicks,threadStartTimeTicks:row.threadStartTimeTicks,expectedProcessStartTimeTicks:row.expectedProcessStartTimeTicks,expectedThreadStartTimeTicks:row.expectedThreadStartTimeTicks,available:row.available,reason:row.unavailableReason,namespaceIds:row.namespaceIds,processNamespaceIds:row.processNamespaceIds,threadNamespaceIds:row.threadNamespaceIds,pidNamespace:row.pidNamespace,commandLine:row.commandLine}));
  let resolvedIdentity=null,identityResolution=null;
  if(targetIdentity){identityResolution=resolveRendererThreadIdentity({traceIdentity:targetIdentity,linuxCandidates:candidates,linuxProcesses:candidates});if(identityResolution.status==='RENDERER_THREAD_RESOLVED')resolvedIdentity=identityResolution.linuxIdentity;}
  else if(!requireTargetIdentity&&candidates.length===1&&candidates[0].threadName==='CrRendererMain'&&candidates[0].processType==='renderer'&&Number.isSafeInteger(candidates[0].processStartTimeTicks)){resolvedIdentity=candidates[0];identityResolution={status:'RENDERER_THREAD_RESOLVED',reason:null,matchMethod:'single-proc-renderer-main-candidate',linuxIdentity:resolvedIdentity};}
  else identityResolution={status:'RENDERER_THREAD_UNAVAILABLE',reason:requireTargetIdentity?'trace-renderer-identity-unavailable':candidates.length===0?'renderer-thread-not-sampled':'multiple-unresolved-candidates',linuxCandidateCount:candidates.length};
  const target=resolvedIdentity,perStep=(stepWindowsMs??[]).map(([startMs,endMs],stepIndex)=>{
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs)return{stepIndex,available:false,reason:'invalid-step-window'};
    if(!clockMapping?.available)return{stepIndex,available:false,reason:'clock-mapping-unavailable',rendererIdentity:identityResolution};
    if(!target)return{stepIndex,available:false,reason:identityResolution.reason,rendererIdentity:identityResolution};
    const margin=clockMappingUncertaintyMs??Infinity,matching=rows.filter(row=>row.pid===target.pid&&row.tid===target.tid),inside=matching.filter(row=>row.available&&row.atBrowserPerformanceNowMs>=startMs+margin&&row.atBrowserPerformanceNowMs<=endMs-margin),runtimeDeltas=[],switches=[];let changedThreadIdentity=false;
    for(let index=1;index<inside.length;index++){
      const before=inside[index-1],after=inside[index],spanMs=after.atBrowserPerformanceNowMs-before.atBrowserPerformanceNowMs;
      if(!(spanMs>0))continue;
      const runtimeMs=(after.runTimeNs-before.runTimeNs)/1e6,waitMs=(after.runQueueWaitNs-before.runQueueWaitNs)/1e6,stableStart=before.startTimeTicks===after.startTimeTicks;
      if(!stableStart||before.processStartTimeTicks!==before.expectedProcessStartTimeTicks||after.processStartTimeTicks!==after.expectedProcessStartTimeTicks||before.startTimeTicks!==before.expectedThreadStartTimeTicks||after.startTimeTicks!==after.expectedThreadStartTimeTicks){changedThreadIdentity=true;continue;}
      if(runtimeMs>=0&&waitMs>=0){runtimeDeltas.push({runtimeMs,waitMs,userCpuMs:Number.isFinite(after.userTicks)&&Number.isFinite(before.userTicks)?(after.userTicks-before.userTicks)*PROC_CPU_COUNTER_RESOLUTION_MS:null,systemCpuMs:Number.isFinite(after.systemTicks)&&Number.isFinite(before.systemTicks)?(after.systemTicks-before.systemTicks)*PROC_CPU_COUNTER_RESOLUTION_MS:null,timeslices:after.timeslices-before.timeslices,spanMs});switches.push({voluntary:after.voluntaryContextSwitches-before.voluntaryContextSwitches,involuntary:after.involuntaryContextSwitches-before.involuntaryContextSwitches});}
    }
    const runtimeMs=runtimeDeltas.reduce((sum,row)=>sum+row.runtimeMs,0),waitMs=runtimeDeltas.reduce((sum,row)=>sum+row.waitMs,0),coverageMs=runtimeDeltas.reduce((sum,row)=>sum+row.spanMs,0),wallMs=endMs-startMs;
    const processSamples=processRows.filter(row=>row.pid===target.pid&&row.atBrowserPerformanceNowMs>=startMs+margin&&row.atBrowserPerformanceNowMs<=endMs-margin),processDeltas=[];
    for(let index=1;index<processSamples.length;index++){const before=processSamples[index-1],after=processSamples[index],spanMs=after.atBrowserPerformanceNowMs-before.atBrowserPerformanceNowMs,deltaMs=Number.isFinite(before.cpuMs)&&Number.isFinite(after.cpuMs)?after.cpuMs-before.cpuMs:null,threadSetStable=Array.isArray(before.threadIds)&&Array.isArray(after.threadIds)?before.threadIds.length===after.threadIds.length&&before.threadIds.every((tid,tidIndex)=>tid===after.threadIds[tidIndex]):before.threadCount===after.threadCount;if(spanMs>0&&deltaMs!==null&&deltaMs>=0&&threadSetStable)processDeltas.push({deltaMs,spanMs});}
    const processCpuDeltaMs=processDeltas.reduce((sum,row)=>sum+row.deltaMs,0),processCoverageMs=processDeltas.reduce((sum,row)=>sum+row.spanMs,0),processCounterAdequate=processCoverageMs>=wallMs*.5&&wallMs>=PROC_CPU_COUNTER_RESOLUTION_MS*2&&processCpuDeltaMs>=PROC_CPU_COUNTER_RESOLUTION_MS;
    const counterAvailable=runtimeDeltas.length>0,coverageAdequate=coverageMs>=wallMs*.5,perStepAvailable=counterAvailable&&coverageAdequate,counterUnavailableReason=counterAvailable&&!coverageAdequate?'counter-coverage-insufficient':counterAvailable?null:matching.find(row=>!row.available)?.unavailableReason??'counter-coverage-insufficient';
    return{stepIndex,available:perStepAvailable,counterAvailable,reason:counterUnavailableReason,pid:target.pid,tid:target.tid,threadName:target.threadName,state:inside.at(-1)?.state??null,runtimeMs:perStepAvailable?runtimeMs:null,runQueueWaitMs:perStepAvailable?waitMs:null,cpuToWallRatio:perStepAvailable?runtimeMs/wallMs:null,observedRuntimeDeltaMs:counterAvailable?runtimeMs:null,observedRunQueueWaitDeltaMs:counterAvailable?waitMs:null,userCpuMs:perStepAvailable&&runtimeDeltas.every(row=>row.userCpuMs!==null)?runtimeDeltas.reduce((sum,row)=>sum+row.userCpuMs,0):null,systemCpuMs:perStepAvailable&&runtimeDeltas.every(row=>row.systemCpuMs!==null)?runtimeDeltas.reduce((sum,row)=>sum+row.systemCpuMs,0):null,timeslices:perStepAvailable?runtimeDeltas.reduce((sum,row)=>sum+row.timeslices,0):null,contextSwitches:perStepAvailable?{voluntary:switches.reduce((sum,row)=>sum+row.voluntary,0),involuntary:switches.reduce((sum,row)=>sum+row.involuntary,0)}:null,sampleCoverageMs:coverageMs,coverageRatio:Math.min(1,coverageMs/wallMs),samplePairCount:runtimeDeltas.length,clockMappingUncertaintyMs,adequate:coverageAdequate,pidReuseObserved:changedThreadIdentity,counterCoverage:{sampleCount:inside.length,pairCount:runtimeDeltas.length,coverageMs:coverageMs,coverageRatio:Math.min(1,coverageMs/wallMs),clockUncertaintyMs:clockMappingUncertaintyMs,maxReadCostMs:inside.length?Math.max(...inside.map(row=>row.readDurationMs??0)):null},rendererProcessCpuMs:processCounterAdequate?processCpuDeltaMs:null,rendererProcessCpuObservedDeltaMs:processDeltas.length?processCpuDeltaMs:null,rendererProcessCpuCounterResolutionMs:PROC_CPU_COUNTER_RESOLUTION_MS,rendererProcessCpuCounterAdequate:processCounterAdequate,rendererProcessCpuSamplePairCount:processDeltas.length,rendererProcessCpuSampleCoverageMs:processCoverageMs};
  });
  return{available:perStep.some(row=>row.available),counterAvailable:perStep.some(row=>row.available),identityResolved:!!target,status:target?'RENDERER_THREAD_RESOLVED':'RENDERER_THREAD_UNAVAILABLE',reason:target?null:identityResolution.reason,identityResolution,clockMappingAvailable:!!map,clockMappingUncertaintyMs,sampleCount:rows.length,threadCandidateCount:candidates.length,perStep};
}

async function readText(path){try{return await readFile(path,'utf8');}catch{return null;}}
async function readSchedulerVisibility(){
  const [procSchedstat,traceEvents,debugTraceEvents,perfParanoid]=await Promise.all([
    readText('/proc/self/schedstat'),readText('/sys/kernel/tracing/available_events'),readText('/sys/kernel/debug/tracing/available_events'),readText('/proc/sys/kernel/perf_event_paranoid')
  ]);
  const eventText=traceEvents??debugTraceEvents,events=eventText?.split(/\s+/).filter(value=>/^sched:(sched_switch|sched_wakeup|sched_wakeup_new)$/.test(value))??[];
  if(!perfCounterProbe){
    const perfPath=spawnSync('which',['perf'],{encoding:'utf8'}),binary=perfPath.status===0?perfPath.stdout.trim():null;
    if(!binary)perfCounterProbe={binary:'UNAVAILABLE',taskClockCounter:'UNAVAILABLE',exitCode:null,detail:'perf binary not found'};
    else{const probe=spawnSync(binary,['stat','-e','task-clock','--','true'],{encoding:'utf8',timeout:3000});perfCounterProbe={binary,taskClockCounter:probe.status===0?'AVAILABLE':'UNAVAILABLE',exitCode:probe.status??null,detail:(probe.stderr||probe.error?.message||'').trim().slice(0,500)};}
  }
  return{procSchedstat:procSchedstat?'AVAILABLE':'UNAVAILABLE',tracefsAvailableEvents:eventText?'AVAILABLE':'UNAVAILABLE',schedulerTraceEvents:events,perf:perfCounterProbe,perfEventParanoid:perfParanoid?.trim()??'UNAVAILABLE',tracefsCapture:'NOT_ATTEMPTED; /proc schedstat is sampled and tracefs is not enabled or modified'};
}
function parseKeyValues(text){
  if(!text)return null;
  const result={};
  for(const line of text.trim().split(/\n+/)){const match=line.match(/^([a-z_]+)\s+(\d+)$/);if(match)result[match[1]]=Number(match[2]);}
  return Object.keys(result).length?result:null;
}
function parseProcCpu(text){
  const line=text?.split('\n').find(value=>value.startsWith('cpu '));
  if(!line)return null;
  const values=line.trim().split(/\s+/).slice(1).map(Number);
  if(values.length<4||values.some(value=>!Number.isFinite(value)))return null;
  return{totalTicks:values.reduce((sum,value)=>sum+value,0),idleTicks:values[3]+(values[4]??0)};
}

export async function captureRunnerSnapshot(browserPid){
  const [procStat,pressure,cgroupStat,cgroupMax,browserProcesses,schedulerVisibility]=await Promise.all([
    readText('/proc/stat'),readText('/proc/pressure/cpu'),readText('/sys/fs/cgroup/cpu.stat'),readText('/sys/fs/cgroup/cpu.max'),readProcessTree(browserPid),readSchedulerVisibility()
  ]);
  return{
    platform:os.platform(),release:os.release(),arch:os.arch(),logicalCpuCount:os.cpus().length,
    cpuModel:os.cpus()[0]?.model??null,loadAverage:os.loadavg(),
    cpuPressure:pressure,systemCpu:parseProcCpu(procStat),
    cgroupCpu:parseKeyValues(cgroupStat),cgroupCpuMax:cgroupMax?.trim()??null,schedulerVisibility,
    browserProcesses,processHrtimeNs:process.hrtime.bigint().toString()
  };
}

export function compareRunnerSnapshots(before,after,wallMs){
  const start=new Map((before.browserProcesses?.processes??[]).map(row=>[row.pid,row]));
  const end=new Map((after.browserProcesses?.processes??[]).map(row=>[row.pid,row]));
  const common=[...start.keys()].filter(pid=>end.has(pid));
  const processTreeAvailable=!!before.browserProcesses?.available&&!!after.browserProcesses?.available&&common.length>0;
  const cpuRows=common.map(pid=>({before:start.get(pid),after:end.get(pid)})),processCpuCounterAvailable=processTreeAvailable&&cpuRows.length>0&&start.size===end.size&&common.length===start.size&&cpuRows.every(row=>{const threadSetStable=Array.isArray(row.before.cpuCounterThreadIds)&&Array.isArray(row.after.cpuCounterThreadIds)?row.before.cpuCounterThreadIds.length===row.after.cpuCounterThreadIds.length&&row.before.cpuCounterThreadIds.every((tid,tidIndex)=>tid===row.after.cpuCounterThreadIds[tidIndex]):row.before.cpuCounterThreadCount==null||row.after.cpuCounterThreadCount==null||row.before.cpuCounterThreadCount===row.after.cpuCounterThreadCount;return Number.isFinite(row.before.cpuMs)&&Number.isFinite(row.after.cpuMs)&&threadSetStable;});
  const browserCpuMs=processCpuCounterAvailable?cpuRows.reduce((sum,row)=>sum+Math.max(0,row.after.cpuMs-row.before.cpuMs),0):null;
  const cpuStart=before.systemCpu,cpuEnd=after.systemCpu;
  const totalDelta=cpuStart&&cpuEnd?cpuEnd.totalTicks-cpuStart.totalTicks:null;
  const idleDelta=cpuStart&&cpuEnd?cpuEnd.idleTicks-cpuStart.idleTicks:null;
  const cgroupStart=before.cgroupCpu,cgroupEnd=after.cgroupCpu;
  const cgroupUsageDeltaUsec=cgroupStart&&cgroupEnd&&Number.isFinite(cgroupStart.usage_usec)&&Number.isFinite(cgroupEnd.usage_usec)?cgroupEnd.usage_usec-cgroupStart.usage_usec:null;
  const cgroupThrottledDeltaUsec=cgroupStart&&cgroupEnd&&Number.isFinite(cgroupStart.throttled_usec)&&Number.isFinite(cgroupEnd.throttled_usec)?cgroupEnd.throttled_usec-cgroupStart.throttled_usec:null;
  return{
    wallMs,browserCpuMs,browserCpuToWallRatio:wallMs>0&&browserCpuMs!==null?browserCpuMs/wallMs:null,
    commonBrowserProcessCount:common.length,browserProcessStatesBefore:[...new Set((before.browserProcesses?.processes??[]).map(row=>row.state))],browserProcessStatesAfter:[...new Set((after.browserProcesses?.processes??[]).map(row=>row.state))],
    hostCpuBusyPercent:totalDelta>0?100*(1-idleDelta/totalDelta):null,
    cgroupCpuUsageDeltaMs:cgroupUsageDeltaUsec===null?null:cgroupUsageDeltaUsec/1000,
    cgroupThrottledDeltaMs:cgroupThrottledDeltaUsec===null?null:cgroupThrottledDeltaUsec/1000,
    loadAverageBefore:before.loadAverage,loadAverageAfter:after.loadAverage,
    cpuPressureBefore:before.cpuPressure,cpuPressureAfter:after.cpuPressure,
    cgroupCpuMax:before.cgroupCpuMax??after.cgroupCpuMax,
    processTreeAvailable,processCpuCounterAvailable,processCpuCounterProcessCount:processCpuCounterAvailable?cpuRows.length:0
  };
}

export function summarizeSlowIntervals(durationsMs,stepWindowsMs=[],budgetMs=8.333333333333334,trialStartMs=null){
  const slowSamples=[],consecutiveRuns=[];
  for(let index=0;index<durationsMs.length;index++){
    const durationMs=durationsMs[index];
    if(!(durationMs>budgetMs))continue;
    const window=stepWindowsMs[index],sample={stepIndex:index,durationMs,...(Array.isArray(window)?{startPerformanceNowMs:window[0],endPerformanceNowMs:window[1],...(Number.isFinite(trialStartMs)?{elapsedFromTrialStartMs:Number((window[0]-trialStartMs).toFixed(3))}:{})}:{})};
    slowSamples.push(sample);
    const run=consecutiveRuns.at(-1);
    if(run&&run.lastStepIndex===index-1){run.lastStepIndex=index;run.count++;run.maximumDurationMs=Math.max(run.maximumDurationMs,durationMs);run.endPerformanceNowMs=sample.endPerformanceNowMs??null;}
    else consecutiveRuns.push({firstStepIndex:index,lastStepIndex:index,count:1,maximumDurationMs:durationMs,startPerformanceNowMs:sample.startPerformanceNowMs??null,endPerformanceNowMs:sample.endPerformanceNowMs??null});
  }
  return{budgetMs,measuredSampleCount:durationsMs.length,slowSampleCount:slowSamples.length,slowSamples,consecutiveSlowRuns:consecutiveRuns,maximumConsecutiveSlowCount:consecutiveRuns.reduce((maximum,run)=>Math.max(maximum,run.count),0)};
}
