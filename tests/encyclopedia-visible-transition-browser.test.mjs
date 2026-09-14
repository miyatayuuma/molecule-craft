import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const indexHtml=await readFile(join(root,'index.html'),'utf8');
const fixtureHtml=indexHtml.replace(/\s*<script type="module" src="\.\/src\/(?:app|pwa)\.js[^\"]*"><\/script>/g,'');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/__transition_fixture__'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(fixtureHtml);return;}
    const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=normalize(join(root,relative));
    if(!file.startsWith(root)){res.writeHead(403).end();return;}
    const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch{res.writeHead(404).end('not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const {port}=server.address();
let chrome='';for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'Chromium is required for Encyclopedia visible-transition validation');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-encyclopedia-visible-')),debugPort=9225,captureEnabled=process.env.ENCYCLOPEDIA_CAPTURE==='1',captureDir=join(root,'test-results','encyclopedia-transition');let child=null,socket=null;
if(captureEnabled)await mkdir(captureDir,{recursive:true});
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});let tabs=null;
  for(let attempt=0;attempt<120;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(tabs?.length,'DevTools endpoint did not become ready');socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}});
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.text);return response.result?.value;};
  const waitFor=async(expression,message,{attempts=80,delay=25}={})=>{for(let i=0;i<attempts;i++){const value=await evaluate(expression);if(value)return value;await new Promise(r=>setTimeout(r,delay));}assert.fail(message);};
  const capture=async name=>{if(!captureEnabled)return;const result=await send('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(join(captureDir,`${name}.png`),Buffer.from(result.data,'base64'));};
  const center=rect=>({x:rect.left+rect.width/2,y:rect.top+rect.height/2});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const assertBetween=(value,a,b,label)=>{const low=Math.min(a,b),high=Math.max(a,b);assert.ok(value>low+1&&value<high-1,`${label} must be strictly between source and destination (${a} -> ${value} -> ${b})`);};
  const detailRectExpression=`(()=>{const host=document.querySelector('.molecule-detail-return');if(!host)return null;const r=host.getBoundingClientRect(),width=Math.min(240,Math.max(140,r.width*.58)),height=width*78/96;return{left:r.left+(r.width-width)/2,top:r.top+(r.height-height)/2,width,height};})()`;
  const proxyFrame=async(progress,name)=>{
    const frame=await evaluate(`(async()=>{const p=document.querySelector('.encyclopedia-molecule-transition');if(!p)return null;const animation=p.getAnimations().find(a=>(a.effect?.getTiming?.().duration??0)>0);if(!animation)return null;animation.pause();const duration=Number(animation.effect.getTiming().duration);animation.currentTime=duration*${progress};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const rect=p.getBoundingClientRect(),style=getComputedStyle(p),source=p.querySelector('.transition-source');return{rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},duration,currentTime:Number(animation.currentTime),opacity:Number(style.opacity),visibility:style.visibility,transform:style.transform,paintReady:p.dataset.paintReady,parentIsDialog:p.parentElement===document.querySelector('#collection-dialog'),sourceReady:!!source?.complete&&source.naturalWidth>0,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};})()`);
    assert.ok(frame,`${name}: transform animation must exist`);assert.equal(frame.parentIsDialog,true,`${name}: proxy must be inside the open modal dialog top layer`);assert.equal(frame.paintReady,'true',`${name}: proxy must complete image readiness + first paint before motion`);assert.equal(frame.sourceReady,true,`${name}: source proxy image must be decoded/loadable`);assert.equal(frame.reduced,false,`${name}: normal-motion fixture must not enter reduced-motion path`);assert.ok(frame.duration>0,`${name}: WAAPI duration must be positive`);assert.ok(frame.opacity>.9&&frame.visibility==='visible',`${name}: proxy must be visibly painted`);await capture(name);return frame;
  };
  const playProxy=async()=>{await evaluate(`(()=>{const p=document.querySelector('.encyclopedia-molecule-transition'),a=p?.getAnimations().find(animation=>(animation.effect?.getTiming?.().duration??0)>0);a?.play();return !!a;})()`);};
  const waitOwner=owner=>waitFor(`document.body.dataset.encyclopediaMoleculeOwner===${JSON.stringify(owner)}`,`owner did not settle on ${owner}`,{attempts:100,delay:30});
  const triggerDetailReturn=()=>evaluate(`(()=>{const host=document.querySelector('.molecule-detail-return');if(!host)return false;const r=host.getBoundingClientRect(),o={bubbles:true,pointerId:77,button:0,clientX:r.left+r.width/2,clientY:r.top+r.height/2};host.dispatchEvent(new PointerEvent('pointerdown',o));host.dispatchEvent(new PointerEvent('pointerup',o));return true;})()`);
  const graphRect=()=>evaluate(`(()=>{const visual=document.querySelector('.graph-node.focus.registered .graph-focus-thumbnail')??document.querySelector('.graph-node.focus .graph-focus-thumbnail'),r=visual?.getBoundingClientRect();return r&&{left:r.left,top:r.top,width:r.width,height:r.height};})()`);
  const runForward=async prefix=>{
    const from=await graphRect();assert.ok(from?.width>0,`${prefix}: Graph source rect missing`);await evaluate(`document.querySelector('.graph-node.focus').click()`);
    await waitFor(`(()=>{const p=document.querySelector('.encyclopedia-molecule-transition');return p?.dataset.paintReady==='true'&&p.getAnimations().some(a=>(a.effect?.getTiming?.().duration??0)>0);})()`,`${prefix}: visible Graph -> Detail animation did not start`);
    const to=await waitFor(detailRectExpression,`${prefix}: Detail destination rect missing`),start=await proxyFrame(0,`${prefix}-graph-to-detail-start`);assert.ok(distance(center(start.rect),center(from))<2.5,`${prefix}: start frame must coincide with Graph source`);
    const mid=await proxyFrame(.5,`${prefix}-graph-to-detail-mid`);assert.ok(distance(center(mid.rect),center(from))>5,`${prefix}: midpoint must leave Graph source`);assert.ok(distance(center(mid.rect),center(to))>5,`${prefix}: midpoint must not reach Detail destination`);assertBetween(mid.rect.width,from.width,to.width,`${prefix}: midpoint width/scale`);assertBetween(mid.rect.height,from.height,to.height,`${prefix}: midpoint height/scale`);
    await playProxy();await waitOwner('detail');await capture(`${prefix}-graph-to-detail-end`);return to;
  };
  const runBack=async prefix=>{
    const from=await evaluate(detailRectExpression);assert.ok(from?.width>0,`${prefix}: Detail source rect missing`);assert.equal(await triggerDetailReturn(),true,`${prefix}: Detail return gesture missing`);
    await waitFor(`(()=>{const p=document.querySelector('.encyclopedia-molecule-transition');return p?.dataset.paintReady==='true'&&p.getAnimations().some(a=>(a.effect?.getTiming?.().duration??0)>0);})()`,`${prefix}: visible Detail -> Graph animation did not start`);
    const to=await waitFor(`(()=>{const visual=document.querySelector('.graph-node.focus .graph-focus-thumbnail'),r=visual?.getBoundingClientRect();return r&&r.width>0&&{left:r.left,top:r.top,width:r.width,height:r.height};})()`,`${prefix}: Graph destination rect missing`),start=await proxyFrame(0,`${prefix}-detail-to-graph-start`);assert.ok(distance(center(start.rect),center(from))<2.5,`${prefix}: reverse start frame must coincide with Detail source`);
    const mid=await proxyFrame(.5,`${prefix}-detail-to-graph-mid`);assert.ok(distance(center(mid.rect),center(from))>5,`${prefix}: reverse midpoint must leave Detail source`);assert.ok(distance(center(mid.rect),center(to))>5,`${prefix}: reverse midpoint must not reach Graph destination`);assertBetween(mid.rect.width,from.width,to.width,`${prefix}: reverse midpoint width/scale`);assertBetween(mid.rect.height,from.height,to.height,`${prefix}: reverse midpoint height/scale`);
    await playProxy();await waitOwner('graph');await capture(`${prefix}-detail-to-graph-end`);return to;
  };

  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await send('Page.navigate',{url:`http://127.0.0.1:${port}/__transition_fixture__`});await new Promise(r=>setTimeout(r,120));
  const initialized=await evaluate(`(async()=>{const chemistry=await import('/src/chemistry.js?v=20');const loaded=await chemistry.loadMoleculeDatabase();if(!loaded.ok)return{ok:false,reason:'db'};const records=chemistry.moleculeCatalog(),save={schemaVersion:3,discoveredMolecules:['hydrogen','oxygen','n-butane','isobutane'].map((id,index)=>({id,at:index+1,order:index+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]},data=new Map([['molecule-craft.collection.v1',JSON.stringify(save)]]),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};const {createCollectionUI}=await import('/src/collection-ui.js?v=39');window.__collection=await createCollectionUI({records,storage,onPlace:()=>{},canOpen:()=>true,elementAccess:()=>true,recipeState:()=>({recipes:[],hints:[]})});return{ok:true,count:window.__collection.state.discoveredCount,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};})()`);
  assert.deepEqual(initialized,{ok:true,count:4,reduced:false});await evaluate(`document.querySelector('#open-collection').click()`);await waitFor(`!!document.querySelector('.graph-node.focus.registered .graph-focus-thumbnail')`,'desktop Graph focus did not render');
  await runForward('desktop');await runBack('desktop');

  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,80));assert.equal(await evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`),false,'mobile normal-motion fixture must remain non-reduced');
  await runForward('mobile');await runBack('mobile');

  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});const currentId=await evaluate(`document.querySelector('.graph-node.focus')?.dataset.graphId`);await evaluate(`document.querySelector('.graph-node.focus').click()`);await waitOwner('detail');assert.equal(await evaluate(`document.querySelector('.molecule-detail-return')?.dataset.moleculeId`),currentId,'reduced motion must keep the same molecule handoff');assert.equal(await evaluate(`!!document.querySelector('.encyclopedia-molecule-transition')`),false,'reduced motion must not leave a ghost proxy');
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await new Promise(r=>setTimeout(r,100));server.close();await rm(profile,{recursive:true,force:true});}
console.log('Encyclopedia visible transition passed: top-layer painted proxy, decoded source, strict position+scale midpoint, desktop/mobile forward+reverse, reduced motion.');
