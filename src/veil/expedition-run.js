import {createRun as createBaseRun,stepRun as stepBaseRun} from './engine.js';
import {advanceInsightAnalysis,createInsightRunState,ensureInsightEngagementOrigin,updateInsightEngagement} from './insights.js';

export {beginBurst,setCombustionHeld} from './engine.js';
export {CRITICAL_INSIGHT_IDS,FIELD_INSIGHT_MIN_DISTANCE,FIELD_INSIGHT_MIN_SECONDS,INSIGHT_ANALYSIS_SECONDS,discardActiveInsight,discardRunInsights,ensureInsightEngagementOrigin,fieldInsightOpportunityEligibility,fieldInsightRequiredElements,triggerInsight,updateInsightEngagement} from './insights.js';

export function createRun(...args){return Object.assign(createBaseRun(...args),createInsightRunState());}

export function stepRun(run,input,elapsed,systems={}){
  ensureInsightEngagementOrigin(run);
  const before=run.time,driveHeldBefore=!!run.driveHeld,events=stepBaseRun(run,input,elapsed,systems),simulated=Math.max(0,run.time-before);
  updateInsightEngagement(run);
  if(driveHeldBefore)for(const event of events)if(event.type==='overheat')event.driveInterrupted=true;
  advanceInsightAnalysis(run,simulated,events);return events;
}
