/* PRECACHE_ASSET_VERSION:9372f833c9538ed7 */
/* All cached bytes belong to one release. A failed install keeps the old app. */
importScripts('./precache-manifest.js');
const CACHE=`molecule-craft-${self.PRECACHE_VERSION}`;
const appURL=new URL(self.registration.scope),rootPath=appURL.pathname;
const normalized=url=>{const key=new URL(url);key.search='';key.hash='';return key.href;};
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE),queue=[...self.PRECACHE_FILES];
  try{
    const checks=await Promise.allSettled(Array.from({length:6},async()=>{
      while(queue.length){const entry=queue.shift(),url=new URL(entry.path,appURL),response=await fetch(new Request(url,{cache:'reload'}));
        if(!response.ok)throw new Error(`Missing offline asset: ${entry.path}`);
        const digest=await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer()),hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
        if(hash!==entry.sha256)throw new Error(`Offline asset changed during install: ${entry.path}`);
        await cache.put(normalized(url),response);
      }
    }));
    const failed=checks.find(check=>check.status==='rejected');if(failed)throw failed.reason;
  }catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('molecule-craft-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='GET_VERSION'){event.ports?.[0]?.postMessage({type:'APP_VERSION',version:self.PRECACHE_VERSION});return;}
  if(event.data?.type!=='ACTIVATE_UPDATE')return;
  event.waitUntil((async()=>{
    const clients=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(client=>new URL(client.url).pathname.startsWith(rootPath));
    if(clients.some(client=>client.id!==event.source?.id)){event.source?.postMessage({type:'UPDATE_BLOCKED'});return;}
    await self.skipWaiting();
  })());
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==appURL.origin||!url.pathname.startsWith(rootPath))return;
  // Online sessions prefer the deployed bytes. The verified precache remains the offline fallback.
  // Force HTTP-cache revalidation so unchanged module URLs cannot resurrect stale release bytes.
  // This also prevents a forgotten manifest rebuild from pinning an old UI indefinitely.
  const path=url.pathname===rootPath?new URL('index.html',appURL).href:normalized(url);
  event.respondWith((async()=>{
    let networkResponse=null;
    try{networkResponse=await fetch(new Request(event.request,{cache:'reload'}));if(networkResponse.ok)return networkResponse;}catch{}
    const cached=await(await caches.open(CACHE)).match(path);
    return cached??networkResponse??Response.error();
  })());
});
