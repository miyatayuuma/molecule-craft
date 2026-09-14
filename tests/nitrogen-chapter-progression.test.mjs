import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMoleculeGraph,getFrontierCandidates} from '../src/molecule-graph.js';
import {growthGoal,REGIONS} from '../src/veil/growth.js';
import {isExpeditionDestinationAvailable} from '../src/veil/launch-request.js';
import {CRITICAL_INSIGHT_IDS,advanceInsightAnalysis,createInsightRunState,fieldInsightRequiredElements,triggerInsight} from '../src/veil/insights.js';
import {performanceFor} from '../src/veil/molecule-roles.js';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {insightCategoryFor} from '../src/insight-category.js';
import {AMMONIA_MOLECULE_ID,NITROGEN_MOLECULE_ID,NITROGEN_REGION_AVAILABLE,nitrogenChapterEligible,nitrogenChapterState,nitrogenCriticalInsightCandidate,nitrogenElementAccessible,nitrogenFrontierObjective} from '../src/veil/nitrogen-progression.js';

const memory=(entries=[])=>{const data=new Map(entries);return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),raw:key=>data.get(key)??null};};
const catalog=[{id:NITROGEN_MOLECULE_ID,formula:'N₂',atoms:['N','N']},{id:AMMONIA_MOLECULE_ID,formula:'NH₃',atoms:['N','H','H','H']}];
const resource=storage=>{const value=createResources({storage:storage??memory()});value.setCatalog(catalog);return value;};
const flight=()=>Object.assign({captured:false,events:[]},createInsightRunState());
const settle=(value,run,captured=false)=>value.settleExpedition({H:0,C:0,O:0,N:0},0,captured,{insights:run.carriedInsights});
const graphRaw=JSON.parse(await readFile(new URL('../data/molecule-graph.json',import.meta.url),'utf8')),graph=createMoleculeGraph(graphRaw);

test('Nitrogen chapter eligibility is derived only from committed CHO completion',()=>{
  assert.equal(nitrogenChapterEligible({choCompleted:false}),false);
  assert.equal(nitrogenChapterEligible({choCompleted:true}),true);
  const discoveries={progress:{choCompleted:false},recipes:Array.from({length:40},(_,index)=>`molecule-${index}`),hints:[]};
  assert.equal(nitrogenChapterState(discoveries,{regionAvailable:true}).eligible,false,'discovery count cannot substitute for CHO completion');

  const captured=resource();captured.settleExpedition({H:0,C:0,O:0,N:0},0,true,{destinationReached:true});assert.equal(captured.state.progress.choCompleted,false,'capture cannot commit CHO completion');
  const returned=resource();const result=returned.settleExpedition({H:0,C:0,O:0,N:0},0,false,{destinationReached:true});assert.equal(result.completedNow,true);assert.equal(returned.state.progress.choCompleted,true,'normal settlement remains the CHO completion authority');
});

test('Task 2 keeps unfinished Nitrogen FIELD and element access unavailable',()=>{
  assert.equal(NITROGEN_REGION_AVAILABLE,false);
  assert.equal(Object.hasOwn(REGIONS,'nitrogen'),false,'Nitrogen geometry is not a production region yet');
  const state={progress:{checkpoint:'nitrogen',regions:['veil','nitrogen']}};
  assert.equal(isExpeditionDestinationAvailable(state,'nitrogen'),false,'unknown region IDs cannot be launched even if stale state lists them');
  assert.equal(isExpeditionDestinationAvailable(state,'continue'),false,'continue cannot relay into unavailable geometry');

  const value=resource();value.state.progress.choCompleted=true;value.findElementForExpedition('N');assert.equal(value.canUseElement('N'),false,'N stays player-inaccessible until the production Nitrogen region gate opens');
  assert.equal(nitrogenElementAccessible(value.state.progress),false);
  assert.equal(nitrogenElementAccessible(value.state.progress,{regionAvailable:true}),true,'Task 3 can activate N authority without a save-schema flag');
});

