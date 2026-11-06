import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const html=(await readFile(join(root,'index.html'),'utf8')).replace(/\s*<script type="module" src="\.\/src\/(?:app|pwa)\.js[^\"]*"><\/script>/g,'');
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/__compare_fixture__'){res.writeHead(200,{'content-type':'text/html'}).end(html);return;}
  const file=normalize(join(root,pathname.replace(/^\/+/,'')));if(!file.startsWith(root)){res.writeHead(403).end();return;}
  const bytes=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream'}).end(bytes);
}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const chrome=['google-chrome','chromium','chromium-browser'].map(name=>spawnSync('which',[name],{encoding:'utf8'})).find(result=>result.status===0)?.stdout.trim();
assert(chrome,'Chromium is needed for the limited visual interaction check');
const profile=await mkdtemp(join(tmpdir(),'molecule-compare-'));let child=null,socket=null,chromeErrors='';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  const debugPort=9249;
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  child.stderr.on('data',data=>{chromeErrors+=String(data).slice(0,1200);});
  let websocketUrl='';for(let i=0;i<160;i++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){const tabs=await response.json();websocketUrl=tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl;if(websocketUrl)break;}}catch{}await pause(100);}
  assert(websocketUrl,`Browser debugger should start (binary ${chrome}; exit ${child.exitCode??'running'}): ${chromeErrors.slice(-900)}`);socket=new WebSocket(websocketUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  let next=0;const waiting=new Map();socket.addEventListener('message',event=>{const result=JSON.parse(event.data);if(waiting.has(result.id)){const resolve=waiting.get(result.id);waiting.delete(result.id);resolve(result);}});
  const send=(method,params={})=>new Promise(resolve=>{const id=++next;waiting.set(id,resolve);socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.error||result.result?.exceptionDetails)throw Error(JSON.stringify(result));return result.result?.result?.value;};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/__compare_fixture__`});await pause(150);
  const ready=await evaluate(`(async()=>{
    const chemistry=await import('/src/chemistry.js'),loaded=await chemistry.loadMoleculeDatabase();if(!loaded.ok)return false;
    const ids=['water','methane','ethanol'],data=new Map(),save={schemaVersion:3,discoveredMolecules:ids.map((id,i)=>({id,at:i+1,order:i+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]};
    data.set('molecule-craft.collection.v1',JSON.stringify(save));window.__save=data;
    const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
    const {createCollectionUI}=await import('/src/collection-ui.js');window.__collection=await createCollectionUI({records:chemistry.moleculeCatalog(),storage,onPlace:()=>{},canOpen:()=>true,elementAccess:()=>true,recipeState:()=>({recipes:[],hints:[]})});
    document.querySelector('#open-collection').click();return true;
  })()`);assert.equal(ready,true);
  assert.equal(await evaluate(`!!document.querySelector('.graph-stage:not(.compare-stage)')`),true,'Existing graph remains the default');
  await evaluate(`document.querySelector('[data-comparison-mode="compare"]').click()`);await pause(100);
  const first=await evaluate(`(()=>({stage:!!document.querySelector('.compare-stage'),count:document.querySelector('.compare-count')?.textContent,buttons:document.querySelectorAll('.compare-bead').length,focus:document.querySelector('.compare-bead.focus')?.dataset.graphId,unit:document.querySelector('.compare-instrument-reading')?.textContent,ropeCanvas:!!document.querySelector('.compare-physics-canvas'),overflow:document.documentElement.scrollWidth>innerWidth+1,secret:[...document.querySelectorAll('.compare-bead.unknown')].every(button=>button.textContent.trim()==='?'&&!button.querySelector('img')&&!button.dataset.graphId&&!button.getAttribute('aria-label').includes('g/mol'))}))()`);
  assert(first.stage&&first.count.includes('142')&&first.buttons>1&&first.buttons<20,'Mobile view virtualizes 142 beads');
  assert.equal(first.focus,'ethanol');assert(first.unit.includes('g/mol'));assert.equal(first.ropeCanvas,true);assert.equal(first.overflow,false);assert.equal(first.secret,true,'Undiscovered beads must not expose name, model, ID or properties in the UI');
  const released=await evaluate(`(()=>{const stage=document.querySelector('.compare-stage'),bead=document.querySelector('.compare-bead.focus'),rect=bead.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;bead.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:75,button:0,clientX:x,clientY:y}));stage.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:75,button:0,clientX:x+10,clientY:y-60}));const moving=stage.classList.contains('is-bead-dragging');stage.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:75,button:0,clientX:x+10,clientY:y-60}));return{moving,locked:stage.classList.contains('is-dock-locked'),released:!stage.classList.contains('is-bead-dragging')}})()`);
  assert(released.moving&&released.locked&&released.released,'free two-axis drag releases into automatic magnetic docking');
  await evaluate(`document.querySelector('[data-compare-axis="atomCount"]').click()`);await pause(80);
  assert.equal(await evaluate(`document.querySelector('.compare-instrument-reading')?.textContent.includes('個')`),true,'Axis changes but the focused molecule remains');
  assert.equal(await evaluate(`document.querySelector('.compare-bead.focus')?.dataset.graphId`),'ethanol');
  await evaluate(`document.querySelector('[data-compare-axis="molarMass"]').click()`);await pause(80);
  const unknown=await evaluate(`(async()=>{
    const {buildComparisonRows}=await import('/src/encyclopedia-compare.js');const records=(await(await fetch('/data/molecules.json')).json());const order=buildComparisonRows(records).rows;
    const index=order.findIndex(row=>row.id==='ethanol');const target=index+1<order.length?index+1:index-1;const stage=document.querySelector('.compare-stage');
    stage.focus();stage.dispatchEvent(new KeyboardEvent('keydown',{key:target>index?'ArrowRight':'ArrowLeft',bubbles:true}));
    return{target:order[target].id,index:target};
  })()`);await pause(650);
  const hidden=await evaluate(`(()=>({index:Number(document.querySelector('.compare-bead.focus')?.dataset.compareIndex),name:document.querySelector('.compare-summary')?.textContent,secret:!!document.querySelector('.compare-bead.focus.unknown'),detail:document.querySelector('#collection-detail').hidden}))()`);
  assert.equal(hidden.index,unknown.index);assert.equal(hidden.secret,true);assert(hidden.name.includes('未知の分子')&&!hidden.name.includes('g/mol'));assert.equal(hidden.detail,true);
  await evaluate(`window.__collection.handleGamepad({pressed:[0],repeat:[],held:[],axes:[0,0,0,0]},1500)`);
  assert.equal(await evaluate(`document.querySelector('#collection-detail').hidden`),true,'Unknown A-button cannot open details');
  const beforeSave=await evaluate(`window.__save.get('molecule-craft.collection.v1')`);
  await evaluate(`window.__collection.registerDiscoveredMolecule(${JSON.stringify(unknown.target)},{at:100})`);await pause(100);
  const revealed=await evaluate(`(()=>({index:Number(document.querySelector('.compare-bead.focus')?.dataset.compareIndex),id:document.querySelector('.compare-bead.focus')?.dataset.graphId,unit:document.querySelector('.compare-instrument-reading')?.textContent,changed:window.__save.get('molecule-craft.collection.v1')!==${JSON.stringify(beforeSave)}}))()`);
  assert.equal(revealed.index,unknown.index,'Discovery preserves the position');assert.equal(revealed.id,unknown.target);assert(revealed.unit.includes('g/mol'));assert.equal(revealed.changed,true);
  await evaluate(`document.querySelector('[data-comparison-mode="graph"]').click()`);await pause(90);
  assert.equal(await evaluate(`!!document.querySelector('.graph-stage:not(.compare-stage)')`),true,'Graph return remains available');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelector('[data-comparison-mode="compare"]').click()`);await pause(110);
  const desktop=await evaluate(`(()=>({stage:document.querySelector('.compare-stage')?.getBoundingClientRect().height,controls:!!document.querySelector('.compare-axis'),beads:document.querySelectorAll('.compare-bead').length,scroll:document.documentElement.scrollWidth>innerWidth+1}))()`);
  assert(desktop.stage>300&&desktop.controls&&desktop.beads<25&&!desktop.scroll,'Desktop comparison stays within one viewport');
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}server.close();await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
console.log('MC-COMPARE-01 browser check passed: mobile/desktop, graph switching, axes, undiscovered secret, discovery reveal, save, gamepad A.');
