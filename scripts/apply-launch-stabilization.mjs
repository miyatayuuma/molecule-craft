import {readFile,writeFile} from 'node:fs/promises';

async function read(path){return readFile(new URL('../'+path,import.meta.url),'utf8');}
async function write(path,content){await writeFile(new URL('../'+path,import.meta.url),content);}
function replaceOnce(source,pattern,replacement,label){
  const next=source.replace(pattern,replacement);
  if(next===source)throw new Error('Patch target not found: '+label);
  return next;
}

let connections=await read('src/craft-connections.js');
connections=replaceOnce(connections,"const copy=x=>JSON.parse(JSON.stringify(x));\n",'', 'unused launch rollback copy helper');
connections=replaceOnce(connections,/export function commitEmptyLaunchFill[\s\S]*?(?=export function installEmptyDeparturePolicy)/,'','legacy saveful launch-fill commit helpers');
connections=replaceOnce(connections,/export function installEmptyDeparturePolicy\(resources\)\{[\s\S]*?\n\}\n\n(?=export function preserveSupplyDuringPrepare)/,"export function installEmptyDeparturePolicy(resources){\n  const basePlan=resources.launchFillPlan.bind(resources);\n  resources.launchFillPlan=options=>normalizeLaunchFillPlan(rebalanceLaunchFillPlan(resources,basePlan(options),options));\n}\n\n",'launch fill policy override');
connections=replaceOnce(connections,/export function preserveSupplyDuringPrepare[\s\S]*?(?=function shortageText)/,'','legacy supply-dialog prepare bridge');
connections=replaceOnce(connections,/function shortageText[\s\S]*?(?=export async function prepareExplorationCatalog)/,'','duplicate shortage observer and DOM augmentation');
connections=replaceOnce(connections,'onBeforeLaunch:preserveSupplyDuringPrepare(onBeforeLaunch)','onBeforeLaunch','direct pre-launch callback');
connections=replaceOnce(connections,'  installLoadoutShortageUI(resources);\n','','duplicate shortage UI installer');
connections=replaceOnce(connections,"    launch(...args){return current()?.launch?.(...args)??false;},\n",'','legacy deferred launch wrapper');
connections=replaceOnce(connections,"// #119 made exploration initialization asynchronous so LOADOUT cannot observe an\n// incomplete molecule catalog. Keep the pre-#119 public exploration surface\n// intact while the concrete UI is deferred; callers must not have to know which\n// side of the DB-ready boundary they are on.\n","// Exploration initialization stays behind the molecule DB-ready boundary. The\n// deferred facade exposes the production application APIs without compatibility\n// launch aliases, so callers cannot bypass requestExpeditionLaunch(destinationId).\n",'deferred facade contract comment');
await write('src/craft-connections.js',connections);

let supply=await read('src/veil/supply.js');
supply=replaceOnce(supply,"import { renderLoadoutPreview } from './loadout-preview.js';\n","import { renderLoadoutPreview } from './loadout-preview.js';\nimport { isExpeditionDestinationAvailable } from './launch-request.js';\n",'canonical destination availability import');
supply=replaceOnce(supply,"  function requestLaunch(destinationId){\n    const checkpoint=resources.state.progress.checkpoint,available=destinationId==='continue'?!!REGIONS[checkpoint]:resources.state.progress.regions.includes(destinationId)&&!!REGIONS[destinationId];\n    if(!available||launchBusy||requestedDestinationId!==null||resources.blocked||!canOpen())return false;\n","  function requestLaunch(destinationId){\n    if(!isExpeditionDestinationAvailable(resources.state,destinationId)||launchBusy||requestedDestinationId!==null||resources.blocked||!canOpen())return false;\n",'LOADOUT duplicate destination policy');
await write('src/veil/supply.js',supply);

