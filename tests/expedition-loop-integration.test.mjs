import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRun,beginBurst,beginShock,setCombustionHeld,stepRun} from '../src/veil/expedition-run.js';
import {advanceInsightAnalysis,discardActiveInsight,runInsightLossSnapshot,triggerInsight} from '../src/veil/insights.js';
import {EXPEDITION,THERMAL} from '../src/veil/config.js';
import {flightConfig} from '../src/veil/growth.js';
import {createResources} from '../src/veil/resources.js';
import {createUniverse} from '../src/veil/universe.js';
import {expeditionLoss} from '../src/veil/expedition-loss.js';
import {performanceFor} from '../src/veil/molecule-roles.js';
import {LAUNCH_TRANSACTION_STATUS,captureLaunchRollbackState,createLaunchTransaction,restoreLaunchRollbackState,stageLaunchSupply} from '../src/veil/launch-transaction.js';
import {createMoleculeGraph} from '../src/molecule-graph.js';

const catalog=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const graphData=JSON.parse(await readFile(new URL('../data/molecule-graph.json',import.meta.url),'utf8'));
const graph=createMoleculeGraph(graphData);
const loadout={propellant:'hydrogen',fuel:'methane',oxidizer:'oxygen',coolant:'water',shock:'nitromethane'};
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};};
const clone=value=>JSON.parse(JSON.stringify(value));

function makeResources(storage=memory(),{frontier=false,partialStock=null}={}){
  const resources=createResources({storage});resources.setCatalog(catalog);
  for(const id of new Set([...Object.values(loadout),...(frontier?graph.roots:[])]))resources.discover(id);
  for(const [use,id]of Object.entries(loadout))assert.equal(resources.setLoadoutTank(use,id),true);
  Object.assign(resources.state.elements,{H:6000,C:4000,N:2000,O:6000,P:500,S:500,F:500,Cl:500});
  Object.assign(resources.state.progress,{regions:['veil','carbon','oxygen'],checkpoint:'veil',foundElements:['H','C','O','N'],choCompleted:true,coreFractured:true,worldAwakeningPending:false,worldAwakened:true,rareEcologyEligible:true});
  if(frontier)resources.setFrontierGraph(graph);
  if(partialStock){for(const el of Object.keys(resources.state.elements))resources.state.elements[el]=0;Object.assign(resources.state.elements,partialStock);}
  assert.equal(resources.save(),true);return resources;
}

function makeHarness(resources,{fault=null}={}){
  const app={run:null,active:false};let preparedSnapshot=null,preparedFuel=null;
  const transaction=createLaunchTransaction({
    validate:()=>true,beforeLaunch:()=>true,
    snapshot:()=>({resources:captureLaunchRollbackState(resources),app:{run:app.run,active:app.active}}),
    commitSupply:options=>{const supply=stageLaunchSupply(resources,options);if(fault==='after-supply'&&supply)throw Error('after supply');return supply;},
    prepareExpedition:({destinationId})=>{const start=destinationId,nextRun=resources.state.progress.runs+1,fuel=resources.prepareExpedition({region:start,rng:()=>0});preparedSnapshot=resources.frontierInsightDiagnostics();preparedFuel=clone(fuel);if(fault==='prepare')throw Error('prepare');return {start,nextRun,seed:0xA2026,fuel};},
    createRun:({prepared})=>{const config=flightConfig(resources.state),capabilities={combustionDrive:true,nitrogenField:config.nitrogenField===true,coreFractured:config.coreFractured===true,worldAwakened:config.worldAwakened===true,rareEcologyEligible:config.rareEcologyEligible===true};const run=createRun(createUniverse(prepared.seed,resources.state.elements,{capabilities}),config,{fuel:prepared.fuel});if(fault==='create-run')return null;run.destination=prepared.start;return run;},
    initializeExplore:({run})=>{app.run=run;app.active=true;return fault!=='initialize';},
    stageSuccess:({prepared})=>{resources.state.progress.runs=prepared.nextRun;return fault!=='stage-success';},
    persist:()=>fault==='save'?false:resources.save(),
    rollback:({checkpoint})=>{restoreLaunchRollbackState(resources,checkpoint.resources);Object.assign(app,checkpoint.app);return true;},
  });
  return {app,transaction,get preparedSnapshot(){return preparedSnapshot;},get preparedFuel(){return preparedFuel;}};
}

