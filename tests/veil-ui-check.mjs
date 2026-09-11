// DOM + real Three.js scene/math integration; WebGL rendering is stubbed.
// Run: node tests/veil-ui-check.mjs /path/to/node_modules/jsdom/lib/api.js
import assert from 'node:assert/strict';
import {inventoryDepletion} from '../src/veil/map.js';
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
const {createCollectionUI}=await import('../src/collection-ui.js?v=37');
const {moleculeDatabaseStatus}=await import('../src/chemistry.js?v=20');
const load=async input=>{const path=input instanceof URL?input:new URL(input,appURL);return {ok:true,json:async()=>JSON.parse(await readFile(path,'utf8'))};};
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setTimeout(resolve,5));};
let now=1000;
async function setup(saved=null,initialH=0,resourceSaved=null,collectionSaved=null){
  const frames=new Map();let nextFrame=1;const raf=fn=>{const id=nextFrame++;frames.set(id,fn);return id;},cancel=id=>frames.delete(id);
  const dom=new JSDOM(html,{url:'https://example.test/molecule-craft/',pretendToBeVisual:true}),{window}=dom,{document}=window;
  Object.assign(globalThis,{window,document,Option:window.Option,fetch:load,requestAnimationFrame:raf,cancelAnimationFrame:cancel,ResizeObserver:class{observe(){}},performance:{now:()=>now}});
  window.matchMedia=()=>({matches:false});window.confirm=()=>true;
  window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
  const context2d=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{}});window.HTMLCanvasElement.prototype.getContext=()=>context2d;window.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:390,height:844,left:0,top:0});
  if(resourceSaved)window.localStorage.setItem('molecule-craft.resources.v1',resourceSaved);
  if(collectionSaved)window.localStorage.setItem('molecule-craft.collection.v1',collectionSaved);
  if(saved)window.localStorage.setItem(WORKSPACE_STORAGE_KEY,saved);
  const viewer=document.getElementById('viewer');Object.defineProperties(viewer,{clientWidth:{value:390},clientHeight:{value:650}});
  document.querySelector('.viewer-actions').getBoundingClientRect=()=>({bottom:74});document.querySelector('#selection-chip').getBoundingClientRect=()=>({top:590});
  const THREE={...bindings.THREE,WebGLRenderer:class{constructor(){this.domElement=document.createElement('canvas');this.domElement.getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:650,width:390,height:650});}setPixelRatio(){}setSize(){}render(){}}};
  let reloads=0;const vibrations=[];const sandbox={...bindings,createProgressResetUI:options=>bindings.createProgressResetUI({...options,reload:()=>reloads++}),THREE,collectionModule:{createCollectionUI},window,document,navigator:{vibrate:duration=>vibrations.push(duration)},devicePixelRatio:1,ResizeObserver:class{observe(){}},performance:{now:()=>now},fetch:load,requestAnimationFrame:raf,cancelAnimationFrame:cancel,setTimeout:()=>1,clearTimeout:()=>{},console};
  sandbox.connectExploration=options=>bindings.connectExploration({...options,reset:{...options.reset,reload:()=>reloads++}});
  const context=createContext(sandbox);runInContext(source,context);await runInContext('veilUI.ready',context);await settle();assert.equal(moleculeDatabaseStatus().status,'ready','Standalone app boot must reach the production molecule DB ready state');runInContext(`resources.collect(${initialH},0);resources.save();`,context);return {window,document,context,vibrations,get reloads(){return reloads;},tick(ms=1000/60){now+=ms;const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(now);},run:code=>runInContext(code,context)};
}

