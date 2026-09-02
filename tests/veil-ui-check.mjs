// DOM + real Three.js scene/math integration; WebGL rendering is stubbed.
// Run: node tests/veil-ui-check.mjs /path/to/node_modules/jsdom/lib/api.js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createContext,runInContext} from 'node:vm';
import {WORKSPACE_STORAGE_KEY} from '../src/workspace-save.js?v=30';
if(!process.argv[2])throw new Error('Pass jsdom/lib/api.js');
const {JSDOM}=await import(pathToFileURL(process.argv[2]));
const root=new URL('../',import.meta.url),appURL=new URL('src/app.js?v=43',root),html=await readFile(new URL('index.html',root),'utf8');
let source=await readFile(appURL,'utf8'),bindings={};
for(const match of source.matchAll(/^import (.*?) from '([^']+)';$/gm)){
  const module=await import(new URL(match[2],appURL));
  if(match[1].startsWith('* as '))bindings[match[1].slice(5)]={...module};
  else for(const item of match[1].slice(1,-1).split(',')){const [name,alias]=item.trim().split(/\s+as\s+/);bindings[alias??name]=module[name];}
}
source=source.replace(/^import .*?;\n/gm,'').replace(/await import\('\.\/collection-ui\.js\?v=\d+'\)/,'collectionModule');
const {createCollectionUI}=await import('../src/collection-ui.js?v=37');
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
  sandbox.connectExploration=options=>bindings.connectExploration({...options,reset:{...options.reset,reload:()=>reloads++}});
  const context=createContext(sandbox);runInContext(source,context);await settle();runInContext(`resources.collect(${initialH},0);resources.save();`,context);return {window,document,context,vibrations,get reloads(){return reloads;},tick(ms=1000/60){now+=ms;const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(now);},run:code=>runInContext(code,context)};
}

