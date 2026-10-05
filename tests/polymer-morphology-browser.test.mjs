import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import net from 'node:net';

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),viewport=process.env.POLYMER_DESKTOP==='1'?{width:1280,height:900,mobile:false}:{width:390,height:844,mobile:true};
const output=join(root,'docs/evidence/static-polymer-morphology'),reviewIds=['polyethylene','polystyrene','polybutadiene','polyacrylonitrile','phenol-formaldehyde-resin'];
const routes=JSON.parse(await readFile(join(root,'data/polymerization-routes.json'),'utf8')).routes,moleculeIds=[...new Set([...routes.flatMap(route=>route.feedSpecies),'water'])];
const moleculeSave={schemaVersion:3,discoveredMolecules:moleculeIds.map((id,index)=>({id,at:index+1,order:index+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=normalize(join(root,pathname==='/'?'index.html':pathname.replace(/^\/+/,'')));if(!file.startsWith(root)){res.writeHead(403).end();return;}res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404).end('not found');}});
await mkdir(output,{recursive:true});await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done);});const {port}=server.address();
let chrome=process.env.CHROMIUM_PATH??'';if(!chrome)for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'Chromium is required for static polymer morphology browser validation');
const portServer=net.createServer();await new Promise(done=>portServer.listen(0,'127.0.0.1',done));const debugPort=portServer.address().port;await new Promise(done=>portServer.close(done));
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-morphology-'));let child=null,socket=null;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:'ignore',detached:true});
  let tabs=null;for(let attempt=0;attempt<180;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await pause(100);}assert.ok(tabs?.length,'Morphology browser DevTools endpoint did not become ready');
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map(),browserErrors=[];socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text);if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')browserErrors.push(message.params.args.map(arg=>arg.value??arg.description??'').join(' '));});
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  const waitFor=async(expression,label,timeout=20000)=>{for(let index=0;index<timeout/50;index++){try{const value=await evaluate(expression);if(value)return value;}catch{}await pause(50);}throw Error(`${label}: ${JSON.stringify({url:await evaluate('location.href'),errors:browserErrors})}`);};
  await send('Runtime.enable');await send('Page.enable');await send('Log.enable');await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('molecule-craft.collection.v1',${JSON.stringify(JSON.stringify(moleculeSave))});localStorage.setItem('molecule-craft.polymer-collection.v1',JSON.stringify({schemaVersion:1,discoveredPolymers:[]}));`});
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/?reactionLabTest=1&reactionLabPhysics=stage-b`});
  await waitFor("!!document.querySelector('#open-reaction-lab')&&!document.querySelector('#open-reaction-lab').disabled&&!!window.__reactionLabProbe",'Reaction Lab test probe did not initialize');
  await evaluate("document.querySelector('#open-reaction-lab').click()");await waitFor("document.querySelector('#reaction-lab-dialog').open",'Reaction Lab did not open');
  assert.deepEqual(await evaluate('window.__reactionLabProbe.snapshot().morphology'),{active:false},'normal production flow starts without morphology');
  const initial=await evaluate('(()=>{const c=document.querySelector("#reaction-lab canvas"),r=c.getBoundingClientRect();return{distance:window.__reactionLabProbe.snapshot().camera.distance,rect:{width:r.width,height:r.height},environment:window.__reactionLabProbe.morphologyEnvironmentSnapshot()}})()');
  for(const polymerId of reviewIds){
    const model=await evaluate(`window.__reactionLabProbe.showMorphologyPreview(${JSON.stringify(polymerId)},'static-review')`);
    assert.equal(model.polymerId,polymerId);assert.ok(model.renderStats.objectCount<=2&&model.renderStats.geometryCount<=2&&model.renderStats.materialCount<=2);
    assert.ok(model.projectedBounds.left>=0&&model.projectedBounds.top>=0,`${polymerId}: geometry starts within the chamber: ${JSON.stringify(model.projectedBounds)}`);
    const canvas=await evaluate(`(()=>{const r=document.querySelector('#reaction-lab canvas').getBoundingClientRect();return{width:r.width,height:r.height,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}})()`);
    assert.ok(model.projectedBounds.right<=canvas.width+1&&model.projectedBounds.bottom<=canvas.height+1,`${polymerId}: geometry fits the chamber: ${JSON.stringify({projected:model.projectedBounds,canvas})}`);
    assert.ok(model.projectedBounds.width>=canvas.width*.43,`${polymerId}: material is large enough in the ${viewport.width}px layout`);
    assert.equal(await evaluate("document.querySelector('#reaction-lab').dataset.morphologyPreview"),'true');
    await pause(140);const stable=await evaluate('window.__reactionLabProbe.snapshot().morphology');assert.deepEqual(stable.renderStats,model.renderStats,`${polymerId}: geometry and resources stay static across frames`);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(output,`${polymerId}-${viewport.width}x${viewport.height}.png`),Buffer.from(shot.data,'base64'));
    await evaluate('window.__reactionLabProbe.hideMorphologyPreview()');await waitFor('window.__reactionLabProbe.snapshot().morphology.active===false','Morphology preview cleanup did not finish');
    const restored=await evaluate(`(()=>{const c=document.querySelector('#reaction-lab canvas'),r=c.getBoundingClientRect();return{distance:window.__reactionLabProbe.snapshot().camera.distance,width:r.width,height:r.height,preview:document.querySelector('#reaction-lab').dataset.morphologyPreview??null,environment:window.__reactionLabProbe.morphologyEnvironmentSnapshot(),cleanup:window.__reactionLabProbe.morphologyCleanupStats()}})()`);
    assert.equal(restored.distance,initial.distance,`${polymerId}: camera distance restored`);assert.equal(restored.preview,null,`${polymerId}: preview UI state restored`);assert.equal(restored.overflow??0,0);
    assert.deepEqual(restored.environment,initial.environment,`${polymerId}: camera, scene, material and preview state are fully restored`);
    assert.deepEqual([restored.cleanup.objectCount,restored.cleanup.geometryCount,restored.cleanup.materialCount],[0,0,0],`${polymerId}: temporary renderer resources are disposed`);
  }
  assert.deepEqual(browserErrors,[],'browser reports no JavaScript errors');
  console.log(`Static morphology browser validation passed at ${viewport.width}×${viewport.height}: ${reviewIds.join(', ')}; screenshots: ${output}`);
}finally{
  try{socket?.close();}catch{}
  if(child){try{process.kill(-child.pid,'SIGTERM');}catch{}await pause(200);try{process.kill(-child.pid,'SIGKILL');}catch{}await Promise.race([new Promise(done=>child.once('exit',done)),pause(500)]);}
  for(let attempt=0;attempt<5;attempt++){try{await rm(profile,{recursive:true,force:true});break;}catch{await pause(100);}}
  await new Promise(done=>server.close(done));
}
