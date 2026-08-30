// DOM + real Three.js scene/math integration; WebGL rendering is stubbed.
// Run: node tests/mobile-ui-check.mjs /path/to/node_modules/jsdom/lib/api.js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createContext,runInContext} from 'node:vm';
import {WORKSPACE_STORAGE_KEY} from '../src/workspace-save.js';
if(!process.argv[2])throw new Error('Pass jsdom/lib/api.js');
const {JSDOM}=await import(pathToFileURL(process.argv[2]));
const root=new URL('../',import.meta.url),appURL=new URL('src/app-v14.js',root),html=await readFile(new URL('index.html',root),'utf8');
let source=await readFile(appURL,'utf8'),bindings={};
for(const match of source.matchAll(/^import (.*?) from '([^']+)';$/gm)){
  const module=await import(new URL(match[2],appURL));
  if(match[1].startsWith('* as '))bindings[match[1].slice(5)]={...module};
  else for(const item of match[1].slice(1,-1).split(',')){const [name,alias]=item.trim().split(/\s+as\s+/);bindings[alias??name]=module[name];}
}
source=source.replace(/^import .*?;\n/gm,'').replace("await import('./collection-ui.js?v=29')",'collectionModule');
const {createCollectionUI}=await import('../src/collection-ui.js?v=29');
const records=JSON.parse(await readFile(new URL('data/molecules.json',root))),{setMoleculeDatabase}=await import('../src/chemistry.js?v=20');setMoleculeDatabase(records);
const load=async input=>{const path=input instanceof URL?input:new URL(input,appURL);return {ok:true,json:async()=>JSON.parse(await readFile(path,'utf8'))};};
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setTimeout(resolve,5));};
let now=1000;
async function setup(saved=null){
  const dom=new JSDOM(html,{url:'https://example.test/molecule-craft/',pretendToBeVisual:true}),{window}=dom,{document}=window;
  Object.assign(globalThis,{window,document,Option:window.Option,fetch:load,requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}});
  window.matchMedia=()=>({matches:false});window.confirm=()=>true;
  window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
  const context2d=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{}});window.HTMLCanvasElement.prototype.getContext=()=>context2d;
  if(saved)window.localStorage.setItem(WORKSPACE_STORAGE_KEY,saved);
  const viewer=document.getElementById('viewer');Object.defineProperties(viewer,{clientWidth:{value:390},clientHeight:{value:650}});
  document.querySelector('.viewer-actions').getBoundingClientRect=()=>({bottom:74});document.querySelector('#selection-chip').getBoundingClientRect=()=>({top:590});
  const THREE={...bindings.THREE,WebGLRenderer:class{constructor(){this.domElement=document.createElement('canvas');this.domElement.getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:650,width:390,height:650});}setPixelRatio(){}setSize(){}render(){}}};
  const sandbox={...bindings,THREE,collectionModule:{createCollectionUI},loadMoleculeDatabase:async()=>({ok:true}),window,document,navigator:{vibrate(){}},devicePixelRatio:1,ResizeObserver:class{observe(){}},performance:{now:()=>now},fetch:load,requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},setTimeout:()=>1,clearTimeout:()=>{},console};
  const context=createContext(sandbox);runInContext(source,context);await settle();return {window,document,context,run:code=>runInContext(code,context)};
}
const app=await setup();
assert.ok(app.document.querySelector('#open-collection').textContent.includes('0/162'));
app.run("addElement('C');addElement('H');");
assert.equal(app.run('molecule.atoms.length'),2);assert.equal(app.document.querySelector('#selection-actions').hidden,false);assert.equal(app.run('saveWorkspace(true)'),true);
const raw=app.window.localStorage.getItem(WORKSPACE_STORAGE_KEY),snapshot=JSON.parse(raw);assert.equal(snapshot.atoms.length,2);
app.document.querySelector('#open-menu').click();assert.ok(app.document.querySelector('#menu-dialog').open);app.run("addElement('O')");assert.equal(app.run('molecule.atoms.length'),2,'Open menu blocks field mutation');
app.document.querySelector('#open-help').click();assert.ok(app.document.querySelector('#help-dialog').open);assert.equal(app.document.querySelector('#menu-dialog').open,false);app.document.querySelector('#help-done').click();
app.document.querySelector('#open-collection').click();assert.ok(app.document.querySelector('#collection-dialog').open);
assert.ok(app.document.querySelectorAll('.collection-card').length>90);
app.document.querySelector('[data-entry-id="water"]').click();assert.ok(app.document.querySelector('.unknown-detail'));assert.equal(app.document.querySelector('.detail-formula'),null,'Unknown formula only appears when requested');
[...app.document.querySelectorAll('button')].find(node=>node.textContent==='ヒントを見る').click();assert.equal(app.document.querySelector('.detail-formula').textContent,'H2O');
app.document.querySelector('#detail-back').click();assert.ok(app.document.querySelector('[data-entry-id="water"]'));
app.document.querySelector('#close-collection').click();
app.run("const sample=new Molecule();const ids=['O','H','H'].map(element=>sample.addAtom(element).id);sample.setBond(ids[0],ids[1],1);sample.setBond(ids[0],ids[2],1);collectionGame.observeStructures(connectedStructures(sample));");
app.document.querySelector('#open-collection').click();const card=app.document.querySelector('[data-entry-id="water"]');assert.ok(card.querySelector('img').src.endsWith('molecule-water.svg'));card.click();await settle();
assert.match(app.document.querySelector('.dex-description').textContent,/砂糖や塩/);assert.equal(app.document.querySelector('.detail-extras').open,false);assert.ok(app.document.querySelector('.detail-extras').textContent.includes('IUPAC'));
app.document.querySelector('[aria-label="次の項目"]').click();assert.equal(app.document.querySelector('.detail-heading .dex-number').textContent,'No. 005');
app.document.querySelector('#close-collection').click();
const reboot=await setup(raw);assert.equal(reboot.run('molecule.atoms.length'),2);const rebooted=JSON.parse(reboot.window.localStorage.getItem(WORKSPACE_STORAGE_KEY));assert.deepEqual(rebooted,snapshot,'Startup must restore the same pose and focus without relaxation/reframing');
reboot.run("addElement('O')");assert.equal(reboot.run('molecule.atoms.length'),3);reboot.run('updateStructureFrame(2000)');reboot.document.querySelector('#open-menu').click();reboot.document.querySelector('#clear-all').click();assert.equal(reboot.run('molecule.atoms.length'),0);assert.equal(JSON.parse(reboot.window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).atoms.length,0);
const future=JSON.stringify({...snapshot,schemaVersion:9}),protectedApp=await setup(future);protectedApp.run("addElement('C');saveWorkspace(true)");assert.equal(protectedApp.window.localStorage.getItem(WORKSPACE_STORAGE_KEY),future);assert.equal(protectedApp.document.querySelector('#workspace-save-status').hidden,false);
console.log('Production DOM integration passed: startup, spawn, dialog guards, collection hints/images/text/navigation, exact restart, clear and future-save protection.');