let game=await setup();
const q=id=>game.document.getElementById(id);
const finishReturn=()=>{for(let i=0;i<60;i++)game.tick();};
assert.equal(game.run('resources.state.elements.H'),0);
q('element-palette').querySelector('[data-element="H"]').click();
assert.equal(game.run('molecule.atoms.length'),0,'No free H from the ordinary palette');
q('open-supply').click();assert.equal(q('supply-dialog').open,true);q('launch-veil').click();assert.equal(q('supply-dialog').open,false);assert.equal(q('veil-view').hidden,false);
assert.equal(game.run('veilUI.active'),true);
game.window.dispatchEvent(new game.window.KeyboardEvent('keydown',{key:'ArrowUp'}));
for(let i=0;i<200;i++)game.tick();
game.window.dispatchEvent(new game.window.KeyboardEvent('keyup',{key:'ArrowUp'}));
const gathered=game.run('veilUI.run.collectedElements.H');assert.ok(gathered>0,'Keyboard flight actually collects expedition cargo through the production RAF');
assert.equal(game.run('resources.state.elements.H'),0,'Cargo is not banked before return');assert.match(q('veil-h').textContent,/H [1-9]/);
const safeReturnTime=game.run('veilUI.run.time');q('veil-return').click();assert.equal(q('veil-view').hidden,false);assert.equal(game.run('veilUI.returning'),'locking');assert.equal(game.run('veilUI.run.returnEffect.mode'),'stable');assert.equal(q('veil-return-label').textContent,'ANCHOR LOCK');assert.equal(game.run('resources.state.elements.H'),0,'ANCHOR LOCK does not settle cargo early');for(let i=0;i<10;i++)game.tick();const lockElapsed=game.run('veilUI.anchorLock.elapsed');q('veil-return').click();game.tick();assert.ok(game.run('veilUI.anchorLock.elapsed')>lockElapsed,'Repeated return input cannot reset ANCHOR LOCK');assert.ok(game.run('veilUI.run.time')>safeReturnTime,'DUST EATER physics remains live during the lock');assert.notEqual(q('veil-anchor-meter').style.transform,'scaleX(0)');finishReturn();assert.equal(q('veil-view').hidden,true);assert.equal(game.run('resources.state.elements.H'),gathered);
game.run('resources.collect(6,0);resources.save()');const craftStock=gathered+6;
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
assert.equal(game.run('resources.state.molecules.hydrogen'),0);assert.equal(game.run('molecule.atoms.length'),2);
const tankAction=q('craft-tank-actions').querySelector('[data-tank-use="propellant"]');assert.ok(tankAction);const hBefore=game.run('resources.state.elements.H');tankAction.click();assert.equal(game.run('resources.state.elements.H'),hBefore,'A short tap does not produce');
game.run("veilUI.directFill('propellant','hydrogen');veilUI.directFill('propellant','hydrogen');veilUI.directFill('propellant','hydrogen')");
assert.equal(game.run('resources.state.elements.H'),hBefore-6);assert.equal(game.run('resources.state.molecules.hydrogen'),0);assert.deepEqual(game.run('resources.state.tanks.propellant'),{molecule:'hydrogen',amount:3});assert.equal(game.run('molecule.atoms.length'),2,'The handmade molecule remains as the production template');
const checkedOut=game.run('resources.state.elements.H');game.run('clearField()');assert.equal(game.run('resources.state.elements.H'),checkedOut+2);assert.equal(game.run('molecule.atoms.length'),0);
q('open-supply').click();assert.equal(q('supply-dialog').open,true);assert.equal(q('open-supply').textContent.trim(),'収集殻');assert.equal(q('shell-propellant').querySelector('small').textContent,'H₂ 3/3');assert.equal(q('tank-model-name').textContent,'H₂ · 水素');assert.equal(q('tank-comparison').children.length,2);
const modelDown=new game.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true,clientX:20,clientY:20});Object.defineProperty(modelDown,'pointerId',{value:61});q('tank-model').dispatchEvent(modelDown);const modelUp=new game.window.MouseEvent('pointerup',{bubbles:true,cancelable:true,clientX:20,clientY:20});Object.defineProperty(modelUp,'pointerId',{value:61});q('tank-model').dispatchEvent(modelUp);assert.equal(q('supply-dialog').open,false);assert.equal(q('collection-dialog').open,true);assert.match(q('collection-detail').textContent,/水素/);[...q('collection-detail').querySelectorAll('button')].find(button=>button.textContent==='この分子をクラフト').click();assert.equal(q('collection-dialog').open,false);assert.match(q('craft-resource-hint').textContent,/H₂をクラフト/);
q('open-supply').click();q('launch-veil').click();const fuel=game.run('resources.state.tanks.propellant.amount');assert.equal(q('veil-fuel').textContent,`${fuel} / 3`);assert.match(q('veil-burst-meter').style.transform,/scaleX\([\d.]+\)/);
q('veil-boost').dispatchEvent(new game.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));
q('veil-boost').dispatchEvent(new game.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));
assert.equal(game.run('resources.state.tanks.propellant.amount'),fuel-1,'Cooldown blocks duplicate tank spend');assert.equal(game.run('resources.state.molecules.hydrogen'),0,'BURST does not touch BASE STOCK');
assert.equal(q('veil-fuel').textContent,`${fuel-1} / 3`,'BURST gauge follows the accepted spend immediately');
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
assert.equal(game.run('resources.state.elements.H'),snapshot.elements.H);assert.equal(game.run('resources.state.molecules.hydrogen'),snapshot.molecules.hydrogen);assert.deepEqual(game.run('resources.state.tanks'),snapshot.tanks);assert.equal(game.run('molecule.atoms.length'),0);
assert.equal(q('molecule-select'),null);assert.equal(q('fill-hydrogen'),null);
// Returned atoms are reusable, not free; a reload cannot refund them again.
game.run('resources.collect(2,0);resources.save();');const balance=game.run('resources.state.elements.H');
q('element-palette').querySelector('[data-element="H"]').click();game.run('updateStructureFrame(performance.now()+1000)');
q('delete-selected').click();for(let i=0;i<150;i++)game.tick();
assert.equal(game.run('resources.state.elements.H'),balance);
assert.equal(JSON.parse(game.window.localStorage.getItem('molecule-craft.resources.v1')).workspace.atoms.length,0);
console.log('Production H Veil UI passed: Collector Shell launch, manual H₂ template, continuous direct fill, tank model to encyclopedia to craft, boost spending, multitouch cancellation, blur pause, exact resource/workspace reload and refunds. Canvas/WebGL are stubbed; this is not a visual or subjective playtest.');

