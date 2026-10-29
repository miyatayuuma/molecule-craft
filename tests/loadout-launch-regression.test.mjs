import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installEmptyDeparturePolicy} from '../src/craft-connections.js?v=5';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {REGIONS} from '../src/veil/growth.js';
import {createExpeditionLaunchRequester,isExpeditionDestinationAvailable} from '../src/veil/launch-request.js';
import {LAUNCH_TRANSACTION_STATUS,captureLaunchRollbackState,createLaunchTransaction,restoreLaunchRollbackState,stageLaunchSupply} from '../src/veil/launch-transaction.js';

const database=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
const USES=['propellant','fuel','oxidizer','coolant'];
const FULL_LOADOUT={propellant:'hydrogen',fuel:'methane',oxidizer:'oxygen',coolant:'water'};
const PULSE_LOADOUT={propellant:'hydrogen',fuel:null,oxidizer:null,coolant:null};
const clone=value=>JSON.parse(JSON.stringify(value));
const memory=()=>{const data=new Map();let writes=0;return {getItem:key=>data.get(key)??null,setItem(key,value){writes++;data.set(key,value);},removeItem:key=>data.delete(key),get writes(){return writes;}};};

function setup({loadout=FULL_LOADOUT,stock={H:1000,C:100,O:1000},regions=['veil','carbon','oxygen'],checkpoint='veil'}={}){
  const storage=memory(),resources=createResources({storage});resources.setCatalog(database);
  for(const id of new Set(Object.values(loadout).filter(Boolean)))resources.discover(id);
  for(const use of USES)assert.equal(resources.setLoadoutTank(use,loadout[use]??null),true);
  Object.assign(resources.state.elements,{H:0,C:0,O:0,...stock});
  resources.state.progress.regions=[...regions];resources.state.progress.checkpoint=checkpoint;
  assert.equal(resources.save(),true);installEmptyDeparturePolicy(resources);return {storage,resources};
}

const available=(resources,id)=>isExpeditionDestinationAvailable(resources.state,id)&&!!REGIONS[id==='continue'?resources.state.progress.checkpoint:id];

function createLaunchHarness(resources,{fault=null}={}){
  const app={mode:'loadout',run:null,selectedDestination:'continue',rafActive:false};
  const counts={uiPrepare:0,beforeLaunch:0,supply:0,prepare:0,createRun:0,initialize:0,rafStarts:0,persist:0,rollback:0};
  const faultState={value:fault};let pending=null;
  const selectDestination=id=>{if(!available(resources,id))return false;app.selectedDestination=id;return true;};
  const transaction=createLaunchTransaction({
    validate:id=>{if(app.mode!=='loadout'||resources.blocked)return 'blocked';return available(resources,id)||'invalid-destination';},
    beforeLaunch:()=>{counts.beforeLaunch++;const atoms=resources.state.workspace?.atoms;if(Array.isArray(atoms)){for(const atom of atoms)if(Object.hasOwn(resources.state.elements,atom.element))resources.state.elements[atom.element]++;resources.state.workspace=null;}return true;},
    snapshot:()=>({resources:captureLaunchRollbackState(resources),app:{mode:app.mode,run:app.run,selectedDestination:app.selectedDestination,rafActive:app.rafActive}}),
    commitSupply:({partial})=>{counts.supply++;const result=stageLaunchSupply(resources,{partial});if(faultState.value==='after-supply'&&result)throw new Error('after supply');return result;},
    prepareExpedition:({destinationId})=>{counts.prepare++;const nextRun=resources.state.progress.runs+1,start=destinationId==='continue'?resources.state.progress.checkpoint:destinationId;return {nextRun,start,fuel:resources.prepareExpedition({region:start,rng:()=>0})};},
    createRun:({prepared})=>{counts.createRun++;return {id:'run-'+prepared.nextRun,destination:prepared.start,fuel:prepared.fuel,elementDust:{H:0,C:0,O:0},best:0,destinationReached:false,carriedInsights:[]};},
    initializeExplore:({run})=>{counts.initialize++;app.mode='explore';app.run=run;if(faultState.value==='initialize')throw new Error('initialize');return true;},
    stageSuccess:({prepared})=>{resources.state.progress.runs=prepared.nextRun;app.rafActive=true;counts.rafStarts++;return true;},
    persist:()=>{counts.persist++;return faultState.value==='save'?false:resources.save();},
    rollback:({checkpoint})=>{restoreLaunchRollbackState(resources,checkpoint.resources);Object.assign(app,checkpoint.app);app.rafActive=false;counts.rollback++;return true;},
  });
  const requestExpeditionLaunch=createExpeditionLaunchRequester({
    isAvailable:id=>app.mode==='loadout'&&!transaction.inFlight&&pending===null&&!resources.blocked&&available(resources,id),
    selectDestination,
    prepareLaunch:id=>{counts.uiPrepare++;const plan=resources.launchFillPlan();if(plan.status==='IMPOSSIBLE')return false;pending={destinationId:id,status:plan.status};return true;},
  });
  async function continueLaunch({partial=false}={}){
    if(!pending)return {status:LAUNCH_TRANSACTION_STATUS.BLOCKED,reason:'no-pending-request'};
    if(pending.status==='PARTIAL'&&!partial)return {status:LAUNCH_TRANSACTION_STATUS.BLOCKED,reason:'confirmation-required'};
    const request=pending;pending=null;return transaction.execute(request.destinationId,{partial});
  }
  function cancelLaunch(){pending=null;}
  function normalReturn(){
    assert.equal(app.mode,'explore');assert.ok(app.run);const completed=app.run;
    const result=resources.settleExpedition(completed.elementDust,completed.best,false,{destinationReached:completed.destinationReached,insights:completed.carriedInsights});
    assert.ok(result,'normal return must persist expedition settlement');app.mode='loadout';app.run=null;app.rafActive=false;return {completed,result};
  }
  return {app,counts,fault:faultState,transaction,requestExpeditionLaunch,selectDestination,requestSelected:()=>requestExpeditionLaunch(app.selectedDestination),continueLaunch,cancelLaunch,normalReturn,get pending(){return pending;}};
}

