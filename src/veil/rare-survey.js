import {nitrogenChapterState} from './nitrogen-progression.js';

export const RARE_SURVEY_ELEMENTS=Object.freeze(['P','S','F','Cl']);
export const RARE_SURVEY_SCAN_SECONDS=.85;
export const RARE_SURVEY_SCAN_RADIUS=68;
export const RARE_SURVEY_RUN_CONFIG=Symbol('molecule-craft.rare-survey-run-config');
export const RARE_SURVEY_CARGO=Symbol('molecule-craft.rare-survey-cargo');
const RARE_SET=new Set(RARE_SURVEY_ELEMENTS);
const INSTALLED=Symbol('molecule-craft.rare-survey-installed');
const freezeSite=site=>Object.freeze({...site});

// Fixed authored specimens deliberately span old and new FIELD territory.  They
// are treasure locations, not renewable dust tables.  Quantity stays data-driven
// so the later Rare -> Utility task can set costs without changing FIELD logic.
export const RARE_ANOMALIES=Object.freeze([
  freezeSite({id:'rare-p-veil-bend',element:'P',quantity:1,region:'veil',x:-520,y:-2200,label:'phosphorus specimen'}),
  freezeSite({id:'rare-s-carbon-revisit',element:'S',quantity:1,region:'carbon',x:980,y:-6300,label:'sulfur specimen'}),
  freezeSite({id:'rare-f-oxygen-thermal',element:'F',quantity:1,region:'oxygen',x:850,y:-10350,label:'fluorine specimen'}),
  freezeSite({id:'rare-cl-nitrogen-pocket',element:'Cl',quantity:1,region:'nitrogen',x:620,y:-14920,label:'chlorine specimen'}),
]);
const BY_ID=new Map(RARE_ANOMALIES.map(site=>[site.id,site]));
const cloneSite=site=>({...site});
const claimedIds=state=>Array.isArray(state?.rareSurvey?.claimedIds)?state.rareSurvey.claimedIds.filter(id=>BY_ID.has(id)):[];

export function rareSurveyUnlocked(state){return nitrogenChapterState(state).stage==='complete';}
export function rareSurveyState(state){return {unlocked:rareSurveyUnlocked(state),claimedIds:[...new Set(claimedIds(state))]};}
export function activeRareAnomalies(state){
  if(!rareSurveyUnlocked(state))return [];
  const claimed=new Set(claimedIds(state));return RARE_ANOMALIES.filter(site=>!claimed.has(site.id)).map(cloneSite);
}
export function rareSurveyRunConfig(state){return {unlocked:rareSurveyUnlocked(state),anomalies:activeRareAnomalies(state)};}

function ensureClaimState(state){
  const current=[...new Set(claimedIds(state))];
  if(!state.rareSurvey||!Array.isArray(state.rareSurvey.claimedIds)||current.length!==state.rareSurvey.claimedIds.length||current.some((id,index)=>id!==state.rareSurvey.claimedIds[index]))state.rareSurvey={claimedIds:current};
  return state.rareSurvey;
}
function cargoFromUnits(units){const cargo=units?.[RARE_SURVEY_CARGO];return Array.isArray(cargo)?cargo:[];}
function normalizedSpecimens(state,units){
  if(!rareSurveyUnlocked(state))return [];
  const already=new Set(claimedIds(state)),seen=new Set(),out=[];
  for(const carried of cargoFromUnits(units)){
    const site=BY_ID.get(carried?.id);if(!site||already.has(site.id)||seen.has(site.id))continue;
    seen.add(site.id);out.push(site);
  }
  return out;
}
function snapshotRareState(state){return {survey:state.rareSurvey===undefined?undefined:JSON.parse(JSON.stringify(state.rareSurvey)),elements:Object.fromEntries(RARE_SURVEY_ELEMENTS.map(element=>[element,state.elements?.[element]??0]))};}
function restoreRareState(state,snapshot){
  for(const [element,value]of Object.entries(snapshot.elements))state.elements[element]=value;
  if(snapshot.survey===undefined)delete state.rareSurvey;else state.rareSurvey=JSON.parse(JSON.stringify(snapshot.survey));
}
function stageClaims(state,specimens){
  const rare=ensureClaimState(state),committed=[];
  for(const site of specimens){
    if(rare.claimedIds.includes(site.id))continue;
    state.elements[site.element]=Math.max(0,Number(state.elements[site.element])||0)+site.quantity;
    rare.claimedIds.push(site.id);committed.push(cloneSite(site));
  }
  return committed;
}

