// FIELD P5 integrated profile. Timing is descriptive, never a CI threshold.
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,resolve,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(process.env.FIELD_PROFILE_OUTPUT??join(root,'test-results/field-particle-p5'));
const mode=process.env.FIELD_PROFILE_MODE??'coarse',smoke=process.argv.includes('--smoke'),runs=smoke?2:Number(process.env.FIELD_PROFILE_RUNS??5),stageRoots=JSON.parse(process.env.FIELD_PROFILE_ROOTS??'{}');
assert.ok(smoke||runs>=5);assert.ok(['coarse','components','history','sanity','scaling'].includes(mode));
await mkdir(out,{recursive:true});
let chrome=process.env.CHROME_BIN;for(const name of ['google-chrome','chromium','chromium-browser']){if(chrome)break;const r=spawnSync('which',[name],{encoding:'utf8'});if(!r.status)chrome=r.stdout.trim();}assert.ok(chrome,'Set CHROME_BIN to a Chromium executable');
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),parts=url.pathname.split('/'),stage=stageRoots[parts[1]],servingRoot=stage??root,path=resolve(servingRoot,'.'+(stage?'/'+parts.slice(2).join('/'):url.pathname));if(relative(servingRoot,path).startsWith('..')){res.writeHead(403).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json'})[extname(path)]??'application/octet-stream');let body=await readFile(path);if(stage&&url.pathname.endsWith('/tests/field-particle-performance-harness.html')){const original=body.toString(),anchor='samples:samples.length';assert.equal(original.split(anchor).length,2);body=original.replace(anchor,'raw:{cpu:samples,simulation,render,raf:intervals},samples:samples.length');}res.end(body);}catch{res.writeHead(404).end();}});
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
  const baseUrl=`http://127.0.0.1:${server.address().port}/`;
  const navigate=async path=>{await send('Page.navigate',{url:new URL(path,baseUrl).href});let ready=false;for(let i=0;i<150;i++){ready=await evaluate('!!window.ready');if(ready)break;await new Promise(done=>setTimeout(done,50));}assert.ok(ready,'harness ready');};
  await navigate('tests/field-particle-profile-harness.html');
  const report={basis:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),browser:await send('Browser.getVersion'),gpu:await send('SystemInfo.getInfo').catch(()=>({note:'SystemInfo requires browser target; flags identify raster backend'})),platform:process.platform,arch:process.arch,args,viewport:[390,844],deviceScaleFactor:2,results:[],visuals:[]};
  report.runtimeSourceSha256={};for(const file of ['src/veil/universe.js','src/veil/engine.js','src/veil/dust-spatial-index.js','src/veil/dynamic-dust-registry.js','src/veil/renderer.js']){try{report.runtimeSourceSha256[file]=createHash('sha256').update(await readFile(join(root,file))).digest('hex');}catch(error){if(error.code!=='ENOENT')throw error;}}
  report.mode=mode;report.runs=runs;report.smoke=smoke;report.stageSources={};report.profileSourceSha256={};
  for(const file of ['scripts/profile-field-particles.mjs','tests/field-particle-profile-harness.html','tests/helpers/field-renderer-profile.mjs'])report.profileSourceSha256[file]=createHash('sha256').update(await readFile(join(root,file))).digest('hex');
  for(const [stage,path]of Object.entries(stageRoots)){const hashes={};for(const file of ['src/veil/engine.js','src/veil/universe.js','src/veil/renderer.js','tests/field-particle-performance-harness.html'])hashes[file]=createHash('sha256').update(await readFile(join(path,file))).digest('hex');report.stageSources[stage]={basis:spawnSync('git',['rev-parse','HEAD'],{cwd:path,encoding:'utf8'}).stdout.trim(),runtimeSourceSha256:hashes,harnessAdapter:'Expose existing raw timing arrays; production unchanged'};}
  const scenarios=process.env.FIELD_PROFILE_SCENARIOS?JSON.parse(process.env.FIELD_PROFILE_SCENARIOS):['normal','dense','awakened','dynamic-heavy'];report.scenarios=scenarios;
  if(mode==='history')assert.ok(['p1','p2','p3','p4'].every(k=>stageRoots[k]));
  for(const reduced of [false,true]){
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
    const jobs=mode==='scaling'?Array.from({length:runs},(_,round)=>(round%2?['dense','normal']:['normal','dense']).map(name=>({name,round}))).flat():scenarios.flatMap(name=>Array.from({length:runs},(_,round)=>({name,round})));
    for(const {name,round}of jobs){
      const order=mode==='history'?(round%2?['p4','p3','p2','p1']:['p1','p2','p3','p4']):mode==='components'?(round%2?['cullOnly','noCarbon','noFlow','noCenter','noGlow','complete']:['complete','noGlow','noCenter','noFlow','noCarbon','cullOnly']):(round%2?['complete','baseline']:['baseline','complete']);
      for(const variant of order){
        if(mode==='history')await navigate(`${variant}/tests/field-particle-performance-harness.html`);
        const r=mode==='history'?await evaluate(`measure(${JSON.stringify(name)},${reduced})`):await evaluate(`profileRun(${JSON.stringify(name)},${reduced},${JSON.stringify(variant)},${smoke?30:mode==='components'?60:180})`);
        if(mode==='history')for(const [key,array]of [['frameCpuMs','cpu'],['simulationMs','simulation'],['renderMs','render'],['rafIntervalMs','raf']])r[key].mean=r.raw[array].reduce((a,b)=>a+b,0)/r.raw[array].length;
        report.results.push({...r,round,stage:mode==='history'?variant:'p4-runtime'});console.log(mode,name,reduced?'reduced':'normal',round,variant,JSON.stringify(r.frameCpuMs));
        // A checkpoint survives a failed later browser run; incomplete reports cannot pass authority.
        await writeFile(join(out,'checkpoint.json.gz'),gzipSync(JSON.stringify(report)));
      }
    }
  }
  if(mode==='sanity')for(const dimensions of [[320,568],[430,932],[1440,900]]){await send('Emulation.setDeviceMetricsOverride',{width:dimensions[0],height:dimensions[1],deviceScaleFactor:2,mobile:dimensions[0]<900});report.results.push(await evaluate(`profileRun('normal',false,'complete',90,${JSON.stringify(dimensions)})`));}
  assert.deepEqual(errors,[]);await writeFile(join(out,'raw.json.gz'),gzipSync(JSON.stringify(report)));await writeFile(join(out,'summary.json'),JSON.stringify({...report,results:report.results.map(({raw,...r})=>r)},null,2)+'\n');
}finally{
  socket?.close();
  if(child&&child.exitCode===null&&child.signalCode===null){
    await new Promise(done=>{const timer=setTimeout(done,5000);child.once('close',()=>{clearTimeout(timer);done();});child.kill('SIGKILL');});
  }
  await new Promise(done=>server.close(done));
  // Chromium subprocesses may finish writing after the parent exits.
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