// Delete + close during settlement must never persist refunded H beside the old atom.
game.run('resources.collect(2,0);resources.save();');const total=game.run('resources.state.elements.H');
for(let i=0;i<2;i++){q('element-palette').querySelector('[data-element="H"]').click();game.run('updateStructureFrame(performance.now()+1000)');}
q('delete-selected').click();assert.equal(game.run('!!relaxation'),true);
game.window.dispatchEvent(new game.window.Event('pagehide'));
const interrupted=JSON.parse(game.window.localStorage.getItem('molecule-craft.resources.v1'));
assert.equal(interrupted.workspace.atoms.length,1);assert.equal(interrupted.elements.H,total-1);
assert.equal(interrupted.elements.H+interrupted.workspace.atoms.filter(a=>a.element==='H').length,total);
console.log('Interrupted atom deletion preserves the H balance atomically before settlement.');

game=await setup(null,30,saved);q('open-supply').click();for(const id of ['shell-propellant','shell-fuel','shell-oxidizer','shell-coolant'])assert.ok(q(id));assert.equal(q('molecule-select'),null);q('supply-dialog').close();
// Cancellation of the full reset is a no-op, confirmation commits once.
q('open-menu').click();game.window.confirm=()=>false;const beforeReset=game.window.localStorage.getItem('molecule-craft.resources.v1');q('reset-all').click();assert.equal(game.window.localStorage.getItem('molecule-craft.resources.v1'),beforeReset);
game.window.confirm=()=>true;q('reset-all').click();assert.equal(game.reloads,1);
const resetSave=game.window.localStorage.getItem('molecule-craft.resources.v1'),resetBook=game.window.localStorage.getItem('molecule-craft.collection.v1');
game.window.dispatchEvent(new game.window.Event('pagehide'));assert.equal(game.window.localStorage.getItem('molecule-craft.resources.v1'),resetSave,'Old graph cannot overwrite reset on pagehide');
game=await setup(null,0,resetSave,resetBook);
assert.equal(game.run('resources.state.elements.H'),0);assert.equal(game.run('resources.state.molecules.hydrogen'),0);assert.equal(game.run('resources.state.recipes.length'),0);assert.equal(game.run('molecule.atoms.length'),0);assert.equal(game.run('collectionGame.state.discoveredCount'),0);assert.equal(q('craft-tank-actions').hidden,true);
q('open-supply').click();q('launch-veil').click();game.window.dispatchEvent(new game.window.KeyboardEvent('keydown',{key:'ArrowUp'}));for(let i=0;i<200;i++)game.tick();assert.ok(game.run('veilUI.run.collectedElements.H')>0);assert.equal(game.run('resources.state.elements.H'),0);q('veil-return').click();finishReturn();assert.ok(game.run('resources.state.elements.H')>0);
console.log('Collector Shell structure, reset cancellation, empty collection/recipe/workspace reboot and a fresh first collection passed.');