test('N2 critical candidate requires chapter, Nitrogen FIELD context, N discovery and engagement',()=>{
  const value=resource();value.findElementForExpedition('N');
  const context={regionAvailable:true,fieldContext:true,nitrogenEngaged:true};
  assert.equal(nitrogenCriticalInsightCandidate(value.state,context),null,'pre-CHO progression cannot offer N2');
  value.state.progress.choCompleted=true;
  assert.equal(nitrogenCriticalInsightCandidate(value.state,{...context,regionAvailable:false}),null,'eligibility is distinct from destination availability');
  assert.equal(nitrogenCriticalInsightCandidate(value.state,{...context,fieldContext:false}),null,'CHO FIELD cannot emit N2');
  assert.equal(nitrogenCriticalInsightCandidate(value.state,{...context,nitrogenEngaged:false}),null,'entering a future region is insufficient without authored N engagement');
  assert.equal(nitrogenCriticalInsightCandidate(value.state,context),NITROGEN_MOLECULE_ID);
  assert.ok(!value.progressionInsightCandidates({nitrogenFieldContext:true,nitrogenEngaged:true}).includes(NITROGEN_MOLECULE_ID),'production default keeps the Task 2 gate closed');
  assert.ok(value.progressionInsightCandidates({nitrogenRegionAvailable:true,nitrogenFieldContext:true,nitrogenEngaged:true}).includes(NITROGEN_MOLECULE_ID),'resource candidate API is ready for Task 3 context');
  value.hint(NITROGEN_MOLECULE_ID);assert.equal(nitrogenCriticalInsightCandidate(value.state,context),null,'committed N2 knowledge removes the critical candidate');
});

test('N2 reuses critical lifecycle and existing role/category profiles unchanged',()=>{
  assert.ok(CRITICAL_INSIGHT_IDS.includes(NITROGEN_MOLECULE_ID));assert.ok(!CRITICAL_INSIGHT_IDS.includes(AMMONIA_MOLECULE_ID));
  assert.deepEqual(fieldInsightRequiredElements(catalog[0]),['N']);assert.equal(insightCategoryFor(NITROGEN_MOLECULE_ID),'propellant');
  assert.deepEqual(performanceFor(NITROGEN_MOLECULE_ID,'propellant'),{capacity:80,moleculesPerBurst:10,burstPower:.72});
  assert.deepEqual(performanceFor(NITROGEN_MOLECULE_ID,'coolant'),{capacity:72,coolingPower:1.90,durationFactor:.45,environmentTolerance:.55});

  const normal=resource();normal.state.progress.choCompleted=true;normal.findElementForExpedition('N');const carried=flight();assert.deepEqual(triggerInsight(carried,NITROGEN_MOLECULE_ID,normal.state),{type:'insightReady',id:NITROGEN_MOLECULE_ID,critical:true});assert.deepEqual(carried.carriedInsights,[NITROGEN_MOLECULE_ID]);assert.ok(!normal.state.hints.includes(NITROGEN_MOLECULE_ID));const committed=settle(normal,carried);assert.deepEqual(committed.committedInsights,[NITROGEN_MOLECULE_ID]);assert.ok(normal.state.hints.includes(NITROGEN_MOLECULE_ID));assert.equal(nitrogenChapterState(normal.state,{regionAvailable:true}).stage,'nitrogen-craft');

  assert.deepEqual(normal.discoverWithLoadout(NITROGEN_MOLECULE_ID,null),{learned:true,assignedUse:null});assert.equal(nitrogenChapterState(normal.state,{regionAvailable:true}).stage,'ammonia-frontier');assert.ok(normal.tankCatalog('propellant').some(record=>record.id===NITROGEN_MOLECULE_ID));assert.ok(normal.tankCatalog('coolant').some(record=>record.id===NITROGEN_MOLECULE_ID));

  const lost=resource();lost.state.progress.choCompleted=true;lost.findElementForExpedition('N');const lostRun=flight();triggerInsight(lostRun,NITROGEN_MOLECULE_ID,lost.state);const forced=settle(lost,lostRun,true);assert.deepEqual(forced.committedInsights,[]);assert.ok(!lost.state.hints.includes(NITROGEN_MOLECULE_ID));assert.ok(lost.progressionInsightCandidates({nitrogenRegionAvailable:true,nitrogenFieldContext:true,nitrogenEngaged:true}).includes(NITROGEN_MOLECULE_ID),'forced return leaves N2 eligible for a later run');
});

