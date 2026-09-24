import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {NITROGEN_HIGH_DENSITY_POCKET} from '../src/veil/nitrogen-routes.js';

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
      source=source.replace('const completed=run,result=',"const completed=run;globalThis.__nitrogenReturnedCargo=completed.elementDust.N;const result=");
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
  await waitFor(`document.querySelector('#open-collection')?.textContent?.includes('0/142')`,'Application did not initialize');
  const seeded=await evaluate(`(async()=>{const {createResources}=await import('/src/veil/resources.js');const records=await fetch('/data/molecules.json').then(r=>r.json());const r=createResources({storage:localStorage});r.setCatalog(records);r.state.progress.choCompleted=true;r.state.progress.regions=['veil','carbon','oxygen','frontier'];r.state.progress.checkpoint='frontier';r.state.progress.foundElements=['H','C','O'];r.state.recipes=['hydrogen','methane','oxygen','water'];Object.assign(r.state.elements,{H:1000,C:1000,O:1000,N:0});return r.save();})()`);assert.equal(seeded,true,'post-CHO browser fixture must persist');
  await send('Page.reload',{ignoreCache:true});
  await waitFor(`!!document.querySelector('#collector-launch-handle')&&!document.querySelector('#open-supply')?.disabled`,'LOADOUT UI did not become ready');await evaluate(`(()=>{document.querySelector('#open-supply').click();document.querySelector('#collector-launch-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true;})()`);await waitFor(`document.querySelector('#expedition-destinations')?.getAttribute('aria-hidden')==='false'&&!!document.querySelector('#expedition-destinations [data-region=\"nitrogen\"]')`,'Nitrogen destination unavailable');
  const requested=await evaluate(`(()=>{const button=document.querySelector('#expedition-destinations [data-region=\"nitrogen\"]');button.click();return button.dataset.region;})()`);assert.equal(requested,'nitrogen');
  await waitFor(`document.querySelector('#veil-view')?.hidden===false&&!!globalThis.__nitrogenPickupRun`,'Nitrogen FIELD did not launch');
  exceptions.length=0;

  const mapState=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,n=run.map.dust.filter(d=>d.element==='N'),main=n.filter(d=>d.route==='nitrogen-main'),pocket=n.filter(d=>d.route==='${NITROGEN_HIGH_DENSITY_POCKET.id}');return {n:n.length,main:main.length,pocket:pocket.length,route:run.map.routes.some(r=>r.id==='nitrogen-main'),signal:run.map.signals.some(s=>s.region==='nitrogen'),boundsTop:run.config.bounds.top};})()`);
  assert.ok(mapState.n>0,'production active run must contain N dust');assert.ok(mapState.main>0,'Nitrogen mainline must contain N dust');assert.ok(mapState.pocket>0,'fresh stock must expose the optional N pocket');assert.equal(mapState.route,true);assert.equal(mapState.signal,true);assert.ok(mapState.boundsTop<-12750,'post-CHO flight bounds must include Nitrogen FIELD');

  const visualPair=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,n=run.map.dust.find(d=>d.element==='N'&&d.route==='nitrogen-main');if(!n)return null;const id=Math.max(...run.map.dust.map(d=>d.id))+1000,h={...n,id,x:n.x+90,baseX:n.x+90,element:'H',kind:'normal',route:'test-h-visual'};run.map.dust.push(h);run.predators=false;Object.assign(run.player,{x:n.x,y:n.y+150,angle:n.angle,vx:0,vy:0,speed:0});globalThis.__nitrogenVisualH=id;return {n:n.id,h:id};})()`);assert.ok(visualPair,'visual regression requires an authored N dust sample');
  const visualColors=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,renderer=globalThis.__nitrogenPickupRenderer,canvas=document.querySelector('#veil-canvas'),ctx=canvas.getContext('2d');renderer.reset();renderer.draw(run,0,false);const rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height,sample=id=>{const d=run.map.dust.find(item=>item.id===id),q=renderer.screen(d.x,d.y),cx=Math.round(q.x*sx),cy=Math.round(q.y*sy),radius=Math.max(3,Math.round(6*Math.max(sx,sy))),left=Math.max(0,cx-radius),top=Math.max(0,cy-radius),right=Math.min(canvas.width,cx+radius+1),bottom=Math.min(canvas.height,cy+radius+1),pixels=ctx.getImageData(left,top,Math.max(1,right-left),Math.max(1,bottom-top)).data;let best=[0,0,0],score=-1;for(let i=0;i<pixels.length;i+=4){const next=pixels[i]+pixels[i+1]+pixels[i+2];if(pixels[i+3]>0&&next>score){score=next;best=[pixels[i],pixels[i+1],pixels[i+2]];}}return best;};return {n:sample(${visualPair.n}),h:sample(${visualPair.h})};})()`);
  const visualDistance=Math.hypot(...visualColors.n.map((value,index)=>value-visualColors.h[index]));assert.ok(visualDistance>50,`N and H dust must be visually distinguishable in the production canvas: ${JSON.stringify(visualColors)}`);
  await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun;run.map.dust=run.map.dust.filter(d=>d.id!==globalThis.__nitrogenVisualH);delete globalThis.__nitrogenVisualH;})()`);

  const armedPickup=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,dust=run.map.dust.find(d=>d.element==='N'&&d.route==='nitrogen-main');if(!dust)return false;run.predators=false;globalThis.__nitrogenPickupDustId=dust.id;globalThis.__nitrogenPickupUnitsBefore=run.elementDust.N;Object.assign(run.player,{x:dust.x,y:dust.y,angle:dust.angle,vx:0,vy:0,speed:0});return true;})()`);assert.equal(armedPickup,true,'N pickup fixture must find mainline dust');
  await waitFor(`globalThis.__nitrogenPickupRun?.elementDust?.N>globalThis.__nitrogenPickupUnitsBefore&&/N\\s+[1-9]/.test(document.querySelector('#veil-minerals')?.textContent??'')`,'N dust overlap did not enter run-local cargo and refresh the FIELD HUD',80);
  const pickup=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,dust=run.map.dust.find(d=>d.id===globalThis.__nitrogenPickupDustId);return {atoms:run.collectedElements.N,units:run.elementDust.N,foundRun:run.foundElements.includes('N'),foundPersistent:globalThis.__nitrogenPickupResources.state.progress.foundElements.includes('N'),consumed:dust.ready>run.time,hud:document.querySelector('#veil-minerals')?.textContent??'',canvasReady:document.querySelector('#veil-canvas')?.width>0};})()`);
  assert.ok(pickup.atoms>0&&pickup.units>0,'N pickup must increase run cargo');assert.equal(pickup.foundRun,true);assert.equal(pickup.foundPersistent,true,'first N pickup must connect to canonical element discovery');assert.equal(pickup.consumed,true,'picked N dust must be consumed until respawn');assert.match(pickup.hud,/N\s+[1-9]/,'FIELD HUD must show collected N');assert.equal(pickup.canvasReady,true,'production FIELD canvas must remain active while N dust is collected');

  const engaged=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,signal=run.map.signals.find(s=>s.nitrogenCritical===true);if(!signal)return false;run.time=Math.max(run.time,20);run.insightEngagementOrigin={x:signal.x,y:signal.y+1400};run.insightEngagementMaxDistance=1400;run.insightEngagementSatisfied=true;return true;})()`);assert.equal(engaged,true);
  await waitFor(`globalThis.__nitrogenPickupRun?.carriedInsights?.includes('nitrogen')||globalThis.__nitrogenPickupRun?.map?.signals?.some(s=>s.nitrogenCritical===true&&s.claimable===true)`,'actual current-run N pickup did not make the N2 Critical opportunity available after engagement',80);
  const marker=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,s=run.map.signals.find(s=>s.nitrogenCritical===true&&s.claimable===true);return {claimable:s?.claimable??false,ready:s?.ready??false,carried:run.carriedInsights.includes('nitrogen')};})()`);assert.ok(marker.carried||marker.claimable,'N2 must become claimable or be acquired through the engaged Critical signal');if(!marker.carried)assert.deepEqual(marker,{claimable:true,ready:false,carried:false});
  // The browser fixture accepts either the deferred marker or immediate Critical
  // acquisition; clear the carried presentation so the following Safe Site
  // assertion isolates N cargo settlement rather than return-mode gating.
  await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun;if(run.carriedInsights.includes('nitrogen'))run.carriedInsights.length=0;return true;})()`);

  const cargoBeforeReturn=await evaluate(`globalThis.__nitrogenPickupRun.elementDust.N`);assert.ok(cargoBeforeReturn>0);
  await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,renderer=globalThis.__nitrogenPickupRenderer,site=run.map.safeExtractionSites.find(site=>site.id==='nitrogen-side-recovery-extraction');Object.assign(run.player,{x:site.x,y:site.y,vx:0,vy:0,speed:0,boost:0,combustion:false});run.driveHeld=false;renderer.reset();})()`);await waitFor(`document.querySelector('#veil-status-panel')?.dataset.state==='site-ready'`,'Nitrogen pickup Safe Site did not become ready');await evaluate(`(()=>{const canvas=document.querySelector('#veil-canvas'),renderer=globalThis.__nitrogenPickupRenderer,run=globalThis.__nitrogenPickupRun,rect=canvas.getBoundingClientRect(),screen=renderer.screen(run.player.x,run.player.y),point={bubbles:true,pointerId:9,pointerType:'touch',button:0,clientX:rect.left+screen.x,clientY:rect.top+screen.y};canvas.dispatchEvent(new PointerEvent('pointerdown',point));canvas.dispatchEvent(new PointerEvent('pointerup',point));})()`);await waitFor(`document.querySelector('#veil-view')?.hidden===true`,'Nitrogen pickup Safe Site extraction did not complete',160);
  await waitFor(`document.querySelector('#veil-view')?.hidden===true`,'Safe Site Nitrogen extraction did not finish',120);
  const returned=await evaluate(`(()=>{const saved=JSON.parse(localStorage.getItem('molecule-craft.resources.v1'));return {stock:saved.elements.N,cargo:globalThis.__nitrogenReturnedCargo,found:saved.progress.foundElements.includes('N'),summary:document.querySelector('#craft-last-run')?.textContent??''};})()`);
  assert.ok(returned.cargo>=cargoBeforeReturn,'Safe Site extraction cannot lose already collected N cargo');assert.equal(returned.stock,returned.cargo,'normal return must settle the final run-local N cargo into BASE STOCK');assert.equal(returned.found,true);assert.match(returned.summary,/N \+[1-9]/,'return summary must expose settled N');
  await waitFor(`(()=>{const button=document.querySelector('#element-palette [data-element="N"]'),stock=document.querySelector('[data-element-stock="N"]');return button&&!button.hidden&&!button.disabled&&Number(stock?.textContent)>0;})()`,'CRAFT N atom did not become available after returning with discovered N',80);
  const craftN=await evaluate(`(()=>{const button=document.querySelector('#element-palette [data-element="N"]'),stock=document.querySelector('[data-element-stock="N"]'),extra=document.querySelector('#show-extra-elements');return {hidden:button.hidden,disabled:button.disabled,stock:Number(stock.textContent),extraChecked:extra.checked};})()`);assert.equal(craftN.hidden,false);assert.equal(craftN.disabled,false);assert.equal(craftN.stock,returned.stock);assert.equal(craftN.extraChecked,false,'N must be a normal progression element, not dependent on the optional extra-elements toggle');

  assert.equal(exceptions.length,0,`Nitrogen pickup/return browser flow must not throw: ${JSON.stringify(exceptions)}`);
}finally{
  try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await new Promise(resolveWait=>setTimeout(resolveWait,100));server.close();await rm(profile,{recursive:true,force:true});
}
console.log('Nitrogen Chromium regression passed: production launch contains visible FIELD canvas/N dust, overlap collects N into run cargo, N2 marker becomes claimable, and normal return settles final N cargo into BASE STOCK.');
await import('./legacy-frontier-browser.test.mjs');
