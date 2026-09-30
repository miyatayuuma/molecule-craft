// Dependency-free Chromium/CDP benchmark. Timing is descriptive, never a CI threshold.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,resolve,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const root=process.env.FIELD_BENCH_ROOT??fileURLToPath(new URL('../',import.meta.url)),out=resolve(process.env.FIELD_BENCH_OUTPUT??join(root,'test-results/field-particle-p1'));
await mkdir(out,{recursive:true});
let chrome=process.env.CHROME_BIN;for(const name of ['google-chrome','chromium','chromium-browser']){if(chrome)break;const r=spawnSync('which',[name],{encoding:'utf8'});if(!r.status)chrome=r.stdout.trim();}assert.ok(chrome,'Set CHROME_BIN to a Chromium executable');
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),path=resolve(root,'.'+url.pathname);if(relative(root,path).startsWith('..')){res.writeHead(403).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json'})[extname(path)]??'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const profile=await mkdtemp(join(tmpdir(),'field-p1-')),args=['--headless=new','--no-sandbox','--disable-background-networking',`--user-data-dir=${profile}`,'--remote-debugging-port=0',...(process.env.FIELD_CHROME_ARGS?JSON.parse(process.env.FIELD_CHROME_ARGS):[]),'about:blank'];let child,socket;
try{
  child=spawn(chrome,args,{stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
  let endpoint;for(let i=0;i<150;i++){endpoint=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];if(endpoint)break;if(child.exitCode!==null)throw Error(stderr);await new Promise(done=>setTimeout(done,100));}assert.ok(endpoint,stderr);
  const base=new URL(endpoint),tabs=await fetch(`http://${base.host}/json/list`).then(r=>r.json());socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((done,reject)=>{socket.addEventListener('open',done,{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map(),errors=[];socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/tests/field-particle-performance-harness.html`});
  let ready=false;for(let i=0;i<100;i++){ready=await evaluate('!!window.ready');if(ready)break;await new Promise(done=>setTimeout(done,100));}assert.ok(ready,'harness ready');
  const report={basis:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),browser:await send('Browser.getVersion'),gpu:await send('SystemInfo.getInfo').catch(()=>({note:'SystemInfo requires browser target; flags identify raster backend'})),platform:process.platform,arch:process.arch,args,viewport:[390,844],deviceScaleFactor:2,results:[],visuals:[]};
  for(const reduced of (process.env.FIELD_VISUAL_ONLY?[]:[false,true])){
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
    for(const name of ['normal','dense','awakened','dynamic-heavy']){
      const r=await evaluate(`measure(${JSON.stringify(name)},${reduced})`);assert.equal(r.counters.renderScanned,r.population.totalDust*60);assert.equal(r.counters.renderScanned,r.counters.renderNotReady+r.counters.renderOffscreen+r.counters.rendered);assert.equal(r.counters.glowDraws,r.counters.rendered);assert.equal(r.counters.centerDraws,r.counters.rendered);assert.equal(r.canvas[0],683);assert.equal(r.canvas[1],1477);if(reduced)assert.equal(r.counters.flowStrokes,0);report.results.push(r);console.log(name,reduced?'reduced':'normal',JSON.stringify(r.frameCpuMs));
    }
  }
  for(const region of ['veil','carbon','oxygen','frontier','nitrogen','rare-P','rare-S','rare-F','rare-Cl'])for(const reduced of [false,true]){
    const name=region.startsWith('rare')?'awakened':'normal',r=await evaluate(`visual(${JSON.stringify(name)},${JSON.stringify(region)},${reduced})`),file=`${region}-${reduced?'reduced':'normal'}.png`;
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{x:0,y:0,width:390,height:844,scale:.5}});await writeFile(join(out,file),Buffer.from(shot.data,'base64'));report.visuals.push({region,reduced,file,...r});
  }
  assert.deepEqual(errors,[]);await writeFile(join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');
}finally{
  socket?.close();
  if(child&&child.exitCode===null&&child.signalCode===null){
    await new Promise(done=>{const timer=setTimeout(done,5000);child.once('close',()=>{clearTimeout(timer);done();});child.kill('SIGKILL');});
  }
  await new Promise(done=>server.close(done));
  // Chromium subprocesses may finish writing after the parent exits.
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