{
  const {storage,resources}=setup(),starting=resources.snapshot(),plan=resources.launchFillPlan(),runsBefore=resources.state.progress.runs,harness=createLaunchHarness(resources);
  assert.equal(plan.status,'FULL');assert.equal(harness.selectDestination('carbon'),true);assert.equal(harness.selectDestination('oxygen'),true,'destination B must replace A before launch');
  const writesBefore=storage.writes,stockBefore={...resources.state.elements};assert.equal(harness.requestSelected(),true);const first=await harness.continueLaunch();
  assert.equal(first.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);assert.equal(first.destinationId,'oxygen');assert.equal(harness.app.mode,'explore');assert.equal(harness.app.run.destination,'oxygen');assert.equal(harness.app.rafActive,true);
  assert.equal(resources.state.progress.runs,runsBefore+1);assert.equal(harness.counts.supply,1);assert.equal(harness.counts.createRun,1);assert.equal(harness.counts.initialize,1);assert.equal(harness.counts.rafStarts,1);assert.equal(harness.counts.persist,1);assert.equal(storage.writes,writesBefore+1,'successful launch must cross the persistence boundary once');
  for(const [element,spent] of Object.entries(plan.full.cost))assert.equal(resources.state.elements[element],stockBefore[element]-spent,'BASE STOCK consumption must be exactly once for '+element);
  const firstRun=harness.app.run,stockAfterFirst={...resources.state.elements};const returned=harness.normalReturn();assert.equal(returned.completed,firstRun);assert.equal(harness.app.mode,'loadout');assert.equal(harness.app.run,null);assert.equal(harness.app.rafActive,false);assert.equal(harness.transaction.inFlight,false);assert.equal(harness.pending,null);
  assert.equal(harness.selectDestination('carbon'),true);const secondWrites=storage.writes;assert.equal(harness.requestSelected(),true);const second=await harness.continueLaunch();
  assert.equal(second.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);assert.equal(harness.app.run.destination,'carbon');assert.notEqual(harness.app.run,firstRun,'relaunch must create a fresh run instance');assert.equal(resources.state.progress.runs,runsBefore+2);assert.deepEqual(resources.state.elements,stockAfterFirst,'full retained tanks must not synthesize or consume supply twice');assert.equal(storage.writes,secondWrites+1);assert.equal(harness.counts.supply,2);assert.equal(harness.counts.createRun,2);assert.equal(harness.counts.initialize,2);assert.equal(harness.counts.rafStarts,2);assert.equal(harness.counts.persist,2);assert.equal(harness.counts.rollback,0);
  harness.normalReturn();
  const saved=JSON.parse(storage.getItem(RESOURCE_KEY));for(const key of ['launchBusy','launchPending','inFlight','requestedDestination','provisionalDestination','activeTransaction','activeRun'])assert.equal(Object.hasOwn(saved,key),false,'transient launch state must not persist: '+key);
  const expectedLoadout=resources.selectedLoadout(),expectedTanks=clone(resources.state.tanks),expectedRuns=resources.state.progress.runs,expectedRegions=[...resources.state.progress.regions],expectedCheckpoint=resources.state.progress.checkpoint;
  const reloaded=createResources({storage});reloaded.setCatalog(database);installEmptyDeparturePolicy(reloaded);assert.deepEqual(reloaded.selectedLoadout(),expectedLoadout);assert.deepEqual(reloaded.state.tanks,expectedTanks);assert.equal(reloaded.state.progress.runs,expectedRuns);assert.deepEqual(reloaded.state.progress.regions,expectedRegions);assert.equal(reloaded.state.progress.checkpoint,expectedCheckpoint);
  const afterReload=createLaunchHarness(reloaded);assert.equal(afterReload.selectDestination('oxygen'),true);const reloadWrites=storage.writes;assert.equal(afterReload.requestSelected(),true);const relaunched=await afterReload.continueLaunch();assert.equal(relaunched.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);assert.equal(afterReload.app.mode,'explore');assert.equal(afterReload.app.run.destination,'oxygen');assert.equal(reloaded.state.progress.runs,expectedRuns+1);assert.equal(storage.writes,reloadWrites+1,'reload relaunch must persist once');
  assert.equal(starting.progress.runs,runsBefore);
}

