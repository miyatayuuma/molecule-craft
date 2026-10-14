import {readdir,readFile} from 'node:fs/promises';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

const clockTicksPerSecond=Number(spawnSync('getconf',['CLK_TCK'],{encoding:'utf8'}).stdout?.trim())||100;

export function parseProcStat(value,pid=null,ticksPerSecond=clockTicksPerSecond){
  const end=value.lastIndexOf(')');
  if(end<0)return null;
  const fields=value.slice(end+2).trim().split(/\s+/);
  if(fields.length<13)return null;
  const numbers=fields.slice(1).map(Number);
  if(!Number.isFinite(numbers[0])||!Number.isFinite(numbers[10])||!Number.isFinite(numbers[11]))return null;
  return{pid:Number(pid),state:fields[0],parentPid:numbers[0],cpuMs:(numbers[10]+numbers[11])*1000/ticksPerSecond};
}

async function readProcessTree(rootPid){
  const processes=[],seen=new Set();
  async function visit(pid){
    if(!Number.isInteger(pid)||pid<=0||seen.has(pid))return;
    seen.add(pid);
    let stat;
    try{stat=parseProcStat(await readFile(`/proc/${pid}/stat`,'utf8'),pid);}catch{return;}
    if(!stat)return;
    processes.push(stat);
    try{
      const raw=await readFile(`/proc/${pid}/task/${pid}/children`,'utf8');
      await Promise.all(raw.trim().split(/\s+/).filter(Boolean).map(child=>visit(Number(child))));
    }catch{}
  }
  await visit(Number(rootPid));
  return{rootPid:Number(rootPid),available:processes.length>0,processes};
}

async function readText(path){try{return await readFile(path,'utf8');}catch{return null;}}
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
  const [procStat,pressure,cgroupStat,cgroupMax,browserProcesses]=await Promise.all([
    readText('/proc/stat'),readText('/proc/pressure/cpu'),readText('/sys/fs/cgroup/cpu.stat'),readText('/sys/fs/cgroup/cpu.max'),readProcessTree(browserPid)
  ]);
  return{
    platform:os.platform(),release:os.release(),arch:os.arch(),logicalCpuCount:os.cpus().length,
    cpuModel:os.cpus()[0]?.model??null,loadAverage:os.loadavg(),
    cpuPressure:pressure,systemCpu:parseProcCpu(procStat),
    cgroupCpu:parseKeyValues(cgroupStat),cgroupCpuMax:cgroupMax?.trim()??null,
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
