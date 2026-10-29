import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),outputDir=join(root,'test-results','encyclopedia-content');
const indexHtml=await readFile(join(root,'index.html'),'utf8');
const fixtureHtml=indexHtml.replace(/\s*<script type="module" src="\.\/src\/(?:app|pwa)\.js[^\"]*"><\/script>/g,'');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/__encyclopedia_content_fixture__'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(fixtureHtml);return;}const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=normalize(join(root,relative));if(!file.startsWith(root)){res.writeHead(403).end();return;}const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);}catch{res.writeHead(404).end('not found');}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const {port}=server.address();
let chrome='';for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'Chromium is required for Encyclopedia content validation');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-encyclopedia-content-')),debugPort=9238;let child=null,socket=null;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});let tabs=null;
  for(let attempt=0;attempt<120;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await pause(100);}
  assert.ok(tabs?.length,'DevTools endpoint did not become ready');socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}});
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.exception?.description??response.exceptionDetails.text);return response.result?.value;};
  const screenshot=async name=>{const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await mkdir(outputDir,{recursive:true});await writeFile(join(outputDir,name),Buffer.from(shot.data,'base64'));};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:`http://127.0.0.1:${port}/__encyclopedia_content_fixture__`});await pause(150);
  const targetIds=['water','oxygen','nitrogen','ammonia','carbon-monoxide','benzene','cyclopropane','nitromethane','nitrobenzene','ozone','sulfuric-acid','n-butane','isobutane','2-butene'];
  const seededIds=['water','oxygen','nitrogen','ammonia','carbon-monoxide','benzene','cyclopropane','nitromethane','nitrobenzene','ozone','sulfuric-acid','n-butane','isobutane','2-butene','methanol'];
  const initialized=await evaluate(`(async()=>{const chemistry=await import('/src/chemistry.js?v=20'),loaded=await chemistry.loadMoleculeDatabase();if(!loaded.ok)return{ok:false};const records=chemistry.moleculeCatalog(),ids=${JSON.stringify(seededIds)},save={schemaVersion:3,discoveredMolecules:ids.map((id,index)=>({id,at:1700000000000+index,order:index+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]},data=new Map([['molecule-craft.collection.v1',JSON.stringify(save)]]),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};const {createCollectionUI}=await import('/src/collection-ui.js?content-architecture=1');window.__collection=await createCollectionUI({records,storage,onPlace:()=>{},canOpen:()=>true,elementAccess:()=>true,recipeState:()=>({recipes:ids,hints:[]})});window.__hamajimaFetches=[];const originalFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=typeof input==='string'?input:input?.url??'';if(url.includes('hamajima.co.jp'))window.__hamajimaFetches.push(url);return originalFetch(input,init);};window.__dialogCount=document.querySelectorAll('dialog').length;window.__iframeCount=document.querySelectorAll('iframe').length;return{ok:true,hydroxylKnown:window.__collection.state.hasGroup('hydroxyl')};})()`);assert.equal(initialized.ok,true);assert.equal(initialized.hydroxylKnown,true,'Production methanol discovery makes its functional group detail available.');

  for(const id of targetIds){
    const opened=await evaluate(`window.__collection.openMolecule(${JSON.stringify(id)})`);assert.equal(opened,true,`${id}: should open from the registered catalog`);await pause(140);
    const before=await evaluate(`(()=>({id:document.querySelector('.molecule-detail-return')?.dataset.moleculeId,summary:document.querySelector('.dex-description')?.textContent?.trim()??'',detailsOpen:document.querySelector('.detail-extras')?.open??false}))()`);
    assert.equal(before.id,id);assert(before.summary.length>=12,`${id}: Summary must be visible before expanding details`);assert.equal(before.detailsOpen,false,`${id}: Chemistry Detail should remain progressive disclosure`);
    const expectedLinks={water:{'極性':'42224001','水素結合':'51112201'},oxygen:{'二重結合':'42222202'},nitrogen:{'三重結合':'42222203'},ammonia:{'孤立電子対':'42222105','水素結合':'51112201'},'n-butane':{'構造異性体':'54113101'}}[id]??{};
    if(Object.keys(expectedLinks).length){
      const anchors=await evaluate(`(()=>[...document.querySelectorAll('#collection-detail a')].map(link=>({text:link.textContent,href:link.href,target:link.target,rel:link.rel})))()`);
      for(const [term,pageId]of Object.entries(expectedLinks)){
        const matching=anchors.filter(link=>link.text===term);
        assert(matching.length>0,`${id}: player-facing ${term} must link to its exact entry`);
        assert(matching.every(link=>link.href===`https://www.hamajima.co.jp/rika/chemterm/${pageId}.html`),`${id}: ${term} destination must be exact`);
      }
      assert(anchors.every(link=>link.target==='_blank'&&link.rel==='noopener noreferrer external'),`${id}: Hamajima anchors keep the PubChem external-navigation contract`);
    }
    await evaluate(`document.querySelector('.detail-extras > summary').click()`);await pause(80);
    const inspected=await evaluate(`(()=>{const extra=document.querySelector('.detail-extras'),chem=[...extra.querySelectorAll('.chemistry-detail-section')].map(node=>({title:node.querySelector('h5')?.textContent?.trim()??'',body:node.querySelector('p')?.textContent?.trim()??''})),entryNotes=[...extra.querySelectorAll('[data-encyclopedia-note]')].map(node=>({key:node.dataset.encyclopediaNote??'',text:node.textContent.trim()})),buttons=[...extra.querySelectorAll('button.collection-tag')].map(node=>node.textContent.trim());return{open:extra.open,chem,entryNotes,hasRepeatedNoteHost:!!extra.querySelector('.model-collection-notes'),extraText:extra.textContent??'',buttons,detailWidth:document.querySelector('#collection-detail')?.clientWidth??0,detailScrollWidth:document.querySelector('#collection-detail')?.scrollWidth??0,docWidth:document.documentElement.clientWidth,docScrollWidth:document.documentElement.scrollWidth};})()`);
    assert.equal(inspected.open,true);assert(inspected.chem.length>=1,`${id}: molecule-specific Chemistry Detail required`);assert(inspected.chem.every(section=>section.title&&section.body.length>=24),`${id}: Chemistry Detail section must be complete`);
    assert.equal(inspected.hasRepeatedNoteHost,false,`${id}: repeated model/collection note container must not render`);assert(!inspected.extraText.includes('模型・収録について'),`${id}: repeated note heading must not render`);
    if(id==='2-butene'){const stereo=inspected.entryNotes.find(note=>note.key==='stereochemistry');assert(stereo?.text.includes('cis/trans'),`${id}: molecule-specific stereochemistry collection note must remain`);}else assert.equal(inspected.entryNotes.length,0,`${id}: no unrelated player-facing collection note should render`);
    assert(inspected.detailScrollWidth<=inspected.detailWidth+1,`${id}: detail content must not overflow horizontally on mobile`);assert(inspected.docScrollWidth<=inspected.docWidth+1,`${id}: page must not overflow horizontally on mobile`);
    if(id==='n-butane')assert(inspected.buttons.some(text=>/イソブタン/.test(text)),`${id}: structural-isomer link must remain available`);
    if(id==='isobutane')assert(inspected.buttons.some(text=>/n-ブタン|ブタン/.test(text)),`${id}: structural-isomer link must remain available`);
    if(id==='water'){
      const external=await evaluate(`(()=>{const link=[...document.querySelectorAll('#collection-detail a')].find(node=>node.textContent==='水素結合'),before={route:location.href,dialogs:document.querySelectorAll('dialog').length,iframes:document.querySelectorAll('iframe').length};link.addEventListener('click',event=>event.preventDefault(),{once:true});link.click();return{routeUnchanged:location.href===before.route,dialogsUnchanged:document.querySelectorAll('dialog').length===before.dialogs&&before.dialogs===window.__dialogCount,iframesUnchanged:document.querySelectorAll('iframe').length===before.iframes&&before.iframes===window.__iframeCount,fetches:[...window.__hamajimaFetches]};})()`);
      assert.equal(external.routeUnchanged,true,'Hamajima navigation does not enter a Molecule Craft route.');assert.equal(external.dialogsUnchanged,true,'No modal or popup is created for external content.');assert.equal(external.iframesUnchanged,true,'No iframe is created for external content.');assert.deepEqual(external.fetches,[],'Hamajima content is never fetched by Molecule Craft.');
    }
    if(['water','nitrobenzene','ozone'].includes(id))await screenshot(`${id}-detail-mobile.png`);
    await evaluate(`document.querySelector('.molecule-detail-return').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
    let settled=false;
    for(let i=0;i<45;i++){
      await pause(50);
      settled=await evaluate(`document.body.dataset.encyclopediaMoleculeOwner==='graph'&&document.querySelector('.graph-node.focus')?.dataset.graphId===${JSON.stringify(id)}&&!document.querySelector('.encyclopedia-molecule-transition')`);
      if(settled)break;
    }
    assert.equal(settled,true,`${id}: Detail → Graph transition must fully settle on the current molecule before the next open`);
  }
  const groupDetail=await evaluate(`(()=>{document.querySelector('[data-book-tab="groups"]').click();const card=document.querySelector('#collection-list [data-entry-id="hydroxyl"]');if(!card)return{card:false};card.click();const summary=document.querySelector('#collection-detail > .dex-description'),summaryText=summary?.textContent??'',summaryLinks=[...(summary?.querySelectorAll('a')??[])].map(link=>link.textContent);document.querySelector('.detail-extras > summary')?.click();const extra=document.querySelector('.detail-extras'),detailLinks=[...(extra?.querySelectorAll('p a')??[])].map(link=>link.textContent),unlockLinks=[...(document.querySelectorAll('.unlock-condition a'))].map(link=>link.textContent);return{card:true,summaryText,summaryLinks,detailLinks,unlockLinks};})()`);
  assert.equal(groupDetail.card,true,'A production functional group detail can be opened.');assert(groupDetail.summaryText.includes('アルコール'));assert(groupDetail.summaryLinks.includes('アルコール'),'Encyclopedia part prose links its exact chemistry term.');assert(groupDetail.detailLinks.includes('アルコール'),'Functional-group prose links its exact chemistry term.');assert.deepEqual(groupDetail.unlockLinks,[],'Player progression text receives no chemistry links.');
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await pause(100);server.close();await rm(profile,{recursive:true,force:true});}
console.log('Encyclopedia content browser validation passed: 14 representative molecules, exact Hamajima links and external navigation, functional-group prose, mobile Summary → Chemistry Detail → Graph return, and structural-isomer navigation.');
