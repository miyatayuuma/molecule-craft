import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const indexHtml=await readFile(join(root,'index.html'),'utf8');
const encyclopediaFixture=indexHtml.replace(/\s*<script type="module" src="\.\/src\/(?:app|pwa)\.js[^\"]*"><\/script>/g,'');
const craftFixture=indexHtml.replace(/\s*<script type="module" src="\.\/src\/pwa\.js[^\"]*"><\/script>/g,'');
const records=JSON.parse(await readFile(join(root,'data/molecules.json'),'utf8'));
const nitromethane=records.find(record=>record.id==='nitromethane');
assert.ok(nitromethane,'nitromethane record missing');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/__resonance_encyclopedia__'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(encyclopediaFixture);return;}
    if(pathname==='/__resonance_craft__'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(craftFixture);return;}
    const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=normalize(join(root,relative));if(!file.startsWith(root)){res.writeHead(403).end();return;}
    const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch{res.writeHead(404).end('not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const {port}=server.address();
let chrome='';for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'Chromium is required for resonance visual validation');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-resonance-visual-')),debugPort=9231,captureDir=join(root,'test-results','resonance-visual');let child=null,socket=null;
await mkdir(captureDir,{recursive:true});
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let tabs=null;for(let attempt=0;attempt<160;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(tabs?.length,'Chromium DevTools endpoint did not become ready');socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}});
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.exception?.description??response.exceptionDetails.text);return response.result?.value;};
  const waitFor=async(expression,message,{attempts=120,delay=50}={})=>{for(let i=0;i<attempts;i++){const value=await evaluate(expression);if(value)return value;await new Promise(r=>setTimeout(r,delay));}assert.fail(message);};
  const capture=async name=>{const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(join(captureDir,`${name}.png`),Buffer.from(shot.data,'base64'));};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});

  // Encyclopedia: real Graph thumbnails and Detail WebGL viewer for charged/resonance molecules.
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/__resonance_encyclopedia__`});await new Promise(r=>setTimeout(r,150));
  const initialized=await evaluate(`(async()=>{const chemistry=await import('/src/chemistry.js');const loaded=await chemistry.loadMoleculeDatabase();if(!loaded.ok)return null;const ids=['ozone','nitromethane','nitrobenzene','2-nitrotoluene','2-4-dinitrotoluene','2-4-6-trinitrotoluene'];const save={schemaVersion:3,discoveredMolecules:ids.map((id,index)=>({id,at:index+1,order:index+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]},data=new Map([['molecule-craft.collection.v1',JSON.stringify(save)]]),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};const {createCollectionUI}=await import('/src/collection-ui.js');window.__resonanceCollection=await createCollectionUI({records:chemistry.moleculeCatalog(),storage,onPlace:()=>{},canOpen:()=>true,elementAccess:()=>true,recipeState:()=>({recipes:ids,hints:[]})});return window.__resonanceCollection.state.discoveredCount;})()`);
  assert.equal(initialized,6,'resonance Encyclopedia fixture must register the six new molecules');await evaluate(`document.querySelector('#open-collection').click()`);await waitFor(`document.querySelector('#collection-dialog')?.open`,'Encyclopedia dialog did not open');
  const focusGraphNode=async id=>{const clicked=await evaluate(`(()=>{const node=document.querySelector('[data-graph-id=${JSON.stringify(id)}]');if(!node)return false;node.click();return true;})()`);assert.equal(clicked,true,`Graph node missing: ${id}`);await waitFor(`document.querySelector('.graph-node.focus')?.dataset.graphId===${JSON.stringify(id)}`,`Graph did not focus ${id}`);await new Promise(r=>setTimeout(r,650));};
  const returnToGraph=async id=>{const returned=await evaluate(`(()=>{const host=document.querySelector('.molecule-detail-return[data-molecule-id=${JSON.stringify(id)}]');if(!host)return false;const r=host.getBoundingClientRect(),options={bubbles:true,pointerId:77,button:0,clientX:r.left+r.width/2,clientY:r.top+r.height/2};host.dispatchEvent(new PointerEvent('pointerdown',options));host.dispatchEvent(new PointerEvent('pointerup',options));return true;})()`);assert.equal(returned,true,`${id}: Detail return surface missing`);await waitFor(`document.querySelector('.graph-node.focus')?.dataset.graphId===${JSON.stringify(id)}`,`${id}: Detail did not return to focused Graph node`);await new Promise(r=>setTimeout(r,650));};
  const assertGraphVisual=async id=>{const state=await evaluate(`(()=>{const node=document.querySelector('.graph-node.focus'),img=node?.querySelector('.graph-focus-thumbnail'),identity=document.querySelector('.graph-focus-identity'),dialog=document.querySelector('#collection-dialog');if(!node||!img||!identity||!dialog)return null;const nr=node.getBoundingClientRect(),ir=identity.getBoundingClientRect(),dr=dialog.getBoundingClientRect();return{id:node.dataset.graphId,imageReady:img.complete&&img.naturalWidth>0,node:{left:nr.left,right:nr.right,top:nr.top,bottom:nr.bottom},identity:{left:ir.left,right:ir.right,top:ir.top,bottom:ir.bottom,scrollWidth:identity.scrollWidth,clientWidth:identity.clientWidth},dialog:{left:dr.left,right:dr.right,top:dr.top,bottom:dr.bottom}};})()`);assert.equal(state?.id,id);assert.equal(state.imageReady,true,`${id}: Graph thumbnail failed to load`);assert.ok(state.node.left>=state.dialog.left-1&&state.node.right<=state.dialog.right+1,`${id}: focused node must stay inside dialog`);assert.ok(state.identity.left>=state.dialog.left-1&&state.identity.right<=state.dialog.right+1,`${id}: external label must stay inside dialog`);assert.ok(state.identity.scrollWidth<=state.identity.clientWidth+2,`${id}: external label must not horizontally clip`);};
  for(const id of ['ozone','nitrobenzene','2-4-6-trinitrotoluene']){
    await focusGraphNode(id);await assertGraphVisual(id);await capture(`mobile-graph-${id}`);
    await evaluate(`document.querySelector('.graph-node.focus').click()`);await waitFor(`document.querySelector('.molecule-detail-return[data-molecule-id=${JSON.stringify(id)}]')?.dataset.viewerReady==='true'`,`${id}: Detail viewer did not become ready`,{attempts:160,delay:50});
    const detail=await evaluate(`(()=>{const host=document.querySelector('.molecule-detail-return[data-molecule-id=${JSON.stringify(id)}]'),canvas=host?.querySelector('canvas');if(!host||!canvas)return null;const r=host.getBoundingClientRect(),c=canvas.getBoundingClientRect();return{host:[r.width,r.height],canvas:[c.width,c.height],text:document.querySelector('#collection-detail')?.innerText??''};})()`);assert.ok(detail?.canvas[0]>100&&detail.canvas[1]>100,`${id}: Detail canvas must be visibly rendered`);assert.ok(detail.text.includes(id==='ozone'?'オゾン':id==='nitrobenzene'?'ニトロベンゼン':'2,4,6-トリニトロトルエン'),`${id}: Detail identity missing`);await capture(`mobile-detail-${id}`);
    await returnToGraph(id);
  }

  // CRAFT: boot the real application with a persisted nitromethane Lewis contributor.
  const positions=[[-1.15,0,0],[0.05,0,0],[.9,.78,0],[.9,-.78,0],[-1.7,.78,.15],[-1.75,-.7,.2],[-1.65,0,-.8]];
  assert.equal(nitromethane.atoms.length,positions.length,'Nitromethane fixture atom count drifted');
  const workspace={schemaVersion:2,atoms:nitromethane.atoms.map((element,index)=>({element,position:positions[index]})),bonds:nitromethane.bonds,selected:null,focus:1,pivot:null,targetMoleculeId:'nitromethane',camera:{position:[0,0,7],target:[-.25,0,0],up:[0,1,0]}};
  await evaluate(`localStorage.clear();localStorage.setItem('molecule-craft.workspace.v1',${JSON.stringify(JSON.stringify(workspace))});true`);
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/__resonance_craft__`});
  const craft=await waitFor(`(()=>{const canvas=[...document.querySelectorAll('canvas')].find(item=>{const r=item.getBoundingClientRect();return r.width>250&&r.height>250;});if(!canvas)return null;const r=canvas.getBoundingClientRect();return{mode:document.body.dataset.mode,width:r.width,height:r.height,target:document.querySelector('#craft-target-name')?.textContent??document.body.innerText};})()`,'CRAFT WebGL canvas did not become ready',{attempts:220,delay:50});
  assert.ok(craft.width>250&&craft.height>250,'CRAFT canvas must be player-visible');await new Promise(r=>setTimeout(r,900));await capture('mobile-craft-nitromethane');

  console.log('Resonance visual browser passed: mobile Graph/Detail for ozone, nitrobenzene and TNT plus real CRAFT nitromethane canvas.');
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await new Promise(r=>setTimeout(r,120));server.close();await rm(profile,{recursive:true,force:true});}
