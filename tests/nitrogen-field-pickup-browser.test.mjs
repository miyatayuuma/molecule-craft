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
      source=source.replace('function frame(now){',"function frame(now){globalThis.__nitrogenPickupRun=run;globalThis.__nitrogenPickupResources=resources;globalThis.__nitrogenPickupRenderer=renderer;");
      body=Buffer.from(source);
    }
    res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch{res.writeHead(404).end('not found');}
});
await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
const {port}=server.address(),origin=`http://127.0.0.1:${port}`;
const candidates=['google-chrome','chromium','chromium-browser'];let chrome='';
for(const command of candidates){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'A Chromium browser is required for Nitrogen pickup regression');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-nitrogen-pickup-browser-')),debugPort=9225;
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

  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:`${origin}/`});
  await waitFor(`document.querySelector('#open-collection')?.textContent?.includes('0/129')`,'Application did not initialize');
  const seeded=await evaluate(`(async()=>{const {createResources}=await import('/src/veil/resources.js');const records=await fetch('/data/molecules.json').then(r=>r.json());const r=createResources({storage:localStorage});r.setCatalog(records);r.state.progress.choCompleted=true;r.state.progress.regions=['veil','carbon','oxygen','frontier'];r.state.progress.checkpoint='frontier';r.state.progress.foundElements=['H','C','O'];r.state.recipes=['hydrogen','methane','oxygen','water'];Object.assign(r.state.elements,{H:1000,C:1000,O:1000,N:0});return r.save();})()`);assert.equal(seeded,true,'post-CHO browser fixture must persist');
  await send('Page.reload',{ignoreCache:true});
  await waitFor(`document.querySelector('#expedition-anchor')?.querySelector('option[value="nitrogen"]')!==null`,'Nitrogen destination did not become available');
  const requested=await evaluate(`(()=>{const select=document.querySelector('#expedition-anchor');select.value='nitrogen';select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#launch-veil').click();return select.value;})()`);assert.equal(requested,'nitrogen');
  await waitFor(`document.querySelector('#veil-view')?.hidden===false&&!!globalThis.__nitrogenPickupRun`,'Nitrogen FIELD did not launch');
  exceptions.length=0;

  const mapState=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,n=run.map.dust.filter(d=>d.element==='N'),main=n.filter(d=>d.route==='nitrogen-main'),pocket=n.filter(d=>d.route==='nitrogen-high-density');return {n:n.length,main:main.length,pocket:pocket.length,route:run.map.routes.some(r=>r.id==='nitrogen-main'),signal:run.map.signals.some(s=>s.region==='nitrogen'),boundsTop:run.config.bounds.top};})()`);
  assert.ok(mapState.n>0,'production active run must contain N dust');assert.ok(mapState.main>0,'Nitrogen mainline must contain N dust');assert.ok(mapState.pocket>0,'fresh stock must expose the optional N pocket');assert.equal(mapState.route,true);assert.equal(mapState.signal,true);assert.ok(mapState.boundsTop<-12750,'post-CHO flight bounds must include Nitrogen FIELD');

  const armedPickup=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,dust=run.map.dust.find(d=>d.element==='N'&&d.route==='nitrogen-main');if(!dust)return false;run.predators=false;globalThis.__nitrogenPickupDustId=dust.id;globalThis.__nitrogenPickupUnitsBefore=run.elementDust.N;Object.assign(run.player,{x:dust.x,y:dust.y,angle:dust.angle,vx:0,vy:0,speed:0});return true;})()`);assert.equal(armedPickup,true,'N pickup fixture must find mainline dust');
  await waitFor(`globalThis.__nitrogenPickupRun?.elementDust?.N>globalThis.__nitrogenPickupUnitsBefore`,'N dust overlap did not enter run-local cargo',80);
  const pickup=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,dust=run.map.dust.find(d=>d.id===globalThis.__nitrogenPickupDustId);return {atoms:run.collectedElements.N,units:run.elementDust.N,foundRun:run.foundElements.includes('N'),foundPersistent:globalThis.__nitrogenPickupResources.state.progress.foundElements.includes('N'),consumed:dust.ready>run.time,hud:document.querySelector('#veil-minerals')?.textContent??'',canvasReady:document.querySelector('#veil-canvas')?.width>0};})()`);
  assert.ok(pickup.atoms>0&&pickup.units>0,'N pickup must increase run cargo');assert.equal(pickup.foundRun,true);assert.equal(pickup.foundPersistent,true,'first N pickup must connect to canonical element discovery');assert.equal(pickup.consumed,true,'picked N dust must be consumed until respawn');assert.match(pickup.hud,/N\s+[1-9]/,'FIELD HUD must show collected N');assert.equal(pickup.canvasReady,true,'production FIELD canvas must remain active while N dust is collected');

  const engaged=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,signal=run.map.signals.find(s=>s.region==='nitrogen');if(!signal)return false;run.time=Math.max(run.time,20);run.insightEngagementOrigin={x:signal.x,y:signal.y+1400};run.insightEngagementMaxDistance=1400;run.insightEngagementSatisfied=true;return true;})()`);assert.equal(engaged,true);
  await waitFor(`globalThis.__nitrogenPickupRun?.map?.signals?.find(s=>s.region==='nitrogen')?.claimable===true`,'actual current-run N pickup did not make the N2 marker claimable after engagement',80);
  const marker=await evaluate(`(()=>{const s=globalThis.__nitrogenPickupRun.map.signals.find(s=>s.region==='nitrogen');return {claimable:s.claimable,ready:s.ready};})()`);assert.deepEqual(marker,{claimable:true,ready:false});

  const cargoBeforeReturn=await evaluate(`globalThis.__nitrogenPickupRun.elementDust.N`);assert.ok(cargoBeforeReturn>0);
  await evaluate(`document.querySelector('#veil-return').click()`);
  await waitFor(`document.querySelector('#veil-view')?.hidden===true`,'normal Nitrogen return did not finish',120);
  const returned=await evaluate(`(()=>{const saved=JSON.parse(localStorage.getItem('molecule-craft.resources.v1'));return {stock:saved.elements.N,found:saved.progress.foundElements.includes('N'),summary:document.querySelector('#craft-last-run')?.textContent??''};})()`);
  assert.equal(returned.stock,cargoBeforeReturn,'normal return must settle all run-local N cargo into BASE STOCK');assert.equal(returned.found,true);assert.match(returned.summary,/N \+[1-9]/,'return summary must expose settled N');
  assert.equal(exceptions.length,0,`Nitrogen pickup/return browser flow must not throw: ${JSON.stringify(exceptions)}`);
}finally{
  try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await new Promise(resolveWait=>setTimeout(resolveWait,100));server.close();await rm(profile,{recursive:true,force:true});
}
console.log('Nitrogen Chromium regression passed: production launch contains visible FIELD canvas/N dust, overlap collects N into run cargo, N2 marker becomes claimable, and normal return settles N into BASE STOCK.');
