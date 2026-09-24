import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=normalize(join(root,relative));if(!file.startsWith(root)){res.writeHead(403).end();return;}const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);}catch{res.writeHead(404).end('not found');}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const {port}=server.address(),origin=`http://127.0.0.1:${port}`;
let chrome='';for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}assert.ok(chrome,'Chromium is required for Reaction Lab validation');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-reaction-lab-')),debugPort=9251,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let child=null,socket=null;
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});let tabs=null;
  for(let attempt=0;attempt<160;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await pause(100);}assert.ok(tabs?.length,'DevTools endpoint did not become ready');
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.exception?.description??response.exceptionDetails.text);return response.result?.value;};
  const waitFor=async(expression,message,attempts=160)=>{for(let i=0;i<attempts;i++){try{if(await evaluate(expression))return;}catch{}await pause(100);}throw new Error(message);};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:origin+'/'});
  await waitFor("!!document.querySelector('#open-reaction-lab')&&!!document.querySelector('#open-dock')",'LAB / DOCK did not initialize');
  await evaluate(`(async()=>{localStorage.clear();const {createResources}=await import('/src/veil/resources.js');const records=await fetch('/data/molecules.json').then(r=>r.json());const r=createResources({storage:localStorage});r.setCatalog(records);r.collect({H:100,C:100,O:100});for(const id of ['ethene','styrene','1-3-butadiene'])r.discover(id);return r.save();})()`);
  await send('Page.reload',{ignoreCache:true});await waitFor("!!document.querySelector('#open-reaction-lab')",'LAB did not restore after seed reload');
  await evaluate("document.querySelector('#open-reaction-lab').click()");await waitFor("document.querySelector('#reaction-lab-dialog')?.open",'Reaction Lab did not open');
  const initial=await evaluate(`(()=>{const d=document.querySelector('#reaction-lab-dialog'),r=d.getBoundingClientRect();return{tray:[...d.querySelectorAll('[data-molecule-id]')].map(n=>n.dataset.moleculeId),text:d.textContent,rect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right}};})()`);
  for(const id of ['ethene','styrene','1-3-butadiene'])assert(initial.tray.includes(id),`missing discovered molecule in tray: ${id}`);
  const before=await evaluate(`(()=>{const s=JSON.parse(localStorage.getItem('molecule-craft.resources.v1'));return JSON.stringify({upgrades:s.upgrades,treatments:s.treatments,elements:s.elements,tanks:s.tanks,recipes:s.recipes,hints:s.hints,progress:s.progress});})()`);
  assert.match(initial.text,/REACTIONS OFF/);assert.ok(initial.rect.top>=0&&initial.rect.bottom<=844&&initial.rect.left>=0&&initial.rect.right<=390,'Reaction Lab must fit the mobile viewport');
  await evaluate("document.querySelector('#reaction-lab-molecules [data-molecule-id=\"ethene\"]').click();document.querySelector('#reaction-lab-molecules [data-molecule-id=\"ethene\"]').click();document.querySelector('#reaction-lab-molecules [data-molecule-id=\"styrene\"]').click()");
  await waitFor("document.querySelectorAll('#reaction-lab-chamber .reaction-lab-molecule').length===3",'multiple molecules were not added');
  const first=await evaluate(`(()=>{const n=document.querySelector('#reaction-lab-chamber .reaction-lab-molecule'),r=n.getBoundingClientRect(),c=document.querySelector('#reaction-lab-chamber').getBoundingClientRect();return{id:n.dataset.instanceId,x:r.left+r.width/2,y:r.top+r.height/2,c:{left:c.left,top:c.top,width:c.width,height:c.height}};})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:first.x,y:first.y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:first.x+70,y:first.y+80,button:'left',buttons:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:first.x+70,y:first.y+80,button:'left',clickCount:1});
  await pause(80);
  const moved=await evaluate(`(()=>{const n=document.querySelector('[data-instance-id="${first.id}"]'),r=n.getBoundingClientRect(),c=document.querySelector('#reaction-lab-chamber').getBoundingClientRect(),nodes=[...document.querySelectorAll('#reaction-lab-chamber .reaction-lab-molecule')].map(x=>{const a=x.getBoundingClientRect();return{left:a.left,right:a.right,top:a.top,bottom:a.bottom}});return{x:r.left+r.width/2,y:r.top+r.height/2,c:{left:c.left,right:c.right,top:c.top,bottom:c.bottom},nodes,selected:n.getAttribute('aria-pressed')};})()`);
  assert(moved.x>first.x+40&&moved.y>first.y+40,'molecule drag must move the selected molecule');
  assert.equal(moved.selected,'true');for(const r of moved.nodes){assert(r.left>=moved.c.left-1&&r.right<=moved.c.right+1&&r.top>=moved.c.top-1&&r.bottom<=moved.c.bottom+1,'molecules must remain visually inside chamber');}
  await evaluate("document.querySelector('#reaction-lab-clear').click()");assert.equal(await evaluate("document.querySelectorAll('#reaction-lab-chamber .reaction-lab-molecule').length"),0);
  const after=await evaluate(`(()=>{const s=JSON.parse(localStorage.getItem('molecule-craft.resources.v1'));return JSON.stringify({upgrades:s.upgrades,treatments:s.treatments,elements:s.elements,tanks:s.tanks,recipes:s.recipes,hints:s.hints,progress:s.progress});})()`);assert.equal(after,before,'interaction prototype must not consume stock or mutate progression');
  console.log('Reaction Lab browser prototype',JSON.stringify({initial,moved}));
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await pause(100);server.close();await rm(profile,{recursive:true,force:true});}
console.log('Reaction Lab Chromium prototype passed: discovered-molecule tray, multi-instance chamber drag, mobile fit, and zero gameplay mutation.');
