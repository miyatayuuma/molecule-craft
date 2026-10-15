import {hasChromiumThreadAuthority} from './chromium-process-authority.mjs';
import {readdir,readFile,readlink} from 'node:fs/promises';
import {basename,join} from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

const clockTicksPerSecond=Number(spawnSync('getconf',['CLK_TCK'],{encoding:'utf8'}).stdout?.trim())||100;
export const PROC_CPU_COUNTER_RESOLUTION_MS=1000/clockTicksPerSecond;
const MAX_PROC_ENUMERATION=4096,MAX_RENDERER_CANDIDATES=32,MAX_PROC_READ_ERRORS=64,MAX_CMDLINE_BYTES=8192;
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

function parseCmdline(value){return typeof value==='string'?value.slice(0,MAX_CMDLINE_BYTES).split('\0').filter(Boolean):[];}
export function parseChromiumCommandLine(cmdlineText,commText=''){
  const boundedCmdline=typeof cmdlineText==='string'?cmdlineText.slice(0,MAX_CMDLINE_BYTES):'',hasNulDelimiter=boundedCmdline.includes('\0'),rawArgs=parseCmdline(boundedCmdline),opaqueSingleString=rawArgs.length===1&&/\s/.test(rawArgs[0].trim()),args=opaqueSingleString?[]:rawArgs,executableName=opaqueSingleString?null:basename(args[0]??'')||null,typeFlags=[];
  const unparsedTypeMarkerSeen=opaqueSingleString&&/(?:^|\s)--type(?:=|\s|$)/.test(boundedCmdline),rendererClientIdMarkerSeen=opaqueSingleString&&/(?:^|\s)--renderer-client-id(?:=|\s)\S+/.test(boundedCmdline);
  for(let index=0;index<args.length;index++){
    const arg=args[index];
    if(arg==='--type')typeFlags.push({value:args[index+1]&&!args[index+1].startsWith('--')?args[index+1]:null,form:'separate'});
    else if(arg.startsWith('--type='))typeFlags.push({value:arg.slice(7)||null,form:'equals'});
  }
  const distinctTypes=[...new Set(typeFlags.map(flag=>flag.value).filter(Boolean))],conflictingTypes=distinctTypes.length>1;
  let processType=null,processTypeReason=null,processTypeSource='command-line';
  if(opaqueSingleString){processTypeReason='cmdline-not-argv-delimited';processTypeSource='unavailable';}
  else if(!args.length)processTypeReason='cmdline-empty';
  else if(typeFlags.some(flag=>!flag.value))processTypeReason='process-type-flag-missing-value';
  else if(conflictingTypes)processTypeReason='process-type-argument-conflict';
  else if(typeFlags.length){processType=distinctTypes[0];processTypeReason=processType==='renderer'?null:'process-type-not-renderer';}
  else{processType='browser';processTypeSource='chromium-default';processTypeReason='process-type-flag-absent';}
  const chromiumName=/(?:chrome|chromium|headless_shell)/i.test(`${executableName??''} ${commText??''}`);
  const diagnosticFlag=typeFlags.length===1?(typeFlags[0].form==='equals'?`--type=${typeFlags[0].value??''}`:`--type ${typeFlags[0].value??''}`):null;
  const argumentCount=opaqueSingleString?1:args.length;
  return{processType,processTypeReason,processTypeSource,processTypeArgument:diagnosticFlag,executableName,isChromiumProcess:chromiumName,argumentCount,commandLine:{format:opaqueSingleString?'opaque-single-string':hasNulDelimiter?'nul-separated-argv':'single-argument',executable:executableName,processTypeArgument:diagnosticFlag,processTypeFlagMarkerSeen:opaqueSingleString?unparsedTypeMarkerSeen:typeFlags.length>0,rendererClientIdMarkerSeen,argumentCount,otherArgumentCount:Math.max(0,args.length-(executableName?1:0)-(typeFlags.length?typeFlags[0].form==='separate'?2:1:0)),truncated:typeof cmdlineText==='string'&&Buffer.byteLength(cmdlineText)>MAX_CMDLINE_BYTES}};
}
function procReadStatus(result){return result?.error?{available:false,reason:result.error.code==='EACCES'||result.error.code==='EPERM'?'permission-denied':result.error.code==='ENOENT'?'not-found':'read-failed',errorCode:result.error.code??null}:{available:true,reason:null,errorCode:null};}
async function readProcFile(path){try{return{value:await readFile(path,'utf8'),error:null};}catch(error){return{value:null,error};}}
async function readProcLink(path){try{return{value:await readlink(path),error:null};}catch(error){return{value:null,error};}}
async function readProcDirectory(path){try{return{value:await readdir(path),error:null};}catch(error){return{value:null,error};}}
async function readProcessRecord(pid,procRoot='/proc'){
  const processRoot=join(procRoot,String(pid)),[statResult,cmdlineResult,commResult,statusResult,namespaceResult]=await Promise.all([
    readProcFile(join(processRoot,'stat')),readProcFile(join(processRoot,'cmdline')),readProcFile(join(processRoot,'comm')),readProcFile(join(processRoot,'status')),readProcLink(join(processRoot,'ns/pid'))
  ]);
  const stat=statResult.value?parseProcStat(statResult.value,pid):null,comm=commResult.value?.trim()??null,commandLine=parseChromiumCommandLine(cmdlineResult.value,comm??''),status=statusResult.value?parseProcStatus(statusResult.value):null;
  return{pid:Number(pid),...(stat??{state:null,parentPid:null,userTicks:null,systemTicks:null,startTimeTicks:null,cpuMs:null}),statAvailable:!!stat,statComm:statResult.value?.slice(statResult.value.indexOf('(')+1,statResult.value.lastIndexOf(')'))??null,comm,commandLine:commandLine.commandLine,executableName:commandLine.executableName,isChromiumProcess:commandLine.isChromiumProcess,processType:commandLine.processType,processTypeReason:commandLine.processTypeReason,processTypeSource:commandLine.processTypeSource,processTypeArgument:commandLine.processTypeArgument,argumentCount:commandLine.argumentCount,namespaceIds:status?.namespaceIds??null,voluntaryContextSwitches:status?.voluntaryContextSwitches??null,involuntaryContextSwitches:status?.involuntaryContextSwitches??null,pidNamespace:namespaceResult.value,readStatus:{stat:procReadStatus(statResult),cmdline:procReadStatus(cmdlineResult),comm:procReadStatus(commResult),status:procReadStatus(statusResult),pidNamespace:procReadStatus(namespaceResult)}};
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
    if(!Number.isInteger(pid)||pid<=0||seen.has(pid)||seen.size>=MAX_PROC_ENUMERATION)return;
    seen.add(pid);
    let process;
    try{process=await readProcessRecord(pid);}catch{return;}
    if(!process?.statAvailable)return;
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

async function readThreadCounter(pid,tid,procRoot='/proc'){
  const threadRoot=join(procRoot,String(pid),'task',String(tid));
  const [statResult,schedstatResult,statusResult,commResult,processStatResult,namespaceResult]=await Promise.all([
    readProcFile(join(threadRoot,'stat')),
    readProcFile(join(threadRoot,'schedstat')),
    readProcFile(join(threadRoot,'status')),
    readProcFile(join(threadRoot,'comm')),
    readProcFile(join(procRoot,String(pid),'stat')),readProcLink(join(procRoot,String(pid),'ns/pid')),
  ]);
  if(statResult.error){const error=statResult.error;let reason=error.code==='EACCES'||error.code==='EPERM'?'permission-denied':error.code==='ENOENT'?'thread-not-visible':'counter-read-failed';if(error.code==='ENOENT'&&processStatResult.error)reason=processStatResult.error.code==='EACCES'||processStatResult.error.code==='EPERM'?'permission-denied':processStatResult.error.code==='ENOENT'?'process-exited':reason;return{pid:Number(pid),tid:Number(tid),available:false,reason,errorCode:error.code??null,error:error.message,readStatus:{stat:procReadStatus(statResult),schedstat:procReadStatus(schedstatResult),status:procReadStatus(statusResult),comm:procReadStatus(commResult),processStat:procReadStatus(processStatResult)}};}
  const stat=parseProcStat(statResult.value,tid),processStat=processStatResult.value?parseProcStat(processStatResult.value,pid):null,schedstat=schedstatResult.value?parseProcSchedstat(schedstatResult.value):null,status=statusResult.value?parseProcStatus(statusResult.value):null,threadName=commResult.value?.trim()??null;
  const readStatus={stat:procReadStatus(statResult),schedstat:procReadStatus(schedstatResult),status:procReadStatus(statusResult),comm:procReadStatus(commResult),processStat:procReadStatus(processStatResult)};
  if(!stat)return{pid:Number(pid),tid:Number(tid),threadName,available:false,reason:'thread-stat-unavailable',readStatus};
  const schedstatError=schedstatResult.error,reason=schedstat?null:schedstatError?.code==='EACCES'||schedstatError?.code==='EPERM'?'permission-denied':schedstatError?.code==='ENOENT'?'schedstat-unavailable':schedstatError?'counter-read-failed':'schedstat-unavailable';
  return{pid:Number(pid),tid:Number(tid),threadName,available:!!schedstat,reason,state:stat.state,cpuMs:stat.cpuMs,userTicks:stat.userTicks,systemTicks:stat.systemTicks,startTimeTicks:stat.startTimeTicks,liveProcessStartTimeTicks:processStat?.startTimeTicks??null,liveParentPid:processStat?.parentPid??null,livePidNamespace:namespaceResult.value,schedstatAvailable:!!schedstat,contextSwitchCountersAvailable:Number.isFinite(status?.voluntaryContextSwitches)&&Number.isFinite(status?.involuntaryContextSwitches),readStatus,...(schedstat??{}),...(status??{}),...(commResult.error?{threadNameReadError:commResult.error.code??commResult.error.message}:{}),...(processStatResult.error?{processStartReadError:processStatResult.error.code??processStatResult.error.message}:{})};
}

async function enumerateRendererProcesses(treeProcesses=[]){
  const known=new Map(treeProcesses.filter(process=>process.processType==='renderer'&&process.isChromiumProcess).map(process=>[process.pid,process])),errors=[];
  let entries=[];try{entries=await readdir('/proc');}catch(error){return{processes:[...known.values()].slice(0,MAX_RENDERER_CANDIDATES),error:error.code==='EACCES'?'permission-denied':'process-list-unavailable',errors:[{reason:error.code==='EACCES'?'permission-denied':'process-list-unavailable',errorCode:error.code??null}]};}
  const numericEntries=entries.filter(entry=>/^\d+$/.test(entry)).slice(0,MAX_PROC_ENUMERATION);
  await Promise.all(numericEntries.filter(entry=>!known.has(Number(entry))).map(async entry=>{
    const pid=Number(entry);let comm;
    try{comm=(await readFile(`/proc/${pid}/comm`,'utf8')).trim();}catch(error){if((error.code==='EACCES'||error.code==='EPERM')&&errors.length<MAX_PROC_READ_ERRORS)errors.push({pid,reason:'permission-denied',errorCode:error.code});return;}
    if(!/chrome|chromium|headless_shell/i.test(comm))return;
    try{const process=await readProcessRecord(pid);if(process?.statAvailable&&process.processType==='renderer'&&process.isChromiumProcess&&known.size<MAX_RENDERER_CANDIDATES)known.set(pid,process);}catch(error){if((error.code==='EACCES'||error.code==='EPERM')&&errors.length<MAX_PROC_READ_ERRORS)errors.push({pid,reason:'permission-denied',errorCode:error.code});}
  }));
  return{processes:[...known.values()].slice(0,MAX_RENDERER_CANDIDATES),error:numericEntries.length<entries.filter(entry=>/^\d+$/.test(entry)).length?'proc-enumeration-limit-reached':null,enumerationLimit:MAX_PROC_ENUMERATION,candidateLimit:MAX_RENDERER_CANDIDATES,errors};
}

function nspidPairIndex(processIds,threadIds,tracePid,traceTid,expectedIndex=null){
  if(!Array.isArray(processIds)||!Array.isArray(threadIds))return -1;
  for(let index=0;index<Math.min(processIds.length,threadIds.length);index++)if(processIds[index]===tracePid&&threadIds[index]===traceTid&&(expectedIndex==null||index===expectedIndex))return index;
  return -1;
}

export function resolveRendererThreadIdentity({traceIdentity=null,linuxCandidates=[],linuxProcesses=[],rootPidNamespace=null,rootPidNamespaceIds=null}={}){
  const tracePid=Number(traceIdentity?.pid),traceTid=Number(traceIdentity?.tid),traceThreadName=traceIdentity?.threadName??null;
  const unavailable=reason=>({status:'RENDERER_THREAD_UNAVAILABLE',reason,traceIdentity:traceIdentity??null,linuxCandidateCount:linuxCandidates.length});
  if(!Number.isSafeInteger(tracePid)||!Number.isSafeInteger(traceTid)||tracePid<=0||traceTid<=0)return unavailable('trace-thread-identity-unavailable');
  if(traceThreadName&&traceThreadName!=='CrRendererMain')return unavailable('trace-thread-name-mismatch');
  const processes=linuxProcesses.length?linuxProcesses:linuxCandidates;
  const rootTraceIndex=Number.isSafeInteger(Number(traceIdentity.browserPid))&&Array.isArray(rootPidNamespaceIds)?rootPidNamespaceIds.findIndex(pid=>pid===Number(traceIdentity.browserPid)):-1;
  const namespaceCompatible=candidate=>!rootPidNamespace||candidate.pidNamespace===rootPidNamespace;
  const pairIndex=candidate=>{
    if(candidate.pid===tracePid&&candidate.tid===traceTid)return namespaceCompatible(candidate)?null:-1;
    const processIds=candidate.processNamespaceIds??candidate.namespaceIds,threadIds=candidate.threadNamespaceIds,expectedIndex=rootTraceIndex>=0?rootTraceIndex:null;
    if(!namespaceCompatible(candidate))return -1;
    return nspidPairIndex(processIds,threadIds,tracePid,traceTid,expectedIndex);
  };
  const directCandidate=linuxCandidates.find(candidate=>candidate.pid===tracePid&&candidate.tid===traceTid);
  if(directCandidate?.reason==='permission-denied'||directCandidate?.readStatus?.stat?.reason==='permission-denied'||processes.some(process=>process.pid===tracePid&&process.readStatus?.stat?.reason==='permission-denied'))return unavailable('permission-denied');
  if(directCandidate?.reason==='process-exited')return unavailable('process-exited');
  const pidMatches=processes.filter(process=>process.processType==='renderer'&&(process.pid===tracePid||process.namespaceIds?.includes(tracePid)));
  const pairMatches=linuxCandidates.filter(candidate=>candidate.processType==='renderer'&&pairIndex(candidate)!==-1);
  const namespacePairMismatch=rootTraceIndex>=0&&linuxCandidates.some(candidate=>{const processIds=candidate.processNamespaceIds??candidate.namespaceIds,threadIds=candidate.threadNamespaceIds;return nspidPairIndex(processIds,threadIds,tracePid,traceTid)>=0&&nspidPairIndex(processIds,threadIds,tracePid,traceTid,rootTraceIndex)<0;});
  const stableProcessStart=candidate=>{const actual=candidate.processStartTimeTicks??candidate.startTimeTicks,expected=candidate.expectedProcessStartTimeTicks;return Number.isSafeInteger(actual)&&(expected==null||actual===expected);};
  const stableThreadStart=candidate=>{const actual=candidate.threadStartTimeTicks??candidate.startTimeTicks,expected=candidate.expectedThreadStartTimeTicks;return Number.isSafeInteger(actual)&&(expected==null||actual===expected);};
  const threadMatches=candidate=>candidate.threadName==='CrRendererMain'||hasChromiumThreadAuthority(traceIdentity,candidate);
  const valid=pairMatches.filter(candidate=>threadMatches(candidate)&&stableProcessStart(candidate)&&stableThreadStart(candidate));
  if(valid.length===1){
    const candidate=valid[0],namespaceIndex=pairIndex(candidate);
    return{status:'RENDERER_THREAD_RESOLVED',reason:null,matchMethod:namespaceIndex===null?'trace-pid-tid-exact':'trace-pid-tid-namespace-map',traceIdentity:{pid:tracePid,tid:traceTid,threadName:traceThreadName??'CrRendererMain'},linuxIdentity:{pid:candidate.pid,tid:candidate.tid,threadName:candidate.threadName,processType:candidate.processType,commandLine:candidate.commandLine??null,processStartTimeTicks:candidate.processStartTimeTicks??candidate.startTimeTicks,threadStartTimeTicks:candidate.threadStartTimeTicks??candidate.startTimeTicks,pidNamespace:candidate.pidNamespace??null,namespaceIndex},counterAvailable:candidate.available===true,counterUnavailableReason:candidate.available===false?candidate.reason??'counter-unavailable':null};
  }
  if(valid.length>1)return unavailable('multiple-unresolved-candidates');
  if(pairMatches.length)return unavailable(pairMatches.some(candidate=>!threadMatches(candidate))?'thread-name-mismatch':pairMatches.some(candidate=>!stableProcessStart(candidate)||!stableThreadStart(candidate))?'process-or-thread-identity-changed':'process-start-identity-unavailable');
  if(namespacePairMismatch)return unavailable('pid-namespace-mismatch');
  if(rootPidNamespace&&processes.some(process=>process.processType==='renderer'&&process.pidNamespace!==rootPidNamespace))return unavailable('pid-namespace-mismatch');
  if(pidMatches.length)return unavailable('thread-not-visible');
  if(directCandidate?.reason==='thread-not-visible')return unavailable(directCandidate.reason);
  const directProcess=processes.find(process=>process.pid===tracePid);
  if(directProcess&&!directProcess.isChromiumProcess)return unavailable(directProcess.processTypeReason==='cmdline-empty'?'cmdline-empty':'chromium-process-name-mismatch');
  if(directProcess&&directProcess.processType!=='renderer')return unavailable(directProcess.processTypeReason==='process-type-flag-absent'?'process-type-flag-absent':directProcess.processTypeReason??'process-type-not-renderer');
  return unavailable(processes.length?'process-not-visible':'renderer-process-not-visible');
}

async function readTraceRendererCandidate(rootPid,traceIdentity){
  const pid=Number(traceIdentity?.pid),tid=Number(traceIdentity?.tid);
  if(!Number.isSafeInteger(pid)||!Number.isSafeInteger(tid)||pid<=0||tid<=0)return{candidate:null,process:null,reason:'trace-thread-identity-unavailable',identityEvidence:{expectedIdentity:traceIdentity??null,rawObservedIdentity:null,parsedIdentity:null,procReadStatus:null,rejectionReason:'trace-thread-identity-unavailable'}};
  let process,rootProcess;
  try{process=await readProcessRecord(pid);}catch{process=null;}
  try{rootProcess=await readProcessRecord(Number(rootPid));}catch{rootProcess=null;}
  const counter=await readThreadCounter(pid,tid),taskResult=await readProcDirectory(`/proc/${pid}/task`);
  const identityEvidence={
    expectedIdentity:{pid,tid,threadName:traceIdentity?.threadName??null,processName:traceIdentity?.processName??null,browserPid:Number.isSafeInteger(Number(traceIdentity?.browserPid))?Number(traceIdentity.browserPid):null},
    rawObservedIdentity:{browserProcess:rootProcess?{pid:rootProcess.pid,parentPid:rootProcess.parentPid,state:rootProcess.state,startTimeTicks:rootProcess.startTimeTicks,namespaceIds:rootProcess.namespaceIds,pidNamespace:rootProcess.pidNamespace}:null,procPathPid:pid,processParentPid:process?.parentPid??null,processComm:process?.comm??null,processStatComm:process?.statComm??null,processCommandLine:process?.commandLine??null,processNSpid:process?.namespaceIds??null,threadPathTid:tid,threadComm:counter.threadName??null,threadNSpid:counter.namespaceIds??null,pidNamespace:process?.pidNamespace??null,processState:process?.state??null,threadState:counter.state??null,processStartTicks:process?.startTimeTicks??null,threadStartTicks:counter.startTimeTicks??null,schedstat:counter.schedstatAvailable?{runTimeNs:counter.runTimeNs,runQueueWaitNs:counter.runQueueWaitNs,timeslices:counter.timeslices}:null,taskDirectory:taskResult.value?{entryCount:taskResult.value.length,targetTidVisible:taskResult.value.includes(String(tid)),sampleTids:taskResult.value.slice(0,16).map(Number).filter(Number.isSafeInteger)}:null},
    parsedIdentity:{pid:process?.pid??null,tid:counter.tid??tid,parentPid:process?.parentPid??null,processType:process?.processType??null,processTypeReason:process?.processTypeReason??null,processTypeSource:process?.processTypeSource??null,processTypeArgument:process?.processTypeArgument??null,executableName:process?.executableName??null,isChromiumProcess:process?.isChromiumProcess??null,processNamespaceIds:process?.namespaceIds??null,threadNamespaceIds:counter.namespaceIds??null,pidNamespace:process?.pidNamespace??null,processStartTicks:process?.startTimeTicks??null,threadStartTicks:counter.startTimeTicks??null},
    procReadStatus:{process:process?.readStatus??null,thread:counter.readStatus??null,taskDirectory:procReadStatus(taskResult),rootProcess:rootProcess?.readStatus??null},
    rejectionReason:null,
  };
  const reject=(reason,extra={})=>{identityEvidence.rejectionReason=reason;return{candidate:null,process,reason,identityEvidence,...extra};};
  if(!process?.statAvailable)return reject(process?.readStatus?.stat?.reason==='permission-denied'?'permission-denied':process?.readStatus?.stat?.reason==='not-found'?'process-not-visible':'process-stat-unavailable',{rootPidNamespace:rootProcess?.pidNamespace??null});
  const traceBrowserPid=Number(traceIdentity.browserPid);
  if(!Number.isSafeInteger(traceBrowserPid))return reject('trace-browser-pid-unavailable',{rootPidNamespace:rootProcess?.pidNamespace??null});
  if(!rootProcess?.statAvailable)return reject(rootProcess?.readStatus?.stat?.reason==='permission-denied'?'permission-denied':Number(rootPid)===traceBrowserPid?'process-exited':'browser-process-not-visible',{rootPidNamespace:rootProcess?.pidNamespace??null});
  const browserMatchesRoot=rootProcess.pid===traceBrowserPid||rootProcess.namespaceIds?.includes(traceBrowserPid);
  if(!browserMatchesRoot)return reject('pid-namespace-mismatch',{rootPidNamespace:rootProcess.pidNamespace??null});
  if(process.readStatus.cmdline.reason==='permission-denied'||process.readStatus.comm.reason==='permission-denied'||process.readStatus.pidNamespace.reason==='permission-denied'||rootProcess.readStatus.pidNamespace.reason==='permission-denied')return reject('permission-denied',{rootPidNamespace:rootProcess.pidNamespace??null});
  if(process.readStatus.pidNamespace.available!==true||rootProcess.readStatus.pidNamespace.available!==true)return reject('pid-namespace-unavailable',{rootPidNamespace:rootProcess.pidNamespace??null});
  if(process.pidNamespace!==rootProcess.pidNamespace)return reject('pid-namespace-mismatch',{rootPidNamespace:rootProcess.pidNamespace});
  if(process.readStatus.cmdline.reason==='not-found')return reject('cmdline-unavailable',{rootPidNamespace:rootProcess.pidNamespace});
  if(process.processTypeReason==='cmdline-empty')return reject('cmdline-empty',{rootPidNamespace:rootProcess?.pidNamespace??null});
  if(!process.isChromiumProcess)return reject('chromium-process-name-mismatch',{rootPidNamespace:rootProcess?.pidNamespace??null});
  if(process.processType!=='renderer')return reject(process.processTypeReason??'process-type-not-renderer',{rootPidNamespace:rootProcess?.pidNamespace??null});
  if(rootProcess?.pidNamespace&&process.pidNamespace&&rootProcess.pidNamespace!==process.pidNamespace)return reject('pid-namespace-mismatch',{rootPidNamespace:rootProcess.pidNamespace});
  if(!taskResult.value)return reject(taskResult.error?.code==='EACCES'||taskResult.error?.code==='EPERM'?'permission-denied':'task-directory-unavailable',{rootPidNamespace:rootProcess?.pidNamespace??null});
  if(!taskResult.value.includes(String(tid)))return reject('thread-not-visible',{rootPidNamespace:rootProcess?.pidNamespace??null});
  if(counter.reason==='process-exited')return reject('process-exited',{rootPidNamespace:rootProcess?.pidNamespace??null});
  if(!Number.isSafeInteger(counter.startTimeTicks))return reject(counter.reason==='permission-denied'?'permission-denied':counter.reason??'thread-not-visible',{rootPidNamespace:rootProcess?.pidNamespace??null});
  if(counter.threadName!=='CrRendererMain')return reject(counter.threadName?'thread-name-mismatch':'thread-not-visible',{rootPidNamespace:rootProcess?.pidNamespace??null});
  if(counter.liveProcessStartTimeTicks!==process.startTimeTicks)return reject('process-or-thread-identity-changed',{rootPidNamespace:rootProcess?.pidNamespace??null});
  const processAfter=await readProcessRecord(pid);
  if(!processAfter?.statAvailable||processAfter.startTimeTicks!==process.startTimeTicks||processAfter.pidNamespace!==process.pidNamespace)return reject('process-or-thread-identity-changed',{rootPidNamespace:rootProcess?.pidNamespace??null});
  const rootAfter=await readProcessRecord(Number(rootPid));
  if(!rootAfter?.statAvailable||rootAfter.startTimeTicks!==rootProcess.startTimeTicks||rootAfter.pidNamespace!==rootProcess.pidNamespace)return reject('browser-process-identity-changed',{rootPidNamespace:rootProcess?.pidNamespace??null});
  identityEvidence.rawObservedIdentity.processStartTicksAfter=processAfter.startTimeTicks;
  identityEvidence.rawObservedIdentity.browserProcessStartTicksAfter=rootAfter.startTimeTicks;
  const candidate={...process,...counter,pid,tid,processName:process.comm,processStartTimeTicks:process.startTimeTicks,threadStartTimeTicks:counter.startTimeTicks,expectedProcessStartTimeTicks:process.startTimeTicks,expectedThreadStartTimeTicks:counter.startTimeTicks,processNamespaceIds:process.namespaceIds,threadNamespaceIds:counter.namespaceIds??null,pidNamespace:process.pidNamespace,candidateSource:'trace-pid-tid-proc'};
  const resolution=resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[candidate],linuxProcesses:[process],rootPidNamespace:rootProcess?.pidNamespace??null,rootPidNamespaceIds:rootProcess?.namespaceIds??null});
  if(resolution.status!=='RENDERER_THREAD_RESOLVED')return reject(resolution.reason,{rootPidNamespace:rootProcess?.pidNamespace??null,resolution});
  return{candidate,process,reason:null,identityEvidence,resolution,rootPidNamespace:rootProcess?.pidNamespace??null,rootPidNamespaceIds:rootProcess?.namespaceIds??null};
}

