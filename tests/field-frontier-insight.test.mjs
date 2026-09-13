import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMoleculeGraph,getFrontierCandidates,scoreFrontierCandidates,selectFrontierCandidate} from '../src/molecule-graph.js';
import {CHALLENGE_INSIGHT_IDS} from '../src/veil/expedition-challenges.js';
import {CRITICAL_INSIGHT_IDS,FIELD_INSIGHT_MIN_SECONDS,advanceInsightAnalysis,createInsightRunState,fieldInsightOpportunityEligibility,fieldInsightRequiredElements,triggerInsight} from '../src/veil/insights.js';
import {createResources} from '../src/veil/resources.js';
import {EXPEDITION} from '../src/veil/config.js';

const raw=JSON.parse(await readFile(new URL('../data/molecule-graph.json',import.meta.url),'utf8'));
const graph=createMoleculeGraph(raw),reserved=new Set([...CRITICAL_INSIGHT_IDS,...CHALLENGE_INSIGHT_IDS]);
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const catalog=graph.nodes.map(node=>({id:node.id,formula:node.id,atoms:['H']}));
const roots=graph.roots.filter(id=>graph.nodeById(id));
const engaged={time:EXPEDITION.safeSeconds,collectedElements:{H:1,C:1,O:1}};
const run=()=>Object.assign({captured:false,events:[]},createInsightRunState());
const settle=(value,flight,captured=false)=>value.settleExpedition({H:0,C:0,O:0},0,captured,{insights:flight?.carriedInsights??[]});
function make({discoverRoots=true}={}){const value=createResources({storage:memory()});value.setCatalog(catalog);value.setFrontierGraph(graph);if(discoverRoots)for(const id of roots)value.discover(id);return value;}
function frontierRows(value,region){const discoveredIds=[...value.state.recipes],knownRecipeIds=[...new Set([...value.state.hints,...reserved])],candidates=getFrontierCandidates(graph,{discoveredIds,knownRecipeIds}),scored=scoreFrontierCandidates(graph,candidates,{discoveredIds,region});return {candidates,scored};}
function expandableChoice(value,region){
  const {candidates,scored}=frontierRows(value,region),frontierIds=new Set(candidates.map(row=>row.id));
  const target=scored.find(row=>row.directUndiscoveredNeighbors.some(id=>!reserved.has(id)&&!frontierIds.has(id)));
  assert.ok(target,`production graph needs an expandable ${region} frontier candidate for the integration regression`);
  const eligible=scored.filter(row=>Number.isFinite(row.weight)&&row.weight>0).sort((a,b)=>a.id.localeCompare(b.id)),total=eligible.reduce((sum,row)=>sum+row.weight,0),index=eligible.findIndex(row=>row.id===target.id),before=eligible.slice(0,index).reduce((sum,row)=>sum+row.weight,0),roll=(before+target.weight/2)/total;
  assert.equal(selectFrontierCandidate(scored,{rng:()=>roll})?.id,target.id);
  return {target,roll,frontierIds};
}

// Insight trigger eligibility opens with the same safe-window boundary that starts
// DUST EATER threat accumulation and requires run-local molecular sampling.
{
  assert.equal(FIELD_INSIGHT_MIN_SECONDS,EXPEDITION.safeSeconds,'insight timing follows the expedition safe-window boundary');
  const methane={id:'methane',atoms:['C','H','H','H','H']},oxygen={id:'oxygen',atoms:['O','O']},nitrogen={id:'nitrogen',atoms:['N','N']};
  assert.deepEqual(fieldInsightRequiredElements(methane),['C','H']);
  assert.equal(fieldInsightOpportunityEligibility({time:FIELD_INSIGHT_MIN_SECONDS-0.01,collectedElements:{H:1,C:1,O:0}},methane).ready,false,'elapsed time alone must not open early');
  assert.equal(fieldInsightOpportunityEligibility({time:FIELD_INSIGHT_MIN_SECONDS,collectedElements:{H:1,C:0,O:0}},methane).ready,false,'CH4 needs both H and C sampled in this run');
  assert.equal(fieldInsightOpportunityEligibility({time:FIELD_INSIGHT_MIN_SECONDS,collectedElements:{H:1,C:1,O:0}},methane).ready,true);
  assert.equal(fieldInsightOpportunityEligibility({time:FIELD_INSIGHT_MIN_SECONDS,collectedElements:{H:0,C:0,O:1}},oxygen).ready,true,'O2 only requires O sampling');
  assert.equal(fieldInsightOpportunityEligibility({time:FIELD_INSIGHT_MIN_SECONDS,collectedElements:{H:0,C:0,O:0}},nitrogen).ready,false,'non-HCO candidates still require real FIELD activity');
  assert.equal(fieldInsightOpportunityEligibility({time:FIELD_INSIGHT_MIN_SECONDS,collectedElements:{H:1,C:0,O:0}},nitrogen).ready,true,'non-HCO candidates fall back to any FIELD element instead of becoming impossible');
}

