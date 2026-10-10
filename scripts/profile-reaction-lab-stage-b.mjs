import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {dirname,extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(process.env.POLYMER_ROOT??fileURLToPath(new URL('..',import.meta.url))),viewport={width:390,height:844,deviceScaleFactor:1,mobile:true};
const output=resolve(process.env.STAGE_B_PROFILE_OUTPUT??join(root,'test-results/stage-b-profile.json')),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(request,response)=>{
  try{const path=new URL(request.url,'http://localhost').pathname==='/'?'index.html':decodeURIComponent(new URL(request.url,'http://localhost').pathname).replace(/^\/+/,''),file=normalize(join(root,path));if(!file.startsWith(root))throw Error();response.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});response.end(await readFile(file));}
  catch{response.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const {port}=server.address();
let chrome=process.env.CHROMIUM_PATH??'';if(!chrome)for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'Chromium is required for the Stage B performance profile');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-stage-b-')),debugPort=Number(process.env.STAGE_B_DEBUG_PORT??9277);let child=null,socket=null;
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:'ignore'});
  let tabs=null;for(let attempt=0;attempt<180;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await pause(100);}assert.ok(tabs?.length,'Chromium DevTools endpoint did not become ready');
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map(),browserErrors=[];socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text);if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')browserErrors.push(message.params.args?.map(arg=>arg.value??arg.description??'').join(' '));});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  const waitFor=async(expression,label,timeout=12000)=>{for(let attempt=0;attempt<timeout/50;attempt++){if(await evaluate(expression))return;await pause(50);}throw Error(label);};
  const snapshot=()=>evaluate('window.__reactionLabProbe.snapshot()'),browser=await send('Browser.getVersion');
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',viewport);
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/?reactionLabTest=1&reactionLabPhysics=stage-b`});
  await waitFor("!!window.__reactionLabProbe&&window.__reactionLabProbe.physicsMode==='stage-b'&&!!document.querySelector('#open-reaction-lab')&&!document.querySelector('#open-reaction-lab').disabled",'Stage B Reaction Lab probe did not initialize');
  await evaluate("document.querySelector('#open-reaction-lab').click()");await waitFor("document.querySelector('#reaction-lab-dialog').open",'Stage B Reaction Lab did not open');
  for(let index=0;index<3;index++){
    const state=await snapshot(),current=state.batch.draftSlots[index]??'',next=['methane','oxygen','2-butene'][index];if(current===next)continue;
    await evaluate(`document.querySelectorAll('[data-lab-slot]')[${index}].click()`);await waitFor("!document.querySelector('[data-lab-picker]').hidden",'Species picker did not open');
    await evaluate(`(()=>{const input=document.querySelector('[data-lab-search]');input.value=${JSON.stringify(next)};input.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
    await waitFor(`!!document.querySelector('[data-lab-picker-list] [data-species=${JSON.stringify(next)}]')&&!document.querySelector('[data-lab-picker-list] [data-species=${JSON.stringify(next)}]').hidden`,`${next} did not appear in the filtered species picker`);
    const option=await evaluate(`(()=>{const item=document.querySelector('[data-lab-picker-list] [data-species=${JSON.stringify(next)}]');return{exists:!!item,disabled:item?.disabled??null,hidden:item?.hidden??null}})()`);assert.equal(option.disabled,false,`${next} must remain selectable in the Stage B fixture`);
    await evaluate(`document.querySelector('[data-lab-picker-list] [data-species=${JSON.stringify(next)}]').click()`);await waitFor("document.querySelector('[data-lab-picker]').hidden",'Species picker did not close');
  }
  await waitFor("!document.querySelector('[data-lab-feed]').disabled",'FEED did not become available');await evaluate("document.querySelector('[data-lab-feed]').click()");
  await waitFor("(()=>{const s=window.__reactionLabProbe.snapshot();return s.batch.phase==='ACTIVE'&&s.instances.length===6&&['methane','oxygen','2-butene'].every(id=>s.instances.some(item=>item.species===id))})()",'Six-instance Stage B workload did not become active');
  const initial=await snapshot();assert.equal(initial.instances.length,6);const poses=initial.instances.map((item,index)=>({id:item.id,positionAngstrom:[index*25,0,0],orientation:[0,0,0,1],velocityAngstromPerPs:[0,0,0],angularVelocityRadPerPs:[0,0,0]}));
  const setFixture=async()=>{await evaluate(`window.__reactionLabProbe.setGeometry(${JSON.stringify(poses)})`);await evaluate('window.__reactionLabProbe.setSimulationClock(0)');};
  const measure=async(label)=>{await setFixture();const result=await evaluate('window.__reactionLabProbe.measureFixedSteps(180)'),durations=result.durationsMs.slice(30);assert.equal(durations.length,150);assert.ok(result.candidateCount>=384,`The full 29-rule matcher workload fell below 384 candidates: ${result.candidateCount}`);const ordered=[...durations].sort((a,b)=>a-b),p=(fraction)=>ordered[Math.ceil(ordered.length*fraction)-1];return{label,candidateCount:result.candidateCount,reactionIds:result.reactionIds,stepCount:durations.length,p50Ms:p(.5),p95Ms:p(.95),p99Ms:p(.99),maximumMs:ordered.at(-1),frameIntervalsMs:durations};};
  const warmup=await measure('warmup'),trials=[];for(let index=1;index<=4;index++)trials.push(await measure(`measured-${index}`));
  assert.deepEqual(browserErrors,[],'Stage B profile has no browser exception or console error');
  const allIntervals=trials.flatMap(trial=>trial.frameIntervalsMs).sort((a,b)=>a-b),percentile=fraction=>allIntervals[Math.ceil(allIntervals.length*fraction)-1];
  const evidence={schemaVersion:1,sourceSha:process.env.POLYMER_SOURCE_SHA??null,label:process.env.STAGE_B_PROFILE_LABEL??'candidate',node:process.version,browser:{product:browser.product,revision:browser.revision,protocolVersion:browser.protocolVersion},viewport,motion:'normal',workload:{instances:6,chemistry:'methane + oxygen + 2-butene',candidateCountPerFixedStep:trials.map(row=>row.candidateCount),assertedMinimumCandidates:384,fullMatcherRules:29},warmup,trials,pooled:{stepCount:allIntervals.length,p50Ms:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),maximumMs:allIntervals.at(-1),frameIntervalsMs:allIntervals},browserErrors};
  await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(evidence,null,2));console.log('REACTION_LAB_STAGE_B_PROFILE',JSON.stringify(evidence));
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await pause(200);server.close();await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100});}
