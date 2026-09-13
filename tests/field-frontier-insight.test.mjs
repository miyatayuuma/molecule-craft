import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMoleculeGraph,getFrontierCandidates,scoreFrontierCandidates,selectFrontierCandidate} from '../src/molecule-graph.js';
import {CHALLENGE_INSIGHT_IDS} from '../src/veil/expedition-challenges.js';
import {CRITICAL_INSIGHT_IDS,advanceInsightAnalysis,createInsightRunState,triggerInsight} from '../src/veil/insights.js';
import {createResources} from '../src/veil/resources.js';

const raw=JSON.parse(await readFile(new URL('../data/molecule-graph.json',import.meta.url),'utf8'));
const graph=createMoleculeGraph(raw),reserved=new Set([...CRITICAL_INSIGHT_IDS,...CHALLENGE_INSIGHT_IDS]);
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const catalog=graph.nodes.map(node=>({id:node.id,formula:node.id,atoms:['H']}));
const roots=graph.roots.filter(id=>graph.nodeById(id));
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
  const opportunity=value.signal('oxygen',.999,.999);assert.deepEqual(opportunity,{recipe:target.id,frontier:true},'frontier selection must not be weighted a second time by regional signal choice/chance');assert.equal(value.frontierInsightDiagnostics().opportunityCreated,true);
}

// A frontier opportunity reuses the ordinary five-second analysis -> carried
// contract. Normal return commits only the carried idea as known recipe; it does
// not register/discover the molecule until CRAFT completes.
{
  const value=make(),{target,roll,frontierIds}=expandableChoice(value,'veil');value.prepareExpedition({region:'veil',rng:()=>roll});
  const opportunity=value.signal('veil',.999,.999);assert.equal(opportunity.recipe,target.id);
  const flight=run(),started=triggerInsight(flight,opportunity.recipe,value.state);assert.deepEqual(started,{type:'insightAnalysisStart',id:target.id});advanceInsightAnalysis(flight,4.9);assert.deepEqual(flight.carriedInsights,[]);advanceInsightAnalysis(flight,.1);assert.deepEqual(flight.carriedInsights,[target.id]);
  const result=settle(value,flight);assert.deepEqual(result.committedInsights,[target.id]);assert.ok(value.state.hints.includes(target.id),'normal return makes the recipe known');assert.ok(!value.state.recipes.includes(target.id),'normal return must not register the molecule');assert.equal(result.frontierInsight.committed,true);assert.equal(result.frontierInsight.carried,true);

  value.prepareExpedition({region:'veil',rng:()=>roll});assert.notEqual(value.frontierInsightDiagnostics().selectedCandidateId,target.id,'known recipe is excluded on the next launch');
  const beforeCraft=new Set(frontierRows(value,'veil').candidates.map(row=>row.id));
  const crafted=value.discoverWithLoadout(target.id,null);assert.equal(crafted.learned,true);assert.ok(value.state.recipes.includes(target.id),'CRAFT completion promotes recipe knowledge to registered/discovered');
  const afterCraft=frontierRows(value,'veil').candidates,newIds=afterCraft.candidates.filter(row=>!frontierIds.has(row.id)&&!beforeCraft.has(row.id));assert.ok(newIds.length>0,'CRAFT/registration expands the graph frontier through the crafted node');
  value.prepareExpedition({region:'veil',rng:()=>0});const next=value.frontierInsightDiagnostics().selectedCandidateId;assert.ok(next===null||afterCraft.candidates.some(row=>row.id===next));assert.notEqual(next,target.id);
}

// One expedition can create at most one graph opportunity. Repeated signal
// eligibility, deeper region movement and enough collection to clear signal
// cooldown cannot produce a second frontier recipe in the same run.
{
  const value=make(),{target,roll}=expandableChoice(value,'veil');value.prepareExpedition({region:'veil',rng:()=>roll});assert.equal(value.signal('veil',0,0).recipe,target.id);value.collect(45,0);
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
  const value=make(),{target,roll}=expandableChoice(value,'veil');value.prepareExpedition({region:'veil',rng:()=>roll});const opportunity=value.signal('veil',0,0),flight=run();triggerInsight(flight,opportunity.recipe,value.state);advanceInsightAnalysis(flight,5);assert.deepEqual(flight.carriedInsights,[target.id]);
  const result=settle(value,flight,true);assert.deepEqual(result.committedInsights,[]);assert.ok(!value.state.hints.includes(target.id));assert.equal(result.frontierInsight.lost,true);assert.equal(result.frontierInsight.committed,false);
  value.prepareExpedition({region:'veil',rng:()=>roll});assert.equal(value.frontierInsightDiagnostics().selectedCandidateId,target.id);
}

// A pending critical progression insight suppresses Graph frontier for the
// entire run instead of competing with H2/CH4/O2/H2O ownership.
{
  const value=make({discoverRoots:false});value.state.elements.H=80;assert.ok(value.progressionInsightCandidates().includes('hydrogen'));value.prepareExpedition({region:'veil',rng:()=>0});const diag=value.frontierInsightDiagnostics();assert.equal(diag.reason,'critical-pending');assert.equal(diag.selectedCandidateId,null);const signal=value.signal('veil',0,0);assert.ok(signal.bonus&&!signal.recipe);
}

// Empty frontier is a normal FIELD run: no DB-wide or legacy regional recipe
// fallback is allowed once an expedition frontier snapshot exists.
{
  const value=make({discoverRoots:false});value.state.recipes.push(...graph.nodes.map(node=>node.id));value.state.hints.push(...graph.nodes.map(node=>node.id));value.prepareExpedition({region:'frontier',rng:()=>0});const diag=value.frontierInsightDiagnostics();assert.equal(diag.reason,'no-candidate');assert.equal(diag.selectedCandidateId,null);const signal=value.signal('frontier',0,0);assert.ok(signal.bonus&&!signal.recipe);
}

// Settlement is idempotent at the persistent knowledge boundary. A repeated
// return callback cannot commit the same frontier insight twice.
{
  const value=make(),{target,roll}=expandableChoice(value,'veil');value.prepareExpedition({region:'veil',rng:()=>roll});const opportunity=value.signal('veil',0,0),flight=run();triggerInsight(flight,opportunity.recipe,value.state);advanceInsightAnalysis(flight,5);const first=settle(value,flight),second=settle(value,flight);assert.deepEqual(first.committedInsights,[target.id]);assert.deepEqual(second.committedInsights,[]);assert.equal(value.state.hints.filter(id=>id===target.id).length,1);
}

console.log('FIELD frontier insight integration passed: production graph selection, one-run signal guard, ordinary analysis/carried lifecycle, return commit/loss, critical priority, no fallback and CRAFT frontier expansion.');
