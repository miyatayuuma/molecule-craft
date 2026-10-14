import {readdir,readFile} from 'node:fs/promises';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

const clockTicksPerSecond=Number(spawnSync('getconf',['CLK_TCK'],{encoding:'utf8'}).stdout?.trim())||100;
let perfCounterProbe=null;

export function parseProcStat(value,pid=null,ticksPerSecond=clockTicksPerSecond){
  const end=value.lastIndexOf(')');
  if(end<0)return null;
  const fields=value.slice(end+2).trim().split(/\s+/);
  if(fields.length<13)return null;
  const numbers=fields.slice(1).map(Number);
  if(!Number.isFinite(numbers[0])||!Number.isFinite(numbers[10])||!Number.isFinite(numbers[11]))return null;
  return{pid:Number(pid),state:fields[0],parentPid:numbers[0],userTicks:numbers[10],systemTicks:numbers[11],cpuMs:(numbers[10]+numbers[11])*1000/ticksPerSecond};
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
  return Number.isFinite(voluntary)&&Number.isFinite(involuntary)?{voluntaryContextSwitches:voluntary,involuntaryContextSwitches:involuntary}:null;
}

function parseCmdline(value){return typeof value==='string'?value.split('\0').filter(Boolean):[];}

async function readProcessTree(rootPid){
  const processes=[],seen=new Set();
  async function visit(pid){
    if(!Number.isInteger(pid)||pid<=0||seen.has(pid))return;
    seen.add(pid);
    let stat,cmdline,comm;
    try{[stat,cmdline,comm]=await Promise.all([readFile(`/proc/${pid}/stat`,'utf8'),readFile(`/proc/${pid}/cmdline`,'utf8'),readFile(`/proc/${pid}/comm`,'utf8')]);stat=parseProcStat(stat,pid);}catch{return;}
    if(!stat)return;
    const argumentsList=parseCmdline(cmdline),typeIndex=argumentsList.indexOf('--type');
    processes.push({...stat,comm:comm.trim(),cmdline:argumentsList,processType:typeIndex>=0?argumentsList[typeIndex+1]??null:argumentsList.find(value=>value.startsWith('--type='))?.slice(7)??'browser'});
    try{
      const raw=await readFile(`/proc/${pid}/task/${pid}/children`,'utf8');
      await Promise.all(raw.trim().split(/\s+/).filter(Boolean).map(child=>visit(Number(child))));
    }catch{}
  }
  await visit(Number(rootPid));
  return{rootPid:Number(rootPid),available:processes.length>0,processes};
}

async function readThreadCounter(pid,tid){
  try{
    const [statText,schedstatText,statusText,commText]=await Promise.all([
      readFile(`/proc/${pid}/task/${tid}/stat`,'utf8'),
      readFile(`/proc/${pid}/task/${tid}/schedstat`,'utf8'),
      readFile(`/proc/${pid}/task/${tid}/status`,'utf8'),
      readFile(`/proc/${pid}/task/${tid}/comm`,'utf8')
    ]);
    const stat=parseProcStat(statText,tid),schedstat=parseProcSchedstat(schedstatText),contextSwitches=parseProcStatus(statusText);
    if(!stat||!schedstat)return null;
    return{pid:Number(pid),tid:Number(tid),threadName:commText.trim(),state:stat.state,cpuMs:stat.cpuMs,...schedstat,...contextSwitches};
  }catch{return null;}
}

export async function findRendererMainThreads(rootPid){
  const tree=await readProcessTree(Number(rootPid)),renderers=tree.processes.filter(process=>process.processType==='renderer'),targets=[];
  for(const renderer of renderers){
    let tids=[];try{tids=await readdir(`/proc/${renderer.pid}/task`);}catch{continue;}
    for(const tidText of tids){const tid=Number(tidText);if(!Number.isInteger(tid))continue;let name;try{name=(await readFile(`/proc/${renderer.pid}/task/${tid}/comm`,'utf8')).trim();}catch{continue;}if(name==='CrRendererMain'){const counters=await readThreadCounter(renderer.pid,tid);targets.push({pid:renderer.pid,tid,processType:renderer.processType,processName:renderer.comm,threadName:name,...(counters??{})});}}
  }
  return{available:targets.length>0,rootPid:Number(rootPid),targets,reason:targets.length?'':renderers.length?'renderer-main-thread-not-visible':'renderer-process-not-visible'};
}

