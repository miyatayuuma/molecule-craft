import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const captureEnabled=process.env.LOADOUT_CAPTURE==='1';
const reducedMotion=process.env.LOADOUT_REDUCED_MOTION==='1';
const captureDir=join(root,'test-results','loadout-optical-alignment');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const chromeCandidates=['google-chrome','chromium','chromium-browser'];
let chrome='';
for(const command of chromeCandidates){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'Chromium is required for LOADOUT optical alignment acceptance');

const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=normalize(join(root,relative));
    if(!file.startsWith(root)){res.writeHead(403).end();return;}
    const body=await readFile(file);
    res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch{res.writeHead(404).end('not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const {port}=server.address(),origin=`http://127.0.0.1:${port}`;
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-loadout-optical-'));
const debugPort=9241,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let child=null,socket=null;

try{
  if(captureEnabled)await mkdir(captureDir,{recursive:true});
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let tabs=null;
  for(let attempt=0;attempt<160;attempt++){
    try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}
    await pause(100);
  }
  assert.ok(tabs?.length,'DevTools endpoint did not become ready');
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}});
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.exception?.description??response.exceptionDetails.text);return response.result?.value;};
  const waitFor=async(expression,message,attempts=160)=>{for(let i=0;i<attempts;i++){try{if(await evaluate(expression))return;}catch{}await pause(100);}throw new Error(message);};
  const viewport=async(width,height,mobile=true)=>{await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await pause(180);};
  const point=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect();return r&&{x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height,left:r.left,top:r.top,right:r.right,bottom:r.bottom};})()`);
  const tap=async selector=>{const p=await point(selector);assert.ok(p,`missing tap target: ${selector}`);await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',buttons:0,clickCount:1});};
  const screenshot=async name=>{if(!captureEnabled)return;const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await writeFile(join(captureDir,name),Buffer.from(shot.data,'base64'));};

  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setEmulatedMedia',{features:reducedMotion?[{name:'prefers-reduced-motion',value:'reduce'}]:[]});await viewport(390,844,true);await send('Page.navigate',{url:`${origin}/`});
  await waitFor("document.querySelector('#open-collection')?.textContent?.includes('0/136')",'Application did not initialize');
  const seeded=await evaluate(`(async()=>{const {createResources}=await import('/src/veil/resources.js');const records=await fetch('/data/molecules.json').then(r=>r.json());const r=createResources({storage:localStorage});r.setCatalog(records);r.state.progress.regions=['veil','carbon','oxygen'];r.state.progress.checkpoint='oxygen';r.state.progress.choCompleted=true;r.state.progress.foundElements=['H','C','O','N'];r.state.recipes=['hydrogen','methane','oxygen','water','nitromethane'];Object.assign(r.state.elements,{H:1200,C:600,O:900,N:300});for(const [use,id] of [['propellant','hydrogen'],['shock','nitromethane'],['fuel','methane'],['oxidizer','oxygen'],['coolant','water']])if(!r.setLoadoutTank(use,id))return false;return r.save();})()`);
  assert.equal(seeded,true,'LOADOUT acceptance seed failed');
  await send('Page.reload',{ignoreCache:true});await waitFor("!!document.querySelector('#collector-launch-handle')&&!document.querySelector('#open-supply')?.disabled",'LOADOUT UI did not become ready');
  await evaluate("document.querySelector('#open-supply').click()");await waitFor("document.querySelector('#supply-dialog')?.open&&document.querySelector('#loadout-element-stock')&&!document.querySelector('#loadout-element-stock').hidden",'LOADOUT did not open');
  await waitFor("[...document.querySelectorAll('.loadout-molecule-thumb')].length===5&&[...document.querySelectorAll('.loadout-molecule-thumb')].every(image=>image.complete&&image.naturalWidth>0)",'LOADOUT molecule thumbnails did not load');
  await pause(220);

  const labelMap={propellant:'PULSE',shock:'SHOCK',fuel:'FUEL',oxidizer:'O₂',coolant:'COOLANT'};
  const inspect=use=>evaluate(`(async()=>{const {LOADOUT_HARDWARE_LAYOUT}=await import('/src/veil/loadout-hardware-layout.js');const rect=node=>{const r=node?.getBoundingClientRect();return r&&{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,x:r.left+r.width/2,y:r.top+r.height/2};};const map=document.querySelector('#supply-dialog .collector-shell-map'),layer=map?.querySelector('.loadout-design-layer'),button=document.querySelector(${JSON.stringify(`#shell-${use}`)}),panel=LOADOUT_HARDWARE_LAYOUT.slots[${JSON.stringify(use)}].panelRect,layerRect=rect(layer),scale=map?map._loadoutDesignScale:0,panelScreen={left:layerRect.left+panel.x*scale,top:layerRect.top+panel.y*scale,width:panel.width*scale,height:panel.height*scale};panelScreen.right=panelScreen.left+panelScreen.width;panelScreen.bottom=panelScreen.top+panelScreen.height;const style=getComputedStyle(button),outline={left:button.getBoundingClientRect().left+parseFloat(style.getPropertyValue('--slot-visual-left'))-parseFloat(style.getPropertyValue('--slot-hit-left')),top:button.getBoundingClientRect().top+parseFloat(style.getPropertyValue('--slot-visual-top'))-parseFloat(style.getPropertyValue('--slot-hit-top')),width:parseFloat(style.getPropertyValue('--slot-visual-width')),height:parseFloat(style.getPropertyValue('--slot-visual-height'))};const labels=[...document.querySelectorAll('.loadout-callout-label,.loadout-module-label')].filter(node=>node.textContent.trim()===${JSON.stringify(labelMap[use])}).filter(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0}).length;const meter=rect(button.querySelector('.tank-scale')),thumbnail=rect(button.querySelector('.loadout-molecule-pod'));const meters=[...document.querySelectorAll('.loadout-slot-path .tank-scale>b')].map(node=>getComputedStyle(node).backgroundColor);return{use:${JSON.stringify(use)},active:button.dataset.active==='true',panel:panelScreen,panelCenter:{x:panelScreen.left+panelScreen.width/2,y:panelScreen.top+panelScreen.height/2},outline,outlineCenter:{x:outline.left+outline.width/2,y:outline.top+outline.height/2},thumbnail,meter,labels,meterColors:meters};})()`);
  const select=async(use,name)=>{await tap(`#shell-${use}`);await waitFor(`document.querySelector(${JSON.stringify(`#shell-${use}`)})?.dataset.active==='true'`,`${use} selection did not activate`);await pause(100);const result=await inspect(use);assert.equal(result.active,true);const dx=Math.abs(result.outlineCenter.x-result.panelCenter.x),dy=Math.abs(result.outlineCenter.y-result.panelCenter.y);assert.ok(dx<=2&&dy<=2,`${use} selected outline is not centered on panel: ${JSON.stringify({dx,dy,result})}`);assert.ok(result.thumbnail.left>=result.panel.left-1&&result.thumbnail.top>=result.panel.top-1&&result.thumbnail.right<=result.panel.right+1&&result.thumbnail.bottom<=result.panel.bottom+1,`${use} thumbnail escaped panel: ${JSON.stringify(result)}`);assert.ok(Math.abs(result.meter.x-result.panelCenter.x)<=2,`${use} meter lost panel authority`);assert.equal(result.labels,1,`${use} player-facing label count must be one`);await screenshot(name);return result;};

  const pulse=await select('propellant','01-pulse-selected.png');
  const shock=await select('shock','02-shock-selected.png');
  const fuel=await select('fuel','03-fuel-selected.png');
  const oxygen=await select('oxidizer','04-oxygen-selected.png');
  const coolant=await select('coolant','05-coolant-selected.png');
  assert.equal(new Set([...fuel.meterColors,...oxygen.meterColors,...coolant.meterColors]).size,1,'DRIVE meter presentation must use one shared accent color');
  assert.equal(fuel.meterColors[0],oxygen.meterColors[0]);assert.equal(oxygen.meterColors[0],coolant.meterColors[0]);

  const inspectCraft=()=>evaluate(`(()=>{const rect=node=>{const r=node?.getBoundingClientRect();return r&&{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,x:r.left+r.width/2,y:r.top+r.height/2};};const map=document.querySelector('#supply-dialog .collector-shell-map'),canvas=map?.querySelector('#collector-shell-preview'),preview=map?._loadoutFlightCraftPreview??{},canvasRect=rect(canvas),scale=Number(preview.scale)||0,flight=canvasRect&&{left:canvasRect.left+preview.x-21*scale/2,top:canvasRect.top+preview.y-34*scale/2,width:21*scale,height:34*scale};if(flight){flight.right=flight.left+flight.width;flight.bottom=flight.top+flight.height;flight.x=flight.left+flight.width/2;flight.y=flight.top+flight.height/2;}const dock=map?.querySelector('.loadout-fixed-dock-image');return{handle:rect(document.querySelector('#collector-launch-handle')),canvas:canvasRect,flight,dock:rect(dock),dockTransform:getComputedStyle(dock).transform,canvasTransform:getComputedStyle(canvas).transform,canvasOpacity:Number(getComputedStyle(canvas).opacity),canvasDisplay:getComputedStyle(canvas).display,pulse:rect(map?.querySelector('.loadout-pulse-image')),shock:rect(map?.querySelector('.loadout-shock-image')),drive:rect(map?.querySelector('.loadout-drive-image'))};})()`);
  const assertCraftVisible=state=>{assert.ok(state.canvas&&state.canvas.width>0&&state.canvas.height>0,'flight craft canvas must have visible dimensions');assert.ok(state.canvasOpacity>=.9,'flight craft sprite must remain visible during launch selection');assert.ok(state.flight&&state.flight.width>0&&state.flight.height>0,'flight craft preview geometry must be visible');assert.ok(state.handle.left<state.flight.right&&state.handle.right>state.flight.left&&state.handle.top<state.flight.bottom&&state.handle.bottom>state.flight.top,'launch hit area must overlap the visible flight craft');assert.equal(state.dockTransform,'none','fixed dock must not have a launch translation');};
  const assertStationFixed=(before,after,label)=>{for(const key of ['dock','pulse','shock','drive'])assert.ok(Math.abs(after[key].x-before[key].x)<=1&&Math.abs(after[key].y-before[key].y)<=1,`${key} must remain fixed during ${label}`);};

  await viewport(1280,900,false);await waitFor("(()=>{const h=document.querySelector('#collector-launch-handle'),r=h?.getBoundingClientRect();return !!h&&r?.width>0&&r?.height>0&&getComputedStyle(h).pointerEvents!=='none';})()",'desktop CRAFT handle did not settle after viewport resize');await pause(240);const desktopDocked=await inspectCraft();assertCraftVisible(desktopDocked);await screenshot('11-craft-desktop-docked.png');
  const desktopStart=await point('#collector-launch-handle');assert.ok(desktopStart?.width>0&&desktopStart?.height>0,'desktop CRAFT drag handle is not measurable');const desktopHit=await evaluate(`(()=>{const h=document.querySelector('#collector-launch-handle'),r=h?.getBoundingClientRect(),hit=r?document.elementFromPoint(r.left+r.width/2,r.top+r.height/2):null;return {rect:r&&{left:r.left,top:r.top,width:r.width,height:r.height},hitId:hit?.id??'',hitClass:hit?.className??'',pointerEvents:h?getComputedStyle(h).pointerEvents:''};})()`);assert.equal(desktopHit.hitId,'collector-launch-handle',`desktop CRAFT handle is not topmost at its center: ${JSON.stringify(desktopHit)}`);await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:desktopStart.x,y:desktopStart.y,button:'none',buttons:0});await send('Input.dispatchMouseEvent',{type:'mousePressed',x:desktopStart.x,y:desktopStart.y,button:'left',buttons:1,clickCount:1});await waitFor("document.querySelector('#expedition-destinations')?.getAttribute('aria-hidden')==='false",`desktop CRAFT drag did not open destination layer: ${JSON.stringify(desktopHit)}`);await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:desktopStart.x+55,y:desktopStart.y+24,button:'left',buttons:1});await pause(120);const desktopDragging=await inspectCraft();assertCraftVisible(desktopDragging);assert.ok(Math.hypot(desktopDragging.flight.x-desktopDocked.flight.x,desktopDragging.flight.y-desktopDocked.flight.y)>2,'desktop flight craft must move');assertStationFixed(desktopDocked,desktopDragging,'desktop CRAFT drag');await screenshot('12-craft-desktop-drag.png');await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:desktopStart.x+55,y:desktopStart.y+24,button:'left',buttons:0,clickCount:1});await waitFor("document.querySelector('#expedition-destinations')?.getAttribute('aria-hidden')==='true",'desktop CRAFT drag did not reset after cancel');

  await viewport(390,844,true);await pause(240);await select('propellant','06-craft-neutral.png');const neutral=await inspectCraft();assertCraftVisible(neutral);await screenshot('06-craft-neutral.png');await screenshot('08-craft-docked.png');
  const handle=neutral.handle;await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:handle.x,y:handle.y,button:'none',buttons:0});await send('Input.dispatchMouseEvent',{type:'mousePressed',x:handle.x,y:handle.y,button:'left',buttons:1,clickCount:1});await waitFor("document.querySelector('#expedition-destinations')?.getAttribute('aria-hidden')==='false",'CRAFT drag did not open destination layer');
  const target=await point("#expedition-destinations button[data-region='carbon']");assert.ok(target,'CRAFT drag destination missing');const midpoint={x:handle.x+(target.x-handle.x)*.5,y:handle.y+(target.y-handle.y)*.5};await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:midpoint.x,y:midpoint.y,button:'left',buttons:1});await pause(120);const dragging=await inspectCraft();assertCraftVisible(dragging);assert.ok(Math.hypot(dragging.flight.x-neutral.flight.x,dragging.flight.y-neutral.flight.y)>2,'flight craft must move during launch drag');assertStationFixed(neutral,dragging,'CRAFT drag');await screenshot('07-craft-drag.png');await screenshot('09-craft-drag-midpoint.png');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x,y:target.y,button:'left',buttons:1});await pause(120);const snapped=await inspectCraft();assertCraftVisible(snapped);assert.ok(Math.hypot(snapped.flight.x-neutral.flight.x,snapped.flight.y-neutral.flight.y)>2,'flight craft must move to the selected destination');assertStationFixed(neutral,snapped,'destination snap');await screenshot('10-craft-destination-snap.png');await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:target.x,y:target.y,button:'left',buttons:0,clickCount:1});
  console.log('LOADOUT optical acceptance passed:',JSON.stringify({pulse,shock,fuel,oxygen,coolant,desktopDocked,desktopDragging,neutral,dragging,snapped,captureEnabled,reducedMotion}));
}finally{
  try{socket?.close();}catch{}
  try{child?.kill('SIGKILL');}catch{}
  await pause(100);server.close();await rm(profile,{recursive:true,force:true});
}
