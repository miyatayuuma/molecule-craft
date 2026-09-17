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
      source=source.replace('function frame(now){',"function frame(now){globalThis.__rareSurveyRun=run;globalThis.__rareSurveyResources=resources;globalThis.__rareSurveyRenderer=renderer;");
      body=Buffer.from(source);
    }
    res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch{res.writeHead(404).end('not found');}
});
await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
const {port}=server.address(),origin=`http://127.0.0.1:${port}`;
let chrome='';for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'A Chromium browser is required for Rare Survey regression');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-rare-survey-browser-')),debugPort=9226;let child=null,socket=null;
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);
  let tabs=null;for(let attempt=0;attempt<160;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await new Promise(resolveWait=>setTimeout(resolveWait,100));}
  assert.ok(tabs?.length,`Chromium DevTools endpoint did not become ready: ${stderr.slice(-1000)}`);
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((resolveOpen,reject)=>{const timer=setTimeout(()=>reject(new Error('DevTools websocket open timed out')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);resolveOpen();},{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map(),exceptions=[];socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);return;}if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails);});
  const send=(method,params={})=>new Promise((resolveSend,reject)=>{const id=++sequence;pending.set(id,{resolve:resolveSend,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  const waitFor=async(expression,message,attempts=120)=>{for(let attempt=0;attempt<attempts;attempt++){try{if(await evaluate(expression))return true;}catch{}await new Promise(resolveWait=>setTimeout(resolveWait,100));}throw new Error(message);};

  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:`${origin}/`});await waitFor(`document.querySelector('#open-collection')?.textContent?.includes('0/135')`,'Application did not initialize');
  const seeded=await evaluate(`(async()=>{const {createResources}=await import('/src/veil/resources.js');const records=await fetch('/data/molecules.json').then(r=>r.json());const r=createResources({storage:localStorage});r.setCatalog(records);r.state.progress.choCompleted=true;r.state.progress.regions=['veil','carbon','oxygen','frontier','nitrogen'];r.state.progress.checkpoint='veil';r.state.progress.foundElements=['H','C','O','N'];r.state.recipes=['hydrogen','methane','oxygen','water','nitrogen','ammonia'];Object.assign(r.state.elements,{H:1000,C:1000,O:1000,N:40,P:0,S:0,F:0,Cl:0});return r.save();})()`);assert.equal(seeded,true);
  await send('Page.reload',{ignoreCache:true});await waitFor(`document.querySelector('#veil-rare-survey-message')!==null`,'Rare Survey presentation did not install after Nitrogen completion');
  await waitFor(`!!document.querySelector('#collector-launch-handle')&&!document.querySelector('#open-supply')?.disabled`,'LOADOUT UI did not become ready');await evaluate(`(()=>{document.querySelector('#open-supply').click();document.querySelector('#collector-launch-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true;})()`);await waitFor(`document.querySelector('#expedition-destinations')?.getAttribute('aria-hidden')==='false'&&!!document.querySelector('#expedition-destinations [data-region=\"veil\"]')`,'H Veil destination unavailable');await evaluate(`document.querySelector('#expedition-destinations [data-region=\"veil\"]').click()`);await waitFor(`document.querySelector('#veil-view')?.hidden===false&&!!globalThis.__rareSurveyRun`,'Rare Survey expedition did not launch');exceptions.length=0;

  const visual=await evaluate(`(()=>{const run=globalThis.__rareSurveyRun,site=run.rareSurvey?.anomalies?.find(item=>item.element==='P'),dust=site&&run.map.dust.find(item=>item.rareAnomaly===site.id);if(!site||!dust)return null;run.predators=false;Object.assign(run.player,{x:site.x,y:site.y+150,vx:0,vy:0,speed:0,angle:-Math.PI/2});const renderer=globalThis.__rareSurveyRenderer,canvas=document.querySelector('#veil-canvas'),ctx=canvas.getContext('2d');renderer.reset();renderer.draw(run,0,false);const rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height,q=renderer.screen(dust.x,dust.y),cx=Math.round(q.x*sx),cy=Math.round(q.y*sy),radius=Math.max(3,Math.round(5*Math.max(sx,sy))),pixels=ctx.getImageData(Math.max(0,cx-radius),Math.max(0,cy-radius),Math.min(canvas.width,cx+radius+1)-Math.max(0,cx-radius),Math.min(canvas.height,cy+radius+1)-Math.max(0,cy-radius)).data;let brightest=[0,0,0],brightness=-1,goldColor=null,goldPixels=0;for(let i=0;i<pixels.length;i+=4){const r=pixels[i],g=pixels[i+1],b=pixels[i+2],a=pixels[i+3],next=r+g+b;if(a>0&&next>brightness){brightness=next;brightest=[r,g,b];}if(a>=64&&r>=120&&g>=80&&r>b+25&&g>b+10){goldPixels++;goldColor??=[r,g,b];}}return {id:site.id,x:site.x,y:site.y,kind:dust.kind,element:dust.element,color:goldColor??brightest,goldPixels,brightest};})()`);
  assert.ok(visual);assert.equal(visual.kind,'rare');assert.equal(visual.element,'P');assert.ok(visual.goldPixels>0,`Rare anomaly region must contain warm gold pixels rather than ordinary dust: ${JSON.stringify({goldPixels:visual.goldPixels,color:visual.color,brightest:visual.brightest})}`);

  await evaluate(`(()=>{const run=globalThis.__rareSurveyRun,site=run.rareSurvey.anomalies.find(item=>item.id==='${visual.id}');Object.assign(run.player,{x:site.x,y:site.y,vx:0,vy:0,speed:0,angle:-Math.PI/2});return true;})()`);
  await waitFor(`globalThis.__rareSurveyRun?.rareSpecimens?.some(item=>item.id==='${visual.id}')`,'Rare anomaly scan did not create run-local specimen',100);
  const pickup=await evaluate(`(()=>{const run=globalThis.__rareSurveyRun,node=document.querySelector('#veil-rare-survey-message'),site=run.rareSurvey.anomalies.find(item=>item.id==='${visual.id}');return {cargo:run.rareCargo.P,specimens:run.rareSpecimens.length,hidden:node.hidden,label:node.getAttribute('aria-label')||'',consumed:site.visual.ready===Infinity,normalInsightArray:Array.isArray(run.carriedInsights)};})()`);
  assert.equal(pickup.cargo,1);assert.equal(pickup.specimens,1);assert.equal(pickup.hidden,false);assert.match(pickup.label,/リン試料 P \+1/);assert.equal(pickup.consumed,true);assert.equal(pickup.normalInsightArray,true,'Rare collection must not replace the Normal Insight run state');

  await evaluate(`document.querySelector('#veil-return').click()`);await waitFor(`document.querySelector('#veil-view')?.hidden===true`,'Rare Survey normal return did not finish',120);
  const returned=await evaluate(`(()=>{const saved=JSON.parse(localStorage.getItem('molecule-craft.resources.v1')),summary=document.querySelector('#craft-last-run')?.textContent??'',extra=document.querySelector('#show-extra-elements');extra.checked=true;extra.dispatchEvent(new Event('change',{bubbles:true}));const button=document.querySelector('#element-palette [data-element="P"]'),stock=document.querySelector('[data-element-stock="P"]');return {stock:saved.elements.P,claimed:saved.rareSurvey?.claimedIds??[],summary,buttonHidden:button.hidden,buttonDisabled:button.disabled,paletteStock:Number(stock.textContent)};})()`);
  assert.equal(returned.stock,1);assert.ok(returned.claimed.includes(visual.id));assert.match(returned.summary,/P \+1/);assert.equal(returned.buttonHidden,false);assert.equal(returned.buttonDisabled,false);assert.equal(returned.paletteStock,1);
  assert.equal(exceptions.length,0,`Rare Survey browser flow must not throw: ${JSON.stringify(exceptions)}`);
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await new Promise(resolveWait=>setTimeout(resolveWait,100));server.close();await rm(profile,{recursive:true,force:true});}
console.log('Rare Survey Chromium regression passed: fixed gold anomaly is visible, proximity scan yields a named specimen, and normal return commits P into BASE/CRAFT access.');