test('NH3 chapter priority is a normal direct-neighbor Graph frontier objective',()=>{
  const before={progress:{choCompleted:true},recipes:[],hints:[]};assert.equal(nitrogenFrontierObjective(graph,before),null,'NH3 cannot skip N2 discovery');
  const skipped={progress:{choCompleted:true},recipes:[AMMONIA_MOLECULE_ID],hints:[]};assert.equal(nitrogenChapterState(skipped,{regionAvailable:true}).stage,'nitrogen-critical','an inconsistent NH3-only state cannot complete the chapter');

  const state={progress:{choCompleted:true},recipes:[NITROGEN_MOLECULE_ID],hints:[]},generic=getFrontierCandidates(graph,{discoveredIds:state.recipes,knownRecipeIds:state.hints}),ammonia=generic.find(candidate=>candidate.id===AMMONIA_MOLECULE_ID),objective=nitrogenFrontierObjective(graph,state);
  assert.ok(graph.getNeighbors(NITROGEN_MOLECULE_ID).includes(AMMONIA_MOLECULE_ID),'production Graph owns the nitrogen ↔ ammonia edge');assert.ok(ammonia,'NH3 must first exist in the ordinary direct-neighbor frontier');assert.ok(ammonia.directDiscoveredNeighbors.includes(NITROGEN_MOLECULE_ID));assert.equal(objective?.id,AMMONIA_MOLECULE_ID);assert.equal(objective?.priority,true);assert.equal(objective?.chapter,'nitrogen');

  state.hints.push(AMMONIA_MOLECULE_ID);assert.equal(nitrogenFrontierObjective(graph,state),null,'known NH3 recipe leaves the frontier and becomes a craft objective');assert.equal(nitrogenChapterState(state,{regionAvailable:true}).stage,'ammonia-craft');
  state.recipes.push(AMMONIA_MOLECULE_ID);assert.equal(nitrogenChapterState(state,{regionAvailable:true}).stage,'complete');assert.equal(nitrogenFrontierObjective(graph,state),null);
});

test('NH3 uses ordinary analysis, normal-return commit and forced-return loss',()=>{
  const normal=resource();normal.state.progress.choCompleted=true;normal.discover(NITROGEN_MOLECULE_ID);const run=flight();assert.deepEqual(triggerInsight(run,AMMONIA_MOLECULE_ID,normal.state),{type:'insightAnalysisStart',id:AMMONIA_MOLECULE_ID});advanceInsightAnalysis(run,5);assert.deepEqual(run.carriedInsights,[AMMONIA_MOLECULE_ID]);const committed=settle(normal,run);assert.deepEqual(committed.committedInsights,[AMMONIA_MOLECULE_ID]);assert.ok(normal.state.hints.includes(AMMONIA_MOLECULE_ID));

  const lost=resource();lost.state.progress.choCompleted=true;lost.discover(NITROGEN_MOLECULE_ID);const lostRun=flight();triggerInsight(lostRun,AMMONIA_MOLECULE_ID,lost.state);advanceInsightAnalysis(lostRun,5);settle(lost,lostRun,true);assert.ok(!lost.state.hints.includes(AMMONIA_MOLECULE_ID));assert.equal(nitrogenFrontierObjective(graph,lost.state)?.id,AMMONIA_MOLECULE_ID);
});

test('growthGoal is stable in Task 2 and ready for Task 3 player-facing stages',()=>{
  const state={progress:{choCompleted:true,foundElements:['H','C','O','N']},recipes:[],hints:[]};const stable=growthGoal(state);assert.match(stable.text,/CHO探索クリア/);assert.doesNotMatch(stable.text,/窒素|N₂|NH₃/,'Task 2 must not instruct the player to enter an unavailable N FIELD');
  assert.match(growthGoal(state,{nitrogenRegionAvailable:true}).text,/窒素/);
  state.hints.push(NITROGEN_MOLECULE_ID);assert.equal(growthGoal(state,{nitrogenRegionAvailable:true}).id,NITROGEN_MOLECULE_ID);
  state.recipes.push(NITROGEN_MOLECULE_ID);assert.match(growthGoal(state,{nitrogenRegionAvailable:true}).text,/NH₃/);
  state.hints.push(AMMONIA_MOLECULE_ID);assert.equal(growthGoal(state,{nitrogenRegionAvailable:true}).id,AMMONIA_MOLECULE_ID);
  state.recipes.push(AMMONIA_MOLECULE_ID);assert.match(growthGoal(state,{nitrogenRegionAvailable:true}).text,/Nitrogen chapter/);
});

test('Nitrogen progression persists through existing schema without a new save flag',()=>{
  const storage=memory(),value=resource(storage);value.state.progress.choCompleted=true;value.findElementForExpedition('N');const run=flight();triggerInsight(run,NITROGEN_MOLECULE_ID,value.state);settle(value,run);assert.equal(JSON.parse(storage.raw(RESOURCE_KEY)).schemaVersion,8);
  const reloaded=resource(storage),chapter=nitrogenChapterState(reloaded.state,{regionAvailable:true});assert.equal(chapter.eligible,true);assert.equal(chapter.stage,'nitrogen-craft');assert.ok(reloaded.state.hints.includes(NITROGEN_MOLECULE_ID));assert.equal(Object.hasOwn(reloaded.state.progress,'nitrogenEligible'),false);assert.equal(Object.hasOwn(reloaded.state.progress,'nitrogenRegionAvailable'),false);assert.equal(Object.hasOwn(reloaded.state.progress,'rareSurveyUnlocked'),false);
});
