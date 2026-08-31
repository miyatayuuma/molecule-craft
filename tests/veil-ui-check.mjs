// DOM + real Three.js scene/math integration; WebGL rendering is stubbed.
// Run: node tests/veil-ui-check.mjs /path/to/node_modules/jsdom/lib/api.js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createContext,runInContext} from 'node:vm';
import {WORKSPACE_STORAGE_KEY} from '../src/workspace-save.js?v=30';
if(!process.argv[2])throw new Error('Pass jsdom/lib/api.js');
const {JSDOM}=await import(pathToFileURL(process.argv[2]));
const root=new URL('../',import.meta.url),appURL=new URL('src/app-v14.js?v=35',root),html=await readFile(new URL('index.html',root),'utf8');
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
async function setup(saved=null,initialH=0,resourceSaved=null,collectionSaved=null){
  const frames=new Map();let nextFrame=1;const raf=fn=>{const id=nextFrame++;frames.set(id,fn);return id;},cancel=id=>frames.delete(id);
  const dom=new JSDOM(html,{url:'https://example.test/molecule-craft/',pretendToBeVisual:true}),{window}=dom,{document}=window;
  Object.assign(globalThis,{window,document,Option:window.Option,fetch:load,requestAnimationFrame:raf,cancelAnimationFrame:cancel,ResizeObserver:class{observe(){}}});
  window.matchMedia=()=>({matches:false});window.confirm=()=>true;
  window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
  const context2d=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{}});window.HTMLCanvasElement.prototype.getContext=()=>context2d;window.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:390,height:844,left:0,top:0});
  if(resourceSaved)window.localStorage.setItem('molecule-craft.resources.v1',resourceSaved);
  if(collectionSaved)window.localStorage.setItem('molecule-craft.collection.v1',collectionSaved);
  if(saved)window.localStorage.setItem(WORKSPACE_STORAGE_KEY,saved);
  const viewer=document.getElementById('viewer');Object.defineProperties(viewer,{clientWidth:{value:390},clientHeight:{value:650}});
  document.querySelector('.viewer-actions').getBoundingClientRect=()=>({bottom:74});document.querySelector('#selection-chip').getBoundingClientRect=()=>({top:590});
  const THREE={...bindings.THREE,WebGLRenderer:class{constructor(){this.domElement=document.createElement('canvas');this.domElement.getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:650,width:390,height:650});}setPixelRatio(){}setSize(){}render(){}}};
  let reloads=0;const vibrations=[];const sandbox={...bindings,createProgressResetUI:options=>bindings.createProgressResetUI({...options,reload:()=>reloads++}),THREE,collectionModule:{createCollectionUI},loadMoleculeDatabase:async()=>({ok:true}),window,document,navigator:{vibrate:duration=>vibrations.push(duration)},devicePixelRatio:1,ResizeObserver:class{observe(){}},performance:{now:()=>now},fetch:load,requestAnimationFrame:raf,cancelAnimationFrame:cancel,setTimeout:()=>1,clearTimeout:()=>{},console};
  const context=createContext(sandbox);runInContext(source,context);await settle();runInContext(`resources.collect(${initialH},0);resources.save();`,context);return {window,document,context,vibrations,get reloads(){return reloads;},tick(ms=1000/60){now+=ms;const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(now);},run:code=>runInContext(code,context)};
}