export function installRareSurvey(resources){
  if(!resources||resources[INSTALLED])return resources;
  Object.defineProperty(resources,INSTALLED,{value:true});
  const prepare=resources.prepareExpedition.bind(resources),settle=resources.settleExpedition.bind(resources),canUse=resources.canUseElement.bind(resources);
  resources.canUseElement=element=>RARE_SET.has(element)?(resources.state.elements?.[element]??0)>0:canUse(element);
  resources.prepareExpedition=options=>{
    const fuel=prepare(options),config=rareSurveyRunConfig(resources.state);
    Object.defineProperty(fuel,RARE_SURVEY_RUN_CONFIG,{value:config,enumerable:false,configurable:false});
    return fuel;
  };
  resources.settleExpedition=(units,best=0,captured=false,options={})=>{
    const carried=normalizedSpecimens(resources.state,units),before=snapshotRareState(resources.state),committed=captured?[]:stageClaims(resources.state,carried),result=settle(units,best,captured,options);
    if(!result){restoreRareState(resources.state,before);return null;}
    result.rareSurvey={committed:committed.map(cloneSite),lost:captured?carried.map(cloneSite):[]};
    for(const site of committed)result.atoms[site.element]=(result.atoms[site.element]??0)+site.quantity;
    return result;
  };
  return resources;
}

function anomalyVisual(map,site,index){return {id:map.dust.length+index,x:site.x,y:site.y,baseX:site.x,baseY:site.y,angle:0,kind:'rare',element:site.element,value:0,ready:0,rareAnomaly:site.id};}
export function initializeRareSurveyRun(run,config={unlocked:false,anomalies:[]}){
  const definitions=config?.unlocked===true&&Array.isArray(config.anomalies)?config.anomalies.filter(site=>BY_ID.has(site?.id)&&!run?.map?.dust?.some(dust=>dust.rareAnomaly===site.id)):[];
  const anomalies=definitions.map((definition,index)=>{const site=cloneSite(BY_ID.get(definition.id)),visual=anomalyVisual(run.map,site,index);run.map.dust.push(visual);return {...site,visual,collected:false};});
  run.rareSurvey={unlocked:config?.unlocked===true,anomalies,activeScanId:null,scanElapsed:0};run.rareSpecimens=[];run.rareCargo=Object.fromEntries(RARE_SURVEY_ELEMENTS.map(element=>[element,0]));
  Object.defineProperty(run.elementDust,RARE_SURVEY_CARGO,{value:run.rareSpecimens,enumerable:false,configurable:false});
  return run;
}
export function suspendRareAnomalyVisuals(run){
  const map=run?.map,visuals=run?.rareSurvey?.anomalies?.map(item=>item.visual).filter(Boolean)??[];
  if(!map||!visuals.length)return()=>{};
  const ids=new Set(visuals.map(visual=>visual.rareAnomaly));map.dust=map.dust.filter(dust=>!ids.has(dust.rareAnomaly));
  return()=>{for(const visual of visuals)if(!map.dust.includes(visual))map.dust.push(visual);};
}
function addPickupEffect(run,site){
  if(!Array.isArray(run.effects)||run.effects.length>=run.config.maxEffects)return;
  run.effects.push({x:site.x,y:site.y,startX:site.x,startY:site.y,life:0,duration:.58,kind:'rare',side:site.element.charCodeAt(0)%2?1:-1,trail:[{x:site.x,y:site.y}]});
}
export function advanceRareSurvey(run,seconds,events=[]){
  const survey=run?.rareSurvey;if(!survey?.unlocked||run.captured||!Number.isFinite(seconds)||seconds<=0)return events;
  const open=survey.anomalies.filter(item=>!item.collected),nearest=open.map(item=>({item,distance:Math.hypot(run.player.x-item.x,run.player.y-item.y)})).filter(row=>row.distance<=RARE_SURVEY_SCAN_RADIUS).sort((a,b)=>a.distance-b.distance||a.item.id.localeCompare(b.item.id))[0]?.item??null;
  if(!nearest){survey.activeScanId=null;survey.scanElapsed=0;return events;}
  if(survey.activeScanId!==nearest.id){survey.activeScanId=nearest.id;survey.scanElapsed=0;events.push({type:'rareAnomalyScanStart',id:nearest.id,element:nearest.element,quantity:nearest.quantity});}
  survey.scanElapsed+=seconds;
  if(survey.scanElapsed+1e-9<RARE_SURVEY_SCAN_SECONDS)return events;
  nearest.collected=true;nearest.visual.ready=Infinity;survey.activeScanId=null;survey.scanElapsed=0;const specimen={id:nearest.id,element:nearest.element,quantity:nearest.quantity};run.rareSpecimens.push(specimen);run.rareCargo[nearest.element]+=nearest.quantity;addPickupEffect(run,nearest);events.push({type:'rareAnomalyCollected',...specimen});return events;
}
export function rareSurveyDiagnostics(run){const survey=run?.rareSurvey;return {unlocked:!!survey?.unlocked,activeScanId:survey?.activeScanId??null,scanElapsed:survey?.scanElapsed??0,available:(survey?.anomalies??[]).filter(item=>!item.collected).map(({id,element,quantity,region,x,y})=>({id,element,quantity,region,x,y})),specimens:(run?.rareSpecimens??[]).map(item=>({...item})),cargo:{...(run?.rareCargo??{})}};}
