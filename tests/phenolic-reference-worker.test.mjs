import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('100-ring phenolic Worker loads the verified static plan without runtime generation',async()=>{
  const actualFetch=globalThis.fetch,actualSelf=globalThis.self,messages=[],urls=[];
  const expected=JSON.parse(await readFile(new URL('../data/phenolic-reference-100.json',import.meta.url),'utf8'));
  globalThis.fetch=async url=>{urls.push(String(url));return{ok:true,json:async()=>expected};};
  globalThis.self={postMessage:message=>messages.push(message)};
  try{
    await import('../src/polymer-reference-worker.js');
    await globalThis.self.onmessage({data:{polymerId:'phenol-formaldehyde-resin',units:100}});
    assert.equal(urls.length,1,'100-ring data is fetched instead of generated');
    assert.match(urls[0],/\/data\/phenolic-reference-100\.json$/);
    assert.equal(messages.length,1);assert.equal(messages[0].plan,expected);
    assert.equal(messages[0].plan.ringCount,100);
  }finally{globalThis.fetch=actualFetch;globalThis.self=actualSelf;}
});
