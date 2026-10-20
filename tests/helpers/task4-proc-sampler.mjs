import {readFileSync,readdirSync,writeFileSync} from 'node:fs';

// Dedicated process: observations never run on the browser/fixture event loop.
// Raw read brackets are retained; 5ms is a requested cadence, not a guarantee.
const config=JSON.parse(process.argv[2]),rows=[],now=()=>Number(process.hrtime.bigint())/1000;
const read=path=>{try{return readFileSync(path,'utf8');}catch(error){return {status:'NOT_AVAILABLE',code:error.code};}};
export function parseStat(text){
  if(typeof text!=='string')return text;
  const close=text.lastIndexOf(')'),f=text.slice(close+2).trim().split(/\s+/);
  return {state:f[0],ppid:Number(f[1]),utimeTicks:Number(f[11]),stimeTicks:Number(f[12]),starttime:f[19],processor:Number(f[36])};
}
const take=()=>{
  const startUs=now(),tasks=[];
  for(const process of config.processes){
    let tids;try{tids=process.type==='GPU'?readdirSync(`/proc/${process.id}/task`):[String(process.id)];}catch{continue;}
    for(const tid of tids){
      const path=`/proc/${process.id}/task/${tid}`,beforeUs=now(),stat=parseStat(read(`${path}/stat`)),schedstat=read(`${path}/schedstat`),status=read(`${path}/status`),wchan=read(`${path}/wchan`),comm=read(`${path}/comm`);
      tasks.push({pid:process.id,tid:Number(tid),type:process.type,beforeUs,afterUs:now(),stat,
        schedstat:typeof schedstat==='string'?schedstat.trim().split(/\s+/).map(Number):schedstat,
        state:typeof status==='string'?status.match(/^State:\s+(.+)$/m)?.[1]??'NOT_AVAILABLE':status,
        voluntary:typeof status==='string'?Number(status.match(/^voluntary_ctxt_switches:\s+(\d+)/m)?.[1]):null,
        involuntary:typeof status==='string'?Number(status.match(/^nonvoluntary_ctxt_switches:\s+(\d+)/m)?.[1]):null,
        wchan,comm});
    }
  }
  const cpuPressure=read('/proc/pressure/cpu'),cpuStat=read('/sys/fs/cgroup/cpu.stat');
  rows.push({startUs,endUs:now(),tasks,cpuPressure,cpuStat});
};
let timer,stopped=false;
function stop(){if(stopped)return;stopped=true;clearInterval(timer);take();writeFileSync(config.output,JSON.stringify({schemaVersion:1,clock:'node process.hrtime microseconds; map only via bracketed trace marks',requestedPeriodMs:5,processes:config.processes,rows,selfCpu:process.cpuUsage(),selfResourceUsage:process.resourceUsage()}));process.exit(0);}
process.on('SIGTERM',stop);process.on('message',message=>{if(message==='stop')stop();});
take();timer=setInterval(take,5);process.send?.('ready');
setTimeout(stop,20000);