let game=await setup();
const q=id=>game.document.getElementById(id);
assert.equal(game.run('resources.state.elements.H'),0);
q('element-palette').querySelector('[data-element="H"]').click();
assert.equal(game.run('molecule.atoms.length'),0,'No free H from the ordinary palette');
q('launch-veil').click();assert.equal(q('veil-view').hidden,false);
assert.equal(game.run('veilUI.active'),true);
game.window.dispatchEvent(new game.window.KeyboardEvent('keydown',{key:'ArrowUp'}));
for(let i=0;i<200;i++)game.tick();
game.window.dispatchEvent(new game.window.KeyboardEvent('keyup',{key:'ArrowUp'}));
assert.ok(Number(q('veil-gained').textContent.slice(1))>0,'Keyboard flight actually collects through the production RAF');
const gathered=game.run('resources.state.elements.H');
q('veil-return').click();assert.equal(q('veil-view').hidden,true);assert.equal(game.run('resources.state.elements.H'),gathered);
q('element-palette').querySelector('[data-element="H"]').click();game.run('updateStructureFrame(performance.now()+1000)');
q('element-palette').querySelector('[data-element="H"]').click();game.run('updateStructureFrame(performance.now()+1000)');
assert.equal(game.run('resources.state.elements.H'),gathered-2);
assert.equal(game.run('molecule.atoms.length'),2);
assert.equal(game.run("resources.state.recipes.includes('hydrogen')"),false);
// Complete H₂ via the real electron drag / dock / settlement path.
game.run(`camera.lookAt(cameraTarget);camera.updateMatrixWorld();animateUnpairedElectrons(performance.now());
  var first=molecule.atoms[0].id,second=molecule.atoms[1].id;
  var start=electronVisuals.find(e=>e.atomId===first),end=electronVisuals.find(e=>e.atomId===second),targetScreen=worldToScreen(end.visible.position);
  beginElectronDrag({clientX:0,clientY:0,pointerId:1,pointerType:'mouse'},{atomId:first,index:start.index,world:start.visible.position.clone()});
  dragState.moved=true;dragState.currentWorld.copy(end.visible.position);finishElectronDrag(dragState,{clientX:targetScreen.x,clientY:targetScreen.y});dragState=null;`);
assert.equal(game.run('!!bondTransition'),true);
for(let i=0;i<300;i++)game.tick();
assert.equal(game.run("structures[0].record?.id"),'hydrogen');
assert.equal(game.run("resources.state.recipes.includes('hydrogen')"),true);
assert.equal(q('store-h2').hidden,false);
q('store-h2').click();assert.equal(game.run('resources.state.molecules.hydrogen'),1);assert.equal(game.run('molecule.atoms.length'),0);
q('store-h2').click();assert.equal(game.run('resources.state.molecules.hydrogen'),1,'Repeated store does not mint fuel');
const hBefore=game.run('resources.state.elements.H');q('make-h2').click();const generated=1;
assert.equal(game.run('resources.state.elements.H'),hBefore-generated*2);
assert.equal(game.run('resources.state.molecules.hydrogen'),1+generated);
q('launch-veil').click();const fuel=game.run('resources.state.molecules.hydrogen');
q('veil-boost').dispatchEvent(new game.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));
q('veil-boost').dispatchEvent(new game.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));
assert.equal(game.run('resources.state.molecules.hydrogen'),fuel-1,'Cooldown blocks duplicate spend');
const pad=q('veil-pad');pad.getBoundingClientRect=()=>({left:20,top:650,width:146,height:146});
function pointer(type,id,x,y){const event=new game.window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:id});pad.dispatchEvent(event);}
pointer('pointerdown',11,93,665);assert.notEqual(q('veil-knob').style.transform,'translate(0px,0px)');
pointer('pointerup',22,93,665);assert.notEqual(q('veil-knob').style.transform,'translate(0px,0px)','Other finger cannot cancel flight');
pointer('pointercancel',11,93,665);assert.equal(q('veil-knob').style.transform,'translate(0px,0px)');
for(let i=0;i<80;i++)game.tick();game.window.dispatchEvent(new game.window.Event('blur'));
const beforePause=q('veil-gained').textContent;for(let i=0;i<180;i++)game.tick();assert.equal(q('veil-gained').textContent,beforePause);assert.equal(q('veil-resume').hidden,false);
q('veil-resume').click();assert.equal(q('veil-resume').hidden,true);
q('veil-return').click();
const saved=game.window.localStorage.getItem('molecule-craft.resources.v1'),snapshot=JSON.parse(saved);
game=await setup(null,0,saved);
assert.equal(game.run('resources.state.elements.H'),snapshot.elements.H);assert.equal(game.run('resources.state.molecules.hydrogen'),snapshot.molecules.hydrogen);assert.equal(game.run('molecule.atoms.length'),0);
assert.equal(q('make-h2').hidden,false);
// Returned atoms are reusable, not free; a reload cannot refund them again.
game.run('resources.collect(2,0);resources.save();');const balance=game.run('resources.state.elements.H');
q('element-palette').querySelector('[data-element="H"]').click();game.run('updateStructureFrame(performance.now()+1000)');
q('delete-selected').click();for(let i=0;i<150;i++)game.tick();
assert.equal(game.run('resources.state.elements.H'),balance);
assert.equal(JSON.parse(game.window.localStorage.getItem('molecule-craft.resources.v1')).workspace.atoms.length,0);
console.log('Production H Veil UI passed: new save, collection, return, paid atom placement, manual H₂ electron drag, one-time storage, quick synthesis, boost spending, multitouch cancellation, blur pause, exact resource/workspace reload and refunds. Canvas/WebGL are stubbed; this is not a visual or subjective playtest.');

