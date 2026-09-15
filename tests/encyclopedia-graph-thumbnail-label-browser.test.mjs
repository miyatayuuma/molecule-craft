import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),outputDir=join(root,'test-results','encyclopedia-graph-thumbnail-label');
const indexHtml=await readFile(join(root,'index.html'),'utf8');
const fixtureHtml=indexHtml.replace(/\s*<script type="module" src="\.\/src\/(?:app|pwa)\.js[^\"]*"><\/script>/g,'');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/__graph_thumbnail_fixture__'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(fixtureHtml);return;}
    const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=normalize(join(root,relative));
    if(!file.startsWith(root)){res.writeHead(403).end();return;}
    const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch{res.writeHead(404).end('not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const {port}=server.address();
let chrome='';for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'Chromium is required for Encyclopedia Graph thumbnail/label validation');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-encyclopedia-thumbnail-')),debugPort=9226;let child=null,socket=null;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});let tabs=null;
  for(let attempt=0;attempt<120;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await pause(100);}
  assert.ok(tabs?.length,'DevTools endpoint did not become ready');socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}});
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.text);return response.result?.value;};
  const screenshot=async name=>{const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await mkdir(outputDir,{recursive:true});await writeFile(join(outputDir,name),Buffer.from(shot.data,'base64'));};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:900,height:760,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:`http://127.0.0.1:${port}/__graph_thumbnail_fixture__`});await pause(120);
  const initialized=await evaluate(`(async()=>{
    const chemistry=await import('/src/chemistry.js?v=20'),loaded=await chemistry.loadMoleculeDatabase();if(!loaded.ok)return{ok:false};
    const records=chemistry.moleculeCatalog(),ids=['cyclohexane','methylcyclohexane'],save={schemaVersion:3,discoveredMolecules:ids.map((id,index)=>({id,at:index+1,order:index+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]},data=new Map([['molecule-craft.collection.v1',JSON.stringify(save)]]),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
    const {createCollectionUI}=await import('/src/collection-ui.js?v=39');window.__collection=await createCollectionUI({records,storage,onPlace:()=>{},canOpen:()=>true,elementAccess:()=>true,recipeState:()=>({recipes:[],hints:[]})});return{ok:true};
  })()`);assert.deepEqual(initialized,{ok:true});
  await evaluate(`document.querySelector('#open-collection').click()`);for(let i=0;i<50;i++){await pause(50);if(await evaluate(`!!document.querySelector('.graph-node.focus.registered .graph-focus-thumbnail')`))break;}
  const inspect=()=>evaluate(`(()=>{
    const rect=node=>{const r=node?.getBoundingClientRect();return r&&{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,x:r.left+r.width/2,y:r.top+r.height/2}};
    const overlap=(a,b)=>!!a&&!!b&&Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
    const segmentHitsRect=(a,b,r)=>{if(!a||!b||!r)return false;let t0=0,t1=1;const dx=b.x-a.x,dy=b.y-a.y;for(const [p,q] of [[-dx,a.x-r.left],[dx,r.right-a.x],[-dy,a.y-r.top],[dy,r.bottom-a.y]]){if(!p){if(q<0)return false;continue;}const t=q/p;if(p<0){if(t>t1)return false;t0=Math.max(t0,t);}else{if(t<t0)return false;t1=Math.min(t1,t);}}return t0<=t1;};
    const stage=document.querySelector('.graph-stage'),focus=document.querySelector('.graph-node.focus'),focusImage=focus?.querySelector('.graph-focus-thumbnail'),identity=document.querySelector('.graph-focus-identity'),identityName=identity?.querySelector('strong'),neighbor=[...document.querySelectorAll('.graph-node.neighbor.registered')].find(node=>node.querySelector('.graph-focus-thumbnail')&&node.querySelector('.graph-neighbor-label')),neighborImage=neighbor?.querySelector('.graph-focus-thumbnail'),neighborLabel=neighbor?.querySelector('.graph-neighbor-label');
    const stageRect=rect(stage),focusRect=rect(focus),focusImageRect=rect(focusImage),identityRect=rect(identity),neighborRect=rect(neighbor),neighborImageRect=rect(neighborImage),neighborLabelRect=rect(neighborLabel),nameStyle=identityName&&getComputedStyle(identityName),neighborStyle=neighborLabel&&getComputedStyle(neighborLabel),focusImageStyle=focusImage&&getComputedStyle(focusImage),neighborImageStyle=neighborImage&&getComputedStyle(neighborImage);
    return{viewport:innerWidth,focusId:focus?.dataset.graphId,neighborId:neighbor?.dataset.graphId,focusRect,focusImageRect,focusImageStyle:focusImageStyle&&{width:focusImageStyle.width,height:focusImageStyle.height,maxWidth:focusImageStyle.maxWidth,objectFit:focusImageStyle.objectFit},identityRect,identityText:identityName?.textContent??'',identityClipped:!!identityName&&(identityName.scrollWidth>identityName.clientWidth+1||identityName.scrollHeight>identityName.clientHeight+1),identityOverflowWrap:nameStyle?.overflowWrap,neighborRect,neighborImageRect,neighborImageStyle:neighborImageStyle&&{width:neighborImageStyle.width,height:neighborImageStyle.height,maxWidth:neighborImageStyle.maxWidth,objectFit:neighborImageStyle.objectFit},neighborLabelRect,neighborText:neighborLabel?.textContent??'',neighborLabelOverlapsNode:overlap(neighborLabelRect,neighborRect),neighborLabelHitsFocusEdge:segmentHitsRect(focusRect,neighborRect,neighborLabelRect),selectedFont:parseFloat(nameStyle?.fontSize||0),neighborFont:parseFloat(neighborStyle?.fontSize||0),neighborLabelsInsideStage:[...document.querySelectorAll('.graph-neighbor-label')].every(label=>{const r=rect(label);return r.left>=stageRect.left-1&&r.right<=stageRect.right+1&&r.top>=stageRect.top-1&&r.bottom<=stageRect.bottom+1}),contextMarks:document.querySelectorAll('.graph-context-node,.graph-teaser-node').length,allExternalLabelsOwned:[...document.querySelectorAll('.graph-neighbor-label')].every(label=>label.closest('.graph-node.neighbor')),stageRect};
  })()`);
  const desktop=await inspect();await screenshot('desktop-methylcyclohexane.png');console.log('Encyclopedia Graph desktop metrics',JSON.stringify(desktop));
  assert.equal(desktop.viewport,900);assert.equal(desktop.focusId,'methylcyclohexane','long-name molecule must be the authoritative selected Graph node');assert.equal(desktop.neighborId,'cyclohexane','registered direct neighbor must remain visible');
  assert(desktop.focusImageRect.width/desktop.focusRect.width>=.85&&desktop.focusImageRect.height/desktop.focusRect.height>=.85,'selected structure should use most of its circular node');
  assert(desktop.neighborImageRect.width/desktop.neighborRect.width>=.85&&desktop.neighborImageRect.height/desktop.neighborRect.height>=.85,'direct-neighbor structure should use most of its circular node');
  assert.equal(desktop.identityClipped,false,'methylcyclohexane selected label must not clip');assert.equal(desktop.identityOverflowWrap,'anywhere');assert.equal(desktop.identityRect.top>=desktop.stageRect.bottom-1,true,'selected identity belongs outside the Graph circle/edge surface');
  assert.equal(desktop.neighborLabelOverlapsNode,false,'direct-neighbor label must stay outside the circle');assert.equal(desktop.neighborLabelHitsFocusEdge,false,'direct-neighbor label must not cover the semantic focus edge');assert(desktop.selectedFont>desktop.neighborFont,'direct-neighbor label hierarchy must be quieter than selected identity');assert.equal(desktop.allExternalLabelsOwned,true);assert(desktop.contextMarks>0,'background nodes remain lightweight context marks');

  await send('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});
  await evaluate(`document.querySelector('[data-graph-id="cyclohexane"]').click()`);await pause(700);
  let mobile=await inspect();assert.equal(mobile.viewport,320);assert.equal(mobile.focusId,'cyclohexane','mobile navigation must recenter the selected direct neighbor');assert.equal(mobile.neighborId,'methylcyclohexane','long name must remain a direct-neighbor label after navigation');assert.equal(mobile.neighborLabelOverlapsNode,false);assert.equal(mobile.neighborLabelHitsFocusEdge,false);assert.equal(mobile.neighborLabelsInsideStage,true,'mobile external labels must remain inside the Graph stage');assert(Math.abs(mobile.focusRect.width-116)<2&&Math.abs(mobile.neighborRect.width-62)<2,'mobile navigation must use the intended focus/direct hit areas');
  await evaluate(`document.querySelector('[data-graph-id="methylcyclohexane"]').click()`);await pause(700);mobile=await inspect();assert.equal(mobile.focusId,'methylcyclohexane');assert.equal(mobile.identityClipped,false,'long selected label must remain readable on mobile');assert(mobile.focusImageRect.width/mobile.focusRect.width>=.85,'mobile selected structure should still fill the circle');assert.equal(mobile.neighborLabelsInsideStage,true);await screenshot('mobile-methylcyclohexane.png');
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await pause(100);server.close();await rm(profile,{recursive:true,force:true});}
console.log('Encyclopedia Graph browser polish passed: methylcyclohexane long label, structure-first selected/direct nodes, edge-clear labels, mobile navigation/re-layout, desktop/mobile captures.');