// Launch snapshots discovered/known state, delegates extraction/scoring/selection
// to the production graph frontier API, uses the canonical FIELD region and
// excludes critical/challenge-owned progression from ordinary graph insights.
{
  const value=make(),{target,roll}=expandableChoice(value,'oxygen');
  value.prepareExpedition({region:'oxygen',rng:()=>roll});
  const before=value.frontierInsightDiagnostics();
  assert.equal(before.selectedCandidateId,target.id);assert.equal(before.launchRegion,'oxygen');assert.equal(before.weightingRegion,'Oxygen');assert.ok(!reserved.has(before.selectedCandidateId));
  value.state.hints.push(target.id);
  assert.equal(value.frontierInsightDiagnostics().selectedCandidateId,target.id,'external knowledge changes must not redraw the run snapshot');
  const wrongRegion=value.signal('veil',0,0);assert.ok(wrongRegion.bonus);assert.equal(value.frontierInsightDiagnostics().opportunityCreated,false);
  const opportunity=value.signal('oxygen',.999,.999,{runContext:engaged});assert.deepEqual(opportunity,{recipe:target.id,frontier:true},'frontier selection must not be weighted a second time by regional signal choice/chance');assert.equal(value.frontierInsightDiagnostics().opportunityCreated,true);
}

// Crossing the authored signal before the gate opens records the observation but
// cannot start analysis. Once both elapsed-time and run-local action gates pass,
// the same one-run opportunity matures without requiring a second signal hit.
{
  const value=make(),{target,roll}=expandableChoice(value,'veil');value.prepareExpedition({region:'veil',rng:()=>roll});
  const early=value.signal('veil',.999,.999,{runContext:{time:2,collectedElements:{H:1,C:1,O:1}}});assert.deepEqual(early,{deferred:true,frontier:true});
  let diag=value.frontierInsightDiagnostics();assert.equal(diag.signalObserved,true);assert.equal(diag.opportunityCreated,false);
  assert.equal(value.pollFrontierInsight({time:FIELD_INSIGHT_MIN_SECONDS-0.01,collectedElements:{H:1,C:1,O:1}}),null,'time gate blocks deferred frontier');
  assert.equal(value.pollFrontierInsight({time:FIELD_INSIGHT_MIN_SECONDS,collectedElements:{H:0,C:0,O:0}}),null,'action gate blocks deferred frontier');
  const matured=value.pollFrontierInsight(engaged);assert.deepEqual(matured,{managed:true,recipe:target.id,frontier:true});diag=value.frontierInsightDiagnostics();assert.equal(diag.opportunityCreated,true);
  assert.equal(value.pollFrontierInsight(engaged),null,'deferred opportunity matures at most once');
}

