import {spawn} from 'node:child_process';
import {mkdtemp, writeFile, readFile, lstat, realpath, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

async function within(promise,ms){
  let timer;
  try{return await Promise.race([promise.then(()=>true),new Promise(done=>{timer=setTimeout(()=>done(false),ms);})]);}
  finally{clearTimeout(timer);}
}
const errorRecord=error=>({name:error?.name??typeof error,message:error?.message??String(error),code:error?.code,stack:error?.stack});

// Test-only lease: a browser and its private profile are created and destroyed
// together. No caller-provided directory is adopted or recursively removed.
export async function createBrowserLifecycle({name,report=record=>console.log('BROWSER_TEST_LIFECYCLE',JSON.stringify(record)),removeProfile=rm,exitTimeoutMs=2000}={}){
  if(!/^[a-z0-9-]+$/.test(name??''))throw new Error('A browser lifecycle name is required');
  const profile=await mkdtemp(join(tmpdir(),`molecule-craft-${name}-`));
  const token=randomUUID(),marker=join(profile,'.test-profile-owner');
  await writeFile(marker,token,{flag:'wx'});
  let child=null,closed=false,closeResult=null,closePromise=null,used=false,running=false;
  const processGroup=process.platform!=='win32';
  const emit=record=>report({name,profile,pid:child?.pid??null,...record});

  function launch(command,args,options={}){
    if(child||!running)throw new Error('Launch exactly one child inside the browser lifecycle body');
    const profileArgs=args.filter(value=>value.startsWith('--user-data-dir='));
    if(profileArgs.length!==1||profileArgs[0]!==`--user-data-dir=${profile}`)throw new Error('Browser profile does not match its lifecycle lease');
    child=spawn(command,args,{...options,detached:processGroup});
    closePromise=new Promise(done=>{
      let spawnError=null;
      child.once('error',error=>{spawnError=errorRecord(error);});
      child.once('close',(code,signal)=>{closed=true;closeResult={code,signal,spawnError};done(closeResult);});
    });
    return child;
  }

  async function stopBrowser(){
    if(!child)return {notStarted:true};
    const signal=kind=>{
      try{
        if(processGroup&&child.pid)process.kill(-child.pid,kind);
        else if(!closed)child.kill(kind);
      }catch(error){if(error.code!=='ESRCH')throw error;}
    };
    // Signal the owned group, including browser subprocesses which may still
    // write Cache_Data after the root has exited. Never kill by executable name.
    signal('SIGTERM');
    let forced=false;
    if(!closed)await within(closePromise,exitTimeoutMs);
    if(!closed){forced=true;signal('SIGKILL');await within(closePromise,exitTimeoutMs);}
    if(!closed)throw new Error('Owned browser did not close; profile retained');
    if(processGroup)signal('SIGKILL');
    return {...closeResult,forced};
  }

  async function deleteProfile(){
    const stat=await lstat(profile);
    if(!stat.isDirectory()||stat.isSymbolicLink()||await realpath(profile)!==resolve(profile)||await readFile(marker,'utf8')!==token)throw new Error('Browser profile ownership changed; refusing removal');
    // Bounded retries cover filesystem teardown after the owned process group
    // has been stopped. Exhaustion is a cleanup FAILURE, never a test PASS.
    await removeProfile(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100});
  }

  async function run(body,{socket=()=>null,server=null}={}){
    if(used)throw new Error('Browser lifecycle has already run');
    used=true;running=true;
    let primaryError,bodyFailed=false;
    try{await body();}catch(error){primaryError=error;bodyFailed=true;}
    running=false;
    // Persist body status before any fallible teardown. In CI stdout is retained
    // even when cleanup subsequently fails and no final success marker appears.
    const cleanupErrors=[];
    try{emit({phase:'body',status:bodyFailed?'FAIL':'PASS',error:bodyFailed?errorRecord(primaryError):null});}catch(error){cleanupErrors.push(error);}
    try{socket()?.close();}catch(error){cleanupErrors.push(error);}
    let browserStopped=false,processResult=null;
    try{processResult=await stopBrowser();browserStopped=true;}catch(error){cleanupErrors.push(error);}
    if(server)try{
      const didClose=await within(new Promise((done,fail)=>{server.close(error=>error?fail(error):done());server.closeAllConnections?.();}),exitTimeoutMs);
      if(!didClose)throw new Error('Browser test server did not close');
    }catch(error){cleanupErrors.push(error);}
    if(browserStopped)try{await deleteProfile();}catch(error){cleanupErrors.push(error);}
    try{emit({phase:'cleanup',status:cleanupErrors.length?'FAIL':'PASS',process:processResult,errors:cleanupErrors.map(errorRecord)});}catch(error){cleanupErrors.push(error);}
    if(bodyFailed&&cleanupErrors.length)throw new AggregateError([primaryError,...cleanupErrors],'Browser test body and cleanup both failed',{cause:primaryError});
    if(bodyFailed)throw primaryError;
    if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Browser test cleanup failed');
  }
  return {profile,launch,run};
}