async function discoverRendererTargets(rootPid,traceIdentity=null){
  if(!traceIdentity)return findRendererMainThreads(rootPid);
  if(traceIdentity.processAuthority)return discoverAuthoritativeRenderer(rootPid,traceIdentity);
  const direct=await readTraceRendererCandidate(rootPid,traceIdentity);
  if(direct.candidate)return{available:true,status:'RENDERER_THREAD_CANDIDATES_DISCOVERED',rootPid:Number(rootPid),rootPidNamespace:direct.rootPidNamespace,rootPidNamespaceIds:direct.rootPidNamespaceIds??null,targets:[direct.candidate],rendererProcesses:[direct.process],rendererMainCandidateCount:1,reason:null,traceIdentityResolution:direct.resolution,traceIdentitySource:'trace-pid-tid-direct-proc',directResolutionFailure:null,directIdentityEvidence:direct.identityEvidence,discoverySources:{tracePidTidDirect:true,processTreeFallbackUsed:false,procEnumerationFallbackUsed:false}};
  const fallback=await findRendererMainThreads(rootPid),resolution=resolveRendererThreadIdentity({traceIdentity,linuxCandidates:fallback.targets,linuxProcesses:fallback.rendererProcesses,rootPidNamespace:fallback.rootPidNamespace,rootPidNamespaceIds:fallback.rootPidNamespaceIds});
  if(resolution.status==='RENDERER_THREAD_RESOLVED'){
    const chosen=fallback.targets.find(candidate=>candidate.pid===resolution.linuxIdentity.pid&&candidate.tid===resolution.linuxIdentity.tid);
    if(chosen)return{...fallback,targets:[chosen],available:true,status:'RENDERER_THREAD_CANDIDATES_DISCOVERED',reason:null,traceIdentityResolution:resolution,traceIdentitySource:'trace-pid-tid-proc-namespace-map',directResolutionFailure:direct.reason,directIdentityEvidence:direct.identityEvidence};
  }
  const genericNotVisible=['process-not-visible','renderer-process-not-visible'].includes(resolution.reason);
  return{...fallback,available:false,status:'RENDERER_THREAD_UNAVAILABLE',reason:genericNotVisible&&direct.reason?direct.reason:resolution.reason,traceIdentityResolution:resolution,traceIdentitySource:null,directResolutionFailure:direct.reason,directIdentityEvidence:direct.identityEvidence};
}

