import {readFile,writeFile} from 'node:fs/promises';

async function replaceOnce(path,from,to){
  const source=await readFile(path,'utf8');
  if(!source.includes(from))throw new Error(`Expected patch target missing in ${path}`);
  if(source.indexOf(from)!==source.lastIndexOf(from))throw new Error(`Patch target is not unique in ${path}`);
  await writeFile(path,source.replace(from,to));
}

await replaceOnce('src/veil/ui.js',
  "import { createRun, stepRun, beginBurst, setCombustionHeld, triggerInsight, discardActiveInsight, discardRunInsights, fieldInsightOpportunityEligibility } from './expedition-run.js';",
  "import { createRun, stepRun, beginBurst, setCombustionHeld, triggerInsight, discardActiveInsight, discardRunInsights } from './expedition-run.js';"
);
await replaceOnce('src/veil/ui.js',
  "function offerProgressionInsights(){if(!run)return;const ids=resources.progressionInsightCandidates({cargo:run.collectedElements,foundElements:run.foundElements}).filter(id=>!run.carriedInsights.includes(id)&&run.analysis?.id!==id&&fieldInsightOpportunityEligibility(run,resources.record(id)).ready);if(ids.length)resources.suppressFrontierInsightForCritical();for(const id of ids)offerInsight(id);}",
  "function offerProgressionInsights(){if(!run)return;const ids=resources.progressionInsightCandidates({cargo:run.collectedElements,foundElements:run.foundElements}).filter(id=>!run.carriedInsights.includes(id)&&run.analysis?.id!==id);if(ids.length)resources.suppressFrontierInsightForCritical();for(const id of ids)offerInsight(id);}"
);

await replaceOnce('src/veil/resources.js',
`  function pollFrontierInsight(runContext={}){
    if(!frontierRun?.signalObserved||frontierRun.reason||frontierRun.opportunityCreated)return null;
    if(!frontierInsightEligibility(runContext).ready)return null;
    return createFrontierOpportunity();
  }`,
`  function pollFrontierInsight(runContext={}){
    if(!frontierRun?.signalObserved||frontierRun.reason||frontierRun.opportunityCreated)return null;
    if(!frontierInsightEligibility(runContext).ready)return null;
    const opportunity=createFrontierOpportunity();
    if(opportunity){const p=state.progress;p.signalMisses=0;p.signalLast[frontierRun.launchRegion]=p.totalCollected;save();}
    return opportunity;
  }`
);
await replaceOnce('src/veil/resources.js',
  "if(frontier.deferred){p.signalMisses=0;p.signalLast[region]=p.totalCollected;save();return {deferred:true,frontier:true};}",
  "if(frontier.deferred)return {deferred:true,frontier:true};"
);