let game=await setup();
const q=id=>game.document.getElementById(id);
const finishReturn=()=>{for(let i=0;i<60;i++)game.tick();};
assert.equal(game.run('resources.state.elements.H'),0);
q('element-palette').querySelector('[data-element="H"]').click();
assert.equal(game.run('molecule.atoms.length'),0,'No free H from the ordinary palette');
q('open-supply').click();assert.equal(q('supply-dialog').open,true);q('launch-veil').click();await settle();assert.equal(q('supply-dialog').open,false);assert.equal(q('veil-view').hidden,false);
assert.equal(game.run('veilUI.active'),true);
game.window.dispatchEvent(new game.window.KeyboardEvent('keydown',{key:'ArrowUp'}));
for(let i=0;i<200;i++)game.tick();
game.window.dispatchEvent(new game.window.KeyboardEvent('keyup',{key:'ArrowUp'}));
const gathered=game.run('veilUI.run.collectedElements.H');assert.ok(gathered>0,'Keyboard flight actually collects expedition cargo through the production RAF');
assert.equal(game.run('resources.state.elements.H'),0,'Cargo is not banked before return');assert.match(q('veil-h').textContent,/H [1-9]/);
const safeReturnTime=game.run('veilUI.run.time');q('veil-return').click();assert.equal(q('veil-view').hidden,false);assert.equal(game.run('veilUI.returning'),'locking');assert.equal(game.run('veilUI.run.returnEffect.mode'),'stable');assert.equal(q('veil-return-label').textContent,'ANCHOR LOCK');assert.equal(game.run('resources.state.elements.H'),0,'ANCHOR LOCK does not settle cargo early');for(let i=0;i<10;i++)game.tick();const lockElapsed=game.run('veilUI.anchorLock.elapsed');q('veil-return').click();game.tick();assert.ok(game.run('veilUI.anchorLock.elapsed')>lockElapsed,'Repeated return input cannot reset ANCHOR LOCK');assert.ok(game.run('veilUI.run.time')>safeReturnTime,'DUST EATER physics remains live during the lock');assert.notEqual(q('veil-anchor-meter').style.transform,'scaleX(0)');finishReturn();assert.equal(q('veil-view').hidden,true);assert.equal(game.run('resources.state.elements.H'),gathered);
game.run('resources.collect(246,0);resources.save()');const craftStock=gathered+246;
q('element-palette').querySelector('[data-element="H"]').click();game.run('updateStructureFrame(performance.now()+1000)');
q('element-palette').querySelector('[data-element="H"]').click();game.run('updateStructureFrame(performance.now()+1000)');
assert.equal(game.run('resources.state.elements.H'),craftStock-2);
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
assert.equal(q('store-h2'),null,'Handmade molecules have no direct stock action');
assert.equal(game.run("Object.hasOwn(resources.state,'molecules')"),false);assert.equal(game.run('molecule.atoms.length'),2);
assert.equal(q('craft-tank-actions'),null,'Legacy manual tank-charge actions stay removed');const hBefore=game.run('resources.state.elements.H');assert.deepEqual(game.run('resources.state.tanks.propellant'),{molecule:null,amount:0});
const checkedOut=hBefore;game.run('clearField()');assert.equal(game.run('resources.state.elements.H'),checkedOut+2);assert.equal(game.run('molecule.atoms.length'),0);
const beforeTarget=game.run('resources.state.elements.H');q('element-palette').querySelector('[data-element="H"]').click();game.run('updateStructureFrame(performance.now()+1000)');assert.equal(game.run('molecule.atoms.length'),1);
q('open-supply').click();assert.equal(q('supply-dialog').open,true);assert.equal(q('open-supply').textContent.trim(),'収集殻');assert.equal(q('shell-propellant').querySelector('small').textContent,'∅');const h2Choice=q('tank-molecules').querySelector('[data-molecule-id="hydrogen"]');assert.ok(h2Choice);const stockBeforeLoadout=game.run('resources.state.elements.H');h2Choice.click();assert.equal(game.run('resources.state.elements.H'),stockBeforeLoadout,'Loadout selection is free');assert.deepEqual(game.run('resources.state.tanks.propellant'),{molecule:null,amount:0},'Loadout editing does not fill or discard the current tank');assert.equal(game.run('resources.selectedLoadout().propellant'),'hydrogen');assert.equal(q('shell-propellant').querySelector('small').textContent,'H₂');assert.equal(q('tank-model-name').textContent,'H₂ · 水素');assert.equal(q('tank-comparison').children.length,2);assert.equal(q('tank-craft-molecule').hidden,true,'Discovered loadout molecules do not require repeat crafting');
q('tank-model').click();assert.equal(q('supply-dialog').open,true,'The model itself stays an inspection surface');assert.equal(q('collection-dialog').open,false);q('tank-open-collection').click();assert.equal(q('supply-dialog').open,false);assert.equal(q('collection-dialog').open,true);assert.match(q('collection-detail').textContent,/水素/);assert.equal([...q('collection-detail').querySelectorAll('button')].some(button=>button.textContent==='この分子をクラフト'),false);q('collection-dialog').close();game.window.dispatchEvent(new game.window.CustomEvent('molecule-craft:craft-molecule',{detail:{id:'hydrogen'}}));assert.equal(game.run('molecule.atoms.length'),0,'Selecting a target automatically puts the old workspace away');assert.equal(game.run('resources.state.elements.H'),beforeTarget);assert.equal(q('craft-target').hidden,false);assert.match(q('craft-target').textContent,/水素/);assert.equal(game.run('resources.state.workspace.targetMoleculeId'),'hydrogen');
q('element-palette').querySelector('[data-element="H"]').click();game.run('updateStructureFrame(performance.now()+1000)');assert.equal(game.run('molecule.atoms.length'),1,'One checked-out atom remains on the craft field before launch');assert.equal(q('craft-target').hidden,false,'Craft target remains until departure');
q('open-supply').click();const launchStock=game.run('resources.state.elements.H');q('launch-veil').click();await new Promise(resolve=>setTimeout(resolve,540));assert.equal(q('craft-target').hidden,true,'Launching exploration clears the craft target');assert.equal(game.run('molecule.atoms.length'),0,'Departure clears the craft workspace before auto synthesis');const fuel=game.run('resources.state.tanks.propellant.amount');assert.equal(fuel,120,'Departure auto-synthesizes the selected propellant to full capacity');assert.equal(game.run('resources.state.elements.H'),launchStock+1-240,'Checked-out atoms return to BASE STOCK before launch synthesis');assert.equal(game.run('veilUI.run.map.depletion.H'),inventoryDepletion(JSON.parse(game.run('JSON.stringify(resources.state.elements)')),'H'),'Launch uses the actual base inventory after auto synthesis');assert.equal(q('veil-boost').getAttribute('aria-description'),'残り噴射 3回');assert.match(q('veil-burst-meter').style.transform,/scaleX\([\d.]+\)/);
q('veil-boost').dispatchEvent(new game.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));
q('veil-boost').dispatchEvent(new game.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));
assert.equal(game.run('resources.state.tanks.propellant.amount'),fuel-40,'Cooldown blocks duplicate tank spend');
assert.equal(q('veil-boost').getAttribute('aria-description'),'残り噴射 2回','BURST gauge follows the accepted spend immediately');
const pad=q('veil-pad');pad.getBoundingClientRect=()=>({left:20,top:650,width:146,height:146});
function pointer(type,id,x,y){const event=new game.window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:id});pad.dispatchEvent(event);}
pointer('pointerdown',11,93,665);assert.notEqual(q('veil-knob').style.transform,'translate(0px,0px)');
pointer('pointerup',22,93,665);assert.notEqual(q('veil-knob').style.transform,'translate(0px,0px)','Other finger cannot cancel flight');
pointer('pointercancel',11,93,665);assert.equal(q('veil-knob').style.transform,'translate(0px,0px)');
for(let i=0;i<80;i++)game.tick();game.window.dispatchEvent(new game.window.Event('blur'));
const beforePause=q('veil-gained').textContent;for(let i=0;i<180;i++)game.tick();assert.equal(q('veil-gained').textContent,beforePause);assert.equal(q('veil-resume').hidden,false);
q('veil-resume').click();assert.equal(q('veil-resume').hidden,true);
q('veil-boost').dispatchEvent(new game.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));const boostAtLock=game.run('veilUI.run.player.boost'),positionAtLock=game.run('veilUI.run.player.y'),tankAtLock=game.run('resources.state.tanks.propellant.amount');q('veil-return').click();assert.equal(game.run('veilUI.returning'),'locking');q('veil-boost').dispatchEvent(new game.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));assert.equal(game.run('resources.state.tanks.propellant.amount'),tankAtLock,'No new BURST can start during ANCHOR LOCK');for(let i=0;i<10;i++)game.tick();assert.ok(game.run('veilUI.run.player.boost')<boostAtLock&&game.run('veilUI.run.player.boost')>0,'A BURST already in flight keeps its short inertia during the lock');assert.notEqual(game.run('veilUI.run.player.y'),positionAtLock);finishReturn();
const saved=game.window.localStorage.getItem('molecule-craft.resources.v1'),snapshot=JSON.parse(saved);
game=await setup(null,0,saved);
assert.equal(game.run('resources.state.elements.H'),snapshot.elements.H);assert.deepEqual(game.run('resources.state.tanks'),snapshot.tanks);assert.equal(game.run('molecule.atoms.length'),0);
assert.equal(q('molecule-select'),null);assert.equal(q('fill-hydrogen'),null);
// Returned atoms are reusable, not free; a reload cannot refund them again.
game.run('resources.collect(2,0);resources.save();');const balance=game.run('resources.state.elements.H');
q('element-palette').querySelector('[data-element="H"]').click();game.run('updateStructureFrame(performance.now()+1000)');
q('delete-selected').click();for(let i=0;i<150;i++)game.tick();
assert.equal(game.run('resources.state.elements.H'),balance);
assert.equal(JSON.parse(game.window.localStorage.getItem('molecule-craft.resources.v1')).workspace.atoms.length,0);
console.log('Production H Veil UI passed: Collector Shell loadout selection, launch auto-synthesis, manual H₂ discovery, explicit encyclopedia route, target cleanup, boost spending, multitouch cancellation, blur pause, exact resource/workspace reload and refunds. Canvas/WebGL are stubbed; this is not a visual or subjective playtest.');

