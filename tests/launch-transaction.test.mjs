import assert from 'node:assert/strict';
import {LAUNCH_TRANSACTION_STATUS,captureLaunchRollbackState,createLaunchTransaction,restoreLaunchRollbackState,stageLaunchSupply} from '../src/veil/launch-transaction.js';

const copy=value=>JSON.parse(JSON.stringify(value));

function createFakeResources(status='FULL'){
  const state={elements:{H:20,C:3,O:2},tanks:{propellant:{molecule:null,amount:0}},progress:{runs:2}};
  let spendCalls=0;
  const full={entries:[{use:'propellant',molecule:'hydrogen',target:4}],cost:{H:8}},partial={entries:[{use:'propellant',molecule:'hydrogen',target:2}],cost:{H:4}};
  return {
    state,blocked:false,
    launchFillPlan(){return {status,full,partial,required:{H:8},missing:status==='FULL'?{}:{H:{have:20,need:24}}};},
    spend(cost){spendCalls++;for(const [element,amount] of Object.entries(cost))if((state.elements[element]??0)<amount)return false;for(const [element,amount] of Object.entries(cost))state.elements[element]-=amount;return true;},
    get spendCalls(){return spendCalls;},
  };
}

{
  const resources=createFakeResources('FULL'),before=copy(resources.state),result=stageLaunchSupply(resources);
  assert.equal(result.status,'FULL');assert.equal(resources.state.elements.H,12);assert.deepEqual(resources.state.tanks.propellant,{molecule:'hydrogen',amount:4});assert.equal(resources.spendCalls,1);
  restoreLaunchRollbackState(resources,{elements:before.elements,tanks:before.tanks,runs:before.progress.runs});assert.deepEqual(resources.state,before);
}

{
  const resources=createFakeResources('PARTIAL'),before=copy(resources.state);
  assert.equal(stageLaunchSupply(resources),false,'PARTIAL must not commit before confirmation');assert.deepEqual(resources.state,before);assert.equal(resources.spendCalls,0);
  const result=stageLaunchSupply(resources,{partial:true});assert.equal(result.status,'PARTIAL');assert.equal(resources.state.elements.H,16);assert.deepEqual(resources.state.tanks.propellant,{molecule:'hydrogen',amount:2});
}

{
  const resources=createFakeResources('IMPOSSIBLE'),before=copy(resources.state);
  assert.equal(stageLaunchSupply(resources,{partial:true}),false);assert.deepEqual(resources.state,before);assert.equal(resources.spendCalls,0,'IMPOSSIBLE must remain pre-commit');
}

function createHarness(initialFault=null,{beforeLaunch=()=>true}={}){
  const resources=createFakeResources('FULL'),baseline=copy(resources.state),ui={mode:'loadout',run:null,operable:true,initialized:0,rollbacks:0,created:0,prepared:0,saves:0},counts={supply:0},fault={value:initialFault};
  const transaction=createLaunchTransaction({
    validate:id=>id==='oxygen'||'invalid-destination',
    beforeLaunch,
    snapshot:()=>({resources:captureLaunchRollbackState(resources),ui:{mode:ui.mode,run:ui.run,operable:ui.operable}}),
    commitSupply:options=>{counts.supply++;const result=stageLaunchSupply(resources,options);if(fault.value==='after-supply')throw new Error('after supply');return result;},
    prepareExpedition:({destinationId})=>{ui.prepared++;if(fault.value==='prepare')throw new Error('prepare');return {start:destinationId,nextRun:resources.state.progress.runs+1};},
    createRun:({prepared})=>{ui.created++;if(fault.value==='create-run')throw new Error('create run');return {id:`run-${prepared.nextRun}`,destination:prepared.start};},
    initializeExplore:({run})=>{ui.initialized++;ui.mode='explore';ui.run=run;ui.operable=false;if(fault.value==='initialize')throw new Error('initialize');return true;},
    stageSuccess:()=>{resources.state.progress.runs++;return true;},
    persist:()=>{ui.saves++;return fault.value!=='save';},
    rollback:({checkpoint})=>{restoreLaunchRollbackState(resources,checkpoint.resources);ui.mode=checkpoint.ui.mode;ui.run=checkpoint.ui.run;ui.operable=checkpoint.ui.operable;ui.rollbacks++;return true;},
  });
  return {resources,baseline,ui,counts,fault,transaction};
}

for(const failure of ['after-supply','prepare','create-run','initialize','save']){
  const harness=createHarness(failure),failed=await harness.transaction.execute('oxygen');
  assert.equal(failed.status,LAUNCH_TRANSACTION_STATUS.FAILED,`${failure} must fail inside the transaction`);
  assert.deepEqual(harness.resources.state,harness.baseline,`${failure} must restore stock, tanks and runs`);
  assert.equal(harness.ui.mode,'loadout');assert.equal(harness.ui.run,null);assert.equal(harness.ui.operable,true);assert.equal(harness.ui.rollbacks,1);assert.equal(harness.transaction.inFlight,false);
  harness.fault.value=null;const retried=await harness.transaction.execute('oxygen');
  assert.equal(retried.status,LAUNCH_TRANSACTION_STATUS.SUCCESS,`${failure} rollback must permit same-session retry`);
  assert.equal(harness.resources.state.elements.H,12);assert.deepEqual(harness.resources.state.tanks.propellant,{molecule:'hydrogen',amount:4});assert.equal(harness.resources.state.progress.runs,3);
  assert.equal(harness.ui.mode,'explore');assert.equal(harness.ui.run?.destination,'oxygen');assert.equal(harness.ui.operable,false);
  assert.equal(harness.counts.supply,2,'failed attempt plus retry must stage supply exactly once each');assert.equal(harness.resources.spendCalls,2,'rollback must prevent duplicate retained consumption');
}

{
  const harness=createHarness(),result=await harness.transaction.execute('oxygen');
  assert.equal(result.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);assert.equal(result.destinationId,'oxygen');assert.equal(harness.counts.supply,1);assert.equal(harness.ui.prepared,1);assert.equal(harness.ui.created,1);assert.equal(harness.ui.initialized,1);assert.equal(harness.ui.saves,1);assert.equal(harness.ui.rollbacks,0);assert.equal(harness.resources.state.progress.runs,3);assert.equal(harness.ui.mode,'explore');
}

{
  let release;const gate=new Promise(resolve=>{release=resolve;}),harness=createHarness(null,{beforeLaunch:()=>gate});
  const first=harness.transaction.execute('oxygen'),duplicate=await harness.transaction.execute('oxygen');
  assert.deepEqual(duplicate,{status:LAUNCH_TRANSACTION_STATUS.BLOCKED,reason:'in-flight'},'application transaction must reject reentrant launch attempts');assert.equal(harness.counts.supply,0);
  release(true);const result=await first;assert.equal(result.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);assert.equal(harness.counts.supply,1);assert.equal(harness.resources.spendCalls,1);assert.equal(harness.ui.created,1);assert.equal(harness.resources.state.progress.runs,3);
}

{
  const harness=createHarness(),before=copy(harness.resources.state),result=await harness.transaction.execute('frontier');
  assert.equal(result.status,LAUNCH_TRANSACTION_STATUS.BLOCKED);assert.equal(result.reason,'invalid-destination');assert.deepEqual(harness.resources.state,before);assert.equal(harness.counts.supply,0);assert.equal(harness.ui.created,0);assert.equal(harness.ui.saves,0);
}

console.log('Launch transaction passed: bounded supply staging, commit-point save, rollback/retry across injected failures, exact-once success and application-level reentrancy protection.');
