import {createRun as createBaseRun,stepRun as stepBaseRun} from './engine.js';
import {advanceInsightAnalysis,createInsightRunState} from './insights.js';

export {beginBurst,setCombustionHeld} from './engine.js';
export {CRITICAL_INSIGHT_IDS,INSIGHT_ANALYSIS_SECONDS,discardActiveInsight,discardRunInsights,triggerInsight} from './insights.js';

export function createRun(...args){return Object.assign(createBaseRun(...args),createInsightRunState());}

export function stepRun(run,input,elapsed,systems={}){
  const before=run.time,driveHeldBefore=!!run.driveHeld,events=stepBaseRun(run,input,elapsed,systems),simulated=Math.max(0,run.time-before);
  if(driveHeldBefore)for(const event of events)if(event.type==='overheat')event.driveInterrupted=true;
  advanceInsightAnalysis(run,simulated,events);return events;
}
