import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const unavailable=error=>({status:'NOT_AVAILABLE',message:error.message});
const read=async path=>{try{return await readFile(path,'utf8');}catch(error){return unavailable(error);}};
async function connect(url){
  const socket=new WebSocket(url),pending=new Map();let id=0;
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('Browser CDP connect timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data),task=pending.get(message.id);if(!task)return;pending.delete(message.id);clearTimeout(task.timer);message.error?task.fail(Error(message.error.message)):task.ok(message.result);});
  return {close:()=>socket.close(),send:(method,params={})=>new Promise((ok,fail)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);fail(Error('Browser CDP timeout: '+method));},5000);pending.set(key,{ok,fail,timer});socket.send(JSON.stringify({id:key,method,params}));})};
}
export async function beginGpuOsObservation({send,debugPort,artifactDir,trialIndex}){
  const version=await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json(),browser=await connect(version.webSocketDebuggerUrl);
  let child;
  try{
    const processInfo=await browser.send('SystemInfo.getProcessInfo');
    const gpuInfo=await browser.send('SystemInfo.getInfo').catch(unavailable),processes=processInfo.processInfo.filter(p=>p.type==='GPU'||p.type==='renderer'||p.type==='browser');
    if(processes.filter(p=>p.type==='GPU').length!==1||!processes.some(p=>p.type==='renderer'))throw Error('SystemInfo GPU/renderer identity unavailable');
    const authority=await Promise.all(processes.map(async p=>({...p,cmdline:await read(`/proc/${p.id}/cmdline`),stat:await read(`/proc/${p.id}/stat`),status:await read(`/proc/${p.id}/status`)})));
    const marks=[];
    const mark=async suffix=>{const name=`task4:os-sync:${trialIndex}:${suffix}`,beforeUs=Number(process.hrtime.bigint())/1000;const result=await send('Runtime.evaluate',{expression:`performance.mark(${JSON.stringify(name)});true`,returnByValue:true});const afterUs=Number(process.hrtime.bigint())/1000;if(result.exceptionDetails)throw Error('clock mark failed');marks.push({name,beforeUs,afterUs});};
    await mark('start');
    child=spawn(process.execPath,[new URL('./task4-proc-sampler.mjs',import.meta.url).pathname,JSON.stringify({processes,output:join(artifactDir,`gpu-os-proc-${trialIndex}.json`)})],{stdio:['ignore','ignore','pipe','ipc']});
    let samplerErrors='';child.stderr.on('data',value=>samplerErrors+=value);
    const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
    await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('proc sampler ready timeout')),5000);child.once('message',()=>{clearTimeout(timer);ok();});child.once('error',fail);});
    return {async stop(){
      const errors=[];
      try{await mark('end');}catch(error){errors.push(unavailable(error));}
      try{if(child.connected)child.send('stop');else child.kill('SIGTERM');}catch(error){errors.push(unavailable(error));child.kill('SIGTERM');}
      const exit=await exited;
      const finalProcessInfo=await browser.send('SystemInfo.getProcessInfo').catch(unavailable),finalAuthority=await Promise.all(processes.map(async p=>({id:p.id,stat:await read(`/proc/${p.id}/stat`)})));
      try{await writeFile(join(artifactDir,`gpu-os-authority-${trialIndex}.json`),JSON.stringify({version,processInfo,finalProcessInfo,gpuInfo,authority,finalAuthority,marks,samplerErrors,exit,errors,
        limits:{kernelSchedulerTrace:'NOT_AVAILABLE unless preflight explicitly reports otherwise',hardwareGpuCounters:'NOT_AVAILABLE via these APIs',stateSampling:'Instantaneous samples; do not infer unobserved switches',clockMapping:'Trace mark ts lies inside each Node hrtime request bracket. Retain bracket uncertainty; do not assume exact clocks.',overhead:'Trace instrumentation + 5ms requested proc polling; sampler read spans, actual cadence and self CPU retained. No uninstrumented acceptance inference.'}},null,2));}finally{browser.close();}
      if(exit.code!==0||errors.length)throw Error('proc sampler incomplete '+JSON.stringify({exit,errors}));
    }};
  }catch(error){child?.kill('SIGTERM');browser.close();throw error;}
}