function addFieldDust(run,items){
  run.map.dust=[];const start=run.map.dust.length;
  for(const [offset,item]of items.entries())run.map.dust.push({id:start+offset,x:run.player.x,y:run.player.y,value:item.value,element:item.element,kind:item.rare?'rare':'normal',rareEcology:item.rare===true,ready:0});
  const events=stepRun(run,{x:0,y:0},1/60);
  assert.ok(events.some(event=>event.type==='pickup'),'production FIELD runtime must acquire the seeded dust');
  return events;
}

// FULL LOADOUT -> production run -> acquisition/Insight/tank runtime
// -> voluntary settlement -> reload -> residual-supply relaunch.
{
  const storage=memory(),resources=makeResources(storage),harness=makeHarness(resources);
  const before=clone(resources.state.elements);
  const plan=resources.launchFillPlan({includeWorkspace:false});assert.equal(plan.status,'FULL');
  const launched=await harness.transaction.execute('veil');assert.equal(launched.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);
  for(const [el,cost]of Object.entries(plan.full.cost))assert.equal(resources.state.elements[el],before[el]-cost,'launch auto-synthesis spends its plan once');
  const run=launched.run;assert.equal(run.fuel.propellant.amount,resources.state.tanks.propellant.amount);assert.equal(run.fuel.fuel.amount,resources.state.tanks.fuel.amount);assert.equal(run.fuel.oxidizer.amount,resources.state.tanks.oxidizer.amount);assert.equal(run.fuel.coolant.amount,resources.state.tanks.coolant.amount);assert.equal(run.fuel.shock.amount,resources.state.tanks.shock.amount);run.map.dust=[];

  const pulseUse=performanceFor('hydrogen','propellant').moleculesPerBurst;
  assert.ok(beginBurst(run,()=>resources.consumeBoost()));assert.equal(run.fuel.propellant.amount,resources.state.tanks.propellant.amount);
  setCombustionHeld(run,true);stepRun(run,{x:0,y:0},1/60,{consumeCombustion:packet=>resources.consumeCombustion(packet)});setCombustionHeld(run,false);
  run.heat=THERMAL.coolantStart;run.overheated=true;stepRun(run,{x:0,y:0},1/60,{consumeCombustion:packet=>resources.consumeCombustion(packet),consumeCoolant:(amount,id)=>resources.consumeTank('coolant',id,amount)});
  assert.ok(beginShock(run,(id,amount)=>resources.consumeTank('shock',id,amount)));
  for(const use of ['propellant','fuel','oxidizer','coolant','shock'])assert.equal(run.fuel[use].amount,resources.state.tanks[use].amount,`${use} persistent/runtime amounts stay in sync after successful consumption`);
  assert.equal(resources.state.tanks.propellant.amount,plan.full.entries.find(entry=>entry.use==='propellant').target-pulseUse);


  const cargoBefore=clone(resources.state.elements);
  addFieldDust(run,[{element:'H',value:24},{element:'P',value:5,rare:true},{element:'S',value:3,rare:true},{element:'F',value:2,rare:true},{element:'Cl',value:4,rare:true}]);
  assert.equal(resources.state.elements.P,cargoBefore.P,'FIELD cargo stays run-local before settlement');
  assert.deepEqual(Object.fromEntries(['P','S','F','Cl'].map(el=>[el,run.elementDust[el]])),{P:5,S:3,F:2,Cl:4});

  assert.deepEqual(triggerInsight(run,'ethane',resources.state),{type:'insightAnalysisStart',id:'ethane'});
  advanceInsightAnalysis(run,5);assert.deepEqual(run.carriedInsights,['ethane']);assert.ok(!resources.state.hints.includes('ethane'),'completed analysis stays run-local before return');
  assert.deepEqual(triggerInsight(run,'nitrogen',resources.state),{type:'insightReady',id:'nitrogen',critical:true});assert.ok(!resources.state.hints.includes('nitrogen'),'critical Insight also remains run-local');
  assert.deepEqual(triggerInsight(run,'propane',resources.state),{type:'insightAnalysisStart',id:'propane'});
  advanceInsightAnalysis(run,2);assert.equal(discardActiveInsight(run),'propane','incomplete analysis is discarded at normal extraction');
  const committedCargo=clone(run.elementDust),settled=resources.settleExpedition(run.elementDust,run.best,false,{insights:run.carriedInsights});assert.ok(settled);
  assert.deepEqual(settled.kept,committedCargo);assert.deepEqual(settled.committedInsights,['ethane','nitrogen']);assert.deepEqual(resources.state.hints.filter(id=>id==='ethane'),['ethane']);assert.deepEqual(resources.state.hints.filter(id=>id==='nitrogen'),['nitrogen']);assert.ok(!resources.state.hints.includes('propane'));
  assert.equal(resources.state.progress.runs,1);

  const settledStock=clone(resources.state.elements),settledTanks=clone(resources.state.tanks),savedLoadout=resources.selectedLoadout();
  const reloaded=createResources({storage});reloaded.setCatalog(catalog);assert.deepEqual(reloaded.state.elements,settledStock);assert.deepEqual(reloaded.state.tanks,settledTanks);assert.deepEqual(reloaded.selectedLoadout(),savedLoadout);assert.deepEqual(reloaded.state.hints,resources.state.hints);assert.deepEqual(reloaded.state.recipes,resources.state.recipes);assert.deepEqual(reloaded.state.progress,resources.state.progress);assert.equal(reloaded.state.progress.runs,1);
  const refill=reloaded.launchFillPlan({includeWorkspace:false}),stockBeforeRelaunch=clone(reloaded.state.elements),relaunch=await makeHarness(reloaded).transaction.execute('veil');assert.equal(relaunch.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);assert.equal(reloaded.state.progress.runs,2);assert.deepEqual(relaunch.supply.plan.cost,refill.full.cost,'relaunch synthesizes only the residual tank deficit');
  for(const [el,cost]of Object.entries(refill.full.cost))assert.equal(reloaded.state.elements[el],stockBeforeRelaunch[el]-cost,'relaunch applies only the previewed refill cost');
  for(const use of Object.keys(loadout))assert.equal(relaunch.run.fuel[use].amount,reloaded.state.tanks[use].amount);assert.equal(relaunch.run.elementDust.H,0);assert.equal(reloaded.state.hints.filter(id=>id==='ethane').length,1,'relaunch does not duplicate the previous Insight commit');
}