// A frontier opportunity reuses the ordinary five-second analysis -> carried
// contract. Normal return commits only the carried idea as known recipe; it does
// not register/discover the molecule until CRAFT completes.
{
  const value=make(),{target,roll,frontierIds}=expandableChoice(value,'veil');value.prepareExpedition({region:'veil',rng:()=>roll});
  const opportunity=value.signal('veil',.999,.999,{runContext:engaged});assert.equal(opportunity.recipe,target.id);
  const flight=run(),started=triggerInsight(flight,opportunity.recipe,value.state);assert.deepEqual(started,{type:'insightAnalysisStart',id:target.id});advanceInsightAnalysis(flight,4.9);assert.deepEqual(flight.carriedInsights,[]);advanceInsightAnalysis(flight,.1);assert.deepEqual(flight.carriedInsights,[target.id]);
  const result=settle(value,flight);assert.deepEqual(result.committedInsights,[target.id]);assert.ok(value.state.hints.includes(target.id),'normal return makes the recipe known');assert.ok(!value.state.recipes.includes(target.id),'normal return must not register the molecule');assert.equal(result.frontierInsight.committed,true);assert.equal(result.frontierInsight.carried,true);

  value.prepareExpedition({region:'veil',rng:()=>roll});assert.notEqual(value.frontierInsightDiagnostics().selectedCandidateId,target.id,'known recipe is excluded on the next launch');
  const beforeCraft=new Set(frontierRows(value,'veil').candidates.map(row=>row.id));
  const crafted=value.discoverWithLoadout(target.id,null);assert.equal(crafted.learned,true);assert.ok(value.state.recipes.includes(target.id),'CRAFT completion promotes recipe knowledge to registered/discovered');
  const {candidates:afterCraft}=frontierRows(value,'veil'),newIds=afterCraft.filter(row=>!frontierIds.has(row.id)&&!beforeCraft.has(row.id));assert.ok(newIds.length>0,'CRAFT/registration expands the graph frontier through the crafted node');
  value.prepareExpedition({region:'veil',rng:()=>0});const next=value.frontierInsightDiagnostics().selectedCandidateId;assert.ok(next===null||afterCraft.some(row=>row.id===next));assert.notEqual(next,target.id);
}

// One expedition can create at most one graph opportunity. Repeated signal
// eligibility, deeper region movement and enough collection to clear signal
// cooldown cannot produce a second frontier recipe in the same run.
{
  const value=make(),{target,roll}=expandableChoice(value,'veil');value.prepareExpedition({region:'veil',rng:()=>roll});assert.equal(value.signal('veil',0,0,{runContext:engaged}).recipe,target.id);value.collect(45,0);
  const second=value.signal('veil',0,0);assert.ok(second.bonus&&!second.recipe);const moved=value.signal('carbon',0,0);assert.ok(moved.bonus&&!moved.recipe);const diag=value.frontierInsightDiagnostics();assert.equal(diag.selectedCandidateId,target.id);assert.equal(diag.opportunityCreated,true);
}

// Returning without touching the opportunity commits nothing. The launch-local
// reservation is not persistent knowledge and can be redrawn on a later run.
{
  const value=make(),{target,roll}=expandableChoice(value,'veil');value.prepareExpedition({region:'veil',rng:()=>roll});const result=settle(value,run());assert.deepEqual(result.committedInsights,[]);assert.ok(!value.state.hints.includes(target.id));assert.equal(result.frontierInsight.reason,'not-acquired');
  value.prepareExpedition({region:'veil',rng:()=>roll});assert.equal(value.frontierInsightDiagnostics().selectedCandidateId,target.id);
}

// Capture/forced return uses the existing settlement loss semantic: even a
// completed carried analysis is not committed and remains eligible next run.
{
  const value=make(),{target,roll}=expandableChoice(value,'veil');value.prepareExpedition({region:'veil',rng:()=>roll});const opportunity=value.signal('veil',0,0,{runContext:engaged}),flight=run();triggerInsight(flight,opportunity.recipe,value.state);advanceInsightAnalysis(flight,5);assert.deepEqual(flight.carriedInsights,[target.id]);
  const result=settle(value,flight,true);assert.deepEqual(result.committedInsights,[]);assert.ok(!value.state.hints.includes(target.id));assert.equal(result.frontierInsight.lost,true);assert.equal(result.frontierInsight.committed,false);
  value.prepareExpedition({region:'veil',rng:()=>roll});assert.equal(value.frontierInsightDiagnostics().selectedCandidateId,target.id);
}

// A pending critical progression insight suppresses Graph frontier for the
// entire run instead of competing with H2/CH4/O2/H2O ownership.
{
  const value=make({discoverRoots:false});value.state.elements.H=80;assert.ok(value.progressionInsightCandidates().includes('hydrogen'));value.prepareExpedition({region:'veil',rng:()=>0});const diag=value.frontierInsightDiagnostics();assert.equal(diag.reason,'critical-pending');assert.equal(diag.selectedCandidateId,null);const signal=value.signal('veil',0,0);assert.ok(signal.bonus&&!signal.recipe);
}

