import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root)),manifest=JSON.parse(await read('manifest.webmanifest'));
assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
for(const icon of manifest.icons){const data=await read(icon.src);assert.equal(data.subarray(1,4).toString(),'PNG');assert.equal(data.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.ok(icon.purpose.includes('maskable'));}
const source=await read('sw.js'),precache=await read('precache-manifest.js'),context={self:{}};runInNewContext(precache.toString(),context);
const entries=context.self.PRECACHE_FILES,paths=new Set(entries.map(e=>e.path));
for(const path of ['src/app-v14.js','src/collection-ui.js','src/collection-viewer.js','vendor/three/three.module.min.js','vendor/three/three.core.min.js','data/encyclopedia.json','assets/icon-192.png','index.html'])assert.ok(paths.has(path),path);
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
for(const item of entries){assert.equal(sha(await read(item.path)),item.sha256,`Stale precache: ${item.path}`);}
// Every literal module dependency is in the offline set, including old query suffixes.
for(const path of paths){if(!path.endsWith('.js'))continue;const text=(await read(path)).toString();for(const match of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)){const dep=match[1];assert.ok(!dep.startsWith('https://'),`${path} has an external import`);const resolved=new URL(dep,new URL(path,root));assert.ok(paths.has(decodeURIComponent(resolved.pathname.slice(root.pathname.length))),`${path} -> ${dep} missing offline`);}}
const db=JSON.parse(await read('data/molecules.json')),parts=JSON.parse(await read('data/craft-structures.json')),dex=JSON.parse(await read('data/encyclopedia.json'));
for(const [kind,items,key]of [['molecule',db,'molecules'],['part',parts,'parts']]){
  const numbers=new Set();for(const item of items){const entry=dex[key][key==='parts'?item.unlock.groupId:item.id];assert.ok(entry&&entry.description.length>15);assert.ok(Number.isInteger(entry.number)&&!numbers.has(entry.number));numbers.add(entry.number);assert.ok(paths.has(`assets/models/${kind}-${item.id}.svg`));}
}
function worker({fail=null,clients=[]}={}){
  const handlers={},cacheMap=new Map(),scope='https://example.test/molecule-craft/';let skip=0,claimed=0,network=0;
  const caches={open:async key=>{if(!cacheMap.has(key)){const rows=new Map();cacheMap.set(key,{put:async(url,response)=>rows.set(String(url),response.clone()),match:async url=>rows.get(String(url))?.clone(),rows});}return cacheMap.get(key);},keys:async()=>[...cacheMap.keys()],delete:async key=>cacheMap.delete(key)};
  const self={...context.self,registration:{scope},clients:{claim:async()=>claimed++,matchAll:async()=>clients},skipWaiting:async()=>skip++,addEventListener:(event,fn)=>handlers[event]=fn};
  const env={self,caches,importScripts:()=>{},URL,Request,Response,crypto:webcrypto,fetch:async request=>{network++;const path=new URL(typeof request==='string'?request:request.url).pathname.replace('/molecule-craft/','');if(path===fail)return new Response('BAD',{status:200});try{return new Response(await read(path));}catch{return new Response('NOT FOUND',{status:404});}}};runInNewContext(source.toString(),env);
  const call=async(type,extra={})=>{let promise;handlers[type]({...extra,waitUntil:p=>promise=p,respondWith:p=>promise=p});return promise;};
  return {call,cacheMap,caches,get skip(){return skip;},get network(){return network;},get claimed(){return claimed;},scope};
}
const good=worker();await good.call('install');assert.equal(good.skip,0,'Install must not force an update');await good.call('activate');assert.equal(good.claimed,1);
let response=await good.call('fetch',{request:new Request(good.scope+'?release=any')});assert.match(await response.text(),/Molecule Craft/);
const network=good.network;response=await good.call('fetch',{request:new Request(good.scope+'src/app-v14.js?v=29')});assert.match(await response.text(),/saveWorkspace/);assert.equal(good.network,network,'Cached release must serve without network');
response=await good.call('fetch',{request:new Request(good.scope+'tests/not-a-real-page.html')});assert.equal(response.status,404,'Never disguise missing pages as index');
await good.call('message',{data:{type:'ACTIVATE_UPDATE'},source:{id:'a'}});assert.equal(good.skip,1);
const messages=[],busy=worker({clients:[{id:'a',url:'https://example.test/molecule-craft/'},{id:'b',url:'https://example.test/molecule-craft/'}]});await busy.call('message',{data:{type:'ACTIVATE_UPDATE'},source:{id:'a',postMessage:m=>messages.push(m)}});assert.equal(busy.skip,0);assert.equal(messages[0].type,'UPDATE_BLOCKED');
const broken=worker({fail:'src/collection-ui.js'});await assert.rejects(broken.call('install'));assert.equal(broken.cacheMap.size,0,'Partial/corrupt release must not remain installed');
console.log(`PWA passed: ${entries.length} hashed assets, dependency closure, icons, 179 numbered entries/previews, offline shell/modules, missing pages, explicit update and multi-window blocking.`);
