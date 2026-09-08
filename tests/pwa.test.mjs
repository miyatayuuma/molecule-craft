import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root)),manifest=JSON.parse(await read('manifest.webmanifest'));
assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
for(const icon of manifest.icons){const data=await read(icon.src);assert.equal(data.subarray(1,4).toString(),'PNG');assert.equal(data.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.ok(icon.purpose.includes('maskable'));}
const source=await read('sw.js'),sourceText=source.toString(),buildSource=(await read('scripts/build-precache.mjs')).toString(),pwaSource=(await read('src/pwa.js')).toString(),precache=await read('precache-manifest.js'),context={self:{}};runInNewContext(precache.toString(),context);
assert.match(pwaSource,/registration\.update\(\)/,'Client must explicitly check for a new service worker');
assert.match(pwaSource,/addEventListener\('focus'.*checkForUpdate/,'Returning to the app must re-check for updates');
assert.match(pwaSource,/function activateWaitingUpdate/,'Waiting updates should have one guarded activation path');
assert.match(pwaSource,/SHELL_API='2'/,'PWA must declare the compatible HTML shell API');
assert.match(pwaSource,/dataset\.moleculeCraftShell/,'PWA must validate the DOM shell instead of module URL query identity');
assert.match(pwaSource,/sessionStorage\.getItem\(shellRecoveryKey\)/,'Shell recovery must be one-shot to prevent reload loops');
assert.match(pwaSource,/location\.replace\(new URL\('\.\.\/',import\.meta\.url\)\.href\)/,'A mixed shell must navigate to the current app root');

assert.match(pwaSource,/molecule-craft:prepare-update/,'Automatic activation must reuse the existing safe-save gate');
assert.doesNotMatch(pwaSource,/EXPECTED_LOADER_REV|loaderRev!==EXPECTED_LOADER_REV/,'PWA must not reload based on module query identity');
assert.doesNotMatch(pwaSource,/hadController\|\|reloadOnChange/,'Controller replacement must not unconditionally reload an already-controlled document');
assert.doesNotMatch(pwaSource,/ready\(\{auto:true\}\)/,'Waiting releases must not auto-activate during hotfix stabilization');
assert.match(pwaSource,/ready\(\{auto:false\}\)/,'Waiting releases should remain manual until update activation is stable');
const entries=context.self.PRECACHE_FILES,paths=new Set(entries.map(e=>e.path));
assert.match(buildSource,/PRECACHE_ASSET_VERSION/,'Precache build must stamp the top-level service worker each release');
const assetVersion=createHash('sha256').update(Buffer.from(JSON.stringify(entries))).digest('hex').slice(0,16);
assert.match(sourceText,new RegExp('^/\\* PRECACHE_ASSET_VERSION:'+assetVersion+' \\*/'),'Service worker stamp must match current asset set');
assert.equal(context.self.PRECACHE_VERSION,createHash('sha256').update(Buffer.from(JSON.stringify(entries)+sourceText)).digest('hex').slice(0,16),'Precache version must include stamped service worker bytes');
for(const path of ['src/app.js','src/collection-ui.js','src/collection-viewer.js','src/special-bonds.js','src/hold-action.js','src/veil/loadout-preview.js','vendor/three/three.module.min.js','vendor/three/three.core.min.js','data/encyclopedia.json','assets/icon-192.png','index.html'])assert.ok(paths.has(path),path);
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
const network=good.network;response=await good.call('fetch',{request:new Request(good.scope+'src/app.js?v=42')});assert.match(await response.text(),/saveWorkspace/);assert.equal(good.network,network+1,'Online runtime modules must check deployed bytes before the offline cache');
response=await good.call('fetch',{request:new Request(good.scope+'tests/not-a-real-page.html')});assert.equal(response.status,404,'Never disguise missing pages as index');
await good.call('message',{data:{type:'ACTIVATE_UPDATE'},source:{id:'a'}});assert.equal(good.skip,1);
const messages=[],busy=worker({clients:[{id:'a',url:'https://example.test/molecule-craft/'},{id:'b',url:'https://example.test/molecule-craft/'}]});await busy.call('message',{data:{type:'ACTIVATE_UPDATE'},source:{id:'a',postMessage:m=>messages.push(m)}});assert.equal(busy.skip,0);assert.equal(messages[0].type,'UPDATE_BLOCKED');
const broken=worker({fail:'src/collection-ui.js'});await assert.rejects(broken.call('install'));assert.equal(broken.cacheMap.size,0,'Partial/corrupt release must not remain installed');
console.log(`PWA passed: ${entries.length} hashed assets, dependency closure, icons, 179 numbered entries/previews, online refresh with verified offline fallback, missing pages, explicit discovery/activation updates and multi-window blocking.`);
