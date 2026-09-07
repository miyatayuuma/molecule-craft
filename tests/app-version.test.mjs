import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
const pwa=await read('src/pwa.js'),sw=await read('sw.js');
assert.match(pwa,/id='app-version'/,'Menu must expose an app-version row');
assert.match(pwa,/APP VERSION/,'Version row must be user-visible');
assert.match(pwa,/postMessage\(\{type:'GET_VERSION'\}/,'Client must ask its controlling worker for the running release');
assert.match(pwa,/event\.data\?\.type!=='APP_VERSION'/,'Client must accept the worker release response');

const handlers={},messages=[];
const self={PRECACHE_VERSION:'0123456789abcdef',registration:{scope:'https://example.test/molecule-craft/'},addEventListener:(type,handler)=>handlers[type]=handler};
runInNewContext(sw,{self,importScripts:()=>{},URL,caches:{},Request,Response,crypto:globalThis.crypto,fetch:()=>{}});
handlers.message({data:{type:'GET_VERSION'},ports:[{postMessage:message=>messages.push(message)}]});
assert.equal(messages.length,1);
assert.equal(messages[0].type,'APP_VERSION');
assert.equal(messages[0].version,'0123456789abcdef');
console.log('App version passed: menu reads the release id from the controlling service worker.');
