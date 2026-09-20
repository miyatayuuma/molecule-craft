import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {NITROGEN_ROUTE,NITROGEN_ZONES,NITROGEN_INSIGHT_AREA} from '../src/veil/nitrogen-routes.js';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=normalize(join(root,relative));
    if(!file.startsWith(root)){res.writeHead(403).end();return;}
    let body=await readFile(file);
    if(relative==='src/veil/ui.js'){
      let source=body.toString('utf8');
      source=source.replace('function frame(now){',"function frame(now){globalThis.__nitrogenChapterRun=run;globalThis.__nitrogenChapterResources=resources;globalThis.__nitrogenChapterRenderer=renderer;globalThis.__nitrogenChapterKeys=keys;");
      body=Buffer.from(source);
    }
    res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch{res.writeHead(404).end('not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const {port}=server.address(),origin=`http://127.0.0.1:${port}`;
let chrome='';for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'A Chromium browser is required for Nitrogen chapter acceptance');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-nitrogen-chapter-browser-')),debugPort=9231;let child=null,socket=null;
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);
  let tabs=null;for(let attempt=0;attempt<160;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await new Promise(done=>setTimeout(done,100));}
  assert.ok(tabs?.length,`Chromium DevTools endpoint did not become ready: ${stderr.slice(-1000)}`);
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);await new Promise((done,fail)=>{const timer=setTimeout(()=>fail(new Error('DevTools websocket open timed out')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);done();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map(),exceptions=[];socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);return;}if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails);});
  const send=(method,params={})=>new Promise((done,fail)=>{const id=++sequence;pending.set(id,{resolve:done,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  const waitFor=async(expression,message,attempts=140)=>{for(let attempt=0;attempt<attempts;attempt++){try{if(await evaluate(expression))return;}catch{}await new Promise(done=>setTimeout(done,100));}throw new Error(message);};
  const canvasHash=`(()=>{const canvas=document.querySelector('#veil-canvas');if(!canvas?.width)return 0;const s=canvas.toDataURL();let h=2166136261;for(let i=0;i<s.length;i+=19)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;})()`;
  const keyCode={w:87,a:65,s:83,d:68};let held=new Set();
  async function setKeys(next){for(const key of held)if(!next.has(key))await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:`Key${key.toUpperCase()}`,windowsVirtualKeyCode:keyCode[key],nativeVirtualKeyCode:keyCode[key]});for(const key of next)if(!held.has(key))await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:`Key${key.toUpperCase()}`,windowsVirtualKeyCode:keyCode[key],nativeVirtualKeyCode:keyCode[key]});held=next;}

  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:`${origin}/`});await waitFor(`document.querySelector('#open-collection')?.textContent?.includes('0/136')`,'Application did not initialize');
  const seeded=await evaluate(`(async()=>{const {createResources}=await import('/src/veil/resources.js');const records=await fetch('/data/molecules.json').then(r=>r.json());const r=createResources({storage:localStorage});r.setCatalog(records);r.state.progress.choCompleted=true;r.state.progress.regions=['veil','carbon','oxygen','frontier','nitrogen'];r.state.progress.checkpoint='nitrogen';r.state.progress.foundElements=['H','C','O','N'];r.state.recipes=['hydrogen','methane','oxygen','water','nitrogen','ammonia'];Object.assign(r.state.elements,{H:1200,C:1200,O:1200,N:1200,P:0,S:0,F:0,Cl:0});return r.save();})()`);assert.equal(seeded,true);
  await send('Page.reload',{ignoreCache:true});await waitFor(`!!document.querySelector('#collector-launch-handle')&&!document.querySelector('#open-supply')?.disabled`,'LOADOUT UI did not become ready');await evaluate(`(()=>{document.querySelector('#open-supply').click();document.querySelector('#collector-launch-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true;})()`);await waitFor(`document.querySelector('#expedition-destinations')?.getAttribute('aria-hidden')==='false'&&!!document.querySelector('#expedition-destinations [data-region=\"nitrogen\"]')`,'Nitrogen destination unavailable');
  await evaluate(`document.querySelector('#expedition-destinations [data-region="nitrogen"]').click()`);await waitFor(`document.querySelector('#veil-view')?.hidden===false&&!!globalThis.__nitrogenChapterRun`,'Nitrogen FIELD launch failed');exceptions.length=0;
  await evaluate(`(()=>{globalThis.__nitrogenChapterRun.predators=false;return true;})()`);
  const authored=await evaluate(`(()=>{const run=globalThis.__nitrogenChapterRun;return {zones:run.map.nitrogenZones?.map(z=>({id:z.id,kind:z.kind,width:z.width,points:z.points.length}))??[],hazards:run.map.nitrogenHazards?.map(h=>({id:h.id,type:h.type,subtype:h.subtype,baseIntensity:h.baseIntensity}))??[],visualCount:run.map.nitrogenVisuals?.length??0,legacyPulses:run.map.fields.filter(f=>f.kind==='nitrogen-pulse').length,core:run.map.nitrogenCore?{x:run.map.nitrogenCore.x,y:run.map.nitrogenCore.y,radius:run.map.nitrogenCore.radius,fractured:run.map.nitrogenCore.fractured}:null,ambient:[...new Set(run.map.dust.filter(d=>String(d.route??'').startsWith('nitrogen-ambient-')).map(d=>d.element))],legacyRare:{survey:Object.hasOwn(run,'rareSurvey'),specimens:Object.hasOwn(run,'rareSpecimens'),cargo:Object.hasOwn(run,'rareCargo'),dust:run.map.dust.filter(d=>d.rareAnomaly||['P','S','F','Cl'].includes(d.element)).length}};})()`);
  assert.deepEqual(authored.zones.map(z=>z.kind),NITROGEN_ZONES.map(z=>z.kind));assert.ok(authored.zones.every(z=>z.width>=700));assert.ok(authored.hazards.length>=10);assert.ok(authored.hazards.some(h=>h.type==='mechanical')&&authored.hazards.some(h=>h.type==='thermal'));assert.ok(authored.visualCount>50);assert.equal(authored.legacyPulses,0);assert.ok(authored.core&&!authored.core.fractured);assert.ok(authored.ambient.some(element=>element!=='N'));assert.deepEqual(authored.legacyRare,{survey:false,specimens:false,cargo:false,dust:0},'legacy Rare Survey runtime must be absent');

  // Player-facing phase identity: render the production canvas from each authored
  // phase midpoint. Hazard composition and landmarks must produce distinct open-space views.
  const hashes=[];for(const zone of NITROGEN_ZONES){const progress=(zone.start+zone.end)/2,point=NITROGEN_ROUTE.points[Math.round(progress*(NITROGEN_ROUTE.points.length-1))];const hash=await evaluate(`(()=>{const run=globalThis.__nitrogenChapterRun,p=${JSON.stringify({x:point.x,y:point.y,angle:point.angle})};Object.assign(run.player,{x:p.x,y:p.y,angle:p.angle,vx:0,vy:0,speed:run.config.driftSpeed});globalThis.__nitrogenChapterRenderer.reset();globalThis.__nitrogenChapterRenderer.draw(run,.016,false);return ${canvasHash};})()`);hashes.push(hash);}assert.ok(new Set(hashes).size>=4,`Nitrogen sections must render as spatially distinct views: ${hashes.join(',')}`);

  // Real browser input validates that the open Entry → Mid field remains readable
  // without a painted corridor. Deep/Core round-trip capability is covered by the
  // deterministic loadout balance test rather than forcing an unprepared browser run.
  const start=NITROGEN_ROUTE.points[0],goalIndex=Math.round((NITROGEN_ROUTE.points.length-1)*.32),goal=NITROGEN_ROUTE.points[goalIndex];await evaluate(`Object.assign(globalThis.__nitrogenChapterRun.player,{x:${start.x},y:${start.y},angle:${start.angle},vx:0,vy:0,speed:globalThis.__nitrogenChapterRun.config.driftSpeed})`);
  let targetIndex=3,reached=false;for(let tick=0;tick<340&&!reached;tick++){
    const position=await evaluate(`(()=>{const p=globalThis.__nitrogenChapterRun.player;return {x:p.x,y:p.y,time:globalThis.__nitrogenChapterRun.time,N:globalThis.__nitrogenChapterRun.collectedElements.N};})()`),target=NITROGEN_ROUTE.points[Math.min(targetIndex,goalIndex)],dx=target.x-position.x,dy=target.y-position.y,d=Math.hypot(dx,dy),next=new Set();
    if(d<120&&targetIndex<goalIndex)targetIndex=Math.min(goalIndex,targetIndex+4);
    const activeTarget=NITROGEN_ROUTE.points[Math.min(targetIndex,goalIndex)],ax=activeTarget.x-position.x,ay=activeTarget.y-position.y;if(Math.abs(ax)>22)next.add(ax>0?'d':'a');if(Math.abs(ay)>22)next.add(ay>0?'s':'w');await setKeys(next);await new Promise(done=>setTimeout(done,80));reached=Math.hypot(position.x-goal.x,position.y-goal.y)<170&&targetIndex>=goalIndex;
  }await setKeys(new Set());
  const travelled=await evaluate(`(()=>{const run=globalThis.__nitrogenChapterRun,goal=${JSON.stringify({x:goal.x,y:goal.y})};return {distance:Math.hypot(run.player.x-goal.x,run.player.y-goal.y),N:run.collectedElements.N,time:run.time,hidden:document.querySelector('#veil-view').hidden,hash:${canvasHash}};})()`);assert.ok(travelled.distance<190,`real WASD traversal must reach Mid Nitrogen; distance=${travelled.distance}`);assert.ok(travelled.N>0,'real traversal must collect renewable N');assert.equal(travelled.hidden,false);

  // Verify the natural Critical Insight side pocket remains spatially
  // attached to its authored environment. The lifecycle itself is covered by the dedicated Critical browser test.
  const insight=await evaluate(`(()=>{const run=globalThis.__nitrogenChapterRun,s=run.map.signals.find(s=>s.region==='nitrogen');return {distance:Math.hypot(s.x-(${NITROGEN_INSIGHT_AREA.x}),s.y-(${NITROGEN_INSIGHT_AREA.y})),x:s.x,y:s.y};})()`);assert.ok(insight.distance<1);
  await evaluate(`(()=>{const run=globalThis.__nitrogenChapterRun,site=run.map.safeExtractionSite;Object.assign(run.player,{x:site.x,y:site.y,vx:0,vy:0,speed:0,boost:0,combustion:false});run.driveHeld=false;})()`);await waitFor(`document.querySelector('#veil-return')?.dataset.returnState==='site-ready'`,'Safe Extraction Site did not enable an Insight-less return');await evaluate(`document.querySelector('#veil-return').click()`);await waitFor(`document.querySelector('#veil-view')?.hidden===true`,'Safe Site extraction did not complete',140);
  const saved=await evaluate(`(()=>{const state=JSON.parse(localStorage.getItem('molecule-craft.resources.v1'));return {rareEcologyEligible:state.progress.rareEcologyEligible,rareStocks:['P','S','F','Cl'].map(element=>state.elements[element]??0)};})()`);assert.deepEqual(saved.rareStocks,[0,0,0,0],'retired Rare Survey must not mint Rare stock');
  await waitFor(`!!document.querySelector('#collector-launch-handle')&&!document.querySelector('#open-supply')?.disabled`,'LOADOUT UI did not become ready');await evaluate(`(()=>{document.querySelector('#open-supply').click();document.querySelector('#collector-launch-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true;})()`);await waitFor(`document.querySelector('#expedition-destinations')?.getAttribute('aria-hidden')==='false'&&!!document.querySelector('#expedition-destinations [data-region="nitrogen"]')`,'Nitrogen destination unavailable');await evaluate(`document.querySelector('#expedition-destinations [data-region="nitrogen"]').click()`);await waitFor(`document.querySelector('#veil-view')?.hidden===false&&!!globalThis.__nitrogenChapterRun`,'Nitrogen relaunch failed');const relaunch=await evaluate(`(()=>{const run=globalThis.__nitrogenChapterRun;return {legacyRare:Object.hasOwn(run,'rareSurvey')||Object.hasOwn(run,'rareSpecimens')||Object.hasOwn(run,'rareCargo'),rareDust:run.map.dust.some(d=>d.rareAnomaly||['P','S','F','Cl'].includes(d.element))};})()`);assert.deepEqual(relaunch,{legacyRare:false,rareDust:false});
  assert.equal(exceptions.length,0,`Nitrogen chapter browser acceptance must not throw: ${JSON.stringify(exceptions)}`);
  console.log('Nitrogen chapter Chromium acceptance',JSON.stringify({zones:authored.zones.map(z=>({kind:z.kind,width:z.width})),hazards:authored.hazards.length,sectionHashes:hashes,travelled:{time:travelled.time,N:travelled.N,distance:+travelled.distance.toFixed(1)},legacyRareRemoved:true}));
}finally{try{await setKeys?.(new Set());}catch{}try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await new Promise(done=>setTimeout(done,100));server.close();await rm(profile,{recursive:true,force:true});}
console.log('Nitrogen chapter Chromium regression passed: five broad rendered phases, hazard-composition presentation, real WASD Entry-to-Mid N collection, N2 side pocket, normal return/relaunch, and no legacy Rare Survey runtime.');
