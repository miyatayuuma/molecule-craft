import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),indexHtml=await readFile(join(root,'index.html'),'utf8');
const fixtureHtml=indexHtml.replace(/\s*<script type="module" src="\.\/src\/(?:app|pwa)\.js[^"]*"><\/script>/g,'');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/__collection-polymer__'){res.writeHead(200,{'content-type':mime['.html'],'cache-control':'no-store'});res.end(fixtureHtml);return;}const file=normalize(join(root,pathname==='/'?'index.html':pathname.replace(/^\/+/,'')));if(!file.startsWith(root)){res.writeHead(403).end();return;}res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404).end('not found');}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const {port}=server.address();
let chrome=process.env.CHROMIUM_PATH??'';if(!chrome)for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'A Chromium browser is required for polymer Collection mobile validation');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-polymer-collection-')),debugPort=9261,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let child=null,socket=null;
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:'ignore'});
  let tabs=null;for(let attempt=0;attempt<160;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await pause(100);}assert.ok(tabs?.length,'Collection DevTools endpoint did not become ready');
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}});
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  const waitFor=async(expression,label,attempts=120)=>{for(let index=0;index<attempts;index++){try{if(await evaluate(expression))return;}catch{}await pause(100);}throw Error(label);};
  const capture=async label=>{
    const dir=process.env.REACTION_BOOK_CAPTURE_DIR;
    if(!dir)return;
    await mkdir(join(root,dir),{recursive:true});
    const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(join(root,dir,label+'-'+(process.env.REACTION_VIEWPORT||360)+'.png'),Buffer.from(result.data,'base64'));
  };
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:Number(process.env.REACTION_VIEWPORT||360),height:844,deviceScaleFactor:1,mobile:Number(process.env.REACTION_VIEWPORT||360)<600});await send('Page.navigate',{url:`http://127.0.0.1:${port}/__collection-polymer__`});
  const ready=await evaluate(`(async()=>{const chemistry=await import('/src/chemistry.js?v=20'),loaded=await chemistry.loadMoleculeDatabase();if(!loaded.ok)return{ok:false,reason:'molecule-db'};const [polymerRecords,polymerContent,routeAuthority]=await Promise.all(['/data/polymers.json','/data/polymer-encyclopedia.json','/data/polymerization-routes.json'].map(path=>fetch(path).then(response=>response.json())));const moleculeSave={schemaVersion:3,discoveredMolecules:[{id:'water',at:1,order:1}],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]},values=new Map([['molecule-craft.collection.v1',JSON.stringify(moleculeSave)]]),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};const {createResources}=await import('/src/veil/resources.js'),{RESOURCE_KEY,createInitialResourcesState}=await import('/src/veil/resources-persistence.js');storage.setItem(RESOURCE_KEY,JSON.stringify(createInitialResourcesState()));window.__engineeringStorage=storage;window.__engineeringResources=createResources({storage});const {createCollectionUI}=await import('/src/collection-ui.js?polymer-browser=1');window.__collection=await createCollectionUI({records:chemistry.moleculeCatalog(),storage,engineeringResources:window.__engineeringResources,onPlace:()=>{},canOpen:()=>true,elementAccess:()=>true,recipeState:()=>({recipes:[],hints:[]}),polymerRecords,polymerContent,polymerRoutes:routeAuthority.routes});return{ok:true,molecules:chemistry.moleculeCatalog().length,polymers:polymerRecords.length};})()`);
  assert.deepEqual(ready,{ok:true,molecules:142,polymers:25});
  await evaluate(`(async()=>{const {createReactionCatalogAuthority}=await import('/src/reaction-catalog-authority.js');const {createReactionProgress}=await import('/src/reaction-progress.js');const routes=(await fetch('/data/polymerization-routes.json').then(r=>r.json())).routes;const authority=createReactionCatalogAuthority({polymerRoutes:routes});const progress=createReactionProgress({storage:window.__engineeringStorage,authority});progress.hint('normal:complete-23-methanol-dehydration');window.__reactionProgress=progress;window.__collection.setReactionProgress(authority,progress);})()`);
  assert.equal(await evaluate(`window.__reactionProgress.getState('normal:complete-01-anhydride-hydrolysis')`),'notFound','legacy water does not verify a reaction');
  await evaluate(`window.__collection.registerDiscoveredPolymer('polyethylene');window.__collection.openPolymer('polyethylene')`);
  await waitFor(`document.querySelectorAll('#collection-detail .polymer-model-mode').length===2`,'Polymer model controls ready');
  await evaluate(`document.querySelectorAll('#collection-detail .polymer-model-mode')[1].click()`);
  assert.equal(await evaluate(`window.__reactionProgress.getState('polymer:polyethylene-coordination')`),'notFound','reference display does not verify LAB reaction');
  await evaluate(`document.querySelector('#close-collection').click()`);
  await evaluate(`document.querySelector('#open-collection').click();document.querySelector('[data-book-tab="reactions"]').click()`);
  assert.match(await evaluate(`document.querySelector('#collection-list').innerText`),/実証 0 \/ 54/);
  assert.equal(await evaluate(`document.querySelectorAll('#collection-list .rb-group-preview').length`),14);
  assert.equal(await evaluate(`[...document.querySelectorAll('.rb-group-preview svg')].every(svg=>!svg.querySelector('text, foreignObject') && Math.abs(parseFloat(getComputedStyle(svg).animationDuration)-5.6)<.01)`),true);
  assert.equal(await evaluate(`document.querySelectorAll('#collection-list canvas').length`),0);
  assert.equal(await evaluate(`[...document.querySelectorAll('#collection-list .reaction-book-group')].every(button=>button.getBoundingClientRect().height>=44)`),true);
  await send('Emulation.setEmulatedMedia',{media:'screen',features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await capture('groups-top');
  await evaluate(`document.querySelector('[data-preview-group="polymerization"]').scrollIntoView({block:'center'})`);
  await pause(150);
  await capture('groups-polymerization');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.rb-group-preview svg')).animationName`),'none');
  await send('Emulation.setEmulatedMedia',{media:'screen',features:[]});
  assert.equal(await evaluate(`document.querySelector('#collection-dialog').scrollWidth<=document.querySelector('#collection-dialog').clientWidth+1`),true);
  await evaluate(`[...document.querySelectorAll('#collection-list button')].find(b=>b.textContent.startsWith('脱水')).click()`);
  assert.match(await evaluate(`document.querySelector('#collection-list').innerText`),/ひらめいたレシピ · 未実証/);
  await evaluate(`document.querySelector('.reaction-book-hint').click()`);
  assert.match(await evaluate(`document.querySelector('#collection-list').innerText`),/まだLABで実証していません/);
  assert.equal(await evaluate(`[...document.querySelectorAll('#collection-list button')].some(button=>button.textContent==='LABでためす')`),true);
  await evaluate(`document.querySelector('#collection-list button').click();document.querySelector('#collection-list button').click()`);
  await evaluate(`[...document.querySelectorAll('#collection-list button')].find(b=>b.textContent.startsWith('環化')).click()`);
  const text=await evaluate(`document.querySelector('#collection-list').innerText`);assert.match(text,/未発見 1 件/);assert.doesNotMatch(text,/シクロブタン|エチレン/);
  assert.equal(await evaluate(`document.querySelectorAll('#collection-list [data-preview-reaction]').length`),0);
  assert.equal(await evaluate(`document.querySelector('#collection-dialog').scrollWidth<=document.querySelector('#collection-dialog').clientWidth+1`),true);
  await evaluate(`document.querySelector('#collection-list button').click()`);
  await evaluate(`(async()=>{
    const previewIds=['normal:complete-01-anhydride-hydrolysis','normal:complete-06-ethene-halogenation','normal:complete-21-cyclobutane-dimerization','polymer:polyethylene-coordination','polymer:polyethylene-terephthalate-direct-polycondensation'];
    for(const id of previewIds)window.__reactionProgress.verify(id);
    const {createReactionCatalogAuthority}=await import('/src/reaction-catalog-authority.js');
    const routes=(await fetch('/data/polymerization-routes.json').then(response=>response.json())).routes;
    window.__collection.setReactionProgress(createReactionCatalogAuthority({polymerRoutes:routes}),window.__reactionProgress);
    document.querySelector('[data-book-tab="molecules"]').click();
    document.querySelector('[data-book-tab="reactions"]').click();
  })()`);
  assert.match(await evaluate(`document.querySelector('#collection-list').innerText`),/実証 5 \/ 54/);
  assert.equal(await evaluate(`document.querySelectorAll('#collection-list [data-preview-group]').length`),14);
  const previews=[['加水分解','normal:complete-01-anhydride-hydrolysis'],['付加','normal:complete-06-ethene-halogenation'],['環化','normal:complete-21-cyclobutane-dimerization'],['重合','polymer:polyethylene-coordination']];
  for(const [label,id] of previews){
    await evaluate(`[...document.querySelectorAll('#collection-list button')].find(button=>button.textContent.startsWith(${JSON.stringify(label)})).click()`);
    assert.equal(await evaluate(`!!document.querySelector('[data-preview-reaction="${id}"]')`),true,'missing '+id);
    assert.equal(await evaluate(`document.querySelector('#collection-dialog').scrollWidth<=document.querySelector('#collection-dialog').clientWidth+1`),true);
    if(label==='重合'){
      assert.equal(await evaluate(`!!document.querySelector('[data-preview-reaction="polymer:polyethylene-terephthalate-direct-polycondensation"]')`),true);
      await waitFor(`!!document.querySelector('[data-preview-reaction="polymer:polyethylene-coordination"] img[data-polymer-unit="polyethylene"]')?.naturalWidth`, 'Polyethylene unit image did not load', 300);
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-polymer-unit="polyethylene"]')).backgroundColor`),'rgba(0, 0, 0, 0)');
      await capture('verified-polymer');
    }
    await evaluate(`document.querySelector('#collection-list button').click()`);
  }
  const fullCoverage=await evaluate(`(async()=>{
    const {createReactionCatalogAuthority}=await import('/src/reaction-catalog-authority.js');
    const routes=(await fetch('/data/polymerization-routes.json').then(r=>r.json())).routes;
    const authority=createReactionCatalogAuthority({polymerRoutes:routes});
    for(const entry of authority.entries())window.__reactionProgress.verify(entry.reactionId);
    window.__collection.setReactionProgress(authority,window.__reactionProgress);
    document.querySelector('[data-book-tab="molecules"]').click();
    document.querySelector('[data-book-tab="reactions"]').click();
    const seen=new Set(),groups=document.querySelectorAll('.reaction-book-group').length;
    for(let i=0;i<groups;i++){
      document.querySelectorAll('.reaction-book-group')[i].click();
      for(const item of document.querySelectorAll('[data-preview-reaction]'))seen.add(item.dataset.previewReaction);
      const inspect=document.querySelector('.reaction-book-inspect');
      if(!inspect)throw Error('Missing verified detail button in group '+i);
      inspect.click();
      const detail=document.querySelector('.rb-detail-chemistry');
      if(!detail||!detail.querySelector('.rb-detail-formula')?.textContent.includes('→')||!detail.textContent.includes('結合の変化'))throw Error('Missing chemistry detail in group '+i);
      if(document.querySelector('.rb-detail-molecules'))throw Error('Duplicated thumbnail models in group '+i);
      if(![...document.querySelectorAll('#collection-list button')].some(b=>b.textContent.includes('LABでもう一度ためす')))throw Error('Missing LAB route in group '+i);
      document.querySelector('#collection-list button').click();
      document.querySelector('#collection-list button').click();
    }
    return{groups,seen:seen.size,overflow:document.querySelector('#collection-dialog').scrollWidth>document.querySelector('#collection-dialog').clientWidth+1};
  })()`);
  assert.deepEqual(fullCoverage,{groups:14,seen:54,overflow:false});
  if(process.env.REACTION_BOOK_CAPTURE_DIR){
    for(let i=0;i<14;i++){
      await evaluate(`document.querySelectorAll('.reaction-book-group')[${i}].click();document.querySelector('#collection-list').scrollTop=0`);
      await capture('all-routes-group-'+String(i+1).padStart(2,'0'));
      if([0,2,7,12].includes(i)){
        await evaluate(`document.querySelector('.reaction-book-inspect').click();document.querySelector('#collection-list').scrollTop=0`);
        await capture('all-routes-detail-'+String(i+1).padStart(2,'0'));
        await evaluate(`document.querySelector('#collection-list button').click()`);
      }
      await evaluate(`document.querySelector('#collection-list button').click()`);
    }
  }
  await evaluate(`document.querySelector('[data-book-tab="polymers"]').click()`);assert.equal(await evaluate(`document.querySelectorAll('#collection-list [data-entry-id]').length`),25);
  await evaluate(`document.querySelector('[data-book-tab="molecules"]').click()`);assert.equal(await evaluate(`document.querySelector('[data-book-tab="molecules"]').getAttribute('aria-selected')`),'true');
  console.log('REACTION_BOOK_BROWSER PASS '+process.env.REACTION_VIEWPORT);
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}server.close();await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100});}