// Delete + close during settlement must never persist refunded H beside the old atom.
game.run('resources.collect(2,0);resources.save();');const total=game.run('resources.state.elements.H');
for(let i=0;i<2;i++){q('element-palette').querySelector('[data-element="H"]').click();game.run('updateStructureFrame(performance.now()+1000)');}
q('delete-selected').click();assert.equal(game.run('!!relaxation'),true);
game.window.dispatchEvent(new game.window.Event('pagehide'));
const interrupted=JSON.parse(game.window.localStorage.getItem('molecule-craft.resources.v1'));
assert.equal(interrupted.workspace.atoms.length,1);assert.equal(interrupted.elements.H,total-1);
assert.equal(interrupted.elements.H+interrupted.workspace.atoms.filter(a=>a.element==='H').length,total);
console.log('Interrupted atom deletion preserves the H balance atomically before settlement.');

game=await setup(null,30,saved);q('open-supply').click();for(const id of ['shell-propellant','shell-fuel','shell-oxidizer','shell-coolant'])assert.ok(q(id));assert.equal(q('shell-coolant').hidden,false,'Coolant is an active Collector Shell tank');assert.equal(q('molecule-select'),null);q('supply-dialog').close();
// Cancellation of the full reset is a no-op, confirmation commits once.
q('open-menu').click();game.window.confirm=()=>false;const beforeReset=game.window.localStorage.getItem('molecule-craft.resources.v1');q('reset-all').click();assert.equal(game.window.localStorage.getItem('molecule-craft.resources.v1'),beforeReset);
game.window.confirm=()=>true;q('reset-all').click();assert.equal(game.reloads,1);
const resetSave=game.window.localStorage.getItem('molecule-craft.resources.v1'),resetBook=game.window.localStorage.getItem('molecule-craft.collection.v1');
game.window.dispatchEvent(new game.window.Event('pagehide'));assert.equal(game.window.localStorage.getItem('molecule-craft.resources.v1'),resetSave,'Old graph cannot overwrite reset on pagehide');
game=await setup(null,0,resetSave,resetBook);
assert.equal(game.run('resources.state.elements.H'),0);assert.equal(game.run("Object.hasOwn(resources.state,'molecules')"),false);assert.equal(game.run('resources.state.recipes.length'),0);assert.equal(game.run('molecule.atoms.length'),0);assert.equal(game.run('collectionGame.state.discoveredCount'),0);assert.equal(q('craft-tank-actions'),null);
q('open-supply').click();q('launch-veil').click();game.window.dispatchEvent(new game.window.KeyboardEvent('keydown',{key:'ArrowUp'}));for(let i=0;i<200;i++)game.tick();assert.ok(game.run('veilUI.run.collectedElements.H')>0);assert.equal(game.run('resources.state.elements.H'),0);q('veil-return').click();finishReturn();assert.ok(game.run('resources.state.elements.H')>0);
console.log('Collector Shell structure, reset cancellation, empty collection/recipe/workspace reboot and a fresh first collection passed.');

