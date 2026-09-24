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
  let sequence=0;const pending=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  const waitFor=async(expression,label,timeout=8000)=>{for(let index=0;index<timeout/40;index++){const value=await evaluate(expression);if(value)return value;await new Promise(resolve=>setTimeout(resolve,40));}throw Error(label);};
  const setSlots=async ids=>evaluate(`(()=>{const slots=[...document.querySelectorAll('[data-lab-slot]')];${JSON.stringify(ids)}.forEach((id,index)=>{slots[index].value=id;slots[index].dispatchEvent(new Event('change',{bubbles:true}));});return document.querySelector('[data-lab-status]').textContent;})()`);
  const snapshot=()=>evaluate('window.__reactionLabProbe.snapshot()');
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
    await drag(plan,{duringHold:async()=>{await new Promise(resolve=>setTimeout(resolve,900));const committed=await snapshot();assert.equal(committed.dialogOpen,true,'Reaction commit must not close the Lab');assert.equal(committed.pointerActive,false,'Reaction commitment clears its stale drag/pointer state');}});
    await waitFor("document.querySelector('[data-lab-status]').textContent.startsWith('反応完了')",`${ruleId} did not complete from a real canvas drag`,10000);
    const result=await waitFor(`window.__labReactionEvents.at(-1)?.ruleId==='${ruleId}'`,'Reaction product event was not emitted',2000);
    assert.deepEqual(result.products,products);
    const remaining=await snapshot();for(const product of products)assert.ok(remaining.instances.some(item=>item.species===product),`3D product instance missing: ${product}`);
    assert.equal(remaining.instances.filter(item=>products.includes(item.species)).length,products.length,'Reaction must spawn the correct product instance count');
    assert.equal(remaining.instances.some(item=>item.busy),false,'products and remaining species become manipulable after commitment');
    const product=remaining.instances.find(item=>products.includes(item.species)),movePlan=await evaluate(`window.__reactionLabProbe.dragPlan('${product.id}',0,[0.32,0,0])`),before=product.position;
    await drag(movePlan,{steps:4,stepDelay:16,hold:0});const moved=await snapshot(),after=moved.instances.find(item=>item.id===product.id).position;
    assert.ok(Math.hypot(...after.map((value,index)=>value-before[index]))>.15,'Generated products remain individually movable');
  };

  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('molecule-craft.collection.v1',JSON.stringify({schemaVersion:3,discoveredMolecules:${JSON.stringify(['water','ethanol','acetic-anhydride','acetic-acid','ethyl-acetate','oxygen','hydrogen','acetone','methane'].map((id,index)=>({id,at:index+1,order:index+1})))},discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]}));`});
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/?reactionLabTest=1`});
  await waitFor("document.querySelector('#open-reaction-lab')&&!document.querySelector('#open-reaction-lab').disabled&&window.__reactionLabProbe",'Reaction Lab entry did not initialize');
  await evaluate("window.__labReactionEvents=[];window.addEventListener('molecule-craft:reaction-lab-product',event=>window.__labReactionEvents.push(event.detail));document.querySelector('#open-reaction-lab').click()");
  await waitFor("document.querySelector('#reaction-lab-dialog').open",'Reaction Lab dialog did not open');
  const initial=await evaluate("(()=>{const d=document.querySelector('#reaction-lab-dialog').getBoundingClientRect(),c=document.querySelector('#reaction-lab canvas').getBoundingClientRect();return{dialog:[d.width,d.height],canvas:[c.width,c.height],slots:document.querySelectorAll('[data-lab-slot]').length}})()");
  assert.equal(initial.slots,3);assert.ok(initial.dialog[0]>=389&&initial.dialog[1]>=843,`390x844 scene did not fill the mobile viewport: ${JSON.stringify(initial)}`);
  await setSlots(['water','','']);await waitFor("document.querySelector('[data-lab-status]').textContent.includes('4 個')",'Water-only population did not create four molecules');
  await evaluate("document.querySelector('[data-lab-mode=rotate]').click();document.querySelector('[data-lab-mode=view]').click()");
  const modes=await evaluate("[...document.querySelectorAll('[data-lab-mode]')].map(button=>button.getAttribute('aria-pressed'))");assert.deepEqual(modes,['false','false','true']);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:145,y:370});await send('Input.dispatchMouseEvent',{type:'mousePressed',x:145,y:370,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:205,y:405,button:'left',buttons:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:205,y:405,button:'left',buttons:0});
  await evaluate("document.querySelector('[data-lab-mode=move]').click()");
  const hbond=await evaluate('window.__reactionLabProbe.arrangeHydrogenBond()');
  assert.equal(hbond.bonds,1,`Aligned water geometry must form a tracked H bond: ${JSON.stringify(hbond)}`);assert.ok(hbond.alignment>.6);
  let waterState=await snapshot();assert.deepEqual(waterState.bonds[0].endpoints,{from:{instanceId:hbond.donorId,atom:1},to:{instanceId:hbond.acceptorId,atom:0}},'Displayed interaction connects donor H to acceptor O');
  const donorBefore=waterState.instances.find(item=>item.id===hbond.donorId).position,acceptorBefore=waterState.instances.find(item=>item.id===hbond.acceptorId).position;
  const axis=hbond.axis,slowPlan=await evaluate(`window.__reactionLabProbe.dragPlan('${hbond.donorId}',0,[${axis.map(value=>(-.45*value).toFixed(8)).join(',')}])`);
  await drag(slowPlan,{steps:24,stepDelay:55,hold:0});await new Promise(resolve=>setTimeout(resolve,300));waterState=await snapshot();
  assert.ok(waterState.bonds.length>0,'Slow motion retains the temporary interaction');
  const acceptorAfter=waterState.instances.find(item=>item.id===hbond.acceptorId).position;
  const follow=acceptorAfter.map((value,index)=>value-acceptorBefore[index]).reduce((sum,value,index)=>sum+value*(-axis[index]),0);
  assert.ok(follow>.015,`The partner should follow a slow donor drag; projected movement was ${follow}`);
  const fastPlan=await evaluate(`window.__reactionLabProbe.dragPlan('${hbond.donorId}',0,[${axis.map(value=>(-2.4*value).toFixed(8)).join(',')}])`);
  await drag(fastPlan,{steps:2,stepDelay:8,hold:0});await new Promise(resolve=>setTimeout(resolve,120));
  assert.equal((await snapshot()).bonds.length,0,'Fast pulling breaks the H bond');
  const donorAfter=waterState.instances.find(item=>item.id===hbond.donorId).position;
  assert.ok(Math.abs(donorAfter[2]-donorBefore[2])>.001,'Camera-facing drag after orbit must retain depth-aware world motion');

  await evaluate("document.querySelector('[data-lab-mode=move]').click()" );
  await setSlots(['acetic-anhydride','water','']);
  await waitFor("document.querySelector('[data-lab-status]').textContent.includes('4 個')",'Hydrolysis reactant population did not initialize');
  await runReaction('anhydride-hydrolysis',['acetic-acid','acetic-acid']);
  await setSlots(['acetic-anhydride','ethanol','']);
  await waitFor("document.querySelector('[data-lab-status]').textContent.includes('4 個')",'Alcoholysis reactant population did not initialize');
  await runReaction('anhydride-alcoholysis',['ethyl-acetate','acetic-acid']);

  for(const ids of [['oxygen','ethanol',''],['hydrogen','acetic-acid','']]){
    await setSlots(ids);await new Promise(resolve=>setTimeout(resolve,60));
    await evaluate('window.__labReactionEvents=[]');
    const arranged=await evaluate(`window.__reactionLabProbe.placeSpeciesPair('${ids[0]}','${ids[1]}')`);assert.ok(arranged.distance<1.18,`Negative control pair should be in reactive-site contact: ${JSON.stringify(arranged)}`);
    const snapshotBefore=await snapshot();
    await new Promise(resolve=>setTimeout(resolve,900));
    assert.equal(await evaluate('window.__labReactionEvents.length'),0,`${ids.join('+')} must not create a reaction`);
    assert.equal((await snapshot()).instances.length,snapshotBefore.instances.length,'Negative controls leave the scene population unchanged');
  }
  console.log('Reaction Lab 390x844 browser regression passed: camera-plane drag after orbit, tracked H···O formation/follow/break, both registered reactions from canvas dragging, and O2/H2 negative controls.');
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}server.close();}
