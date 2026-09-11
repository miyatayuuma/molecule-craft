import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDeferredExplorationFacade} from '../src/craft-connections.js?v=3';

// #119 defers createVeilUI until the molecule DB is ready. That boundary must
// not shrink the exploration object that app.js and production diagnostics use.
let current=null;
const ready=Promise.resolve('ready');
const facade=createDeferredExplorationFacade(()=>current,ready);
assert.equal(facade.active,false);
assert.equal(facade.run,null);
assert.equal(facade.returning,null);
assert.equal(facade.anchorLock,null);
assert.equal(facade.lastTelemetry,null);
assert.equal(facade.ready,ready);
assert.equal(facade.launch(),false);
assert.equal(facade.openSupply('hydrogen','propellant'),false);
assert.deepEqual(facade.usesFor('hydrogen'),[]);
assert.equal(facade.tankStatus('propellant','hydrogen'),null);
assert.equal(facade.fillPlan('propellant','hydrogen'),null);
assert.equal(facade.commitFill('propellant','hydrogen',1),false);

const run={id:'run'},anchorLock={elapsed:0.2},telemetry={id:'last'};
const calls=[];
current={
  active:true,run,returning:'locking',anchorLock,lastTelemetry:telemetry,
  updateCraft:(...args)=>calls.push(['updateCraft',...args]),
  launch:(...args)=>{calls.push(['launch',...args]);return true;},
  pause:(...args)=>{calls.push(['pause',...args]);return 'paused';},
  openSupply:(...args)=>{calls.push(['openSupply',...args]);return true;},
  discovered:(...args)=>calls.push(['discovered',...args]),
  usesFor:id=>id==='hydrogen'?['propellant']:[],
  tankStatus:(...args)=>({args}),
  fillPlan:(...args)=>({args}),
  commitFill:(...args)=>{calls.push(['commitFill',...args]);return 'committed';},
};
assert.equal(facade.active,true);
assert.equal(facade.run,run);
assert.equal(facade.returning,'locking');
assert.equal(facade.anchorLock,anchorLock);
assert.equal(facade.lastTelemetry,telemetry);
assert.equal(facade.launch({prepared:true}),true);
assert.equal(facade.pause(),'paused');
assert.equal(facade.openSupply('hydrogen','propellant'),true);
facade.updateCraft('refresh');facade.discovered('hydrogen');
assert.deepEqual(facade.usesFor('hydrogen'),['propellant']);
assert.deepEqual(facade.tankStatus('propellant','hydrogen'),{args:['propellant','hydrogen']});
assert.deepEqual(facade.fillPlan('propellant','hydrogen'),{args:['propellant','hydrogen']});
assert.equal(facade.commitFill('propellant','hydrogen',1),'committed');
assert.ok(calls.some(call=>call[0]==='launch'));

// Current relay map is intentionally frozen for #122, not cleaned up here:
// destination -> hidden select/change -> #launch-veil click -> supply prepare /
// fill commit -> onLaunchReady -> createVeilUI.launch({prepared:true}). #123 owns
// replacing this DOM-command relay with one direct launch request API.
const supply=await readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8');
const veil=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');
const connections=await readFile(new URL('../src/craft-connections.js',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
assert.match(supply,/function launchDestination\(id\)[\s\S]*?expedition-anchor[\s\S]*?dispatchEvent\(new Event\('change'[\s\S]*?q\('launch-veil'\)\.click\(\)/);
assert.match(supply,/function commitAndContinue\(partial\)[\s\S]*?onPrepareLaunch\(\)[\s\S]*?commitLaunchFill[\s\S]*?onLaunchReady\(\)/);
assert.match(veil,/onLaunchReady:\(\)=>launch\(\{prepared:true\}\)/);
assert.match(veil,/function launch\(\{prepared=false\}=\{\}\)/);
assert.match(app,/onBeforeLaunch:\(\)=>clearField\(\{clearTarget:true,silent:true,recordHistory:false\}\)/);
assert.match(connections,/prepareExplorationCatalog\(options\.resources\)[\s\S]*?veilUI=createReadyExploration\(options\)/);

console.log('Issue #122 launch route contract passed: DB-deferred exploration preserves the pre-#119 facade and the legacy DOM relay is explicitly mapped for #123.');
