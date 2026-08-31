// Production UI + actual Three.js geometry/math. WebGL alone is replaced.
// This verifies input transactions and framing, not Android/GPU performance.
// node tests/island-ui-check.mjs /path/to/jsdom/lib/api.js
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createContext,runInContext} from 'node:vm';
import {ISLAND_STORAGE_KEY} from '../src/island-save.js?v=33';
import {WORKSPACE_STORAGE_KEY} from '../src/workspace-save.js?v=30';
import {ISLAND_SAMPLES} from '../src/island-data.js?v=33';
import {createIslandState,unlockSample,applySample,advanceIsland,ignite} from '../src/island-engine.js?v=33';
import {createIslandScene} from '../src/island-scene.js?v=33';
if(!process.argv[2])throw new Error('Pass jsdom/lib/api.js');
const {JSDOM}=await import(pathToFileURL(process.argv[2]));
const root=new URL('../',import.meta.url),appURL=new URL('src/app-v14.js',root),html=await readFile(new URL('index.html',root),'utf8');
let source=await readFile(appURL,'utf8');const bindings={};
for(const match of source.matchAll(/^import (.*?) from '([^']+)';$/gm)){
  const module=await import(new URL(match[2],appURL));
  if(match[1].startsWith('* as '))bindings[match[1].slice(5)]={...module};
  else for(const item of match[1].slice(1,-1).split(',')){const [name,alias]=item.trim().split(/\s+as\s+/);bindings[alias??name]=module[name];}
}
source=source.replace(/^import .*?;\n/gm,'').replace(/await import\('\.\/collection-ui\.js\?v=\d+'\)/,'collectionModule');
const {createCollectionUI}=await import('../src/collection-ui.js?v=33');
const records=JSON.parse(await readFile(new URL('data/molecules.json',root))),{setMoleculeDatabase}=await import('../src/chemistry.js?v=20');setMoleculeDatabase(records);
const load=async input=>{const path=input instanceof URL?input:new URL(input,appURL);return{ok:true,json:async()=>JSON.parse(await readFile(path,'utf8'))};};
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setTimeout(resolve,5));};
let now=1000,latestRendered=null;
async function setup({width=390,height=540,saved=null,hash='island'}={}){
  const dom=new JSDOM(html,{url:`https://example.test/molecule-craft/#${hash}`,pretendToBeVisual:true}),{window}=dom,{document}=window;
  const queue=new Map();let next=0;
  const requestAnimationFrame=fn=>{const id=++next;queue.set(id,fn);return id;},cancelAnimationFrame=id=>queue.delete(id);
  Object.assign(globalThis,{window,document,Option:window.Option,fetch:load,requestAnimationFrame,cancelAnimationFrame});
  window.matchMedia=()=>({matches:false});window.ResizeObserver=class{observe(){}disconnect(){}};
  window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
  const context2d=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{}});window.HTMLCanvasElement.prototype.getContext=()=>context2d;
  if(saved)for(const [key,value]of Object.entries(saved))window.localStorage.setItem(key,value);
  for(const id of ['viewer','island-canvas'])Object.defineProperties(document.getElementById(id),{clientWidth:{value:width},clientHeight:{value:height}});
  document.querySelector('.viewer-actions').getBoundingClientRect=()=>({bottom:175});document.querySelector('#selection-chip').getBoundingClientRect=()=>({top:height+35});
  const THREE={...bindings.THREE,WebGLRenderer:class{
    constructor(){this.domElement=document.createElement('canvas');this.domElement.getBoundingClientRect=()=>({left:0,top:100,right:width,bottom:height+100,width,height});this.domElement.setPointerCapture=()=>{};this.domElement.releasePointerCapture=()=>{};this.shadowMap={};this.info={render:{calls:0,triangles:0},memory:{geometries:0}};}
    setPixelRatio(r){this.r=r;}getPixelRatio(){return this.r;}setClearColor(){}setSize(){}dispose(){}
    render(scene,camera){scene.updateMatrixWorld();camera.updateMatrixWorld();latestRendered={scene,camera};let calls=0,triangles=0;const geometries=new Set();scene.traverseVisible(o=>{if(o.isMesh&&o.material.visible!==false){calls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.count??1);geometries.add(o.geometry);}});this.info={render:{calls,triangles},memory:{geometries:geometries.size}};}
  }};
  const sandbox={...bindings,THREE,collectionModule:{createCollectionUI},loadMoleculeDatabase:async()=>({ok:true}),window,document,navigator:{vibrate:()=>{}},devicePixelRatio:1,ResizeObserver:window.ResizeObserver,performance:{now:()=>now},fetch:load,requestAnimationFrame,cancelAnimationFrame,setTimeout:()=>1,clearTimeout:()=>{},console};
  const context=createContext(sandbox);runInContext(source,context);await settle();
  function tick(seconds){for(let f=0;f<seconds*60;f++){now+=1000/60;const callbacks=[...queue.values()];queue.clear();for(const fn of callbacks)fn(now);}}
  const q=id=>document.getElementById(id),run=code=>runInContext(code,context);
  const snapshot=()=>run('islandGame.snapshot()');
  return{window,document,context,THREE,q,run,tick,snapshot,dispose:()=>{queue.clear();window.close();}};
}
const a=await setup();
assert.ok(a.run('islandActive'));assert.equal(a.q('island-view').hidden,false);assert.ok(a.q('island-canvas').querySelector('canvas'));
assert.equal(a.snapshot().samples.length,0);a.tick(.5);
assert.ok(a.run('islandGame.stats().drawCalls')>100,'The island is a real geometry scene, not a background picture');
assert.ok(a.run('islandGame.stats().drawCalls')<330,'Bounded mobile scene draw calls');
assert.ok(a.run('islandGame.stats().triangles')<250000,'No dense fluid/physics geometry');
const initialStats=a.run('islandGame.stats()');
a.q('scene-craft').click();assert.equal(a.run('islandActive'),false);
const pausedClock=a.snapshot().clock;a.tick(3);assert.equal(a.snapshot().clock,pausedClock,'Crafting freezes the island clock');

