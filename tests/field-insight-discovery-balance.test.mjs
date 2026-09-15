import assert from 'node:assert/strict';
import {FRONTIER_WEIGHTING,scoreFrontierCandidates} from '../src/molecule-frontier.js';
import {createResources} from '../src/veil/resources.js';
import {INSIGHT_SITE_BALANCE,INSIGHT_SITE_POOLS,fieldInsightSiteDiagnostics,syncFieldInsightMarkerClaimability} from '../src/veil/signal-claimability.js';
import {makeGraph} from './molecule-frontier-fixtures.mjs';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const records=[
  {id:'root',atoms:['H']},{id:'sibling-a',atoms:['H','H']},{id:'sibling-b',atoms:['H','H','H']},{id:'sibling-c',atoms:['H','H','H','H']},{id:'deep-child',atoms:['H','H','H']},{id:'locked-f',atoms:['H','F']},
];
const graph=makeGraph({nodes:[
  {id:'root',depth:0,branches:['root'],affinities:'H1'},
  {id:'sibling-a',depth:1,branches:['a'],affinities:'H1'},
  {id:'sibling-b',depth:1,branches:['b'],affinities:'C1'},
  {id:'sibling-c',depth:1,branches:['c'],affinities:'O1'},
  {id:'deep-child',depth:2,branches:['a'],affinities:'H1'},
  {id:'hydrogen',depth:1,branches:['critical'],affinities:'H1'},
  {id:'locked-f',depth:1,branches:['locked'],affinities:'H1'},
],edges:[['root','sibling-a'],['root','sibling-b'],['root','sibling-c'],['sibling-a','deep-child'],['root','hydrogen'],['root','locked-f']],roots:['root']});

function makeResources(){
  const value=createResources({storage:memory()});value.setCatalog(records);Object.assign(value.state.progress,{regions:['veil','carbon','oxygen'],checkpoint:'veil',foundElements:['H','C','O']});value.state.recipes=['root'];value.state.hints=[];Object.assign(value.state.elements,{H:0,C:0,O:0,F:0});value.setFrontierGraph(graph);return value;
}
const settle=(value,{captured=false,insights=[]}={})=>value.settleExpedition({H:0,C:0,N:0,O:0},0,captured,{insights});

// Weighting remains multiplicative and adds only soft gameplay/simplicity/craftability factors.
{
  assert.deepEqual(FRONTIER_WEIGHTING,{baseWeight:1,shallowBonus:.16,unexploredBranchBonus:.28,regionAffinityBonus:.25,gameplayUtilityBonus:.55,structuralSimplicityBonus:.36,craftableNowBonus:.08});
  const candidates=[
    {id:'sibling-a',depth:1,branchKeys:['a'],regionAffinities:{Hydrogen:1},baseWeight:1,gameplayUtility:0,structuralSimplicity:0,craftableNow:false},
    {id:'sibling-b',depth:1,branchKeys:['b'],regionAffinities:{Hydrogen:1},baseWeight:1,gameplayUtility:1,structuralSimplicity:1,craftableNow:true},
  ];
  const scored=scoreFrontierCandidates(graph,candidates,{discoveredIds:['root'],region:null}),plain=scored.find(row=>row.id==='sibling-a'),favored=scored.find(row=>row.id==='sibling-b');
  assert(favored.weight>plain.weight);assert.equal(favored.weighting.gameplayUtility.factor,1.55);assert.equal(favored.weighting.structuralSimplicity.factor,1.36);assert.equal(favored.weighting.craftableNow.factor,1.08);
}

// Persistent Seed hard prerequisites and launch/return stability.
{
  const value=makeResources(),initial=value.insightSeedDiagnostics();assert.ok(['sibling-a','sibling-b','sibling-c'].includes(initial.seedId));assert.ok(['veil','carbon','oxygen'].includes(initial.hotDestination));assert.equal(initial.blocked,false);
  assert.notEqual(initial.seedId,'hydrogen','critical IDs are reserved');assert.notEqual(initial.seedId,'locked-f','element-locked candidates are excluded');
  const seed=initial.seedId,hot=initial.hotDestination;
  for(let i=0;i<3;i++){value.prepareExpedition({region:hot,rng:()=>i/3});assert.equal(value.frontierInsightDiagnostics().selectedCandidateId,seed);const result=settle(value);assert.equal(result.frontierInsight.seedMaintained,true);assert.equal(value.insightSeedDiagnostics().seedId,seed);}

  value.prepareExpedition({region:hot});const runContext={time:35,frontierInsightSiteManaged:true,frontierInsightSiteReady:true,frontierInsightActiveRoll:.123,frontierInsightActiveChoice:.456,analysis:null,carriedInsights:[]};
  const opportunity=value.signal(hot,.123,.456,{runContext,claimableOnly:true});assert.equal(opportunity.recipe,seed);const forced=settle(value,{captured:true});assert.equal(forced.frontierInsight.lost,true);assert.equal(forced.frontierInsight.seedMaintained,true);assert.equal(value.insightSeedDiagnostics().seedId,seed);

  value.prepareExpedition({region:hot});const incomplete=value.signal(hot,.223,.556,{runContext:{...runContext,frontierInsightActiveRoll:.223,frontierInsightActiveChoice:.556},claimableOnly:true});assert.equal(incomplete.recipe,seed);const incompleteResult=settle(value);assert.equal(incompleteResult.frontierInsight.reason,'analysis-incomplete');assert.equal(value.insightSeedDiagnostics().seedId,seed);

  value.prepareExpedition({region:hot});const complete=value.signal(hot,.323,.656,{runContext:{...runContext,frontierInsightActiveRoll:.323,frontierInsightActiveChoice:.656},claimableOnly:true});assert.equal(complete.recipe,seed);const normal=settle(value,{insights:[seed]});assert.ok(normal.committedInsights.includes(seed));assert.ok(value.state.hints.includes(seed));assert.equal(normal.frontierInsight.seedAdvanced,true);assert.notEqual(value.insightSeedDiagnostics().seedId,seed);
}

