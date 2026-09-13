import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=normalize(join(root,relative));
    if(!file.startsWith(root)){res.writeHead(403).end();return;}
    const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch{res.writeHead(404).end('not found');}
});
await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
const {port}=server.address();
const candidates=['google-chrome','chromium','chromium-browser'];let chrome='';
for(const command of candidates){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'A Chromium browser is required for startup smoke validation');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-browser-')),debugPort=9222;
let child=null,socket=null;
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);
  let tabs=null;
  for(let attempt=0;attempt<80;attempt++){
    try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}
    await new Promise(resolveWait=>setTimeout(resolveWait,100));
  }
  assert.ok(tabs?.length,`Chromium DevTools endpoint did not become ready: ${stderr.slice(-1000)}`);
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((resolveOpen,reject)=>{const timer=setTimeout(()=>reject(new Error('DevTools websocket open timed out')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);resolveOpen();},{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map(),exceptions=[];
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);return;}
    if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails);
  });
  const send=(method,params={})=>new Promise((resolveSend,reject)=>{const id=++sequence;pending.set(id,{resolve:resolveSend,reject});socket.send(JSON.stringify({id,method,params}));});
  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  let snapshot=null;
  for(let attempt=0;attempt<80;attempt++){
    await new Promise(resolveWait=>setTimeout(resolveWait,100));
    try{
      const result=await send('Runtime.evaluate',{expression:`({text:document.querySelector('#open-collection')?.textContent??'',disabled:document.querySelector('#open-collection')?.disabled??null,body:document.body?.innerText??''})`,returnByValue:true});
      snapshot=result.result?.value??null;
      if(snapshot?.body?.includes('図鑑を読み込めませんでした。原子からの制作は続けられます。')||snapshot?.text?.includes('0/129'))break;
    }catch{}
  }
  assert.ok(snapshot,'Application DOM did not become readable');
  assert.ok(!snapshot.body.includes('図鑑を読み込めませんでした。原子からの制作は続けられます。'),'Collection startup must not fall back to the unavailable state');
  assert.match(snapshot.text,/図鑑\s*0\/129/,'Encyclopedia startup denominator must resolve to the 129-molecule production DB');
  assert.ok(!exceptions.some(item=>item.exception?.className==='SyntaxError'||item.text?.includes('SyntaxError')),`Browser startup must not contain module syntax errors: ${JSON.stringify(exceptions)}`);
}finally{
  try{socket?.close();}catch{}
  try{child?.kill('SIGKILL');}catch{}
  await new Promise(resolveWait=>setTimeout(resolveWait,100));
  server.close();await rm(profile,{recursive:true,force:true});
}
console.log('Browser startup passed: Encyclopedia initializes against the 129-molecule production catalog without module parse failures.');