// Build WATER from actual palette additions and actual electron pointer handlers.
for(const symbol of ['O','H','H'])a.document.querySelector(`[data-element="${symbol}"]`).click();
a.tick(1);
assert.equal(a.run('molecule.atoms.length'),3);
for(const index of [1,2]){
  a.run(`camera.lookAt(cameraTarget);camera.updateMatrixWorld();animateUnpairedElectrons(performance.now());
    var sourceAtom=molecule.atoms[0].id,targetAtom=molecule.atoms[${index}].id;
    var evStart=electronVisuals.find(e=>e.atomId===sourceAtom),evEnd=electronVisuals.find(e=>e.atomId===targetAtom);
    var start=worldToScreen(evStart.visible.position),end=worldToScreen(evEnd.visible.position);
    var down={pointerId:7,pointerType:'touch',button:0,clientX:start.x,clientY:start.y};
    onPointerDown(down);`);
  assert.equal(a.run('dragState?.mode'),'electron','Production hit-test must select the electron');
  a.run("onPointerMove({...down,clientX:end.x,clientY:end.y});onPointerUp({...down,clientX:end.x,clientY:end.y});");
  a.tick(2);
}
assert.equal(a.run('molecule.recognizedMolecule()?.id'),'water');
assert.equal(a.q('world-use').hidden,false);assert.equal(a.q('world-use').disabled,false);
const craftBefore=a.window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
a.q('world-use').click();a.tick(.1);
assert.ok(a.run('islandActive'));assert.equal(a.snapshot().preferences.selected,'water');assert.deepEqual(a.snapshot().samples,['water']);
assert.equal(a.window.localStorage.getItem(WORKSPACE_STORAGE_KEY),craftBefore,'Carrying must not consume, rebuild, or reframe the molecule');

