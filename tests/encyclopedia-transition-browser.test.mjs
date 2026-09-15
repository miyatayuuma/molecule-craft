import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
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
assert.ok(chrome,'Chromium is required for Encyclopedia transition visual validation');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-encyclopedia-transition-')),debugPort=9224;let child=null,socket=null;
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});let tabs=null;
  for(let attempt=0;attempt<120;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(tabs?.length,'DevTools endpoint did not become ready');socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}});
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.text);return response.result?.value;};
  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:`http://127.0.0.1:${port}/__transition_fixture__`});await new Promise(r=>setTimeout(r,120));
  const initialized=await evaluate(`(async()=>{
    const chemistry=await import('/src/chemistry.js?v=20');const loaded=await chemistry.loadMoleculeDatabase();if(!loaded.ok)return{ok:false,reason:'db'};
    const records=chemistry.moleculeCatalog(),save={schemaVersion:3,discoveredMolecules:['hydrogen','oxygen','n-butane','isobutane'].map((id,index)=>({id,at:index+1,order:index+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]},data=new Map([['molecule-craft.collection.v1',JSON.stringify(save)]]),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
    const {createCollectionUI}=await import('/src/collection-ui.js?v=39');window.__collection=await createCollectionUI({records,storage,onPlace:()=>{},canOpen:()=>true,elementAccess:()=>true,recipeState:()=>({recipes:[],hints:[]})});return{ok:true,count:window.__collection.state.discoveredCount,text:document.querySelector('#open-collection')?.textContent??''};
  })()`);
  assert.deepEqual(initialized,{ok:true,count:4,text:'図鑑 4/129'});
  await evaluate(`document.querySelector('#open-collection').click()`);for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,50));if(await evaluate(`!!document.querySelector('.graph-node.focus.registered .graph-focus-thumbnail')`))break;}
  let initial=await evaluate(`(()=>{const node=document.querySelector('.graph-node.focus.registered'),visual=node?.querySelector('.graph-focus-thumbnail'),r=visual?.getBoundingClientRect();return{id:node?.dataset.graphId,rect:r&&{left:r.left,top:r.top,width:r.width,height:r.height}}})()`);
  assert.equal(initial.id,'isobutane','latest registered molecule is the Graph focus');assert.ok(initial.rect?.width>0);

  await evaluate(`document.querySelector('[data-graph-id="n-butane"]').click()`);await new Promise(r=>setTimeout(r,70));
  const focusEdges=await evaluate(`(()=>{const focus=document.querySelector('.graph-node.focus')?.dataset.graphId,chevrons=[...document.querySelectorAll('.graph-edge-chevron')],backgroundStyled=[...document.querySelectorAll('.graph-edge:not(.direct)')].filter(edge=>[...edge.classList].some(name=>name.startsWith('relation-')));return{focus,chainLines:document.querySelectorAll('.graph-edge.direct.relation-chain-extension').length,chainChevrons:document.querySelectorAll('.graph-edge-chevron.relation-chain-extension').length,isomerChevrons:document.querySelectorAll('.graph-edge-chevron.relation-isomer').length,backgroundStyled:backgroundStyled.length,incident:chevrons.every(node=>node.dataset.edgeSource===focus||node.dataset.edgeTarget===focus),iterations:chevrons.flatMap(node=>node.getAnimations()).map(animation=>animation.effect?.getTiming?.().iterations)}})()`);
  assert.equal(focusEdges.focus,'n-butane');assert.ok(focusEdges.chainLines>=2,'focused n-butane must expose both shorter and longer chain-extension edges');assert.ok(focusEdges.chainChevrons>=2,'directional chain-extension focus edges need Chevrons');assert.equal(focusEdges.isomerChevrons,0,'isomer edge must not receive a directional Chevron');assert.equal(focusEdges.backgroundStyled,0,'background edges must remain relation-neutral');assert.equal(focusEdges.incident,true,'only current-focus incident edges may own Chevrons');assert.ok(focusEdges.iterations.length&&focusEdges.iterations.every(value=>value===1),'Chevron animations must be one-shot');
  await evaluate(`document.querySelector('[data-graph-id="isobutane"]').click()`);await new Promise(r=>setTimeout(r,35));await evaluate(`document.querySelector('[data-graph-id="n-butane"]').click()`);await new Promise(r=>setTimeout(r,70));
  const rapidFocus=await evaluate(`(()=>{const focus=document.querySelector('.graph-node.focus')?.dataset.graphId,chevrons=[...document.querySelectorAll('.graph-edge-chevron')];return{focus,incident:chevrons.every(node=>node.dataset.edgeSource===focus||node.dataset.edgeTarget===focus),count:chevrons.length}})()`);assert.equal(rapidFocus.focus,'n-butane');assert.equal(rapidFocus.incident,true,'rapid focus replacement must leave no stale Chevron from the prior focus');assert.ok(rapidFocus.count>0);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await evaluate(`document.querySelector('[data-graph-id="isobutane"]').click()`);await new Promise(r=>setTimeout(r,70));
  const reducedEdges=await evaluate(`(()=>{const direct=document.querySelectorAll('.graph-edge.direct[class*="relation-"]').length,chevrons=[...document.querySelectorAll('.graph-edge-chevron')];return{direct,chevrons:chevrons.length,animations:chevrons.flatMap(node=>node.getAnimations()).length}})()`);assert.ok(reducedEdges.direct>0,'reduced motion must retain relation styling');assert.equal(reducedEdges.animations,0,'reduced motion must keep Chevron direction static');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await send('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});await evaluate(`document.querySelector('[data-graph-id="n-butane"]').click()`);await new Promise(r=>setTimeout(r,950));
  const mobileEdges=await evaluate(`(()=>{const focus=document.querySelector('.graph-node.focus'),nodes=[...document.querySelectorAll('.graph-node')],chevrons=[...document.querySelectorAll('.graph-edge-chevron')],inside=(x,y,r)=>Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2))<Math.min(r.width,r.height)/2;return{width:innerWidth,count:chevrons.length,clear:chevrons.every(node=>{const r=node.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return !nodes.some(graphNode=>inside(x,y,graphNode.getBoundingClientRect()));}),focus:focus?.dataset.graphId}})()`);assert.equal(mobileEdges.width,320);assert.equal(mobileEdges.focus,'n-butane');assert.ok(mobileEdges.count>0);assert.equal(mobileEdges.clear,true,'mobile Chevrons must remain in the visible line gap instead of node interiors');
  await send('Emulation.clearDeviceMetricsOverride');await evaluate(`document.querySelector('[data-graph-id="isobutane"]').click()`);await new Promise(r=>setTimeout(r,650));initial=await evaluate(`(()=>{const node=document.querySelector('.graph-node.focus.registered'),visual=node?.querySelector('.graph-focus-thumbnail'),r=visual?.getBoundingClientRect();return{id:node?.dataset.graphId,rect:r&&{left:r.left,top:r.top,width:r.width,height:r.height}}})()`);assert.equal(initial.id,'isobutane');assert.ok(initial.rect?.width>0);

  await evaluate(`document.querySelector('.graph-node.focus.registered').click()`);await new Promise(r=>setTimeout(r,70));
  const active=await evaluate(`(()=>{const p=document.querySelector('.encyclopedia-molecule-transition'),r=p?.getBoundingClientRect();return{owner:document.body.dataset.encyclopediaMoleculeOwner,id:document.body.dataset.encyclopediaMoleculeId,proxy:!!p,rect:r&&{left:r.left,top:r.top,width:r.width,height:r.height}}})()`);
  assert.equal(active.owner,'transition');assert.equal(active.id,'isobutane');assert.equal(active.proxy,true,'selected molecule proxy must remain visible while Graph is replaced');assert.ok(active.rect.width>0);
  await new Promise(r=>setTimeout(r,300));const mid=await evaluate(`(()=>{const r=document.querySelector('.encyclopedia-molecule-transition')?.getBoundingClientRect();return r&&{left:r.left,top:r.top,width:r.width,height:r.height}})()`);
  assert.ok(mid&&Math.hypot(mid.left-initial.rect.left,mid.top-initial.rect.top)>5,'molecule must visibly travel from the measured Graph node instead of crossfading in place');
  for(let i=0;i<30;i++){
    await new Promise(r=>setTimeout(r,60));
    const lifecycle=await evaluate(`(()=>({owner:document.body.dataset.encyclopediaMoleculeOwner,proxy:!!document.querySelector('.encyclopedia-molecule-transition')}))()`);
    if(lifecycle.owner==='detail')break;
    assert.equal(lifecycle.owner,'transition');assert.equal(lifecycle.proxy,true,'transition owner must always have a visible molecule proxy');
  }
  assert.equal(await evaluate(`document.body.dataset.encyclopediaMoleculeOwner`),'detail');assert.equal(await evaluate(`document.querySelector('.molecule-detail-return')?.dataset.moleculeId`),'isobutane');

  const navigated=await evaluate(`(()=>{const buttons=[...document.querySelectorAll('.molecule-detail-navigation button')].filter(button=>!button.disabled);if(!buttons.length)return false;buttons[0].click();return true;})()`);assert.equal(navigated,true);await new Promise(r=>setTimeout(r,140));
  const currentAfterNav=await evaluate(`document.querySelector('.molecule-detail-return')?.dataset.moleculeId`);assert.ok(currentAfterNav&&currentAfterNav!=='isobutane','prev/next must change the authoritative Detail molecule');
  await evaluate(`(()=>{const host=document.querySelector('.molecule-detail-return'),r=host.getBoundingClientRect(),o={bubbles:true,pointerId:41,button:0,clientX:r.left+r.width/2,clientY:r.top+r.height/2};host.dispatchEvent(new PointerEvent('pointerdown',o));host.dispatchEvent(new PointerEvent('pointerup',o));})()`);await new Promise(r=>setTimeout(r,60));assert.equal(await evaluate(`document.body.dataset.encyclopediaMoleculeId`),currentAfterNav);
  for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,60));if(await evaluate(`document.body.dataset.encyclopediaMoleculeOwner`)==='graph')break;}
  assert.equal(await evaluate(`document.body.dataset.encyclopediaMoleculeOwner`),'graph');assert.equal(await evaluate(`document.querySelector('.graph-node.focus')?.dataset.graphId`),currentAfterNav,'Detail close must land on current prev/next molecule');

  await evaluate(`document.querySelector('.graph-node.focus').click()`);for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,60));if(await evaluate(`document.body.dataset.encyclopediaMoleculeOwner`)==='detail')break;}
  const beforeIsomer=await evaluate(`document.querySelector('.molecule-detail-return')?.dataset.moleculeId`),clickedIsomer=await evaluate(`(()=>{const button=[...document.querySelectorAll('button.collection-tag')].find(node=>node.textContent.includes('イソブタン')||node.textContent.includes('n-ブタン'));if(!button)return false;button.click();return true;})()`);assert.equal(clickedIsomer,true);await new Promise(r=>setTimeout(r,140));
  const isomerId=await evaluate(`document.querySelector('.molecule-detail-return')?.dataset.moleculeId`);assert.ok(isomerId&&isomerId!==beforeIsomer,'isomer navigation must update the current Detail molecule');
  await evaluate(`(()=>{const host=document.querySelector('.molecule-detail-return'),r=host.getBoundingClientRect(),o={bubbles:true,pointerId:42,button:0,clientX:r.left+r.width/2,clientY:r.top+r.height/2};host.dispatchEvent(new PointerEvent('pointerdown',o));host.dispatchEvent(new PointerEvent('pointerup',o));})()`);for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,60));if(await evaluate(`document.body.dataset.encyclopediaMoleculeOwner`)==='graph')break;}
  assert.equal(await evaluate(`document.querySelector('.graph-node.focus')?.dataset.graphId`),isomerId,'isomer Detail must zoom back to the isomer node');

  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await evaluate(`document.querySelector('.graph-node.focus').click()`);await new Promise(r=>setTimeout(r,90));
  assert.equal(await evaluate(`document.body.dataset.encyclopediaMoleculeOwner`),'detail');assert.equal(await evaluate(`document.querySelector('.molecule-detail-return')?.dataset.moleculeId`),isomerId,'reduced motion keeps the same current molecule handoff');
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await new Promise(r=>setTimeout(r,100));server.close();await rm(profile,{recursive:true,force:true});}
console.log('Encyclopedia browser transition passed: focus-edge relations/Chevrons, mobile/reduced-motion safety, measured Graph origin, continuous proxy, current prev/next + isomer return.');