// Backlog can fan out sideways, but a hinted molecule cannot unlock its child until crafted.
{
  const value=makeResources(),seen=[];
  while(value.insightSeedDiagnostics().seedId){
    const seed=value.insightSeedDiagnostics().seedId;if(seed==='deep-child')break;seen.push(seed);const hot=value.insightSeedDiagnostics().hotDestination;value.prepareExpedition({region:hot});const runContext={time:40,frontierInsightSiteManaged:true,frontierInsightSiteReady:true,frontierInsightActiveRoll:.4,frontierInsightActiveChoice:.6,analysis:null,carriedInsights:[]};assert.equal(value.signal(hot,.4,.6,{runContext,claimableOnly:true}).recipe,seed);settle(value,{insights:[seed]});if(seen.length>4)break;
  }
  assert.equal(seen.includes('deep-child'),false,'hint-only parent must not open graph depth');assert.ok(seen.length>=2,'multiple sibling hints can accumulate');assert.equal(value.state.hints.filter(id=>seen.includes(id)).length,seen.length);assert.ok(value.state.hints.length>=seen.length,'there is no arbitrary hint cap');
  assert.ok(value.state.hints.includes('sibling-a'));value.discoverWithLoadout('sibling-a');const afterCraft=value.insightSeedDiagnostics().seedId;assert.equal(afterCraft,'deep-child','crafting the hinted parent opens its next graph depth once siblings are exhausted');
}

function signal(id,region,x,y){return {id,region,x,y,anchorX:x,anchorY:y,ready:false,roll:.21+(x%7)/100,choice:.61+(Math.abs(y)%7)/100,claimable:false};}
function fakeRun(seed=91){return {time:0,map:{seed,universe:true,signals:[signal('veil','veil',390,-650),signal('carbon','carbon',840,-5660),signal('oxygen-network','oxygen',520,-9250),signal('oxygen-deep','oxygen',-280,-11100),signal('oxygen-frontier','frontier',100,-11620)]},player:{x:0,y:210,vx:0,vy:-100,angle:-Math.PI/2},config:{bounds:{left:-1400,right:1400,top:-13000,bottom:600}},region:'veil',eaters:[],captured:false,analysis:null,carriedInsights:[],insightEngagementMaxDistance:0};}
const evaluator=run=>signalRow=>{
  const active=run.frontierInsightSiteReady===true&&signalRow.roll===run.frontierInsightActiveRoll&&signalRow.choice===run.frontierInsightActiveChoice;
  return {managed:true,frontier:true,seedId:'sibling-a',hotDestination:'veil',activeForRun:true,claimable:active,recipe:active?'sibling-a':null};
};

// Site pools preserve authored canonical points, add reusable CHO geography, and leave N empty for later registration.
{
  assert.equal(INSIGHT_SITE_POOLS.veil.find(row=>row.canonicalSignalId==='veil').x,390);assert.equal(INSIGHT_SITE_POOLS.carbon.find(row=>row.canonicalSignalId==='carbon').y,-5660);assert.equal(INSIGHT_SITE_POOLS.oxygen.filter(row=>row.canonicalSignalId).length,3);assert.deepEqual(INSIGHT_SITE_POOLS.nitrogen,[]);
}

