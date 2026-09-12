export const INSIGHT_ANALYSIS_SECONDS=5;
export const CRITICAL_INSIGHT_IDS=Object.freeze(['hydrogen','methane','oxygen','water']);
const CRITICAL_INSIGHTS=new Set(CRITICAL_INSIGHT_IDS);

export function createInsightRunState(){return {analysis:null,carriedInsights:[]};}

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
