// DOM + real Three.js scene/math integration; WebGL rendering is stubbed.
// Run: node tests/mobile-ui-check.mjs /path/to/node_modules/jsdom/lib/api.js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createContext,runInContext} from 'node:vm';
import {WORKSPACE_STORAGE_KEY} from '../src/workspace-save.js?v=30';
if(!process.argv[2])throw new Error('Pass jsdom/lib/api.js');
const {JSDOM}=await import(pathToFileURL(process.argv[2]));
const root=new URL('../',import.meta.url),appURL=new URL('src/app-v14.js?v=31',root),html=await readFile(new URL('index.html',root),'utf8');
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
reboot.run("addElement('O')");assert.equal(reboot.run('molecule.atoms.length'),3);reboot.run('updateStructureFrame(2000)');reboot.document.querySelector('#clear-all').click();assert.equal(reboot.run('molecule.atoms.length'),3,'A click never clears');reboot.run('clearField()');assert.equal(reboot.run('molecule.atoms.length'),0);assert.equal(JSON.parse(reboot.window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).atoms.length,0);
const future=JSON.stringify({...snapshot,schemaVersion:9}),protectedApp=await setup(future);protectedApp.run("addElement('C');saveWorkspace(true)");assert.equal(protectedApp.window.localStorage.getItem(WORKSPACE_STORAGE_KEY),future);assert.equal(protectedApp.document.querySelector('#workspace-save-status').hidden,false);
console.log('Production DOM integration passed: startup, spawn, dialog guards, collection hints/images/text/navigation, exact restart, clear and future-save protection.');