// Early activation is seeded at run start, never available at launch, and deterministic for identical run/seed.
{
  const a=fakeRun(400),b=fakeRun(400),c=fakeRun(401);syncFieldInsightMarkerClaimability(a,evaluator(a));syncFieldInsightMarkerClaimability(b,evaluator(b));syncFieldInsightMarkerClaimability(c,evaluator(c));
  const da=fieldInsightSiteDiagnostics(a),db=fieldInsightSiteDiagnostics(b),dc=fieldInsightSiteDiagnostics(c);assert.equal(a.map.signals.some(row=>row.claimable),false);assert.deepEqual({earlyEnabled:da.earlyEnabled,earlyActivationTime:da.earlyActivationTime,earlyMinimumTravel:da.earlyMinimumTravel},{earlyEnabled:db.earlyEnabled,earlyActivationTime:db.earlyActivationTime,earlyMinimumTravel:db.earlyMinimumTravel});assert.notDeepEqual({earlyEnabled:da.earlyEnabled,earlyActivationTime:da.earlyActivationTime,earlyMinimumTravel:da.earlyMinimumTravel},{earlyEnabled:dc.earlyEnabled,earlyActivationTime:dc.earlyActivationTime,earlyMinimumTravel:dc.earlyMinimumTravel});
  a.frontierInsightPlan.earlyEnabled=true;a.time=a.frontierInsightPlan.earlyActivationTime;a.insightEngagementMaxDistance=a.frontierInsightPlan.earlyMinimumTravel;syncFieldInsightMarkerClaimability(a,evaluator(a));assert.equal(a.map.signals.filter(row=>row.claimable).length,1);assert.equal(fieldInsightSiteDiagnostics(a).phase,'early');
}

// Rescue begins from the first actual Eater spawn + grace, not warning/threat state, and re-arms geographically after a miss.
{
  const run=fakeRun(700);syncFieldInsightMarkerClaimability(run,evaluator(run));run.frontierInsightPlan.earlyEnabled=false;run.threat=999;run.danger='warning';run.time=50;syncFieldInsightMarkerClaimability(run,evaluator(run));assert.equal(fieldInsightSiteDiagnostics(run).rescueEntered,false,'warning alone cannot start rescue');
  run.eaters.push({x:1000,y:1000});syncFieldInsightMarkerClaimability(run,evaluator(run));const first=fieldInsightSiteDiagnostics(run).firstEaterSpawnTime;assert.equal(first,50);run.time=first+INSIGHT_SITE_BALANCE.rescueGraceSeconds-.01;syncFieldInsightMarkerClaimability(run,evaluator(run));assert.equal(fieldInsightSiteDiagnostics(run).rescueEntered,false);run.time=first+INSIGHT_SITE_BALANCE.rescueGraceSeconds;syncFieldInsightMarkerClaimability(run,evaluator(run));let diag=fieldInsightSiteDiagnostics(run);assert.equal(diag.rescueEntered,true);assert.ok(diag.activeSiteId);assert.equal(run.map.signals.filter(row=>row.claimable).length,1);
  const oldId=diag.activeSiteId,active=run.map.signals.find(row=>row.insightSiteId===oldId);Object.assign(run.player,{x:active.x,y:active.y});syncFieldInsightMarkerClaimability(run,evaluator(run));const fixed={x:active.x,y:active.y};run.time+=INSIGHT_SITE_BALANCE.rearmMinimumSeconds+.1;Object.assign(run.player,{x:active.x+620,y:active.y-620,vy:-100,vx:0});syncFieldInsightMarkerClaimability(run,evaluator(run));diag=fieldInsightSiteDiagnostics(run);assert.equal(diag.rearmCount,1);assert.notEqual(diag.activeSiteId,oldId);assert.deepEqual({x:active.x,y:active.y},fixed,'marker itself never follows the player');assert.equal(run.map.signals.filter(row=>row.claimable).length,1,'re-arm moves the same opportunity rather than adding another');
  const acquired=run.map.signals.find(row=>row.insightSiteId===diag.activeSiteId);acquired.ready=true;run.time+=.1;syncFieldInsightMarkerClaimability(run,evaluator(run));diag=fieldInsightSiteDiagnostics(run);assert.equal(diag.phase,'acquired');assert.equal(diag.activeSiteId,null);const count=diag.rearmCount;run.time+=20;syncFieldInsightMarkerClaimability(run,evaluator(run));assert.equal(fieldInsightSiteDiagnostics(run).rearmCount,count,'acquired opportunity never re-arms');
}

// Critical claimability wins without moving its fixed signal into the ordinary site pool.
{
  const run=fakeRun(900),nitrogen=signal('nitrogen-critical-fixed','nitrogen',40,-12500);run.map.signals.push(nitrogen);const evaluate=row=>row===nitrogen?{claimable:true,recipe:'nitrogen',critical:true}:{managed:true,frontier:true,seedId:'sibling-a',hotDestination:'veil',activeForRun:true,claimable:false,recipe:null};syncFieldInsightMarkerClaimability(run,evaluate);assert.equal(nitrogen.claimable,true);assert.notEqual(nitrogen.insightSite,true);assert.equal(run.frontierInsightPlan,undefined,'critical opportunity takes precedence over ordinary planning on that sync');
}

console.log('FIELD Insight persistent Seed, weighting, early/rescue/re-arm and Critical protection regressions passed.');