let veil=await read('src/veil/ui.js');
veil=replaceOnce(veil,"  const insightPresentation=createInsightPresentation({root,resources,formula,audio,reduced});\n","  const insightPresentation=createInsightPresentation({root,resources,formula,audio,reduced});\n  const launchRegionId=id=>id==='continue'?resources.state.progress.checkpoint:id;\n  const destinationAvailable=id=>isExpeditionDestinationAvailable(resources.state,id)&&!!REGIONS[launchRegionId(id)];\n",'canonical UI destination policy');
veil=replaceOnce(veil,"      return isExpeditionDestinationAvailable(resources.state,id)&&!!REGIONS[id==='continue'?resources.state.progress.checkpoint:id]||'invalid-destination';","      return destinationAvailable(id)||'invalid-destination';",'transaction destination guard');
veil=replaceOnce(veil,"    isAvailable:id=>!active&&!launchTransaction.inFlight&&!supply.launchPending&&!resources.blocked&&isExpeditionDestinationAvailable(resources.state,id)&&!!REGIONS[id==='continue'?resources.state.progress.checkpoint:id],","    isAvailable:id=>!active&&!launchTransaction.inFlight&&!supply.launchPending&&!resources.blocked&&destinationAvailable(id),",'request destination guard');
veil=replaceOnce(veil,"    const regionId=id==='continue'?resources.state.progress.checkpoint:id;if(!isExpeditionDestinationAvailable(resources.state,id)||!REGIONS[regionId])return false;\n    anchor=id;","    if(!destinationAvailable(id))return false;\n    anchor=id;",'selection destination guard');
veil=replaceOnce(veil,"    supply.update();q('launch-veil').disabled=resources.blocked;\n    const checkpoint=resources.state.progress.checkpoint;\n    q('launch-veil').textContent='↗ 出発';","    supply.update();q('launch-veil').disabled=resources.blocked;\n    q('launch-veil').textContent='↗ 出発';",'unused checkpoint state');
veil=replaceOnce(veil,"  function launch(){return requestExpeditionLaunch(anchor);}\n",'','legacy launch wrapper');
veil=replaceOnce(veil,"    if(!active||!run)return;active=false;cancelAnimationFrame(raf);resetInput();audio.pause();","    if(!active||!run)return;active=false;cancelAnimationFrame(raf);raf=0;resetInput();audio.pause();",'normal return RAF ownership');
veil=replaceOnce(veil,'updateCraft,requestExpeditionLaunch,launch,pause','updateCraft,requestExpeditionLaunch,pause','public launch API surface');
await write('src/veil/ui.js',veil);

