import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {captureChromiumProcessAuthority} from '../scripts/chromium-renderer-identity.mjs';
import {discoverAuthoritativeRenderer,resolveRendererThreadIdentity,summarizeSchedulerSamples} from '../scripts/stage-b-runner-telemetry.mjs';

const page={available:true,identity:{pid:91,tid:91,browserPid:10,threadName:'CrRendererMain',processName:'Renderer',source:'browser-performance-marker-trace-pid-tid'},markerIds:['unique-page-renderer-identity']};
const processInfo=[{id:10,type:'browser'},{id:91,type:'renderer'},{id:95,type:'renderer'}];
const getAuthority=()=>captureChromiumProcessAuthority(async method=>{assert.equal(method,'SystemInfo.getProcessInfo');return{processInfo};},page);

test('Browser CDP authority requires unique renderer, browser and actual page marker correspondence',async()=>{
  const authority=await getAuthority();assert.equal(authority.available,true);
  assert.equal((await captureChromiumProcessAuthority(null,page)).reason,'browser-cdp-unavailable');
  assert.equal((await captureChromiumProcessAuthority(async()=>{throw Error('not supported on target');},page)).reason,'system-info-process-metadata-unavailable');
  for(const bad of [{...page,available:false},{...page,identity:{...page.identity,pid:99}},{...page,identity:{...page.identity,processName:'GPU Process'}}])assert.equal((await captureChromiumProcessAuthority(async()=>({processInfo}),bad)).available,false);
  assert.equal((await captureChromiumProcessAuthority(async()=>({processInfo:[...processInfo,{id:91,type:'renderer'}]}),page)).available,false);
});

function stat(pid,parent,start){const fields=['R',String(parent),'0','0','0','0','0','0','0','0','0','12','1',...Array(6).fill('0'),String(start)];return `${pid} (chrome) ${fields.join(' ')}`;}
async function procRecord(root,pid,{parent=0,start=100,ids=[pid],namespace='pid:[1]',thread=false,schedstat='1000000 2000000 3'}={}){
  const path=thread?join(root,'191','task',String(pid)):join(root,String(pid));await mkdir(path,{recursive:true});
  await writeFile(join(path,'stat'),stat(pid,parent,start));await writeFile(join(path,'comm'),'chrome\n');
  await writeFile(join(path,'status'),`NSpid:\t${ids.join(' ')}\nvoluntary_ctxt_switches:\t5\nnonvoluntary_ctxt_switches:\t2\n`);
  if(thread){if(schedstat!==null)await writeFile(join(path,'schedstat'),schedstat);}else{await writeFile(join(path,'cmdline'),'/opaque/profile --renderer-client-id=6\0');await mkdir(join(path,'ns'),{recursive:true});await symlink(namespace,join(path,'ns/pid'));}
}
async function fixture(options={}){
  const root=await mkdtemp(join(tmpdir(),'renderer-authority-'));
  await procRecord(root,110,{ids:[110,10]});await procRecord(root,150,{parent:110,ids:[150,50]});
  await procRecord(root,191,{parent:options.parent??150,ids:[191,91],namespace:options.namespace??'pid:[1]'});
  await procRecord(root,191,{thread:true,ids:[191,91],schedstat:options.schedstat===null?null:undefined});
  return root;
}