// Production permission -> visible handle -> drag -> animated bond -> recognition.
// Only atom placement is seeded; every bond goes through the app's drag handler.
for(const record of records.filter(r=>['carbon-monoxide','sulfur-dioxide','sulfur-trioxide','phosphoric-acid','sulfuric-acid','phosphorus-pentachloride','sulfur-hexafluoride'].includes(r.id))){
  const scene=await setup();
  scene.run(`globalThis.fixture=${JSON.stringify(record)};globalThis.fixtureIds=fixture.atoms.map((element,i)=>{const atom=molecule.addAtom(element);placements.set(atom.id,{position:new THREE.Vector3((i%3-1)*2,Math.floor(i/3)*2,0)});return atom.id;});topologyChanged();refresh();camera.lookAt(cameraTarget);camera.updateMatrixWorld();animateUnpairedElectrons(performance.now());`);
  for(const [a,b,order]of record.bonds)for(let step=1;step<=order;step++){
    scene.run(`globalThis.startId=fixtureIds[${a}];globalThis.endId=fixtureIds[${b}];globalThis.startVisual=electronVisuals.find(e=>e.atomId===startId);globalThis.endVisual=electronVisuals.find(e=>e.atomId===endId);`);
    assert.ok(scene.run('!!startVisual&&!!endVisual'),`${record.id}: both rendered handles exist`);
    scene.run(`globalThis.endScreen=worldToScreen(endVisual.visible.position);beginElectronDrag({clientX:0,clientY:0,pointerId:1,pointerType:'mouse'},{atomId:startId,index:startVisual.index,world:startVisual.visible.position.clone()});dragState.moved=true;dragState.currentWorld.copy(endVisual.visible.position);finishElectronDrag(dragState,{clientX:endScreen.x,clientY:endScreen.y});dragState=null;`);
    assert.ok(scene.run('!!bondTransition'),`${record.id}: drag did not queue bond`);
    assert.equal(scene.run('bondTransition.targetId'),scene.run('endId'),`${record.id}: hit wrong atom`);
    for(let f=0;f<300&&scene.run('!!bondTransition||!!relaxation');f++){now+=1000/60;scene.run('if(bondTransition)updateBondTransition(performance.now());if(relaxation)updateRelaxation(performance.now());');}
    assert.equal(scene.run(`bondBetween(startId,endId)?.order`),step,record.id);
    scene.run('animateUnpairedElectrons(performance.now())');
  }
  assert.equal(scene.run('molecule.recognizedMolecule()?.id'),record.id);
  const errors=scene.run('solver.measureError()');console.log(record.id,JSON.stringify(errors));
  assert.ok(errors.finite&&errors.bondRelative<.035&&errors.angleRadians<12*Math.PI/180&&errors.planeDistance<.045,`${record.id}: final pose not converged`);
  assert.ok(scene.run('electronVisuals.every(e=>Number.isFinite(e.visible.position.x))'));
  // Production atom dragging must be rigid, for every element in each graph.
  scene.run(`globalThis.cameraBefore=camera.matrixWorld.toArray();globalThis.extra=molecule.addAtom('H');placements.set(extra.id,{position:new THREE.Vector3(30,30,30)});globalThis.extraBefore=pos(extra.id).clone();topologyChanged();refresh();`);
  for(let atomIndex=0;atomIndex<record.atoms.length;atomIndex++){
    scene.run(`globalThis.pairs=fixtureIds.flatMap((id,i)=>fixtureIds.slice(i+1).map(other=>[id,other,pos(id).distanceTo(pos(other))]));globalThis.event={pointerId:91,clientX:100,clientY:200,pointerType:'touch'};activePointers.set(91,{...event,downAt:performance.now()});beginAtomDrag(event,fixtureIds[${atomIndex}]);`);
    assert.equal(scene.run('dragState.mode'),'molecule-rotate',`${record.id}: atom ${atomIndex} is freely draggable`);
    scene.run(`onPointerMove({...event,clientX:245,clientY:420});onPointerUp({...event,clientX:245,clientY:420});`);
    assert.ok(scene.run('pairs.every(([a,b,length])=>Math.abs(pos(a).distanceTo(pos(b))-length)<1e-9)'),`${record.id}: drag deformed molecule`);
    assert.equal(scene.run('!!relaxation'),false,'Rigid drag must not trigger a slow return');
    assert.ok(scene.run('pos(extra.id).distanceTo(extraBefore)===0'),'Atom drag moved another component');
  }
  assert.ok(scene.run('camera.matrixWorld.toArray().every((n,i)=>n===cameraBefore[i])'),'Rigid drag changed camera');
  assert.equal(scene.document.querySelector('#stop-relaxation'),null,'Stop-correction control was not removed');
  if(record.id==='phosphoric-acid'){
    scene.run(`pos(fixtureIds[0]).add(new THREE.Vector3(-1.8,.4,.9));selectAtom(fixtureIds[0]);saveWorkspace(true);`);
    const savedBad=scene.window.localStorage.getItem(WORKSPACE_STORAGE_KEY),repaired=await setup(savedBad);
    assert.ok(repaired.run('!!relaxation'),'A stretched old save must repair automatically');
    const initialNow=now;
    for(let frame=0;frame<60&&repaired.run('!!relaxation');frame++){now+=1000/60;repaired.run('updateRelaxation(performance.now())');}
    assert.equal(repaired.run('!!relaxation'),false);assert.ok(now-initialNow<=800,'Startup correction took too long');
    assert.ok(repaired.run('solver.measureError({ids:focusedStructure().ids}).bondRelative<.035'),'Old save kept stretched phosphorus bonds');
    assert.deepEqual(Array.from(repaired.run('camera.position.toArray()')),JSON.parse(savedBad).camera.position,'Repair moved the camera');
  }

  if(record.id==='carbon-monoxide')assert.equal(scene.run('[...atomVisuals.values()].filter(v=>v.charge).length'),2);
  if(record.id==='sulfur-trioxide'){
    assert.equal(scene.run('sharedVisuals.length'),1);
    assert.ok(scene.run('[...bondVisuals.values()].every(v=>v.lines.length===1)'));
  }
}
// Unknown saturated graph, bounded automatic correction, camera preservation and
// background rotation during relaxation. Neither recognition nor failure cuts bonds.
const unknown=await setup();
unknown.run(`globalThis.xids=['C','C','C','C'].map((element,i)=>{const a=molecule.addAtom(element);placements.set(a.id,{position:new THREE.Vector3(i%2,Math.floor(i/2),0)});return a.id;});for(let i=0;i<4;i++)molecule.setBond(xids[i],xids[(i+1)%4],2);topologyChanged();refresh();globalThis.beforeCamera=camera.matrixWorld.toArray();globalThis.beforeBonds=molecule.bonds.length;`);
assert.equal(unknown.run('focusedStructure().record'),null);
unknown.run(`globalThis.plan=planStructureEdit(molecule,xids[0]);startRelaxation('test',{...editRelaxationOptions(molecule,plan),restore:new Map(plan.ids.map(id=>[id,pos(id).clone()]))});`);
for(let i=0;i<180&&unknown.run('!!relaxation');i++){now+=1000/60;unknown.run('updateRelaxation(performance.now())');}
assert.equal(unknown.run('!!relaxation'),false);assert.equal(unknown.run('molecule.bonds.length'),4);
assert.ok(unknown.run('camera.matrixWorld.toArray().every((n,i)=>n===beforeCamera[i])'),'Unknown correction changed camera');
unknown.run("startRelaxation();onPointerDown({pointerId:8,clientX:-500,clientY:-500,pointerType:'mouse'});");
assert.equal(unknown.run('dragState.mode'),'molecule-rotate');assert.equal(unknown.run('!!relaxation'),true,'Rotation must not cancel automatic correction');
unknown.run('clearField()');assert.equal(unknown.run('activePointers.size'),0);assert.equal(unknown.run('molecule.atoms.length'),0);
console.log('Seven molecules complete through production drag; all bonded atoms rotate rigidly with no rebound; old P save repairs; unknown correction stays rotatable and clear cancels work.');
