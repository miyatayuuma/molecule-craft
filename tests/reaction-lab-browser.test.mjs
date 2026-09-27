import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join,normalize,resolve} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(request,response)=>{
  try{const path=new URL(request.url,'http://localhost').pathname==='/'?'index.html':decodeURIComponent(new URL(request.url,'http://localhost').pathname).replace(/^\/+/,''),file=normalize(join(root,path));if(!file.startsWith(root))throw Error();response.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});response.end(await readFile(file));}
  catch{response.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const {port}=server.address();
let chrome='';
for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'Chromium is required for Reaction Lab mobile validation');
const debugPort=9237,profile=`/tmp/molecule-craft-reaction-lab-${process.pid}`;let child,socket;

try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:'ignore'});
  let tabs;
  for(let index=0;index<180;index++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  assert.ok(tabs?.length,'Chromium DevTools endpoint not ready');
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map(),browserErrors=[];
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}});
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')browserErrors.push({type:'exception',text:message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text});else if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')browserErrors.push({type:'console',text:message.params.args?.map(arg=>arg.value??arg.description).join(' ')});else if(message.method==='Network.loadingFailed')browserErrors.push({type:'network',error:message.params.errorText});});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  const waitFor=async(expression,label,timeout=8000)=>{for(let index=0;index<timeout/40;index++){const value=await evaluate(expression);if(value)return value;await new Promise(resolve=>setTimeout(resolve,40));}const state=await evaluate("({readyState:document.readyState,title:document.title,button:!!document.querySelector('#open-reaction-lab'),disabled:document.querySelector('#open-reaction-lab')?.disabled,dialog:!!document.querySelector('#reaction-lab-dialog'),probe:!!window.__reactionLabProbe})");throw Error(`${label}: ${JSON.stringify({state,browserErrors})}`);};
  const setSlots=async ids=>evaluate(`(()=>{const slots=[...document.querySelectorAll('[data-lab-slot]')];${JSON.stringify(ids)}.forEach((id,index)=>{slots[index].value=id;slots[index].dispatchEvent(new Event('change',{bubbles:true}));});return document.querySelector('[data-lab-status]').textContent;})()`);
  const snapshot=()=>evaluate('window.__reactionLabProbe.snapshot()');
  const waitForPopulation=async(species,total,label)=>waitFor(`(()=>{const rows=window.__reactionLabProbe?.snapshot().instances??[];return rows.length===${total}&&${JSON.stringify(species)}.every(id=>rows.some(row=>row.species===id))})()`,label);
  const drag=async(plan,{steps=12,stepDelay=20,hold=720,duringHold=null}={})=>{
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:plan.start.x,y:plan.start.y});
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:plan.start.x,y:plan.start.y,button:'left',buttons:1,clickCount:1});
    for(let step=1;step<=steps;step++){const progress=step/steps;await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:plan.start.x+(plan.end.x-plan.start.x)*progress,y:plan.start.y+(plan.end.y-plan.start.y)*progress,button:'left',buttons:1});await new Promise(resolve=>setTimeout(resolve,stepDelay));}
    if(duringHold)await duringHold();else if(hold)await new Promise(resolve=>setTimeout(resolve,hold));
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:plan.end.x,y:plan.end.y,button:'left',buttons:0});
  };
  const runReaction=async(ruleId,products)=>{
    const plan=await evaluate(`window.__reactionLabProbe.prepareContact('${ruleId}')`);
    assert.ok(plan.initialDistance>1.18&&plan.initialDistance<3,`contact setup starts outside the reaction threshold: ${JSON.stringify(plan)}`);
    await drag(plan,{steps:4,stepDelay:12,hold:0});
    const contact=await evaluate(`(()=>{window.__reactionLabProbe.setGeometry(${JSON.stringify(plan.contactPoses)});return window.__reactionLabProbe.reactionContactDiagnostics('${ruleId}').map(({ids,distance,maxDistance,isolationEligible})=>({ids,distance,maxDistance,isolationEligible}))})()`);
    assert.ok(contact.some(item=>item.isolationEligible&&item.distance<item.maxDistance),`deterministic contact pose must enter the registered reaction range: ${JSON.stringify(contact)}`);
    await new Promise(resolve=>setTimeout(resolve,900));const state=await snapshot();assert.equal(state.dialogOpen,true,'Reaction commit must not close the Lab');
    try{await waitFor("document.querySelector('[data-lab-status]').textContent.startsWith('反応完了')",`${ruleId} did not complete from a real canvas drag`,10000);}catch(error){const contact=await evaluate(`window.__reactionLabProbe.reactionContactDiagnostics('${ruleId}').map(({ids,distance,maxDistance,contactPairActive,busy,isolationEligible})=>({ids,distance,maxDistance,contactPairActive,busy,isolationEligible}))`);throw Error(`${error.message}; reaction contact=${JSON.stringify(contact)}`);}
    await waitFor(`window.__labReactionEvents.at(-1)?.ruleId==='${ruleId}'`,'Reaction product event was not emitted',2000);
    const result=await evaluate('window.__labReactionEvents.at(-1)');
    assert.deepEqual(result.products,products);
    let remaining=await snapshot();assert.equal(remaining.pointerActive,false,'Reaction completion clears stale drag/pointer state');for(const product of products)assert.ok(remaining.instances.some(item=>item.species===product),`3D product instance missing: ${product}`);
    assert.equal(remaining.instances.filter(item=>products.includes(item.species)).length,products.length,'Reaction must spawn the correct product instance count');
    assert.equal(remaining.instances.some(item=>item.busy),false,'products and remaining species become manipulable after commitment');
    const productInstances=remaining.instances.filter(item=>products.includes(item.species));await evaluate(`window.__reactionLabProbe.setGeometry(${JSON.stringify(productInstances.map((item,index)=>({id:item.id,positionAngstrom:[index?2:-2,0,0],orientation:[0,0,0,1]})))})`);remaining=await snapshot();
    const product=remaining.instances.find(item=>products.includes(item.species)),movePlan=await evaluate(`window.__reactionLabProbe.dragPlan('${product.id}',0,[0.32,0,0])`),before=product.position;
    await drag(movePlan,{steps:4,stepDelay:16,hold:0});const moved=await snapshot(),after=moved.instances.find(item=>item.id===product.id).position;
    assert.ok(Math.hypot(...after.map((value,index)=>value-before[index]))>.15,'Generated products remain individually movable');
  };

  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('molecule-craft.collection.v1',JSON.stringify({schemaVersion:3,discoveredMolecules:${JSON.stringify(['water','ethanol','acetic-anhydride','acetic-acid','ethyl-acetate','oxygen','hydrogen','acetone','pyridine','methane','carbon-dioxide','carbonic-acid','hexamethylenediamine','isoamyl-acetate','methylcyclohexane'].map((id,index)=>({id,at:index+1,order:index+1})))},discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]}));`});
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/?reactionLabTest=1`});
  await waitFor("!!document.querySelector('#open-reaction-lab')&&!document.querySelector('#open-reaction-lab').disabled&&!!window.__reactionLabProbe",'Reaction Lab entry did not initialize');
  await evaluate("window.__labReactionEvents=[];window.addEventListener('molecule-craft:reaction-lab-product',event=>window.__labReactionEvents.push(event.detail));document.querySelector('#open-reaction-lab').click()");
  await waitFor("document.querySelector('#reaction-lab-dialog').open",'Reaction Lab dialog did not open');
  const initial=await evaluate("(()=>{const d=document.querySelector('#reaction-lab-dialog').getBoundingClientRect(),c=document.querySelector('#reaction-lab canvas').getBoundingClientRect();return{dialog:[d.width,d.height],canvas:[c.width,c.height],slots:document.querySelectorAll('[data-lab-slot]').length}})()");
  assert.equal(initial.slots,3);assert.ok(initial.dialog[0]>=389&&initial.dialog[1]>=843,`390x844 scene did not fill the mobile viewport: ${JSON.stringify(initial)}`);
  await setSlots(['water','','']);await waitFor("document.querySelector('[data-lab-status]').textContent.includes('4 個')",'Water-only population did not create four molecules');
  await evaluate("document.querySelector('[data-lab-mode=rotate]').click();document.querySelector('[data-lab-mode=view]').click()");
  const modes=await evaluate("[...document.querySelectorAll('[data-lab-mode]')].map(button=>button.getAttribute('aria-pressed'))");assert.deepEqual(modes,['false','false','true']);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:145,y:370});await send('Input.dispatchMouseEvent',{type:'mousePressed',x:145,y:370,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:205,y:405,button:'left',buttons:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:205,y:405,button:'left',buttons:0});
  await evaluate("document.querySelector('[data-lab-mode=move]').click()");
  let productionState=await snapshot();assert.equal(productionState.physicsMode,'stage-b');assert.equal(productionState.qA,.15);assert.equal('bonds' in productionState,false,'Production has no H-bond lifecycle state');assert.equal(productionState.instances.every(item=>item.renderedObjectCount===item.expectedRealObjectCount),true,'Stage B sites remain invisible');
  const productionWaters=productionState.instances.filter(item=>item.species==='water');assert.equal(productionWaters.length,4);
  const waterPairPoses=[{id:productionWaters[0].id,positionAngstrom:[0,0,0],orientation:[0,0,0,1]},{id:productionWaters[1].id,positionAngstrom:[8,0,0],orientation:[0,0,0,1]}];
  const waterPair=await evaluate(`(()=>{window.__reactionLabProbe.setGeometry(${JSON.stringify(waterPairPoses)});return window.__reactionLabProbe.decomposePair('${productionWaters[0].id}','${productionWaters[1].id}')})()`);assert.equal(waterPair.overlapGuardActivationCount,0);assert.ok(waterPair.pairs.every(pair=>[pair.coulombEnergyKcalMol,pair.ljEnergyKcalMol,pair.totalEnergyKcalMol,...pair.forceOnA,...pair.torqueOnA].every(Number.isFinite)));
  const sameWaterPair=await evaluate(`(()=>{window.__reactionLabProbe.advanceDeterministic(2);window.__reactionLabProbe.setGeometry(${JSON.stringify(waterPairPoses)});return window.__reactionLabProbe.decomposePair('${productionWaters[0].id}','${productionWaters[1].id}')})()`);
  assert.deepEqual(sameWaterPair.bodies,waterPair.bodies,'The same Stage B geometry has the same force and torque independent of prior history');
  await setSlots(['water','acetone','']);await waitForPopulation(['water','acetone'],4,'Production water/acetone scene did not spawn');
  await evaluate("window.__reactionLabProbe.placeSpeciesPair('water','acetone',8)");productionState=await snapshot();const productionWater=productionState.instances.find(item=>item.species==='water'),productionAcetone=productionState.instances.find(item=>item.species==='acetone');
  const productionAcetonePair=await evaluate(`window.__reactionLabProbe.decomposePair('${productionWater.id}','${productionAcetone.id}')`);assert.ok(productionAcetonePair.pairs.some(pair=>Math.abs(pair.stageBAnisotropyCoulombEnergyKcalMol)>0),'Production carbonyl anisotropy contributes through fixed virtual charges');assert.equal(productionAcetonePair.overlapGuardActivationCount,0);
  await setSlots(['water','pyridine','']);await waitForPopulation(['water','pyridine'],4,'Production water/pyridine scene did not spawn');await evaluate("window.__reactionLabProbe.placeSpeciesPair('water','pyridine',8)");productionState=await snapshot();const productionPyridine=productionState.instances.find(item=>item.species==='pyridine'),productionPyridineWater=productionState.instances.find(item=>item.species==='water'),pyridinePair=await evaluate(`window.__reactionLabProbe.decomposePair('${productionPyridineWater.id}','${productionPyridine.id}')`);assert.ok(pyridinePair.pairs.every(pair=>[pair.stageACoulombEnergyKcalMol,pair.stageBAnisotropyCoulombEnergyKcalMol,pair.ljEnergyKcalMol].every(Number.isFinite)));
  await setSlots(['water','methane','']);await waitForPopulation(['water','methane'],4,'Production water/methane scene did not spawn');await evaluate("window.__reactionLabProbe.placeSpeciesPair('water','methane',8)");productionState=await snapshot();const productionMethane=productionState.instances.find(item=>item.species==='methane'),methaneWater=productionState.instances.find(item=>item.species==='water'),methanePair=await evaluate(`window.__reactionLabProbe.decomposePair('${methaneWater.id}','${productionMethane.id}')`);assert.equal(methanePair.overlapGuardActivationCount,0);assert.ok(methanePair.pairs.every(pair=>Number.isFinite(pair.totalEnergyKcalMol)));
  await setSlots(['acetic-anhydride','water','']);
  await waitForPopulation(['acetic-anhydride','water'],4,'Hydrolysis reactant population did not initialize');
  await runReaction('anhydride-hydrolysis',['acetic-acid','acetic-acid']);
  await setSlots(['acetic-anhydride','ethanol','']);
  await waitForPopulation(['acetic-anhydride','ethanol'],4,'Alcoholysis reactant population did not initialize');
  await runReaction('anhydride-alcoholysis',['ethyl-acetate','acetic-acid']);

  for(const ids of [['oxygen','ethanol',''],['hydrogen','acetic-acid','']]){
    await setSlots(ids);await waitForPopulation(ids.slice(0,2),4,`Negative control scene did not spawn: ${ids.join('+')}`);
    await evaluate('window.__labReactionEvents=[]');
    const arranged=await evaluate(`window.__reactionLabProbe.placeSpeciesPair('${ids[0]}','${ids[1]}',.82)`);assert.ok(arranged.distance<1.18,`Negative control pair should be in reactive-site contact: ${JSON.stringify(arranged)}`);
    const snapshotBefore=await snapshot();
    await new Promise(resolve=>setTimeout(resolve,900));
    assert.equal(await evaluate('window.__labReactionEvents.length'),0,`${ids.join('+')} must not create a reaction`);
    assert.equal((await snapshot()).instances.length,snapshotBefore.instances.length,'Negative controls leave the scene population unchanged');
  }
  await setSlots(['hexamethylenediamine','isoamyl-acetate','methylcyclohexane']);
  await waitForPopulation(['hexamethylenediamine','isoamyl-acetate','methylcyclohexane'],6,'Three-species scene did not create six molecules');
  const largeScene=await snapshot();assert.equal(largeScene.instances.length,6);assert.ok(Math.max(...largeScene.instances.map(item=>item.atomCount))>=24,'Large DB molecules participate in the six-particle performance case');
  const frameSample=await evaluate(`new Promise(resolve=>{let first=0,last=0,count=0,maxGap=0;function frame(now){if(!first)first=now;if(last)maxGap=Math.max(maxGap,now-last);last=now;count++;if(now-first>=900)resolve({count,elapsed:now-first,maxGap,mean:(now-first)/Math.max(1,count-1)});else requestAnimationFrame(frame)}requestAnimationFrame(frame)})`);
  assert.ok(frameSample.count>=10,`Six-molecule interaction scene stalled: ${JSON.stringify(frameSample)}`);assert.ok(frameSample.maxGap<260,`Six-molecule interaction caused a visible frame stall: ${JSON.stringify(frameSample)}`);
  await evaluate("document.querySelector('[data-lab-mode=view]').click()");
  const canvasRect=await evaluate("(()=>{const r=document.querySelector('#reaction-lab canvas').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})()");
  const orbitStart={x:canvasRect.x+8,y:canvasRect.y+canvasRect.height*.5},orbitEnd={x:orbitStart.x+42,y:orbitStart.y+18};
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:orbitStart.x,y:orbitStart.y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x:orbitStart.x,y:orbitStart.y,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:orbitEnd.x,y:orbitEnd.y,button:'left',buttons:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:orbitEnd.x,y:orbitEnd.y,button:'left',buttons:0});
  assert.notEqual((await snapshot()).camera.azimuth,largeScene.camera.azimuth,'Camera orbit remains responsive with six large molecules');

  await send('Page.navigate',{url:`http://127.0.0.1:${port}/?reactionLabTest=1&reactionLabPhysics=stage-a`});
  await waitFor("!!document.querySelector('#open-reaction-lab')&&!document.querySelector('#open-reaction-lab').disabled&&!!window.__reactionLabProbe&&window.__reactionLabProbe.physicsMode==='stage-a'",'Stateless Stage A localhost probe did not initialize');
  await evaluate("window.__stageAReactionEvents=[];window.addEventListener('molecule-craft:reaction-lab-product',event=>window.__stageAReactionEvents.push(event.detail));document.querySelector('#open-reaction-lab').click()");
  await waitFor("document.querySelector('#reaction-lab-dialog').open",'Stage A Reaction Lab dialog did not open');
  const stageInitial=await evaluate("(()=>{const d=document.querySelector('#reaction-lab-dialog').getBoundingClientRect();return{dialog:[d.width,d.height],mode:window.__reactionLabProbe.physicsMode,step:window.__reactionLabProbe.physicalPsPerGameSecond}})()");
  assert.ok(stageInitial.dialog[0]>=389&&stageInitial.dialog[1]>=843,`Stage A did not start at 390×844: ${JSON.stringify(stageInitial)}`);assert.equal(stageInitial.mode,'stage-a');assert.equal(stageInitial.step,.1);
  await setSlots(['water','','']);await waitFor("document.querySelector('[data-lab-status]').textContent.includes('4 個')",'Stage A water population did not spawn');
  let stageState=await snapshot();assert.equal(stageState.physicsMode,'stage-a');assert.equal(stageState.instances.length,4);assert.ok(stageState.instances.every(item=>Number.isFinite(item.massAmu)&&item.inertiaTensorAmuAngstrom2.length===3));assert.equal('bonds' in stageState,false,'Stage A exposes no H-bond tracker lifecycle');
  const waterFixture=stageState.instances.map((item,index)=>({id:item.id,positionAngstrom:[[0,0,0],[8,0,0],[0,8,0],[8,8,0]][index]}));await evaluate(`window.__reactionLabProbe.setGeometry(${JSON.stringify(waterFixture)})`);
  const selectedWater=(await snapshot()).instances[0],waterPlan=await evaluate(`window.__reactionLabProbe.dragPlan('${selectedWater.id}',0,[.55,0,0])`);
  await evaluate("document.querySelector('[data-lab-mode=move]').click()");await drag(waterPlan,{steps:4,stepDelay:18,hold:0});stageState=await snapshot();
  const movedWater=stageState.instances.find(item=>item.id===selectedWater.id);assert.ok(Math.hypot(...movedWater.position.map((value,index)=>value-selectedWater.position[index]))>.15,'Kinematic Stage A pointer drag moves the selected rigid body');
  await evaluate("document.querySelector('[data-lab-mode=rotate]').click()");const rotationPlan=await evaluate(`window.__reactionLabProbe.dragPlan('${movedWater.id}',0,[.4,0,0])`),orientationBefore=movedWater.orientation;
  await drag(rotationPlan,{steps:3,stepDelay:18,hold:0});stageState=await snapshot();const orientationAfter=stageState.instances.find(item=>item.id===movedWater.id).orientation;assert.ok(Math.hypot(...orientationAfter.map((value,index)=>value-orientationBefore[index]))>1e-4,'Stage A scene retains interactive rigid-body rotation');
  await setSlots(['water','carbon-dioxide','']);await waitFor("document.querySelector('[data-lab-status]').textContent.includes('4 個')",'Stage A multi-species scene did not spawn');
  stageState=await snapshot();const water=stageState.instances.find(item=>item.species==='water'),carbonDioxide=stageState.instances.find(item=>item.species==='carbon-dioxide');
  await evaluate(`window.__reactionLabProbe.setGeometry([${JSON.stringify({id:water.id,positionAngstrom:[0,0,0]})},${JSON.stringify({id:carbonDioxide.id,positionAngstrom:[8,0,0]})}])`);
  const stagePair=await evaluate(`window.__reactionLabProbe.decomposePair('${water.id}','${carbonDioxide.id}')`);assert.ok(stagePair.pairs.length>0);assert.ok(stagePair.pairs.every(pair=>[pair.coulombEnergyKcalMol,pair.ljEnergyKcalMol,pair.totalEnergyKcalMol,...pair.forceOnA,...pair.torqueOnA].every(Number.isFinite)));assert.equal(stagePair.overlapGuardActivationCount,0,'Separated Stage A acceptance fixture must not activate the overlap guard');
  await setSlots(['acetic-anhydride','water','']);await waitFor("document.querySelector('[data-lab-status]').textContent.includes('4 個')",'Stage A reaction fixture population did not spawn');
  const stageContact=await evaluate("window.__reactionLabProbe.prepareContact('anhydride-hydrolysis',.82)");assert.ok(stageContact.initialDistance<1.18,'Stage A reaction fixture begins inside the registered contact range');
  try{await waitFor("document.querySelector('[data-lab-status]').textContent.startsWith('反応完了')",'Reaction contact did not execute in Stage A',12000);}catch(error){const diagnostic=await evaluate("window.__reactionLabProbe.reactionContactDiagnostics('anhydride-hydrolysis')");throw Error(`${error.message}; contact diagnostics=${JSON.stringify(diagnostic)}`);}
  assert.equal((await evaluate('window.__stageAReactionEvents.at(-1)?.ruleId')),'anhydride-hydrolysis','Registered reaction contact remains active alongside Stage A interactions');
  await setSlots(['hexamethylenediamine','isoamyl-acetate','methylcyclohexane']);await waitFor("document.querySelector('[data-lab-status]').textContent.includes('6 個')",'Six-large-molecule Stage A performance scene did not spawn');
  stageState=await snapshot();assert.equal(stageState.instances.length,6);assert.ok(Math.max(...stageState.instances.map(item=>item.atomCount))>=24);
  const largePoses=stageState.instances.map((item,index)=>({id:item.id,positionAngstrom:[index*25,0,0]}));await evaluate(`window.__reactionLabProbe.setGeometry(${JSON.stringify(largePoses)})`);
  const stageFrame=await evaluate(`(()=>{const started=performance.now();const state=window.__reactionLabProbe.advanceDeterministic(1);return{elapsed:performance.now()-started,state}})()`);
  assert.ok(stageFrame.elapsed<500,`Six-large-molecule Stage A force evaluation exceeded 500ms: ${stageFrame.elapsed}ms`);assert.ok(stageFrame.state.instances.every(item=>item.positionAngstrom.every(Number.isFinite)&&item.velocityAngstromPerPs.every(Number.isFinite)),'Six-body Stage A step remains finite');assert.ok(stageFrame.state.diagnostics.lastInteractionPairCount>0);
  const stageCanvas=await evaluate("(()=>{const r=document.querySelector('#reaction-lab canvas').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})()"),stageOrbitStart={x:stageCanvas.x+8,y:stageCanvas.y+stageCanvas.height*.5},stageOrbitEnd={x:stageOrbitStart.x+42,y:stageOrbitStart.y+18};
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:stageOrbitStart.x,y:stageOrbitStart.y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x:stageOrbitStart.x,y:stageOrbitStart.y,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:stageOrbitEnd.x,y:stageOrbitEnd.y,button:'left',buttons:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:stageOrbitEnd.x,y:stageOrbitEnd.y,button:'left',buttons:0});
  assert.ok(stageState.instances.length===6,'Stage A leaves its spawned multi-molecule scene intact');
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/?reactionLabTest=1&reactionLabPhysics=stage-b`});
  await waitFor("!!document.querySelector('#open-reaction-lab')&&!document.querySelector('#open-reaction-lab').disabled&&!!window.__reactionLabProbe&&window.__reactionLabProbe.physicsMode==='stage-b'",'Carbonyl anisotropy Stage B localhost probe did not initialize');
  await evaluate("document.querySelector('#open-reaction-lab').click()");await waitFor("document.querySelector('#reaction-lab-dialog').open",'Stage B Reaction Lab dialog did not open');
  const stageBDialog=await evaluate("(()=>{const d=document.querySelector('#reaction-lab-dialog').getBoundingClientRect();return[d.width,d.height]})()");assert.ok(stageBDialog[0]>=389&&stageBDialog[1]>=843,`Stage B changed the 390×844 layout: ${JSON.stringify(stageBDialog)}`);
  await setSlots(['water','acetone','']);await waitFor("document.querySelector('[data-lab-status]').textContent.includes('4 個')",'Stage B water/acetone scene did not spawn');
  let stageBState=await snapshot();assert.equal(stageBState.physicsMode,'stage-b');assert.ok(stageBState.qA>=0&&stageBState.qA<=.2);const acetoneInstances=stageBState.instances.filter(item=>item.species==='acetone');assert.equal(acetoneInstances.flatMap(item=>item.carbonylSites).length,acetoneInstances.length,'Each acetone carbonyl virtual charge geometry is exposed to the test probe');assert.ok(stageBState.instances.filter(item=>item.species==='water').every(item=>item.carbonylSites.length===0),'Water atoms are excluded from carbonyl correction');assert.ok(stageBState.instances.every(item=>item.renderedObjectCount===item.expectedRealObjectCount),'Virtual charge sites must not render as Three.js objects');assert.equal('bonds' in stageBState,false,'Stage B exposes no persistent H-bond tracker');
  await evaluate("window.__reactionLabProbe.placeSpeciesPair('water','acetone',8)");stageBState=await snapshot();const stageBWater=stageBState.instances.find(item=>item.species==='water'),stageBAcetone=stageBState.instances.find(item=>item.species==='acetone');
  const stageBPair=await evaluate(`window.__reactionLabProbe.decomposePair('${stageBWater.id}','${stageBAcetone.id}')`);assert.ok(stageBPair.pairs.some(pair=>Math.abs(pair.stageBAnisotropyCoulombEnergyKcalMol)>0));assert.ok(stageBPair.pairs.every(pair=>[pair.stageACoulombEnergyKcalMol,pair.stageBAnisotropyCoulombEnergyKcalMol,pair.ljEnergyKcalMol,pair.totalEnergyKcalMol,...pair.stageBAnisotropyForceOnA,...pair.stageBAnisotropyTorqueOnA].every(Number.isFinite)));assert.equal(stageBPair.overlapGuardActivationCount,0);
  const stageBPlan=await evaluate(`window.__reactionLabProbe.dragPlan('${stageBWater.id}',0,[.32,0,0])`);await evaluate("document.querySelector('[data-lab-mode=move]').click()");await drag(stageBPlan,{steps:4,stepDelay:18,hold:0});stageBState=await snapshot();assert.ok(stageBState.instances.find(item=>item.id===stageBWater.id).positionAngstrom.every(Number.isFinite),'Stage B drag leaves rigid-body state finite');
  await evaluate("document.querySelector('[data-lab-mode=rotate]').click()");const stageBRotation=await evaluate(`window.__reactionLabProbe.dragPlan('${stageBAcetone.id}',0,[.25,0,0])`);await drag(stageBRotation,{steps:3,stepDelay:18,hold:0});stageBState=await snapshot();assert.ok(stageBState.instances.find(item=>item.species==='acetone').carbonylSites[0].lpPlusWorldPositionAngstrom.every(Number.isFinite),'Stage B virtual sites rotate with the body');
  const stageBCanvas=await evaluate("(()=>{const r=document.querySelector('#reaction-lab canvas').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})()"),stageBCameraBefore=stageBState.camera.azimuth,stageBOrbitStart={x:stageBCanvas.x+8,y:stageBCanvas.y+stageBCanvas.height*.5},stageBOrbitEnd={x:stageBOrbitStart.x+25,y:stageBOrbitStart.y+10};
  await evaluate("document.querySelector('[data-lab-mode=view]').click()");await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:stageBOrbitStart.x,y:stageBOrbitStart.y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x:stageBOrbitStart.x,y:stageBOrbitStart.y,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:stageBOrbitEnd.x,y:stageBOrbitEnd.y,button:'left',buttons:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:stageBOrbitEnd.x,y:stageBOrbitEnd.y,button:'left',buttons:0});assert.notEqual((await snapshot()).camera.azimuth,stageBCameraBefore,'Stage B camera orbit remains responsive');
  assert.equal(browserErrors.length,0,`Browser reported errors: ${JSON.stringify(browserErrors)}`);
  console.log('Reaction Lab 390×844 browser regression passed: stateless Stage B production, Stage A localhost mode, invisible anisotropy sites, drag/rotation/camera, and reaction contact.');
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}server.close();}
