import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),routes=JSON.parse(await readFile(join(root,'data/polymerization-routes.json'),'utf8')).routes,polymers=JSON.parse(await readFile(join(root,'data/polymers.json'),'utf8'));
const hardRouteIds=['polybutadiene-coordination-1-4','polyacrylonitrile-radical','phenol-formaldehyde-resole','polyvinyl-chloride-radical'];
const hardRoutes=hardRouteIds.map(id=>routes.find(route=>route.routeId===id));assert.equal(hardRoutes.filter(Boolean).length,4);
// This browser resumes a checkpoint earned by production flight, pickup and CRAFT APIs.
// It never seeds polymer discovery, engineering.fabricated or activeApplications.
import {preCoreCheckpoint,awaken,acquireRare,craftInputs} from './helpers/material-progression-fixture.mjs';
const {resources,storage}=preCoreCheckpoint();awaken(resources);
for(const [element,region] of [['P','veil'],['S','carbon'],['Cl','nitrogen']])acquireRare(resources,element,region);
craftInputs(resources,storage,['1-3-butadiene','acrylonitrile','phenol','formaldehyde','vinyl-chloride','phosphoric-acid','water']);resources.save();
const checkpoint=Object.fromEntries(storage.values);
const indexHtml=await readFile(join(root,'index.html'),'utf8'),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=normalize(join(root,pathname==='/'?'index.html':pathname.replace(/^\/+/,'')));if(!file.startsWith(root)){res.writeHead(403).end();return;}res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});let body=await readFile(file);if(pathname==='/src/veil/ui.js')body=Buffer.from(body.toString().replace('function frame(now){','function frame(now){globalThis.__materialFieldProbe=()=>({run,renderer});'));res.end(body);}catch{res.writeHead(404).end('not found');}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const {port}=server.address();
let chrome=process.env.CHROMIUM_PATH??'';if(!chrome)for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'Chromium is required for Reaction Lab polymer pointer validation');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-polymer-lab-')),debugPort=9264,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let child=null,socket=null;
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:'ignore'});
  let tabs=null;for(let attempt=0;attempt<180;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await pause(100);}assert.ok(tabs?.length,'Polymer Reaction Lab DevTools endpoint did not become ready');
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map(),browserErrors=[];socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text);});
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  const waitFor=async(expression,label,timeout=16000)=>{for(let index=0;index<timeout/50;index++){try{const value=await evaluate(expression);if(value)return value;}catch{}await pause(50);}const state=await evaluate(`(()=>({url:location.href,title:document.title,dialog:document.querySelector('#reaction-lab-dialog')?.open,collection:document.querySelector('#collection-dialog')?.open,partial:document.querySelector('#partial-fill-confirm')?.hidden,supply:document.querySelector('#supply-dialog')?.open,field:document.querySelector('#veil-view')?.hidden,batch:window.__reactionLabProbe?.snapshot().batch,polymerization:window.__reactionLabProbe?.snapshot().polymerization,events:window.__polymerSampleEvents??[]}))()`);throw Error(`${label}: ${JSON.stringify({state,browserErrors})}`);};
  const tap=async selector=>{
    const point=await evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)throw Error('Missing pointer target');node.scrollIntoView({block:'center'});const r=node.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,disabled:node.disabled};})()`);
    assert.ok(point.w>0&&point.h>0&&point.x>=0&&point.x<=390&&point.y>=0&&point.y<=844&&!point.disabled,`${selector}: visible enabled mobile target ${JSON.stringify(point)}`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});
  };
  const snapshot=()=>evaluate('window.__reactionLabProbe.snapshot()');
  const wireDiscoveryEvents=()=>evaluate(`(()=>{window.__polymerSampleEvents=[];window.__polymerPresentEvents=[];window.__polymerDismissEvents=[];window.addEventListener('molecule-craft:reaction-lab-polymer-sample',event=>window.__polymerSampleEvents.push(event.detail));window.addEventListener('molecule-craft:reaction-lab-polymer-sample-present',event=>window.__polymerPresentEvents.push(event.detail));window.addEventListener('molecule-craft:reaction-lab-polymer-sample-dismiss',event=>window.__polymerDismissEvents.push(event.detail));return true})()`);
  const openLab=async()=>{await waitFor("!!document.querySelector('#open-reaction-lab')&&!document.querySelector('#open-reaction-lab').disabled&&!!window.__reactionLabProbe",'Reaction Lab app did not initialize');await tap('#open-reaction-lab');await waitFor("document.querySelector('#reaction-lab-dialog').open",'Reaction Lab did not open');};
  const seedPage=await send('Page.addScriptToEvaluateOnNewDocument',{source:`for(const [key,value] of Object.entries(${JSON.stringify(checkpoint)}))localStorage.setItem(key,value);`});
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/?reactionLabTest=1&reactionLabPhysics=stage-b`});
  await waitFor("!!document.querySelector('#open-collector-applications')&&!document.querySelector('#open-supply').disabled",'post-Awakening application startup');
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:seedPage.identifier});
  await tap('#open-supply');await tap('#open-collector-applications');assert.equal(await evaluate("document.querySelectorAll('[data-collector-application][data-state=locked]:disabled').length"),3);await tap('#collector-applications-dialog .sheet-header button');
  await tap('#collector-launch-handle');await waitFor("document.querySelector('#expedition-destinations').getAttribute('aria-hidden')==='false'",'Rare expedition selector');await tap('#expedition-destinations [data-region=veil]');await pause(100);if(await evaluate("!!document.querySelector('#partial-fill-confirm')&&!document.querySelector('#partial-fill-confirm').hidden"))await tap('#partial-fill-confirm .primary');await waitFor("!!window.__materialFieldProbe?.().run&&!document.querySelector('#veil-view').hidden",'Rare FIELD entry');
  assert.equal(await evaluate("window.__materialFieldProbe().run.config.worldAwakened"),true);
  const pad=await evaluate("(()=>{const r=document.querySelector('#veil-pad').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
  const steerTo=async(target,radius,{element=null}={})=>{
    // Stop at the acquisition event, and slow down before a point target. The
    // pilot must not orbit an already-collected socket while waiting for one
    // exact 50 ms position sample on a differently paced CI browser.
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...pad,button:'left',buttons:1,clickCount:1});
    let reached=false,driving=false,lastState;
    for(let n=0;n<600;n++){
      const p=await evaluate("(()=>{const r=window.__materialFieldProbe().run;return{x:r.player.x,y:r.player.y,vx:r.player.vx,vy:r.player.vy,captured:r.captured,time:r.time,cargo:r.elementDust,fuel:r.fuel,driveHeld:r.driveHeld}})()");lastState=p;
      const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy);
      assert.equal(p.captured,false,`pointer pilot captured: ${JSON.stringify({target,radius,d,state:p,pad})}`);
      if(d<radius||element&&p.cargo[element]>0){reached=true;break;}
      const shouldDrive=d>400;if(shouldDrive!==driving){await send('Input.dispatchKeyEvent',{type:shouldDrive?'rawKeyDown':'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16});driving=shouldDrive;}
      const magnitude=shouldDrive?1:Math.max(.2,Math.min(1,d/250));
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:pad.x+dx/d*48*magnitude,y:pad.y+dy/d*48*magnitude,button:'left',buttons:1});await pause(50);
    }
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...pad,button:'left',buttons:0});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16});assert.ok(reached,`normal pointer flight reaches waypoint: ${JSON.stringify({target,state:lastState})}`);
  };
  const rare=await evaluate("(()=>{const r=window.__materialFieldProbe().run;const d=r.map.dust.filter(x=>x.rareEcology&&x.element==='P').sort((a,b)=>Math.hypot(a.x-r.player.x,a.y-r.player.y)-Math.hypot(b.x-r.player.x,b.y-r.player.y))[0];return{x:d.x,y:d.y}})()");
  await steerTo(rare,25,{element:'P'});await waitFor("window.__materialFieldProbe().run.elementDust.P>0",'pointer flight collects Rare P');
  const site=await evaluate("(()=>{const r=window.__materialFieldProbe().run;const s=r.map.safeExtractionSites.sort((a,b)=>Math.hypot(a.x-r.player.x,a.y-r.player.y)-Math.hypot(b.x-r.player.x,b.y-r.player.y))[0];return{x:s.x,y:s.y,radius:s.radius}})()");await steerTo(site,site.radius*.7);
  await waitFor("document.querySelector('#veil-status-panel').dataset.state==='site-ready'",'safe return ready');
  const ship=await evaluate("(()=>{const {run,renderer}=window.__materialFieldProbe(),r=document.querySelector('#veil-canvas').getBoundingClientRect(),p=renderer.screen(run.player.x,run.player.y);return{x:r.x+p.x,y:r.y+p.y}})()");await send('Input.dispatchMouseEvent',{type:'mousePressed',...ship,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...ship,button:'left',buttons:0});await waitFor("document.querySelector('#veil-view').hidden",'normal return settles Rare inventory');
  console.log('Mobile Rare acquisition / normal return PASS');
  await openLab();await wireDiscoveryEvents();
  assert.equal((await snapshot()).physicsMode,'stage-b','the browser gate uses production Stage B');
  const setDraftSlots=async ids=>{
    for(let index=0;index<3;index++){
      const state=await snapshot(),current=state.batch.draftSlots[index]??'',next=ids[index]??'';if(current===next)continue;
      await waitFor("!window.__reactionLabProbe.snapshot().pickerOpen&&!window.__reactionLabProbe.snapshot().batch.transitionKind",'Feed Rack is still transitioning');
      await tap(`[data-lab-slot="${index}"]`);await waitFor("!document.querySelector('[data-lab-picker]').hidden",'Species picker did not open');
      if(next)await evaluate(`(()=>{const input=document.querySelector('[data-lab-search]');input.value=${JSON.stringify(next)};input.dispatchEvent(new Event('input',{bubbles:true}));const option=document.querySelector('[data-lab-picker-list] [data-species="${next}"]');if(!option)throw Error('Feed picker lacks '+${JSON.stringify(next)});})()`);
      if(next)await tap(`[data-lab-picker-list] [data-species="${next}"]`);
      else await tap('[data-lab-disconnect]');
      await waitFor("document.querySelector('[data-lab-picker]').hidden",'Species picker did not close');
    }
  };
  const setEnvironment=async route=>{
    const requiredHeat=route.environment.requires.includes('heat'),requiredMedium=route.environment.requires.includes('basic')?'basic':route.environment.requires.includes('acidic')?'acidic':'neutral';
    let state=await snapshot();if(state.environment.light)await tap('[data-lab-light]');
    if(state.environment.heat!==requiredHeat)await tap('[data-lab-heat]');
    state=await snapshot();if(state.environment.medium!==requiredMedium){await tap('[data-lab-medium-port]');await waitFor("!document.querySelector('[data-lab-medium-selector]').hidden",'Existing pH equipment did not open');await tap(`[data-lab-medium-option="${requiredMedium}"] input`);}
  };
  const feedRoute=async(route,expectPurge)=>{
    await setDraftSlots(route.feedSpecies);const before=await snapshot();assert.deepEqual(before.batch.draftSlots.filter(Boolean).sort(),[...route.feedSpecies].sort(),`${route.routeId}: exact Feed slots are set`);
    await waitFor("!document.querySelector('[data-lab-feed]').disabled",`${route.routeId}: FEED is unavailable`);
    await tap('[data-lab-feed]');
    if(expectPurge)await waitFor("window.__reactionLabProbe.snapshot().purging.some(item=>item.species==='PolymerSample')",`${route.routeId}: next FEED did not PURGE prior PolymerSample`,5000);
    await waitFor(`(()=>{const s=window.__reactionLabProbe.snapshot();return s.batch.phase==='ACTIVE'&&s.polymerization.routeId===${JSON.stringify(route.routeId)}&&['WAITING','AUTO_PENDING','SAMPLE'].includes(s.polymerization.state)})()`,`${route.routeId}: polymer route did not own its exact Feed batch`,22000);
    await setEnvironment(route);
    await waitFor(`window.__reactionLabProbe.snapshot().polymerization.waitReason!=='conditions'`,`${route.routeId}: route conditions did not become valid`);
  };
  const pointerDrag=async(plan,instanceId,routeId,manualIndex)=>{
    const rect=await evaluate(`(()=>{const r=document.querySelector('#reaction-lab canvas').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,documentWidth:document.documentElement.clientWidth,documentScroll:document.documentElement.scrollWidth}})()`);
    assert.ok(plan.start.x>=rect.x&&plan.start.x<=rect.x+rect.width&&plan.start.y>=rect.y&&plan.start.y<=rect.y+rect.height,`${routeId} manual step ${manualIndex}: reactive site is visible in the 390×844 chamber: ${JSON.stringify(plan)}`);
    assert.ok(plan.end.x>=rect.x&&plan.end.x<=rect.x+rect.width&&plan.end.y>=rect.y&&plan.end.y<=rect.y+rect.height,`${routeId} manual step ${manualIndex}: projected target remains visible: ${JSON.stringify(plan)}`);
    assert.ok(rect.documentScroll<=rect.documentWidth+1,`${routeId} manual step ${manualIndex}: no horizontal overflow`);
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:plan.start.x,y:plan.start.y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x:plan.start.x,y:plan.start.y,button:'left',buttons:1,clickCount:1});await pause(40);
    assert.equal((await snapshot()).draggedInstanceId,instanceId,`${routeId} manual step ${manualIndex} acquires the intended real monomer on the first pointer target`);
    for(let step=1;step<=12;step++){const t=step/12;await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:plan.start.x+(plan.end.x-plan.start.x)*t,y:plan.start.y+(plan.end.y-plan.start.y)*t,button:'left',buttons:1});await pause(20);}
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:plan.end.x,y:plan.end.y,button:'left',buttons:0});
    await waitFor(`(()=>{const p=window.__reactionLabProbe.snapshot().polymerization;return p.manualStepCount===${manualIndex}&&p.state!=='TRANSFORMING'})()`,`${routeId} manual step ${manualIndex} did not commit from a pointer gesture`,9000);
    assert.equal((await snapshot()).pointerActive,false,`${routeId} manual gesture releases pointer capture`);
    await pause(360);
  };
  const runManualSteps=async route=>{
    for(let manualIndex=1;manualIndex<=route.interactionCadence.manualSteps;manualIndex++){
      await waitFor("!!window.__reactionLabProbe.snapshot().polymerization.siteTarget",`${route.routeId} manual step ${manualIndex}: stable reactive site is presented`);
      const state=await snapshot(),consumed=state.polymerization.consumedInstanceIds,reserved=new Set(state.polymerization.reservedInstanceIds),species=route.representativeSequence[consumed.length],candidate=state.instances.find(item=>reserved.has(item.id)&&item.species===species&&!consumed.includes(item.id));
      assert.ok(candidate,`${route.routeId} manual step ${manualIndex}: representative incoming monomer is reserved and draggable`);
      const plan=await evaluate(`window.__reactionLabProbe.polymerDockPlan(${JSON.stringify(candidate.id)})`);await pointerDrag(plan,candidate.id,route.routeId,manualIndex);
      assert.equal((await snapshot()).polymerization.manualStepCount,manualIndex,`${route.routeId}: exactly one manual chemistry step was committed`);
    }
  };
  const inspectSample=async route=>{
    await waitFor(`(()=>{const p=window.__reactionLabProbe.snapshot().polymerization,bay=document.querySelector('[data-polymer-sample-bay]');return p.state==='SAMPLE'&&!!p.sampleId&&p.samplePhase==='hold'&&!p.sampleReady&&bay&&!bay.hidden})()`,`${route.routeId}: PolymerSample did not dock into the visible Sample Bay before Collection handoff`,20000);
    const state=await snapshot(),bay=await evaluate(`(()=>{const node=document.querySelector('[data-polymer-sample-bay]'),r=node.getBoundingClientRect(),e=[...document.querySelectorAll('.reaction-lab-equipment,.reaction-lab-medium-selector:not([hidden]),.reaction-lab-purge-outlet')].filter(n=>!n.hidden).map(n=>{const x=n.getBoundingClientRect();return{left:x.left-12,right:x.right+12,top:x.top-12,bottom:x.bottom+12}});return{hidden:node.hidden,region:node.dataset.region,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},equipment:e}})()`),events=await evaluate('window.__polymerSampleEvents.slice()');
    assert.equal(bay.hidden,false);assert.ok(['upper-left','upper-right'].includes(bay.region));for(const box of bay.equipment)assert.ok(bay.rect.right<=box.left||bay.rect.left>=box.right||bay.rect.bottom<=box.top||bay.rect.top>=box.bottom,`${route.routeId}: Sample Bay avoids equipment with margin: ${JSON.stringify({bay,box})}`);
    assert.equal(state.polymerization.routeId,route.routeId);assert.equal(state.polymerization.polymerId,route.polymerId);assert.equal(state.polymerization.sampleEvidence.unitCount,route.completionEvidence.unitCount);
    assert.equal(state.polymerization.sampleEvidence.interUnitLinks,route.completionEvidence.interUnitLinks);assert.equal(state.polymerization.sampleEvidence.ringOpenings,route.completionEvidence.ringOpenings);assert.equal(state.instances.some(item=>item.species==='PolymerSample'),false,'PolymerSample is outside Stage B instances');assert.ok(state.polymerization.sourceMeshCount>0,'source atom meshes remain the sample presentation');
    assert.ok(events.some(event=>event.routeId===route.routeId&&event.polymerId===route.polymerId&&event.sampleId===state.polymerization.sampleId),'registration event identifies this exact route sample');
    const saved=await evaluate(`JSON.parse(localStorage.getItem('molecule-craft.polymer-collection.v1')||'{}').discoveredPolymers`);assert.ok(saved.some(item=>item.id===route.polymerId));
    await waitFor(`window.__reactionLabProbe.snapshot().polymerization.sampleReady`,`${route.routeId}: Sample Bay visible hold did not finish`);
    await waitFor("document.querySelector('#collection-dialog').open&&!!document.querySelector('#collection-detail [data-discovery-session-action]')&&!document.querySelector('#collection-detail [data-discovery-session-action]').disabled",`${route.routeId}: Collection NEW ENTRY did not complete`);
    const reveal=await evaluate(`(()=>({entry:document.querySelector('#collection-detail h3')?.textContent,marker:document.querySelector('[data-registration-marker]')?.textContent??'',action:document.querySelector('#collection-detail [data-discovery-session-action]')?.textContent,waterKnown:JSON.parse(localStorage.getItem('molecule-craft.collection.v1')||'{}').discoveredMolecules.some(item=>item.id==='water')}))()`);
    assert.equal(reveal.entry,polymers.find(item=>item.id===route.polymerId).nameJa);assert.match(reveal.marker,/REGISTERED|NEW ENTRY/);assert.equal(reveal.action,'REACTION LABへ戻る');assert.equal(reveal.waterKnown,true,'pre-discovered molecular byproduct does not add a second reveal');
    await tap('#collection-detail [data-discovery-session-action]');await waitFor("document.querySelector('#reaction-lab-dialog').open&&!document.querySelector('#collection-dialog').open",`${route.routeId}: NEW ENTRY did not return to the Lab`);
    const returned=await snapshot();assert.equal(returned.polymerization.sampleId,state.polymerization.sampleId,'sample remains docked after discovery presentation');assert.equal(returned.polymerization.sampleReady,true);return state.polymerization.sampleEvidence;
  };
  const openPolymer=async id=>{await tap('[data-lab-close]');await waitFor("!document.querySelector('#reaction-lab-dialog').open",'Lab closed');await pause(100);await tap('#open-collection');await waitFor("document.querySelector('#collection-dialog').open",'Collection open');await tap('[data-book-tab=polymers]');await tap(`[data-entry-id="${id}"]`);await waitFor(`document.querySelector('#collection-detail').dataset.detailId===${JSON.stringify(id)}`,'polymer detail');};
  let previousSample=false;const evidence=[];
  for(const route of hardRoutes){
    console.log('Mobile route',route.routeId);await feedRoute(route,previousSample);await runManualSteps(route);evidence.push(await inspectSample(route));previousSample=true;
    const sampleId=(await snapshot()).polymerization.sampleId;
    await openPolymer(route.polymerId);
    const recipe={'polybutadiene':'br-sulfur-wear','polyacrylonitrile':'pan-phenolic-thermal','phenol-formaldehyde-resin':'pan-phenolic-thermal','polyvinyl-chloride':'pvc-insulation'}[route.polymerId];
    await waitFor(`!!document.querySelector('[data-fabricate-recipe="${recipe}"]')`,'fabrication surface');
    if(route.polymerId==='polyacrylonitrile')assert.equal(await evaluate(`document.querySelector('[data-fabricate-recipe="${recipe}"]').disabled`),true,'resin is still required');
    else{const before=await evaluate("JSON.parse(localStorage.getItem('molecule-craft.resources.v1')).elements");await tap(`[data-fabricate-recipe="${recipe}"]`);assert.equal(await evaluate(`document.querySelector('[data-fabricate-recipe="${recipe}"]').disabled`),true);const after=await evaluate("JSON.parse(localStorage.getItem('molecule-craft.resources.v1')).elements");const cost=recipe==='br-sulfur-wear'?{S:1}:recipe==='pan-phenolic-thermal'?{P:1,H:3,O:4}:{};for(const key of Object.keys(before))assert.equal(after[key],before[key]-(cost[key]??0));}
    await tap('#close-collection');await waitFor("!document.querySelector('#collection-dialog').open&&!document.body.classList.contains('collection-open')",'Collection close completes');await pause(100);await openLab();assert.equal((await snapshot()).polymerization.sampleId,sampleId,'fabrication leaves Sample Bay intact');
  }
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('molecule-craft.polymer-collection.v1')).discoveredPolymers.length"),4);
  await send('Page.reload',{ignoreCache:true});await waitFor("!!document.querySelector('#open-collector-applications')&&!document.querySelector('#open-supply').disabled",'checkpoint D reload');
  const fabricated=await evaluate("JSON.parse(localStorage.getItem('molecule-craft.resources.v1')).engineering.fabricated");assert.deepEqual(fabricated,{WEAR_SKIN:true,THERMAL_SHELL:true,CONTROL_INSULATION:true});
  await tap('#open-supply');await tap('#open-collector-applications');assert.equal(await evaluate("document.querySelectorAll('[data-collector-application][data-state=available]').length"),3);
  const stock=await evaluate("JSON.parse(localStorage.getItem('molecule-craft.resources.v1')).elements");
  for(const id of Object.keys(fabricated)){await tap(`[data-collector-application=${id}]`);await tap(`[data-collector-application=${id}]`);await tap(`[data-collector-application=${id}]`);}
  assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('molecule-craft.resources.v1')).elements"),stock);
  await send('Page.reload',{ignoreCache:true});await waitFor("!!document.querySelector('#open-collector-applications')&&!document.querySelector('#open-supply').disabled",'checkpoint F reload');await tap('#open-supply');await tap('#open-collector-applications');assert.equal(await evaluate("document.querySelectorAll('[data-collector-application][data-state=active]').length"),3);
  const bounds=await evaluate("(()=>{const d=document.querySelector('#collector-applications-dialog'),r=d.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:d.scrollWidth-d.clientWidth}})()");assert.ok(bounds.left>=0&&bounds.right<=390&&bounds.top>=0&&bounds.bottom<=844&&bounds.overflow<=1);
  await tap('#collector-applications-dialog .sheet-header button');await tap('#collector-launch-handle');await waitFor("document.querySelector('#expedition-destinations').getAttribute('aria-hidden')==='false'",'destination selector');await tap('#expedition-destinations [data-region=veil]');await pause(100);if(await evaluate("!!document.querySelector('#partial-fill-confirm')&&!document.querySelector('#partial-fill-confirm').hidden"))await tap('#partial-fill-confirm .primary');await waitFor("!!window.__materialFieldProbe?.().run&&!document.querySelector('#veil-view').hidden",'FIELD entry');
  assert.deepEqual(await evaluate("window.__materialFieldProbe().run.collectorMaterial.activeApplications"),fabricated);
  // Controlled, authored exposure positions compare actual FIELD feedback; normal flight/pickup is tested by the checkpoint producer.
  for(const [position,label] of [[{x:105,y:-6535},'摩耗軽減'],[{x:760,y:-11300},'熱伝達軽減'],[{x:660,y:-5370},'制御低下軽減']]){await evaluate(`Object.assign(window.__materialFieldProbe().run.player,${JSON.stringify(position)},{vx:0,vy:0})`);await waitFor(`document.querySelector('#veil-region-subtitle').textContent.includes(${JSON.stringify(label)})`,'FIELD feedback '+label);}
  assert.deepEqual(browserErrors,[]);console.log('Material progression mobile pointer closure',JSON.stringify({routeIds:hardRouteIds,samples:evidence.length,bounds}));
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await pause(100);server.close();await rm(profile,{recursive:true,force:true});}
console.log('390×844 material progression: actual FEED, 4 polymer routes, fabrication, free toggles, reload, FIELD cache and feedback PASS.');
