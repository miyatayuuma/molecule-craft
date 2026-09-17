import {createRun as createBaseRun,stepRun as stepBaseRun} from './engine.js';
import {advanceInsightAnalysis,createInsightRunState,ensureInsightEngagementOrigin,updateInsightEngagement} from './insights.js';
import {appendNitrogenField} from './nitrogen-routes.js';
import {RARE_SURVEY_RUN_CONFIG,advanceRareSurvey,initializeRareSurveyRun,suspendRareAnomalyVisuals} from './rare-survey.js';

export {beginBurst,beginShock,setCombustionHeld} from './engine.js';
export {CRITICAL_INSIGHT_IDS,FIELD_INSIGHT_MIN_DISTANCE,FIELD_INSIGHT_MIN_SECONDS,INSIGHT_ANALYSIS_SECONDS,discardActiveInsight,discardRunInsights,ensureInsightEngagementOrigin,fieldInsightOpportunityEligibility,fieldInsightRequiredElements,triggerInsight,updateInsightEngagement} from './insights.js';

export function createRun(map,config,...args){
  if(config?.nitrogenField===true)appendNitrogenField(map,map?.seed??1,{N:config.nitrogenStock??0});
  const run=Object.assign(createBaseRun(map,config,...args),createInsightRunState(),{deferredNitrogenSignal:null}),rareConfig=args[0]?.fuel?.[RARE_SURVEY_RUN_CONFIG];
  return initializeRareSurveyRun(run,rareConfig);
}

export function stepRun(run,input,elapsed,systems={}){
  ensureInsightEngagementOrigin(run);
  const before=run.time,driveHeldBefore=!!run.driveHeld,restoreRareVisuals=suspendRareAnomalyVisuals(run);let events;
  try{events=stepBaseRun(run,input,elapsed,systems);}finally{restoreRareVisuals();}
  const simulated=Math.max(0,run.time-before),nitrogenSignal=events.find(event=>event.type==='signal'&&event.region==='nitrogen');
  updateInsightEngagement(run);
  if(nitrogenSignal&&!run.insightEngagementSatisfied)run.deferredNitrogenSignal={...nitrogenSignal};
  else if(run.insightEngagementSatisfied&&run.deferredNitrogenSignal&&!nitrogenSignal){events.push(run.deferredNitrogenSignal);run.deferredNitrogenSignal=null;}
  if(driveHeldBefore)for(const event of events)if(event.type==='overheat')event.driveInterrupted=true;
  advanceInsightAnalysis(run,simulated,events);advanceRareSurvey(run,simulated,events);return events;
}
