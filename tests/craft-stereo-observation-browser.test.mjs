import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),captureDir=join(root,'test-results','craft-stereo-observation');
const html=await readFile(join(root,'index.html'),'utf8');
const craftHtml=html.replace(/\s*<script type="module" src="\.\/src\/pwa\.js[^"]*"><\/script>/g,'');
const seedHtml='<!doctype html><meta charset="utf-8"><title>CRAFT stereo seed</title>';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};

const server=createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/__craft_stereo_seed__'){res.writeHead(200,{'content-type':mime['.html'],'cache-control':'no-store'});res.end(seedHtml);return;}
  if(pathname==='/__craft_stereo__'){res.writeHead(200,{'content-type':mime['.html'],'cache-control':'no-store'});res.end(craftHtml);return;}
  const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,'');
  const file=normalize(join(root,relative));
  if(!file.startsWith(root)){res.writeHead(403).end();return;}
  const body=await readFile(file);
  res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});
  res.end(body);
}catch(error){res.writeHead(500).end(String(error?.stack??error));}});

await new Promise(done=>server.listen(0,'127.0.0.1',done));
const {port}=server.address(),origin=`http://127.0.0.1:${port}`;
let chrome='';
for(const command of ['google-chrome','chromium','chromium-browser']){
  const found=spawnSync('which',[command],{encoding:'utf8'});
  if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}
}
assert.ok(chrome,'Chromium is required for CRAFT stereo observation validation');

