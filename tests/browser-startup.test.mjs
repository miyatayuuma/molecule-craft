import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';

const root=resolve(new URL('..',import.meta.url).pathname);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
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
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-browser-'));
try{
  const child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,'--virtual-time-budget=6500','--dump-dom',`http://127.0.0.1:${port}/`],{stdio:['ignore','pipe','pipe']});
  let dom='',stderr='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',chunk=>dom+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
  const code=await new Promise((resolveExit,reject)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Browser startup smoke timed out'));},20000);child.on('error',reject);child.on('close',value=>{clearTimeout(timer);resolveExit(value);});});
  assert.equal(code,0,`Chromium startup failed: ${stderr.slice(-2000)}`);
  assert.ok(!dom.includes('図鑑を読み込めませんでした。原子からの制作は続けられます。'),'Collection startup must not fall back to the unavailable state');
  assert.match(dom,/id="open-collection"[^>]*>図鑑\s*<small>0\/129<\/small>/s,'Encyclopedia startup denominator must resolve to the 129-molecule production DB');
  assert.ok(!stderr.includes('Uncaught SyntaxError'),'Browser startup must not contain module syntax errors');
}finally{server.close();await rm(profile,{recursive:true,force:true});}
console.log('Browser startup passed: Encyclopedia initializes against the 129-molecule production catalog without module parse failures.');