// PARTIAL supply preview, persistent tank contents, prepared snapshot and runtime
// amount agree exactly through the production launch functions.
{
  const full=makeResources(),required=full.launchFillPlan({includeWorkspace:false}).required,partialStock=Object.fromEntries(Object.entries(required).map(([el,count])=>[el,Math.floor(count/2)])),partial=makeResources(memory(),{partialStock}),preview=partial.launchFillPlan({includeWorkspace:false});
  assert.equal(preview.status,'PARTIAL');const h=makeHarness(partial),launched=await h.transaction.execute('veil',{partial:true});assert.equal(launched.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);
  for(const entry of preview.partial.entries){assert.ok(entry.target>0,`${entry.use} receives a nonzero proportional partial load`);assert.equal(partial.state.tanks[entry.use].amount,entry.target);assert.equal(h.preparedFuel[entry.use].amount,entry.target);assert.equal(launched.run.fuel[entry.use].amount,entry.target);}
  assert.equal(h.preparedSnapshot.reason,'graph-unavailable');
}

// Reloading an active FIELD discards its un-settled run-local cargo. The saved
// launch remains a launch, but does not become a settlement or a resumable run.
{
  const storage=memory(),resources=makeResources(storage),launched=await makeHarness(resources).transaction.execute('veil');assert.equal(launched.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);const stockAtField=clone(resources.state.elements);
  addFieldDust(launched.run,[{element:'H',value:40},{element:'Cl',value:8,rare:true}]);assert.notEqual(launched.run.elementDust.H,0);assert.deepEqual(resources.state.elements,stockAtField,'active FIELD acquisition does not change persistent stock');
  const reloaded=createResources({storage});reloaded.setCatalog(catalog);assert.deepEqual(reloaded.state.elements,stockAtField);assert.equal(reloaded.state.progress.runs,1);assert.deepEqual(reloaded.state.tanks,resources.state.tanks);
  const next=await makeHarness(reloaded).transaction.execute('veil');assert.equal(next.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);assert.deepEqual(next.run.elementDust,{H:0,C:0,N:0,O:0,P:0,S:0,F:0,Cl:0});assert.deepEqual(reloaded.state.elements,stockAtField,'active run cargo is not phantom-settled on reload');
}

