import {REGIONS} from './growth.js';
import {NITROGEN_REGION_AVAILABLE,nitrogenChapterEligible} from './nitrogen-progression.js';
import {NITROGEN_REGION_ID} from './nitrogen-config.js';

export function isExpeditionDestinationAvailable(state,destinationId){
  if(typeof destinationId!=='string'||!destinationId)return false;
  const progress=state?.progress;
  if(!progress)return false;
  if(destinationId==='continue'){
    const checkpoint=progress.checkpoint;
    if(typeof checkpoint!=='string'||!Object.hasOwn(REGIONS,checkpoint))return false;
    return checkpoint!==NITROGEN_REGION_ID||NITROGEN_REGION_AVAILABLE&&nitrogenChapterEligible(progress);
  }
  if(destinationId===NITROGEN_REGION_ID)return NITROGEN_REGION_AVAILABLE&&nitrogenChapterEligible(progress)&&Object.hasOwn(REGIONS,NITROGEN_REGION_ID);
  return Object.hasOwn(REGIONS,destinationId)&&Array.isArray(progress.regions)&&progress.regions.includes(destinationId);
}

export function createExpeditionLaunchRequester({isAvailable,selectDestination,prepareLaunch}){
  if(typeof isAvailable!=='function'||typeof selectDestination!=='function'||typeof prepareLaunch!=='function')throw new TypeError('Launch requester requires availability, selection, and preparation callbacks.');
  return function requestExpeditionLaunch(destinationId){
    if(!isAvailable(destinationId))return false;
    if(selectDestination(destinationId)===false)return false;
    return prepareLaunch(destinationId)!==false;
  };
}