await replaceOnce('tests/field-frontier-insight.test.mjs',
  "import {CRITICAL_INSIGHT_IDS,FIELD_INSIGHT_MIN_SECONDS,advanceInsightAnalysis,createInsightRunState,fieldInsightOpportunityEligibility,fieldInsightRequiredElements,triggerInsight} from '../src/veil/insights.js';",
  "import {CRITICAL_INSIGHT_IDS,FIELD_INSIGHT_MIN_DISTANCE,FIELD_INSIGHT_MIN_SECONDS,advanceInsightAnalysis,createInsightRunState,ensureInsightEngagementOrigin,fieldInsightOpportunityEligibility,triggerInsight,updateInsightEngagement} from '../src/veil/insights.js';"
);
await replaceOnce('tests/field-frontier-insight.test.mjs',
  "const engaged={time:EXPEDITION.safeSeconds,collectedElements:{H:1,C:1,O:1}};",
`function engagement({time=FIELD_INSIGHT_MIN_SECONDS,distance=FIELD_INSIGHT_MIN_DISTANCE}={}){const value=Object.assign({time:0,player:{x:0,y:0}},createInsightRunState());ensureInsightEngagementOrigin(value);value.time=time;value.player.y=-distance;updateInsightEngagement(value);return value;}
const engaged=engagement();`
);
await replaceOnce('tests/field-frontier-insight.test.mjs',
`// Insight trigger eligibility opens with the same safe-window boundary that starts
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
}`,
`// Ordinary Graph insight eligibility requires both simulation time and real
// world-space displacement from the fixed launch origin, then latches for the run.
{
  assert.equal(FIELD_INSIGHT_MIN_SECONDS,EXPEDITION.safeSeconds,'insight timing keeps the established 20-second lower bound');
  assert.equal(FIELD_INSIGHT_MIN_DISTANCE,1200,'engagement distance reaches the first authored route split instead of launch jitter');
  const timeOnly=engagement({time:FIELD_INSIGHT_MIN_SECONDS,distance:0});assert.equal(fieldInsightOpportunityEligibility(timeOnly).ready,false);assert.equal(fieldInsightOpportunityEligibility(timeOnly).elapsedReady,true);assert.equal(fieldInsightOpportunityEligibility(timeOnly).distanceReady,false);
  const distanceOnly=engagement({time:0,distance:FIELD_INSIGHT_MIN_DISTANCE});assert.equal(fieldInsightOpportunityEligibility(distanceOnly).ready,false);assert.equal(fieldInsightOpportunityEligibility(distanceOnly).elapsedReady,false);assert.equal(fieldInsightOpportunityEligibility(distanceOnly).distanceReady,true);
  assert.equal(fieldInsightOpportunityEligibility(engagement({time:FIELD_INSIGHT_MIN_SECONDS-.01,distance:FIELD_INSIGHT_MIN_DISTANCE})).ready,false,'distance cannot bypass minimum time');
  assert.equal(fieldInsightOpportunityEligibility(engagement({time:FIELD_INSIGHT_MIN_SECONDS,distance:FIELD_INSIGHT_MIN_DISTANCE-.01})).ready,false,'time cannot bypass minimum distance');
  const latched=engagement();assert.equal(fieldInsightOpportunityEligibility(latched).ready,true);latched.player.y=0;updateInsightEngagement(latched);assert.equal(fieldInsightOpportunityEligibility(latched).ready,true,'returning to launch must not revoke engagement');assert.equal(latched.insightEngagementMaxDistance,FIELD_INSIGHT_MIN_DISTANCE);
}`
);
await replaceOnce('tests/field-frontier-insight.test.mjs',
`  const early=value.signal('veil',.999,.999,{runContext:{time:2,collectedElements:{H:1,C:1,O:1}}});assert.deepEqual(early,{deferred:true,frontier:true});
  let diag=value.frontierInsightDiagnostics();assert.equal(diag.signalObserved,true);assert.equal(diag.opportunityCreated,false);
  assert.equal(value.pollFrontierInsight({time:FIELD_INSIGHT_MIN_SECONDS-0.01,collectedElements:{H:1,C:1,O:1}}),null,'time gate blocks deferred frontier');
  assert.equal(value.pollFrontierInsight({time:FIELD_INSIGHT_MIN_SECONDS,collectedElements:{H:0,C:0,O:0}}),null,'action gate blocks deferred frontier');
  const matured=value.pollFrontierInsight(engaged);assert.deepEqual(matured,{managed:true,recipe:target.id,frontier:true});diag=value.frontierInsightDiagnostics();assert.equal(diag.opportunityCreated,true);`,
`  const signalLastBefore=value.state.progress.signalLast.veil,early=value.signal('veil',.999,.999,{runContext:engagement({time:2,distance:FIELD_INSIGHT_MIN_DISTANCE})});assert.deepEqual(early,{deferred:true,frontier:true});
  let diag=value.frontierInsightDiagnostics();assert.equal(diag.signalObserved,true);assert.equal(diag.opportunityCreated,false);assert.equal(diag.selectedCandidateId,target.id);assert.equal(value.state.progress.signalLast.veil,signalLastBefore,'gate miss must not consume persistent signal cooldown');
  assert.equal(value.pollFrontierInsight(engagement({time:FIELD_INSIGHT_MIN_SECONDS-.01,distance:FIELD_INSIGHT_MIN_DISTANCE})),null,'time gate blocks deferred frontier');
  assert.equal(value.pollFrontierInsight(engagement({time:FIELD_INSIGHT_MIN_SECONDS,distance:FIELD_INSIGHT_MIN_DISTANCE-.01})),null,'distance gate blocks deferred frontier');
  const matured=value.pollFrontierInsight(engaged);assert.deepEqual(matured,{managed:true,recipe:target.id,frontier:true});diag=value.frontierInsightDiagnostics();assert.equal(diag.opportunityCreated,true);assert.equal(value.state.progress.signalLast.veil,value.state.progress.totalCollected,'signal cooldown begins only when opportunity actually matures');`
);
await replaceOnce('tests/field-frontier-insight.test.mjs',
  "assert.match(uiSource,/fieldInsightOpportunityEligibility\\(run,resources\\.record\\(id\\)\\)\\.ready/,'critical insights must use the run engagement gate');",
  "assert.doesNotMatch(uiSource,/fieldInsightOpportunityEligibility\\(run,resources\\.record\\(id\\)\\)/,'critical progression must bypass the ordinary Graph engagement gate');"
);