// Forced return applies the same loss calculation to Rare and normal cargo,
// loses carried Insight and stops engine consumption.
{
  const storage=memory(),resources=makeResources(storage),h=makeHarness(resources),launched=await h.transaction.execute('veil');assert.equal(launched.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);resources.state.progress.choCompleted=false;assert.equal(resources.save(),true);const run=launched.run;
  run.map.dust=[];
  addFieldDust(run,[{element:'H',value:15},{element:'P',value:11,rare:true},{element:'S',value:7,rare:true},{element:'F',value:5,rare:true},{element:'Cl',value:9,rare:true}]);
  assert.deepEqual(triggerInsight(run,'ethane',resources.state),{type:'insightAnalysisStart',id:'ethane'});advanceInsightAnalysis(run,5);assert.deepEqual(run.carriedInsights,['ethane']);
  assert.deepEqual(triggerInsight(run,'nitrogen',resources.state),{type:'insightReady',id:'nitrogen',critical:true});
  run.captured=true;run.forcedReturn={triggeredAt:run.time,eaterId:2,presentationStarted:false};const lossSnapshot={lost:expeditionLoss(run.elementDust,EXPEDITION.captureLoss),insights:runInsightLossSnapshot(run)};
  assert.deepEqual(lossSnapshot.insights,['ethane','nitrogen']);const remainingPropellant=run.fuel.propellant.amount;assert.equal(beginBurst(run,()=>resources.consumeBoost()),false);assert.equal(run.fuel.propellant.amount,remainingPropellant);stepRun(run,{x:0,y:0},1/60);
  const returned=resources.settleExpedition(run.elementDust,run.best,true,{destinationReached:true,insights:[]});assert.ok(returned);assert.deepEqual(returned.lost,lossSnapshot.lost);assert.equal(returned.captured,true);assert.ok(!resources.state.hints.includes('ethane'));assert.equal(resources.state.progress.choCompleted,false,'forced return does not commit destination completion');
  for(const el of ['P','S','F','Cl'])assert.equal(returned.kept[el]+returned.lost[el],run.elementDust[el],`${el} Rare cargo follows shared settlement loss authority`);
  const after=createResources({storage});assert.equal(after.state.progress.runs,1);assert.deepEqual(after.state.tanks,resources.state.tanks);
}

// Each transaction failure after supply/prepare restores persistent progress,
// tanks and stock, plus the private frontier-run state created by prepareExpedition.
for(const fault of ['after-supply','prepare','create-run','initialize','stage-success','save']){
  const resources=makeResources(memory(),{frontier:true}),baseline=resources.snapshot(),frontierBefore=resources.frontierInsightDiagnostics(),h=makeHarness(resources,{fault});
  const failed=await h.transaction.execute('veil');assert.equal(failed.status,LAUNCH_TRANSACTION_STATUS.FAILED,`${fault} injected failure is rolled back`);
  assert.deepEqual(resources.snapshot(),baseline,`${fault} restores stock, tanks and all progression state`);assert.deepEqual(resources.frontierInsightDiagnostics(),frontierBefore,`${fault} does not leave the failed run's Insight/frontier bookkeeping`);assert.equal(h.app.active,false);assert.equal(h.app.run,null);
}

console.log('Expedition loop integration passed: production FULL/PARTIAL launch, packet/tank sync, FIELD cargo and Insight authority, Rare settlement, reload, residual relaunch and full launch rollback including frontier bookkeeping.');