const profile=await mkdtemp(join(tmpdir(),'molecule-craft-stereo-craft-')),debugPort=9236;
let child=null,socket=null;
await mkdir(captureDir,{recursive:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);
  let tabs=null;
  for(let attempt=0;attempt<180;attempt++){
    try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}
    await pause(100);
  }
  assert.ok(tabs?.length,`Chromium DevTools endpoint did not become ready: ${stderr.slice(-1000)}`);
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});

  let seq=0;const pending=new Map(),exceptions=[];
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);return;}
    if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails);
  });
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++seq;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.exception?.description??response.exceptionDetails.text);return response.result?.value;};
  const waitFor=async(expression,message,{attempts=220,delay=50}={})=>{for(let i=0;i<attempts;i++){try{const value=await evaluate(expression);if(value)return value;}catch{}await pause(delay);}assert.fail(message);};
  const screenshot=async name=>{const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(join(captureDir,name),Buffer.from(shot.data,'base64'));};

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:780,deviceScaleFactor:1,mobile:true});

  const SAME=[[-1.15,.78,0],[-.58,0,0],[.58,0,0],[1.15,.78,0],[-1.65,1.15,.55],[-1.62,1.12,-.55],[-1.2,.95,0],[-1.08,-.78,0],[1.08,-.78,0],[1.65,1.15,.55],[1.62,1.12,-.55],[1.2,.95,0]];
  const OPPOSITE=[[-1.15,.78,0],[-.58,0,0],[.58,0,0],[1.15,-.78,0],[-1.65,1.15,.55],[-1.62,1.12,-.55],[-1.2,.95,0],[-1.08,-.78,0],[1.08,.78,0],[1.65,-1.15,.55],[1.62,-1.12,-.55],[1.2,-.95,0]];

  async function seedWorkspace(id,coordinates){
    await send('Page.navigate',{url:`${origin}/__craft_stereo_seed__`});
    await waitFor(`location.pathname==='/__craft_stereo_seed__'`,'CRAFT stereo seed page did not load');
    const ok=await evaluate(`(async()=>{
      localStorage.clear();
      const records=await fetch('/data/molecules.json').then(r=>r.json());
      const record=records.find(item=>item.id===${JSON.stringify(id)});
      const coordinates=${JSON.stringify(coordinates)};
      if(!record||coordinates.length!==record.atoms.length)return false;
      const save={
        schemaVersion:2,
        atoms:record.atoms.map((element,index)=>({element,position:coordinates[index]})),
        bonds:record.bonds.map(bond=>[...bond]),
        selected:null,focus:0,pivot:null,targetMoleculeId:null,
        camera:{position:[5.2,4,7.6],target:[0,0,0],up:[0,1,0]}
      };
      localStorage.setItem('molecule-craft.workspace.v1',JSON.stringify(save));
      return true;
    })()`);
    assert.equal(ok,true,`${id}: workspace seed failed`);
    exceptions.length=0;
    await send('Page.navigate',{url:`${origin}/__craft_stereo__?case=${encodeURIComponent(id)}&t=${Date.now()}`});
    await waitFor(`document.querySelector('#viewer canvas')?.getBoundingClientRect().width>250`,'CRAFT viewer did not initialize');
  }

  const readObservation=()=>evaluate(`(()=>{
    const node=document.querySelector('.craft-stereo-observation');
    const viewer=document.querySelector('.viewer-wrap');
    return{
      hidden:node?.hidden??true,
      label:document.querySelector('.craft-stereo-label')?.textContent??'',
      detail:document.querySelector('.craft-stereo-detail')?.textContent??'',
      relation:node?.dataset.relation??'',
      aria:node?.getAttribute('aria-label')??'',
      molecule:document.querySelector('#molecule-name')?.textContent??'',
      formula:document.querySelector('#formula')?.textContent??'',
      viewerWidth:viewer?.getBoundingClientRect().width??0,
      docWidth:document.documentElement.clientWidth,
      docScrollWidth:document.documentElement.scrollWidth
    };
  })()`);

  await seedWorkspace('2-butene',SAME);
  await waitFor(`document.querySelector('.craft-stereo-observation')?.dataset.relation==='same-side'`,'same-side restored CRAFT pose did not produce observation');
  const same=await readObservation();
  assert.equal(same.label,'cis (Z)');
  assert.match(same.detail,/\u540c\u3058\u5074/);
  assert.match(same.aria,/cis \(Z\)/);
  assert.match(same.molecule,/2-ブテン|2-Butene|butene/i);
  assert(same.viewerWidth>=350,'mobile completion viewer must not shrink');
  assert(same.docScrollWidth<=same.docWidth+1,'same-side completion must not overflow horizontally');
  await screenshot('2-butene-cis-z-craft-mobile.png');

  await seedWorkspace('2-butene',OPPOSITE);
  await waitFor(`document.querySelector('.craft-stereo-observation')?.dataset.relation==='opposite-side'`,'opposite-side restored CRAFT pose did not produce observation');
  const opposite=await readObservation();
  assert.equal(opposite.label,'trans (E)');
  assert.match(opposite.detail,/\u53cd\u5bfe\u5074/);
  assert.match(opposite.aria,/trans \(E\)/);
  assert(opposite.docScrollWidth<=opposite.docWidth+1,'opposite-side completion must not overflow horizontally');
  await screenshot('2-butene-trans-e-craft-mobile.png');

  const etheneCoordinates=[[-.65,0,0],[.65,0,0],[-1.15,.85,0],[-1.15,-.85,0],[1.15,.85,0],[1.15,-.85,0]];
  await seedWorkspace('ethene',etheneCoordinates);
  await waitFor(`document.querySelector('#molecule-name')?.textContent?.length>0`,'normal molecule workspace did not restore');
  await pause(250);
  const normal=await readObservation();
  assert.equal(normal.hidden,true,'non-2-butene molecule received stereo observation');
  assert.equal(normal.label,'');
  assert.equal(normal.relation,'');
  assert.equal(exceptions.length,0,`CRAFT stereo browser flow threw: ${JSON.stringify(exceptions)}`);
}finally{
  try{socket?.close();}catch{}
  try{child?.kill('SIGKILL');}catch{}
  await pause(120);
  server.close();
  await rm(profile,{recursive:true,force:true});
}
console.log('CRAFT stereo observation Chromium regression passed: restored player poses recompute cis/trans observation, remain isolated from normal molecules, fit 360x780, and preserve a purely derived UI state.');
