import {createRun as createBaseRun,stepRun as stepBaseRun} from './engine.js';
import {advanceInsightAnalysis,createInsightRunState,ensureInsightEngagementOrigin,updateInsightEngagement} from './insights.js';
import {appendNitrogenField} from './nitrogen-routes.js';

export {beginBurst,beginShock,setCombustionHeld} from './engine.js';
export {FIELD_RUNTIME_ALLOWLIST,FIELD_RUNTIME_ALLOWLIST_VERSION,RETIRED_FIELD_RUNTIME} from './field-runtime-authority.js';
export {CRITICAL_INSIGHT_IDS,FIELD_INSIGHT_MIN_DISTANCE,FIELD_INSIGHT_MIN_SECONDS,INSIGHT_ANALYSIS_SECONDS,discardActiveInsight,discardRunInsights,ensureInsightEngagementOrigin,fieldInsightOpportunityEligibility,fieldInsightRequiredElements,runInsightLossSnapshot,triggerInsight,updateInsightEngagement} from './insights.js';

export function createRun(map,config,...args){
  if(config?.nitrogenField===true)appendNitrogenField(map,map?.seed??1,{N:config.nitrogenStock??0},{coreFractured:config.coreFractured===true,worldState:config.hazardWorldState??'base'});
  return Object.assign(createBaseRun(map,config,...args),createInsightRunState(),{deferredNitrogenSignal:null});
}

export function stepRun(run,input,elapsed,systems={}){
  if(run?.captured)return stepBaseRun(run,input,elapsed,systems);
  ensureInsightEngagementOrigin(run);
  const before=run.time,driveHeldBefore=!!run.driveHeld,events=stepBaseRun(run,input,elapsed,systems);
  const simulated=Math.max(0,run.time-before),nitrogenSignal=events.find(event=>event.type==='signal'&&event.region==='nitrogen');
  updateInsightEngagement(run);
  if(nitrogenSignal&&!run.insightEngagementSatisfied)run.deferredNitrogenSignal={...nitrogenSignal};
  else if(run.insightEngagementSatisfied&&run.deferredNitrogenSignal&&!nitrogenSignal){events.push(run.deferredNitrogenSignal);run.deferredNitrogenSignal=null;}
  if(driveHeldBefore)for(const event of events)if(event.type==='overheat')event.driveInterrupted=true;
  advanceInsightAnalysis(run,simulated,events);return events;
}