export async function discoverAuthoritativeRenderer(rootPid,traceIdentity,{procRoot='/proc'}={}){
  const root=await readProcessRecord(Number(rootPid),procRoot),authority=traceIdentity.processAuthority;
  const evidence={expectedIdentity:traceIdentity,rawObservedIdentity:null,parsedIdentity:null,procReadStatus:{root:root.readStatus},rejectionReason:null};
  const reject=reason=>({available:false,status:'RENDERER_THREAD_UNAVAILABLE',reason,targets:[],rendererProcesses:[],rootPidNamespace:root.pidNamespace,rootPidNamespaceIds:root.namespaceIds,directIdentityEvidence:{...evidence,rejectionReason:reason}});
  if(!authority?.available)return reject(authority?.reason??'chromium-process-authority-unavailable');
  if(!root.statAvailable||!root.pidNamespace)return reject('browser-process-not-visible');
  const traceIndex=root.namespaceIds?.indexOf(traceIdentity.browserPid)??-1;
  if(traceIndex<0)return reject('pid-namespace-mismatch');
  const entries=await readProcDirectory(procRoot);
  if(!entries.value)return reject('process-list-unavailable');
  const numeric=entries.value.filter(value=>/^\d+$/.test(value));
  if(numeric.length>MAX_PROC_ENUMERATION)return reject('proc-enumeration-limit-reached');
  const records=await Promise.all(numeric.map(pid=>readProcessRecord(Number(pid),procRoot)));
  const matches=records.filter(row=>row.namespaceIds?.[traceIndex]===traceIdentity.pid);
  if(matches.length!==1)return reject(matches.length?'multiple-unresolved-candidates':'process-not-visible');
  const process=matches[0];
  evidence.rawObservedIdentity={browserProcess:root,process};evidence.parsedIdentity={processType:process.processType,processTypeReason:process.processTypeReason};evidence.procReadStatus.process=process.readStatus;
  if(process.pidNamespace!==root.pidNamespace)return reject('pid-namespace-mismatch');
  if(process.processTypeSource==='command-line'&&process.processType&&process.processType!=='renderer')return reject('process-type-authority-conflict');
  const tasks=await readProcDirectory(join(procRoot,String(process.pid),'task'));
  if(!tasks.value)return reject('task-directory-unavailable');
  const counters=await Promise.all(tasks.value.filter(value=>/^\d+$/.test(value)).map(tid=>readThreadCounter(process.pid,Number(tid),procRoot)));
  const threads=counters.filter(row=>row.namespaceIds?.[traceIndex]===traceIdentity.tid);
  if(threads.length!==1)return reject(threads.length?'multiple-unresolved-candidates':'thread-not-visible');
  const thread=threads[0],ancestry=[];let current=process;
  while(current.pid!==root.pid&&ancestry.length<32){
    if(ancestry.some(row=>row.pid===current.pid))break;
    ancestry.push({pid:current.pid,parentPid:current.parentPid,startTimeTicks:current.startTimeTicks});
    if(!Number.isSafeInteger(current.parentPid)||current.parentPid<=0)break;
    current=await readProcessRecord(current.parentPid,procRoot);
    if(!current.statAvailable)break;
  }
  evidence.rawObservedIdentity.thread=thread;evidence.rawObservedIdentity.ancestry=ancestry;
  if(current.pid!==root.pid)return reject('parent-pid-mismatch');
  const after=await readThreadCounter(process.pid,thread.tid,procRoot),rootAfter=await readProcessRecord(root.pid,procRoot);
  const stable=process.startTimeTicks===thread.liveProcessStartTimeTicks&&thread.liveProcessStartTimeTicks===after.liveProcessStartTimeTicks&&thread.startTimeTicks===after.startTimeTicks&&after.livePidNamespace===process.pidNamespace&&after.liveParentPid===process.parentPid&&rootAfter.startTimeTicks===root.startTimeTicks&&rootAfter.pidNamespace===root.pidNamespace;
  evidence.rawObservedIdentity.after=after;evidence.rawObservedIdentity.rootAfter=rootAfter;
  if(!stable)return reject('process-or-thread-identity-changed');
  const candidate={...process,...thread,pid:process.pid,tid:thread.tid,processType:'renderer',processTypeSource:authority.source,chromiumAuthority:authority,ancestryVerified:true,ancestry,processStartTimeTicks:process.startTimeTicks,threadStartTimeTicks:thread.startTimeTicks,expectedProcessStartTimeTicks:process.startTimeTicks,expectedThreadStartTimeTicks:thread.startTimeTicks,expectedParentPid:process.parentPid,processNamespaceIds:process.namespaceIds,threadNamespaceIds:thread.namespaceIds,pidNamespace:process.pidNamespace};
  const resolution=resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[candidate],linuxProcesses:[candidate],rootPidNamespace:root.pidNamespace,rootPidNamespaceIds:root.namespaceIds});
  if(resolution.status!=='RENDERER_THREAD_RESOLVED')return reject(resolution.reason);
  return{available:true,status:'RENDERER_THREAD_CANDIDATES_DISCOVERED',reason:null,targets:[candidate],rendererProcesses:[candidate],rootPidNamespace:root.pidNamespace,rootPidNamespaceIds:root.namespaceIds,directIdentityEvidence:evidence,traceIdentityResolution:resolution};
}

