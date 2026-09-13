import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDeferredExplorationFacade} from '../src/craft-connections.js?v=4';

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
assert.equal(facade.requestExpeditionLaunch('oxygen'),false);
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
  requestExpeditionLaunch:(...args)=>{calls.push(['requestExpeditionLaunch',...args]);return true;},
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
assert.equal(facade.requestExpeditionLaunch('oxygen'),true);
assert.equal(facade.launch({prepared:true}),true);
assert.equal(facade.pause(),'paused');
assert.equal(facade.openSupply('hydrogen','propellant'),true);
facade.updateCraft('refresh');facade.discovered('hydrogen');
assert.deepEqual(facade.usesFor('hydrogen'),['propellant']);
assert.deepEqual(facade.tankStatus('propellant','hydrogen'),{args:['propellant','hydrogen']});
assert.deepEqual(facade.fillPlan('propellant','hydrogen'),{args:['propellant','hydrogen']});
assert.equal(facade.commitFill('propellant','hydrogen',1),'committed');
assert.ok(calls.some(call=>call[0]==='requestExpeditionLaunch'&&call[1]==='oxygen'));
assert.ok(calls.some(call=>call[0]==='launch'));

// Launch requests cross the application boundary with an explicit destination
// id. LOADOUT confirmation stays pre-transaction; supply/resource mutation and
// EXPLORE initialization are owned by the application launch transaction.
const supply=await readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8');
const veil=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');
const connections=await readFile(new URL('../src/craft-connections.js',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
assert.match(supply,/function requestDestinationLaunch\(id\)[\s\S]*?onRequestLaunch\(id\)/);
assert.match(supply,/function requestLaunch\(destinationId\)[\s\S]*?requestedDestinationId=destinationId[\s\S]*?commitAndContinue/);
assert.match(supply,/function commitAndContinue\(partial\)[\s\S]*?onLaunchReady\(destinationId,\{partial\}\)/);
assert.doesNotMatch(supply,/onPrepareLaunch/,'LOADOUT must not own the pre-launch application mutation hook');
assert.doesNotMatch(supply,/resources\.commitLaunchFill/,'LOADOUT must not persist supply before the launch transaction commits');
assert.doesNotMatch(supply,/dispatchEvent\(new window\.Event\('change'/);
assert.doesNotMatch(supply,/q\('launch-veil'\)\.click\(\)/);
assert.match(veil,/createExpeditionLaunchRequester/);
assert.match(veil,/createLaunchTransaction/);
assert.match(veil,/onRequestLaunch:id=>requestExpeditionLaunch\(id\)/);
assert.match(veil,/onLaunchReady:\(id,options\)=>launchTransaction\?\.execute\(id,options\)/);
assert.match(veil,/commitSupply:\(\{partial\}\)=>stageLaunchSupply\(resources,\{partial\}\)/);
assert.match(veil,/persist:\(\)=>resources\.save\(\)/);
assert.match(veil,/q\('launch-veil'\)\.addEventListener\('click',event=>\{event\.preventDefault\(\);requestExpeditionLaunch\(anchor\);\}\)/);
assert.match(veil,/function launch\(\)\{return requestExpeditionLaunch\(anchor\);\}/);
assert.match(app,/onBeforeLaunch:\(\)=>clearField\(\{clearTarget:true,silent:true,recordHistory:false\}\)/);
assert.match(connections,/requestExpeditionLaunch\(\.\.\.args\)\{return current\(\)\?\.requestExpeditionLaunch\?\.\(\.\.\.args\)\?\?false;\}/);
assert.match(connections,/prepareExplorationCatalog\(options\.resources\)[\s\S]*?veilUI=createReadyExploration\(options\)/);

console.log('Issue #122 launch route contract passed: DB-deferred exploration preserves the facade while launch intents use one explicit destination request API and transaction boundary.');
