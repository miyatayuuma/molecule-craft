import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {POLYMER_2D_PILOT_IDS} from '../scripts/polymer-structure-svg.mjs';

const pilotIds=POLYMER_2D_PILOT_IDS;
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=join(root,'test-results','task7-polymer-visual-qa');
const indexHtml=await readFile(join(root,'index.html'),'utf8');
const fixtureHtml=indexHtml.replace(/\s*<script type="module" src="\.\/src\/(?:app|pwa)\.js[^"]*"><\/script>/g,'');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/__task7_collection__'){
      res.writeHead(200,{'content-type':mime['.html'],'cache-control':'no-store'});
      res.end(fixtureHtml);return;
    }
    if(pathname==='/__task7_contact_sheet__'){
      const cards=pilotIds.map(id=>'<article><h2>'+id+'</h2><div class="pair"><figure><figcaption>390 × 844</figcaption><img src="/test-results/task7-polymer-visual-qa/'+id+'-mobile-model.png" alt="'+id+' mobile"></figure><figure><figcaption>1280 × 900</figcaption><img src="/test-results/task7-polymer-visual-qa/'+id+'-desktop-model.png" alt="'+id+' desktop"></figure></div></article>').join('');
      const sheet='<!doctype html><html lang="en"><meta charset="utf-8"><title>Task7 polymer visual QA</title><style>html,body{margin:0;background:#07131e;color:#f2f7fa;font:18px/1.4 sans-serif}main{width:1420px;margin:0 auto;padding:12px}h1{font-size:25px;margin:0 0 10px}article{display:grid;grid-template-columns:250px 1fr;align-items:start;border-top:1px solid #526777;padding:8px 0;min-height:215px}h2{font:700 17px/1.3 ui-monospace,monospace;margin:8px 10px 0 0;overflow-wrap:anywhere}.pair{display:grid;grid-template-columns:390px 760px;gap:12px}figure{margin:0;background:#122638;border-radius:8px;overflow:hidden}figcaption{padding:3px 8px;color:#d8e7ef;font-size:14px}img{display:block;width:100%;height:auto;object-fit:contain}body>main>p{margin:0 0 8px;color:#c5d6e0;font-size:14px}</style><main><h1>Task7 Collection detail visual crops</h1><p>Rendered from the actual Collection detail screen; original mobile and desktop viewport screenshots are saved separately.</p>'+cards+'</main></html>';
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      res.end(sheet);return;
    }
    const file=normalize(join(root,pathname==='/'?'index.html':pathname.replace(/^\/+/,'')));
    if(!file.startsWith(root)){res.writeHead(403).end();return;}
    res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});
    res.end(await readFile(file));
  }catch{res.writeHead(404).end('not found');}
});
await mkdir(output,{recursive:true});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const port=server.address().port;
let chrome=process.env.CHROMIUM_PATH??'';
if(!chrome)for(const command of ['google-chrome','chromium','chromium-browser']){
  const found=spawnSync('which',[command],{encoding:'utf8'});
  if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}
}
assert.ok(chrome,'A Chromium browser is required for Task7 Collection visual QA');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-task7-'));
const debugPort=9367,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let child=null,socket=null;
try{
  child=spawn(chrome,[
    '--headless=new','--no-sandbox','--disable-background-networking',
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',
    '--force-device-scale-factor=1','--hide-scrollbars','--user-data-dir='+profile,
    '--remote-debugging-port='+debugPort,'about:blank',
  ],{stdio:'ignore'});
  let tabs=null;
  for(let attempt=0;attempt<160;attempt++){
    try{
      const response=await fetch('http://127.0.0.1:'+debugPort+'/json/list');
      if(response.ok){tabs=await response.json();if(tabs.length)break;}
    }catch{}
    await pause(100);
  }
  assert.ok(tabs?.length,'Task7 browser DevTools endpoint did not become ready');
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{
    const timer=setTimeout(()=>fail(Error('Task7 browser DevTools websocket timeout')),5000);
    socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});
    socket.addEventListener('error',fail,{once:true});
  });
  let sequence=0;
  const pending=new Map();
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id&&pending.has(message.id)){
      const task=pending.get(message.id);pending.delete(message.id);
      message.error?task.reject(Error(message.error.message)):task.resolve(message.result);
    }
  });
  const send=(method,params={})=>new Promise((ok,fail)=>{
    const id=++sequence;pending.set(id,{resolve:ok,reject:fail});
    socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);
    return result.result?.value;
  };
  const waitFor=async(expression,label,attempts=150)=>{
    for(let index=0;index<attempts;index++){
      try{if(await evaluate(expression))return;}catch{}
      await pause(100);
    }
    throw Error(label);
  };
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/__task7_collection__'});
  const bootstrap="(async()=>{const chemistry=await import('/src/chemistry.js?v=20'),loaded=await chemistry.loadMoleculeDatabase();if(!loaded.ok)return{ok:false};const [polymerRecords,polymerContent,routeAuthority]=await Promise.all(['/data/polymers.json','/data/polymer-encyclopedia.json','/data/polymerization-routes.json'].map(path=>fetch(path).then(response=>response.json())));const moleculeSave={schemaVersion:3,discoveredMolecules:[{id:'water',at:1,order:1}],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]},values=new Map([['molecule-craft.collection.v1',JSON.stringify(moleculeSave)]]),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};const {createCollectionUI}=await import('/src/collection-ui.js?task7-visual=1');window.__task7Collection=await createCollectionUI({records:chemistry.moleculeCatalog(),storage,onPlace:()=>{},canOpen:()=>true,elementAccess:()=>true,recipeState:()=>({recipes:[],hints:[]}),polymerRecords,polymerContent,polymerRoutes:routeAuthority.routes});return{ok:true,polymers:polymerRecords.length};})()";
  await waitFor('document.readyState==="complete"','Task7 Collection fixture did not load');
  assert.deepEqual(await evaluate(bootstrap),{ok:true,polymers:25});
  await evaluate("document.querySelector('#open-collection').click();document.querySelector('[data-book-tab=\"polymers\"]').click()");
  const viewports=[
    {name:'mobile',width:390,height:844,mobile:true},
    {name:'desktop',width:1280,height:900,mobile:false},
  ];
  for(const viewport of viewports){
    await send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:viewport.mobile});
    await pause(120);
    for(let index=0;index<pilotIds.length;index++){
      const id=pilotIds[index];
      const opened=await evaluate("(async()=>{const api=window.__task7Collection,id="+JSON.stringify(id)+";api.registerDiscoveredPolymer(id,{at:1700000000000+"+index+"});const result=api.openEntry('polymers',id);await new Promise(resolve=>setTimeout(resolve,80));const image=document.querySelector('#collection-detail .polymer-detail-visual');if(image&&!image.complete)await new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});});try{await image?.decode?.();}catch{}const dialog=document.querySelector('#collection-dialog');if(dialog)dialog.scrollTop=0;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const detail=document.querySelector('#collection-detail'),stage=image?.closest('.model-stage'),r=image?.getBoundingClientRect(),s=stage?.getBoundingClientRect();return{opened:result!==false,dialogOpen:dialog?.open===true,detailId:detail?.dataset.detailId,src:image?.getAttribute('src')??'',alt:image?.alt??'',loaded:!!image&&image.complete&&image.naturalWidth>0&&image.naturalHeight>0,imageRect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,stageRect:s?{x:s.x,y:s.y,width:s.width,height:s.height}:null,documentWidth:document.documentElement.clientWidth,documentHeight:document.documentElement.clientHeight,documentScroll:document.documentElement.scrollWidth,dialogWidth:dialog?.clientWidth,dialogScroll:dialog?.scrollWidth};})()");
      assert.ok(opened.opened&&opened.dialogOpen,viewport.name+' '+id+': Collection detail did not open');
      assert.equal(opened.detailId,id,viewport.name+' '+id+': wrong detail entry');
      assert.match(opened.src,new RegExp('polymer-'+id+'\\.svg$'));
      assert.ok(opened.loaded,viewport.name+' '+id+': SVG did not load in Collection');
      assert.ok(opened.alt,viewport.name+' '+id+': detail image has no accessible alternative');
      assert.ok(opened.imageRect?.width>0&&opened.imageRect?.height>0,viewport.name+' '+id+': image has no visible area');
      assert.ok(opened.stageRect?.width>0&&opened.stageRect?.height>0,viewport.name+' '+id+': image stage has no visible area');
      assert.ok(opened.documentScroll<=opened.documentWidth+1&&opened.dialogScroll<=opened.dialogWidth+1,viewport.name+' '+id+': horizontal overflow '+JSON.stringify(opened));
      assert.ok(opened.imageRect.x>=0&&opened.imageRect.x+opened.imageRect.width<=opened.documentWidth+1,viewport.name+' '+id+': image is horizontally clipped');
      assert.ok(opened.imageRect.y>=0&&opened.imageRect.y+opened.imageRect.height<=opened.documentHeight+1,viewport.name+' '+id+': image is vertically clipped');
      const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
      const path=join(output,id+'-'+viewport.name+'.png');
      const bytes=Buffer.from(shot.data,'base64');
      assert.ok(bytes.length>1000,viewport.name+' '+id+': screenshot output is unexpectedly small');
      await writeFile(path,bytes);
      const modelShot=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false,clip:{x:opened.stageRect.x,y:opened.stageRect.y,width:opened.stageRect.width,height:opened.stageRect.height,scale:1}});
      await writeFile(join(output,id+'-'+viewport.name+'-model.png'),Buffer.from(modelShot.data,'base64'));
      await pause(80);
    }
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:3000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/__task7_contact_sheet__'});
  await waitFor('document.images.length===18&&[...document.images].every(image=>image.complete&&image.naturalWidth>0)','Task7 visual contact sheet images did not load');
  const preview=await send('Page.captureScreenshot',{format:'jpeg',quality:65,fromSurface:true,captureBeyondViewport:true});
  const previewPath=join(output,'task7-collection-detail-contact-sheet.jpg');
  await writeFile(previewPath,Buffer.from(preview.data,'base64'));
  if(process.env.TASK7_EXPORT_VISUAL_QA==='1'){
    console.log('TASK7_VISUAL_QA_CONTACT_SHEET_BASE64_BEGIN');
    console.log(preview.data);
    console.log('TASK7_VISUAL_QA_CONTACT_SHEET_BASE64_END');
  }
  const manifest={viewports,polymerIds:pilotIds,screenshots:pilotIds.flatMap(id=>viewports.map(viewport=>id+'-'+viewport.name+'.png')),modelCrops:pilotIds.flatMap(id=>viewports.map(viewport=>id+'-'+viewport.name+'-model.png')),contactSheet:'task7-collection-detail-contact-sheet.jpg',source:'Collection detail screen rendered in headless Chromium from this checkout'};
  await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}finally{
  try{socket?.close();}catch{}
  try{child?.kill('SIGKILL');}catch{}
  await pause(100);server.close();await rm(profile,{recursive:true,force:true});
}
console.log('Task7 Collection visual QA passed: 9 known polymer detail views at 390×844 and 1280×900; 18 viewport screenshots saved to test-results/task7-polymer-visual-qa.');