export async function findRendererMainThreads(rootPid){
  const tree=await readProcessTree(Number(rootPid)),enumerated=await enumerateRendererProcesses(tree.processes),renderers=enumerated.processes,targets=[],readErrors=[];
  for(const renderer of renderers){
    let tids=[];try{tids=await readdir(`/proc/${renderer.pid}/task`);}catch(error){if(readErrors.length<MAX_PROC_READ_ERRORS)readErrors.push({pid:renderer.pid,reason:error.code==='EACCES'||error.code==='EPERM'?'permission-denied':'process-not-visible',errorCode:error.code??null});continue;}
    await Promise.all(tids.slice(0,MAX_PROC_ENUMERATION).map(async tidText=>{
      const tid=Number(tidText);if(!Number.isSafeInteger(tid))return;
      let threadName='';try{threadName=(await readFile(`/proc/${renderer.pid}/task/${tid}/comm`,'utf8')).trim();}catch(error){if(readErrors.length<MAX_PROC_READ_ERRORS)readErrors.push({pid:renderer.pid,tid,reason:error.code==='EACCES'||error.code==='EPERM'?'permission-denied':'thread-not-visible',errorCode:error.code??null});return;}
      if(threadName!=='CrRendererMain')return;
      const counter=await readThreadCounter(renderer.pid,tid);
      if(targets.length<MAX_RENDERER_CANDIDATES)targets.push({pid:renderer.pid,tid,processType:renderer.processType,processTypeReason:renderer.processTypeReason,processName:renderer.comm,commandLine:renderer.commandLine,processStartTimeTicks:renderer.startTimeTicks,processNamespaceIds:renderer.namespaceIds,threadNamespaceIds:counter.namespaceIds??null,pidNamespace:renderer.pidNamespace,threadName,candidateSource:'proc-thread-name',...counter});
    }));
  }
  const rendererMainCandidates=targets.filter(target=>target.threadName==='CrRendererMain');
  const rootProcess=tree.processes.find(process=>process.pid===Number(rootPid));
  const discoveryErrors=[...readErrors,...(enumerated.errors??[])],reason=targets.length?null:discoveryErrors.some(item=>item.reason==='permission-denied')||enumerated.error==='permission-denied'?'permission-denied':renderers.length?'thread-not-visible':tree.processes.length?'renderer-process-not-visible':enumerated.error??'process-not-visible';
  return{available:targets.length>0,status:targets.length?'RENDERER_THREAD_CANDIDATES_DISCOVERED':'RENDERER_THREAD_UNAVAILABLE',rootPid:Number(rootPid),rootPidNamespace:rootProcess?.pidNamespace??null,rootPidNamespaceIds:rootProcess?.namespaceIds??null,targets,rendererProcesses:renderers,rendererMainCandidateCount:rendererMainCandidates.length,reason,discoverySources:{processTreeCount:tree.processes.length,treeRendererCount:tree.processes.filter(process=>process.processType==='renderer').length,procRendererCount:renderers.length,procEnumerationLimit:enumerated.enumerationLimit??MAX_PROC_ENUMERATION,rendererCandidateLimit:enumerated.candidateLimit??MAX_RENDERER_CANDIDATES,treeFallbackUsed:renderers.some(process=>!tree.processes.some(row=>row.pid===process.pid))},processCount:tree.processes.length,readErrors:discoveryErrors};
}