for(const injected of ['after-supply','initialize']){
  const {storage,resources}=setup({loadout:PULSE_LOADOUT,stock:{H:400,C:0,O:0}}),baseline=resources.snapshot(),writesBefore=storage.writes,harness=createLaunchHarness(resources,{fault:injected});
  assert.equal(harness.selectDestination('oxygen'),true);assert.equal(harness.requestSelected(),true);const failed=await harness.continueLaunch();assert.equal(failed.status,LAUNCH_TRANSACTION_STATUS.FAILED);assert.deepEqual(resources.snapshot(),baseline,injected+' failure must restore stock, tanks and progress');assert.equal(harness.app.mode,'loadout');assert.equal(harness.app.run,null);assert.equal(harness.app.rafActive,false);assert.equal(harness.transaction.inFlight,false);assert.equal(harness.pending,null);assert.equal(harness.counts.rollback,1);assert.equal(harness.counts.persist,0);assert.equal(storage.writes,writesBefore,'failure before commit point must not save');
  harness.fault.value=null;assert.equal(harness.requestSelected(),true);const retry=await harness.continueLaunch();assert.equal(retry.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);assert.equal(harness.app.mode,'explore');assert.equal(harness.app.run.destination,'oxygen');assert.equal(harness.transaction.inFlight,false);assert.equal(harness.counts.supply,2,'failed attempt and retry each stage supply once');assert.equal(harness.counts.persist,1,'only retry success reaches persistence');assert.equal(harness.counts.rafStarts,1,'failed launch must not leave a duplicate RAF start');assert.equal(resources.state.progress.runs,baseline.progress.runs+1);assert.equal(storage.writes,writesBefore+1);
}

{
  const {storage,resources}=setup({loadout:PULSE_LOADOUT,stock:{H:2,C:0,O:0}}),plan=resources.launchFillPlan(),baseline=resources.snapshot(),harness=createLaunchHarness(resources),writesBefore=storage.writes;
  assert.equal(plan.status,'PARTIAL');assert.equal(harness.requestSelected(),true);assert.equal(harness.pending.status,'PARTIAL');const waiting=await harness.continueLaunch();assert.equal(waiting.reason,'confirmation-required');assert.deepEqual(resources.snapshot(),baseline);assert.equal(storage.writes,writesBefore);harness.cancelLaunch();assert.equal(harness.pending,null);assert.deepEqual(resources.snapshot(),baseline,'PARTIAL cancel must remain in LOADOUT without mutation');
  assert.equal(harness.requestSelected(),true);const launched=await harness.continueLaunch({partial:true});assert.equal(launched.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);assert.equal(harness.app.mode,'explore');assert.equal(harness.counts.supply,1);assert.equal(harness.counts.createRun,1);assert.equal(harness.counts.persist,1);assert.equal(storage.writes,writesBefore+1);
}

{
  const {storage,resources}=setup({loadout:PULSE_LOADOUT,stock:{H:400,C:0,O:0}});resources.state.loadout.tanks.propellant='not-discovered';assert.equal(resources.save(),true);const baseline=resources.snapshot(),writesBefore=storage.writes,harness=createLaunchHarness(resources);assert.equal(resources.launchFillPlan().status,'IMPOSSIBLE');assert.equal(harness.requestSelected(),false);assert.equal(harness.pending,null);assert.deepEqual(resources.snapshot(),baseline);assert.equal(harness.app.mode,'loadout');assert.equal(harness.app.run,null);assert.equal(harness.counts.supply,0);assert.equal(harness.counts.createRun,0);assert.equal(harness.counts.persist,0);assert.equal(storage.writes,writesBefore,'IMPOSSIBLE must remain pre-transaction and unsaved');
}

{
  const {storage,resources}=setup({loadout:PULSE_LOADOUT,stock:{H:0,C:0,O:0}});resources.state.workspace={atoms:[{element:'H'},{element:'H'}]};const preview=resources.launchFillPlan(),harness=createLaunchHarness(resources),writesBefore=storage.writes;assert.equal(preview.status,'PARTIAL','CRAFT-held H must count in the LOADOUT preview');assert.equal(harness.requestSelected(),true);const launched=await harness.continueLaunch({partial:true});assert.equal(launched.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);assert.equal(resources.state.workspace,null,'pre-launch CRAFT clear must return held atoms before supply staging');assert.equal(resources.state.elements.H,0);assert.deepEqual(resources.state.tanks.propellant,{molecule:'hydrogen',amount:1},'returned CRAFT atoms must be available to launch synthesis');assert.equal(harness.counts.beforeLaunch,1);assert.equal(harness.counts.supply,1);assert.equal(harness.counts.persist,1);assert.equal(storage.writes,writesBefore+1);
}

console.log('Integrated LOADOUT/EXPLORE regression passed: FULL launch, normal return, destination switch, same-session relaunch, reload relaunch, failure/retry, PARTIAL cancel/confirm, IMPOSSIBLE pre-commit and CRAFT-to-BASE-STOCK supply.');
