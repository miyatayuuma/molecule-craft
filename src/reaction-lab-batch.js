import { normalizeSpeciesSlots, planVisiblePopulation } from './reaction-lab-core.js?v=11';

export const REACTION_LAB_BATCH_PHASES=Object.freeze({IDLE:'IDLE',FLUSHING:'FLUSHING',FEEDING:'FEEDING',ACTIVE:'ACTIVE'});
const EMPTY_SLOTS=()=>['','',''];

export function planFeedSchedule(slots){
  const planned=planVisiblePopulation(slots),selectedCount=slots.filter(Boolean).length;
  return planned.map(entry=>{
    const slotIndex=slots.findIndex(species=>species===entry.species),waveIndex=selectedCount===1?entry.index:entry.index;
    return{...entry,slotIndex,waveIndex,startDelayMs:selectedCount===1?waveIndex*170:waveIndex*190+slotIndex*38};
  });
}

export function deterministicFeedVariation(slotIndex,waveIndex,copyIndex){
  const seed=(slotIndex+1)*17+(waveIndex+1)*29+(copyIndex+1)*11;
  const signed=value=>(value%9)/4.5-1;
  return{
    yaw:signed(seed%9)*.22,
    pitch:signed((seed*2+3)%9)*.16,
    roll:signed((seed*4+1)%9)*.18,
    angular:[signed((seed+2)%9)*.65,signed((seed*3+4)%9)*.65,signed((seed*5+7)%9)*.65],
    lateral:signed((seed*7+2)%9)*.16,
    speed:1+((seed*5)%7)*.035,
  };
}

export function createReactionLabBatch(records=[]){
  const knownIds=new Set(records.map(record=>record.id));
  let activeSlots=EMPTY_SLOTS(),draftSlots=EMPTY_SLOTS(),phase=REACTION_LAB_BATCH_PHASES.IDLE,generation=0;
  const snapshot=()=>({activeSlots:[...activeSlots],draftSlots:[...draftSlots],phase,generation});
  const locked=()=>phase===REACTION_LAB_BATCH_PHASES.FLUSHING||phase===REACTION_LAB_BATCH_PHASES.FEEDING;
  return{
    snapshot,
    get phase(){return phase;},
    get generation(){return generation;},
    get activeSlots(){return [...activeSlots];},
    get draftSlots(){return [...draftSlots];},
    setDraftSlot(index,species){
      if(!Number.isInteger(index)||index<0||index>=3)return{ok:false,reason:'invalid-slot'};
      if(locked())return{ok:false,reason:'transition-locked'};
      const proposed=[...draftSlots];proposed[index]=species||'';
      const normalized=normalizeSpeciesSlots(proposed,[...knownIds].map(id=>({id})));
      if(!normalized.ok)return normalized;
      draftSlots=normalized.slots;return{ok:true,slots:[...draftSlots]};
    },
    beginFeed({hasCurrentBatch=false}={}){
      if(locked())return{ok:false,reason:'transition-locked'};
      const normalized=normalizeSpeciesSlots(draftSlots,[...knownIds].map(id=>({id})));
      if(!normalized.ok)return normalized;
      const nextSlots=[...normalized.slots];
      if(!hasCurrentBatch&&!nextSlots.some(Boolean))return{ok:false,reason:'empty-batch'};
      generation++;
      activeSlots=nextSlots;
      phase=hasCurrentBatch?REACTION_LAB_BATCH_PHASES.FLUSHING:REACTION_LAB_BATCH_PHASES.FEEDING;
      return{ok:true,generation,phase,activeSlots:[...activeSlots],feedSchedule:planFeedSchedule(activeSlots)};
    },
    completeFlush(token){
      if(token!==generation||phase!==REACTION_LAB_BATCH_PHASES.FLUSHING)return{ok:false,reason:'stale-generation'};
      phase=activeSlots.some(Boolean)?REACTION_LAB_BATCH_PHASES.FEEDING:REACTION_LAB_BATCH_PHASES.IDLE;
      return{ok:true,generation,phase,activeSlots:[...activeSlots],feedSchedule:phase===REACTION_LAB_BATCH_PHASES.FEEDING?planFeedSchedule(activeSlots):[]};
    },
    completeFeed(token){
      if(token!==generation||phase!==REACTION_LAB_BATCH_PHASES.FEEDING)return{ok:false,reason:'stale-generation'};
      phase=activeSlots.some(Boolean)?REACTION_LAB_BATCH_PHASES.ACTIVE:REACTION_LAB_BATCH_PHASES.IDLE;
      return{ok:true,generation,phase};
    },
    invalidate(){generation++;phase=REACTION_LAB_BATCH_PHASES.IDLE;activeSlots=EMPTY_SLOTS();draftSlots=EMPTY_SLOTS();return generation;},
  };
}