// Tap injection, delayed impact, UI journal and derived world chain.
a.document.querySelector('[data-dose="3"]').click();
a.document.querySelector('[data-target="pond"]').click();
assert.equal(a.snapshot().experiments,0,'Do not change the water before the falling molecule lands');
a.tick(.3);assert.equal(a.snapshot().experiments,0);a.tick(5);
assert.equal(a.snapshot().experiments,1);assert.ok(a.snapshot().garden.vigor>.7);assert.ok(a.snapshot().encounters.length>=2);
assert.ok(a.q('island-target-note').textContent.includes('ふち'));
a.q('open-collection').click();a.document.querySelector('[data-book-tab="phenomena"]').click();
assert.ok(a.q('collection-list').textContent.includes('水のゆくえ'));assert.ok(a.q('collection-list').textContent.includes('まだ見ぬ発見'));
assert.equal(a.q('collection-controls').hidden,true);const modalClock=a.snapshot().clock;a.tick(4);assert.equal(a.snapshot().clock,modalClock);
a.document.querySelector('[data-book-tab="creatures"]').click();assert.ok(a.q('collection-list').textContent.includes('ミズポン'));assert.ok(a.q('collection-list').textContent.includes('コケモチ'));
a.q('close-collection').click();a.tick(.1);

// Drag a real tray bottle into a projected target (not directly into the engine).
function pointer(app,type,target,{x,y,id=22}={}){
  const event=new app.window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0});
  Object.defineProperties(event,{pointerId:{value:id},pointerType:{value:'touch'}});target.dispatchEvent(event);
}
const bottle=a.document.querySelector('[data-sample="water"]'),tray=a.q('island-samples');
const cellPin=a.document.querySelector('[data-target="cell"]');
const dropPoint={x:parseFloat(cellPin.style.left),y:parseFloat(cellPin.style.top)+100};
pointer(a,'pointerdown',bottle,{x:50,y:760});pointer(a,'pointermove',tray,{x:70,y:730});
pointer(a,'pointermove',tray,dropPoint);assert.equal(a.q('island-drag-ghost').hidden,false);
pointer(a,'pointerup',tray,dropPoint);assert.equal(a.q('island-drag-ghost').hidden,true);a.tick(1);
assert.ok(a.snapshot().zones.cell.water>.8,'Upward drag reached the chosen cell');assert.equal(a.snapshot().experiments,2);
const beforeCancelled=a.snapshot().experiments;
pointer(a,'pointerdown',bottle,{x:50,y:760});pointer(a,'pointermove',tray,{x:70,y:730});pointer(a,'pointercancel',tray,{x:70,y:730});
pointer(a,'pointerup',tray,dropPoint);a.tick(1);assert.equal(a.snapshot().experiments,beforeCancelled,'Canceled drag must never inject');
pointer(a,'pointerdown',bottle,{x:50,y:760});pointer(a,'pointermove',tray,{x:70,y:730});pointer(a,'pointerup',tray,{x:-30,y:400});a.tick(1);assert.equal(a.snapshot().experiments,beforeCancelled,'Off-island drag is canceled');
pointer(a,'pointerdown',bottle,{x:50,y:760,id:31});pointer(a,'pointermove',tray,{x:70,y:730,id:31});
pointer(a,'pointerdown',bottle,{x:55,y:750,id:32});pointer(a,'pointerup',tray,{...dropPoint,id:32});pointer(a,'pointerup',tray,{...dropPoint,id:31});
a.tick(1);assert.equal(a.snapshot().experiments,beforeCancelled,'A second finger cancels carrying instead of replacing the first finger');

// Two fingers cannot become a drop when one lifts; orbit cannot mutate crafting.
const canvas=a.q('island-canvas').querySelector('canvas'),cameraBefore=a.run('camera.position.toArray()');
pointer(a,'pointerdown',canvas,{x:120,y:340,id:1});pointer(a,'pointerdown',canvas,{x:250,y:340,id:2});
pointer(a,'pointermove',canvas,{x:285,y:360,id:2});pointer(a,'pointerup',canvas,{x:285,y:360,id:2});pointer(a,'pointerup',canvas,{x:120,y:340,id:1});
a.tick(1);assert.equal(a.snapshot().experiments,beforeCancelled);assert.deepEqual(a.run('camera.position.toArray()'),cameraBefore);
assert.equal(a.window.localStorage.getItem(WORKSPACE_STORAGE_KEY),craftBefore);