const routeTest=`import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDeferredExplorationFacade} from '../src/craft-connections.js?v=5';

let current=null;
const ready=Promise.resolve('ready');
const facade=createDeferredExplorationFacade(()=>current,ready);
assert.equal(facade.active,false);
assert.equal(facade.run,null);
assert.equal(facade.returning,null);
assert.equal(facade.anchorLock,null);
assert.equal(facade.lastTelemetry,null);
assert.equal(facade.ready,ready);
assert.equal(facade.requestExpeditionLaunch('oxygen'),false,'DB-not-ready facade must reject launch requests');
assert.equal('launch' in facade,false,'legacy launch alias must not remain on the application facade');
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
assert.equal(facade.pause(),'paused');
assert.equal(facade.openSupply('hydrogen','propellant'),true);
facade.updateCraft('refresh');facade.discovered('hydrogen');
assert.deepEqual(facade.usesFor('hydrogen'),['propellant']);
assert.deepEqual(facade.tankStatus('propellant','hydrogen'),{args:['propellant','hydrogen']});
assert.deepEqual(facade.fillPlan('propellant','hydrogen'),{args:['propellant','hydrogen']});
assert.equal(facade.commitFill('propellant','hydrogen',1),'committed');
assert.ok(calls.some(call=>call[0]==='requestExpeditionLaunch'&&call[1]==='oxygen'));
assert.equal('launch' in facade,false);

const supply=await readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8');
const veil=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');
const connections=await readFile(new URL('../src/craft-connections.js',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');

assert.match(connections,/prepareExplorationCatalog\(options\.resources\)\.then\(result=>\{[\s\S]*?veilUI=createReadyExploration\(options\)/,'concrete LOADOUT/EXPLORE UI must be created only after the DB-ready promise resolves');
assert.doesNotMatch(connections,/preserveSupplyDuringPrepare|commitEmptyLaunchFill|commitRebalancedLaunchFill|installLoadoutShortageUI|data-launch-shortage-summary|data-launch-shortage-detail/,'migration-only launch bridges and duplicate shortage DOM must be removed');
assert.doesNotMatch(connections,/resources\.commitLaunchFill\s*=/,'application connection must not replace the resource commit API with a saveful pre-transaction launch path');
assert.doesNotMatch(connections,/\n\s*launch\(\.\.\.args\)/,'deferred application facade must expose no legacy launch alias');
assert.match(connections,/const veilUI=createVeilUI\(\{resources,canLeave,canSupply,onBeforeLaunch,/,'pre-launch behavior must be passed directly to the transaction-owning UI');

assert.match(supply,/function requestDestinationLaunch\(id\)[\s\S]*?onRequestLaunch\(id\)/);
assert.match(supply,/button\.addEventListener\('click',event=>\{event\.stopPropagation\(\);requestDestinationLaunch\(point\.id\);\}\)/,'destination button activation must use the explicit request path');
assert.match(supply,/if\(id\)requestDestinationLaunch\(id\);/,'pointer/touch release must use the same destination request path');
assert.match(supply,/event\.key!=='Enter'&&event\.key!==' '/,'keyboard activation must stay on native destination buttons rather than a launch relay');
assert.match(supply,/isExpeditionDestinationAvailable\(resources\.state,destinationId\)/,'LOADOUT must share the canonical destination validity contract');
assert.match(supply,/onLaunchReady\(destinationId,\{partial\}\)/,'confirmed LOADOUT must hand the explicit destination to the transaction');
assert.doesNotMatch(supply,/resources\.commitLaunchFill/,'LOADOUT must not persist supply before transaction commit');
assert.doesNotMatch(supply,/dispatchEvent\(new window\.Event\('change'/,'launch must not synthesize destination change events');
assert.doesNotMatch(supply,/#launch-veil[^\n]*\.click\(|q\('launch-veil'\)\.click\(\)/,'launch must not pseudo-click the fallback launch affordance');

assert.match(veil,/const destinationAvailable=id=>isExpeditionDestinationAvailable\(resources\.state,id\)&&!!REGIONS\[launchRegionId\(id\)\]/,'request, selection and transaction guards must share one destination policy');
assert.match(veil,/validate:id=>\{[\s\S]*?destinationAvailable\(id\)\|\|'invalid-destination'/);
assert.match(veil,/isAvailable:id=>!active&&!launchTransaction\.inFlight&&!supply\.launchPending&&!resources\.blocked&&destinationAvailable\(id\)/,'layer-specific active/in-flight/pending guards remain without duplicating destination policy');
assert.match(veil,/function selectLaunchDestination\(id\)\{\s*if\(!destinationAvailable\(id\)\)return false;/);
assert.match(veil,/q\('launch-veil'\)\.addEventListener\('click',event=>\{event\.preventDefault\(\);requestExpeditionLaunch\(anchor\);\}\)/,'normal launch button is a direct application request path, not a relay');
assert.doesNotMatch(veil,/function launch\(\)/,'legacy launch wrapper must be removed');
assert.equal((veil.match(/q\('launch-veil'\)\.addEventListener/g)||[]).length,1,'launch handler is installed once per UI instance');
assert.equal((veil.match(/audio=createVeilAudio\(\)/g)||[]).length,1,'audio session is created once per UI instance');
assert.match(veil,/renderer\?\?=createVeilRenderer\(canvas\)/,'renderer must be reused across same-session relaunches');
assert.match(veil,/function finish\(captured=false\)\{[\s\S]*?cancelAnimationFrame\(raf\);raf=0;/,'normal return must release the active RAF handle');
assert.match(veil,/function rollbackLaunchTransaction[\s\S]*?cancelAnimationFrame\(raf\)[\s\S]*?raf=0;/,'failed launch rollback must release the active RAF handle');
assert.match(veil,/document\.body\.dataset\.mode='veil'/);
assert.match(veil,/document\.body\.dataset\.mode='craft'/);
assert.match(app,/onBeforeLaunch:\(\)=>clearField\(\{clearTarget:true,silent:true,recordHistory:false\}\)/,'CRAFT-to-BASE-STOCK boundary remains the pre-launch application hook');

console.log('Integrated launch route source contract passed: DB gating, explicit input convergence, canonical destination policy, legacy relay removal, reusable instances and return cleanup.');
`;
await write('tests/issue-122-launch-route.test.mjs',routeTest);

