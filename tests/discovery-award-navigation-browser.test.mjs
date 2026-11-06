import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const index=await readFile(join(root,'index.html'),'utf8');
const fixture=index.replace(/\s*<script type="module" src="\.\/src\/(?:app|pwa)\.js[^"]*"><\/script>/g,'');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(request,response)=>{
  try{
    const path=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if(path==='/__award__'){response.writeHead(200,{'content-type':mime['.html'],'cache-control':'no-store'});response.end(fixture);return;}
    const file=normalize(join(root,path==='/'?'index.html':path.replace(/^\/+/,'')));
    if(!file.startsWith(root)){response.writeHead(403).end();return;}
    response.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});
    response.end(await readFile(file));
  }catch{response.writeHead(404).end('not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let chrome=process.env.CHROMIUM_PATH??'';
if(!chrome)for(const command of ['chromium','google-chrome','chromium-browser']){
  const found=spawnSync('which',[command],{encoding:'utf8'});
  if(found.status===0){chrome=found.stdout.trim();break;}
}
assert.ok(chrome,'Chromium is required for discovery award navigation validation');
const profile=await mkdtemp(join(tmpdir(),'molecule-award-navigation-'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let child=null,socket=null;
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-background-networking',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
  let endpoint='';
  for(let i=0;i<100;i++){
    try{endpoint=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n')[0];break;}catch{await pause(100);}
  }
  assert.ok(endpoint,'Chromium DevTools did not start');
  const tabs=await fetch(`http://127.0.0.1:${endpoint}/json/list`).then(response=>response.json());
  socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(!pending.has(message.id))return;const job=pending.get(message.id);pending.delete(message.id);message.error?job.reject(Error(message.error.message)):job.resolve(message.result);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  const waitFor=async(expression,label)=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(50);}throw Error(label);};
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/__award__`});
  const started=await evaluate(`(async()=>{
    const chemistry=await import('/src/chemistry.js?v=20');await chemistry.loadMoleculeDatabase();
    const [polymerRecords,polymerContent,routeData]=await Promise.all(['/data/polymers.json','/data/polymer-encyclopedia.json','/data/polymerization-routes.json'].map(path=>fetch(path).then(response=>response.json())));
    const records=chemistry.moleculeCatalog(),values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
    const {createCollectionUI}=await import('/src/collection-ui.js');
    const {createReactionCatalogAuthority}=await import('/src/reaction-catalog-authority.js');
    const {createReactionProgress}=await import('/src/reaction-progress.js');
    const {createReactionLabDiscoveryCoordinator}=await import('/src/reaction-lab-discovery.js');
    const collection=await createCollectionUI({records,storage,onPlace:()=>{},canOpen:()=>true,elementAccess:()=>true,recipeState:()=>({recipes:[],hints:[]}),polymerRecords,polymerContent,polymerRoutes:routeData.routes});
    const authority=createReactionCatalogAuthority({polymerRoutes:routeData.routes}),progress=createReactionProgress({storage,authority});
    collection.setReactionProgress(authority,progress);
    const coordinator=createReactionLabDiscoveryCoordinator({records,collection,reactionAuthority:authority,reactionProgress:progress,getBatchGeneration:()=>1,closeLabAndWait:()=>Promise.resolve(),onDiagnostic:item=>{throw Error(item.message)}});
    const reaction=authority.get('normal:complete-01-anhydride-hydrolysis'),reactionId=reaction.reactionId.slice('normal:'.length);
    const products=reaction.definition.products;
    const result=coordinator.handleProductEvent({reactionId,pathwayId:reactionId+'/browser-check',batchGeneration:1,products,productInstances:products.map((species,productIndex)=>({species,productIndex,instanceId:'instance-'+productIndex}))});
    window.__award={collection,coordinator,values};
    return{newReaction:result.newReaction,newSpecies:result.newSpecies};
  })()`);
  assert.equal(started.newReaction,'normal:complete-01-anhydride-hydrolysis');
  assert.deepEqual(started.newSpecies,['acetic-acid']);
  await waitFor(`!!document.querySelector('#collection-dialog').open&&!!document.querySelector('.discovery-award-notice')`,'Reaction award did not open');
  assert.equal(await evaluate(`document.querySelector('#close-collection').getAttribute('aria-label')`),'発見演出を終えて次へ進む');
  await evaluate(`document.querySelector('#close-collection').click()`);
  await waitFor(`document.querySelector('#collection-dialog').open&&document.querySelector('#collection-detail').dataset.detailId==='acetic-acid'`,'Closing the star ceremony did not advance to molecule detail');
  assert.equal(await evaluate(`document.querySelector('#close-collection').getAttribute('aria-label')`),'図鑑を閉じる');
  assert.equal(await evaluate(`window.__award.coordinator.snapshot().queue.map(item=>item.status).join(',')`),'presented,active');
  assert.equal(await evaluate(`document.querySelector('.discovery-award-notice')===null`),true);
  await evaluate(`document.querySelector('#close-collection').click()`);
  await waitFor(`!document.querySelector('#collection-dialog').open`,'Normal detail close did not close the Collection');

  await evaluate(`(()=>{
    const collection=window.__award.collection;
    collection.registerDiscoveredPolymer('polyethylene');
    window.__award.polymerSettled=null;
    if(!collection.openPolymerAward('polyethylene',{onSettled:result=>window.__award.polymerSettled=result.status}))throw Error('Polymer award did not start');
    document.querySelector('#close-collection').click();
  })()`);
  assert.deepEqual(await evaluate(`(()=>({open:document.querySelector('#collection-dialog').open,kind:document.querySelector('#collection-detail').dataset.detailKind,id:document.querySelector('#collection-detail').dataset.detailId,status:window.__award.polymerSettled}))()`),{open:true,kind:'polymers',id:'polyethylene',status:'presented'});
}finally{
  try{socket?.close();}catch{}
  child?.kill('SIGKILL');
  server.close();
  await pause(100);
  await rm(profile,{recursive:true,force:true});
}
console.log('Discovery award navigation browser: star × → molecule detail, ordinary × close, polymer × → detail PASS');