// A critical insight that becomes ready after launch still owns the run before
// the Graph opportunity is emitted. This closes the cargo/thermal readiness race.
{
  const value=make(),{target,roll}=expandableChoice(value,'oxygen');value.prepareExpedition({region:'oxygen',rng:()=>roll});assert.equal(value.frontierInsightDiagnostics().selectedCandidateId,target.id);
  value.state.progress.driveThermalInterruptions=2;const critical=value.progressionInsightCandidates({cargo:{H:8},foundElements:[]});assert.ok(critical.includes('water'),'water becomes critical-ready during the expedition');
  assert.equal(value.suppressFrontierInsightForCritical(),true);assert.equal(value.frontierInsightDiagnostics().reason,'critical-pending');const signal=value.signal('oxygen',0,0);assert.ok(signal.bonus&&!signal.recipe,'unspawned Graph opportunity stays suppressed once critical progression becomes ready');
}

// Graph visibility is broader than FIELD insight eligibility. A direct
// neighbor that requires an element not yet unlocked by registered-molecule
// progression stays visible in the Encyclopedia but cannot be selected as a
// FIELD idea until that element unlocks. Regression: CH3F must wait for F.
{
  const value=make({discoverRoots:false});
  value.setCatalog([{id:'fluoromethane',formula:'CH3F',atoms:['C','H','H','H','F']}]);
  value.state.progress.foundElements=['H','C','O'];
  value.state.recipes=['methane'];
  value.state.hints=graph.nodes.map(node=>node.id).filter(id=>id!=='fluoromethane');
  value.prepareExpedition({region:'veil',rng:()=>0});
  let diag=value.frontierInsightDiagnostics();assert.equal(diag.selectedCandidateId,null);assert.equal(diag.reason,'element-locked','F-containing frontier stays ineligible before the 15-registration F unlock');
  const fillers=graph.nodes.map(node=>node.id).filter(id=>id!=='methane'&&id!=='fluoromethane').slice(0,14);
  value.state.recipes=['methane',...fillers];
  value.prepareExpedition({region:'veil',rng:()=>0});
  diag=value.frontierInsightDiagnostics();assert.equal(diag.selectedCandidateId,'fluoromethane','the same graph frontier becomes eligible once F is unlocked');
}

// Empty frontier is a normal FIELD run: no DB-wide or legacy regional recipe
// fallback is allowed once an expedition frontier snapshot exists.
{
  const value=make({discoverRoots:false});value.state.recipes.push(...graph.nodes.map(node=>node.id));value.state.hints.push(...graph.nodes.map(node=>node.id));value.prepareExpedition({region:'frontier',rng:()=>0});const diag=value.frontierInsightDiagnostics();assert.equal(diag.reason,'no-candidate');assert.equal(diag.selectedCandidateId,null);const signal=value.signal('frontier',0,0);assert.ok(signal.bonus&&!signal.recipe);
}

// Settlement is idempotent at the persistent knowledge boundary. A repeated
// return callback cannot commit the same frontier insight twice.
{
  const value=make(),{target,roll}=expandableChoice(value,'veil');value.prepareExpedition({region:'veil',rng:()=>roll});const opportunity=value.signal('veil',0,0,{runContext:engaged}),flight=run();triggerInsight(flight,opportunity.recipe,value.state);advanceInsightAnalysis(flight,5);const first=settle(value,flight),second=settle(value,flight);assert.deepEqual(first.committedInsights,[target.id]);assert.deepEqual(second.committedInsights,[]);assert.equal(value.state.hints.filter(id=>id===target.id).length,1);
}

const uiSource=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');
assert.match(uiSource,/fieldInsightOpportunityEligibility\(run,resources\.record\(id\)\)\.ready/,'critical insights must use the run engagement gate');
assert.match(uiSource,/runContext:run/,'FIELD signals must pass current-run time and collection context');
assert.match(uiSource,/pollFrontierInsight\(run\)/,'deferred frontier observations must mature from the live run context');

console.log('FIELD frontier insight integration passed: production graph selection, one-run signal guard, ordinary analysis/carried lifecycle, return commit/loss, critical priority, no fallback and CRAFT frontier expansion.');
