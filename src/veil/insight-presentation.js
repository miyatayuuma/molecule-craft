import {CRITICAL_INSIGHT_IDS} from './insights.js';

const CRITICAL_INSIGHTS=new Set(CRITICAL_INSIGHT_IDS),READY_SECONDS=2.6;
const clamp01=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));

export function insightAnalysisProgress(analysis){
  if(!analysis)return 0;
  if(Number.isFinite(analysis.progress))return clamp01(analysis.progress);
  if(Number.isFinite(analysis.elapsed)&&Number.isFinite(analysis.requiredDuration)&&analysis.requiredDuration>0)return clamp01(analysis.elapsed/analysis.requiredDuration);
  return 0;
}

export function criticalInsightModels(run,resources,formula=id=>resources?.record?.(id)?.formula??id){
  const carried=run?.carriedInsights??[],persistent=resources?.state??{},models=[];
  for(const id of carried){
    if(!CRITICAL_INSIGHTS.has(id)||persistent.hints?.includes(id)||persistent.recipes?.includes(id))continue;
    const cost=resources?.costFor?.(id);if(!cost)continue;
    models.push({id,formula:formula(id),atoms:Object.entries(cost).filter(([,count])=>Number.isFinite(count)&&count>0)});
  }
  return models;
}

function make(doc,tag,className,text=''){
  const node=doc.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;
}
function ensureStyles(doc){
  if(doc.getElementById?.('veil-insight-styles'))return;
  const link=doc.createElement('link');link.id='veil-insight-styles';link.rel='stylesheet';link.href=new URL('./insight-presentation.css',import.meta.url).href;doc.head?.append(link);
}
function atomText(atoms){return atoms.map(([element,count])=>`${element} ×${count}`).join(' · ');}

export function createInsightPresentation({root,resources,formula=id=>resources?.record?.(id)?.formula??id,audio,reduced=false,document:doc=root?.ownerDocument??globalThis.document}={}){
  if(!root||!doc)return {sync:()=>{},ready:()=>false,clear:()=>{}};
  ensureStyles(doc);
  const group=make(doc,'div','veil-insight-hud');group.id='veil-insight-hud';group.dataset.reduced=String(!!reduced);group.setAttribute('aria-label','分子アイデア');
  const analysis=make(doc,'div','veil-insight-analysis');analysis.id='veil-insight-analysis';analysis.hidden=true;
  const analysisHead=make(doc,'div','veil-insight-analysis-head'),analysisLabel=make(doc,'strong','', 'ANALYZING'),analysisMeta=make(doc,'small','', 'STRUCTURE RESOLUTION');analysisHead.append(analysisLabel,analysisMeta);
  const analysisTrack=make(doc,'div','veil-insight-analysis-track');analysisTrack.setAttribute('role','progressbar');analysisTrack.setAttribute('aria-label','分子アイデア解析');analysisTrack.setAttribute('aria-valuemin','0');analysisTrack.setAttribute('aria-valuemax','100');const analysisBar=make(doc,'i');analysisTrack.append(analysisBar);analysis.append(analysisHead,analysisTrack);
  const ready=make(doc,'div','veil-insight-ready');ready.id='veil-insight-ready';ready.hidden=true;ready.setAttribute('role','status');const readySymbol=make(doc,'span','veil-insight-ready-symbol','💡'),readyFormula=make(doc,'strong');readySymbol.setAttribute('aria-hidden','true');ready.append(readySymbol,readyFormula);
  const critical=make(doc,'div','veil-critical-insights');critical.id='veil-critical-insights';critical.setAttribute('aria-label','持ち帰る重要な分子アイデア');
  group.append(analysis,ready,critical);root.append(group);
  let readyUntil=-Infinity,criticalKey='';

  function renderCritical(run){
    const models=criticalInsightModels(run,resources,formula),key=models.map(model=>`${model.id}:${atomText(model.atoms)}`).join('|');if(key===criticalKey)return models;criticalKey=key;critical.replaceChildren();
    for(const model of models){
      const chip=make(doc,'div','veil-critical-insight');chip.dataset.insightId=model.id;chip.setAttribute('aria-label',`持ち帰る分子アイデア ${model.formula}。必要原子 ${atomText(model.atoms)}`);
      const symbol=make(doc,'span','veil-critical-insight-symbol','💡'),label=make(doc,'strong','',model.formula),atoms=make(doc,'small','',atomText(model.atoms));symbol.setAttribute('aria-hidden','true');chip.append(symbol,label,atoms);critical.append(chip);
    }
    return models;
  }
  function sync(run){
    const current=run?.analysis??null,progress=insightAnalysisProgress(current);analysis.hidden=!current;
    if(current){const percent=Math.round(progress*100);analysisTrack.setAttribute('aria-valuenow',String(percent));analysisBar.style.transform=`scaleX(${progress})`;}
    if(!run||run.time>=readyUntil)ready.hidden=true;
    renderCritical(run);return {analysis:current?{progress}:null,critical:criticalInsightModels(run,resources,formula),ready:!ready.hidden};
  }
  function showReady(event,run){
    if(!event?.id||event.type!=='insightReady')return false;
    readyFormula.textContent=formula(event.id);ready.dataset.critical=String(!!event.critical);ready.hidden=false;readyUntil=(run?.time??0)+READY_SECONDS;audio?.event?.('insight');renderCritical(run);return true;
  }
  function clear(){analysis.hidden=true;ready.hidden=true;readyUntil=-Infinity;criticalKey='';critical.replaceChildren();analysisBar.style.transform='scaleX(0)';analysisTrack.setAttribute('aria-valuenow','0');}
  return {sync,ready:showReady,clear,nodes:{group,analysis,analysisTrack,analysisBar,ready,readyFormula,critical}};
}
