import {CRITICAL_INSIGHT_IDS} from './insights.js';
import {insightCategoryFor,insightCategoryLabel} from '../insight-category.js';
import {subscribeCollectorShellScreenAnchor} from './collector-shell.js';

const CRITICAL_INSIGHTS=new Set(CRITICAL_INSIGHT_IDS),READY_SECONDS=1.1,START_SECONDS=.34,NORMAL_VISIBLE_LIMIT=3,DEFAULT_BOUNDS={width:220,height:118},EDGE_MARGIN=10;
const clamp01=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

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
    const category=insightCategoryFor(id);
    models.push({id,formula:formula(id),category,categoryLabel:insightCategoryLabel(category),atoms:Object.entries(cost).filter(([,count])=>Number.isFinite(count)&&count>0)});
  }
  return models;
}

export function normalInsightModels(run,resources){
  const persistent=resources?.state??{},models=[];
  for(const id of run?.carriedInsights??[]){
    if(CRITICAL_INSIGHTS.has(id)||persistent.hints?.includes(id)||persistent.recipes?.includes(id))continue;
    const category=insightCategoryFor(id);models.push({id,category,categoryLabel:insightCategoryLabel(category)});
  }
  return models;
}

export function playerAnchoredInsightPosition(anchor,viewport,bounds=DEFAULT_BOUNDS,offset=38){
  if(!anchor||!Number.isFinite(anchor.x)||!Number.isFinite(anchor.y)||!Number.isFinite(viewport?.w)||!Number.isFinite(viewport?.h))return null;
  const availableWidth=Math.max(1,viewport.w-EDGE_MARGIN*2),width=Math.min(Math.max(1,bounds?.width||DEFAULT_BOUNDS.width),availableWidth),height=Math.max(1,bounds?.height||DEFAULT_BOUNDS.height),half=width/2;
  const x=viewport.w<=width+EDGE_MARGIN*2?viewport.w/2:clamp(anchor.x,EDGE_MARGIN+half,viewport.w-EDGE_MARGIN-half),canAbove=anchor.y-offset-height>=EDGE_MARGIN,canBelow=anchor.y+offset+height<=viewport.h-EDGE_MARGIN,side=canAbove||!canBelow?'above':'below';
  const y=side==='above'?clamp(anchor.y-offset,EDGE_MARGIN+height,viewport.h-EDGE_MARGIN):clamp(anchor.y+offset,EDGE_MARGIN,Math.max(EDGE_MARGIN,viewport.h-EDGE_MARGIN-height));
  return {x,y,side};
}

function make(doc,tag,className,text=''){
  const node=doc.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;
}
function ensureStyle(doc,id,href){
  if(doc.getElementById?.(id))return;
  const link=doc.createElement('link');link.id=id;link.rel='stylesheet';link.href=href;doc.head?.append(link);
}
function ensureStyles(doc){
  ensureStyle(doc,'insight-category-styles',new URL('../insight-category.css',import.meta.url).href);
  ensureStyle(doc,'veil-insight-styles',new URL('./insight-presentation.css',import.meta.url).href);
}
function atomText(atoms){return atoms.map(([element,count])=>`${element} ×${count}`).join(' · ');}
function setProgress(node,progress){const value=`${progress*360}deg`;if(typeof node.style.setProperty==='function')node.style.setProperty('--insight-progress',value);else node.style['--insight-progress']=value;}