// Delete + close during settlement must never persist refunded H beside the old atom.
game.run('resources.collect(2,0);resources.save();');const total=game.run('resources.state.elements.H');
for(let i=0;i<2;i++){q('element-palette').querySelector('[data-element="H"]').click();game.run('updateStructureFrame(performance.now()+1000)');}
q('delete-selected').click();assert.equal(game.run('!!relaxation'),true);
game.window.dispatchEvent(new game.window.Event('pagehide'));
const interrupted=JSON.parse(game.window.localStorage.getItem('molecule-craft.resources.v1'));
assert.equal(interrupted.workspace.atoms.length,1);assert.equal(interrupted.elements.H,total-1);
assert.equal(interrupted.elements.H+interrupted.workspace.atoms.filter(a=>a.element==='H').length,total);
console.log('Interrupted atom deletion preserves the H balance atomically before settlement.');

// Hold synthesis runs the actual UI callback; release stops inventory changes.
game=await setup(null,30,saved);const make=q('make-h2'),beforeHold=game.run('resources.state.molecules.hydrogen');
const down=new game.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0});Object.defineProperty(down,'pointerId',{value:31});make.dispatchEvent(down);
assert.equal(game.run('resources.state.molecules.hydrogen'),beforeHold+1,'Immediate one on contact');
await new Promise(resolve=>setTimeout(resolve,540));
const up=new game.window.MouseEvent('pointerup',{bubbles:true});Object.defineProperty(up,'pointerId',{value:31});make.dispatchEvent(up);
const afterHold=game.run('resources.state.molecules.hydrogen');assert.ok(afterHold>=beforeHold+3);
await new Promise(resolve=>setTimeout(resolve,190));assert.equal(game.run('resources.state.molecules.hydrogen'),afterHold,'Release cancels production');
// Cancellation of the full reset is a no-op, confirmation commits once.
q('open-menu').click();game.window.confirm=()=>false;const beforeReset=game.window.localStorage.getItem('molecule-craft.resources.v1');q('reset-all').click();assert.equal(game.window.localStorage.getItem('molecule-craft.resources.v1'),beforeReset);
game.window.confirm=()=>true;q('reset-all').click();assert.equal(game.reloads,1);
const resetSave=game.window.localStorage.getItem('molecule-craft.resources.v1'),resetBook=game.window.localStorage.getItem('molecule-craft.collection.v1');
game.window.dispatchEvent(new game.window.Event('pagehide'));assert.equal(game.window.localStorage.getItem('molecule-craft.resources.v1'),resetSave,'Old graph cannot overwrite reset on pagehide');
game=await setup(null,0,resetSave,resetBook);
assert.equal(game.run('resources.state.elements.H'),0);assert.equal(game.run('resources.state.molecules.hydrogen'),0);assert.equal(game.run('resources.state.recipes.length'),0);assert.equal(game.run('molecule.atoms.length'),0);assert.equal(game.run('collectionGame.state.discoveredCount'),0);assert.equal(q('make-h2').hidden,true);
q('launch-veil').click();game.window.dispatchEvent(new game.window.KeyboardEvent('keydown',{key:'ArrowUp'}));for(let i=0;i<200;i++)game.tick();assert.ok(game.run('resources.state.elements.H')>0);q('veil-return').click();
console.log('Hold synthesis, reset cancellation, empty collection/recipe/workspace reboot and a fresh first collection passed.');