// A scene exit/pagehide during flight commits exactly once before saving.
a.document.querySelector('[data-target="garden"]').click();const beforeExit=a.snapshot().experiments;
assert.equal(a.run('islandGame.stats().flyingSamples'),1);
a.q('scene-craft').click();assert.equal(a.snapshot().experiments,beforeExit+1);a.tick(2);assert.equal(a.snapshot().experiments,beforeExit+1);
assert.equal(a.run('islandGame.stats().flyingSamples'),0,'Completed drops must not resume visually after a scene round trip');
assert.equal(a.window.localStorage.getItem(WORKSPACE_STORAGE_KEY),craftBefore);
a.q('scene-island').click();a.tick(.1);a.document.querySelector('[data-target="pond"]').click();
a.window.dispatchEvent(new a.window.Event('pagehide'));const last=a.snapshot();
const saved={[ISLAND_STORAGE_KEY]:a.window.localStorage.getItem(ISLAND_STORAGE_KEY),[WORKSPACE_STORAGE_KEY]:a.window.localStorage.getItem(WORKSPACE_STORAGE_KEY)};
assert.equal(JSON.parse(saved[ISLAND_STORAGE_KEY]).experiments,last.experiments);a.dispose();
const reboot=await setup({saved});assert.equal(reboot.snapshot().experiments,last.experiments);assert.deepEqual(reboot.snapshot().discoveries,last.discoveries);assert.deepEqual(reboot.snapshot().creatures,last.creatures);reboot.dispose();

// Projection and resource reuse under multiple portrait/landscape viewports.
for(const [width,height]of [[360,470],[390,540],[634,302],[1280,540]]){
  const app=await setup({width,height});app.tick(.1);
  for(const pin of app.document.querySelectorAll('[data-target]')){
    const x=parseFloat(pin.style.left),y=parseFloat(pin.style.top);
    assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.ok(x>=0&&x<=width&&y>=0&&y<=height,`Target ${pin.dataset.target} fits ${width}x${height}`);
  }
  assert.equal(app.q('island-unavailable').hidden,true);app.dispose();
}
console.log('Island UI passed: real water crafting via pointer handlers, carry with exact craft preservation, delayed tap/drag impact, pointer cancel, two-finger arbitration, paused clocks, journal, in-flight exit and reload, 4 viewport projections.');
console.log('Geometry budget (WebGL substituted):',JSON.stringify(initialStats));

// Optional offline geometry export for visual inspection. It is a software
// preview of scene composition, never presented as a browser/GPU screenshot.
if(process.env.ISLAND_GEOMETRY_EXPORT){
  const app=await setup({width:1100,height:760});
  const host=app.q('island-canvas'),view=createIslandScene({THREE:app.THREE,host,records});
  const world=createIslandState();for(const s of ISLAND_SAMPLES)unlockSample(world,s.id);
  for(const [id,target,dose]of [['water','pond',3],['water','pond',3],['water','garden',3],['carbon-dioxide','garden',1],['ammonia','garden',1],['water','cell',1],['salt','cell',1],['acetone','resin',1],['hydrogen','flask',1],['methane','burner',3],['oxygen','burner',3]])applySample(world,id,target,dose);
  ignite(world);advanceIsland(world,7);view.render(world,.1);
  const {scene,camera}=latestRendered;scene.updateMatrixWorld();camera.updateMatrixWorld();
  await writeFile(process.env.ISLAND_GEOMETRY_EXPORT,JSON.stringify({scene:scene.toJSON(),camera:camera.toJSON(),world}));
  view.dispose();app.dispose();
}
