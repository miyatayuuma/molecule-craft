import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),outputDir=join(root,'test-results','ring-visual-calibration');
const indexHtml=await readFile(join(root,'index.html'),'utf8'),fixtureHtml=indexHtml.replace(/\s*<script type="module" src="\.\/src\/(?:app|pwa)\.js[^"]*"><\/script>/g,'');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/__ring_visual__'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(fixtureHtml);return;}const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=normalize(join(root,relative));if(!file.startsWith(root)){res.writeHead(403).end();return;}const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);}catch{res.writeHead(404).end('not found');}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const {port}=server.address();
let chrome='';for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'Chromium is required for ring visual calibration');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-ring-visual-')),debugPort=9258;let child=null,socket=null;const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let tabs=null;for(let attempt=0;attempt<120;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await pause(100);}assert.ok(tabs?.length,'DevTools endpoint did not become ready');
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}});
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.exception?.description??response.exceptionDetails.text);return response.result?.value;};
  const waitFor=async(expression,message)=>{for(let i=0;i<120;i++){try{if(await evaluate(expression))return;}catch{}await pause(100);}throw new Error(message);};
  const screenshot=async name=>{const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await mkdir(outputDir,{recursive:true});await writeFile(join(outputDir,name),Buffer.from(shot.data,'base64'));};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:360,height:780,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:`http://127.0.0.1:${port}/__ring_visual__`});await pause(150);
  const ids=['cyclopentane','tetrahydrofuran','cyclobutane','cyclohexane'];
  const initialized=await evaluate(`(async()=>{const chemistry=await import('/src/chemistry.js?v=20'),loaded=await chemistry.loadMoleculeDatabase();if(!loaded.ok)return{ok:false};const records=chemistry.moleculeCatalog(),ids=${JSON.stringify(['cyclopentane','tetrahydrofuran','cyclobutane','cyclohexane'])},save={schemaVersion:3,discoveredMolecules:ids.map((id,index)=>({id,at:index+1,order:index+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]},data=new Map([['molecule-craft.collection.v1',JSON.stringify(save)]]),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};const {createCollectionUI}=await import('/src/collection-ui.js?ring-visual=1');window.__collection=await createCollectionUI({records,storage,onPlace:()=>{},canOpen:()=>true,elementAccess:()=>true,recipeState:()=>({recipes:ids,hints:[]})});return{ok:true};})()`);
  assert.deepEqual(initialized,{ok:true});
  for(const id of ids){
    assert.equal(await evaluate(`window.__collection.openMolecule(${JSON.stringify(id)})`),true,`${id}: open`);
    await waitFor(`document.querySelector('.molecule-detail-return')?.dataset.viewerReady==='true'`,`${id}: 3D viewer did not become ready`);
    await pause(120);
    const state=await evaluate(`(()=>{const detail=document.querySelector('#collection-detail'),canvas=detail?.querySelector('.model-canvas'),host=canvas?.closest('[data-render-mode]'),r=canvas?.getBoundingClientRect();return{viewport:[innerWidth,innerHeight],detailWidth:detail?.clientWidth??0,detailScroll:detail?.scrollWidth??Infinity,docWidth:document.documentElement.clientWidth,docScroll:document.documentElement.scrollWidth,canvas:r&&{width:r.width,height:r.height,left:r.left,right:r.right},mode:host?.dataset.renderMode??''};})()`);
    assert.deepEqual(state.viewport,[360,780],`${id}: mobile viewport`);
    assert.ok(state.detailScroll<=state.detailWidth+1&&state.docScroll<=state.docWidth+1,`${id}: mobile layout overflow`);
    assert.ok(state.canvas?.width>=300&&state.canvas.right<=361&&state.canvas.left>=-1,`${id}: model canvas not fitted to mobile detail`);
    assert.ok(['webgl','software-3d'].includes(state.mode),`${id}: live 3D render mode missing`);
    await screenshot(`${id}-360x780.png`);
  }
  const assets=await evaluate(`(async()=>Object.fromEntries(await Promise.all(${JSON.stringify(['cyclopentane','tetrahydrofuran','cyclobutane','cyclohexane'])}.map(async id=>[id,await fetch('/assets/models/molecule-'+id+'.svg').then(r=>r.text())]))))()`);
  for(const id of ids){assert.match(assets[id],/viewBox="0 0 192 128"/,`${id}: Graph thumbnail framing contract`);assert.ok((assets[id].match(/<circle /g)??[]).length>=4,`${id}: Graph thumbnail lost atom topology`);assert.ok((assets[id].match(/<path /g)??[]).length>=4,`${id}: Graph thumbnail lost readable bonds`);}
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await pause(100);server.close();await rm(profile,{recursive:true,force:true});}
console.log('Ring visual browser passed at 360x780: live 3D fitting, no overflow, and Graph thumbnail topology/framing.');