// New exploration access reveals C/O in the same palette. A paid handmade CH₄
// is learned while its atoms stay checked out; putting it away refunds them.
assert.equal(q('element-palette').querySelector('[data-element="C"]').hidden,true);
game.run(`resources.collect({H:40,C:12,O:16},0);collectionGame.refreshProgress();veilUI.updateCraft();`);
assert.equal(q('element-palette').querySelector('[data-element="C"]').hidden,false);assert.equal(q('element-palette').querySelector('[data-element="O"]').hidden,false);
game.run(`resources.spend({C:1,H:4});globalThis.hcoIds=['C','H','H','H','H'].map((element,i)=>{const atom=molecule.addAtom(element);placements.set(atom.id,{position:new THREE.Vector3(i,0,0)});return atom.id;});for(let i=1;i<5;i++)molecule.setBond(hcoIds[0],hcoIds[i],1);topologyChanged();refresh();`);
assert.equal(game.run("resources.state.recipes.includes('methane')"),true);assert.equal(game.run('molecule.atoms.length'),5);assert.equal(q('craft-tank-actions'),null);game.run('clearField()');assert.equal(game.run('molecule.atoms.length'),0);
game.run(`resources.collect({H:700,C:30,O:220},0);resources.discover('hydrogen');resources.discover('oxygen');resources.discover('water');resources.setLoadoutTank('propellant','hydrogen');resources.setLoadoutTank('fuel','methane');resources.setLoadoutTank('oxidizer','oxygen');resources.setLoadoutTank('coolant','water');resources.visit('oxygen');veilUI.updateCraft();`);
q('open-supply').click();q('shell-fuel').click();assert.equal(q('tank-model-name').textContent,'CH₄ · メタン');assert.equal(q('tank-comparison').dataset.previewKind,'fuel');assert.equal(q('tank-comparison').querySelectorAll('.loadout-stat').length,3);q('shell-oxidizer').click();assert.equal(q('tank-model-name').textContent,'O₂ · 酸素');q('shell-coolant').click();assert.equal(q('tank-model-name').textContent,'H₂O · 水');assert.equal(q('tank-comparison').dataset.previewKind,'coolant');assert.equal(q('tank-comparison').querySelectorAll('.loadout-stat').length,3);
q('expedition-anchor').value='oxygen';q('expedition-anchor').dispatchEvent(new game.window.Event('change',{bubbles:true}));q('launch-veil').click();await new Promise(resolve=>setTimeout(resolve,540));assert.deepEqual(game.run('resources.state.tanks'),{propellant:{molecule:'hydrogen',amount:120},fuel:{molecule:'methane',amount:18},oxidizer:{molecule:'oxygen',amount:36},coolant:{molecule:'water',amount:80}});assert.equal(q('veil-combustion').hidden,false);const methaneFuel=game.run('resources.state.tanks.fuel.amount'),oxygenFuel=game.run('resources.state.tanks.oxidizer.amount'),elementsBeforeDrive=game.run('JSON.stringify(resources.state.elements)');
q('veil-combustion').dispatchEvent(new game.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));game.tick();game.tick();assert.equal(game.run('resources.state.tanks.fuel.amount'),methaneFuel-1);assert.equal(game.run('resources.state.tanks.oxidizer.amount'),oxygenFuel-2);assert.equal(game.run('JSON.stringify(resources.state.elements)'),elementsBeforeDrive);assert.ok(game.run('veilUI.run.driveBuffer')>1.9);assert.equal(Number(q('veil-combustion-fuel').querySelector('[data-role=fuel]').getAttribute('aria-valuenow')),methaneFuel-1);assert.equal(Number(q('veil-combustion-fuel').querySelector('[data-role=oxidizer]').getAttribute('aria-valuenow')),oxygenFuel-2);assert.match(q('veil-combustion-meter').style.transform,/scaleX\([\d.]+\)/);
assert.equal(q('veil-thermal').hidden,false);assert.equal(q('veil-thermal').dataset.state,'normal');for(let i=0;i<220;i++)game.tick();assert.equal(q('veil-thermal').dataset.state,'cooling');assert.match(q('veil-coolant').textContent,/❄ H₂O/);assert.equal(game.run('resources.state.tanks.coolant.amount'),79);assert.equal(game.run('veilUI.run.fuel.coolant.amount'),79);const bufferAtLock=game.run('veilUI.run.driveBuffer');q('veil-return').click();assert.equal(game.run('veilUI.returning'),'locking');assert.equal(game.run('veilUI.run.driveHeld'),false,'Starting ANCHOR LOCK releases held COMBUSTION');assert.equal(game.run('veilUI.run.driveBuffer'),bufferAtLock,'The already paid packet remainder is preserved');
game.run(`veilUI.run.elementDust={H:20,C:14,O:7};veilUI.run.map.dust.forEach(dust=>dust.ready=Infinity);var beforeCaptureResources=JSON.stringify(resources.snapshot());var eaterPlayer=veilUI.run.player;veilUI.run.eaters=[{id:0,x:eaterPlayer.x,y:eaterPlayer.y,angle:0,speed:178,vx:0,vy:0,phase:0,trail:[]}];`);game.tick();assert.equal(game.run('veilUI.returning'),'emergency','Contact before lock completion overrides voluntary return');assert.equal(game.run('veilUI.run.returnEffect.mode'),'emergency');assert.equal(game.run('veilUI.run.lostCargoEffects.length'),6,'Task 1 loss particles lead into emergency retrieval');assert.equal(game.run('JSON.stringify(resources.snapshot())'),game.run('beforeCaptureResources'),'Emergency presentation does not deduct resources before the existing settlement');const capturedTime=game.run('veilUI.run.time');q('veil-return').click();for(let i=0;i<20;i++)game.tick();assert.equal(q('veil-view').hidden,false);assert.equal(game.run('veilUI.run.time'),capturedTime);assert.equal(game.run('veilUI.returning'),'emergency','Normal return cannot replace an active emergency transition');finishReturn();assert.equal(q('veil-view').hidden,true);assert.match(q('craft-last-run').textContent,/⚠/);
console.log('C/O palette gating, paid handmade CH₄ template, use-specific molecule models and comparison bars, launch-filled tanks, automatic H₂O cooling, independent H₂ BURST, no environmental coolant gate and captured return passed.');