export async function startRendererSchedulerSampler(rootPid,{intervalMs=2,processIntervalMs=20,traceIdentity=null}={}){
  const discovery=await discoverRendererTargets(rootPid,traceIdentity);
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

export function summarizeSchedulerSamples(samples,clockMapping,stepWindowsMs,{targetIdentity=null,requireTargetIdentity=false,rootPidNamespace=null,rootPidNamespaceIds=null}={}){
  const map=clockMapping?.available?(value=>clockMapping.slope*value+clockMapping.offset):null,clockMappingUncertaintyMs=clockMapping?.available&&Number.isFinite(clockMapping.uncertaintyMs)?clockMapping.uncertaintyMs:null;
  const rows=(samples??[]).flatMap(sample=>{
    const start=Number(sample.readStartHrtimeNs)/1e6,end=Number(sample.readEndHrtimeNs)/1e6;
    if(!Number.isFinite(start)||!Number.isFinite(end))return[];
    const at=map?(map(start)+map(end))/2:null;
    return(sample.threads??[]).map(thread=>{
      const expectedProcessStartTimeTicks=thread.expectedProcessStartTimeTicks??thread.processStartTimeTicks??null,expectedThreadStartTimeTicks=thread.expectedThreadStartTimeTicks??null,processStartTimeTicks=thread.liveProcessStartTimeTicks??thread.processStartTimeTicks??thread.startTimeTicks,processIdentityStable=expectedProcessStartTimeTicks==null||processStartTimeTicks===expectedProcessStartTimeTicks,threadIdentityStable=expectedThreadStartTimeTicks==null||thread.startTimeTicks===expectedThreadStartTimeTicks,namespaceStable=!thread.chromiumAuthority||thread.livePidNamespace===thread.pidNamespace&&thread.liveParentPid===thread.expectedParentPid&&JSON.stringify(thread.namespaceIds)===JSON.stringify(thread.threadNamespaceIds),threadNameStable=thread.threadName==='CrRendererMain'||hasChromiumThreadAuthority(targetIdentity??(thread.chromiumAuthority&&{pid:thread.chromiumAuthority.pid,tid:thread.chromiumAuthority.threadId,browserPid:thread.chromiumAuthority.browserPid}),thread),processTypeStable=thread.processType==='renderer';
      return{chromiumAuthority:thread.chromiumAuthority,ancestryVerified:thread.ancestryVerified,pid:thread.pid,tid:thread.tid,threadName:thread.threadName,processType:thread.processType,processStartTimeTicks,threadStartTimeTicks:thread.startTimeTicks,expectedProcessStartTimeTicks,expectedThreadStartTimeTicks,state:thread.state,available:thread.available===true&&processIdentityStable&&threadIdentityStable&&threadNameStable&&processTypeStable&&namespaceStable,unavailableReason:thread.reason??(!processIdentityStable||!threadIdentityStable||!threadNameStable||!processTypeStable||!namespaceStable?'process-or-thread-identity-changed':null),atBrowserPerformanceNowMs:at,readStartHrtimeMs:start,readEndHrtimeMs:end,readDurationMs:sample.readDurationMs??end-start,runTimeNs:thread.runTimeNs,runQueueWaitNs:thread.runQueueWaitNs,timeslices:thread.timeslices,cpuMs:thread.cpuMs,userTicks:thread.userTicks,systemTicks:thread.systemTicks,startTimeTicks:thread.startTimeTicks,voluntaryContextSwitches:thread.voluntaryContextSwitches,involuntaryContextSwitches:thread.involuntaryContextSwitches,namespaceIds:thread.namespaceIds,processNamespaceIds:thread.processNamespaceIds,threadNamespaceIds:thread.threadNamespaceIds,pidNamespace:thread.pidNamespace,commandLine:thread.commandLine};
    });
  }).sort((a,b)=>(a.atBrowserPerformanceNowMs??0)-(b.atBrowserPerformanceNowMs??0));
  const processRows=(samples??[]).flatMap(sample=>{
    const start=Number(sample.readStartHrtimeNs)/1e6,end=Number(sample.readEndHrtimeNs)/1e6;
    if(!Number.isFinite(start)||!Number.isFinite(end))return[];
    const at=map?(map(start)+map(end))/2:null;
    return(sample.processes??[]).map(process=>({pid:process.pid,state:process.state,cpuMs:process.cpuMs,threadCount:process.threadCount,threadIds:process.threadIds,available:process.available,atBrowserPerformanceNowMs:at}));
  }).filter(row=>Number.isFinite(row.atBrowserPerformanceNowMs)).sort((a,b)=>a.atBrowserPerformanceNowMs-b.atBrowserPerformanceNowMs);
  const candidateMap=new Map(rows.map(row=>[`${row.pid}:${row.tid}`,row])),candidates=[...candidateMap.values()].map(row=>({chromiumAuthority:row.chromiumAuthority,ancestryVerified:row.ancestryVerified,pid:row.pid,tid:row.tid,threadName:row.threadName,processType:row.processType,processStartTimeTicks:row.processStartTimeTicks,threadStartTimeTicks:row.threadStartTimeTicks,expectedProcessStartTimeTicks:row.expectedProcessStartTimeTicks,expectedThreadStartTimeTicks:row.expectedThreadStartTimeTicks,available:row.available,reason:row.unavailableReason,namespaceIds:row.namespaceIds,processNamespaceIds:row.processNamespaceIds,threadNamespaceIds:row.threadNamespaceIds,pidNamespace:row.pidNamespace,commandLine:row.commandLine}));
  let resolvedIdentity=null,identityResolution=null;
  if(targetIdentity){identityResolution=resolveRendererThreadIdentity({traceIdentity:targetIdentity,linuxCandidates:candidates,linuxProcesses:candidates,rootPidNamespace,rootPidNamespaceIds});if(identityResolution.status==='RENDERER_THREAD_RESOLVED')resolvedIdentity=identityResolution.linuxIdentity;}
  else if(!requireTargetIdentity&&candidates.length===1&&candidates[0].threadName==='CrRendererMain'&&candidates[0].processType==='renderer'&&Number.isSafeInteger(candidates[0].processStartTimeTicks)){resolvedIdentity=candidates[0];identityResolution={status:'RENDERER_THREAD_RESOLVED',reason:null,matchMethod:'single-proc-renderer-main-candidate',linuxIdentity:resolvedIdentity};}
  else identityResolution={status:'RENDERER_THREAD_UNAVAILABLE',reason:requireTargetIdentity?'trace-renderer-identity-unavailable':candidates.length===0?'renderer-thread-not-sampled':'multiple-unresolved-candidates',linuxCandidateCount:candidates.length};
  const target=resolvedIdentity,perStep=(stepWindowsMs??[]).map(([startMs,endMs],stepIndex)=>{
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs)return{stepIndex,available:false,reason:'invalid-step-window'};
    if(!clockMapping?.available)return{stepIndex,available:false,reason:'clock-mapping-unavailable',rendererIdentity:identityResolution};
    if(!target)return{stepIndex,available:false,reason:identityResolution.reason,rendererIdentity:identityResolution};
    const margin=clockMappingUncertaintyMs??Infinity,matching=rows.filter(row=>row.pid===target.pid&&row.tid===target.tid),inside=matching.filter(row=>row.available&&map(row.readStartHrtimeMs)>=startMs+margin&&map(row.readEndHrtimeMs)<=endMs-margin),runtimeDeltas=[],switches=[];let changedThreadIdentity=false;
    for(let index=1;index<inside.length;index++){
      const before=inside[index-1],after=inside[index],spanMs=after.atBrowserPerformanceNowMs-before.atBrowserPerformanceNowMs;
      if(!(spanMs>0))continue;
      const runtimeMs=(after.runTimeNs-before.runTimeNs)/1e6,waitMs=(after.runQueueWaitNs-before.runQueueWaitNs)/1e6,stableStart=before.startTimeTicks===after.startTimeTicks;
      if(!stableStart||before.processStartTimeTicks!==before.expectedProcessStartTimeTicks||after.processStartTimeTicks!==after.expectedProcessStartTimeTicks||before.startTimeTicks!==before.expectedThreadStartTimeTicks||after.startTimeTicks!==after.expectedThreadStartTimeTicks){changedThreadIdentity=true;continue;}
      const timeslices=after.timeslices-before.timeslices,contextSwitchCountersAvailable=Number.isFinite(after.voluntaryContextSwitches)&&Number.isFinite(before.voluntaryContextSwitches)&&Number.isFinite(after.involuntaryContextSwitches)&&Number.isFinite(before.involuntaryContextSwitches);
      if(runtimeMs>=0&&waitMs>=0&&timeslices>=0){runtimeDeltas.push({runtimeMs,waitMs,userCpuMs:Number.isFinite(after.userTicks)&&Number.isFinite(before.userTicks)?(after.userTicks-before.userTicks)*PROC_CPU_COUNTER_RESOLUTION_MS:null,systemCpuMs:Number.isFinite(after.systemTicks)&&Number.isFinite(before.systemTicks)?(after.systemTicks-before.systemTicks)*PROC_CPU_COUNTER_RESOLUTION_MS:null,timeslices,spanMs,contextSwitchCountersAvailable});switches.push(contextSwitchCountersAvailable?{available:true,voluntary:after.voluntaryContextSwitches-before.voluntaryContextSwitches,involuntary:after.involuntaryContextSwitches-before.involuntaryContextSwitches}:{available:false,voluntary:null,involuntary:null});}
    }
    const runtimeMs=runtimeDeltas.reduce((sum,row)=>sum+row.runtimeMs,0),waitMs=runtimeDeltas.reduce((sum,row)=>sum+row.waitMs,0),coverageMs=runtimeDeltas.reduce((sum,row)=>sum+row.spanMs,0),wallMs=endMs-startMs;
    const processSamples=processRows.filter(row=>row.pid===target.pid&&row.atBrowserPerformanceNowMs>=startMs+margin&&row.atBrowserPerformanceNowMs<=endMs-margin),processDeltas=[];
    for(let index=1;index<processSamples.length;index++){const before=processSamples[index-1],after=processSamples[index],spanMs=after.atBrowserPerformanceNowMs-before.atBrowserPerformanceNowMs,deltaMs=Number.isFinite(before.cpuMs)&&Number.isFinite(after.cpuMs)?after.cpuMs-before.cpuMs:null,threadSetStable=Array.isArray(before.threadIds)&&Array.isArray(after.threadIds)?before.threadIds.length===after.threadIds.length&&before.threadIds.every((tid,tidIndex)=>tid===after.threadIds[tidIndex]):before.threadCount===after.threadCount;if(spanMs>0&&deltaMs!==null&&deltaMs>=0&&threadSetStable)processDeltas.push({deltaMs,spanMs});}
    const processCpuDeltaMs=processDeltas.reduce((sum,row)=>sum+row.deltaMs,0),processCoverageMs=processDeltas.reduce((sum,row)=>sum+row.spanMs,0),processCounterAdequate=processCoverageMs>=wallMs*.5&&wallMs>=PROC_CPU_COUNTER_RESOLUTION_MS*2&&processCpuDeltaMs>=PROC_CPU_COUNTER_RESOLUTION_MS;
    const identityStable=matching.length>=2&&matching.every(row=>row.unavailableReason!=='process-or-thread-identity-changed'&&row.unavailableReason!=='process-exited'&&row.processStartTimeTicks===target.processStartTimeTicks&&row.startTimeTicks===target.threadStartTimeTicks),counterAvailable=runtimeDeltas.length>0&&identityStable,coverageAdequate=coverageMs>=wallMs*.5&&identityStable,perStepAvailable=counterAvailable&&coverageAdequate,counterUnavailableReason=!identityStable?'process-or-thread-identity-changed':counterAvailable&&!coverageAdequate?'counter-coverage-insufficient':counterAvailable?null:matching.find(row=>!row.available)?.unavailableReason??'counter-coverage-insufficient';
    const first=matching[0],last=matching.at(-1),bracketAvailable=identityStable&&first?.available&&last?.available&&last.runTimeNs>=first.runTimeNs&&last.runQueueWaitNs>=first.runQueueWaitNs&&last.timeslices>=first.timeslices;
    const workloadBracket={available:!!bracketAvailable,scope:'counter sample endpoints enclosing workload; includes CDP/marker boundary overhead',intervalMs:first&&last?last.atBrowserPerformanceNowMs-first.atBrowserPerformanceNowMs:null,runtimeMs:bracketAvailable?(last.runTimeNs-first.runTimeNs)/1e6:null,runQueueWaitMs:bracketAvailable?(last.runQueueWaitNs-first.runQueueWaitNs)/1e6:null,timeslices:bracketAvailable?last.timeslices-first.timeslices:null};
    const contextSwitchCounterAvailable=perStepAvailable&&switches.length===runtimeDeltas.length&&switches.every(row=>row.available);
    return{stepIndex,workloadBracket,identityStable,identityBefore:matching[0]??null,identityAfter:matching.at(-1)??null,available:perStepAvailable,counterAvailable,reason:counterUnavailableReason,pid:target.pid,tid:target.tid,threadName:target.threadName,state:inside.at(-1)?.state??null,runtimeMs:perStepAvailable?runtimeMs:null,runQueueWaitMs:perStepAvailable?waitMs:null,cpuToWallRatio:perStepAvailable?runtimeMs/wallMs:null,observedRuntimeDeltaMs:counterAvailable?runtimeMs:null,observedRunQueueWaitDeltaMs:counterAvailable?waitMs:null,userCpuMs:perStepAvailable&&runtimeDeltas.every(row=>row.userCpuMs!==null)?runtimeDeltas.reduce((sum,row)=>sum+row.userCpuMs,0):null,systemCpuMs:perStepAvailable&&runtimeDeltas.every(row=>row.systemCpuMs!==null)?runtimeDeltas.reduce((sum,row)=>sum+row.systemCpuMs,0):null,timeslices:perStepAvailable?runtimeDeltas.reduce((sum,row)=>sum+row.timeslices,0):null,contextSwitchCounterAvailable,contextSwitches:contextSwitchCounterAvailable?{voluntary:switches.reduce((sum,row)=>sum+row.voluntary,0),involuntary:switches.reduce((sum,row)=>sum+row.involuntary,0)}:null,sampleCoverageMs:coverageMs,coverageRatio:Math.min(1,coverageMs/wallMs),samplePairCount:runtimeDeltas.length,clockMappingUncertaintyMs,adequate:coverageAdequate,pidReuseObserved:changedThreadIdentity,counterCoverage:{sampleCount:inside.length,pairCount:runtimeDeltas.length,coverageMs:coverageMs,coverageRatio:Math.min(1,coverageMs/wallMs),clockUncertaintyMs:clockMappingUncertaintyMs,maxReadCostMs:inside.length?Math.max(...inside.map(row=>row.readDurationMs??0)):null},rendererProcessCpuMs:processCounterAdequate?processCpuDeltaMs:null,rendererProcessCpuObservedDeltaMs:processDeltas.length?processCpuDeltaMs:null,rendererProcessCpuCounterResolutionMs:PROC_CPU_COUNTER_RESOLUTION_MS,rendererProcessCpuCounterAdequate:processCounterAdequate,rendererProcessCpuSamplePairCount:processDeltas.length,rendererProcessCpuSampleCoverageMs:processCoverageMs};
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