export async function startRendererSchedulerSampler(rootPid,{intervalMs=2}={}){
  const discovery=await findRendererMainThreads(rootPid);
  if(!discovery.available)return{available:false,discovery,samples:[],stop:async()=>({available:false,discovery,samples:[],sampleIntervalMs:intervalMs})};
  const targets=discovery.targets.map(({pid,tid})=>({pid,tid})),samples=[];let inFlight=null;
  const take=()=>{
    if(inFlight)return inFlight;
    inFlight=(async()=>{
      const readStartHrtimeNs=process.hrtime.bigint().toString();
      const rows=await Promise.all(targets.map(({pid,tid})=>readThreadCounter(pid,tid)));
      const readEndHrtimeNs=process.hrtime.bigint().toString();
      samples.push({readStartHrtimeNs,readEndHrtimeNs,threads:rows.filter(Boolean)});
    })().finally(()=>{inFlight=null;});
    return inFlight;
  };
  await take();
  const timer=setInterval(()=>{void take();},Math.max(1,intervalMs));timer.unref?.();
  return{
    available:true,discovery,
    stop:async()=>{
      clearInterval(timer);await inFlight;await take();
      const readCostsMs=samples.map(sample=>(Number(sample.readEndHrtimeNs)-Number(sample.readStartHrtimeNs))/1e6);
      return{available:true,discovery,sampleIntervalMs:intervalMs,sampleCount:samples.length,meanReadCostMs:readCostsMs.length?readCostsMs.reduce((sum,value)=>sum+value,0)/readCostsMs.length:null,maxReadCostMs:readCostsMs.length?Math.max(...readCostsMs):null,samples};
    }
  };
}

export function summarizeSchedulerSamples(samples,clockMapping,stepWindowsMs){
  const map=clockMapping?.available?(value=>clockMapping.slope*value+clockMapping.offset):null;
  const rows=(samples??[]).flatMap(sample=>{
    const start=Number(sample.readStartHrtimeNs)/1e6,end=Number(sample.readEndHrtimeNs)/1e6;
    if(!Number.isFinite(start)||!Number.isFinite(end))return[];
    const at=map?(map(start)+map(end))/2:null;
    return(sample.threads??[]).map(thread=>({pid:thread.pid,tid:thread.tid,threadName:thread.threadName,state:thread.state,atBrowserPerformanceNowMs:at,readStartHrtimeMs:start,readEndHrtimeMs:end,runTimeNs:thread.runTimeNs,runQueueWaitNs:thread.runQueueWaitNs,timeslices:thread.timeslices,cpuMs:thread.cpuMs,voluntaryContextSwitches:thread.voluntaryContextSwitches,involuntaryContextSwitches:thread.involuntaryContextSwitches}));
  }).filter(row=>Number.isFinite(row.atBrowserPerformanceNowMs)).sort((a,b)=>a.atBrowserPerformanceNowMs-b.atBrowserPerformanceNowMs);
  const target=rows[0],perStep=(stepWindowsMs??[]).map(([startMs,endMs],stepIndex)=>{
    if(!target||!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs)return{stepIndex,available:false,reason:'invalid-clock-or-thread'};
    const matching=rows.filter(row=>row.pid===target.pid&&row.tid===target.tid),inside=matching.filter(row=>row.atBrowserPerformanceNowMs>=startMs&&row.atBrowserPerformanceNowMs<=endMs),runtimeDeltas=[],waitDeltas=[],switches=[];
    for(let index=1;index<inside.length;index++){
      const before=inside[index-1],after=inside[index],spanMs=after.atBrowserPerformanceNowMs-before.atBrowserPerformanceNowMs;
      if(!(spanMs>0))continue;
      const runtimeMs=(after.runTimeNs-before.runTimeNs)/1e6,waitMs=(after.runQueueWaitNs-before.runQueueWaitNs)/1e6;
      if(runtimeMs>=0&&waitMs>=0){runtimeDeltas.push({runtimeMs,waitMs,spanMs});switches.push({voluntary:after.voluntaryContextSwitches-before.voluntaryContextSwitches,involuntary:after.involuntaryContextSwitches-before.involuntaryContextSwitches});}
    }
    const runtimeMs=runtimeDeltas.reduce((sum,row)=>sum+row.runtimeMs,0),waitMs=runtimeDeltas.reduce((sum,row)=>sum+row.waitMs,0),coverageMs=runtimeDeltas.reduce((sum,row)=>sum+row.spanMs,0),wallMs=endMs-startMs;
    return{stepIndex,available:runtimeDeltas.length>0,pid:target.pid,tid:target.tid,threadName:target.threadName,state:inside.at(-1)?.state??null,runtimeMs,runQueueWaitMs:waitMs,contextSwitches:{voluntary:switches.reduce((sum,row)=>sum+row.voluntary,0),involuntary:switches.reduce((sum,row)=>sum+row.involuntary,0)},sampleCoverageMs:coverageMs,coverageRatio:Math.min(1,coverageMs/wallMs),samplePairCount:runtimeDeltas.length,adequate:coverageMs>=wallMs*.5};
  });
  return{available:rows.length>0,clockMappingAvailable:!!map,sampleCount:rows.length,perStep};
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
  const browserCpuMs=processTreeAvailable?common.reduce((sum,pid)=>sum+Math.max(0,end.get(pid).cpuMs-start.get(pid).cpuMs),0):null;
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
    processTreeAvailable
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
