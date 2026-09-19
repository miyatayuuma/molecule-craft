import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),outputDir=join(root,'test-results','encyclopedia-stereo-comparison');
const indexHtml=await readFile(join(root,'index.html'),'utf8');
const fixtureHtml=indexHtml.replace(/\s*<script type="module" src="\.\/src\/(?:app|pwa)\.js[^\"]*"><\/script>/g,'');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/__stereo_fixture__'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(fixtureHtml);return;}const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=normalize(join(root,relative));if(!file.startsWith(root)){res.writeHead(403).end();return;}const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);}catch{res.writeHead(404).end('not found');}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const {port}=server.address();
let chrome='';for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'Chromium is required for Encyclopedia stereo comparison validation');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-stereo-')),debugPort=9241;let child=null,socket=null;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});let tabs=null;
  for(let attempt=0;attempt<120;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await pause(100);}
  assert.ok(tabs?.length,'DevTools endpoint did not become ready');socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}});
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.exception?.description??response.exceptionDetails.text);return response.result?.value;};
  const waitFor=async(expression,message,{attempts=100,delay=30}={})=>{for(let i=0;i<attempts;i++){const value=await evaluate(expression);if(value)return value;await pause(delay);}assert.fail(message);};
  const screenshot=async name=>{const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await mkdir(outputDir,{recursive:true});await writeFile(join(outputDir,name),Buffer.from(shot.data,'base64'));};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:360,height:780,deviceScaleFactor:1,mobile:true});await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await send('Page.navigate',{url:`http://127.0.0.1:${port}/__stereo_fixture__`});await pause(150);
  const initialized=await evaluate(`(async()=>{const chemistry=await import('/src/chemistry.js?v=20'),loaded=await chemistry.loadMoleculeDatabase();if(!loaded.ok)return{ok:false};const records=chemistry.moleculeCatalog(),ids=['2-butene','water'],save={schemaVersion:3,discoveredMolecules:ids.map((id,index)=>({id,at:1700000000000+index,order:index+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]},data=new Map([['molecule-craft.collection.v1',JSON.stringify(save)]]),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};const {createCollectionUI}=await import('/src/collection-ui.js?stereo-comparison=1');window.__collection=await createCollectionUI({records,storage,onPlace:()=>{},canOpen:()=>true,elementAccess:()=>true,recipeState:()=>({recipes:ids,hints:[]})});return{ok:true};})()`);
  assert.deepEqual(initialized,{ok:true});
  assert.equal(await evaluate(`window.__collection.openMolecule('2-butene')`),true);
  await waitFor(`document.querySelector('.molecule-detail-return')?.dataset.viewerReady==='true'&&!!document.querySelector('.stereo-comparison')`,'2-butene stereo comparison did not become ready');
  const initial=await evaluate(`(()=>{const host=document.querySelector('.molecule-detail-return'),control=document.querySelector('.stereo-comparison'),group=control?.querySelector('[role="group"]'),buttons=[...control.querySelectorAll('.stereo-state-button')].map(node=>({text:node.textContent.trim(),relation:node.dataset.relation,pressed:node.getAttribute('aria-pressed'),height:node.getBoundingClientRect().height,tabIndex:node.tabIndex})),detail=document.querySelector('#collection-detail'),stage=document.querySelector('.model-stage');return{moleculeId:host?.dataset.moleculeId,relation:host?.dataset.stereoRelation,groupLabel:group?.getAttribute('aria-label'),buttons,detailWidth:detail?.clientWidth,detailScrollWidth:detail?.scrollWidth,docWidth:document.documentElement.clientWidth,docScrollWidth:document.documentElement.scrollWidth,stageHeight:stage?.getBoundingClientRect().height};})()`);
  assert.equal(initial.moleculeId,'2-butene');assert.equal(initial.relation,'opposite-side');assert.match(initial.groupLabel,/2-ブテン/);assert.deepEqual(initial.buttons.map(item=>item.text),['cis (Z)','trans (E)']);assert.equal(initial.buttons.filter(item=>item.pressed==='true').length,1);assert(initial.buttons.every(item=>item.height>=43),'stereo controls must remain touchable');assert(initial.buttons.every(item=>item.tabIndex===0),'both stereo choices must remain keyboard reachable');assert(initial.detailScrollWidth<=initial.detailWidth+1&&initial.docScrollWidth<=initial.docWidth+1,'mobile stereo detail must not overflow horizontally');assert(initial.stageHeight>=210,'viewer must remain large enough on mobile');

  await evaluate(`document.querySelector('.stereo-state-button[data-relation="same-side"]').click()`);
  await waitFor(`document.querySelector('.molecule-detail-return')?.dataset.stereoRelation==='same-side'&&document.querySelector('.molecule-detail-return')?.dataset.viewerReady==='true'`,'same-side view did not settle');
  await evaluate(`document.querySelector('.model-canvas').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);await pause(50);
  const sameView=await evaluate(`document.querySelector('.molecule-detail-return').dataset.viewerView`);assert(sameView,'camera view state missing');
  await screenshot('2-butene-cis-z-mobile.png');

  await evaluate(`document.querySelector('.stereo-state-button[data-relation="opposite-side"]').click()`);
  await waitFor(`document.querySelector('.molecule-detail-return')?.dataset.stereoRelation==='opposite-side'&&document.querySelector('.molecule-detail-return')?.dataset.viewerReady==='true'`,'opposite-side view did not settle');
  await pause(180);
  const oppositeView=await evaluate(`document.querySelector('.molecule-detail-return').dataset.viewerView`);
  assert.equal(oppositeView,sameView,'camera orientation/zoom must survive stereo configuration replacement');
  assert.equal(await evaluate(`document.querySelectorAll('.stereo-configuration-transition').length`),0,'crossfade overlay must be removed after switch');
  await screenshot('2-butene-trans-e-mobile.png');

  await evaluate(`(()=>{const b=document.querySelector('.stereo-state-button[data-relation="same-side"]');b.click();b.click();b.click();return true;})()`);
  await waitFor(`document.querySelector('.molecule-detail-return')?.dataset.stereoRelation==='same-side'&&document.querySelector('.molecule-detail-return')?.dataset.viewerReady==='true'`,'rapid stereo requests left stale viewer state');

  assert.equal(await evaluate(`window.__collection.openMolecule('water')`),true);await waitFor(`document.querySelector('.molecule-detail-return')?.dataset.viewerReady==='true'`,'water detail did not load');
  assert.equal(await evaluate(`!!document.querySelector('.stereo-comparison')`),false,'normal molecule must not receive stereo comparison UI');
  assert.equal(await evaluate(`document.querySelector('.molecule-detail-return')?.dataset.stereoRelation??''`),'','stereo state must not leak to another molecule');

  assert.equal(await evaluate(`window.__collection.openMolecule('2-butene')`),true);await waitFor(`document.querySelector('.molecule-detail-return')?.dataset.viewerReady==='true'`,'2-butene reopen did not load');
  assert.equal(await evaluate(`document.querySelector('.molecule-detail-return')?.dataset.stereoRelation`),'opposite-side','detail reopen should return to presentation default rather than persist chemical state');

  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate(`document.querySelector('.stereo-state-button[data-relation="same-side"]').click()`);
  await waitFor(`document.querySelector('.molecule-detail-return')?.dataset.stereoRelation==='same-side'&&document.querySelector('.molecule-detail-return')?.dataset.viewerReady==='true'`,'reduced-motion stereo switch did not settle');
  await pause(40);assert.equal(await evaluate(`document.querySelectorAll('.stereo-configuration-transition').length`),0,'reduced motion must not retain a configuration crossfade overlay');
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await pause(100);server.close();await rm(profile,{recursive:true,force:true});}
console.log('Encyclopedia stereo comparison passed: 2-butene-only accessible toggle, descriptor-backed states, camera-stable replacement, mobile fit, rapid switching and reduced motion.');
