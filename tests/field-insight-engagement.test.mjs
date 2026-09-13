import assert from 'node:assert/strict';
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
