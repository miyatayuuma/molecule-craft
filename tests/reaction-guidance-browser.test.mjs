import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),records=JSON.parse(await readFile(join(root,'data/molecules.json'),'utf8'));
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=normalize(join(root,path==='/'?'index.html':path.slice(1)));if(!file.startsWith(root))throw Error();res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let chrome='';for(const name of ['google-chrome','chromium','chromium-browser']){const p=spawnSync('which',[name],{encoding:'utf8'});if(p.status===0){chrome=p.stdout.trim();break;}}assert.ok(chrome);
const profile=await mkdtemp(join(tmpdir(),'reaction-guide-')),port=server.address().port,debug=9291,pause=ms=>new Promise(r=>setTimeout(r,ms));let child,socket;
try{
 child=spawn(chrome,['--headless=new','--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',`--user-data-dir=${profile}`,`--remote-debugging-port=${debug}`,'about:blank'],{stdio:'ignore'});
 let tabs;for(let i=0;i<180;i++){try{tabs=await fetch(`http://127.0.0.1:${debug}/json/list`).then(r=>r.json());if(tabs.length)break;}catch{}await pause(100);}assert.ok(tabs?.length,'Chrome unavailable');
 socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((ok,fail)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',fail,{once:true});});let seq=0;const pending=new Map();socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{let r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const wait=async(expression,label,timeout=20000)=>{for(let i=0;i<timeout/100;i++){try{if(await ev(expression))return;}catch{}await pause(100);}throw Error(label);};
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:Number(process.env.GUIDE_WIDTH??360),height:844,deviceScaleFactor:1,mobile:Number(process.env.GUIDE_WIDTH??360)<600});
 const saved={schemaVersion:3,discoveredMolecules:records.map((x,i)=>({id:x.id,at:i+1,order:i+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]};
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(!localStorage.getItem('molecule-craft.collection.v1'))localStorage.setItem('molecule-craft.collection.v1',${JSON.stringify(JSON.stringify(saved))});if(!localStorage.getItem('molecule-craft.reaction-progress.v1'))localStorage.setItem('molecule-craft.reaction-progress.v1',JSON.stringify({schemaVersion:1,hintedReactionIds:['normal:complete-21-cyclobutane-dimerization','normal:complete-01-anhydride-hydrolysis'],verifiedReactionIds:[]}));`});
 await send('Page.navigate',{url:`http://127.0.0.1:${port}/?reactionLabTest=1`});await wait("!!window.__reactionLabProbe&&!document.querySelector('#open-reaction-lab').disabled",'app ready');
 await ev(`document.querySelector('#open-collection').click();document.querySelector('[data-book-tab="reactions"]').click();[...document.querySelectorAll('#collection-list button')].find(b=>b.textContent.startsWith('環化')).click();document.querySelector('.reaction-book-hint').click();[...document.querySelectorAll('#collection-list button')].find(b=>b.textContent==='LABでためす').click()`);
 await wait("document.querySelector('#reaction-lab-dialog').open&&!document.querySelector('[data-reaction-guide]').hidden",'guided LAB opens');
 assert.equal(await ev("document.querySelectorAll('[data-lab-slot].reaction-guide-target').length"),1);
 assert.equal(await ev("document.querySelector('#reaction-lab-dialog').scrollWidth<=document.querySelector('#reaction-lab-dialog').clientWidth+1"),true);
 await ev("document.querySelector('[data-lab-slot].reaction-guide-target').click()");assert.equal(await ev("document.querySelectorAll('[data-lab-picker-list] .reaction-guide-target').length"),1);assert.equal(await ev("document.querySelector('[data-lab-picker-list] .reaction-guide-target').dataset.species"),'ethene');
 await ev("document.querySelector('[data-lab-picker-list] .reaction-guide-target').click()");assert.equal(await ev("document.querySelector('[data-lab-light]').classList.contains('reaction-guide-target')"),true);assert.equal(await ev("document.querySelector('[data-lab-feed]').classList.contains('reaction-guide-target')"),false);
 await ev("document.querySelector('[data-lab-feed]').click()");await wait("window.__reactionLabProbe.snapshot().batch.phase==='ACTIVE'",'FEED active');
 assert.equal(await ev("window.__reactionLabProbe.snapshot().polymerization.routeOwned"),false,'guided cyclobutane does not route to polyethylene');
 await ev("window.__reactionLabProbe.prepareGenericReactionPose('complete-21-cyclobutane-dimerization');window.__reactionLabProbe.advanceDeterministic(20)");
 assert.equal(await ev("(JSON.parse(localStorage.getItem('molecule-craft.reaction-progress.v1')).verifiedReactionIds||[]).length"),0,'incorrect conditions do not verify');
 await ev("document.querySelector('[data-lab-light]').click()");
 await ev("window.__reactionLabProbe.prepareGenericReactionPose('complete-21-cyclobutane-dimerization');window.__reactionLabProbe.advanceDeterministic(10)");
 await wait("(JSON.parse(localStorage.getItem('molecule-craft.reaction-progress.v1')).verifiedReactionIds||[]).includes('normal:complete-21-cyclobutane-dimerization')",'cyclobutane event persists',20000);
 assert.equal(await ev("(JSON.parse(localStorage.getItem('molecule-craft.reaction-progress.v1')).verifiedReactionIds||[]).includes('polymer:polyethylene-coordination')"),false);
 console.log('T3_GUIDED_CYCLOBUTANE PASS');
 await ev("document.querySelector('[data-lab-close]').click()");await wait("!document.querySelector('#reaction-lab-dialog').open",'lab closes');
 await send('Page.reload');await wait("!!window.__reactionLabProbe&&!document.querySelector('#open-reaction-lab').disabled",'reload ready');
 assert.equal(await ev("document.querySelector('[data-reaction-guide]').hidden"),true,'guide does not persist after reload');
 await ev(`document.querySelector('#open-collection').click();document.querySelector('[data-book-tab="reactions"]').click();[...document.querySelectorAll('#collection-list button')].find(b=>b.textContent.startsWith('加水分解')).click();document.querySelector('.reaction-book-hint').click();[...document.querySelectorAll('#collection-list button')].find(b=>b.textContent==='LABでためす').click()`);
 await wait("document.querySelector('#reaction-lab-dialog').open&&!document.querySelector('[data-reaction-guide]').hidden",'second guide opens');
 for(const species of ['acetic-anhydride','water']){
   await wait("!!document.querySelector('[data-lab-slot].reaction-guide-target')",'required slot');await ev("document.querySelector('[data-lab-slot].reaction-guide-target').click()");
   assert.equal(await ev("document.querySelector('[data-lab-picker-list] .reaction-guide-target').dataset.species"),species);await ev("document.querySelector('[data-lab-picker-list] .reaction-guide-target').click()");
 }
 assert.equal(await ev("document.querySelector('[data-lab-feed]').classList.contains('reaction-guide-target')"),true,'conditionless route advances to FEED');
 await ev("document.querySelector('[data-lab-feed]').click()");await wait("window.__reactionLabProbe.snapshot().batch.phase==='ACTIVE'",'second FEED active');
 await ev("window.__reactionLabProbe.prepareGenericReactionPose('complete-01-anhydride-hydrolysis');window.__reactionLabProbe.advanceDeterministic(10)");
 await wait("JSON.parse(localStorage.getItem('molecule-craft.reaction-progress.v1')).verifiedReactionIds.includes('normal:complete-01-anhydride-hydrolysis')",'conditionless route saved');
 await ev("document.querySelector('[data-reaction-guide-cancel]').click()");assert.equal(await ev("document.querySelector('[data-reaction-guide]').hidden"),true);assert.equal(await ev("document.querySelectorAll('.reaction-guide-target').length"),0);
 await ev("document.querySelector('[data-lab-close]').click()");await wait("!document.querySelector('#reaction-lab-dialog').open",'lab closes again');await ev("document.querySelector('#open-reaction-lab').click()");await wait("document.querySelector('#reaction-lab-dialog').open",'free lab opens');assert.equal(await ev("document.querySelector('[data-reaction-guide]').hidden"),true,'free lab remains unguided');
 console.log('T3_GUIDED_NO_CONDITION_AND_CANCEL PASS');

}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}server.close();await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100});}
