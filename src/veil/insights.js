import {EXPEDITION} from './config.js';

export const INSIGHT_ANALYSIS_SECONDS=5;
export const CRITICAL_INSIGHT_IDS=Object.freeze(['hydrogen','methane','oxygen','water']);
export const FIELD_INSIGHT_MIN_SECONDS=EXPEDITION.safeSeconds;
export const FIELD_INSIGHT_MIN_DISTANCE=1200;
const CRITICAL_INSIGHTS=new Set(CRITICAL_INSIGHT_IDS),FIELD_ACTION_ELEMENTS=Object.freeze(['H','C','O']);

export function fieldInsightRequiredElements(record){
  if(!Array.isArray(record?.atoms)||!record.atoms.length)return [];
  return [...new Set(record.atoms.filter(element=>FIELD_ACTION_ELEMENTS.includes(element)))];
}

const finitePoint=point=>point&&Number.isFinite(point.x)&&Number.isFinite(point.y)?{x:point.x,y:point.y}:null;
export function ensureInsightEngagementOrigin(run){
  if(!run)return null;
  if(!finitePoint(run.insightEngagementOrigin))run.insightEngagementOrigin=finitePoint(run.player);
  return finitePoint(run.insightEngagementOrigin);
}
export function fieldInsightOpportunityEligibility(run,record=null){
  const minimumSeconds=FIELD_INSIGHT_MIN_SECONDS,minimumDistance=FIELD_INSIGHT_MIN_DISTANCE,elapsed=Number.isFinite(run?.time)?Math.max(0,run.time):0,maxDistance=Number.isFinite(run?.insightEngagementMaxDistance)?Math.max(0,run.insightEngagementMaxDistance):0;
  const elapsedReady=elapsed+1e-9>=minimumSeconds,distanceReady=maxDistance+1e-9>=minimumDistance,criticalBypass=CRITICAL_INSIGHTS.has(record?.id),engagementSatisfied=run?.insightEngagementSatisfied===true;
  return {ready:criticalBypass||engagementSatisfied,elapsedReady,distanceReady,engagementSatisfied,criticalBypass,elapsed,maximumDistance:maxDistance,minimumSeconds,minimumDistance};
}
export function updateInsightEngagement(run){
  if(!run)return fieldInsightOpportunityEligibility(run);
  const origin=ensureInsightEngagementOrigin(run),player=finitePoint(run.player);
  if(origin&&player){const distance=Math.hypot(player.x-origin.x,player.y-origin.y);run.insightEngagementMaxDistance=Math.max(Number.isFinite(run.insightEngagementMaxDistance)?run.insightEngagementMaxDistance:0,distance);}
  const status=fieldInsightOpportunityEligibility(run);
  if(!run.insightEngagementSatisfied&&status.elapsedReady&&status.distanceReady)run.insightEngagementSatisfied=true;
  return fieldInsightOpportunityEligibility(run);
}

export function createInsightRunState(){return {analysis:null,carriedInsights:[],insightEngagementOrigin:null,insightEngagementMaxDistance:0,insightEngagementSatisfied:false};}

function known(run,id,persistent){return !!(persistent?.recipes?.includes(id)||persistent?.hints?.includes(id)||run?.carriedInsights?.includes(id)||run?.analysis?.id===id);}

export function triggerInsight(run,id,persistent={}){
  if(!run||run.captured||typeof id!=='string'||!id||known(run,id,persistent))return null;
  if(CRITICAL_INSIGHTS.has(id)){
    run.carriedInsights.push(id);
    return {type:'insightReady',id,critical:true};
  }
  if(run.analysis)return null;
  run.analysis={id,elapsed:0,requiredDuration:INSIGHT_ANALYSIS_SECONDS,progress:0};
  return {type:'insightAnalysisStart',id};
}

export function advanceInsightAnalysis(run,dt,events=run?.events){
  const analysis=run?.analysis;if(!analysis||run.captured||!Number.isFinite(dt)||dt<=0)return null;
  analysis.elapsed=Math.min(analysis.requiredDuration,analysis.elapsed+dt);
  analysis.progress=analysis.requiredDuration?analysis.elapsed/analysis.requiredDuration:1;
  if(analysis.elapsed+1e-9<analysis.requiredDuration)return null;
  const id=analysis.id;run.analysis=null;
  if(!run.carriedInsights.includes(id))run.carriedInsights.push(id);
  const event={type:'insightReady',id,critical:false};events?.push(event);return event;
}

export function discardActiveInsight(run){if(!run)return null;const id=run.analysis?.id??null;run.analysis=null;return id;}
export function discardRunInsights(run){if(!run)return;run.analysis=null;run.carriedInsights.length=0;}
