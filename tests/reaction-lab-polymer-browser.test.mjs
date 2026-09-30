import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),routes=JSON.parse(await readFile(join(root,'data/polymerization-routes.json'),'utf8')).routes,polymers=JSON.parse(await readFile(join(root,'data/polymers.json'),'utf8'));
const hardRouteIds=['polyethylene-coordination','ethylene-propylene-coordination','polyethylene-oxide-anionic-ring-opening','polyethylene-terephthalate-direct-polycondensation','phenol-formaldehyde-resole','styrene-butadiene-radical','butyl-rubber-cationic','nylon-6-6-direct-polycondensation'];
const hardRoutes=hardRouteIds.map(id=>routes.find(route=>route.routeId===id));assert.equal(hardRoutes.filter(Boolean).length,8);
const moleculeIds=[...new Set([...routes.flatMap(route=>route.feedSpecies),'water'])],moleculeSave={schemaVersion:3,discoveredMolecules:moleculeIds.map((id,index)=>({id,at:index+1,order:index+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]};
const indexHtml=await readFile(join(root,'index.html'),'utf8'),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=normalize(join(root,pathname==='/'?'index.html':pathname.replace(/^\/+/,'')));if(!file.startsWith(root)){res.writeHead(403).end();return;}res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404).end('not found');}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const {port}=server.address();
let chrome=process.env.CHROMIUM_PATH??'';if(!chrome)for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'Chromium is required for Reaction Lab polymer pointer validation');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-polymer-lab-')),debugPort=9262,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let child=null,socket=null;
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:'ignore'});
  let tabs=null;for(let attempt=0;attempt<180;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await pause(100);}assert.ok(tabs?.length,'Polymer Reaction Lab DevTools endpoint did not become ready');
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map(),browserErrors=[];socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text);});
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  const waitFor=async(expression,label,timeout=16000)=>{for(let index=0;index<timeout/50;index++){try{const value=await evaluate(expression);if(value)return value;}catch{}await pause(50);}const state=await evaluate(`(()=>({url:location.href,title:document.title,dialog:document.querySelector('#reaction-lab-dialog')?.open,collection:document.querySelector('#collection-dialog')?.open,batch:window.__reactionLabProbe?.snapshot().batch,polymerization:window.__reactionLabProbe?.snapshot().polymerization,events:window.__polymerSampleEvents??[]}))()`);throw Error(`${label}: ${JSON.stringify({state,browserErrors})}`);};
  const snapshot=()=>evaluate('window.__reactionLabProbe.snapshot()');
  const wireDiscoveryEvents=()=>evaluate(`(()=>{window.__polymerSampleEvents=[];window.__polymerPresentEvents=[];window.__polymerDismissEvents=[];window.addEventListener('molecule-craft:reaction-lab-polymer-sample',event=>window.__polymerSampleEvents.push(event.detail));window.addEventListener('molecule-craft:reaction-lab-polymer-sample-present',event=>window.__polymerPresentEvents.push(event.detail));window.addEventListener('molecule-craft:reaction-lab-polymer-sample-dismiss',event=>window.__polymerDismissEvents.push(event.detail));return true})()`);
  const openLab=async()=>{await waitFor("!!document.querySelector('#open-reaction-lab')&&!document.querySelector('#open-reaction-lab').disabled&&!!window.__reactionLabProbe",'Reaction Lab app did not initialize');await evaluate("document.querySelector('#open-reaction-lab').click()");await waitFor("document.querySelector('#reaction-lab-dialog').open",'Reaction Lab did not open');};
  const seedPage=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('molecule-craft.collection.v1',${JSON.stringify(JSON.stringify(moleculeSave))});localStorage.setItem('molecule-craft.polymer-collection.v1',JSON.stringify({schemaVersion:1,discoveredPolymers:[]}));`});
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/?reactionLabTest=1&reactionLabPhysics=stage-b`});await openLab();await wireDiscoveryEvents();
  assert.equal((await snapshot()).physicsMode,'stage-b','the browser gate uses production Stage B');
  const setDraftSlots=async ids=>{
    for(let index=0;index<3;index++){
      const state=await snapshot(),current=state.batch.draftSlots[index]??'',next=ids[index]??'';if(current===next)continue;
      await waitFor("!window.__reactionLabProbe.snapshot().pickerOpen&&!window.__reactionLabProbe.snapshot().batch.transitionKind",'Feed Rack is still transitioning');
      await evaluate(`document.querySelectorAll('[data-lab-slot]')[${index}].click()`);await waitFor("!document.querySelector('[data-lab-picker]').hidden",'Species picker did not open');
      if(next)await evaluate(`(()=>{const input=document.querySelector('[data-lab-search]');input.value=${JSON.stringify(next)};input.dispatchEvent(new Event('input',{bubbles:true}));const option=document.querySelector('[data-lab-picker-list] [data-species="${next}"]');if(!option)throw Error('Feed picker lacks '+${JSON.stringify(next)});option.click()})()`);
      else await evaluate("document.querySelector('[data-lab-disconnect]').click()");
      await waitFor("document.querySelector('[data-lab-picker]').hidden",'Species picker did not close');
    }
  };
  const setEnvironment=async route=>{
    const requiredHeat=route.environment.requires.includes('heat'),requiredMedium=route.environment.requires.includes('basic')?'basic':route.environment.requires.includes('acidic')?'acidic':'neutral';
    let state=await snapshot();if(state.environment.light)await evaluate("document.querySelector('[data-lab-light]').click()");
    if(state.environment.heat!==requiredHeat)await evaluate("document.querySelector('[data-lab-heat]').click()");
    state=await snapshot();if(state.environment.medium!==requiredMedium){await evaluate("document.querySelector('[data-lab-medium-port]').click()");await waitFor("!document.querySelector('[data-lab-medium-selector]').hidden",'Existing pH equipment did not open');await evaluate(`document.querySelector('[data-lab-medium-option="${requiredMedium}"] input').click()`);}
  };
  const feedRoute=async(route,expectPurge)=>{
    await setDraftSlots(route.feedSpecies);const before=await snapshot();assert.deepEqual(before.batch.draftSlots.filter(Boolean).sort(),[...route.feedSpecies].sort(),`${route.routeId}: exact Feed slots are set`);
    await waitFor("!document.querySelector('[data-lab-feed]').disabled",`${route.routeId}: FEED is unavailable`);
    await evaluate("document.querySelector('[data-lab-feed]').click()");
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
      const state=await snapshot(),consumed=state.polymerization.consumedInstanceIds,reserved=new Set(state.polymerization.reservedInstanceIds),species=route.representativeSequence[consumed.length],candidate=state.instances.find(item=>reserved.has(item.id)&&item.species===species&&!consumed.includes(item.id));
      assert.ok(candidate,`${route.routeId} manual step ${manualIndex}: representative incoming monomer is reserved and draggable`);
      const plan=await evaluate(`window.__reactionLabProbe.polymerDockPlan(${JSON.stringify(candidate.id)})`);await pointerDrag(plan,candidate.id,route.routeId,manualIndex);
      assert.equal((await snapshot()).polymerization.manualStepCount,manualIndex,`${route.routeId}: exactly one manual chemistry step was committed`);
    }
  };
  const inspectSample=async route=>{
    await waitFor(`(()=>{const p=window.__reactionLabProbe.snapshot().polymerization;return p.state==='SAMPLE'&&!!p.sampleId&&p.sampleReady})()`,`${route.routeId}: finite PolymerSample did not dock and finish its visible hold`,20000);
    const state=await snapshot(),bay=await evaluate(`(()=>{const node=document.querySelector('[data-polymer-sample-bay]'),r=node.getBoundingClientRect(),e=[...document.querySelectorAll('.reaction-lab-equipment,.reaction-lab-medium-selector:not([hidden]),.reaction-lab-purge-outlet')].filter(n=>!n.hidden).map(n=>{const x=n.getBoundingClientRect();return{left:x.left-12,right:x.right+12,top:x.top-12,bottom:x.bottom+12}});return{hidden:node.hidden,region:node.dataset.region,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},equipment:e}})()`),events=await evaluate('window.__polymerSampleEvents.slice()');
    assert.equal(bay.hidden,false);assert.ok(['upper-left','upper-right'].includes(bay.region));for(const box of bay.equipment)assert.ok(bay.rect.right<=box.left||bay.rect.left>=box.right||bay.rect.bottom<=box.top||bay.rect.top>=box.bottom,`${route.routeId}: Sample Bay avoids equipment with margin: ${JSON.stringify({bay,box})}`);
    assert.equal(state.polymerization.routeId,route.routeId);assert.equal(state.polymerization.polymerId,route.polymerId);assert.equal(state.polymerization.sampleEvidence.unitCount,route.completionEvidence.unitCount);
    assert.equal(state.polymerization.sampleEvidence.interUnitLinks,route.completionEvidence.interUnitLinks);assert.equal(state.polymerization.sampleEvidence.ringOpenings,route.completionEvidence.ringOpenings);assert.equal(state.instances.some(item=>item.species==='PolymerSample'),false,'PolymerSample is outside Stage B instances');assert.ok(state.polymerization.sourceMeshCount>0,'source atom meshes remain the sample presentation');
    assert.ok(events.some(event=>event.routeId===route.routeId&&event.polymerId===route.polymerId&&event.sampleId===state.polymerization.sampleId),'registration event identifies this exact route sample');
    const saved=await evaluate(`JSON.parse(localStorage.getItem('molecule-craft.polymer-collection.v1')||'{}').discoveredPolymers`);assert.ok(saved.some(item=>item.id===route.polymerId));
    await waitFor("document.querySelector('#collection-dialog').open&&!!document.querySelector('#collection-detail [data-discovery-session-action]')&&!document.querySelector('#collection-detail [data-discovery-session-action]').disabled",`${route.routeId}: Collection NEW ENTRY did not complete`);
    const reveal=await evaluate(`(()=>({entry:document.querySelector('#collection-detail h3')?.textContent,marker:document.querySelector('[data-registration-marker]')?.textContent??'',action:document.querySelector('#collection-detail [data-discovery-session-action]')?.textContent,waterKnown:JSON.parse(localStorage.getItem('molecule-craft.collection.v1')||'{}').discoveredMolecules.some(item=>item.id==='water')}))()`);
    assert.equal(reveal.entry,polymers.find(item=>item.id===route.polymerId).nameJa);assert.match(reveal.marker,/REGISTERED|NEW ENTRY/);assert.equal(reveal.action,'REACTION LABへ戻る');assert.equal(reveal.waterKnown,true,'pre-discovered molecular byproduct does not add a second reveal');
    await evaluate("document.querySelector('#collection-detail [data-discovery-session-action]').click()");await waitFor("document.querySelector('#reaction-lab-dialog').open&&!document.querySelector('#collection-dialog').open",`${route.routeId}: NEW ENTRY did not return to the Lab`);
    const returned=await snapshot();assert.equal(returned.polymerization.sampleId,state.polymerization.sampleId,'sample remains docked after discovery presentation');assert.equal(returned.polymerization.sampleReady,true);return state.polymerization.sampleEvidence;
  };
  let previousSample=false;const normalEvidence=[];
  for(const route of hardRoutes){await feedRoute(route,previousSample);await runManualSteps(route);await waitFor(`window.__reactionLabProbe.snapshot().polymerization.state==='SAMPLE'`,`${route.routeId}: automatic final step did not complete`,18000);normalEvidence.push(await inspectSample(route));previousSample=true;}
  const discoveries=await evaluate(`JSON.parse(localStorage.getItem('molecule-craft.polymer-collection.v1')||'{}').discoveredPolymers`);assert.equal(discoveries.length,8);assert.deepEqual(discoveries.map(item=>item.order),[1,2,3,4,5,6,7,8]);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await send('Page.reload',{ignoreCache:true});
  await waitFor("!!document.querySelector('#open-reaction-lab')&&!document.querySelector('#open-reaction-lab').disabled&&!!window.__reactionLabProbe",'Reduced-motion reload did not initialize');await openLab();await wireDiscoveryEvents();
  const pe=hardRoutes[0];await feedRoute(pe,false);await runManualSteps(pe);await waitFor("window.__reactionLabProbe.snapshot().polymerization.state==='SAMPLE'&&window.__reactionLabProbe.snapshot().polymerization.sampleReady",'Reduced-motion PE sample did not complete its dock/hold',18000);
  const reduced=await snapshot(),reducedEvidence=reduced.polymerization.sampleEvidence,reference=normalEvidence[0];
  assert.deepEqual({unitCount:reducedEvidence.unitCount,interUnitLinks:reducedEvidence.interUnitLinks,ringOpenings:reducedEvidence.ringOpenings,byproducts:reducedEvidence.byproducts.map(item=>item.species),features:reducedEvidence.features},{unitCount:reference.unitCount,interUnitLinks:reference.interUnitLinks,ringOpenings:reference.ringOpenings,byproducts:reference.byproducts.map(item=>item.species),features:reference.features},'reduced motion changes only presentation timing, not PolymerSample chemistry');
  assert.equal(reduced.polymerization.sampleReady,true);assert.equal(reduced.instances.some(item=>item.species==='PolymerSample'),false);assert.deepEqual(browserErrors,[],'No browser exception is raised by polymer gameplay');
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await pause(100);server.close();await rm(profile,{recursive:true,force:true});}
console.log('Reaction Lab polymer pointer browser validation passed: 8/8 390×844 hard routes, 2 real pointer chemistry steps each, sample persistence/purge/Collection return, and matching reduced-motion chemistry.');