export function createInsightPresentation({root,resources,formula=id=>resources?.record?.(id)?.formula??id,audio,reduced=false,document:doc=root?.ownerDocument??globalThis.document}={}){
  if(!root||!doc)return {sync:()=>{},ready:()=>false,snapshot:()=>({normal:[],critical:[]}),loss:()=>false,clear:()=>{}};
  ensureStyles(doc);
  const group=make(doc,'div','veil-insight-hud');group.id='veil-insight-hud';group.dataset.reduced=String(!!reduced);group.dataset.anchorSide='above';group.hidden=true;group.setAttribute('aria-label','分子アイデア');
  const start=make(doc,'div','veil-insight-start');start.id='veil-insight-start';start.hidden=true;start.setAttribute('aria-hidden','true');start.append(make(doc,'i'),make(doc,'i'));
  const analysis=make(doc,'div','veil-insight-analysis');analysis.id='veil-insight-analysis';analysis.hidden=true;analysis.setAttribute('role','progressbar');analysis.setAttribute('aria-label','分子アイデア解析');analysis.setAttribute('aria-valuemin','0');analysis.setAttribute('aria-valuemax','100');
  const analysisRing=make(doc,'span','veil-insight-analysis-ring'),analysisSymbol=make(doc,'span','veil-insight-analysis-symbol','⌁');analysisRing.setAttribute('aria-hidden','true');analysisSymbol.setAttribute('aria-hidden','true');analysis.append(analysisRing,analysisSymbol);
  const ready=make(doc,'div','veil-insight-ready');ready.id='veil-insight-ready';ready.hidden=true;ready.setAttribute('role','status');const readySymbol=make(doc,'span','veil-insight-ready-symbol insight-bulb');readySymbol.setAttribute('aria-hidden','true');ready.append(readySymbol);
  const normal=make(doc,'div','veil-normal-insights');normal.id='veil-normal-insights';normal.hidden=true;
  const critical=make(doc,'div','veil-critical-insights');critical.id='veil-critical-insights';critical.setAttribute('aria-label','持ち帰る重要な分子アイデア');
  const lossLayer=make(doc,'div','veil-insight-loss');lossLayer.id='veil-insight-loss';lossLayer.hidden=true;lossLayer.setAttribute('aria-hidden','true');
  group.append(start,analysis,ready,normal,critical,lossLayer);root.append(group);
  let startUntil=-Infinity,readyUntil=-Infinity,readyNormalId=null,normalKey='',criticalKey='',analysisKey=null,lastSnapshot={normal:[],critical:[]},lastAnchor=null,lastViewport=null;

  function concealNormalFieldIdentity(run,models){
    const target=run?.inspiration;if(!target||!models.some(model=>model.id===target))return;
    const prompt=doc.getElementById?.('veil-craft-prompt'),action=doc.getElementById?.('veil-to-craft'),label=doc.getElementById?.('veil-to-craft-label'),atoms=doc.getElementById?.('veil-to-craft-atoms'),goal=doc.getElementById?.('cho-goal-action'),goalLabel=doc.getElementById?.('cho-goal-label'),goalAtoms=doc.getElementById?.('cho-goal-atoms');
    if(prompt)prompt.hidden=true;if(action)action.removeAttribute?.('aria-label');if(label)label.textContent='';atoms?.replaceChildren?.();if(goal)goal.removeAttribute?.('aria-label');if(goalLabel)goalLabel.textContent='';goalAtoms?.replaceChildren?.();
  }
  function renderNormal(run){
    const models=normalInsightModels(run,resources),visible=models.filter(model=>!(model.id===readyNormalId&&!ready.hidden)),key=visible.map(model=>`${model.id}:${model.category}`).join('|');if(key===normalKey)return models;normalKey=key;normal.replaceChildren();
    for(const model of visible.slice(0,NORMAL_VISIBLE_LIMIT)){const bulb=make(doc,'span','veil-normal-insight insight-bulb');bulb.dataset.insightCategory=model.category;bulb.setAttribute('aria-hidden','true');normal.append(bulb);}
    if(visible.length>NORMAL_VISIBLE_LIMIT){const overflow=make(doc,'small','veil-normal-insight-overflow',`+${visible.length-NORMAL_VISIBLE_LIMIT}`);overflow.setAttribute('aria-hidden','true');normal.append(overflow);}
    normal.hidden=!visible.length;
    if(visible.length)normal.setAttribute('aria-label',`持ち帰る未確定アイデア ${visible.length}件。用途 ${visible.map(model=>model.categoryLabel).join('、')}`);else normal.removeAttribute?.('aria-label');
    return models;
  }
  function renderCritical(run){
    const models=criticalInsightModels(run,resources,formula),key=models.map(model=>`${model.id}:${model.category}:${atomText(model.atoms)}`).join('|');if(key===criticalKey)return models;criticalKey=key;critical.replaceChildren();
    for(const model of models){
      const chip=make(doc,'div','veil-critical-insight');chip.dataset.insightId=model.id;chip.dataset.insightCategory=model.category;chip.setAttribute('aria-label',`CRAFT ${model.formula}。用途 ${model.categoryLabel}。必要原子 ${atomText(model.atoms)}`);
      const symbol=make(doc,'span','veil-critical-insight-symbol insight-bulb'),label=make(doc,'strong','',`CRAFT ${model.formula}`),atoms=make(doc,'small','',atomText(model.atoms));symbol.setAttribute('aria-hidden','true');chip.append(symbol,label,atoms);critical.append(chip);
    }
    return models;
  }
  function place(anchor=lastAnchor,viewport=lastViewport){
    if(anchor)lastAnchor=anchor;if(viewport)lastViewport=viewport;if(!lastAnchor||!lastViewport)return null;
    const scale=Number.isFinite(lastViewport.scale)?lastViewport.scale:1,offset=clamp(38*scale,30,45),estimatedHeight=Math.max(DEFAULT_BOUNDS.height,critical.children.length?critical.children.length*38+24:0),bounds={width:group.offsetWidth||DEFAULT_BOUNDS.width,height:group.offsetHeight||estimatedHeight},position=playerAnchoredInsightPosition(lastAnchor,lastViewport,bounds,offset);if(!position)return null;
    group.style.left=`${position.x}px`;group.style.top=`${position.y}px`;group.dataset.anchorSide=position.side;return position;
  }
  function updateVisibility(){group.hidden=!lastAnchor||analysis.hidden&&start.hidden&&ready.hidden&&normal.hidden&&critical.children.length===0&&lossLayer.hidden;}
  function sync(run){
    const current=run?.analysis??null,progress=insightAnalysisProgress(current),now=run?.time??Infinity,currentKey=current?.id??null;if(currentKey&&currentKey!==analysisKey){startUntil=now+START_SECONDS;start.hidden=false;}analysisKey=currentKey;analysis.hidden=!current;
    if(current){const percent=Math.round(progress*100);analysis.setAttribute('aria-valuenow',String(percent));setProgress(analysisRing,progress);}
    else{analysis.setAttribute('aria-valuenow','0');setProgress(analysisRing,0);}
    start.hidden=!(run&&now<startUntil);
    if(!run||now>=readyUntil){ready.hidden=true;readyNormalId=null;}
    const normalModels=renderNormal(run),criticalModels=renderCritical(run);concealNormalFieldIdentity(run,normalModels);lastSnapshot={normal:normalModels,critical:criticalModels};updateVisibility();return {analysis:current?{progress}:null,normal:normalModels,critical:criticalModels,ready:!ready.hidden};
  }
  function showReady(event,run){
    if(!event?.id||event.type!=='insightReady')return false;
    const category=insightCategoryFor(event.id),label=insightCategoryLabel(category),isCritical=!!event.critical;ready.dataset.critical=String(isCritical);ready.dataset.fromAnalysis=String(!isCritical);ready.dataset.insightCategory=category;ready.setAttribute('aria-label',isCritical?`分子アイデア ${formula(event.id)}。用途 ${label}`:`分子アイデアを獲得。用途 ${label}`);ready.hidden=false;readyUntil=(run?.time??0)+READY_SECONDS;readyNormalId=isCritical?null:event.id;start.hidden=true;audio?.event?.('insight');const normalModels=renderNormal(run);renderCritical(run);concealNormalFieldIdentity(run,normalModels);updateVisibility();return true;
  }
  function snapshot(run){return {normal:normalInsightModels(run,resources),critical:criticalInsightModels(run,resources,formula)};}
  function showLoss(snapshotValue){
    const lost=snapshotValue??{normal:[],critical:[]};if(!(lost.normal?.length||lost.critical?.length))return false;analysis.hidden=true;start.hidden=true;ready.hidden=true;readyNormalId=null;normal.replaceChildren();normal.hidden=true;normalKey='';critical.replaceChildren();criticalKey='';lossLayer.replaceChildren();
    for(const model of (lost.normal??[]).slice(0,NORMAL_VISIBLE_LIMIT)){const bulb=make(doc,'span','veil-insight-loss-bulb insight-bulb');bulb.dataset.insightCategory=model.category;lossLayer.append(bulb);}
    for(const model of lost.critical??[]){const marker=make(doc,'span','veil-insight-loss-critical');marker.dataset.insightCategory=model.category;const bulb=make(doc,'i','insight-bulb'),copy=make(doc,'b','',`CRAFT ${model.formula}`);marker.append(bulb,copy);lossLayer.append(marker);}
    lossLayer.hidden=false;lossLayer.dataset.active=String((Number(lossLayer.dataset.active)||0)+1);updateVisibility();return true;
  }
  function clear(){
    const lost=lastSnapshot,shouldLose=lost.normal.length||lost.critical.length;lastSnapshot={normal:[],critical:[]};analysisKey=null;startUntil=readyUntil=-Infinity;readyNormalId=null;delete ready.dataset.insightCategory;ready.removeAttribute?.('aria-label');analysis.setAttribute('aria-valuenow','0');setProgress(analysisRing,0);
    if(shouldLose){showLoss(lost);return;}
    analysis.hidden=start.hidden=ready.hidden=normal.hidden=lossLayer.hidden=true;normalKey=criticalKey='';normal.replaceChildren();critical.replaceChildren();lossLayer.replaceChildren();lastAnchor=lastViewport=null;group.hidden=true;
  }
  subscribeCollectorShellScreenAnchor(anchor=>{lastAnchor={x:anchor.x,y:anchor.y};lastViewport={w:anchor.w,h:anchor.h,scale:anchor.scale};place();updateVisibility();});
  return {sync,ready:showReady,snapshot,loss:showLoss,clear,nodes:{group,start,analysis,analysisRing,analysisSymbol,ready,readySymbol,normal,critical,lossLayer}};
}
