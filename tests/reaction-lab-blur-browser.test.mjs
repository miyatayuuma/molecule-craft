import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBrowserLifecycle} from './helpers/browser-lifecycle.mjs';

// Candidate-only lifecycle regression. The immutable Task10 performance control
// predates the blur fix and continues using the shared release/physics guardrail.
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),pause=ms=>new Promise(done=>setTimeout(done,ms));
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(request,response)=>{
  try{const path=new URL(request.url,'http://localhost').pathname,file=normalize(join(root,path==='/'?'index.html':decodeURIComponent(path).replace(/^\//,'')));if(!file.startsWith(root+'/'))throw Error('Invalid test path');response.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'}).end(await readFile(file));}
  catch{response.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const lifecycle=await createBrowserLifecycle({name:'reaction-lab-blur'});let socket;
await lifecycle.run(async()=>{
  let chrome='';for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0){chrome=found.stdout.trim();break;}}assert.ok(chrome,'Chromium is required');
  lifecycle.launch(chrome,['--headless=new','--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',`--user-data-dir=${lifecycle.profile}`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
  let tabs;for(let i=0;i<180;i++){try{const port=(await readFile(join(lifecycle.profile,'DevToolsActivePort'),'utf8')).split('\n')[0];const response=await fetch(`http://127.0.0.1:${port}/json/list`);tabs=await response.json();if(tabs.length)break;}catch{}await pause(100);}assert.ok(tabs?.length,'Chromium DevTools endpoint not ready');
  socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise((done,fail)=>{socket.addEventListener('open',done,{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map(),errors=[];
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')errors.push(message.params.args);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const waitFor=async(expression,label)=>{for(let i=0;i<240;i++){if(await evaluate(expression))return;await pause(50);}throw Error(label);};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.setItem('molecule-craft.collection.v1',JSON.stringify({schemaVersion:3,discoveredMolecules:[{id:'water',at:1,order:1}],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]}))"});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?reactionLabTest=1`});
  await waitFor("!!window.__reactionLabProbe&&!document.querySelector('#open-reaction-lab')?.disabled",'Reaction Lab did not initialize');
  await evaluate("document.querySelector('#open-reaction-lab').click();document.querySelectorAll('[data-lab-slot]')[0].click()");await waitFor("!document.querySelector('[data-lab-picker]').hidden",'Picker did not open');
  await evaluate("document.querySelector('[data-lab-picker-list] [data-species=water]').click()");await waitFor("document.querySelector('[data-lab-picker]').hidden&&!document.querySelector('[data-lab-feed]').disabled",'Water selection did not finish');
  await evaluate("document.querySelector('[data-lab-feed]').click()");await waitFor("(()=>{const s=window.__reactionLabProbe.snapshot();return s.batch.phase==='ACTIVE'&&s.instances.length===4})()",'Water batch did not become ACTIVE');
  const fixture=await evaluate("(()=>{const p=window.__reactionLabProbe,s=p.snapshot(),poses=s.instances.map((item,index)=>({id:item.id,positionAngstrom:index===0?[0,0,0]:[240+index*50,240,0],orientation:[0,0,0,1]}));p.setGeometry(poses);return{id:s.instances[0].id,plan:p.dragPlan(s.instances[0].id,0,[.42,.18,0]),ids:s.instances.map(item=>item.id)}})()");
  await evaluate("window.__blurPointerEvents=[];for(const type of ['pointerdown','pointermove'])document.querySelector('#reaction-lab canvas').addEventListener(type,event=>window.__blurPointerEvents.push({type:event.type,trusted:event.isTrusted,pointerId:event.pointerId}),{once:true})");
  const {start,end}=fixture.plan;await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:start.x,y:start.y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x:start.x,y:start.y,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:end.x,y:end.y,button:'left',buttons:1});await pause(40);
  const controls="[data-lab-feed],[data-lab-slot],[data-lab-light],[data-lab-heat],[data-lab-medium-port]";
  const before=await evaluate(`({state:window.__reactionLabProbe.snapshot(),locked:[...document.querySelectorAll('${controls}')].every(button=>button.disabled)})`);assert.equal(before.state.draggedInstanceId,fixture.id);assert.equal(before.locked,true);
  // Pointer acquisition/movement above is native CDP input. Dispatch the window
  // lifecycle event explicitly, without delivering a pointerup to the canvas.
  const after=await evaluate(`(()=>{window.dispatchEvent(new Event('blur'));return{state:window.__reactionLabProbe.snapshot(),unlocked:[...document.querySelectorAll('${controls}')].every(button=>!button.disabled),events:window.__blurPointerEvents,captured:document.querySelector('#reaction-lab canvas').hasPointerCapture(window.__blurPointerEvents.find(e=>e.type==='pointerdown').pointerId)}})()`);
  assert.ok(after.events.some(event=>event.type==='pointerdown'&&event.trusted));assert.ok(after.events.every(event=>event.trusted));assert.equal(after.state.pointerActive,false);assert.equal(after.state.selectedInstanceId,null);assert.equal(after.state.downInstanceId,null);assert.equal(after.state.manipulationActive,false);assert.equal(after.state.simulationTimeMode,'NORMAL');assert.equal(after.state.simulationTimeScale,1);assert.equal(after.captured,false);assert.equal(after.unlocked,true,'Blur unlocks FEED, slots and environment controls');assert.deepEqual(after.state.instances.map(item=>item.id),fixture.ids);assert.deepEqual(after.state.instances.find(item=>item.id===fixture.id).velocityAngstromPerPs,[0,0,0]);
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:end.x,y:end.y,button:'left',buttons:0});
  assert.deepEqual(errors,[],'Blur regression has no browser errors');console.log('REACTION_LAB_BLUR_REGRESSION',JSON.stringify({fixture,before,after}));
},{socket:()=>socket,server});