// The new loop begins with a hint, not a gifted recipe. Exercise a paid CO₂
// graph, its collection callback, replacement charge, flight and rebuild.
assert.ok(game.run("resources.state.hints.includes('carbon-dioxide')"));
assert.equal(game.run("resources.state.recipes.includes('carbon-dioxide')"),false);
q('open-supply').click();assert.equal(q('oxygen-route-guide').hidden,false);assert.equal(q('oxygen-route-chart').querySelectorAll('polyline').length,3);
q('oxygen-co2-hint').click();assert.equal(q('collection-dialog').open,true);assert.match(q('collection-detail').textContent,/まだ見つかっていない分子/);
[...q('collection-detail').querySelectorAll('button')].find(b=>b.textContent==='ヒントを見る').click();assert.match(q('collection-detail').textContent,/CO2|CO₂/);q('collection-dialog').close();
game.run(`resources.collect({C:90,O:180});resources.spend({C:1,O:2});var co2Ids=['C','O','O'].map((element,i)=>{const atom=molecule.addAtom(element);placements.set(atom.id,{position:new THREE.Vector3(i,0,0)});return atom.id;});molecule.setBond(co2Ids[0],co2Ids[1],2);molecule.setBond(co2Ids[0],co2Ids[2],2);topologyChanged();refresh();`);
assert.equal(game.run("resources.state.recipes.includes('carbon-dioxide')"),true);assert.equal(game.run("collectionGame.state.hasMolecule('carbon-dioxide')"),true);
game.window.dispatchEvent(new game.window.CustomEvent('molecule-craft:open-molecule',{detail:{id:'carbon-dioxide'}}));
assert.match(q('collection-detail').textContent,/二酸化炭素|CO2/);
assert.equal([...q('collection-detail').querySelectorAll('button')].some(b=>b.textContent==='補給で比較する'),false,'Encyclopedia no longer embeds supply gameplay actions');q('collection-dialog').close();q('open-supply').click();q('shell-propellant').click();assert.equal(q('supply-dialog').open,true);const co2Preview=q('tank-molecules').querySelector('[data-molecule-id="carbon-dioxide"]');assert.ok(co2Preview);co2Preview.click();assert.match(q('tank-model-name').textContent,/CO[₂2]/);
assert.equal(q('tank-craft-molecule').hidden,true);const co2Choice=q('tank-molecules').querySelector('[data-molecule-id="carbon-dioxide"]');assert.ok(co2Choice);const beforeCo2Loadout=game.run('resources.snapshot()');co2Choice.click();assert.deepEqual(game.run('resources.state.tanks'),beforeCo2Loadout.tanks,'Selecting CO₂ does not mutate the loaded tank');assert.equal(game.run('resources.selectedLoadout().propellant'),'carbon-dioxide');
q('launch-veil').click();await new Promise(resolve=>setTimeout(resolve,540));assert.equal(game.run('resources.state.tanks.propellant.molecule'),'carbon-dioxide');assert.equal(game.run('resources.state.tanks.propellant.amount'),72);assert.equal(q('veil-boost').getAttribute('aria-description'),'残り噴射 9回');q('veil-boost').click();q('veil-return').click();finishReturn();assert.match(q('craft-last-run').textContent,/↩/);
game.window.dispatchEvent(new game.window.CustomEvent('molecule-craft:open-molecule',{detail:{id:'carbon-dioxide'}}));assert.match(q('collection-detail').textContent,/二酸化炭素|CO2/);q('collection-dialog').close();q('open-supply').click();q('shell-propellant').click();assert.equal(q('tank-comparison').dataset.previewKind,'propellant');const shotRows=q('tank-comparison').lastElementChild;assert.equal(shotRows.firstElementChild.querySelectorAll('i').length,8,'Current CO₂ ghost shows eight remaining BURST shots');assert.equal(shotRows.lastElementChild.querySelectorAll('i').length,9,'Candidate CO₂ loadout shows nine full-tank BURST shots');
console.log('CO₂ loop passed: unknown hint, handmade discovery, collection → loadout selection, launch auto-synthesis, nine-use expedition and return review.');

