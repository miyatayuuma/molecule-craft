/** Browser-target only. Keep unsupported APIs explicit, never infer type from client-id. */
export async function captureChromiumProcessAuthority(browserSend,pageRenderer){
  if(!browserSend)return{available:false,reason:'browser-cdp-unavailable',source:'SystemInfo.getProcessInfo'};
  try{
    const result=await browserSend('SystemInfo.getProcessInfo');
    const processes=(result?.processInfo??[]).map(row=>({id:Number(row.id),type:row.type}));
    const identity=pageRenderer?.identity,renderers=processes.filter(row=>row.id===identity?.pid&&row.type==='renderer'),browsers=processes.filter(row=>row.id===identity?.browserPid&&row.type==='browser');
    const available=pageRenderer?.available===true&&pageRenderer.markerIds?.length>0&&identity?.source==='browser-performance-marker-trace-pid-tid'&&identity?.processName==='Renderer'&&renderers.length===1&&browsers.length===1;
    return{available,reason:available?null:'cdp-trace-process-authority-mismatch',source:'SystemInfo.getProcessInfo',processes,pid:identity?.pid??null,browserPid:identity?.browserPid??null,threadId:identity?.tid??null,markerIds:pageRenderer?.markerIds??[]};
  }catch(error){return{available:false,reason:'system-info-process-metadata-unavailable',source:'SystemInfo.getProcessInfo',error:error.message};}
}

export function hasChromiumThreadAuthority(traceIdentity,candidate){
  const authority=candidate?.chromiumAuthority;
  return authority?.available===true&&authority.source==='SystemInfo.getProcessInfo'&&authority.pid===traceIdentity?.pid&&authority.threadId===traceIdentity?.tid&&authority.browserPid===traceIdentity?.browserPid&&authority.markerIds?.length>0&&authority.processes?.filter(row=>row.id===authority.pid&&row.type==='renderer').length===1&&authority.processes?.filter(row=>row.id===authority.browserPid&&row.type==='browser').length===1&&candidate.ancestryVerified===true;
}

/** Bounded CDP requests; pending operations are rejected when the transport closes. */
export async function connectBrowserProcessMetadata(url){
  const socket=new WebSocket(url),pending=new Map();let sequence=0;
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('browser-cdp-connect-timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);fail(Error('browser-cdp-connect-failed'));},{once:true});});
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data),task=pending.get(message.id);if(!task)return;pending.delete(message.id);clearTimeout(task.timer);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);});
  const close=()=>{for(const task of pending.values()){clearTimeout(task.timer);task.reject(Error('browser-cdp-closed'));}pending.clear();socket.close();};
  socket.addEventListener('close',()=>{for(const task of pending.values()){clearTimeout(task.timer);task.reject(Error('browser-cdp-closed'));}pending.clear();});
  return{close,send:(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('browser-cdp-request-timeout'));},5000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));})};
}
