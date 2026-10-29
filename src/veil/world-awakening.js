export const WORLD_AWAKENING_VERSION=1;

export const WORLD_PROGRESS_DEFAULTS=Object.freeze({
  coreFractured:false,
  worldAwakeningPending:false,
  worldAwakened:false,
  rareEcologyEligible:false,
});

export const DUST_EATER_WORLD_TUNING=Object.freeze({
  base:Object.freeze({
    safeSecondsMultiplier:1,threatPerSecondMultiplier:1,threatPerDustMultiplier:1,thresholdMultiplier:1,
    spawnDistanceMultiplier:1,spawnDelayMultiplier:1,speedMultiplier:1,earlyEncounterSeconds:Infinity,earlyEncounterCount:0,maxPursuers:5,
  }),
  awakened:Object.freeze({
    safeSecondsMultiplier:.55,threatPerSecondMultiplier:1.18,threatPerDustMultiplier:1.10,thresholdMultiplier:.80,
    spawnDistanceMultiplier:.92,spawnDelayMultiplier:.76,speedMultiplier:1.10,earlyEncounterSeconds:6,earlyEncounterCount:1,maxPursuers:6,
  }),
});

export function normalizeWorldAwakeningProgress(progress){
  if(!progress||typeof progress!=='object')return false;let changed=false;
  for(const [key,value] of Object.entries(WORLD_PROGRESS_DEFAULTS))if(typeof progress[key]!=='boolean'){progress[key]=value;changed=true;}
  if(progress.worldAwakened){
    if(!progress.coreFractured){progress.coreFractured=true;changed=true;}
    if(progress.worldAwakeningPending){progress.worldAwakeningPending=false;changed=true;}
    if(!progress.rareEcologyEligible){progress.rareEcologyEligible=true;changed=true;}
  }else if(progress.worldAwakeningPending&&!progress.coreFractured){progress.coreFractured=true;changed=true;}
  if(progress.rareEcologyEligible&&!progress.worldAwakened){progress.rareEcologyEligible=false;changed=true;}
  return changed;
}
export function worldAwakeningState(progress){
  const coreFractured=progress?.coreFractured===true,worldAwakeningPending=progress?.worldAwakeningPending===true,worldAwakened=progress?.worldAwakened===true,rareEcologyEligible=progress?.rareEcologyEligible===true&&worldAwakened;
  return Object.freeze({coreFractured,worldAwakeningPending:worldAwakened?false:worldAwakeningPending,worldAwakened,rareEcologyEligible,stage:worldAwakened?'awakened':worldAwakeningPending?'pending':coreFractured?'fractured':'intact'});
}
export function markCoreFractured(progress){if(!progress||typeof progress!=='object')return false;normalizeWorldAwakeningProgress(progress);if(progress.worldAwakened)return false;const changed=!progress.coreFractured||!progress.worldAwakeningPending;progress.coreFractured=true;progress.worldAwakeningPending=true;return changed;}
export function commitWorldAwakening(progress,{captured=false}={}){if(!progress||captured)return false;normalizeWorldAwakeningProgress(progress);if(!progress.worldAwakeningPending||progress.worldAwakened)return false;progress.coreFractured=true;progress.worldAwakeningPending=false;progress.worldAwakened=true;progress.rareEcologyEligible=true;return true;}
export const dustEaterWorldTuning=worldAwakened=>DUST_EATER_WORLD_TUNING[worldAwakened===true?'awakened':'base'];
