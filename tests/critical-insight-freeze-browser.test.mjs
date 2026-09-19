import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=normalize(join(root,relative));
    if(!file.startsWith(root)){res.writeHead(403).end();return;}
    let body=await readFile(file);
    if(relative==='src/veil/ui.js'){
      let source=body.toString('utf8');
      source=source.replace('function handleInsight(event){',"function handleInsight(event){if(event?.type==='insightReady'&&event.critical)globalThis.__criticalInsightFreezeReadyEvents=(globalThis.__criticalInsightFreezeReadyEvents??0)+1;");
      source=source.replace('function frame(now){',"function frame(now){globalThis.__criticalInsightFreezeRun=run;globalThis.__criticalInsightFreezeResources=resources;globalThis.__criticalInsightFreezeKeys=keys;");
      body=Buffer.from(source);
    }
    res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch{res.writeHead(404).end('not found');}
});
await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
const {port}=server.address(),origin=`http://127.0.0.1:${port}`;
const candidates=['google-chrome','chromium','chromium-browser'];let chrome='';
for(const command of candidates){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'A Chromium browser is required for Critical Insight browser regression');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-critical-browser-')),debugPort=9224;
let child=null,socket=null;
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);
  let tabs=null;for(let attempt=0;attempt<160;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await new Promise(resolveWait=>setTimeout(resolveWait,100));}
  assert.ok(tabs?.length,`Chromium DevTools endpoint did not become ready: ${stderr.slice(-1000)}`);
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((resolveOpen,reject)=>{const timer=setTimeout(()=>reject(new Error('DevTools websocket open timed out')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);resolveOpen();},{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map(),exceptions=[];
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);return;}if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails);});
  const send=(method,params={})=>new Promise((resolveSend,reject)=>{const id=++sequence;pending.set(id,{resolve:resolveSend,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  const waitFor=async(expression,message,attempts=120)=>{for(let attempt=0;attempt<attempts;attempt++){try{if(await evaluate(expression))return true;}catch{}await new Promise(resolveWait=>setTimeout(resolveWait,100));}throw new Error(message);};
  const canvasHash=`(()=>{const canvas=document.querySelector('#veil-canvas');if(!canvas||!canvas.width)return 0;const s=canvas.toDataURL();let h=2166136261;for(let i=0;i<s.length;i+=17)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;})()`;

  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:`${origin}/`});
  await waitFor(`document.querySelector('#open-collection')?.textContent?.includes('0/136')`,'Application did not initialize');
  const seeded=await evaluate(`(async()=>{const {createResources}=await import('/src/veil/resources.js');const records=await fetch('/data/molecules.json').then(r=>r.json());const r=createResources({storage:localStorage});r.setCatalog(records);r.state.progress.choCompleted=true;r.state.progress.regions=['veil','carbon','oxygen','frontier'];r.state.progress.checkpoint='frontier';r.state.progress.foundElements=['H','C','O'];r.state.recipes=['hydrogen','methane','oxygen','water'];Object.assign(r.state.elements,{H:1000,C:1000,O:1000,N:0});return r.save();})()`);assert.equal(seeded,true,'post-CHO browser fixture must persist');
  await send('Page.reload',{ignoreCache:true});
  await waitFor(`!!document.querySelector('#collector-launch-handle')&&!document.querySelector('#open-supply')?.disabled`,'LOADOUT UI did not become ready');await evaluate(`(()=>{document.querySelector('#open-supply').click();document.querySelector('#collector-launch-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true;})()`);await waitFor(`document.querySelector('#expedition-destinations')?.getAttribute('aria-hidden')==='false'&&!!document.querySelector('#expedition-destinations [data-region=\"nitrogen\"]')`,'Nitrogen destination unavailable');
  const requested=await evaluate(`(()=>{const button=document.querySelector('#expedition-destinations [data-region=\"nitrogen\"]');button.click();return button.dataset.region;})()`);assert.equal(requested,'nitrogen');
  await waitFor(`document.querySelector('#veil-view')?.hidden===false&&!!globalThis.__criticalInsightFreezeRun`,'Nitrogen FIELD did not launch');
  exceptions.length=0;
  const armed=await evaluate(`(()=>{const run=globalThis.__criticalInsightFreezeRun,signal=run.map.signals.find(item=>item.region==='nitrogen');if(!signal)return false;run.predators=false;run.region='nitrogen';run.time=Math.max(run.time,20);run.insightEngagementOrigin={x:signal.x,y:signal.y+1400};run.insightEngagementMaxDistance=1400;run.insightEngagementSatisfied=true;run.collectedElements.N=1;if(!run.foundElements.includes('N'))run.foundElements.push('N');Object.assign(run.player,{x:signal.x,y:signal.y,angle:0,vx:0,vy:0,speed:run.config.driftSpeed});signal.ready=false;signal.claimable=false;globalThis.__criticalInsightFreezeReadyEvents=0;return true;})()`);assert.equal(armed,true,'Critical Insight signal fixture must arm');
  await waitFor(`globalThis.__criticalInsightFreezeRun?.carriedInsights?.includes('nitrogen')===true`,'Critical Insight was not acquired',80);
  const before=await evaluate(`(()=>{const run=globalThis.__criticalInsightFreezeRun,signal=run.map.signals.find(item=>item.region==='nitrogen');return {time:run.time,x:run.player.x,y:run.player.y,events:globalThis.__criticalInsightFreezeReadyEvents,ready:signal.ready,claimable:signal.claimable,carried:[...run.carriedInsights],hash:${canvasHash}};})()`);
  assert.equal(before.events,1,'Critical Insight presentation must fire exactly once at pickup');assert.equal(before.ready,true);assert.equal(before.claimable,false);assert.deepEqual(before.carried,['nitrogen']);

  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'d',code:'KeyD',windowsVirtualKeyCode:68,nativeVirtualKeyCode:68});
  await waitFor(`globalThis.__criticalInsightFreezeKeys?.has('d')===true`,'production FIELD input did not receive keyboard keydown',20);
  await new Promise(resolveWait=>setTimeout(resolveWait,1200));
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'d',code:'KeyD',windowsVirtualKeyCode:68,nativeVirtualKeyCode:68});
  await new Promise(resolveWait=>setTimeout(resolveWait,250));
  const after=await evaluate(`(()=>{const run=globalThis.__criticalInsightFreezeRun,signal=run.map.signals.find(item=>item.region==='nitrogen');return {time:run.time,x:run.player.x,y:run.player.y,events:globalThis.__criticalInsightFreezeReadyEvents,ready:signal.ready,claimable:signal.claimable,carried:[...run.carriedInsights],hidden:document.querySelector('#veil-view').hidden,hash:${canvasHash}};})()`);
  assert.equal(after.events,1,'remaining in the pickup area across browser frames must not retrigger Critical Insight');assert.equal(after.ready,true);assert.equal(after.claimable,false);assert.deepEqual(after.carried,['nitrogen']);assert.equal(after.hidden,false,'FIELD remains active after Critical pickup');
  assert.ok(after.time>before.time+.9,`simulation time must continue (${before.time} -> ${after.time})`);assert.ok(after.x>before.x+12,`keyboard movement must continue (${before.x} -> ${after.x})`);assert.notEqual(after.hash,before.hash,'renderer output must continue changing after Critical pickup');
  assert.equal(exceptions.length,0,`Critical pickup and continuation must not throw: ${JSON.stringify(exceptions)}`);
}finally{
  try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await new Promise(resolveWait=>setTimeout(resolveWait,100));server.close();await rm(profile,{recursive:true,force:true});
}
console.log('Critical Insight Chromium regression passed: production FIELD launch, one-shot Critical pickup, renderer/simulation continuation and real keyboard movement remain live.');