// A fresh player gets the first craft/return prompt while H is still cargo.
const starterGame=await setup();starterGame.document.getElementById('open-supply').click();starterGame.document.getElementById('launch-veil').click();
starterGame.run(`veilUI.run.elementDust.H=72;veilUI.run.collectedElements.H=24;veilUI.updateCraft();`);
assert.equal(starterGame.document.getElementById('veil-craft-prompt').hidden,false);
// Restore the prior app's global DOM bindings before continuing its checks.
game=await setup(null,0,game.window.localStorage.getItem('molecule-craft.resources.v1'));

// CHO ending is reached spatially and banked only by a successful safe return. Keep this spatial test independent of saved supply choices.
game.run(`for(const use of ['propellant','fuel','oxidizer','coolant'])resources.setLoadoutTank(use,null);`);q('open-supply').click();q('launch-veil').click();
game.run(`Object.assign(veilUI.run.player,{x:280,y:-12470,vx:0,vy:0});veilUI.run.eaters=[];veilUI.run.predators=false;`);game.tick();game.tick();
assert.equal(game.run('veilUI.run.destinationReached'),true);assert.equal(game.run('resources.state.progress.choCompleted'),false);
q('veil-return').click();finishReturn();assert.equal(game.run('resources.state.progress.choCompleted'),true);assert.equal(q('cho-completion'),null);assert.match(q('craft-last-run').textContent,/CHO ✓/);
const completedRaw=game.window.localStorage.getItem('molecule-craft.resources.v1');
game=await setup(null,0,completedRaw);assert.equal(q('cho-completion'),null);assert.equal(q('craft-resource-hint').textContent,'');
q('open-supply').click();assert.equal(q('supply-dialog').open,true);
console.log('CHO completion persists without the obsolete completion CTA; the standard exploration entry remains available.');