// New exploration access reveals C/O in the same palette. A paid handmade CH₄
// is learned and stored once; the generic supply control then mass-produces it.
assert.equal(q('stock-c').hidden,true);assert.equal(q('element-palette').querySelector('[data-element="C"]').hidden,true);
game.run(`resources.collect({H:40,C:12,O:16},0);collectionGame.refreshProgress();veilUI.updateCraft();`);
assert.equal(q('stock-c').hidden,false);assert.equal(q('stock-o').hidden,false);assert.equal(q('element-palette').querySelector('[data-element="C"]').hidden,false);assert.equal(q('element-palette').querySelector('[data-element="O"]').hidden,false);
game.run(`resources.spend({C:1,H:4});globalThis.hcoIds=['C','H','H','H','H'].map((element,i)=>{const atom=molecule.addAtom(element);placements.set(atom.id,{position:new THREE.Vector3(i,0,0)});return atom.id;});for(let i=1;i<5;i++)molecule.setBond(hcoIds[0],hcoIds[i],1);topologyChanged();refresh();`);
assert.equal(game.run("resources.state.recipes.includes('methane')"),true);assert.equal(q('store-h2').hidden,false);q('store-h2').click();assert.equal(game.run('resources.state.molecules.methane'),1);assert.equal(game.run('molecule.atoms.length'),0);
q('open-supply').click();assert.equal(q('supply-dialog').open,true);const recipeValues=[...q('molecule-select').options].map(option=>option.value);assert.ok(recipeValues.includes('methane')&&recipeValues.includes('oxygen')&&recipeValues.includes('water'));
q('molecule-select').value='methane';q('molecule-select').dispatchEvent(new game.window.Event('change',{bubbles:true}));const hBeforeMethane=game.run('resources.state.elements.H'),cBeforeMethane=game.run('resources.state.elements.C');q('make-h2').click();assert.equal(game.run('resources.state.elements.H'),hBeforeMethane-4);assert.equal(game.run('resources.state.elements.C'),cBeforeMethane-1);
game.run(`resources.discover('hydrogen');resources.discover('oxygen');resources.discover('water');resources.makeMolecule('hydrogen',2);resources.makeMolecule('methane',2);resources.makeMolecule('oxygen',4);resources.makeMolecule('water',2);resources.visit('oxygen');veilUI.updateCraft();`);
q('drive-select').value='combustion';q('drive-select').dispatchEvent(new game.window.Event('change',{bubbles:true}));assert.equal(game.run('resources.state.loadout.drive'),'combustion');q('expedition-anchor').value='oxygen';q('expedition-anchor').dispatchEvent(new game.window.Event('change',{bubbles:true}));q('supply-dialog').close();
q('launch-veil').click();assert.equal(q('veil-drive-switch').hidden,false);const methaneFuel=game.run('resources.state.molecules.methane'),oxygenFuel=game.run('resources.state.molecules.oxygen');q('veil-boost').dispatchEvent(new game.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));assert.equal(game.run('resources.state.molecules.methane'),methaneFuel-1);assert.equal(game.run('resources.state.molecules.oxygen'),oxygenFuel-2);
const waterFuel=game.run('resources.state.molecules.water');game.window.dispatchEvent(new game.window.KeyboardEvent('keydown',{key:'ArrowUp'}));for(let i=0;i<240;i++)game.tick();game.window.dispatchEvent(new game.window.KeyboardEvent('keyup',{key:'ArrowUp'}));assert.equal(game.run('resources.state.molecules.water'),waterFuel-1);assert.equal(q('veil-thermal').hidden,false);assert.match(q('veil-cooling-status').textContent,/冷却/);q('veil-return').click();
console.log('C/O palette gating, paid handmade CH₄ storage, generic hold production, combustion loadout spending and automatic H₂O cooling passed.');
