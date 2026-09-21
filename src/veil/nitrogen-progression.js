import {getFrontierCandidates} from '../molecule-frontier.js';
import {NITROGEN_REGION_ID} from './nitrogen-config.js';

export const NITROGEN_MOLECULE_ID='nitrogen';
export const AMMONIA_MOLECULE_ID='ammonia';
export {NITROGEN_REGION_ID};

// Task 3 productionizes the FIELD. Availability remains a source capability;
// player eligibility is still derived from progress.choCompleted.
export const NITROGEN_REGION_AVAILABLE=true;

const includes=(value,id)=>Array.isArray(value)&&value.includes(id);
const known=(state,id)=>includes(state?.recipes,id)||includes(state?.hints,id);

export function nitrogenChapterEligible(progress){
  return progress?.choCompleted===true;
}

export function nitrogenChapterState(state,{regionAvailable=NITROGEN_REGION_AVAILABLE}={}){
  const eligible=nitrogenChapterEligible(state?.progress),nitrogenDiscovered=includes(state?.recipes,NITROGEN_MOLECULE_ID),nitrogenKnown=known(state,NITROGEN_MOLECULE_ID),ammoniaDiscovered=includes(state?.recipes,AMMONIA_MOLECULE_ID),ammoniaKnown=known(state,AMMONIA_MOLECULE_ID);
  let stage='locked';
  if(eligible){
    if(!nitrogenDiscovered)stage=nitrogenKnown?'nitrogen-craft':'nitrogen-critical';
    else if(ammoniaDiscovered)stage='complete';
    else stage=ammoniaKnown?'ammonia-craft':'ammonia-frontier';
  }
  return Object.freeze({eligible,destinationAvailable:eligible&&regionAvailable===true,stage,playerStage:eligible&&regionAvailable!==true?'eligible-waiting-field':stage,nitrogenKnown,nitrogenDiscovered,ammoniaKnown,ammoniaDiscovered});
}

export function nitrogenElementAccessible(progress,{regionAvailable=NITROGEN_REGION_AVAILABLE}={}){
  return nitrogenChapterEligible(progress)&&regionAvailable===true&&Array.isArray(progress?.foundElements)&&progress.foundElements.includes('N');
}

export function nitrogenCriticalInsightCandidate(state,{regionAvailable=NITROGEN_REGION_AVAILABLE,fieldContext=false,nitrogenEngaged=false,collectedElements={}}={}){
  const chapter=nitrogenChapterState(state,{regionAvailable});
  if(!chapter.eligible||!chapter.destinationAvailable||chapter.nitrogenKnown||fieldContext!==true||nitrogenEngaged!==true)return null;
  return Number(collectedElements?.N)>0?NITROGEN_MOLECULE_ID:null;
}

// NH3 is never injected into the graph. It becomes a chapter objective only if
// the ordinary direct-neighbor frontier already contains it after N2 discovery.
export function nitrogenFrontierObjective(graph,state){
  const chapter=nitrogenChapterState(state,{regionAvailable:true});
  if(!chapter.eligible||chapter.stage!=='ammonia-frontier')return null;
  const candidates=getFrontierCandidates(graph,{discoveredIds:state?.recipes??[],knownRecipeIds:state?.hints??[]}),candidate=candidates.find(row=>row.id===AMMONIA_MOLECULE_ID);
  return candidate?Object.freeze({...candidate,chapter:'nitrogen',priority:true}):null;
}

export function nitrogenGrowthGoal(state,{regionAvailable=NITROGEN_REGION_AVAILABLE}={}){
  const chapter=nitrogenChapterState(state,{regionAvailable});
  if(!chapter.eligible)return null;
  switch(chapter.playerStage){
    case 'eligible-waiting-field':return {text:'CHO探索クリア · 次の探索領域を準備中。自由探索でCHO分子や装備構成を試そう。'};
    case 'nitrogen-critical':return {text:'Nitrogen FIELDでNを集め、DRIVEで持続逆流を抜けよう。必要なら資源とSafe Siteのside pocketへ寄り、短いPULSE shearの先でN₂のInsightを探そう。'};
    case 'nitrogen-craft':return {id:NITROGEN_MOLECULE_ID,text:'得た構造をもとにN₂をCRAFTし、窒素系の噴射剤・冷却剤を使えるようにしよう。'};
    case 'ammonia-frontier':return {text:'N₂から図鑑Graphの直接隣接branchを辿り、Nitrogen FIELDでNH₃のInsightを探そう。'};
    case 'ammonia-craft':return {id:AMMONIA_MOLECULE_ID,text:'得た構造をもとにNH₃をCRAFTし、Nitrogen chapterの中核を完成させよう。'};
    case 'complete':return {text:'Nitrogen chapterの中核を完了。次の探索段階が実装されるまでは装備構成やGraph branchを試そう。'};
    default:return null;
  }
}