const integrationTest=`import assert from 'node:assert/strict';
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
`;
await write('tests/loadout-launch-regression.test.mjs',integrationTest);

let shortage=await read('tests/loadout-shortage-confirmation.test.mjs');
shortage=replaceOnce(shortage,"import {launchConfirmationState} from '../src/veil/supply.js';\n","import {launchConfirmationState} from '../src/veil/supply.js';\nimport {stageLaunchSupply} from '../src/veil/launch-transaction.js';\n",'production supply stage import');
shortage=replaceOnce(shortage,"  const result=resources.commitLaunchFill({partial:true});assert.ok(result?.committed);","  const result=stageLaunchSupply(resources,{partial:true});assert.ok(result?.committed);",'confirmation/transaction-stage parity');
await write('tests/loadout-shortage-confirmation.test.mjs',shortage);

let pointer=await read('tests/launch-pointer-lifecycle.test.mjs');
pointer=replaceOnce(pointer,"assert.match(source,/if\\(!available\\|\\|launchBusy\\|\\|requestedDestinationId!==null\\|\\|resources\\.blocked\\|\\|!canOpen\\(\\)\\)return false;/,'A pending destination or active handoff must reject duplicate pointer/button launch requests before transaction handoff');","assert.match(source,/if\\(!isExpeditionDestinationAvailable\\(resources\\.state,destinationId\\)\\|\\|launchBusy\\|\\|requestedDestinationId!==null\\|\\|resources\\.blocked\\|\\|!canOpen\\(\\)\\)return false;/,'Canonical destination validity plus pending/busy state must reject duplicate launch requests before transaction handoff');",'pointer lifecycle canonical destination assertion');
await write('tests/launch-pointer-lifecycle.test.mjs',pointer);

let schematic=await read('tests/loadout-schematic.test.mjs');
schematic=replaceOnce(schematic,/test\('stock preview remains a simple shortage bar and hides when fully affordable',[\s\S]*?\n\}\);\n\n(?=test\('launch gestures)/,`test('stock preview reuses existing shortage chips and hides when fully affordable',()=>{\n  assert.match(source,/syncStockPreview/);\n  assert.doesNotMatch(source,/材料不足|loadout-shortage-status/,'the removed explanatory shortage banner must not be restored');\n  assert.match(source,/node\.dataset\?\.sufficient!==undefined/);\n  assert.match(source,/chip\.dataset\.sufficient==='false'/);\n  assert.match(source,/preview\.hidden=!insufficient/);\n  assert.match(source,/chip\.dataset\.stockState=chip\.dataset\.sufficient==='false'\?'short':'ready'/);\n  assert.match(source,/preview\.setAttribute\('aria-label','必要元素'\)/);\n});\n\n`,'stale shortage-banner schematic assertion');
await write('tests/loadout-schematic.test.mjs',schematic);

console.log('Applied LOADOUT → EXPLORE stabilization cleanup and integrated regression updates.');