// New exploration access reveals C/O in the same palette. A paid handmade CH₄
// is learned while its atoms stay checked out; putting it away refunds them.
assert.equal(q('stock-c').hidden,true);assert.equal(q('element-palette').querySelector('[data-element="C"]').hidden,true);
game.run(`resources.collect({H:40,C:12,O:16},0);collectionGame.refreshProgress();veilUI.updateCraft();`);
assert.equal(q('stock-c').hidden,false);assert.equal(q('stock-o').hidden,false);assert.equal(q('element-palette').querySelector('[data-element="C"]').hidden,false);assert.equal(q('element-palette').querySelector('[data-element="O"]').hidden,false);
game.run(`resources.spend({C:1,H:4});globalThis.hcoIds=['C','H','H','H','H'].map((element,i)=>{const atom=molecule.addAtom(element);placements.set(atom.id,{position:new THREE.Vector3(i,0,0)});return atom.id;});for(let i=1;i<5;i++)molecule.setBond(hcoIds[0],hcoIds[i],1);topologyChanged();refresh();`);
assert.equal(game.run("resources.state.recipes.includes('methane')"),true);assert.equal(game.run('resources.state.molecules.methane'),0);assert.equal(game.run('molecule.atoms.length'),5);assert.ok(q('craft-tank-actions').querySelector('[data-tank-use="fuel"]'));game.run('clearField()');assert.equal(game.run('molecule.atoms.length'),0);
game.run(`resources.collect({H:250,C:30,O:80},0);resources.discover('hydrogen');resources.discover('oxygen');resources.discover('water');for(let i=0;i<3;i++)resources.fillTankFromElements('propellant','hydrogen');for(let i=0;i<18;i++)resources.fillTankFromElements('fuel','methane');for(let i=0;i<36;i++)resources.fillTankFromElements('oxidizer','oxygen');resources.visit('oxygen');veilUI.updateCraft();`);
assert.deepEqual(game.run('resources.state.tanks'),{propellant:{molecule:'hydrogen',amount:3},fuel:{molecule:'methane',amount:18},oxidizer:{molecule:'oxygen',amount:36},coolant:{molecule:null,amount:0}});
q('open-supply').click();q('shell-fuel').click();assert.equal(q('tank-model-name').textContent,'CH₄ · メタン');assert.equal(q('tank-comparison').children.length,2);q('shell-oxidizer').click();assert.equal(q('tank-model-name').textContent,'O₂ · 酸素');q('shell-coolant').click();assert.equal(q('tank-empty').hidden,false);
q('expedition-anchor').value='oxygen';q('expedition-anchor').dispatchEvent(new game.window.Event('change',{bubbles:true}));q('launch-veil').click();assert.equal(q('veil-combustion').hidden,false);const methaneBase=game.run('resources.state.molecules.methane'),oxygenBase=game.run('resources.state.molecules.oxygen'),methaneFuel=game.run('resources.state.tanks.fuel.amount'),oxygenFuel=game.run('resources.state.tanks.oxidizer.amount'),waterFuel=game.run('resources.state.molecules.water');
q('veil-combustion').dispatchEvent(new game.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));game.tick();game.tick();assert.equal(game.run('resources.state.tanks.fuel.amount'),methaneFuel-1);assert.equal(game.run('resources.state.tanks.oxidizer.amount'),oxygenFuel-2);assert.equal(game.run('resources.state.molecules.methane'),methaneBase);assert.equal(game.run('resources.state.molecules.oxygen'),oxygenBase);assert.ok(game.run('veilUI.run.driveBuffer')>1.9);assert.match(q('veil-combustion-fuel').textContent,/CH₄ \d+ · O₂ \d+/);assert.match(q('veil-combustion-remaining').textContent,/\d+ \/ 18 PACKETS · \d+s/);assert.match(q('veil-combustion-meter').style.transform,/scaleX\([\d.]+\)/);
assert.equal(game.run('resources.state.molecules.water'),waterFuel,'H₂O is not silently consumed by exploration');assert.equal(q('veil-thermal'),null);const bufferAtLock=game.run('veilUI.run.driveBuffer');q('veil-return').click();assert.equal(game.run('veilUI.returning'),'locking');assert.equal(game.run('veilUI.run.driveHeld'),false,'Starting ANCHOR LOCK releases held COMBUSTION');assert.equal(game.run('veilUI.run.driveBuffer'),bufferAtLock,'The already paid packet remainder is preserved');
game.run(`veilUI.run.elementDust={H:20,C:14,O:7};veilUI.run.map.dust.forEach(dust=>dust.ready=Infinity);var beforeCaptureResources=JSON.stringify(resources.snapshot());var eaterPlayer=veilUI.run.player;veilUI.run.eaters=[{id:0,x:eaterPlayer.x,y:eaterPlayer.y,angle:0,speed:178,vx:0,vy:0,phase:0,trail:[]}];`);game.tick();assert.equal(game.run('veilUI.returning'),'emergency','Contact before lock completion overrides voluntary return');assert.equal(game.run('veilUI.run.returnEffect.mode'),'emergency');assert.equal(game.run('veilUI.run.lostCargoEffects.length'),6,'Task 1 loss particles lead into emergency retrieval');assert.equal(game.run('JSON.stringify(resources.snapshot())'),game.run('beforeCaptureResources'),'Emergency presentation does not deduct resources before the existing settlement');const capturedTime=game.run('veilUI.run.time');q('veil-return').click();for(let i=0;i<20;i++)game.tick();assert.equal(q('veil-view').hidden,false);assert.equal(game.run('veilUI.run.time'),capturedTime);assert.equal(game.run('veilUI.returning'),'emergency','Normal return cannot replace an active emergency transition');finishReturn();assert.equal(q('veil-view').hidden,true);assert.match(q('craft-last-run').textContent,/緊急回収/);
console.log('C/O palette gating, paid handmade CH₄ template, use-specific molecule models and comparison bars, direct capped tanks, hold/release COMBUSTION DRIVE, independent H₂ BURST, no H₂O gate and captured return passed.');