const engagementTest=`import assert from 'node:assert/strict';
import {VEIL} from '../src/veil/config.js';
import {FIELD_INSIGHT_MIN_DISTANCE,FIELD_INSIGHT_MIN_SECONDS,createRun,fieldInsightOpportunityEligibility,stepRun,updateInsightEngagement} from '../src/veil/expedition-run.js';

const emptyMap=()=>({seed:71,dust:[],fields:[],labels:[],routes:[]});

// The run starts without an origin so UI checkpoint positioning cannot look like
// exploration. The first physics step fixes the origin at the actual launch point.
{
  const run=createRun(emptyMap(),VEIL,{predators:false});
  run.player.x=250;run.player.y=-4600;run.player.angle=-Math.PI/2;
  assert.equal(run.insightEngagementOrigin,null);
  stepRun(run,{x:0,y:0},0);
  assert.deepEqual(run.insightEngagementOrigin,{x:250,y:-4600});
  assert.equal(run.insightEngagementMaxDistance,0);
  assert.equal(run.insightEngagementSatisfied,false);
}

// Max displacement, not path/input accumulation, owns the movement half of the gate.
{
  const run=createRun(emptyMap(),VEIL,{predators:false});stepRun(run,{x:0,y:0},0);
  run.time=FIELD_INSIGHT_MIN_SECONDS;
  for(const x of [400,-400,500,-500,600,-600]){run.player.x=x;run.player.y=VEIL.spawn.y;updateInsightEngagement(run);}
  let status=fieldInsightOpportunityEligibility(run);assert.equal(status.elapsedReady,true);assert.equal(status.distanceReady,false);assert.equal(status.ready,false);assert.equal(run.insightEngagementMaxDistance,600);
  run.player.x=FIELD_INSIGHT_MIN_DISTANCE;updateInsightEngagement(run);status=fieldInsightOpportunityEligibility(run);assert.equal(status.ready,true);assert.equal(status.maximumDistance,FIELD_INSIGHT_MIN_DISTANCE);
  run.player.x=0;updateInsightEngagement(run);assert.equal(fieldInsightOpportunityEligibility(run).ready,true,'engagement remains latched after returning to launch');
}

console.log('FIELD insight engagement gate passed: fixed launch origin, time + max world-space displacement, jitter resistance and run-local latch.');
`;
await writeFile('tests/field-insight-engagement.test.mjs',engagementTest);

await replaceOnce('.github/workflows/repository-validation.yml',
`      - name: Expedition insights
        run: |
          node tests/expedition-insights.test.mjs
          node tests/signal-eligibility.test.mjs`,
`      - name: Expedition insights
        run: |
          node tests/field-insight-engagement.test.mjs
          node tests/expedition-insights.test.mjs
          node tests/signal-eligibility.test.mjs`
);

console.log('Applied FIELD insight engagement task patches.');
