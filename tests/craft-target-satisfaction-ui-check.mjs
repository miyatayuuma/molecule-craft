// DOM + real Three.js scene/math integration; WebGL rendering is stubbed.
// Run: node tests/mobile-ui-check.mjs /path/to/node_modules/jsdom/lib/api.js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createContext,runInContext} from 'node:vm';
import {WORKSPACE_STORAGE_KEY} from '../src/workspace-save.js?v=30';
if(!process.argv[2])throw new Error('Pass jsdom/lib/api.js');
const {JSDOM}=await import(pathToFileURL(process.argv[2]));
const root=new URL('../',import.meta.url),appURL=new URL('src/app.js?v=44',root),html=await readFile(new URL('index.html',root),'utf8');
let source=await readFile(appURL,'utf8'),bindings={};
for(const match of source.matchAll(/^import (.*?) from '([^']+)';$/gm)){
  const module=await import(new URL(match[2],appURL));
  if(match[1].startsWith('* as '))bindings[match[1].slice(5)]={...module};
  else for(const item of match[1].slice(1,-1).split(',')){const [name,alias]=item.trim().split(/\s+as\s+/);bindings[alias??name]=module[name];}
}
source=source.replace(/^import .*?;\n/gm,'').replace(/await import\('\.\/collection-ui\.js\?v=\d+'\)/,'collectionModule');
const {createCollectionUI}=await import('../src/collection-ui.js?v=31');
const records=JSON.parse(await readFile(new URL('data/molecules.json',root))),{setMoleculeDatabase}=await import('../src/chemistry.js?v=20');setMoleculeDatabase(records);
const load=async input=>{const path=input instanceof URL?input:new URL(input,appURL);return {ok:true,json:async()=>JSON.parse(await readFile(path,'utf8'))};};
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setTimeout(resolve,5));};
let now=1000;
async function setup(saved=null,initialH=1000,resourceSaved=null,collectionSaved=null){
  const dom=new JSDOM(html,{url:'https://example.test/molecule-craft/',pretendToBeVisual:true}),{window}=dom,{document}=window;
  Object.assign(globalThis,{window,document,Option:window.Option,fetch:load,requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},ResizeObserver:class{observe(){}}});
  window.matchMedia=()=>({matches:false});window.confirm=()=>true;
  window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
  const context2d=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{}});window.HTMLCanvasElement.prototype.getContext=()=>context2d;
  if(saved)window.localStorage.setItem(WORKSPACE_STORAGE_KEY,saved);
  if(resourceSaved)window.localStorage.setItem('molecule-craft.resources.v1',resourceSaved);
  if(collectionSaved)window.localStorage.setItem('molecule-craft.collection.v1',collectionSaved);
  const viewer=document.getElementById('viewer');Object.defineProperties(viewer,{clientWidth:{value:390},clientHeight:{value:650}});
  document.querySelector('.viewer-actions').getBoundingClientRect=()=>({bottom:74});document.querySelector('#selection-chip').getBoundingClientRect=()=>({top:590});
  const THREE={...bindings.THREE,WebGLRenderer:class{constructor(){this.domElement=document.createElement('canvas');this.domElement.getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:650,width:390,height:650});}setPixelRatio(){}setSize(){}render(){}}};
  const vibrations=[];const sandbox={...bindings,THREE,collectionModule:{createCollectionUI},loadMoleculeDatabase:async()=>({ok:true}),window,document,navigator:{vibrate:duration=>vibrations.push(duration)},devicePixelRatio:1,ResizeObserver:class{observe(){}},performance:{now:()=>now},fetch:load,requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},setTimeout:()=>1,clearTimeout:()=>{},console};
  const context=createContext(sandbox);runInContext(source,context);await settle();
  // This suite exercises the established unrestricted chemistry sandbox. Mark
  // C/O as explored explicitly so the new expedition gate is tested elsewhere.
  runInContext(`resources.collect({H:${initialH},C:${initialH},O:${initialH}},0);collectionGame?.refreshProgress();resources.save();`,context);return {window,document,context,vibrations,run:code=>runInContext(code,context)};
}

const game=await setup(),q=id=>game.document.getElementById(id);
game.run(`(()=>{const r=moleculeCatalog().find(r=>r.id==='methanol'),m=new Molecule(),ids=r.atoms.map(el=>m.addAtom(el).id);r.bonds.forEach(([a,b,o])=>m.setBond(ids[a],ids[b],o));collectionGame.observeStructures(connectedStructures(m));resources.discover('ethanol');})()`);
assert.equal(game.run("beginCraftTarget('ethanol')"),true);
const oh=()=>q('craft-target-atoms').querySelector('[data-part-id="hydroxyl"]');
const remaining=()=>game.run("JSON.stringify(targetPartsFor(resources.record(craftTargetId)).map(p=>[p.partId,p.atomIndices]))");
assert.ok(oh());const stock=JSON.parse(game.run('JSON.stringify(resources.state.elements)'));
oh().click();assert.equal(oh(),null);const fromTarget=remaining();
assert.equal(game.run('resources.state.elements.O'),stock.O-1);assert.equal(game.run('resources.state.elements.H'),stock.H-1);
game.run('updateStructureFrame(2000);molecule.removeBond(molecule.atoms[0].id,molecule.atoms[1].id);topologyChanged();refreshInfo();');assert.ok(oh());
game.run('molecule.setBond(molecule.atoms[0].id,molecule.atoms[1].id,1);topologyChanged();refreshInfo();');assert.equal(oh(),null);
game.run('clearField({silent:true});');assert.ok(oh());
game.document.querySelector('#parts-tab').click();game.document.querySelector('#craft-palette [data-part-id="hydroxyl"]').click();assert.equal(remaining(),fromTarget);
game.run('updateStructureFrame(2000);clearField({silent:true});addElement("O");updateStructureFrame(2000);addElement("H");updateStructureFrame(2000);');assert.ok(oh());
game.run('molecule.setBond(molecule.atoms[0].id,molecule.atoms[1].id,1);topologyChanged();refreshInfo();');assert.equal(remaining(),fromTarget);
game.run('saveWorkspace(true);');
const resourceSaved=game.window.localStorage.getItem('molecule-craft.resources.v1'),collectionSaved=game.window.localStorage.getItem('molecule-craft.collection.v1');
const restored=await setup(null,0,resourceSaved,collectionSaved);assert.equal(restored.run("JSON.stringify(targetPartsFor(resources.record(craftTargetId)).map(p=>[p.partId,p.atomIndices]))"),fromTarget);assert.equal(restored.document.querySelector('#craft-target-atoms [data-part-id="hydroxyl"]'),null);
restored.run('craftWorkspace.removeAtom(molecule.atoms[0].id);selectAtom(null);topologyChanged();refreshInfo();');assert.ok(restored.document.querySelector('#craft-target-atoms [data-part-id="hydroxyl"]'));
console.log('Target graph DOM passed: top/tray/manual origins, break/rebond/delete, stock checkout and reload derive the same missing pieces.');
