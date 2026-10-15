// Layout-only browser regression. No completion performance trial is run here.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {resolve,join,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {connectBrowserProcessMetadata} from './chromium-process-authority.mjs';
const root=resolve(process.env.POLYMER_ROOT??'.'),out=resolve(process.env.POLYMER_EVIDENCE_DIR??'test-results/c9-layout');
const sourceSha=spawnSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
if(process.env.POLYMER_SOURCE_SHA)assert.equal(sourceSha,process.env.POLYMER_SOURCE_SHA);
const candidate=process.env.C9_LAYOUT_CANDIDATE==='1',rows=[],polymers=JSON.parse(await readFile(join(root,'data/polymers.json'))),routes=JSON.parse(await readFile(join(root,'data/polymerization-routes.json'))).routes;
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname,file=resolve(root,'.'+(path==='/'?'/index.html':path));assert.ok(file.startsWith(root+'/'));let body=await readFile(file);if(path==='/src/app.js')body=Buffer.from(body.toString().replace('reactionLabViewer=createReactionLabViewer({','reactionLabViewer=window.__layoutViewer=createReactionLabViewer({'));if(path==='/src/reaction-lab-viewer.js'){
  let s=body.toString();assert.ok(s.includes('function resize(){'));s=s.replace('function resize(){','function resize(){window.__layoutCounts.resize++;');assert.ok(s.includes('new ResizeObserver(resize)'));s=s.replace('new ResizeObserver(resize)','new ResizeObserver(()=>{window.__layoutCounts.observer++;resize();})');
  s=s.replace("scene.add(new THREE.HemisphereLight", "const nativeSetSize=renderer.setSize.bind(renderer);renderer.setSize=(...args)=>{window.__layoutCounts.setSize++;return nativeSetSize(...args);};scene.add(new THREE.HemisphereLight");body=Buffer.from(s);
}res.writeHead(200,{'content-type':({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]??'application/octet-stream','cross-origin-opener-policy':'same-origin','cross-origin-embedder-policy':'require-corp','cache-control':'no-store'}).end(body);}catch{res.writeHead(404).end();}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const port=server.address().port;
let chrome=process.env.CHROMIUM_PATH;for(const name of ['google-chrome','chromium','chromium-browser'])if(!chrome){const r=spawnSync('which',[name],{encoding:'utf8'});if(r.status===0)chrome=r.stdout.trim();}assert.ok(chrome);
const profile=await mkdtemp(join(tmpdir(),'c9-layout-')),debug=Number(process.env.POLYMER_DEBUG_PORT??9266),pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const child=spawn(chrome,['--headless=new','--no-sandbox','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--force-device-scale-factor=1',`--user-data-dir=${profile}`,`--remote-debugging-port=${debug}`,'about:blank'],{stdio:'ignore'});
let cdp;
try{
  let tabs;for(let i=0;i<150;i++){try{tabs=await(await fetch(`http://127.0.0.1:${debug}/json/list`)).json();if(tabs.length)break;}catch{}await pause(100);}assert.ok(tabs?.length);
  cdp=await connectBrowserProcessMetadata(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);const send=cdp.send;
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const wait=async expression=>{for(let i=0;i<300;i++){if(await evaluate(expression))return;await pause(50);}throw Error('layout wait timeout: '+expression);};
  const tick=()=>evaluate('new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)))');
  await send('Page.enable');await send('Network.enable');await send('Network.setBypassServiceWorker',{bypass:true});
  const seed={schemaVersion:3,discoveredMolecules:[...new Set(routes.flatMap(r=>r.feedSpecies))].map((id,i)=>({id,at:i+1,order:i+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]};
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__layoutCounts={resize:0,observer:0,setSize:0};localStorage.setItem('molecule-craft.collection.v1',${JSON.stringify(JSON.stringify(seed))});`});
  const browser=await send('Browser.getVersion');
  for(const viewport of [{width:1280,height:900,mobile:false},{width:390,height:844,mobile:true}])for(const reduced of [false,true]){
    await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
    await send('Page.navigate',{url:`http://127.0.0.1:${port}/?reactionLabTest=1`});await wait("!!window.__reactionLabProbe&&!document.querySelector('#open-reaction-lab').disabled");await evaluate("document.querySelector('#open-reaction-lab').click()");await tick();
    const capture=async label=>evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};},c=document.querySelector('#reaction-lab canvas'),s=document.querySelector('[data-lab-status]'),p=document.querySelector('[data-polymer-completion]');return{label:${JSON.stringify(label)},dialog:rect(document.querySelector('#reaction-lab-dialog')),lab:rect(document.querySelector('#reaction-lab')),canvas:rect(c),buffer:{width:c.width,height:c.height},dpr:devicePixelRatio,status:rect(s),completion:rect(p),chamber:rect(c.parentElement),counts:{...window.__layoutCounts},statusHidden:s.hidden,completionHidden:p.hidden,overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...p.querySelectorAll('button')].map(b=>({hidden:b.hidden,disabled:b.disabled,rect:rect(b)}))}})()`);
    const initial=await capture('open');rows.push({viewport,reduced,initial});
    for(const polymer of candidate?polymers:polymers.filter(p=>p.id==='polyethylene')){
      if(candidate)await evaluate(`import('/src/reaction-lab-viewer.js').then(m=>m.reservePolymerCompletionFooter(document.querySelector('[data-polymer-footer-reservation]'),document.querySelector('[data-polymer-completion]'),${JSON.stringify(polymer.nameJa)}))`);
      await tick();const before=await capture('feed-reserved');
      for(const ready of [false,true]){
        await evaluate(`(()=>{const p=document.querySelector('[data-polymer-completion]');p.hidden=false;document.querySelector('[data-lab-status]').hidden=true;document.querySelector('[data-polymer-completion-name]').textContent=${JSON.stringify(polymer.nameJa)};document.querySelector('[data-polymer-completion-status]').textContent=${JSON.stringify(ready?'重合完了 · ドラッグで回転、ホイール・ピンチで拡大':'重合完了 · 3D表示を整えています')};for(const b of p.querySelectorAll('button')){b.hidden=!${ready};b.disabled=!${ready};}})()`);await tick();const after=await capture(ready?'ready':'completion');rows.push({viewport,reduced,polymerId:polymer.id,before,after});
        if(candidate){assert.equal(after.canvas.height,before.canvas.height,JSON.stringify(rows.at(-1)));assert.deepEqual(after.buffer,before.buffer);assert.equal(after.counts.setSize,before.counts.setSize);assert.ok(after.completion.bottom<=viewport.height&&after.completion.right<=viewport.width);assert.equal(after.overflow,false);}
        else if(!ready&&viewport.width===1280)assert.equal(before.canvas.height-after.canvas.height,33,'C8 622 → 589 is reproduced by only swapping the footer');
      }
      await evaluate("document.querySelector('[data-polymer-completion]').hidden=true;document.querySelector('[data-lab-status]').hidden=false");await tick();const restored=await capture('status-return');if(candidate)assert.equal(restored.canvas.height,before.canvas.height);
      await evaluate("document.querySelector('[data-lab-close]').click()");await tick();await evaluate("document.querySelector('#open-reaction-lab').click()");await tick();const reopened=await capture('reopen');if(candidate){assert.deepEqual(reopened.buffer,before.buffer);assert.equal(reopened.counts.setSize,before.counts.setSize);}
    }
    if(candidate){
      await send('Emulation.setDeviceMetricsOverride',{...viewport,width:viewport.width-30,deviceScaleFactor:2});await tick();const changed=await capture('viewport-and-dpr');assert.equal(changed.buffer.width,Math.floor(changed.canvas.width*2));assert.equal(changed.buffer.height,Math.floor(changed.canvas.height*2));rows.push({viewport,reduced,changed});
      await evaluate('window.__layoutViewer.dispose()');
    }
  }
  await mkdir(out,{recursive:true});await writeFile(join(out,'layout.json'),JSON.stringify({sourceSha,candidate,browser,rows},null,2));console.log(`C9 layout ${candidate?'candidate':'baseline'} PASS: ${rows.length} records`);
}finally{cdp?.close();child.kill('SIGKILL');server.close();await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
