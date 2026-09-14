import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMoleculeGraph,getFrontierCandidates} from '../src/molecule-graph.js';
import {createInsightRunState,FIELD_INSIGHT_MIN_DISTANCE,FIELD_INSIGHT_MIN_SECONDS,triggerInsight} from '../src/veil/insights.js';
import {createResources,insightRecipeElementEligible} from '../src/veil/resources.js';
import {syncFieldInsightMarkerClaimability} from '../src/veil/signal-claimability.js';
import {NITROGEN_MOLECULE_ID} from '../src/veil/nitrogen-progression.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const database=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const rawGraph=JSON.parse(await readFile(new URL('../data/molecule-graph.json',import.meta.url),'utf8')),graph=createMoleculeGraph(rawGraph);
const record=id=>database.find(row=>row.id===id);
const make=()=>{const value=createResources({storage:memory()});value.setCatalog(database);value.setFrontierGraph(graph);return value;};
const engagedRun=(overrides={})=>Object.assign({},createInsightRunState(),{captured:false,region:'carbon',time:FIELD_INSIGHT_MIN_SECONDS+1,insightEngagementSatisfied:true,insightEngagementMaxDistance:FIELD_INSIGHT_MIN_DISTANCE+1,player:{x:0,y:0},collectedElements:{H:0,C:0,N:0,O:0},map:{signals:[]},events:[]},overrides);

// HCl is a direct Hydrogen neighbor, but Cl remains locked by canonical gameplay authority.
{
  const hcl='hydrogen-chloride',direct=getFrontierCandidates(graph,{discoveredIds:['hydrogen'],knownRecipeIds:[]});assert.ok(direct.some(row=>row.id===hcl),'production graph must keep HCl directly adjacent to H2');
  const value=make();value.state.recipes=['hydrogen'];value.state.hints=direct.map(row=>row.id).filter(id=>id!==hcl);value.prepareExpedition({region:'veil',rng:()=>0});const diag=value.frontierInsightDiagnostics();assert.equal(value.canUseElement('Cl'),false);assert.equal(diag.selectedCandidateId,null);assert.equal(diag.reason,'element-locked');
}

// The same generic element predicate protects representative S/P/F records and automatically opens when canonical access opens in a future progression.
for(const element of ['Cl','S','P','F']){
  const sample=database.find(row=>Array.isArray(row.atoms)&&row.atoms.includes(element));assert.ok(sample,`catalog needs a ${element} representative`);
  assert.equal(insightRecipeElementEligible(sample,{canUseElement:el=>['H','C','O'].includes(el)}),false,`${element} locked => no ordinary FIELD Insight`);
  assert.equal(insightRecipeElementEligible(sample,{canUseElement:()=>true}),true,`${element} accessible => the same candidate contract naturally opens`);
}

// Existing stale hints are sanitized at catalog load and new locked-element hints fail closed.
{
  const value=createResources({storage:memory()});value.state.hints.push('hydrogen-chloride');value.setCatalog(database);assert.ok(!value.state.hints.includes('hydrogen-chloride'));assert.equal(value.hint('hydrogen-chloride'),false);
}

// Marker state is presentation-only: no claim => no marker; one nearest claim => exactly one visible marker; active/acquired insight hides all.
{
  const run=engagedRun({map:{signals:[{id:'a',region:'carbon',x:40,y:0,ready:false,roll:.1,choice:.1},{id:'b',region:'carbon',x:10,y:0,ready:false,roll:.2,choice:.2}]}});
  assert.equal(syncFieldInsightMarkerClaimability(run,()=>({claimable:false,recipe:null})),null);assert.ok(run.map.signals.every(signal=>signal.claimable===false));
  const selected=syncFieldInsightMarkerClaimability(run,signal=>({claimable:true,recipe:signal.id==='a'?'ethane':'propane'}));assert.equal(selected.signal.id,'b');assert.equal(run.map.signals.filter(signal=>signal.claimable).length,1);
  run.analysis={id:'ethane'};assert.equal(syncFieldInsightMarkerClaimability(run,()=>({claimable:true,recipe:'ethane'})),null);assert.ok(run.map.signals.every(signal=>!signal.claimable));run.analysis=null;run.carriedInsights=['ethane'];syncFieldInsightMarkerClaimability(run,()=>({claimable:true,recipe:'propane'}));assert.ok(run.map.signals.every(signal=>!signal.claimable));
}