test('flattened argv and different OS thread name resolve via CDP, trace marker, namespace pair and ancestry',async()=>{
  const root=await fixture();try{
    const traceIdentity={...page.identity,processAuthority:await getAuthority()},result=await discoverAuthoritativeRenderer(110,traceIdentity,{procRoot:root});
    assert.equal(result.available,true);const candidate=result.targets[0];
    assert.equal(candidate.pid,191);assert.equal(candidate.tid,191);assert.equal(candidate.threadName,'chrome');assert.equal(candidate.commandLine.format,'opaque-single-string');
    assert.deepEqual(candidate.ancestry.map(row=>row.pid),[191,150]);
    assert.equal(result.traceIdentityResolution.matchMethod,'trace-pid-tid-namespace-map');
    assert.equal(result.directIdentityEvidence.rawObservedIdentity.after.startTimeTicks,100);
    const nameOnly={...candidate,chromiumAuthority:undefined};
    assert.equal(resolveRendererThreadIdentity({traceIdentity,linuxCandidates:[nameOnly]}).reason,'thread-name-mismatch');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('parent mismatch, namespace mismatch and renderer-client-id alone stay fail closed',async()=>{
  for(const [options,expected] of [[{parent:999},'parent-pid-mismatch'],[{namespace:'pid:[2]'},'pid-namespace-mismatch']]){
    const root=await fixture(options);try{assert.equal((await discoverAuthoritativeRenderer(110,{...page.identity,processAuthority:await getAuthority()},{procRoot:root})).reason,expected);}finally{await rm(root,{recursive:true,force:true});}
  }
  const root=await fixture();try{assert.equal((await discoverAuthoritativeRenderer(110,{...page.identity,processAuthority:{available:false,reason:'system-info-process-metadata-unavailable'}},{procRoot:root})).available,false);}finally{await rm(root,{recursive:true,force:true});}
});

test('CDP may supersede an inferred default but explicit non-renderer argv conflicts fail closed',async()=>{
  const root=await fixture();try{
    const identity={...page.identity,processAuthority:await getAuthority()};
    await writeFile(join(root,'191','cmdline'),'/usr/bin/chrome\0');assert.equal((await discoverAuthoritativeRenderer(110,identity,{procRoot:root})).available,true);
    await writeFile(join(root,'191','cmdline'),'/usr/bin/chrome\0--type=gpu-process\0');assert.equal((await discoverAuthoritativeRenderer(110,identity,{procRoot:root})).reason,'process-type-authority-conflict');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('missing counter remains separate from verified identity; duplicate namespace candidates reject',async()=>{
  const root=await fixture({schedstat:null});try{
    const identity={...page.identity,processAuthority:await getAuthority()},result=await discoverAuthoritativeRenderer(110,identity,{procRoot:root});assert.equal(result.available,true);assert.equal(result.traceIdentityResolution.counterAvailable,false);
    await procRecord(root,192,{parent:150,ids:[192,91]});assert.equal((await discoverAuthoritativeRenderer(110,identity,{procRoot:root})).reason,'multiple-unresolved-candidates');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('all observations must preserve process/thread lifetime and namespace, including invalid middle samples',async()=>{
  const authority=await getAuthority(),identity=page.identity;
  const sample=(at,extra={})=>({readStartHrtimeNs:String(at*1e6),readEndHrtimeNs:String(at*1e6+10000),threads:[{pid:91,tid:91,threadName:'chrome',processType:'renderer',chromiumAuthority:authority,ancestryVerified:true,processStartTimeTicks:100,liveProcessStartTimeTicks:100,startTimeTicks:101,expectedProcessStartTimeTicks:100,expectedThreadStartTimeTicks:101,pidNamespace:'pid:[1]',livePidNamespace:'pid:[1]',expectedParentPid:50,liveParentPid:50,available:true,runTimeNs:at*1e6,runQueueWaitNs:at*2e5,timeslices:at,voluntaryContextSwitches:at,involuntaryContextSwitches:0,...extra}]});
  const summary=rows=>summarizeSchedulerSamples(rows,{available:true,slope:1,offset:0,uncertaintyMs:0},[[0,10]],{targetIdentity:identity,requireTargetIdentity:true});
  const good=summary([sample(1),sample(4),sample(8)]).perStep[0];assert.equal(good.identityStable,true);assert.equal(good.runtimeMs,7);assert.equal(good.runQueueWaitMs,1.4);assert.equal(good.timeslices,7);
  for(const extra of [{liveProcessStartTimeTicks:999},{startTimeTicks:999},{livePidNamespace:'pid:[2]'},{liveParentPid:999},{available:false,reason:'process-exited'}]){
    const bad=summary([sample(1),sample(4,extra),sample(8)]).perStep[0];assert.equal(bad.available,false);assert.equal(bad.runtimeMs,null);
  }
  const failed=summary([sample(1,{available:false,reason:'schedstat-unavailable'}),sample(8,{available:false,reason:'schedstat-unavailable'})]).perStep[0];assert.equal(failed.runtimeMs,null);assert.equal(failed.runQueueWaitMs,null);
  const sparse=summary([sample(1),sample(2)]).perStep[0];assert.equal(sparse.available,false);assert.equal(sparse.reason,'counter-coverage-insufficient');
});