// A production Graph marker becomes visible only after engagement; pickup through claimableOnly always yields a recipe and a valid analysis transition.
{
  const value=make();value.state.recipes=['methane'];value.findElementForExpedition('C');value.prepareExpedition({region:'carbon',rng:()=>0});const selected=value.frontierInsightDiagnostics().selectedCandidateId;assert.ok(selected,'carbon run needs an eligible ordinary frontier candidate');
  const signal={id:'ordinary',region:'carbon',x:0,y:0,ready:false,roll:.1,choice:.1},early=engagedRun({time:1,insightEngagementSatisfied:false,insightEngagementMaxDistance:FIELD_INSIGHT_MIN_DISTANCE+10,map:{signals:[signal]}});
  syncFieldInsightMarkerClaimability(early,item=>value.signalClaimability(item.region,item.roll,item.choice,{runContext:early}));assert.equal(signal.claimable,false);
  const run=engagedRun({map:{signals:[signal]}});const marker=syncFieldInsightMarkerClaimability(run,item=>value.signalClaimability(item.region,item.roll,item.choice,{runContext:run}));assert.equal(marker?.claim.recipe,selected);assert.equal(signal.claimable,true);
  const result=value.signal(signal.region,signal.roll,signal.choice,{runContext:run,claimableOnly:true});assert.equal(result.recipe,selected);const event=triggerInsight(run,result.recipe,value.state);assert.deepEqual(event,{type:'insightAnalysisStart',id:selected});syncFieldInsightMarkerClaimability(run,item=>value.signalClaimability(item.region,item.roll,item.choice,{runContext:run}));assert.equal(signal.claimable,false,'one active Insight prevents a second active marker');
}

// N2 ignores persistent N discovery and keys only from current-run N pickup + engagement.
{
  const value=make();value.state.progress.choCompleted=true;value.findElementForExpedition('N');value.prepareExpedition({region:'nitrogen',rng:()=>0});
  const signal={id:'n2',region:'nitrogen',x:0,y:0,ready:false,roll:.11,choice:.23};
  const noPickup=engagedRun({region:'nitrogen',collectedElements:{H:0,C:0,N:0,O:0},map:{signals:[signal]}});assert.equal(value.signalClaimability('nitrogen',.11,.23,{runContext:noPickup}).claimable,false);syncFieldInsightMarkerClaimability(noPickup,item=>value.signalClaimability(item.region,item.roll,item.choice,{runContext:noPickup}));assert.equal(signal.claimable,false);
  const notEngaged=engagedRun({region:'nitrogen',insightEngagementSatisfied:false,collectedElements:{H:0,C:0,N:1,O:0},map:{signals:[signal]}});assert.equal(value.signalClaimability('nitrogen',.11,.23,{runContext:notEngaged}).claimable,false);
  const run=engagedRun({region:'nitrogen',collectedElements:{H:0,C:0,N:1,O:0},map:{signals:[signal]}});const claim=value.signalClaimability('nitrogen',.11,.23,{runContext:run});assert.deepEqual(claim,{claimable:true,recipe:NITROGEN_MOLECULE_ID,critical:true});syncFieldInsightMarkerClaimability(run,item=>value.signalClaimability(item.region,item.roll,item.choice,{runContext:run}));assert.equal(signal.claimable,true);const result=value.signal('nitrogen',.11,.23,{runContext:run,claimableOnly:true});assert.equal(result.recipe,NITROGEN_MOLECULE_ID);const event=triggerInsight(run,result.recipe,value.state);assert.equal(event?.critical,true);assert.deepEqual(run.carriedInsights,[NITROGEN_MOLECULE_ID]);syncFieldInsightMarkerClaimability(run,()=>claim);assert.equal(signal.claimable,false);
}

const renderer=await readFile(new URL('../src/veil/renderer.js',import.meta.url),'utf8'),universe=await readFile(new URL('../src/veil/universe.js',import.meta.url),'utf8'),ui=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');
assert.match(renderer,/!signal\.ready&&signal\.claimable===true/,'yellow marker renderer is claimability-gated');
assert.match(universe,/!signal\.ready&&signal\.claimable===true&&Math\.hypot/,'signal collision is claimability-gated');
assert.match(ui,/claimableOnly:true/,'visible marker pickup fails closed instead of falling back to a no-op or material bonus');
console.log('Insight claimability consistency passed: canonical element eligibility, stale-hint cleanup, current-run N2 pickup gate, hidden non-claimable markers, valid visible pickups and one-Insight marker suppression.');
